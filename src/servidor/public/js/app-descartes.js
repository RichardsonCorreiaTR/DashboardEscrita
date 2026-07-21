/**
 * app-descartes.js - Frontend: Analise de Descartes (CsD/Repr/Presc)
 *
 * Renderiza KPIs, graficos, tabela e analise de descricoes para o estudo
 * de descartes de NE por versao historica (2022+).
 *
 * Expoe AppDescartes.carregar(force) para integracao com app-estudos.js.
 */

/* eslint-disable no-unused-vars */
const AppDescartes = (() => {
  const BASE = '/api';
  const AREAS = [['Escrita', 'Escrita'], ['Importacao', 'Importa\u00e7\u00e3o']];
  let dados = null;
  let charts = {};
  let areaSel = 'Escrita';
  let anoSel = String(new Date().getFullYear());
  let carregando = false;

  async function carregar(force) {
    if (carregando) return;
    carregando = true;
    renderizarControles();
    try {
      const params = new URLSearchParams();
      if (force) params.set('force', '1');
      if (areaSel !== 'Escrita') params.set('area', areaSel);
      const qs = params.toString();
      const url = `${BASE}/estudos/descartes-ne${qs ? '?' + qs : ''}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(600000) });
      if (!resp.ok) { const b = await resp.json().catch(() => ({})); throw new Error(b.erro || `HTTP ${resp.status}`); }
      dados = await resp.json();
      ajustarAno();
      renderizar();
    } finally {
      carregando = false;
    }
  }

  function anoDaVersao(v) { const m = (v || '').match(/^10\.(\d+)A-\d{2}/); return m ? 2020 + parseInt(m[1], 10) : null; }
  function anosDisponiveis() {
    return [...new Set(((dados && dados.versoes) || []).map(v => anoDaVersao(v.versao)).filter(Boolean))].sort((a, b) => a - b).map(String);
  }
  function ajustarAno() {
    const anos = anosDisponiveis();
    if (anoSel !== 'todos' && !anos.includes(anoSel)) anoSel = anos.length ? anos[anos.length - 1] : 'todos';
  }
  function versoesFiltradas() {
    const vs = (dados && dados.versoes) || [];
    const serie = (dados && dados.estatisticas && dados.estatisticas.serieEWMA) || [];
    if (anoSel === 'todos') return { versoes: vs, serie };
    const idx = [];
    vs.forEach((v, i) => { if (String(anoDaVersao(v.versao)) === anoSel) idx.push(i); });
    return { versoes: idx.map(i => vs[i]), serie: idx.map(i => serie[i]) };
  }

  function renderizarControles() {
    const el = document.getElementById('descartes-area-seletor');
    if (!el) return;
    const btns = AREAS.map(([val, lbl]) => {
      const ativo = areaSel === val;
      const estilo = ativo
        ? 'background:var(--info,#3b82f6);color:#fff;border-color:var(--info,#3b82f6)'
        : 'background:transparent;color:var(--cor-texto-sec);border-color:var(--cor-borda,#ccc)';
      return `<button data-area="${val}" style="${estilo};border:1px solid;border-radius:6px;padding:0.3rem 0.9rem;margin-right:0.4rem;font-size:0.82rem;cursor:pointer">${lbl}</button>`;
    }).join('');
    const anos = anosDisponiveis();
    const opts = ['<option value="todos"' + (anoSel === 'todos' ? ' selected' : '') + '>Todos os anos</option>']
      .concat(anos.map(a => `<option value="${a}"${a === anoSel ? ' selected' : ''}>${a}</option>`)).join('');
    el.innerHTML =
      '<span style="font-size:0.82rem;color:var(--cor-texto-sec);margin-right:0.5rem">\u00c1rea:</span>' + btns +
      '<span style="font-size:0.82rem;color:var(--cor-texto-sec);margin:0 0.5rem 0 1rem">Ano:</span>' +
      `<select id="descartes-ano-select" style="border:1px solid var(--cor-borda,#ccc);border-radius:6px;padding:0.3rem 0.6rem;font-size:0.82rem;cursor:pointer">${opts}</select>`;
    el.querySelectorAll('button[data-area]').forEach(b => {
      b.addEventListener('click', () => {
        if (areaSel === b.dataset.area) return;
        areaSel = b.dataset.area;
        carregar(false);
      });
    });
    const sel = document.getElementById('descartes-ano-select');
    if (sel) sel.addEventListener('change', () => { anoSel = sel.value; renderizar(); });
  }

  function renderizar() {
    renderizarControles();
    renderizarKPIs();
    renderizarDiagnostico();
    renderizarGraficos();
    renderizarTabela();
    renderizarAnalise();
  }

  function renderizarKPIs() {
    const el = document.getElementById('descartes-kpis');
    if (!el || !dados || !dados.estatisticas) return;
    const s = dados.estatisticas;
    const d = s.diagnostico;

    let html = `
      <div class="estudo-kpi estudo-kpi--destaque">
        <div class="estudo-kpi__label">Versoes Analisadas</div>
        <div class="estudo-kpi__valor">${s.totalVersoes}</div>
        <div class="estudo-kpi__sub">${s.totais.foco} descartes (CsD+Repr+Presc) de ${s.totais.entradas} entradas</div>
      </div>
      <div class="estudo-kpi">
        <div class="estudo-kpi__label">% Global</div>
        <div class="estudo-kpi__valor">${s.totais.pctGlobal}%</div>
        <div class="estudo-kpi__sub">Mediana: ${s.percentual.mediana}% | Media: ${s.percentual.media}%</div>
      </div>
      <div class="estudo-kpi">
        <div class="estudo-kpi__label">EWMA Esperado</div>
        <div class="estudo-kpi__valor">${s.ewma.atual}%</div>
        <div class="estudo-kpi__sub">Normal: ate ${s.faixas.normal}% | Atencao: ate ${s.faixas.atencao}%</div>
      </div>
      <div class="estudo-kpi">
        <div class="estudo-kpi__label">Composicao</div>
        <div class="estudo-kpi__valor" style="font-size:0.82rem">
          <span style="color:var(--info)">CsD ${s.porMotivo.conclSemDev.pct}%</span> |
          <span style="color:var(--vermelho)">Repr ${s.porMotivo.reprovada.pct}%</span> |
          <span style="color:var(--amarelo)">Presc ${s.porMotivo.prescrita.pct}%</span>
        </div>
        <div class="estudo-kpi__sub">${s.totais.conclSemDev} CsD | ${s.totais.reprovadas} repr | ${s.totais.prescritas} presc</div>
      </div>
    `;

    if (d) {
      html += `
        <div class="estudo-kpi estudo-kpi--${d.cor}">
          <div class="estudo-kpi__label">${d.versao} (Atual)</div>
          <div class="estudo-kpi__valor">${d.percentual}%</div>
          <div class="estudo-kpi__sub">${label(d.classificacao)} | ${d.desvio > 0 ? '+' : ''}${d.desvio}pp vs EWMA (${d.desvioSigmas}σ)</div>
        </div>
        <div class="estudo-kpi">
          <div class="estudo-kpi__label">Recente (6 versoes)</div>
          <div class="estudo-kpi__valor">${s.recente.mediana}%</div>
          <div class="estudo-kpi__sub">Media: ${s.recente.media}% | DP hist: ${s.percentual.dp}%</div>
        </div>
      `;
    }
    el.innerHTML = html;
  }

  function renderizarDiagnostico() {
    const el = document.getElementById('descartes-diagnostico');
    if (!el || !dados || !dados.estatisticas) { if (el) el.innerHTML = ''; return; }
    const s = dados.estatisticas;
    const d = s.diagnostico;
    if (!d) { el.innerHTML = ''; return; }

    const corBorda = d.cor === 'verde' ? 'var(--verde)' : d.cor === 'amarelo' ? 'var(--amarelo)' : 'var(--vermelho)';
    const nomeClass = label(d.classificacao);

    el.innerHTML = `
      <div style="background:#fff;border-radius:var(--radius);box-shadow:var(--sombra);padding:1rem 1.25rem;border-left:5px solid ${corBorda}">
        <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:0.5rem">
          <span style="font-weight:700;font-size:0.9rem">Diagnostico: ${d.versao}</span>
          <span class="saude-badge saude-badge--${d.classificacao === 'normal' ? 'confortavel' : d.classificacao}">${d.percentual}% - ${nomeClass}</span>
          <a href="#" id="btn-desc-como" style="font-size:0.72rem;color:var(--cor-primaria);margin-left:auto;text-decoration:underline">Como se calcula?</a>
        </div>
        <div style="font-size:0.82rem;color:var(--cor-texto-sec);line-height:1.6">
          <p>De <strong>${d.entradas}</strong> NEs que entraram na versao ${d.versao}, <strong>${d.conclSemDev + d.reprovadas + d.prescritas}</strong> foram descartadas: Concl.s/Dev (${d.conclSemDev}), Reprovacao (${d.reprovadas}), Prescricao (${d.prescritas}), resultando em <strong>${d.percentual}%</strong> de descarte.</p>
          <p>O percentual esperado pela EWMA e <strong>${d.esperado}%</strong> (mediana historica: ${d.mediaHistorica}%). ${
            d.classificacao === 'normal'
              ? 'A versao atual esta <strong style="color:var(--verde)">dentro da faixa normal</strong>.'
              : d.classificacao === 'atencao'
              ? 'A versao atual esta <strong style="color:var(--amarelo)">na faixa de atencao</strong> — monitorar.'
              : 'A versao atual esta <strong style="color:var(--vermelho)">acima do aceitavel</strong> — investigar causas.'
          }</p>
        </div>
        <div id="desc-explicacao" style="display:none;margin-top:1rem;border-top:1px solid var(--cor-borda);padding-top:1rem">
          ${renderMetodologia(s)}
        </div>
      </div>
    `;

    const btn = document.getElementById('btn-desc-como');
    const painel = document.getElementById('desc-explicacao');
    if (btn && painel) {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const aberto = painel.style.display !== 'none';
        painel.style.display = aberto ? 'none' : 'block';
        btn.textContent = aberto ? 'Como se calcula?' : 'Ocultar';
      });
    }
  }

  function renderMetodologia(s) {
    return `
      <div style="font-weight:700;font-size:0.82rem;margin-bottom:0.75rem">Metodologia do Calculo</div>
      <div style="font-size:0.78rem;color:var(--cor-texto-sec);line-height:1.6">
        <div class="isv-metodo">
          <div class="isv-metodo__titulo">1. Percentual por Versao</div>
          <div class="isv-metodo__corpo">
            <p><strong>Formula:</strong> % descarte = (CsD + reprovada + prescrita) / entradas_versao × 100</p>
            <p>Entradas = NEs com CadastroPSAI dentro do periodo da versao. Descartes = NEs com campo Descarte dentro do periodo E situacao IN (5=Concl.s/Dev, 6=Reprovada, 23=Prescrita).</p>
          </div>
        </div>
        <div class="isv-metodo">
          <div class="isv-metodo__titulo">2. EWMA (Exponential Weighted Moving Average)</div>
          <div class="isv-metodo__corpo">
            <p><strong>Formula:</strong> EWMA_t = α × Pct_t + (1-α) × EWMA_{t-1}, onde α = 2/(span+1)</p>
            <p>Span = ${s.ewma.span} versoes → α ≈ ${r2(2 / (s.ewma.span + 1))}. Versoes mais recentes tem peso exponencialmente maior. Isso captura <strong>tendencias</strong> — se o percentual vem subindo, o EWMA acompanha.</p>
            <p class="isv-metodo__dados">EWMA atual: <strong>${s.ewma.atual}%</strong></p>
          </div>
        </div>
        <div class="isv-metodo">
          <div class="isv-metodo__titulo">3. Faixas de Controle (Banda Estatistica)</div>
          <div class="isv-metodo__corpo">
            <p>Desvio padrao historico: <strong>${s.percentual.dp}%</strong></p>
            <p><strong style="color:var(--verde)">Normal</strong>: ate ${s.faixas.normal}% (EWMA + 1×DP) — variacao natural do processo.</p>
            <p><strong style="color:var(--amarelo)">Atencao</strong>: ${s.faixas.normal}% a ${s.faixas.atencao}% (EWMA + 2×DP) — possivel mudanca no padrao.</p>
            <p><strong style="color:var(--vermelho)">Critico</strong>: acima de ${s.faixas.atencao}% — sinal claro de anomalia.</p>
            <p class="isv-metodo__dados">Analogia: similar a carta de controle Shewhart, usada em controle estatistico de processos.</p>
          </div>
        </div>
      </div>
    `;
  }

  function renderizarGraficos() {
    if (!dados || !dados.versoes) return;
    destruir('chartDescPct'); destruir('chartDescMotivo');

    const { versoes: v, serie } = versoesFiltradas();
    if (!v.length) return;
    const labels = v.map(x => x.versao);

    const ctx1 = document.getElementById('chart-descartes-pct');
    if (ctx1) {
      charts.chartDescPct = new Chart(ctx1.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: '% Descarte (CsD+Repr+Presc)', data: v.map(x => x.percentual), borderColor: 'rgba(59,130,246,0.9)', backgroundColor: 'rgba(59,130,246,0.08)', fill: true, tension: 0.3, pointRadius: 4, pointBackgroundColor: v.map(x => x.versao === dados.versaoAtual ? 'rgba(239,68,68,1)' : 'rgba(59,130,246,0.9)'), pointBorderWidth: v.map(x => x.versao === dados.versaoAtual ? 3 : 1) },
            { label: 'EWMA', data: serie.map(s => s.ewma), borderColor: 'rgba(34,197,94,0.8)', borderWidth: 2, borderDash: [4, 3], pointRadius: 0, fill: false },
            { label: 'Faixa Normal (+1σ)', data: serie.map(s => s.faixaNormal), borderColor: 'rgba(234,179,8,0.5)', borderWidth: 1, borderDash: [6, 4], pointRadius: 0, fill: false },
            { label: 'Faixa Atencao (+2σ)', data: serie.map(s => s.faixaAtencao), borderColor: 'rgba(239,68,68,0.4)', borderWidth: 1, borderDash: [6, 4], pointRadius: 0, fill: false }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { font: { size: 10 } } }, tooltip: { callbacks: { afterLabel: ctx => { const vr = v[ctx.dataIndex]; return `Entradas: ${vr.entradas} | CsD: ${vr.conclSemDev || 0} | Repr: ${vr.reprovadas} | Presc: ${vr.prescritas}`; } } } }, scales: { x: { ticks: { font: { size: 9 }, maxRotation: 90 } }, y: { beginAtZero: true, title: { display: true, text: '% Descarte', font: { size: 10 } }, ticks: { callback: val => val + '%' } } } }
      });
    }

    const ctx2 = document.getElementById('chart-descartes-motivo');
    if (ctx2) {
      charts.chartDescMotivo = new Chart(ctx2.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Concl.s/Dev (5)', data: v.map(x => x.conclSemDev || 0), backgroundColor: 'rgba(96,165,250,0.6)', borderRadius: 4 },
            { label: 'Reprovadas (6)', data: v.map(x => x.reprovadas), backgroundColor: 'rgba(239,68,68,0.6)', borderRadius: 4 },
            { label: 'Prescritas (23)', data: v.map(x => x.prescritas), backgroundColor: 'rgba(234,179,8,0.6)', borderRadius: 4 }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { font: { size: 10 } } } }, scales: { x: { stacked: true, ticks: { font: { size: 9 }, maxRotation: 90 } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Qtde Descartes', font: { size: 10 } } } } }
      });
    }
  }

  function renderizarTabela() {
    const el = document.getElementById('tabela-descartes');
    if (!el || !dados) return;
    const thead = el.querySelector('thead');
    const tbody = el.querySelector('tbody');
    const { versoes, serie } = versoesFiltradas();

    thead.innerHTML = `<tr><th>Versao</th><th>Entradas</th><th>CsD (5)</th><th>Repr (6)</th><th>Presc (23)</th><th>Total Foco</th><th>% Descarte</th><th>EWMA</th><th>Status</th></tr>`;

    tbody.innerHTML = versoes.map((v, i) => {
      const ewma = serie[i];
      const pct = v.percentual;
      const fn = ewma ? ewma.faixaNormal : 999;
      const fa = ewma ? ewma.faixaAtencao : 999;
      let cor = '', badge = '';
      if (pct <= fn) { cor = 'var(--verde-bg)'; badge = '<span style="color:var(--verde);font-weight:600">Normal</span>'; }
      else if (pct <= fa) { cor = 'var(--amarelo-bg)'; badge = '<span style="color:var(--amarelo);font-weight:600">Atencao</span>'; }
      else { cor = 'var(--vermelho-bg)'; badge = '<span style="color:var(--vermelho);font-weight:600">Critico</span>'; }
      const isAtual = v.versao === dados.versaoAtual;

      return `<tr style="background:${isAtual ? 'var(--info-bg)' : ''}">
        <td><strong>${v.versao}</strong>${isAtual ? ' <span style="color:var(--info);font-size:0.7rem">●</span>' : ''}</td>
        <td>${v.entradas}</td><td>${v.conclSemDev || 0}</td><td>${v.reprovadas}</td><td>${v.prescritas}</td>
        <td><strong>${v.totalDescartesFoco}</strong></td>
        <td style="background:${cor};font-weight:700">${pct}%</td>
        <td>${ewma ? ewma.ewma + '%' : '-'}</td><td>${badge}</td>
      </tr>`;
    }).join('');

    const tot = versoes.reduce((t, v) => ({
      entradas: t.entradas + v.entradas, csd: t.csd + (v.conclSemDev || 0),
      repr: t.repr + v.reprovadas, presc: t.presc + v.prescritas, foco: t.foco + v.totalDescartesFoco
    }), { entradas: 0, csd: 0, repr: 0, presc: 0, foco: 0 });
    const pctTot = tot.entradas ? Math.round((tot.foco / tot.entradas) * 10000) / 100 : 0;
    const rotuloTot = anoSel === 'todos' ? 'Total' : 'Total ' + anoSel;
    tbody.innerHTML += `<tr style="font-weight:700;background:var(--cor-fundo)">
      <td>${rotuloTot}</td><td>${tot.entradas}</td><td>${tot.csd}</td><td>${tot.repr}</td><td>${tot.presc}</td>
      <td>${tot.foco}</td><td>${pctTot}%</td><td>-</td><td>-</td>
    </tr>`;
  }

  function renderizarAnalise() {
    const el = document.getElementById('descartes-analise');
    if (!el || !dados || !dados.estatisticas) return;
    const a = dados.estatisticas.analiseDescricoes;
    if (!a) { el.innerHTML = ''; return; }

    const renderBloco = (titulo, dados) => {
      if (!dados || dados.total === 0) return `<p style="font-size:0.78rem;color:var(--cor-texto-sec)">Sem dados</p>`;
      const gravHtml = Object.entries(dados.porGravidade).sort((a, b) => b[1] - a[1]).map(([g, q]) => `<span style="margin-right:0.8rem"><strong>${g}</strong>: ${q}</span>`).join('');
      const topHtml = dados.topDescricoes.slice(0, 10).map((d, i) => {
        const motNome = d.motivo === 5 ? 'CsD' : d.motivo === 6 ? 'Repr' : 'Presc';
        return `<tr><td style="font-size:0.72rem;color:var(--cor-texto-sec)">${i + 1}</td><td style="font-size:0.75rem;max-width:400px;word-break:break-word">${d.descricao}</td><td><strong>${d.qtd}</strong></td><td>${motNome}</td></tr>`;
      }).join('');
      return `
        <div style="margin-bottom:0.75rem"><strong>Por Gravidade:</strong> ${gravHtml}</div>
        ${topHtml ? `<table class="tabela-detalhes" style="margin-top:0"><thead><tr><th>#</th><th>Descricao (trunc.)</th><th>Qtd</th><th>Motivo</th></tr></thead><tbody>${topHtml}</tbody></table>` : ''}
      `;
    };

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
        <div><div style="font-weight:700;font-size:0.85rem;margin-bottom:0.5rem">Versao Atual (${dados.versaoAtual})</div>${renderBloco('Atual', a.atual)}</div>
        <div><div style="font-weight:700;font-size:0.85rem;margin-bottom:0.5rem">Historico Completo (${a.historico.total} itens)</div>${renderBloco('Historico', a.historico)}</div>
      </div>
    `;
  }

  function destruir(key) { if (charts[key]) { charts[key].destroy(); delete charts[key]; } }
  function r2(v) { return Math.round(v * 100) / 100; }
  function label(c) { return { normal: 'Normal', atencao: 'Atencao', critico: 'Critico' }[c] || c; }

  return { carregar };
})();
