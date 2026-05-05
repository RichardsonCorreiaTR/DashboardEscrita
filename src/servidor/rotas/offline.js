/**
 * rotas/offline.js - API REST somente-leitura a partir do cache em disco
 *
 * Zero conexao ODBC. Le apenas arquivos JSON de data/cache/.
 * Mesma estrutura de rotas da API principal para que o frontend funcione sem mudanca.
 */

const { Router } = require('express');
const path = require('path');
const fs = require('fs');

const CACHE_DIR = path.join(__dirname, '..', '..', '..', 'data', 'cache');
const HIST_FILE = path.join(__dirname, '..', '..', '..', 'data', 'historico.jsonl');

const router = Router();

/** Le um arquivo JSON de cache (com tratamento de erro) */
function lerCache(nome) {
  const arquivo = path.join(CACHE_DIR, nome);
  if (!fs.existsSync(arquivo)) return null;
  try {
    return JSON.parse(fs.readFileSync(arquivo, 'utf-8'));
  } catch (err) {
    console.error('[offline] Erro ao ler %s: %s', nome, err.message);
    return null;
  }
}

/* ============== INDICADORES ============== */

/** GET /api/indicadores - lista indicadores disponíveis */
router.get('/indicadores', (req, res) => {
  const dados = lerCache('indicadores.json');
  if (!dados) return res.json([]);

  const versoes = Object.keys(dados).filter(k => k !== '_meta');
  if (versoes.length === 0) return res.json([]);

  const primeiraVersao = dados[versoes[0]];
  const lista = Object.keys(primeiraVersao).map(id => {
    const ind = primeiraVersao[id];
    return { id, nome: ind.nome || id, categoria: ind.categoria || 'produto' };
  });
  res.json(lista);
});

/** GET /api/indicadores/todos?versao=X */
router.get('/indicadores/todos', (req, res) => {
  const dados = lerCache('indicadores.json');
  if (!dados) return res.status(404).json({ erro: 'Cache nao encontrado' });

  const versoes = Object.keys(dados).filter(k => k !== '_meta');
  const v = req.query.versao || versoes[versoes.length - 1];
  const resultados = dados[v];
  if (!resultados) return res.status(404).json({ erro: `Sem cache para ${v}` });

  res.json({
    versao: v, resultados,
    _fonte: 'cache-offline',
    _atualizado_em: dados._meta ? dados._meta.atualizado_em : null
  });
});

/** GET /api/indicadores/:id?versao=X */
router.get('/indicadores/:id', (req, res) => {
  const dados = lerCache('indicadores.json');
  if (!dados) return res.status(404).json({ erro: 'Cache nao encontrado' });

  const versoes = Object.keys(dados).filter(k => k !== '_meta');
  const v = req.query.versao || versoes[versoes.length - 1];
  const resultados = dados[v];
  if (!resultados || !resultados[req.params.id]) {
    return res.status(404).json({ erro: `Sem cache para ${req.params.id} em ${v}` });
  }

  res.json({
    ...resultados[req.params.id],
    _fonte: 'cache-offline',
    _atualizado_em: dados._meta ? dados._meta.atualizado_em : null
  });
});

/* ============== VERSAO ============== */

/** GET /api/versao/atual */
router.get('/versao/atual', (req, res) => {
  const dados = lerCache('indicadores.json');
  const versoes = dados ? Object.keys(dados).filter(k => k !== '_meta').sort() : [];
  const atual = versoes[versoes.length - 1] || 'desconhecida';
  res.json({ versao: atual, _fonte: 'cache-offline' });
});

/* ============== ESTUDOS ============== */

/** GET /api/estudos/versoes */
router.get('/estudos/versoes', (req, res) => {
  const dados = lerCache('estudos-historico.json');
  if (!dados || !dados.versoes) return res.json({ versoes: [] });

  const nomes = Object.keys(dados.versoes).sort();
  const atual = nomes[nomes.length - 1] || null;
  const lista = nomes.map(nome => ({ versao: nome, atual: nome === atual }));
  res.json({ versoes: lista, atual });
});

