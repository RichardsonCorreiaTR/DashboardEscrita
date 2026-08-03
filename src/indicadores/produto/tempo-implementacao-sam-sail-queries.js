/**
 * tempo-implementacao-sam-sail-queries.js - Queries Tempo Implementacao SAM+SAIL
 */
const versaoUtil = require('../../core/versao');
const { condAreaNE } = require('../../core/consultas-ne');

function filtroLib(v) {
  const p = versaoUtil.padraoArquivoVersao(v);
  return p ? `(sp.nomeVersao = '${v}' OR sp.nomeVersao LIKE '${p}')` : `sp.nomeVersao = '${v}'`;
}

const COL_NOME_AREA = `CAST(TRIM(sp.nomeArea) AS BINARY(32)) as nomeArea`;
const FILTRO_PARALELO = "SUBSTR(sp.nomeVersao, 1, 1) NOT BETWEEN '0' AND '9'";
const CASO_FOCO = `sp.tipoSAI IN ('SAM', 'SAIL') AND COALESCE(sp.NE_PREVENCAO, 0) <> 1`;

function querySaisPorTipo(v, area = 'Escrita') {
  return `
    SELECT sp.tipoSAI, COUNT(*) as total
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE ${condAreaNE(area, 'sp')} AND ${filtroLib(v)}
      AND sp.Liberacao IS NOT NULL AND COALESCE(psai.i_produto_grupo, 1) = 1
    GROUP BY sp.tipoSAI
  `;
}

function queryTempoDev(v, area = 'Escrita') {
  return `
    SELECT SUM(rd.tempo_realizado) as dev_total,
      SUM(CASE WHEN ${CASO_FOCO} THEN rd.tempo_realizado ELSE 0 END) as dev_foco
    FROM bethadba.sai_roteiro_desenvolvimento rd
    JOIN UP.SAI_PSAI sp ON rd.i_sai = sp.i_sai
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE rd.data_exclusao IS NULL AND ${condAreaNE(area, 'sp')} AND ${filtroLib(v)}
      AND sp.Liberacao IS NOT NULL AND COALESCE(psai.i_produto_grupo, 1) = 1 AND sp.i_sai > 0
  `;
}

function queryTempoTeste(v, area = 'Escrita') {
  return `
    SELECT SUM(rt.tempo_teste_realizado) as teste_total,
      SUM(rt.tempo_preparacao_realizado) as prep_total,
      SUM(CASE WHEN ${CASO_FOCO} THEN rt.tempo_teste_realizado ELSE 0 END) as teste_foco,
      SUM(CASE WHEN ${CASO_FOCO} THEN rt.tempo_preparacao_realizado ELSE 0 END) as prep_foco
    FROM bethadba.sai_roteiro_testes rt
    JOIN UP.SAI_PSAI sp ON rt.i_sai = sp.i_sai
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE rt.data_exclusao IS NULL AND ${condAreaNE(area, 'sp')} AND ${filtroLib(v)}
      AND sp.Liberacao IS NOT NULL AND COALESCE(psai.i_produto_grupo, 1) = 1 AND sp.i_sai > 0
  `;
}

function queryDetalheDev(v, area = 'Escrita') {
  return `
    SELECT sp.i_sai, sp.i_psai, sp.tipoSAI, sp.nomeVersao, ${COL_NOME_AREA},
           COALESCE(SUM(rd.tempo_realizado), 0) as dev
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    LEFT JOIN bethadba.sai_roteiro_desenvolvimento rd
      ON rd.i_sai = sp.i_sai AND rd.data_exclusao IS NULL
    WHERE ${condAreaNE(area, 'sp')} AND ${filtroLib(v)}
      AND sp.Liberacao IS NOT NULL AND COALESCE(psai.i_produto_grupo, 1) = 1 AND sp.i_sai > 0
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
    WHERE ${condAreaNE(area, 'sp')} AND ${filtroLib(v)}
      AND sp.Liberacao IS NOT NULL AND COALESCE(psai.i_produto_grupo, 1) = 1 AND sp.i_sai > 0
    GROUP BY sp.i_sai
  `;
}

function queryParaleloDev(v, area = 'Escrita') {
  const ini = versaoUtil.sqlInicioVersao(v);
  const fim = versaoUtil.sqlFimVersao(v);
  return `
    SELECT SUM(rd.tempo_realizado) as par_dev
    FROM bethadba.sai_roteiro_desenvolvimento rd
    JOIN UP.SAI_PSAI sp ON rd.i_sai = sp.i_sai
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE rd.data_exclusao IS NULL AND rd.data_conclusao >= ${ini} AND rd.data_conclusao <= ${fim}
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
    WHERE rt.data_exclusao IS NULL AND rt.data_conclusao >= ${ini} AND rt.data_conclusao <= ${fim}
      AND ${condAreaNE(area, 'sp')} AND ${FILTRO_PARALELO}
      AND COALESCE(psai.i_produto_grupo, 1) = 1 AND sp.i_sai > 0
  `;
}

function queryDetalheParaleloDev(v, area = 'Escrita') {
  const ini = versaoUtil.sqlInicioVersao(v);
  const fim = versaoUtil.sqlFimVersao(v);
  return `
    SELECT sp.i_sai, sp.i_psai, sp.tipoSAI, sp.nomeVersao, ${COL_NOME_AREA},
           COALESCE(SUM(rd.tempo_realizado), 0) as dev
    FROM bethadba.sai_roteiro_desenvolvimento rd
    JOIN UP.SAI_PSAI sp ON rd.i_sai = sp.i_sai
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE rd.data_exclusao IS NULL AND rd.data_conclusao >= ${ini} AND rd.data_conclusao <= ${fim}
      AND ${condAreaNE(area, 'sp')} AND ${FILTRO_PARALELO}
      AND COALESCE(psai.i_produto_grupo, 1) = 1 AND sp.i_sai > 0
    GROUP BY sp.i_sai, sp.i_psai, sp.tipoSAI, sp.nomeVersao, sp.nomeArea
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
    WHERE rt.data_exclusao IS NULL AND rt.data_conclusao >= ${ini} AND rt.data_conclusao <= ${fim}
      AND ${condAreaNE(area, 'sp')} AND ${FILTRO_PARALELO}
      AND COALESCE(psai.i_produto_grupo, 1) = 1 AND sp.i_sai > 0
    GROUP BY sp.i_sai
  `;
}

module.exports = {
  querySaisPorTipo, queryTempoDev, queryTempoTeste,
  queryDetalheDev, queryDetalheTeste,
  queryParaleloDev, queryParaleloTeste,
  queryDetalheParaleloDev, queryDetalheParaleloTeste
};
