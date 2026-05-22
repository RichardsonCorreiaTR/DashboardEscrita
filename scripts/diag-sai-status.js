const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();

  // Verificar quais campos de situacao/status existem na SAI
  console.log('=== Situacoes unicas das SAIs (via bethadba.sai) ===');
  const sit = await qe.executar(`
    SELECT s.i_situacoes, COUNT(*) as qtd
    FROM bethadba.sai s
    WHERE YEAR(s.cadastro) = 2026
    GROUP BY s.i_situacoes
    ORDER BY qtd DESC
  `);
  sit.forEach(r => console.log('  situacao', r.i_situacoes, ':', r.qtd));

  // Verificar descricao das situacoes
  console.log('\n=== Descricao das situacoes de SAI ===');
  const desc = await qe.executar(`
    SELECT i_situacoes, descricao
    FROM bethadba.sai_situacoes
    ORDER BY i_situacoes
  `);
  desc.forEach(r => console.log('  ', r.i_situacoes, '-', r.descricao));

  // Verificar se a view SAI_PSAI filtra por situacao
  console.log('\n=== Situacoes de SAI dentro de UP.SAI_PSAI (2026) ===');
  const sitView = await qe.executar(`
    SELECT s.i_situacoes, COUNT(*) as qtd
    FROM UP.SAI_PSAI sp
    JOIN bethadba.sai s ON sp.i_sai = s.i_sai
    WHERE YEAR(sp.CadastroSAI) = 2026
    GROUP BY s.i_situacoes
    ORDER BY qtd DESC
  `);
  sitView.forEach(r => console.log('  situacao', r.i_situacoes, ':', r.qtd));

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
