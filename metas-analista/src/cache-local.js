/**
 * cache-local.js - Leitura/gravacao do cache local (pacote individual)
 */
const fs = require('fs');
const path = require('path');

function cachePath(root) {
  return path.join(root, 'data', 'cache', 'metas-equipe.json');
}

function lerRaw(root) {
  const p = cachePath(root);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function salvar(root, slug, dados) {
  const raw = lerRaw(root) || { _meta: { atualizado_em: null } };
  const antigo = raw[slug];
  raw[slug] = antigo && antigo._detalhes ? { ...dados, _detalhes: antigo._detalhes } : dados;
  raw._meta = { atualizado_em: new Date().toISOString() };
  fs.mkdirSync(path.dirname(cachePath(root)), { recursive: true });
  fs.writeFileSync(cachePath(root), JSON.stringify(raw, null, 2));
  return raw._meta.atualizado_em;
}

function obterDetalhe(root, slug, metaId, mes) {
  const raw = lerRaw(root);
  const dados = raw && raw[slug];
  if (!dados || !dados._detalhes) return null;
  return dados._detalhes[metaId + ':' + mes] || null;
}

function salvarDetalhe(root, slug, metaId, mes, registros) {
  const raw = lerRaw(root) || { _meta: { atualizado_em: null }, [slug]: {} };
  if (!raw[slug]) raw[slug] = {};
  if (!raw[slug]._detalhes) raw[slug]._detalhes = {};
  raw[slug]._detalhes[metaId + ':' + mes] = registros;
  raw._meta.atualizado_em = new Date().toISOString();
  fs.mkdirSync(path.dirname(cachePath(root)), { recursive: true });
  fs.writeFileSync(cachePath(root), JSON.stringify(raw, null, 2));
}

module.exports = { lerRaw, salvar, obterDetalhe, salvarDetalhe, cachePath };
