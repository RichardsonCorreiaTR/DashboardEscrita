#!/usr/bin/env node
/**
 * exportar-pacote-analista.js - Gera pacote isolado para um analista
 * Uso: node scripts/exportar-pacote-analista.js <slug>
 */
const path = require('path');
const { exportarPacote } = require('./lib/exportar-pacote-lib');

const ROOT = path.join(__dirname, '..');
const slug = process.argv[2];
if (!slug) {
  console.error('Uso: node scripts/exportar-pacote-analista.js <slug>');
  process.exit(1);
}

const r = exportarPacote(ROOT, slug);
if (!r.ok) { console.error(r.erro, slug); process.exit(1); }
console.log('Pacote:', r.dest);
console.log('Analista:', r.apelido, '| login:', r.usuario);
