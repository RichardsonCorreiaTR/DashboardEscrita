/**
 * index.js - Orquestrador completo do estudo PSAI/SAI v2
 *
 * Uso:
 *   node scripts/estudo-psai-sai/index.js                (tudo: coleta + detalhe + analise + excel)
 *   node scripts/estudo-psai-sai/index.js --skip-coleta   (analise + excel, usa cache)
 *   node scripts/estudo-psai-sai/index.js --so-excel      (so excel, usa cache da analise)
 *
 * Etapas:
 * 1. Coleta base (entradas, descartes, pendentes, datas)
 * 2. Coleta detalhe (PSAI individual, tempos, SAI, atividades)
 * 3. Coleta tempo analistas (registro atividades)
 * 4. Analise granular
 * 5. Geracao Excel
 */

const path = require('path');
const fs = require('fs');
const conexao = require('../../src/core/conexao');
const { executarColeta } = require('./coleta');
const { executarColetaTempo } = require('./coleta-tempo');
const { executarColetaDetalhe } = require('./coleta-detalhe');
const { executarAnalise } = require('./analise');
const { gerarExcel } = require('./excel');

const OUTPUT = path.join(__dirname, '..', '..', 'output');
const skip = process.argv.includes('--skip-coleta');
const soExcel = process.argv.includes('--so-excel');

async function main() {
  console.log('========================================');
  console.log(' ESTUDO PSAI/SAI v2 - Time NE Folha');
  console.log(' Nov/2025 a Mar/2026 (granular)');
  console.log('========================================\n');

  if (!skip && !soExcel) {
    const t = await conexao.testar();
    if (!t.ok) { console.error('Conexao falhou: %s', t.mensagem); process.exit(1); }
    console.log('Conexao OK (%dms)\n', t.tempo_ms);

    console.log('[1/5] Coleta base...');
    await executarColeta();
    console.log('\n[2/5] Coleta detalhe (PSAI por PSAI)...');
    await executarColetaDetalhe();
    console.log('\n[3/5] Coleta tempo analistas...');
    await executarColetaTempo();
  } else {
    console.log('[SKIP] Usando cache existente\n');
  }

  console.log('\n[4/5] Analise granular...');
  const analise = executarAnalise();

  if (!fs.existsSync(OUTPUT)) fs.mkdirSync(OUTPUT, { recursive: true });
  console.log('\n[5/5] Gerando Excel...');
  const arq = await gerarExcel(analise, OUTPUT);

  console.log('\n========================================');
  console.log(' CONCLUIDO - %s', arq);
  console.log('========================================');

  if (!skip && !soExcel) await conexao.fechar();
}

main().catch(async err => {
  console.error('Erro fatal:', err);
  try { await conexao.fechar(); } catch { /* */ }
  process.exit(1);
});
