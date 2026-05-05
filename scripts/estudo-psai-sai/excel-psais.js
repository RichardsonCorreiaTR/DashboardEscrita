/**
 * excel-psais.js - 1 linha por PSAI, tempo total unico em minutos
 */

const { COR, sCell, sTitulo, fd, aplicarHeaders } = require('./excel-estilos');

function criarAbaPsais(wb, analise) {
  const ws = wb.addWorksheet('PSAIs Individuais', { properties: { tabColor: { argb: COR.azulMedio } } });
  ws.columns = [
    { width: 3 }, { width: 11 }, { width: 9 }, { width: 9 }, { width: 38 },
    { width: 10 }, { width: 20 }, { width: 8 }, { width: 13 },
    { width: 14 }, { width: 10 }, { width: 13 }, { width: 3 }
  ];

  ws.mergeCells('B1:L1');
  ws.getCell('B1').value = 'NEs Individuais - Tempo Total por PSAI (minutos)';
  ws.getCell('B1').style = sTitulo(14);
  ws.getRow(1).height = 28;

  const hdrs = [
    'Versao', 'PSAI', 'SAI', 'Descricao', 'Gravidade', 'Analista',
    'Equipe?', 'Entrada', 'Tempo Total (min)', 'Tem Def.', 'Status'
  ];
  aplicarHeaders(ws, 3, hdrs);

  let row = 4;
  for (const ne of analise.nes) {
    const vals = [
      ne.versao || '-', ne.i_psai, ne.i_sai || '-',
      ne.descricao || '-', ne.gravidade, ne.analista,
      ne.isEquipe ? 'Sim' : 'Nao', fd(ne.cadastroPSAI),
      ne.tempoTotal || 0, ne.temDefinicao ? 'Sim' : 'Nao', ne.status
    ];
    vals.forEach((v, i) => {
      const cell = ws.getCell(row, i + 2);
      cell.value = v;
      cell.style = sCell((row - 4) % 2 === 0);
    });

    if (ne.gravidade === 'Critica') {
      ws.getCell(row, 6).font = { size: 10, name: 'Segoe UI', bold: true, color: { argb: COR.vermelho } };
    } else if (ne.gravidade === 'Grave') {
      ws.getCell(row, 6).font = { size: 10, name: 'Segoe UI', bold: true, color: { argb: COR.laranja } };
    }
    if (ne.temDefinicao) {
      ws.getCell(row, 11).font = { size: 10, name: 'Segoe UI', bold: true, color: { argb: COR.azulMedio } };
    }
    if (ne.status === 'PSAI pendente') {
      ws.getCell(row, 12).font = { size: 10, name: 'Segoe UI', bold: true, color: { argb: COR.vermelho } };
    }
    ws.getCell(row, 5).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    row++;
  }

  if (row > 4) ws.autoFilter = { from: { row: 3, column: 2 }, to: { row: row - 1, column: 12 } };
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
}

module.exports = { criarAbaPsais };
