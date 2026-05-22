const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');
const planilha = require('../src/core/planilha-escrita');
const equipe = require('../config/equipe.json');

async function main() {
  await conexao.inicializar();

  // 1. Verificar SAI 101789 no banco
  console.log('=== SAI 101789 NO BANCO ===');
  const sai = await qe.executar(`
    SELECT sp.i_sai, sp.i_psai, sp.tipoSAI, sp.CadastroSAI,
      MONTH(sp.CadastroSAI) as mes, YEAR(sp.CadastroSAI) as ano,
      p.i_responsaveis as codigo_sgd, sp.nomeArea
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.i_sai = 101789
  `);
  sai.forEach(r => console.log(JSON.stringify(r)));

  // 2. Verificar SAIs da Barbara Melo em Maio na planilha
  console.log('\n=== BARBARA MELO - PLANILHA MAIO ===');
  const barbara = equipe.analistas.find(a => a.slug === 'barbara-melo');
  console.log('Barbara:', barbara.nome, '| apelido:', barbara.apelido, '| sgd:', barbara['codigo-sgd']);
  const saisMaio = await planilha.obterSaisAnalista(5, barbara);
  console.log('SAIs Maio na planilha:', saisMaio.length);
  saisMaio.forEach(s => console.log(' SAI', s.i_sai, '| psai', s.i_psai, '| tipo', s.tipoSAI, '| nivel', s.nivel, '| resp_psai:', s.responsavel_psai));

  // 3. Verificar todas as SAIs de maio da Barbara no banco
  console.log('\n=== BARBARA MELO - BANCO MAIO 2026 ===');
  const dbMaio = await qe.executar(`
    SELECT sp.i_sai, sp.i_psai, sp.tipoSAI, sp.CadastroSAI,
      p.i_responsaveis as codigo_sgd
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.nomeArea IN ('Escrita', 'Importacao')
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND p.i_responsaveis = ${barbara['codigo-sgd']}
      AND MONTH(sp.CadastroSAI) = 5 AND YEAR(sp.CadastroSAI) = 2026
  `);
  console.log('SAIs no banco para maio:', dbMaio.length);
  dbMaio.forEach(r => console.log(' SAI', r.i_sai, '| psai', r.i_psai, '| tipo', r.tipoSAI));

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
