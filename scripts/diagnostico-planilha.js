/**
 * diagnostico-planilha.js
 * Verifica quais analistas do equipe.json nao sao encontrados na planilha.
 */
const path = require('path');
const ExcelJS = require('exceljs');
const equipe = require('../config/equipe.json');

const PLANILHA_PATH = path.join(__dirname, '..', 'data', 'planilha-escrita-2026.xlsm');
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio'];

function normalizarNome(nome) {
  return (nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function matcher(analista) {
  const apelido = normalizarNome(analista.apelido);
  const nomeCompleto = normalizarNome(analista.nome);
  return resp => resp === apelido ||
    resp === nomeCompleto ||
    nomeCompleto.startsWith(resp) ||
    resp.startsWith(apelido.split(' ')[0]);
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(PLANILHA_PATH);

  // Coletar todos os responsavel_psai unicos por mes
  const nomesPorMes = {};
  for (const nomeMes of MESES) {
    const sheet = wb.getWorksheet(nomeMes);
    if (!sheet) { nomesPorMes[nomeMes] = new Set(); continue; }

    // encontrar header
    let headerNum = 0;
    sheet.eachRow((row, rn) => {
      if (headerNum) return;
      let hasSAI = false, hasTipo = false;
      row.eachCell(c => {
        if (String(c.value || '') === 'SAI') hasSAI = true;
        if (String(c.value || '').includes('Tipo')) hasTipo = true;
      });
      if (hasSAI && hasTipo) headerNum = rn;
    });

    const nomes = new Set();
    sheet.eachRow((row, rn) => {
      if (rn <= headerNum) return;
      const iSai = parseInt(String(row.getCell(4).value || ''), 10);
      if (!iSai || isNaN(iSai)) return;
      const resp = normalizarNome(String(row.getCell(8).value || '').trim());
      if (resp) nomes.add(resp);
    });
    nomesPorMes[nomeMes] = nomes;
  }

  // Todos os nomes unicos da planilha
  const todosNomes = new Set();
  for (const s of Object.values(nomesPorMes)) s.forEach(n => todosNomes.add(n));

  console.log('\n=== NOMES UNICOS NA PLANILHA (responsavel_psai) ===');
  [...todosNomes].sort().forEach(n => console.log(' ', n));

  const analistas = equipe.analistas.filter(a => a.papel === 'analista');
  console.log('\n=== RESULTADO POR ANALISTA ===');
  for (const a of analistas) {
    const fn = matcher(a);
    const mesesEncontrados = MESES.filter(m => [...(nomesPorMes[m] || [])].some(fn));
    const status = mesesEncontrados.length > 0 ? `OK (${mesesEncontrados.join(', ')})` : 'NAO ENCONTRADO';
    console.log(`  ${a.apelido.padEnd(20)} | ${a.nome.padEnd(35)} | ${status}`);
  }
}

main().catch(e => { console.error('Erro:', e.message); process.exit(1); });
