/**
 * nes-definicao-grafico.js - Graficos de tendencia de NEs com Definicao por analista
 * Usa Chart.js (CDN). Quanto mais NEs = pior.
 */
/* eslint-disable no-unused-vars */
/* global Chart */
const NesGrafico = (() => {
  const _charts = {};

  function destruir(canvasId) {
    if (_charts[canvasId]) { _charts[canvasId].destroy(); delete _charts[canvasId]; }
  }

  // Calcula tendencia linear: retorna slope (pos=piora, neg=melhora)
  function calcularTendencia(valores) {
    const n = valores.length;
    if (n < 2) return 0;
    const mx = (n - 1) / 2;
    const my = valores.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    valores.forEach((y, i) => { num += (i - mx) * (y - my); den += (i - mx) ** 2; });
    return den === 0 ? 0 : num / den;
  }

  function indicadorTendencia(slope, ultimoValor) {
    if (ultimoValor === 0 && slope <= 0) return { icone: '✓', cor: '#22c55e', texto: 'zerado' };
    if (slope < -0.1) return { icone: '↓', cor: '#22c55e', texto: 'melhorando' };
    if (slope > 0.1) return { icone: '↑', cor: '#ef4444', texto: 'piorando' };
    return { icone: '→', cor: '#eab308', texto: 'estável' };
  }

  function linhasTendencia(labels, valores) {
    const slope = calcularTendencia(valores);
    const n = valores.length;
    const mx = (n - 1) / 2;
    const my = valores.reduce((a, b) => a + b, 0) / n;
    return labels.map((_, i) => +(my + slope * (i - mx)).toFixed(2));
  }

  function renderizar(canvasId, nomeAnalista, labels, valores) {
    destruir(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const slope = calcularTendencia(valores);
    const ultimo = valores[valores.length - 1] ?? 0;
    const tend = indicadorTendencia(slope, ultimo);
    const tendLine = linhasTendencia(labels, valores);

    _charts[canvasId] = new Chart(canvas, {
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'NEs com definição',
            data: valores,
            backgroundColor: valores.map(v => v === 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.4)'),
            borderColor: valores.map(v => v === 0 ? '#22c55e' : '#ef4444'),
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            type: 'line',
            label: 'Tendência',
            data: tendLine,
            borderColor: tend.cor,
            borderWidth: 2,
            borderDash: [5, 3],
            pointRadius: 0,
            fill: false,
            tension: 0,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ctx.dataset.label + ': ' + (ctx.parsed.y % 1 === 0 ? ctx.parsed.y : ctx.parsed.y.toFixed(2))
            }
          }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 },
            title: { display: true, text: 'NEs', font: { size: 10 } } },
          x: { ticks: { font: { size: 9 }, maxRotation: 45 } }
        }
      }
    });
    return tend;
  }

  function renderizarMini(canvasId, labels, valores) {
    destruir(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const slope = calcularTendencia(valores);
    const ultimo = valores[valores.length - 1] ?? 0;
    const tend = indicadorTendencia(slope, ultimo);

    _charts[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: valores,
          borderColor: tend.cor,
          borderWidth: 2,
          pointRadius: 2,
          fill: { target: 'origin', above: tend.cor + '22' },
          tension: 0.3,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
        animation: false,
      }
    });
    return tend;
  }

  return { renderizar, renderizarMini, calcularTendencia, indicadorTendencia };
})();
