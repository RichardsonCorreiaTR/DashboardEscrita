const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');
const { diasUteisSybase } = require('../src/core/date-utils');

const GIOVANI = 5867;
const SS_LIST = [1080984, 1083353];

async function main() {
  await conexao.inicializar();
  for (const ss of SS_LIST) {
    console.log('\n=== SS', ss, '===');
    const rows = await qe.executar(`
      SELECT st.i_ss_tramites, st.i_usuarios, st.entrada, st.data_resposta
      FROM bethadba.ss_tramites st
      WHERE st.i_ss = ${ss}
      ORDER BY st.i_ss_tramites
    `);
    rows.forEach(r => {
      console.log(
        'T' + r.i_ss_tramites,
        'usr=' + r.i_usuarios,
        'ent=' + (r.entrada ? new Date(r.entrada).toISOString().slice(0, 16) : '-'),
        'resp=' + (r.data_resposta ? new Date(r.data_resposta).toISOString().slice(0, 16) : '-')
      );
    });
  }

  console.log('\n=== Nova logica v2 (autor resposta + pergunta anterior outro usuario) ===');
  const q2 = `
    SELECT st.i_ss,
      (SELECT MAX(prev.i_ss_tramites) FROM bethadba.ss_tramites prev
       WHERE prev.i_ss = st.i_ss AND prev.entrada < st.entrada
         AND prev.i_usuarios <> st.i_usuarios) as i_ss_tramites,
      st.i_ss_tramites as i_ss_tramites_resp,
      st.i_usuarios,
      (SELECT MAX(prev.entrada) FROM bethadba.ss_tramites prev
       WHERE prev.i_ss = st.i_ss AND prev.entrada < st.entrada
         AND prev.i_usuarios <> st.i_usuarios) as entrada_inicio,
      st.entrada as data_resposta
    FROM bethadba.ss_tramites st
    JOIN bethadba.ss s ON st.i_ss = s.i_ss
    WHERE st.i_usuarios = ${GIOVANI}
      AND YEAR(st.entrada) = 2026 AND MONTH(st.entrada) = 2
      AND COALESCE(s.i_produto_grupo, 1) = 1
      AND (SELECT MAX(prev.entrada) FROM bethadba.ss_tramites prev
           WHERE prev.i_ss = st.i_ss AND prev.entrada < st.entrada
             AND prev.i_usuarios <> st.i_usuarios) IS NOT NULL
    ORDER BY st.i_ss, st.i_ss_tramites
  `;
  const calc2 = await qe.executar(q2);
  calc2.forEach(r => {
    const du = diasUteisSybase(r.entrada_inicio, r.data_resposta);
    console.log(
      'SS', r.i_ss, 'perg T' + r.i_ss_tramites, 'resp T' + r.i_ss_tramites_resp,
      'inicio=' + new Date(r.entrada_inicio).toISOString().slice(0, 10),
      'resp=' + new Date(r.data_resposta).toISOString().slice(0, 10),
      'D.U.=' + du
    );
  });

  console.log('\n=== Giovani fev/2026 (data_resposta) ===');
  const fev = await qe.executar(`
    SELECT st.i_ss, st.i_ss_tramites, st.i_usuarios, st.entrada, st.data_resposta
    FROM bethadba.ss_tramites st
    JOIN bethadba.ss s ON st.i_ss = s.i_ss
    WHERE st.i_usuarios = ${GIOVANI} AND st.data_resposta IS NOT NULL
      AND YEAR(st.data_resposta) = 2026 AND MONTH(st.data_resposta) = 2
      AND COALESCE(s.i_produto_grupo, 1) = 1
    ORDER BY st.i_ss, st.i_ss_tramites
  `);
  fev.forEach(r => console.log('SS', r.i_ss, 'T' + r.i_ss_tramites, r.entrada, r.data_resposta));

  console.log('\n=== Giovani fev/2026 (só entrada, sem data_resposta) ===');
  const fev2 = await qe.executar(`
    SELECT st.i_ss, st.i_ss_tramites, st.entrada, st.data_resposta
    FROM bethadba.ss_tramites st
    JOIN bethadba.ss s ON st.i_ss = s.i_ss
    WHERE st.i_usuarios = ${GIOVANI} AND st.data_resposta IS NULL
      AND YEAR(st.entrada) = 2026 AND MONTH(st.entrada) = 2
      AND COALESCE(s.i_produto_grupo, 1) = 1
    ORDER BY st.i_ss, st.i_ss_tramites
  `);
  fev2.forEach(r => console.log('SS', r.i_ss, 'T' + r.i_ss_tramites, r.entrada));

  await conexao.fechar();
}

main().catch(e => { console.error(e); process.exit(1); });
