/**
 * previsao-lab.js - Previsao da proxima versao e exemplo do calculo
 *
 * Usa a melhor estrategia do backtest para projetar NEs.
 * Gera passo-a-passo para V3, V5 e V6 (EWMA, regressao, V2).
 */

const { round2 } = require('../estatisticas-ne');
const versaoLib = require('../../core/versao');
const regressao = require('./regressao');
let _bt = null;
function bt() { if (!_bt) _bt = require('./backtest-lab'); return _bt; }

function gerar(melhorInfo) {
  if (!melhorInfo || !melhorInfo.estrategia) return { previsao: null, exemplo: null };
  const sinais = bt().carregarSinaisCombinados();
  const { ne, desc } = bt().carregarCaches();
  const nomes = Object.keys(sinais).sort().filter(v => {
    const n = bt().neLiq(ne, desc, v);
    return n !== null;
  });
  if (nomes.length < 4) return { previsao: null, exemplo: null };
  return {
    previsao: gerarPrevisao(nomes, ne, desc, sinais, melhorInfo),
    exemplo: gerarExemplo(nomes, ne, desc, sinais, melhorInfo)
  };
}

function gerarPrevisao(nomes, ne, desc, sinais, melhor) {
  const j = melhor.janela || 4;
  const h = [];
  for (let i = Math.max(0, nomes.length - j); i < nomes.length; i++) {
    const n = bt().neLiq(ne, desc, nomes[i]);
    if (n !== null) h.push(n);
  }
  if (h.length < 3) return null;
  const fn = bt().ESTRATEGIAS[melhor.estrategia];
  if (!fn) return null;
  const ult = nomes[nomes.length - 1];
  const p = Math.round(fn(h, sinais[ult] || null, sinais, nomes, nomes.length - 1));
  const mg = Math.max(0.15, (melhor.mape6m || melhor.mape) / 100);
  const pv = versaoLib.parsearNomeVersao(ult);
  const nv = pv
    ? versaoLib.nomeDaVersao(pv.mes === 12 ? pv.ano + 1 : pv.ano, pv.mes === 12 ? 1 : pv.mes + 1)
    : 'Proxima';
  return {
    pontual: p,
    intervalo: { baixo: Math.max(0, Math.round(p * (1 - mg))), alto: Math.round(p * (1 + mg)) },
    versaoAlvo: nv, versaoBase: ult, estrategia: melhor.nome,
    risco: melhor.mape <= 20 ? 'baixo' : melhor.mape <= 35 ? 'moderado' : 'alto',
    confianca: round2(100 - (melhor.mape6m || melhor.mape))
  };
}

function gerarExemplo(nomes, ne, desc, sinais, melhor) {
  const j = melhor.janela || 4;
  const refs = [];
  for (let i = Math.max(0, nomes.length - j); i < nomes.length; i++) {
    const n = bt().neLiq(ne, desc, nomes[i]);
    if (n !== null) refs.push({ v: nomes[i], ne: n });
  }
  if (refs.length < 3) return null;
  const nesArr = refs.map(r => r.ne);
  const med = bt().mediana(nesArr);
  const est = melhor.estrategia;
  const passos = [
    { titulo: 'Versoes de referencia (J=' + j + ')',
      detalhe: refs.map(r => r.v + ': ' + r.ne + ' NEs liquidas'),
      resultado: refs.length + ' versoes na janela' }
  ];

  if (est.includes('ewma') || est.includes('v6_ewma')) {
    passosEwma(passos, nesArr);
  } else {
    passos.push({ titulo: 'Mediana das NEs',
      detalhe: 'Ordenar: [' + [...nesArr].sort((a, b) => a - b).join(', ') + ']',
      resultado: 'Mediana = ' + med });
  }

  if (est.includes('ensemble')) {
    passosEnsemble(passos, est);
  } else if (est.includes('ridge') || est.includes('reg')) {
    passosRegressao(passos, sinais, nomes, est);
  } else if (est.startsWith('v6_carga') || est.includes('carga')) {
    passosSinal(passos, sinais, nomes, 'carga', 'Carga V2');
    if (est.includes('ia')) passosSinal(passos, sinais, nomes, 'idx_complexidade', 'Complexidade IA');
  } else if (est.startsWith('v5_') || (est.startsWith('v6_') && est.includes('ia'))) {
    const campo = est.includes('complex') ? 'idx_complexidade'
      : est.includes('risco') ? 'idx_risco' : 'score_ia';
    passosSinal(passos, sinais, nomes, campo, campo.replace(/idx_/, ''));
  }

  const fn = bt().ESTRATEGIAS[est];
  const ult = nomes[nomes.length - 1];
  const pred = fn ? Math.round(fn(nesArr, sinais[ult] || null, sinais, nomes, nomes.length - 1)) : Math.round(med);
  passos.push({ titulo: 'Previsao final', detalhe: 'Resultado do modelo',
    resultado: pred + ' NEs previstas' });

  return { estrategia: melhor.nome, versaoBase: nomes[nomes.length - 1], janela: j, passos };
}

