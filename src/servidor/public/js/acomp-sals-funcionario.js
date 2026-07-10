/**
 * acomp-sals-funcionario.js - Por Funcionario: mes a mes com filtro por nivel SAL
 * Niveis: 1=Baixa, 2=Media, 3=Alta, 4=Extra Alta
 */
/* eslint-disable no-unused-vars */
/* global Chart */
const AcompSalsFuncionario = (() => {
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const NIVEIS = { 1: 'Baixa', 2: 'Média', 3: 'Alta', 4: 'Extra Alta' };
  const CORES_NIVEL = { 1: '#22c55e', 2: '#eab308', 3: '#f97316', 4: '#ef4444' };
  let _chart = null;
  let _analistas = [];

  function destruirChart() {
    if (_chart) { _chart.destroy(); _chart = null; }
  }

  function niveisAtivos() {
    return Array.from(document.querySelectorAll('.sal-nivel-cb:checked')).map(el => Number(el.value));
  }

  function analistaAtivo() {
    const sel = document.getElementById('sal-func-select');
    return sel ? sel.value : null;
  }

  function renderGrafico(analista) {
    destruirChart();
    const canvas = document.getElementById('sal-func-canvas');
    if (!canvas || !analista) return;
    const niveis = niveisAtivos();
    if (!niveis.length) return;

    const datasets = niveis.map(n => {
      const dados = MESES.map((_, m) => {
        const d = analista.mensal_nivel[n] && analista.mensal_nivel[n][m + 1];
        return d && d.qtd > 0 ? d.media : null;
      });
      return {
        label: NIVEIS[n], data: dados,
        backgroundColor: CORES_NIVEL[n] + '55',
        borderColor: CORES_NIVEL[n],
        borderWidth: 2, borderRadius: 4, spanGaps: true
      };
    });

    _chart = new Chart(canvas, {
      type: 'bar',
      data: { labels: MESES, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 14 } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y ?? '—'} min/SAL` } }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Minutos por SAL' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function renderTabela(analista) {
    const el = document.getElementById('sal-func-tabela');
    if (!el || !analista) return;
    const niveis = niveisAtivos();
    const ths = ['Mês', ...niveis.map(n => NIVEIS[n] + ' (SALs / média)')].map(h => `<th>${h}</th>`).join('');
    const linhas = MESES.map((mes, m) => {
      const tds = niveis.map(n => {
        const d = analista.mensal_nivel[n] && analista.mensal_nivel[n][m + 1];
        if (!d || d.qtd === 0) return `<td style="text-align:center;opacity:.4">—</td>`;
        return `<td style="text-align:center">${d.qtd} SALs · <strong>${d.media}min</strong></td>`;
      }).join('');
      return `<tr><td><strong>${mes}</strong></td>${tds}</tr>`;
    }).join('');
    // Totais
    const totRow = niveis.map(n => {
      let soma = 0, qtd = 0;
      for (let m = 1; m <= 12; m++) {
        const d = analista.mensal_nivel[n] && analista.mensal_nivel[n][m];
        if (d) { soma += d.tempo; qtd += d.qtd; }
      }
      return `<td style="text-align:center;font-weight:700">${qtd} SALs · ${qtd > 0 ? Math.round(soma/qtd) + 'min' : '—'}</td>`;
    }).join('');
    el.innerHTML = `<table class="eq-tabela" style="font-size:0.78rem;width:100%">
      <thead><tr>${ths}</tr></thead>
      <tbody>${linhas}<tr style="background:#f8fafc"><td><strong>Total</strong></td>${totRow}</tr></tbody>
    </table>`;
  }

  function atualizar() {
    const slug = analistaAtivo();
    const analista = _analistas.find(a => a.slug === slug);
    renderGrafico(analista);
    renderTabela(analista);
  }

  function renderControles(analistas) {
    _analistas = analistas;
    const sel = document.getElementById('sal-func-select');
    if (!sel) return;
    sel.innerHTML = analistas.map(a => `<option value="${a.slug}">${a.apelido} (${a.senioridade})</option>`).join('');
    sel.addEventListener('change', atualizar);
    document.querySelectorAll('.sal-nivel-cb').forEach(cb => cb.addEventListener('change', atualizar));
    atualizar();
  }

  return { renderControles, atualizar, destruirChart };
})();
