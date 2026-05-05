/**
 * scripts/coletar-rastreabilidade.js
 *
 * Coleta dados de rastreabilidade SA/NE via ODBC e salva no cache.
 * Executar antes de usar as views Mapa de Risco, Rastreabilidade e Backtest.
 *
 * Uso: node scripts/coletar-rastreabilidade.js
 */

const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');
const rastreabilidade = require('../src/estudos/laboratorio/rastreabilidade');

async function main() {
  console.log('[coleta] Iniciando coleta de rastreabilidade via ODBC...');
  const inicio = Date.now();

  try {
    await conexao.inicializar();
    const resultado = await rastreabilidade.coletar(qe);
    const duracao = ((Date.now() - inicio) / 1000).toFixed(1);
    console.log('[coleta] Finalizado em %ss', duracao);
    console.log('[coleta] %d NEs, %d SAs, %d versoes',
      resultado._meta.total_nes,
      resultado._meta.total_sas,
      resultado._meta.versoes
    );
  } catch (err) {
    console.error('[coleta] ERRO:', err.message);
    process.exit(1);
  }
  process.exit(0);
}

main();
