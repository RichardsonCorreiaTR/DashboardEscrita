/**
 * estrategias-v6.js - Estrategias avancadas de previsao
 *
 * V6: EWMA, carga V2, regressao, cronograma PBCVS
 * V7: ensemble, trend, ridge, auto-tuning
 */

const regressao = require('./regressao');
let _bt = null;
function bt() { if (!_bt) _bt = require('./backtest-lab'); return _bt; }

function ewma(arr, alpha) {
  if (arr.length === 0) return 0;
  let s = arr[0];
  for (let i = 1; i < arr.length; i++) s = alpha * arr[i] + (1 - alpha) * s;
  return s;
}

function slope(arr) {
  const n = arr.length;
  if (n < 3) return 0;
  let sX = 0, sY = 0, sXY = 0, sX2 = 0;
  for (let i = 0; i < n; i++) { sX += i; sY += arr[i]; sXY += i * arr[i]; sX2 += i * i; }
  return (n * sXY - sX * sY) / (n * sX2 - sX * sX);
}

function coletarTreino(todos, nomes, ate, campos) {
  const dados = [];
  for (let j = 1; j < ate; j++) {
    const s = todos[nomes[j]];
    if (!s || s.neLiq === null || s.neLiq === undefined) continue;
    const x = campos.map(c => s[c] || 0);
    if (x.every(v => v === 0)) continue;
    dados.push({ x, y: s.neLiq });
  }
  return dados;
}

function fator(sinal, todos, nomes, idx, campo) {
  if (!sinal || !sinal[campo]) return 1;
  const mh = bt().medianaHistSinais(todos, nomes, idx, campo);
  return bt().clamp(sinal[campo] / mh, 0.7, 1.5);
}

function regPrever(todos, nomes, idx, campos, lambda) {
  const dados = coletarTreino(todos, nomes, idx, campos);
  const modelo = regressao.treinar(dados, lambda);
  if (!modelo || modelo.r2 < 0) return null;
  const sinal = todos[nomes[idx]] || {};
  return regressao.prever(modelo, campos.map(c => sinal[c] || 0));
}

const ESTRATEGIAS = {
  'v6_ewma': (nes) => ewma(nes, 0.3),
  'v6_ewma_02': (nes) => ewma(nes, 0.2),
  'v6_ewma_04': (nes) => ewma(nes, 0.4),

  'v6_ewma_ia': (nes, sinal, todos, nomes, idx) => {
    return ewma(nes, 0.3) * fator(sinal, todos, nomes, idx, 'idx_complexidade');
  },

  'v6_carga_v2': (nes, sinal, todos, nomes, idx) => {
    if (!sinal || !sinal.carga) return bt().mediana(nes);
    return bt().mediana(nes) * fator(sinal, todos, nomes, idx, 'carga');
  },

  'v6_carga_ia': (nes, sinal, todos, nomes, idx) => {
    if (!sinal) return bt().mediana(nes);
    const fc = fator(sinal, todos, nomes, idx, 'carga');
    const fi = fator(sinal, todos, nomes, idx, 'idx_complexidade');
    return bt().mediana(nes) * bt().clamp(fc * 0.5 + fi * 0.5, 0.7, 1.5);
  },

  'v6_reg_ia': (nes, sinal, todos, nomes, idx) => {
    const p = regPrever(todos, nomes, idx, ['idx_complexidade', 'idx_risco']);
    return p > 0 ? p : bt().mediana(nes);
  },

  'v6_reg_v2': (nes, sinal, todos, nomes, idx) => {
    const p = regPrever(todos, nomes, idx, ['carga', 'totalSAs', 'pctLegal']);
    return p > 0 ? p : bt().mediana(nes);
  },

  'v6_reg_completa': (nes, sinal, todos, nomes, idx) => {
    const p = regPrever(todos, nomes, idx, ['idx_complexidade', 'idx_risco', 'carga', 'totalSAs', 'pctLegal']);
    return p > 0 ? p : bt().mediana(nes);
  },

  'v6_ewma_carga_ia': (nes, sinal, todos, nomes, idx) => {
    if (!sinal) return ewma(nes, 0.3);
    const base = ewma(nes, 0.3);
    const fc = fator(sinal, todos, nomes, idx, 'carga');
    const fi = fator(sinal, todos, nomes, idx, 'idx_complexidade');
    return base * bt().clamp(fc * 0.4 + fi * 0.4 + 0.2, 0.7, 1.5);
  },

  'v7_trend': (nes) => {
    const base = bt().mediana(nes);
    const s = slope(nes);
    return base + s;
  },

  'v7_ewma_trend': (nes) => {
    return ewma(nes, 0.3) + slope(nes) * 0.5;
  },

  'v7_ridge_ia': (nes, sinal, todos, nomes, idx) => {
    const p = regPrever(todos, nomes, idx, ['idx_complexidade', 'idx_risco'], 1.0);
    return p > 0 ? p : bt().mediana(nes);
  },

  'v7_ridge_completa': (nes, sinal, todos, nomes, idx) => {
    const campos = ['idx_complexidade', 'idx_risco', 'carga', 'totalSAs', 'pctLegal', 'diasDesenv', 'tendencia'];
    const p = regPrever(todos, nomes, idx, campos, 1.0);
    return p > 0 ? p : bt().mediana(nes);
  },

  'v7_reg_crono': (nes, sinal, todos, nomes, idx) => {
    const campos = ['idx_complexidade', 'carga', 'diasDesenv'];
    const p = regPrever(todos, nomes, idx, campos);
    return p > 0 ? p : bt().mediana(nes);
  },

  'v7_ensemble_top3': (nes, sinal, todos, nomes, idx) => {
    const strats = ['v6_reg_completa', 'v6_reg_ia', 'v6_ewma_ia'];
    const preds = strats.map(s => {
      const fn = bt().ESTRATEGIAS[s];
      return fn ? fn(nes, sinal, todos, nomes, idx) : null;
    }).filter(p => p != null && p > 0);
    return preds.length > 0 ? preds.reduce((a, b) => a + b, 0) / preds.length : bt().mediana(nes);
  },

  'v7_ensemble_top5': (nes, sinal, todos, nomes, idx) => {
    const strats = ['v6_reg_completa', 'v6_reg_ia', 'v6_ewma_ia', 'v7_ridge_completa', 'v7_trend'];
    const preds = strats.map(s => {
      const fn = bt().ESTRATEGIAS[s];
      return fn ? fn(nes, sinal, todos, nomes, idx) : null;
    }).filter(p => p != null && p > 0);
    return preds.length > 0 ? preds.reduce((a, b) => a + b, 0) / preds.length : bt().mediana(nes);
  }
};

