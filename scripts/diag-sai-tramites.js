const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();

  // Verificar tabelas de tramites da SAI
  console.log('=== Tabelas com "sai_tram" no nome ===');
  const tabs = await qe.executar(`
    SELECT table_name FROM sys.systable
    WHERE table_name LIKE '%sai_tram%' OR table_name LIKE '%sai_sit%'
    ORDER BY table_name
  `);
  tabs.forEach(r => console.log('  ', r.table_name));

  // Verificar tramites da SAI 98669 em bethadba.sai_tramites (se existir)
  console.log('\n=== bethadba.sai_tramites para SAI 98669 ===');
  try {
    const t = await qe.executar(`
      SELECT st.i_tramites, st.i_situacoes, st.entrada, st.i_usuarios
      FROM bethadba.sai_tramites st
      WHERE st.i_sai = 98669
      ORDER BY st.entrada
    `);
    console.log('Registros:', t.length);
    t.forEach(r => console.log('  tram', r.i_tramites, '| sit', r.i_situacoes, '| data', String(r.entrada||'').slice(0,10), '| user', r.i_usuarios));
  } catch(e) { console.log('  Erro:', e.message.slice(0,80)); }

  // Verificar bethadba.sai_situacoes
  console.log('\n=== bethadba.sai_situacoes ===');
  try {
    const sit = await qe.executar(`
      SELECT i_situacoes, descricao FROM bethadba.sai_situacoes ORDER BY i_situacoes
    `);
    sit.forEach(r => console.log('  ', r.i_situacoes, '-', r.descricao));
  } catch(e) { console.log('  Erro:', e.message.slice(0,80)); }

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
