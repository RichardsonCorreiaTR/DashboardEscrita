/**
 * feedback-equipe-visao.js - Visao geral da agenda da equipe no Feedback 1:1
 * Exibe todos os analistas do coordenador com indicacao de sessoes no mes.
 * Meta: cada analista deve ter >= 2 sessoes por mes.
 */
/* eslint-disable no-unused-vars */
const FeedbackEquipeVisao = (() => {
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const CARGO = { junior:'Jr', pleno:'Pl', senior:'Sr', especialista:'Esp' };
  let _todasSessoes = [];
  let _colaboradores = [];
  let _onAbrirColab = null;
  let _mesAtual = new Date().getMonth() + 1;
  let _anoAtual = new Date().getFullYear();

  function sessoesDoMes(slug, mes, ano) {
    return _todasSessoes.filter(s => {
      if (s.colaborador_slug !== slug || s.status === 'cancelado') return false;
      const d = new Date((s.data || '') + 'T12:00:00');
      return d.getFullYear() === ano && d.getMonth() + 1 === mes;
    });
  }

  function fmtData(data, horario) {
    const d = new Date(data + 'T12:00:00');
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    return `${dia}/${mes}` + (horario ? ` ${horario}` : ' (s/ hora)');
  }

  function renderControles(container) {
    const anosOpts = [2024,2025,2026,2027].map(a =>
      `<option value="${a}"${a===_anoAtual?' selected':''}>${a}</option>`).join('');
    const mesesOpts = MESES.map((m, i) =>
      `<option value="${i+1}"${i+1===_mesAtual?' selected':''}>${m}</option>`).join('');
    container.innerHTML = `
      <div class="fbev-filtros">
        <select id="fbev-mes" class="fbev-select">${mesesOpts}</select>
        <select id="fbev-ano" class="fbev-select">${anosOpts}</select>
      </div>
      <div id="fbev-grid"></div>`;
    document.getElementById('fbev-mes').addEventListener('change', e => {
      _mesAtual = parseInt(e.target.value); renderGrade();
    });
    document.getElementById('fbev-ano').addEventListener('change', e => {
      _anoAtual = parseInt(e.target.value); renderGrade();
    });
  }

  function renderLinha(colab) {
    const sessoes = sessoesDoMes(colab.slug, _mesAtual, _anoAtual);
    const qtd = sessoes.length;
    const alerta = qtd < 2;
    const cor = qtd === 0 ? '#ef4444' : qtd === 1 ? '#eab308' : '#22c55e';
    const icone = qtd === 0 ? '⚠' : qtd === 1 ? '⚡' : '✓';
    const datasHtml = sessoes.length
      ? sessoes.map(s => {
          const b = {agendado:'badge--info',realizado:'badge--verde'}[s.status]||'badge--cinza';
          return `<span class="badge ${b}" style="font-size:0.65rem">${fmtData(s.data, s.horario)}</span>`;
        }).join('')
      : '<span class="fbev-vazio">Nenhuma sessão</span>';
    return `
      <div class="fbev-linha${alerta ? ' fbev-linha--alerta' : ''}">
        <div class="fbev-analista-cell">
          <span class="fbev-icone" style="color:${cor}">${icone}</span>
          <button class="fbev-nome-btn" data-slug="${colab.slug}">${colab.apelido}</button>
          <span class="fbev-cargo">${CARGO[colab.senioridade]||''}</span>
        </div>
        <div class="fbev-prog-cell">
          <span class="fbev-qtd" style="color:${cor}">${qtd}<span class="fbev-meta">/2</span></span>
        </div>
        <div class="fbev-datas-cell">${datasHtml}</div>
        ${alerta
          ? `<div class="fbev-alerta-cell"><span style="color:${cor};font-size:0.72rem;font-weight:700">${qtd===0?'Sem agendamento':'Falta 1'}</span></div>`
          : '<div class="fbev-alerta-cell"></div>'}
      </div>`;
  }

  function renderGrade() {
    const grid = document.getElementById('fbev-grid');
    if (!grid) return;
    const semAgenda = _colaboradores.filter(c => sessoesDoMes(c.slug, _mesAtual, _anoAtual).length < 2);
    const cor = semAgenda.length > 0 ? '#ef4444' : '#22c55e';
    grid.innerHTML = `
      <div class="fbev-resumo">
        <span class="fbev-resumo-badge" style="background:${cor}22;color:${cor};border:1px solid ${cor}66">
          ${semAgenda.length === 0
            ? '✓ Todos com 2+ sessões no mês'
            : `⚠ ${semAgenda.length} analista(s) com menos de 2 sessões`}
        </span>
        <span class="fbev-legenda">
          <span style="color:#ef4444">⚠ Sem sessões</span>
          <span style="color:#eab308">⚡ 1 sessão</span>
          <span style="color:#22c55e">✓ 2+ sessões</span>
        </span>
      </div>
      <div class="fbev-grid-header">
        <span>Analista/Esp.</span><span>Sessões</span><span>Datas agendadas</span><span>Status</span>
      </div>
      <div class="fbev-grid-corpo">${_colaboradores.map(renderLinha).join('')}</div>`;
    grid.querySelectorAll('.fbev-nome-btn').forEach(btn => {
      btn.addEventListener('click', () => _onAbrirColab && _onAbrirColab(btn.dataset.slug));
    });
  }

  async function renderizar(container, coordSlug, colaboradores, onAbrirColab) {
    _colaboradores = colaboradores;
    _onAbrirColab = onAbrirColab;
    try {
      const resp = await fetch(`/api/feedback-1on1/sessoes?coord=${coordSlug}`);
      const dados = await resp.json();
      _todasSessoes = dados.sessoes || [];
    } catch { _todasSessoes = []; }
    renderControles(container);
    renderGrade();
  }

  return { renderizar };
})();
