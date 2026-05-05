/**
 * tempo-correcao-queries.js - Queries do indicador Tempo Correcao NE
 *
 * Tres fontes de tempo:
 * 1. SAIs liberadas na versao (nomeVersao = 'X')
 * 2. SAIs liberadas em arquivo de versao (nomeVersao LIKE '{anterior}.%')
 * 3. SAIs em paralelo: versoes especiais (ex: PacotesIA, ImportacaoEsoci)
 *    com roteiros concluidos (data_conclusao) no periodo da versao
 *
 * Versoes paralelas: nomeVersao que NAO comeca com digito (ex: 'PacotesIA')
 */

const versaoUtil = require('../../core/versao');

/** Filtro SQL: SAIs liberadas na versao OU em arquivo */
function filtroLib(v) {
  const p = versaoUtil.padraoArquivoVersao(v);
  return p
    ? `(sp.nomeVersao = '${v}' OR sp.nomeVersao LIKE '${p}')`
    : `sp.nomeVersao = '${v}'`;
}

const FILTRO_PARALELO = "SUBSTR(sp.nomeVersao, 1, 1) NOT BETWEEN '0' AND '9'";

/* ====== QUERIES SAIs LIBERADAS (versao + arquivo) ====== */

function querySaisPorTipo(v) {
  return `
    SELECT
      sp.tipoSAI,
      COUNT(*) as total,
      SUM(CASE WHEN sp.tipoSAI = 'NE' AND COALESCE(sp.NE_PREVENCAO, 0) = 1 THEN 1 ELSE 0 END) as ne_internas
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE sp.nomeArea = 'Escrita'
      AND ${filtroLib(v)}
      AND sp.Liberacao IS NOT NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
    GROUP BY sp.tipoSAI
  `;
}

function queryTempoDev(v) {
  return `
    SELECT
      SUM(rd.tempo_realizado) as dev_total,
      SUM(CASE WHEN sp.tipoSAI = 'NE' AND COALESCE(sp.NE_PREVENCAO, 0) <> 1
        THEN rd.tempo_realizado ELSE 0 END) as dev_ne
    FROM bethadba.sai_roteiro_desenvolvimento rd
    JOIN UP.SAI_PSAI sp ON rd.i_sai = sp.i_sai
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE rd.data_exclusao IS NULL
      AND sp.nomeArea = 'Escrita' AND ${filtroLib(v)}
      AND sp.Liberacao IS NOT NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND sp.i_sai > 0
  `;
}

function queryTempoTeste(v) {
  return `
    SELECT
      SUM(rt.tempo_teste_realizado) as teste_total,
      SUM(rt.tempo_preparacao_realizado) as prep_total,
      SUM(CASE WHEN sp.tipoSAI = 'NE' AND COALESCE(sp.NE_PREVENCAO, 0) <> 1
        THEN rt.tempo_teste_realizado ELSE 0 END) as teste_ne,
      SUM(CASE WHEN sp.tipoSAI = 'NE' AND COALESCE(sp.NE_PREVENCAO, 0) <> 1
        THEN rt.tempo_preparacao_realizado ELSE 0 END) as prep_ne
    FROM bethadba.sai_roteiro_testes rt
    JOIN UP.SAI_PSAI sp ON rt.i_sai = sp.i_sai
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE rt.data_exclusao IS NULL
      AND sp.nomeArea = 'Escrita' AND ${filtroLib(v)}
      AND sp.Liberacao IS NOT NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND sp.i_sai > 0
  `;
}

function queryDetalheDev(v) {
  return `
    SELECT sp.i_sai, sp.i_psai, sp.tipoSAI, sp.nomeVersao,
           COALESCE(SUM(rd.tempo_realizado), 0) as dev
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    LEFT JOIN bethadba.sai_roteiro_desenvolvimento rd
      ON rd.i_sai = sp.i_sai AND rd.data_exclusao IS NULL
    WHERE sp.nomeArea = 'Escrita'
      AND ${filtroLib(v)}
      AND sp.Liberacao IS NOT NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND sp.i_sai > 0
    GROUP BY sp.i_sai, sp.i_psai, sp.tipoSAI, sp.nomeVersao
  `;
}

