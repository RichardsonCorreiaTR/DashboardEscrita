/**
 * feedback-storage.js - Persistencia de sessoes de feedback 1:1
 * Armazena em data/feedback-1on1.json (append-friendly, facil backup)
 */
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'feedback-1on1.json');

function lerDados() {
  try {
    if (!fs.existsSync(DATA_PATH)) return { sessoes: [] };
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch { return { sessoes: [] }; }
}

function salvar(dados) {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(dados, null, 2), 'utf8');
}

function listar(filtros = {}) {
  const { sessoes } = lerDados();
  return sessoes.filter(s => {
    if (filtros.coordenador && s.coordenador_slug !== filtros.coordenador) return false;
    if (filtros.colaborador && s.colaborador_slug !== filtros.colaborador) return false;
    if (filtros.ano && !s.data.startsWith(String(filtros.ano))) return false;
    return true;
  });
}

function obter(id) {
  return lerDados().sessoes.find(s => s.id === id) || null;
}

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function dadosColabVazio() {
  return { pontos_positivos: '', pontos_melhora: '', comentarios: '', preenchido_em: null };
}

function dadosCoordVazio() {
  return { pontos_positivos: '', pontos_melhora: '', acoes: '', preenchido_em: null };
}

function criar(campos) {
  const dados = lerDados();
  const nova = {
    id: gerarId(),
    criado_em: new Date().toISOString(),
    status: 'agendado',
    email_enviado: false,
    dados_colaborador: dadosColabVazio(),
    dados_coordenador: dadosCoordVazio(),
    ...campos
  };
  dados.sessoes.push(nova);
  salvar(dados);
  return nova;
}

function atualizar(id, campos) {
  const dados = lerDados();
  const idx = dados.sessoes.findIndex(s => s.id === id);
  if (idx < 0) return null;
  dados.sessoes[idx] = { ...dados.sessoes[idx], ...campos };
  salvar(dados);
  return dados.sessoes[idx];
}

function excluir(id) {
  const dados = lerDados();
  const idx = dados.sessoes.findIndex(s => s.id === id);
  if (idx < 0) return false;
  dados.sessoes.splice(idx, 1);
  salvar(dados);
  return true;
}

function resumoAnual(ano, filtros = {}) {
  const sessoes = listar({ ...filtros, ano });
  const realizadas = sessoes.filter(s => s.status === 'realizado');
  const porColab = {};
  realizadas.forEach(s => {
    if (!porColab[s.colaborador_slug]) {
      porColab[s.colaborador_slug] = { total: 0, positivos: [], melhorias: [], acoes: [] };
    }
    const c = porColab[s.colaborador_slug];
    c.total++;
    if (s.dados_colaborador.pontos_positivos) c.positivos.push(s.dados_colaborador.pontos_positivos);
    if (s.dados_colaborador.pontos_melhora) c.melhorias.push(s.dados_colaborador.pontos_melhora);
    if (s.dados_coordenador.acoes) c.acoes.push(s.dados_coordenador.acoes);
  });
  return { total_sessoes: sessoes.length, realizadas: realizadas.length, por_colaborador: porColab };
}

module.exports = { listar, obter, criar, atualizar, excluir, resumoAnual };
