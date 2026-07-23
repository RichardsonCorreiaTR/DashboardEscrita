/**
 * diag-saldo-gap.js - Identifica NEs que saem do saldo sem aparecer nas abas
 * Uso: node scripts/diag-saldo-gap.js [versao]
 */
const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');
const versao = require('../src/core/versao');
const cne = require('../src/core/consultas-ne');

const V = process.argv[2] || '10.6A-02';
const ANT = versao.versaoAnterior(V);

function querySaldoPsais(nomeVersao) {
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT sai_psai.i_psai, sai_psai.i_sai, sai_psai.nomeVersao,
           sai_psai.Liberacao, sai_psai.Descarte, sai_psai.CadastroPSAI,
           sai_psai.i_sai_situacoes, sai_psai.i_psai_situacoes
    FROM UP.SAI_PSAI sai_psai
    WHERE ${cne.condAreaNE('Escrita')}
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.i_sai <> 0
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (sai_psai.Liberacao IS NULL OR sai_psai.Liberacao > ${fim})
      AND (sai_psai.Descarte IS NULL OR sai_psai.Descarte > ${fim})
      ${cne.condNeExterna()}
    UNION ALL
    SELECT sai_psai.i_psai, sai_psai.i_sai, sai_psai.nomeVersao,
           sai_psai.Liberacao, sai_psai.Descarte, sai_psai.CadastroPSAI,
           sai_psai.i_sai_situacoes, sai_psai.i_psai_situacoes
    FROM UP.SAI_PSAI sai_psai
    WHERE ${cne.condAreaNE('Escrita')}
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.i_sai = 0
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (sai_psai.Descarte IS NULL OR sai_psai.Descarte > ${fim})
      ${cne.condNeExterna()}
  `;
}

function fmt(d) {
  return d ? new Date(d).toLocaleDateString('pt-BR') : '-';
}

async function main() {
  await conexao.inicializar();
  console.log(`\n=== GAP SALDO: ${ANT} -> ${V} ===\n`);

  const [saldoAnt, saldoAtual, entradas, descartes, liberadas, libArq] = await Promise.all([
    qe.executar(querySaldoPsais(ANT)),
    qe.executar(querySaldoPsais(V)),
    qe.executar(cne.queryEntradas(V)),
    qe.executar(cne.queryDescartes(V)),
    qe.executar(cne.queryLiberadas(V)),
    cne.queryLiberadasArquivo(V) ? qe.executar(cne.queryLiberadasArquivo(V)) : Promise.resolve([])
  ]);

  const mapAnt = new Map(saldoAnt.map(r => [r.i_psai, r]));
  const setAtual = new Set(saldoAtual.map(r => r.i_psai));
  const setEnt = new Set(entradas.map(r => r.i_psai));
  const setDesc = new Set(descartes.map(r => r.i_psai));
  const setLib = new Set([...liberadas, ...libArq].map(r => r.i_psai));
  const libIds = [...liberadas, ...libArq].map(r => r.i_psai);

  const sairam = [...mapAnt.keys()].filter(id => !setAtual.has(id));
  const orphan = sairam.filter(id => !setDesc.has(id) && !setLib.has(id));

  console.log(`Saldo ${ANT}: ${saldoAnt.length} | Saldo ${V}: ${saldoAtual.length} | variacao: ${saldoAtual.length - saldoAnt.length}`);
  console.log(`Sairam do saldo anterior: ${sairam.length}`);
  console.log(`Orfaos (nao em Descartes/Liberadas da versao): ${orphan.length}\n`);
  console.log(`Fim versao ${V} (PIAZZA):`, await qe.executar(`SELECT ${versao.sqlFimVersao(V)} as fim`));
  console.log(`Inicio versao ${V} (PIAZZA):`, await qe.executar(`SELECT ${versao.sqlInicioVersao(V)} as inicio`));

  for (const id of orphan) {
    const r = mapAnt.get(id);
    console.log(`PSAI ${id} | SAI ${r.i_sai || '-'} | nomeVersao: ${r.nomeVersao || '(vazio)'}`);
    console.log(`  Cadastro: ${fmt(r.CadastroPSAI)} | Liberacao: ${fmt(r.Liberacao)} | Descarte: ${fmt(r.Descarte)}`);
    console.log(`  sit SAI: ${r.i_sai_situacoes} | sit PSAI: ${r.i_psai_situacoes}`);
    console.log(`  Entrada no periodo? ${setEnt.has(id) ? 'sim' : 'nao (backlog)'}\n`);
  }

  // Liberadas com nomeVersao != V (backlog liberado no periodo)
  const fim = versao.sqlFimVersao(V);
  const inicio = versao.sqlInicioVersao(V);
  const libBacklog = await qe.executar(`
    SELECT sai_psai.i_psai, sai_psai.i_sai, sai_psai.nomeVersao, sai_psai.Liberacao
    FROM UP.SAI_PSAI sai_psai
    WHERE ${cne.condAreaNE('Escrita')}
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.Liberacao > ${inicio}
      AND sai_psai.Liberacao <= ${fim}
      AND sai_psai.nomeVersao IS NOT NULL
      AND sai_psai.nomeVersao <> '${V}'
      AND sai_psai.nomeVersao NOT LIKE '${versao.padraoArquivoVersao(V) || 'IMPOSSIVEL'}'
      ${cne.condNeExterna()}
  `);

  const libBacklogNoSaldoAnt = libBacklog.filter(r => mapAnt.has(r.i_psai));
  console.log(`Liberadas no periodo com nomeVersao != ${V}: ${libBacklog.length}`);
  for (const r of libBacklogNoSaldoAnt) {
    console.log(`  PSAI ${r.i_psai} | SAI ${r.i_sai} | versao: ${r.nomeVersao} | lib: ${fmt(r.Liberacao)}`);
  }

  if (orphan.length) {
    const ids = orphan.join(',');
    const det = await qe.executar(`
      SELECT sai_psai.i_psai, sai_psai.i_sai, sai_psai.nomeVersao,
             sai_psai.Liberacao, sai_psai.NE_PREVENCAO,
             psai.i_produto_grupo, sai_psai.nomeArea, sai_psai.tipoSAI
      FROM UP.SAI_PSAI sai_psai
      LEFT JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
      WHERE sai_psai.i_psai IN (${ids})
    `);
    console.log('\nDetalhe completo dos orfaos:');
    det.forEach(r => console.log(JSON.stringify(r)));
    const inLibQuery = orphan.filter(id => setLib.has(id));
    console.log(`Orfaos que ESTAO na query liberadas: ${inLibQuery.length}`);
  }

  await conexao.fechar();
}

main().catch(e => { console.error(e); process.exit(1); });
