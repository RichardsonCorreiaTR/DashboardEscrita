/**
 * consulta.js - Consulta e analise do historico de indicadores
 *
 * Permite consultar o historico persistido (JSONL) para:
 * - Comparar periodos (ontem vs hoje, semana vs semana)
 * - Identificar tendencias (subindo, descendo, estavel)
 * - Responder "qual era o valor de X no dia Y?"
 */

const { filtrarPorIndicador, lerTodos } = require('./registrador');
const { parsearData } = require('../core/date-utils');

/**
 * Busca registros de um indicador dentro de um periodo
 * @param {string} indicadorId - ID do indicador
 * @param {Date|string} inicio - Data inicio
 * @param {Date|string} fim - Data fim
 * @returns {Object[]} Registros no periodo
 */
function buscarPorPeriodo(indicadorId, inicio, fim) {
  const dataInicio = parsearData(inicio);
  const dataFim = parsearData(fim);

  if (!dataInicio || !dataFim) return [];

  return filtrarPorIndicador(indicadorId).filter(r => {
    const ts = parsearData(r.ts);
    return ts && ts >= dataInicio && ts <= dataFim;
  });
}

/**
 * Compara o valor mais recente com o anterior de um indicador
 * @param {string} indicadorId - ID do indicador
 * @returns {{atual: Object|null, anterior: Object|null, variacao: number|null}}
 */
function compararComAnterior(indicadorId) {
  const registros = filtrarPorIndicador(indicadorId);

  if (registros.length < 1) {
    return { atual: null, anterior: null, variacao: null };
  }

  const atual = registros[registros.length - 1];
  const anterior = registros.length >= 2 ? registros[registros.length - 2] : null;

  let variacao = null;
  if (anterior && anterior.valor !== null && atual.valor !== null) {
    variacao = atual.valor - anterior.valor;
  }

  return { atual, anterior, variacao };
}

/**
 * Identifica a tendencia de um indicador (ultimos N registros)
 * @param {string} indicadorId - ID do indicador
 * @param {number} [n=5] - Quantos registros considerar
 * @returns {'subindo'|'descendo'|'estavel'|'insuficiente'}
 */
function tendencia(indicadorId, n = 5) {
  const registros = filtrarPorIndicador(indicadorId);

  if (registros.length < 3) return 'insuficiente';

  const ultimos = registros.slice(-n);
  const valores = ultimos.map(r => r.valor).filter(v => v !== null);

  if (valores.length < 3) return 'insuficiente';

  let subindo = 0;
  let descendo = 0;

  for (let i = 1; i < valores.length; i++) {
    if (valores[i] > valores[i - 1]) subindo++;
    if (valores[i] < valores[i - 1]) descendo++;
  }

  if (subindo > descendo) return 'subindo';
  if (descendo > subindo) return 'descendo';
  return 'estavel';
}

module.exports = { buscarPorPeriodo, compararComAnterior, tendencia };
