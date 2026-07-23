/**
 * consultas-ne-outros.js - Movimentacao de NEs fora do produto principal (grupo <> 1)
 * Informativo: nao entra no saldo/meta, mas explica divergencias de reconciliacao.
 */
const versao = require('./versao');
const { condAreaNE, condNeExterna, COL_NOME_AREA } = require('./consultas-ne');

const FILTRO_OUTROS = `
      AND sai_psai.i_sai <> 0
      AND EXISTS (
        SELECT 1 FROM bethadba.sai sai
        WHERE sai_psai.i_sai = sai.i_sai
          AND sai.i_produto_grupo IS NOT NULL
          AND sai.i_produto_grupo <> 1
      )`;

function queryEntradasOutros(nomeVersao, area = 'Escrita') {
  const inicio = versao.sqlInicioVersao(nomeVersao);
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT sai_psai.i_sai, sai_psai.i_psai, ${COL_NOME_AREA}, sai_psai.CadastroPSAI,
           sai_psai.gravidade_ne, psai.i_produto_grupo
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE ${condAreaNE(area)} AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.CadastroPSAI > ${inicio} AND sai_psai.CadastroPSAI <= ${fim}
      ${condNeExterna()} ${FILTRO_OUTROS}
  `;
}

function queryDescartesOutros(nomeVersao, area = 'Escrita') {
  const inicio = versao.sqlInicioVersao(nomeVersao);
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT sai_psai.i_sai, sai_psai.i_psai, ${COL_NOME_AREA}, sai_psai.Descarte,
           sai_psai.gravidade_ne, psai.i_produto_grupo
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE ${condAreaNE(area)} AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.Descarte > ${inicio} AND sai_psai.Descarte <= ${fim}
      ${condNeExterna()} ${FILTRO_OUTROS}
  `;
}

function filtroLiberadasVersao(nomeVersao) {
  const padrao = versao.padraoArquivoVersao(nomeVersao);
  return padrao
    ? `(sai_psai.nomeVersao = '${nomeVersao}' OR sai_psai.nomeVersao LIKE '${padrao}')
       AND sai_psai.Liberacao IS NOT NULL`
    : `sai_psai.nomeVersao = '${nomeVersao}' AND sai_psai.Liberacao IS NOT NULL`;
}

function queryLiberadasInternas(nomeVersao, area = 'Escrita') {
  return `
    SELECT sai_psai.i_sai, sai_psai.i_psai, ${COL_NOME_AREA}, sai_psai.Liberacao,
           sai_psai.gravidade_ne, sai_psai.nomeVersao, sai_psai.NE_PREVENCAO
    FROM UP.SAI_PSAI sai_psai
    WHERE ${condAreaNE(area)} AND sai_psai.tipoSAI = 'NE'
      AND ${filtroLiberadasVersao(nomeVersao)}
      AND COALESCE(sai_psai.NE_PREVENCAO, 0) = 1
  `;
}

function queryLiberadasOutros(nomeVersao, area = 'Escrita') {
  return `
    SELECT sai_psai.i_sai, sai_psai.i_psai, ${COL_NOME_AREA}, sai_psai.Liberacao,
           sai_psai.gravidade_ne, sai_psai.nomeVersao, psai.i_produto_grupo
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE ${condAreaNE(area)} AND sai_psai.tipoSAI = 'NE'
      AND ${filtroLiberadasVersao(nomeVersao)}
      AND psai.i_produto_grupo IS NOT NULL AND psai.i_produto_grupo <> 1
      ${condNeExterna()}
  `;
}

function mergeExcluidasLiberadas(internas, outros) {
  const map = new Map();
  (internas || []).forEach(r => map.set(r.i_psai, { ...r, _motivo: 'Prevencao interna' }));
  (outros || []).forEach(r => {
    if (!map.has(r.i_psai)) {
      map.set(r.i_psai, { ...r, _motivo: `Grupo ${r.i_produto_grupo}` });
    }
  });
  return [...map.values()];
}

module.exports = {
  queryEntradasOutros, queryDescartesOutros,
  queryLiberadasOutros, queryLiberadasInternas, mergeExcluidasLiberadas
};
