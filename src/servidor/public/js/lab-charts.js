/**
 * lab-charts.js - Graficos Chart.js do Laboratorio
 */
/* global Chart, LabRender */
const LabCharts = (() => {
  const CORES = {
    azul: 'rgba(59,130,246,0.7)', vermelho: 'rgba(239,68,68,0.7)',
    verde: 'rgba(34,197,94,0.7)', amarelo: 'rgba(234,179,8,0.7)',
    laranja: 'rgba(249,115,22,0.7)', cinza: 'rgba(148,163,184,0.5)'
  };
  const charts = {};

  function destruir(id) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  }

  function donut(id, contagem, ordem, cores) {
    destruir(id);
    const labels = ordem.filter(k => contagem[k]);
    const bg = labels.map(l => cores[ordem.indexOf(l)] || CORES.cinza);
    charts[id] = new Chart(document.getElementById(id), {
      type: 'doughnut',
      data: { labels, datasets: [{ data: labels.map(k => contagem[k]), backgroundColor: bg }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }

  function barHoriz(id, contagem) {
    destruir(id);
    const entries = Object.entries(contagem)
      .filter(([k]) => k !== 'N/A').sort((a, b) => b[1] - a[1]).slice(0, 10);
    charts[id] = new Chart(document.getElementById(id), {
      type: 'bar',
      data: {
        labels: entries.map(([k]) => LabRender.LABELS_AREA[k] || k),
        datasets: [{ data: entries.map(([, v]) => v), backgroundColor: CORES.azul }]
      },
      options: {
        indexAxis: 'y', responsive: true, plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  function line(id, labels, valores, label, cor, opts) {
    destruir(id);
    charts[id] = new Chart(document.getElementById(id), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label, data: valores, borderColor: cor,
          backgroundColor: cor.replace('0.7', '0.15'),
          tension: 0.3, fill: true, pointRadius: 2
        }]
      },
      options: {
        responsive: true, plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: !opts.sugMin, suggestedMin: opts.sugMin, suggestedMax: opts.sugMax,
            ticks: opts.pctSuffix ? { callback: v => v + '%' } : {}
          },
          x: { ticks: { maxRotation: 45, font: { size: 10 } } }
        }
      }
    });
  }

  function barVolume(id, labels, valores) {
    destruir(id);
    charts[id] = new Chart(document.getElementById(id), {
      type: 'bar',
      data: { labels, datasets: [{ label: 'SAIs', data: valores, backgroundColor: CORES.azul }] },
      options: {
        responsive: true, plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          x: { ticks: { maxRotation: 45, font: { size: 10 } } }
        }
      }
    });
  }

  function dnaFreq(id, areas) {
    destruir(id);
    const bg = areas.map(a =>
      a.idx_risco > 2.5 ? CORES.vermelho : a.idx_risco > 1.5 ? CORES.amarelo : CORES.verde
    );
    charts[id] = new Chart(document.getElementById(id), {
      type: 'bar',
      data: {
        labels: areas.map(a => a.label),
        datasets: [{ label: 'SAIs', data: areas.map(a => a.total), backgroundColor: bg }]
      },
      options: {
        indexAxis: 'y', responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => {
                const a = areas[ctx.dataIndex];
                return 'Risco: ' + a.idx_risco + ' | Complex: ' + a.idx_complexidade
                  + ' | Alto risco: ' + a.pct_alto_risco + '%';
              }
            }
          }
        },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  return { CORES, donut, barHoriz, line, barVolume, dnaFreq };
})();
