const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();

  // Dados basicos da SAI 97438
  console.log('=== SAI 97438 - dados basicos ===');
  const sai = await qe.executar(`
    SELECT s.i_sai, s.i_usuarios, s.entrada, s.i_equipes
    FROM bethadba.sai s
    WHERE s.i_sai = 97438
  `);
  sai.forEach(r => console.log(JSON.stringify(r)));

  // Verificar se esta em UP.SAI_PSAI
  console.log('\n=== SAI 97438 em UP.SAI_PSAI ===');
  const sp = await qe.executar(`
    SELECT sp.i_sai, sp.i_psai, sp.tipoSAI, sp.nomeArea,
      sp.CadastroSAI, p.i_responsaveis, p.i_situacoes, p.i_produto_grupo
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.i_sai = 97438
  `);
  console.log('Registros em SAI_PSAI:', sp.length);
  sp.forEach(r => console.log(JSON.stringify(r)));

  // Verificar se tem revisoes
  console.log('\n=== Revisoes da SAI 97438 ===');
  const rev = await qe.executar(`
    SELECT sr.i_revisoes, sr.i_motivos, sr.entrada
    FROM bethadba.sai_revisoes sr
    WHERE sr.i_sai = 97438
    ORDER BY sr.entrada
  `);
  console.log('Total revisoes:', rev.length);
  rev.forEach(r => console.log('  motivo', r.i_motivos, '| data', String(r.entrada||'').slice(0,10)));

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
