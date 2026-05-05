/**
 * consultas-metas.js - Queries SQL anuais para metas da equipe Escrita Fiscal
 *
 * Retorna dados agrupados por MES (1..12) para o ANO informado.
 * Dois modos de link: POR DEFINIDOR (psai) e POR GERADOR (sai).
 * Motivos de revisao: A (Alteracao) = 1,4 / C (Complemento) = 2,5
 *
 * REVISOES: denominador (total SAIs) por CadastroSAI,
 *           numerador (total revisoes) por sai_revisoes.entrada (data da revisao).
 */

const FILTRO_AREA = "sp.nomeArea = 'Escrita'";
const MOTIVOS_AC = '(1, 2, 4, 5)';

const TIPOS_REV = "('NE', 'SAL', 'SAIL', 'SAM')";

function queryControleRevisoes(ano, sgd) {
  const extra = sgd ? `AND p.i_responsaveis = ${sgd}` : '';
  return `
    SELECT sub.i_usuarios, sub.mes, sub.tipo, sub.nomeArea,
      SUM(sub.total_sais) as total_sais,
      SUM(sub.total_revisoes) as total_revisoes
    FROM (
      SELECT p.i_responsaveis as i_usuarios, MONTH(sp.CadastroSAI) as mes,
        sp.tipoSAI as tipo, sp.nomeArea,
        COUNT(DISTINCT sp.i_sai) as total_sais, 0 as total_revisoes
      FROM UP.SAI_PSAI sp
      JOIN bethadba.psai p ON sp.i_psai = p.i_psai
      WHERE COALESCE(p.i_produto_grupo, 1) = 1
        AND sp.tipoSAI IN ${TIPOS_REV} AND YEAR(sp.CadastroSAI) = ${ano} ${extra}
      GROUP BY p.i_responsaveis, MONTH(sp.CadastroSAI), sp.tipoSAI, sp.nomeArea
      UNION ALL
      SELECT p.i_responsaveis as i_usuarios, MONTH(sr.entrada) as mes,
        sp.tipoSAI as tipo, sp.nomeArea,
        0 as total_sais, COUNT(sr.i_revisoes) as total_revisoes
      FROM bethadba.sai_revisoes sr
      JOIN UP.SAI_PSAI sp ON sr.i_sai = sp.i_sai
      JOIN bethadba.psai p ON sp.i_psai = p.i_psai
      WHERE COALESCE(p.i_produto_grupo, 1) = 1
        AND sp.tipoSAI IN ${TIPOS_REV} AND sr.i_motivos IN ${MOTIVOS_AC}
        AND YEAR(sr.entrada) = ${ano} ${extra}
      GROUP BY p.i_responsaveis, MONTH(sr.entrada), sp.tipoSAI, sp.nomeArea
    ) sub
    GROUP BY sub.i_usuarios, sub.mes, sub.tipo, sub.nomeArea
  `;
}

function queryControleRevisoesPorGerador(ano, uid) {
  const extra = uid ? `AND s.i_usuarios = ${uid}` : '';
  return `
    SELECT sub.i_usuarios, sub.mes, sub.tipo, sub.nomeArea,
      SUM(sub.total_sais) as total_sais,
      SUM(sub.total_revisoes) as total_revisoes
    FROM (
      SELECT s.i_usuarios, MONTH(sp.CadastroSAI) as mes,
        sp.tipoSAI as tipo, sp.nomeArea,
        COUNT(DISTINCT sp.i_sai) as total_sais, 0 as total_revisoes
      FROM UP.SAI_PSAI sp
      JOIN bethadba.sai s ON sp.i_sai = s.i_sai
      WHERE COALESCE(s.i_produto_grupo, 1) = 1
        AND sp.tipoSAI IN ${TIPOS_REV} AND YEAR(sp.CadastroSAI) = ${ano} ${extra}
      GROUP BY s.i_usuarios, MONTH(sp.CadastroSAI), sp.tipoSAI, sp.nomeArea
      UNION ALL
      SELECT s.i_usuarios, MONTH(sr.entrada) as mes,
        sp.tipoSAI as tipo, sp.nomeArea,
        0 as total_sais, COUNT(sr.i_revisoes) as total_revisoes
      FROM bethadba.sai_revisoes sr
      JOIN UP.SAI_PSAI sp ON sr.i_sai = sp.i_sai
      JOIN bethadba.sai s ON sp.i_sai = s.i_sai
      WHERE COALESCE(s.i_produto_grupo, 1) = 1
        AND sp.tipoSAI IN ${TIPOS_REV} AND sr.i_motivos IN ${MOTIVOS_AC}
        AND YEAR(sr.entrada) = ${ano} ${extra}
      GROUP BY s.i_usuarios, MONTH(sr.entrada), sp.tipoSAI, sp.nomeArea
    ) sub
    GROUP BY sub.i_usuarios, sub.mes, sub.tipo, sub.nomeArea
  `;
}

