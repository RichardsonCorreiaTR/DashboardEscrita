/**
 * utils.js - Cores, estilos e funcoes de estatistica para o Excel de descartes
 */

const COR = {
  azulEscuro: 'FF1E3A5F', azulMedio: 'FF2B5797', azulClaro: 'FFD6E4F0',
  verde: 'FF22C55E', verdeBg: 'FFDCFCE7', verdeEscuro: 'FF166534',
  amarelo: 'FFEAB308', amareloBg: 'FFFEF9C3', amareloEscuro: 'FF854D0E',
  vermelho: 'FFEF4444', vermelhoBg: 'FFFEE2E2', vermelhoEscuro: 'FF991B1B',
  cinzaClaro: 'FFF3F4F6', cinzaMedio: 'FF9CA3AF', branco: 'FFFFFFFF',
  preto: 'FF1F2937', cinzaTexto: 'FF6B7280'
};

function round2(v) { return Math.round(v * 100) / 100; }

function bordaFina() {
  const b = { style: 'thin', color: { argb: 'FFD1D5DB' } };
  return { top: b, bottom: b, left: b, right: b };
}

function estiloCabecalho() {
  return {
    font: { bold: true, color: { argb: COR.branco }, size: 11, name: 'Segoe UI' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.azulMedio } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: bordaFina()
  };
}

function estiloTitulo(size = 16) {
  return {
    font: { bold: true, color: { argb: COR.azulEscuro }, size, name: 'Segoe UI' },
    alignment: { vertical: 'middle' }
  };
}

function calcEWMA(valores, span) {
  if (valores.length === 0) return [];
  const alpha = 2 / (span + 1);
  const result = [valores[0]];
  for (let i = 1; i < valores.length; i++) {
    result.push(round2(alpha * valores[i] + (1 - alpha) * result[i - 1]));
  }
  return result;
}

function calcDesvioPadrao(arr) {
  if (arr.length === 0) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return round2(Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length));
}

function calcMediana(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return round2(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
}

function calcularEstatisticas(versoes) {
  const pcts = versoes.map(v => v.percentual);
  const media = round2(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  const mediana = calcMediana(pcts);
  const dp = calcDesvioPadrao(pcts);
  const ewmaSerie = calcEWMA(pcts, 6);
  const ewmaAtual = ewmaSerie[ewmaSerie.length - 1] || media;
  const recentes = pcts.slice(-6);
  const mediaRecente = round2(recentes.reduce((a, b) => a + b, 0) / recentes.length);
  const totEntradas = versoes.reduce((s, v) => s + v.entradas, 0);
  const totConcl = versoes.reduce((s, v) => s + (v.conclSemDev || 0), 0);
  const totRepr = versoes.reduce((s, v) => s + v.reprovadas, 0);
  const totPresc = versoes.reduce((s, v) => s + v.prescritas, 0);
  const totFoco = totConcl + totRepr + totPresc;
  const pctGlobal = totEntradas > 0 ? round2((totFoco / totEntradas) * 100) : 0;

  return {
    media, mediana, dp, ewmaSerie, ewmaAtual,
    faixaNormal: round2(ewmaAtual + dp), faixaAtencao: round2(ewmaAtual + 2 * dp),
    mediaRecente, totEntradas, totConcl, totRepr, totPresc, totFoco, pctGlobal,
    min: round2(Math.min(...pcts)), max: round2(Math.max(...pcts))
  };
}

module.exports = {
  COR, round2, bordaFina, estiloCabecalho, estiloTitulo,
  calcularEstatisticas
};
