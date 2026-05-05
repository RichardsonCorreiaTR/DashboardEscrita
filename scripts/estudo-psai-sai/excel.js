/**
 * excel.js - Orquestrador do Excel v2 (granular)
 *
 * Abas:
 * 1. Resumo - Volume + definicao por versao + carga analista
 * 2. PSAIs Individuais - 1 linha por PSAI com tempos e descricao
 * 3. Impacto Definicao - Faixas de tempo_definicao vs conversao
 * 4. Tempo Analistas - Breakdown analise/definicao + atividades mensais
 * 5. Descartes - Detalhes com motivo e descricao
 */

const path = require('path');
const ExcelJS = require('exceljs');
const { criarAbaConclusoes } = require('./excel-conclusoes');
const { criarAbaResumo } = require('./excel-resumo');
const { criarAbaPsais } = require('./excel-psais');
const { criarAbaImpactoDefinicao, criarAbaDescartes } = require('./excel-dados');
const { criarAbaTempoAnalistas } = require('./excel-atividades');

async function gerarExcel(analise, outputDir) {
  console.log('\n=== GERACAO EXCEL v2 (GRANULAR) ===\n');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dashboard Diretrizes - Estudo PSAI/SAI v2';
  wb.created = new Date();

  console.log('  Aba 1: Conclusoes...');
  criarAbaConclusoes(wb, analise);

  console.log('  Aba 2: Resumo...');
  criarAbaResumo(wb, analise);

  console.log('  Aba 3: PSAIs Individuais (%d linhas)...', analise.nes.length);
  criarAbaPsais(wb, analise);

  console.log('  Aba 4: Impacto Definicao...');
  criarAbaImpactoDefinicao(wb, analise);

  console.log('  Aba 5: Tempo Analistas...');
  criarAbaTempoAnalistas(wb, analise);

  console.log('  Aba 6: Descartes (%d linhas)...', analise.descartes.length);
  criarAbaDescartes(wb, analise);

  const arquivo = path.join(outputDir, 'estudo-psai-sai.xlsx');
  await wb.xlsx.writeFile(arquivo);
  console.log('\n  Excel gerado: %s', arquivo);
  return arquivo;
}

module.exports = { gerarExcel };
