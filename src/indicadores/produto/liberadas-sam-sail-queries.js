/**
 * liberadas-sam-sail-queries.js - SAIs SAM/SAIL liberadas na versao
 */
const versaoUtil = require('../../core/versao');
const { condAreaNE } = require('../../core/consultas-ne');

function filtroLib(v) {
  const p = versaoUtil.padraoArquivoVersao(v);
  return p
    ? `(sp.nomeVersao = '${v}' OR sp.nomeVersao LIKE '${p}')`
    : `sp.nomeVersao = '${v}'`;
}

const COL_NOME_AREA = `CAST(TRIM(sp.nomeArea) AS BINARY(32)) as nomeArea`;
const FILTRO_TIPO = "sp.tipoSAI IN ('SAM', 'SAIL')";

function queryContagem(nomeVersao, area = 'Escrita') {
  return `
    SELECT sp.tipoSAI, COUNT(*) as qtd
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE ${condAreaNE(area, 'sp')}
      AND ${FILTRO_TIPO}
      AND ${filtroLib(nomeVersao)}
      AND sp.Liberacao IS NOT NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
    GROUP BY sp.tipoSAI
  `;
}

function queryLista(nomeVersao, area = 'Escrita') {
  return `
    SELECT sp.i_sai, sp.i_psai, sp.tipoSAI, sp.nomeVersao, sp.Liberacao,
           sp.gravidade_ne, ${COL_NOME_AREA}
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE ${condAreaNE(area, 'sp')}
      AND ${FILTRO_TIPO}
      AND ${filtroLib(nomeVersao)}
      AND sp.Liberacao IS NOT NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
    ORDER BY sp.tipoSAI, sp.i_sai
  `;
}

module.exports = { queryContagem, queryLista };
