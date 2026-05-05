/**
 * Pool ODBC opcional para o banco SGSAI (SQL Anywhere 16).
 * Complementa PSAI/modulos/tramites conforme PBCVS Discovery (MAPA-COMPLETO-SGSAI.md).
 *
 * Em config/conexao.json defina o bloco "sgsai" com habilitado: true e credenciais.
 */

const path = require('path');
const fs = require('fs');
const { validarQuery } = require('./query-executor');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'config', 'conexao.json');

let pool = null;
let odbc = null;

function carregarBlocoSgsai() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return raw.sgsai || null;
  } catch {
    return null;
  }
}

function sgsaiHabilitadoNaConfig() {
  const s = carregarBlocoSgsai();
  return !!(s && s.habilitado && String(s.usuario || '').trim());
}

function montarConnStr(s) {
  return `DSN=${s.dsn};UID=${s.usuario};PWD=${s.senha}`;
}

async function obterPoolSgsai() {
  if (!sgsaiHabilitadoNaConfig()) return null;
  if (pool) return pool;

  const s = carregarBlocoSgsai();
  odbc = require('odbc');
  const toSec = Math.floor((s['timeout-conexao'] || 60000) / 1000);
  pool = await odbc.pool(montarConnStr(s), {
    connectionTimeout: toSec,
    loginTimeout: toSec
  });
  console.log('[conexao-sgsai] Pool inicializado (DSN: %s)', s.dsn);
  return pool;
}

/**
 * Executa SELECT no SGSAI. Retorna null se desabilitado ou falhar (log no caller).
 * @param {string} sql
 * @returns {Promise<Object[]|null>}
 */
async function executarSgsai(sql) {
  validarQuery(sql);
  const p = await obterPoolSgsai();
  if (!p) return null;
  const conn = await p.connect();
  try {
    return await conn.query(sql);
  } finally {
    try {
      await conn.close();
    } catch {
      /* ignore */
    }
  }
}

async function fecharPoolSgsai() {
  if (!pool) return;
  try {
    await pool.close();
  } catch {
    /* ignore */
  }
  pool = null;
}

module.exports = {
  sgsaiHabilitadoNaConfig,
  executarSgsai,
  fecharPoolSgsai
};
