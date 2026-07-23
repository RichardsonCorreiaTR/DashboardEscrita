/**
 * Valida que cache de memoria separa area Escrita vs Importacao.
 */
const cache = require('../src/core/cache');
const conexao = require('../src/core/conexao');
const qe = require('../src/core/query-executor');
const indicadores = require('../src/indicadores');

async function main() {
  cache.limparTudo();
  await conexao.inicializar();
  indicadores.inicializar();

  const versao = '10.6A-01';
  const esc = await indicadores.calcular('saldo-ne', qe, { versao, area: 'Escrita', force: true });
  const imp = await indicadores.calcular('saldo-ne', qe, { versao, area: 'Importacao', force: true });
  const impCache = await indicadores.calcular('saldo-ne', qe, { versao, area: 'Importacao' });

  console.log('Escrita (ODBC):', esc.valor);
  console.log('Importacao (ODBC):', imp.valor);
  console.log('Importacao (memoria):', impCache.valor);

  if (esc.valor === imp.valor) {
    console.warn('AVISO: ODBC retornou mesmo saldo para ambas areas (pode ser coincidencia)');
  }
  if (impCache.valor !== imp.valor) {
    throw new Error(`Cache incorreto: esperado ${imp.valor}, obteve ${impCache.valor}`);
  }
  console.log('OK: cache por area funcionando');

  await conexao.fechar();
}

main().catch((e) => { console.error(e); process.exit(1); });
