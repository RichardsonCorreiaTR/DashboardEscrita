/**
 * app-lab-backtest.js - View "Backtest" do Laboratorio (padrao visual V2)
 */
/* global Chart */
/* eslint-disable no-unused-vars */
const AppLabBacktest = (() => {
  let chartBt = null;
  function r1(v) { return Math.round(v * 10) / 10; }
  function corMape(m) { return m <= 15 ? 'var(--verde)' : m <= 25 ? 'var(--amarelo)' : m <= 35 ? '#f59e0b' : 'var(--vermelho)'; }
  function esc(s) { return !s ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function renderizar(dados) {
    if (!dados) return;
    renderResumo(dados);
    renderKpis(dados);
    renderImpacto(dados.previsao);
    renderProva(dados);
    renderExemplo(dados.exemplo, dados.previsao);
    renderEstrategias(dados.estrategias, dados.atual);
  }

  function renderResumo(d) {
    const el = document.getElementById('bt-resumo');
    if (!el || !d.melhor) return;
    const m = d.melhor;
    const borda = m.mape <= 25 ? 'var(--verde)' : m.mape <= 40 ? 'var(--amarelo)' : 'var(--vermelho)';
    const genTxt = m.geracao === 'V7' ? ' (ridge/ensemble que aprende)' : m.geracao === 'V6' ? ' (regressao que aprende)' : m.geracao === 'V5' ? ' (ajuste IA)' : '';
    const comp = d.melhoria > 0
      ? 'A melhor estrategia (<strong>' + esc(m.nome) + '</strong>' + genTxt + ') supera o algoritmo atual por <strong>' + r1(d.melhoria) + ' pp</strong> de MAPE.'
      : d.melhoria < 0 ? 'O algoritmo atual ainda e o melhor. Nenhuma estrategia IA superou por enquanto.'
        : 'A melhor estrategia empata com o algoritmo atual.';
    const prev = d.previsao
      ? ' Para a proxima versao (<strong>' + d.previsao.versaoAlvo + '</strong>), o modelo preve <strong>' +
        d.previsao.pontual + ' NEs</strong> (intervalo: ' + d.previsao.intervalo.baixo + '-' + d.previsao.intervalo.alto + ').'
      : '';
    el.innerHTML = '<div class="resumo-executivo" style="border-left:4px solid ' + borda + '">' +
      '<div class="resumo-executivo__texto"><strong>' + d.estrategias.length + ' estrategias</strong> testadas em <strong>' +
      d.totalVersoes + ' versoes</strong>. ' + comp + prev + '</div></div>';
  }

  function renderKpis(d) {
    const el = document.getElementById('bt-kpis');
    if (!el || !d.melhor) return;
    const m = d.melhor, a = d.atual;
    function kpi(cls, v, l, s) {
      return '<div class="estudo-kpi ' + cls + '"><span class="estudo-kpi__label">' + l +
        '</span><span class="estudo-kpi__valor">' + v + '</span><span class="estudo-kpi__sub">' + esc(s || '') + '</span></div>';
    }
    const sf = m.scoreFuturo;
    el.innerHTML = [
      kpi('estudo-kpi--destaque', sf || m.mape + '%', 'Score Futuro', 'menor = mais preciso'),
      kpi(m.mape6m != null && m.mape6m <= 20 ? 'estudo-kpi--verde' : 'estudo-kpi--amarelo',
        (m.mape6m != null ? m.mape6m + '%' : '-'), 'MAPE ultimos 6m', 'tendencia recente'),
      kpi('estudo-kpi--info', m.mape + '%', 'MAPE geral', m.nome),
      kpi(d.melhoria > 0 ? 'estudo-kpi--verde' : 'estudo-kpi--amarelo',
        (d.melhoria > 0 ? '-' : '') + r1(Math.abs(d.melhoria)) + ' pp', 'Melhoria vs Atual',
        m.geracao ? 'Geracao ' + m.geracao : 'IA')
    ].join('');
  }

  function renderImpacto(prev) {
    const el = document.getElementById('bt-impacto');
    if (!el) return;
    if (!prev) { el.innerHTML = ''; return; }
    const borda = prev.risco === 'baixo' ? 'var(--verde)' : prev.risco === 'moderado' ? 'var(--amarelo)' : 'var(--vermelho)';
    const corC = prev.confianca >= 75 ? 'var(--verde)' : prev.confianca >= 50 ? 'var(--amarelo)' : 'var(--vermelho)';
    function num(v, l, dest, cor) {
      const st = cor ? ' style="color:' + cor + '"' : '';
      return '<div class="impacto-num' + (dest ? ' impacto-num--destaque' : '') + '">' +
        '<span class="impacto-num__valor"' + st + '>' + v + '</span><span class="impacto-num__label">' + l + '</span></div>';
    }
    el.innerHTML = '<div class="impacto-card" style="border-left:4px solid ' + borda + '">' +
      '<div class="impacto-card__header"><span class="impacto-card__titulo">Previsao: ' + esc(prev.versaoAlvo) + '</span>' +
      '<span class="impacto-badge" style="background:' + borda + '">Risco ' + prev.risco + '</span></div>' +
      '<div class="impacto-card__corpo"><div class="impacto-numeros">' +
      num(prev.pontual, 'NEs previstas', true) +
      num(prev.intervalo.baixo + ' - ' + prev.intervalo.alto, 'Intervalo') +
      num(r1(prev.confianca) + '%', 'Confianca', false, corC) +
      num(esc(prev.estrategia), 'Estrategia') + '</div></div></div>';
  }

  function renderProva(dados) {
    const el = document.getElementById('bt-prova');
    if (!el) return;
    if (!dados.melhor || !dados.estrategias || dados.estrategias.length === 0) {
      el.innerHTML = '<p style="color:var(--cor-texto-sec)">Sem dados de backtest.</p>'; return;
    }
    const best = dados.estrategias[0];
    if (!best || !best.resultados) { el.innerHTML = ''; return; }
    const cM = corMape(best.mape), c6 = best.mape6m != null ? corMape(best.mape6m) : null;
    const metricas = [
      { v: best.mape + '%', l: 'Erro medio geral', c: cM },
      best.mape6m != null ? { v: best.mape6m + '%', l: 'Erro ultimos 6m', c: c6 } : null,
      { v: best.acertoDirecao + '%', l: 'Acerto direcao',
        c: best.acertoDirecao >= 70 ? 'var(--verde)' : best.acertoDirecao >= 50 ? 'var(--amarelo)' : 'var(--vermelho)' },
      { v: best.testes, l: 'Versoes testadas' }
    ].filter(Boolean);
    const mH = metricas.map(m =>
      '<div class="prova-metrica"><span class="prova-metrica__valor"' +
      (m.c ? ' style="color:' + m.c + '"' : '') + '>' + m.v +
      '</span><span class="prova-metrica__label">' + m.l + '</span></div>').join('');
    el.innerHTML = '<div class="prova-card"><div class="prova-card__header">' +
      '<span class="prova-card__titulo">Previsto vs Real: ' + esc(best.nome) + '</span>' +
      '<span class="prova-card__badge" style="background:' + cM + '">MAPE ' + best.mape + '%</span>' +
      (c6 ? '<span class="prova-card__badge" style="background:' + c6 + '">6m: ' + best.mape6m + '%</span>' : '') +
      '</div><div class="prova-card__body"><div class="prova-metricas">' + mH + '</div>' +
      '<div class="prova-chart"><canvas id="bt-chart-main"></canvas></div>' +
      '<div class="prova-legenda"><strong>Como ler:</strong> Azul = previsao. Verde = NE real. ' +
      (dados.previsao ? 'Roxo = projecao para <strong>' + dados.previsao.versaoAlvo + '</strong>. ' : '') +
      'Quanto mais proximas as barras, mais preciso.</div></div></div>';
    renderChart(best.resultados, dados.previsao);
  }

  function renderChart(res, prev) {
    if (chartBt) { chartBt.destroy(); chartBt = null; }
    const ctx = document.getElementById('bt-chart-main');
    if (!ctx) return;
    const labels = res.map(r => r.versaoAlvo), pv = res.map(r => r.previsto), rl = res.map(r => r.real);
    if (prev) { labels.push(prev.versaoAlvo); pv.push(prev.pontual); rl.push(null); }
    const hasFut = prev && labels.length > 0;
    const bgP = pv.map((_, i) => i === labels.length - 1 && hasFut ? 'rgba(168,85,247,0.5)' : 'rgba(59,130,246,0.7)');
    const brP = pv.map((_, i) => i === labels.length - 1 && hasFut ? 'rgba(168,85,247,0.9)' : 'rgba(59,130,246,0.9)');
    chartBt = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [
        { label: 'Previsto', data: pv, backgroundColor: bgP, borderColor: brP, borderWidth: 1, borderRadius: 3 },
        { label: 'Real (NE liquida)', data: rl, backgroundColor: 'rgba(34,197,94,0.7)', borderRadius: 3 }
      ] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 10 } } },
          tooltip: { callbacks: { afterBody: (items) => {
            const r = res[items[0].dataIndex];
            return r ? 'Erro: ' + r.erroPct + '%' : 'Projecao futura';
          } } }
        },
        scales: {
          x: { ticks: { font: { size: 8 }, maxRotation: 90 } },
          y: { beginAtZero: true, title: { display: true, text: 'NEs', font: { size: 10 } } }
        }
      }
    });
  }

  function renderExemplo(ex, prev) {
    const el = document.getElementById('bt-exemplo');
    if (!el) return;
    if (!ex || !ex.passos) { el.innerHTML = ''; return; }
    const passosH = ex.passos.map((p, i) => {
      const det = Array.isArray(p.detalhe)
        ? p.detalhe.map(d => '<div class="exemplo-detalhe">' + esc(d) + '</div>').join('')
        : '<div class="exemplo-detalhe">' + esc(p.detalhe) + '</div>';
      const cls = i === ex.passos.length - 1 ? ' exemplo-passo--final' : '';
      return '<div class="exemplo-passo' + cls + '"><div class="exemplo-passo__num">' + (i + 1) + '</div>' +
        '<div class="exemplo-passo__body"><div class="exemplo-passo__titulo">' + esc(p.titulo) + '</div>' +
        det + '<div class="exemplo-passo__resultado">' + esc(p.resultado) + '</div></div></div>';
    }).join('');
    el.innerHTML = '<div class="prova-card"><div class="prova-card__header">' +
      '<span class="prova-card__titulo">Como chegamos na previsao para ' + (prev ? prev.versaoAlvo : 'proxima versao') + '</span>' +
      '<span class="prova-card__badge" style="background:var(--info)">' + esc(ex.estrategia) + '</span></div>' +
      '<div class="prova-card__body"><div class="exemplo-intro">Usando dados da versao <strong>' + esc(ex.versaoBase) +
      '</strong>, janela de <strong>' + ex.janela + ' versoes</strong>:</div>' +
      '<div class="exemplo-passos">' + passosH + '</div></div></div>';
  }

  function corGen(g) { return g === 'V7' ? 'lab-pill--roxo' : g === 'V6' ? 'lab-pill--verde' : g === 'V5' ? 'lab-pill--azul' : 'lab-pill--info'; }

  function renderEstrategias(estrategias, atual) {
    const el = document.getElementById('bt-estrategias');
    if (!el || !estrategias || estrategias.length === 0) return;
    const rows = estrategias.map((e, i) => {
      const cls = i === 0 ? ' class="lab-row--melhor"' : e.nome.includes('ATUAL') ? ' class="lab-row--atual"' : '';
      const tag = e.nome.includes('ATUAL') ? ' <span class="lab-pill lab-pill--amarelo">atual</span>' : '';
      const best = i === 0 ? ' <span class="lab-pill lab-pill--verde">melhor</span>' : '';
      const gen = e.geracao ? ' <span class="lab-pill ' + corGen(e.geracao) + '">' + e.geracao + '</span>' : '';
      const cM = corMape(e.mape), cS = e.scoreFuturo ? corMape(e.scoreFuturo) : cM;
      let delta = '';
      if (atual && atual.scoreFuturo && e.scoreFuturo) {
        const d = r1(e.scoreFuturo - atual.scoreFuturo);
        if (d !== 0) delta = ' <span class="lab-pill ' + (d < 0 ? 'lab-pill--verde' : 'lab-pill--vermelho') + '">' + (d > 0 ? '+' : '') + d + '</span>';
      }
      return '<tr' + cls + '><td><strong>' + esc(e.nome) + '</strong>' + gen + tag + best + '</td>' +
        '<td style="color:' + cS + '"><strong>' + (e.scoreFuturo || '-') + '</strong>' + delta + '</td>' +
        '<td style="color:' + cM + '">' + e.mape + '%</td>' +
        '<td>' + (e.mape6m != null ? e.mape6m + '%' : '-') + '</td>' +
        '<td>' + e.acertoDirecao + '%</td><td>' + e.testes + '</td></tr>';
    }).join('');
    el.innerHTML = '<div class="prova-card"><div class="prova-card__header">' +
      '<span class="prova-card__titulo">Comparativo de Todas as Estrategias</span>' +
      '<span class="prova-card__badge" style="background:var(--info)">' + estrategias.length + ' testadas</span></div>' +
      '<div class="prova-card__body"><div class="prova-legenda" style="margin-bottom:0.5rem">' +
      '<b>V3</b> = mediana pura. <b>V5</b> = ajuste IA. <b>V6</b> = regressao/EWMA. <b>V7</b> = ensemble/ridge/tendencia. ' +
      '<b>Score</b> = 30% MAPE geral + 70% MAPE recente (menor = melhor previsao futura).</div>' +
      '<table class="tabela-detalhes prova-tabela"><thead><tr>' +
      '<th>Estrategia</th><th>Score</th><th>MAPE Geral</th><th>MAPE 6m</th><th>Acerto Dir.</th><th>Testes</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }

  return { renderizar };
})();
