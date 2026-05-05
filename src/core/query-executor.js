/**
 * query-executor.js - Executa queries SQL com tratamento de erro, retry e log
 *
 * Responsabilidade unica: receber uma query SQL, executar via pool ODBC,
 * e retornar os dados com tratamento robusto de erros.
 *
 * Regras:
 * - Nenhuma query deve conter SELECT *
 * - Campos BLOB/TEXT conhecidos geram AVISO (nao bloqueio)
 * - Timeout configuravel por query
 * - Retry automatico em caso de falha transiente
 *
 * Encoding: O banco usa charset iso_1 (ISO-8859-1/Latin-1). O driver ODBC
 * retorna bytes brutos que o Node.js interpreta como UTF-8 (corrompendo acentos).
 * Campos CAST(... AS BINARY) retornam ArrayBuffer, que decodificamos como latin1
 * automaticamente apos cada query (ver decodificarResultados).
 */

const path = require('path');
const fs = require('fs');

const conexao = require('./conexao');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config', 'conexao.json');
const CAMPOS_PROIBIDOS = carregarCamposProibidos();
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;

/**
 * Carrega a lista de campos BLOB proibidos da config
 * @returns {string[]} Lista de campos proibidos
 */
function carregarCamposProibidos() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw).restricoes['campos-blob-proibidos'] || [];
  } catch {
    return ['DESCRICAO', 'ANTECIPACOES', 'CORRECOES', 'situacao_descricao'];
  }
}

/**
 * Valida uma query SQL antes de executar
 * @param {string} sql - Query SQL
 * @throws {Error} Se a query violar restricoes
 */
function validarQuery(sql) {
  const sqlUpper = sql.toUpperCase().replace(/\s+/g, ' ');

  if (/SELECT\s+\*\s+FROM/i.test(sql)) {
    throw new Error(
      '[query-executor] SELECT * proibido - sempre listar colunas explicitamente'
    );
  }

  for (const campo of CAMPOS_PROIBIDOS) {
    const regex = new RegExp(`\\b${campo}\\b`, 'i');
    if (regex.test(sql) && !sql.includes('--allow-blob')) {
      console.warn(
        '[query-executor] AVISO: campo potencialmente pesado detectado: %s. ' +
        'Pode causar lentidao em tabelas com TEXT/BLOB.',
        campo
      );
    }
  }
}

/**
 * Decodifica valores ArrayBuffer (retornados por CAST AS BINARY) como latin1.
 * Converte in-place: ArrayBuffer -> string UTF-8 legivel.
 * Banco iso_1 -> bytes -> ArrayBuffer -> Buffer.toString('latin1') -> string correta.
 * @param {Object[]} rows - Registros retornados pela query
 * @returns {Object[]} Mesmos registros com ArrayBuffers convertidos
 */
function decodificarResultados(rows) {
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (row[key] instanceof ArrayBuffer) {
        row[key] = Buffer.from(row[key])
          .toString('latin1')
          .replace(/\0+$/g, '')
          .trim();
      }
    }
  }
  return rows;
}

/**
 * Espera um tempo antes de tentar novamente
 * @param {number} ms - Milissegundos
 * @returns {Promise<void>}
 */
function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executa uma query SQL com retry e tratamento de erro
 * @param {string} sql - Query SQL (deve listar colunas explicitamente)
 * @param {Object} [opcoes] - Opcoes de execucao
 * @param {number} [opcoes.timeout] - Timeout em ms (padrao: config)
 * @param {number} [opcoes.maxRetries] - Max tentativas (padrao: 2)
 * @returns {Promise<Object[]>} Array de registros
 * @throws {Error} Se falhar apos todas as tentativas
 */
async function executar(sql, opcoes = {}) {
  validarQuery(sql);

  const maxRetries = opcoes.maxRetries ?? MAX_RETRIES;
  let ultimoErro;

  for (let tentativa = 0; tentativa <= maxRetries; tentativa++) {
    if (tentativa > 0) {
      console.log('[query-executor] Retry %d/%d...', tentativa, maxRetries);
      await esperar(RETRY_DELAY_MS * tentativa);
    }

    let conn;
    try {
      const inicio = Date.now();
      conn = await conexao.obterConexao();
      const resultado = await conn.query(sql);
      decodificarResultados(resultado);
      const tempo = Date.now() - inicio;

      console.log(
        '[query-executor] OK (%d registros, %dms)',
        resultado.length,
        tempo
      );
      return resultado;
    } catch (err) {
      ultimoErro = err;
      console.error(
        '[query-executor] Erro (tentativa %d): %s',
        tentativa + 1,
        err.message
      );
      if (tentativa === 0) {
        try { await conexao.reconectar(); } catch { /* reconexao tentada */ }
      }
    } finally {
      if (conn) {
        try { await conn.close(); } catch { /* ignora erro ao fechar */ }
      }
    }
  }

  throw new Error(
    `[query-executor] Falha apos ${maxRetries + 1} tentativas: ${ultimoErro.message}`
  );
}

/**
 * Executa uma query com paginacao (para tabelas grandes)
 * @param {string} sqlBase - Query base SEM TOP/START AT
 * @param {Object} opcoes - Opcoes de paginacao
 * @param {number} opcoes.tamanhoPagina - Registros por pagina
 * @param {number} [opcoes.maxPaginas] - Limite de paginas (seguranca)
 * @returns {Promise<Object[]>} Todos os registros concatenados
 */
async function executarPaginado(sqlBase, opcoes) {
  const { tamanhoPagina = 5000, maxPaginas = 100 } = opcoes;
  const todos = [];

  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const offset = pagina * tamanhoPagina + 1;
    const sql = sqlBase.replace(
      /^SELECT/i,
      `SELECT TOP ${tamanhoPagina} START AT ${offset}`
    );

    const registros = await executar(sql);
    todos.push(...registros);

    if (registros.length < tamanhoPagina) break;
  }

  console.log('[query-executor] Paginado: %d registros totais', todos.length);
  return todos;
}

module.exports = { executar, executarPaginado, validarQuery };
