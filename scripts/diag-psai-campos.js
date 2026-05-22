const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();

  // Verificar campos da psai (para SAI 98669 que tem i_psai=122890)
  console.log('=== PSAI 122890 - todos os campos ===');
  const r = await qe.executar(`SELECT TOP 1 * FROM bethadba.psai WHERE i_psai = 122890`);
  if (r.length > 0) {
    Object.entries(r[0]).forEach(([k, v]) => {
      if (typeof v !== 'string' || v.length < 200) console.log(`  ${k}: ${v}`);
    });
  }

  // Situacoes da PSAI
  console.log('\n=== Situacoes de bethadba.psai_situacoes ===');
  const sit = await qe.executar(`SELECT * FROM bethadba.psai_situacoes ORDER BY i_situacoes`);
  sit.forEach(r => console.log('  ', r.i_situacoes, '-', r.descricao || r.nome || JSON.stringify(r)));

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
