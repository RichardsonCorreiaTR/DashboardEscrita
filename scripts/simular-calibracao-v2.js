/**
 * Simulacao V2 - testa refinamentos apos insights iniciais.
 *
 * Insights chave da simulacao V1:
 *   - Fator carga PIORA as previsoes (ruido > sinal)
 *   - Janela 4 bate janela 6
 *   - EWMA se beneficia de recencia
 *   - Ultimos 6 meses MAPE=13% (dados estaveis)
 *
 * Testes V2:
 *   - Fator carga amortecido (peso 0.2-0.5)
 *   - Mediana adaptativa (pesos exponenciais)
 *   - Combinacao mediana + EWMA (ensemble)
 *   - Peso extra nos ultimos 6 meses
 */

const path = require('path');
const fs = require('fs');
const { round2 } = require('../src/estudos/estatisticas-ne');
const coleta = require('../src/estudos/liberacoes-sa-v2/coleta');
const { agregarVersao } = require('../src/estudos/liberacoes-sa-v2/carga');

const CACHE_NE = path.join(__dirname, '..', 'data', 'cache', 'estudos-historico.json');
const CACHE_DESC = path.join(__dirname, '..', 'data', 'cache', 'estudos-descartes-ne.json');
const CACHE_SA = path.join(__dirname, '..', 'data', 'cache', 'estudos-liberacoes-sa-v2.json');

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
  return d ? b - (d.reprovadas || 0) - (d.prescritas || 0) : b;
}

function mediana(arr) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function ewma(arr, span) {
  const alpha = 2 / (span + 1);
  let r = arr[0];
  for (let i = 1; i < arr.length; i++) r = alpha * arr[i] + (1 - alpha) * r;
  return r;
}

function clamp(v, min, max) { return Math.max(min, Math.min(v, max)); }

function rodarBt(nomes, dados, fn, p) {
  const { ne, desc, saProc } = dados;
  const jan = p.janela || 6;
  const resultados = [];
  for (let i = jan; i < nomes.length - 1; i++) {
    const sa = saProc[nomes[i]];
    const real = neLiq(ne, desc, nomes[i + 1]);
    if (!sa || sa.totalLiberacoes === 0 || real === null) continue;
    const nes = [], cargas = [];
    for (let j = Math.max(0, i - jan); j < i; j++) {
      const n = neLiq(ne, desc, nomes[j + 1]);
      const s = saProc[nomes[j]];
      if (n !== null && s) { nes.push(n); cargas.push(s.carga.total); }
    }
    if (nes.length < 3) continue;
    const prev = Math.round(fn(nes, cargas, sa, p));
    const ea = Math.abs(prev - real);
    const ep = real > 0 ? round2((ea / real) * 100) : 0;
    resultados.push({ v: nomes[i + 1], prev, real, ep });
  }
  if (!resultados.length) return null;
  const mape = round2(resultados.reduce((s, r) => s + r.ep, 0) / resultados.length);
  const rec6 = resultados.slice(-6);
  const mapeRec = rec6.length > 0
    ? round2(rec6.reduce((s, r) => s + r.ep, 0) / rec6.length)
    : null;
  return { mape, mapeRec, n: resultados.length, resultados };
}

const E = {
  'MED_J4': (nes) => mediana(nes),
  'EWMA_S4': (nes, _, __, p) => ewma(nes, 4),
  'EWMA_S6': (nes, _, __, p) => ewma(nes, 6),

  'MED_J4_CARGA_DAMP': (nes, cargas, sa, p) => {
    const base = mediana(nes);
    const mc = mediana(cargas);
    const rawF = mc > 0 ? sa.carga.total / mc : 1;
    const f = 1 + (rawF - 1) * (p.damping || 0.3);
    return base * clamp(f, 0.8, 1.3);
  },

  'ENSEMBLE_MED_EWMA': (nes) => {
    return mediana(nes) * 0.5 + ewma(nes, 4) * 0.5;
  },

  'ENSEMBLE_MED_EWMA_60_40': (nes) => {
    return mediana(nes) * 0.6 + ewma(nes, 4) * 0.4;
  },

  'MED_PONDERADA_EXP': (nes) => {
    const n = nes.length;
    const alpha = 0.5;
    let sum = 0, wsum = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.pow(alpha, n - 1 - i);
      sum += nes[i] * w;
      wsum += w;
    }
    return sum / wsum;
  },

  'MED_J4_TAXA_DESC': (nes, cargas, sa, p) => {
    // usa taxa de descarte historica como ajuste
    const base = mediana(nes);
    const taxas = p._taxasDesc || [];
    if (taxas.length < 3) return base;
    const taxaMed = mediana(taxas);
    // se a taxa de descarte esta subindo, prevemos menos NE liquida
    const taxaRecente = ewma(taxas, 3);
    const ajuste = taxaMed > 0 ? taxaRecente / taxaMed : 1;
    return base * clamp(2 - ajuste, 0.85, 1.15);
  },

  'EWMA_S4_PISO_TETO': (nes) => {
    const base = ewma(nes, 4);
    const min = Math.min(...nes.slice(-3));
    const max = Math.max(...nes.slice(-3));
    return clamp(base, min * 0.9, max * 1.1);
  },

  'MEDIANA_WINSORIZADA': (nes) => {
    const sorted = [...nes].sort((a, b) => a - b);
    if (sorted.length >= 4) {
      sorted[0] = sorted[1]; // winsorize extremes
      sorted[sorted.length - 1] = sorted[sorted.length - 2];
    }
    return mediana(sorted);
  },
};

