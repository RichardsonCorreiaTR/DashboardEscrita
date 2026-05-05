/**
 * queries-detalhe.js - Queries granulares: PSAI individual, tempos, SAI, atividades
 *
 * Fontes: psai_responsaveis (tempo_analise/definicao), bethadba.sai (pontuacao),
 *         vanalise_registro_atividades (tempo por SAI)
 */

const versao = require('../../src/core/versao');

const INI_PERIODO = versao.sqlInicioVersao('10.5A-11');
const FIM_PERIODO = versao.sqlFimVersao('10.6A-03');
const FILTRO_NE = `sp.nomeArea = 'Escrita' AND sp.tipoSAI = 'NE'`;

function queryPsaiDetalhe() {
  return `
    SELECT sp.i_psai, sp.i_sai, sp.CadastroPSAI, sp.CadastroSAI,
           sp.gravidade_ne, sp.NE_PREVENCAO, sp.nomeVersao,
           sp.Liberacao, sp.Descarte, sp.i_sai_situacoes, sp.i_psai_situacoes,
           p.i_responsaveis as analista_resp,
           CAST(p.descricao_destaque AS BINARY(250)) as descricao --allow-blob
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE ${FILTRO_NE}
      AND sp.CadastroPSAI > ${INI_PERIODO}
      AND sp.CadastroPSAI <= ${FIM_PERIODO}
      AND COALESCE(p.i_produto_grupo, 1) = 1
    ORDER BY sp.CadastroPSAI`;
}

function queryTemposPsai() {
  return `
    SELECT pr.i_psai, pr.i_usuarios,
           pr.tempo_analise, pr.tempo_definicao
    FROM bethadba.psai_responsaveis pr
    WHERE pr.i_psai IN (
      SELECT sp.i_psai FROM UP.SAI_PSAI sp
      JOIN bethadba.psai p ON sp.i_psai = p.i_psai
      WHERE ${FILTRO_NE}
        AND sp.CadastroPSAI > ${INI_PERIODO}
        AND sp.CadastroPSAI <= ${FIM_PERIODO}
        AND COALESCE(p.i_produto_grupo, 1) = 1
    )`;
}

function querySaiDetalhe() {
  return `
    SELECT s.i_sai, s.pontuacao, s.i_usuarios as gerador_sai,
           CASE WHEN DATALENGTH(s.definicao) > 0 THEN 1 ELSE 0 END as tem_definicao --allow-blob
    FROM bethadba.sai s
    WHERE s.i_sai IN (
      SELECT sp.i_sai FROM UP.SAI_PSAI sp
      JOIN bethadba.psai p ON sp.i_psai = p.i_psai
      WHERE ${FILTRO_NE}
        AND sp.CadastroPSAI > ${INI_PERIODO}
        AND sp.CadastroPSAI <= ${FIM_PERIODO}
        AND COALESCE(p.i_produto_grupo, 1) = 1
        AND sp.i_sai > 0
    )
    AND COALESCE(s.i_produto_grupo, 1) = 1`;
}

function queryTempoDevSai() {
  return `
    SELECT rd.i_sai,
           SUM(rd.tempo_realizado) as tempo_dev,
           SUM(rd.tempo_previsto) as tempo_prev
    FROM bethadba.sai_roteiro_desenvolvimento rd
    WHERE rd.data_exclusao IS NULL
      AND rd.i_sai IN (
        SELECT sp.i_sai FROM UP.SAI_PSAI sp
        JOIN bethadba.psai p ON sp.i_psai = p.i_psai
        WHERE ${FILTRO_NE}
          AND sp.CadastroPSAI > ${INI_PERIODO}
          AND sp.CadastroPSAI <= ${FIM_PERIODO}
          AND COALESCE(p.i_produto_grupo, 1) = 1
          AND sp.i_sai > 0
      )
    GROUP BY rd.i_sai`;
}

function queryAtividadesPorSai(saiIds) {
  const ids = saiIds.join(', ');
  return `
    SELECT v.i_sai, v.i_usuarios, v.dia,
           CAST(v.NomeAtividade AS BINARY) as atividade,
           SUM(v.tempo) as minutos, COUNT(*) as registros
    FROM bethadba.vanalise_registro_atividades v
    WHERE v.i_sai IN (${ids})
      AND v.dia >= '2025-10-01'
      AND v.dia <= '2026-03-31'
    GROUP BY v.i_sai, v.i_usuarios, v.dia, v.NomeAtividade`;
}

function querySituacoesDescarte() {
  return `
    SELECT sp.i_psai, sp.i_sai, sp.Descarte, sp.gravidade_ne,
           sp.i_sai_situacoes, sp.i_psai_situacoes,
           p.i_responsaveis as analista_resp,
           CAST(TRIM(COALESCE(sit.descricao, psit.descricao)) AS BINARY(64)) as motivo, --allow-blob
           CAST(p.descricao_destaque AS BINARY(250)) as descricao --allow-blob
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    LEFT JOIN bethadba.sai_situacoes sit
      ON sp.i_sai_situacoes = sit.i_sai_situacoes AND sit.i_sai_linhas = 1
    LEFT JOIN bethadba.psai_situacoes psit
      ON sp.i_psai_situacoes = psit.i_situacoes
    WHERE ${FILTRO_NE}
      AND sp.Descarte > ${INI_PERIODO}
      AND sp.Descarte <= ${FIM_PERIODO}
      AND COALESCE(p.i_produto_grupo, 1) = 1
    ORDER BY sp.Descarte`;
}

module.exports = {
  queryPsaiDetalhe, queryTemposPsai, querySaiDetalhe,
  queryTempoDevSai, queryAtividadesPorSai, querySituacoesDescarte
};
