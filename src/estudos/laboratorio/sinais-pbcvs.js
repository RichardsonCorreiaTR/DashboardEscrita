/**
 * sinais-pbcvs.js - Sinais extras do PBCVS (cronograma + metas)
 *
 * Carrega dados de duracao dev/teste e metas de NE por versao.
 * Usado como features adicionais no backtest.
 */

const fs = require('fs');
const path = require('path');
const { round2 } = require('../estatisticas-ne');

const CACHE = path.join(__dirname, '..', '..', '..', 'data', 'cache', 'sinais-pbcvs-extra.json');

function calcularPorVersao() {
  const resultado = {};
  try {
    if (!fs.existsSync(CACHE)) return resultado;
    const raw = JSON.parse(fs.readFileSync(CACHE, 'utf-8'));

    const cronoMap = {};
    for (const c of (raw.cronograma || [])) {
      if (!c.nomeVersao || !c.nomeVersao.match(/^10\.[2-6]A-\d{2}$/)) continue;
      if (!cronoMap[c.nomeVersao]) cronoMap[c.nomeVersao] = [];
      cronoMap[c.nomeVersao].push(c);
    }
    for (const [v, arr] of Object.entries(cronoMap)) {
      const dD = arr.map(x => x.diasDesenv).filter(Boolean);
      const dT = arr.map(x => x.diasTeste).filter(Boolean);
      if (!resultado[v]) resultado[v] = {};
      resultado[v].diasDesenv = dD.length > 0 ? round2(mediana(dD)) : 0;
      resultado[v].diasTeste = dT.length > 0 ? round2(mediana(dT)) : 0;
    }

    for (const m of (raw.metas || [])) {
      if (!m.nomeVersao) continue;
      if (!resultado[m.nomeVersao]) resultado[m.nomeVersao] = {};
      resultado[m.nomeVersao].metaNE = m.meta_entrada_ne || 0;
    }

    console.log('[sinais-pbcvs] %d versoes com dados PBCVS', Object.keys(resultado).length);
  } catch (err) {
    console.warn('[sinais-pbcvs] Nao carregou:', err.message);
  }
  return resultado;
}

function mediana(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

module.exports = { calcularPorVersao };
