/**
 * registrador.js - Persiste indicadores calculados em formato JSONL (append-only)
 *
 * O historico e a MEMORIA do projeto. Cada vez que um indicador e calculado,
 * o resultado e adicionado ao arquivo historico.jsonl.
 *
 * Formato: uma linha JSON por registro, NUNCA sobrescreve, NUNCA deleta.
 * Isso permite rastrear a evolucao de qualquer indicador ao longo do tempo.
 */

const fs = require('fs');
const path = require('path');

const { agora } = require('../core/date-utils');

const HISTORICO_PATH = path.join(__dirname, '..', '..', 'data', 'historico.jsonl');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

/**
 * Garante que o diretorio data/ existe
 */
function garantirDiretorio() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Registra o resultado de um indicador no historico
 * @param {string} indicadorId - ID do indicador
 * @param {Object} resultado - Resultado do calcular()
 * @param {Object} [contexto] - Contexto adicional (versao, periodo, etc.)
 */
function registrar(indicadorId, resultado, contexto = {}) {
  garantirDiretorio();

  const registro = {
    ts: agora(),
    indicador: indicadorId,
    valor: resultado.valor,
    meta: resultado.meta,
    pct: resultado.pct,
    status: resultado.status,
    validacao_ok: resultado.validacao ? resultado.validacao.ok : null,
    registros_lidos: resultado.validacao ? resultado.validacao.registros_lidos : null,
    ...contexto
  };

  const linha = JSON.stringify(registro) + '\n';

  try {
    fs.appendFileSync(HISTORICO_PATH, linha, 'utf-8');
  } catch (err) {
    console.error('[registrador] Erro ao salvar historico:', err.message);
    throw err;
  }
}

/**
 * Le todos os registros do historico
 * @returns {Object[]} Array de registros
 */
function lerTodos() {
  if (!fs.existsSync(HISTORICO_PATH)) return [];

  const conteudo = fs.readFileSync(HISTORICO_PATH, 'utf-8');
  return conteudo
    .split('\n')
    .filter(linha => linha.trim())
    .map(linha => {
      try {
        return JSON.parse(linha);
      } catch {
        console.warn('[registrador] Linha invalida ignorada');
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Filtra registros do historico por indicador
 * @param {string} indicadorId - ID do indicador
 * @returns {Object[]} Registros filtrados, ordenados por data
 */
function filtrarPorIndicador(indicadorId) {
  return lerTodos()
    .filter(r => r.indicador === indicadorId)
    .sort((a, b) => new Date(a.ts) - new Date(b.ts));
}

/**
 * Retorna o ultimo registro de cada indicador
 * @returns {Object} Mapa indicadorId -> ultimo registro
 */
function ultimosRegistros() {
  const todos = lerTodos();
  const mapa = {};

  for (const r of todos) {
    if (!mapa[r.indicador] || new Date(r.ts) > new Date(mapa[r.indicador].ts)) {
      mapa[r.indicador] = r;
    }
  }

  return mapa;
}

/**
 * Retorna estatisticas do arquivo de historico
 * @returns {{total_registros: number, indicadores: string[], tamanho_kb: number}}
 */
function estatisticas() {
  const todos = lerTodos();
  const indicadores = [...new Set(todos.map(r => r.indicador))];

  let tamanhoKb = 0;
  try {
    const stats = fs.statSync(HISTORICO_PATH);
    tamanhoKb = Math.round(stats.size / 1024);
  } catch { /* arquivo pode nao existir */ }

  return {
    total_registros: todos.length,
    indicadores,
    tamanho_kb: tamanhoKb
  };
}

module.exports = {
  registrar,
  lerTodos,
  filtrarPorIndicador,
  ultimosRegistros,
  estatisticas
};
