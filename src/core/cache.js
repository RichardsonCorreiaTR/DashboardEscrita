/**
 * cache.js - Cache de performance em memoria + persistencia em disco
 *
 * Duas camadas:
 * 1. Memoria: evita reconsultar o banco (TTL configuravel, rapido)
 * 2. Disco: sobrevive a restart e serve como fallback quando ODBC cai
 *
 * Estrutura em disco: data/cache/indicadores.json
 * Formato: { "_meta": { atualizado_em }, "versao": { indicadorId: resultado } }
 */

const path = require('path');
const fs = require('fs');

const CACHE_DIR = path.join(__dirname, '..', '..', 'data', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'indicadores.json');

/** Chave de versao no disco/memoria por area (Escrita mantem chave original). */
function chaveVersaoArea(v, area = 'Escrita') {
  if (!v) return v;
  return area && area !== 'Escrita' ? `${v}@${area}` : v;
}

/** @type {Map<string, {valor: any, expira: number}>} */
const memoria = new Map();

/** Cache disco carregado em memoria (para leitura rapida) */
let disco = { _meta: { atualizado_em: null } };

/* ============== CACHE MEMORIA (TTL) ============== */

function obter(chave) {
  const entrada = memoria.get(chave);
  if (!entrada) return null;
  if (Date.now() > entrada.expira) { memoria.delete(chave); return null; }
  return entrada.valor;
}

function definir(chave, valor, ttlMs) {
  memoria.set(chave, { valor, expira: Date.now() + ttlMs });
}

function invalidar(chave) { return memoria.delete(chave); }
function limparTudo() { memoria.clear(); }

function estatisticas() {
  let ativas = 0, expiradas = 0;
  const agora = Date.now();
  for (const [, e] of memoria) {
    if (agora > e.expira) expiradas++; else ativas++;
  }
  return { total: memoria.size, ativas, expiradas };
}

/* ============== CACHE DISCO (FALLBACK) ============== */

function garantirDiretorio() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Salva resultado de um indicador no cache de disco
 * @param {string} versao - Nome da versao (ex: '10.6A-02')
 * @param {string} indicadorId - ID do indicador
 * @param {Object} resultado - Resultado completo do calcular()
 */
function salvarNoDisco(versao, indicadorId, resultado) {
  garantirDiretorio();
  if (!disco[versao]) disco[versao] = {};
  disco[versao][indicadorId] = resultado;
  disco._meta.atualizado_em = new Date().toISOString();

  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(disco, null, 2), 'utf-8');
  } catch (err) {
    console.error('[cache] Erro ao salvar disco:', err.message);
  }
}

/**
 * Salva todos os resultados de uma versao no disco de uma vez
 * @param {string} versao - Nome da versao
 * @param {Object} resultados - Mapa indicadorId -> resultado
 */
function salvarTodosNoDisco(versao, resultados) {
  garantirDiretorio();
  disco[versao] = { ...resultados };
  disco._meta.atualizado_em = new Date().toISOString();

  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(disco, null, 2), 'utf-8');
    console.log('[cache] Disco salvo (%s, %d indicadores)', versao, Object.keys(resultados).length);
  } catch (err) {
    console.error('[cache] Erro ao salvar disco:', err.message);
  }
}

/**
 * Obtem resultado do cache de disco
 * @param {string} versao - Nome da versao
 * @param {string} [indicadorId] - Se informado, retorna so esse indicador
 * @returns {Object|null} Resultado ou null
 */
function obterDoDisco(versao, indicadorId) {
  if (!disco[versao]) return null;
  if (indicadorId) return disco[versao][indicadorId] || null;
  return disco[versao];
}

/**
 * Retorna o timestamp da ultima atualizacao do cache de disco
 * @returns {string|null} ISO timestamp
 */
function ultimaAtualizacaoDisco() {
  return disco._meta.atualizado_em || null;
}

/**
 * Restaura o cache de disco na inicializacao
 */
function restaurarDoDisco() {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      console.log('[cache] Nenhum cache em disco encontrado');
      return;
    }
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    disco = JSON.parse(raw);
    if (!disco._meta) disco._meta = { atualizado_em: null };

    const versoes = Object.keys(disco).filter(k => k !== '_meta');
    console.log('[cache] Disco restaurado (%d versoes, atualizado em %s)',
      versoes.length, disco._meta.atualizado_em || 'desconhecido');
  } catch (err) {
    console.error('[cache] Erro ao restaurar disco:', err.message);
    disco = { _meta: { atualizado_em: null } };
  }
}

module.exports = {
  obter, definir, invalidar, limparTudo, estatisticas,
  salvarNoDisco, salvarTodosNoDisco, obterDoDisco,
  ultimaAtualizacaoDisco, restaurarDoDisco, chaveVersaoArea
};
