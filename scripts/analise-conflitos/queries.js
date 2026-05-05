/**
 * queries.js - Queries SQL para analise de conflitos PSAI/SAI
 *
 * Coleta atividades dos analistas SA (time Sabrina) + NEs pendentes Escrita Fiscal
 * Periodo: ultimas 2 semanas
 */

const versao = require('../../src/core/versao');

const VERSAO_ATUAL = '10.6A-03';

const EQUIPE_SA = [
  { nome: 'Ana Paula Duarte Huf', sgd: 906989, iu: 800, apelido: 'Ana Paula' },
  { nome: 'Douglas Ribeiro', sgd: 339196, iu: 1223, apelido: 'Douglas' },
  { nome: 'Taiane Ribeiro', sgd: 1383268, iu: 1280, apelido: 'Taiane' },
  { nome: 'Jerusa De Souza', sgd: 369388, iu: 720, apelido: 'Jerusa' },
  { nome: 'Vivian Cassol Matheus', sgd: 1024928, iu: 891, apelido: 'Vivian' },
  { nome: 'Talita Ferreira Pereira', sgd: 1383271, iu: 1281, apelido: 'Talita' },
  { nome: 'Helen Da Silva Gomes', sgd: 1230721, iu: 1177, apelido: 'Helen' },
  { nome: 'Elisangela Pereira Boaventura', sgd: 1384934, iu: 1286, apelido: 'Elisangela' },
  { nome: 'Ana Carolina Gregorio Goncalves', sgd: 1024928, iu: 1272, apelido: 'Ana Carolina' }
];

const EQUIPE_NE = [
  { nome: 'Ana Ligia Passarelli', sgd: 902202, iu: 796, apelido: 'Ana Ligia' },
  { nome: 'Laiz Velho de Almeida', sgd: 241472, iu: 614, apelido: 'Laiz' },
  { nome: 'Mateus Alves', sgd: 1116513, iu: 1010, apelido: 'Mateus' },
  { nome: 'Flávia Felipe Cardoso', sgd: 1220798, iu: 1282, apelido: 'Flávia' },
  { nome: 'Jessica Maximiano', sgd: 922589, iu: 1263, apelido: 'Jessica' }
];

function queryAtividadesSA() {
  const ids = EQUIPE_SA.map(e => e.iu).join(', ');
  return `
    SELECT v.i_usuarios, v.dia,
           CAST(v.NomeAtividade AS BINARY) as atividade,
           SUM(v.tempo) as minutos, COUNT(*) as registros
    FROM bethadba.vanalise_registro_atividades v
    WHERE v.i_usuarios IN (${ids})
      AND v.dia >= DATEADD(day, -14, CURRENT DATE)
      AND v.dia <= CURRENT DATE
    GROUP BY v.i_usuarios, v.dia, v.NomeAtividade
    ORDER BY v.i_usuarios, v.dia`;
}

function queryAtividadesSAComSai() {
  const ids = EQUIPE_SA.map(e => e.iu).join(', ');
  return `
    SELECT g.i_usuarios, g.inicio, g.fim, g.tempo, g.i_sai,
           CAST(a.nome AS BINARY) as atividade_nome --allow-blob
    FROM bethadba.gaGerenciadorAtividades g
    JOIN bethadba.GAATIVIDADES a ON g.I_ATIVIDADES = a.I_ATIVIDADES
    WHERE g.i_usuarios IN (${ids})
      AND g.inicio >= DATEADD(day, -14, CURRENT DATE)
      AND g.inicio <= CURRENT DATE
      AND g.i_sai IS NOT NULL AND g.i_sai > 0
    ORDER BY g.i_usuarios, g.inicio`;
}

