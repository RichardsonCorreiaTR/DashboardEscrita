/**
 * app-nes-definicao-analista.js - NEs com Definicao do logado (ciencia de retrabalho)
 */
/* global NesTabela, NesGrafico */
const AppNesDefinicaoAnalista = (() => {
  let _dados = null;
  let _me = null;
  let _anoFiltro = String(new Date().getFullYear());

  async function init() {
    _me = await fetch('/auth/me').then(r => r.json()).catch(() => ({ logado: false }));
    if (!_me.logado) { window.location.href = '/login.html'; return; }
    const el = document.getElementById('header-usuario');
    if (el) el.textContent = _me.apelido || _me.usuario;
    await carregar();
  }

  async function carregar() {
    mostrarLoading(true);
    try {
      const resp = await fetch('/api/nes-definicao/dados');
      const json = await resp.json();
      if (!resp.ok) { mostrarErro(json.erro || 'Erro ao carregar'); return; }
      _dados = json;
      atualizarFiltroAnos();
      renderizar();
    } catch (e) {
      mostrarErro('Erro de rede: ' + e.message);
    } finally {
      mostrarLoading(false);
    }
  }

  function atualizarFiltroAnos() {
    const anos = [...new Set((_dados.versoes || []).map(v => v.ano).filter(Boolean))].sort();
    const sel = document.getElementById('ned-filtro-ano');
    const anoAtual = new Date().getFullYear();
    sel.innerHTML = '<option value="todos">Todos os anos</option>' +
      anos.map(a => '<option value="' + a + '"' + (a === anoAtual ? ' selected' : '') + '>' + a + '</option>').join('');
    if (anos.includes(anoAtual)) _anoFiltro = String(anoAtual);
    sel.onchange = e => { _anoFiltro = e.target.value; renderizar(); };
  }

  function labelsFiltrados() {
    if (_anoFiltro === 'todos') return _dados.labels || [];
    return [...new Set((_dados.versoes || [])
      .filter(v => String(v.ano) === String(_anoFiltro))
      .map(v => v.label || v.nome_aba))];
  }

  function renderResumoPessoal(slug, labels) {
    const vals = NesTabela.valoresPorAnalista(slug, labels, _dados.por_analista);
    const total = vals.reduce((s, v) => s + v, 0);
    const graves = contarGraves(slug, labels);
    const el = document.getElementById('ned-resumo');
    el.innerHTML =
      '<div class="ned-resumo-cards">' +
        '<div class="ned-card"><span class="ned-card-num">' + total + '</span>' +
          '<span class="ned-card-label">Suas NEs com definição</span></div>' +
        '<div class="ned-card"><span class="ned-card-num">' + graves + '</span>' +
          '<span class="ned-card-label">Marcadas como graves</span></div>' +
        '<div class="ned-card"><span class="ned-card-num">' + (labels[labels.length - 1] || '—') + '</span>' +
          '<span class="ned-card-label">Última versão no filtro</span></div>' +
      '</div>';
  }

  function contarGraves(slug, labels) {
    const por = (_dados.por_analista && _dados.por_analista[slug]) || {};
    let n = 0;
    labels.forEach(l => (por[l] || []).forEach(ne => { if (ne.grave) n++; }));
    return n;
  }

  function renderizar() {
    if (!_dados || !_me) return;
    const slug = _me.slug;
    const labels = labelsFiltrados();
    renderResumoPessoal(slug, labels);
    const cont = document.getElementById('ned-analistas');
    cont.innerHTML = '';
    const nome = _me.apelido || _me.usuario || slug;
    NesTabela.renderizarSecaoAnalista(slug, nome, { ..._dados, labels }, cont, labels);
  }

  function mostrarLoading(show) {
    const el = document.getElementById('ned-loading');
    if (el) el.style.display = show ? '' : 'none';
  }

  function mostrarErro(msg) {
    const el = document.getElementById('ned-erro');
    if (el) { el.textContent = msg; el.style.display = ''; }
  }

  document.addEventListener('DOMContentLoaded', init);
  return {};
})();
