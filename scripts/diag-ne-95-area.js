/**
 * Diagnostico NE > 95 dias: area + internas
 * Uso: node scripts/diag-ne-95-area.js [versao]
 */
const conexao = require('../src/core/conexao');
const qe = require('../src/core/query-executor');
const ne95 = require('../src/indicadores/produto/ne-95-dias');
const versao = require('../src/core/versao');
const { condAreaNE, condNeExterna } = require('../src/core/consultas-ne');

const v = process.argv[2] || '10.6A-07';

async function contar(executor, area, extra = '') {
  const fim = versao.sqlFimVersao(v);
  const rows = await executor.executar(`
    SELECT sai_psai.nomeArea, sai_psai.NE_PREVENCAO, COUNT(*) as qtd
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE ${condAreaNE(area)}
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (COALESCE(sai_psai.Liberacao, '3000-12-01') > ${fim})
      AND (COALESCE(sai_psai.Descarte, '3000-12-01') > ${fim})
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) > 95
      ${condNeExterna()}
      ${extra}
    GROUP BY sai_psai.nomeArea, sai_psai.NE_PREVENCAO
    ORDER BY sai_psai.nomeArea
  `);
  return rows;
}

async function main() {
  await conexao.inicializar();
  console.log('Versao:', v);

  for (const area of ['Escrita', 'Importacao', 'Ambas']) {
    const r = await ne95.calcular(qe, { versao: v, area, force: true });
    console.log(`\n${area}: total=${r.valor} status=${JSON.stringify(r.detalhes.por_status)}`);
    const top = r.detalhes.top_10_mais_antigas || [];
    const areas = top.map(x => x.nomeArea);
    console.log('  top10 areas:', [...new Set(areas)].join(', ') || '(vazio)');
    console.log('  top10 dias>', Math.min(...top.map(x => x.dias)), '-', Math.max(...top.map(x => x.dias)));
  }

  console.log('\n--- Breakdown ODBC (>95d, produto 1, externas) ---');
  for (const area of ['Escrita', 'Importacao', 'Ambas']) {
    const rows = await contar(qe, area);
    const tot = rows.reduce((s, r) => s + r.qtd, 0);
    console.log(`${area} total=${tot}`, rows);
  }

  console.log('\n--- Internas incluidas SE remover condNeExterna (Ambas) ---');
  const comInternas = await contar(qe, 'Ambas', '');
  const soInternas = await qe.executar(`
    SELECT COUNT(*) as qtd FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE ${condAreaNE('Ambas')}
      AND sai_psai.tipoSAI = 'NE'
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND COALESCE(sai_psai.NE_PREVENCAO, 0) = 1
      AND DATEDIFF(day, sai_psai.CadastroPSAI, ${versao.sqlFimVersao(v)}) > 95
  `);
  console.log('NE_PREVENCAO=1 (>95d, Ambas):', soInternas[0]?.qtd);

  await conexao.fechar();
}

main().catch(e => { console.error(e); process.exit(1); });
