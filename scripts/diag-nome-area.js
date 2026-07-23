/**
 * Diagnostico: nomeArea nas entradas Ambas
 */
const conexao = require('../src/core/conexao');
const qe = require('../src/core/query-executor');
const { queryEntradas } = require('../src/core/consultas-ne');

async function main() {
  await conexao.inicializar();
  const rows = await qe.executar(queryEntradas('10.6A-01', 'Ambas'));
  console.log('Total:', rows.length);
  const sample = rows.slice(0, 5);
  for (const r of sample) {
    console.log('keys:', Object.keys(r));
    console.log('row:', JSON.stringify(r));
  }
  const comArea = rows.filter(r => r.nomeArea || r.NOMEAREA || r.nomearea);
  console.log('Com nomeArea:', comArea.length, '/', rows.length);
  if (comArea[0]) console.log('Exemplo com area:', comArea[0]);

  const probe = await qe.executar(`
    SELECT TOP 5 i_psai, i_sai, nomeArea,
           CAST(TRIM(nomeArea) AS BINARY(32)) as area_bin
    FROM UP.SAI_PSAI
    WHERE tipoSAI = 'NE' AND (nomeArea = 'Escrita' OR nomeArea LIKE 'Importa%')
      AND CadastroPSAI > '2025-12-26' AND CadastroPSAI <= '2026-01-22'
  `);
  console.log('Probe direto:', JSON.stringify(probe, null, 2));

  await conexao.fechar();
}

main().catch(e => { console.error(e); process.exit(1); });
