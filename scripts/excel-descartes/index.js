/**
 * Excel Descartes - Gera Excel completo da analise de Descartes (CsD/Repr/Presc)
 *
 * Uso: node scripts/excel-descartes/index.js
 */

const path = require('path');
const fs = require('fs');

const ExcelJS = require('exceljs');

const { calcularEstatisticas } = require('./utils');
const { criarAbaResumo } = require('./aba-resumo');
const { criarAbaDados } = require('./aba-dados');
const { criarAbaGraficos } = require('./aba-graficos');
const { criarAbaMetodologia } = require('./aba-metodologia');
const { criarAbaDetalhes } = require('./aba-detalhes');
const { injetarGraficos } = require('./ooxml');

const CACHE_FILE = path.join(__dirname, '..', '..', 'data', 'cache', 'estudos-descartes-ne.json');
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'analise-descartes-reprovada-prescrita.xlsx');

/** Carrega dados do cache de descartes */
function carregarDados() {
  if (!fs.existsSync(CACHE_FILE)) {
    console.error('Cache nao encontrado:', CACHE_FILE);
    console.error('Execute o dashboard primeiro: npm start');
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  const versoes = Object.values(raw.versoes)
    .filter(v => v && v.entradas > 0)
    .sort((a, b) => a.versao.localeCompare(b.versao));

  if (versoes.length === 0) {
    console.error('Nenhum dado de versao encontrado no cache');
    process.exit(1);
  }
  return { versoes, meta: raw._meta };
}

async function main() {
  console.log('=== Exportacao Excel: Analise de Descartes ===\n');

  const { versoes } = carregarDados();
  console.log('Versoes: %d (%s a %s)', versoes.length, versoes[0].versao, versoes[versoes.length - 1].versao);

  const stats = calcularEstatisticas(versoes);
  console.log('Estatisticas: media=%s%%, EWMA=%s%%', stats.media, stats.ewmaAtual);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dashboard Diretrizes - Escrita Fiscal';
  wb.created = new Date();
  wb.properties.date1904 = false;

  criarAbaResumo(wb, versoes, stats);
  criarAbaDados(wb, versoes, stats);
  const { chart1Start, chart1End, chart2Start, chart2End } = criarAbaGraficos(wb, versoes, stats);
  criarAbaMetodologia(wb, stats);
  criarAbaDetalhes(wb, versoes);

  console.log('Abas: Resumo, Dados, Graficos, Metodologia, Detalhes');

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const buffer = await wb.xlsx.writeBuffer();
  console.log('Injetando graficos nativos Excel (OOXML)...');
  const finalBuffer = await injetarGraficos(buffer, versoes.length, chart1Start, chart1End, chart2Start, chart2End);

  fs.writeFileSync(OUTPUT_FILE, finalBuffer);
  console.log('\nExcel gerado: %s (%s KB)', OUTPUT_FILE, Math.round(finalBuffer.length / 1024));
}

main().catch(err => { console.error('Erro:', err); process.exit(1); });
