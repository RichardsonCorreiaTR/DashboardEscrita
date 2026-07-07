/**
 * app-feedback-1on1.js - Controlador principal da pagina de feedback 1:1
 * Coordena carregamento de dados, lista de colaboradores e interacao.
 */
/* global FeedbackCalendario, FeedbackFormulario, FeedbackEquipeVisao */

const AppFeedback = (() => {
  let _config = { coordenadores: [], colaboradores: [] };
  let _sessoes = [];
  let _colaboradorAtivo = null;
  let _papel = null;
  let _slug = null;
  let _modoEquipe = false;

  async function init() {
    const me = await fetch('/auth/me').then(r => r.json());
    if (!me.logado) { window.location.href = '/login.html'; return; }
    _papel = me.papel; _slug = me.slug;
    document.getElementById('header-usuario').textContent = me.usuario;
    _config = await fetch('/api/feedback-1on1/config').then(r => r.json());
    FeedbackFormulario.configurar({ papel: _papel, slug: _slug,
      colaboradores: _config.colaboradores, onSalvo: aoSalvar });
    renderizarTituloEquipe();
    renderizarLista();
    if (_papel === 'coordenador') mostrarVisaoEquipe();
    else { const primeiro = colaboradoresVisiveis()[0]; if (primeiro) selecionarColaborador(primeiro.slug); }
  }

  function colaboradoresVisiveis() {
    if (_papel === 'coordenador') return _config.colaboradores.filter(c => c['coordenador-slug'] === _slug);
    return _config.colaboradores.filter(c => c.slug === _slug);
  }

  function renderizarLista() {
    const lista = document.getElementById('fb-lista-colab');
    if (!lista) return;
    let html = '';
    const membros = colaboradoresVisiveis();
    if (_papel === 'coordenador') {
      html += `<li class="fb-colab-item fb-colab-item--equipe${_modoEquipe ? ' fb-colab-item--ativo' : ''}" id="fb-btn-equipe">
        <span class="fb-colab-nome">📅 Visão da equipe</span>
      </li>`;
      membros.forEach(m => {
        html += `<li class="fb-colab-item${!_modoEquipe && _colaboradorAtivo === m.slug ? ' fb-colab-item--ativo' : ''}" data-slug="${m.slug}">
          <span class="fb-colab-nome">${m.apelido}</span>
          <span class="fb-colab-cargo">${labelCargo(m.senioridade)}</span>
        </li>`;
      });
    } else {
      const eu = membros[0];
      if (eu) html += `<li class="fb-colab-item" data-slug="${eu.slug}"><span class="fb-colab-nome">${eu.nome}</span></li>`;
    }
    lista.innerHTML = html;
    document.getElementById('fb-btn-equipe') && document.getElementById('fb-btn-equipe').addEventListener('click', mostrarVisaoEquipe);
    lista.querySelectorAll('.fb-colab-item[data-slug]').forEach(item => {
      item.addEventListener('click', () => selecionarColaborador(item.dataset.slug));
    });
  }

  function mostrarVisaoEquipe() {
    _modoEquipe = true;
    _colaboradorAtivo = null;
    renderizarLista();
    document.getElementById('fb-conteudo').style.display = 'none';
    document.getElementById('fb-main-header').style.display = 'none';
    const painel = document.getElementById('fb-visao-equipe');
    painel.style.display = '';
    const coord = _config.coordenadores.find(c => c.slug === _slug);
    const membros = colaboradoresVisiveis();
    FeedbackEquipeVisao.renderizar(painel, _slug, membros, slug => selecionarColaborador(slug));
    document.getElementById('fb-equipe-titulo').textContent = coord ? `Equipe de ${coord.apelido}` : 'Minha equipe';
  }

  function mostrarVisaoIndividual() {
    _modoEquipe = false;
    document.getElementById('fb-conteudo').style.display = 'flex';
    document.getElementById('fb-main-header').style.display = 'flex';
    document.getElementById('fb-visao-equipe').style.display = 'none';
    renderizarLista();
  }

  function renderizarTituloEquipe() {
    const el = document.getElementById('fb-equipe-titulo');
    if (!el) return;
    if (_papel === 'coordenador') {
      const coord = _config.coordenadores.find(c => c.slug === _slug);
      el.textContent = coord ? `Equipe de ${coord.apelido}` : 'Minha equipe';
    } else {
      el.textContent = 'Meus feedbacks';
    }
  }

  function labelCargo(senioridade) {
    const map = { junior: 'Júnior', pleno: 'Pleno', senior: 'Sênior',
      especialista: 'Especialista', coordenador: 'Coordenador' };
    return map[senioridade] || senioridade;
  }

  async function selecionarColaborador(slug) {
    _colaboradorAtivo = slug;
    mostrarVisaoIndividual();
    document.querySelectorAll('.fb-colab-item').forEach(el => {
      el.classList.toggle('fb-colab-item--ativo', el.dataset.slug === slug);
    });
    const colab = _config.colaboradores.find(c => c.slug === slug);
    document.getElementById('fb-colab-titulo').textContent = colab ? colab.nome : slug;
    const ano = new Date().getFullYear();
    const resp = await fetch(`/api/feedback-1on1/sessoes?colaborador=${slug}&ano=${ano}`);
    const dados = await resp.json();
    _sessoes = dados.sessoes || [];
    if (typeof FeedbackAlertas !== 'undefined') {
      FeedbackAlertas.agendarTodos(_sessoes, _config.colaboradores);
    }
    const coord = colab ? _config.coordenadores.find(c => c.slug === colab['coordenador-slug']) : null;
    FeedbackCalendario.configurar({
      sessoes: _sessoes,
      onAgendar: _papel === 'coordenador' ? data => {
        FeedbackFormulario.abrir({ data, colaboradorSlug: slug, coordenadorSlug: coord ? coord.slug : '' });
      } : null,
      onAbrir: sessao => FeedbackFormulario.abrir({ sessao })
    });
    renderizarHistorico();
    renderizarProxima(slug, coord);
  }

  function renderizarProxima(slug, coord) {
    const el = document.getElementById('fb-proxima');
    if (!el || _papel !== 'coordenador') return;
    const realizadas = _sessoes.filter(s => s.status !== 'cancelado').sort((a, b) => b.data.localeCompare(a.data));
    const ultima = realizadas[0];
    if (!ultima) {
      el.innerHTML = `<button class="btn btn--outline btn--sm" id="btn-agendar-primeira">+ Agendar primeiro 1:1</button>`;
    } else {
      const proxData = calcularProxData(ultima.data);
      el.innerHTML = `<span class="fb-proxima-texto">Próxima sugerida: <strong>${proxData}</strong></span>
        <button class="btn btn--outline btn--sm" id="btn-agendar-prox">+ Agendar</button>`;
      document.getElementById('btn-agendar-prox').addEventListener('click', () => {
        FeedbackFormulario.abrir({ data: proxData, colaboradorSlug: slug, coordenadorSlug: coord ? coord.slug : '' });
      });
    }
    document.getElementById('btn-agendar-primeira') && document.getElementById('btn-agendar-primeira').addEventListener('click', () => {
      FeedbackFormulario.abrir({ data: new Date().toISOString().slice(0,10), colaboradorSlug: slug, coordenadorSlug: coord ? coord.slug : '' });
    });
  }

  function calcularProxData(dataBase) {
    const d = new Date(dataBase + 'T12:00:00');
    d.setDate(d.getDate() + 15);
    while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  function renderizarHistorico() {
    const el = document.getElementById('fb-historico');
    if (!el) return;
    if (!_sessoes.length) { el.innerHTML = '<p class="fb-vazio">Nenhuma sessão registrada.</p>'; return; }
    const sorted = [..._sessoes].sort((a, b) => b.data.localeCompare(a.data));
    el.innerHTML = sorted.map(s => {
      const dataFmt = new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR',
        { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
      const horarioFmt = s.horario ? ` · ${s.horario}` : '';
      const badge = { agendado: 'badge--info', realizado: 'badge--verde', cancelado: 'badge--cinza' }[s.status] || '';
      const preenchido = s.dados_colaborador && s.dados_colaborador.preenchido_em ? '✓ Colab.' : '';
      return `<div class="fb-item" data-id="${s.id}">
        <span class="fb-item-data">${dataFmt}${horarioFmt}</span>
        <span class="badge ${badge}">${s.status}</span>
        <span class="fb-item-check">${preenchido}</span>
        <button class="btn btn--sm btn--outline fb-btn-abrir" data-id="${s.id}">Abrir</button>
      </div>`;
    }).join('');
    el.querySelectorAll('.fb-btn-abrir').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = _sessoes.find(x => x.id === btn.dataset.id);
        if (s) FeedbackFormulario.abrir({ sessao: s });
      });
    });
  }

  async function aoSalvar() {
    if (_colaboradorAtivo) await selecionarColaborador(_colaboradorAtivo);
  }

  document.addEventListener('DOMContentLoaded', init);
  return {};
})();
