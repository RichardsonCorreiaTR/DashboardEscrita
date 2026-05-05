/**
 * rotas/laboratorio.js - API REST do Laboratorio de Previsibilidade
 *
 * GET /api/laboratorio/versoes             - Lista de versoes disponiveis
 * GET /api/laboratorio/raio-x/:versao      - Raio-X de uma versao
 * GET /api/laboratorio/evolucao            - Tendencias ao longo das versoes
 * GET /api/laboratorio/dna-tecnico         - Analise por area tecnica
 */

const { Router } = require('express');
const analise = require('../../estudos/laboratorio/analise-classificacoes');
const backtest = require('../../estudos/laboratorio/backtest-lab');
const previsaoLab = require('../../estudos/laboratorio/previsao-lab');

const router = Router();

router.get('/laboratorio/versoes', (_req, res) => {
  try { res.json(analise.listarVersoes()); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/laboratorio/raio-x/:versao', (req, res) => {
  try { res.json(analise.raioXVersao(req.params.versao)); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/laboratorio/evolucao', (_req, res) => {
  try { res.json(analise.evolucao()); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/laboratorio/dna-tecnico', (_req, res) => {
  try { res.json(analise.dnaTecnico()); }
  catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/laboratorio/backtest', (_req, res) => {
  try {
    const bt = backtest.executarComIA();
    const extras = previsaoLab.gerar(bt.melhor);
    res.json({ ...bt, ...extras });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
