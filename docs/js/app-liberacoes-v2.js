/**
 * app-liberacoes-v2.js - Frontend principal Liberacoes SA V2
 * Orquestra: resumo executivo, KPIs, impacto, recomendacoes + modulos externos
 */
/* eslint-disable no-unused-vars */
const AppLiberacoesV2 = (() => {
  const BASE = '/api/estudos/liberacoes-sa-v2';
  let dados = null;
  function r1(v) { return Math.round(v * 10) / 10; }
  function r0(v) { return Math.round(v); }

  async function carregar(force) {
    const url = `${BASE}${force ? '?force=1' : ''}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.erro || `HTTP ${resp.status}`);
    }
    dados = await resp.json();
    renderizar();
    return dados;
  }

  function renderizar() {
    if (!dados) return;
    renderResumoExecutivo();
    renderBloco1();
    if (typeof AppLiberacoesV2Graficos !== 'undefined') AppLiberacoesV2Graficos.renderizar(dados);
    renderBloco2();
    renderBloco3();
    if (typeof AppLiberacoesV2Prova !== 'undefined') AppLiberacoesV2Prova.renderizar(dados);
    if (typeof AppLiberacoesV2Diario !== 'undefined') AppLiberacoesV2Diario.renderizar(dados);
    if (typeof AppLiberacoesV2Tabela !== 'undefined') AppLiberacoesV2Tabela.renderizar(dados);
  }

  function efetivo(va, campo) {
    if (campo === 'totalLiberacoes') return va.totalProjetado != null ? va.totalProjetado : va.totalLiberacoes;
    if (campo === 'carga') return va.cargaProjetada != null ? va.cargaProjetada : va.carga.total;
    if (campo === 'pctAlta') return va.pctAltaComplexidadeProj != null ? va.pctAltaComplexidadeProj : va.pctAltaComplexidade;
    return va[campo];
  }
  function temPipeline(va) { return va.pipeline && va.pipeline.totalLiberacoes > 0; }

  function renderResumoExecutivo() {
    const el = document.getElementById('v2-resumo-executivo');
    if (!el) return;
    const va = dados.versoes.find(v => v.versao === dados.versaoAtual);
    const s = dados.estatisticas;
    const prev = dados.previsao;
    if (!va || !s) { el.innerHTML = ''; return; }

    const totalEf = efetivo(va, 'totalLiberacoes');
    const delta = totalEf - s.total.mediana;
    const deltaStr = delta > 0 ? `${delta} acima` : delta < 0 ? `${Math.abs(delta)} abaixo` : 'igual a';
    const tend = delta > 3 ? 'atencao' : delta < -3 ? 'favoravel' : 'estavel';
    let frase2 = '';
    if (prev && !prev.fallbackUsado) {
      const rl = { critico: 'alto', elevado: 'moderado', normal: 'normal', favoravel: 'baixo' };
      frase2 = ` A previsao de impacto e de <strong>${prev.prevPontual} NEs</strong> (risco <strong>${rl[prev.risco] || prev.risco}</strong>).`;
    }
    const pipeNota = temPipeline(va)
      ? ` <span style="font-size:0.85em;opacity:0.8">(${va.totalLiberacoes} liberadas + ${va.pipeline.totalLiberacoes} em pipeline)</span>` : '';
    const corB = { atencao: 'var(--amarelo)', favoravel: 'var(--verde)', estavel: 'var(--info)' };
    el.innerHTML = `<div class="resumo-executivo" style="border-left:4px solid ${corB[tend] || 'var(--info)'}">
      <div class="resumo-executivo__texto">Na versao <strong>${dados.versaoAtual}</strong>,
      <strong>${totalEf} SAs</strong> projetadas${pipeNota}
      (${deltaStr} da mediana historica de ${s.total.mediana}).${frase2}</div></div>`;
  }

  function renderBloco1() {
    const el = document.getElementById('v2-bloco1');
    if (!el) return;
    const s = dados.estatisticas;
    const va = dados.versoes.find(v => v.versao === dados.versaoAtual);
    if (!va || !s) { el.innerHTML = '<p>Sem dados para versao atual.</p>'; return; }

    const totalEf = efetivo(va, 'totalLiberacoes');
    const cargaEf = efetivo(va, 'carga');
    const pctAltaEf = efetivo(va, 'pctAlta');
    const porTipoEf = va.porTipoProjetado || va.porTipo;
    const temPipe = temPipeline(va);

    const medC = s.carga.mediana || 1;
    const ratC = r1(cargaEf / medC);
    const corC = ratC > 1.3 ? 'vermelho' : ratC > 1.1 ? 'amarelo' : ratC < 0.7 ? 'verde' : 'info';
    const pQ = r0(va.qualidade.completudeGeral * 100);
    const corQ = pQ >= 70 ? 'var(--verde)' : pQ >= 50 ? 'var(--amarelo)' : 'var(--vermelho)';
    const bar = buildMiniBar(porTipoEf.SAM, porTipoEf.SAL, porTipoEf.SAIL);
    const dv = va.temposProjetados ? va.temposProjetados.desvioEstimativa : va.tempos.desvioEstimativa;

    const labelTotal = temPipe ? 'SAs Projetadas' : 'SAs Liberadas';
    const subTotal = temPipe
      ? `${va.totalLiberacoes} lib. + ${va.pipeline.totalLiberacoes} pipeline`
      : `Mediana hist.: ${s.total.mediana}`;

    const pipeHtml = temPipe
      ? `<div class="estudo-kpi estudo-kpi--info"><div class="estudo-kpi__label">Pipeline</div>
          <div class="estudo-kpi__valor">${va.pipeline.totalLiberacoes}</div>
          <div class="estudo-kpi__sub">Alocadas, nao liberadas</div></div>` : '';

    el.innerHTML = `
      <div class="estudo-kpi estudo-kpi--destaque"><div class="estudo-kpi__label">${labelTotal}</div>
        <div class="estudo-kpi__valor">${totalEf}</div>
        <div class="estudo-kpi__sub">${subTotal} | ${dados.versaoAtual}</div></div>
      ${pipeHtml}
      <div class="estudo-kpi"><div class="estudo-kpi__label">Por Tipo${temPipe ? ' (proj.)' : ''}</div>
        <div class="estudo-kpi__valor" style="font-size:0.85rem;line-height:1.4">SAM: ${porTipoEf.SAM} &nbsp; SAL: ${porTipoEf.SAL} &nbsp; SAIL: ${porTipoEf.SAIL}</div>
        <div class="estudo-kpi__sub">${bar}</div></div>
      <div class="estudo-kpi estudo-kpi--${corC}"><div class="estudo-kpi__label">Carga${temPipe ? ' Projetada' : ' Ponderada'}</div>
        <div class="estudo-kpi__valor">${r1(cargaEf)}</div>
        <div class="estudo-kpi__sub">${ratC}x da mediana</div></div>
      <div class="estudo-kpi"><div class="estudo-kpi__label">Alta Complexidade</div>
        <div class="estudo-kpi__valor">${pctAltaEf}%</div>
        <div class="estudo-kpi__sub">Faixa Alta + Muito Alta</div></div>
      <div class="estudo-kpi"><div class="estudo-kpi__label">Desvio Estimativa</div>
        <div class="estudo-kpi__valor">${dv > 0 ? '+' : ''}${dv}%</div>
        <div class="estudo-kpi__sub">Realizado vs previsto</div></div>
      <div class="v2-qualidade" style="grid-column:1/-1;margin-top:0.5rem">
        <div style="display:flex;align-items:center;gap:0.75rem;font-size:0.78rem">
          <span style="font-weight:600">Qualidade dos dados:</span>
          <div style="flex:1;height:8px;background:var(--cor-borda);border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${pQ}%;background:${corQ};border-radius:4px"></div></div>
          <span style="font-weight:600">${pQ}%</span></div></div>`;
  }

  function buildMiniBar(sam, sal, sail) {
    const t = sam + sal + sail;
    if (t === 0) return '';
    const ps = r0(sam / t * 100), pl = r0(sal / t * 100), pi = 100 - ps - pl;
    return `<div style="display:flex;height:6px;border-radius:3px;overflow:hidden;margin-top:4px">
      <div style="width:${ps}%;background:#3b82f6" title="SAM ${ps}%"></div>
      <div style="width:${pl}%;background:#f59e0b" title="SAL ${pl}%"></div>
      <div style="width:${pi}%;background:#10b981" title="SAIL ${pi}%"></div></div>`;
  }

  function renderBloco2() {
    const el = document.getElementById('v2-bloco2');
    if (!el) return;
    const prev = dados.previsao;
    if (!prev || prev.fallbackUsado) {
      el.innerHTML = `<div class="impacto-card impacto-card--neutral">
        <div class="impacto-card__titulo">Impacto Estimado em NE</div>
        <div class="impacto-card__corpo">${prev ? prev.explicacao : 'Dados insuficientes'}.</div></div>`;
      return;
    }
    const rl = { critico: 'Risco alto', elevado: 'Risco moderado', normal: 'Risco normal', favoravel: 'Cenario favoravel' };
    const cr = { critico: 'var(--vermelho)', elevado: 'var(--amarelo)', favoravel: 'var(--verde)', normal: 'var(--info)' };
    const bt = prev.backtest;
    const m6 = bt && bt.mape6m != null ? bt.mape6m : null;
    const confLabel = m6 != null ? (m6 <= 15 ? 'Alta' : m6 <= 25 ? 'Moderada' : m6 <= 35 ? 'Baixa' : 'Muito baixa')
      : (bt && bt.mape != null ? (bt.mape <= 15 ? 'Alta' : bt.mape <= 25 ? 'Moderada' : 'Baixa') : '?');
    const nums = [
      { v: prev.prevPontual, l: 'NEs previstas', dest: true },
      { v: `${prev.intervalo.baixo} - ${prev.intervalo.alto}`, l: 'Intervalo provavel' },
      { v: prev.baselineNE, l: 'Mediana 4 versoes' },
      { v: confLabel, l: 'Confianca (6m)' },
      m6 != null ? { v: `${m6}%`, l: 'Erro recente' } : null
    ].filter(Boolean);
    const numsH = nums.map(n => `<div class="impacto-num${n.dest ? ' impacto-num--destaque' : ''}">
      <span class="impacto-num__valor">${n.v}</span><span class="impacto-num__label">${n.l}</span></div>`).join('');

    el.innerHTML = `<div class="impacto-card" style="border-left:4px solid ${cr[prev.risco] || 'var(--info)'}">
      <div class="impacto-card__header"><span class="impacto-card__titulo">Impacto Estimado em NE</span>
        <span class="impacto-badge" style="background:${cr[prev.risco] || 'var(--info)'}">${rl[prev.risco] || prev.risco}</span></div>
      <div class="impacto-numeros">${numsH}</div></div>`;
  }

  function renderBloco3() {
    const el = document.getElementById('v2-bloco3');
    if (!el) return;
    const recs = dados.recomendacoes || [];
    const alertas = dados.alertasModelo || [];
    const ct = { critico: 'var(--vermelho)', alerta: 'var(--amarelo)', atencao: 'var(--amarelo)', info: 'var(--info)' };
    const rH = recs.length > 0
      ? recs.map(r => `<div class="rec-item" style="border-left:3px solid ${ct[r.tipo] || 'var(--info)'}">
          <div class="rec-item__msg"><strong>${r.mensagem}</strong></div>
          <div class="rec-item__acao">Acao: ${r.acao}</div></div>`).join('')
      : '<div class="rec-vazio">Sem recomendacoes especiais para esta versao.</div>';
    const aH = alertas.length > 0 ? `<div class="rec-alertas">${alertas.join(' | ')}</div>` : '';
    el.innerHTML = `<div class="prova-card"><div class="prova-card__header">
      <span class="prova-card__titulo">O que fazer agora</span></div>
      <div class="prova-card__body">${aH}${rH}</div></div>`;
  }

  return { carregar, renderizar, getDados: () => dados };
})();
