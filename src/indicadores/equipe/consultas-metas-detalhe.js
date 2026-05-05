/**
 * consultas-metas-detalhe.js - Queries de detalhe mensal (registros individuais)
 *
 * Retorna registros individuais para um analista/mes especifico.
 * Usado pelo endpoint de drill-down.
 *
 * REVISOES: retorna dois grupos via UNION ALL:
 *   'denominador' = SAIs criadas no mes (revisoes contadas apenas deste mes)
 *   'numerador'   = SAIs de outros meses que tiveram revisoes neste mes
 */

const FILTRO_AREA = "sp.nomeArea = 'Escrita'";
const MOTIVOS_AC = '(1, 2, 4, 5)';

const METAID_REV_CONFIG = {
  'indice-revisoes-sal':      { tipos: ['SAL'], area: "sp.nomeArea = 'Escrita'" },
  'indice-revisoes-ne':       { tipos: ['NE'],  area: "sp.nomeArea = 'Escrita'" },
  'indice-revisoes-sail':     { tipos: ['SAIL'], area: "sp.nomeArea = 'Escrita'" },
  'indice-revisoes-sam-esc':  { tipos: ['SAM'], area: "sp.nomeArea = 'Escrita'" },
  'indice-revisoes-sam-imp':  { tipos: ['SAM'], area: "sp.nomeArea <> 'Escrita'" }
};

function detalheRevisoes(codigoSgd, ano, mes, porGerador, metaId) {
  const cfg = METAID_REV_CONFIG[metaId] || { tipos: ['NE'], area: "sp.nomeArea = 'Escrita'" };
  const tiposIn = cfg.tipos.map(t => `'${t}'`).join(', ');
  const join = porGerador
    ? 'JOIN bethadba.sai s2 ON sp.i_sai = s2.i_sai'
    : 'JOIN bethadba.psai p ON sp.i_psai = p.i_psai';
  const filtro = porGerador
    ? `s2.i_usuarios = ${codigoSgd} AND COALESCE(s2.i_produto_grupo, 1) = 1`
    : `p.i_responsaveis = ${codigoSgd} AND COALESCE(p.i_produto_grupo, 1) = 1`;
  return `
    SELECT sp.i_sai, sp.tipoSAI, sp.CadastroSAI,
      COUNT(CASE WHEN MONTH(sr.entrada) = ${mes} AND YEAR(sr.entrada) = ${ano}
        THEN sr.i_revisoes END) as revisoes,
      'denominador' as grupo
    FROM UP.SAI_PSAI sp
    ${join}
    LEFT JOIN bethadba.sai_revisoes sr ON sr.i_sai = sp.i_sai AND sr.i_motivos IN ${MOTIVOS_AC}
    WHERE ${cfg.area} AND ${filtro}
      AND sp.tipoSAI IN (${tiposIn})
      AND MONTH(sp.CadastroSAI) = ${mes} AND YEAR(sp.CadastroSAI) = ${ano}
    GROUP BY sp.i_sai, sp.tipoSAI, sp.CadastroSAI
    UNION ALL
    SELECT sp.i_sai, sp.tipoSAI, sp.CadastroSAI,
      COUNT(sr.i_revisoes) as revisoes,
      'numerador' as grupo
    FROM bethadba.sai_revisoes sr
    JOIN UP.SAI_PSAI sp ON sr.i_sai = sp.i_sai
    ${join}
    WHERE ${cfg.area} AND ${filtro}
      AND sp.tipoSAI IN (${tiposIn}) AND sr.i_motivos IN ${MOTIVOS_AC}
      AND MONTH(sr.entrada) = ${mes} AND YEAR(sr.entrada) = ${ano}
      AND NOT (MONTH(sp.CadastroSAI) = ${mes} AND YEAR(sp.CadastroSAI) = ${ano})
    GROUP BY sp.i_sai, sp.tipoSAI, sp.CadastroSAI
  `;
}

function detalhePontos(codigoSgd, ano, mes) {
  return `
    SELECT sp.i_sai, sp.tipoSAI, sp.CadastroSAI, s.pontuacao
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    JOIN bethadba.sai s ON sp.i_sai = s.i_sai
    WHERE sp.nomeArea IN ('Escrita', 'Importação')
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND p.i_responsaveis = ${codigoSgd}
      AND MONTH(sp.CadastroSAI) = ${mes} AND YEAR(sp.CadastroSAI) = ${ano}
    ORDER BY s.pontuacao DESC, sp.CadastroSAI
  `;
}

