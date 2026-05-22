const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();

  // Seleciona todos os campos da SAI 98669 para ver estrutura
  console.log('=== SAI 98669 - todos os campos ===');
  const r = await qe.executar(`
    SELECT TOP 1 * FROM bethadba.sai WHERE i_sai = 98669
  `);
  if (r.length > 0) {
    Object.entries(r[0]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  }

  // Verificar UP.SAI_PSAI - todos os campos
  console.log('\n=== UP.SAI_PSAI - 98669 ===');
  const sp = await qe.executar(`
    SELECT TOP 1 * FROM UP.SAI_PSAI WHERE i_sai = 98669
  `);
  if (sp.length > 0) {
    Object.entries(sp[0]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  }

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
