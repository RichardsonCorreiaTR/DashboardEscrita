/**
 * consultas-metas.js - Queries SQL anuais para metas da equipe Escrita Fiscal
 *
 * Retorna dados agrupados por MES (1..12) para o ANO informado.
 * Dois modos de link: POR DEFINIDOR (psai) e POR GERADOR (sai).
 *
 * REVISOES: denominator = SAIs com i_sai_situacoes=16 (Liberada) no ano,
 *           agrupadas pelo mes de sp.Liberacao.
 *           Numerador = TODAS as revisoes (motivos 1,2) da SAI, indiferente do ano.
 */

const FILTRO_AREA = "sp.nomeArea IN ('Escrita', 'Importacao', 'ONVIO ESCRITA')";
const MOTIVOS_AC = '(1, 2)'; // Somente Alteracao (1) e Complemento (2) na definicao. Excluindo motivo externo (4,5)

const TIPOS_REV = "('NE', 'SAL', 'SAIL', 'SAM')";

function queryControleRevisoes(ano, sgd) {
  const extra = sgd ? `AND p.i_responsaveis = ${sgd}` : '';
  return `
    SELECT p.i_responsaveis as i_usuarios, MONTH(sp.Liberacao) as mes,
      sp.tipoSAI as tipo, sp.nomeArea,
      COUNT(DISTINCT sp.i_sai) as total_sais,
      COUNT(DISTINCT CASE WHEN sr.i_motivos IN ${MOTIVOS_AC} THEN sr.i_revisoes ELSE NULL END) as total_revisoes
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    LEFT JOIN bethadba.sai_revisoes sr ON sr.i_sai = sp.i_sai AND sr.i_motivos IN ${MOTIVOS_AC}
    WHERE COALESCE(p.i_produto_grupo, 1) = 1
      AND sp.tipoSAI IN ${TIPOS_REV}
      AND sp.i_sai_situacoes = 16 AND YEAR(sp.Liberacao) = ${ano} ${extra}
    GROUP BY p.i_responsaveis, MONTH(sp.Liberacao), sp.tipoSAI, sp.nomeArea
  `;
}

function queryControleRevisoesPorGerador(ano, uid) {
  const extra = uid ? `AND s.i_usuarios = ${uid}` : '';
  return `
    SELECT s.i_usuarios, MONTH(sp.Liberacao) as mes,
      sp.tipoSAI as tipo, sp.nomeArea,
      COUNT(DISTINCT sp.i_sai) as total_sais,
      COUNT(DISTINCT CASE WHEN sr.i_motivos IN ${MOTIVOS_AC} THEN sr.i_revisoes ELSE NULL END) as total_revisoes
    FROM UP.SAI_PSAI sp
    JOIN bethadba.sai s ON sp.i_sai = s.i_sai
    LEFT JOIN bethadba.sai_revisoes sr ON sr.i_sai = sp.i_sai AND sr.i_motivos IN ${MOTIVOS_AC}
    WHERE COALESCE(s.i_produto_grupo, 1) = 1
      AND sp.tipoSAI IN ${TIPOS_REV}
      AND sp.i_sai_situacoes = 16 AND YEAR(sp.Liberacao) = ${ano} ${extra}
    GROUP BY s.i_usuarios, MONTH(sp.Liberacao), sp.tipoSAI, sp.nomeArea
  `;
}

function queryPontosDefinicao(ano, sgd) {
  const extra = sgd ? `AND p.i_responsaveis = ${sgd}` : '';
  return `
    SELECT p.i_responsaveis as i_usuarios, MONTH(sp.CadastroSAI) as mes,
      sp.i_sai, sp.tipoSAI, p.nivel_alteracao
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.nomeArea IN ('Escrita', 'Importacao', 'ONVIO ESCRITA')
      AND YEAR(sp.CadastroSAI) = ${ano} ${extra}
  `;
}

// sit=2 (Analisada) = analista envia; sit 4,11,12 = coordenador responde
const SIT_ENVIO = 2;
const SIT_RESPOSTA = '(4, 11, 12)';

// N - (N+DOW-2)/7 - (N+DOW-1)/7 : converte dias corridos em uteis (exclui sab/dom)
function diasUteisSql(diffExpr, dowExpr) {
  return `(${diffExpr} - (${diffExpr} + ${dowExpr} - 2) / 7 - (${diffExpr} + ${dowExpr} - 1) / 7)`;
}

