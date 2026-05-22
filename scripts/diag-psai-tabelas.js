const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();

  // Tentar tabelas de responsaveis de PSAI com nomes diferentes
  const tentativas = [
    'SELECT TOP 3 * FROM bethadba.psai_responsaveis WHERE i_psai = 126784',
    'SELECT TOP 3 * FROM bethadba.pre_sai_responsaveis WHERE i_psai = 126784',
    'SELECT TOP 3 * FROM SGSAI.psai_responsaveis WHERE i_psai = 126784',
    'SELECT TOP 3 pr.* FROM bethadba.psai p JOIN bethadba.psai_responsaveis pr ON p.i_psai = pr.i_psai WHERE p.i_psai = 126784',
  ];

  for (const sql of tentativas) {
    try {
      const r = await qe.executar(sql);
      console.log('OK:', sql.substring(0, 60));
      r.forEach(row => console.log('  ', JSON.stringify(row)));
      break;
    } catch(e) {
      console.log('FALHOU:', sql.substring(0, 60), '->', e.message.split('\n')[0].substring(0, 60));
    }
  }

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
