/**
 * entrada-ne.js - Acompanhamento de entrada de NEs por versao
 *
 * Nao e meta formal, mas impacta diretamente o saldo.
 * Usa periodo de versao (PIAZZA functions).
 *
 * Formula:
 * - Entradas = CadastroPSAI dentro do periodo da versao
 * - Descartes = Descarte dentro do periodo da versao
 * - Liberacoes = nomeVersao = versao (liberacao real)
 * - produto_grupo = 1 (ou NULL) via EXISTS bethadba.sai + i_sai=0
 * - NE_PREVENCAO: NAO e filtro, e detalhamento (interna vs externa)
 *
 * Periodicidade: por versao (mensal) e semanal (futuro)
 */

const versao = require('../../core/versao');
const consultasNE = require('../../core/consultas-ne');

/**
 * Query: entradas e descartes dentro do periodo de uma versao
 * Inclui NE_PREVENCAO como campo de classificacao (nao como filtro)
 */
function queryMovimentacao(nomeVersao) {
  const inicio = versao.sqlInicioVersao(nomeVersao);
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT
      sai_psai.NE_PREVENCAO as ne_prevencao,
      CASE
        WHEN sai_psai.CadastroPSAI > ${inicio}
             AND sai_psai.CadastroPSAI <= ${fim}
        THEN 1 ELSE 0
      END as eh_entrada,
      CASE
        WHEN sai_psai.Descarte > ${inicio}
             AND sai_psai.Descarte <= ${fim}
        THEN 1 ELSE 0
      END as eh_descarte
    FROM UP.SAI_PSAI sai_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND (
        (sai_psai.CadastroPSAI > ${inicio}
         AND sai_psai.CadastroPSAI <= ${fim})
        OR
        (sai_psai.Descarte > ${inicio}
         AND sai_psai.Descarte <= ${fim})
      )
      AND (
        EXISTS (
          SELECT 1 FROM bethadba.sai sai
          WHERE sai_psai.i_sai = sai.i_sai
            AND (sai.i_produto_grupo IS NULL OR sai.i_produto_grupo = 1)
        )
        OR sai_psai.i_sai = 0
      )
  `;
}

/**
 * Query: liberacoes reais na versao (nomeVersao + Liberacao preenchidos)
 * Inclui liberacoes via arquivo de versao (antecipacao).
 */
function queryLiberacoes(nomeVersao) {
  const padrao = versao.padraoArquivoVersao(nomeVersao);
  const filtroArquivo = padrao
    ? `OR (sai_psai.nomeVersao LIKE '${padrao}' AND sai_psai.Liberacao IS NOT NULL)`
    : '';
  return `
    SELECT COUNT(*) as liberacoes
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND (
        (sai_psai.nomeVersao = '${nomeVersao}' AND sai_psai.Liberacao IS NOT NULL)
        ${filtroArquivo}
      )
      AND COALESCE(psai.i_produto_grupo, 1) = 1
  `;
}

/**
 * Processa registros e consolida contagens com detalhamento interno/externo
 * @param {Object[]} registros - Resultado da query
 * @returns {{entradas: number, descartes: number, internas: Object, externas: Object}}
 */
function consolidarMovimentacao(registros) {
  let entradas = 0;
  let descartes = 0;
  let entradasInternas = 0;
  let entradasExternas = 0;
  let descartesInternos = 0;
  let descartesExternos = 0;

  for (const r of registros) {
    const isInterna = r.ne_prevencao === 1;

    if (r.eh_entrada === 1) {
      entradas++;
      if (isInterna) entradasInternas++;
      else entradasExternas++;
    }
    if (r.eh_descarte === 1) {
      descartes++;
      if (isInterna) descartesInternos++;
      else descartesExternos++;
    }
  }

  return {
    entradas,
    descartes,
    origem: {
      internas: { entradas: entradasInternas, descartes: descartesInternos },
      externas: { entradas: entradasExternas, descartes: descartesExternos }
    }
  };
}

module.exports = {
  id: 'entrada-ne',
  nome: 'Acompanhamento de Entrada de NEs',
  categoria: 'produto',
  cacheTTL: 60 * 60 * 1000,

  async calcular(executor, opcoes = {}) {
    const nomeVersao = opcoes.versao
      || versao.nomeDaVersao(
        opcoes.ano || new Date().getFullYear(),
        opcoes.mes || (new Date().getMonth() + 1)
      );

    const versaoAnt = versao.versaoAnterior(nomeVersao);

    const [movResult, libResult, movAntResult, libAntResult,
           descSitResult, descListaResult, entradasDetalheResult
    ] = await Promise.all([
      executor.executar(queryMovimentacao(nomeVersao)),
      executor.executar(queryLiberacoes(nomeVersao)),
      versaoAnt ? executor.executar(queryMovimentacao(versaoAnt)) : Promise.resolve([]),
      versaoAnt ? executor.executar(queryLiberacoes(versaoAnt)) : Promise.resolve(null),
      executor.executar(consultasNE.queryDescartesPorSituacao(nomeVersao)),
      executor.executar(consultasNE.queryDescartes(nomeVersao)),
      executor.executar(consultasNE.queryEntradasDetalhe(nomeVersao))
    ]);

    if (!movResult) {
      return {
        valor: null, meta: null, pct: null, status: 'erro',
        detalhes: {},
        validacao: { ok: false, registros_lidos: 0, problemas: ['Query retornou vazio'] }
      };
    }

    const atual = consolidarMovimentacao(movResult);
    const libAtual = libResult ? libResult[0].liberacoes : 0;
    const anterior = consolidarMovimentacao(movAntResult || []);
    const libAnterior = libAntResult ? libAntResult[0].liberacoes : 0;

    return {
      valor: atual.entradas,
      meta: null,
      pct: null,
      status: 'info',
      detalhes: {
        versao: nomeVersao,
        entradas: atual.entradas,
        descartes: atual.descartes,
        liberacoes: libAtual,
        variacao_saldo: atual.entradas - atual.descartes - libAtual,
        origem: atual.origem,
        entradas_lista: entradasDetalheResult || [],
        descartes_por_situacao: descSitResult || [],
        descartes_lista: descListaResult || [],
        versao_anterior: versaoAnt ? {
          versao: versaoAnt,
          entradas: anterior.entradas,
          descartes: anterior.descartes,
          liberacoes: libAnterior,
          variacao_saldo: anterior.entradas - anterior.descartes - libAnterior,
          origem: anterior.origem
        } : null
      },
      validacao: {
        ok: true,
        registros_lidos: movResult.length,
        registros_usados: movResult.length,
        avisos: []
      }
    };
  }
};
