/**
 * aba-graficos.js - Cria aba "Graficos" (tabelas de dados para graficos)
 */

const { COR, round2, bordaFina, estiloCabecalho, estiloTitulo } = require('./utils');

function criarAbaGraficos(wb, versoes, stats) {
  const ws = wb.addWorksheet('Graficos', { properties: { tabColor: { argb: COR.vermelho } } });
  ws.columns = [
    { width: 4 }, { width: 14 }, { width: 12 }, { width: 12 },
    { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 },
    { width: 12 }, { width: 12 }
  ];

  ws.mergeCells('B1:I1');
  ws.getCell('B1').value = 'Dados para Graficos (gere os graficos selecionando estas tabelas)';
  ws.getCell('B1').style = estiloTitulo(13);

  let row = 3;
  ws.getCell(`B${row}`).value = 'Grafico 1: % Descarte vs EWMA com Faixas de Controle';
  ws.getCell(`B${row}`).style = estiloTitulo(11);
  row++;

  ['Versao', '% Descarte', 'EWMA', 'Normal (+1σ)', 'Atencao (+2σ)'].forEach((h, i) => {
    ws.getCell(row, i + 2).value = h;
    ws.getCell(row, i + 2).style = estiloCabecalho();
  });
  row++;

  const chart1Start = row;
  versoes.forEach((v, idx) => {
    const ewma = round2(stats.ewmaSerie[idx] || 0);
    ws.getCell(row, 2).value = v.versao;
    ws.getCell(row, 3).value = v.percentual;
    ws.getCell(row, 4).value = ewma;
    ws.getCell(row, 5).value = round2(ewma + stats.dp);
    ws.getCell(row, 6).value = round2(ewma + 2 * stats.dp);
    for (let c = 2; c <= 6; c++) {
      ws.getCell(row, c).border = bordaFina();
      ws.getCell(row, c).font = { name: 'Segoe UI', size: 9 };
      ws.getCell(row, c).alignment = { horizontal: 'center' };
      if (c >= 3) ws.getCell(row, c).numFmt = '0.00';
    }
    row++;
  });
  const chart1End = row - 1;
  row += 2;

  ws.getCell(`B${row}`).value = 'Grafico 2: Descartes por Motivo (CsD / Repr / Presc)';
  ws.getCell(`B${row}`).style = estiloTitulo(11);
  row++;

  ['Versao', 'CsD (5)', 'Repr (6)', 'Presc (23)', 'Total'].forEach((h, i) => {
    ws.getCell(row, i + 2).value = h;
    ws.getCell(row, i + 2).style = estiloCabecalho();
  });
  row++;

  const chart2Start = row;
  versoes.forEach(v => {
    ws.getCell(row, 2).value = v.versao;
    ws.getCell(row, 3).value = v.conclSemDev || 0;
    ws.getCell(row, 4).value = v.reprovadas;
    ws.getCell(row, 5).value = v.prescritas;
    ws.getCell(row, 6).value = v.totalDescartesFoco;
    for (let c = 2; c <= 6; c++) {
      ws.getCell(row, c).border = bordaFina();
      ws.getCell(row, c).font = { name: 'Segoe UI', size: 9 };
      ws.getCell(row, c).alignment = { horizontal: 'center' };
    }
    row++;
  });
  const chart2End = row - 1;

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
  return { ws, chart1Start, chart1End, chart2Start, chart2End };
}

module.exports = { criarAbaGraficos };
