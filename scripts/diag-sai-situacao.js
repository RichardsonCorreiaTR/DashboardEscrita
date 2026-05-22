const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();

  // SAI_PSAI com i_sai_situacoes para SAI 98669
  console.log('=== UP.SAI_PSAI com i_sai_situacoes para SAI 98669 ===');
  const sp = await qe.executar(`
    SELECT sp.i_sai, sp.i_psai, sp.tipoSAI, sp.CadastroSAI, sp.i_sai_situacoes,
      sp.nomeVersao, sp.Liberacao
    FROM UP.SAI_PSAI sp
    WHERE sp.i_sai = 98669
  `);
  sp.forEach(r => console.log(JSON.stringify(r)));

  // Situacoes da sai_situacoes (key: i_sai_situacoes, i_sai_linhas=1)
  console.log('\n=== sai_situacoes (i_sai_linhas=1) ===');
  const sit = await qe.executar(`
    SELECT s.i_sai_situacoes, s.descricao
    FROM bethadba.sai_situacoes s
    WHERE s.i_sai_linhas = 1
    ORDER BY s.i_sai_situacoes
  `);
  sit.forEach(r => console.log('  ', r.i_sai_situacoes, '-', r.descricao));

  // Distribuicao i_sai_situacoes em 2026
  console.log('\n=== Distribuicao i_sai_situacoes (SAIs de 2026, Escrita) ===');
  const dist = await qe.executar(`
    SELECT sp.i_sai_situacoes, COUNT(*) as qtd
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE COALESCE(p.i_produto_grupo, 1) = 1
      AND sp.nomeArea = 'Escrita'
      AND YEAR(sp.CadastroSAI) >= 2025
    GROUP BY sp.i_sai_situacoes
    ORDER BY qtd DESC
  `);
  dist.forEach(r => console.log('  sit_sai', r.i_sai_situacoes, ':', r.qtd));

  // Ver SAIs com i_sai_situacoes=16 + Liberacao em 2026
  console.log('\n=== SAIs com i_sai_situacoes=16 e Liberacao em 2026 (TOP 5) ===');
  const lib = await qe.executar(`
    SELECT TOP 5 sp.i_sai, sp.tipoSAI, sp.i_sai_situacoes, sp.Liberacao, sp.nomeVersao, p.i_responsaveis
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.i_sai_situacoes = 16 AND YEAR(sp.Liberacao) = 2026
      AND COALESCE(p.i_produto_grupo, 1) = 1
    ORDER BY sp.Liberacao
  `);
  lib.forEach(r => console.log(JSON.stringify(r)));

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
