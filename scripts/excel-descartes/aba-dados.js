/**
 * aba-dados.js - Cria aba "Dados por Versao" do Excel de descartes
 */

const { COR, round2, bordaFina, estiloCabecalho, estiloTitulo } = require('./utils');

function criarAbaDados(wb, versoes, stats) {
  const ws = wb.addWorksheet('Dados por Versao', { properties: { tabColor: { argb: COR.verde } } });
  ws.columns = [
    { header: '', width: 4 }, { header: 'Versao', width: 14 },
    { header: 'Entradas', width: 12 }, { header: 'CsD (5)', width: 12 },
    { header: 'Repr (6)', width: 12 }, { header: 'Presc (23)', width: 12 },
    { header: 'Total Foco', width: 13 }, { header: '% Descarte', width: 13 },
    { header: 'EWMA', width: 10 }, { header: 'Faixa Normal', width: 14 },
    { header: 'Faixa Atencao', width: 14 }, { header: 'Status', width: 12 }
  ];

  ws.mergeCells('B1:L1');
  ws.getCell('B1').value = 'Dados Historicos - Descartes por Versao';
  ws.getCell('B1').style = estiloTitulo(14);
  ws.getRow(1).height = 30;

  const headerRow = 3;
  ['Versao', 'Entradas', 'CsD (5)', 'Repr (6)', 'Presc (23)', 'Total Foco', '% Descarte', 'EWMA', 'Faixa Normal', 'Faixa Atencao', 'Status'].forEach((h, i) => {
    ws.getCell(headerRow, i + 2).value = h;
    ws.getCell(headerRow, i + 2).style = estiloCabecalho();
  });
  ws.getRow(headerRow).height = 28;

  const dataStartRow = headerRow + 1;
  versoes.forEach((v, idx) => {
    const r = dataStartRow + idx;
    const ewma = round2(stats.ewmaSerie[idx] || 0);
    const fn = round2(ewma + stats.dp);
    const fa = round2(ewma + 2 * stats.dp);
    let status;
    if (v.percentual <= fn) status = 'Normal';
    else if (v.percentual <= fa) status = 'Atencao';
    else status = 'Critico';

    const isLast = idx === versoes.length - 1;
    const zebra = idx % 2 === 0 ? COR.branco : COR.cinzaClaro;
    const vals = [v.versao, v.entradas, v.conclSemDev || 0, v.reprovadas, v.prescritas, v.totalDescartesFoco, v.percentual, ewma, fn, fa, status];

    vals.forEach((val, ci) => {
      const cell = ws.getCell(r, ci + 2);
      cell.value = val;
      cell.border = bordaFina();
      cell.font = { name: 'Segoe UI', size: 10, bold: isLast };
      cell.alignment = { horizontal: ci === 0 ? 'left' : 'center', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isLast ? COR.azulClaro : zebra } };
      if (ci >= 6 && ci <= 9) cell.numFmt = '0.00"%"';
      if (ci === 10) {
        const corS = status === 'Normal' ? COR.verdeEscuro : status === 'Atencao' ? COR.amareloEscuro : COR.vermelhoEscuro;
        const bgS = status === 'Normal' ? COR.verdeBg : status === 'Atencao' ? COR.amareloBg : COR.vermelhoBg;
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: corS } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgS } };
      }
    });
  });

  const totalRow = dataStartRow + versoes.length;
  ['TOTAL', stats.totEntradas, stats.totConcl, stats.totRepr, stats.totPresc, stats.totFoco, stats.pctGlobal, '-', '-', '-', '-'].forEach((val, ci) => {
    const cell = ws.getCell(totalRow, ci + 2);
    cell.value = val;
    cell.style = {
      font: { bold: true, size: 10, name: 'Segoe UI', color: { argb: COR.branco } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.azulEscuro } },
      alignment: { horizontal: 'center', vertical: 'middle' }, border: bordaFina()
    };
    if (ci === 6) cell.numFmt = '0.00"%"';
  });
  ws.getRow(totalRow).height = 24;
  ws.autoFilter = { from: { row: headerRow, column: 2 }, to: { row: totalRow - 1, column: 12 } };
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
  return { ws, dataStartRow, headerRow };
}

module.exports = { criarAbaDados };
