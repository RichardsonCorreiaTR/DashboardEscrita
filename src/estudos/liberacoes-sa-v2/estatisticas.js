/**
 * liberacoes-sa-v2/estatisticas.js - Estatisticas V2
 *
 * Descritivas com winsoirzacao, percentis e deteccao de outliers.
 * Filtra versoes com totalLiberacoes=0 da analise.
 */

const { mediana, media, desvioPadrao, round2 } = require('../estatisticas-ne');
const { obterTotalEfetivo, obterCargaEfetiva } = require('./projecao-utils');

function percentil(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function winsorizar(arr, pctLow, pctHigh) {
  if (arr.length < 3) return [...arr];
  const lo = percentil(arr, pctLow);
  const hi = percentil(arr, pctHigh);
  return arr.map(v => Math.max(lo, Math.min(hi, v)));
}

function calcularEstatisticas(versoes) {
  const validas = versoes.filter(v => obterTotalEfetivo(v) > 0);
  if (validas.length === 0) return null;

  const totais = validas.map(v => obterTotalEfetivo(v));
  const cargas = validas.map(v => obterCargaEfetiva(v));
  const cargasWin = winsorizar(cargas, 5, 95);
  const dp = desvioPadrao(totais);
  const m = media(totais);
  const outliers = validas
    .filter(v => Math.abs(obterTotalEfetivo(v) - m) > 2 * dp)
    .map(v => v.versao);

  return {
    totalVersoes: validas.length,
    versoesExcluidas: versoes.length - validas.length,
    total: {
      media: round2(media(totais)), mediana: round2(mediana(totais)),
      min: Math.min(...totais), max: Math.max(...totais),
      desvioPadrao: round2(dp),
      p25: round2(percentil(totais, 25)), p75: round2(percentil(totais, 75))
    },
    carga: {
      media: round2(media(cargas)), mediana: round2(mediana(cargas)),
      mediaWinsorizada: round2(media(cargasWin)),
      desvioPadrao: round2(desvioPadrao(cargas)),
      p25: round2(percentil(cargas, 25)), p75: round2(percentil(cargas, 75))
    },
    outliers
  };
}

module.exports = { percentil, winsorizar, calcularEstatisticas, mediana, media, round2 };
