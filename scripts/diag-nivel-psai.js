const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();

  // Distribuicao nivel_alteracao em SALs 2026
  const dist = await qe.executar(`
    SELECT p.nivel_alteracao, COUNT(*) as qtd
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.nomeArea = 'Escrita' AND sp.tipoSAI = 'SAL'
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND YEAR(sp.CadastroSAI) = 2026
    GROUP BY p.nivel_alteracao
    ORDER BY p.nivel_alteracao
  `);
  console.log('Distribuicao nivel_alteracao em SALs 2026:');
  dist.forEach(r => console.log('  nivel_alteracao:', r.nivel_alteracao, '| qtd:', r.qtd));

  // Verificar PSAIs especificas
  const rows = await qe.executar(`
    SELECT p.i_psai, p.nivel_alteracao
    FROM bethadba.psai p
    WHERE p.i_psai IN (126784, 122916, 125271, 126460)
  `);
  console.log('\nPSAIs especificas:');
  rows.forEach(r => console.log('  PSAI', r.i_psai, '| nivel_alteracao:', r.nivel_alteracao));

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
