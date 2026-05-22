const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();

  // Pegar SAIs da Carolina como responsavel e ver todos campos de usuario disponiveis
  console.log('=== SAIs onde Carolina e responsavel - campos de usuario ===');
  const r1 = await qe.executar(`
    SELECT TOP 3 sp.i_sai, sp.i_psai, p.i_responsaveis,
      s.i_usuarios as sai_i_usuarios
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    JOIN bethadba.sai s ON sp.i_sai = s.i_sai
    WHERE p.i_responsaveis = 501722
      AND sp.nomeArea = 'Escrita'
      AND YEAR(sp.CadastroSAI) = 2026
  `);
  console.log('SAIs responsavel Carolina:');
  r1.forEach(r => console.log(JSON.stringify(r)));

  // Verificar tabela sai_revisoes para ver quem revisou/gerou
  console.log('\n=== Tentativa: sai.i_usuarios significa o CRIADOR da SAI no SGSAI ===');
  const r2 = await qe.executar(`
    SELECT TOP 5 sp.i_sai, s.i_usuarios as criador, p.i_responsaveis as resp_psai,
      sp.tipoSAI, sp.nomeArea, MONTH(sp.CadastroSAI) as mes
    FROM UP.SAI_PSAI sp
    JOIN bethadba.sai s ON sp.i_sai = s.i_sai
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.nomeArea = 'Escrita'
      AND s.i_usuarios <> p.i_responsaveis
      AND YEAR(sp.CadastroSAI) = 2026
      AND p.i_responsaveis IN (501722, 1306310, 999820)
    ORDER BY sp.CadastroSAI DESC
  `);
  console.log('SAIs onde criador != responsavel:');
  r2.forEach(r => console.log(JSON.stringify(r)));

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
