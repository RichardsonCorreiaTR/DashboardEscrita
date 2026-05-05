/**
 * app-laboratorio.js - Controller do Laboratorio de Previsibilidade
 *
 * 3 views: raio-x (por versao), evolucao (tendencias), dna (areas tecnicas).
 * Carrega dados via API e renderiza com Chart.js + lab-render.js.
 */

/* global LabRender, AppLabBacktest, Chart */
const AppLab = (() => {
  const CORES = {
    azul: 'rgba(59,130,246,0.7)', vermelho: 'rgba(239,68,68,0.7)',
    verde: 'rgba(34,197,94,0.7)', amarelo: 'rgba(234,179,8,0.7)',
    roxo: 'rgba(168,85,247,0.7)', laranja: 'rgba(249,115,22,0.7)',
    cinza: 'rgba(148,163,184,0.5)', ciano: 'rgba(6,182,212,0.7)'
  };
  const CORES_COMPLEX = [CORES.verde, CORES.azul, CORES.amarelo, CORES.laranja, CORES.vermelho];
  const CORES_RISCO = [CORES.verde, CORES.amarelo, CORES.laranja, CORES.vermelho];
  const ORDEM_COMPLEX = ['trivial', 'baixa', 'media', 'alta', 'sistemica'];
  const ORDEM_RISCO = ['baixo', 'medio', 'alto', 'critico'];

  const estado = { view: 'raio-x', charts: {} };
  const els = {};

  function init() {
    cachearElementos();
    const params = new URLSearchParams(window.location.search);
    estado.view = params.get('view') || 'raio-x';
    ativarView(estado.view);
    carregarView(estado.view);
  }

  function cachearElementos() {
    els.loading = document.getElementById('lab-loading');
    els.erro = document.getElementById('lab-erro');
    els.status = document.getElementById('lab-status');
    els.selVersao = document.getElementById('sel-versao');
    els.rxKpis = document.getElementById('rx-kpis');
    els.rxCriticas = document.getElementById('rx-criticas');
    els.dnaTabela = document.getElementById('dna-tabela');
  }

  function ativarView(view) {
    for (const v of ['raio-x', 'evolucao', 'dna', 'backtest']) {
      const el = document.getElementById('view-' + v);
      if (el) el.classList.toggle('view-toggle--ativo', view === v);
    }
  }

  async function carregarView(view) {
    loading(true);
    esconderErro();
    try {
      if (view === 'raio-x') await carregarRaioX();
      else if (view === 'evolucao') await carregarEvolucao();
      else if (view === 'dna') await carregarDNA();
      else if (view === 'backtest') await carregarBacktest();
    } catch (err) { mostrarErro(err.message || 'Erro ao carregar dados'); }
    loading(false);
  }

  async function carregarRaioX() {
    const versoes = await fetchJSON('/api/laboratorio/versoes');
    LabRender.renderSeletorVersoes(versoes, els.selVersao);
    els.selVersao.value = versoes[versoes.length - 1];
    els.selVersao.onchange = () => { loading(true); carregarRaioXVersao(els.selVersao.value); };
    await carregarRaioXVersao(els.selVersao.value);
  }

  async function carregarRaioXVersao(versao) {
    const d = await fetchJSON('/api/laboratorio/raio-x/' + encodeURIComponent(versao));
    if (d.erro) { mostrarErro(d.erro); loading(false); return; }

    LabRender.renderKPIs(d, els.rxKpis);
    chartDonut('rx-complex', d.complexidades, ORDEM_COMPLEX, CORES_COMPLEX);
    chartDonut('rx-risco', d.riscos, ORDEM_RISCO, CORES_RISCO);
    chartBarHoriz('rx-areas', d.areas);
    LabRender.renderSais(d.sais, els.rxCriticas);
    els.status.textContent = versao + ' \u2014 ' + d.total + ' SAIs';
    loading(false);
  }

  async function carregarEvolucao() {
    const dados = await fetchJSON('/api/laboratorio/evolucao');
    if (!dados || dados.length === 0) { mostrarErro('Sem dados'); return; }

    const labels = dados.map(d => d.versao);
    chartLine('ev-complex', labels, dados.map(d => d.idx_complexidade),
      'Complexidade Media', CORES.azul, { sugMin: 1, sugMax: 5 });
    chartLine('ev-risco', labels, dados.map(d => d.pct_alto_risco),
      '% Alto Risco', CORES.vermelho, { sugMin: 0, pctSuffix: true });
    chartBarVolume('ev-volume', labels, dados.map(d => d.total));
    els.status.textContent = dados.length + ' versoes analisadas';
  }

  async function carregarDNA() {
    const areas = await fetchJSON('/api/laboratorio/dna-tecnico');
    if (!areas || areas.length === 0) { mostrarErro('Sem dados'); return; }

    chartDnaFreq('dna-freq', areas);
    LabRender.renderDnaTabela(areas, els.dnaTabela);
    els.status.textContent = areas.length + ' areas tecnicas';
  }

  function chartDonut(canvasId, contagem, ordem, cores) {
    destruir(canvasId);
    const labels = ordem.filter(k => contagem[k]);
    const vals = labels.map(k => contagem[k]);
    const bg = labels.map((_, i) => cores[ordem.indexOf(labels[i])] || CORES.cinza);
    estado.charts[canvasId] = new Chart(document.getElementById(canvasId), {
      type: 'doughnut',
      data: { labels, datasets: [{ data: vals, backgroundColor: bg }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }

  function chartBarHoriz(canvasId, contagem) {
    destruir(canvasId);
    const entries = Object.entries(contagem)
      .filter(([k]) => k !== 'N/A').sort((a, b) => b[1] - a[1]).slice(0, 10);
    const labels = entries.map(([k]) => LabRender.LABELS_AREA[k] || k);
    estado.charts[canvasId] = new Chart(document.getElementById(canvasId), {
      type: 'bar',
      data: { labels, datasets: [{ data: entries.map(([, v]) => v), backgroundColor: CORES.azul }] },
      options: {
        indexAxis: 'y', responsive: true,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  function chartLine(canvasId, labels, valores, label, cor, opts) {
    destruir(canvasId);
    estado.charts[canvasId] = new Chart(document.getElementById(canvasId), {
      type: 'line',
      data: { labels, datasets: [{
        label, data: valores, borderColor: cor,
        backgroundColor: cor.replace('0.7', '0.15'),
        tension: 0.3, fill: true, pointRadius: 2
      }] },
      options: {
        responsive: true, plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: !opts.sugMin,
            suggestedMin: opts.sugMin, suggestedMax: opts.sugMax,
            ticks: opts.pctSuffix ? { callback: v => v + '%' } : {}
          },
          x: { ticks: { maxRotation: 45, font: { size: 10 } } }
        }
      }
    });
  }

  function chartBarVolume(canvasId, labels, valores) {
    destruir(canvasId);
    estado.charts[canvasId] = new Chart(document.getElementById(canvasId), {
      type: 'bar',
      data: { labels, datasets: [{ label: 'SAIs', data: valores, backgroundColor: CORES.azul }] },
      options: {
        responsive: true, plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          x: { ticks: { maxRotation: 45, font: { size: 10 } } }
        }
      }
    });
  }

  function chartDnaFreq(canvasId, areas) {
    destruir(canvasId);
    const labels = areas.map(a => a.label);
    const bg = areas.map(a =>
      a.idx_risco > 2.5 ? CORES.vermelho : a.idx_risco > 1.5 ? CORES.amarelo : CORES.verde
    );
    estado.charts[canvasId] = new Chart(document.getElementById(canvasId), {
      type: 'bar',
      data: { labels, datasets: [{ label: 'SAIs', data: areas.map(a => a.total), backgroundColor: bg }] },
      options: {
        indexAxis: 'y', responsive: true,
        plugins: { legend: { display: false },
          tooltip: { callbacks: { afterLabel: (ctx) => {
            const a = areas[ctx.dataIndex];
            return 'Risco: ' + a.idx_risco + ' | Complex: ' + a.idx_complexidade + ' | Alto risco: ' + a.pct_alto_risco + '%';
          } } }
        },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  async function carregarBacktest() {
    const data = await fetchJSON('/api/laboratorio/backtest');
    if (!data || !data.estrategias) { mostrarErro('Sem dados de backtest'); return; }
    AppLabBacktest.renderizar(data);
    const n = data.estrategias.length;
    const m = data.melhor ? ' | Melhor: ' + data.melhor.nome : '';
    els.status.textContent = n + ' estrategias' + m;
  }

  function destruir(id) {
    if (estado.charts[id]) { estado.charts[id].destroy(); delete estado.charts[id]; }
  }

  async function fetchJSON(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    } finally { clearTimeout(timer); }
  }

  function loading(show) { if (els.loading) els.loading.style.display = show ? 'flex' : 'none'; }
  function mostrarErro(msg) { if (els.erro) { els.erro.style.display = 'block'; els.erro.textContent = msg; } }
  function esconderErro() { if (els.erro) els.erro.style.display = 'none'; }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { estado };
})();
