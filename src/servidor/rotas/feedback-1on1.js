/**
 * rotas/feedback-1on1.js - API REST para controle de feedback 1:1
 *
 * Rotas:
 * - GET  /api/feedback-1on1/config              -> colaboradores por coordenador
 * - GET  /api/feedback-1on1/sessoes             -> lista (?ano=&coord=&colaborador=)
 * - GET  /api/feedback-1on1/sessoes/:id         -> uma sessao
 * - POST /api/feedback-1on1/sessoes             -> agendar nova sessao
 * - PUT  /api/feedback-1on1/sessoes/:id         -> atualizar dados
 * - DELETE /api/feedback-1on1/sessoes/:id       -> remover sessao
 * - GET  /api/feedback-1on1/resumo/:ano         -> resumo anual por colaborador
 */
const fs = require('fs');
const path = require('path');
const { Router } = require('express');
const storage = require('../../core/feedback-storage');

const EQUIP_PATH = path.join(__dirname, '..', '..', '..', 'config', 'equipe.json');
const router = Router();

function lerEquipe() {
  return JSON.parse(fs.readFileSync(EQUIP_PATH, 'utf8'));
}

function apenasCoord(req, res, next) {
  if (req.session && req.session.papel === 'coordenador') return next();
  return res.status(403).json({ erro: 'Acesso restrito ao coordenador' });
}

router.get('/feedback-1on1/config', (_req, res) => {
  const { analistas } = lerEquipe();
  const coordenadores = analistas
    .filter(a => a.papel === 'coordenador')
    .map(a => ({ slug: a.slug, nome: a.nome, apelido: a.apelido }));
  const colaboradores = analistas
    .filter(a => a.papel !== 'coordenador')
    .map(a => ({
      slug: a.slug, nome: a.nome, apelido: a.apelido,
      senioridade: a.senioridade,
      'coordenador-slug': a['coordenador-slug'] || null
    }));
  res.json({ coordenadores, colaboradores });
});

router.get('/feedback-1on1/sessoes', (req, res) => {
  const { ano, coord, colaborador } = req.query;
  const papel = req.session && req.session.papel;
  const slug = req.session && req.session.slug;
  const filtros = {};
  if (ano) filtros.ano = ano;
  if (coord) filtros.coordenador = coord;
  if (colaborador) filtros.colaborador = colaborador;
  if (papel !== 'coordenador' && slug) filtros.colaborador = slug;
  res.json({ sessoes: storage.listar(filtros) });
});

router.get('/feedback-1on1/sessoes/:id', (req, res) => {
  const sessao = storage.obter(req.params.id);
  if (!sessao) return res.status(404).json({ erro: 'Sessao nao encontrada' });
  const papel = req.session && req.session.papel;
  const slug = req.session && req.session.slug;
  if (papel !== 'coordenador' && sessao.colaborador_slug !== slug) {
    return res.status(403).json({ erro: 'Acesso negado' });
  }
  res.json(sessao);
});

router.post('/feedback-1on1/sessoes', apenasCoord, (req, res) => {
  const { data, colaborador_slug, coordenador_slug } = req.body || {};
  if (!data || !colaborador_slug || !coordenador_slug) {
    return res.status(400).json({ erro: 'Campos obrigatorios: data, colaborador_slug, coordenador_slug' });
  }
  const nova = storage.criar({ data, colaborador_slug, coordenador_slug });
  res.json({ ok: true, sessao: nova });
});

router.put('/feedback-1on1/sessoes/:id', (req, res) => {
  const sessao = storage.obter(req.params.id);
  if (!sessao) return res.status(404).json({ erro: 'Sessao nao encontrada' });
  const papel = req.session && req.session.papel;
  const slug = req.session && req.session.slug;
  const campos = {};
  if (papel === 'coordenador') {
    if (req.body.dados_coordenador) {
      campos.dados_coordenador = {
        ...sessao.dados_coordenador,
        ...req.body.dados_coordenador,
        preenchido_em: new Date().toISOString()
      };
    }
    if (req.body.dados_colaborador) {
      // Preservar preenchido_em original do colaborador ao coordenador salvar
      campos.dados_colaborador = {
        ...sessao.dados_colaborador,
        ...req.body.dados_colaborador,
        preenchido_em: sessao.dados_colaborador.preenchido_em
      };
    }
    if (req.body.status) campos.status = req.body.status;
    if (req.body.data) campos.data = req.body.data;
    if (req.body.horario !== undefined) campos.horario = req.body.horario;
    if (req.body.duracao !== undefined) campos.duracao = req.body.duracao;
    if (req.body.email_enviado !== undefined) campos.email_enviado = req.body.email_enviado;
  } else if (sessao.colaborador_slug === slug) {
    if (req.body.dados_colaborador) {
      campos.dados_colaborador = {
        ...sessao.dados_colaborador,
        ...req.body.dados_colaborador,
        preenchido_em: new Date().toISOString()
      };
    }
  } else {
    return res.status(403).json({ erro: 'Acesso negado' });
  }
  const atualizada = storage.atualizar(req.params.id, campos);
  res.json({ ok: true, sessao: atualizada });
});

router.delete('/feedback-1on1/sessoes/:id', apenasCoord, (req, res) => {
  const ok = storage.excluir(req.params.id);
  if (!ok) return res.status(404).json({ erro: 'Sessao nao encontrada' });
  res.json({ ok: true });
});

router.get('/feedback-1on1/resumo/:ano', (req, res) => {
  const papel = req.session && req.session.papel;
  const slug = req.session && req.session.slug;
  const filtros = papel !== 'coordenador' ? { colaborador: slug } : {};
  const resumo = storage.resumoAnual(req.params.ano, filtros);
  res.json({ ano: req.params.ano, ...resumo });
});

module.exports = router;
