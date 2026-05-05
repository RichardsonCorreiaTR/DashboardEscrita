/**
 * excel-estilos.js - Cores, bordas e estilos compartilhados do Excel
 */

const COR = {
  azulEscuro: 'FF1E3A5F', azulMedio: 'FF2B5797', azulClaro: 'FFD6E4F0',
  verde: 'FF22C55E', verdeBg: 'FFDCFCE7', vermelho: 'FFEF4444', vermelhoBg: 'FFFEE2E2',
  amarelo: 'FFEAB308', amareloBg: 'FFFFFBEB', cinzaClaro: 'FFF3F4F6',
  branco: 'FFFFFFFF', preto: 'FF1F2937', cinzaTexto: 'FF6B7280', laranja: 'FFEA580C'
};

const BORDA = (() => {
  const b = { style: 'thin', color: { argb: 'FFD1D5DB' } };
  return { top: b, bottom: b, left: b, right: b };
})();

const FONTE = 'Segoe UI';

function sHeader() {
  return {
    font: { bold: true, color: { argb: COR.branco }, size: 10, name: FONTE },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.azulMedio } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: BORDA
  };
}

function sCell(zebra, bold) {
  return {
    font: { size: 10, name: FONTE, bold: !!bold },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra ? COR.cinzaClaro : COR.branco } },
    alignment: { horizontal: 'center', vertical: 'middle' }, border: BORDA
  };
}

function sTitulo(sz) {
  return { font: { bold: true, size: sz, color: { argb: COR.azulEscuro }, name: FONTE } };
}

function sSubtitulo() {
  return { font: { size: 9, color: { argb: COR.cinzaTexto }, name: FONTE, italic: true } };
}

function corImpacto(nivel) {
  if (nivel === 'critico') return { fg: COR.vermelhoBg, font: COR.vermelho };
  if (nivel === 'alto') return { fg: COR.amareloBg, font: COR.laranja };
  return { fg: COR.verdeBg, font: COR.verde };
}

function fd(d) { return d ? new Date(d).toLocaleDateString('pt-BR') : '-'; }

function aplicarHeaders(ws, row, headers) {
  headers.forEach((h, i) => { ws.getCell(row, i + 2).value = h; ws.getCell(row, i + 2).style = sHeader(); });
  ws.getRow(row).height = 28;
}

function aplicarLinha(ws, row, vals, zebra, bold) {
  vals.forEach((v, i) => { ws.getCell(row, i + 2).value = v; ws.getCell(row, i + 2).style = sCell(zebra, bold); });
}

module.exports = {
  COR, BORDA, FONTE, sHeader, sCell, sTitulo, sSubtitulo,
  corImpacto, fd, aplicarHeaders, aplicarLinha
};
