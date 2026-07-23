/**
 * rotas/indicadores.js - API REST de indicadores e versao
 *
 * Rotas:
 * - GET /api/versao/atual         -> versao corrente detectada
 * - GET /api/versao/:nome/datas   -> datas inicio/fim da versao
 * - GET /api/indicadores          -> lista indicadores disponiveis
 * - GET /api/indicadores/todos    -> calcula todos (?versao=X&force=1&fonte=cache)
 * - GET /api/indicadores/:id      -> calcula um especifico (?versao=X&force=1)
 *
 * Parametros especiais:
 * - force=1  -> bypass do cache de memoria, consulta ODBC fresca
 * - fonte=cache -> retorna dados do cache em disco (sem consultar ODBC)
 */

const { Router } = require('express');

const indicadores = require('../../indicadores');
const qe = require('../../core/query-executor');
const versao = require('../../core/versao');
const cache = require('../../core/cache');

const router = Router();

/** Normaliza o parametro de area (Escrita padrao). */
function normalizarArea(a) {
  if (a === 'Importacao' || a === 'Ambas') return a;
  return 'Escrita';
}
const chaveVersaoArea = cache.chaveVersaoArea;

/** GET /api/versao/atual */
router.get('/versao/atual', async (req, res) => {
  try {
    const nome = await versao.detectarVersaoAtual(qe);
    const datas = await versao.obterDatas(qe, nome);
    res.json({ versao: nome, inicio: datas.inicio, fim: datas.fim });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/** GET /api/versao/:nome/datas */
router.get('/versao/:nome/datas', async (req, res) => {
  try {
    const datas = await versao.obterDatas(qe, req.params.nome);
    if (!datas) return res.status(404).json({ erro: 'Versao nao encontrada' });
    res.json({ versao: req.params.nome, inicio: datas.inicio, fim: datas.fim });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/** GET /api/indicadores */
router.get('/indicadores', (req, res) => {
  res.json(indicadores.listar());
});

/** GET /api/indicadores/todos?versao=10.6A-02&force=1&fonte=cache */
router.get('/indicadores/todos', async (req, res) => {
  const v = req.query.versao || undefined;
  const force = req.query.force === '1';
  const fonte = req.query.fonte;
  const area = normalizarArea(req.query.area);
  const cacheV = chaveVersaoArea(v, area);

  // Fonte=cache: retorna cache de disco direto
  if (fonte === 'cache') {
    const dadosDisco = cacheV ? cache.obterDoDisco(cacheV) : null;
    const atualizado = cache.ultimaAtualizacaoDisco();
    if (dadosDisco) {
      return res.json({
        versao: v, area, resultados: dadosDisco,
        _fonte: 'cache', _atualizado_em: atualizado
      });
    }
    return res.status(404).json({
      erro: 'Nenhum cache disponivel para esta versao',
      _fonte: 'cache'
    });
  }

  // Fonte ODBC (padrao) com fallback para cache
  try {
    const opcoes = v ? { versao: v, force, area } : { force, area };
    const lista = indicadores.listar();
    const resultados = {};

    for (const ind of lista) {
      try {
        resultados[ind.id] = await indicadores.calcular(ind.id, qe, opcoes);
      } catch (err) {
        resultados[ind.id] = { status: 'erro', erro: err.message };
      }
    }

    // Salvar snapshot completo no disco
    if (cacheV) cache.salvarTodosNoDisco(cacheV, resultados);

    res.json({
      versao: v || 'auto', area, resultados,
      _fonte: 'odbc', _atualizado_em: new Date().toISOString()
    });
  } catch (err) {
    // Fallback: tentar servir cache de disco
    console.error('[api] Falha ODBC, tentando cache disco:', err.message);
    const dadosDisco = cacheV ? cache.obterDoDisco(cacheV) : null;
    const atualizado = cache.ultimaAtualizacaoDisco();

    if (dadosDisco) {
      return res.json({
        versao: v, area, resultados: dadosDisco,
        _fonte: 'cache', _atualizado_em: atualizado,
        _aviso: 'Conexao ODBC indisponivel. Exibindo ultimo cache.'
      });
    }

    res.status(500).json({ erro: err.message });
  }
});

/** GET /api/indicadores/:id?versao=10.6A-02&force=1 */
router.get('/indicadores/:id', async (req, res) => {
  const v = req.query.versao || undefined;
  const force = req.query.force === '1';
  const area = normalizarArea(req.query.area);
  const cacheV = chaveVersaoArea(v, area);

  try {
    const opcoes = v ? { versao: v, force, area } : { force, area };
    const resultado = await indicadores.calcular(req.params.id, qe, opcoes);

    if (cacheV) cache.salvarNoDisco(cacheV, req.params.id, resultado);

    res.json({ ...resultado, _fonte: 'odbc', _atualizado_em: new Date().toISOString() });
  } catch (err) {
    // Fallback disco
    const dadoDisco = cacheV ? cache.obterDoDisco(cacheV, req.params.id) : null;
    if (dadoDisco) {
      return res.json({
        ...dadoDisco,
        _fonte: 'cache',
        _atualizado_em: cache.ultimaAtualizacaoDisco(),
        _aviso: 'Conexao ODBC indisponivel. Exibindo cache.'
      });
    }

    const status = err.message.includes('desconhecido') ? 404 : 500;
    res.status(status).json({ erro: err.message });
  }
});

module.exports = router;
