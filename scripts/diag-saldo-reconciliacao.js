/**
 * diag-saldo-reconciliacao.js - Diagnostico do fluxo de saldo de NE
 *
 * Reconciliacao: saldo_anterior + entradas - descartes - liberadas = saldo_atual?
 * E verifica sobreposicao entre o SALDO atual e as LIBERADAS (para saber se as
 * liberadas ja sairam do saldo ou nao).
 *
 * Uso: node scripts/diag-saldo-reconciliacao.js [versao]
 */
const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');
const versao = require('../src/core/versao');
const cne = require('../src/core/consultas-ne');
const { FILTRO_PRODUTO_ENTRADA } = cne;

const AREA = 'Escrita';

function querySaldoPsais(nomeVersao, area = 'Escrita') {
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT sai_psai.i_psai
    FROM UP.SAI_PSAI sai_psai
    WHERE ${cne.condAreaNE(area)}
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.i_sai <> 0
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (sai_psai.Liberacao IS NULL OR sai_psai.Liberacao > ${fim})
      AND (sai_psai.Descarte IS NULL OR sai_psai.Descarte > ${fim})
      ${cne.condNeExterna()}
      ${FILTRO_PRODUTO_ENTRADA}
    UNION ALL
    SELECT sai_psai.i_psai
    FROM UP.SAI_PSAI sai_psai
    WHERE ${cne.condAreaNE(area)}
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.i_sai = 0
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (sai_psai.Descarte IS NULL OR sai_psai.Descarte > ${fim})
      ${cne.condNeExterna()}
      ${FILTRO_PRODUTO_ENTRADA}
  `;
}

function setPsai(rows) { return new Set((rows || []).map(r => r.i_psai)); }

async function main() {
  const nomeVersao = process.argv[2] || '10.6A-07';
  const anterior = versao.versaoAnterior(nomeVersao);
  await conexao.inicializar();

  console.log(`\n===== RECONCILIACAO DE SALDO NE - versao ${nomeVersao} =====`);
  console.log(`Versao anterior: ${anterior}`);
  console.log(`Fim ${nomeVersao}: ${versao.sqlFimVersao(nomeVersao)}`);
  console.log(`Fim ${anterior}: ${versao.sqlFimVersao(anterior)}\n`);

  const [saldoAtual, saldoAnt, entradas, descartes, liberadas, libArqRaw,
         pendentes, emArqRaw, alocadas] = await Promise.all([
    qe.executar(querySaldoPsais(nomeVersao, AREA)),
    qe.executar(querySaldoPsais(anterior, AREA)),
    qe.executar(cne.queryEntradas(nomeVersao, AREA)),
    qe.executar(cne.queryDescartes(nomeVersao, AREA)),
    qe.executar(cne.queryLiberadas(nomeVersao, AREA)),
    (cne.queryLiberadasArquivo(nomeVersao, AREA)
      ? qe.executar(cne.queryLiberadasArquivo(nomeVersao, AREA)) : Promise.resolve([])),
    qe.executar(cne.queryPendentes(nomeVersao, AREA)),
    (cne.queryEmArquivo(nomeVersao, AREA)
      ? qe.executar(cne.queryEmArquivo(nomeVersao, AREA)) : Promise.resolve([])),
    qe.executar(cne.queryAlocadas(nomeVersao, AREA))
  ]);

  const setAtual = setPsai(saldoAtual);
  const nAtual = setAtual.size;
  const nAnt = setPsai(saldoAnt).size;
  const nEnt = (entradas || []).length;
  const nDesc = (descartes || []).length;
  const totalLib = (liberadas || []).length + (libArqRaw || []).length;
  const totalProj = (pendentes || []).length + (emArqRaw || []).length + (alocadas || []).length;

  console.log('--- Contagens (somente externas) ---');
  console.log(`Saldo atual (${nomeVersao}):      ${nAtual}`);
  console.log(`Saldo anterior (${anterior}):     ${nAnt}   variacao: ${nAtual - nAnt >= 0 ? '+' : ''}${nAtual - nAnt}`);
  console.log(`Entradas:                       ${nEnt}`);
  console.log(`Descartes:                      ${nDesc}`);
  console.log(`Liberadas versao:                 ${(liberadas || []).length}`);
  console.log(`Liberadas arquivo (antecipadas):  ${(libArqRaw || []).length}`);
  console.log(`Liberadas TOTAL:                  ${totalLib}`);
  console.log(`Projecao (pend+arq+aloc):         ${totalProj}  (pend ${(pendentes||[]).length} / arq ${(emArqRaw||[]).length} / aloc ${(alocadas||[]).length})`);

  console.log('\n--- Sobreposicao SALDO x LIBERADAS ---');
  const libSet = [...(liberadas || []), ...(libArqRaw || [])];
  const libNoSaldo = libSet.filter(x => setAtual.has(x.i_psai));
  console.log(`Liberadas que AINDA estao no saldo atual: ${libNoSaldo.length} de ${totalLib}`);
  if (libNoSaldo.length) console.log('  i_psai:', libNoSaldo.map(x => x.i_psai).join(', '));

  console.log('\n--- Reconciliacao de fluxo ---');
  const esperado = nAnt + nEnt - nDesc - totalLib;
  console.log(`anterior(${nAnt}) + entradas(${nEnt}) - descartes(${nDesc}) - liberadas(${totalLib}) = ${esperado}`);
  console.log(`saldo atual real = ${nAtual}   =>  diferenca (real - esperado) = ${nAtual - esperado}`);

  console.log(`Formula: saldo(${nAtual}) - projecao(${totalProj}) = ${nAtual - totalProj}`);

  await conexao.fechar();
}
main().catch(e => { console.error(e); process.exit(1); });