function queryTramitacoesPsai(codigoSgdList, maxDias, ano, tiposSAI) {
  const ids = codigoSgdList.join(', ');
  const tipoFiltro = tiposSAI
    ? `AND sp.tipoSAI IN (${tiposSAI.map(t => `'${t}'`).join(', ')})`
    : "AND sp.tipoSAI = 'NE'";
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
      WHERE ${FILTRO_AREA} ${tipoFiltro}
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

function queryTempoMedioSal(ano, sgdList) {
  const ids = Array.isArray(sgdList) ? sgdList.join(', ') : sgdList;
  const filtro = ids ? `AND pr.i_usuarios IN (${ids})` : '';
  return `
    SELECT pr.i_usuarios, sp.i_sai, sp.tipoSAI, MONTH(sp.CadastroSAI) as mes,
      SUM(pr.tempo_analise) as total_analise,
      SUM(pr.tempo_definicao) as total_definicao
    FROM bethadba.psai_responsaveis pr
    JOIN UP.SAI_PSAI sp ON pr.i_psai = sp.i_psai
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE ${FILTRO_AREA}
      AND sp.tipoSAI IN ('SAL', 'NE', 'SAIL', 'SAM')
      AND COALESCE(p.i_produto_grupo, 1) = 1
      ${filtro}
      AND YEAR(sp.CadastroSAI) = ${ano}
    GROUP BY pr.i_usuarios, sp.i_sai, sp.tipoSAI, MONTH(sp.CadastroSAI)
  `;
}

const SITS_DESCARTE = '(5, 6, 23, 33)';

function queryControleDescartes(ano, sgdList) {
  const ids = Array.isArray(sgdList) ? sgdList.join(', ') : sgdList;
  const filtro = ids ? `AND p.i_responsaveis IN (${ids})` : '';
  return `
    SELECT p.i_responsaveis as i_usuarios, MONTH(sp.CadastroPSAI) as mes, sp.i_psai,
      COALESCE(SUM(pr.tempo_analise), 0) as total_analise,
      COALESCE(SUM(pr.tempo_definicao), 0) as total_definicao
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    LEFT JOIN bethadba.psai_responsaveis pr ON pr.i_psai = sp.i_psai
      AND pr.i_usuarios = p.i_responsaveis
    WHERE ${FILTRO_AREA}
      AND sp.i_psai_situacoes IN ${SITS_DESCARTE}
      AND COALESCE(p.i_produto_grupo, 1) = 1
      ${filtro}
      AND YEAR(sp.CadastroPSAI) = ${ano}
    GROUP BY p.i_responsaveis, sp.i_psai, MONTH(sp.CadastroPSAI)
  `;
}

// SAIs geradas pelo analista (sai.i_usuarios = codigo-sgd)
// onde ele NAO e o responsavel da PSAI (p.i_responsaveis != codigo-sgd)
function queryPontosGerados(ano, sgd) {
  return `
    SELECT s.i_usuarios as codigo_sgd, MONTH(sp.CadastroSAI) as mes,
      sp.i_sai, sp.i_psai, sp.tipoSAI, p.nivel_alteracao,
      p.i_responsaveis as resp_psai_sgd
    FROM UP.SAI_PSAI sp
    JOIN bethadba.sai s ON sp.i_sai = s.i_sai
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.nomeArea IN ('Escrita', 'Importacao', 'ONVIO ESCRITA')
      AND s.i_usuarios = ${sgd}
      AND p.i_responsaveis <> ${sgd}
      AND YEAR(sp.CadastroSAI) = ${ano}
  `;
}

// PSAIs descartadas usando DATA DA SITUACAO (psai_tramites.entrada)
function queryDescartesDataSituacao(ano, sgdList) {
  const ids = Array.isArray(sgdList) ? sgdList.join(', ') : sgdList;
  const filtro = ids ? `AND p.i_responsaveis IN (${ids})` : '';
  return `
    SELECT p.i_responsaveis as i_usuarios,
      MONTH(pt.entrada) as mes, sp.i_psai
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    JOIN bethadba.psai_tramites pt ON pt.i_psai = sp.i_psai
      AND pt.i_situacoes IN (5, 6, 23, 33)
    WHERE ${FILTRO_AREA}
      AND COALESCE(p.i_produto_grupo, 1) = 1
      ${filtro}
      AND YEAR(pt.entrada) = ${ano}
      AND NOT EXISTS (
        SELECT 1 FROM bethadba.psai_tramites pt2
        WHERE pt2.i_psai = pt.i_psai
          AND pt2.i_situacoes IN (5, 6, 23, 33)
          AND pt2.entrada < pt.entrada
      )
  `;
}

function queryAnalisesSemSai(ano, sgdList) {
  const ids = Array.isArray(sgdList) ? sgdList.join(', ') : sgdList;
  const filtro = ids ? `AND p.i_responsaveis IN (${ids})` : '';
  return `
    SELECT p.i_responsaveis as i_usuarios,
      MONTH(sp.CadastroPSAI) as mes, COUNT(DISTINCT sp.i_psai) as qtd
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE ${FILTRO_AREA}
      AND sp.i_sai = 0
      AND COALESCE(p.i_produto_grupo, 1) = 1
      ${filtro}
      AND YEAR(sp.CadastroPSAI) = ${ano}
    GROUP BY p.i_responsaveis, MONTH(sp.CadastroPSAI)
  `;
}

module.exports = {
  queryControleRevisoes, queryControleRevisoesPorGerador,
  queryPontosDefinicao, queryPontosGerados, queryTramitacoesPsai,
  queryRespostasSS, queryTempoAtividades, queryTempoMedioSal,
  queryControleDescartes, queryDescartesDataSituacao, queryAnalisesSemSai
};
