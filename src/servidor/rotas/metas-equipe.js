/**
 * rotas/metas-equipe.js - API REST para metas individuais por colaborador
 *
 * Rotas:
 * - GET /api/metas-equipe/config                         -> config (colaboradores + metas)
 * - GET /api/metas-equipe?fonte=cache                    -> resumo de todos
 * - GET /api/metas-equipe/:slug?fonte=cache              -> metas anuais
 * - GET /api/metas-equipe/:slug/detalhe/:metaId/:mes     -> detalhe mensal
 *
 * Suporta: fonte=cache (disco) | force=1 (ODBC) | default (ODBC com fallback cache)
 *
 * equipe.json e metas-equipe.json sao lidos do disco a cada request (sem cache require),
 * para mudancas na equipe refletirem sem reiniciar o servidor.
 */

const fs = require('fs');
const { Router } = require('express');
const path = require('path');
const qe = require('../../core/query-executor');
const cacheMetas = require('../../core/cache-metas');
const queries = require('../../indicadores/equipe/consultas-metas');
const detalhe = require('../../indicadores/equipe/consultas-metas-detalhe');
const anual = require('../../indicadores/equipe/metas-anual');
const planilha = require('../../core/planilha-escrita');
const cruzamento = require('../../core/planilha-cruzamento');

const CONFIG_DIR = path.join(__dirname, '..', '..', '..', 'config');
const EQUIP_PATH = path.join(CONFIG_DIR, 'equipe.json');
const METAS_EQU_PATH = path.join(CONFIG_DIR, 'metas-equipe.json');
const ANO = new Date().getFullYear();

const CARGO_LABEL = { junior: 'Analista Jr', pleno: 'Analista Pleno', senior: 'Analista Senior', especialista: 'Especialista' };
const router = Router();

function readEquipe() {
  return JSON.parse(fs.readFileSync(EQUIP_PATH, 'utf8'));
}

function readMetasEquipe() {
  return JSON.parse(fs.readFileSync(METAS_EQU_PATH, 'utf8'));
}

function getAnalistas() {
  return readEquipe().analistas.filter(a => a.papel === 'analista');
}

function metasDoAnalista(a, metasJson) {
  const tmpl = metasJson.templates[a.senioridade] || [];
  const extras = (metasJson.overrides[a.slug] || {})['metas-adicionais'] || [];
  return [...tmpl, ...extras].filter(id => id !== 'diretrizes-95');
}

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
    metas: metasMap,
    templates: metasJson.templates,
    overrides: metasJson.overrides
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
    const dados = await buscarDados();
    const analistas = getAnalistas().map(a => montarResposta(a, dados));
    cacheMetas.salvarTodos(analistas);
    res.json({ analistas, ano: ANO, _fonte: 'odbc', _atualizado_em: new Date().toISOString() });
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
    const dados = await buscarDadosAnalista(a);
    const resp = montarResposta(a, dados);
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
    const registros = await buscarDetalhe(a, metaId, mes);
    cacheMetas.salvarDetalhe(a.slug, metaId, mes, registros);
    const extra = metaId === 'pontos-definicao'
      ? { planilha: await buscarCruzamentoPlanilha(a, mes, registros) }
      : {};
    res.json({ registros, mes, ano: ANO, _fonte: 'odbc', ...extra });
  } catch (err) {
    const cached = cacheMetas.obterDetalhe(a.slug, metaId, mes);
    if (cached) return res.json({ registros: cached, mes, ano: ANO, _fonte: 'cache', _aviso: err.message });
    res.status(500).json({ erro: err.message });
  }
});

async function buscarCruzamentoPlanilha(a, mes, sgdRows) {
  try {
    const saisPlanilha = await planilha.obterSaisAnalista(mes, a);
    return cruzamento.cruzar(sgdRows, saisPlanilha);
  } catch (e) {
    return { erro: e.message };
  }
}

