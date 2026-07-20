/**
 * ss-respondidas.js - Rota SS Respondidas (cache mensal + ODBC sob demanda)
 *
 * GET /api/ss-respondidas?ano=2026              -> cache (ODBC so na 1a vez)
 * GET /api/ss-respondidas?ano=2026&force=1     -> atualiza ano inteiro via ODBC
 * GET /api/ss-respondidas?ano=2026&force=1&mes=2 -> atualiza so fevereiro
 */

const path = require('path');
const { Router } = require('express');
const qe = require('../../core/query-executor');
const cacheSs = require('../../core/cache-ss-respondidas');
const { querySsRespondidas } = require('./ss-respondidas-queries');
const { gerarResumo, mapearRegistros, mesAtualRef } = require('./ss-respondidas-utils');

const router = Router();
const equipe = require(path.join(__dirname, '../../../config/equipe.json'));

const membros = equipe.analistas.filter(a => a.papel === 'analista');
const IDS_SGD = membros.map(a => a['codigo-sgd']);
const MAPA = {};
membros.forEach(a => { MAPA[a['codigo-sgd']] = { nome: a.apelido, senioridade: a.senioridade }; });

async function buscarOdbc(ano, mes) {
  const rows = await qe.executar(querySsRespondidas(IDS_SGD, ano, mes || null));
  return mapearRegistros(rows, MAPA);
}

function agruparPorMes(registros) {
  const map = {};
  registros.forEach(r => {
    if (!map[r.mes]) map[r.mes] = [];
    map[r.mes].push(r);
  });
  return map;
}

async function popularAnoCompleto(ano) {
  const registros = await buscarOdbc(ano, null);
  const porMes = agruparPorMes(registros);
  Object.entries(porMes).forEach(([mes, rows]) => cacheSs.salvarMes(ano, Number(mes), rows));
  return registros;
}

async function atualizarMes(ano, mes) {
  const registros = await buscarOdbc(ano, mes);
  cacheSs.salvarMes(ano, mes, registros);
  return registros;
}

router.get('/ss-respondidas', async (req, res) => {
  const ano = Number(req.query.ano) || mesAtualRef().ano;
  const force = req.query.force === '1';
  const mesFiltro = req.query.mes ? Number(req.query.mes) : null;

  try {
    let fonte = 'cache';

    if (force) {
      if (mesFiltro) {
        await atualizarMes(ano, mesFiltro);
      } else {
        await popularAnoCompleto(ano);
      }
      fonte = 'odbc';
    } else if (!cacheSs.temAno(ano)) {
      await popularAnoCompleto(ano);
      fonte = 'odbc';
    }

    const montado = cacheSs.montarAno(ano);
    res.json({
      ano,
      registros: montado.registros,
      resumo: gerarResumo(montado.registros),
      _fonte: fonte,
      _atualizado_em: montado.atualizado_em || cacheSs.ultimaAtualizacao(),
      _meses_cache: montado.meses
    });
  } catch (err) {
    const montado = cacheSs.montarAno(ano);
    if (montado.registros.length) {
      return res.json({
        ano,
        registros: montado.registros,
        resumo: gerarResumo(montado.registros),
        _fonte: 'cache',
        _atualizado_em: montado.atualizado_em,
        _aviso: 'ODBC indisponivel: exibindo cache',
        _meses_cache: montado.meses
      });
    }
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
