const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();

  // Tentar obter as situacoes da PSAI
  console.log('=== Situacoes de bethadba.psai_situacoes ===');
  const sit = await qe.executar(`
    SELECT i_situacoes, descricao
    FROM bethadba.psai_situacoes
    ORDER BY i_situacoes
  `);
  sit.forEach(r => console.log('  ', r.i_situacoes, '-', r.descricao));

  // Distribuicao de situacao das PSAIs de 2026 (UP.SAI_PSAI)
  console.log('\n=== Situacao das PSAIs ligadas a SAIs de 2026 ===');
  const dist = await qe.executar(`
    SELECT p.i_situacoes, COUNT(*) as qtd
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE YEAR(sp.CadastroSAI) = 2026
    GROUP BY p.i_situacoes
    ORDER BY qtd DESC
  `);
  dist.forEach(r => console.log('  situacao', r.i_situacoes, ':', r.qtd));

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
