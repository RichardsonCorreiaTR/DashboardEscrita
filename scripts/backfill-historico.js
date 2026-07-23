/**
 * backfill-historico.js - Regrava historico JSONL com indicadores recalculados
 *
 * Arquiva historico.jsonl existente e grava um snapshot por versao/indicador.
 * Uso: node scripts/backfill-historico.js [versao-inicial] [versao-final]
 */
const fs = require('fs');
const path = require('path');
const conexao = require('../src/core/conexao');
const qe = require('../src/core/query-executor');
const indicadores = require('../src/indicadores');
const { registrar } = require('../src/historico/registrador');

const IDS = ['saldo-ne', 'ne-95-dias', 'criticas-graves-5d', 'tempo-correcao-ne', 'entrada-ne'];
const HIST = path.join(__dirname, '..', 'data', 'historico.jsonl');
const SNAPSHOT = 'backfill-externas-2026-07-22';

function listarVersoes(inicio, fim) {
  const m1 = inicio.match(/^10\.(\d+)A-(\d{2})$/);
  const m2 = fim.match(/^10\.(\d+)A-(\d{2})$/);
  const out = [];
  for (let mes = Number(m1[2]); mes <= Number(m2[2]); mes++) {
    out.push(`10.${m1[1]}A-${String(mes).padStart(2, '0')}`);
  }
  return out;
}

function arquivarHistorico() {
  if (!fs.existsSync(HIST)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = HIST.replace('.jsonl', `.pre-externas.${stamp}.jsonl`);
  fs.renameSync(HIST, dest);
  console.log(`Historico anterior arquivado: ${dest}`);
}

async function main() {
  const inicio = process.argv[2] || '10.6A-01';
  const fim = process.argv[3] || '10.6A-07';
  const versoes = listarVersoes(inicio, fim);

  arquivarHistorico();
  await conexao.inicializar();
  indicadores.inicializar();

  for (const v of versoes) {
    console.log(`--- ${v} ---`);
    for (const id of IDS) {
      const r = await indicadores.calcular(id, qe, { versao: v, force: true });
      registrar(id, r, { versao: v, snapshot: SNAPSHOT });
      console.log(`  ${id}: ${r.valor} (${r.status})`);
    }
  }

  await conexao.fechar();
  console.log(`\nHistorico gravado em ${HIST}`);
}
main().catch(e => { console.error(e); process.exit(1); });