function queryPsaisSendoTrabalhadas() {
  const sgds = EQUIPE_SA.map(e => e.sgd).join(', ');
  return `
    SELECT pt.i_psai, pt.i_usuarios as sgd_analista, pt.entrada,
           pt.i_situacoes,
           CAST(TRIM(sit.descricao) AS BINARY(64)) as situacao --allow-blob
    FROM bethadba.psai_tramites pt
    JOIN bethadba.psai_situacoes sit ON pt.i_situacoes = sit.i_situacoes
    WHERE pt.i_usuarios IN (${sgds})
      AND pt.entrada >= DATEADD(day, -14, CURRENT DATE)
    ORDER BY pt.i_psai, pt.entrada`;
}

function querySaisSendoTrabalhadas() {
  const sgds = EQUIPE_SA.map(e => e.sgd).join(', ');
  const ius = EQUIPE_SA.map(e => e.iu).join(', ');
  return `
    SELECT st.i_sai, st.i_usuarios, st.data_tramite, st.i_sai_situacoes,
           CAST(TRIM(sit.descricao) AS BINARY(64)) as situacao --allow-blob
    FROM bethadba.sai_tramites st
    JOIN bethadba.sai_situacoes sit
      ON st.i_sai_situacoes = sit.i_sai_situacoes
      AND sit.i_sai_linhas = 1
    WHERE (st.i_usuarios IN (${sgds}) OR st.i_usuarios IN (${ius}))
      AND st.data_tramite >= DATEADD(day, -14, CURRENT DATE)
    ORDER BY st.i_sai, st.data_tramite`;
}

function queryDetalhesPsaiSai(psaiIds) {
  const lista = psaiIds.join(', ');
  return `
    SELECT sp.i_psai, sp.i_sai, sp.CadastroPSAI, sp.CadastroSAI,
           sp.gravidade_ne, sp.tipoSAI, sp.nomeArea, sp.nomeVersao,
           sp.Liberacao, sp.Descarte,
           sp.i_sai_situacoes, sp.i_psai_situacoes
    FROM UP.SAI_PSAI sp
    WHERE sp.i_psai IN (${lista})`;
}

function queryNEsPendentesFolha() {
  const ini = versao.sqlInicioVersao(VERSAO_ATUAL);
  const fim = versao.sqlFimVersao(VERSAO_ATUAL);
  return `
    SELECT sp.i_psai, sp.i_sai, sp.CadastroPSAI, sp.gravidade_ne,
           sp.i_sai_situacoes, sp.i_psai_situacoes, sp.nomeVersao,
           sp.tipoSAI
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE sp.nomeArea = 'Escrita'
      AND sp.tipoSAI = 'NE'
      AND sp.Liberacao IS NULL
      AND sp.Descarte IS NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND sp.CadastroPSAI <= ${fim}`;
}

function queryResponsaveisPsai(psaiIds) {
  const lista = psaiIds.join(', ');
  return `
    SELECT pr.i_psai, pr.i_usuarios,
           u.NOME as nome_responsavel
    FROM bethadba.psai_responsaveis pr
    JOIN bethadba.UDUSUARIOS u
      ON pr.i_usuarios = CAST(u.CODIGO_SGD AS INT)
    WHERE pr.i_psai IN (${lista})`;
}

function querySaiResponsaveis(saiIds) {
  const lista = saiIds.join(', ');
  return `
    SELECT sr.i_sai, sr.i_usuarios,
           u.NOME as nome_responsavel
    FROM bethadba.sai_responsaveis sr
    JOIN bethadba.UDUSUARIOS u
      ON sr.i_usuarios = u.I_USUARIOS
    WHERE sr.i_sai IN (${lista})`;
}

module.exports = {
  VERSAO_ATUAL, EQUIPE_SA, EQUIPE_NE,
  queryAtividadesSA, queryAtividadesSAComSai,
  queryPsaisSendoTrabalhadas, querySaisSendoTrabalhadas,
  queryDetalhesPsaiSai, queryNEsPendentesFolha,
  queryResponsaveisPsai, querySaiResponsaveis
};
