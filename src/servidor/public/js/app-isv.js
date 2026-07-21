/**
 * app-isv.js - Frontend: Dashboard dedicado ao ISV (Indice de Saude da Versao)
 *
 * Renderiza KPIs, graficos (timeline + breakdown), tabela e diagnostico.
 * Expoe AppISV.carregar(force) para integracao com app-estudos.js.
 */

/* eslint-disable no-unused-vars */
const AppISV = (() => {
  const BASE = '/api';
  const AREAS = [['Escrita', 'Escrita'], ['Importacao', 'Importa\u00e7\u00e3o']];
  let dados = null;
  let charts = {};
  let areaSel = 'Escrita';
  let carregando = false;
  let todasVersoes = [];               // todas as versoes com ISV (historico completo)
  let anoSel = String(new Date().getFullYear()); // filtro de exibicao (padrao: ano vigente)

  async function carregar(force) {
    if (carregando) return; // evita coletas concorrentes (ex.: trocar area + clicar ODBC)
    carregando = true;
    renderizarControles();
    try {
      const params = new URLSearchParams();
      if (force) params.set('force', '1');
      if (areaSel !== 'Escrita') params.set('area', areaSel);
      const qs = params.toString();
      const url = `${BASE}/estudos/historico${qs ? '?' + qs : ''}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(600000) });
      if (!resp.ok) { const b = await resp.json().catch(() => ({})); throw new Error(b.erro || `HTTP ${resp.status}`); }
      const raw = await resp.json();
      todasVersoes = (raw.versoes || []).filter(v => v.isv && !v.isv.insuficiente);
      ajustarAnoSelecionado();
      renderizar();
    } finally {
      carregando = false;
    }
  }

  function anosDisponiveis() {
    return [...new Set(todasVersoes.map(v => v.ano).filter(Boolean))].sort((a, b) => a - b).map(String);
  }

  function ajustarAnoSelecionado() {
    const anos = anosDisponiveis();
    if (anoSel !== 'todos' && !anos.includes(anoSel)) {
      anoSel = anos.length ? anos[anos.length - 1] : 'todos';
    }
  }

  function versoesFiltradas() {
    if (anoSel === 'todos') return todasVersoes;
    return todasVersoes.filter(v => String(v.ano) === anoSel);
  }

  function renderizarControles() {
    const el = document.getElementById('isv-area-seletor');
    if (!el) return;
    const btns = AREAS.map(([val, lbl]) => {
      const ativo = areaSel === val;
      const estilo = ativo
        ? 'background:var(--info,#3b82f6);color:#fff;border-color:var(--info,#3b82f6)'
        : 'background:transparent;color:var(--cor-texto-sec);border-color:var(--cor-borda,#ccc)';
      return `<button data-area="${val}" style="${estilo};border:1px solid;border-radius:6px;padding:0.3rem 0.9rem;margin-right:0.4rem;font-size:0.82rem;cursor:pointer">${lbl}</button>`;
    }).join('');
    const anos = anosDisponiveis();
    const opts = ['<option value="todos"' + (anoSel === 'todos' ? ' selected' : '') + '>Todos os anos</option>']
      .concat(anos.map(a => `<option value="${a}"${a === anoSel ? ' selected' : ''}>${a}</option>`)).join('');
    el.innerHTML =
      '<span style="font-size:0.82rem;color:var(--cor-texto-sec);margin-right:0.5rem">\u00c1rea:</span>' + btns +
      '<span style="font-size:0.82rem;color:var(--cor-texto-sec);margin:0 0.5rem 0 1rem">Ano:</span>' +
      `<select id="isv-ano-select" style="border:1px solid var(--cor-borda,#ccc);border-radius:6px;padding:0.3rem 0.6rem;font-size:0.82rem;cursor:pointer">${opts}</select>`;
    el.querySelectorAll('button[data-area]').forEach(b => {
      b.addEventListener('click', () => {
        if (areaSel === b.dataset.area) return;
        areaSel = b.dataset.area;
        carregar(false);
      });
    });
    const sel = document.getElementById('isv-ano-select');
    if (sel) sel.addEventListener('change', () => { anoSel = sel.value; renderizar(); });
  }

  function extrairISV(versoes) {
    const atual = versoes.length > 0 ? versoes[versoes.length - 1] : null;
    const isvs = versoes.map(v => v.isv.total);
    const media = isvs.length > 0 ? r2(isvs.reduce((a, b) => a + b, 0) / isvs.length) : 0;
    const recentes = isvs.slice(-6);
    const mediaRecente = recentes.length > 0 ? r2(recentes.reduce((a, b) => a + b, 0) / recentes.length) : 0;
    const melhor = versoes.reduce((m, v) => (!m || v.isv.total > m.isv.total ? v : m), null);
    const pior = versoes.reduce((m, v) => (!m || v.isv.total < m.isv.total ? v : m), null);
    const tendencia = recentes.length >= 2 ? r2(recentes[recentes.length - 1] - recentes[0]) : 0;
    return { versoes, atual, media, mediaRecente, melhor, pior, tendencia };
  }

  function renderizar() {
    renderizarControles();
    dados = extrairISV(versoesFiltradas());
    renderizarKPIs();
    renderizarGraficos();
    renderizarTabela();
  }

  function renderizarKPIs() {
    const el = document.getElementById('isv-kpis');
    if (!el || !dados || !dados.atual) return;
    const a = dados.atual;
    const isv = a.isv;
    const classLabel = { confortavel: 'Confortavel', normal: 'Normal', atencao: 'Atencao', critico: 'Critico' };
    const tendSeta = dados.tendencia > 2 ? '&#9650;' : dados.tendencia < -2 ? '&#9660;' : '&#9679;';
    const tendCor = dados.tendencia > 2 ? 'var(--vermelho)' : dados.tendencia < -2 ? 'var(--verde)' : 'var(--cor-texto-sec)';

    el.innerHTML = `
      <div class="estudo-kpi estudo-kpi--${isv.classificacao}">
        <div class="estudo-kpi__label">ISV Atual (${a.versao})</div>
        <div class="estudo-kpi__valor">${isv.total}</div>
        <div class="estudo-kpi__sub">${classLabel[isv.classificacao] || isv.classificacao}</div>
      </div>
      <div class="estudo-kpi">
        <div class="estudo-kpi__label">${anoSel === 'todos' ? 'Media Historica' : 'Media ' + anoSel}</div>
        <div class="estudo-kpi__valor">${dados.media}</div>
        <div class="estudo-kpi__sub">${dados.versoes.length} versoes analisadas</div>
      </div>
      <div class="estudo-kpi">
        <div class="estudo-kpi__label">Tendencia (6 versoes)</div>
        <div class="estudo-kpi__valor" style="color:${tendCor}">${tendSeta} ${dados.mediaRecente}</div>
        <div class="estudo-kpi__sub">${dados.tendencia > 0 ? '+' : ''}${dados.tendencia} pts vs 6 atras</div>
      </div>
      <div class="estudo-kpi">
        <div class="estudo-kpi__label">Melhor Versao</div>
        <div class="estudo-kpi__valor" style="font-size:0.85rem">${dados.melhor ? dados.melhor.versao : '-'}</div>
        <div class="estudo-kpi__sub">${dados.melhor ? dados.melhor.isv.total + ' pts' : ''}</div>
      </div>
      <div class="estudo-kpi">
        <div class="estudo-kpi__label">Pior Versao</div>
        <div class="estudo-kpi__valor" style="font-size:0.85rem">${dados.pior ? dados.pior.versao : '-'}</div>
        <div class="estudo-kpi__sub">${dados.pior ? dados.pior.isv.total + ' pts' : ''}</div>
      </div>
      ${impactoKpi(isv)}
      ${gravKpi(isv)}
    `;
  }

  function renderizarGraficos() {
    if (!dados || dados.versoes.length === 0) return;
    destruir('chartTimeline'); destruir('chartBreakdown');

    const labels = dados.versoes.map(v => v.versao);
    const totais = dados.versoes.map(v => v.isv.total);

    const ctx1 = document.getElementById('chart-isv-timeline');
    if (ctx1) {
      charts.chartTimeline = new Chart(ctx1.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'ISV', data: totais,
            borderColor: 'rgba(59,130,246,0.9)', backgroundColor: 'rgba(59,130,246,0.08)',
            fill: true, tension: 0.3, pointRadius: 4,
            pointBackgroundColor: totais.map(t => t >= 75 ? '#22C55E' : t >= 55 ? '#3B82F6' : t >= 35 ? '#EAB308' : '#EF4444'),
            pointBorderWidth: 2
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            annotation: { annotations: {
              verde: { type: 'box', yMin: 75, yMax: 100, backgroundColor: 'rgba(34,197,94,0.06)', borderWidth: 0 },
              azul: { type: 'box', yMin: 55, yMax: 75, backgroundColor: 'rgba(59,130,246,0.06)', borderWidth: 0 },
              amarelo: { type: 'box', yMin: 35, yMax: 55, backgroundColor: 'rgba(234,179,8,0.06)', borderWidth: 0 },
              vermelho: { type: 'box', yMin: 0, yMax: 35, backgroundColor: 'rgba(239,68,68,0.06)', borderWidth: 0 }
            }},
            tooltip: { callbacks: { afterLabel: ctx => { const v = dados.versoes[ctx.dataIndex]; return `${v.isv.classificacao} | R:${r2(v.isv.pontuacao.ritmo)} T:${r2(v.isv.pontuacao.tendencia)} P:${r2(v.isv.pontuacao.projecao)} A:${r2(v.isv.pontuacao.aceleracao)}`; } } }
          },
          scales: {
            x: { ticks: { font: { size: 9 }, maxRotation: 90 } },
            y: { min: 0, max: 100, title: { display: true, text: 'ISV (0-100)', font: { size: 10 } } }
          }
        }
      });
    }

    const ctx2 = document.getElementById('chart-isv-breakdown');
    if (ctx2) {
      charts.chartBreakdown = new Chart(ctx2.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Ritmo (39)', data: dados.versoes.map(v => r2(v.isv.pontuacao.ritmo)), backgroundColor: 'rgba(59,130,246,0.6)', borderRadius: 3 },
            { label: 'Tendencia (28)', data: dados.versoes.map(v => r2(v.isv.pontuacao.tendencia)), backgroundColor: 'rgba(34,197,94,0.6)', borderRadius: 3 },
            { label: 'Projecao (22)', data: dados.versoes.map(v => r2(v.isv.pontuacao.projecao)), backgroundColor: 'rgba(234,179,8,0.6)', borderRadius: 3 },
            { label: 'Aceleracao (11)', data: dados.versoes.map(v => r2(v.isv.pontuacao.aceleracao)), backgroundColor: 'rgba(168,85,247,0.6)', borderRadius: 3 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { font: { size: 10 } } } },
          scales: {
            x: { stacked: true, ticks: { font: { size: 9 }, maxRotation: 90 } },
            y: { stacked: true, min: 0, max: 100, title: { display: true, text: 'Pontuacao', font: { size: 10 } } }
          }
        }
      });
    }
  }

  function renderizarTabela() {
    const el = document.getElementById('tabela-isv');
    if (!el || !dados) return;
    const thead = el.querySelector('thead');
    const tbody = el.querySelector('tbody');

    thead.innerHTML = '<tr><th>Versao</th><th>ISV</th><th>Ritmo (39)</th><th>Tend (28)</th><th>Proj (22)</th><th>Acel (11)</th><th>Impacto</th><th>SSCs</th><th>Status</th></tr>';

    tbody.innerHTML = dados.versoes.map(v => {
      const i = v.isv;
      const cor = i.classificacao === 'confortavel' ? 'var(--verde)' : i.classificacao === 'normal' ? 'var(--info)' : i.classificacao === 'atencao' ? 'var(--amarelo)' : 'var(--vermelho)';
      const bg = i.classificacao === 'confortavel' ? 'var(--verde-bg)' : i.classificacao === 'normal' ? '' : i.classificacao === 'atencao' ? 'var(--amarelo-bg)' : 'var(--vermelho-bg)';
      const label = { confortavel: 'Confortavel', normal: 'Normal', atencao: 'Atencao', critico: 'Critico' };
      const impMod = i.impacto ? `${i.impacto.modificador > 0 ? '+' : ''}${i.impacto.modificador}` : (i.gravidade ? `${i.gravidade.modificador > 0 ? '+' : ''}${i.gravidade.modificador}` : '-');
      const impCor = i.impacto ? (i.impacto.modificador > 0 ? 'var(--verde)' : i.impacto.modificador < 0 ? 'var(--vermelho)' : '') : '';
      const sscTxt = i.impacto && i.impacto.ssc ? `${i.impacto.ssc.totalSSC}` : '-';
      const ratioTxt = i.impacto ? `${i.impacto.ratio}/NE` : '';
      return `<tr>
        <td><strong>${v.versao}</strong></td>
        <td style="font-weight:700;background:${bg}">${i.total}</td>
        <td>${r2(i.pontuacao.ritmo)}</td><td>${r2(i.pontuacao.tendencia)}</td>
        <td>${r2(i.pontuacao.projecao)}</td><td>${r2(i.pontuacao.aceleracao)}</td>
        <td style="color:${impCor};font-weight:600">${impMod}</td>
        <td>${sscTxt}${ratioTxt ? ' <small style="opacity:0.6">(' + ratioTxt + ')</small>' : ''}</td>
        <td><span style="color:${cor};font-weight:600">${label[i.classificacao] || i.classificacao}</span></td>
      </tr>`;
    }).join('');
  }

  function impactoKpi(isv) {
    const imp = isv.impacto;
    if (!imp) return '';
    const labels = {
      impacto_baixo: 'Baixo', impacto_abaixo_media: 'Abx Media',
      medio: 'Medio', impacto_acima_media: 'Acima Media',
      impacto_alto: 'Alto', insuficiente: 'N/D'
    };
    const cores = {
      impacto_baixo: 'var(--verde)', impacto_abaixo_media: 'var(--verde)',
      medio: 'var(--info)', impacto_acima_media: 'var(--amarelo)',
      impacto_alto: 'var(--vermelho)', insuficiente: 'var(--cor-texto-sec)'
    };
    const label = labels[imp.interpretacao] || imp.interpretacao;
    const cor = cores[imp.interpretacao] || 'var(--cor-texto-sec)';
    const ssc = imp.ssc || {};
    return `<div class="estudo-kpi">
      <div class="estudo-kpi__label">Impacto Cliente</div>
      <div class="estudo-kpi__valor" style="color:${cor};font-size:0.85rem">${label}</div>
      <div class="estudo-kpi__sub">${ssc.totalSSC || 0} SSCs (${imp.ratio || 0}/NE) | Mod: ${imp.modificador > 0 ? '+' : ''}${imp.modificador}pts</div>
    </div>`;
  }

  function gravKpi(isv) {
    const g = isv.gravidade;
    if (!g || !g.modificador) return '';
    const labels = { gravidade_leve: 'Leve', dentro_da_media: 'Na media', gravidade_elevada: 'Elevada', gravidade_alta: 'Alta', insuficiente: 'N/D' };
    const cores = { gravidade_leve: 'var(--verde)', dentro_da_media: 'var(--info)', gravidade_elevada: 'var(--amarelo)', gravidade_alta: 'var(--vermelho)', insuficiente: 'var(--cor-texto-sec)' };
    const label = labels[g.interpretacao] || g.interpretacao;
    const cor = cores[g.interpretacao] || 'var(--cor-texto-sec)';
    return `<div class="estudo-kpi">
      <div class="estudo-kpi__label">Gravidade</div>
      <div class="estudo-kpi__valor" style="color:${cor};font-size:0.85rem">${label}</div>
      <div class="estudo-kpi__sub">Indice: ${g.indice} | Mod: ${g.modificador > 0 ? '+' : ''}${g.modificador}pts</div>
    </div>`;
  }

  function destruir(key) { if (charts[key]) { charts[key].destroy(); delete charts[key]; } }
  function r2(v) { return Math.round((v || 0) * 100) / 100; }

  return { carregar };
})();
