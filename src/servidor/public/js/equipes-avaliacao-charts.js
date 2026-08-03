/**
 * equipes-avaliacao-charts.js - Graficos Chart.js da avaliacao equipe
 */
/* globals Chart */
const EquipesAvaliacaoCharts = (() => {
  let inst = [];

  function destruir() {
    inst.forEach(c => { try { c.destroy(); } catch (_) {} });
    inst = [];
  }

  function opts() {
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' } } }
    };
  }

  function bar(id, labels, vals) {
    const el = document.getElementById(id);
    if (!el || typeof Chart === 'undefined') return;
    inst.push(new Chart(el, {
      type: 'bar',
      data: { labels, datasets: [{ data: vals, backgroundColor: ['#3b82f6', '#8b5cf6', '#f59e0b'], borderRadius: 4 }] },
      options: opts()
    }));
  }

  function linha(id, labels, vals) {
    const el = document.getElementById(id);
    if (!el || typeof Chart === 'undefined') return;
    inst.push(new Chart(el, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Nota', data: vals, borderColor: '#22c55e', tension: 0.3 }] },
      options: opts()
    }));
  }

  return { destruir, bar, linha };
})();
