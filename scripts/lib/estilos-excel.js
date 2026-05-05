/**
 * estilos-excel.js - Estilos compartilhados para planilhas Excel (ExcelJS)
 * Padrao visual: Thomson Reuters / Dashboard Diretrizes
 */

function estilosExcel() {
  const cores = {
    azulEscuro: 'FF1B2A4A', azulMedio: 'FF2E5090', azulClaro: 'FFD6E4F0',
    vermelho: 'FFC0392B', vermelhoBg: 'FFFCE4EC', verdeBg: 'FFE2EFDA',
    laranjaBg: 'FFFDF2E9', cinzaBg: 'FFF2F2F2', branco: 'FFFFFFFF',
  };

  const borda = {
    top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
    left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
    bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
    right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
  };

  const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

  const fontes = {
    titulo: { name: 'Calibri', size: 14, bold: true, color: { argb: cores.branco } },
    subtitulo: { name: 'Calibri', size: 11, bold: true, color: { argb: cores.branco } },
    secao: { name: 'Calibri', size: 11, bold: true, color: { argb: cores.azulEscuro } },
    normal: { name: 'Calibri', size: 10 },
    negrito: { name: 'Calibri', size: 10, bold: true },
    destaque: { name: 'Calibri', size: 11, bold: true },
    pequena: { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF888888' } },
    vermelho: { name: 'Calibri', size: 10, bold: true, color: { argb: cores.vermelho } },
    verde: { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF27AE60' } },
    brancoNegrito: { name: 'Calibri', size: 11, bold: true, color: { argb: cores.branco } },
  };

  const fills = {
    azulEscuro: fill(cores.azulEscuro), azulMedio: fill(cores.azulMedio),
    azulClaro: fill(cores.azulClaro), vermelho: fill(cores.vermelho),
    vermelhoBg: fill(cores.vermelhoBg), verdeBg: fill(cores.verdeBg),
    laranjaBg: fill(cores.laranjaBg), cinzaBg: fill(cores.cinzaBg),
    branco: fill(cores.branco),
  };

  return { cores, borda, fontes, fills };
}

function applyBorder(ws, row, cols, est) {
  for (let i = 1; i <= cols; i++) ws.getRow(row).getCell(i).border = est.borda;
}

function setTitulo(ws, row, cols, text, est) {
  ws.mergeCells(`A${row}:${colLetra(cols)}${row}`);
  const c = ws.getCell(`A${row}`);
  c.value = text; c.font = est.fontes.titulo;
  c.fill = est.fills.azulEscuro;
  c.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(row).height = 36;
}

function setSubtitulo(ws, row, cols, text, est) {
  ws.mergeCells(`A${row}:${colLetra(cols)}${row}`);
  const c = ws.getCell(`A${row}`);
  c.value = text; c.font = est.fontes.pequena;
  c.fill = est.fills.cinzaBg;
  c.alignment = { horizontal: 'center' };
  ws.getRow(row).height = 20;
}

function setSecao(ws, row, cols, text, est, corBg) {
  ws.mergeCells(`A${row}:${colLetra(cols)}${row}`);
  const c = ws.getCell(`A${row}`);
  c.value = text; c.font = est.fontes.secao;
  c.fill = corBg
    ? { type: 'pattern', pattern: 'solid', fgColor: { argb: corBg } }
    : est.fills.azulClaro;
  applyBorder(ws, row, cols, est);
}

function addHeaderRow(ws, row, headers, est, corBg) {
  const hRow = ws.getRow(row);
  const fillH = corBg
    ? { type: 'pattern', pattern: 'solid', fgColor: { argb: corBg } }
    : est.fills.azulMedio;
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h; c.font = est.fontes.subtitulo; c.fill = fillH;
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = est.borda;
  });
  hRow.height = 32;
}

function colLetra(n) {
  let s = '';
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}

module.exports = { estilosExcel, applyBorder, setTitulo, setSubtitulo, setSecao, addHeaderRow };