/** GET /api/estudos/semanal/:versao */
router.get('/estudos/semanal/:versao', (req, res) => {
  const dados = lerCache('estudos-historico.json');
  if (!dados || !dados.versoes) return res.status(404).json({ erro: 'Cache nao encontrado' });

  const v = dados.versoes[req.params.versao];
  if (!v) return res.status(404).json({ erro: `Sem dados para ${req.params.versao}` });
  res.json({ ...v, _fonte: 'cache-offline' });
});

/** Rotas de estudos que retornam o cache completo sem transformacao */
for (const [rota, arquivo] of [
  ['/estudos/historico', 'estudos-historico.json'],
  ['/estudos/liberacoes-sa', 'estudos-liberacoes-sa.json'],
  ['/estudos/liberacoes-sa-v2', 'estudos-liberacoes-sa-v2.json'],
  ['/estudos/descartes-ne', 'estudos-descartes-ne.json']
]) {
  router.get(rota, (req, res) => {
    const dados = lerCache(arquivo);
    if (!dados) return res.status(404).json({ erro: 'Cache nao encontrado' });
    res.json({ ...dados, _fonte: 'cache-offline' });
  });
}

/* ============== HISTORICO JSONL ============== */

function lerJsonl() {
  if (!fs.existsSync(HIST_FILE)) return [];
  const linhas = fs.readFileSync(HIST_FILE, 'utf-8').split('\n').filter(l => l.trim());
  return linhas.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

/** GET /api/historico/stats */
router.get('/historico/stats', (req, res) => {
  const todos = lerJsonl();
  const indicadores = [...new Set(todos.map(r => r.indicador))];
  let tamanhoKb = 0;
  try { tamanhoKb = Math.round(fs.statSync(HIST_FILE).size / 1024); } catch {}
  res.json({ total_registros: todos.length, indicadores, tamanho_kb: tamanhoKb });
});

/** GET /api/historico/:id */
router.get('/historico/:id', (req, res) => {
  const limite = parseInt(req.query.limite) || 20;
  const registros = lerJsonl()
    .filter(r => r.indicador === req.params.id)
    .sort((a, b) => new Date(a.ts) - new Date(b.ts));
  res.json({ indicador: req.params.id, total: registros.length, registros: registros.slice(-limite) });
});

/** GET /api/historico/:id/tendencia */
router.get('/historico/:id/tendencia', (req, res) => {
  const n = parseInt(req.query.n) || 5;
  const registros = lerJsonl()
    .filter(r => r.indicador === req.params.id)
    .sort((a, b) => new Date(a.ts) - new Date(b.ts));

  let direcao = 'insuficiente';
  const valores = registros.slice(-n).map(r => r.valor).filter(v => v !== null);
  if (valores.length >= 3) {
    let sub = 0, desc = 0;
    for (let i = 1; i < valores.length; i++) {
      if (valores[i] > valores[i - 1]) sub++;
      if (valores[i] < valores[i - 1]) desc++;
    }
    direcao = sub > desc ? 'subindo' : desc > sub ? 'descendo' : 'estavel';
  }

  const atual = registros.length > 0 ? registros[registros.length - 1] : null;
  const anterior = registros.length >= 2 ? registros[registros.length - 2] : null;
  const variacao = atual && anterior && atual.valor != null && anterior.valor != null
    ? atual.valor - anterior.valor : null;

  res.json({ indicador: req.params.id, tendencia: direcao, comparacao: { atual, anterior, variacao } });
});

/** GET /api/saude */
router.get('/saude', (req, res) => {
  const arquivos = fs.existsSync(CACHE_DIR)
    ? fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'))
    : [];
  res.json({
    status: 'offline',
    modo: 'somente-cache',
    arquivos_cache: arquivos.length,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
