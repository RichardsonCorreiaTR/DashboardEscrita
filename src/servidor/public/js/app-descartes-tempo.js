/**
 * app-descartes-tempo.js - Frontend do estudo Descartes x Tempo GA
 *
 * Carrega dados da API, renderiza cards de resumo, grafico mensal
 * e tabela de detalhe por PSAI.
 */
(() => {
  const $conteudo = document.getElementById('conteudo');
  const $loading = document.getElementById('loading');
  const $ano = document.getElementById('seletor-ano');
  const $btn = document.getElementById('btn-carregar');

  const CORES = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  let chartQtd = null;
  let chartTempo = null;

  $btn.addEventListener('click', carregar);
  carregar();

  async function carregar() {
    $loading.hidden = false;
    $conteudo.innerHTML = '';
    try {
      const res = await fetch(`/api/descartes-tempo?ano=${$ano.value}`);
      const dados = await res.json();
      if (dados.erro) throw new Error(dados.erro);
      renderizar(dados);
    } catch (err) {
      $conteudo.innerHTML = `<div class="card"><p style="color:#991b1b">Erro: ${err.message}</p></div>`;
    } finally {
      $loading.hidden = true;
    }
  }

  function renderizar({ resumo, registros, ano }) {
    const totalGeral = registros.length;
    const minGeral = registros.reduce((s, r) => s + r.minutos_lancados, 0);
    const semSai = registros.filter(r => !r.i_sai || r.i_sai === 0).length;

    $conteudo.innerHTML = `
      <div class="dt-legenda">
        <strong>${totalGeral}</strong> PSAIs descartadas em ${ano} pela equipe |
        <strong>${(minGeral / 60).toFixed(1)}h</strong> lancadas no GA |
        <strong>${semSai}</strong> sem SAI (tempo indisponivel no GA)
      </div>
      <div class="dt-cards">${renderCards(resumo)}</div>
      <div class="card" style="margin-bottom:16px">
        <h2 style="margin:0 0 12px;font-size:1rem">Descartes por Mês — Quantidade - ${ano}</h2>
        <canvas id="chart-qtd" height="220"></canvas>
        <p style="margin:8px 0 0;font-size:0.75rem;color:#64748b;border-top:1px solid #e2e8f0;padding-top:6px">
          Total de PSAIs descartadas por mês, empilhadas por analista. Passe o mouse para ver o detalhe.
        </p>
      </div>
      <div class="card" style="margin-bottom:16px">
        <h2 style="margin:0 0 12px;font-size:1rem">Descartes por Mês — Tempo Lançado (h) - ${ano}</h2>
        <canvas id="chart-tempo" height="220"></canvas>
        <p style="margin:8px 0 0;font-size:0.75rem;color:#64748b;border-top:1px solid #e2e8f0;padding-top:6px">
          Soma do tempo lançado (análise + definição) nas PSAIs descartadas, em horas, por mês e analista.
        </p>
      </div>
      <div class="card">
        <h2 style="margin:0 0 10px;font-size:1rem">Detalhe por PSAI</h2>
        <div class="dt-filtros">
          <label>Analista: <select id="filtro-analista"><option value="">Todos</option></select></label>
          <label>Motivo: <select id="filtro-motivo"><option value="">Todos</option></select></label>
        </div>
        <div id="tabela-container">${renderTabela(registros)}</div>
      </div>
    `;

    renderCharts(registros);
    iniciarFiltros(registros);
  }

  function renderCards(resumo) {
    return Object.entries(resumo).map(([nome, r], i) => {
      const horas = (r.minutos / 60).toFixed(1);
      const media = r.descartes > 0 ? Math.round(r.minutos / r.descartes) : 0;
      const motivos = Object.entries(r.por_motivo).map(([m, q]) => `${m}: ${q}`).join(' | ');
      const semCls = r.sem_lancamento > 0 ? 'dt-alerta' : 'dt-ok';
      return `
        <div class="dt-card" style="border-left-color:${CORES[i % CORES.length]}">
          <h3>${nome}</h3>
          <div class="dt-stat">
            <div><strong>${r.descartes}</strong> descartes</div>
            <div><strong>${horas}h</strong> lancadas</div>
            <div><strong>${media} min</strong> media/descarte</div>
            <div class="${semCls}"><strong>${r.sem_lancamento}</strong> sem lancamento</div>
          </div>
          <div class="dt-motivos">${motivos}</div>
        </div>
      `;
    }).join('');
  }

  function renderChartBarras(canvasId, registros, acumular, eixoY, chartHolder, setChart) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (chartHolder.ref) chartHolder.ref.destroy();

    const porAnalista = {};
    registros.forEach(r => {
      if (!porAnalista[r.nome]) porAnalista[r.nome] = {};
      porAnalista[r.nome][r.mes] = (porAnalista[r.nome][r.mes] || 0) + acumular(r);
    });

    const datasets = Object.entries(porAnalista).map(([nome, meses], i) => ({
      label: nome,
      data: Array.from({ length: 12 }, (_, m) => +(meses[m + 1] || 0).toFixed(1)),
      backgroundColor: CORES[i % CORES.length] + '99',
      borderColor: CORES[i % CORES.length],
      borderWidth: 1
    }));

    chartHolder.ref = new Chart(canvas, {
      type: 'bar',
      data: { labels: MESES, datasets },
      options: {
        responsive: true,
        plugins: { legend: { position: 'top' } },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true, title: { display: true, text: eixoY } }
        }
      }
    });
    setChart(chartHolder.ref);
  }

  function renderCharts(registros) {
    renderChartBarras('chart-qtd',   registros, () => 1,                          'Qtd descartes', { ref: chartQtd },   c => { chartQtd   = c; });
    renderChartBarras('chart-tempo', registros, r => r.minutos_lancados / 60,     'Horas',         { ref: chartTempo }, c => { chartTempo = c; });
  }

  function renderTabela(registros) {
    if (!registros.length) return '<p style="color:#64748b">Nenhum descarte encontrado.</p>';
    const linhas = registros.map(r => {
      const semSai = !r.i_sai || r.i_sai === 0;
      const semTempo = r.minutos_lancados === 0;
      const notaSai = semSai ? ' <span class="sem-sai" title="PSAI sem SAI vinculada">*</span>' : '';
      const tdTempo = `<td class="${semTempo ? 'sem-tempo' : ''}">${r.minutos_lancados} min${notaSai}</td>`;
      const data = r.data_descarte ? new Date(r.data_descarte).toLocaleDateString('pt-BR') : '-';
      return `<tr data-analista="${r.nome}" data-motivo="${r.motivo_nome}">
        <td>${r.nome}</td><td>${r.i_psai}</td><td>${r.i_sai || '-'}</td>
        <td>${data}</td><td>${r.motivo_nome}</td>${tdTempo}
      </tr>`;
    }).join('');

    return `<table class="dt-tabela">
      <thead><tr>
        <th>Analista</th><th>PSAI</th><th>SAI</th>
        <th>Data Descarte</th><th>Motivo</th><th>Tempo Lancado</th>
      </tr></thead>
      <tbody>${linhas}</tbody>
    </table>`;
  }

  function iniciarFiltros(registros) {
    const nomes = [...new Set(registros.map(r => r.nome))].sort();
    const motivos = [...new Set(registros.map(r => r.motivo_nome))].sort();
    const $analista = document.getElementById('filtro-analista');
    const $motivo = document.getElementById('filtro-motivo');
    if (!$analista || !$motivo) return;

    nomes.forEach(n => { $analista.innerHTML += `<option value="${n}">${n}</option>`; });
    motivos.forEach(m => { $motivo.innerHTML += `<option value="${m}">${m}</option>`; });

    const filtrar = () => {
      const fa = $analista.value;
      const fm = $motivo.value;

      const filtrados = registros.filter(r =>
        (!fa || r.nome === fa) && (!fm || r.motivo_nome === fm)
      );

      document.querySelectorAll('.dt-tabela tbody tr').forEach(tr => {
        const ok = (!fa || tr.dataset.analista === fa) && (!fm || tr.dataset.motivo === fm);
        tr.style.display = ok ? '' : 'none';
      });

      renderCharts(filtrados);
    };

    $analista.addEventListener('change', filtrar);
    $motivo.addEventListener('change', filtrar);
  }
})();
