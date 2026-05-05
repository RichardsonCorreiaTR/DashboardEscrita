/**
 * coleta.js - Extrai dados de NEs (entradas, descartes, pendentes, definicao)
 *
 * Periodo: versoes 10.5A-11 a 10.6A-03 (Nov/2025 - Mar/2026)
 * Salva JSONs intermediarios em data/cache/estudo-psai-sai/
 */

const path = require('path');
const fs = require('fs');
const { executar } = require('../../src/core/query-executor');
const q = require('./queries');

const CACHE_DIR = path.join(__dirname, '..', '..', 'data', 'cache', 'estudo-psai-sai');

function salvar(nome, dados) {
  const arq = path.join(CACHE_DIR, `${nome}.json`);
  fs.writeFileSync(arq, JSON.stringify(dados, null, 2), 'utf-8');
  console.log('  Salvo: %s (%d bytes)', arq, fs.statSync(arq).size);
}

async function coletarDatasVersoes() {
  console.log('\n--- Datas das versoes ---');
  const datas = {};
  for (const v of q.VERSOES) {
    const [row] = await executar(q.queryDatasVersao(v));
    datas[v] = { inicio: row.inicio, fim: row.fim };
    console.log('  %s: %s a %s', v, row.inicio, row.fim);
  }
  salvar('datas-versoes', datas);
  return datas;
}

async function coletarEntradas() {
  console.log('\n--- Entradas NE por versao ---');
  const resultado = {};
  for (const v of q.VERSOES) {
    const rows = await executar(q.queryEntradas(v));
    resultado[v] = rows;
    const comSAI = rows.filter(r => r.i_sai > 0).length;
    const semSAI = rows.filter(r => r.i_sai === 0).length;
    console.log('  %s: %d entradas (%d com SAI, %d PSAI pura)', v, rows.length, comSAI, semSAI);
  }
  salvar('entradas', resultado);
  return resultado;
}

async function coletarDescartes() {
  console.log('\n--- Descartes NE por versao ---');
  const resultado = {};
  for (const v of q.VERSOES) {
    const rows = await executar(q.queryDescartes(v));
    resultado[v] = rows;
    console.log('  %s: %d descartes', v, rows.length);
  }
  salvar('descartes', resultado);
  return resultado;
}

async function coletarPendentes() {
  console.log('\n--- Saldo/Pendentes por versao ---');
  const resultado = {};
  for (const v of q.VERSOES) {
    const [row] = await executar(q.queryPendentes(v));
    resultado[v] = row;
    console.log('  %s: saldo=%d (psai_sem_sai=%d, sai_pendente=%d)',
      v, row.total_saldo, row.psai_sem_sai, row.sai_pendente);
  }
  salvar('pendentes', resultado);
  return resultado;
}

async function coletarDefinicao() {
  console.log('\n--- Definicao/Complexidade por versao ---');
  const resultado = {};
  for (const v of q.VERSOES) {
    const rows = await executar(q.queryDefinicaoFlag(v));
    const comDef = rows.filter(r => r.tem_definicao === 1).length;
    const semDef = rows.filter(r => r.tem_definicao === 0).length;
    resultado[v] = rows;
    console.log('  %s: %d SAIs (%d com definicao, %d sem)', v, rows.length, comDef, semDef);
  }
  salvar('definicao', resultado);
  return resultado;
}

async function executarColeta() {
  console.log('=== COLETA DE DADOS NE (Nov/2025 - Mar/2026) ===');
  const datas = await coletarDatasVersoes();
  const entradas = await coletarEntradas();
  const descartes = await coletarDescartes();
  const pendentes = await coletarPendentes();
  const definicao = await coletarDefinicao();
  return { datas, entradas, descartes, pendentes, definicao };
}

module.exports = { executarColeta };
