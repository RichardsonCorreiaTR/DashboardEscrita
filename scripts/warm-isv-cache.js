/**
 * Pre-aquece o cache historico do ISV para uma area (sem HTTP).
 * Uso: node scripts/warm-isv-cache.js Importacao
 * Popula data/cache/estudos-historico.json com as versoes daquela area.
 */
const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');
const historica = require('../src/estudos/analise-historica-ne');

const AREA = process.argv[2] || 'Escrita';

async function main() {
  await conexao.inicializar();
  console.log('Pre-aquecendo ISV para area:', AREA, '(pode levar varios minutos)');
  const t0 = Date.now();
  const r = await historica.calcularHistorico(qe, { area: AREA, forceAtual: true, forceTodas: false });
  const seg = Math.round((Date.now() - t0) / 1000);
  console.log(`OK: ${r.versoes.length} versoes com ISV calculadas para ${AREA} em ${seg}s`);
  await conexao.fechar();
}

main().catch(e => { console.error(e); process.exit(1); });
