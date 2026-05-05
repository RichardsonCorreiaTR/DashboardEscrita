/**
 * proposta-metas-queries.js - Queries SQL para retrospectiva 2025
 *
 * Reutiliza padroes de consultas-metas.js.
 * Retorna dados agrupados por i_usuarios e mes para cada meta proposta.
 */

const FILTRO_AREA = "sp.nomeArea = 'Escrita'";
const SIT_ENVIO = 2;
const SIT_RESPOSTA = '(4, 11, 12)';

function diasUteisSql(diffExpr, dowExpr) {
  return `(${diffExpr} - (${diffExpr} + ${dowExpr} - 2) / 7 - (${diffExpr} + ${dowExpr} - 1) / 7)`;
}

function queryTempoCicloResposta(codigoSgdList, ano) {
  const ids = codigoSgdList.join(', ');
  const du = diasUteisSql(
    'DATEDIFF(day, sub.data_envio, sub.data_resposta)',
    'DOW(sub.data_envio)'
  );
  return `
    SELECT sub.i_usuarios, MONTH(sub.data_resposta) as mes,
      COUNT(*) as total_ciclos,
      AVG(${du}) as media_dias,
      MIN(${du}) as min_dias,
      MAX(${du}) as max_dias
    FROM (
      SELECT resp.i_usuarios, resp.i_psai, resp.entrada as data_resposta,
        (SELECT MAX(env.entrada) FROM bethadba.psai_tramites env
         WHERE env.i_psai = resp.i_psai AND env.entrada < resp.entrada
           AND env.i_situacoes = ${SIT_ENVIO}) as data_envio
      FROM bethadba.psai_tramites resp
      JOIN bethadba.psai p ON resp.i_psai = p.i_psai
      JOIN UP.SAI_PSAI sp ON sp.i_psai = p.i_psai
      WHERE ${FILTRO_AREA} AND sp.tipoSAI = 'NE'
        AND COALESCE(p.i_produto_grupo, 1) = 1
        AND resp.i_usuarios IN (${ids})
        AND resp.i_situacoes IN ${SIT_RESPOSTA}
        AND YEAR(resp.entrada) = ${ano}
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
    GROUP BY sub.i_usuarios, MONTH(sub.data_resposta)
  `;
}

function queryTempoCicloEnvio(codigoSgdList, ano) {
  const ids = codigoSgdList.join(', ');
  const du = diasUteisSql(
    'DATEDIFF(day, sub.data_inicio, sub.data_envio)',
    'DOW(sub.data_inicio)'
  );
  return `
    SELECT sub.i_usuarios, MONTH(sub.data_envio) as mes,
      COUNT(*) as total_ciclos,
      AVG(${du}) as media_dias,
      MIN(${du}) as min_dias,
      MAX(${du}) as max_dias
    FROM (
      SELECT env.i_usuarios, env.i_psai, env.entrada as data_envio,
        COALESCE(
          (SELECT MAX(prev.entrada) FROM bethadba.psai_tramites prev
           WHERE prev.i_psai = env.i_psai AND prev.entrada < env.entrada
             AND prev.i_situacoes IN ${SIT_RESPOSTA}),
          sp.CadastroPSAI
        ) as data_inicio
      FROM bethadba.psai_tramites env
      JOIN bethadba.psai p ON env.i_psai = p.i_psai
      JOIN UP.SAI_PSAI sp ON sp.i_psai = p.i_psai
      WHERE ${FILTRO_AREA} AND sp.tipoSAI = 'NE'
        AND COALESCE(p.i_produto_grupo, 1) = 1
        AND env.i_usuarios IN (${ids})
        AND env.i_situacoes = ${SIT_ENVIO}
        AND YEAR(env.entrada) = ${ano}
    ) sub
    WHERE sub.data_inicio IS NOT NULL
    GROUP BY sub.i_usuarios, MONTH(sub.data_envio)
  `;
}

function queryComplexidade(codigoSgdList, ano) {
  const ids = codigoSgdList.join(', ');
  return `
    SELECT p.i_responsaveis as i_usuarios, MONTH(sp.CadastroSAI) as mes,
      AVG(s.pontuacao) as media_pontuacao,
      COUNT(sp.i_sai) as qtd_sais,
      SUM(s.pontuacao) as total_pontos
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    JOIN bethadba.sai s ON sp.i_sai = s.i_sai
    WHERE ${FILTRO_AREA} AND COALESCE(p.i_produto_grupo, 1) = 1
      AND s.pontuacao IS NOT NULL AND s.pontuacao > 0
      AND p.i_responsaveis IN (${ids})
      AND YEAR(sp.CadastroSAI) = ${ano}
    GROUP BY p.i_responsaveis, MONTH(sp.CadastroSAI)
  `;
}

function queryCoberturaEstimativa(codigoSgdList, ano) {
  const ids = codigoSgdList.join(', ');
  return `
    SELECT sr.i_usuarios, MONTH(sp.CadastroSAI) as mes,
      COUNT(*) as total_sais,
      SUM(CASE WHEN sr.tempo_previsto > 0 THEN 1 ELSE 0 END) as com_estimativa
    FROM bethadba.sai_responsaveis sr
    JOIN UP.SAI_PSAI sp ON sp.i_sai = sr.i_sai
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE ${FILTRO_AREA}
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND YEAR(sp.CadastroSAI) = ${ano}
      AND sr.i_usuarios IN (${ids})
    GROUP BY sr.i_usuarios, MONTH(sp.CadastroSAI)
  `;
}

function queryVerifTempoCiclo() {
  return `SELECT COUNT(*) AS total
    FROM bethadba.psai_tramites pt
    JOIN bethadba.psai p ON p.i_psai = pt.i_psai
    JOIN UP.SAI_PSAI sp ON sp.i_psai = p.i_psai
    WHERE sp.nomeArea = 'Escrita' AND sp.tipoSAI = 'NE'
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND pt.i_situacoes IN (2, 4, 11, 12)
      AND pt.entrada >= '2025-01-01'`;
}

function queryVerifComplexidade() {
  return `SELECT COUNT(*) AS total,
      AVG(s.pontuacao) AS media_pontuacao
    FROM UP.SAI_PSAI sp
    JOIN bethadba.sai s ON s.i_sai = sp.i_sai
    WHERE sp.nomeArea = 'Escrita'
      AND s.pontuacao > 0
      AND sp.CadastroSAI >= '2025-01-01'`;
}

function queryVerifCobertura() {
  return `SELECT COUNT(*) AS total,
      SUM(CASE WHEN sr.tempo_previsto > 0 THEN 1 ELSE 0 END) AS com_estimativa
    FROM bethadba.sai_responsaveis sr
    JOIN UP.SAI_PSAI sp ON sp.i_sai = sr.i_sai
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.nomeArea = 'Escrita'
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND sp.CadastroSAI >= '2025-01-01'`;
}

module.exports = {
  queryTempoCicloResposta,
  queryTempoCicloEnvio,
  queryComplexidade,
  queryCoberturaEstimativa,
  queryVerifTempoCiclo,
  queryVerifComplexidade,
  queryVerifCobertura
};
