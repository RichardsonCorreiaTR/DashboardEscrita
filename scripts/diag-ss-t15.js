const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');
const ss = require('../src/core/ss-respondidas-shared');

const GIOVANI = 5867;
const SS = 1088353;

async function main() {
  await conexao.inicializar();

  console.log('=== Timeline', SS, 'T11-18 ===');
  const t = await qe.executar(`
    SELECT st.i_ss_tramites, st.i_usuarios, st.entrada, st.data_resposta
    FROM bethadba.ss_tramites st
    WHERE st.i_ss = ${SS} AND st.i_ss_tramites BETWEEN 11 AND 18
    ORDER BY st.i_ss_tramites
  `);
  t.forEach(x => console.log(
    'T' + x.i_ss_tramites, 'u' + x.i_usuarios,
    String(x.entrada).slice(0, 19),
    '->', x.data_resposta ? String(x.data_resposta).slice(0, 19) : '-'
  ));

  console.log('\n=== Nova logica fev/2026 Giovani SS', SS, '===');
  const rows = await qe.executar(ss.querySsEnvolvimento([GIOVANI], 2026, 2));
  ss.mapearLinhas(rows).filter(r => r.i_ss === SS).forEach(r => {
    console.log('perg T' + r.i_ss_tramites, 'resp T' + r.i_ss_tramites_resp,
      'DU', r.dias_uteis, 'ent', String(r.entrada).slice(0, 10),
      'resp', String(r.data_resposta).slice(0, 10));
  });

  console.log('\n=== Giovani T14: quem responde T15? ===');
  const t15 = await qe.executar(`
    SELECT st.i_ss_tramites, st.i_usuarios, st.entrada
    FROM bethadba.ss_tramites st
    WHERE st.i_ss = ${SS} AND st.i_ss_tramites IN (14,15,16,17,18)
    ORDER BY st.i_ss_tramites
  `);
  t15.forEach(x => console.log('T' + x.i_ss_tramites, 'u' + x.i_usuarios, String(x.entrada).slice(0, 19)));

  await conexao.fechar();
}

main().catch(e => { console.error(e); process.exit(1); });
