const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');
const consultasSAL = require('../src/core/consultas-sal');

async function main() {
  await conexao.inicializar();
  const v = '10.6A-07';

  const sai = await qe.executar(`
    SELECT sp.i_sai, sp.i_psai, sp.tipoSAI, sp.nomeArea, sp.nomeVersao, sp.i_versoes,
      sp.Liberacao, sp.Descarte, sp.CadastroPSAI, sp.gravidade_ne,
      sp.NE_PREVENCAO, sp.i_sai_situacoes, sp.i_psai_situacoes,
      COALESCE(p.i_produto_grupo, 1) as produto_grupo
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.i_sai = 102325
  `);
  console.log('=== SAI 102325 ===');
  console.log(JSON.stringify(sai, null, 2));

  const idsVersao = await qe.executar(`
    SELECT DISTINCT sp2.i_versoes
    FROM UP.SAI_PSAI sp2
    WHERE sp2.nomeVersao = '${v}' AND sp2.nomeArea = 'Escrita'
  `);
  console.log('\n=== i_versoes da versao', v, '===');
  console.log(JSON.stringify(idsVersao));

  const checks = {
    pendentes: await qe.executar(consultasSAL.queryPendentes(v, 'Escrita')),
    emArquivo: consultasSAL.queryEmArquivo(v, 'Escrita')
      ? await qe.executar(consultasSAL.queryEmArquivo(v, 'Escrita')) : [],
    alocadas: await qe.executar(consultasSAL.queryAlocadas(v, 'Escrita')),
    entradas: await qe.executar(consultasSAL.queryEntradas(v, 'Escrita')),
    liberadas: await qe.executar(consultasSAL.queryLiberadas(v, 'Escrita')),
    descartes: await qe.executar(consultasSAL.queryDescartes(v, 'Escrita'))
  };
  for (const [k, rows] of Object.entries(checks)) {
    const hit = (rows || []).find(r => r.i_sai === 102325);
    console.log(`${k}: ${hit ? 'ENCONTRADA' : 'nao'} | total: ${(rows || []).length}`);
  }

  await conexao.fechar();
}

main().catch(e => { console.error(e.message); process.exit(1); });
