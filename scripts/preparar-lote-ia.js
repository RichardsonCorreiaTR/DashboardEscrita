/**
 * scripts/preparar-lote-ia.js - Gera lotes de entrada para classificacao IA (Escrita)
 *
 * Uso: node scripts/preparar-lote-ia.js <versao>
 * Ex:  node scripts/preparar-lote-ia.js 10.6A-06
 *
 * Coleta SAIs Escrita via ODBC, aplica Camada 1 (regras-auto) e gera
 * classificados-auto + lote-entrada com texto_spec inline.
 */
const fs = require('fs');
const path = require('path');
const { classificarAuto } = require('../src/estudos/laboratorio/regras-auto');
const coleta = require('./lib/coleta-sais-escrita');

const IA_DIR = path.join(__dirname, '..', 'data', 'ia');

function garantirDir() {
  if (!fs.existsSync(IA_DIR)) fs.mkdirSync(IA_DIR, { recursive: true });
}

function salvarArquivos(versao, auto, pendentes, total) {
  const autoPath = path.join(IA_DIR, `classificados-auto-${versao}.json`);
  fs.writeFileSync(autoPath, JSON.stringify({
    versao, gerado_em: new Date().toISOString(),
    total_auto: auto.length, itens: auto
  }, null, 2), 'utf-8');

  const lotePath = path.join(IA_DIR, `lote-entrada-${versao}.json`);
  fs.writeFileSync(lotePath, JSON.stringify({
    versao, gerado_em: new Date().toISOString(),
    produto: 'Escrita Fiscal',
    instrucoes: 'Classificar conforme data/ia/PROMPT-CLASSIFICACAO.md (usar texto_spec de cada item)',
    total_itens: pendentes.length, itens: pendentes
  }, null, 2), 'utf-8');

  console.log('[preparar] Resultado %s: total=%d auto=%d pendentes_IA=%d',
    versao, total, auto.length, pendentes.length);
  console.log('  %s', autoPath);
  console.log('  %s', lotePath);
  atualizarControle(versao, total, auto.length, pendentes.length);
}

function atualizarControle(versao, total, auto, pendentes) {
  const controlePath = path.join(IA_DIR, 'controle-enriquecimento.json');
  let controle = { versoes: {} };
  try {
    if (fs.existsSync(controlePath)) {
      controle = JSON.parse(fs.readFileSync(controlePath, 'utf-8'));
    }
  } catch { /* novo */ }

  controle.versoes[versao] = {
    total, auto, pendentes_ia: pendentes, classificados_ia: 0,
    status: pendentes === 0 ? 'completa' : 'pendente',
    preparado_em: new Date().toISOString()
  };
  controle.atualizado_em = new Date().toISOString();
  fs.writeFileSync(controlePath, JSON.stringify(controle, null, 2), 'utf-8');
}

async function processarVersao(versao) {
  garantirDir();
  console.log('[preparar] Coletando Escrita %s via ODBC...', versao);
  const itens = await coleta.coletarPorVersao(versao);
  console.log('[preparar] %d SAIs encontradas', itens.length);
  if (itens.length === 0) {
    console.log('[preparar] Nenhuma SAI para versao %s', versao);
    return;
  }

  const auto = [];
  const pendentes = [];
  for (const item of itens) {
    const classif = classificarAuto(item, item.tags);
    if (classif._completa) auto.push(classif);
    else pendentes.push(item);
  }
  salvarArquivos(versao, auto, pendentes, itens.length);
}

async function main() {
  const arg = process.argv[2];
  if (!arg || arg === '--todas') {
    console.error('Uso: node scripts/preparar-lote-ia.js <versao>');
    console.error('Ex:  node scripts/preparar-lote-ia.js 10.6A-06');
    if (arg === '--todas') console.error('--todas desabilitado no piloto Escrita.');
    process.exit(1);
  }
  try {
    await processarVersao(arg);
  } finally {
    await coleta.fechar();
  }
}

main().catch(err => {
  console.error('[preparar] ERRO:', err.message);
  coleta.fechar().finally(() => process.exit(1));
});
