const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();

  // Motivos das revisoes da SAI 101668
  console.log('=== Revisoes SAI 101668 ===');
  const r = await qe.executar(`
    SELECT sr.i_revisoes, sr.i_motivos, sr.entrada,
      CAST(sm.descricao AS BINARY) as descricao_motivo
    FROM bethadba.sai_revisoes sr
    JOIN bethadba.sai_revisoes_motivos sm ON sr.i_motivos = sm.i_motivos
    WHERE sr.i_sai = 101668
    ORDER BY sr.entrada
  `);
  r.forEach(x => console.log('  revisao', x.i_revisoes, '| motivo', x.i_motivos, '|', String(x.descricao_motivo)));

  // Ver todos os motivos existentes
  console.log('\n=== Todos os motivos disponiveis ===');
  const m = await qe.executar(`SELECT i_motivos, CAST(descricao AS BINARY) as desc FROM bethadba.sai_revisoes_motivos ORDER BY i_motivos`);
  m.forEach(x => console.log('  id', x.i_motivos, '|', String(x.desc)));

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
