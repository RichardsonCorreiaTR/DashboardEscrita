/**
 * app-liberacoes-v2-prova.js - Secao "Prova do Algoritmo"
 * Backtest (previsto vs real + versao futura), volatilidade, explicacao
 */
/* eslint-disable no-unused-vars */
const AppLiberacoesV2Prova = (() => {
  let chartBt = null;
  function r1(v) { return Math.round(v * 10) / 10; }
  function r0(v) { return Math.round(v); }

  function renderizar(dados) {
    if (!dados) return;
    renderBacktest(dados);
    renderVolatilidade(dados.volatilidade);
    renderAlgoritmo(dados.algoritmo);
  }

  function renderBacktest(dados) {
    const el = document.getElementById('v2-prova-backtest');
    const prev = dados.previsao;
    if (!el || !prev || prev.fallbackUsado) {
      if (el) el.innerHTML = '<p style="color:var(--cor-texto-sec);font-size:0.8rem">Backtest indisponivel.</p>';
      return;
    }
    const bt = prev.backtest;
    if (!bt || !bt.resultados || bt.resultados.length === 0) {
      el.innerHTML = '<p style="color:var(--cor-texto-sec);font-size:0.8rem">Sem dados de backtest.</p>';
      return;
    }
    const cM = bt.mape <= 15 ? 'var(--verde)' : bt.mape <= 25 ? 'var(--amarelo)' : bt.mape <= 35 ? '#f59e0b' : 'var(--vermelho)';
    const m6 = bt.mape6m;
    const c6 = m6 != null ? (m6 <= 15 ? 'var(--verde)' : m6 <= 25 ? 'var(--amarelo)' : '#f59e0b') : null;
    const cD = (bt.acertoDirecao || 0) >= 70 ? 'var(--verde)' : (bt.acertoDirecao || 0) >= 50 ? 'var(--amarelo)' : 'var(--vermelho)';
    const metricas = [
      { v: `${bt.mape}%`, l: 'Erro medio geral', c: cM },
      m6 != null ? { v: `${m6}%`, l: 'Erro ultimos 6m', c: c6 } : null,
      { v: `${bt.acertoDirecao || '?'}%`, l: 'Acerto de direcao', c: cD },
      { v: bt.totalTestes, l: 'Versoes testadas' }
    ].filter(Boolean);
    const mH = metricas.map(m => `<div class="prova-metrica">
      <span class="prova-metrica__valor"${m.c ? ` style="color:${m.c}"` : ''}>${m.v}</span>
      <span class="prova-metrica__label">${m.l}</span></div>`).join('');
    const liqLabel = bt.usaLiquida
      ? '<strong>NE liquida</strong> = entradas brutas - descartes (CsD + Reprovada + Prescrita)'
      : 'NE brutas (sem ajuste de descartes)';

    el.innerHTML = `<div class="prova-card">
      <div class="prova-card__header"><span class="prova-card__titulo">Prova do Algoritmo V3: Previsto vs Real</span>
        <span class="prova-card__badge" style="background:${cM}">MAPE ${bt.mape}%</span>
        ${m6 != null ? `<span class="prova-card__badge" style="background:${c6}">6m: ${m6}%</span>` : ''}</div>
      <div class="prova-card__body"><div class="prova-metricas">${mH}</div>
        <div class="prova-chart"><canvas id="chart-v2-backtest"></canvas></div>
        <div class="prova-legenda">
          <strong>Como ler:</strong> Azul = previsao do modelo. Verde = NE real da versao.
          ${dados.versaoFutura ? `Roxo tracejado = projecao para <strong>${dados.versaoFutura}</strong> (ainda sem dado real).` : ''}
          <br>O "Real" usa ${liqLabel}.
          Quanto mais proximas as barras, mais preciso o modelo.
        </div></div></div>`;
    renderChartBt(bt.resultados, dados);
  }

  function renderChartBt(res, dados) {
    if (chartBt) { chartBt.destroy(); chartBt = null; }
    const ctx = document.getElementById('chart-v2-backtest');
    if (!ctx) return;
    const labels = res.map(r => r.versaoAlvo);
    const previstos = res.map(r => r.previsto);
    const reais = res.map(r => r.real);
    const prev = dados.previsao;
    if (dados.versaoFutura && prev && prev.prevPontual) {
      labels.push(dados.versaoFutura);
      previstos.push(prev.prevPontual);
      reais.push(null);
    }
    const bgPrev = previstos.map((_, i) => i === labels.length - 1 && dados.versaoFutura
      ? 'rgba(168,85,247,0.5)' : 'rgba(59,130,246,0.7)');
    const borderPrev = previstos.map((_, i) => i === labels.length - 1 && dados.versaoFutura
      ? 'rgba(168,85,247,0.9)' : 'rgba(59,130,246,0.9)');

    chartBt = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Previsto', data: previstos, backgroundColor: bgPrev, borderColor: borderPrev, borderWidth: 1, borderRadius: 3 },
          { label: 'Real (NE liquida)', data: reais, backgroundColor: 'rgba(34,197,94,0.7)', borderRadius: 3 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 10 } } },
          tooltip: { callbacks: {
            afterBody: (items) => {
              const idx = items[0].dataIndex;
              const r = res[idx];
              if (!r) return `Projecao para ${dados.versaoFutura}`;
              return `Erro: ${r.erroPct}%${r.neBruta !== r.real ? ` | Bruta: ${r.neBruta} | Liquida: ${r.real}` : ''}`;
            }
          }}
        },
        scales: {
          x: { ticks: { font: { size: 8 }, maxRotation: 90 } },
          y: { beginAtZero: true, title: { display: true, text: 'NEs', font: { size: 10 } } }
        }
      }
    });
  }

  function renderVolatilidade(vol) {
    const el = document.getElementById('v2-prova-volatilidade');
    if (!el) return;
    if (!vol || !vol.lags || vol.lags.length === 0) {
      el.innerHTML = '<p style="color:var(--cor-texto-sec);font-size:0.8rem">Analise de volatilidade indisponivel.</p>';
      return;
    }
    const rows = vol.lags.map(l => {
      const rho = l.melhorRho !== null && l.melhorRho !== undefined ? l.melhorRho : '-';
      const cS = l.significativa ? 'var(--verde)' : 'var(--cor-texto-sec)';
      const dom = vol.lagDominante === l.lag ? ' (dominante)' : '';
      return `<tr><td><strong>N+${l.lag}${dom}</strong></td><td>${l.pares} pares</td>
        <td>${rho}</td><td style="color:${cS}">${l.significativa ? 'Sim' : 'Nao'}</td>
        <td>${l.interpretacao}</td></tr>`;
    }).join('');
    const dp = r0(vol.dispersao * 100);
    const cD = dp < 30 ? 'var(--verde)' : dp < 50 ? 'var(--amarelo)' : 'var(--vermelho)';

    el.innerHTML = `<div class="prova-card">
      <div class="prova-card__header"><span class="prova-card__titulo">Volatilidade: Impacto em Versoes Futuras</span>
        <span class="prova-card__badge" style="background:${cD}">${dp}% dispersao</span></div>
      <div class="prova-card__body"><p class="prova-resumo">${vol.resumo || 'Analise em andamento.'}</p>
        <table class="tabela-detalhes prova-tabela">
          <thead><tr><th>Defasagem</th><th>Dados</th><th>Correlacao</th><th>Significativa?</th><th>Interpretacao</th></tr></thead>
          <tbody>${rows}</tbody></table>
        <div class="prova-legenda">Se a dispersao for alta (&gt;30%), SAs de uma versao geram NEs em 2-3 versoes
          a frente. O modelo precisa considerar esse efeito cascata.</div></div></div>`;
  }

  function renderAlgoritmo(algo) {
    const el = document.getElementById('v2-prova-algoritmo');
    if (!el || !algo) return;
    const etH = algo.etapas.map(e => `<div class="prova-etapa">
      <div class="prova-etapa__num">${e.passo}</div>
      <div class="prova-etapa__body"><div class="prova-etapa__titulo">${e.titulo}</div>
        <div class="prova-etapa__desc">${e.desc}</div>
        ${e.formula ? `<code class="prova-etapa__formula">${e.formula}</code>` : ''}</div></div>`).join('');
    const valItems = [];
    const v = algo.validacao;
    if (v) {
      if (v.calibracao) valItems.push(`<strong>Calibracao V3:</strong> ${v.calibracao.estrategiasTested} estrategias testadas em ${v.calibracao.backtests} backtests. Vencedora: ${v.calibracao.vencedora}. Descartada: ${v.calibracao.descartada}. Motivo: ${v.calibracao.motivo}.`);
      if (v.backtest) valItems.push(`Backtest: MAPE ${v.backtest.mape}%${v.backtest.mape6m != null ? ` (6m: ${v.backtest.mape6m}%)` : ''} - ${v.backtest.qualidade}, ${v.backtest.testes} versoes`);
      if (v.correlacao) valItems.push(`Correlacao: ${v.correlacao.tipo}, rho=${v.correlacao.rho}, ${v.correlacao.significativa ? 'significativa' : 'nao significativa'}`);
      if (v.volatilidade) valItems.push(`Volatilidade: lag N+${v.volatilidade.lagDominante}, dispersao ${r0(v.volatilidade.dispersao * 100)}%`);
    }
    const valH = valItems.length > 0 ? `<div class="prova-validacao">
      <div style="font-weight:600;font-size:0.78rem;margin-bottom:0.3rem">Validacao e Calibracao</div>
      ${valItems.map(i => `<div class="prova-validacao__item">${i}</div>`).join('')}</div>` : '';
    const melH = algo.melhorias.map(m => `<li>${m}</li>`).join('');
    el.innerHTML = `<div class="prova-card">
      <div class="prova-card__header"><span class="prova-card__titulo">Como o Algoritmo Funciona</span></div>
      <div class="prova-card__body"><div class="prova-etapas">${etH}</div>${valH}
        <details class="prova-evolucao"><summary>Como o algoritmo pode melhorar ao longo do tempo</summary>
          <ul>${melH}</ul></details></div></div>`;
  }

  return { renderizar };
})();
