/**
 * diag-psai-visibilidade.js - Colunas psai/SAI_PSAI com 'vis'
 */
const qe = require('../src/core/query-executor');
const I_PSAI = Number(process.argv[2]) || 125088;

async function cols(table, creator) {
  const rows = await qe.executar(`
    SELECT column_name, domain_id
    FROM sys.syscolumns
    WHERE table_name = '${table}' AND creator = '${creator}'
      AND (LOWER(column_name) LIKE '%vis%' OR LOWER(column_name) LIKE '%intern%')
    ORDER BY column_id
  `);
  console.log(`\n=== Colunas ${creator}.${table} (vis/intern) ===`);
  rows.forEach(r => console.log(' ', r.column_name));
  return rows;
}

async function main() {
  await cols('psai', 'bethadba');
  await cols('SAI_PSAI', 'UP');

  const allPsai = await qe.executar(`
    SELECT column_name FROM sys.syscolumns
    WHERE table_name = 'psai' AND creator = 'bethadba'
    ORDER BY column_id
  `);
  console.log('\n=== Todas colunas psai ===');
  console.log(allPsai.map(r => r.column_name).join(', '));

  const sp = await qe.executar(`
    SELECT sp.i_psai, sp.i_sai, sp.tipoSAI, sp.nomeArea, sp.CadastroPSAI
    FROM UP.SAI_PSAI sp WHERE sp.i_psai = ${I_PSAI}
  `);
  console.log(`\n=== SAI_PSAI ${I_PSAI} basico ===`, sp[0]);

  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
