const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const PLANILHA = 'C:\\Users\\0181286\\Downloads\\Acompanhamento  Escrita SAIs -2026.xlsm';
const MESES = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const OVERRIDES_PATH = path.join(__dirname, '..', 'config', 'pontos-overrides.json');

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(PLANILHA);
  const saiMap = {};

  for (const nomeMes of MESES) {
    const sheet = wb.getWorksheet(nomeMes);
    if (!sheet) continue;
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
      if (nivel) saiMap[i_sai] = { nivel, mes: nomeMes };
    });
  }

  // Ler overrides existentes
  const existing = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8'));
  const existingIds = new Set((existing.overrides || []).map(o => String(o.i_sai)));

  // Gerar novos overrides para SAIs nao-Baixa da planilha (que ainda nao estao no arquivo)
  const novos = [];
  for (const [id, d] of Object.entries(saiMap)) {
    if (d.nivel.toLowerCase() === 'baixa') continue; // Baixa e o default, nao precisa override
    if (existingIds.has(String(id))) continue; // Ja existe
    novos.push({
      i_sai: parseInt(id),
      nivel: d.nivel,
      conferido: true,
      motivo: 'Planilha Acompanhamento 2026 - ' + d.mes
    });
  }

  console.log('Novos overrides a adicionar:', novos.length);
  novos.forEach(o => console.log('  SAI ' + o.i_sai + ': ' + o.nivel));

  // Merge com existentes
  const merged = {
    ...existing,
    overrides: [...(existing.overrides || []), ...novos]
  };
  fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(merged, null, 2), 'utf8');
  console.log('\nArquivo pontos-overrides.json atualizado. Total overrides:', merged.overrides.length);
}
main().catch(e => console.error(e.message));
