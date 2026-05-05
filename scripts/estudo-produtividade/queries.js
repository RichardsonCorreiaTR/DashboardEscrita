/**
 * queries.js - Queries SQL para o estudo de produtividade NE Q1
 *
 * Compara 3 primeiras versoes de 2024, 2025 e 2026.
 * Cada query retorna os dados brutos com filtros padrao area Escrita NE.
 */

const versao = require('../../src/core/versao');

const FILTRO_PRODUTO = `
  AND (EXISTS (SELECT 1 FROM bethadba.sai sai
    WHERE sp.i_sai = sai.i_sai
    AND (sai.i_produto_grupo IS NULL OR sai.i_produto_grupo = 1))
  OR sp.i_sai = 0)`;

const FILTRO_PRODUTO_PSAI = 'AND COALESCE(p.i_produto_grupo, 1) = 1';
const BASE = "sp.nomeArea = 'Escrita' AND sp.tipoSAI = 'NE'";

function ini(v) { return versao.sqlInicioVersao(v); }
function fim(v) { return versao.sqlFimVersao(v); }

function queryEntradas(v) {
  return `SELECT COUNT(*) as total,
    COUNT(CASE WHEN sp.i_sai > 0 THEN 1 END) as com_sai,
    COUNT(CASE WHEN sp.i_sai = 0 THEN 1 END) as sem_sai
    FROM UP.SAI_PSAI sp
    WHERE ${BASE}
    AND sp.CadastroPSAI > ${ini(v)} AND sp.CadastroPSAI <= ${fim(v)}
    ${FILTRO_PRODUTO}`;
}

function queryDescartes(v) {
  return `SELECT
    COALESCE(NULLIF(sp.i_sai_situacoes,0), sp.i_psai_situacoes) as motivo,
    COUNT(*) as qtd
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE ${BASE}
    AND sp.Descarte > ${ini(v)} AND sp.Descarte <= ${fim(v)}
    ${FILTRO_PRODUTO_PSAI}
    GROUP BY COALESCE(NULLIF(sp.i_sai_situacoes,0), sp.i_psai_situacoes)`;
}

function queryTempos(v) {
  return `SELECT COUNT(DISTINCT sp.i_psai) as psai_total,
    COUNT(DISTINCT CASE WHEN pr.tempo_analise > 0 OR pr.tempo_definicao > 0
      THEN sp.i_psai END) as com_tempo,
    SUM(COALESCE(pr.tempo_analise,0)) as min_analise,
    SUM(COALESCE(pr.tempo_definicao,0)) as min_definicao,
    SUM(COALESCE(pr.tempo_analise,0)+COALESCE(pr.tempo_definicao,0)) as min_total
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    LEFT JOIN bethadba.psai_responsaveis pr ON sp.i_psai = pr.i_psai
    WHERE ${BASE}
    AND sp.CadastroPSAI > ${ini(v)} AND sp.CadastroPSAI <= ${fim(v)}
    ${FILTRO_PRODUTO_PSAI}`;
}

function queryAnalistasPsai(v) {
  return `SELECT pr.i_usuarios,
    COUNT(DISTINCT sp.i_psai) as psais,
    SUM(COALESCE(pr.tempo_analise,0)) as min_analise,
    SUM(COALESCE(pr.tempo_definicao,0)) as min_definicao
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    JOIN bethadba.psai_responsaveis pr ON sp.i_psai = pr.i_psai
    WHERE ${BASE}
    AND sp.CadastroPSAI > ${ini(v)} AND sp.CadastroPSAI <= ${fim(v)}
    ${FILTRO_PRODUTO_PSAI}
    AND (pr.tempo_analise > 0 OR pr.tempo_definicao > 0)
    GROUP BY pr.i_usuarios`;
}

function queryGeradoresSai(v) {
  return `SELECT s.i_usuarios as gerador,
    COUNT(DISTINCT s.i_sai) as sais
    FROM bethadba.sai s
    WHERE s.i_sai IN (
      SELECT sp.i_sai FROM UP.SAI_PSAI sp
      JOIN bethadba.psai p ON sp.i_psai = p.i_psai
      WHERE ${BASE}
      AND sp.CadastroPSAI > ${ini(v)} AND sp.CadastroPSAI <= ${fim(v)}
      ${FILTRO_PRODUTO_PSAI} AND sp.i_sai > 0)
    AND COALESCE(s.i_produto_grupo, 1) = 1
    GROUP BY s.i_usuarios`;
}

function queryNomes(ids) {
  return `SELECT u.CODIGO_SGD,
    CAST(u.NOME AS BINARY(80)) as nome
    FROM bethadba.UDUSUARIOS u
    WHERE u.CODIGO_SGD IN (${ids.join(',')}) --allow-blob`;
}

function queryDatas(v) {
  return `SELECT PIAZZA.FG_GET_DATA_INICIO_VERSAO('${v}', 1) as dt_ini,
    PIAZZA.FG_GET_DATA_FIM_VERSAO('${v}', 1) as dt_fim`;
}

const SQL_TEXTOS = {
  entradas: `SELECT COUNT(*) FROM UP.SAI_PSAI sp
WHERE sp.nomeArea = 'Escrita' AND sp.tipoSAI = 'NE'
AND sp.CadastroPSAI > PIAZZA.FG_GET_DATA_INICIO_VERSAO(versao, 1)
AND sp.CadastroPSAI <= PIAZZA.FG_GET_DATA_FIM_VERSAO(versao, 1)
AND (EXISTS (SELECT 1 FROM bethadba.sai sai
  WHERE sp.i_sai = sai.i_sai
  AND (sai.i_produto_grupo IS NULL OR sai.i_produto_grupo = 1))
OR sp.i_sai = 0)`,
  descartes: `SELECT COALESCE(NULLIF(sp.i_sai_situacoes,0), sp.i_psai_situacoes) as motivo, COUNT(*)
FROM UP.SAI_PSAI sp JOIN bethadba.psai p ON sp.i_psai = p.i_psai
WHERE ... AND sp.Descarte > PIAZZA_INICIO AND sp.Descarte <= PIAZZA_FIM
AND COALESCE(p.i_produto_grupo, 1) = 1
GROUP BY motivo  -- Excluindo motivo 26 na agregacao`,
  tempos: `SELECT SUM(pr.tempo_analise), SUM(pr.tempo_definicao)
FROM bethadba.psai_responsaveis pr
WHERE pr.i_psai IN (PSAIs cadastradas no periodo da versao)`,
  time: `SELECT pr.i_usuarios, COUNT(DISTINCT sp.i_psai)
FROM psai_responsaveis pr ... GROUP BY pr.i_usuarios
UNION (geradores SAI: sai.i_usuarios)
Filtro esporadico: >= 3 PSAIs OU >= 10h (analise) / >= 3 SAIs (geracao)`
};

module.exports = {
  queryEntradas, queryDescartes, queryTempos,
  queryAnalistasPsai, queryGeradoresSai, queryNomes, queryDatas,
  SQL_TEXTOS
};
