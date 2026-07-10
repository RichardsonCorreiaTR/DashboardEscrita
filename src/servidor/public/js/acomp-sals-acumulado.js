/**
 * acomp-sals-acumulado.js - Visao Acumulado: todos analistas mes a mes
 * Grafico: tempo medio por SAL (min) por mes, uma linha por analista.
 */
/* eslint-disable no-unused-vars */
/* global Chart */
const AcompSalsAcumulado = (() => {
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const CORES = ['#3b82f6','#22c55e','#f97316','#a855f7','#ef4444',
                 '#14b8a6','#eab308','#ec4899','#6366f1','#0ea5e9','#84cc16','#f43f5e'];

  let _chart = null;

  function destruirChart() {
    if (_chart) { _chart.destroy(); _chart = null; }
  }

  function renderGrafico(analistas, container) {
    const wrap = document.getElementById('sal-acum-chart-wrap');
    if (!wrap) return;
    destruirChart();
    const canvas = wrap.querySelector('canvas');
    if (!canvas) return;

    const datasets = analistas
      .filter(a => Object.keys(a.mensal).length > 0)
      .map((a, i) => ({
        label: a.apelido,
        data: MESES.map((_, m) => {
          const d = a.mensal[m + 1];
          return d && d.qtd > 0 ? d.media : null;
        }),
        borderColor: CORES[i % CORES.length],
        backgroundColor: CORES[i % CORES.length] + '22',
        borderWidth: 2, pointRadius: 4, tension: 0.3,
        spanGaps: true
      }));

    // Linha de total (media de todos)
    const totalPorMes = MESES.map((_, m) => {
      let somaMedia = 0, count = 0;
      analistas.forEach(a => {
        const d = a.mensal[m + 1];
        if (d && d.qtd > 0) { somaMedia += d.media; count++; }
      });
      return count > 0 ? Math.round(somaMedia / count) : null;
    });
    datasets.unshift({
      label: '— Média geral',
      data: totalPorMes,
      borderColor: '#1e293b', borderWidth: 3, borderDash: [8, 4],
      pointRadius: 3, tension: 0.3, spanGaps: true,
      backgroundColor: 'transparent'
    });

    _chart = new Chart(canvas, {
      type: 'line',
      data: { labels: MESES, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 14 } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y ?? '—'} min` } }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Minutos por SAL' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function renderTabela(analistas) {
    const tEl = document.getElementById('sal-acum-tabela');
    if (!tEl) return;
    const colunas = MESES.map((m, i) => {
      let somaMedia = 0, count = 0;
      analistas.forEach(a => { const d = a.mensal[i+1]; if (d && d.qtd>0) { somaMedia += d.media; count++; } });
      return count > 0 ? Math.round(somaMedia / count) : null;
    });
    const ths = MESES.map(m => `<th>${m}</th>`).join('');
    const totalRow = `<tr style="background:#f8fafc;font-weight:700">
      <td>Média geral</td>
      ${colunas.map(v => `<td style="text-align:center">${v != null ? v + 'min' : '—'}</td>`).join('')}
    </tr>`;
    const analRow = analistas.filter(a => Object.keys(a.mensal).length).map(a =>
      `<tr><td><strong>${a.apelido}</strong></td>
        ${MESES.map((_, m) => {
          const d = a.mensal[m+1];
          return `<td style="text-align:center">${d && d.qtd > 0 ? d.media + 'min' : '—'}</td>`;
        }).join('')}
      </tr>`
    ).join('');
    tEl.innerHTML = `<table class="eq-tabela" style="font-size:0.75rem;overflow-x:auto;display:block">
      <thead><tr><th>Analista</th>${ths}</tr></thead>
      <tbody>${totalRow}${analRow}</tbody>
    </table>`;
  }

  function renderizar(analistas) {
    renderGrafico(analistas);
    renderTabela(analistas);
  }

  return { renderizar, destruirChart };
})();