const CONFIGS = [
  { nome: 'V6 EWMA a=0.3 (J=4)', estrategia: 'v6_ewma', janela: 4 },
  { nome: 'V6 EWMA a=0.2 (J=4)', estrategia: 'v6_ewma_02', janela: 4 },
  { nome: 'V6 EWMA a=0.4 (J=4)', estrategia: 'v6_ewma_04', janela: 4 },
  { nome: 'V6 EWMA + IA (J=4)', estrategia: 'v6_ewma_ia', janela: 4 },
  { nome: 'V6 Carga V2 (J=4)', estrategia: 'v6_carga_v2', janela: 4 },
  { nome: 'V6 Carga + IA (J=4)', estrategia: 'v6_carga_ia', janela: 4 },
  { nome: 'V6 Regressao IA', estrategia: 'v6_reg_ia', janela: 4 },
  { nome: 'V6 Regressao V2', estrategia: 'v6_reg_v2', janela: 4 },
  { nome: 'V6 Regressao Completa', estrategia: 'v6_reg_completa', janela: 4 },
  { nome: 'V6 EWMA + Carga + IA (J=4)', estrategia: 'v6_ewma_carga_ia', janela: 4 },
  { nome: 'V7 Mediana + Tendencia (J=4)', estrategia: 'v7_trend', janela: 4 },
  { nome: 'V7 EWMA + Tendencia (J=4)', estrategia: 'v7_ewma_trend', janela: 4 },
  { nome: 'V7 Ridge IA (λ=1)', estrategia: 'v7_ridge_ia', janela: 4 },
  { nome: 'V7 Ridge Completa (λ=1)', estrategia: 'v7_ridge_completa', janela: 4 },
  { nome: 'V7 Regressao + Cronograma', estrategia: 'v7_reg_crono', janela: 4 },
  { nome: 'V7 Ensemble Top-3', estrategia: 'v7_ensemble_top3', janela: 4 },
  { nome: 'V7 Ensemble Top-5', estrategia: 'v7_ensemble_top5', janela: 4 }
];

module.exports = { ESTRATEGIAS, CONFIGS };
