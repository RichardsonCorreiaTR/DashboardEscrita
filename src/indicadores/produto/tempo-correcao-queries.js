/**
 * tempo-correcao-queries.js - Queries Tempo Correcao NE (SAIs liberadas)
 *
 * Paralelo: ver tempo-correcao-queries-paralelo.js (reexportado abaixo).
 */
const { condAreaNE } = require('../../core/consultas-ne');
const versaoUtil = require('../../core/versao');
const paralelo = require('./tempo-correcao-queries-paralelo');

function filtroLib(v) {
  const p = versaoUtil.padraoArquivoVersao(v);
  return p
    ? `(sp.nomeVersao = '${v}' OR sp.nomeVersao LIKE '${p}')`
    : `sp.nomeVersao = '${v}'`;
}

const COL_NOME_AREA_SP = `CAST(TRIM(sp.nomeArea) AS BINARY(32)) as nomeArea`;

function querySaisPorTipo(v, area = 'Escrita') {
  return `
    SELECT
      sp.tipoSAI,
      COUNT(*) as total,
      SUM(CASE WHEN sp.tipoSAI = 'NE' AND COALESCE(sp.NE_PREVENCAO, 0) = 1 THEN 1 ELSE 0 END) as ne_internas
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE ${condAreaNE(area, 'sp')}
      AND ${filtroLib(v)}
      AND sp.Liberacao IS NOT NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
    GROUP BY sp.tipoSAI
  `;
}

function queryTempoDev(v, area = 'Escrita') {
  return `
    SELECT
      SUM(rd.tempo_realizado) as dev_total,
      SUM(CASE WHEN sp.tipoSAI = 'NE' AND COALESCE(sp.NE_PREVENCAO, 0) <> 1
        THEN rd.tempo_realizado ELSE 0 END) as dev_ne,
      SUM(CASE WHEN sp.tipoSAI = 'NE' AND COALESCE(sp.NE_PREVENCAO, 0) = 1
        THEN rd.tempo_realizado ELSE 0 END) as dev_ne_int
    FROM bethadba.sai_roteiro_desenvolvimento rd
    JOIN UP.SAI_PSAI sp ON rd.i_sai = sp.i_sai
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE rd.data_exclusao IS NULL
      AND ${condAreaNE(area, 'sp')} AND ${filtroLib(v)}
      AND sp.Liberacao IS NOT NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND sp.i_sai > 0
  `;
}

function queryTempoTeste(v, area = 'Escrita') {
  return `
    SELECT
      SUM(rt.tempo_teste_realizado) as teste_total,
      SUM(rt.tempo_preparacao_realizado) as prep_total,
      SUM(CASE WHEN sp.tipoSAI = 'NE' AND COALESCE(sp.NE_PREVENCAO, 0) <> 1
        THEN rt.tempo_teste_realizado ELSE 0 END) as teste_ne,
      SUM(CASE WHEN sp.tipoSAI = 'NE' AND COALESCE(sp.NE_PREVENCAO, 0) <> 1
        THEN rt.tempo_preparacao_realizado ELSE 0 END) as prep_ne,
      SUM(CASE WHEN sp.tipoSAI = 'NE' AND COALESCE(sp.NE_PREVENCAO, 0) = 1
        THEN rt.tempo_teste_realizado ELSE 0 END) as teste_ne_int,
      SUM(CASE WHEN sp.tipoSAI = 'NE' AND COALESCE(sp.NE_PREVENCAO, 0) = 1
        THEN rt.tempo_preparacao_realizado ELSE 0 END) as prep_ne_int
    FROM bethadba.sai_roteiro_testes rt
    JOIN UP.SAI_PSAI sp ON rt.i_sai = sp.i_sai
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE rt.data_exclusao IS NULL
      AND ${condAreaNE(area, 'sp')} AND ${filtroLib(v)}
      AND sp.Liberacao IS NOT NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND sp.i_sai > 0
  `;
}

function queryDetalheDev(v, area = 'Escrita') {
  return `
    SELECT sp.i_sai, sp.i_psai, sp.tipoSAI, sp.nomeVersao, ${COL_NOME_AREA_SP},
           COALESCE(sp.NE_PREVENCAO, 0) as ne_prevencao,
           COALESCE(SUM(rd.tempo_realizado), 0) as dev
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    LEFT JOIN bethadba.sai_roteiro_desenvolvimento rd
      ON rd.i_sai = sp.i_sai AND rd.data_exclusao IS NULL
    WHERE ${condAreaNE(area, 'sp')}
      AND ${filtroLib(v)}
      AND sp.Liberacao IS NOT NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND sp.i_sai > 0
    GROUP BY sp.i_sai, sp.i_psai, sp.tipoSAI, sp.nomeVersao, sp.nomeArea, sp.NE_PREVENCAO
  `;
}

function queryDetalheTeste(v, area = 'Escrita') {
  return `
    SELECT sp.i_sai,
           COALESCE(SUM(rt.tempo_teste_realizado), 0) as teste,
           COALESCE(SUM(rt.tempo_preparacao_realizado), 0) as prep
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    LEFT JOIN bethadba.sai_roteiro_testes rt
      ON rt.i_sai = sp.i_sai AND rt.data_exclusao IS NULL
    WHERE ${condAreaNE(area, 'sp')}
      AND ${filtroLib(v)}
      AND sp.Liberacao IS NOT NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND sp.i_sai > 0
    GROUP BY sp.i_sai
  `;
}

module.exports = {
  querySaisPorTipo,
  queryTempoDev, queryTempoTeste,
  queryDetalheDev, queryDetalheTeste,
  ...paralelo
};
