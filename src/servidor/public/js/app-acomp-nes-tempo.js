/**
 * app-acomp-nes-tempo.js - Tempo por NE (detalhamento mensal)
 *
 * Filtros: analista, area (Escrita/Importacao), ano. Tabela por mes (acumulado)
 * com botao "Ver" que expande as NEs do mes. Filtro de situacao da SAI.
 * Grafico de tendencia da media de analise/NE. (Sem nivel de alteracao.)
 */
/* global Chart */
const AppAcompNesTempo = (() => {
  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  let _linhas = [];
  let _chart = null;
  let _situacoesSel = null; // null = todas; senao, Set com as situacoes escolhidas

  function fmtMin(min) {
    if (!min) return '0';
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  }

  async function init() {
    const me = await fetch('/auth/me').then(r => r.json()).catch(() => ({ logado: false }));
    if (!me.logado) { window.location.href = '/login.html'; return; }
    popularAnos();
    await popularFiltros();
    renderSituacaoPlaceholder();
    document.getElementById('salt-consultar').addEventListener('click', consultar);
  }

  function renderSituacaoPlaceholder() {
    const el = document.getElementById('salt-situacoes');
    if (!el) return;
    el.style.display = 'flex';
    el.innerHTML = '<span class="salt-sit-label">Situação da SAI:</span>' +
      '<span style="font-size:.8rem;color:var(--cor-texto-sec)">Padrão: Todas — as opções para filtrar aparecem aqui após clicar em Consultar.</span>';
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

  async function popularFiltros() {
    try {
      const r = await fetch('/api/acomp-nes/tempo-detalhado?filtros=1').then(x => x.json());
      const sel = document.getElementById('salt-analista');
      (r.filtros.analistas || []).forEach(a => {
        const o = document.createElement('option');
        o.value = a.sgd; o.textContent = `${a.apelido} (${a.senioridade})`;
        sel.appendChild(o);
      });
    } catch { /* mantem so 'Todos' */ }
  }

  async function consultar() {
    const analista = document.getElementById('salt-analista').value;
    const area = document.getElementById('salt-area').value;
    const ano = document.getElementById('salt-ano').value;
    const cont = document.getElementById('salt-conteudo');
    cont.innerHTML = '<div class="loading"><div class="loading__spinner"></div><span>Consultando banco (pode demorar)...</span></div>';
    document.getElementById('salt-chart-wrap').style.display = 'none';
    try {
      const url = `/api/acomp-nes/tempo-detalhado?ano=${ano}&analista=${analista}&area=${area}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(180000) }).then(x => x.json());
      if (r.erro) throw new Error(r.erro);
      _linhas = r.linhas || [];
      _situacoesSel = null; // reset: nova consulta volta para "Todas"
      render();
    } catch (e) {
      cont.innerHTML = `<p class="eq-sem-dados">Erro: ${e.message}</p>`;
    }
  }

  function escAttr(s) { return String(s).replace(/"/g, '&quot;'); }

  function linhasFiltradas() {
    if (!_situacoesSel) return _linhas;
    return _linhas.filter(l => _situacoesSel.has(l.situacao));
  }

  function renderFiltroSituacoes() {
    const el = document.getElementById('salt-situacoes');
    const sits = [...new Set(_linhas.map(l => l.situacao))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (!sits.length) { el.style.display = 'none'; return; }
    if (_situacoesSel === null) _situacoesSel = new Set(sits);
    const todas = sits.every(s => _situacoesSel.has(s));
    el.style.display = 'flex';
    el.innerHTML = '<span class="salt-sit-label">Situação da SAI:</span>' +
      `<label class="salt-sit-opt"><input type="checkbox" id="salt-sit-todas" ${todas ? 'checked' : ''}> <strong>Todas</strong></label>` +
      sits.map(s => `<label class="salt-sit-opt"><input type="checkbox" class="salt-sit-cb" value="${escAttr(s)}" ${_situacoesSel.has(s) ? 'checked' : ''}> ${s}</label>`).join('');
    el.querySelector('#salt-sit-todas').addEventListener('change', e => {
      _situacoesSel = e.target.checked ? new Set(sits) : new Set();
      renderFiltroSituacoes(); renderTabelaEGrafico();
    });
    el.querySelectorAll('.salt-sit-cb').forEach(cb => cb.addEventListener('change', () => {
      _situacoesSel = new Set([...el.querySelectorAll('.salt-sit-cb:checked')].map(x => x.value));
      renderFiltroSituacoes(); renderTabelaEGrafico();
    }));
  }

  function agruparPorMes() {
    const meses = {};
    for (let m = 1; m <= 12; m++) meses[m] = { qtd: 0, tA: 0, tD: 0, tT: 0, linhas: [] };
    linhasFiltradas().forEach(l => {
      const m = l.mes;
      if (!meses[m]) return;
      meses[m].qtd++;
      meses[m].tA += l.tempo_analise;
      meses[m].tD += l.tempo_definicao;
      meses[m].tT += l.tempo_total;
      meses[m].linhas.push(l);
    });
    return meses;
  }

  function render() {
    const cont = document.getElementById('salt-conteudo');
    if (!_linhas.length) {
      document.getElementById('salt-situacoes').style.display = 'none';
      document.getElementById('salt-chart-wrap').style.display = 'none';
      cont.innerHTML = '<p class="eq-sem-dados">Nenhuma NE encontrada para os filtros selecionados.</p>';
      return;
    }
    renderFiltroSituacoes();
    renderTabelaEGrafico();
  }

  function renderTabelaEGrafico() {
    const cont = document.getElementById('salt-conteudo');
    const meses = agruparPorMes();
    let totQtd = 0, totA = 0, totD = 0, totT = 0;

    const rows = [];
    for (let m = 1; m <= 12; m++) {
      const d = meses[m];
      if (!d.qtd) continue;
      totQtd += d.qtd; totA += d.tA; totD += d.tD; totT += d.tT;
      const mediaA = d.qtd ? Math.round(d.tA / d.qtd) : 0;
      rows.push(`
        <tr class="salt-mes-row" data-mes="${m}">
          <td>${MESES[m - 1]}</td>
          <td class="num">${d.qtd}</td>
          <td class="num">${fmtMin(d.tA)}</td>
          <td class="num">${fmtMin(d.tD)}</td>
          <td class="num">${fmtMin(d.tT)}</td>
          <td class="num">${fmtMin(mediaA)}</td>
          <td class="num"><button class="btn btn--sm btn--outline" data-ver="${m}" style="font-size:.72rem">Ver</button></td>
        </tr>
        <tr class="salt-detalhe-row" data-detalhe="${m}" style="display:none">
          <td colspan="7" class="salt-detalhe-wrap">${renderDetalhe(d.linhas)}</td>
        </tr>`);
    }
    if (!rows.length) {
      document.getElementById('salt-chart-wrap').style.display = 'none';
      cont.innerHTML = '<p class="eq-sem-dados">Nenhuma NE para as situações selecionadas.</p>';
      return;
    }
    const mediaTotalA = totQtd ? Math.round(totA / totQtd) : 0;

    cont.innerHTML = `
      <table class="salt-tabela">
        <thead><tr>
          <th>Mês</th><th class="num">NEs</th><th class="num">T. Análise</th>
          <th class="num">T. Definição</th><th class="num">T. Total</th>
          <th class="num">Média Análise/NE</th><th class="num">Detalhe</th>
        </tr></thead>
        <tbody>${rows.join('')}</tbody>
        <tfoot><tr class="salt-total-row">
          <td>Total</td><td class="num">${totQtd}</td><td class="num">${fmtMin(totA)}</td>
          <td class="num">${fmtMin(totD)}</td><td class="num">${fmtMin(totT)}</td>
          <td class="num">${fmtMin(mediaTotalA)}</td><td></td>
        </tr></tfoot>
      </table>`;

    cont.querySelectorAll('button[data-ver]').forEach(b => {
      b.addEventListener('click', () => {
        const m = b.dataset.ver;
        const row = cont.querySelector(`tr[data-detalhe="${m}"]`);
        const aberto = row.style.display !== 'none';
        row.style.display = aberto ? 'none' : '';
        b.textContent = aberto ? 'Ver' : 'Ocultar';
      });
    });

    renderChart(meses);
  }

  function renderDetalhe(linhas) {
    const rows = linhas
      .slice()
      .sort((a, b) => b.tempo_total - a.tempo_total)
      .map(l => `
        <tr>
          <td>${l.apelido}</td>
          <td>${l.i_psai}</td>
          <td>${l.i_sai || '—'}</td>
          <td class="num">${l.tempo_analise}</td>
          <td class="num">${l.tempo_definicao}</td>
          <td class="num"><strong>${l.tempo_total}</strong></td>
          <td>${l.situacao}</td>
        </tr>`).join('');
    return `
      <table class="salt-detalhe">
        <thead><tr>
          <th>Analista</th><th>PSAI</th><th>SAI</th>
          <th class="num">T. Análise (min)</th><th class="num">T. Definição (min)</th>
          <th class="num">T. Total (min)</th><th>Situação SAI</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
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
    const ctx = document.getElementById('salt-canvas').getContext('2d');
    _chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Média de análise por NE (min)',
          data,
          borderColor: 'rgba(59,130,246,0.9)',
          backgroundColor: 'rgba(59,130,246,0.08)',
          fill: true, tension: 0.3, pointRadius: 4
        }, tendenciaDataset(data)]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } },
        scales: { y: { beginAtZero: true, title: { display: true, text: 'Minutos', font: { size: 10 } } } }
      }
    });
  }

  function tendenciaDataset(data) {
    const n = data.length;
    if (n < 2) return { label: 'Tendência', data: [], borderColor: 'transparent' };
    const xm = (n - 1) / 2, ym = data.reduce((s, v) => s + v, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (i - xm) * (data[i] - ym); den += (i - xm) ** 2; }
    const slope = den ? num / den : 0;
    const b = ym - slope * xm;
    const linha = data.map((_, i) => Math.round(slope * i + b));
    const subindo = slope > 0;
    return {
      label: `Tendência (${subindo ? 'aumentando ▲' : slope < 0 ? 'diminuindo ▼' : 'estável'})`,
      data: linha,
      borderColor: subindo ? 'rgba(239,68,68,0.9)' : 'rgba(34,197,94,0.9)',
      borderDash: [6, 4], pointRadius: 0, fill: false, tension: 0
    };
  }

  document.addEventListener('DOMContentLoaded', init);
  return {};
})();
