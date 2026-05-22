const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();

  // Tentar UP.SAI_PSAI com sit da SAI
  console.log('=== Campos de UP.SAI_PSAI para SAI 98669 ===');
  try {
    const r = await qe.executar(`SELECT TOP 1 sp.i_sai, sp.i_psai, sp.tipoSAI, sp.CadastroSAI, sp.nomeArea, sp.i_situacoes FROM UP.SAI_PSAI sp WHERE sp.i_sai = 98669`);
    r.forEach(x => console.log(JSON.stringify(x)));
  } catch(e) { console.log('  Sem i_situacoes em SAI_PSAI'); }

  // Verificar UP.SAI com situacoes
  console.log('\n=== UP.SAI para SAI 98669 ===');
  try {
    const r = await qe.executar(`SELECT TOP 1 s.i_sai, s.i_situacoes, s.data_liberacao FROM UP.SAI s WHERE s.i_sai = 98669`);
    r.forEach(x => console.log(JSON.stringify(x)));
  } catch(e) { console.log('  Erro UP.SAI:', e.message.slice(0,80)); }

  // sai_tramites com variações de nome de coluna
  console.log('\n=== sai_tramites colunas variações ===');
  const tentativas = [
    `SELECT TOP 1 i_sai, i_situacoes, entrada FROM sai_tramites WHERE i_sai = 98669`,
    `SELECT TOP 1 i_sai, situacao, data FROM sai_tramites WHERE i_sai = 98669`,
    `SELECT TOP 1 i_sais, i_situacoes, entrada FROM sai_tramites WHERE i_sais = 98669`,
    `SELECT TOP 1 i_sai, i_situacoes, data_tramite FROM sai_tramites WHERE i_sai = 98669`,
  ];
  for (const sql of tentativas) {
    try {
      const r = await qe.executar(sql);
      console.log('  OK:', sql.slice(0,60), '->', r.length, 'registros');
      if (r.length > 0) r.forEach(x => console.log('  ', JSON.stringify(x)));
    } catch(e) { console.log('  Falhou:', sql.slice(14,60)); }
  }

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