async function mergePlanilhaPontos(sgdRows, a) {
  const mesAtual = new Date().getMonth() + 1;
  const meses = Array.from({ length: mesAtual }, (_, i) => i + 1);
  const planTotais = {};
  await Promise.all(meses.map(async mes => {
    try {
      const sais = await planilha.obterSaisAnalista(mes, a);
      planTotais[mes] = {
        total: sais.reduce((s, r) => s + (r.pontos ? Number(r.pontos) : 0), 0),
        qtd: sais.length
      };
    } catch (_) {
      planTotais[mes] = { total: 0, qtd: 0 };
    }
  }));
  const sgdMap = new Map(sgdRows.map(r => [Number(r.mes), r]));
  const resultado = sgdRows.map(r => ({ ...r }));
  for (const mes of meses) {
    const plan = planTotais[mes];
    if (!plan || plan.qtd === 0) continue;
    const sgdRow = sgdMap.get(mes);
    if (!sgdRow) {
      resultado.push({ i_usuarios: a['codigo-sgd'], mes, pontos: plan.total, qtd_sais: plan.qtd, qtd_sem_pontos: 0 });
    } else if (Number(sgdRow.pontos) === 0) {
      const r = resultado.find(x => Number(x.mes) === mes);
      if (r) { r.pontos = plan.total; r.qtd_sem_pontos = 0; }
    }
  }
  return resultado;
}

async function buscarDados() {
  const analistas = getAnalistas();
  const idsUsuarios = analistas.map(a => a['i-usuarios']);
  const idsSgd = analistas.map(a => a['codigo-sgd']);
  const [revDef, revGer, pontos, tempoGer, ss, ativs] = await Promise.all([
    qe.executar(queries.queryControleRevisoes(ANO)),
    qe.executar(queries.queryControleRevisoesPorGerador(ANO)),
    qe.executar(queries.queryPontosDefinicao(ANO)),
    qe.executar(queries.queryTramitacoesPsai(idsSgd, 3, ANO)),
    qe.executar(queries.queryRespostasSS(idsUsuarios, ANO)),
    qe.executar(queries.queryTempoAtividades(idsUsuarios, ANO))
  ]);
  return {
    revCtrl: { def: anual.agruparControleRevisoes(revDef), ger: anual.agruparControleRevisoes(revGer) },
    pontos: anual.agrupar(pontos), tempoGer: anual.agrupar(tempoGer),
    ss: anual.agrupar(ss), ativs: anual.agruparAtividades(ativs)
  };
}

async function buscarDadosAnalista(a) {
  const sgd = a['codigo-sgd'], uid = a['i-usuarios'];
  const [revDef, revGer, pontosRaw, tempoGer, ss, ativs] = await Promise.all([
    qe.executar(queries.queryControleRevisoes(ANO, sgd)),
    qe.executar(queries.queryControleRevisoesPorGerador(ANO, uid)),
    qe.executar(queries.queryPontosDefinicao(ANO, sgd)),
    qe.executar(queries.queryTramitacoesPsai([sgd], 3, ANO)),
    qe.executar(queries.queryRespostasSS([uid], ANO)),
    qe.executar(queries.queryTempoAtividades([uid], ANO))
  ]);
  const pontosMerged = await mergePlanilhaPontos(pontosRaw, a);
  return {
    revCtrl: { def: anual.agruparControleRevisoes(revDef), ger: anual.agruparControleRevisoes(revGer) },
    pontos: anual.agrupar(pontosMerged), tempoGer: anual.agrupar(tempoGer),
    ss: anual.agrupar(ss), ativs: anual.agruparAtividades(ativs)
  };
}

function montarResposta(a, dados) {
  const metasJson = readMetasEquipe();
  const ids = metasDoAnalista(a, metasJson);
  const calc = anual.calcularMetas(a, dados, ids);
  return { slug: a.slug, nome: a.nome, senioridade: a.senioridade, ...calc };
}

async function buscarDetalhe(a, metaId, mes) {
  const sgd = a['codigo-sgd'], uid = a['i-usuarios'];
  const isEsp = a.senioridade === 'especialista';
  if (metaId.startsWith('indice-revisoes')) return qe.executar(detalhe.detalheRevisoes(sgd, ANO, mes, isEsp, metaId));
  if (metaId === 'pontos-definicao') return qe.executar(detalhe.detalhePontos(sgd, ANO, mes));
  if (metaId.startsWith('gerar-sai')) return qe.executar(detalhe.detalheTramitacoesPsai(sgd, ANO, mes));
  if (metaId.startsWith('tempo-trabalho')) return qe.executar(detalhe.detalheAtividades(uid, ANO, mes));
  if (metaId === 'respostas-ss-3d') return qe.executar(detalhe.detalheRespostasSS(uid, ANO, mes));
  return [];
}

module.exports = router;
