const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');
const equipe = require('../config/equipe.json');

async function main() {
  await conexao.inicializar();
  const carolina = equipe.analistas.find(a => a.slug === 'carolina');
  console.log('Carolina: codigo_sgd=' + carolina['codigo-sgd']);

  // Verificar cada SAI ausente
  const ausentes = [101513, 101230, 100393];
  console.log('\n=== SAIs AUSENTES ===');
  for (const id of ausentes) {
    const r = await qe.executar(`
      SELECT sp.i_sai, sp.i_psai, sp.tipoSAI, sp.CadastroSAI,
        MONTH(sp.CadastroSAI) as mes, YEAR(sp.CadastroSAI) as ano,
        sp.nomeArea, p.i_responsaveis, COALESCE(p.i_produto_grupo, 1) as produto_grupo
      FROM UP.SAI_PSAI sp
      JOIN bethadba.psai p ON sp.i_psai = p.i_psai
      WHERE sp.i_sai = ${id}
    `);
    if (r.length === 0) { console.log('SAI ' + id + ': NAO encontrada no banco'); }
    else r.forEach(row => console.log('SAI ' + id + ':', JSON.stringify(row)));
  }

  // Comparar com query atual do detalhePontos
  console.log('\n=== QUERY ATUAL (detalhePontos Abril) ===');
  const atual = await qe.executar(`
    SELECT sp.i_sai, sp.tipoSAI, sp.CadastroSAI, p.nivel_alteracao,
      sp.nomeArea, COALESCE(p.i_produto_grupo, 1) as produto_grupo
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.nomeArea IN ('Escrita', 'Importacao')
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND p.i_responsaveis = ${carolina['codigo-sgd']}
      AND MONTH(sp.CadastroSAI) = 4 AND YEAR(sp.CadastroSAI) = 2026
    ORDER BY p.nivel_alteracao DESC, sp.CadastroSAI
  `);
  console.log('SAIs encontradas:', atual.length);
  atual.forEach(r => console.log(' SAI', r.i_sai, '|', r.tipoSAI, '|', r.nomeArea, '| nivel:', r.nivel_alteracao));

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
