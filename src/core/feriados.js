/**
 * feriados.js - Feriados nacionais para calculo de dias uteis
 * Fonte: config/feriados.json
 */

const path = require('path');
const fs = require('fs');
const { parsearData } = require('./date-utils');

const FERIADOS_PATH = path.join(__dirname, '..', '..', 'config', 'feriados.json');
let _map = null;

function carregarMap() {
  if (_map) return _map;
  try { _map = JSON.parse(fs.readFileSync(FERIADOS_PATH, 'utf-8')); }
  catch { _map = {}; }
  return _map;
}

function feriadosNoIntervalo(inicio, fim) {
  const di = parsearData(inicio);
  const df = parsearData(fim);
  if (!di || !df || df < di) return 0;
  const map = carregarMap();
  const anos = new Set([di.getFullYear(), df.getFullYear()]);
  const a = new Date(di.getFullYear(), di.getMonth(), di.getDate());
  const b = new Date(df.getFullYear(), df.getMonth(), df.getDate());
  let n = 0;
  anos.forEach(ano => {
    (map[String(ano)] || []).forEach(iso => {
      const fd = parsearData(iso);
      if (!fd) return;
      const d = new Date(fd.getFullYear(), fd.getMonth(), fd.getDate());
      if (d <= a || d > b) return;
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) n++;
    });
  });
  return n;
}

module.exports = { feriadosNoIntervalo };
