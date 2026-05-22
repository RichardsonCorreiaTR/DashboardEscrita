const ExcelJS = require('exceljs');
const path = require('path');

const PLANILHA = 'C:\\Users\\0181286\\Downloads\\Acompanhamento  Escrita SAIs -2026.xlsm';
const MESES = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(PLANILHA);

  const saiMap = {}; // { i_sai: { nivel, analista, tipo } }

  for (const nomeMes of MESES) {
    const sheet = wb.getWorksheet(nomeMes);
    if (!sheet) continue;

    // Encontrar header
    let headerRow = null;
    sheet.eachRow((row, rn) => {
      if (headerRow) return;
      let hasSAI = false, hasTipo = false;
      row.eachCell(c => {
        if (String(c.value || '') === 'SAI') hasSAI = true;
        if (String(c.value || '').includes('Tipo')) hasTipo = true;
      });
      if (hasSAI && hasTipo) headerRow = rn;
    });
    if (!headerRow) continue;

    sheet.eachRow((row, rn) => {
      if (rn <= headerRow) return;
      const cel = col => String(row.getCell(col).value || '').trim();
      const i_sai = parseInt(cel(4), 10);
      if (!i_sai || isNaN(i_sai)) return;
      const nivel = cel(11);
      const tipoSAI = cel(5);
      const responsavel = cel(8);
      if (nivel) {
        saiMap[i_sai] = { nivel, tipoSAI, responsavel, mes: nomeMes };
      }
    });
  }

  console.log('Total SAIs com nivel na planilha:', Object.keys(saiMap).length);
  console.log('\nAmostra (primeiras 10):');
  Object.entries(saiMap).slice(0, 10).forEach(([id, d]) => {
    console.log(`  SAI ${id}: ${d.tipoSAI} | ${d.nivel} | ${d.responsavel} | ${d.mes}`);
  });

  // Verificar distribuicao de niveis
  const dist = {};
  Object.values(saiMap).forEach(d => { dist[d.nivel] = (dist[d.nivel] || 0) + 1; });
  console.log('\nDistribuicao de niveis:');
  Object.entries(dist).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
}
main().catch(e => console.error(e.message));
