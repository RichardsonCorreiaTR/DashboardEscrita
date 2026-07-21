const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

const SS_LIST = [1088353, 1124178];

function fmt(d) { return d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') : '-'; }

async function main() {
  await conexao.inicializar();

  console.log('=== Descricoes ss_situacoes ===');
  const sits = await qe.executar(`
    SELECT i_ss_situacoes, situacao_descricao FROM bethadba.ss_situacoes ORDER BY i_ss_situacoes
  `).catch(async () => await qe.executar(`
    SELECT i_ss_situacoes, descricao FROM bethadba.ss_situacoes ORDER BY i_ss_situacoes
  `).catch(e => { console.log('erro ss_situacoes:', e.message); return []; }));
  sits.forEach(s => console.log(
    (s.i_ss_situacoes) + ' = ' + (s.situacao_descricao || s.descricao)
  ));

  for (const ss of SS_LIST) {
    console.log('\n=== SS', ss, '- trâmites com situacao ===');
    const rows = await qe.executar(`
      SELECT st.i_ss_tramites, st.i_usuarios, st.situacao,
        st.tipo_encaminhamento, st.i_area, st.entrada, st.data_resposta
      FROM bethadba.ss_tramites st
      WHERE st.i_ss = ${ss}
      ORDER BY st.i_ss_tramites
    `).catch(e => { console.log('erro:', e.message); return []; });
    rows.forEach(r => console.log(
      'T' + String(r.i_ss_tramites).padEnd(3),
      'usr=' + String(r.i_usuarios).padEnd(8),
      'sit=' + String(r.situacao).padEnd(4),
      'tipoEnc=' + String(r.tipo_encaminhamento).padEnd(4),
      'area=' + String(r.i_area).padEnd(4),
      'ent=' + fmt(r.entrada),
      'resp=' + fmt(r.data_resposta)
    ));
  }

  await conexao.fechar();
}

main().catch(e => { console.error(e); process.exit(1); });
