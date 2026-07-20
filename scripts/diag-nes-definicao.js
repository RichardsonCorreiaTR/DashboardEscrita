/**
 * diag-nes-definicao.js - Diagnóstico do parser de NEs com Definição
 */
process.chdir(require('path').join(__dirname, '..'));
const ExcelJS = require('exceljs');
const path    = require('path');

const ARQUIVO = path.join('data', 'nes-definicao.xlsx');

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ARQUIVO);

  console.log(`\nAbas encontradas (${wb.worksheets.length}):\n`);
  wb.worksheets.forEach((ws, i) => {
    const nome = ws.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const inclui = nome.includes('escrita') || nome.includes('importa');
    const r1 = ws.getRow(1).getCell(1).value;
    console.log(`  [${inclui ? 'INCLUI' : 'IGNORA'}] "${ws.name}" | linha1: ${String(r1).substring(0, 60)}`);
  });

  // Mostrar conteúdo de uma aba de Importação (a primeira encontrada)
  const abaImp = wb.worksheets.find(ws => {
    const n = ws.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return n.includes('importa');
  });

  if (!abaImp) { console.log('\nNenhuma aba de Importação encontrada!'); return; }

  console.log(`\nPrimeiras linhas da aba "${abaImp.name}":\n`);
  abaImp.eachRow((row, n) => {
    if (n > 10) return;
    const cells = [];
    for (let c = 1; c <= 8; c++) {
      const v = row.getCell(c).value;
      cells.push(v !== null && v !== undefined ? String(v).trim().substring(0, 20) : '');
    }
    console.log(`  Linha ${n}: [${cells.join(' | ')}]`);
  });

  // Inspecionar estrutura das células da primeira aba de Importação de 2026
  const abaImp26 = wb.worksheets.find(ws => ws.name.includes('2026') && ws.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes('importa'));
  const abaAlvo = abaImp26 || abaImp;
  console.log(`\nInspecionando célula NE da aba "${abaAlvo.name}":`);
  abaAlvo.eachRow((row, n) => {
    if (n < 4 || n > 12) return;
    const cell = row.getCell(1);
    const v = cell.value;
    const tipo = typeof v;
    const chaves = tipo === 'object' && v ? Object.keys(v) : [];
    console.log(`  Linha ${n}: tipo=${tipo} | chaves=[${chaves}] | valor=${JSON.stringify(v)?.substring(0,80)} | col5="${row.getCell(5).value}"`);
  });
}

main().catch(e => { console.error('Erro:', e.message); process.exit(1); });
