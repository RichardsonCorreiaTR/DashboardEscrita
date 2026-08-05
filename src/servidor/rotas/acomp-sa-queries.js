/**
 * acomp-sa-queries.js - SQL builders para acompanhamento SAL / SAM / SAIL
 */
const path = require('path');
const equipe = require(path.join(__dirname, '../../../config/equipe.json'));
const analistas = equipe.analistas.filter(a => a.papel === 'analista');
const IDS_SGD = analistas.map(a => a['codigo-sgd']).join(', ');
const MAPA = {};
analistas.forEach(a => {
  MAPA[String(a['codigo-sgd'])] = { apelido: a.apelido, slug: a.slug, senioridade: a.senioridade };
});

const AREA = "sp.nomeArea IN ('Escrita', 'Importacao', 'ONVIO ESCRITA')";
const SITS_DESC = '(5, 6, 23, 33)';
const NIVEL_NOME = { 1: 'Baixa', 2: 'Média', 3: 'Alta', 4: 'Extra Alta' };
const TIPO_SAL = "sp.tipoSAI = 'SAL'";
/** SAM/SAIL: exclui PSAI "A aprovar" (14) — sem SAI e sem tempo util no acomp. */
const TIPO_SAM = "sp.tipoSAI IN ('SAM', 'SAIL') AND sp.i_psai_situacoes <> 14";

function queryTempoAtivas(ano, tipoSql) {
  return `
    SELECT p.i_responsaveis as i_usuarios, MONTH(sp.CadastroPSAI) as mes,
      COUNT(DISTINCT sp.i_psai) as total_psais,
      COALESCE(SUM(pr.tempo_analise), 0) + COALESCE(SUM(pr.tempo_definicao), 0) as tempo_total
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    LEFT JOIN bethadba.psai_responsaveis pr ON pr.i_psai = sp.i_psai
      AND pr.i_usuarios = p.i_responsaveis
    WHERE ${AREA} AND ${tipoSql}
      AND sp.i_psai_situacoes NOT IN ${SITS_DESC}
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND p.i_responsaveis IN (${IDS_SGD})
      AND YEAR(sp.CadastroPSAI) = ${ano}
    GROUP BY p.i_responsaveis, MONTH(sp.CadastroPSAI)`;
}

function queryTempoDescartadas(ano, tipoSql) {
  return `
    SELECT p.i_responsaveis as i_usuarios, MONTH(sp.CadastroPSAI) as mes,
      COUNT(DISTINCT sp.i_psai) as total_descartadas,
      COALESCE(SUM(pr.tempo_analise), 0) + COALESCE(SUM(pr.tempo_definicao), 0) as tempo_desc
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    LEFT JOIN bethadba.psai_responsaveis pr ON pr.i_psai = sp.i_psai
      AND pr.i_usuarios = p.i_responsaveis
    WHERE ${AREA} AND ${tipoSql}
      AND sp.i_psai_situacoes IN ${SITS_DESC}
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND p.i_responsaveis IN (${IDS_SGD})
      AND YEAR(sp.CadastroPSAI) = ${ano}
    GROUP BY p.i_responsaveis, MONTH(sp.CadastroPSAI)`;
}

function queryDetalheNivel(ano, tipoSql) {
  return `
    SELECT p.i_responsaveis as i_usuarios, MONTH(sp.CadastroPSAI) as mes,
      COALESCE(p.nivel_alteracao, 1) as nivel,
      COUNT(DISTINCT sp.i_psai) as total_psais,
      COALESCE(SUM(pr.tempo_analise), 0) + COALESCE(SUM(pr.tempo_definicao), 0) as tempo_total
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    LEFT JOIN bethadba.psai_responsaveis pr ON pr.i_psai = sp.i_psai
      AND pr.i_usuarios = p.i_responsaveis
    WHERE ${AREA} AND ${tipoSql}
      AND sp.i_psai_situacoes NOT IN ${SITS_DESC}
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND p.i_responsaveis IN (${IDS_SGD})
      AND YEAR(sp.CadastroPSAI) = ${ano}
    GROUP BY p.i_responsaveis, MONTH(sp.CadastroPSAI), p.nivel_alteracao`;
}

function queryLinhas(ano, idsSgd, nivel, tipoSql) {
  const filtroNivel = nivel ? `AND COALESCE(p.nivel_alteracao, 1) = ${nivel}` : '';
  return `
    SELECT p.i_responsaveis as i_usuarios, sp.i_psai, sp.i_sai,
      COALESCE(p.nivel_alteracao, 1) as nivel, MONTH(sp.CadastroPSAI) as mes,
      COALESCE(pr.tempo_analise, 0) as tempo_analise,
      COALESCE(pr.tempo_definicao, 0) as tempo_definicao,
      CAST(TRIM(COALESCE(sit.descricao, psit.descricao)) AS BINARY(64)) as situacao_nome --allow-blob
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    LEFT JOIN bethadba.psai_responsaveis pr ON pr.i_psai = sp.i_psai
      AND pr.i_usuarios = p.i_responsaveis
    LEFT JOIN bethadba.sai_situacoes sit
      ON sp.i_sai_situacoes = sit.i_sai_situacoes AND sit.i_sai_linhas = 1
    LEFT JOIN bethadba.psai_situacoes psit ON sp.i_psai_situacoes = psit.i_situacoes
    WHERE ${AREA} AND ${tipoSql}
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND p.i_responsaveis IN (${idsSgd})
      AND YEAR(sp.CadastroPSAI) = ${ano} ${filtroNivel}
    ORDER BY MONTH(sp.CadastroPSAI), sp.i_psai`;
}

module.exports = {
  analistas, MAPA, NIVEL_NOME, TIPO_SAL, TIPO_SAM,
  queryTempoAtivas, queryTempoDescartadas, queryDetalheNivel, queryLinhas
};
