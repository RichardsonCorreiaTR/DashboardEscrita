const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();

  // SAI 99414 - Carolina gerou, Erick e responsavel PSAI
  const ids = [99414, 99367, 99289, 99214, 99187];
  const idStr = ids.join(',');

  console.log('=== bethadba.sai para SAIs geradas por Carolina ===');
  const r1 = await qe.executar(`
    SELECT i_sai, i_usuarios FROM bethadba.sai WHERE i_sai IN (${idStr})
  `);
  r1.forEach(r => console.log(JSON.stringify(r)));

  console.log('\n=== sai_roteiro_desenvolvimento (i_responsaveis) para essas SAIs ===');
  const r2 = await qe.executar(`
    SELECT i_sai, i_responsaveis FROM bethadba.sai_roteiro_desenvolvimento
    WHERE i_sai IN (${idStr}) AND data_exclusao IS NULL
  `);
  r2.forEach(r => console.log(JSON.stringify(r)));

  console.log('\n=== UP.SAI_PSAI campos adicionais ===');
  const r3 = await qe.executar(`
    SELECT sp.i_sai, sp.i_psai, sp.tipoSAI, p.i_responsaveis as resp_psai
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.i_sai IN (${idStr})
  `);
  r3.forEach(r => console.log(JSON.stringify(r)));

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
