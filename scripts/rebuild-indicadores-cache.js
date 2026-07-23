/**
 * rebuild-indicadores-cache.js - Recalcula e persiste cache de indicadores de produto
 *
 * Uso: node scripts/rebuild-indicadores-cache.js [versao-inicial] [versao-final]
 * Exemplo: node scripts/rebuild-indicadores-cache.js 10.6A-01 10.6A-07
 */
const path = require('path');
const conexao = require('../src/core/conexao');
const qe = require('../src/core/query-executor');
const cache = require('../src/core/cache');
const indicadores = require('../src/indicadores');

const IDS = ['saldo-ne', 'ne-95-dias', 'criticas-graves-5d', 'tempo-correcao-ne', 'entrada-ne'];

function listarVersoes(inicio, fim) {
  const m1 = inicio.match(/^10\.(\d+)A-(\d{2})$/);
  const m2 = fim.match(/^10\.(\d+)A-(\d{2})$/);
  if (!m1 || !m2) throw new Error('Versoes invalidas');
  const out = [];
  for (let mes = Number(m1[2]); mes <= Number(m2[2]); mes++) {
    out.push(`10.${m1[1]}A-${String(mes).padStart(2, '0')}`);
  }
  return out;
}

async function rebuildVersao(executor, nomeVersao) {
  const resultados = {};
  for (const id of IDS) {
    process.stdout.write(`  ${id}... `);
    resultados[id] = await indicadores.calcular(id, executor, { versao: nomeVersao, force: true });
    console.log(resultados[id].valor, resultados[id].status);
  }
  cache.salvarTodosNoDisco(nomeVersao, resultados);
}

async function main() {
  const inicio = process.argv[2] || '10.6A-01';
  const fim = process.argv[3] || '10.6A-07';
  const versoes = listarVersoes(inicio, fim);

  await conexao.inicializar();
  indicadores.inicializar();

  console.log(`\nRebuild cache: ${versoes.join(', ')}\n`);
  for (const v of versoes) {
    console.log(`--- ${v} ---`);
    await rebuildVersao(qe, v);
  }

  await conexao.fechar();
  const cacheFile = path.join(__dirname, '..', 'data', 'cache', 'indicadores.json');
  console.log(`\nConcluido. Cache em ${cacheFile}`);
}
main().catch(e => { console.error(e); process.exit(1); });
