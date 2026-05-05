/**
 * saldo-ne.js - Indicador: Saldo de NEs da area Escrita
 *
 * Diretriz 1.4.1 (codigo SGD: 143633)
 * Meta 2026: 222 NEs ao final do ano
 *
 * Formula (logica correta - independente de versao):
 *   Saldo = Grupo A: NEs que possuem SAI gerada (i_sai <> 0)
 *                    sem Liberacao nem Descarte
 *         + Grupo B: PSAIs de NE sem SAI gerada (i_sai = 0)
 *                    sem Descarte (pendentes de analise)
 *   Ambos com produto_grupo = 1 (ou NULL)
 *
 * Documentacao: docs/diretrizes/1-produto/1.4-controladas-coordenacao/1.4.1-saldo-ne.md
 */

const versao = require('../../core/versao');
const consultasNE = require('../../core/consultas-ne');

/**
 * Metas mensais Escrita Fiscal 2026 (jan a dez).
 * Revisadas para a area Escrita — demais meses a confirmar.
 */
const METAS_MENSAIS = [90, 84, 92, 95, 100, 92, 104, 103, 103, 102, 90, 98];
//                     jan  fev  mar  abr  mai  jun  jul  ago  set  out  nov  dez
const META_ANUAL = 98;

/**
 * Saldo por versao (atual ou historico).
 *
 * Para versao em andamento (FIM_VERSAO no futuro): equivale ao estado real
 * atual, pois CadastroPSAI <= data_futura inclui todos os registros existentes
 * e Liberacao/Descarte > data_futura exclui apenas eventos que ainda nao ocorreram.
 *
 * Para versoes passadas: reconstroi o saldo no fechamento daquela versao.
 *
 * Grupo A: NEs com SAI (i_sai <> 0) abertas no fechamento da versao.
 * Grupo B: PSAIs sem SAI (i_sai = 0) pendentes no fechamento da versao.
 */
function querySaldo(nomeVersao) {
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT COUNT(*) as saldo
    FROM (
      SELECT sai_psai.i_psai
      FROM UP.SAI_PSAI sai_psai
      WHERE sai_psai.nomeArea = 'Escrita'
        AND sai_psai.tipoSAI = 'NE'
        AND sai_psai.i_sai <> 0
        AND sai_psai.CadastroPSAI <= ${fim}
        AND (sai_psai.Liberacao IS NULL OR sai_psai.Liberacao > ${fim})
        AND (sai_psai.Descarte IS NULL OR sai_psai.Descarte > ${fim})
      UNION ALL
      SELECT sai_psai.i_psai
      FROM UP.SAI_PSAI sai_psai
      WHERE sai_psai.nomeArea = 'Escrita'
        AND sai_psai.tipoSAI = 'NE'
        AND sai_psai.i_sai = 0
        AND sai_psai.CadastroPSAI <= ${fim}
        AND (sai_psai.Descarte IS NULL OR sai_psai.Descarte > ${fim})
    ) t
  `;
}

function queryGrupoA(nomeVersao) {
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT COUNT(*) as qtd
    FROM UP.SAI_PSAI sai_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.i_sai <> 0
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (sai_psai.Liberacao IS NULL OR sai_psai.Liberacao > ${fim})
      AND (sai_psai.Descarte IS NULL OR sai_psai.Descarte > ${fim})
  `;
}

function queryGrupoB(nomeVersao) {
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT COUNT(*) as qtd
    FROM UP.SAI_PSAI sai_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.i_sai = 0
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (sai_psai.Descarte IS NULL OR sai_psai.Descarte > ${fim})
  `;
}

function queryGravidade(nomeVersao) {
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT gravidade_ne, COUNT(*) as qtd
    FROM (
      SELECT sai_psai.i_psai, sai_psai.gravidade_ne
      FROM UP.SAI_PSAI sai_psai
      WHERE sai_psai.nomeArea = 'Escrita'
        AND sai_psai.tipoSAI = 'NE'
        AND sai_psai.i_sai <> 0
        AND sai_psai.CadastroPSAI <= ${fim}
        AND (sai_psai.Liberacao IS NULL OR sai_psai.Liberacao > ${fim})
        AND (sai_psai.Descarte IS NULL OR sai_psai.Descarte > ${fim})
      UNION ALL
      SELECT sai_psai.i_psai, sai_psai.gravidade_ne
      FROM UP.SAI_PSAI sai_psai
      WHERE sai_psai.nomeArea = 'Escrita'
        AND sai_psai.tipoSAI = 'NE'
        AND sai_psai.i_sai = 0
        AND sai_psai.CadastroPSAI <= ${fim}
        AND (sai_psai.Descarte IS NULL OR sai_psai.Descarte > ${fim})
    ) t
    GROUP BY gravidade_ne
  `;
}

