/**
 * Pre-aquece o cache historico de Descartes para uma area (sem HTTP).
 * Uso: node scripts/warm-descartes-cache.js Importacao
 */
const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');
const descartes = require('../src/estudos/descartes-ne');

const AREA = process.argv[2] || 'Escrita';

async function main() {
  await conexao.inicializar();
  console.log('Pre-aquecendo Descartes para area:', AREA, '(pode levar alguns minutos)');
  const t0 = Date.now();
  const r = await descartes.calcularDescartes(qe, { area: AREA, forceAtual: true, forceTodas: false });
  const seg = Math.round((Date.now() - t0) / 1000);
  console.log(`OK: ${r.versoes.length} versoes de Descartes para ${AREA} em ${seg}s`);
  if (r.versoes.length) {
    const ult = r.versoes[r.versoes.length - 1];
    console.log('  ultima:', ult.versao, '| entradas=' + ult.entradas, '| %desc=' + ult.percentual);
  }
  await conexao.fechar();
}
main().catch(e => { console.error(e); process.exit(1); });
