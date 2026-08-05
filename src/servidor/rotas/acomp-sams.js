/**
 * rotas/acomp-sams.js - Acompanhamento SAMs/SAILs: Tempo Descarte
 * GET /api/acomp-sams/tempo-descarte?ano=2026
 * GET /api/acomp-sams/detalhe?ano=2026
 */
const { Router } = require('express');
const h = require('./acomp-sa-helpers');

const router = Router();

router.get('/acomp-sams/tempo-descarte', async (req, res) => {
  const ano = Number(req.query.ano) || new Date().getFullYear();
  try { res.json(await h.tempoDescarte(ano, h.TIPO_SAM)); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/acomp-sams/detalhe', async (req, res) => {
  const ano = Number(req.query.ano) || new Date().getFullYear();
  try { res.json(await h.detalhe(ano, h.TIPO_SAM)); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
