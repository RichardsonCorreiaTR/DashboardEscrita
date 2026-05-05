/**
 * estilos.js - Cores, fontes e helpers de formatacao Excel
 */

const COR = {
  azulEscuro: 'FF1B2A4A', azulMedio: 'FF2E5090', azulClaro: 'FFD6E4F0',
  verde: 'FF16A34A', verdeBg: 'FFE2EFDA', verdeEscuro: 'FF166534',
  vermelho: 'FFC0392B', vermelhoBg: 'FFFCE4EC',
  laranja: 'FFE67E22', laranjaBg: 'FFFDF2E9',
  roxo: 'FF7B2D8E', roxoBg: 'FFF3E5F5',
  cinza: 'FFF2F2F2', cinzaMedio: 'FF9CA3AF',
  branco: 'FFFFFFFF', preto: 'FF1F2937'
};

const FONTE = {
  titulo: { name: 'Calibri', size: 14, bold: true, color: { argb: COR.branco } },
  subtitulo: { name: 'Calibri', size: 11, bold: true, color: { argb: COR.branco } },
  secao: { name: 'Calibri', size: 11, bold: true, color: { argb: COR.azulEscuro } },
  normal: { name: 'Calibri', size: 10 },
  negrito: { name: 'Calibri', size: 10, bold: true },
  destaque: { name: 'Calibri', size: 11, bold: true },
  pequena: { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF888888' } },
  kpi: { name: 'Calibri', size: 12, bold: true, color: { argb: COR.verdeEscuro } },
  kpiNeg: { name: 'Calibri', size: 12, bold: true, color: { argb: COR.vermelho } }
};

function borda() {
  const b = { style: 'thin', color: { argb: 'FFD0D0D0' } };
  return { top: b, bottom: b, left: b, right: b };
}

function fill(cor) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: cor } };
}

function setTitulo(ws, row, texto, cols, cor) {
  ws.mergeCells(row, 1, row, cols);
  const c = ws.getCell(row, 1);
  c.value = texto;
  c.font = FONTE.titulo;
  c.fill = fill(cor || COR.azulEscuro);
  c.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(row).height = 32;
}

function setSubtitulo(ws, row, texto, cols) {
  ws.mergeCells(row, 1, row, cols);
  const c = ws.getCell(row, 1);
  c.value = texto;
  c.font = FONTE.pequena;
  c.fill = fill(COR.cinza);
  c.alignment = { horizontal: 'center' };
}

function setCabecalhos(ws, row, headers) {
  headers.forEach((h, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = h;
    c.font = FONTE.subtitulo;
    c.fill = fill(COR.azulMedio);
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = borda();
  });
  ws.getRow(row).height = 28;
}

function setSecao(ws, row, texto, cols, cor) {
  ws.mergeCells(row, 1, row, cols);
  const c = ws.getCell(row, 1);
  c.value = texto;
  c.font = FONTE.secao;
  c.fill = fill(cor || COR.azulClaro);
  for (let i = 1; i <= cols; i++) ws.getCell(row, i).border = borda();
}

function setLinha(ws, row, vals, opts = {}) {
  vals.forEach((v, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = v;
    c.font = opts.bold ? FONTE.negrito : FONTE.normal;
    c.alignment = { horizontal: i === 0 ? 'left' : 'center' };
    c.border = borda();
    if (opts.bg) c.fill = fill(opts.bg);
    if (opts.fontColor) c.font = { ...c.font, color: { argb: opts.fontColor } };
  });
}

function round1(v) { return Math.round(v * 10) / 10; }
function round2(v) { return Math.round(v * 100) / 100; }
function pct(v) { return (v >= 0 ? '+' : '') + Math.round(v) + '%'; }
function horas(min) { return Math.round(min / 60); }

module.exports = {
  COR, FONTE, borda, fill, round1, round2, pct, horas,
  setTitulo, setSubtitulo, setCabecalhos, setSecao, setLinha
};