function queryDetalheTeste(v) {
  return `
    SELECT sp.i_sai,
           COALESCE(SUM(rt.tempo_teste_realizado), 0) as teste,
           COALESCE(SUM(rt.tempo_preparacao_realizado), 0) as prep
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    LEFT JOIN bethadba.sai_roteiro_testes rt
      ON rt.i_sai = sp.i_sai AND rt.data_exclusao IS NULL
    WHERE sp.nomeArea = 'Escrita'
      AND ${filtroLib(v)}
      AND sp.Liberacao IS NOT NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND sp.i_sai > 0
    GROUP BY sp.i_sai
  `;
}

/* ====== QUERIES SAIs EM PARALELO (filtradas por data_conclusao no periodo) ====== */

function queryParaleloDev(v) {
  const ini = versaoUtil.sqlInicioVersao(v);
  const fim = versaoUtil.sqlFimVersao(v);
  return `
    SELECT SUM(rd.tempo_realizado) as par_dev
    FROM bethadba.sai_roteiro_desenvolvimento rd
    JOIN UP.SAI_PSAI sp ON rd.i_sai = sp.i_sai
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE rd.data_exclusao IS NULL
      AND rd.data_conclusao >= ${ini} AND rd.data_conclusao <= ${fim}
      AND sp.nomeArea = 'Escrita'
      AND ${FILTRO_PARALELO}
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND sp.i_sai > 0
  `;
}

function queryParaleloTeste(v) {
  const ini = versaoUtil.sqlInicioVersao(v);
  const fim = versaoUtil.sqlFimVersao(v);
  return `
    SELECT
      SUM(rt.tempo_teste_realizado) as par_teste,
      SUM(rt.tempo_preparacao_realizado) as par_prep
    FROM bethadba.sai_roteiro_testes rt
    JOIN UP.SAI_PSAI sp ON rt.i_sai = sp.i_sai
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE rt.data_exclusao IS NULL
      AND rt.data_conclusao >= ${ini} AND rt.data_conclusao <= ${fim}
      AND sp.nomeArea = 'Escrita'
      AND ${FILTRO_PARALELO}
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND sp.i_sai > 0
  `;
}

/** Detalhe paralelo DEV por SAI (com tempo concluido no periodo) */
function queryDetalheParaleloDev(v) {
  const ini = versaoUtil.sqlInicioVersao(v);
  const fim = versaoUtil.sqlFimVersao(v);
  return `
    SELECT sp.i_sai, sp.i_psai, sp.tipoSAI, sp.nomeVersao,
           COALESCE(SUM(rd.tempo_realizado), 0) as dev
    FROM bethadba.sai_roteiro_desenvolvimento rd
    JOIN UP.SAI_PSAI sp ON rd.i_sai = sp.i_sai
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE rd.data_exclusao IS NULL
      AND rd.data_conclusao >= ${ini} AND rd.data_conclusao <= ${fim}
      AND sp.nomeArea = 'Escrita'
      AND ${FILTRO_PARALELO}
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND sp.i_sai > 0
    GROUP BY sp.i_sai, sp.i_psai, sp.tipoSAI, sp.nomeVersao
  `;
}

/** Detalhe paralelo TESTE+PREP por SAI (com tempo concluido no periodo) */
function queryDetalheParaleloTeste(v) {
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
      AND sp.nomeArea = 'Escrita'
      AND ${FILTRO_PARALELO}
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND sp.i_sai > 0
    GROUP BY sp.i_sai
  `;
}

module.exports = {
  querySaisPorTipo,
  queryTempoDev, queryTempoTeste,
  queryDetalheDev, queryDetalheTeste,
  queryParaleloDev, queryParaleloTeste,
  queryDetalheParaleloDev, queryDetalheParaleloTeste
};
