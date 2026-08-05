/**
 * app-acomp-tempo-analista.js - Tempo por SAL/NE/SAM (somente o logado)
 * CFG: window.ACOMP_CFG = { modo, label, apiDetalhe } ou body[data-acomp]
 */
/* global Chart */
const AppAcompTempoAnalista = (() => {
  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const NIVEL_COR = { 1: '#22c55e', 2: '#eab308', 3: '#f97316', 4: '#ef4444' };
  const CFG = window.ACOMP_CFG || {};
  const modo = CFG.modo || document.body.dataset.acomp || 'sal';
  const isNivel = modo === 'sal' || modo === 'sam';
  const labelItem = CFG.label || (modo === 'ne' ? 'NE' : modo === 'sam' ? 'SAM/SAIL' : 'SAL');
  let _linhas = [], _chart = null, _situacoesSel = null, _sgd = null;

  function fmtMin(min) {
    if (!min) return '0';
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return h > 0 ? h + 'h ' + m + 'min' : m + 'min';
  }

  function apiBase() {
    if (CFG.apiDetalhe) return CFG.apiDetalhe;
    if (modo === 'ne') return '/api/acomp-nes/tempo-detalhado';
    if (modo === 'sam') return '/api/acomp-sams/tempo-detalhado';
    return '/api/acomp-sals/tempo-detalhado';
  }

  async function init() {
    const me = await fetch('/auth/me').then(r => r.json()).catch(() => ({ logado: false }));
    if (!me.logado) { window.location.href = '/login.html'; return; }
    popularAnos();
    const filtros = await fetch(apiBase() + '?filtros=1').then(r => r.json());
    const eu = (filtros.filtros && filtros.filtros.analistas || [])[0];
    _sgd = eu ? eu.sgd : null;
    const elNome = document.getElementById('salt-meu-nome');
    if (elNome && eu) elNome.textContent = eu.apelido + ' (' + eu.senioridade + ')';
    document.getElementById('salt-consultar').addEventListener('click', consultar);
  }

  function popularAnos() {
    const sel = document.getElementById('salt-ano');
    const atual = new Date().getFullYear();
    for (let a = atual; a >= atual - 3; a--) {
      const o = document.createElement('option');
      o.value = a; o.textContent = a;
      if (a === atual) o.selected = true;
      sel.appendChild(o);
    }
  }

  async function consultar() {
    const ano = document.getElementById('salt-ano').value;
    const cont = document.getElementById('salt-conteudo');
    cont.innerHTML = '<div class="loading"><div class="loading__spinner"></div><span>Consultando banco...</span></div>';
    document.getElementById('salt-chart-wrap').style.display = 'none';
    let url = apiBase() + '?ano=' + ano + '&analista=' + encodeURIComponent(_sgd || '');
    if (isNivel) url += '&nivel=' + (document.getElementById('salt-nivel').value || 'todos');
    else url += '&area=' + (document.getElementById('salt-area').value || 'Escrita');
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(180000) }).then(x => x.json());
      if (r.erro) throw new Error(r.erro);
      _linhas = r.linhas || [];
      _situacoesSel = null;
      render();
    } catch (e) {
      cont.innerHTML = '<p class="eq-sem-dados">Erro: ' + e.message + '</p>';
    }
  }

  function linhasFiltradas() {
    return _situacoesSel ? _linhas.filter(l => _situacoesSel.has(l.situacao)) : _linhas;
  }

  function renderFiltroSituacoes() {
    const el = document.getElementById('salt-situacoes');
    const sits = [...new Set(_linhas.map(l => l.situacao))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (!sits.length) { el.style.display = 'none'; return; }
    if (_situacoesSel === null) _situacoesSel = new Set(sits);
    const todas = sits.every(s => _situacoesSel.has(s));
    el.style.display = 'flex';
    el.innerHTML = '<span class="salt-sit-label">Situação:</span>' +
      '<label class="salt-sit-opt"><input type="checkbox" id="salt-sit-todas"' + (todas ? ' checked' : '') +
      '> <strong>Todas</strong></label>' +
      sits.map(s => '<label class="salt-sit-opt"><input type="checkbox" class="salt-sit-cb" value="' +
        String(s).replace(/"/g, '&quot;') + '"' + (_situacoesSel.has(s) ? ' checked' : '') + '> ' + s + '</label>').join('');
    el.querySelector('#salt-sit-todas').onchange = e => {
      _situacoesSel = e.target.checked ? new Set(sits) : new Set();
      renderFiltroSituacoes(); renderTabela();
    };
    el.querySelectorAll('.salt-sit-cb').forEach(cb => {
      cb.onchange = () => {
        _situacoesSel = new Set([...el.querySelectorAll('.salt-sit-cb:checked')].map(x => x.value));
        renderFiltroSituacoes(); renderTabela();
      };
    });
  }

  function render() {
    if (!_linhas.length) {
      document.getElementById('salt-situacoes').style.display = 'none';
      document.getElementById('salt-chart-wrap').style.display = 'none';
      document.getElementById('salt-conteudo').innerHTML =
        '<p class="eq-sem-dados">Nenhuma ' + labelItem + ' encontrada.</p>';
      return;
    }
    renderFiltroSituacoes();
    renderTabela();
  }

  function renderTabela() {
    const meses = {};
    for (let m = 1; m <= 12; m++) meses[m] = { qtd: 0, tA: 0, tD: 0, tT: 0, linhas: [] };
    linhasFiltradas().forEach(l => {
      if (!meses[l.mes]) return;
      meses[l.mes].qtd++; meses[l.mes].tA += l.tempo_analise;
      meses[l.mes].tD += l.tempo_definicao; meses[l.mes].tT += l.tempo_total;
      meses[l.mes].linhas.push(l);
    });
    let totQ = 0, totA = 0, totD = 0, totT = 0;
    const rows = [];
    for (let m = 1; m <= 12; m++) {
      const d = meses[m];
      if (!d.qtd) continue;
      totQ += d.qtd; totA += d.tA; totD += d.tD; totT += d.tT;
      rows.push('<tr><td>' + MESES[m - 1] + '</td><td class="num">' + d.qtd +
        '</td><td class="num">' + fmtMin(d.tA) + '</td><td class="num">' + fmtMin(d.tD) +
        '</td><td class="num">' + fmtMin(d.tT) + '</td><td class="num">' +
        fmtMin(Math.round(d.tA / d.qtd)) +
        '</td><td class="num"><button class="btn btn--sm btn--outline" data-ver="' + m +
        '" style="font-size:.72rem">Ver</button></td></tr>' +
        '<tr data-detalhe="' + m + '" style="display:none"><td colspan="7" class="salt-detalhe-wrap">' +
        renderDetalhe(d.linhas) + '</td></tr>');
    }
    const cont = document.getElementById('salt-conteudo');
    if (!rows.length) {
      cont.innerHTML = '<p class="eq-sem-dados">Nenhum registro para as situações.</p>';
      return;
    }
    cont.innerHTML = '<table class="salt-tabela"><thead><tr><th>Mês</th><th class="num">' +
      labelItem + 's</th><th class="num">T. Análise</th><th class="num">T. Definição</th>' +
      '<th class="num">T. Total</th><th class="num">Média Análise</th><th class="num">Detalhe</th>' +
      '</tr></thead><tbody>' + rows.join('') + '</tbody><tfoot><tr class="salt-total-row"><td>Total</td>' +
      '<td class="num">' + totQ + '</td><td class="num">' + fmtMin(totA) + '</td><td class="num">' +
      fmtMin(totD) + '</td><td class="num">' + fmtMin(totT) + '</td><td class="num">' +
      fmtMin(totQ ? Math.round(totA / totQ) : 0) + '</td><td></td></tr></tfoot></table>';
    cont.querySelectorAll('button[data-ver]').forEach(b => {
      b.onclick = () => {
        const row = cont.querySelector('tr[data-detalhe="' + b.dataset.ver + '"]');
        const aberto = row.style.display !== 'none';
        row.style.display = aberto ? 'none' : '';
        b.textContent = aberto ? 'Ver' : 'Ocultar';
      };
    });
    renderChart(meses);
  }

  function renderDetalhe(linhas) {
    const head = '<th>PSAI</th><th>SAI</th>' + (isNivel ? '<th>Nível</th>' : '') +
      '<th class="num">Análise</th><th class="num">Definição</th><th class="num">Total</th><th>Situação</th>';
    const body = linhas.slice().sort((a, b) => b.tempo_total - a.tempo_total).map(l =>
      '<tr><td>' + l.i_psai + '</td><td>' + (l.i_sai || '—') + '</td>' +
      (isNivel ? '<td><span class="salt-badge" style="color:' + (NIVEL_COR[l.nivel] || '#64748b') +
        '">' + l.nivel_nome + '</span></td>' : '') +
      '<td class="num">' + l.tempo_analise + '</td><td class="num">' + l.tempo_definicao +
      '</td><td class="num"><strong>' + l.tempo_total + '</strong></td><td>' + l.situacao + '</td></tr>'
    ).join('');
    return '<table class="salt-detalhe"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  function renderChart(meses) {
    const wrap = document.getElementById('salt-chart-wrap');
    wrap.style.display = '';
    const labels = [], data = [];
    for (let m = 1; m <= 12; m++) {
      if (!meses[m].qtd) continue;
      labels.push(MESES[m - 1]);
      data.push(Math.round(meses[m].tA / meses[m].qtd));
    }
    if (_chart) { _chart.destroy(); _chart = null; }
    _chart = new Chart(document.getElementById('salt-canvas').getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Média análise/' + labelItem + ' (min)', data,
          borderColor: 'rgba(59,130,246,0.9)', backgroundColor: 'rgba(59,130,246,0.08)',
          fill: true, tension: 0.3, pointRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true, title: { display: true, text: 'Minutos' } } }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
  return {};
})();
