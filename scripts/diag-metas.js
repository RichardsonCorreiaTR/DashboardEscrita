/**
 * Diagnostico: verificar mapeamento i_responsaveis vs i_usuarios
 * Rodar: node scripts/diag-metas.js
 */
const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function run() {
  await conexao.inicializar();

  console.log('=== i_responsaveis distintos (Escrita, 2025+) ===');
  const r1 = await qe.executar(`
    SELECT DISTINCT p.i_responsaveis, COUNT(sp.i_sai) as qtd
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.nomeArea = 'Escrita'
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND sp.CadastroSAI >= '2025-01-01'
    GROUP BY p.i_responsaveis
    ORDER BY qtd DESC
  `);
  console.log(JSON.stringify(r1, null, 2));

  console.log('\n=== Verificar se i_usuarios do time existem em psai_tramites ===');
  const ids = [614, 796, 1264, 1263, 1254];
  const r2 = await qe.executar(`
    SELECT pt.i_usuarios, COUNT(pt.i_psai_tramites) as qtd_tramites
    FROM bethadba.psai_tramites pt
    JOIN bethadba.psai p ON pt.i_psai = p.i_psai
    JOIN UP.SAI_PSAI sp ON sp.i_psai = p.i_psai
    WHERE sp.nomeArea = 'Escrita'
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND pt.i_usuarios IN (${ids.join(',')})
      AND sp.CadastroSAI >= '2025-01-01'
    GROUP BY pt.i_usuarios
    ORDER BY qtd_tramites DESC
  `);
  console.log(JSON.stringify(r2, null, 2));

  console.log('\n=== sai_revisoes por i_usuarios do time ===');
  const r3 = await qe.executar(`
    SELECT sr.i_usuarios, COUNT(sr.i_revisoes) as qtd_revisoes
    FROM bethadba.sai_revisoes sr
    JOIN UP.SAI_PSAI sp ON sr.i_sai = sp.i_sai
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.nomeArea = 'Escrita'
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND sr.i_usuarios IN (${ids.join(',')})
      AND sp.CadastroSAI >= '2025-01-01'
    GROUP BY sr.i_usuarios
  `);
  console.log(JSON.stringify(r3, null, 2));

  await conexao.fechar();
}

run().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
