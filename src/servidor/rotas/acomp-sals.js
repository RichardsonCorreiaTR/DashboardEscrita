/**
 * rotas/acomp-sals.js - Acompanhamento de SALs: Tempo Descarte
 * GET /api/acomp-sals/tempo-descarte?ano=2026
 * GET /api/acomp-sals/detalhe?ano=2026
 */
const { Router } = require('express');
const h = require('./acomp-sa-helpers');

const router = Router();

router.get('/acomp-sals/tempo-descarte', async (req, res) => {
  const ano = Number(req.query.ano) || new Date().getFullYear();
  try { res.json(await h.tempoDescarte(ano, h.TIPO_SAL)); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/acomp-sals/detalhe', async (req, res) => {
  const ano = Number(req.query.ano) || new Date().getFullYear();
  try { res.json(await h.detalhe(ano, h.TIPO_SAL)); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
