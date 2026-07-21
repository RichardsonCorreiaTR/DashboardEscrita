/**
 * app-isv-yoy.js - Dashboard ISV Year over Year
 *
 * Agrupa ISV por ano, compara meses equivalentes entre anos,
 * calcula tendencias anuais e exibe graficos comparativos.
 * Expoe AppISVYoY.carregar(force) para app-estudos.js.
 */

/* eslint-disable no-unused-vars */
const AppISVYoY = (() => {
  const BASE = '/api';
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const AREAS = [['Escrita', 'Escrita'], ['Importacao', 'Importa\u00e7\u00e3o']];
  let dados = null;
  let charts = {};
  let areaSel = 'Escrita';
  let carregando = false;

  async function carregar(force) {
    if (carregando) return;
    carregando = true;
    renderizarSeletorArea();
    try {
      const params = new URLSearchParams();
      if (force) params.set('force', '1');
      if (areaSel !== 'Escrita') params.set('area', areaSel);
      const qs = params.toString();
      const url = `${BASE}/estudos/historico${qs ? '?' + qs : ''}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(600000) });
      if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).erro || `HTTP ${resp.status}`);
      const raw = await resp.json();
      dados = agrupar(raw);
      renderizar();
    } finally {
      carregando = false;
    }
  }

  function renderizarSeletorArea() {
    const el = document.getElementById('isv-yoy-area-seletor');
    if (!el) return;
    el.innerHTML = '<span style="font-size:0.82rem;color:var(--cor-texto-sec);margin-right:0.5rem">\u00c1rea:</span>' +
      AREAS.map(([val, lbl]) => {
        const ativo = areaSel === val;
        const estilo = ativo
          ? 'background:var(--info,#3b82f6);color:#fff;border-color:var(--info,#3b82f6)'
          : 'background:transparent;color:var(--cor-texto-sec);border-color:var(--cor-borda,#ccc)';
        return `<button data-area="${val}" style="${estilo};border:1px solid;border-radius:6px;padding:0.3rem 0.9rem;margin-right:0.4rem;font-size:0.82rem;cursor:pointer">${lbl}</button>`;
      }).join('');
    el.querySelectorAll('button[data-area]').forEach(b => {
      b.addEventListener('click', () => {
        if (areaSel === b.dataset.area) return;
        areaSel = b.dataset.area;
        carregar(false);
      });
    });
  }

  function agrupar(raw) {
    const versoes = (raw.versoes || []).filter(v => v.isv && !v.isv.insuficiente);
    const porAno = {};

    for (const v of versoes) {
      const match = v.versao.match(/^10\.(\d+)A-(\d{2})$/);
      if (!match) continue;
      const ano = parseInt(match[1], 10) + 2020;
      const mes = parseInt(match[2], 10);
      if (!porAno[ano]) porAno[ano] = { ano, meses: {}, lista: [] };
      porAno[ano].meses[mes] = v;
      porAno[ano].lista.push(v);
    }

    const anos = Object.keys(porAno).map(Number).sort();
    for (const ano of anos) {
      const a = porAno[ano];
      const isvs = a.lista.map(v => v.isv.total);
      a.media = r2(isvs.reduce((s, x) => s + x, 0) / isvs.length);
      a.min = Math.min(...isvs);
      a.max = Math.max(...isvs);
      a.totalVersoes = isvs.length;

      const entradas = a.lista.map(v => v.totais.entradasBrutas);
      a.mediaEntradas = r2(entradas.reduce((s, x) => s + x, 0) / entradas.length);

      if (isvs.length >= 2) {
        const n = isvs.length;
        const xm = (n - 1) / 2, ym = a.media;
        let num = 0, den = 0;
        for (let i = 0; i < n; i++) {
          num += (i - xm) * (isvs[i] - ym);
          den += (i - xm) ** 2;
        }
        a.slope = den ? r2(num / den) : 0;
      } else {
        a.slope = 0;
      }
    }

    const comparativoMensal = [];
    for (let m = 1; m <= 12; m++) {
      const row = { mes: m, label: MESES[m - 1] };
      for (const ano of anos) {
        const v = porAno[ano].meses[m];
        row[ano] = v ? v.isv.total : null;
        row[`ent_${ano}`] = v ? v.totais.entradasBrutas : null;
      }
      comparativoMensal.push(row);
    }

    return { porAno, anos, comparativoMensal };
  }

  function renderizar() {
    renderizarSeletorArea();
    if (!dados) return;
    renderizarKPIs();
    renderizarGraficoLinhas();
    renderizarGraficoBarras();
    renderizarTabela();
    renderizarAnalise();
  }

  function renderizarKPIs() {
    const el = document.getElementById('isv-yoy-kpis');
    if (!el) return;
    const { anos, porAno } = dados;

    const anoAtual = anos[anos.length - 1];
    const anoAnterior = anos.length >= 2 ? anos[anos.length - 2] : null;
    const a = porAno[anoAtual];
    const prev = anoAnterior ? porAno[anoAnterior] : null;

    const parcial = a.totalVersoes < 12;
    const diff = prev ? r2(a.media - prev.media) : 0;
    const diffCor = diff > 2 ? 'var(--verde)' : diff < -2 ? 'var(--vermelho)' : 'var(--cor-texto-sec)';
    const diffSeta = diff > 2 ? '&#9650;' : diff < -2 ? '&#9660;' : '&#9679;';

    let melhorAno = anos[0], piorAno = anos[0];
    for (const y of anos) {
      if (porAno[y].media > porAno[melhorAno].media) melhorAno = y;
      if (porAno[y].media < porAno[piorAno].media) piorAno = y;
    }

    el.innerHTML = `
      <div class="estudo-kpi estudo-kpi--${classISV(a.media)}">
        <div class="estudo-kpi__label">ISV Medio ${anoAtual}${parcial ? ' (parcial)' : ''}</div>
        <div class="estudo-kpi__valor">${a.media}</div>
        <div class="estudo-kpi__sub">${a.totalVersoes}/12 versoes | ${a.mediaEntradas} NE/versao</div>
      </div>
      ${prev ? `
      <div class="estudo-kpi">
        <div class="estudo-kpi__label">vs ${anoAnterior}</div>
        <div class="estudo-kpi__valor" style="color:${diffCor}">${diffSeta} ${diff > 0 ? '+' : ''}${diff} pts</div>
        <div class="estudo-kpi__sub">${prev.media} &rarr; ${a.media}</div>
      </div>` : ''}
      <div class="estudo-kpi">
        <div class="estudo-kpi__label">Tendencia ${anoAtual}${parcial && a.totalVersoes < 4 ? ' (poucos dados)' : ''}</div>
        <div class="estudo-kpi__valor" style="color:${a.slope > 0.5 ? 'var(--verde)' : a.slope < -0.5 ? 'var(--vermelho)' : 'var(--cor-texto-sec)'}">${a.slope > 0.5 ? '&#9650; Melhorando' : a.slope < -0.5 ? '&#9660; Piorando' : '&#9679; Estavel'}</div>
        <div class="estudo-kpi__sub">Slope: ${a.slope > 0 ? '+' : ''}${a.slope} pts/versao</div>
      </div>
      <div class="estudo-kpi">
        <div class="estudo-kpi__label">Melhor Ano</div>
        <div class="estudo-kpi__valor" style="font-size:0.85rem">${melhorAno}</div>
        <div class="estudo-kpi__sub">Media ${porAno[melhorAno].media} pts</div>
      </div>
      <div class="estudo-kpi">
        <div class="estudo-kpi__label">Pior Ano</div>
        <div class="estudo-kpi__valor" style="font-size:0.85rem">${piorAno}</div>
        <div class="estudo-kpi__sub">Media ${porAno[piorAno].media} pts</div>
      </div>
      <div class="estudo-kpi">
        <div class="estudo-kpi__label">Anos Comparados</div>
        <div class="estudo-kpi__valor">${anos.length}</div>
        <div class="estudo-kpi__sub">${anos[0]} a ${anos[anos.length - 1]}</div>
      </div>
    `;
  }

  function renderizarGraficoLinhas() {
    destruir('chartYoYLine');
    const ctx = document.getElementById('chart-isv-yoy-line');
    if (!ctx || !dados) return;

    const { anos, porAno } = dados;
    const cores = ['#3B82F6','#22C55E','#EAB308','#EF4444','#A855F7','#F97316'];

    const datasets = anos.map((ano, i) => {
      const dataPoints = [];
      for (let m = 1; m <= 12; m++) {
        const v = porAno[ano].meses[m];
        dataPoints.push(v ? v.isv.total : null);
      }
      return {
        label: String(ano),
        data: dataPoints,
        borderColor: cores[i % cores.length],
        backgroundColor: cores[i % cores.length] + '15',
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        borderWidth: ano === anos[anos.length - 1] ? 3 : 1.5,
        pointBackgroundColor: cores[i % cores.length],
        spanGaps: true
      };
    });

    charts.chartYoYLine = new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: { labels: MESES, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11 } } },
          tooltip: {
            callbacks: {
              afterLabel: (c) => {
                const ano = anos[c.datasetIndex];
                const mes = c.dataIndex + 1;
                const v = porAno[ano].meses[mes];
                if (!v) return '';
                const imp = v.isv.impacto;
                const impTxt = imp ? ` | Imp:${imp.modificador > 0 ? '+' : ''}${imp.modificador} (${imp.ssc ? imp.ssc.totalSSC : 0} SSC)` : '';
                return `${v.totais.entradasBrutas} NEs | R:${r2(v.isv.pontuacao.ritmo)} T:${r2(v.isv.pontuacao.tendencia)}${impTxt}`;
              }
            }
          }
        },
        scales: {
          y: { min: 0, max: 100, title: { display: true, text: 'ISV', font: { size: 10 } } },
          x: { title: { display: true, text: 'Mes', font: { size: 10 } } }
        }
      }
    });
  }

  function renderizarGraficoBarras() {
    destruir('chartYoYBar');
    const ctx = document.getElementById('chart-isv-yoy-bar');
    if (!ctx || !dados) return;

    const { anos, porAno } = dados;
    const cores = ['#3B82F6','#22C55E','#EAB308','#EF4444','#A855F7','#F97316'];

    const datasets = anos.map((ano, i) => ({
      label: String(ano),
      data: [porAno[ano].media],
      backgroundColor: cores[i % cores.length] + '80',
      borderColor: cores[i % cores.length],
      borderWidth: 1,
      borderRadius: 4
    }));

    charts.chartYoYBar = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: { labels: ['ISV Medio Anual'], datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11 } } },
          tooltip: {
            callbacks: {
              afterLabel: (c) => {
                const ano = anos[c.datasetIndex];
                const a = porAno[ano];
                return `${a.totalVersoes} versoes | ${a.mediaEntradas} NE/versao | Slope:${a.slope}`;
              }
            }
          }
        },
        scales: { y: { min: 0, max: 100, title: { display: true, text: 'ISV Medio', font: { size: 10 } } } }
      }
    });
  }

  function renderizarTabela() {
    const el = document.getElementById('tabela-isv-yoy');
    if (!el || !dados) return;
    const { anos, comparativoMensal, porAno } = dados;

    const thead = el.querySelector('thead');
    const tbody = el.querySelector('tbody');

    thead.innerHTML = `<tr>
      <th>Mes</th>
      ${anos.map(a => `<th colspan="2">${a}</th>`).join('')}
    </tr>
    <tr>
      <th></th>
      ${anos.map(() => '<th>ISV</th><th>NEs</th>').join('')}
    </tr>`;

    tbody.innerHTML = comparativoMensal.map(row => {
      const cells = anos.map(ano => {
        const isv = row[ano];
        const ent = row[`ent_${ano}`];
        if (isv === null) return '<td>-</td><td>-</td>';
        const cls = classISV(isv);
        const cor = cls === 'confortavel' ? 'var(--verde)' : cls === 'normal' ? 'var(--info)' : cls === 'atencao' ? 'var(--amarelo)' : 'var(--vermelho)';
        return `<td style="font-weight:600;color:${cor}">${isv}</td><td>${ent}</td>`;
      }).join('');
      return `<tr><td><strong>${row.label}</strong></td>${cells}</tr>`;
    }).join('');

    const mediaRow = anos.map(ano => {
      const a = porAno[ano];
      const cls = classISV(a.media);
      const cor = cls === 'confortavel' ? 'var(--verde)' : cls === 'normal' ? 'var(--info)' : cls === 'atencao' ? 'var(--amarelo)' : 'var(--vermelho)';
      return `<td style="font-weight:700;color:${cor}">${a.media}</td><td>${a.mediaEntradas}</td>`;
    }).join('');
    tbody.innerHTML += `<tr style="border-top:2px solid var(--cor-borda)"><td><strong>Media</strong></td>${mediaRow}</tr>`;
  }

  function renderizarAnalise() {
    const el = document.getElementById('isv-yoy-analise');
    if (!el || !dados) return;
    const { anos, porAno, comparativoMensal } = dados;

    const insights = [];

    for (let i = 1; i < anos.length; i++) {
      const ant = porAno[anos[i - 1]], cur = porAno[anos[i]];
      const diff = r2(cur.media - ant.media);
      const diffEnt = r2(cur.mediaEntradas - ant.mediaEntradas);
      const seta = diff > 0 ? '&#9650;' : diff < 0 ? '&#9660;' : '&#9679;';
      const cor = diff > 2 ? 'var(--verde)' : diff < -2 ? 'var(--vermelho)' : 'var(--cor-texto-sec)';
      insights.push(`<strong>${anos[i - 1]} &rarr; ${anos[i]}:</strong>
        ISV <span style="color:${cor}">${seta} ${diff > 0 ? '+' : ''}${diff} pts</span>
        (${ant.media} &rarr; ${cur.media}) |
        NE/versao: ${diffEnt > 0 ? '+' : ''}${diffEnt} (${ant.mediaEntradas} &rarr; ${cur.mediaEntradas})`);
    }

    const sazonalidade = [];
    for (let m = 1; m <= 12; m++) {
      const vals = anos.map(a => comparativoMensal[m - 1][a]).filter(v => v !== null);
      if (vals.length >= 2) {
        const med = r2(vals.reduce((s, x) => s + x, 0) / vals.length);
        sazonalidade.push({ mes: m, label: MESES[m - 1], media: med, n: vals.length });
      }
    }
    const melhorMes = sazonalidade.reduce((b, s) => s.media > b.media ? s : b, sazonalidade[0]);
    const piorMes = sazonalidade.reduce((b, s) => s.media < b.media ? s : b, sazonalidade[0]);

    el.innerHTML = `
      <div style="margin-bottom:1rem">
        <strong>Evolucao entre anos</strong>
        <ul style="margin:0.5rem 0;padding-left:1.2rem">${insights.map(i => `<li>${i}</li>`).join('')}</ul>
      </div>
      <div style="margin-bottom:1rem">
        <strong>Sazonalidade (media multi-ano por mes)</strong>
        <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.5rem">
          ${sazonalidade.map(s => {
            const cls = classISV(s.media);
            const cor = cls === 'confortavel' ? 'var(--verde)' : cls === 'normal' ? 'var(--info)' : cls === 'atencao' ? 'var(--amarelo)' : 'var(--vermelho)';
            const tag = s === melhorMes ? ' ★ melhor' : s === piorMes ? ' ✗ pior' : '';
            return `<span style="padding:0.25rem 0.5rem;border-radius:4px;font-size:0.8rem;background:var(--cor-bg-alt);border:1px solid ${cor}"><strong>${s.label}</strong>: <span style="color:${cor}">${s.media}</span> <small>(${s.n}a)${tag}</small></span>`;
          }).join('')}
        </div>
      </div>
      <div>
        <strong>Padroes detectados</strong>
        <ul style="margin:0.5rem 0;padding-left:1.2rem">
          <li>Melhor mes historico: <strong>${melhorMes.label}</strong> (media ${melhorMes.media} pts em ${melhorMes.n} anos)</li>
          <li>Pior mes historico: <strong>${piorMes.label}</strong> (media ${piorMes.media} pts em ${piorMes.n} anos)</li>
          ${anos.length >= 2 ? `<li>Tendencia geral: ${porAno[anos[anos.length-1]].media > porAno[anos[0]].media ? 'ISV medio <strong style="color:var(--verde)">subindo</strong> ao longo dos anos (menos NEs)' : 'ISV medio <strong style="color:var(--vermelho)">caindo</strong> ao longo dos anos (mais NEs)'}</li>` : ''}
        </ul>
      </div>
    `;
  }

  function classISV(val) {
    if (val >= 75) return 'confortavel';
    if (val >= 55) return 'normal';
    if (val >= 35) return 'atencao';
    return 'critico';
  }
  function destruir(key) { if (charts[key]) { charts[key].destroy(); delete charts[key]; } }
  function r2(v) { return Math.round((v || 0) * 100) / 100; }

  return { carregar };
})();