/**
 * Retorna a meta do mes (pelo indice da versao)
 * @param {number} indice - Indice 0-11
 * @returns {number}
 */
function obterMeta(indice) {
  return METAS_MENSAIS[indice] || META_ANUAL;
}

function determinarSemaforo(saldo, meta) {
  if (saldo <= meta) return 'verde';
  if (saldo <= meta * 1.10) return 'amarelo';
  return 'vermelho';
}

module.exports = {
  id: 'saldo-ne',
  nome: 'Saldo de NEs',
  categoria: 'produto',
  cacheTTL: 30 * 60 * 1000,

  async calcular(executor, opcoes = {}) {
    const nomeVersao = opcoes.versao
      || versao.nomeDaVersao(
        opcoes.ano || new Date().getFullYear(),
        opcoes.mes || (new Date().getMonth() + 1)
      );

    const parsed = versao.parsearNomeVersao(nomeVersao);
    const indice = parsed ? parsed.indice : (new Date().getMonth());
    const versaoAnteriorNome = versao.versaoAnterior(nomeVersao);

    // Queries de arquivo podem retornar null se nao houver versao anterior
    const qLibArq = consultasNE.queryLiberadasArquivo(nomeVersao);
    const qEmArq = consultasNE.queryEmArquivo(nomeVersao);

    const [saldoResult, gravidadeResult, saldoAnteriorResult,
           entradasResult, descartesResult, liberadasResult, pendentesResult,
           libArquivoResult, emArquivoResult, alocadasResult,
           grupoAResult, grupoBResult
    ] = await Promise.all([
      executor.executar(querySaldo(nomeVersao)),
      executor.executar(queryGravidade(nomeVersao)),
      versaoAnteriorNome
        ? executor.executar(querySaldo(versaoAnteriorNome))
        : Promise.resolve(null),
      executor.executar(consultasNE.queryEntradas(nomeVersao)),
      executor.executar(consultasNE.queryDescartes(nomeVersao)),
      executor.executar(consultasNE.queryLiberadas(nomeVersao)),
      executor.executar(consultasNE.queryPendentes(nomeVersao)),
      qLibArq ? executor.executar(qLibArq) : Promise.resolve([]),
      qEmArq ? executor.executar(qEmArq) : Promise.resolve([]),
      executor.executar(consultasNE.queryAlocadas(nomeVersao)),
      executor.executar(queryGrupoA(nomeVersao)),
      executor.executar(queryGrupoB(nomeVersao))
    ]);

    if (!saldoResult || saldoResult.length === 0) {
      return {
        valor: null, meta: null, pct: null, status: 'erro',
        detalhes: {},
        validacao: { ok: false, registros_lidos: 0, problemas: ['Query retornou vazio'] }
      };
    }

    const saldo = saldoResult[0].saldo;
    const meta = opcoes.meta || obterMeta(indice);
    const pct = meta ? Math.round((saldo / meta) * 100 * 10) / 10 : null;
    const saldoAnterior = saldoAnteriorResult
      ? saldoAnteriorResult[0].saldo
      : null;
    const grupoA = grupoAResult && grupoAResult.length ? grupoAResult[0].qtd : null;
    const grupoB = grupoBResult && grupoBResult.length ? grupoBResult[0].qtd : null;

    return {
      valor: saldo,
      meta,
      pct,
      status: determinarSemaforo(saldo, meta),
      detalhes: {
        versao: nomeVersao,
        versao_anterior: versaoAnteriorNome,
        saldo_versao_anterior: saldoAnterior,
        variacao: saldoAnterior !== null ? saldo - saldoAnterior : null,
        grupo_a: grupoA,
        grupo_b: grupoB,
        por_gravidade: gravidadeResult || [],
        meta_anual: META_ANUAL,
        metas_mensais: METAS_MENSAIS,
        movimentacao: {
          entradas: entradasResult || [],
          descartes: descartesResult || [],
          liberadas: liberadasResult || [],
          pendentes: pendentesResult || [],
          liberadas_arquivo: libArquivoResult || [],
          em_arquivo: emArquivoResult || [],
          alocadas: alocadasResult || []
        }
      },
      validacao: {
        ok: true,
        registros_lidos: saldo,
        registros_usados: saldo,
        avisos: saldo === 0 ? ['Saldo zerado - verificar filtros'] : []
      }
    };
  }
};
