/**
 * rotas-acomp.js - API Acomp. NEs/SALs somente do colaborador logado
 */
const { Router } = require('express');
const helpers = require('./acomp-helpers');

function criarRotas(slugFixo) {
  const router = Router();

  function slugReq(req) {
    return slugFixo || (req.session && req.session.slug);
  }

  function exigirSelf(req, res) {
    const slug = slugReq(req);
    if (!slug) { res.status(401).json({ erro: 'Nao autenticado' }); return null; }
    const colab = helpers.lerColab(slug);
    if (!colab) { res.status(404).json({ erro: 'Colaborador nao encontrado' }); return null; }
    return colab;
  }

  router.get('/acomp-sals/tempo-descarte', async (req, res) => {
    const colab = exigirSelf(req, res);
    if (!colab) return;
    try {
      res.json(await helpers.tempoDescarte(colab.slug, Number(req.query.ano) || new Date().getFullYear()));
    } catch (err) { res.status(500).json({ erro: err.message }); }
  });

  router.get('/acomp-sals/tempo-detalhado', async (req, res) => {
    const colab = exigirSelf(req, res);
    if (!colab) return;
    if (req.query.filtros === '1') {
      return res.json({ filtros: helpers.filtrosSelf(colab), linhas: [] });
    }
    const ano = Number(req.query.ano) || new Date().getFullYear();
    const nivel = req.query.nivel && req.query.nivel !== 'todos' ? Number(req.query.nivel) : null;
    try {
      const linhas = await helpers.linhasSal(colab.slug, ano, nivel);
      res.json({ ano, filtros: helpers.filtrosSelf(colab), linhas });
    } catch (err) { res.status(500).json({ erro: err.message }); }
  });

  router.get('/acomp-nes/tempo-detalhado', async (req, res) => {
    const colab = exigirSelf(req, res);
    if (!colab) return;
    if (req.query.filtros === '1') {
      return res.json({ filtros: helpers.filtrosSelf(colab), linhas: [] });
    }
    const ano = Number(req.query.ano) || new Date().getFullYear();
    const area = req.query.area === 'Importacao' ? 'Importacao' : 'Escrita';
    try {
      const linhas = await helpers.linhasNe(colab.slug, ano, area);
      res.json({ ano, area, filtros: helpers.filtrosSelf(colab), linhas });
    } catch (err) { res.status(500).json({ erro: err.message }); }
  });

  return router;
}

module.exports = { criarRotas };
