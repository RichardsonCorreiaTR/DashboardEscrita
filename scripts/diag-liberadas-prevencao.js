/**
 * diag-liberadas-prevencao.js - Verifica se as LIBERADAS incluem NEs internas (prevencao)
 *
 * Uso: node scripts/diag-liberadas-prevencao.js [versao]
 */
const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');
const cne = require('../src/core/consultas-ne');

const AREA = 'Escrita';

function queryLiberadasPrevencao(nomeVersao, area = 'Escrita') {
  return `
    SELECT sai_psai.i_sai, sai_psai.i_psai, sai_psai.Liberacao,
           sai_psai.gravidade_ne, sai_psai.NE_PREVENCAO
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE ${cne.condAreaNE(area)}
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.nomeVersao = '${nomeVersao}'
      AND sai_psai.Liberacao IS NOT NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
    ORDER BY sai_psai.NE_PREVENCAO, sai_psai.i_sai
  `;
}

async function main() {
  const nomeVersao = process.argv[2] || '10.6A-01';
  await conexao.inicializar();

  const rows = await qe.executar(queryLiberadasPrevencao(nomeVersao, AREA));
  const externas = rows.filter(r => r.NE_PREVENCAO !== 1);
  const internas = rows.filter(r => r.NE_PREVENCAO === 1);

  console.log(`\n===== LIBERADAS ${nomeVersao} - por origem =====`);
  console.log(`Total liberadas:  ${rows.length}`);
  console.log(`  Externas:       ${externas.length}`);
  console.log(`  Internas (prev):${internas.length}`);
  if (internas.length) {
    console.log('\n  NEs internas (NE_PREVENCAO=1) contadas nas liberadas:');
    internas.forEach(r => console.log(`   SAI ${r.i_sai} | PSAI ${r.i_psai} | ${String(r.Liberacao || '').slice(0, 10)} | ${r.gravidade_ne}`));
  }

  await conexao.fechar();
}
main().catch(e => { console.error(e); process.exit(1); });
