/**
 * proposta-metas-charts.js - Graficos e tabelas da retrospectiva 2025
 *
 * Depende de Chart.js (CDN) e proposta-metas-dados.js.
 * Carregar ANTES de app-proposta-metas.js.
 */

/* eslint-disable no-unused-vars */
const PropostaCharts = (() => {
  const { MESES, CORES } = PropostaDados;
  const charts = {};

  function criarGrafico(canvasId, analistas, meta) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (charts[canvasId]) charts[canvasId].destroy();

    const nomes = [...new Set(analistas.map(r => r.nome))];
    const datasets = nomes.map((nome, i) => {
      const dados = analistas.filter(r => r.nome === nome);
      const values = Array(12).fill(null);
      dados.forEach(d => {
        const val = meta.campoValor
          ? Number(d[meta.campoValor])
          : calcPct(d);
        if (val != null && !isNaN(val)) values[d.mes - 1] = +val.toFixed(1);
      });
      return {
        label: nome, data: values,
        borderColor: CORES[i % CORES.length],
        backgroundColor: CORES[i % CORES.length] + '33',
        tension: 0.3, fill: meta.tipoGrafico === 'bar',
        pointRadius: 4, borderWidth: 2
      };
    });

    charts[canvasId] = new Chart(ctx, {
      type: meta.tipoGrafico || 'line',
      data: { labels: MESES.slice(1), datasets },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: { beginAtZero: meta.unidade === '%', title: { display: true, text: meta.unidade } }
        }
      }
    });
  }

  function criarTabela(containerId, analistas, meta) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const nomes = [...new Set(analistas.map(r => r.nome))];
    const mesesAtivos = [...new Set(analistas.map(r => r.mes))].sort((a, b) => a - b);

    let html = '<table class="retro-tabela"><thead><tr><th>Analista</th>';
    mesesAtivos.forEach(m => { html += `<th>${MESES[m]}</th>`; });
    html += '<th>Media</th></tr></thead><tbody>';

    nomes.forEach(nome => {
      const dados = analistas.filter(r => r.nome === nome);
      html += `<tr><td><strong>${nome}</strong></td>`;
      let soma = 0, count = 0;
      mesesAtivos.forEach(m => {
        const d = dados.find(r => r.mes === m);
        if (d) {
          const val = meta.campoValor ? Number(d[meta.campoValor]) : calcPct(d);
          const fmt = formatVal(val, meta);
          const cls = corCelula(val, meta);
          html += `<td class="${cls}" title="${d[meta.campoCiclos] || 0} SAIs">${fmt}</td>`;
          soma += val; count++;
        } else {
          html += '<td class="retro-vazio">-</td>';
        }
      });
      const media = count > 0 ? soma / count : 0;
      html += `<td class="retro-media"><strong>${formatVal(media, meta)}</strong></td></tr>`;
    });

    html += '</tbody></table>';
    el.innerHTML = html;
  }

  function calcPct(d) {
    const t = Number(d.total_sais);
    const c = Number(d.com_estimativa);
    return t > 0 ? (c / t) * 100 : 0;
  }

  function formatVal(val, meta) {
    if (val == null || isNaN(val)) return '-';
    if (meta.unidade === '%') return val.toFixed(0) + '%';
    if (meta.unidade === 'pontos') return val.toFixed(1);
    return val.toFixed(1) + 'd';
  }

  function corCelula(val, meta) {
    if (val == null || isNaN(val)) return 'retro-vazio';
    if (meta.direcao === 'menor-melhor') {
      if (val <= 3) return 'retro-verde';
      if (val <= 5) return 'retro-amarelo';
      return 'retro-vermelho';
    }
    if (meta.unidade === '%') {
      if (val >= 80) return 'retro-verde';
      if (val >= 50) return 'retro-amarelo';
      return 'retro-vermelho';
    }
    return '';
  }

  return { criarGrafico, criarTabela };
})();
