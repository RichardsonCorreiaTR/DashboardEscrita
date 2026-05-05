/**
 * Simulacao: Predicao dual (NE bruta + taxa de descarte separadas)
 *
 * Insight: NE bruta tem MAPE 16%, NE liquida tem MAPE 39%.
 * Se prevemos bruta e descartes separadamente, combinamos o
 * melhor dos dois mundos.
 */
const fs = require('fs');
const ne = JSON.parse(fs.readFileSync('data/cache/estudos-historico.json', 'utf-8')).versoes;
const desc = JSON.parse(fs.readFileSync('data/cache/estudos-descartes-ne.json', 'utf-8')).versoes;

function mediana(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function ewma(arr, span) {
  const a = 2 / (span + 1);
  let r = arr[0];
  for (let i = 1; i < arr.length; i++) r = a * arr[i] + (1 - a) * r;
  return r;
}
function r1(v) { return Math.round(v * 10) / 10; }

const nomes = Object.keys(ne).sort();
const dados = [];
for (const n of nomes) {
  const v = ne[n]; if (!v || !v.totais) continue;
  const b = v.totais.entradasBrutas;
  const d = desc[n];
  const rep = d ? (d.reprovadas || 0) : 0;
  const pre = d ? (d.prescritas || 0) : 0;
  const liq = b - rep - pre;
  const taxa = b > 0 ? (rep + pre) / b : 0;
  dados.push({ n, b, liq, taxa });
}

function backtest(nome, prevFn) {
  const res = [];
  for (let i = 4; i < dados.length; i++) {
    const hist = dados.slice(Math.max(0, i - 8), i);
    if (hist.length < 3) continue;
    const prev = Math.round(prevFn(hist, i));
    const real = dados[i].liq;
    if (real <= 0) continue;
    const ep = r1(Math.abs(prev - real) / real * 100);
    res.push({ v: dados[i].n, prev, real, ep, tx: r1(dados[i].taxa * 100) });
  }
  const mape = r1(res.reduce((s, r) => s + r.ep, 0) / res.length);
  const rec6 = res.slice(-6);
  const m6 = r1(rec6.reduce((s, r) => s + r.ep, 0) / rec6.length);
  return { nome, mape, m6, n: res.length, res };
}

const estrategias = {
  'V3 atual: mediana liquida J=4': (h) => {
    const liqs = h.slice(-4).map(d => d.liq);
    return mediana(liqs);
  },
  'DUAL-A: med bruta J=4 * (1 - med taxa J=4)': (h) => {
    const brutas = h.slice(-4).map(d => d.b);
    const taxas = h.slice(-4).map(d => d.taxa);
    return mediana(brutas) * (1 - mediana(taxas));
  },
  'DUAL-B: med bruta J=4 * (1 - ewma taxa S=3)': (h) => {
    const brutas = h.slice(-4).map(d => d.b);
    const taxas = h.map(d => d.taxa);
    return mediana(brutas) * (1 - ewma(taxas, 3));
  },
  'DUAL-C: med bruta J=4 * (1 - ewma taxa S=4)': (h) => {
    const brutas = h.slice(-4).map(d => d.b);
    const taxas = h.map(d => d.taxa);
    return mediana(brutas) * (1 - ewma(taxas, 4));
  },
  'DUAL-D: ewma bruta S=4 * (1 - ewma taxa S=4)': (h) => {
    return ewma(h.map(d => d.b), 4) * (1 - ewma(h.map(d => d.taxa), 4));
  },
  'DUAL-E: med bruta J=6 * (1 - ewma taxa S=4)': (h) => {
    const brutas = h.slice(-6).map(d => d.b);
    const taxas = h.map(d => d.taxa);
    return mediana(brutas) * (1 - ewma(taxas, 4));
  },
  'DUAL-F: med bruta J=4 * (1 - media taxa J=4)': (h) => {
    const brutas = h.slice(-4).map(d => d.b);
    const taxas = h.slice(-4).map(d => d.taxa);
    const avgTx = taxas.reduce((a, b) => a + b, 0) / taxas.length;
    return mediana(brutas) * (1 - avgTx);
  },
};

const resultados = [];
for (const [nome, fn] of Object.entries(estrategias)) {
  resultados.push(backtest(nome, fn));
}
resultados.sort((a, b) => a.mape - b.mape);

console.log('');
console.log('SIMULACAO: PREDICAO DUAL (Bruta + Taxa Descarte)');
console.log('='.repeat(75));
console.log('');
console.log('Rank  MAPE     MAPE6m   N   Estrategia');
console.log('='.repeat(75));
for (let i = 0; i < resultados.length; i++) {
  const r = resultados[i];
  const rank = String(i + 1).padStart(4);
  const mape = (r.mape + '%').padStart(7);
  const m6 = (r.m6 + '%').padStart(7);
  const flag = r.nome.includes('V3 atual') ? '  <<<' : '';
  console.log(rank + '  ' + mape + '  ' + m6 + '  ' + String(r.n).padStart(2) + '  ' + r.nome + flag);
}

console.log('');
console.log('COMPARATIVO TOP 3 vs V3 ATUAL (ultimas 12 versoes)');
console.log('='.repeat(75));
const top = resultados.slice(0, 3);
const atual = resultados.find(r => r.nome.includes('V3 atual'));
const todos = [...top];
if (!top.find(r => r.nome.includes('V3 atual'))) todos.push(atual);

for (const r of todos) {
  console.log('');
  console.log(r.nome + ' (MAPE=' + r.mape + '%, 6m=' + r.m6 + '%)');
  console.log('Versao         Prev  Real  Erro%  TxDesc%');
  for (const b of r.res.slice(-12)) {
    console.log(b.v.padEnd(15) + String(b.prev).padStart(5) + String(b.real).padStart(6)
      + (b.ep + '%').padStart(7) + (b.tx + '%').padStart(8));
  }
}

console.log('');
console.log('GANHO DA MELHOR DUAL vs V3 ATUAL:');
console.log('MAPE geral: ' + atual.mape + '% -> ' + resultados[0].mape
  + '% (reducao de ' + r1(atual.mape - resultados[0].mape) + ' pp)');
console.log('MAPE 6m:    ' + atual.m6 + '% -> ' + resultados[0].m6
  + '% (reducao de ' + r1(atual.m6 - resultados[0].m6) + ' pp)');
