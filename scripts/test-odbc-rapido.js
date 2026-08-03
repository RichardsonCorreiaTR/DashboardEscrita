const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');
const saldoSal = require('../src/indicadores/produto/saldo-sal');

async function main() {
  await conexao.inicializar();
  const r = await saldoSal.calcular(qe, { versao: '10.6A-07', area: 'Escrita', force: true });
  console.log('saldo-sal:', r.valor, 'status:', r.status, r.validacao?.ok ? 'OK' : r.validacao?.problemas);
  await conexao.fechar();
}

main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
