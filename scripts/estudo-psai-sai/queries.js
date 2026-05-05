/**
 * queries.js - SQL builders para o estudo PSAI/SAI Nov/2025 - Mar/2026
 *
 * Versoes: 10.5A-11 a 10.6A-03
 * Foco: entradas, descartes, pendentes, tempo PSAI->SAI, definicao, atividades
 */

const versao = require('../../src/core/versao');

const VERSOES = ['10.5A-11', '10.5A-12', '10.6A-01', '10.6A-02', '10.6A-03'];

const FILTRO_BASE = `sai_psai.nomeArea = 'Escrita' AND sai_psai.tipoSAI = 'NE'`;

const FILTRO_PRODUTO = `
  AND (
    EXISTS (SELECT 1 FROM bethadba.sai sai
      WHERE sai_psai.i_sai = sai.i_sai
        AND (sai.i_produto_grupo IS NULL OR sai.i_produto_grupo = 1))
    OR sai_psai.i_sai = 0
  )`;

const EQUIPE = [
  { nome: 'Vitor Justino', sgd: 1392773, iu: 628 },
  { nome: 'Ana Ligia Passarelli', sgd: 902202, iu: 796 },
  { nome: 'Laiz Velho de Almeida', sgd: 241472, iu: 614 },
  { nome: 'Mateus Alves', sgd: 1116513, iu: 1010 },
  { nome: 'Flávia Felipe Cardoso', sgd: 1220798, iu: 1282 },
  { nome: 'Jessica Maximiano', sgd: 922589, iu: 1263 },
  { nome: 'Vivian Cassol Matheus', sgd: 1024928, iu: null },
  { nome: 'Ana Paula Duarte Huf', sgd: 906989, iu: null },
  { nome: 'Douglas Vicente Ribeiro', sgd: 339196, iu: null },
  { nome: 'Taiane Ribeiro Goncalves', sgd: 1383268, iu: null },
  { nome: 'Talita Ferreira Pereira', sgd: 1383271, iu: null },
  { nome: 'Colab. 1383110', sgd: 1383110, iu: null }
];

function queryEntradas(nomeVersao) {
  const ini = versao.sqlInicioVersao(nomeVersao);
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT sai_psai.i_psai, sai_psai.i_sai, sai_psai.CadastroPSAI,
           sai_psai.CadastroSAI, sai_psai.gravidade_ne, sai_psai.NE_PREVENCAO,
           sai_psai.nomeVersao, sai_psai.Liberacao, sai_psai.Descarte,
           sai_psai.i_sai_situacoes, sai_psai.i_psai_situacoes
    FROM UP.SAI_PSAI sai_psai
    WHERE ${FILTRO_BASE}
      AND sai_psai.CadastroPSAI > ${ini}
      AND sai_psai.CadastroPSAI <= ${fim}
      ${FILTRO_PRODUTO}`;
}

function queryDescartes(nomeVersao) {
  const ini = versao.sqlInicioVersao(nomeVersao);
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT sai_psai.i_psai, sai_psai.i_sai, sai_psai.Descarte,
           sai_psai.gravidade_ne, sai_psai.i_sai_situacoes,
           CAST(TRIM(COALESCE(sit.descricao, psai_sit.descricao)) AS BINARY(64)) as situacao_nome --allow-blob
    FROM UP.SAI_PSAI sai_psai
    LEFT JOIN bethadba.sai_situacoes sit
      ON sai_psai.i_sai_situacoes = sit.i_sai_situacoes AND sit.i_sai_linhas = 1
    LEFT JOIN bethadba.psai_situacoes psai_sit
      ON sai_psai.i_psai_situacoes = psai_sit.i_situacoes
    WHERE ${FILTRO_BASE}
      AND sai_psai.Descarte > ${ini}
      AND sai_psai.Descarte <= ${fim}
      ${FILTRO_PRODUTO}`;
}

