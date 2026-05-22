const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();

  // Nivel via JOIN SAI_PSAI -> psai_responsaveis com tempos corretos
  console.log('=== TEMPO CORRETO (psai_responsaveis) para Felipi (1059913) em Jan 2026 ===');
  const tempos = await qe.executar(`
    SELECT pr.i_usuarios, pr.i_psai, sp.i_sai, MONTH(sp.CadastroSAI) as mes,
      pr.tempo_analise, pr.tempo_definicao,
      pr.tempo_analise + pr.tempo_definicao as tempo_total
    FROM bethadba.psai_responsaveis pr
    JOIN UP.SAI_PSAI sp ON pr.i_psai = sp.i_psai
    WHERE sp.nomeArea = 'Escrita' AND sp.tipoSAI = 'SAL'
      AND COALESCE((SELECT p2.i_produto_grupo FROM bethadba.psai p2 WHERE p2.i_psai = sp.i_psai), 1) = 1
      AND pr.i_usuarios = 1059913
      AND YEAR(sp.CadastroSAI) = 2026
      AND MONTH(sp.CadastroSAI) = 1
  `);
  tempos.forEach(r => console.log(JSON.stringify(r)));

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
