const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();

  // Campos de sgd_versoes_sais (sem join)
  console.log('=== sgd_versoes_sais para SAI 98669 ===');
  const svs = await qe.executar(`
    SELECT TOP 5 svs.i_versoes, svs.i_sai, svs.i_responsaveis
    FROM sgd_versoes_sais svs
    WHERE svs.i_sai = 98669
  `);
  svs.forEach(r => console.log(JSON.stringify(r)));

  // Campos de sgd_versoes (TOP 1 para ver estrutura)
  console.log('\n=== sgd_versoes TOP 1 (campos disponíveis) ===');
  const sv = await qe.executar(`
    SELECT TOP 1 sv.i_versoes, sv.i_situacoes, sv.data_liberacao
    FROM sgd_versoes sv
    WHERE sv.i_situacoes = 16 AND sv.data_liberacao IS NOT NULL
    ORDER BY sv.data_liberacao DESC
  `);
  sv.forEach(r => console.log(JSON.stringify(r)));

  // Tentar psai_tramites_situacoes sem descricao
  console.log('\n=== psai_situacoes situacao 16 (via psai) ===');
  const ps16 = await qe.executar(`
    SELECT COUNT(*) as total
    FROM bethadba.psai p
    WHERE p.i_situacoes = 16
  `);
  console.log('PSAIs com i_situacoes=16:', ps16[0].total);

  // Verificar psai_tramites com sit 16 para SAI 98669
  console.log('\n=== psai_tramites sit=16 para SAI 98669 (via psai join) ===');
  const pt16 = await qe.executar(`
    SELECT pt.i_psai, pt.i_situacoes, pt.entrada, pt.i_usuarios
    FROM bethadba.psai_tramites pt
    JOIN bethadba.psai p ON pt.i_psai = p.i_psai
    WHERE p.i_sai = 98669 AND pt.i_situacoes = 16
    ORDER BY pt.entrada
  `);
  pt16.forEach(r => console.log('  sit', r.i_situacoes, '| data', String(r.entrada||'').slice(0,10)));

  // Verificar sit 16 na distribuicao de 2026 (psai atual)
  console.log('\n=== PSAIs em situacao 16 de 2026 ===');
  const p16 = await qe.executar(`
    SELECT COUNT(*) as total
    FROM bethadba.psai p
    JOIN UP.SAI_PSAI sp ON p.i_psai = sp.i_psai
    WHERE p.i_situacoes = 16 AND YEAR(sp.CadastroSAI) = 2026
  `);
  console.log('Total:', p16[0].total);

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
