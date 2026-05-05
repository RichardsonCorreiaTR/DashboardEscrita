/**
 * app-estudos.js - Frontend SPA para Estudos e Analises
 *
 * Gerencia tres views:
 * - semanal-versao: Analise semanal de NE por versao (S1-S4)
 * - semanal-historica: Analise historica agregada (2022+)
 * - liberacoes-sa: Liberacoes de SA (SAM/SAL/SAIL) por versao
 *
 * Cada view tem seus KPIs, graficos e tabelas.
 */

/* eslint-disable no-unused-vars */
const AppEstudos = (() => {
  const BASE = '/api';

  /* ============== ESTADO ============== */
  const estado = {
    view: 'semanal-versao',
    versaoAtual: null,
    versoes: [],
    dadosSemanal: null,
    dadosHistorico: null,
    dadosLiberacoes: null,
    charts: {}
  };

  /* ============== ELEMENTOS ============== */
  let els = {};

  function cachearElementos() {
    els = {
      titulo: document.getElementById('titulo-pagina'),
      subtitulo: document.getElementById('subtitulo-pagina'),
      seletorVersao: document.getElementById('seletor-versao'),
      periodoLabel: document.getElementById('periodo-label'),
      atualizadoLabel: document.getElementById('atualizado-label'),
      btnOdbc: document.getElementById('btn-odbc'),
      btnCache: document.getElementById('btn-cache'),
      btnRetry: document.getElementById('btn-retry'),
      bannerOffline: document.getElementById('banner-offline'),
      bannerMsg: document.getElementById('banner-offline-msg'),
      loading: document.getElementById('loading'),
      loadingMsg: document.getElementById('loading-msg'),
      erroGlobal: document.getElementById('erro-global'),
      erroMsg: document.getElementById('erro-mensagem'),
      viewSemanal: document.getElementById('view-semanal-versao'),
      viewHistorica: document.getElementById('view-semanal-historica'),
      kpisSemanal: document.getElementById('kpis-semanal'),
      saudeContainer: document.getElementById('saude-container'),
      tabelaSemanal: document.getElementById('tabela-semanal'),
      kpisHistorico: document.getElementById('kpis-historico'),
      tendenciaContainer: document.getElementById('tendencia-container'),
      tabelaHistorico: document.getElementById('tabela-historico'),
      viewLiberacoes: document.getElementById('view-liberacoes-sa'),
      kpisLiberacoes: document.getElementById('kpis-liberacoes'),
      correlacaoContainer: document.getElementById('correlacao-container'),
      tabelaLiberacoes: document.getElementById('tabela-liberacoes'),
      viewLiberacoesV2: document.getElementById('view-liberacoes-sa-v2'),
      viewDescartes: document.getElementById('view-descartes-ne'),
      viewISV: document.getElementById('view-isv-ne'),
      viewISVYoY: document.getElementById('view-isv-yoy')
    };
  }

  /* ============== API ============== */

  async function apiGet(rota, timeoutMs) {
    const opts = {};
    if (timeoutMs) {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), timeoutMs);
      opts.signal = ctrl.signal;
    }
    const resp = await fetch(`${BASE}${rota}`, opts);
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.erro || `HTTP ${resp.status}`);
    }
    return resp.json();
  }

  /* ============== UI HELPERS ============== */

  function mostrarLoading(show, msg) {
    els.loading.hidden = !show;
    if (msg) els.loadingMsg.textContent = msg;
    if (show) {
      els.erroGlobal.hidden = true;
      els.viewSemanal.classList.remove('view-toggle--ativo');
      els.viewHistorica.classList.remove('view-toggle--ativo');
      els.viewLiberacoes.classList.remove('view-toggle--ativo');
      if (els.viewLiberacoesV2) els.viewLiberacoesV2.classList.remove('view-toggle--ativo');
      if (els.viewDescartes) els.viewDescartes.classList.remove('view-toggle--ativo');
      if (els.viewISV) els.viewISV.classList.remove('view-toggle--ativo');
      if (els.viewISVYoY) els.viewISVYoY.classList.remove('view-toggle--ativo');
    }
  }

  function mostrarErro(msg) {
    els.erroGlobal.hidden = false;
    els.erroMsg.textContent = msg;
    mostrarLoading(false);
  }

  function mostrarBanner(msg) {
    els.bannerOffline.hidden = !msg;
    if (msg) els.bannerMsg.textContent = msg;
  }

  function ativarView(view) {
    estado.view = view;
    els.viewSemanal.classList.toggle('view-toggle--ativo', view === 'semanal-versao');
    els.viewHistorica.classList.toggle('view-toggle--ativo', view === 'semanal-historica');
    els.viewLiberacoes.classList.toggle('view-toggle--ativo', view === 'liberacoes-sa');
    if (els.viewLiberacoesV2) {
      els.viewLiberacoesV2.classList.toggle('view-toggle--ativo', view === 'liberacoes-sa-v2');
    }
    if (els.viewDescartes) {
      els.viewDescartes.classList.toggle('view-toggle--ativo', view === 'descartes-ne');
    }
    if (els.viewISV) {
      els.viewISV.classList.toggle('view-toggle--ativo', view === 'isv-ne');
    }
    if (els.viewISVYoY) {
      els.viewISVYoY.classList.toggle('view-toggle--ativo', view === 'isv-yoy');
    }

    if (view === 'semanal-versao') {
      els.titulo.textContent = 'Analise Semanal - NE por Versao';
      els.subtitulo.textContent = 'Entradas brutas, descartes, medias e projecao';
      els.seletorVersao.closest('.header__versao').style.display = '';
    } else if (view === 'semanal-historica') {
      els.titulo.textContent = 'Analise Semanal - NE Historica';
      els.subtitulo.textContent = 'Comparativo de todas as versoes desde 2022';
      els.seletorVersao.closest('.header__versao').style.display = 'none';
    } else if (view === 'liberacoes-sa') {
      els.titulo.textContent = 'Liberacoes de SA';
      els.subtitulo.textContent = 'SAM, SAL, SAIL - Analise historica e correlacao com NE';
      els.seletorVersao.closest('.header__versao').style.display = 'none';
    } else if (view === 'isv-ne') {
      els.titulo.textContent = 'ISV - Indice de Saude da Versao';
      els.subtitulo.textContent = 'Ritmo, tendencia, projecao e aceleracao em uma nota de 0 a 100';
      els.seletorVersao.closest('.header__versao').style.display = 'none';
    } else if (view === 'descartes-ne') {
      els.titulo.textContent = 'Analise de Descartes - Concl.s/Dev / Reprovada / Prescrita';
      els.subtitulo.textContent = 'Percentual historico, faixa aceitavel (EWMA) e descricoes mais frequentes';
      els.seletorVersao.closest('.header__versao').style.display = 'none';
    } else if (view === 'isv-yoy') {
      els.titulo.textContent = 'ISV - Year by Year';
      els.subtitulo.textContent = 'Comparativo anual do Indice de Saude da Versao por mes';
      els.seletorVersao.closest('.header__versao').style.display = 'none';
    } else if (view === 'liberacoes-sa-v2') {
      els.titulo.textContent = 'Liberacoes de SA (V2)';
      els.subtitulo.textContent = 'Carga, impacto, previsao validada e prova do algoritmo';
      els.seletorVersao.closest('.header__versao').style.display = 'none';
    }
  }

  function formatarData(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR');
  }

  /* ============== POPULAR VERSOES ============== */

  async function carregarVersoes() {
    try {
      const resp = await apiGet('/estudos/versoes', 8000);
      estado.versoes = resp.versoes || [];
      estado.versaoAtual = resp.atual;

      els.seletorVersao.innerHTML = '';
      // Mais recentes primeiro
      const reversed = [...estado.versoes].reverse();
      for (const v of reversed) {
        const opt = document.createElement('option');
        opt.value = v.versao;
        opt.textContent = v.versao + (v.atual ? ' (atual)' : '');
        els.seletorVersao.appendChild(opt);
      }

      if (estado.versaoAtual) {
        els.seletorVersao.value = estado.versaoAtual;
      }
    } catch (err) {
      console.warn('[estudos] Erro ao carregar versoes:', err.message);
      // Estimar versao
      const agora = new Date();
      const base = agora.getFullYear() - 2020;
      const mes = String(agora.getMonth() + 1).padStart(2, '0');
      estado.versaoAtual = `10.${base}A-${mes}`;
      const opt = document.createElement('option');
      opt.value = estado.versaoAtual;
      opt.textContent = estado.versaoAtual + ' (estimada)';
      els.seletorVersao.appendChild(opt);
    }
  }

  /* ============== VIEW: SEMANAL POR VERSAO ============== */

  async function carregarSemanal(nomeVersao, force) {
    mostrarLoading(true, `Analisando ${nomeVersao}...`);
    mostrarBanner(null);

    try {
      const url = `/estudos/semanal/${nomeVersao}${force ? '?force=1' : ''}`;
      const dados = await apiGet(url, 30000);
      estado.dadosSemanal = dados;

      els.periodoLabel.textContent =
        `${formatarData(dados.periodo.inicio)} - ${formatarData(dados.periodo.fim)}`;
      els.atualizadoLabel.textContent =
        `Atualizado: ${new Date(dados._atualizado_em).toLocaleString('pt-BR')}`;

      renderizarKPIsSemanal(dados);
      renderizarSaude(dados.isv);
      renderizarTabelaSemanal(dados);
      renderizarGraficosSemanal(dados);
      carregarResumoExecutivo(nomeVersao, dados.isv);

      mostrarLoading(false);
      ativarView('semanal-versao');
    } catch (err) {
      mostrarErro(`Erro ao carregar analise: ${err.message}`);
    }
  }

  async function carregarResumoExecutivo(nomeVersao, isv) {
    const section = document.getElementById('resumo-executivo-section');
    if (!section) return;
    try {
      const data = await apiGet(`/estudos/resumo/${nomeVersao}`, 60000);
      section.hidden = false;
      const kpis = document.getElementById('resumo-executivo-kpis');
      const areasDiv = document.getElementById('resumo-executivo-areas');
      const body = document.getElementById('resumo-executivo-body');
      const tbl = document.getElementById('resumo-executivo-tabela');
      const r = data.resumo;
      const pctSSC = data.totalNE > 0 ? Math.round(r.neComSSC / data.totalNE * 100) : 0;

      kpis.innerHTML = `
        <div class="estudo-kpi"><div class="estudo-kpi__label">SSCs Vinculadas</div>
          <div class="estudo-kpi__valor">${r.totalSSC}</div>
          <div class="estudo-kpi__sub">${r.ratio} SSC/NE | ${pctSSC}% NEs tem SSC</div></div>
        <div class="estudo-kpi"><div class="estudo-kpi__label">Criticas</div>
          <div class="estudo-kpi__valor" style="color:var(--vermelho)">${r.criticas}</div></div>
        <div class="estudo-kpi"><div class="estudo-kpi__label">Graves</div>
          <div class="estudo-kpi__valor" style="color:var(--amarelo)">${r.graves}</div></div>
        <div class="estudo-kpi"><div class="estudo-kpi__label">Normais</div>
          <div class="estudo-kpi__valor">${r.normais}</div></div>`;

      renderizarDiagnosticoISV(kpis, isv);
      renderizarAreasAfetadas(areasDiv, data.areas || []);
      renderizarCriticasGraves(body, data.criticasGraves || []);
      renderizarTopSSC(tbl, data.topSSC || []);
    } catch (err) {
      section.hidden = true;
      console.warn('[resumo-executivo] %s', err.message);
    }
  }

  function renderizarAreasAfetadas(el, areas) {
    if (!areas.length) { el.innerHTML = ''; return; }
    const maisAfetada = areas[0];
    let html = `<div style="margin-bottom:0.75rem">
      <strong style="font-size:0.95rem">Areas mais afetadas nesta versao:</strong>
      <p style="margin:0.3rem 0;color:var(--vermelho)">Area critica: <strong>${maisAfetada.area}</strong> &mdash; ${maisAfetada.sscs} SSCs em ${maisAfetada.qtd} NEs`;
    if (maisAfetada.criticas > 0) html += `, ${maisAfetada.criticas} critica(s)`;
    if (maisAfetada.graves > 0) html += `, ${maisAfetada.graves} grave(s)`;
    html += '</p></div>';

    html += '<table class="tabela-detalhes" style="font-size:0.8rem"><thead><tr>' +
      '<th>Area Funcional</th><th>NEs</th><th>SSCs</th><th>Criticas</th><th>Graves</th><th>Normais</th><th>Destaques</th></tr></thead><tbody>';
    for (const a of areas) {
      const destaque = a.topNE.map(n =>
        `<span style="font-size:0.75rem">${n.i_psai} (${n.sscs} SSC)</span>`
      ).join(', ');
      const corLinha = a.criticas > 0 ? 'background:rgba(255,50,50,0.06)' : '';
      html += `<tr style="${corLinha}">
        <td><strong>${a.area}</strong></td>
        <td>${a.qtd}</td><td><strong>${a.sscs}</strong></td>
        <td style="color:var(--vermelho)">${a.criticas || '-'}</td>
        <td style="color:var(--amarelo)">${a.graves || '-'}</td>
        <td>${a.normais}</td><td>${destaque || '-'}</td></tr>`;
    }
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  function renderizarCriticasGraves(el, cg) {
    if (!cg.length) { el.innerHTML = '<em>Sem NEs criticas ou graves nesta versao.</em>'; return; }
    el.innerHTML = '<strong>Detalhamento - NEs Criticas e Graves:</strong>' +
      '<ul style="margin:0.4rem 0;padding-left:1.2rem">' +
      cg.map(n => {
        const cor = n.gravidade === 'Critica' ? 'var(--vermelho)' : 'var(--amarelo)';
        const sscBadge = n.sscs > 0
          ? ` <span style="background:var(--cor-bg-alt);padding:0 4px;border-radius:3px;font-size:0.75rem">${n.sscs} SSC</span>` : '';
        const area = n.area ? ` <span style="opacity:0.6;font-size:0.75rem">[${n.area}]</span>` : '';
        return `<li><span style="color:${cor};font-weight:600">[${n.gravidade}]</span> ${n.descricao || 'PSAI ' + n.i_psai}${area}${sscBadge}</li>`;
      }).join('') + '</ul>';
  }

  function renderizarTopSSC(tbl, top) {
    if (!top.length) return;
    tbl.querySelector('thead').innerHTML = '<tr><th>PSAI</th><th>SSCs</th><th>Grav.</th><th>Area</th><th>Lib.</th><th>Descricao</th></tr>';
    tbl.querySelector('tbody').innerHTML = top.map(n => {
      const cor = n.gravidade === 'Critica' ? 'var(--vermelho)' : n.gravidade === 'Grave' ? 'var(--amarelo)' : '';
      const lib = n.liberacao ? new Date(n.liberacao).toLocaleDateString('pt-BR') : '<em>pendente</em>';
      return `<tr><td>${n.i_psai}</td><td><strong>${n.sscs}</strong></td>` +
        `<td style="color:${cor}">${n.gravidade}</td><td style="font-size:0.8rem">${n.area || ''}</td>` +
        `<td>${lib}</td><td style="font-size:0.8rem">${(n.descricao || '').substring(0, 100)}</td></tr>`;
    }).join('');
  }

  function renderizarDiagnosticoISV(container, isv) {
    if (!isv || isv.insuficiente) return;
    const p = isv.pontuacao;
    const mx = isv.maxPontos || { ritmo: 39, tendencia: 28, projecao: 22, aceleracao: 11 };
    const ref = isv.referencias || {};
    const imp = isv.impacto;

    const fatores = [
      { nome: 'Ritmo', pts: p.ritmo, max: mx.ritmo, pct: round1(p.ritmo / mx.ritmo * 100) },
      { nome: 'Tendencia', pts: p.tendencia, max: mx.tendencia, pct: round1(p.tendencia / mx.tendencia * 100) },
      { nome: 'Projecao', pts: p.projecao, max: mx.projecao, pct: round1(p.projecao / mx.projecao * 100) },
      { nome: 'Aceleracao', pts: p.aceleracao, max: mx.aceleracao, pct: round1(p.aceleracao / mx.aceleracao * 100) }
    ];
    if (imp) {
      fatores.push({ nome: 'Impacto Cliente', pts: imp.modificador, max: 8, pct: null, isModifier: true });
    }

    fatores.sort((a, b) => (a.isModifier ? a.pts : a.pct) - (b.isModifier ? b.pts : b.pct));
    const pior = fatores[0];
    const melhor = fatores[fatores.length - 1];

    const explicacoes = construirExplicacoes(p, mx, ref, imp);

    const classLabel = { confortavel: 'Confortavel', normal: 'Normal', atencao: 'Atencao', critico: 'Critico' };
    const classCor = { confortavel: 'var(--verde)', normal: 'var(--info)', atencao: 'var(--amarelo)', critico: 'var(--vermelho)' };

    let html = `<div style="grid-column:1/-1;margin-top:0.5rem;padding:0.75rem;background:var(--cor-bg-alt);border-radius:8px;font-size:0.82rem;line-height:1.6">
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
        <span style="font-size:1.2rem;font-weight:700;color:${classCor[isv.classificacao] || ''}">${round1(isv.total)}/100</span>
        <span style="font-weight:600;color:${classCor[isv.classificacao] || ''}">${classLabel[isv.classificacao] || isv.classificacao}</span>
        <span style="opacity:0.6">|</span>
        <span>Fator mais critico: <strong style="color:var(--vermelho)">${pior.nome}</strong></span>
      </div>`;

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0.4rem;margin-bottom:0.6rem">';
    for (const f of fatores) {
      const pctVal = f.isModifier ? null : f.pct;
      const cor = f.isModifier
        ? (f.pts > 0 ? 'var(--verde)' : f.pts < 0 ? 'var(--vermelho)' : 'var(--cor-texto-sec)')
        : (pctVal >= 70 ? 'var(--verde)' : pctVal >= 40 ? 'var(--amarelo)' : 'var(--vermelho)');
      const valorTxt = f.isModifier
        ? `${f.pts > 0 ? '+' : ''}${round1(f.pts)} pts`
        : `${round1(f.pts)}/${f.max} (${pctVal}%)`;
      html += `<div style="padding:0.3rem 0.5rem;border-left:3px solid ${cor};background:var(--cor-bg)">
        <div style="font-weight:600;font-size:0.78rem">${f.nome}</div>
        <div style="color:${cor};font-weight:700">${valorTxt}</div></div>`;
    }
    html += '</div>';

    html += '<div style="font-size:0.8rem"><strong>Diagnostico por fator:</strong><ul style="margin:0.3rem 0;padding-left:1.2rem">';
    for (const e of explicacoes) {
      html += `<li style="margin-bottom:0.25rem"><strong>${e.nome}:</strong> ${e.texto}</li>`;
    }
    html += '</ul></div></div>';

    container.insertAdjacentHTML('beforeend', html);
  }

  function construirExplicacoes(p, mx, ref, imp) {
    const exps = [];
    const pctRitmo = round1(p.ritmo / mx.ritmo * 100);
    if (ref.acumuladoAtual && ref.medianaNoEstagio) {
      const ratio = ref.medianaNoEstagio > 0 ? round1(ref.acumuladoAtual / ref.medianaNoEstagio * 100) : 0;
      const diff = ratio - 100;
      if (pctRitmo >= 70) {
        exps.push({ nome: 'Ritmo', texto: `<span style="color:var(--verde)">Bom.</span> ${ref.acumuladoAtual} NEs acumuladas, ${diff > 0 ? '+' : ''}${round1(diff)}% vs mediana historica (${ref.medianaNoEstagio}) neste estagio.` });
      } else if (pctRitmo >= 40) {
        exps.push({ nome: 'Ritmo', texto: `<span style="color:var(--amarelo)">Moderado.</span> ${ref.acumuladoAtual} NEs acumuladas, ${round1(diff)}% acima da mediana (${ref.medianaNoEstagio}). Volume de entradas acima do padrao.` });
      } else {
        exps.push({ nome: 'Ritmo', texto: `<span style="color:var(--vermelho)">Critico.</span> ${ref.acumuladoAtual} NEs acumuladas, ${round1(diff)}% acima da mediana (${ref.medianaNoEstagio}). Volume de entradas muito superior ao historico neste ponto da versao.` });
      }
    }
    const pctTend = round1(p.tendencia / mx.tendencia * 100);
    if (ref.taxaAtual !== undefined && ref.media6meses) {
      const ratio = ref.media6meses > 0 ? round1(ref.taxaAtual / ref.media6meses * 100) : 0;
      if (pctTend >= 70) {
        exps.push({ nome: 'Tendencia', texto: `<span style="color:var(--verde)">Favoravel.</span> Taxa atual ${ref.taxaAtual} NE/dia vs media 6 meses ${ref.media6meses} (${round1(ratio - 100)}%). Entradas em queda relativa.` });
      } else if (pctTend >= 40) {
        exps.push({ nome: 'Tendencia', texto: `<span style="color:var(--amarelo)">Neutra.</span> Taxa ${ref.taxaAtual} NE/dia vs media ${ref.media6meses} (+${round1(ratio - 100)}%). Ritmo proximo ao normal dos ultimos meses.` });
      } else {
        exps.push({ nome: 'Tendencia', texto: `<span style="color:var(--vermelho)">Desfavoravel.</span> Taxa ${ref.taxaAtual} NE/dia, ${round1(ratio - 100)}% acima da media de 6 meses (${ref.media6meses}). Tendencia de aumento nas entradas.` });
      }
    }
    const pctProj = round1(p.projecao / mx.projecao * 100);
    if (ref.projecaoConservadora && ref.medianaHistoricaTotal) {
      const diffProj = round1((ref.projecaoConservadora / ref.medianaHistoricaTotal - 1) * 100);
      if (pctProj >= 70) {
        exps.push({ nome: 'Projecao', texto: `<span style="color:var(--verde)">Positiva.</span> Projecao conservadora de ${ref.projecaoConservadora} NEs vs mediana historica ${ref.medianaHistoricaTotal} (${diffProj > 0 ? '+' : ''}${diffProj}%).` });
      } else if (pctProj >= 40) {
        exps.push({ nome: 'Projecao', texto: `<span style="color:var(--amarelo)">Moderada.</span> Projecao de ${ref.projecaoConservadora} NEs, +${diffProj}% acima da mediana (${ref.medianaHistoricaTotal}).` });
      } else {
        exps.push({ nome: 'Projecao', texto: `<span style="color:var(--vermelho)">Preocupante.</span> Projecao de ${ref.projecaoConservadora} NEs, +${diffProj}% acima da mediana (${ref.medianaHistoricaTotal}). Final previsto muito acima do padrao.` });
      }
    }
    const pctAcel = round1(p.aceleracao / mx.aceleracao * 100);
    if (pctAcel >= 70) {
      exps.push({ nome: 'Aceleracao', texto: '<span style="color:var(--verde)">Desacelerando.</span> O volume de NEs/semana esta diminuindo ao longo da versao.' });
    } else if (pctAcel >= 40) {
      exps.push({ nome: 'Aceleracao', texto: '<span style="color:var(--amarelo)">Estavel.</span> O ritmo semanal de entradas esta relativamente constante.' });
    } else {
      exps.push({ nome: 'Aceleracao', texto: '<span style="color:var(--vermelho)">Acelerando.</span> O volume de NEs/semana esta aumentando, indicando piora progressiva.' });
    }
    if (imp) {
      const ssc = imp.ssc || {};
      if (imp.modificador <= -4) {
        exps.push({ nome: 'Impacto Cliente', texto: `<span style="color:var(--vermelho)">Alto impacto (${imp.modificador} pts).</span> ${ssc.totalSSC || 0} SSCs vinculadas (ratio ${imp.ratio}/NE). Peso: ${imp.indiceComposto ? round1(imp.indiceComposto) : '?'} (percentil ${imp.percentil || '?'}). Versao gerou volume de chamados muito acima do historico, agravado por NEs criticas/graves.` });
      } else if (imp.modificador < 0) {
        exps.push({ nome: 'Impacto Cliente', texto: `<span style="color:var(--amarelo)">Impacto moderado (${imp.modificador} pts).</span> ${ssc.totalSSC || 0} SSCs (ratio ${imp.ratio}/NE). Acima da mediana historica.` });
      } else if (imp.modificador > 0) {
        exps.push({ nome: 'Impacto Cliente', texto: `<span style="color:var(--verde)">Baixo impacto (+${imp.modificador} pts).</span> ${ssc.totalSSC || 0} SSCs (ratio ${imp.ratio}/NE). Abaixo da mediana historica, indicando menor impacto aos clientes.` });
      } else {
        exps.push({ nome: 'Impacto Cliente', texto: `Neutro (0 pts). ${ssc.totalSSC || 0} SSCs (ratio ${imp.ratio || 0}/NE). Alinhado com a mediana historica.` });
      }
    }
    return exps;
  }

  function renderizarKPIsSemanal(dados) {
    // Limpar painel de explicacao anterior (se existir)
    const painelAnterior = document.getElementById('proj-explicacao');
    if (painelAnterior) painelAnterior.remove();

    const t = dados.totais;
    const pr = dados.projecaoRealista;
    const proj = dados.projecao;

    // Linha 1: Realizado
    let html = `
      <div class="estudo-kpi estudo-kpi--destaque">
        <div class="estudo-kpi__label">Realizado</div>
        <div class="estudo-kpi__valor">${t.entradasBrutas}</div>
        <div class="estudo-kpi__sub">${dados.versaoEmAndamento ? (proj ? proj.percentualConcluido + '% concluido' : 'Em andamento') : 'Versao concluida'}</div>
      </div>
      <div class="estudo-kpi">
        <div class="estudo-kpi__label">Media/Dia Util${dados.versaoEmAndamento ? ' (real)' : ''}</div>
        <div class="estudo-kpi__valor">${t.mediaDiaUtil}</div>
        <div class="estudo-kpi__sub">${dados.versaoEmAndamento ? dados.diasUteisDecorridos + ' d.uteis decorridos' : dados.totalDiasUteis + ' d.uteis'} | Corrido: ${t.mediaDiaCorrido}</div>
      </div>
      <div class="estudo-kpi">
        <div class="estudo-kpi__label">Descartes</div>
        <div class="estudo-kpi__valor">${t.descartes}</div>
        <div class="estudo-kpi__sub">${t.mediaDiaUtilDescartes}/dia util</div>
      </div>
    `;

    // KPIs de comparacao com historico (se disponivel)
    if (pr && pr.comparativoEstagio) {
      const ce = pr.comparativoEstagio;
      const corDesvio = ce.desvioPercentual > 10 ? 'vermelho'
        : ce.desvioPercentual < -10 ? 'verde' : 'info';
      const sinal = ce.desvioPercentual > 0 ? '+' : '';

      html += `
        <div class="estudo-kpi estudo-kpi--${corDesvio}">
          <div class="estudo-kpi__label">vs Historico (mesmo estagio)</div>
          <div class="estudo-kpi__valor">${sinal}${ce.desvioPercentual}%</div>
          <div class="estudo-kpi__sub">${ce.acumuladoAtual} atual vs ${ce.medianaHistorica} mediana</div>
        </div>
      `;
    }

    // Projecoes (se versao em andamento e ha dados historicos)
    if (dados.versaoEmAndamento && pr) {
      const corProj = pr.conservadora && pr.historicoTotal
        ? (pr.conservadora > pr.historicoTotal.mediana * 1.1 ? 'vermelho'
          : pr.conservadora < pr.historicoTotal.mediana * 0.9 ? 'verde' : 'amarelo')
        : 'info';

      html += `
        <div class="estudo-kpi estudo-kpi--${corProj}">
          <div class="estudo-kpi__label">Projecao Conservadora</div>
          <div class="estudo-kpi__valor">${pr.conservadora || '?'}</div>
          <div class="estudo-kpi__sub">Linear: ${pr.linear || '?'} | Historica: ${pr.historica || '?'}
            <a href="#" id="btn-proj-como" style="font-size:0.68rem;color:var(--cor-primaria);margin-left:0.5rem;text-decoration:underline">Como se calcula?</a>
          </div>
        </div>
        <div class="estudo-kpi">
          <div class="estudo-kpi__label">Mediana Historica Total</div>
          <div class="estudo-kpi__valor">${pr.historicoTotal ? pr.historicoTotal.mediana : '?'}</div>
          <div class="estudo-kpi__sub">${proj ? proj.diasRestantes + 'd restantes' : ''}</div>
        </div>
      `;
    }

    els.kpisSemanal.innerHTML = html;

    // Painel explicativo da projecao (inserido apos os KPIs)
    if (dados.versaoEmAndamento && pr) {
      const pctEst = pr.percentualEstagio || '?';
      const diasPassados = proj ? proj.diasPassados : '?';
      const taxaDiaria = proj ? proj.taxaDiaria : '?';
      const totalDiasVersao = dados.totalDias || '?';
      const scAtual = dados.semanasConcluidas || '?';
      const acumAtual = pr.acumuladoAtual || '?';

      const painelHtml = `
        <div id="proj-explicacao" style="display:none;margin-top:0.75rem">
          <div style="background:#fff;border-radius:var(--radius);box-shadow:var(--sombra);padding:1rem 1.25rem">
            <div style="font-weight:700;font-size:0.82rem;margin-bottom:0.75rem">Metodologia de Calculo das Projecoes</div>
            <div style="font-size:0.78rem;color:var(--cor-texto-sec);line-height:1.6">

              <div class="isv-metodo">
                <div class="isv-metodo__titulo">1. Projecao Linear</div>
                <div class="isv-metodo__corpo">
                  <p>Calcula a <strong>taxa diaria de entradas</strong> com base nos dias corridos ja passados e projeta linearmente ate o fim da versao.</p>
                  <p><strong>Formula:</strong> total_projetado = (entradas_ate_agora / dias_passados) &times; total_dias_versao</p>
                  <p><strong>Premissa:</strong> Assume que o ritmo de entradas se mantera constante ate o final da versao. Metodo simples, mas pode subestimar se a demanda tende a acelerar nas ultimas semanas.</p>
                  <p class="isv-metodo__dados">
                    <strong>Nesta versao:</strong> ${acumAtual} entradas / ${diasPassados} dias passados = ${taxaDiaria} NE/dia &times; ${totalDiasVersao} dias totais = <strong>${pr.linear || '?'} NEs projetadas</strong>
                  </p>
                </div>
              </div>

              <div class="isv-metodo">
                <div class="isv-metodo__titulo">2. Projecao Historica</div>
                <div class="isv-metodo__corpo">
                  <p>Usa o <strong>padrao de distribuicao semanal historico</strong> para projetar o total. Calcula que percentual do total final as primeiras ${scAtual} semana(s) representaram nas versoes passadas, e aplica essa proporcao ao acumulado atual.</p>
                  <p><strong>Formula:</strong> total_projetado = acumulado_atual / mediana_percentual_no_estagio</p>
                  <p><strong>Premissa:</strong> Assume que a versao atual seguira o mesmo padrao de concentracao de demanda que as versoes historicas. Mais robusto que a linear porque considera que historicamente S3/S4 tendem a concentrar mais entradas.</p>
                  ${pr.percentualEstagio ? `<p class="isv-metodo__dados">
                    <strong>Nesta versao:</strong> Historicamente, as primeiras ${scAtual} semana(s) representam <strong>${pctEst}%</strong> do total final (mediana). Com ${acumAtual} entradas acumuladas: ${acumAtual} / ${(pctEst / 100).toFixed(2)} = <strong>${pr.historica || '?'} NEs projetadas</strong>
                  </p>` : ''}
                </div>
              </div>

              <div class="isv-metodo">
                <div class="isv-metodo__titulo">3. Projecao Conservadora (usada no ISV)</div>
                <div class="isv-metodo__corpo">
                  <p>A projecao conservadora e o <strong>pior cenario</strong> entre a Linear e a Historica &mdash; ou seja, o <strong>maior valor</strong> entre as duas.</p>
                  <p><strong>Formula:</strong> conservadora = max(linear, historica)</p>
                  <p><strong>Por que:</strong> Como mais entradas = pior (mais problemas no produto), o cenario conservador assume que a versao pode fechar com o maior volume projetado. Isso alimenta o ISV de forma mais critica e realista.</p>
                  <p class="isv-metodo__dados">
                    <strong>Nesta versao:</strong> max(${pr.linear || '?'}, ${pr.historica || '?'}) = <strong>${pr.conservadora || '?'} NEs</strong>
                    ${pr.historicoTotal ? ` vs mediana historica de ${pr.historicoTotal.mediana} NEs por versao` : ''}
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      `;

      els.kpisSemanal.insertAdjacentHTML('afterend', painelHtml);

      const btnProjComo = document.getElementById('btn-proj-como');
      const painelProjExp = document.getElementById('proj-explicacao');
      if (btnProjComo && painelProjExp) {
        btnProjComo.addEventListener('click', (e) => {
          e.preventDefault();
          const aberto = painelProjExp.style.display !== 'none';
          painelProjExp.style.display = aberto ? 'none' : 'block';
          btnProjComo.textContent = aberto ? 'Como se calcula?' : 'Ocultar explicacao';
        });
      }
    }
  }

  function renderizarSaude(isv) {
    if (!isv || isv.insuficiente) {
      els.saudeContainer.innerHTML = isv && isv.insuficiente
        ? '<div style="padding:0.5rem;color:var(--cor-texto-sec);font-size:0.8rem">ISV indisponivel: carregue o historico primeiro (menu Semanal - NE Historica) para acumular dados.</div>'
        : '';
      return;
    }

    const maxPts = isv.maxPontos || { ritmo: 39, tendencia: 28, projecao: 22, aceleracao: 11 };

    const nomesFatores = {
      ritmo: 'Ritmo vs Estagio',
      projecao: 'Projecao vs Historico',
      tendencia: 'Tendencia 6 Meses',
      aceleracao: 'Aceleracao Semanal'
    };

    const fatoresHtml = Object.entries(isv.pontuacao).map(([key, val]) => {
      const max = maxPts[key] || 10;
      const pct = Math.round((val / max) * 100);
      const barCor = pct >= 60 ? 'var(--verde)' : pct >= 35 ? 'var(--amarelo)' : 'var(--vermelho)';
      return `
        <div class="saude-fator">
          <div class="saude-fator__nome">${nomesFatores[key] || capitalize(key)} (${round1(val)}/${max})</div>
          <div class="saude-fator__desc">${isv.fatores[key] || ''}</div>
          <div class="saude-fator__barra">
            <div class="saude-fator__barra-fill" style="width:${pct}%;background:${barCor}"></div>
          </div>
        </div>
      `;
    }).join('');

    const labelClass = {
      confortavel: 'Confortavel',
      normal: 'Normal',
      atencao: 'Atencao',
      critico: 'Critico'
    };

    // Dados de referencia para a explicacao
    const ref = isv.referencias || {};

    els.saudeContainer.innerHTML = `
      <div style="background:#fff;border-radius:var(--radius);box-shadow:var(--sombra);padding:1rem 1.25rem">
        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:0.75rem;flex-wrap:wrap">
          <span style="font-weight:700;font-size:0.85rem">Indice de Saude da Versao (ISV) - Foco NE Bruta</span>
          <span class="saude-badge saude-badge--${isv.classificacao}">
            ${round1(isv.total)}/100 - ${labelClass[isv.classificacao] || isv.classificacao}
          </span>
          <a href="#" id="btn-isv-como" style="font-size:0.72rem;color:var(--cor-primaria);margin-left:auto;cursor:pointer;text-decoration:underline">Como se calcula?</a>
        </div>
        <div class="saude-fatores">${fatoresHtml}</div>

        <!-- PAINEL EXPLICATIVO -->
        <div id="isv-explicacao" style="display:none;margin-top:1rem;border-top:1px solid var(--cor-borda);padding-top:1rem">
          <div style="font-weight:700;font-size:0.82rem;margin-bottom:0.75rem">Metodologia de Calculo do ISV</div>
          <div style="font-size:0.78rem;color:var(--cor-texto-sec);line-height:1.6">
            <p style="margin-bottom:0.5rem"><strong>Premissa:</strong> Mais entradas de NE = pior (mais problemas no produto). Menos entradas = melhor. Pontuacao alta = situacao mais saudavel.</p>

            <div class="isv-metodo">
              <div class="isv-metodo__titulo">1. Ritmo vs Estagio (${maxPts.ritmo} pts) - Peso principal</div>
              <div class="isv-metodo__corpo">
                <p>Compara as <strong>NEs brutas acumuladas</strong> ate o momento com o que as versoes historicas tinham <strong>no mesmo ponto de conclusao</strong>.</p>
                <p>Ex: Se estamos na S3 (~75% concluido), soma S1+S2+S3 de todas as versoes passadas e calcula a mediana.</p>
                <p><strong>Calculo:</strong> ratio = acumulado_atual / mediana_historica_no_estagio</p>
                <ul>
                  <li>ratio &le; 0.85 (15% abaixo da mediana) = ${maxPts.ritmo} pts (maximo)</li>
                  <li>ratio = 1.0 (na mediana) = ~20 pts</li>
                  <li>ratio &ge; 1.3 (30% acima da mediana) = 0 pts</li>
                </ul>
                ${ref.acumuladoAtual ? `<p class="isv-metodo__dados"><strong>Nesta versao:</strong> ${ref.acumuladoAtual} NEs brutas acumuladas vs mediana ${ref.medianaNoEstagio} no estagio = ratio ${ref.medianaNoEstagio > 0 ? round1(ref.acumuladoAtual / ref.medianaNoEstagio) : '?'}</p>` : ''}
              </div>
            </div>

            <div class="isv-metodo">
              <div class="isv-metodo__titulo">2. Projecao vs Historico (${maxPts.projecao} pts)</div>
              <div class="isv-metodo__corpo">
                <p>Para versao em andamento: usa a <strong>projecao conservadora</strong> (pior entre projecao linear e projecao baseada no padrao historico).</p>
                <p>Para versao concluida: usa o total real de NEs brutas.</p>
                <p>Compara com a <strong>mediana do total final de NEs brutas</strong> de todas as versoes historicas completas.</p>
                <p><strong>Calculo:</strong> ratio = projecao_conservadora / mediana_historica_total</p>
                <ul>
                  <li>ratio &le; 0.85 = ${maxPts.projecao} pts (projecao bem abaixo do historico)</li>
                  <li>ratio = 1.0 = ~${Math.round(maxPts.projecao / 2)} pts</li>
                  <li>ratio &ge; 1.3 = 0 pts (projecao 30% acima do historico)</li>
                </ul>
                ${ref.projecaoConservadora ? `<p class="isv-metodo__dados"><strong>Nesta versao:</strong> projecao ${ref.projecaoConservadora} NEs brutas vs mediana historica ${ref.medianaHistoricaTotal} = ratio ${ref.medianaHistoricaTotal > 0 ? round1(ref.projecaoConservadora / ref.medianaHistoricaTotal) : '?'}</p>` : ''}
              </div>
            </div>

            <div class="isv-metodo">
              <div class="isv-metodo__titulo">3. Tendencia 6 Meses (${maxPts.tendencia} pts)</div>
              <div class="isv-metodo__corpo">
                <p>Compara a taxa atual de <strong>NEs brutas/dia util decorrido</strong> (somente dias que ja passaram) com a <strong>media das ultimas 6 versoes</strong>.</p>
                <p><strong>Calculo:</strong> ratio = taxa_atual / media_6_meses</p>
                <ul>
                  <li>ratio &le; 0.9 (10% abaixo) = ${maxPts.tendencia} pts</li>
                  <li>ratio = 1.0 (igual) = ~${Math.round(maxPts.tendencia * 0.75)} pts</li>
                  <li>ratio &ge; 1.4 (40% acima) = 0 pts</li>
                </ul>
                ${ref.taxaAtual ? `<p class="isv-metodo__dados"><strong>Nesta versao:</strong> ${ref.taxaAtual} NE bruta/dia util vs media 6m ${ref.media6meses} = ratio ${ref.media6meses > 0 ? round1(ref.taxaAtual / ref.media6meses) : '?'}</p>` : ''}
              </div>
            </div>

            <div class="isv-metodo">
              <div class="isv-metodo__titulo">4. Aceleracao Semanal (${maxPts.aceleracao} pts)</div>
              <div class="isv-metodo__corpo">
                <p>Aplica <strong>regressao linear</strong> nas medias diarias de NE bruta por semana (S1, S2, S3...) para detectar a tendencia.</p>
                <p>Se as entradas brutas estao <strong>desacelerando</strong> (slope negativo) = bom = mais pontos.</p>
                <p>Se estao <strong>acelerando</strong> (slope positivo) = ruim = menos pontos.</p>
                <ul>
                  <li>slope normalizado &le; -0.1 = ${maxPts.aceleracao} pts (desacelerando forte)</li>
                  <li>slope normalizado ~ 0 = ~5 pts (estavel)</li>
                  <li>slope normalizado &ge; 0.3 = 0 pts (acelerando forte)</li>
                </ul>
              </div>
            </div>

            <div class="isv-metodo">
              <div class="isv-metodo__titulo">5. Impacto ao Cliente (&plusmn;8 pts - modificador)</div>
              <div class="isv-metodo__corpo">
                <p>Combina <strong>SSCs vinculadas</strong> (chamados abertos pelos clientes em decorrencia das NEs) com gravidade ponderada:</p>
                <ul>
                  <li><strong>SSC/NE ratio:</strong> Total de SSCs da versao / total NEs, em escala logaritmica</li>
                  <li><strong>Peso por gravidade:</strong> NEs Criticas = 3x, Graves = 2x, Normais = 1x</li>
                  <li><strong>Indice composto:</strong> log(ratio+1) + criticas*0.3 + graves*0.15</li>
                  <li>Compara com percentis historicos (P25/P50/P75/P90). Abaixo da mediana = bonus. Acima = penalidade.</li>
                </ul>
              </div>
            </div>
            <div class="isv-metodo" style="margin-top:0.75rem;border-top:1px solid var(--cor-borda);padding-top:0.75rem">
              <div class="isv-metodo__titulo">Classificacao Final</div>
              <div class="isv-metodo__corpo">
                <p>Soma os 4 fatores (0 a 100 pts) + modificador Impacto ao Cliente (&plusmn;8) e classifica:</p>
                <ul>
                  <li><span style="color:var(--verde);font-weight:600">&ge; 75 pts = Confortavel</span> - Entradas brutas dentro ou abaixo do esperado</li>
                  <li><span style="color:var(--info);font-weight:600">&ge; 55 pts = Normal</span> - Entradas brutas alinhadas ao historico</li>
                  <li><span style="color:var(--amarelo);font-weight:600">&ge; 35 pts = Atencao</span> - Entradas brutas acima do padrao, monitorar</li>
                  <li><span style="color:var(--vermelho);font-weight:600">&lt; 35 pts = Critico</span> - Entradas brutas significativamente piores que o historico</li>
                </ul>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    // Evento toggle
    const btnComo = document.getElementById('btn-isv-como');
    const painelExp = document.getElementById('isv-explicacao');
    if (btnComo && painelExp) {
      btnComo.addEventListener('click', (e) => {
        e.preventDefault();
        const aberto = painelExp.style.display !== 'none';
        painelExp.style.display = aberto ? 'none' : 'block';
        btnComo.textContent = aberto ? 'Como se calcula?' : 'Ocultar explicacao';
      });
    }
  }

  function round1(v) { return Math.round(v * 10) / 10; }

  function renderizarTabelaSemanal(dados) {
    const thead = els.tabelaSemanal.querySelector('thead');
    const tbody = els.tabelaSemanal.querySelector('tbody');

    thead.innerHTML = `
      <tr>
        <th>Semana</th>
        <th>Periodo</th>
        <th>Dias</th>
        <th>D.Uteis</th>
        <th>Entradas</th>
        <th>Acumulado</th>
        <th>Descartes</th>
        <th>Med/D.Util</th>
        <th>Med/D.Corrido</th>
      </tr>
    `;

    const sc = dados.semanasConcluidas || 4;

    tbody.innerHTML = dados.semanas.map((s, idx) => {
      const ativo = s.id === dados.semanaAtual;
      const futuro = dados.versaoEmAndamento && idx >= sc;
      let bg = '';
      if (ativo) bg = ' style="background:var(--info-bg)"';
      else if (futuro) bg = ' style="background:var(--cor-fundo);opacity:0.6"';

      return `
        <tr${bg}>
          <td><strong>${s.id}</strong>${ativo ? ' \u25C0' : ''}${futuro ? ' <span style="font-size:0.65rem;color:var(--cor-texto-sec)">(pendente)</span>' : ''}</td>
          <td>${formatarData(s.inicio)} - ${formatarData(s.fim)}</td>
          <td>${s.dias}</td>
          <td>${s.diasUteis}</td>
          <td><strong>${s.entradasBrutas}</strong></td>
          <td>${s.acumuladoEntradas !== undefined && !isNaN(s.acumuladoEntradas) ? s.acumuladoEntradas : '-'}</td>
          <td>${s.descartes}</td>
          <td>${s.mediaDiaUtil}</td>
          <td>${s.mediaDiaCorrido}</td>
        </tr>
      `;
    }).join('');

    // Linha total
    const t = dados.totais;
    tbody.innerHTML += `
      <tr style="background:var(--cor-fundo);font-weight:700">
        <td>Total${dados.versaoEmAndamento ? ' (parcial)' : ''}</td>
        <td></td>
        <td>${dados.totalDias}</td>
        <td>${dados.totalDiasUteis}</td>
        <td>${t.entradasBrutas}</td>
        <td>${t.entradasBrutas}</td>
        <td>${t.descartes}</td>
        <td>${t.mediaDiaUtil}</td>
        <td>${t.mediaDiaCorrido}</td>
      </tr>
    `;

    // Linha de projecao (se versao em andamento)
    if (dados.versaoEmAndamento && dados.projecaoRealista) {
      const pr = dados.projecaoRealista;
      tbody.innerHTML += `
        <tr style="background:var(--amarelo-bg);font-style:italic;font-size:0.8rem">
          <td colspan="4">Projecao final da versao</td>
          <td title="Conservadora">${pr.conservadora || '?'}</td>
          <td title="Linear: ${pr.linear || '?'} | Historica: ${pr.historica || '?'}">Lin:${pr.linear || '?'} | Hist:${pr.historica || '?'}</td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      `;
    }
  }

  function renderizarGraficosSemanal(dados) {
    destruirChart('chartEntradasSemana');
    destruirChart('chartMediaDiaria');

    const labels = dados.semanas.map(s => s.id);

    // Grafico 1: Entradas por semana
    const ctx1 = document.getElementById('chart-entradas-semana').getContext('2d');
    estado.charts.chartEntradasSemana = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Entradas Brutas',
            data: dados.semanas.map(s => s.entradasBrutas),
            backgroundColor: 'rgba(59,130,246,0.7)',
            borderRadius: 6
          },
          {
            label: 'Descartes',
            data: dados.semanas.map(s => s.descartes),
            backgroundColor: 'rgba(239,68,68,0.5)',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11 } } }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 5 } }
        }
      }
    });

    // Grafico 2: Media diaria
    const ctx2 = document.getElementById('chart-media-diaria').getContext('2d');
    estado.charts.chartMediaDiaria = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Media/Dia Util',
            data: dados.semanas.map(s => s.mediaDiaUtil),
            backgroundColor: 'rgba(34,197,94,0.7)',
            borderRadius: 6
          },
          {
            label: 'Media/Dia Corrido',
            data: dados.semanas.map(s => s.mediaDiaCorrido),
            backgroundColor: 'rgba(168,85,247,0.5)',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11 } } }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  /* ============== VIEW: HISTORICA ============== */

  async function carregarHistorico(force) {
    mostrarLoading(true, 'Carregando historico (pode demorar na primeira vez)...');
    mostrarBanner(null);

    try {
      const url = `/estudos/historico${force ? '?force=1' : ''}`;
      const dados = await apiGet(url, 300000); // 5 min timeout
      estado.dadosHistorico = dados;

      els.atualizadoLabel.textContent =
        `Atualizado: ${new Date(dados._meta.atualizado_em).toLocaleString('pt-BR')}`;

      renderizarKPIsHistorico(dados);
      renderizarTendenciaSemanal(dados);
      renderizarTabelaHistorico(dados);
      renderizarGraficosHistorico(dados);

      mostrarLoading(false);
      ativarView('semanal-historica');
    } catch (err) {
      mostrarErro(`Erro ao carregar historico: ${err.message}`);
    }
  }

  function renderizarKPIsHistorico(dados) {
    const s = dados.estatisticas;
    if (!s) { els.kpisHistorico.innerHTML = ''; return; }

    // Encontrar versao atual (em andamento)
    const vAtual = dados.versoes.find(v => v.versaoEmAndamento);
    const prAtual = vAtual && vAtual.projecaoRealista;
    const isvAtual = vAtual && vAtual.isv && !vAtual.isv.insuficiente ? vAtual.isv : null;

    let html = `
      <div class="estudo-kpi estudo-kpi--destaque">
        <div class="estudo-kpi__label">Versoes Analisadas</div>
        <div class="estudo-kpi__valor">${s.totalVersoes}</div>
        <div class="estudo-kpi__sub">Completas: ${dados._meta.versoes_completas || s.totalVersoes}</div>
      </div>
      <div class="estudo-kpi">
        <div class="estudo-kpi__label">Mediana Entradas/Versao</div>
        <div class="estudo-kpi__valor">${s.entradas.mediana}</div>
        <div class="estudo-kpi__sub">Media: ${s.entradas.media} | DP: ${s.entradas.desvioPadrao}</div>
      </div>
      <div class="estudo-kpi">
        <div class="estudo-kpi__label">Mediana/Dia Util</div>
        <div class="estudo-kpi__valor">${s.mediaDiaUtil.mediana}</div>
        <div class="estudo-kpi__sub">Media: ${s.mediaDiaUtil.media}</div>
      </div>
    `;

    // Versao atual: projecao e posicao
    if (vAtual && prAtual) {
      const desvio = prAtual.comparativoEstagio ? prAtual.comparativoEstagio.desvioPercentual : 0;
      const corDesvio = desvio > 10 ? 'vermelho' : desvio < -10 ? 'verde' : 'amarelo';
      const sinal = desvio > 0 ? '+' : '';

      html += `
        <div class="estudo-kpi estudo-kpi--${corDesvio}">
          <div class="estudo-kpi__label">${vAtual.versao} vs Historico</div>
          <div class="estudo-kpi__valor">${sinal}${desvio}%</div>
          <div class="estudo-kpi__sub">Realizado: ${prAtual.acumuladoAtual} | Proj: ${prAtual.conservadora || '?'}</div>
        </div>
      `;
    }

    if (isvAtual) {
      html += `
        <div class="estudo-kpi estudo-kpi--${isvAtual.classificacao === 'critico' ? 'vermelho' : isvAtual.classificacao === 'atencao' ? 'amarelo' : isvAtual.classificacao === 'confortavel' ? 'verde' : 'info'}">
          <div class="estudo-kpi__label">ISV ${vAtual.versao}</div>
          <div class="estudo-kpi__valor">${round1(isvAtual.total)}/100</div>
          <div class="estudo-kpi__sub">${isvAtual.classificacao}</div>
        </div>
      `;
    }

    if (s.outliers.length > 0) {
      html += `
        <div class="estudo-kpi">
          <div class="estudo-kpi__label">Outliers</div>
          <div class="estudo-kpi__valor">${s.outliers.length}</div>
          <div class="estudo-kpi__sub">${s.outliers.join(', ')}</div>
        </div>
      `;
    }

    els.kpisHistorico.innerHTML = html;
  }

  function renderizarTendenciaSemanal(dados) {
    const s = dados.estatisticas;
    if (!s || !s.porSemana || !s.porSemanaRecente) {
      els.tendenciaContainer.innerHTML = '';
      return;
    }

    const ps = s.porSemana;     // S1-S4 todas as versoes
    const pr = s.porSemanaRecente; // S1-S4 ultimas 6 versoes

    const corHistorica = 'rgba(59,130,246,0.7)';
    const corRecente = 'rgba(234,179,8,0.8)';
    const corMediana = 'rgba(34,197,94,0.7)';

    // Tabela + barras visuais
    const semIds = ['S1', 'S2', 'S3', 'S4'];
    const maxPct = Math.max(
      ...ps.map(x => x.percentualMedio),
      ...pr.map(x => x.percentualMedio)
    );

    function barra(pct, cor) {
      const w = maxPct > 0 ? Math.round((pct / maxPct) * 100) : 0;
      return `<div class="tendencia-barra"><div class="tendencia-barra__fill" style="width:${w}%;background:${cor}"></div></div>`;
    }

    let tabelaHtml = `
      <table class="tendencia-tabela">
        <thead>
          <tr>
            <th></th>
            <th>S1</th>
            <th>S2</th>
            <th>S3</th>
            <th>S4</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight:600;color:${corHistorica}">Historica (todas)</td>
            ${ps.map(x => `<td>${x.percentualMedio}%${barra(x.percentualMedio, corHistorica)}</td>`).join('')}
          </tr>
          <tr>
            <td style="font-weight:600;color:${corRecente}">Recente (6 versoes)</td>
            ${pr.map(x => `<td>${x.percentualMedio}%${barra(x.percentualMedio, corRecente)}</td>`).join('')}
          </tr>
          <tr>
            <td style="font-weight:600;color:${corMediana}">Mediana (entradas)</td>
            ${ps.map(x => `<td>${x.mediana}${barra(x.mediana, corMediana)}</td>`).join('')}
          </tr>
          <tr style="font-size:0.72rem;color:var(--cor-texto-sec)">
            <td>Media/Dia Util</td>
            ${ps.map((x, i) => `<td>Hist: ${x.mediaDiaUtil} | Rec: ${pr[i].mediaDiaUtil}</td>`).join('')}
          </tr>
        </tbody>
      </table>
    `;

    els.tendenciaContainer.innerHTML = `
      <div class="tendencia-panel">
        <div class="tendencia-panel__titulo">Tendencia de Concentracao Semanal (S1-S4)</div>
        <p style="font-size:0.75rem;color:var(--cor-texto-sec);margin-bottom:0.75rem">
          Como a demanda de NEs se distribui ao longo das 4 semanas da versao.
          Valores em % representam a parcela media de entradas brutas por semana.
        </p>
        <div class="tendencia-grid">
          <div>${tabelaHtml}</div>
          <div>
            <div style="font-size:0.75rem;font-weight:600;margin-bottom:0.5rem">Insight</div>
            <div style="font-size:0.75rem;color:var(--cor-texto-sec);line-height:1.6" id="tendencia-insight"></div>
          </div>
        </div>
      </div>
    `;

    // Gerar insight automatico
    const insightEl = document.getElementById('tendencia-insight');
    if (insightEl) {
      const maiorHist = ps.reduce((a, b) => a.percentualMedio > b.percentualMedio ? a : b);
      const maiorRec = pr.reduce((a, b) => a.percentualMedio > b.percentualMedio ? a : b);
      const diffS1 = round1(pr[0].percentualMedio - ps[0].percentualMedio);
      const diffS4 = round1(pr[3].percentualMedio - ps[3].percentualMedio);

      let insight = `<p><strong>Padrao historico:</strong> A maior concentracao de entradas ocorre na <strong>${maiorHist.id}</strong> (${maiorHist.percentualMedio}% do total).</p>`;
      insight += `<p><strong>Tendencia recente:</strong> Nas ultimas 6 versoes, a maior carga esta na <strong>${maiorRec.id}</strong> (${maiorRec.percentualMedio}%).</p>`;

      if (Math.abs(diffS1) > 3) {
        insight += `<p>A S1 recente esta ${diffS1 > 0 ? 'acima' : 'abaixo'} do historico em <strong>${Math.abs(diffS1)} p.p.</strong> - ${diffS1 > 0 ? 'mais demanda no inicio' : 'menos pressao inicial'}.</p>`;
      }
      if (Math.abs(diffS4) > 3) {
        insight += `<p>A S4 recente esta ${diffS4 > 0 ? 'acima' : 'abaixo'} do historico em <strong>${Math.abs(diffS4)} p.p.</strong> - ${diffS4 > 0 ? 'versoes ficando mais carregadas no fim' : 'fechamento mais tranquilo'}.</p>`;
      }

      insightEl.innerHTML = insight;
    }
  }

  function renderizarTabelaHistorico(dados) {
    const thead = els.tabelaHistorico.querySelector('thead');
    const tbody = els.tabelaHistorico.querySelector('tbody');

    thead.innerHTML = `
      <tr>
        <th></th>
        <th>Versao</th>
        <th>Dias</th>
        <th>Entradas</th>
        <th>Proj.</th>
        <th>Descartes</th>
        <th>Media/D.Util</th>
        <th>S1</th>
        <th>S2</th>
        <th>S3</th>
        <th>S4</th>
        <th>ISV</th>
      </tr>
    `;

    const outliers = new Set(dados.estatisticas.outliers);

    tbody.innerHTML = dados.versoes.map((v, idx) => {
      const isOutlier = outliers.has(v.versao);
      const isv = v.isv;
      const isvBadge = isv && !isv.insuficiente
        ? `<span class="saude-badge saude-badge--${isv.classificacao}" style="font-size:0.65rem;padding:0.15rem 0.4rem">${round1(isv.total)}</span>`
        : '<span style="color:var(--cor-texto-sec);font-size:0.7rem">-</span>';

      const semanas = v.semanas || [];
      const sc = v.semanasConcluidas || 4;
      const s = [0, 1, 2, 3].map(i => {
        if (!semanas[i]) return '-';
        const val = semanas[i].entradasBrutas;
        if (v.versaoEmAndamento && i >= sc) {
          return `<span style="color:var(--cor-texto-sec)">${val}*</span>`;
        }
        return val;
      });

      const pr = v.projecaoRealista;
      const projCol = v.versaoEmAndamento && pr && pr.conservadora
        ? `<span style="color:var(--amarelo);font-weight:600" title="Projecao conservadora">${pr.conservadora}</span>`
        : '-';

      const bgStyle = isOutlier ? ' style="background:var(--amarelo-bg)"'
        : v.versaoEmAndamento ? ' style="background:var(--info-bg)"' : '';

      // Sub-linhas de detalhamento semanal
      const detalheId = `detalhe-${idx}`;
      let detalheHtml = '';
      if (semanas.length > 0) {
        detalheHtml = semanas.map(sem => {
          const acum = sem.acumuladoEntradas !== undefined && !isNaN(sem.acumuladoEntradas)
            ? sem.acumuladoEntradas : '-';
          return `
            <tr class="hist-detalhe hist-detalhe--${detalheId}" style="display:none">
              <td></td>
              <td style="padding-left:1.5rem;font-size:0.75rem;color:var(--cor-texto-sec)">
                <strong>${sem.id}</strong>
              </td>
              <td style="font-size:0.75rem">${sem.dias}d / ${sem.diasUteis}du</td>
              <td style="font-size:0.75rem">${sem.entradasBrutas}</td>
              <td style="font-size:0.75rem;color:var(--cor-texto-sec)">${acum}</td>
              <td style="font-size:0.75rem">${sem.descartes}</td>
              <td style="font-size:0.75rem">${sem.mediaDiaUtil}</td>
              <td colspan="4" style="font-size:0.7rem;color:var(--cor-texto-sec)">
                ${formatarData(sem.inicio)} - ${formatarData(sem.fim)}
              </td>
              <td></td>
            </tr>
          `;
        }).join('');
      }

      return `
        <tr${bgStyle} class="hist-row" data-detalhe="${detalheId}">
          <td style="width:1.5rem;cursor:pointer;text-align:center" class="hist-toggle" data-target="${detalheId}">
            <span class="hist-toggle__seta">&#9654;</span>
          </td>
          <td>
            <strong>${v.versao}</strong>
            ${isOutlier ? ' <span title="Outlier" style="color:var(--amarelo)">&#9888;</span>' : ''}
            ${v.versaoEmAndamento ? ' <span title="Em andamento" style="color:var(--info)">&#9679;</span>' : ''}
          </td>
          <td>${v.totalDias}</td>
          <td><strong>${v.totais.entradasBrutas}</strong>${v.versaoEmAndamento ? '<sup style="font-size:0.6rem;color:var(--cor-texto-sec)">parcial</sup>' : ''}</td>
          <td>${projCol}</td>
          <td>${v.totais.descartes}</td>
          <td>${v.totais.mediaDiaUtil}</td>
          <td>${s[0]}</td>
          <td>${s[1]}</td>
          <td>${s[2]}</td>
          <td>${s[3]}</td>
          <td>${isvBadge}</td>
        </tr>
        ${detalheHtml}
      `;
    }).join('');

    // Bind toggles de expansao
    tbody.querySelectorAll('.hist-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        const seta = btn.querySelector('.hist-toggle__seta');
        const linhas = tbody.querySelectorAll(`.hist-detalhe--${target}`);
        const aberto = linhas[0] && linhas[0].style.display !== 'none';
        linhas.forEach(l => { l.style.display = aberto ? 'none' : 'table-row'; });
        seta.style.transform = aberto ? '' : 'rotate(90deg)';
      });
    });
  }

  function renderizarGraficosHistorico(dados) {
    destruirChart('chartHistEntradas');
    destruirChart('chartHistMedia');
    destruirChart('chartHistSemanas');
    destruirChart('chartTendenciaSemanas');

    const versoes = dados.versoes;
    const labels = versoes.map(v => v.versao);
    const outliers = new Set(dados.estatisticas.outliers);

    // 1. Entradas brutas por versao (wide)
    const ctx1 = document.getElementById('chart-historico-entradas').getContext('2d');
    estado.charts.chartHistEntradas = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Entradas Brutas',
          data: versoes.map(v => v.totais.entradasBrutas),
          backgroundColor: versoes.map(v =>
            outliers.has(v.versao) ? 'rgba(234,179,8,0.7)'
            : v.versaoEmAndamento ? 'rgba(59,130,246,0.8)'
            : 'rgba(59,130,246,0.5)'
          ),
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => {
                const v = versoes[ctx.dataIndex];
                return `Media/dia util: ${v.totais.mediaDiaUtil}\nDescartes: ${v.totais.descartes}`;
              }
            }
          }
        },
        scales: {
          x: { ticks: { font: { size: 9 }, maxRotation: 90 } },
          y: { beginAtZero: true }
        }
      }
    });

    // 2. Media diaria por versao
    const ctx2 = document.getElementById('chart-historico-media').getContext('2d');
    const medianaGeral = dados.estatisticas.mediaDiaUtil.mediana;
    estado.charts.chartHistMedia = new Chart(ctx2, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Media/Dia Util',
            data: versoes.map(v => v.totais.mediaDiaUtil),
            borderColor: 'rgba(59,130,246,0.8)',
            backgroundColor: 'rgba(59,130,246,0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 3
          },
          {
            label: `Mediana (${medianaGeral})`,
            data: versoes.map(() => medianaGeral),
            borderColor: 'rgba(239,68,68,0.6)',
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 10 } } } },
        scales: {
          x: { ticks: { font: { size: 9 }, maxRotation: 90 } },
          y: { beginAtZero: true }
        }
      }
    });

    // 3. Medias por semana (S1-S4)
    const semStats = dados.estatisticas.porSemana;
    const ctx3 = document.getElementById('chart-historico-semanas').getContext('2d');
    estado.charts.chartHistSemanas = new Chart(ctx3, {
      type: 'bar',
      data: {
        labels: semStats.map(s => s.id),
        datasets: [
          {
            label: 'Media',
            data: semStats.map(s => s.media),
            backgroundColor: 'rgba(59,130,246,0.6)',
            borderRadius: 6
          },
          {
            label: 'Mediana',
            data: semStats.map(s => s.mediana),
            backgroundColor: 'rgba(34,197,94,0.6)',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } },
        scales: { y: { beginAtZero: true } }
      }
    });

    // 4. Tendencia de concentracao semanal (%)
    const semRecente = dados.estatisticas.porSemanaRecente;
    if (semStats && semRecente) {
      const ctx4 = document.getElementById('chart-tendencia-semanas');
      if (ctx4) {
        estado.charts.chartTendenciaSemanas = new Chart(ctx4.getContext('2d'), {
          type: 'bar',
          data: {
            labels: ['S1', 'S2', 'S3', 'S4'],
            datasets: [
              {
                label: 'Historica (% medio)',
                data: semStats.map(s => s.percentualMedio),
                backgroundColor: 'rgba(59,130,246,0.6)',
                borderRadius: 6
              },
              {
                label: 'Recente 6v (% medio)',
                data: semRecente.map(s => s.percentualMedio),
                backgroundColor: 'rgba(234,179,8,0.7)',
                borderRadius: 6
              },
              {
                label: 'Mediana (entradas)',
                data: semStats.map(s => s.mediana),
                backgroundColor: 'rgba(34,197,94,0.5)',
                borderRadius: 6,
                yAxisID: 'y1'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'top', labels: { font: { size: 10 } } },
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    const ds = ctx.dataset;
                    if (ctx.datasetIndex < 2) {
                      return `${ds.label}: ${ctx.parsed.y}%`;
                    }
                    return `${ds.label}: ${ctx.parsed.y} NEs`;
                  }
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                title: { display: true, text: '% do total', font: { size: 10 } },
                ticks: { callback: v => v + '%' }
              },
              y1: {
                position: 'right',
                beginAtZero: true,
                title: { display: true, text: 'NEs (mediana)', font: { size: 10 } },
                grid: { drawOnChartArea: false }
              }
            }
          }
        });
      }
    }
  }

  /* ============== VIEW: LIBERACOES DE SA ============== */

  async function carregarLiberacoes(force) {
    mostrarLoading(true, 'Carregando liberacoes de SA (pode demorar na primeira vez)...');
    mostrarBanner(null);

    try {
      const url = `/estudos/liberacoes-sa${force ? '?force=1' : ''}`;
      const dados = await apiGet(url, 300000);
      estado.dadosLiberacoes = dados;

      els.atualizadoLabel.textContent =
        `Atualizado: ${new Date(dados._meta.atualizado_em).toLocaleString('pt-BR')}`;

      renderizarKPIsLiberacoes(dados);
      renderizarIILPrevisao(dados);
      renderizarCorrelacao(dados);
      renderizarTabelaLiberacoes(dados);
      renderizarGraficosLiberacoes(dados);

      mostrarLoading(false);
      ativarView('liberacoes-sa');
    } catch (err) {
      mostrarErro(`Erro ao carregar liberacoes: ${err.message}`);
    }
  }

  function renderizarKPIsLiberacoes(dados) {
    const s = dados.estatisticas;
    if (!s) { els.kpisLiberacoes.innerHTML = ''; return; }

    const c = dados.correlacao;

    let html = `
      <div class="estudo-kpi estudo-kpi--destaque">
        <div class="estudo-kpi__label">Versoes Analisadas</div>
        <div class="estudo-kpi__valor">${s.totalVersoes}</div>
        <div class="estudo-kpi__sub">Mediana: ${s.total.mediana} SAs/versao</div>
      </div>
      <div class="estudo-kpi">
        <div class="estudo-kpi__label">Proporcao Media</div>
        <div class="estudo-kpi__valor" style="font-size:0.82rem">
          <span style="color:var(--info)">SAM ${s.proporcaoMedia.SAM}%</span>
          <span style="color:var(--verde)">SAL ${s.proporcaoMedia.SAL}%</span>
          <span style="color:var(--amarelo)">SAIL ${s.proporcaoMedia.SAIL}%</span>
        </div>
        <div class="estudo-kpi__sub">SAM:${s.porTipo.SAM.mediana} | SAL:${s.porTipo.SAL.mediana} | SAIL:${s.porTipo.SAIL.mediana} (medianas)</div>
      </div>
      <div class="estudo-kpi">
        <div class="estudo-kpi__label">Carga Ponderada Med.</div>
        <div class="estudo-kpi__valor">${s.carga.mediana}</div>
        <div class="estudo-kpi__sub">Media: ${s.carga.media} | DP: ${s.carga.desvioPadrao}</div>
      </div>
      <div class="estudo-kpi">
        <div class="estudo-kpi__label">Horas Prev. Med./Versao</div>
        <div class="estudo-kpi__valor">${s.horasPrevistas.mediana}h</div>
        <div class="estudo-kpi__sub">Media: ${s.horasPrevistas.media}h</div>
      </div>
    `;

    // Correlacao ponderada
    if (c && c.melhorPreditorR !== null && c.melhorPreditorR !== undefined) {
      const absR = Math.abs(c.melhorPreditorR);
      const corCorr = absR >= 0.5 ? 'vermelho' : absR >= 0.3 ? 'amarelo' : 'verde';
      html += `
        <div class="estudo-kpi estudo-kpi--${corCorr}">
          <div class="estudo-kpi__label">Melhor Correlacao</div>
          <div class="estudo-kpi__valor">${c.melhorPreditorR}</div>
          <div class="estudo-kpi__sub">${c.melhorPreditorLabel} (${c.totalPontos} pares)
            ${c.regressao ? ' | R²=' + c.regressao.r2 : ''}</div>
        </div>
      `;
    }

    // Previsao de NEs para versao atual
    const prev = dados.previsao;
    if (prev) {
      const corPrev = prev.risco === 'critico' ? 'vermelho'
        : prev.risco === 'elevado' ? 'amarelo'
        : prev.risco === 'favoravel' ? 'verde' : 'info';
      html += `
        <div class="estudo-kpi estudo-kpi--${corPrev}">
          <div class="estudo-kpi__label">Previsao NEs (${dados.versaoAtual} +1)</div>
          <div class="estudo-kpi__valor">${prev.prevPontual}</div>
          <div class="estudo-kpi__sub">${prev.prevOtimista}-${prev.prevPessimista} (intervalo)${prev.medianaNE ? ' | Med.hist: ' + prev.medianaNE : ''}</div>
        </div>
      `;
    }

    if (s.outliers.length > 0) {
      html += `
        <div class="estudo-kpi">
          <div class="estudo-kpi__label">Outliers</div>
          <div class="estudo-kpi__valor">${s.outliers.length}</div>
          <div class="estudo-kpi__sub">${s.outliers.join(', ')}</div>
        </div>
      `;
    }

    els.kpisLiberacoes.innerHTML = html;
  }

  function renderizarIILPrevisao(dados) {
    // Painel do IIL da versao atual + Previsao + Explicacao do algoritmo
    const vAtual = dados.versaoAtual;
    const vDados = dados.versoes.find(v => v.versao === vAtual);
    const iil = vDados ? vDados.iil : null;
    const prev = dados.previsao;
    const corr = dados.correlacao;

    let html = '';

    // IIL da versao atual
    if (iil) {
      const maxPts = iil.maxPontos;
      const classLabels = { baixo: 'Baixo', moderado: 'Moderado', alto: 'Alto', critico: 'Critico' };
      const classColors = { baixo: 'var(--verde)', moderado: 'var(--info)', alto: 'var(--amarelo)', critico: 'var(--vermelho)' };

      const fatoresHtml = Object.entries(iil.pontuacao).map(([key, val]) => {
        const max = maxPts[key] || 10;
        const pct = Math.round((val / max) * 100);
        const barCor = pct >= 60 ? 'var(--vermelho)' : pct >= 35 ? 'var(--amarelo)' : 'var(--verde)';
        const nomes = { volume: 'Volume', complexidade: 'Complexidade', perfil: 'Perfil de Risco', desvio: 'Desvio Estimativa', abrangencia: 'Abrangencia' };
        return `
          <div class="saude-fator">
            <div class="saude-fator__nome">${nomes[key] || key} (${round1(val)}/${max})</div>
            <div class="saude-fator__desc">${iil.fatores[key] || ''}</div>
            <div class="saude-fator__barra">
              <div class="saude-fator__barra-fill" style="width:${pct}%;background:${barCor}"></div>
            </div>
          </div>
        `;
      }).join('');

      html += `
        <div style="background:#fff;border-radius:var(--radius);box-shadow:var(--sombra);padding:1rem 1.25rem;margin-bottom:1rem">
          <div style="display:flex;align-items:center;gap:1rem;margin-bottom:0.75rem;flex-wrap:wrap">
            <span style="font-weight:700;font-size:0.85rem">IIL - Indice de Impacto de Liberacao (${vAtual})</span>
            <span class="saude-badge" style="background:${classColors[iil.classificacao] || 'var(--info)'};color:#fff;padding:0.2rem 0.6rem;border-radius:6px;font-size:0.75rem;font-weight:700">
              ${round1(iil.total)}/100 - ${classLabels[iil.classificacao] || iil.classificacao}
            </span>
            <a href="#" id="btn-iil-como" style="font-size:0.72rem;color:var(--cor-primaria);margin-left:auto;cursor:pointer;text-decoration:underline">Como se calcula?</a>
          </div>
          <p style="font-size:0.73rem;color:var(--cor-texto-sec);margin-bottom:0.75rem">
            Mede o risco de a versao ${vAtual} gerar NEs na versao seguinte. Mais alto = mais risco.
          </p>
          <div class="saude-fatores">${fatoresHtml}</div>
      `;

      // Previsao dentro do mesmo painel
      if (prev) {
        const corRisco = prev.risco === 'critico' ? 'var(--vermelho)'
          : prev.risco === 'elevado' ? 'var(--amarelo)'
          : prev.risco === 'favoravel' ? 'var(--verde)' : 'var(--info)';

        html += `
          <div style="margin-top:1rem;padding-top:0.75rem;border-top:1px solid var(--cor-borda)">
            <div style="font-weight:700;font-size:0.82rem;margin-bottom:0.5rem">
              Previsao de NEs para a proxima versao
              <span style="display:inline-block;background:${corRisco};color:#fff;padding:0.15rem 0.5rem;border-radius:4px;font-size:0.7rem;margin-left:0.5rem">${prev.risco}</span>
            </div>
            <div style="display:flex;gap:1.5rem;flex-wrap:wrap;font-size:0.78rem">
              <div>
                <strong style="font-size:1.1rem">${prev.prevPontual} NEs</strong>
                <div style="color:var(--cor-texto-sec)">Previsao pontual</div>
              </div>
              <div>
                <strong>${prev.prevOtimista} - ${prev.prevPessimista}</strong>
                <div style="color:var(--cor-texto-sec)">Intervalo de confianca</div>
              </div>
              ${prev.medianaNE ? `
              <div>
                <strong>${prev.medianaNE}</strong>
                <div style="color:var(--cor-texto-sec)">Mediana historica NE</div>
              </div>
              ` : ''}
              ${prev.variacaoVsMediana !== null ? `
              <div>
                <strong style="color:${prev.variacaoVsMediana > 10 ? 'var(--vermelho)' : prev.variacaoVsMediana < -10 ? 'var(--verde)' : 'inherit'}">${prev.variacaoVsMediana > 0 ? '+' : ''}${prev.variacaoVsMediana}%</strong>
                <div style="color:var(--cor-texto-sec)">vs Mediana</div>
              </div>
              ` : ''}
            </div>
            <div style="font-size:0.7rem;color:var(--cor-texto-sec);margin-top:0.5rem">
              Modelo: ${prev.modelo.formula} (R²=${prev.modelo.r2}, qualidade: ${prev.modelo.qualidade})
            </div>
          </div>
        `;
      }

      // Painel explicativo do IIL (oculto)
      html += `
          <div id="iil-explicacao" style="display:none;margin-top:1rem;border-top:1px solid var(--cor-borda);padding-top:1rem">
            <div style="font-weight:700;font-size:0.82rem;margin-bottom:0.75rem">Metodologia do IIL e Modelo de Previsao</div>
            <div style="font-size:0.78rem;color:var(--cor-texto-sec);line-height:1.6">
              <p style="margin-bottom:0.5rem"><strong>Premissa:</strong> Mais SAs liberadas, mais complexas e com maior desvio de estimativa = maior risco de NEs na proxima versao.</p>

              <div class="isv-metodo">
                <div class="isv-metodo__titulo">1. Volume (${maxPts.volume} pts)</div>
                <div class="isv-metodo__corpo">
                  <p>Compara a <strong>quantidade de SAs</strong> liberadas com a mediana historica.</p>
                  <p>Ratio &le; 0.5 = 0 pts (poucas SAs) | Ratio 1.0 = ~10 pts | Ratio &ge; 1.5 = ${maxPts.volume} pts (muitas SAs)</p>
                </div>
              </div>

              <div class="isv-metodo">
                <div class="isv-metodo__titulo">2. Complexidade (${maxPts.complexidade} pts) - Peso principal</div>
                <div class="isv-metodo__corpo">
                  <p>Usa a <strong>Carga Ponderada</strong>: cada SA recebe um peso baseado no tempo previsto (Baixa=1, Media=2, Alta=4, Muito Alta=8), multiplicado pelo tipo (SAM=1.0, SAL=1.3, SAIL=1.5), desvio de estimativa e abrangencia (SSCs).</p>
                  <p><strong>Formula por SA:</strong> Carga = pesoFaixa &times; pesoTipo &times; pesoDesvio &times; pesoAbrangencia</p>
                  <p>Compara a soma de cargas da versao com a mediana historica.</p>
                </div>
              </div>

              <div class="isv-metodo">
                <div class="isv-metodo__titulo">3. Perfil de Risco (${maxPts.perfil} pts)</div>
                <div class="isv-metodo__corpo">
                  <p>Proporcao de SAs de <strong>alta/muito alta complexidade</strong> (60% do peso) + proporcao de SAs <strong>legais</strong> (SAL+SAIL, 40% do peso).</p>
                  <p>Versoes com mais itens complexos e legais sao historicamente mais problematicas.</p>
                </div>
              </div>

              <div class="isv-metodo">
                <div class="isv-metodo__titulo">4. Desvio Estimativa (${maxPts.desvio} pts)</div>
                <div class="isv-metodo__corpo">
                  <p>Mede o quanto o <strong>tempo realizado excedeu o previsto</strong>. Subestimativa = testes insuficientes = mais NEs.</p>
                  <p>Desvio &le; -20% = 0 pts | Desvio +50% = ${maxPts.desvio} pts (maximo risco)</p>
                </div>
              </div>

              <div class="isv-metodo">
                <div class="isv-metodo__titulo">5. Abrangencia (${maxPts.abrangencia} pts)</div>
                <div class="isv-metodo__corpo">
                  <p>Media de <strong>SSC (Subitens de Construcao)</strong> por SA. Mais SSCs = mais codigo alterado = mais risco.</p>
                </div>
              </div>

              <div class="isv-metodo" style="margin-top:0.75rem;border-top:1px solid var(--cor-borda);padding-top:0.75rem">
                <div class="isv-metodo__titulo">Modelo de Previsao de NEs</div>
                <div class="isv-metodo__corpo">
                  <p>Testa 3 preditores (Qtde SAs, Carga Ponderada, Horas Previstas) e escolhe o com <strong>maior correlacao Pearson</strong> com NEs da versao seguinte.</p>
                  <p>Aplica <strong>regressao linear</strong> no melhor preditor para projetar NEs. Intervalo = previsao &plusmn; erro padrao.</p>
                  ${corr && corr.regressao ? `
                  <p class="isv-metodo__dados">
                    <strong>Preditor escolhido:</strong> ${corr.melhorPreditorLabel} (r=${corr.melhorPreditorR})
                    | Simples r=${corr.pearsonSimples || 'N/A'} | Carga r=${corr.pearsonCarga || 'N/A'} | Horas r=${corr.pearsonHoras || 'N/A'}
                  </p>` : ''}
                </div>
              </div>

              <div class="isv-metodo" style="margin-top:0.5rem">
                <div class="isv-metodo__titulo">Classificacao IIL</div>
                <div class="isv-metodo__corpo">
                  <ul>
                    <li><span style="color:var(--verde);font-weight:600">&lt; 30 pts = Baixo</span> - Liberacao leve, baixa chance de impacto</li>
                    <li><span style="color:var(--info);font-weight:600">30-49 pts = Moderado</span> - Liberacao tipica, risco padrao</li>
                    <li><span style="color:var(--amarelo);font-weight:600">50-69 pts = Alto</span> - Liberacao pesada, monitorar proxima versao</li>
                    <li><span style="color:var(--vermelho);font-weight:600">&ge; 70 pts = Critico</span> - Liberacao de alto impacto, preparar-se para demanda elevada</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    els.correlacaoContainer.innerHTML = html;

    // Bind toggle explicacao
    const btnComo = document.getElementById('btn-iil-como');
    const painelExp = document.getElementById('iil-explicacao');
    if (btnComo && painelExp) {
      btnComo.addEventListener('click', (e) => {
        e.preventDefault();
        const aberto = painelExp.style.display !== 'none';
        painelExp.style.display = aberto ? 'none' : 'block';
        btnComo.textContent = aberto ? 'Como se calcula?' : 'Ocultar explicacao';
      });
    }
  }

  function renderizarCorrelacao(dados) {
    const c = dados.correlacao;
    if (!c || c.totalPontos < 3) return;

    const topCarga = [...c.pontos].sort((a, b) => b.cargaPonderada - a.cargaPonderada).slice(0, 5);
    const topNE = [...c.pontos].sort((a, b) => b.nesVersaoSeguinte - a.nesVersaoSeguinte).slice(0, 5);

    const painelHtml = `
      <div class="tendencia-panel" style="margin-top:1rem">
        <div class="tendencia-panel__titulo">Detalhamento da Correlacao SA x NE</div>
        <p style="font-size:0.75rem;color:var(--cor-texto-sec);margin-bottom:0.75rem">
          Comparacao dos 3 preditores testados:
          Qtde SAs (r=${c.pearsonSimples || 'N/A'}) |
          Carga Ponderada (r=${c.pearsonCarga || 'N/A'}) |
          Horas Previstas (r=${c.pearsonHoras || 'N/A'})
          &mdash; Melhor: <strong>${c.melhorPreditorLabel}</strong>
        </p>
        <div class="tendencia-grid">
          <div>
            <div style="font-size:0.75rem;font-weight:600;margin-bottom:0.5rem">Top 5 - Maior Carga Ponderada</div>
            <table class="tendencia-tabela" style="font-size:0.75rem">
              <thead><tr><th>Versao</th><th>Carga</th><th>SAs</th><th>NEs (N+1)</th></tr></thead>
              <tbody>
                ${topCarga.map(p => `<tr><td>${p.versao}</td><td>${p.cargaPonderada}</td><td>${p.totalSA}</td><td>${p.nesVersaoSeguinte}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
          <div>
            <div style="font-size:0.75rem;font-weight:600;margin-bottom:0.5rem">Top 5 - Mais NEs na versao seguinte</div>
            <table class="tendencia-tabela" style="font-size:0.75rem">
              <thead><tr><th>Versao</th><th>Carga</th><th>SAs</th><th>NEs (N+1)</th></tr></thead>
              <tbody>
                ${topNE.map(p => `<tr><td>${p.versao}</td><td>${p.cargaPonderada}</td><td>${p.totalSA}</td><td>${p.nesVersaoSeguinte}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    els.correlacaoContainer.insertAdjacentHTML('beforeend', painelHtml);
  }

  function renderizarTabelaLiberacoes(dados) {
    const thead = els.tabelaLiberacoes.querySelector('thead');
    const tbody = els.tabelaLiberacoes.querySelector('tbody');

    thead.innerHTML = `
      <tr>
        <th></th>
        <th>Versao</th>
        <th>Total SA</th>
        <th>SAM</th>
        <th>SAL</th>
        <th>SAIL</th>
        <th>Carga</th>
        <th>Horas Prev.</th>
        <th>NE (N+1)</th>
        <th>IIL</th>
      </tr>
    `;

    const outliers = new Set(dados.estatisticas ? dados.estatisticas.outliers : []);
    const corrMap = {};
    if (dados.correlacao && dados.correlacao.pontos) {
      dados.correlacao.pontos.forEach(p => { corrMap[p.versao] = p; });
    }

    tbody.innerHTML = dados.versoes.map((v, idx) => {
      const isOutlier = outliers.has(v.versao);
      const cx = v.complexidade || {};
      const corr = corrMap[v.versao];
      const nesNext = corr ? corr.nesVersaoSeguinte : '-';
      const iil = v.iil;

      const iilBadge = iil
        ? `<span class="saude-badge" style="font-size:0.65rem;padding:0.15rem 0.4rem;background:${
            iil.classificacao === 'critico' ? 'var(--vermelho)' : iil.classificacao === 'alto' ? 'var(--amarelo)' : iil.classificacao === 'moderado' ? 'var(--info)' : 'var(--verde)'
          };color:#fff;border-radius:4px">${round1(iil.total)}</span>`
        : '-';

      const bgStyle = isOutlier ? ' style="background:var(--amarelo-bg)"'
        : v.versao === dados.versaoAtual ? ' style="background:var(--info-bg)"' : '';

      // Detalhe expansivel: lista de SAIs com descricao
      const detalheId = `lib-detalhe-${idx}`;
      let detalheHtml = '';
      const itens = v.itens || [];
      const faixaLabels = { baixa: 'Baixa', media: 'Media', alta: 'Alta', muito_alta: 'Muito Alta' };
      const faixaCores = { baixa: 'var(--verde)', media: 'var(--info)', alta: 'var(--amarelo)', muito_alta: 'var(--vermelho)' };
      const tipoCores = { SAM: 'rgba(59,130,246,0.15)', SAL: 'rgba(34,197,94,0.15)', SAIL: 'rgba(234,179,8,0.15)' };

      if (itens.length > 0) {
        // Cabecalho do detalhe
        detalheHtml += `
          <tr class="hist-detalhe hist-detalhe--${detalheId}" style="display:none">
            <td></td>
            <td colspan="9" style="padding:0.5rem 0.75rem">
              <div style="font-size:0.72rem;color:var(--cor-texto-sec);margin-bottom:0.25rem;font-weight:600">
                ${itens.length} SAIs implementadas | Horas prev: ${cx.horasPrevistoTotal || 0}h | Desvio: ${(cx.desvioEstimativa || 0) > 0 ? '+' : ''}${cx.desvioEstimativa || 0}% | SSC medio: ${cx.mediaSSC || 0}
              </div>
            </td>
          </tr>`;

        // Lista de SAIs
        itens.forEach(item => {
          const fxLabel = faixaLabels[item.faixa] || item.faixa;
          const fxCor = faixaCores[item.faixa] || 'var(--cor-texto-sec)';
          const horasP = item.tempoPrev > 0 ? round1(item.tempoPrev / 60) + 'h' : '-';
          const origemTag = item.origem === 'arquivo'
            ? '<span style="font-size:0.6rem;background:var(--amarelo);color:#fff;padding:0.1rem 0.3rem;border-radius:3px;margin-left:0.3rem" title="Liberada via arquivo de versao">ARQ</span>'
            : '';

          detalheHtml += `
            <tr class="hist-detalhe hist-detalhe--${detalheId}" style="display:none;background:${tipoCores[item.tipo] || 'transparent'}">
              <td></td>
              <td style="padding-left:1rem;font-size:0.73rem">
                <span style="font-weight:600;color:var(--cor-texto)">${item.tipo}</span>
                <span style="color:var(--cor-texto-sec);margin-left:0.3rem">${item.psai}</span>
                ${origemTag}
              </td>
              <td colspan="4" style="font-size:0.72rem;color:var(--cor-texto);max-width:350px;word-break:break-word">${item.descricao || '-'}</td>
              <td style="font-size:0.7rem;text-align:center"><span style="color:${fxCor};font-weight:600">${fxLabel}</span> (${horasP})</td>
              <td style="font-size:0.7rem;text-align:center">${item.ssc > 0 ? item.ssc + ' SSC' : '-'}</td>
              <td colspan="2" style="font-size:0.7rem;color:var(--cor-texto-sec)">${item.nivel}</td>
            </tr>`;
        });
      } else if (cx.porFaixa) {
        // Fallback se nao tem itens (cache antigo)
        detalheHtml += Object.entries(cx.porFaixa).filter(([, q]) => q > 0).map(([f, q]) => `
          <tr class="hist-detalhe hist-detalhe--${detalheId}" style="display:none">
            <td></td>
            <td style="padding-left:1.5rem;font-size:0.75rem;color:var(--cor-texto-sec)">${faixaLabels[f] || f}</td>
            <td style="font-size:0.75rem">${q} SAs</td>
            <td colspan="7" style="font-size:0.72rem;color:var(--cor-texto-sec)">
              Horas prev: ${cx.horasPrevistoTotal}h | Desvio: ${cx.desvioEstimativa > 0 ? '+' : ''}${cx.desvioEstimativa}% | SSC medio: ${cx.mediaSSC}
            </td>
          </tr>
        `).join('');
      }

      return `
        <tr${bgStyle} class="hist-row" data-detalhe="${detalheId}">
          <td style="width:1.5rem;cursor:pointer;text-align:center" class="hist-toggle" data-target="${detalheId}">
            <span class="hist-toggle__seta">&#9654;</span>
          </td>
          <td>
            <strong>${v.versao}</strong>
            ${isOutlier ? ' <span title="Outlier" style="color:var(--amarelo)">&#9888;</span>' : ''}
            ${v.versao === dados.versaoAtual ? ' <span title="Atual" style="color:var(--info)">&#9679;</span>' : ''}
          </td>
          <td><strong>${v.totalLiberacoes}</strong></td>
          <td>${v.porTipo.SAM}</td>
          <td>${v.porTipo.SAL}</td>
          <td>${v.porTipo.SAIL}</td>
          <td>${cx.cargaPonderada || 0}</td>
          <td>${cx.horasPrevistoTotal || 0}h</td>
          <td>${nesNext}</td>
          <td>${iilBadge}</td>
        </tr>
        ${detalheHtml}
      `;
    }).join('');

    // Bind toggles
    tbody.querySelectorAll('.hist-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        const seta = btn.querySelector('.hist-toggle__seta');
        const linhas = tbody.querySelectorAll(`.hist-detalhe--${target}`);
        const aberto = linhas[0] && linhas[0].style.display !== 'none';
        linhas.forEach(l => { l.style.display = aberto ? 'none' : 'table-row'; });
        seta.style.transform = aberto ? '' : 'rotate(90deg)';
      });
    });
  }

  function renderizarGraficosLiberacoes(dados) {
    destruirChart('chartSAVersao');
    destruirChart('chartSAEvolucao');
    destruirChart('chartSANivel');
    destruirChart('chartSACorrelacao');

    const versoes = dados.versoes;
    const labels = versoes.map(v => v.versao);
    const outliers = new Set(dados.estatisticas ? dados.estatisticas.outliers : []);

    // 1. Barras empilhadas: SAM/SAL/SAIL por versao
    const ctx1 = document.getElementById('chart-sa-versao').getContext('2d');
    estado.charts.chartSAVersao = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'SAM', data: versoes.map(v => v.porTipo.SAM), backgroundColor: 'rgba(59,130,246,0.7)', borderRadius: 2 },
          { label: 'SAL', data: versoes.map(v => v.porTipo.SAL), backgroundColor: 'rgba(34,197,94,0.7)', borderRadius: 2 },
          { label: 'SAIL', data: versoes.map(v => v.porTipo.SAIL), backgroundColor: 'rgba(234,179,8,0.7)', borderRadius: 2 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 10 } } },
          tooltip: { callbacks: { afterBody: (items) => `Total: ${versoes[items[0].dataIndex].totalLiberacoes}` } }
        },
        scales: {
          x: { stacked: true, ticks: { font: { size: 9 }, maxRotation: 90 } },
          y: { stacked: true, beginAtZero: true }
        }
      }
    });

    // 2. Linha dupla: Carga Ponderada + Total SAs (dual axis)
    const ctx2 = document.getElementById('chart-sa-evolucao').getContext('2d');
    const medianaCarga = dados.estatisticas ? dados.estatisticas.carga.mediana : 0;
    estado.charts.chartSAEvolucao = new Chart(ctx2, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Carga Ponderada',
            data: versoes.map(v => v.complexidade ? v.complexidade.cargaPonderada : 0),
            borderColor: 'rgba(168,85,247,0.8)',
            backgroundColor: 'rgba(168,85,247,0.1)',
            fill: true, tension: 0.3, pointRadius: 3,
            yAxisID: 'y'
          },
          {
            label: 'Total SAs',
            data: versoes.map(v => v.totalLiberacoes),
            borderColor: 'rgba(59,130,246,0.6)',
            borderDash: [4, 3], tension: 0.3, pointRadius: 2,
            yAxisID: 'y1'
          },
          {
            label: `Med. Carga (${medianaCarga})`,
            data: versoes.map(() => medianaCarga),
            borderColor: 'rgba(239,68,68,0.5)',
            borderDash: [6, 4], pointRadius: 0, fill: false,
            yAxisID: 'y'
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 10 } } } },
        scales: {
          x: { ticks: { font: { size: 9 }, maxRotation: 90 } },
          y: { beginAtZero: true, title: { display: true, text: 'Carga Ponderada', font: { size: 10 } } },
          y1: { position: 'right', beginAtZero: true, title: { display: true, text: 'Qtde SAs', font: { size: 10 } }, grid: { drawOnChartArea: false } }
        }
      }
    });

    // 3. Donut: distribuicao por faixa de complexidade (agregado)
    const faixasAgreg = { baixa: 0, media: 0, alta: 0, muito_alta: 0 };
    versoes.forEach(v => {
      if (v.complexidade && v.complexidade.porFaixa) {
        Object.entries(v.complexidade.porFaixa).forEach(([f, q]) => {
          faixasAgreg[f] = (faixasAgreg[f] || 0) + q;
        });
      }
    });
    const fxLabels = ['Baixa (ate 2h)', 'Media (2h-8h)', 'Alta (8h-40h)', 'Muito Alta (40h+)'];
    const fxValues = [faixasAgreg.baixa, faixasAgreg.media, faixasAgreg.alta, faixasAgreg.muito_alta];
    const fxCores = ['rgba(34,197,94,0.7)', 'rgba(59,130,246,0.7)', 'rgba(234,179,8,0.7)', 'rgba(239,68,68,0.7)'];

    const ctx3 = document.getElementById('chart-sa-nivel').getContext('2d');
    estado.charts.chartSANivel = new Chart(ctx3, {
      type: 'doughnut',
      data: { labels: fxLabels, datasets: [{ data: fxValues, backgroundColor: fxCores, borderWidth: 2, borderColor: '#fff' }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 } } },
          tooltip: { callbacks: { label: (ctx) => {
            const total = fxValues.reduce((a, b) => a + b, 0);
            return `${ctx.label}: ${ctx.parsed} (${total > 0 ? round1((ctx.parsed / total) * 100) : 0}%)`;
          }}}
        }
      }
    });

    // 4. Scatter: Carga Ponderada (N) vs NEs (N+1) com linha de regressao
    const corr = dados.correlacao;
    if (corr && corr.pontos.length >= 3) {
      const xField = corr.melhorPreditor === 'horas' ? 'horasPrevistas'
        : corr.melhorPreditor === 'simples' ? 'totalSA' : 'cargaPonderada';
      const xLabel = corr.melhorPreditorLabel + ' (versao N)';

      const datasets = [{
        label: `${corr.melhorPreditorLabel} vs NE (N+1)`,
        data: corr.pontos.map(p => ({ x: p[xField], y: p.nesVersaoSeguinte })),
        backgroundColor: corr.pontos.map(p =>
          outliers.has(p.versao) ? 'rgba(234,179,8,0.8)' : 'rgba(59,130,246,0.7)'
        ),
        pointRadius: 6, pointHoverRadius: 8
      }];

      // Linha de regressao
      if (corr.regressao) {
        const reg = corr.regressao;
        const xVals = corr.pontos.map(p => p[xField]);
        const xMin = Math.min(...xVals) * 0.8;
        const xMax = Math.max(...xVals) * 1.2;
        datasets.push({
          label: `Regressao (R²=${reg.r2})`,
          data: [{ x: xMin, y: reg.slope * xMin + reg.intercept }, { x: xMax, y: reg.slope * xMax + reg.intercept }],
          type: 'line', borderColor: 'rgba(239,68,68,0.7)', borderWidth: 2, borderDash: [6, 3],
          pointRadius: 0, fill: false
        });
      }

      const ctx4 = document.getElementById('chart-sa-correlacao').getContext('2d');
      estado.charts.chartSACorrelacao = new Chart(ctx4, {
        type: 'scatter',
        data: { datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'top', labels: { font: { size: 10 } } },
            tooltip: { callbacks: { label: (ctx) => {
              if (ctx.datasetIndex === 0) {
                const p = corr.pontos[ctx.dataIndex];
                return `${p.versao}: ${p[xField]} -> ${p.nesVersaoSeguinte} NEs (${p.versaoSeguinte})`;
              }
              return `Regressao: y=${round1(ctx.parsed.y)}`;
            }}}
          },
          scales: {
            x: { title: { display: true, text: xLabel, font: { size: 10 } }, beginAtZero: true },
            y: { title: { display: true, text: 'NEs entrada (versao N+1)', font: { size: 10 } }, beginAtZero: true }
          }
        }
      });
    }
  }

  /* ============== VIEW: DESCARTES (REPROVADA/PRESCRITA) ============== */

  async function carregarISV(force) {
    mostrarLoading(true, 'Calculando ISV...');
    mostrarBanner(null);
    try {
      await AppISV.carregar(force);
      els.atualizadoLabel.textContent = `Atualizado: ${new Date().toLocaleString('pt-BR')}`;
      mostrarLoading(false);
      ativarView('isv-ne');
    } catch (err) { mostrarErro(`Erro ISV: ${err.message}`); }
  }

  async function carregarISVYoY(force) {
    mostrarLoading(true, 'Carregando ISV Year by Year...');
    mostrarBanner(null);
    try {
      await AppISVYoY.carregar(force);
      els.atualizadoLabel.textContent = `Atualizado: ${new Date().toLocaleString('pt-BR')}`;
      mostrarLoading(false);
      ativarView('isv-yoy');
    } catch (err) { mostrarErro(`Erro ISV YoY: ${err.message}`); }
  }

  async function carregarDescartes(force) {
    mostrarLoading(true, 'Carregando analise de descartes (pode demorar na primeira vez)...');
    mostrarBanner(null);
    try {
      await AppDescartes.carregar(force);
      els.atualizadoLabel.textContent =
        `Atualizado: ${new Date().toLocaleString('pt-BR')}`;
      mostrarLoading(false);
      ativarView('descartes-ne');
    } catch (err) {
      mostrarErro(`Erro descartes: ${err.message}`);
    }
  }

  /* ============== VIEW: LIBERACOES SA V2 ============== */

  async function carregarLiberacoesV2(force) {
    mostrarLoading(true, 'Carregando Liberacoes SA V2...');
    mostrarBanner(null);
    try {
      await AppLiberacoesV2.carregar(force);
      els.atualizadoLabel.textContent =
        `Atualizado: ${new Date().toLocaleString('pt-BR')}`;
      mostrarLoading(false);
      ativarView('liberacoes-sa-v2');
    } catch (err) {
      mostrarErro(`Erro V2: ${err.message}`);
    }
  }

  /* ============== CHART UTILS ============== */

  function destruirChart(key) {
    if (estado.charts[key]) {
      estado.charts[key].destroy();
      delete estado.charts[key];
    }
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /* ============== INICIALIZACAO ============== */

  async function iniciar() {
    cachearElementos();

    // Detectar view pela URL
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view') || 'semanal-versao';

    // Event listeners
    els.btnOdbc.addEventListener('click', () => {
      if (estado.view === 'semanal-versao') { carregarSemanal(els.seletorVersao.value, true); }
      else if (estado.view === 'isv-ne') { carregarISV(true); }
      else if (estado.view === 'descartes-ne') { carregarDescartes(true); }
      else if (estado.view === 'liberacoes-sa') { carregarLiberacoes(true); }
      else if (estado.view === 'liberacoes-sa-v2') { carregarLiberacoesV2(true); }
      else { carregarHistorico(true); }
    });

    els.btnCache.addEventListener('click', () => {
      if (estado.view === 'semanal-versao') { carregarSemanal(els.seletorVersao.value, false); }
      else if (estado.view === 'isv-ne') { carregarISV(false); }
      else if (estado.view === 'descartes-ne') { carregarDescartes(false); }
      else if (estado.view === 'liberacoes-sa') { carregarLiberacoes(false); }
      else if (estado.view === 'liberacoes-sa-v2') { carregarLiberacoesV2(false); }
      else { carregarHistorico(false); }
    });

    els.btnRetry.addEventListener('click', () => {
      if (estado.view === 'semanal-versao') { carregarSemanal(els.seletorVersao.value || estado.versaoAtual, false); }
      else if (estado.view === 'isv-ne') { carregarISV(false); }
      else if (estado.view === 'descartes-ne') { carregarDescartes(false); }
      else if (estado.view === 'liberacoes-sa') { carregarLiberacoes(false); }
      else if (estado.view === 'liberacoes-sa-v2') { carregarLiberacoesV2(false); }
      else { carregarHistorico(false); }
    });

    els.seletorVersao.addEventListener('change', e => {
      carregarSemanal(e.target.value, false);
    });

    // Carregar versoes
    mostrarLoading(true, 'Carregando versoes...');
    await carregarVersoes();

    // Carregar view apropriada
    if (viewParam === 'semanal-historica') {
      ativarView('semanal-historica');
      await carregarHistorico(false);
    } else if (viewParam === 'isv-ne') {
      ativarView('isv-ne');
      await carregarISV(false);
    } else if (viewParam === 'isv-yoy') {
      ativarView('isv-yoy');
      await carregarISVYoY(false);
    } else if (viewParam === 'descartes-ne') {
      ativarView('descartes-ne');
      await carregarDescartes(false);
    } else if (viewParam === 'liberacoes-sa-v2') {
      ativarView('liberacoes-sa-v2');
      await carregarLiberacoesV2(false);
    } else if (viewParam === 'liberacoes-sa') {
      ativarView('liberacoes-sa');
      await carregarLiberacoes(false);
    } else {
      ativarView('semanal-versao');
      if (estado.versaoAtual) {
        await carregarSemanal(estado.versaoAtual, false);
      } else {
        mostrarLoading(false);
        ativarView('semanal-versao');
      }
    }
  }

  // Iniciar quando DOM pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  return { estado };
})();
