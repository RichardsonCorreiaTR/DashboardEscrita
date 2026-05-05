/**
 * conexao.js - Gerencia a conexao ODBC com o banco Sybase ASA 9.0
 *
 * Responsabilidade unica: abrir, manter e fechar conexao ODBC.
 * Usa o DSN 'pbcvs9' configurado no sistema.
 *
 * Restricoes criticas do banco:
 * - NUNCA usar SELECT * em tabelas com campos TEXT/BLOB
 * - Campos perigosos: DESCRICAO, ANTECIPACOES, CORRECOES, situacao_descricao,
 *   comportamento, definicao, descricao_destaque, motivo_descricao
 */

const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config', 'conexao.json');

let odbc;
let pool = null;

/**
 * Carrega a configuracao de conexao do arquivo JSON
 * @returns {Object} Configuracao de conexao
 */
function carregarConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw).odbc;
}

/**
 * Monta a connection string ODBC a partir da config
 * @param {Object} config - Configuracao de conexao
 * @returns {string} Connection string
 */
function montarConnectionString(config) {
  return `DSN=${config.dsn};UID=${config.usuario};PWD=${config.senha}`;
}

/**
 * Inicializa o pool de conexoes ODBC
 * @returns {Promise<Object>} Pool de conexoes
 * @throws {Error} Se nao conseguir conectar
 */
async function inicializar() {
  if (pool) return pool;

  try {
    odbc = require('odbc');
  } catch (err) {
    throw new Error(
      'Pacote "odbc" nao encontrado. Execute: npm install\n' +
      'Detalhes: ' + err.message
    );
  }

  const config = carregarConfig();
  const connStr = montarConnectionString(config);

  try {
    pool = await odbc.pool(connStr, {
      connectionTimeout: Math.floor(config['timeout-conexao'] / 1000),
      loginTimeout: Math.floor(config['timeout-conexao'] / 1000)
    });
    console.log('[conexao] Pool ODBC inicializado com sucesso (DSN: %s)', config.dsn);
    return pool;
  } catch (err) {
    pool = null;
    throw new Error(
      `[conexao] Falha ao conectar no banco (DSN: ${config.dsn}): ${err.message}`
    );
  }
}

/**
 * Obtem uma conexao do pool (inicializa se necessario)
 * @returns {Promise<Object>} Conexao ODBC
 */
async function obterConexao() {
  if (!pool) await inicializar();
  return pool.connect();
}

/**
 * Testa a conexao executando um SELECT simples
 * @returns {Promise<{ok: boolean, mensagem: string, tempo_ms: number}>}
 */
async function testar() {
  const inicio = Date.now();
  try {
    const conn = await obterConexao();
    const resultado = await conn.query('SELECT 1 AS teste');
    await conn.close();
    const tempo = Date.now() - inicio;
    return { ok: true, mensagem: 'Conexao OK', tempo_ms: tempo };
  } catch (err) {
    const tempo = Date.now() - inicio;
    return { ok: false, mensagem: err.message, tempo_ms: tempo };
  }
}

/**
 * Fecha o pool de conexoes (chamado no shutdown)
 */
async function fechar() {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('[conexao] Pool ODBC fechado');
  }
}

/**
 * Recria o pool ODBC (usado quando conexoes ficam obsoletas)
 * @returns {Promise<Object>} Novo pool de conexoes
 */
async function reconectar() {
  console.log('[conexao] Recriando pool ODBC...');
  const antigo = pool;
  pool = null;
  if (antigo) {
    try { await antigo.close(); } catch { /* ignora erro ao fechar pool antigo */ }
  }
  return inicializar();
}

// Teste direto: node src/core/conexao.js --test
if (require.main === module && process.argv.includes('--test')) {
  (async () => {
    console.log('[conexao] Testando conexao ODBC...');
    const resultado = await testar();
    console.log('[conexao] Resultado:', JSON.stringify(resultado, null, 2));
    await fechar();
    process.exit(resultado.ok ? 0 : 1);
  })();
}

module.exports = { inicializar, obterConexao, testar, fechar, reconectar };
