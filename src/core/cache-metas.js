/**
 * cache-metas.js - Cache em disco para metas da equipe
 *
 * Arquivo: data/cache/metas-equipe.json
 * Estrutura: { "_meta": { atualizado_em }, "slug": { ...resposta } }
 *
 * Mesma filosofia do cache.js (indicadores):
 * - Persiste no disco para sobreviver a restart
 * - Serve como fallback quando ODBC esta indisponivel
 */

const path = require('path');
const fs = require('fs');

const CACHE_DIR = path.join(__dirname, '..', '..', 'data', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'metas-equipe.json');

let disco = { _meta: { atualizado_em: null } };

function garantirDiretorio() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function salvar(slug, dados) {
  garantirDiretorio();
  disco[slug] = dados;
  disco._meta.atualizado_em = new Date().toISOString();
  gravar();
}

function salvarTodos(respostas) {
  garantirDiretorio();
  const novo = { _meta: { atualizado_em: new Date().toISOString() } };
  respostas.forEach(r => {
    const antigo = disco[r.slug];
    novo[r.slug] = antigo && antigo._detalhes ? { ...r, _detalhes: antigo._detalhes } : r;
  });
  disco = novo;
  gravar();
  console.log('[cache-metas] Salvo (%d colaboradores)', respostas.length);
}

function obter(slug) { return disco[slug] || null; }

function obterTodos() {
  const slugs = Object.keys(disco).filter(k => k !== '_meta');
  return slugs.length > 0 ? slugs.map(s => disco[s]) : null;
}

function ultimaAtualizacao() { return disco._meta.atualizado_em || null; }

function restaurar() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return;
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    disco = JSON.parse(raw);
    if (!disco._meta) disco._meta = { atualizado_em: null };
    const n = Object.keys(disco).filter(k => k !== '_meta').length;
    console.log('[cache-metas] Restaurado (%d colaboradores)', n);
  } catch (err) {
    console.error('[cache-metas] Erro ao restaurar:', err.message);
    disco = { _meta: { atualizado_em: null } };
  }
}

function gravar() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(disco, null, 2), 'utf-8');
  } catch (err) {
    console.error('[cache-metas] Erro ao gravar:', err.message);
  }
}

function salvarDetalhe(slug, metaId, mes, registros) {
  if (!disco[slug]) disco[slug] = {};
  if (!disco[slug]._detalhes) disco[slug]._detalhes = {};
  disco[slug]._detalhes[metaId + ':' + mes] = registros;
  disco._meta.atualizado_em = new Date().toISOString();
  gravar();
}

function obterDetalhe(slug, metaId, mes) {
  if (!disco[slug] || !disco[slug]._detalhes) return null;
  return disco[slug]._detalhes[metaId + ':' + mes] || null;
}

module.exports = {
  salvar, salvarTodos, obter, obterTodos,
  salvarDetalhe, obterDetalhe,
  ultimaAtualizacao, restaurar
};
