/**
 * liberacoes-sa-v2/calibracao.js - Simulacao de estrategias de previsao
 * Testa 8+ abordagens via backtest historico usando caches em disco.
 */

const path = require('path');
const fs = require('fs');
const { round2 } = require('../estatisticas-ne');
const coleta = require('./coleta');
const { agregarVersao } = require('./carga');

const CACHE_NE = path.join(__dirname, '..', '..', '..', 'data', 'cache', 'estudos-historico.json');
const CACHE_DESC = path.join(__dirname, '..', '..', '..', 'data', 'cache', 'estudos-descartes-ne.json');
const CACHE_SA = path.join(__dirname, '..', '..', '..', 'data', 'cache', 'estudos-liberacoes-sa-v2.json');
const FATOR_CLAMP = { min: 0.5, max: 2.0 };

function carregar() {
  const ne = JSON.parse(fs.readFileSync(CACHE_NE, 'utf-8')).versoes;
  const desc = JSON.parse(fs.readFileSync(CACHE_DESC, 'utf-8')).versoes;
  const saRaw = JSON.parse(fs.readFileSync(CACHE_SA, 'utf-8')).versoes;
  const saProc = {};
  for (const [nome, v] of Object.entries(saRaw)) {
    if (v.itens && v.itens.length > 0) saProc[nome] = agregarVersao(v.itens);
  }
  return { ne, desc, saProc };
}

function neLiq(ne, desc, nome) {
  const v = ne[nome];
  if (!v || !v.totais) return null;
  const b = v.totais.entradasBrutas;
  const d = desc[nome];
  return d ? b - (d.conclSemDev || 0) - (d.reprovadas || 0) - (d.prescritas || 0) : b;
}

function mediana(arr) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function ewma(arr, span) {
  const alpha = 2 / (span + 1);
  let result = arr[0];
  for (let i = 1; i < arr.length; i++) result = alpha * arr[i] + (1 - alpha) * result;
  return result;
}

function tendencia(arr) {
  const n = arr.length;
  if (n < 3) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) { sumX += i; sumY += arr[i]; sumXY += i * arr[i]; sumX2 += i * i; }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return slope;
}

function clamp(v, min, max) { return Math.max(min, Math.min(v, max)); }

function rodarBacktest(nomes, dados, estrategia, params = {}) {
  const { ne, desc, saProc } = dados;
  const jan = params.janela || 6;
  const resultados = [];

  for (let i = jan; i < nomes.length - 1; i++) {
    const sa = saProc[nomes[i]];
    const realLiq = neLiq(ne, desc, nomes[i + 1]);
    if (!sa || sa.totalLiberacoes === 0 || realLiq === null) continue;

    const nes = [];
    const cargas = [];
    for (let j = Math.max(0, i - jan); j < i; j++) {
      const n = neLiq(ne, desc, nomes[j + 1]);
      const s = saProc[nomes[j]];
      if (n !== null && s) { nes.push(n); cargas.push(s.carga.total); }
    }
    if (nes.length < 3) continue;

    const previsto = estrategia(nes, cargas, sa, params);
    if (previsto === null) continue;

    const prev = Math.round(previsto);
    const erroAbs = Math.abs(prev - realLiq);
    const erroPct = realLiq > 0 ? round2((erroAbs / realLiq) * 100) : 0;

    resultados.push({
      versaoAlvo: nomes[i + 1], previsto: prev, real: realLiq,
      erroAbs, erroPct
    });
  }

  if (resultados.length === 0) return null;
  const mape = round2(resultados.reduce((s, r) => s + r.erroPct, 0) / resultados.length);
  const acerto = round2(resultados.filter(r => {
    const base = mediana(resultados.map(x => x.real));
    return (r.previsto >= base && r.real >= base) || (r.previsto < base && r.real < base);
  }).length / resultados.length * 100);

  return { mape, acertoDirecao: acerto, testes: resultados.length, resultados };
}

/* ============== ESTRATEGIAS ============== */

