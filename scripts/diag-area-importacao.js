/**
 * Compara indicadores Escrita vs Importacao vs Ambas para uma versao.
 * Uso: node scripts/diag-area-importacao.js [versao]
 */
const conexao = require('../src/core/conexao');
const qe = require('../src/core/query-executor');
const saldo = require('../src/indicadores/produto/saldo-ne');
const entrada = require('../src/indicadores/produto/entrada-ne');
const { condAreaNE } = require('../src/core/consultas-ne');

const versao = process.argv[2] || '10.6A-01';

async function main() {
  await conexao.inicializar();
  console.log('Versao:', versao);
  for (const area of ['Escrita', 'Importacao', 'Ambas']) {
    const s = await saldo.calcular(qe, { versao, area });
    const e = await entrada.calcular(qe, { versao, area });
    console.log(
      `${area}: saldo=${s.valor} ent=${e.valor} lib=${e.detalhes.liberacoes} desc=${e.detalhes.descartes}`
    );
  }
  const areas = await qe.executar(`
    SELECT nomeArea, COUNT(1) AS qtd
    FROM UP.SAI_PSAI
    WHERE tipoSAI = 'NE' AND nomeArea LIKE 'Importa%'
    GROUP BY nomeArea
  `);
  console.log('nomeArea Importa%:', JSON.stringify(areas, null, 2));

  const filtroImp = condAreaNE('Importacao');
  const cnt = await qe.executar(`
    SELECT COUNT(1) AS qtd FROM UP.SAI_PSAI p
    JOIN UP.VERSAO v ON p.i_versao = v.i_versao
    WHERE v.nomeVersao = '${versao}' AND p.tipoSAI = 'NE' AND p.status = 'Aberta'
      AND ${filtroImp}
  `);
  console.log('Saldo Importacao (query direta):', cnt[0]?.qtd);

  await conexao.fechar();
}

main().catch((e) => { console.error(e); process.exit(1); });
