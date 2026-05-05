/**
 * versao.js - Gerenciamento de versoes do produto Piazza
 *
 * Usa funcoes PIAZZA.FG_GET_DATA_INICIO_VERSAO e FG_GET_DATA_FIM_VERSAO
 * para obter datas oficiais de cada versao via SQL.
 *
 * Convencao de nomes: 10.{anoBase}A-{mes:02d}
 * Ex: 2025 -> 10.5A-01..12, 2026 -> 10.6A-01..12
 *
 * anoBase = ano - 2020  (2025=5, 2026=6, 2027=7...)
 */

/** Cache de datas de versao (nao mudam durante a execucao) */
const cacheDatas = {};

/**
 * Constroi o nome da versao a partir de ano e mes
 * @param {number} ano - Ex: 2026
 * @param {number} mes - 1 a 12
 * @returns {string} Ex: '10.6A-02'
 */
function nomeDaVersao(ano, mes) {
  const base = ano - 2020;
  return `10.${base}A-${String(mes).padStart(2, '0')}`;
}

/**
 * Extrai ano e mes a partir do nome da versao
 * @param {string} nome - Ex: '10.6A-02'
 * @returns {{ano: number, mes: number, indice: number}|null}
 */
function parsearNomeVersao(nome) {
  const match = nome.match(/^10\.(\d+)A-(\d{2})$/);
  if (!match) return null;
  const base = parseInt(match[1], 10);
  const mes = parseInt(match[2], 10);
  return { ano: base + 2020, mes, indice: mes - 1 };
}

/**
 * Retorna o nome da versao anterior
 * @param {string} nome - Ex: '10.6A-02'
 * @returns {string|null} Ex: '10.6A-01'
 */
function versaoAnterior(nome) {
  const parsed = parsearNomeVersao(nome);
  if (!parsed) return null;
  if (parsed.mes === 1) return nomeDaVersao(parsed.ano - 1, 12);
  return nomeDaVersao(parsed.ano, parsed.mes - 1);
}

/**
 * Retorna o padrao SQL LIKE para arquivos de versao (antecipacoes).
 * Arquivos da versao 10.6A-02 sao: 10.6A-01.XX (sub-releases da anterior).
 * @param {string} nome - Ex: '10.6A-02'
 * @returns {string|null} Ex: '10.6A-01.%'
 */
function padraoArquivoVersao(nome) {
  const ant = versaoAnterior(nome);
  if (!ant) return null;
  return `${ant}.%`;
}

/**
 * Fragmento SQL: data de FIM da versao
 * @param {string} nome - Nome da versao
 * @returns {string} Fragmento SQL
 */
function sqlFimVersao(nome) {
  return `PIAZZA.FG_GET_DATA_FIM_VERSAO('${nome}', 1)`;
}

/**
 * Fragmento SQL: data de INICIO da versao
 * @param {string} nome - Nome da versao
 * @returns {string} Fragmento SQL
 */
function sqlInicioVersao(nome) {
  return `PIAZZA.FG_GET_DATA_INICIO_VERSAO('${nome}', 1)`;
}

/**
 * Busca as datas reais de uma versao no banco (com cache)
 * @param {Object} executor - Query executor
 * @param {string} nomeVersao - Ex: '10.6A-02'
 * @returns {Promise<{inicio: string, fim: string}|null>}
 */
async function obterDatas(executor, nomeVersao) {
  if (cacheDatas[nomeVersao]) return cacheDatas[nomeVersao];

  const result = await executor.executar(`
    SELECT
      PIAZZA.FG_GET_DATA_INICIO_VERSAO('${nomeVersao}', 1) as dt_inicio,
      PIAZZA.FG_GET_DATA_FIM_VERSAO('${nomeVersao}', 1) as dt_fim
  `);

  if (!result || result.length === 0) return null;

  const datas = { inicio: result[0].dt_inicio, fim: result[0].dt_fim };
  cacheDatas[nomeVersao] = datas;
  return datas;
}

/**
 * Detecta a versao corrente baseada na data de hoje
 * Tenta o mes atual e, se nao encaixar, tenta o mes anterior
 * @param {Object} executor - Query executor
 * @returns {Promise<string>} Nome da versao atual
 */
async function detectarVersaoAtual(executor) {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;

  const tentativas = [
    nomeDaVersao(ano, mes),
    nomeDaVersao(mes === 12 ? ano + 1 : ano, mes === 12 ? 1 : mes + 1),
    nomeDaVersao(mes === 1 ? ano - 1 : ano, mes === 1 ? 12 : mes - 1)
  ];

  for (const v of tentativas) {
    try {
      const datas = await obterDatas(executor, v);
      if (datas && hoje >= new Date(datas.inicio) && hoje <= new Date(datas.fim)) {
        return v;
      }
    } catch (err) { /* tenta a proxima */ }
  }

  return tentativas[0];
}

/** Limpa o cache (util para testes) */
function limparCache() {
  Object.keys(cacheDatas).forEach(k => delete cacheDatas[k]);
}

module.exports = {
  nomeDaVersao,
  parsearNomeVersao,
  versaoAnterior,
  padraoArquivoVersao,
  sqlFimVersao,
  sqlInicioVersao,
  obterDatas,
  detectarVersaoAtual,
  limparCache
};
