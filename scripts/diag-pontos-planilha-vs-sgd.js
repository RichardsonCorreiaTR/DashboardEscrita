/**
 * diag-pontos-planilha-vs-sgd.js - Compara niveis da planilha com o SGD
 *
 * Para cada SAI da planilha 2026, busca o nivel_alteracao no SGD e aponta:
 *   - SAIs sem nivel no SGD (null) quando planilha tem nivel definido
 *   - SAIs com nivel diferente entre planilha e SGD
 *
 * Uso: node scripts/diag-pontos-planilha-vs-sgd.js
 */

process.chdir(require('path').join(__dirname, '..'));
const conexao  = require('../src/core/conexao');
const qe       = require('../src/core/query-executor');
const planilha = require('../src/core/planilha-escrita');

const NIVEL_PLANILHA = {
  'baixa': 1, 'media': 2, 'média': 2,
  'alta': 3, 'extra alta': 4, 'extra': 4
};
const NIVEL_LABEL = { 1: 'Baixa', 2: 'Média', 3: 'Alta', 4: 'Extra Alta' };

function normNivel(texto) {
  return NIVEL_PLANILHA[(texto || '').toLowerCase().trim()] || null;
}

async function main() {
  await conexao.inicializar();

  // 1. Ler todos os meses da planilha
  const todasSais = [];
  for (let mes = 1; mes <= 12; mes++) {
    const rows = await planilha.obterSaisPorMes(mes);
    rows.forEach(r => { if (r.i_sai) todasSais.push({ ...r, mes }); });
  }

  if (!todasSais.length) { console.log('Nenhuma SAI na planilha.'); return; }

  // Deduplica por i_sai (pode aparecer em mais de um mês)
  const mapSais = {};
  todasSais.forEach(r => {
    if (!mapSais[r.i_sai]) mapSais[r.i_sai] = r;
  });
  const ids = Object.keys(mapSais);
  console.log(`\nPlanilha: ${ids.length} SAIs únicas em 2026\n`);

  // 2. Buscar nivel_alteracao + tipoSAI no SGD
  const CHUNK = 200;
  const sgdMap = {};
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK).join(', ');
    const rows = await qe.executar(
      `SELECT sp.i_sai, p.nivel_alteracao, sp.tipoSAI
       FROM UP.SAI_PSAI sp
       JOIN bethadba.psai p ON sp.i_psai = p.i_psai
       WHERE sp.i_sai IN (${chunk})
         AND COALESCE(p.i_produto_grupo, 1) = 1`
    );
    rows.forEach(r => { sgdMap[r.i_sai] = r; });
  }

  // 3. Comparar
  const semNivelSgd   = [];  // planilha tem nivel; SGD sem nivel_alteracao
  const nivelDiferente = [];  // niveis divergentes
  const semNaPlanilha = [];  // nivel na planilha nulo/vazio

  ids.forEach(id => {
    const pl = mapSais[id];
    const sg = sgdMap[id];
    const nivelPl = normNivel(pl.nivel);
    const nivelSg = sg ? (sg.nivel_alteracao || null) : null;

    if (!nivelPl) { semNaPlanilha.push({ i_sai: id, nivel_sgd: nivelSg, tipo: pl.tipoSAI, mes: pl.mes }); return; }
    if (nivelSg === null) { semNivelSgd.push({ i_sai: id, nivel_planilha: NIVEL_LABEL[nivelPl], tipo: pl.tipoSAI, mes: pl.mes }); return; }
    if (nivelPl !== Number(nivelSg)) {
      nivelDiferente.push({
        i_sai: id, tipo: pl.tipoSAI, mes: pl.mes,
        planilha: NIVEL_LABEL[nivelPl],
        sgd: NIVEL_LABEL[Number(nivelSg)] || nivelSg
      });
    }
  });

  // 4. Exibir resultados
  console.log('═══════════════════════════════════════════════════════');
  console.log(`RESULTADO: ${nivelDiferente.length} com nível diferente | ${semNivelSgd.length} sem nível no SGD | ${semNaPlanilha.length} sem nível na planilha`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (nivelDiferente.length) {
    console.log(`── NÍVEL DIFERENTE (${nivelDiferente.length} SAIs) ──────────────────────`);
    console.log('SAI      | Tipo | Mês | Planilha   | SGD');
    nivelDiferente.forEach(r =>
      console.log(`${String(r.i_sai).padEnd(8)} | ${String(r.tipo).padEnd(4)} | ${String(r.mes).padEnd(3)} | ${String(r.planilha).padEnd(10)} | ${r.sgd}`)
    );
    console.log();
  }

  if (semNivelSgd.length) {
    console.log(`── SEM NÍVEL NO SGD (${semNivelSgd.length} SAIs) ────────────────────────`);
    console.log('SAI      | Tipo | Mês | Nível planilha');
    semNivelSgd.forEach(r =>
      console.log(`${String(r.i_sai).padEnd(8)} | ${String(r.tipo).padEnd(4)} | ${String(r.mes).padEnd(3)} | ${r.nivel_planilha}`)
    );
    console.log();
  }

  if (!nivelDiferente.length && !semNivelSgd.length) {
    console.log('✓ Nenhuma divergência encontrada — planilha e SGD estão alinhados.\n');
  }

  await conexao.fechar();
}

main().catch(e => { console.error('Erro:', e.message); process.exit(1); });
