/**
 * sync-overrides-planilha.js - Sincroniza overrides automaticamente
 *
 * Compara a planilha com o SGD e adiciona ao pontos-overrides.json
 * todas as SAIs onde o nivel no SGD é MENOR que na planilha,
 * respeitando o campo "conferido_ate" (ignora meses já conferidos).
 *
 * Uso: node scripts/sync-overrides-planilha.js
 * npm:  npm run sync-overrides
 */

process.chdir(require('path').join(__dirname, '..'));
const fs       = require('fs');
const path     = require('path');
const conexao  = require('../src/core/conexao');
const qe       = require('../src/core/query-executor');
const planilha = require('../src/core/planilha-escrita');

const OVERRIDES_PATH = path.join('config', 'pontos-overrides.json');

const NIVEL_PL = { 'baixa':1,'media':2,'média':2,'alta':3,'extra alta':4,'extra':4 };
const NIVEL_LABEL = { 1:'Baixa', 2:'Média', 3:'Alta', 4:'Extra Alta' };

function normNivel(texto) {
  return NIVEL_PL[(texto || '').toLowerCase().trim()] || null;
}

function carregarOverrides() {
  return JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8'));
}

function salvarOverrides(data) {
  fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(data, null, 2), 'utf8');
}

async function main() {
  await conexao.inicializar();

  const overridesData = carregarOverrides();
  const confAte = overridesData.conferido_ate || null;
  const mesConf = confAte ? confAte.mes : 0;
  const anoConf = confAte ? confAte.ano : 0;
  const limiteConf = anoConf * 100 + mesConf;

  // IDs já cobertos por override
  const jaNoOverride = new Set(
    (overridesData.overrides || []).map(o => String(o.i_sai))
  );

  console.log(`\n── Sync Overrides Planilha ──────────────────────────`);
  if (limiteConf > 0) console.log(`Conferido até: ${String(mesConf).padStart(2,'0')}/${anoConf} (ignorando estes meses)`);
  console.log(`Overrides existentes: ${jaNoOverride.size}\n`);

  // 1. Ler planilha (meses não conferidos)
  const saisMapa = {};
  for (let mes = 1; mes <= 12; mes++) {
    if (limiteConf > 0 && 2026 * 100 + mes <= limiteConf) continue;
    const rows = await planilha.obterSaisPorMes(mes);
    rows.forEach(r => {
      if (r.i_sai && !saisMapa[r.i_sai]) saisMapa[r.i_sai] = { ...r, mes };
    });
  }

  const ids = Object.keys(saisMapa);
  if (!ids.length) {
    console.log('Nenhuma SAI nos meses pendentes de conferência.');
    await conexao.fechar(); return;
  }
  console.log(`SAIs na planilha (meses pendentes): ${ids.length}`);

  // 2. Buscar nivel_alteracao no SGD
  const sgdMap = {};
  const CHUNK = 200;
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

  // 3. Detectar divergências (SGD < planilha) que ainda não têm override
  const novos = [];
  ids.forEach(id => {
    if (jaNoOverride.has(String(id))) return; // já coberto
    const pl      = saisMapa[id];
    const sg      = sgdMap[id];
    const nivelPl = normNivel(pl.nivel);
    if (!nivelPl) return;
    const nivelSg = sg ? (sg.nivel_alteracao ? Number(sg.nivel_alteracao) : 1) : 1;
    if (nivelSg >= nivelPl) return; // SGD >= planilha → ok
    novos.push({
      i_sai:   Number(id),
      nivel:   NIVEL_LABEL[nivelPl],
      conferido: true,
      motivo:  `Sync automatico: planilha=${NIVEL_LABEL[nivelPl]}, SGD=${NIVEL_LABEL[nivelSg]||nivelSg} (mes ${pl.mes}/2026)`
    });
  });

  if (!novos.length) {
    console.log('\n✓ Nenhuma divergência nova encontrada — overrides já estão atualizados.\n');
    await conexao.fechar(); return;
  }

  // 4. Adicionar ao arquivo
  overridesData.overrides.push(...novos);
  salvarOverrides(overridesData);

  console.log(`\n✓ ${novos.length} override(s) adicionado(s):\n`);
  novos.forEach(o =>
    console.log(`  SAI ${o.i_sai} → ${o.nivel} | ${o.motivo}`)
  );
  console.log(`\nTotal overrides agora: ${overridesData.overrides.length}\n`);

  await conexao.fechar();
}

main().catch(e => { console.error('Erro:', e.message); process.exit(1); });
