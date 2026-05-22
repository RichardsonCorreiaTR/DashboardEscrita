const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');
const equipe = require('../config/equipe.json');

async function main() {
  await conexao.inicializar();
  const felipi = equipe.analistas.find(a => a.slug === 'felipi');
  console.log('Felipi: sgd=' + felipi['codigo-sgd']);

  // PSAIs sem SAI vinculada (i_sai = 0) do Felipi em 2026
  const r = await qe.executar(`
    SELECT MONTH(sp.CadastroPSAI) as mes, COUNT(DISTINCT sp.i_psai) as qtd_analises
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.nomeArea = 'Escrita'
      AND sp.i_sai = 0
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND p.i_responsaveis = ${felipi['codigo-sgd']}
      AND YEAR(sp.CadastroPSAI) = 2026
    GROUP BY MONTH(sp.CadastroPSAI)
    ORDER BY mes
  `);
  console.log('PSAIs sem SAI (analises) por mes:');
  r.forEach(x => console.log('  Mes ' + x.mes + ': ' + x.qtd_analises));
  await conexao.fechar();
}
main().catch(e => console.error(e.message));
