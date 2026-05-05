/**
 * estudos-semanal-v2.js — Rendering that matches PE/ONVIO reference exactly.
 *
 * - Two-row hero (REALIZADO x PROJECAO) with tiny uppercase labels
 * - Progress bar with meta marker
 * - Sentence-style inline metrics
 * - Composition pills
 * - ISV score ring + transparent factor bars
 * - Expandable diagnostics with ▸ triangle
 * - Same backend API (/api/estudos/*)
 */
(() => {
  const BASE = '/api';
  let estado = { versoes: [], versaoAtual: null, dados: null, charts: {} };

  const $ = id => document.getElementById(id);
  const round = (v, d = 1) => Number(v).toFixed(d);

  async function api(rota, timeout = 30000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const r = await fetch(`${BASE}${rota}`, { signal: ctrl.signal });
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.erro || `HTTP ${r.status}`); }
      return r.json();
    } finally { clearTimeout(timer); }
  }

  function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function showLoading(show, msg) {
    const el = $('loading');
    el.hidden = !show;
    if (msg) $('loading-msg').textContent = msg;
    if (show) { $('erro').hidden = true; $('conteudo').innerHTML = ''; }
  }

  function showError(msg) {
    showLoading(false);
    $('erro').hidden = false;
    $('erro').textContent = msg;
  }

  function badgeCls(c) { return { confortavel: 'green', normal: 'blue', atencao: 'yellow', critico: 'red' }[c] || 'neutral'; }
  function badgeLbl(c) { return { confortavel: 'Confortavel', normal: 'Normal', atencao: 'Atencao', critico: 'Critico' }[c] || c; }
  function barColor(pct) { return pct >= 60 ? 'var(--verde)' : pct >= 35 ? 'var(--amarelo)' : 'var(--vermelho)'; }

  // ===== RENDER =====

  function renderSemanal(dados) {
    const t = dados.totais;
    const pr = dados.projecaoRealista;
    const proj = dados.projecao;
    const isv = dados.isv;
    const emAndamento = dados.versaoEmAndamento;
    const pctConcluido = proj ? proj.percentualConcluido : 100;

    let html = '';

    // --- FILTER CARD ---
    html += renderFilterCard(dados);

    // --- MAIN CARD: Hero + Progress + Metrics ---
    html += renderMainCard(dados, t, pr, proj, isv, emAndamento, pctConcluido);

    // --- ISV CARD ---
    if (isv && !isv.insuficiente) {
      html += renderISV(isv);
    }

    // --- CHARTS ---
    html += renderChartContainers();

    // --- TABLE ---
    html += renderTabela(dados);

    $('conteudo').innerHTML = html;
    setupExpandables();
    renderCharts(dados);
  }

  function renderFilterCard(dados) {
    return `<div class="filter-card">
      <div class="filter-card__row">
        <span class="filter-card__label">Versao:</span>
        <select id="seletor-versao" class="select" aria-label="Selecionar versao"></select>
        <div class="filter-card__sep"></div>
        <span class="filter-card__label">Periodo:</span>
        <span id="periodo-info" style="font-size:0.8125rem;color:var(--texto-sec)">
          ${dados.periodo ? fmtDate(dados.periodo.inicio) + ' – ' + fmtDate(dados.periodo.fim) : ''}
          ${dados.versaoEmAndamento && dados.projecao ? ' · ' + dados.projecao.diasPassados + ' dias em dev' : ''}
        </span>
      </div>
      <div class="filter-card__toggles">
        <button class="toggle-btn toggle-btn--ativo" id="btn-cache">Cache</button>
        <button class="toggle-btn toggle-btn--blue" id="btn-odbc">Consultar ODBC</button>
      </div>
    </div>`;
  }

  function renderMainCard(dados, t, pr, proj, isv, emAndamento, pctConcluido) {
    const medianaHist = pr && pr.historicoTotal ? pr.historicoTotal.mediana : null;
    const projConservadora = pr ? pr.conservadora : null;
    const desvio = pr && pr.comparativoEstagio ? pr.comparativoEstagio.desvioPercentual : null;

    // Progress bar color
    let progCls = 'progress-bar--accent';
    if (isv && !isv.insuficiente) {
      progCls = isv.total >= 60 ? 'progress-bar--green' : isv.total >= 35 ? 'progress-bar--yellow' : 'progress-bar--red';
    }

    // Meta marker: mediana historica as % position
    let markerHtml = '';
    if (emAndamento && medianaHist && projConservadora && projConservadora > 0) {
      const markerPct = Math.min(95, Math.round((medianaHist / projConservadora) * pctConcluido));
      markerHtml = `<div class="progress-bar__marker" style="left:${markerPct}%">
        <span class="progress-bar__marker-label">Mediana: ${medianaHist}</span>
      </div>`;
    }

    let html = `<div class="card">
      <div class="card__header">
        <div class="card__title" id="card-versao-titulo">${dados.versaoAtual || ''}</div>
        <div class="card__subtitle">
          ${dados.periodo ? fmtDate(dados.periodo.inicio) + ' – ' + fmtDate(dados.periodo.fim) : ''}
          ${emAndamento && proj ? ' · ' + proj.diasPassados + ' dias em dev' : ''}
        </div>
      </div>

      <div class="hero-row">
        <div class="hero-group">
          <span class="hero-group__label">Realizado</span>
          <span class="hero-group__value">${t.entradasBrutas}<span class="hero-group__unit"> NEs</span></span>
        </div>`;

    if (emAndamento && projConservadora) {
      html += `
        <span class="hero-sep">×</span>
        <div class="hero-group">
          <span class="hero-group__label">Projecao Conservadora</span>
          <span class="hero-group__value">${projConservadora}<span class="hero-group__unit"> NEs</span></span>
        </div>`;
    }

    if (emAndamento) {
      html += `<div class="hero-right">
        <span class="hero-group__label">Progresso</span>
        <span class="hero-group__value">${round(pctConcluido, 0)}%</span>
      </div>`;
    }

    html += `</div>`;

    // Progress bar
    if (emAndamento) {
      html += `<div class="progress-wrap">
        <div class="progress-bar ${progCls}">
          <div class="progress-bar__fill" style="width:${pctConcluido}%"></div>
          ${markerHtml}
        </div>
      </div>
      <div class="progress-labels">
        <span>${round(pctConcluido, 0)}% concluido</span>
        <span>${proj ? proj.diasRestantes + ' dias restantes' : ''}</span>
      </div>`;
    }

    // Sentence metrics
    html += `<div class="sentence-metrics">
      <span><strong>${t.mediaDiaUtil}</strong> /dia util${emAndamento ? ' (' + dados.diasUteisDecorridos + ' d.u.)' : ''}</span>
      <span>Corrido: <strong>${t.mediaDiaCorrido}</strong></span>
      <span>Descartes: <strong>${t.descartes}</strong> (${t.mediaDiaUtilDescartes}/d.u.)</span>
      ${desvio !== null ? `<span>vs Historico: <strong style="color:${desvio > 10 ? 'var(--vermelho)' : desvio < -10 ? 'var(--verde)' : 'var(--texto)'}">
        ${desvio > 0 ? '+' : ''}${desvio}%</strong></span>` : ''}
    </div>`;

    // Composition pills
    html += renderComposicao(dados);

    // Narrative
    html += `<p class="narrative" style="margin-top:16px">${buildNarrativa(dados)}</p>`;

    html += '</div>';
    return html;
  }

  function renderComposicao(dados) {
    if (!dados.semanas || !dados.semanas.length) return '';
    const t = dados.totais;
    const cores = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#8b5cf6'];

    const items = [
      { label: 'Entradas Brutas', val: t.entradasBrutas, cor: cores[0] },
      { label: 'Descartes', val: t.descartes, cor: cores[1] }
    ];

    let pillsHtml = items.map(i =>
      `<span class="pill"><span class="pill__dot" style="background:${i.cor}"></span> <strong>${i.label}</strong> ${i.val}</span>`
    ).join('');

    return `<div class="composition">
      <div class="composition__title">Composicao da Versao</div>
      <div class="pills">${pillsHtml}</div>
    </div>`;
  }

  function buildNarrativa(dados) {
    const t = dados.totais;
    const pr = dados.projecaoRealista;
    const isv = dados.isv;

    let txt = `A versao registra <strong>${t.entradasBrutas} entradas</strong> com media de <strong>${t.mediaDiaUtil} NE/dia util</strong>.`;

    if (pr && pr.comparativoEstagio) {
      const ce = pr.comparativoEstagio;
      const dir = ce.desvioPercentual > 0 ? 'acima' : 'abaixo';
      txt += ` No mesmo estagio, esta <strong>${Math.abs(ce.desvioPercentual)}% ${dir}</strong> da mediana historica (${ce.medianaHistorica} NEs).`;
    }

    if (dados.versaoEmAndamento && pr) {
      txt += ` Projecao conservadora de <strong>${pr.conservadora} NEs</strong> ate o fim.`;
    }

    if (isv && !isv.insuficiente) {
      txt += ` Saude da versao: <strong>${round(isv.total, 1)}/100</strong> (${badgeLbl(isv.classificacao)}).`;
    }

    return txt;
  }

  function renderISV(isv) {
    const p = isv.pontuacao;
    const mx = isv.maxPontos || { ritmo: 39, tendencia: 28, projecao: 22, aceleracao: 11 };
    const nomes = { ritmo: 'Ritmo vs Estagio', tendencia: 'Tendencia 6 Meses', projecao: 'Projecao vs Historico', aceleracao: 'Aceleracao Semanal' };

    let fatoresHtml = '';
    for (const [key, val] of Object.entries(p)) {
      const max = mx[key] || 10;
      const pct = Math.round((val / max) * 100);
      fatoresHtml += `<div class="factor">
        <div class="factor__header">
          <span class="factor__name">${nomes[key] || key}</span>
          <span class="factor__pts">${round(val, 1)}/${max}</span>
        </div>
        <div class="factor__bar">
          <div class="factor__bar-fill" style="width:${pct}%;background:${barColor(pct)}"></div>
        </div>
      </div>`;
    }

    let diagHtml = '';
    if (isv.fatores) {
      diagHtml = '<ul style="margin:0;padding-left:1.2rem;font-size:0.8125rem;color:var(--texto-sec);line-height:1.8">';
      for (const [key, texto] of Object.entries(isv.fatores)) {
        diagHtml += `<li><strong>${nomes[key] || key}:</strong> ${texto}</li>`;
      }
      diagHtml += '</ul>';
    }

    return `<div class="card" style="margin-top:24px">
      <div class="score">
        <div class="score__ring score__ring--${badgeCls(isv.classificacao)}">${round(isv.total, 0)}</div>
        <div class="score__body">
          <div class="score__label">Indice de Saude da Versao (ISV)</div>
          <div class="score__sub">
            <span class="badge badge--${badgeCls(isv.classificacao)}">${badgeLbl(isv.classificacao)}</span>
            · Foco NE Bruta · Escala 0-100
          </div>
        </div>
      </div>
      <div class="factors">${fatoresHtml}</div>
      ${diagHtml ? `<div class="expandable">
        <button class="expandable__trigger" data-expand>Diagnostico detalhado</button>
        <div class="expandable__content">${diagHtml}</div>
      </div>` : ''}
    </div>`;
  }

  function renderChartContainers() {
    return `<div class="chart-row">
      <div class="chart-box">
        <div class="chart-box__header">
          <span class="chart-box__title">Entradas Brutas por Semana</span>
        </div>
        <div class="chart-box__canvas"><canvas id="chart-entradas-semana"></canvas></div>
      </div>
      <div class="chart-box">
        <div class="chart-box__header">
          <span class="chart-box__title">Media Diaria (Dias Uteis vs Corridos)</span>
        </div>
        <div class="chart-box__canvas"><canvas id="chart-media-diaria"></canvas></div>
      </div>
    </div>`;
  }

  function renderTabela(dados) {
    if (!dados.semanas || !dados.semanas.length) return '';

    let rows = '';
    for (const s of dados.semanas) {
      rows += `<tr>
        <td>${s.semana || s.label || ''}</td>
        <td><strong>${s.brutas != null ? s.brutas : s.entradas || ''}</strong></td>
        <td>${s.descartes != null ? s.descartes : ''}</td>
        <td>${s.mediaDiaUtil != null ? s.mediaDiaUtil : ''}</td>
        <td>${s.mediaDiaCorrido != null ? s.mediaDiaCorrido : ''}</td>
      </tr>`;
    }

    return `<div class="card" style="margin-top:24px">
      <div class="card__title">Detalhamento Semanal</div>
      <table class="data-table">
        <thead><tr>
          <th>Semana</th><th>Entradas</th><th>Descartes</th><th>Media/D.U.</th><th>Media/D.C.</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  // ===== CHARTS =====

  function renderCharts(dados) {
    if (!dados.semanas || !dados.semanas.length) return;
    const labels = dados.semanas.map(s => s.semana || s.label || '');
    const brutas = dados.semanas.map(s => s.brutas != null ? s.brutas : s.entradas || 0);
    const descartes = dados.semanas.map(s => s.descartes || 0);
    const mdu = dados.semanas.map(s => s.mediaDiaUtil || 0);
    const mdc = dados.semanas.map(s => s.mediaDiaCorrido || 0);

    destroyCharts();

    const optsBase = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 11, family: 'Segoe UI' }, padding: 16 } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: '#f0f0f0' }, ticks: { font: { size: 11 } } }
      }
    };

    const c1 = document.getElementById('chart-entradas-semana');
    if (c1) {
      estado.charts.entradas = new Chart(c1, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Entradas', data: brutas, backgroundColor: '#2563eb', borderRadius: 4 },
            { label: 'Descartes', data: descartes, backgroundColor: '#f87171', borderRadius: 4 }
          ]
        },
        options: optsBase
      });
    }

    const c2 = document.getElementById('chart-media-diaria');
    if (c2) {
      estado.charts.media = new Chart(c2, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Media/Dia Util', data: mdu, backgroundColor: '#16a34a', borderRadius: 4 },
            { label: 'Media/Dia Corrido', data: mdc, backgroundColor: '#a78bfa', borderRadius: 4 }
          ]
        },
        options: optsBase
      });
    }
  }

  function destroyCharts() {
    Object.values(estado.charts).forEach(c => c && c.destroy());
    estado.charts = {};
  }

  // ===== EXPANDABLES =====

  function setupExpandables() {
    document.querySelectorAll('[data-expand]').forEach(btn => {
      btn.addEventListener('click', () => {
        const wrap = btn.closest('.expandable');
        wrap.classList.toggle('expandable--open');
        const open = wrap.classList.contains('expandable--open');
        btn.textContent = open ? 'Ocultar detalhes' : 'Diagnostico detalhado';
      });
    });
  }

  // ===== INIT =====

  async function loadVersions(selectEl) {
    try {
      const resp = await api('/estudos/versoes', 8000);
      estado.versoes = resp.versoes || [];
      estado.versaoAtual = resp.atual;
      selectEl.innerHTML = '';
      for (const v of [...estado.versoes].reverse()) {
        const opt = document.createElement('option');
        opt.value = v.versao;
        opt.textContent = v.versao + (v.atual ? ' (atual)' : '');
        selectEl.appendChild(opt);
      }
      if (estado.versaoAtual) selectEl.value = estado.versaoAtual;
    } catch (err) {
      const now = new Date();
      estado.versaoAtual = `10.${now.getFullYear() - 2020}A-${String(now.getMonth() + 1).padStart(2, '0')}`;
      selectEl.innerHTML = `<option value="${estado.versaoAtual}">${estado.versaoAtual} (estimada)</option>`;
    }
  }

  async function loadSemanal(versao, force) {
    showLoading(true, `Analisando ${versao}...`);
    try {
      const url = `/estudos/semanal/${versao}${force ? '?force=1' : ''}`;
      const dados = await api(url, 30000);
      estado.dados = dados;
      dados.versaoAtual = versao;

      document.title = `Semanal ${versao} | Escrita Fiscal`;
      const navTitle = document.getElementById('nav-page-title');
      if (navTitle) navTitle.textContent = `Semanal por Versao`;

      showLoading(false);
      renderSemanal(dados);

      // Rebind events on new DOM
      const sel = $('seletor-versao');
      if (sel) {
        await loadVersions(sel);
        sel.value = versao;
        sel.addEventListener('change', () => loadSemanal(sel.value));
      }
      const btnOdbc = $('btn-odbc');
      if (btnOdbc) btnOdbc.addEventListener('click', () => loadSemanal(sel ? sel.value : versao, true));
      const btnCache = $('btn-cache');
      if (btnCache) btnCache.addEventListener('click', () => loadSemanal(sel ? sel.value : versao));

    } catch (err) {
      showError(`Erro ao carregar: ${err.message}`);
    }
  }

  async function init() {
    showLoading(true, 'Carregando versoes...');

    const params = new URLSearchParams(window.location.search);
    const view = params.get('view') || 'semanal-versao';

    if (view === 'semanal-versao') {
      // Fetch version list first to get the current version name
      let versao;
      try {
        const resp = await api('/estudos/versoes', 8000);
        estado.versoes = resp.versoes || [];
        estado.versaoAtual = resp.atual;
        versao = resp.atual || (resp.versoes.length ? resp.versoes[resp.versoes.length - 1].versao : null);
      } catch {
        const now = new Date();
        versao = `10.${now.getFullYear() - 2020}A-${String(now.getMonth() + 1).padStart(2, '0')}`;
        estado.versaoAtual = versao;
      }
      if (versao) await loadSemanal(versao);
    } else {
      showLoading(false);
      $('conteudo').innerHTML = `<div class="card"><p class="narrative">
        View <strong>${view}</strong> em desenvolvimento. Use a
        <a href="/estudos.html?view=semanal-versao" style="color:var(--primario)">Semanal por Versao</a> como prova de conceito.
      </p></div>`;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
