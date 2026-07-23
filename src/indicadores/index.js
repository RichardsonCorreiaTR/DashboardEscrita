/**
 * indicadores/index.js - Registro central e orquestrador de indicadores
 *
 * Responsabilidades:
 * - Carregar dinamicamente todos os indicadores de produto/ e equipe/
 * - Fornecer uma interface unica para calcular qualquer indicador
 * - Integrar cache e validacao automaticamente
 *
 * Uso: const indicadores = require('./indicadores');
 *      const resultado = await indicadores.calcular('saldo-ne', opcoes);
 */

const fs = require('fs');
const path = require('path');

const cache = require('../core/cache');
const { validarResultado } = require('../core/validator');

/** Incrementar ao mudar estrutura de detalhes (ex.: nomeArea em Ambas). */
const CACHE_SCHEMA = 3;

/** @type {Map<string, Object>} Mapa de indicadores registrados */
const registro = new Map();

/**
 * Carrega indicadores de uma pasta
 * @param {string} pasta - Caminho da pasta de indicadores
 * @param {string} categoria - Categoria (produto/equipe)
 */
function carregarDePasta(pasta, categoria) {
  if (!fs.existsSync(pasta)) return;

  const arquivos = fs.readdirSync(pasta).filter(f => f.endsWith('.js'));

  for (const arquivo of arquivos) {
    try {
      const modulo = require(path.join(pasta, arquivo));

      if (!modulo.id || !modulo.calcular) {
        console.warn('[indicadores] %s ignorado: falta id ou calcular()', arquivo);
        continue;
      }

      registro.set(modulo.id, modulo);
      console.log('[indicadores] Carregado: %s (%s)', modulo.id, categoria);
    } catch (err) {
      console.error('[indicadores] Erro ao carregar %s: %s', arquivo, err.message);
    }
  }
}

/**
 * Inicializa o registro, carregando todos os indicadores
 */
function inicializar() {
  const basePath = __dirname;
  carregarDePasta(path.join(basePath, 'produto'), 'produto');
  carregarDePasta(path.join(basePath, 'equipe'), 'equipe');
  console.log('[indicadores] %d indicador(es) carregado(s)', registro.size);
}

/**
 * Calcula um indicador (com cache e validacao automatica)
 * @param {string} id - ID do indicador
 * @param {Object} executor - Query executor
 * @param {Object} [opcoes] - Opcoes (meta, versao, periodo, force, etc.)
 * @returns {Promise<Object>} Resultado validado
 */
async function calcular(id, executor, opcoes = {}) {
  const indicador = registro.get(id);
  if (!indicador) {
    throw new Error(`[indicadores] Indicador desconhecido: '${id}'`);
  }

  const area = opcoes.area || 'Escrita';
  const cacheKey = `indicador:${id}:s${CACHE_SCHEMA}:${JSON.stringify({ versao: opcoes.versao, area })}`;

  // Verificar cache memoria (pula se force=true)
  if (!opcoes.force) {
    const cacheado = cache.obter(cacheKey);
    if (cacheado) {
      console.log('[indicadores] %s (cache memoria, %s)', id, area);
      return cacheado;
    }
  }

  // Calcular via ODBC
  const resultado = await indicador.calcular(executor, opcoes);

  // Validar
  const validacao = validarResultado(id, resultado);
  if (!validacao.ok) {
    console.warn('[indicadores] %s: validacao falhou: %s', id, validacao.problemas.join('; '));
  }
  if (validacao.avisos.length > 0) {
    console.warn('[indicadores] %s: avisos: %s', id, validacao.avisos.join('; '));
  }

  // Cachear em memoria
  if (indicador.cacheTTL) {
    cache.definir(cacheKey, resultado, indicador.cacheTTL);
  }

  // Salvar em disco (fallback offline)
  const cacheV = cache.chaveVersaoArea(opcoes.versao, area);
  if (cacheV) {
    cache.salvarNoDisco(cacheV, id, resultado);
  }

  return resultado;
}

/**
 * Lista todos os indicadores registrados
 * @returns {Object[]} Lista com id, nome, categoria de cada indicador
 */
function listar() {
  return Array.from(registro.values()).map(ind => ({
    id: ind.id,
    nome: ind.nome,
    categoria: ind.categoria
  }));
}

/**
 * Obtem um indicador pelo ID (sem calcular)
 * @param {string} id - ID do indicador
 * @returns {Object|null}
 */
function obter(id) {
  return registro.get(id) || null;
}

module.exports = { inicializar, calcular, listar, obter };
