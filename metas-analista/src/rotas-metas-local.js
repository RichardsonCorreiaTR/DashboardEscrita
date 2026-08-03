/**
 * rotas-metas-local.js - API de metas (cache local + ODBC do proprio usuario)
 */
const { Router } = require('express');
const cacheLocal = require('./cache-local');
const atualizar = require('./atualizar-metas');

function criarRotas(root, slugPermitido) {
  const router = Router();
  const odbcOk = atualizar.temOdbc(root);

  function negarSlug(slug, res) {
    if (slug !== slugPermitido) {
      res.status(403).json({ erro: 'Acesso restrito as suas metas' });
      return true;
    }
    return false;
  }

  function respCache(slug, ano) {
    const raw = cacheLocal.lerRaw(root);
    const dados = raw && raw[slug];
    if (!dados) return null;
    return {
      ...dados, ano,
      _fonte: 'cache',
      _atualizado_em: raw._meta && raw._meta.atualizado_em
    };
  }

  router.get('/metas-equipe/:slug', async (req, res) => {
    if (negarSlug(req.params.slug, res)) return;
    const ano = Number(req.query.ano) || new Date().getFullYear();
    if (req.query.fonte === 'cache') {
      const cached = respCache(slugPermitido, ano);
      if (!cached) return res.status(404).json({ erro: 'Sem dados no cache', _fonte: 'cache' });
      return res.json(cached);
    }
    if (!odbcOk) {
      const cached = respCache(slugPermitido, ano);
      if (cached) return res.json({ ...cached, _aviso: 'ODBC indisponivel neste pacote' });
      return res.status(503).json({ erro: 'Atualizacao ao vivo indisponivel' });
    }
    try {
      res.json(await atualizar.atualizarResumo(root, slugPermitido, req.query.ano));
    } catch (err) {
      const cached = respCache(slugPermitido, ano);
      if (cached) return res.json({ ...cached, _aviso: err.message });
      res.status(500).json({ erro: err.message });
    }
  });

  router.get('/metas-equipe/:slug/detalhe/:metaId/:mes', async (req, res) => {
    if (negarSlug(req.params.slug, res)) return;
    const mes = parseInt(req.params.mes, 10);
    const ano = Number(req.query.ano) || new Date().getFullYear();
    const { metaId } = req.params;
    if (req.query.fonte === 'cache') {
      const regs = cacheLocal.obterDetalhe(root, slugPermitido, metaId, mes);
      if (!regs) return res.status(404).json({ erro: 'Detalhe nao disponivel no cache', _fonte: 'cache' });
      return res.json({ registros: regs, mes, ano, _fonte: 'cache' });
    }
    if (!odbcOk) {
      const regs = cacheLocal.obterDetalhe(root, slugPermitido, metaId, mes);
      if (regs) return res.json({ registros: regs, mes, ano, _fonte: 'cache', _aviso: 'ODBC indisponivel' });
      return res.status(503).json({ erro: 'Atualizacao ao vivo indisponivel' });
    }
    try {
      res.json(await atualizar.atualizarDetalhe(root, slugPermitido, metaId, mes, req.query.ano));
    } catch (err) {
      const regs = cacheLocal.obterDetalhe(root, slugPermitido, metaId, mes);
      if (regs) return res.json({ registros: regs, mes, ano, _fonte: 'cache', _aviso: err.message });
      res.status(500).json({ erro: err.message });
    }
  });

  router.get('/metas-equipe/odbc-disponivel', (_req, res) => {
    res.json({ disponivel: odbcOk });
  });

  return router;
}

module.exports = { criarRotas };
