const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();

  // 1. Verificar nivel_alteracao na SAI 99364 (a SAL associada a PSAI 126784)
  console.log('=== NIVEL NA SAI 99364 ===');
  const saiNivel = await qe.executar(`
    SELECT s.i_sai, s.nivel_alteracao
    FROM bethadba.sai s
    WHERE s.i_sai = 99364
  `);
  saiNivel.forEach(r => console.log(JSON.stringify(r)));

  // 2. Campos de tempo na SAI_PSAI para PSAI 126784
  console.log('\n=== SAI_PSAI PARA PSAI 126784 ===');
  const sp = await qe.executar(`
    SELECT sp.i_psai, sp.i_sai, sp.tipoSAI,
           sp.tempoPrevistoTotal, sp.tempoRealizadoTotal
    FROM UP.SAI_PSAI sp
    WHERE sp.i_psai = 126784
  `);
  sp.forEach(r => console.log(JSON.stringify(r)));

  // 3. Verificar tabela psai_responsaveis
  console.log('\n=== PSAI_RESPONSAVEIS PARA PSAI 126784 ===');
  try {
    const resp = await qe.executar(`
      SELECT pr.i_psai, pr.i_usuarios, pr.tempo_analise, pr.tempo_definicao
      FROM bethadba.psai_responsaveis pr
      WHERE pr.i_psai = 126784
    `);
    resp.forEach(r => console.log(JSON.stringify(r)));
  } catch(e) { console.log('psai_responsaveis erro:', e.message.split('\n')[0]); }

  // 4. Verificar nivel_alteracao na SAI via SAI_PSAI
  console.log('\n=== NIVEL NO SAI_PSAI ===');
  const nivel = await qe.executar(`
    SELECT sp.i_psai, sp.i_sai, s.nivel_alteracao
    FROM UP.SAI_PSAI sp
    JOIN bethadba.sai s ON sp.i_sai = s.i_sai
    WHERE sp.i_psai = 126784
  `);
  nivel.forEach(r => console.log(JSON.stringify(r)));

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
