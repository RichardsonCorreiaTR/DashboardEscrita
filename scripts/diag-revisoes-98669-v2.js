const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');
const equipe = require('../config/equipe.json');

async function main() {
  await conexao.inicializar();
  const flavia = equipe.analistas.find(a => a.slug === 'flavia');
  console.log('Flavia: i-usuarios=' + flavia['i-usuarios'] + ' | sgd=' + flavia['codigo-sgd']);

  // SAI 98669 - dados basicos
  console.log('\n=== SAI 98669 cadastro ===');
  const sai = await qe.executar(`
    SELECT sp.i_sai, sp.tipoSAI, sp.CadastroSAI, sp.nomeArea,
      p.i_responsaveis, s.i_usuarios as gerador
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    JOIN bethadba.sai s ON sp.i_sai = s.i_sai
    WHERE sp.i_sai = 98669
  `);
  sai.forEach(r => console.log(JSON.stringify(r)));

  // Todas as revisoes de 98669 com motivos 1 e 2
  console.log('\n=== Revisoes motivo 1 e 2 (por ano) ===');
  const rev = await qe.executar(`
    SELECT sr.i_revisoes, sr.i_motivos, sr.entrada,
      YEAR(sr.entrada) as ano, MONTH(sr.entrada) as mes
    FROM bethadba.sai_revisoes sr
    WHERE sr.i_sai = 98669 AND sr.i_motivos IN (1, 2)
    ORDER BY sr.entrada
  `);
  console.log('Total com motivos 1+2:', rev.length);
  rev.forEach(r => console.log('  revisao', r.i_revisoes, '| motivo', r.i_motivos, '| data', String(r.entrada||'').slice(0,10)));

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
