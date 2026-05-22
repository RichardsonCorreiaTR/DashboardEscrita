const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();

  console.log('=== Revisoes SAI 98669 - TODOS os motivos ===');
  const r = await qe.executar(`
    SELECT sr.i_revisoes, sr.i_motivos, sr.entrada
    FROM bethadba.sai_revisoes sr
    WHERE sr.i_sai = 98669
    ORDER BY sr.entrada
  `);
  console.log('Total revisoes:', r.length);
  r.forEach(x => console.log('  revisao', x.i_revisoes, '| motivo', x.i_motivos, '| data', String(x.entrada || '').slice(0,10)));

  // Distribuicao de todos os motivos usados em revisoes
  console.log('\n=== Distribuicao de motivos em sai_revisoes (2026) ===');
  const dist = await qe.executar(`
    SELECT i_motivos, COUNT(*) as qtd
    FROM bethadba.sai_revisoes
    WHERE YEAR(entrada) >= 2025
    GROUP BY i_motivos
    ORDER BY qtd DESC
  `);
  dist.forEach(x => console.log('  motivo', x.i_motivos, ':', x.qtd));

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
