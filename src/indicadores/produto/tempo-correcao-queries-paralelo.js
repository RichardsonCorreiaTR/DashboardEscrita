/**
 * tempo-correcao-queries-paralelo.js - Tempo em versoes paralelas (periodo da versao)
 */
const versaoUtil = require('../../core/versao');
const { condAreaNE } = require('../../core/consultas-ne');

const COL_NOME_AREA_SP = `CAST(TRIM(sp.nomeArea) AS BINARY(32)) as nomeArea`;
const FILTRO_PARALELO = "SUBSTR(sp.nomeVersao, 1, 1) NOT BETWEEN '0' AND '9'";

function queryParaleloDev(v, area = 'Escrita') {
  const ini = versaoUtil.sqlInicioVersao(v);
  const fim = versaoUtil.sqlFimVersao(v);
  return `
    SELECT SUM(rd.tempo_realizado) as par_dev
    FROM bethadba.sai_roteiro_desenvolvimento rd
    JOIN UP.SAI_PSAI sp ON rd.i_sai = sp.i_sai
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE rd.data_exclusao IS NULL
      AND rd.data_conclusao >= ${ini} AND rd.data_conclusao <= ${fim}
      AND ${condAreaNE(area, 'sp')} AND ${FILTRO_PARALELO}
      AND COALESCE(psai.i_produto_grupo, 1) = 1 AND sp.i_sai > 0
  `;
}

function queryParaleloTeste(v, area = 'Escrita') {
  const ini = versaoUtil.sqlInicioVersao(v);
  const fim = versaoUtil.sqlFimVersao(v);
  return `
    SELECT SUM(rt.tempo_teste_realizado) as par_teste,
           SUM(rt.tempo_preparacao_realizado) as par_prep
    FROM bethadba.sai_roteiro_testes rt
    JOIN UP.SAI_PSAI sp ON rt.i_sai = sp.i_sai
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE rt.data_exclusao IS NULL
      AND rt.data_conclusao >= ${ini} AND rt.data_conclusao <= ${fim}
      AND ${condAreaNE(area, 'sp')} AND ${FILTRO_PARALELO}
      AND COALESCE(psai.i_produto_grupo, 1) = 1 AND sp.i_sai > 0
  `;
}

function queryDetalheParaleloDev(v, area = 'Escrita') {
  const ini = versaoUtil.sqlInicioVersao(v);
  const fim = versaoUtil.sqlFimVersao(v);
  return `
    SELECT sp.i_sai, sp.i_psai, sp.tipoSAI, sp.nomeVersao, ${COL_NOME_AREA_SP},
           COALESCE(sp.NE_PREVENCAO, 0) as ne_prevencao,
           COALESCE(SUM(rd.tempo_realizado), 0) as dev
    FROM bethadba.sai_roteiro_desenvolvimento rd
    JOIN UP.SAI_PSAI sp ON rd.i_sai = sp.i_sai
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE rd.data_exclusao IS NULL
      AND rd.data_conclusao >= ${ini} AND rd.data_conclusao <= ${fim}
      AND ${condAreaNE(area, 'sp')} AND ${FILTRO_PARALELO}
      AND COALESCE(psai.i_produto_grupo, 1) = 1 AND sp.i_sai > 0
    GROUP BY sp.i_sai, sp.i_psai, sp.tipoSAI, sp.nomeVersao, sp.nomeArea, sp.NE_PREVENCAO
  `;
}

function queryDetalheParaleloTeste(v, area = 'Escrita') {
  const ini = versaoUtil.sqlInicioVersao(v);
  const fim = versaoUtil.sqlFimVersao(v);
  return `
    SELECT sp.i_sai,
           COALESCE(SUM(rt.tempo_teste_realizado), 0) as teste,
           COALESCE(SUM(rt.tempo_preparacao_realizado), 0) as prep
    FROM bethadba.sai_roteiro_testes rt
    JOIN UP.SAI_PSAI sp ON rt.i_sai = sp.i_sai
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE rt.data_exclusao IS NULL
      AND rt.data_conclusao >= ${ini} AND rt.data_conclusao <= ${fim}
      AND ${condAreaNE(area, 'sp')} AND ${FILTRO_PARALELO}
      AND COALESCE(psai.i_produto_grupo, 1) = 1 AND sp.i_sai > 0
    GROUP BY sp.i_sai
  `;
}

module.exports = {
  queryParaleloDev, queryParaleloTeste,
  queryDetalheParaleloDev, queryDetalheParaleloTeste
};
