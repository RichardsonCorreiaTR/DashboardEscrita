/**
 * app-nes-definicao.js - Controlador principal da pagina NEs com Definicao
 * Carrega dados do Excel parseado, renderiza tabela resumo e secao por analista.
 */
/* global NesTabela, NesGrafico */

const AppNesDefinicao = (() => {
  let _dados = null;
  let _config = null;
  let _papel = null;
  let _anoFiltro = String(new Date().getFullYear());

  async function init() {
    const me = await fetch('/auth/me').then(r => r.json());
    if (!me.logado) { window.location.href = '/login.html'; return; }
    _papel = me.papel;
    document.getElementById('header-usuario').textContent = me.usuario;

    if (_papel === 'coordenador') {
      document.getElementById('ned-upload-area').style.display = '';
      document.getElementById('ned-btn-atualizar').addEventListener('click', atualizar);
      document.getElementById('ned-input-arquivo').addEventListener('change', uploadArquivo);
    }

    _config = await fetch('/api/feedback-1on1/config').then(r => r.json());
    await carregarDados(false);
  }

  async function carregarDados(forcar) {
    mostrarLoading(true);
    try {
      const url = '/api/nes-definicao/dados' + (forcar ? '?forcar=1' : '');
      const resp = await fetch(url);
      if (!resp.ok) {
        const err = await resp.json();
        mostrarErro(err.erro || 'Erro ao carregar dados');
        return;
      }
      _dados = await resp.json();
      atualizarFiltroAnos();
      renderizar();
    } catch (e) {
      mostrarErro('Erro de rede: ' + e.message);
    } finally {
      mostrarLoading(false);
    }
  }

  function atualizarFiltroAnos() {
    const anoAtual = new Date().getFullYear();
    const anos = [...new Set(_dados.versoes.map(v => v.ano).filter(Boolean))].sort();
    const sel = document.getElementById('ned-filtro-ano');
    sel.innerHTML = '<option value="todos">Todos os anos</option>' +
      anos.map(a => `<option value="${a}"${a === anoAtual ? ' selected' : ''}>${a}</option>`).join('');
    // Garante que o filtro esta no ano atual se ele existir nos dados
    if (anos.includes(anoAtual)) _anoFiltro = String(anoAtual);
    sel.addEventListener('change', e => { _anoFiltro = e.target.value; renderizar(); });
  }

  function labelsFiltrados() {
    if (_anoFiltro === 'todos') return _dados.labels;
    const versoesFiltradas = _dados.versoes.filter(v => String(v.ano) === String(_anoFiltro));
    return [...new Set(versoesFiltradas.map(v => v.label || v.nome_aba))];
  }

  function renderizar() {
    if (!_dados || !_config) return;
    const labels = labelsFiltrados();

    NesTabela.renderizarResumo(_dados, document.getElementById('ned-resumo'));

    const tabelaContainer = document.getElementById('ned-tabela-geral');
    NesTabela.renderizarTabelaGeral(
      _config.colaboradores.filter(c => _dados.por_analista[c.slug]),
      { ..._dados, labels },
      tabelaContainer
    );

    const analistas = document.getElementById('ned-analistas');
    analistas.innerHTML = '';
    const todos = _config.colaboradores.filter(c => {
      const vals = NesTabela.valoresPorAnalista(c.slug, labels, _dados.por_analista);
      return vals.some(v => v > 0);
    });

    if (!todos.length) {
      analistas.innerHTML = '<p class="ned-vazio" style="padding:1rem">Nenhum analista com NEs neste período.</p>';
      return;
    }

    todos.sort((a, b) => {
      const ta = NesTabela.valoresPorAnalista(a.slug, labels, _dados.por_analista).reduce((s, v) => s + v, 0);
      const tb = NesTabela.valoresPorAnalista(b.slug, labels, _dados.por_analista).reduce((s, v) => s + v, 0);
      return tb - ta;
    });

    todos.forEach(a => {
      NesTabela.renderizarSecaoAnalista(a.slug, a.nome, { ..._dados, labels }, analistas, labels);
    });
  }

  async function atualizar() {
    mostrarLoading(true);
    const resp = await fetch('/api/nes-definicao/atualizar', { method: 'POST' });
    const r = await resp.json();
    mostrarLoading(false);
    if (r.ok) { alert(`Atualizado! ${r.versoes} versões carregadas.`); await carregarDados(true); }
    else alert('Erro: ' + r.erro);
  }

  async function uploadArquivo(e) {
    const file = e.target.files[0];
    if (!file) return;
    mostrarLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const resp = await fetch('/api/nes-definicao/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buffer
      });
      const r = await resp.json();
      if (r.ok) { alert(`Importado! ${r.versoes} versões carregadas.`); await carregarDados(true); }
      else alert('Erro: ' + r.erro);
    } finally { mostrarLoading(false); e.target.value = ''; }
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
