/**
 * app-laboratorio.js - Controller do Laboratorio de Previsibilidade
 *
 * Views: raio-x, evolucao, dna, backtest. Dados via API + LabCharts/LabRender.
 */
/* global LabRender, AppLabBacktest, LabCharts */
const AppLab = (() => {
  const C = LabCharts.CORES;
  const CORES_COMPLEX = [C.verde, C.azul, C.amarelo, C.laranja, C.vermelho];
  const CORES_RISCO = [C.verde, C.amarelo, C.laranja, C.vermelho];
  const ORDEM_COMPLEX = ['trivial', 'baixa', 'media', 'alta', 'sistemica'];
  const ORDEM_RISCO = ['baixo', 'medio', 'alto', 'critico'];
  const estado = { view: 'raio-x' };
  const els = {};

  function init() {
    cachearElementos();
    estado.view = new URLSearchParams(location.search).get('view') || 'raio-x';
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
    if (!versoes || !versoes.length) {
      mostrarErro('Sem dados de classificacao em data/ia/');
      els.status.textContent = 'Sem dados';
      return;
    }
    LabRender.renderSeletorVersoes(versoes, els.selVersao);
    els.selVersao.value = versoes[versoes.length - 1];
    els.selVersao.onchange = () => { loading(true); carregarRaioXVersao(els.selVersao.value); };
    await carregarRaioXVersao(els.selVersao.value);
  }

  async function carregarRaioXVersao(versao) {
    if (!versao) { mostrarErro('Selecione uma versao'); loading(false); return; }
    const d = await fetchJSON('/api/laboratorio/raio-x/' + encodeURIComponent(versao));
    if (d.erro) { mostrarErro(d.erro); loading(false); return; }
    LabRender.renderKPIs(d, els.rxKpis);
    LabCharts.donut('rx-complex', d.complexidades, ORDEM_COMPLEX, CORES_COMPLEX);
    LabCharts.donut('rx-risco', d.riscos, ORDEM_RISCO, CORES_RISCO);
    LabCharts.barHoriz('rx-areas', d.areas);
    LabRender.renderSais(d.sais, els.rxCriticas);
    els.status.textContent = versao + ' \u2014 ' + d.total + ' SAIs';
    loading(false);
  }

  async function carregarEvolucao() {
    const dados = await fetchJSON('/api/laboratorio/evolucao');
    if (!dados || !dados.length) { mostrarErro('Sem dados'); return; }
    const labels = dados.map(d => d.versao);
    LabCharts.line('ev-complex', labels, dados.map(d => d.idx_complexidade),
      'Complexidade Media', C.azul, { sugMin: 1, sugMax: 5 });
    LabCharts.line('ev-risco', labels, dados.map(d => d.pct_alto_risco),
      '% Alto Risco', C.vermelho, { sugMin: 0, pctSuffix: true });
    LabCharts.barVolume('ev-volume', labels, dados.map(d => d.total));
    els.status.textContent = dados.length + ' versoes analisadas';
  }

  async function carregarDNA() {
    const areas = await fetchJSON('/api/laboratorio/dna-tecnico');
    if (!areas || !areas.length) { mostrarErro('Sem dados'); return; }
    LabCharts.dnaFreq('dna-freq', areas);
    LabRender.renderDnaTabela(areas, els.dnaTabela);
    els.status.textContent = areas.length + ' areas tecnicas';
  }

  async function carregarBacktest() {
    const data = await fetchJSON('/api/laboratorio/backtest');
    if (!data || !data.estrategias) { mostrarErro('Sem dados de backtest'); return; }
    AppLabBacktest.renderizar(data);
    const m = data.melhor ? ' | Melhor: ' + data.melhor.nome : '';
    els.status.textContent = data.estrategias.length + ' estrategias' + m;
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
