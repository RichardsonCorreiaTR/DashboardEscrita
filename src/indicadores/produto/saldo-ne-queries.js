/**
 * saldo-ne-queries.js - Queries SQL do indicador saldo-ne
 */
const versao = require('../../core/versao');
const { condAreaNE, condNeExterna, FILTRO_PRODUTO_ENTRADA } = require('../../core/consultas-ne');

function baseSaldo(nomeVersao, area, cols) {
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT ${cols}
    FROM UP.SAI_PSAI sai_psai
    WHERE ${condAreaNE(area)}
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.i_sai <> 0
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (sai_psai.Liberacao IS NULL OR sai_psai.Liberacao > ${fim})
      AND (sai_psai.Descarte IS NULL OR sai_psai.Descarte > ${fim})
      ${condNeExterna()}
      ${FILTRO_PRODUTO_ENTRADA}
    UNION ALL
    SELECT ${cols}
    FROM UP.SAI_PSAI sai_psai
    WHERE ${condAreaNE(area)}
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.i_sai = 0
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (sai_psai.Descarte IS NULL OR sai_psai.Descarte > ${fim})
      ${condNeExterna()}
      ${FILTRO_PRODUTO_ENTRADA}
  `;
}

function querySaldo(nomeVersao, area = 'Escrita') {
  return `SELECT COUNT(*) as saldo FROM (${baseSaldo(nomeVersao, area, 'sai_psai.i_psai')}) t`;
}

function queryGrupoA(nomeVersao, area = 'Escrita') {
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT COUNT(*) as qtd FROM UP.SAI_PSAI sai_psai
    WHERE ${condAreaNE(area)} AND sai_psai.tipoSAI = 'NE' AND sai_psai.i_sai <> 0
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (sai_psai.Liberacao IS NULL OR sai_psai.Liberacao > ${fim})
      AND (sai_psai.Descarte IS NULL OR sai_psai.Descarte > ${fim})
      ${condNeExterna()} ${FILTRO_PRODUTO_ENTRADA}
  `;
}

function queryGrupoB(nomeVersao, area = 'Escrita') {
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT COUNT(*) as qtd FROM UP.SAI_PSAI sai_psai
    WHERE ${condAreaNE(area)} AND sai_psai.tipoSAI = 'NE' AND sai_psai.i_sai = 0
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (sai_psai.Descarte IS NULL OR sai_psai.Descarte > ${fim})
      ${condNeExterna()} ${FILTRO_PRODUTO_ENTRADA}
  `;
}

function queryGravidade(nomeVersao, area = 'Escrita') {
  return `
    SELECT gravidade_ne, COUNT(*) as qtd FROM (
      ${baseSaldo(nomeVersao, area, 'sai_psai.i_psai, sai_psai.gravidade_ne')}
    ) t GROUP BY gravidade_ne
  `;
}

module.exports = { querySaldo, queryGrupoA, queryGrupoB, queryGravidade };
