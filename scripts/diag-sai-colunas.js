const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();

  // Listar colunas da tabela bethadba.sai
  console.log('=== Colunas de bethadba.sai ===');
  const cols = await qe.executar(`
    SELECT column_name, data_type
    FROM sys.syscolumns
    WHERE table_name = 'sai' AND creator = 'bethadba'
    ORDER BY column_id
  `);
  cols.forEach(r => console.log('  ', r.column_name, '-', r.data_type));

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
