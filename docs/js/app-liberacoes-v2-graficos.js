/**
 * app-liberacoes-v2-graficos.js - Graficos do estudo Liberacoes SA V2
 *
 * Renderiza 3 graficos Chart.js:
 *   1. SAs por tipo/versao (barras empilhadas)
 *   2. Carga ponderada por versao (linha com mediana)
 *   3. Complexidade da versao atual (doughnut)
 */
/* eslint-disable no-unused-vars */
const AppLiberacoesV2Graficos = (() => {
  const charts = {};

  function kill(k) { if (charts[k]) { charts[k].destroy(); delete charts[k]; } }
  function r1(v) { return Math.round(v * 10) / 10; }

  function renderizar(dados) {
    kill('tipo'); kill('carga'); kill('complex');
    if (!dados || !dados.versoes || dados.versoes.length < 2) return;
    renderChartSATipo(dados);
    renderChartCarga(dados);
    renderChartComplex(dados);
  }

  function renderChartSATipo(dados) {
    const ctx = document.getElementById('chart-v2-sa-tipo');
    if (!ctx) return;
    const vs = dados.versoes.filter(v => v.totalLiberacoes > 0);
    charts.tipo = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: vs.map(v => v.versao),
        datasets: [
          { label: 'SAM (Melhoria)', data: vs.map(v => v.porTipo.SAM), backgroundColor: 'rgba(59,130,246,0.75)', borderRadius: 2 },
          { label: 'SAL (Legal)', data: vs.map(v => v.porTipo.SAL), backgroundColor: 'rgba(245,158,11,0.75)', borderRadius: 2 },
          { label: 'SAIL (Impl. Legal)', data: vs.map(v => v.porTipo.SAIL), backgroundColor: 'rgba(16,185,129,0.75)', borderRadius: 2 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 10 } } } },
        scales: {
          x: { stacked: true, ticks: { font: { size: 8 }, maxRotation: 90 } },
          y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Qtde SAs', font: { size: 10 } } }
        }
      }
    });
  }

  function renderChartCarga(dados) {
    const ctx = document.getElementById('chart-v2-carga');
    if (!ctx) return;
    const vs = dados.versoes.filter(v => v.totalLiberacoes > 0);
    const med = dados.estatisticas ? dados.estatisticas.carga.mediana : 0;
    charts.carga = new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: {
        labels: vs.map(v => v.versao),
        datasets: [
          {
            label: 'Carga Ponderada', data: vs.map(v => v.carga.total),
            borderColor: 'rgba(168,85,247,0.8)', backgroundColor: 'rgba(168,85,247,0.1)',
            fill: true, tension: 0.3, pointRadius: 3
          },
          {
            label: `Mediana (${med})`, data: vs.map(() => med),
            borderColor: 'rgba(239,68,68,0.5)', borderDash: [6, 4], pointRadius: 0, fill: false
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 10 } } } },
        scales: {
          x: { ticks: { font: { size: 8 }, maxRotation: 90 } },
          y: { beginAtZero: true, title: { display: true, text: 'Carga', font: { size: 10 } } }
        }
      }
    });
  }

  function renderChartComplex(dados) {
    const ctx = document.getElementById('chart-v2-complex');
    if (!ctx) return;
    const va = dados.versoes.find(v => v.versao === dados.versaoAtual);
    if (!va || !va.carga || !va.carga.porFaixa) return;
    const faixas = va.carga.porFaixa;
    const labels = []; const vals = []; const colors = [];
    const corMap = { baixa: '#22c55e', media: '#3b82f6', alta: '#f59e0b', muito_alta: '#ef4444' };
    const labelMap = { baixa: 'Baixa (ate 2h)', media: 'Media (2-8h)', alta: 'Alta (8-40h)', muito_alta: 'Muito Alta (+40h)' };
    for (const [k, v] of Object.entries(faixas)) {
      if (v > 0) { labels.push(labelMap[k] || k); vals.push(v); colors.push(corMap[k] || '#94a3b8'); }
    }
    if (vals.length === 0) return;
    charts.complex = new Chart(ctx.getContext('2d'), {
      type: 'doughnut',
      data: { labels, datasets: [{ data: vals, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 10 }, padding: 12 } },
          title: { display: true, text: `${dados.versaoAtual} (${va.totalLiberacoes} SAs)`, font: { size: 11 } }
        }
      }
    });
  }

  return { renderizar };
})();
