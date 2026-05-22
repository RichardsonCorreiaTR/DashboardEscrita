/**
 * charts.js - Fabrica de graficos Chart.js para os indicadores
 *
 * Cada funcao cria (ou atualiza) um grafico no canvas informado.
 * Retorna a instancia Chart para possivel atualizacao posterior.
 */

/* eslint-disable no-unused-vars */
const Charts = (() => {
  const CORES = {
    verde: '#22c55e',
    amarelo: '#eab308',
    vermelho: '#ef4444',
    azul: '#3b82f6',
    cinza: '#94a3b8',
    roxo: '#8b5cf6',
    laranja: '#f97316'
  };

  const FAIXA_CORES = ['#3b82f6', '#f97316', '#ef4444', '#7c3aed'];

  /** Destroi grafico anterior no mesmo canvas, se existir */
  function limpar(canvasId) {
    const existente = Chart.getChart(canvasId);
    if (existente) existente.destroy();
  }

  /**
   * Grafico de linha: Trajetoria do Saldo vs Meta ao longo do ano
   * Mostra a evolucao mensal da meta e os pontos reais (anterior + atual + estimativa)
   * @param {string} canvasId
   * @param {Object} dados - { metas, versaoAtual, indiceAtual, saldoAtual, saldoAnterior, estimativa }
   */
  function linhaTrajetoria(canvasId, dados) {
    limpar(canvasId);
    const { metas, versaoAtual, indiceAtual, saldoAtual, saldoAnterior, estimativa } = dados;

    // Gerar labels de versao (01 a 12)
    const prefixo = versaoAtual ? versaoAtual.replace(/-\d+$/, '-') : '10.6A-';
    const labels = metas.map((_, i) => prefixo + String(i + 1).padStart(2, '0'));

    // Dataset meta (linha tracejada completa)
    const dsMeta = {
      label: 'Meta',
      data: [...metas],
      borderColor: CORES.verde,
      backgroundColor: CORES.verde + '20',
      borderDash: [6, 4],
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: CORES.verde,
      fill: false,
      tension: 0.3
    };

    // Dataset saldo real (apenas pontos com dados)
    const saldoData = new Array(metas.length).fill(null);
    if (indiceAtual >= 1 && saldoAnterior !== null) saldoData[indiceAtual - 1] = saldoAnterior;
    if (indiceAtual >= 0) saldoData[indiceAtual] = saldoAtual;

    const dsSaldo = {
      label: 'Saldo Real',
      data: saldoData,
      borderColor: CORES.azul,
      backgroundColor: CORES.azul,
      borderWidth: 2.5,
      pointRadius: 5,
      pointBackgroundColor: CORES.azul,
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      spanGaps: true,
      fill: false,
      tension: 0.3
    };

    // Dataset estimativa saldo final (ponto projetado)
    const estData = new Array(metas.length).fill(null);
    if (indiceAtual >= 0 && estimativa !== null && estimativa !== undefined) {
      estData[indiceAtual] = estimativa;
    }

    const dsEstimativa = {
      label: 'Estimativa Final',
      data: estData,
      borderColor: CORES.roxo,
      backgroundColor: CORES.roxo,
      borderWidth: 0,
      pointRadius: 7,
      pointStyle: 'triangle',
      pointBackgroundColor: CORES.roxo,
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      fill: false,
      showLine: false
    };

    return new Chart(document.getElementById(canvasId), {
      type: 'line',
      data: { labels, datasets: [dsMeta, dsSaldo, dsEstimativa] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { position: 'bottom', labels: { padding: 12, font: { size: 11 }, usePointStyle: true } },
          title: { display: true, text: 'Trajetoria Saldo vs Meta 2026', font: { size: 13, weight: '600' } },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                if (ctx.raw === null) return null;
                return ctx.dataset.label + ': ' + ctx.raw;
              }
            }
          }
        },
        scales: {
          y: { beginAtZero: false, ticks: { precision: 0 } },
          x: { ticks: { font: { size: 10 } } }
        }
      }
    });
  }

  /**
   * Grafico de barras horizontais: Movimentacao da versao (entradas/lib/desc/projecao)
   * @param {string} canvasId
   * @param {Object} dados - { entradas, liberadas, descartes, projecao }
   */
  function barrasMovimentacao(canvasId, dados) {
    limpar(canvasId);
    return new Chart(document.getElementById(canvasId), {
      type: 'bar',
      data: {
        labels: ['Entradas', 'Liberadas', 'Descartes', 'Proj. Lib.'],
        datasets: [{
          label: 'Quantidade',
          data: [dados.entradas, dados.liberadas, dados.descartes, dados.projecao],
          backgroundColor: [CORES.laranja, CORES.verde, CORES.cinza, CORES.roxo + '99'],
          borderColor: [CORES.laranja, CORES.verde, CORES.cinza, CORES.roxo],
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Movimentacao da Versao', font: { size: 13, weight: '600' } },
          tooltip: {
            callbacks: {
              afterLabel: function(ctx) {
                const idx = ctx.dataIndex;
                if (idx === 0) return 'Novas NEs no periodo';
                if (idx === 1) return 'Liberadas (versao + arquivo)';
                if (idx === 2) return 'Descartadas no periodo';
                if (idx === 3) return 'Pendentes + Em arquivo + Alocadas';
                return '';
              }
            }
          }
        },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  /**
   * Grafico doughnut: Composicao da projecao de liberacao
   * @param {string} canvasId
   * @param {Object} dados - { pendentes, emArquivo, alocadas }
   */
  function doughnutProjecao(canvasId, dados) {
    limpar(canvasId);
    const total = dados.pendentes + dados.emArquivo + dados.alocadas;
    if (total === 0) {
      document.getElementById(canvasId).parentElement.innerHTML =
        '<p style="text-align:center;color:var(--cor-texto-sec);padding:2rem;font-size:0.85rem;">Sem projecao de liberacao</p>';
      return null;
    }
    return new Chart(document.getElementById(canvasId), {
      type: 'doughnut',
      data: {
        labels: ['Pendentes', 'Em Arquivo', 'Alocadas'],
        datasets: [{
          data: [dados.pendentes, dados.emArquivo, dados.alocadas],
          backgroundColor: [CORES.azul, CORES.laranja, CORES.roxo],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { padding: 12, font: { size: 11 }, usePointStyle: true } },
          title: { display: true, text: 'Composicao da Projecao', font: { size: 13, weight: '600' } },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                const pct = total > 0 ? Math.round(ctx.raw / total * 100) : 0;
                return ctx.label + ': ' + ctx.raw + ' (' + pct + '%)';
              }
            }
          }
        }
      }
    });
  }

  /**
   * Grafico de barras: Faixas de idade (NE > 95 dias)
   * @param {string} canvasId
   * @param {Object[]} faixas - [{faixa, qtd}]
   */
  function barrasFaixas(canvasId, faixas, titulo) {
    limpar(canvasId);
    const labels = faixas.map(f => f.faixa);
    const dados = faixas.map(f => f.qtd);

    return new Chart(document.getElementById(canvasId), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'NEs',
          data: dados,
          backgroundColor: FAIXA_CORES.slice(0, labels.length),
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: titulo || 'NEs por Faixa de Idade', font: { size: 13, weight: '600' } }
        },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  /**
   * Grafico de barras: NEs Externas > 95d por status de versao (Na Versao / Alocada / Sem Versao)
   * @param {string} canvasId
   * @param {Object} dados - { na_versao, alocada, sem_versao }
   */
  function barrasStatusVersao(canvasId, dados) {
    limpar(canvasId);
    const total = (dados.na_versao || 0) + (dados.alocada || 0) + (dados.sem_versao || 0);
    return new Chart(document.getElementById(canvasId), {
      type: 'bar',
      data: {
        labels: ['Na Versao', 'Alocada', 'Sem Versao'],
        datasets: [{
          label: 'NEs Externas',
          data: [dados.na_versao || 0, dados.alocada || 0, dados.sem_versao || 0],
          backgroundColor: [CORES.verde, CORES.amarelo, CORES.vermelho],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'NEs Externas > 95d por Status de Versao', font: { size: 13, weight: '600' } },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                const pct = total > 0 ? Math.round(ctx.raw / total * 100) : 0;
                return ctx.raw + ' NEs (' + pct + '%)';
              }
            }
          }
        },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  /**
   * Grafico doughnut: Percentual dentro/fora do prazo
   * @param {string} canvasId
   * @param {number} dentro - Qtd dentro do prazo
   * @param {number} fora - Qtd fora do prazo
   */
  function doughnutPercentual(canvasId, dentro, fora) {
    limpar(canvasId);
    return new Chart(document.getElementById(canvasId), {
      type: 'doughnut',
      data: {
        labels: ['Dentro (<=5d)', 'Fora (>5d)'],
        datasets: [{
          data: [dentro, fora],
          backgroundColor: [CORES.verde, CORES.vermelho],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { padding: 12, font: { size: 11 } } },
          title: { display: true, text: 'Criticas/Graves - Prazo 5 Dias', font: { size: 13, weight: '600' } }
        }
      }
    });
  }

  /**
   * Grafico de barras horizontais: Entradas vs Saidas
   * @param {string} canvasId
   * @param {Object} dados - {entradas, liberacoes, descartes}
   */
  function barrasEntradaSaida(canvasId, dados) {
    limpar(canvasId);
    return new Chart(document.getElementById(canvasId), {
      type: 'bar',
      data: {
        labels: ['Entradas', 'Liberacoes', 'Descartes'],
        datasets: [{
          label: 'Quantidade',
          data: [dados.entradas, dados.liberacoes, dados.descartes],
          backgroundColor: [CORES.vermelho, CORES.verde, CORES.amarelo],
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Movimentacao da Versao', font: { size: 13, weight: '600' } }
        },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  /**
   * Grafico de barras: Origem (internas vs externas)
   * @param {string} canvasId
   * @param {Object} origem - {internas: {entradas, descartes}, externas: {entradas, descartes}}
   */
  function barrasOrigem(canvasId, origem) {
    limpar(canvasId);
    return new Chart(document.getElementById(canvasId), {
      type: 'bar',
      data: {
        labels: ['Internas', 'Externas'],
        datasets: [
          {
            label: 'Entradas',
            data: [origem.internas.entradas, origem.externas.entradas],
            backgroundColor: CORES.azul,
            borderRadius: 4
          },
          {
            label: 'Descartes',
            data: [origem.internas.descartes, origem.externas.descartes],
            backgroundColor: CORES.laranja,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 } } },
          title: { display: true, text: 'Origem: Internas vs Externas', font: { size: 13, weight: '600' } }
        },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  return {
    linhaTrajetoria,
    barrasMovimentacao,
    doughnutProjecao,
    barrasFaixas,
    barrasStatusVersao,
    doughnutPercentual,
    barrasEntradaSaida,
    barrasOrigem
  };
})();
