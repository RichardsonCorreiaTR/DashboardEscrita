/**
 * tempo-implementacao-queries.js - Queries do indicador Tempo Implementacao SAL
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
const { condAreaNE } = require('../../core/consultas-ne');

/** Filtro SQL: SAIs liberadas na versao OU em arquivo */
function filtroLib(v) {
  const p = versaoUtil.padraoArquivoVersao(v);
  return p
    ? `(sp.nomeVersao = '${v}' OR sp.nomeVersao LIKE '${p}')`
    : `sp.nomeVersao = '${v}'`;
}

const COL_NOME_AREA_SP = `CAST(TRIM(sp.nomeArea) AS BINARY(32)) as nomeArea`;
const FILTRO_PARALELO = "SUBSTR(sp.nomeVersao, 1, 1) NOT BETWEEN '0' AND '9'";

/* ====== QUERIES SAIs LIBERADAS (versao + arquivo) ====== */

function querySaisPorTipo(v, area = 'Escrita') {
  return `
    SELECT
      sp.tipoSAI,
      COUNT(*) as total,
      SUM(CASE WHEN sp.tipoSAI = 'SAL' AND COALESCE(sp.NE_PREVENCAO, 0) = 1 THEN 1 ELSE 0 END) as sal_internas
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
      SUM(CASE WHEN sp.tipoSAI = 'SAL' AND COALESCE(sp.NE_PREVENCAO, 0) <> 1
        THEN rd.tempo_realizado ELSE 0 END) as dev_sal
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
      SUM(CASE WHEN sp.tipoSAI = 'SAL' AND COALESCE(sp.NE_PREVENCAO, 0) <> 1
        THEN rt.tempo_teste_realizado ELSE 0 END) as teste_sal,
      SUM(CASE WHEN sp.tipoSAI = 'SAL' AND COALESCE(sp.NE_PREVENCAO, 0) <> 1
        THEN rt.tempo_preparacao_realizado ELSE 0 END) as prep_sal
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
    GROUP BY sp.i_sai, sp.i_psai, sp.tipoSAI, sp.nomeVersao, sp.nomeArea
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

/* ====== QUERIES SAIs EM PARALELO (filtradas por data_conclusao no periodo) ====== */

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
      AND ${condAreaNE(area, 'sp')}
      AND ${FILTRO_PARALELO}
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND sp.i_sai > 0
  `;
}

function queryParaleloTeste(v, area = 'Escrita') {
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
      AND ${condAreaNE(area, 'sp')}
      AND ${FILTRO_PARALELO}
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND sp.i_sai > 0
  `;
}

/** Detalhe paralelo DEV por SAI (com tempo concluido no periodo) */
function queryDetalheParaleloDev(v, area = 'Escrita') {
  const ini = versaoUtil.sqlInicioVersao(v);
  const fim = versaoUtil.sqlFimVersao(v);
  return `
    SELECT sp.i_sai, sp.i_psai, sp.tipoSAI, sp.nomeVersao, ${COL_NOME_AREA_SP},
           COALESCE(SUM(rd.tempo_realizado), 0) as dev
    FROM bethadba.sai_roteiro_desenvolvimento rd
    JOIN UP.SAI_PSAI sp ON rd.i_sai = sp.i_sai
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE rd.data_exclusao IS NULL
      AND rd.data_conclusao >= ${ini} AND rd.data_conclusao <= ${fim}
      AND ${condAreaNE(area, 'sp')}
      AND ${FILTRO_PARALELO}
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND sp.i_sai > 0
    GROUP BY sp.i_sai, sp.i_psai, sp.tipoSAI, sp.nomeVersao, sp.nomeArea
  `;
}

/** Detalhe paralelo TESTE+PREP por SAI (com tempo concluido no periodo) */
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
      AND ${condAreaNE(area, 'sp')}
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

