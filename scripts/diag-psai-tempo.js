/**
 * diag-psai-tempo.js - Diagnostico: de onde vem o tempo para PSAIs descartadas
 * Uso: node scripts/diag-psai-tempo.js
 */
const path = require('path');
process.chdir(path.join(__dirname, '..'));
const conexao = require('../src/core/conexao');
const qe = require('../src/core/query-executor');

const PSAI_TESTE = 126092;

async function main() {
  await conexao.inicializar();

  console.log(`\n=== Diagnóstico PSAI ${PSAI_TESTE} ===\n`);

  const queries = [
    {
      label: '1. psai_responsaveis (tempo_analise + tempo_definicao)',
      sql: `SELECT i_psai, i_usuarios, dia, tempo_analise, tempo_definicao
            FROM bethadba.psai_responsaveis WHERE i_psai = ${PSAI_TESTE}`
    },
    {
      label: '2. SAI_PSAI (i_psai, i_sai, situacoes)',
      sql: `SELECT i_psai, i_sai, i_psai_situacoes, i_sai_situacoes, tipoSAI, nomeArea
            FROM UP.SAI_PSAI WHERE i_psai = ${PSAI_TESTE}`
    },
    {
      label: '3. bethadba.psai (i_psai, i_responsaveis)',
      sql: `SELECT i_psai, i_responsaveis FROM bethadba.psai WHERE i_psai = ${PSAI_TESTE}`
    },
  ];

  for (const q of queries) {
    console.log(`--- ${q.label} ---`);
    try {
      const rows = await qe.executar(q.sql);
      if (!rows.length) console.log('  (nenhum registro)');
      else rows.forEach(r => console.log(' ', JSON.stringify(r)));
    } catch (e) {
      console.log('  ERRO:', e.message);
    }
    console.log();
  }

  await conexao.fechar();
}

main().catch(e => { console.error(e); process.exit(1); });
