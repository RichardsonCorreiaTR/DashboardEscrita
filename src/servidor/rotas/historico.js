/**
 * rotas/historico.js - API REST de historico de indicadores
 *
 * Rotas:
 * - GET /api/historico/:id           → ultimos registros de um indicador
 * - GET /api/historico/:id/tendencia → tendencia (subindo/descendo/estavel)
 */

const { Router } = require('express');

const consulta = require('../../historico/consulta');
const { filtrarPorIndicador, estatisticas } = require('../../historico/registrador');

const router = Router();

/** GET /api/historico/stats - estatisticas gerais */
router.get('/historico/stats', (req, res) => {
  try {
    res.json(estatisticas());
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/** GET /api/historico/:id - ultimos N registros de um indicador */
router.get('/historico/:id', (req, res) => {
  try {
    const limite = parseInt(req.query.limite) || 20;
    const registros = filtrarPorIndicador(req.params.id);
    const ultimos = registros.slice(-limite);

    res.json({
      indicador: req.params.id,
      total: registros.length,
      registros: ultimos
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/** GET /api/historico/:id/tendencia - tendencia recente */
router.get('/historico/:id/tendencia', (req, res) => {
  try {
    const n = parseInt(req.query.n) || 5;
    const t = consulta.tendencia(req.params.id, n);
    const comp = consulta.compararComAnterior(req.params.id);

    res.json({
      indicador: req.params.id,
      tendencia: t,
      comparacao: comp
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
