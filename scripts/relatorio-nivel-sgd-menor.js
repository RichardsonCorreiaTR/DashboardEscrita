/**
 * relatorio-nivel-sgd-menor.js
 * Gera HTML com SAIs onde o nível no SGD é MENOR que na planilha.
 * Uso: node scripts/relatorio-nivel-sgd-menor.js
 * Saída: output/relatorio-nivel-sgd-menor.html
 */

process.chdir(require('path').join(__dirname, '..'));
const fs       = require('fs');
const path     = require('path');
const conexao  = require('../src/core/conexao');
const qe       = require('../src/core/query-executor');
const planilha = require('../src/core/planilha-escrita');
const TABELA     = require('../config/pontos-definicao.json');
const OVERRIDES  = JSON.parse(fs.readFileSync('config/pontos-overrides.json', 'utf8'));
const equipe     = JSON.parse(fs.readFileSync('config/equipe.json', 'utf8'));

const confAte = OVERRIDES.conferido_ate || null;
const MES_CONFERIDO = confAte ? confAte.mes : 0;
const ANO_CONFERIDO = confAte ? confAte.ano : 0;

const NIVEL_PL = { 'baixa':1,'media':2,'média':2,'alta':3,'extra alta':4,'extra':4 };
const NIVEL_LABEL = { 1:'Baixa', 2:'Média', 3:'Alta', 4:'Extra Alta' };
const MESES_NOME  = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const URL_SAI = 'https://sgsai.dominiosistemas.com.br/sgsai/faces/sai.html?sai=';

// Mapa codigo-sgd → { apelido, senioridade }
const cargoMap = {};
equipe.analistas.forEach(a => {
  cargoMap[a['codigo-sgd']] = { nome: a.apelido, cargo: a.senioridade === 'coordenador' ? 'pleno' : (a.senioridade || 'pleno') };
});

function normNivel(texto) {
  return NIVEL_PL[(texto || '').toLowerCase().trim()] || null;
}

function pontos(tipo, nivel, cargo) {
  const t = TABELA.pontos[tipo]; if (!t) return 0;
  const c = t[cargo === 'senior' ? 'senior' : cargo === 'junior' ? 'junior' : 'pleno']; if (!c) return 0;
  return c[String(nivel)] || 0;
}

