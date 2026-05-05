/**
 * laboratorio/backtest-lab.js - Backtest com sinais do laboratorio
 *
 * Testa V3 (mediana), V5 (IA) e V6 (regressao+volume+EWMA).
 * Combina sinais IA, dados V2 e NE historica para cada versao.
 */

const fs = require('fs');
const path = require('path');
const { round2 } = require('../estatisticas-ne');
const sinaisIA = require('./sinais-ia');
const sinaisV2 = require('./sinais-v2');
const sinaisPBCVS = require('./sinais-pbcvs');
const v6 = require('./estrategias-v6');

const CACHE_NE = path.join(__dirname, '..', '..', '..', 'data', 'cache', 'estudos-historico.json');
const CACHE_DESC = path.join(__dirname, '..', '..', '..', 'data', 'cache', 'estudos-descartes-ne.json');

function mediana(arr) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function clamp(v, min, max) { return Math.max(min, Math.min(v, max)); }

function neLiq(ne, desc, nome) {
  const v = ne[nome];
  if (!v || !v.totais) return null;
  const b = v.totais.entradasBrutas;
  const d = desc ? desc[nome] : null;
  return d ? b - (d.conclSemDev || 0) - (d.reprovadas || 0) - (d.prescritas || 0) : b;
}

function carregarCaches() {
  const ne = JSON.parse(fs.readFileSync(CACHE_NE, 'utf-8')).versoes;
  let desc = null;
  try { desc = JSON.parse(fs.readFileSync(CACHE_DESC, 'utf-8')).versoes; }
  catch { /* sem descartes */ }
  return { ne, desc };
}

function medianaHistSinais(sinaisPorVersao, nomes, idxAtual, campo) {
  const vals = [];
  for (let j = 0; j < idxAtual; j++) {
    const s = sinaisPorVersao[nomes[j]];
    if (s && s[campo]) vals.push(s[campo]);
  }
  return vals.length > 0 ? mediana(vals) : 1;
}

function carregarSinaisCombinados() {
  const ia = sinaisIA.calcularPorVersao();
  const vol = sinaisV2.calcularPorVersao();
  const pbcvs = sinaisPBCVS.calcularPorVersao();
  const caches = carregarCaches();
  const todosNomes = new Set([...Object.keys(ia), ...Object.keys(vol),
    ...Object.keys(pbcvs), ...Object.keys(caches.ne)]);
  const sinais = {};
  for (const v of todosNomes) {
    sinais[v] = { ...(ia[v] || {}), ...(vol[v] || {}), ...(pbcvs[v] || {}) };
    const ne = neLiq(caches.ne, caches.desc, v);
    if (ne !== null) sinais[v].neLiq = ne;
  }
  const nomes = [...todosNomes].sort();
  for (let i = 3; i < nomes.length; i++) {
    const w = [];
    for (let j = i - 3; j <= i; j++) {
      const ne = sinais[nomes[j]] ? sinais[nomes[j]].neLiq : null;
      if (ne !== null) w.push(ne);
    }
    if (w.length >= 3) {
      let sX = 0, sY = 0, sXY = 0, sX2 = 0;
      for (let k = 0; k < w.length; k++) { sX += k; sY += w[k]; sXY += k * w[k]; sX2 += k * k; }
      sinais[nomes[i]].tendencia = round2((w.length * sXY - sX * sY) / (w.length * sX2 - sX * sX));
    }
  }
  return sinais;
}

function rodarBacktest(nomes, caches, sinaisPorVersao, estrategia, janela) {
  const { ne, desc } = caches;
  const resultados = [];
  for (let i = janela; i < nomes.length - 1; i++) {
    const realLiq = neLiq(ne, desc, nomes[i + 1]);
    if (realLiq === null) continue;
    const nesHist = [];
    for (let j = Math.max(0, i - janela); j < i; j++) {
      const n = neLiq(ne, desc, nomes[j + 1]);
      if (n !== null) nesHist.push(n);
    }
    if (nesHist.length < 3) continue;
    const sinal = sinaisPorVersao[nomes[i]] || null;
    const previsto = estrategia(nesHist, sinal, sinaisPorVersao, nomes, i);
    if (previsto === null) continue;
    const prev = Math.round(previsto);
    const erroAbs = Math.abs(prev - realLiq);
    const erroPct = realLiq > 0 ? round2((erroAbs / realLiq) * 100) : 0;
    resultados.push({ versaoAlvo: nomes[i + 1], previsto: prev, real: realLiq, erroAbs, erroPct });
  }
  return sumarizar(resultados);
}

function sumarizar(resultados) {
  if (resultados.length === 0) return null;
  const mape = round2(resultados.reduce((s, r) => s + r.erroPct, 0) / resultados.length);
  const rec6 = resultados.slice(-6);
  const mape6m = rec6.length > 0 ? round2(rec6.reduce((s, r) => s + r.erroPct, 0) / rec6.length) : null;
  const med = mediana(resultados.map(x => x.real));
  const acerto = round2(
    resultados.filter(r =>
      (r.previsto >= med && r.real >= med) || (r.previsto < med && r.real < med)
    ).length / resultados.length * 100
  );
  return { mape, mape6m, acertoDirecao: acerto, testes: resultados.length, resultados };
}

