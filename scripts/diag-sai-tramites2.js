const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();

  // Tentar sgd_sai_tramites para SAI 98669
  console.log('=== sgd_sai_tramites para SAI 98669 ===');
  try {
    const t = await qe.executar(`
      SELECT TOP 5 st.i_sai, st.i_situacoes, st.data_entrada
      FROM sgd_sai_tramites st
      WHERE st.i_sai = 98669
      ORDER BY st.data_entrada
    `);
    console.log('Registros:', t.length);
    t.forEach(r => console.log(JSON.stringify(r)));
  } catch(e) { console.log('  Erro sgd_sai_tramites:', e.message.slice(0,100)); }

  // Tentar sgd_sai_tramites_atual para SAI 98669
  console.log('\n=== sgd_sai_tramites_atual para SAI 98669 ===');
  try {
    const t = await qe.executar(`
      SELECT TOP 3 st.i_sai, st.i_situacoes, st.data_entrada
      FROM sgd_sai_tramites_atual st
      WHERE st.i_sai = 98669
    `);
    t.forEach(r => console.log(JSON.stringify(r)));
  } catch(e) { console.log('  Erro sgd_sai_tramites_atual:', e.message.slice(0,100)); }

  // Tentar sai_situacoes sem descricao
  console.log('\n=== sai_situacoes (campos sem descricao) ===');
  try {
    const sit = await qe.executar(`
      SELECT i_situacoes, nome FROM sai_situacoes ORDER BY i_situacoes
    `);
    sit.forEach(r => console.log('  ', r.i_situacoes, '-', r.nome));
  } catch(e) { console.log('  Erro nome:', e.message.slice(0,100)); }

  // Tentar sgd_sai_situacoes_descricao
  console.log('\n=== sgd_sai_situacoes_descricao ===');
  try {
    const sit = await qe.executar(`
      SELECT i_situacoes, descricao FROM sgd_sai_situacoes_descricao ORDER BY i_situacoes
    `);
    sit.forEach(r => console.log('  ', r.i_situacoes, '-', r.descricao));
  } catch(e) { console.log('  Erro:', e.message.slice(0,100)); }

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