async function main() {
  await conexao.inicializar();

  // 1. Ler planilha
  const saisMapa = {};
  for (let mes = 1; mes <= 12; mes++) {
    const rows = await planilha.obterSaisPorMes(mes);
    rows.forEach(r => { if (r.i_sai && !saisMapa[r.i_sai]) saisMapa[r.i_sai] = { ...r, mes }; });
  }
  const ids = Object.keys(saisMapa);
  console.log(`Planilha: ${ids.length} SAIs. Consultando SGD...`);

  // 2. Buscar no SGD: nivel_alteracao + responsavel sgd
  const sgdMap = {};
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK).join(', ');
    const rows = await qe.executar(
      `SELECT sp.i_sai, p.nivel_alteracao, sp.tipoSAI, p.i_responsaveis as sgd_resp
       FROM UP.SAI_PSAI sp
       JOIN bethadba.psai p ON sp.i_psai = p.i_psai
       WHERE sp.i_sai IN (${chunk})
         AND COALESCE(p.i_produto_grupo, 1) = 1`
    );
    rows.forEach(r => { sgdMap[r.i_sai] = r; });
  }

  const mesAnoConf = ANO_CONFERIDO * 100 + MES_CONFERIDO; // ex: 202606

  // 3. Filtrar: SGD nível < planilha nível (ignora meses já conferidos)
  const divergentes = [];
  ids.forEach(id => {
    const pl  = saisMapa[id];
    const sg  = sgdMap[id];

    // Ignorar meses já conferidos
    if (mesAnoConf > 0 && (2026 * 100 + pl.mes) <= mesAnoConf) return;

    const nivelPl = normNivel(pl.nivel);
    if (!nivelPl) return; // sem nível na planilha = ignora
    const nivelSg = sg ? (sg.nivel_alteracao ? Number(sg.nivel_alteracao) : 1) : 1; // null = Baixa (1)
    if (nivelSg >= nivelPl) return; // SGD >= planilha = ok ou SGD maior
    const sgdResp = sg ? sg.sgd_resp : null;
    const analista = cargoMap[sgdResp] || { nome: String(sgdResp || '?'), cargo: 'pleno' };
    const cargo = analista.cargo;
    const ptsSgd = pontos(pl.tipoSAI, nivelSg, cargo);
    const ptsPl  = pontos(pl.tipoSAI, nivelPl, cargo);
    divergentes.push({
      i_sai:       id,
      tipo:        pl.tipoSAI,
      mes:         pl.mes,
      analista:    analista.nome,
      cargo,
      nivel_pl:    NIVEL_LABEL[nivelPl],
      nivel_sgd:   nivelSg === 1 && (!sg || !sg.nivel_alteracao) ? 'Baixa (nulo)' : NIVEL_LABEL[nivelSg],
      pts_sgd:     ptsSgd,
      pts_pl:      ptsPl,
      diff:        ptsPl - ptsSgd,
    });
  });

  divergentes.sort((a, b) => b.diff - a.diff || a.mes - b.mes);

  const totalDiff = divergentes.reduce((s, r) => s + r.diff, 0);
  console.log(`Encontradas ${divergentes.length} SAIs com SGD < planilha. Gerando relatório...`);

  // 4. Gerar HTML
  const linhas = divergentes.map(r => `
    <tr>
      <td><a href="${URL_SAI}${r.i_sai}" target="_blank">${r.i_sai}</a></td>
      <td>${r.tipo}</td>
      <td>${MESES_NOME[r.mes]}</td>
      <td>${r.analista}</td>
      <td class="nivel-ok">${r.nivel_pl}</td>
      <td class="nivel-nok">${r.nivel_sgd}</td>
      <td class="pts">${r.pts_pl}</td>
      <td class="pts nok">${r.pts_sgd}</td>
      <td class="diff">+${r.diff.toFixed(1)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>SAIs com Nível SGD Menor que Planilha — 2026</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #1e293b; background: #f8fafc; }
    h1 { font-size: 1.25rem; margin-bottom: 0.25rem; }
    .resumo { display: flex; gap: 1.5rem; margin: 1rem 0 1.5rem; flex-wrap: wrap; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1.25rem; min-width: 140px; }
    .card strong { display: block; font-size: 1.6rem; font-weight: 800; }
    .card span { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .card.alerta strong { color: #dc2626; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    th { background: #1e293b; color: #e2e8f0; padding: 0.5rem 0.75rem; font-size: 0.72rem; text-align: left; white-space: nowrap; }
    td { padding: 0.45rem 0.75rem; border-bottom: 1px solid #f1f5f9; font-size: 0.82rem; }
    tr:hover td { background: #f8fafc; }
    a { color: #3b82f6; font-weight: 600; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .nivel-ok  { color: #16a34a; font-weight: 600; }
    .nivel-nok { color: #dc2626; font-weight: 600; }
    .pts  { text-align: right; }
    .nok  { color: #dc2626; }
    .diff { text-align: right; font-weight: 700; color: #f59e0b; }
    .nota { font-size: 0.75rem; color: #64748b; margin-top: 1.5rem; border-top: 1px solid #e2e8f0; padding-top: 0.75rem; }
    .gerado { font-size: 0.72rem; color: #94a3b8; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <h1>⚠ SAIs com Nível no SGD MENOR que na Planilha — 2026</h1>
  <p style="color:#64748b;font-size:0.85rem">Ajustando o nível no SGD para o valor da planilha, estes analistas ganhariam mais pontos.</p>
  ${mesAnoConf > 0 ? `<p style="font-size:0.8rem;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:0.5rem 0.9rem;display:inline-block;margin-bottom:0.75rem">✓ Meses 01–${String(MES_CONFERIDO).padStart(2,'0')}/${ANO_CONFERIDO} já conferidos — exibindo apenas a partir de ${String(MES_CONFERIDO+1).padStart(2,'0')}/${ANO_CONFERIDO}</p>` : ''}

  <div class="resumo">
    <div class="card alerta"><strong>${divergentes.length}</strong><span>SAIs divergentes</span></div>
    <div class="card"><strong>${[...new Set(divergentes.map(r=>r.analista))].length}</strong><span>Analistas afetados</span></div>
    <div class="card alerta"><strong>+${totalDiff.toFixed(0)} pts</strong><span>Pontos sub-contados (total)</span></div>
    <div class="card"><strong>${divergentes.filter(r=>r.nivel_sgd.includes('nulo')).length}</strong><span>Sem nível no SGD</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>SAI</th><th>Tipo</th><th>Mês</th><th>Analista</th>
        <th>Nível Planilha</th><th>Nível SGD</th>
        <th>Pts Planilha</th><th>Pts SGD</th><th>Diferença</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
  </table>

  <p class="nota">
    <strong>Ação sugerida:</strong> Para cada SAI, verificar no SGD (clique no número) qual é o nível correto
    e ajustar o campo <em>Nível de Alteração</em> na PSAI. Se o nível da planilha estiver correto,
    o ajuste no SGD fará os pontos serem recalculados automaticamente no dashboard.
    Se não for possível alterar o SGD, registrar um override em <code>config/pontos-overrides.json</code>.
  </p>
  <p class="gerado">Gerado em ${new Date().toLocaleString('pt-BR')} | Fonte: planilha-escrita-2026.xlsm × SGD (pbcvs9)</p>
</body>
</html>`;

  fs.mkdirSync('output', { recursive: true });
  const outPath = path.join('output', 'relatorio-nivel-sgd-menor.html');
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`\n✓ Relatório salvo em: ${outPath}`);
  console.log(`  ${divergentes.length} SAIs | +${totalDiff.toFixed(0)} pts sub-contados no total\n`);

  await conexao.fechar();
}

main().catch(e => { console.error('Erro:', e.message); process.exit(1); });