function queryPontosDefinicao(ano, sgd) {
  const extra = sgd ? `AND p.i_responsaveis = ${sgd}` : '';
  return `
    SELECT p.i_responsaveis as i_usuarios, MONTH(sp.CadastroSAI) as mes,
      COALESCE(SUM(s.pontuacao), 0) as pontos, COUNT(sp.i_sai) as qtd_sais,
      SUM(CASE WHEN s.pontuacao IS NULL OR s.pontuacao = 0 THEN 1 ELSE 0 END) as qtd_sem_pontos
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    JOIN bethadba.sai s ON sp.i_sai = s.i_sai
    WHERE sp.nomeArea IN ('Escrita', 'Importação')
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND YEAR(sp.CadastroSAI) = ${ano} ${extra}
    GROUP BY p.i_responsaveis, MONTH(sp.CadastroSAI)
  `;
}

// sit=2 (Analisada) = analista envia; sit 4,11,12 = coordenador responde
const SIT_ENVIO = 2;
const SIT_RESPOSTA = '(4, 11, 12)';

// N - (N+DOW-2)/7 - (N+DOW-1)/7 : converte dias corridos em uteis (exclui sab/dom)
function diasUteisSql(diffExpr, dowExpr) {
  return `(${diffExpr} - (${diffExpr} + ${dowExpr} - 2) / 7 - (${diffExpr} + ${dowExpr} - 1) / 7)`;
}

function queryTramitacoesPsai(codigoSgdList, maxDias, ano) {
  const ids = codigoSgdList.join(', ');
  const du = diasUteisSql(
    'DATEDIFF(day, sub.data_envio, sub.data_resposta)',
    'DOW(sub.data_envio)'
  );
  return `
    SELECT sub.i_usuarios, MONTH(sub.data_resposta) as mes,
      COUNT(*) as total_ciclos,
      AVG(${du}) as media_dias,
      SUM(CASE WHEN ${du} <= ${maxDias} THEN 1 ELSE 0 END) as dentro_prazo
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

function queryRespostasSS(iUsuariosList, ano) {
  const ids = iUsuariosList.join(', ');
  return `
    SELECT st.i_usuarios, MONTH(st.data_resposta) as mes,
      COUNT(st.i_ss_tramites) as total_respostas,
      SUM(CASE WHEN DATEDIFF(day, st.entrada, st.data_resposta) <= 3 THEN 1 ELSE 0 END) as dentro_3d,
      AVG(DATEDIFF(day, st.entrada, st.data_resposta)) as media_dias
    FROM bethadba.ss_tramites st
    JOIN bethadba.ss s ON st.i_ss = s.i_ss
    WHERE st.i_usuarios IN (${ids}) AND st.data_resposta IS NOT NULL
      AND YEAR(st.data_resposta) = ${ano} AND COALESCE(s.i_produto_grupo, 1) = 1
    GROUP BY st.i_usuarios, MONTH(st.data_resposta)
  `;
}

function queryTempoAtividades(iUsuariosList, ano) {
  const ids = iUsuariosList.join(', ');
  return `
    SELECT v.i_usuarios, MONTH(v.dia) as mes,
      CAST(v.NomeAtividade AS BINARY) as atividade,
      SUM(v.tempo) as minutos, COUNT(*) as registros
    FROM bethadba.vanalise_registro_atividades v
    WHERE v.i_usuarios IN (${ids}) AND YEAR(v.dia) = ${ano}
    GROUP BY v.i_usuarios, MONTH(v.dia), v.NomeAtividade
  `;
}

module.exports = {
  queryControleRevisoes, queryControleRevisoesPorGerador,
  queryPontosDefinicao, queryTramitacoesPsai,
  queryRespostasSS, queryTempoAtividades
};