function queryPendentes(nomeVersao) {
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT COUNT(CASE WHEN sai_psai.i_sai = 0 THEN 1 END) as psai_sem_sai,
           COUNT(CASE WHEN sai_psai.i_sai > 0 AND sai_psai.Liberacao IS NULL
             AND sai_psai.Descarte IS NULL THEN 1 END) as sai_pendente,
           COUNT(*) as total_saldo
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE ${FILTRO_BASE}
      AND sai_psai.CadastroPSAI <= ${fim}
      AND COALESCE(sai_psai.Liberacao, '3000-12-01') > ${fim}
      AND COALESCE(sai_psai.Descarte, '3000-12-01') > ${fim}
      AND COALESCE(psai.i_produto_grupo, 1) = 1`;
}

function queryDefinicaoFlag(nomeVersao) {
  const ini = versao.sqlInicioVersao(nomeVersao);
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT sai_psai.i_psai, sai_psai.i_sai, sai_psai.CadastroPSAI,
           sai_psai.CadastroSAI,
           CASE WHEN s.definicao IS NOT NULL THEN 1 ELSE 0 END as tem_definicao,  --allow-blob
           s.pontuacao as complexidade
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.sai s ON sai_psai.i_sai = s.i_sai
    WHERE ${FILTRO_BASE}
      AND sai_psai.CadastroPSAI > ${ini}
      AND sai_psai.CadastroPSAI <= ${fim}
      AND sai_psai.i_sai > 0
      AND COALESCE(s.i_produto_grupo, 1) = 1`;
}

function queryAtividades(mesInicio, anoInicio, mesFim, anoFim) {
  const ids = EQUIPE.map(e => e.iu).join(', ');
  return `
    SELECT v.i_usuarios, v.dia,
           CAST(v.NomeAtividade AS BINARY) as atividade,
           SUM(v.tempo) as minutos, COUNT(*) as registros
    FROM bethadba.vanalise_registro_atividades v
    WHERE v.i_usuarios IN (${ids})
      AND v.dia >= '${anoInicio}-${String(mesInicio).padStart(2, '0')}-01'
      AND v.dia < '${anoFim}-${String(mesFim + 1).padStart(2, '0')}-01'
    GROUP BY v.i_usuarios, v.dia, v.NomeAtividade`;
}

function queryTramitacoesPsai(mesInicio, anoInicio, mesFim, anoFim) {
  const sgds = EQUIPE.map(e => e.sgd).join(', ');
  return `
    SELECT resp.i_psai, resp.i_usuarios, resp.entrada as data_resposta,
           resp.i_situacoes,
           (SELECT MAX(env.entrada) FROM bethadba.psai_tramites env
            WHERE env.i_psai = resp.i_psai AND env.entrada < resp.entrada
              AND env.i_situacoes = 2) as data_envio
    FROM bethadba.psai_tramites resp
    JOIN bethadba.psai p ON resp.i_psai = p.i_psai
    JOIN UP.SAI_PSAI sp ON sp.i_psai = p.i_psai
    WHERE sp.nomeArea = 'Escrita' AND sp.tipoSAI = 'NE'
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND resp.i_usuarios IN (${sgds})
      AND resp.i_situacoes IN (4, 11, 12)
      AND resp.entrada >= '${anoInicio}-${String(mesInicio).padStart(2, '0')}-01'
      AND resp.entrada < '${anoFim}-${String(mesFim + 1).padStart(2, '0')}-01'`;
}

function queryDatasVersao(nomeVersao) {
  return `
    SELECT PIAZZA.FG_GET_DATA_INICIO_VERSAO('${nomeVersao}', 1) as inicio,
           PIAZZA.FG_GET_DATA_FIM_VERSAO('${nomeVersao}', 1) as fim`;
}

module.exports = {
  VERSOES, EQUIPE,
  queryEntradas, queryDescartes, queryPendentes, queryDefinicaoFlag,
  queryAtividades, queryTramitacoesPsai, queryDatasVersao
};
