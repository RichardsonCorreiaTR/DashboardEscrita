/**
 * diag-descartes-erick.js - Diagnóstico PSAIs descartadas Erick
 */
process.chdir(require('path').join(__dirname, '..'));
const conexao = require('../src/core/conexao');
const qe      = require('../src/core/query-executor');
const equipe  = require('../config/equipe.json');

const erick = equipe.analistas.find(a => a.slug === 'erick');
const sgd   = erick['codigo-sgd'];   // ex: 1306310
const uid   = erick['i-usuarios'];   // ex: 1237
console.log(`Erick → codigo-sgd: ${sgd} | i-usuarios: ${uid}\n`);

async function q(label, sql) {
  console.log(`── ${label}`);
  try {
    const rows = await qe.executar(sql);
    if (!rows.length) console.log('  (nenhum registro)');
    else rows.forEach(r => console.log(' ', JSON.stringify(r)));
  } catch (e) { console.log('  ERRO:', e.message); }
  console.log();
}

async function main() {
  await conexao.inicializar();

  await q('1. Total por area/grupo (sem filtro extra)', `
    SELECT MONTH(sp.CadastroPSAI) as mes, sp.nomeArea,
      COALESCE(p.i_produto_grupo,1) as grp, COUNT(*) as total
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE p.i_responsaveis = ${sgd}
      AND sp.i_psai_situacoes IN (5,6,23,33)
      AND YEAR(sp.CadastroPSAI) = 2026
    GROUP BY MONTH(sp.CadastroPSAI), sp.nomeArea, COALESCE(p.i_produto_grupo,1)
    ORDER BY mes`);

  await q('2. Com filtro area + grupo=1 (sem psai_responsaveis)', `
    SELECT MONTH(sp.CadastroPSAI) as mes, COUNT(*) as total
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.nomeArea IN ('Escrita','Importacao','ONVIO ESCRITA')
      AND sp.i_psai_situacoes IN (5,6,23,33)
      AND COALESCE(p.i_produto_grupo,1) = 1
      AND p.i_responsaveis = ${sgd}
      AND YEAR(sp.CadastroPSAI) = 2026
    GROUP BY MONTH(sp.CadastroPSAI)`);

  await q('3. Via psai_responsaveis com codigo-sgd', `
    SELECT MONTH(sp.CadastroPSAI) as mes, COUNT(*) as total
    FROM bethadba.psai_responsaveis pr
    JOIN UP.SAI_PSAI sp ON pr.i_psai = sp.i_psai
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.nomeArea IN ('Escrita','Importacao','ONVIO ESCRITA')
      AND sp.i_psai_situacoes IN (5,6,23,33)
      AND COALESCE(p.i_produto_grupo,1) = 1
      AND pr.i_usuarios = ${sgd}
      AND YEAR(sp.CadastroPSAI) = 2026
    GROUP BY MONTH(sp.CadastroPSAI)`);

  await q(`4. Via psai_responsaveis com i-usuarios interno (${uid})`, `
    SELECT MONTH(sp.CadastroPSAI) as mes, COUNT(*) as total
    FROM bethadba.psai_responsaveis pr
    JOIN UP.SAI_PSAI sp ON pr.i_psai = sp.i_psai
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.nomeArea IN ('Escrita','Importacao','ONVIO ESCRITA')
      AND sp.i_psai_situacoes IN (5,6,23,33)
      AND COALESCE(p.i_produto_grupo,1) = 1
      AND pr.i_usuarios = ${uid}
      AND YEAR(sp.CadastroPSAI) = 2026
    GROUP BY MONTH(sp.CadastroPSAI)`);

  await q('5. Sem filtro grupo (apenas area e responsavel)', `
    SELECT MONTH(sp.CadastroPSAI) as mes, COALESCE(p.i_produto_grupo,1) as grp, COUNT(*) as total
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.nomeArea IN ('Escrita','Importacao','ONVIO ESCRITA')
      AND sp.i_psai_situacoes IN (5,6,23,33)
      AND p.i_responsaveis = ${sgd}
      AND YEAR(sp.CadastroPSAI) = 2026
    GROUP BY MONTH(sp.CadastroPSAI), COALESCE(p.i_produto_grupo,1)
    ORDER BY mes`);

  await conexao.fechar();
}
main().catch(e => { console.error(e.message); process.exit(1); });
