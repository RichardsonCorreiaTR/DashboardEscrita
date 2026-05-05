/**
 * liberacoes-sa-v2/correlacao.js - Correlacao Spearman + significancia
 *
 * Usa rank correlation (nao assume normalidade dos dados).
 * Calcula p-valor via aproximacao t-student -> normal.
 * Minimo 5 pares para calcular; so declara significancia se p < 0.05.
 */

const { round2 } = require('../estatisticas-ne');
const coleta = require('./coleta');
const { obterTotalEfetivo, obterCargaEfetiva } = require('./projecao-utils');

function ranks(arr) {
  const indexed = arr.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const r = new Array(arr.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
    const avgRank = (i + j + 1) / 2;
    for (let k = i; k < j; k++) r[indexed[k].i] = avgRank;
    i = j;
  }
  return r;
}

function normalCDF(z) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + p * x);
  const erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return round2(0.5 * (1 + sign * erf) * 10000) / 10000;
}

function spearman(x, y) {
  if (x.length < 5 || x.length !== y.length) return { rho: null, p: null };
  const rx = ranks(x), ry = ranks(y);
  const n = x.length;
  let sumD2 = 0;
  for (let i = 0; i < n; i++) sumD2 += (rx[i] - ry[i]) ** 2;
  const rho = round2(1 - (6 * sumD2) / (n * (n * n - 1)));
  if (Math.abs(rho) >= 1) return { rho, p: 0 };
  const t = rho * Math.sqrt((n - 2) / (1 - rho * rho));
  const p = round2(2 * (1 - normalCDF(Math.abs(t))));
  return { rho, p: Math.max(p, 0.001) };
}

function interpretarCorrelacao(rho, p) {
  if (rho === null) return 'Dados insuficientes (minimo 5 pares)';
  const sig = p !== null && p < 0.05 ? '' : ' (NAO significativa, p=' + p + ')';
  const abs = Math.abs(rho);
  if (abs < 0.2) return 'Correlacao fraca ou inexistente' + sig;
  if (abs < 0.4) return 'Correlacao moderada' + sig;
  if (abs < 0.6) return 'Correlacao significativa' + sig;
  return 'Correlacao forte' + sig;
}

function calcularCorrelacao(versoesProc, cacheNE, cacheDesc) {
  const nomes = coleta.listarVersoesEsperadas();
  const pontos = [];

  for (let i = 0; i < nomes.length - 1; i++) {
    const vSA = versoesProc.find(v => v.versao === nomes[i]);
    const vNE = cacheNE[nomes[i + 1]];
    const totalEf = vSA ? obterTotalEfetivo(vSA) : 0;
    if (vSA && totalEf > 0 && vNE && vNE.totais) {
      const brutas = vNE.totais.entradasBrutas;
      let liquidas = brutas;
      if (cacheDesc && cacheDesc[nomes[i + 1]]) {
        const d = cacheDesc[nomes[i + 1]];
        liquidas = brutas - (d.conclSemDev || 0) - (d.reprovadas || 0) - (d.prescritas || 0);
      }
      pontos.push({
        versao: nomes[i], versaoSeguinte: nomes[i + 1],
        totalSA: totalEf,
        cargaPonderada: obterCargaEfetiva(vSA),
        nesVersaoSeguinte: liquidas,
        nesBrutas: brutas
      });
    }
  }

  if (pontos.length < 5) {
    return {
      suficiente: false, totalPontos: pontos.length,
      interpretacao: 'Dados insuficientes (minimo 5 pares SA-NE)',
      pontos, spearmanSimples: { rho: null, p: null },
      spearmanCarga: { rho: null, p: null }
    };
  }

  const y = pontos.map(p => p.nesVersaoSeguinte);
  const corrSimples = spearman(pontos.map(p => p.totalSA), y);
  const corrCarga = spearman(pontos.map(p => p.cargaPonderada), y);

  const melhor = Math.abs(corrCarga.rho || 0) >= Math.abs(corrSimples.rho || 0)
    ? { tipo: 'carga', ...corrCarga, label: 'Carga Ponderada' }
    : { tipo: 'simples', ...corrSimples, label: 'Qtde SAs' };

  return {
    suficiente: true, totalPontos: pontos.length,
    spearmanSimples: corrSimples, spearmanCarga: corrCarga,
    melhorPreditor: melhor.tipo, melhorPreditorLabel: melhor.label,
    melhorRho: melhor.rho, melhorP: melhor.p,
    significativa: melhor.p !== null && melhor.p < 0.05,
    interpretacao: interpretarCorrelacao(melhor.rho, melhor.p),
    pontos
  };
}

module.exports = { spearman, calcularCorrelacao, interpretarCorrelacao };
