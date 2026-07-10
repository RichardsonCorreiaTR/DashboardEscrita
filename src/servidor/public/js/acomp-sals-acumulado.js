/**
 * acomp-sals-acumulado.js - Acumulado: todos analistas agrupados por mes e nivel
 * Grafico: uma linha por nivel de SAL (Baixa/Media/Alta/Extra Alta)
 * Filtro de nivel acima do grafico com atualizacao automatica.
 */
/* eslint-disable no-unused-vars */
/* global Chart */
const AcompSalsAcumulado = (() => {
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const NIVEIS = { 1: 'Baixa', 2: 'Média', 3: 'Alta', 4: 'Extra Alta' };
  const CORES  = { 1: '#22c55e', 2: '#eab308', 3: '#f97316', 4: '#ef4444' };
  let _chart = null;
  let _agregado = {}; // { nivel: { mes: { tempo, qtd } } }

  function destruirChart() {
    if (_chart) { _chart.destroy(); _chart = null; }
  }

  // Agrega todos os analistas: soma tempo e qtd por nivel/mes
  function agregar(analistas) {
    _agregado = {};
    analistas.forEach(a => {
      Object.entries(a.mensal_nivel || {}).forEach(([nivel, meses]) => {
        if (!_agregado[nivel]) _agregado[nivel] = {};
        Object.entries(meses).forEach(([mes, d]) => {
          if (!_agregado[nivel][mes]) _agregado[nivel][mes] = { tempo: 0, qtd: 0 };
          _agregado[nivel][mes].tempo += d.tempo || 0;
          _agregado[nivel][mes].qtd   += d.qtd   || 0;
        });
      });
    });
  }

  function niveisAtivos() {
    return Array.from(document.querySelectorAll('.sal-acum-cb:checked')).map(el => Number(el.value));
  }

  function renderGrafico() {
    destruirChart();
    const canvas = document.getElementById('sal-acum-canvas');
    if (!canvas) return;
    const niveis = niveisAtivos();

    const datasets = niveis.map(n => {
      const dados = MESES.map((_, i) => {
        const d = _agregado[n] && _agregado[n][i + 1];
        return (d && d.qtd > 0) ? Math.round(d.tempo / d.qtd) : null;
      });
      return {
        label: NIVEIS[n],
        data: dados,
        borderColor: CORES[n],
        backgroundColor: CORES[n] + '22',
        borderWidth: 3, pointRadius: 5, tension: 0.3, spanGaps: true,
        fill: false
      };
    });

    // Linha de média geral (todos os niveis ativos, todos os meses)
    const mediaGeral = MESES.map((_, i) => {
      let somaT = 0, somaQ = 0;
      niveis.forEach(n => {
        const d = _agregado[n] && _agregado[n][i + 1];
        if (d) { somaT += d.tempo; somaQ += d.qtd; }
      });
      return somaQ > 0 ? Math.round(somaT / somaQ) : null;
    });
    datasets.unshift({
      label: '— Média geral',
      data: mediaGeral,
      borderColor: '#1e293b', borderWidth: 2, borderDash: [8, 4],
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
          tooltip: {
            callbacks: {
              label: ctx => {
                const v = ctx.parsed.y;
                if (v == null) return null;
                return `${ctx.dataset.label}: ${v} min/SAL`;
              }
            }
          }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Minutos por SAL' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function renderTabela() {
    const el = document.getElementById('sal-acum-tabela');
    if (!el) return;
    const niveis = niveisAtivos();
    const ths = ['Nível / Mês', ...MESES].map(h => `<th>${h}</th>`).join('');
    const linhas = niveis.map(n => {
      const tds = MESES.map((_, i) => {
        const d = _agregado[n] && _agregado[n][i + 1];
        if (!d || d.qtd === 0) return `<td style="text-align:center;opacity:.35">—</td>`;
        const media = Math.round(d.tempo / d.qtd);
        return `<td style="text-align:center"><strong style="color:${CORES[n]}">${media}min</strong><br><span style="font-size:.65rem;color:var(--cor-texto-sec)">${d.qtd} SALs</span></td>`;
      }).join('');
      return `<tr><td><span style="color:${CORES[n]};font-weight:700">${NIVEIS[n]}</span></td>${tds}</tr>`;
    }).join('');
    el.innerHTML = `<div style="overflow-x:auto;margin-top:.75rem">
      <table class="eq-tabela" style="font-size:.75rem;min-width:600px">
        <thead><tr>${ths}</tr></thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>`;
  }

  function atualizar() {
    renderGrafico();
    renderTabela();
  }

  function renderFiltros(container) {
    const wrap = document.createElement('div');
    wrap.className = 'sal-acum-filtros';
    wrap.innerHTML = `
      <span class="sal-acum-filtros__label">Filtrar nível:</span>
      ${Object.entries(NIVEIS).map(([n, label]) => `
        <label class="sal-nivel-opt">
          <input type="checkbox" class="sal-acum-cb" value="${n}" checked>
          <span style="color:${CORES[n]};font-weight:700">${label}</span>
        </label>`).join('')}`;
    const chartWrap = document.getElementById('sal-acum-chart-wrap');
    if (chartWrap && chartWrap.parentNode) chartWrap.parentNode.insertBefore(wrap, chartWrap);
    wrap.querySelectorAll('.sal-acum-cb').forEach(cb => cb.addEventListener('change', atualizar));
  }

  function renderizar(analistas) {
    agregar(analistas);
    renderFiltros();
    atualizar();
  }

  return { renderizar, destruirChart };
})();
