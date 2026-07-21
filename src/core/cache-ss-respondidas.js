/**
 * cache-ss-respondidas.js - Cache em disco por ano/mes (SS Respondidas)
 *
 * Arquivo: data/cache/ss-respondidas.json
 * Meses fechados permanecem em cache; mes aberto pode ser atualizado via force.
 */

const path = require('path');
const fs = require('fs');

const CACHE_DIR = path.join(__dirname, '..', '..', 'data', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'ss-respondidas.json');
const CACHE_LOGIC_VERSION = 7; // v7: par por situacao 6 (pergunta GP) -> 7 (resposta GP)

let disco = { _meta: { atualizado_em: null, versao_logica: CACHE_LOGIC_VERSION }, anos: {} };

function garantirDiretorio() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function gravar() {
  try {
    garantirDiretorio();
    fs.writeFileSync(CACHE_FILE, JSON.stringify(disco, null, 2), 'utf-8');
  } catch (err) {
    console.error('[cache-ss] Erro ao gravar:', err.message);
  }
}

function restaurar() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return;
    disco = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    if (!disco.anos) disco.anos = {};
    if (!disco._meta) disco._meta = { atualizado_em: null };
    if (disco._meta.versao_logica !== CACHE_LOGIC_VERSION) {
      console.log('[cache-ss] Logica alterada (v%s -> v%s), cache invalidado',
        disco._meta.versao_logica || '?', CACHE_LOGIC_VERSION);
      disco = { _meta: { atualizado_em: null, versao_logica: CACHE_LOGIC_VERSION }, anos: {} };
      gravar();
      return;
    }
    const n = Object.keys(disco.anos).length;
    console.log('[cache-ss] Restaurado (%d ano(s))', n);
  } catch (err) {
    console.error('[cache-ss] Erro ao restaurar:', err.message);
    disco = { _meta: { atualizado_em: null }, anos: {} };
  }
}

function salvarMes(ano, mes, registros) {
  const chave = String(ano);
  if (!disco.anos[chave]) disco.anos[chave] = { meses: {} };
  disco.anos[chave].meses[String(mes)] = {
    registros,
    atualizado_em: new Date().toISOString()
  };
  disco._meta.atualizado_em = new Date().toISOString();
  disco._meta.versao_logica = CACHE_LOGIC_VERSION;
  gravar();
}

function obterMes(ano, mes) {
  const bloco = disco.anos[String(ano)];
  return bloco && bloco.meses[String(mes)] ? bloco.meses[String(mes)].registros : null;
}

function temAno(ano) {
  const bloco = disco.anos[String(ano)];
  return !!(bloco && bloco.meses && Object.keys(bloco.meses).length);
}

function montarAno(ano) {
  const bloco = disco.anos[String(ano)];
  if (!bloco || !bloco.meses) return { registros: [], atualizado_em: null, meses: 0 };
  const registros = [];
  let atualizado_em = null;
  const meses = Object.keys(bloco.meses).sort((a, b) => a - b);
  meses.forEach(m => {
    const item = bloco.meses[m];
    if (item.registros) registros.push(...item.registros);
    if (!atualizado_em || item.atualizado_em > atualizado_em) atualizado_em = item.atualizado_em;
  });
  registros.sort((a, b) => a.i_ss - b.i_ss || a.i_ss_tramites - b.i_ss_tramites);
  const { recalcularRegistro } = require('./ss-respondidas-shared');
  registros.forEach(r => recalcularRegistro(r));
  return { registros, atualizado_em, meses: meses.length };
}

module.exports = { restaurar, salvarMes, obterMes, temAno, montarAno, ultimaAtualizacao: () => disco._meta.atualizado_em };
