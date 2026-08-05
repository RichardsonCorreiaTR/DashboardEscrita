/**
 * rotas-nes-definicao.js - NEs com Definicao somente do colaborador logado
 * Le cache do projeto pai (ou data/ local no standalone). Sem upload.
 */
const fs = require('fs');
const path = require('path');
const { Router } = require('express');
const { ROOT } = require('./config-analista');

const CACHE_PATH = path.join(ROOT, 'data', 'nes-definicao-cache.json');

function lerCache() {
  try {
    if (fs.existsSync(CACHE_PATH)) return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch { /* corrompido */ }
  return null;
}

function filtrarSlug(dados, slug) {
  const meus = (dados.por_analista && dados.por_analista[slug]) || {};
  return {
    versoes: dados.versoes || [],
    labels: dados.labels || [],
    por_analista: { [slug]: meus },
    gerado_em: dados.gerado_em || null,
    _slug: slug
  };
}

function criarRotas(slugFixo) {
  const router = Router();

  router.get('/nes-definicao/dados', (req, res) => {
    const slug = slugFixo || (req.session && req.session.slug);
    if (!slug) return res.status(401).json({ erro: 'Nao autenticado' });
    const cache = lerCache();
    if (!cache) {
      return res.status(404).json({
        erro: 'Dados de NEs com Definicao ainda nao disponiveis. Aguarde o coordenador atualizar a planilha.'
      });
    }
    res.json({ ...filtrarSlug(cache, slug), _fonte: 'cache' });
  });

  return router;
}

module.exports = { criarRotas };
