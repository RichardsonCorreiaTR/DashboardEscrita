/**
 * Lê trechos de pesquisa de mercado (Markdown) para enriquecer narrativa/diagrama.
 *
 * Ordem de pasta: PESQUISA_MERCADO_DIR → config/pesquisa-mercado.json → pasta "irmã" PesquisaMercado/data/raw
 */

const fs = require('fs');
const path = require('path');

const CONFIG = path.join(__dirname, '..', '..', 'config', 'pesquisa-mercado.json');

function pastaPadraoPesquisa() {
  return path.join(__dirname, '..', '..', '..', 'PesquisaMercado', 'data', 'raw');
}

function resolverPasta() {
  const env = process.env.PESQUISA_MERCADO_DIR;
  if (env && fs.existsSync(env)) return { p: env, origem: 'PESQUISA_MERCADO_DIR' };

  try {
    const j = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
    if (j.pasta && String(j.pasta).trim() && fs.existsSync(j.pasta)) {
      return { p: path.resolve(j.pasta), origem: 'config/pesquisa-mercado.json' };
    }
  } catch {
    /* sem config */
  }

  const pad = pastaPadraoPesquisa();
  if (fs.existsSync(pad)) return { p: pad, origem: 'PesquisaMercado/data/raw (irmão)' };
  return { p: null, origem: null };
}

function listarMdRecursivo(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const nome of fs.readdirSync(dir)) {
    const fp = path.join(dir, nome);
    const st = fs.statSync(fp);
    if (st.isDirectory()) listarMdRecursivo(fp, acc);
    else if (nome.toLowerCase().endsWith('.md')) acc.push({ fp, m: st.mtimeMs });
  }
  return acc;
}

function normalizarEol(txt) {
  return String(txt).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function removerFrontmatter(txt) {
  const t = normalizarEol(txt);
  if (!t.startsWith('---\n')) return t;
  const m = t.match(/^---\n[\s\S]*?\n---\n/);
  if (!m) return t;
  return t.slice(m[0].length).trim();
}

function extrairParagrafos(md, maxPar = 10) {
  const corpo = removerFrontmatter(md);
  const partes = corpo.split(/\n{2,}/).map(s => s.replace(/\s+/g, ' ').trim());
  const out = [];
  for (const p of partes) {
    if (!p || p.startsWith('#')) continue;
    if (p.startsWith('|')) continue;
    if (p.length < 40) continue;
    out.push(p.slice(0, 520) + (p.length > 520 ? '…' : ''));
    if (out.length >= maxPar) break;
  }
  return out;
}

function carregarTrechosPesquisaMercado() {
  const { p, origem } = resolverPasta();
  if (!p) {
    return { ok: false, trechos: [], arquivos: [], origem: null, nota: 'Pasta PesquisaMercado não encontrada.' };
  }

  const todos = listarMdRecursivo(p).sort((a, b) => b.m - a.m);
  const trechos = [];
  const arquivos = [];
  const limiteArquivos = 3;

  for (const { fp } of todos.slice(0, limiteArquivos)) {
    try {
      const raw = fs.readFileSync(fp, 'utf8');
      const rel = path.relative(p, fp);
      arquivos.push(rel);
      extrairParagrafos(raw, 18).forEach(x => trechos.push(x));
    } catch {
      /* skip */
    }
  }

  return {
    ok: trechos.length > 0,
    trechos: trechos.slice(0, 24),
    arquivos,
    origem,
    nota: trechos.length ? null : 'Nenhum parágrafo extraído dos .md (só tabelas/cabeçalhos?).'
  };
}

function carregarRawPrimeiroMd() {
  const { p, origem } = resolverPasta();
  if (!p) return { ok: false };
  const todos = listarMdRecursivo(p).sort((a, b) => b.m - a.m);
  if (!todos.length) return { ok: false };
  const { fp } = todos[0];
  return {
    ok: true,
    fp,
    raw: fs.readFileSync(fp, 'utf8'),
    origem,
    rel: path.relative(p, fp)
  };
}

module.exports = {
  carregarTrechosPesquisaMercado,
  resolverPasta,
  carregarRawPrimeiroMd,
  removerFrontmatter,
  normalizarEol,
  listarMdRecursivo
};
