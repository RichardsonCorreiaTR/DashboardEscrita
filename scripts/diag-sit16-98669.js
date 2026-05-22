const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();

  // Todas as PSAIs da SAI 98669 (sem filtro da view)
  console.log('=== Todas as PSAIs da SAI 98669 ===');
  const psais = await qe.executar(`
    SELECT p.i_psai, p.i_sai, p.i_situacoes, p.i_responsaveis, p.entrada
    FROM bethadba.psai p
    WHERE p.i_sai = 98669
    ORDER BY p.entrada
  `);
  console.log('Total PSAIs:', psais.length);
  psais.forEach(r => console.log('  psai', r.i_psai, '| sit', r.i_situacoes, '| resp', r.i_responsaveis, '| entrada', String(r.entrada||'').slice(0,10)));

  // Tramites sit=16 de 2026 para todas as PSAIs da SAI 98669
  console.log('\n=== Tramites sit=16 em 2026 para SAI 98669 ===');
  const pt16 = await qe.executar(`
    SELECT pt.i_psai, pt.i_situacoes, pt.entrada, pt.i_usuarios
    FROM bethadba.psai_tramites pt
    JOIN bethadba.psai p ON pt.i_psai = p.i_psai
    WHERE p.i_sai = 98669
      AND pt.i_situacoes = 16
      AND YEAR(pt.entrada) = 2026
    ORDER BY pt.entrada
  `);
  console.log('Registros:', pt16.length);
  pt16.forEach(r => console.log('  psai', r.i_psai, '| sit', r.i_situacoes, '| data', String(r.entrada||'').slice(0,10)));

  // Exemplo: quais SAIs dos analistas tiveram sit 16 em abril/2026
  console.log('\n=== Exemplo: SAIs com sit=16 em abril/2026 (5 primeiros) ===');
  const ex = await qe.executar(`
    SELECT TOP 5 pt.i_psai, sp.i_sai, sp.tipoSAI, pt.entrada, p.i_responsaveis
    FROM bethadba.psai_tramites pt
    JOIN bethadba.psai p ON pt.i_psai = p.i_psai
    JOIN UP.SAI_PSAI sp ON p.i_psai = sp.i_psai
    WHERE pt.i_situacoes = 16
      AND MONTH(pt.entrada) = 4 AND YEAR(pt.entrada) = 2026
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND sp.tipoSAI IN ('NE', 'SAL', 'SAIL', 'SAM')
    ORDER BY pt.entrada
  `);
  ex.forEach(r => console.log('  sai', r.i_sai, '| tipo', r.tipoSAI, '| data', String(r.entrada||'').slice(0,10), '| resp', r.i_responsaveis));

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
