const qe = require('../src/core/query-executor');
const saldo = require('../src/indicadores/produto/saldo-sal');

async function main() {
  const r = await saldo.calcular(qe, { versao: '10.6A-07', area: 'Escrita', force: true });
  const mov = r.detalhes.movimentacao || {};
  const ids = [...(mov.entradas || []), ...(mov.pendentes || [])].map(x => x.i_psai);
  console.log('Saldo SAL Escrita:', r.valor, 'meta', r.meta);
  console.log('PSAI 125088 incluida?', ids.includes(125088) ? 'SIM (erro)' : 'NAO (ok)');

  const check = await qe.executar(`
    SELECT sp.i_psai FROM UP.SAI_PSAI sp
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE sp.i_psai = 125088 AND sp.tipoSAI = 'SAL'
      AND COALESCE(sp.ne_prevencao, 0) = 1
  `);
  console.log('125088 ne_prevencao=1:', check.length > 0 ? 'confirmado' : 'nao encontrada');
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
