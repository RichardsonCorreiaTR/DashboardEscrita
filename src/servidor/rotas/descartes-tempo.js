/**
 * descartes-tempo.js - Rota do estudo Descartes x Tempo GA
 *
 * GET /descartes-tempo?ano=2025 - PSAIs descartadas com tempo lancado no GA
 */

const path = require('path');
const { Router } = require('express');
const qe = require('../../core/query-executor');
const { queryDescartesTempo, MOTIVOS_DESCARTE } = require('./descartes-tempo-queries');

const router = Router();

const equipe = require(path.join(__dirname, '../../../config/equipe.json'));
const analistas = equipe.analistas.filter(a => a.papel === 'analista');
const IDS_SGD = analistas.map(a => a['codigo-sgd']);
const MAPA_NOMES = {};
analistas.forEach(a => { MAPA_NOMES[a['codigo-sgd']] = a.apelido; });

router.get('/descartes-tempo', async (req, res) => {
  const ano = Number(req.query.ano) || 2025;
  try {
    const registros = await qe.executar(queryDescartesTempo(IDS_SGD, ano));
    const dados = registros.map(r => ({
      ...r,
      nome: MAPA_NOMES[r.i_usuarios] || String(r.i_usuarios),
      motivo_nome: MOTIVOS_DESCARTE[r.motivo] || `Sit ${r.motivo}`,
      minutos_lancados: Number(r.minutos_lancados) || 0
    }));
    res.json({ ano, registros: dados, resumo: gerarResumo(dados), _fonte: 'odbc' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

function gerarResumo(dados) {
  const porAnalista = {};
  dados.forEach(r => {
    if (!porAnalista[r.nome]) {
      porAnalista[r.nome] = { descartes: 0, minutos: 0, sem_lancamento: 0, por_motivo: {} };
    }
    const a = porAnalista[r.nome];
    a.descartes++;
    a.minutos += r.minutos_lancados;
    if (r.minutos_lancados === 0 && r.i_sai > 0) a.sem_lancamento++;
    const mot = r.motivo_nome;
    a.por_motivo[mot] = (a.por_motivo[mot] || 0) + 1;
  });
  return porAnalista;
}

module.exports = router;