const ESTRATEGIAS_BASE = {
  'v3_mediana_pura': (nes) => mediana(nes),
  'v3_media_pond': (nes) => {
    const p = nes.map((_, i) => i + 1);
    return nes.reduce((s, v, i) => s + v * p[i], 0) / p.reduce((a, b) => a + b, 0);
  },
  'v5_complexidade_ia': (nes, sinal, todos, nomes, idx) => {
    if (!sinal || !sinal.idx_complexidade) return mediana(nes);
    const mh = medianaHistSinais(todos, nomes, idx, 'idx_complexidade');
    return mediana(nes) * clamp(sinal.idx_complexidade / mh, 0.7, 1.5);
  },
  'v5_risco_ia': (nes, sinal, todos, nomes, idx) => {
    if (!sinal || !sinal.idx_risco) return mediana(nes);
    const mh = medianaHistSinais(todos, nomes, idx, 'idx_risco');
    return mediana(nes) * clamp(sinal.idx_risco / mh, 0.7, 1.5);
  },
  'v5_score_ia': (nes, sinal, todos, nomes, idx) => {
    if (!sinal || !sinal.score_ia) return mediana(nes);
    const mh = medianaHistSinais(todos, nomes, idx, 'score_ia');
    return mediana(nes) * clamp(sinal.score_ia / mh, 0.7, 1.5);
  },
  'v5_complex_suave': (nes, sinal, todos, nomes, idx) => {
    if (!sinal || !sinal.idx_complexidade) return mediana(nes);
    const mh = medianaHistSinais(todos, nomes, idx, 'idx_complexidade');
    return mediana(nes) * clamp(sinal.idx_complexidade / mh, 0.85, 1.15);
  },
  'v5_multi': (nes, sinal, todos, nomes, idx) => {
    if (!sinal) return mediana(nes);
    const mc = medianaHistSinais(todos, nomes, idx, 'idx_complexidade') || 1;
    const mr = medianaHistSinais(todos, nomes, idx, 'idx_risco') || 1;
    const fc = sinal.idx_complexidade ? sinal.idx_complexidade / mc : 1;
    const fr = sinal.idx_risco ? sinal.idx_risco / mr : 1;
    return mediana(nes) * clamp(fc * 0.6 + fr * 0.4, 0.7, 1.5);
  }
};

const ESTRATEGIAS = { ...ESTRATEGIAS_BASE, ...v6.ESTRATEGIAS };

const CONFIGS_BASE = [
  { nome: 'V3 Mediana Pura (J=4) [ATUAL]', estrategia: 'v3_mediana_pura', janela: 4 },
  { nome: 'V3 Mediana Pura (J=3)', estrategia: 'v3_mediana_pura', janela: 3 },
  { nome: 'V3 Mediana Pura (J=6)', estrategia: 'v3_mediana_pura', janela: 6 },
  { nome: 'V3 Media Ponderada (J=4)', estrategia: 'v3_media_pond', janela: 4 },
  { nome: 'V5 Complexidade IA (J=4)', estrategia: 'v5_complexidade_ia', janela: 4 },
  { nome: 'V5 Risco IA (J=4)', estrategia: 'v5_risco_ia', janela: 4 },
  { nome: 'V5 Score Combinado (J=4)', estrategia: 'v5_score_ia', janela: 4 },
  { nome: 'V5 Complexidade Suave (J=4)', estrategia: 'v5_complex_suave', janela: 4 },
  { nome: 'V5 Multi-Sinal (J=4)', estrategia: 'v5_multi', janela: 4 },
  { nome: 'V5 Complexidade IA (J=6)', estrategia: 'v5_complexidade_ia', janela: 6 },
  { nome: 'V5 Score Combinado (J=6)', estrategia: 'v5_score_ia', janela: 6 }
];

const ALL_CONFIGS = [...CONFIGS_BASE, ...v6.CONFIGS];

function executarTodos(nomes, sinaisPorVersao) {
  const caches = carregarCaches();
  const resultados = [];
  for (const cfg of ALL_CONFIGS) {
    const fn = ESTRATEGIAS[cfg.estrategia];
    if (!fn) continue;
    const bt = rodarBacktest(nomes, caches, sinaisPorVersao, fn, cfg.janela);
    if (bt) {
      const score = round2(bt.mape * 0.3 + (bt.mape6m || bt.mape) * 0.7);
      const gen = cfg.estrategia.startsWith('v7_') ? 'V7' : cfg.estrategia.startsWith('v6_') ? 'V6' : cfg.estrategia.startsWith('v5_') ? 'V5' : 'V3';
      resultados.push({ ...cfg, ...bt, scoreFuturo: score, geracao: gen });
    }
  }
  resultados.sort((a, b) => a.scoreFuturo - b.scoreFuturo);
  return resultados;
}

function executarComIA() {
  const sinais = carregarSinaisCombinados();
  const nomes = Object.keys(sinais).sort();
  const estrategias = executarTodos(nomes, sinais);
  const melhor = estrategias[0] || null;
  const atual = estrategias.find(e => e.nome.includes('ATUAL')) || null;
  return {
    estrategias,
    melhor: melhor ? { nome: melhor.nome, mape: melhor.mape, mape6m: melhor.mape6m,
      scoreFuturo: melhor.scoreFuturo, estrategia: melhor.estrategia, janela: melhor.janela,
      geracao: melhor.geracao } : null,
    atual: atual ? { nome: atual.nome, mape: atual.mape, mape6m: atual.mape6m,
      scoreFuturo: atual.scoreFuturo } : null,
    melhoria: atual && melhor ? round2(atual.mape - melhor.mape) : 0,
    totalVersoes: nomes.length
  };
}

module.exports = {
  executarTodos, executarComIA, ESTRATEGIAS,
  mediana, clamp, neLiq, carregarCaches, medianaHistSinais,
  carregarSinaisCombinados
};
