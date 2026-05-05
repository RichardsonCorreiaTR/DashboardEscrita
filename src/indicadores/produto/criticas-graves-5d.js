/**
 * criticas-graves-5d.js - NEs Criticas/Graves liberadas em ate 5 dias uteis
 *
 * Diretriz 1.4.3 (codigo SGD: 143635)
 * Meta 2026: 90% liberadas em ate 5 dias uteis
 *
 * Formula: (Criticas+Graves liberadas em <=5d uteis / Total) * 100
 *
 * Regras:
 * - "Liberada" = tem nomeVersao preenchido (liberacao real em versao)
 * - Dias contados de CadastroPSAI ate Liberacao (dias uteis)
 * - Se nao houver Criticas/Graves no periodo: valor = 0, status = verde
 * - Filtro i_produto_grupo = 1 (ou NULL) via bethadba.psai
 *
 * Doc: docs/diretrizes/1-produto/1.4-controladas-coordenacao/1.4.3-criticas-graves-5-dias.md
 */

const { contarDiasUteis } = require('../../core/date-utils');
const versao = require('../../core/versao');

const META_PCT = 90;
const LIMITE_DIAS_UTEIS = 5;

/**
 * Query: Criticas/Graves liberadas na versao OU em arquivo (antecipacao).
 * Mesmo padrao do tempo-correcao-ne: versao direta + arquivo da anterior.
 */
function queryLiberadas(nomeVersao) {
  const padraoArquivo = versao.padraoArquivoVersao(nomeVersao);
  const filtroVersao = padraoArquivo
    ? `(sai_psai.nomeVersao = '${nomeVersao}' OR sai_psai.nomeVersao LIKE '${padraoArquivo}')`
    : `sai_psai.nomeVersao = '${nomeVersao}'`;
  return `
    SELECT
      sai_psai.i_sai, sai_psai.i_psai, sai_psai.gravidade_ne,
      sai_psai.CadastroPSAI, sai_psai.Liberacao, sai_psai.nomeVersao
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.gravidade_ne IN ('Critica', 'Grave')
      AND ${filtroVersao}
      AND sai_psai.Liberacao IS NOT NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
  `;
}

/** Query: Criticas/Graves atualmente abertas (no saldo) */
function queryAbertas(nomeVersao) {
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT
      sai_psai.i_sai, sai_psai.i_psai, sai_psai.gravidade_ne,
      sai_psai.CadastroPSAI,
      DATEDIFF(day, sai_psai.CadastroPSAI, GETDATE()) as dias_corridos
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.gravidade_ne IN ('Critica', 'Grave')
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (COALESCE(sai_psai.Liberacao, '3000-12-01') > ${fim})
      AND (COALESCE(sai_psai.Descarte, '3000-12-01') > ${fim})
      AND COALESCE(psai.i_produto_grupo, 1) = 1
  `;
}

/**
 * Processa registros e calcula dias uteis para cada um
 * @param {Object[]} dados - Registros do banco
 * @returns {{total: number, dentro5d: number, detalhes: Object[]}}
 */
function calcularDiasUteis(dados) {
  const detalhes = dados.map(d => {
    const diasUteis = contarDiasUteis(d.CadastroPSAI, d.Liberacao);
    return {
      i_sai: d.i_sai,
      i_psai: d.i_psai,
      gravidade: d.gravidade_ne,
      cadastro: d.CadastroPSAI,
      liberacao: d.Liberacao,
      via: d.nomeVersao || '--',
      dias_uteis: diasUteis,
      dentro_5d: diasUteis <= LIMITE_DIAS_UTEIS
    };
  });

  return {
    total: detalhes.length,
    dentro5d: detalhes.filter(d => d.dentro_5d).length,
    detalhes
  };
}

function determinarSemaforo(pct, total, totalAbertas) {
  if (total === 0) return totalAbertas > 0 ? 'amarelo' : 'verde';
  if (pct >= META_PCT) return 'verde';
  if (pct >= 70) return 'amarelo';
  return 'vermelho';
}

module.exports = {
  id: 'criticas-graves-5d',
  nome: 'NEs Criticas/Graves em ate 5 Dias Uteis',
  categoria: 'produto',
  cacheTTL: 30 * 60 * 1000,

  async calcular(executor, opcoes = {}) {
    const nomeVersao = opcoes.versao
      || versao.nomeDaVersao(
        opcoes.ano || new Date().getFullYear(),
        opcoes.mes || (new Date().getMonth() + 1)
      );

    const [liberadasResult, abertasResult] = await Promise.all([
      executor.executar(queryLiberadas(nomeVersao)),
      executor.executar(queryAbertas(nomeVersao))
    ]);

    if (!liberadasResult) {
      return {
        valor: null, meta: META_PCT, pct: null, status: 'erro',
        detalhes: {},
        validacao: { ok: false, registros_lidos: 0, problemas: ['Query retornou vazio'] }
      };
    }

    const periodo = calcularDiasUteis(liberadasResult);
    const totalAbertas = (abertasResult || []).length;

    const valor = periodo.total === 0
      ? 0
      : Math.round((periodo.dentro5d / periodo.total) * 1000) / 10;

    return {
      valor,
      meta: META_PCT,
      pct: periodo.total === 0 ? null : Math.round((valor / META_PCT) * 100),
      status: determinarSemaforo(valor, periodo.total, totalAbertas),
      detalhes: {
        versao: nomeVersao,
        total_periodo: periodo.total,
        dentro_5d: periodo.dentro5d,
        fora_5d: periodo.total - periodo.dentro5d,
        total_abertas: totalAbertas,
        abertas_agora: abertasResult || [],
        casos: periodo.detalhes,
        casos_fora_5d: periodo.detalhes.filter(d => !d.dentro_5d)
      },
      validacao: {
        ok: true,
        registros_lidos: liberadasResult.length,
        registros_usados: periodo.total,
        avisos: periodo.total === 0
          ? [totalAbertas > 0
            ? `Nenhuma liberada na versao, mas ${totalAbertas} Critica(s)/Grave(s) abertas no saldo`
            : 'Nenhuma NE Critica/Grave na versao']
          : []
      }
    };
  }
};
