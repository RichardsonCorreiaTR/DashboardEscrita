const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();

  // Verificar situacoes de tramites da PSAI (pode ter situacao 'Liberada')
  console.log('=== Situacoes em bethadba.psai_tramites_situacoes ===');
  try {
    const sit = await qe.executar(`
      SELECT i_situacoes, descricao FROM bethadba.psai_tramites_situacoes ORDER BY i_situacoes
    `);
    sit.forEach(r => console.log('  ', r.i_situacoes, '-', r.descricao));
  } catch(e) { console.log('  Nao existe:', e.message); }

  // Verificar se existe tabela de versoes/liberacoes
  console.log('\n=== Tabelas com "liber" ou "versao" no nome ===');
  try {
    const tabs = await qe.executar(`
      SELECT table_name FROM sys.systable
      WHERE table_name LIKE '%liber%' OR table_name LIKE '%versao%' OR table_name LIKE '%versoes%'
      ORDER BY table_name
    `);
    tabs.forEach(r => console.log('  ', r.table_name));
  } catch(e) { console.log('  Erro:', e.message); }

  // Verificar psai_tramites da SAI 98669 (PSAI 122890) para ver historico de situacoes
  console.log('\n=== Tramites da PSAI 122890 (SAI 98669) ===');
  const tram = await qe.executar(`
    SELECT pt.i_tramites, pt.i_situacoes, pt.entrada, pt.i_usuarios
    FROM bethadba.psai_tramites pt
    WHERE pt.i_psai = 122890
    ORDER BY pt.entrada
  `);
  tram.forEach(r => console.log('  sit', r.i_situacoes, '| data', String(r.entrada||'').slice(0,10), '| user', r.i_usuarios));

  // Verificar todas as situacoes de tramites de 2026
  console.log('\n=== Distribuicao situacoes tramites PSAI (2026) ===');
  const dist = await qe.executar(`
    SELECT pt.i_situacoes, COUNT(*) as qtd
    FROM bethadba.psai_tramites pt
    WHERE YEAR(pt.entrada) = 2026
    GROUP BY pt.i_situacoes
    ORDER BY qtd DESC
  `);
  dist.forEach(r => console.log('  sit', r.i_situacoes, ':', r.qtd));

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
