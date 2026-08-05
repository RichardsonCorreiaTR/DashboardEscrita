/**
 * coleta-sais-escrita.js - Coleta SAIs Escrita via ODBC para o Laboratorio IA
 *
 * Retorna itens com texto_spec (descricao + definicao + comportamento).
 */
const { executar } = require('../../src/core/query-executor');
const conexao = require('../../src/core/conexao');

const MAX_SPEC = 8000;

function queryPorVersao(versao) {
  return `
    SELECT sai_psai.i_psai, sai_psai.i_sai, sai_psai.tipoSAI, sai_psai.nomeVersao,
           sai_psai.gravidade_ne, sai_psai.tempoPrevistoTotal, sai_psai.Liberacao,
           psai.nivel_alteracao,
           CAST(SUBSTRING(psai.descricao, 1, 4000) AS BINARY) AS descricao,
           CAST(SUBSTRING(sai.definicao, 1, 4000) AS BINARY) AS definicao,
           CAST(SUBSTRING(sai.comportamento, 1, 4000) AS BINARY) AS comportamento
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    LEFT JOIN bethadba.sai sai ON sai_psai.i_sai = sai.i_sai AND sai_psai.i_sai > 0
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.nomeVersao = '${versao}'
      AND sai_psai.tipoSAI IN ('NE', 'SAM', 'SAL', 'SAIL')
      AND COALESCE(psai.i_produto_grupo, 1) = 1
    --allow-blob`;
}

function extrairRefs(texto) {
  if (!texto) return [];
  const matches = texto.match(/SAI\s+(\d+)/gi) || [];
  return [...new Set(matches.map(m => m.replace(/SAI\s+/i, 'SAI ')))];
}

function montarTextoSpec(r) {
  const partes = [];
  if (r.descricao) partes.push('## Descricao\n' + String(r.descricao).trim());
  if (r.comportamento) partes.push('## Comportamento\n' + String(r.comportamento).trim());
  if (r.definicao) partes.push('## Definicao\n' + String(r.definicao).trim());
  const full = partes.join('\n\n');
  return full.length > MAX_SPEC ? full.slice(0, MAX_SPEC) + '\n...(truncado)' : full;
}

function mapearItem(r) {
  const descricao = (r.descricao || '').trim();
  const texto_spec = montarTextoSpec(r);
  return {
    i_psai: r.i_psai,
    i_sai: r.i_sai || 0,
    tipo: r.tipoSAI,
    tags: [],
    gravidade: r.gravidade_ne || 'Normal',
    nivel_alteracao: r.nivel_alteracao,
    tempoPrevistoTotal: r.tempoPrevistoTotal || 0,
    descricao,
    texto_spec,
    refs_cruzadas: extrairRefs(texto_spec),
    status: r.Liberacao ? 'Liberada' : 'Em andamento'
  };
}

async function coletarPorVersao(versao) {
  await conexao.inicializar();
  const rows = await executar(queryPorVersao(versao));
  return rows.map(mapearItem);
}

async function fechar() {
  await conexao.fechar();
}

module.exports = { coletarPorVersao, fechar, mapearItem };
