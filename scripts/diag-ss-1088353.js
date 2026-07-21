const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');
const { diasUteisSybase } = require('../src/core/date-utils');
const shared = require('../src/core/ss-respondidas-shared');

const GIOVANI = 5867;
const SS = Number(process.argv[2]) || 1088353;

function fmt(d) { return d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') : '-'; }

async function main() {
  await conexao.inicializar();

  console.log('=== Trâmites brutos SS', SS, '===');
  const rows = await qe.executar(`
    SELECT st.i_ss_tramites, st.i_usuarios, st.entrada, st.data_resposta
    FROM bethadba.ss_tramites st
    WHERE st.i_ss = ${SS}
    ORDER BY st.i_ss_tramites
  `);
  rows.forEach(r => console.log(
    'T' + String(r.i_ss_tramites).padEnd(3),
    'usr=' + String(r.i_usuarios).padEnd(8),
    'entrada=' + fmt(r.entrada).padEnd(18),
    'data_resposta=' + fmt(r.data_resposta)
  ));

  console.log('\n=== O que a query da pagina retorna (Giovani, ano 2026) ===');
  const q = shared.querySsEnvolvimento([GIOVANI], 2026, null);
  const raw = await qe.executar(q);
  raw.filter(r => r.i_ss === SS).forEach(r => console.log(
    'perg T' + r.i_ss_tramites, 'resp T' + r.i_ss_tramites_resp,
    'entrada=' + fmt(r.entrada), 'resposta=' + fmt(r.data_resposta)
  ));

  console.log('\n=== Apos mapearLinhas (colapso atual) ===');
  const linhas = shared.mapearLinhas(raw.filter(r => r.i_ss === SS));
  linhas.forEach(r => console.log(
    'T' + r.i_ss_tramites, 'entrada=' + fmt(r.entrada),
    'resposta=' + fmt(r.data_resposta), 'D.U.=' + r.dias_uteis
  ));

  await conexao.fechar();
}

main().catch(e => { console.error(e); process.exit(1); });