function passosEwma(passos, nesArr) {
  const alpha = 0.3;
  let s = nesArr[0];
  const etapas = [nesArr[0].toString()];
  for (let i = 1; i < nesArr.length; i++) {
    s = alpha * nesArr[i] + (1 - alpha) * s;
    etapas.push(round2(s).toString());
  }
  passos.push({ titulo: 'Suavizacao exponencial (alpha=0.3)',
    detalhe: ['Pesos decrescentes: recente pesa mais',
      'Sequencia: [' + etapas.join(' -> ') + ']'],
    resultado: 'Base EWMA = ' + round2(s) });
}

function passosSinal(passos, sinais, nomes, campo, label) {
  const sinal = sinais[nomes[nomes.length - 1]] || {};
  const val = sinal[campo] || 0;
  const hv = [];
  for (let i = 0; i < nomes.length - 1; i++) {
    const s = sinais[nomes[i]];
    if (s && s[campo]) hv.push(s[campo]);
  }
  const mh = hv.length > 0 ? bt().mediana(hv) : 1;
  const fat = mh > 0 ? round2(val / mh) : 1;
  passos.push({ titulo: 'Sinal: ' + label,
    detalhe: ['Versao atual: ' + round2(val) + ' | Media hist: ' + round2(mh),
      'Fator = ' + round2(val) + ' / ' + round2(mh) + ' = ' + fat],
    resultado: 'Ajuste: ' + (fat > 1 ? '+' : '') + round2((fat - 1) * 100) + '%' });
}

function passosEnsemble(passos, est) {
  const top = est.includes('top5')
    ? ['Reg Completa', 'Reg IA', 'EWMA+IA', 'Ridge Completa', 'Trend']
    : ['Reg Completa', 'Reg IA', 'EWMA+IA'];
  passos.push({ titulo: 'Ensemble: media de ' + top.length + ' estrategias',
    detalhe: ['Combina: ' + top.join(', '),
      'Cada estrategia faz sua previsao independente',
      'O resultado final e a media aritmetica'],
    resultado: 'Reduz variancia e melhora estabilidade' });
}

function passosRegressao(passos, sinais, nomes, est) {
  const isRidge = est.includes('ridge');
  const campos = est.includes('completa') || (isRidge && !est.includes('_ia'))
    ? ['idx_complexidade', 'idx_risco', 'carga', 'totalSAs', 'pctLegal', 'diasDesenv', 'tendencia']
    : est.includes('crono') ? ['idx_complexidade', 'carga', 'diasDesenv']
      : est.includes('v2') ? ['carga', 'totalSAs', 'pctLegal']
        : ['idx_complexidade', 'idx_risco'];
  let treino = 0;
  for (let j = 1; j < nomes.length - 1; j++) {
    const s = sinais[nomes[j]];
    if (s && s.neLiq !== undefined && s.neLiq !== null) treino++;
  }
  const sinal = sinais[nomes[nomes.length - 1]] || {};
  const tipo = isRidge ? 'Ridge (regularizada, lambda=1)' : 'OLS';
  passos.push({ titulo: 'Regressao linear ' + tipo,
    detalhe: ['Treinado com ' + treino + ' versoes historicas',
      'Variaveis: ' + campos.join(', '),
      'Valores atuais: [' + campos.map(c => round2(sinal[c] || 0)).join(', ') + ']',
      isRidge ? 'Regularizacao previne overfitting com poucos dados' : ''].filter(Boolean),
    resultado: 'Modelo aprende pesos automaticamente' });
}

module.exports = { gerar };
