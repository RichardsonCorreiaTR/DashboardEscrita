/**
 * aba-detalhes.js - Cria aba "Detalhes Descartes" do Excel de descartes
 */

const { COR, bordaFina, estiloCabecalho, estiloTitulo } = require('./utils');

function criarAbaDetalhes(wb, versoes) {
  const ws = wb.addWorksheet('Detalhes Descartes', { properties: { tabColor: { argb: COR.vermelho } } });
  ws.columns = [
    { width: 4 }, { width: 14 }, { width: 10 }, { width: 10 },
    { width: 12 }, { width: 14 }, { width: 16 }, { width: 50 }
  ];

  ws.mergeCells('B1:H1');
  ws.getCell('B1').value = 'Detalhes dos Descartes (CsD/Reprovada/Prescrita) - NEs Individuais';
  ws.getCell('B1').style = estiloTitulo(13);
  ws.getRow(1).height = 28;

  const headerRow = 3;
  ['Versao', 'i_psai', 'i_sai', 'Gravidade', 'Motivo ID', 'Motivo', 'Descricao'].forEach((h, i) => {
    ws.getCell(headerRow, i + 2).value = h;
    ws.getCell(headerRow, i + 2).style = estiloCabecalho();
  });

  let row = headerRow + 1;
  let totalDetalhes = 0;

  for (const v of versoes) {
    if (!v.detalhes || v.detalhes.length === 0) continue;
    for (const d of v.detalhes) {
      const motNome = d.motivo_id === 5 ? 'Concl. sem Dev' : d.motivo_id === 6 ? 'Reprovada' : d.motivo_id === 23 ? 'Prescrita' : String(d.motivo_id);
      const vals = [v.versao, d.i_psai, d.i_sai, d.gravidade || 'N/D', d.motivo_id, motNome, d.descricao || ''];
      const zebra = totalDetalhes % 2 === 0 ? COR.branco : COR.cinzaClaro;
      vals.forEach((val, ci) => {
        const cell = ws.getCell(row, ci + 2);
        cell.value = val;
        cell.border = bordaFina();
        cell.font = { name: 'Segoe UI', size: 9 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } };
        cell.alignment = ci === 6 ? { wrapText: true, vertical: 'top' } : { horizontal: 'center', vertical: 'middle' };
      });
      row++;
      totalDetalhes++;
    }
  }

  ws.autoFilter = { from: { row: headerRow, column: 2 }, to: { row: row - 1, column: 8 } };
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
  return ws;
}

module.exports = { criarAbaDetalhes };
