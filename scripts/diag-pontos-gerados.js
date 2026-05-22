const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');
const equipe = require('../config/equipe.json');

async function main() {
  await conexao.inicializar();
  const carolina = equipe.analistas.find(a => a.slug === 'carolina');
  const erick = equipe.analistas.find(a => a.slug === 'erick');
  console.log('Carolina: i-usuarios=' + carolina['i-usuarios'] + ' | sgd=' + carolina['codigo-sgd']);
  console.log('Erick: i-usuarios=' + erick['i-usuarios'] + ' | sgd=' + erick['codigo-sgd']);

  // Verificar SAIs onde Carolina e a geradora (sai.i_usuarios)
  console.log('\n=== SAIs com sai.i_usuarios = Carolina (947) ===');
  const r1 = await qe.executar(`
    SELECT TOP 5 s.i_sai, s.i_usuarios, sp.tipoSAI, sp.nomeArea, p.i_responsaveis, MONTH(sp.CadastroSAI) as mes
    FROM bethadba.sai s
    JOIN UP.SAI_PSAI sp ON s.i_sai = sp.i_sai
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE s.i_usuarios = ${carolina['i-usuarios']}
      AND YEAR(sp.CadastroSAI) = 2026
  `);
  r1.forEach(r => console.log(JSON.stringify(r)));

  // Verificar campo correto para gerador de SAI
  console.log('\n=== Verificar campos disponiveis em sai para SAIs do Erick ===');
  const r2 = await qe.executar(`
    SELECT TOP 3 sp.i_sai, sp.i_psai, p.i_responsaveis, sp.tipoSAI, MONTH(sp.CadastroSAI) as mes
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE p.i_responsaveis = ${erick['codigo-sgd']}
      AND sp.nomeArea = 'Escrita'
      AND YEAR(sp.CadastroSAI) = 2026
  `);
  r2.forEach(r => console.log(JSON.stringify(r)));

  // Verificar campo i_usuarios na SAI para essas SAIs
  if (r2.length > 0) {
    const ids = r2.map(r => r.i_sai).join(',');
    console.log('\n=== sai.i_usuarios para SAIs do Erick ===');
    const r3 = await qe.executar(`SELECT i_sai, i_usuarios FROM bethadba.sai WHERE i_sai IN (${ids})`);
    r3.forEach(r => console.log(JSON.stringify(r)));
  }

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
