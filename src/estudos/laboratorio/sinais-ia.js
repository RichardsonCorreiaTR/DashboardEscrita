/**
 * sinais-ia.js - Sinais numericos por versao baseados em classificacao IA
 *
 * Cada versao recebe um score numerico derivado das classificacoes
 * (complexidade, risco, area tecnica). Esses scores alimentam
 * as estrategias V5 do backtest para prever NEs.
 */

const analise = require('./analise-classificacoes');

const PESO_COMPLEX = { trivial: 1, baixa: 2, media: 3, alta: 4, sistemica: 5 };
const PESO_RISCO = { baixo: 1, medio: 2, alto: 3, critico: 4 };

function calcularPorVersao() {
  const data = analise.carregar();
  if (!data) return {};

  const resultado = {};
  for (const [versao, sais] of Object.entries(data.versoes)) {
    resultado[versao] = calcular(sais);
  }
  return resultado;
}

function calcular(sais) {
  const n = sais.length;
  if (n === 0) return vazio();

  const idxC = mediaP(sais, 'complexidade_real', PESO_COMPLEX);
  const idxR = mediaP(sais, 'risco_regressao', PESO_RISCO);
  const pctAlto = sais.filter(ehAltoRisco).length / n;

  return {
    idx_complexidade: r2(idxC),
    idx_risco: r2(idxR),
    pct_alto_risco: r2(pctAlto),
    score_ia: r2(idxC / 5 * 0.4 + idxR / 4 * 0.4 + pctAlto * 0.2),
    total_sais: n
  };
}

function ehAltoRisco(s) {
  return s.risco_regressao === 'alto' || s.risco_regressao === 'critico';
}

function mediaP(arr, campo, pesos) {
  let soma = 0, c = 0;
  for (const i of arr) {
    const p = pesos[i[campo]];
    if (p !== undefined) { soma += p; c++; }
  }
  return c > 0 ? soma / c : 0;
}

function vazio() {
  return { idx_complexidade: 0, idx_risco: 0, pct_alto_risco: 0, score_ia: 0, total_sais: 0 };
}

function r2(v) { return Math.round(v * 100) / 100; }

module.exports = { calcularPorVersao };