const SIT_ENVIO = 2;
const SIT_RESPOSTA = '(4, 11, 12)';

function detalheTramitacoesPsai(codigoSgd, ano, mes) {
  const duExpr =
    'DATEDIFF(day, sub.data_envio, sub.data_resposta)' +
    ' - (DATEDIFF(day, sub.data_envio, sub.data_resposta) + DOW(sub.data_envio) - 2) / 7' +
    ' - (DATEDIFF(day, sub.data_envio, sub.data_resposta) + DOW(sub.data_envio) - 1) / 7';
  return `
    SELECT sub.i_psai, sub.data_envio, sub.data_resposta, sub.i_situacoes,
      DATEDIFF(day, sub.data_envio, sub.data_resposta) as dias_corridos,
      ${duExpr} as dias_uteis
    FROM (
      SELECT resp.i_psai, resp.entrada as data_resposta, resp.i_situacoes,
        (SELECT MAX(env.entrada) FROM bethadba.psai_tramites env
          WHERE env.i_psai = resp.i_psai AND env.entrada < resp.entrada
            AND env.i_situacoes = ${SIT_ENVIO}) as data_envio
      FROM bethadba.psai_tramites resp
      JOIN bethadba.psai p ON resp.i_psai = p.i_psai
      JOIN UP.SAI_PSAI sp ON sp.i_psai = p.i_psai
      WHERE ${FILTRO_AREA} AND sp.tipoSAI = 'NE'
        AND COALESCE(p.i_produto_grupo, 1) = 1
        AND resp.i_usuarios = ${codigoSgd}
        AND resp.i_situacoes IN ${SIT_RESPOSTA}
        AND MONTH(resp.entrada) = ${mes} AND YEAR(resp.entrada) = ${ano}
        AND (SELECT MAX(env.entrada) FROM bethadba.psai_tramites env
          WHERE env.i_psai = resp.i_psai AND env.entrada < resp.entrada
            AND env.i_situacoes = ${SIT_ENVIO}) IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM bethadba.psai_tramites prev
          WHERE prev.i_psai = resp.i_psai AND prev.i_usuarios = resp.i_usuarios
            AND prev.entrada > (SELECT MAX(e2.entrada) FROM bethadba.psai_tramites e2
              WHERE e2.i_psai = resp.i_psai AND e2.entrada < resp.entrada
                AND e2.i_situacoes = ${SIT_ENVIO})
            AND prev.entrada < resp.entrada)
    ) sub
    WHERE sub.data_envio IS NOT NULL
    ORDER BY sub.data_resposta
  `;
}

function detalheAtividades(iUsuarios, ano, mes) {
  return `
    SELECT CAST(v.NomeAtividade AS BINARY) as atividade,
      SUM(v.tempo) as minutos, COUNT(*) as registros
    FROM bethadba.vanalise_registro_atividades v
    WHERE v.i_usuarios = ${iUsuarios}
      AND MONTH(v.dia) = ${mes} AND YEAR(v.dia) = ${ano}
    GROUP BY v.NomeAtividade
    ORDER BY SUM(v.tempo) DESC
  `;
}

function detalheRespostasSS(iUsuarios, ano, mes) {
  return `
    SELECT st.i_ss, st.entrada, st.data_resposta,
      DATEDIFF(day, st.entrada, st.data_resposta) as dias
    FROM bethadba.ss_tramites st
    JOIN bethadba.ss s ON st.i_ss = s.i_ss
    WHERE st.i_usuarios = ${iUsuarios} AND st.data_resposta IS NOT NULL
      AND MONTH(st.data_resposta) = ${mes} AND YEAR(st.data_resposta) = ${ano}
      AND COALESCE(s.i_produto_grupo, 1) = 1
    ORDER BY st.data_resposta
  `;
}

module.exports = {
  detalheRevisoes, detalhePontos, detalheTramitacoesPsai,
  detalheAtividades, detalheRespostasSS
};
