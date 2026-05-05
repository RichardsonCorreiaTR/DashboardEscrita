/**
 * proposta-metas.js - Rota da pagina de proposta de metas
 *
 * Endpoints:
 * - GET /proposta-metas/verificar/:metaId - prova de conceito (dados existem?)
 * - GET /proposta-metas/retro/:metaId     - retrospectiva 2025 por analista
 */

const path = require('path');
const { Router } = require('express');
const qe = require('../../core/query-executor');
const queries = require('./proposta-metas-queries');

const router = Router();

const equipe = require(path.join(__dirname, '../../../config/equipe.json'));
const analistas = equipe.analistas.filter(a => a.papel === 'analista');
const IDS_SGD = analistas.map(a => a['codigo-sgd']);

const IDS_ENVIO = analistas
  .filter(a => ['junior', 'pleno'].includes(a.senioridade))
  .map(a => a['codigo-sgd']);
const IDS_RESPOSTA = analistas
  .filter(a => a.senioridade === 'especialista')
  .map(a => a['codigo-sgd']);

const MAPA_NOMES = {};
analistas.forEach(a => {
  MAPA_NOMES[a['codigo-sgd']] = a.apelido;
  MAPA_NOMES[a['i-usuarios']] = a.apelido;
});

const VERIFICACOES = {
  'tempo-ciclo-analise': {
    descricao: 'Tramites de PSAI com datas de envio e resposta (NE Escrita)',
    sql: queries.queryVerifTempoCiclo()
  },
  'complexidade-media': {
    descricao: 'SAIs com pontuacao preenchida (area Escrita)',
    sql: queries.queryVerifComplexidade()
  },
  'cobertura-estimativa': {
    descricao: 'SAIs com campo de estimativa preenchido',
    sql: queries.queryVerifCobertura()
  }
};

router.get('/proposta-metas/verificar/:metaId', async (req, res) => {
  const verif = VERIFICACOES[req.params.metaId];
  if (!verif) {
    return res.status(404).json({ acessivel: false, erro: 'Meta nao encontrada.' });
  }
  try {
    const registros = await qe.executar(verif.sql);
    const total = extrairTotal(registros);
    const amostra = formatarAmostra(registros);
    res.json({ acessivel: total > 0, registros: total, descricao: verif.descricao, amostra });
  } catch (err) {
    res.json({ acessivel: false, registros: 0, descricao: verif.descricao, erro: err.message });
  }
});

router.get('/proposta-metas/retro/:metaId', async (req, res) => {
  const { metaId } = req.params;
  const ano = Number(req.query.ano) || 2025;
  try {
    const dados = await executarRetro(metaId, ano);
    res.json({ meta: metaId, ano, analistas: mapearNomes(dados), _fonte: 'odbc' });
  } catch (err) {
    res.status(500).json({ meta: metaId, erro: err.message });
  }
});

router.get('/proposta-metas/equipe', (_req, res) => {
  res.json(analistas.map(a => ({
    apelido: a.apelido, slug: a.slug, senioridade: a.senioridade,
    codigoSgd: a['codigo-sgd'], iUsuarios: a['i-usuarios']
  })));
});

async function executarRetro(metaId, ano) {
  if (metaId === 'tempo-ciclo-analise') {
    const promises = [];
    if (IDS_ENVIO.length) promises.push(qe.executar(queries.queryTempoCicloEnvio(IDS_ENVIO, ano)));
    if (IDS_RESPOSTA.length) promises.push(qe.executar(queries.queryTempoCicloResposta(IDS_RESPOSTA, ano)));
    const resultados = await Promise.all(promises);
    return resultados.flat();
  }
  if (metaId === 'complexidade-media') {
    return await qe.executar(queries.queryComplexidade(IDS_SGD, ano));
  }
  if (metaId === 'cobertura-estimativa') {
    return await qe.executar(queries.queryCoberturaEstimativa(IDS_SGD, ano));
  }
  throw new Error(`Meta "${metaId}" nao possui retrospectiva.`);
}

function mapearNomes(registros) {
  return registros.map(r => ({
    ...r,
    nome: MAPA_NOMES[r.i_usuarios] || String(r.i_usuarios)
  }));
}

function extrairTotal(registros) {
  if (!registros || !registros.length) return 0;
  if (registros[0].total != null) {
    return registros.reduce((acc, r) => acc + Number(r.total), 0);
  }
  return registros.length;
}

function formatarAmostra(registros) {
  if (!registros || !registros.length) return null;
  if (registros[0].media_pontuacao != null) {
    return `Pontuacao media: ${Number(registros[0].media_pontuacao).toFixed(1)}`;
  }
  if (registros[0].com_estimativa != null) {
    const t = Number(registros[0].total);
    const c = Number(registros[0].com_estimativa);
    return t > 0 ? `${((c / t) * 100).toFixed(0)}% com estimativa` : null;
  }
  return null;
}

module.exports = router;