const estrategias = {
  'mediana_pura': (nes) => mediana(nes),

  'mediana_carga': (nes, cargas, sa) => {
    const basNE = mediana(nes);
    const basC = mediana(cargas);
    const f = basC > 0 ? clamp(sa.carga.total / basC, FATOR_CLAMP.min, FATOR_CLAMP.max) : 1;
    return basNE * f;
  },

  'ewma_pura': (nes, _, __, p) => ewma(nes, p.span || 4),

  'ewma_carga': (nes, cargas, sa, p) => {
    const basNE = ewma(nes, p.span || 4);
    const basC = mediana(cargas);
    const f = basC > 0 ? clamp(sa.carga.total / basC, FATOR_CLAMP.min, FATOR_CLAMP.max) : 1;
    return basNE * f;
  },

  'mediana_tendencia': (nes) => {
    const base = mediana(nes);
    const slope = tendencia(nes);
    return base + slope;
  },

  'ewma_tendencia': (nes, _, __, p) => {
    const base = ewma(nes, p.span || 4);
    const slope = tendencia(nes);
    return base + slope * 0.5;
  },

  'mediana_carga_tendencia': (nes, cargas, sa) => {
    const basNE = mediana(nes), basC = mediana(cargas);
    const f = basC > 0 ? clamp(sa.carga.total / basC, FATOR_CLAMP.min, FATOR_CLAMP.max) : 1;
    return (basNE + tendencia(nes) * 0.5) * f;
  },
  'ewma_carga_tendencia': (nes, cargas, sa, p) => {
    const basNE = ewma(nes, p.span || 4), basC = mediana(cargas);
    const f = basC > 0 ? clamp(sa.carga.total / basC, FATOR_CLAMP.min, FATOR_CLAMP.max) : 1;
    return (basNE + tendencia(nes) * 0.3) * f;
  },
  'multi_fator': (nes, cargas, sa) => {
    const basNE = mediana(nes), basC = mediana(cargas);
    const fC = basC > 0 ? clamp(sa.carga.total / basC, 0.7, 1.8) : 1;
    const fL = 1 + (sa.porTipo.SAL + sa.porTipo.SAIL) / Math.max(sa.totalLiberacoes, 1) * 0.15;
    return basNE * fC * fL * (1 + (sa.pctAltaComplexidade / 100) * 0.1);
  }
};

function executarCalibracao() {
  coleta.restaurarCache();
  const dados = carregar();
  const nomes = coleta.listarVersoesEsperadas();

  const configs = [
    { nome: 'Mediana pura (J=6)', estrategia: 'mediana_pura', params: { janela: 6 } },
    { nome: 'Mediana pura (J=4)', estrategia: 'mediana_pura', params: { janela: 4 } },
    { nome: 'Mediana pura (J=8)', estrategia: 'mediana_pura', params: { janela: 8 } },
    { nome: 'Mediana+Carga (J=6) [ATUAL]', estrategia: 'mediana_carga', params: { janela: 6 } },
    { nome: 'Mediana+Carga (J=4)', estrategia: 'mediana_carga', params: { janela: 4 } },
    { nome: 'Mediana+Carga (J=8)', estrategia: 'mediana_carga', params: { janela: 8 } },
    { nome: 'EWMA span=3', estrategia: 'ewma_pura', params: { janela: 8, span: 3 } },
    { nome: 'EWMA span=4', estrategia: 'ewma_pura', params: { janela: 8, span: 4 } },
    { nome: 'EWMA span=6', estrategia: 'ewma_pura', params: { janela: 8, span: 6 } },
    { nome: 'EWMA+Carga span=3', estrategia: 'ewma_carga', params: { janela: 8, span: 3 } },
    { nome: 'EWMA+Carga span=4', estrategia: 'ewma_carga', params: { janela: 8, span: 4 } },
    { nome: 'Mediana+Tendencia', estrategia: 'mediana_tendencia', params: { janela: 6 } },
    { nome: 'EWMA+Tendencia span=4', estrategia: 'ewma_tendencia', params: { janela: 8, span: 4 } },
    { nome: 'Mediana+Carga+Tend (J=6)', estrategia: 'mediana_carga_tendencia', params: { janela: 6 } },
    { nome: 'EWMA+Carga+Tend span=4', estrategia: 'ewma_carga_tendencia', params: { janela: 8, span: 4 } },
    { nome: 'Multi-fator (carga+legal+complex)', estrategia: 'multi_fator', params: { janela: 6 } },
  ];

  const resultados = [];
  for (const cfg of configs) {
    const fn = estrategias[cfg.estrategia];
    const bt = rodarBacktest(nomes, dados, fn, cfg.params);
    if (bt) resultados.push({ ...cfg, mape: bt.mape, acerto: bt.acertoDirecao, testes: bt.testes, bt });
  }

  resultados.sort((a, b) => a.mape - b.mape);
  return resultados;
}

module.exports = { executarCalibracao, estrategias, rodarBacktest };