coleta.restaurarCache();
const dados = carregar();
const nomes = coleta.listarVersoesEsperadas();

// pre-calcular taxas de descarte por versao
const taxasDesc = {};
for (const n of nomes) {
  const ne = dados.ne[n];
  const d = dados.desc[n];
  if (ne && ne.totais && d) {
    const b = ne.totais.entradasBrutas;
    taxasDesc[n] = b > 0 ? ((d.reprovadas || 0) + (d.prescritas || 0)) / b : 0;
  }
}

const cfgs = [
  { tag: 'Mediana pura J=4 [BASE]', fn: 'MED_J4', p: { janela: 4 } },
  { tag: 'EWMA span=4', fn: 'EWMA_S4', p: { janela: 8 } },
  { tag: 'EWMA span=6', fn: 'EWMA_S6', p: { janela: 8 } },
  { tag: 'Med J4 + Carga amort 0.2', fn: 'MED_J4_CARGA_DAMP', p: { janela: 4, damping: 0.2 } },
  { tag: 'Med J4 + Carga amort 0.3', fn: 'MED_J4_CARGA_DAMP', p: { janela: 4, damping: 0.3 } },
  { tag: 'Med J4 + Carga amort 0.5', fn: 'MED_J4_CARGA_DAMP', p: { janela: 4, damping: 0.5 } },
  { tag: 'Ensemble MED+EWMA 50/50', fn: 'ENSEMBLE_MED_EWMA', p: { janela: 6 } },
  { tag: 'Ensemble MED+EWMA 60/40', fn: 'ENSEMBLE_MED_EWMA_60_40', p: { janela: 6 } },
  { tag: 'Media ponderada exponencial', fn: 'MED_PONDERADA_EXP', p: { janela: 6 } },
  { tag: 'EWMA S4 + piso/teto 3v', fn: 'EWMA_S4_PISO_TETO', p: { janela: 6 } },
  { tag: 'Mediana winsorizada J=4', fn: 'MEDIANA_WINSORIZADA', p: { janela: 4 } },
];

// enriquecer com taxas descarte para estrategias que usam
for (const c of cfgs) {
  if (c.fn === 'MED_J4_TAXA_DESC') {
    const txArr = nomes.map(n => taxasDesc[n]).filter(t => t !== undefined);
    c.p._taxasDesc = txArr;
  }
}

const resultados = [];
for (const c of cfgs) {
  const bt = rodarBt(nomes, dados, E[c.fn], c.p);
  if (bt) resultados.push({ ...c, ...bt });
}

resultados.sort((a, b) => a.mape - b.mape);

console.log('');
console.log('SIMULACAO V2: ESTRATEGIAS REFINADAS');
console.log('='.repeat(75));
console.log('');
console.log('Rank  MAPE     MAPE6m   Testes  Estrategia');
console.log('='.repeat(75));

for (let i = 0; i < resultados.length; i++) {
  const r = resultados[i];
  const rank = String(i + 1).padStart(4);
  const mape = (r.mape + '%').padStart(7);
  const m6 = r.mapeRec !== null ? (r.mapeRec + '%').padStart(7) : '   N/A';
  const n = String(r.n).padStart(6);
  console.log(rank + '  ' + mape + '  ' + m6 + '  ' + n + '  ' + r.tag);
}

// Detalhes dos top 3 nos ultimos 10
console.log('');
console.log('TOP 3: DETALHES ULTIMOS 10');
console.log('='.repeat(75));
for (let i = 0; i < 3; i++) {
  const r = resultados[i];
  console.log('');
  console.log('#' + (i + 1) + ' ' + r.tag + ' (MAPE=' + r.mape + '%, MAPE6m=' + r.mapeRec + '%)');
  console.log('Versao         Prev  Real  Erro%');
  for (const b of r.resultados.slice(-10)) {
    console.log(b.v.padEnd(15) + String(b.prev).padStart(5) + String(b.real).padStart(6) + '  ' + b.ep + '%');
  }
}

// Insights sobre taxa de descarte
console.log('');
console.log('ANALISE DA VOLATILIDADE DOS DESCARTES');
console.log('='.repeat(75));
const txValues = nomes.filter(n => taxasDesc[n] !== undefined).map(n => ({
  v: n, tx: round2(taxasDesc[n] * 100)
}));
console.log('Versao         Taxa desc.(%)');
for (const t of txValues.slice(-15)) {
  const bar = '#'.repeat(Math.round(t.tx));
  console.log(t.v.padEnd(15) + String(t.tx + '%').padStart(6) + ' ' + bar);
}
const recent6 = txValues.slice(-6);
const allTx = txValues.map(t => t.tx);
console.log('');
console.log('Media geral taxa descarte: ' + round2(allTx.reduce((a, b) => a + b, 0) / allTx.length) + '%');
console.log('Media 6 meses recentes:    ' + round2(recent6.reduce((a, b) => a + b.tx, 0) / recent6.length) + '%');
console.log('Desvio padrao geral:       ' + round2(Math.sqrt(allTx.reduce((s, x) => s + Math.pow(x - allTx.reduce((a, b) => a + b, 0) / allTx.length, 2), 0) / allTx.length)) + '%');
