/**
 * metadata-sais.js - Metadados das SAIs Escrita a partir dos lotes locais
 *
 * Le lote-entrada-*.json e classificados-auto-*.json em data/ia/
 * (gerados via ODBC). Sem dependencia de BuscaSaiFolha.
 */
const fs = require('fs');
const path = require('path');

const IA_DIR = path.join(__dirname, '..', '..', '..', 'data', 'ia');

let _meta = null;

function indexarArquivo(file, meta) {
  let data;
  try { data = JSON.parse(fs.readFileSync(path.join(IA_DIR, file), 'utf-8')); }
  catch { return; }
  for (const it of (data.itens || [])) {
    if (!it.i_psai) continue;
    const prev = meta[it.i_psai] || {};
    meta[it.i_psai] = {
      i_sai: it.i_sai || prev.i_sai || 0,
      tipo: it.tipo || prev.tipo || null,
      descricao: (it.descricao || prev.descricao || '').trim(),
      status: it.status || prev.status || '',
      gravidade: it.gravidade || prev.gravidade || 'Normal'
    };
  }
}

function carregar() {
  if (_meta) return _meta;
  _meta = {};
  try {
    if (!fs.existsSync(IA_DIR)) return _meta;
    const files = fs.readdirSync(IA_DIR);
    for (const f of files.filter(n => /^lote-entrada-.+\.json$/.test(n))) {
      indexarArquivo(f, _meta);
    }
    for (const f of files.filter(n => /^classificados-auto-.+\.json$/.test(n))) {
      indexarArquivo(f, _meta);
    }
    if (Object.keys(_meta).length) {
      console.log('[meta-sais] %d SAIs Escrita indexadas (data/ia)', Object.keys(_meta).length);
    }
  } catch (err) {
    console.warn('[meta-sais] Nao carregou metadata:', err.message);
  }
  return _meta;
}

function invalidar() { _meta = null; }

module.exports = { carregar, invalidar };
