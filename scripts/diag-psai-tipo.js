const qe = require('../src/core/query-executor');

async function main() {
  const prev = await qe.executar(`
    SELECT COALESCE(sp.ne_prevencao, 0) as ne_prevencao, COUNT(*) as qtd
    FROM UP.SAI_PSAI sp
    WHERE sp.tipoSAI = 'SAL' AND sp.nomeArea = 'Escrita'
    GROUP BY COALESCE(sp.ne_prevencao, 0) ORDER BY qtd DESC
  `);
  console.log('SAL Escrita por ne_prevencao:', prev);

  const cross = await qe.executar(`
    SELECT p.tipo, COALESCE(sp.ne_prevencao, 0) as ne_prevencao, COUNT(*) as qtd
    FROM bethadba.psai p
    JOIN UP.SAI_PSAI sp ON sp.i_psai = p.i_psai
    WHERE sp.tipoSAI = 'SAL' AND sp.nomeArea = 'Escrita'
    GROUP BY p.tipo, COALESCE(sp.ne_prevencao, 0)
    ORDER BY p.tipo, ne_prevencao
  `);
  console.log('\nCruzamento tipo x ne_prevencao:', cross);

  const saldoCom = await qe.executar(`
    SELECT COUNT(*) as com_interna FROM UP.SAI_PSAI sp
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE sp.tipoSAI = 'SAL' AND sp.nomeArea = 'Escrita'
      AND COALESCE(sp.ne_prevencao, 0) = 1
      AND COALESCE(psai.i_produto_grupo, 1) = 1
  `);
  console.log('\nSAL no escopo produto com ne_prevencao=1:', saldoCom[0]);

  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
