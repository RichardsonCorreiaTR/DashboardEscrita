/**
 * rotas/acomp-sams-tempo.js - Detalhamento de tempo por SAM/SAIL
 * GET /api/acomp-sams/tempo-detalhado?ano=&analista=&nivel=
 */
const { Router } = require('express');
const h = require('./acomp-sa-helpers');

const router = Router();

router.get('/acomp-sams/tempo-detalhado', async (req, res) => {
  if (req.query.filtros === '1') {
    return res.json({ filtros: h.montarFiltros(), linhas: [] });
  }
  const ano = Number(req.query.ano) || new Date().getFullYear();
  const nivel = req.query.nivel && req.query.nivel !== 'todos' ? Number(req.query.nivel) : null;
  const analista = req.query.analista && req.query.analista !== 'todos' ? String(req.query.analista) : null;
  try { res.json(await h.tempoDetalhado(ano, analista, nivel, h.TIPO_SAM)); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
