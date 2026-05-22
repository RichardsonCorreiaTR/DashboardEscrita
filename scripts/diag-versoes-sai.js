const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();

  // Situacoes de versoes
  console.log('=== versoes_situacoes ===');
  try {
    const sit = await qe.executar(`SELECT i_situacoes, descricao FROM versoes_situacoes ORDER BY i_situacoes`);
    sit.forEach(r => console.log('  ', r.i_situacoes, '-', r.descricao));
  } catch(e) { console.log('  Erro:', e.message); }

  // SAI 98669 nas versoes
  console.log('\n=== SAI 98669 em sgd_versoes_sais ===');
  const vs = await qe.executar(`
    SELECT svs.i_versoes, svs.i_sai, svs.situacao, sv.descricao as versao_desc, sv.data_liberacao
    FROM sgd_versoes_sais svs
    JOIN sgd_versoes sv ON svs.i_versoes = sv.i_versoes
    WHERE svs.i_sai = 98669
    ORDER BY sv.data_liberacao
  `);
  console.log('Registros:', vs.length);
  vs.forEach(r => console.log(JSON.stringify(r)));

  // Verificar campos de sgd_versoes (campos de data e situacao)
  console.log('\n=== sgd_versoes para versoes de 2026 (situacao 16) ===');
  const v = await qe.executar(`
    SELECT sv.i_versoes, sv.descricao, sv.data_liberacao, sv.i_situacoes
    FROM sgd_versoes sv
    WHERE YEAR(sv.data_liberacao) = 2026 AND sv.i_situacoes = 16
    ORDER BY sv.data_liberacao
    LIMIT 5
  `);
  v.forEach(r => console.log(JSON.stringify(r)));

  // Distribuicao situacoes de sgd_versoes
  console.log('\n=== Distribuicao situacoes sgd_versoes (2026) ===');
  const dist = await qe.executar(`
    SELECT sv.i_situacoes, COUNT(*) as qtd
    FROM sgd_versoes sv
    WHERE YEAR(sv.data_liberacao) = 2026
    GROUP BY sv.i_situacoes
    ORDER BY qtd DESC
  `);
  dist.forEach(r => console.log('  sit', r.i_situacoes, ':', r.qtd));

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
