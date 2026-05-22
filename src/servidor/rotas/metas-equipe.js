/**
 * rotas/metas-equipe.js - API REST para metas individuais por colaborador
 *
 * Rotas:
 * - GET /api/metas-equipe/config                         -> config (colaboradores + metas)
 * - GET /api/metas-equipe?fonte=cache                    -> resumo de todos
 * - GET /api/metas-equipe/:slug?fonte=cache              -> metas anuais
 * - GET /api/metas-equipe/:slug/detalhe/:metaId/:mes     -> detalhe mensal
 *
 * Logica de calculo em metas-loader.js (separado para manter <200 linhas).
 */

const fs = require('fs');
const { Router } = require('express');
const path = require('path');
const cacheMetas = require('../../core/cache-metas');
const loader = require('../../indicadores/equipe/metas-loader');

const CONFIG_DIR = path.join(__dirname, '..', '..', '..', 'config');
const EQUIP_PATH = path.join(CONFIG_DIR, 'equipe.json');
const METAS_EQU_PATH = path.join(CONFIG_DIR, 'metas-equipe.json');
const ANO = new Date().getFullYear();
const CARGO_LABEL = { junior: 'Analista Júnior', pleno: 'Analista Pleno', senior: 'Analista Sênior', especialista: 'Especialista' };
const router = Router();

function readEquipe() { return JSON.parse(fs.readFileSync(EQUIP_PATH, 'utf8')); }
function readMetasEquipe() { return JSON.parse(fs.readFileSync(METAS_EQU_PATH, 'utf8')); }
function getAnalistas() { return readEquipe().analistas.filter(a => a.papel === 'analista'); }

router.get('/metas-equipe/config', (_req, res) => {
  const metasJson = readMetasEquipe();
  const metasMap = {};
  metasJson.metas.forEach(m => { metasMap[m.id] = m; });
  const todos = readEquipe().analistas;
  const coordenadores = todos
    .filter(a => a.papel === 'coordenador')
    .map(a => ({ slug: a.slug, nome: a.nome, apelido: a.apelido }));
  res.json({
    coordenadores,
    colaboradores: getAnalistas().map(a => ({
      slug: a.slug, nome: a.nome, apelido: a.apelido,
      senioridade: a.senioridade, cargo: CARGO_LABEL[a.senioridade] || a.senioridade,
      'coordenador-slug': a['coordenador-slug'] || null
    })),
    metas: metasMap, templates: metasJson.templates, overrides: metasJson.overrides
  });
});

router.get('/metas-equipe', async (req, res) => {
  const fonte = req.query.fonte;
  if (fonte === 'cache') {
    const todos = cacheMetas.obterTodos();
    if (!todos) return res.status(404).json({ erro: 'Nenhum cache disponivel', _fonte: 'cache' });
    return res.json({ analistas: todos, ano: ANO, _fonte: 'cache', _atualizado_em: cacheMetas.ultimaAtualizacao() });
  }
  try {
    const analistas = getAnalistas();
    const dados = await loader.buscarDados(analistas);
    const metasJson = readMetasEquipe();
    const result = analistas.map(a => loader.montarResposta(a, dados, metasJson));
    cacheMetas.salvarTodos(result);
    res.json({ analistas: result, ano: ANO, _fonte: 'odbc', _atualizado_em: new Date().toISOString() });
  } catch (err) {
    const todos = cacheMetas.obterTodos();
    if (todos) return res.json({ analistas: todos, ano: ANO, _fonte: 'cache', _atualizado_em: cacheMetas.ultimaAtualizacao(), _aviso: err.message });
    res.status(500).json({ erro: err.message });
  }
});

router.get('/metas-equipe/:slug', async (req, res) => {
  const a = getAnalistas().find(x => x.slug === req.params.slug);
  if (!a) return res.status(404).json({ erro: 'Nao encontrado' });
  const fonte = req.query.fonte;
  if (fonte === 'cache') {
    const cached = cacheMetas.obter(a.slug);
    if (!cached) return res.status(404).json({ erro: 'Nenhum cache para ' + a.slug, _fonte: 'cache' });
    return res.json({ ...cached, ano: ANO, _fonte: 'cache', _atualizado_em: cacheMetas.ultimaAtualizacao() });
  }
  try {
    const dados = await loader.buscarDadosAnalista(a);
    const metasJson = readMetasEquipe();
    const resp = loader.montarResposta(a, dados, metasJson);
    cacheMetas.salvar(a.slug, resp);
    res.json({ ...resp, ano: ANO, _fonte: 'odbc', _atualizado_em: new Date().toISOString() });
  } catch (err) {
    const cached = cacheMetas.obter(a.slug);
    if (cached) return res.json({ ...cached, ano: ANO, _fonte: 'cache', _atualizado_em: cacheMetas.ultimaAtualizacao(), _aviso: err.message });
    res.status(500).json({ erro: err.message });
  }
});

router.get('/metas-equipe/:slug/detalhe/:metaId/:mes', async (req, res) => {
  const a = getAnalistas().find(x => x.slug === req.params.slug);
  if (!a) return res.status(404).json({ erro: 'Nao encontrado' });
  const metaId = req.params.metaId, mes = parseInt(req.params.mes, 10);
  const fonte = req.query.fonte;
  if (fonte === 'cache') {
    const cached = cacheMetas.obterDetalhe(a.slug, metaId, mes);
    if (cached) return res.json({ registros: cached, mes, ano: ANO, _fonte: 'cache' });
    return res.status(404).json({ erro: 'Sem cache detalhe', _fonte: 'cache' });
  }
  try {
    const registros = await loader.buscarDetalhe(a, metaId, mes);
    cacheMetas.salvarDetalhe(a.slug, metaId, mes, registros);
    res.json({ registros, mes, ano: ANO, _fonte: 'odbc' });
  } catch (err) {
    const cached = cacheMetas.obterDetalhe(a.slug, metaId, mes);
    if (cached) return res.json({ registros: cached, mes, ano: ANO, _fonte: 'cache', _aviso: err.message });
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
