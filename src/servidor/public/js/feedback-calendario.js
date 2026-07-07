/**
 * feedback-calendario.js - Componente de calendario mensal para sessoes 1:1
 * Renderiza grade mensal com navegacao e marcacao de sessoes agendadas/realizadas.
 */
/* eslint-disable no-unused-vars */
const FeedbackCalendario = (() => {
  let _sessoes = [];
  let _mesAtual = new Date().getMonth();
  let _anoAtual = new Date().getFullYear();
  let _onAgendar = null;
  let _onAbrir = null;

  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const DIAS_NOME = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  function ehDiaUtil(data) {
    const dow = new Date(data + 'T12:00:00').getDay();
    return dow >= 1 && dow <= 5;
  }

  function sessoesNaData(data) {
    return _sessoes.filter(s => s.data === data);
  }

  function classeDia(data, sessoesDia) {
    if (!ehDiaUtil(data)) return 'cal-dia--fds';
    if (!sessoesDia.length) return 'cal-dia--livre';
    if (sessoesDia.some(s => s.status === 'realizado')) return 'cal-dia--realizado';
    if (sessoesDia.some(s => s.status === 'agendado')) return 'cal-dia--agendado';
    return 'cal-dia--livre';
  }

  function renderizarCabecalho(ano, mes) {
    const dias = DIAS_NOME.map(d => `<div class="cal-nome-dia">${d}</div>`).join('');
    return `
      <div class="cal-nav-bar">
        <button class="cal-nav-btn" data-dir="-1">&#8249;</button>
        <span class="cal-mes-titulo">${MESES[mes]} ${ano}</span>
        <button class="cal-nav-btn" data-dir="1">&#8250;</button>
      </div>
      <div class="cal-grid-header">${dias}</div>`;
  }

  function renderizarDias(ano, mes) {
    const primeiroDia = new Date(ano, mes, 1);
    const totalDias = new Date(ano, mes + 1, 0).getDate();
    const inicioPad = primeiroDia.getDay();
    let html = '<div class="cal-grid">';
    for (let i = 0; i < inicioPad; i++) html += '<div class="cal-dia cal-dia--vazio"></div>';
    for (let d = 1; d <= totalDias; d++) {
      const data = `${ano}-${String(mes + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const sessoesDia = sessoesNaData(data);
      const classe = classeDia(data, sessoesDia);
      const clicavel = classe !== 'cal-dia--fds' ? 'cal-dia--clicavel' : '';
      const ponto = sessoesDia.length ? '<span class="cal-ponto"></span>' : '';
      html += `<div class="cal-dia ${classe} ${clicavel}" data-data="${data}">
        <span class="cal-num">${d}</span>${ponto}</div>`;
    }
    return html + '</div>';
  }

  function montar(ano, mes) {
    const container = document.getElementById('cal-container');
    if (!container) return;
    container.innerHTML = renderizarCabecalho(ano, mes) + renderizarDias(ano, mes);
    container.querySelectorAll('.cal-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => navegar(parseInt(btn.dataset.dir)));
    });
    container.querySelectorAll('.cal-dia--clicavel').forEach(dia => {
      dia.addEventListener('click', () => {
        const data = dia.dataset.data;
        const sessoesDia = sessoesNaData(data);
        if (sessoesDia.length && _onAbrir) _onAbrir(sessoesDia[0]);
        else if (!sessoesDia.length && _onAgendar) _onAgendar(data);
      });
    });
  }

  function navegar(dir) {
    _mesAtual += dir;
    if (_mesAtual > 11) { _mesAtual = 0; _anoAtual++; }
    if (_mesAtual < 0) { _mesAtual = 11; _anoAtual--; }
    montar(_anoAtual, _mesAtual);
  }

  function configurar({ sessoes, onAgendar, onAbrir }) {
    _sessoes = sessoes || [];
    _onAgendar = onAgendar || null;
    _onAbrir = onAbrir || null;
    montar(_anoAtual, _mesAtual);
  }

  function atualizarSessoes(sessoes) {
    _sessoes = sessoes || [];
    montar(_anoAtual, _mesAtual);
  }

  return { configurar, atualizarSessoes };
})();
