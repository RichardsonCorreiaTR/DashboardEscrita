/**
 * entrada-sal.js - Acompanhamento de entrada de SALs por versao
 */
const versao = require('../../core/versao');
const consultasSAL = require('../../core/consultas-sal');
const { condNeExterna } = require('../../core/consultas-ne');
const { enriquecerNomeArea } = require('../../core/consultas-ne-enriquecer');

const METAS_MENSAIS = [30, 30, 35, 20, 25, 20, 30, 35, 25, 25, 22, 30];
const META_ANUAL = 30;

function obterMeta(indice) { return METAS_MENSAIS[indice] || META_ANUAL; }

function determinarSemaforo(entradas, meta) {
  if (meta == null) return 'info';
  if (entradas <= meta) return 'verde';
  if (entradas <= meta * 1.10) return 'amarelo';
  return 'vermelho';
}

function queryMovimentacao(nomeVersao, area = 'Escrita') {
  const inicio = versao.sqlInicioVersao(nomeVersao);
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT
      CASE WHEN sai_psai.CadastroPSAI > ${inicio} AND sai_psai.CadastroPSAI <= ${fim} THEN 1 ELSE 0 END as eh_entrada,
      CASE WHEN sai_psai.Descarte > ${inicio} AND sai_psai.Descarte <= ${fim} THEN 1 ELSE 0 END as eh_descarte
    FROM UP.SAI_PSAI sai_psai
    WHERE ${consultasSAL.condAreaNE(area)}
      AND sai_psai.tipoSAI = 'SAL'
      AND (
        (sai_psai.CadastroPSAI > ${inicio} AND sai_psai.CadastroPSAI <= ${fim})
        OR (sai_psai.Descarte > ${inicio} AND sai_psai.Descarte <= ${fim})
      )
      AND (
        EXISTS (
          SELECT 1 FROM bethadba.sai sai
          WHERE sai_psai.i_sai = sai.i_sai
            AND (sai.i_produto_grupo IS NULL OR sai.i_produto_grupo = 1)
        )
        OR sai_psai.i_sai = 0
      )
      ${condNeExterna()}
  `;
}

function queryLiberacoes(nomeVersao, area = 'Escrita') {
  const padrao = versao.padraoArquivoVersao(nomeVersao);
  const filtroArquivo = padrao
    ? `OR (sai_psai.nomeVersao LIKE '${padrao}' AND sai_psai.Liberacao IS NOT NULL)`
    : '';
  return `
    SELECT COUNT(*) as liberacoes
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE ${consultasSAL.condAreaNE(area)}
      AND sai_psai.tipoSAI = 'SAL'
      AND (
        (sai_psai.nomeVersao = '${nomeVersao}' AND sai_psai.Liberacao IS NOT NULL)
        ${filtroArquivo}
      )
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      ${condNeExterna()}
  `;
}

function consolidarMovimentacao(registros) {
  let entradas = 0;
  let descartes = 0;
  for (const r of registros) {
    if (r.eh_entrada === 1) entradas++;
    if (r.eh_descarte === 1) descartes++;
  }
  return { entradas, descartes };
}

module.exports = {
  id: 'entrada-sal',
  nome: 'Entrada de SALs',
  categoria: 'produto',
  cacheTTL: 60 * 60 * 1000,

  async calcular(executor, opcoes = {}) {
    const nomeVersao = opcoes.versao
      || versao.nomeDaVersao(opcoes.ano || new Date().getFullYear(), opcoes.mes || (new Date().getMonth() + 1));
    const area = opcoes.area || 'Escrita';
    const parsed = versao.parsearNomeVersao(nomeVersao);
    const indice = parsed ? parsed.indice : (new Date().getMonth());
    const versaoAnt = versao.versaoAnterior(nomeVersao);

    const [movResult, libResult, movAntResult, libAntResult,
      descSitResult, descListaResult, entradasDetalheResult
    ] = await Promise.all([
      executor.executar(queryMovimentacao(nomeVersao, area)),
      executor.executar(queryLiberacoes(nomeVersao, area)),
      versaoAnt ? executor.executar(queryMovimentacao(versaoAnt, area)) : Promise.resolve([]),
      versaoAnt ? executor.executar(queryLiberacoes(versaoAnt, area)) : Promise.resolve(null),
      executor.executar(consultasSAL.queryDescartesPorSituacao(nomeVersao, area)),
      executor.executar(consultasSAL.queryDescartes(nomeVersao, area)),
      executor.executar(consultasSAL.queryEntradasDetalhe(nomeVersao, area))
    ]);

    if (!movResult) {
      return {
        valor: null, meta: null, pct: null, status: 'erro', detalhes: {},
        validacao: { ok: false, registros_lidos: 0, problemas: ['Query retornou vazio'] }
      };
    }

    const atual = consolidarMovimentacao(movResult);
    const libAtual = libResult ? libResult[0].liberacoes : 0;
    const anterior = consolidarMovimentacao(movAntResult || []);
    const libAnterior = libAntResult ? libAntResult[0].liberacoes : 0;
    const entradasLista = entradasDetalheResult || [];
    const descartesLista = descListaResult || [];
    if (area === 'Ambas') await enriquecerNomeArea(executor, entradasLista, descartesLista);

    const meta = opcoes.meta || obterMeta(indice);
    const pct = meta ? Math.round((atual.entradas / meta) * 100 * 10) / 10 : null;

    return {
      valor: atual.entradas,
      meta,
      pct,
      status: determinarSemaforo(atual.entradas, meta),
      detalhes: {
        versao: nomeVersao,
        entradas: atual.entradas,
        descartes: atual.descartes,
        liberacoes: libAtual,
        variacao_saldo: atual.entradas - atual.descartes - libAtual,
        meta_anual: META_ANUAL,
        metas_mensais: METAS_MENSAIS,
        entradas_lista: entradasLista,
        descartes_por_situacao: descSitResult || [],
        descartes_lista: descartesLista,
        versao_anterior: versaoAnt ? {
          versao: versaoAnt,
          entradas: anterior.entradas,
          descartes: anterior.descartes,
          liberacoes: libAnterior,
          variacao_saldo: anterior.entradas - anterior.descartes - libAnterior
        } : null
      },
      validacao: { ok: true, registros_lidos: movResult.length, registros_usados: movResult.length, avisos: [] }
    };
  }
};
