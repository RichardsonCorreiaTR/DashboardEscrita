/**
 * index.js - Orquestrador do estudo de produtividade NE Q1
 *
 * Gera output/estudo-produtividade-ne-q1.xlsx com 7 abas:
 * 1. Resumo Executivo  2. Entradas  3. Descartes  4. Tempo Analise
 * 5. Time  6. Produtividade  7. Metodologia
 */

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const conexao = require('../../src/core/conexao');
const executor = require('../../src/core/query-executor');
const { coletarTudo } = require('./coleta');
const { agregarPorAno, calcularVariacoes } = require('./agregar');
const { criarAbaResumo } = require('./aba-resumo');
const { criarAbaEntradas } = require('./aba-entradas');
const { criarAbaDescartes } = require('./aba-descartes');
const { criarAbaTempos } = require('./aba-tempos');
const { criarAbaTime } = require('./aba-time');
const { criarAbaProdutividade } = require('./aba-produtividade');
const { criarAbaMetodologia } = require('./aba-metodologia');

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'estudo-produtividade-ne-q1.xlsx');

async function main() {
  console.log('=== Estudo de Produtividade NE - Q1 2024/2025/2026 ===\n');

  await conexao.inicializar();
  const coleta = await coletarTudo(sql => executor.executar(sql));
  await conexao.fechar();

  console.log('\nAgregando por ano...');
  const agregados = agregarPorAno(coleta);
  const variacoes = calcularVariacoes(agregados);

  console.log('Variacoes 2024→2026:');
  console.log('  Pessoas: %s%', variacoes.varPessoas);
  console.log('  NEs/pessoa: %s%', variacoes.varNEsPessoa);
  console.log('  Horas/pessoa: %s%', variacoes.varHorasPessoa);
  console.log('  SAIs/pessoa: %s%', variacoes.varSaiPessoa);
  console.log('  Indice composto: %s%', variacoes.indiceProdutividade);

  const dataExtracao = new Date().toISOString().substring(0, 10);
  console.log('\nGerando Excel...');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dashboard Diretrizes - Escrita Fiscal';
  wb.created = new Date();

  criarAbaResumo(wb, agregados, variacoes, dataExtracao);
  criarAbaEntradas(wb, coleta, agregados);
  criarAbaDescartes(wb, coleta, agregados);
  criarAbaTempos(wb, coleta, agregados);
  criarAbaTime(wb, coleta, agregados);
  criarAbaProdutividade(wb, agregados, variacoes);
  criarAbaMetodologia(wb);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  await wb.xlsx.writeFile(OUTPUT_FILE);

  console.log('\nExcel salvo em: %s', OUTPUT_FILE);
  console.log('Abas: Resumo Executivo, Entradas, Descartes, Tempo Analise, Time, Produtividade, Metodologia');
}

main().catch(e => { console.error('ERRO FATAL:', e); process.exit(1); });
