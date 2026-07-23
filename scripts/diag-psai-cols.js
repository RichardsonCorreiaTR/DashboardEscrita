const qe = require('../src/core/query-executor');

async function main() {
  const r = await qe.executar(`
    SELECT column_name FROM sys.syscolumns
    WHERE table_name = 'psai' AND creator = 'bethadba'
    ORDER BY column_id
  `);
  console.log('=== psai columns ===');
  r.forEach(x => console.log(x.column_name));

  const r2 = await qe.executar(`
    SELECT column_name FROM sys.syscolumns
    WHERE table_name = 'SAI_PSAI' AND creator = 'UP'
    ORDER BY column_id
  `);
  console.log('\n=== SAI_PSAI columns ===');
  r2.forEach(x => console.log(x.column_name));

  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
