/**
 * coleta-detalhe.js - Coleta granular: PSAI por PSAI, tempos, SAI, atividades
 *
 * Busca dados individuais de cada PSAI/SAI do periodo para analise detalhada.
 */

const path = require('path');
const fs = require('fs');
const { executar } = require('../../src/core/query-executor');
const qd = require('./queries-detalhe');
const q = require('./queries');

const CACHE = path.join(__dirname, '..', '..', 'data', 'cache', 'estudo-psai-sai');
const salvar = (n, d) => {
  const f = path.join(CACHE, `${n}.json`);
  fs.writeFileSync(f, JSON.stringify(d, null, 2), 'utf-8');
  console.log('  Salvo: %s (%d registros)', n, Array.isArray(d) ? d.length : Object.keys(d).length);
};

function nomeAnalista(id) {
  if (id === null || id === undefined) return 'Nao atribuido';
  const e = q.EQUIPE.find(e => e.sgd === id || e.iu === id);
  return e ? e.nome : `Outro (${id})`;
}

async function coletarPsaiDetalhe() {
  console.log('\n--- PSAIs individuais (com descricao e responsavel) ---');
  const rows = await executar(qd.queryPsaiDetalhe());
  console.log('  Total PSAIs: %d', rows.length);
  for (const r of rows) r.analista_nome = nomeAnalista(r.analista_resp);
  salvar('psai-detalhe', rows);
  return rows;
}

async function coletarTemposPsai() {
  console.log('\n--- Tempos por PSAI (analise + definicao) ---');
  try {
    const rows = await executar(qd.queryTemposPsai());
    console.log('  Total registros psai_responsaveis: %d', rows.length);
    const comAnalise = rows.filter(r => r.tempo_analise > 0).length;
    const comDef = rows.filter(r => r.tempo_definicao > 0).length;
    console.log('  Com tempo_analise > 0: %d | Com tempo_definicao > 0: %d', comAnalise, comDef);
    salvar('tempos-psai', rows);
    return rows;
  } catch (err) {
    console.warn('  AVISO: psai_responsaveis falhou: %s', err.message);
    salvar('tempos-psai', []);
    return [];
  }
}

async function coletarSaiDetalhe() {
  console.log('\n--- SAIs detalhe (complexidade, definicao) ---');
  const rows = await executar(qd.querySaiDetalhe());
  console.log('  Total SAIs: %d', rows.length);
  const comPont = rows.filter(r => r.pontuacao > 0).length;
  console.log('  Com pontuacao: %d', comPont);
  salvar('sai-detalhe', rows);
  return rows;
}

async function coletarTempoDevSai() {
  console.log('\n--- Tempo dev por SAI (roteiro desenvolvimento) ---');
  const rows = await executar(qd.queryTempoDevSai());
  console.log('  SAIs com tempo dev: %d', rows.length);
  salvar('tempo-dev-sai', rows);
  return rows;
}

async function coletarAtividadesPorSai(psais) {
  const saiIds = [...new Set(psais.filter(p => p.i_sai > 0).map(p => p.i_sai))];
  console.log('\n--- Atividades vinculadas a %d SAIs ---', saiIds.length);
  if (saiIds.length === 0) { salvar('atividades-sai', []); return []; }

  const BATCH = 50;
  const todos = [];
  for (let i = 0; i < saiIds.length; i += BATCH) {
    const lote = saiIds.slice(i, i + BATCH);
    console.log('  Lote %d/%d (%d SAIs)...', Math.floor(i / BATCH) + 1, Math.ceil(saiIds.length / BATCH), lote.length);
    try {
      const rows = await executar(qd.queryAtividadesPorSai(lote));
      todos.push(...rows);
    } catch (err) {
      console.warn('  AVISO lote %d: %s', Math.floor(i / BATCH) + 1, err.message);
    }
  }
  console.log('  Total registros atividades: %d', todos.length);
  salvar('atividades-sai', todos);
  return todos;
}

async function coletarDescartes() {
  console.log('\n--- Descartes detalhados (com motivo e descricao) ---');
  const rows = await executar(qd.querySituacoesDescarte());
  console.log('  Total descartes: %d', rows.length);
  for (const r of rows) r.analista_nome = nomeAnalista(r.analista_resp);
  salvar('descartes-detalhe', rows);
  return rows;
}

async function executarColetaDetalhe() {
  console.log('=== COLETA DETALHADA (PSAI por PSAI, SAI por SAI) ===');
  const psais = await coletarPsaiDetalhe();
  const tempos = await coletarTemposPsai();
  const sais = await coletarSaiDetalhe();
  const tempoDev = await coletarTempoDevSai();
  const ativSai = await coletarAtividadesPorSai(psais);
  const descartes = await coletarDescartes();
  return { psais, tempos, sais, tempoDev, ativSai, descartes };
}

module.exports = { executarColetaDetalhe };
