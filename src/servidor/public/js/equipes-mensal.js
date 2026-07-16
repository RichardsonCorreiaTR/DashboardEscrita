/**
 * equipes-mensal.js - Tabelas mensais (Jan-Dez), totalizador e explicacoes
 *
 * Depende de format-utils.js e metas-config.js (LABELS, EXPLICACOES).
 */

/* eslint-disable no-unused-vars */
const EquipesMensal = (() => {
  const { LABELS, EXPLICACOES } = MetasConfig;
  const { MESES, fmtMin, fmtDecimal, corPct } = FormatUtils;
  const ANO_ATUAL = new Date().getFullYear();

  function diasUteis(mes, ano) {
    const a = ano || ANO_ATUAL;
    let count = 0;
    const total = new Date(a, mes, 0).getDate();
    for (let d = 1; d <= total; d++) {
      const dow = new Date(a, mes - 1, d).getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    return count;
  }

  function esperadoHoras(mes, ano) {
    return diasUteis(mes, ano) * 8 * 60; // em minutos
  }

  function renderTotalizador(tot, metas, valorMap) {
    if (!tot || !tot.por_meta) return '<div class="eq-sem-dados">Sem avaliacoes no ano</div>';
    const EXCLUIR_COUNT = new Set(['tempo-medio-sal', 'controle-descartes', 'tempo-trabalho-principal', 'pontos-gerados', 'pontos-atividade-principal', 'pct-descartes', 'psais-definidas']);
    const pm = tot.por_meta;
    const itens = Object.entries(pm).filter(([id]) => !EXCLUIR_COUNT.has(id));
    if (!itens.length) return '<div class="eq-sem-dados">Sem avaliacoes no ano</div>';
    let verde = 0, vermelho = 0;
    itens.forEach(([id, d]) => {
      const r = metas && metas[id] ? computeResumoMeta(id, metas[id].mensal, valorMap && valorMap[id]) : null;
      // Se computeResumoMeta nao tem dados, usa avaliacao do backend (atingidas/total)
      const isVerde = r ? r.cor === 'var(--verde)' : (d.nao_atingidas === 0);
      if (isVerde) verde++; else vermelho++;
    });
    const total = itens.length;
    const pct = Math.round(verde / total * 100);
    return `<div class="eq-tot">
      <div class="eq-tot-header">
        <h3 class="eq-tot__titulo">Totalizador Anual <span class="eq-tot-badge">Acumulado</span></h3>
        <div class="eq-dados-grid">
          <div class="eq-dado"><span class="eq-dado__valor" style="color:${corPct(pct)}">${pct}%</span><span class="eq-dado__label">Atingimento geral</span></div>
          <div class="eq-dado"><span class="eq-dado__valor" style="color:var(--verde)">${verde}</span><span class="eq-dado__label">Metas no verde</span></div>
          <div class="eq-dado"><span class="eq-dado__valor" style="color:var(--vermelho)">${vermelho}</span><span class="eq-dado__label">Metas no vermelho</span></div>
          <div class="eq-dado"><span class="eq-dado__valor">${total}</span><span class="eq-dado__label">Total metas</span></div>
        </div>
      </div>
      ${resumoMetas(tot.por_meta, metas, valorMap)}
    </div>`;
  }

  function computeResumoMeta(id, mensal, metaValor) {
    if (!mensal) return null;
    const mesAtual = new Date().getMonth() + 1;
    const mesAcum = mesAtual - 1; // apenas meses fechados
    if (mesAcum < 1) return null;
    const temDados = Array.from({ length: mesAcum }, (_, i) => mensal[i + 1]).some(d => d != null);
    if (!temDados) return null;
    const zero = { pontos: 0, trabalhoSai: 0, efetivo: 0, total_sais: 0, total_revisoes: 0, total_psais: 0, total_retornos: 0, media_realizado: 0, media: 0, qtd_sais: 0, qtd_psais: 0 };
    const dados = Array.from({ length: mesAcum }, (_, i) => mensal[i + 1] || zero);
    const corOk = 'var(--verde)', corNok = 'var(--vermelho)';
    if (id === 'pontos-definicao') {
      const media = Math.round(dados.reduce((s, d) => s + (d.pontos || 0), 0) / dados.length);
      return { texto: media + ' pts/m\u00eas', cor: media >= 80 ? corOk : corNok };
    }
    if (id.startsWith('tempo-trabalho')) {
      const tt = dados.reduce((s, d) => s + (d.trabalhoSai || 0), 0);
      const te = dados.reduce((s, d) => s + (d.efetivo || 0), 0);
      if (!te) return null;
      const pct = Math.round(tt / te * 100);
      const meta = metaValor || (id === 'tempo-trabalho-analise' ? 85 : id === 'tempo-trabalho-geracao' ? 80 : 70);
      return { texto: pct + '%', cor: pct >= meta ? corOk : corNok };
    }
    if (id.startsWith('indice-revisoes')) {
      const ts = dados.reduce((s, d) => s + (d.total_sais || 0), 0);
      const tr = dados.reduce((s, d) => s + (d.total_revisoes || 0), 0);
      if (!ts) return null;
      const idx = Math.round(tr / ts * 100) / 100;
      const meta = metaValor || (id === 'indice-revisoes-sam-imp' ? 0.80 : id === 'indice-revisoes-sail' ? 1.15 : 0.50);
      return { texto: fmtDecimal(idx), cor: idx <= meta ? corOk : corNok };
    }
    if (id.startsWith('indice-retornos')) {
      const tp = dados.reduce((s, d) => s + (d.total_psais || 0), 0);
      const tr = dados.reduce((s, d) => s + (d.total_retornos || 0), 0);
      if (!tp) return null;
      const idx = Math.round(tr / tp * 100) / 100;
      const meta = metaValor || (id === 'indice-retornos-sal' ? 1.00 : 1.50);
      return { texto: fmtDecimal(idx), cor: idx <= meta ? corOk : corNok };
    }
    if (id === 'tempo-medio-sal') {
      const c = dados.filter(d => d.qtd_sal > 0);
      if (!c.length) return null;
      const totalSal = c.reduce((s, d) => s + (d.qtd_sal || 0), 0);
      const somaS = c.reduce((s, d) => s + ((d.media_sal || 0) * (d.qtd_sal || 0)), 0);
      const avg = totalSal > 0 ? Math.round(somaS / totalSal) : 0;
      return { texto: avg + ' min', cor: avg <= 800 ? corOk : corNok };
    }
    if (id === 'pontos-atividade-principal') {
      const c = dados.filter(d => d.pct_atividade != null);
      if (!c.length) return { texto: '0/0', cor: 'var(--verde)' };
      const mediaPontos = Math.round(c.reduce((s, d) => s + (d.pontos || 0), 0) / dados.length);
      const mediaMeta = Math.round(c.reduce((s, d) => s + (d.meta_ajustada || 0), 0) / c.length);
      const ok = mediaPontos >= mediaMeta;
      return { texto: mediaPontos + '/' + mediaMeta, cor: ok ? 'var(--verde)' : 'var(--vermelho)' };
    }
    if (id === 'pontos-gerados' || id === 'psais-definidas') {
      const total = dados.reduce((s, d) => s + (d.pontos || 0), 0);
      const media = Math.round(total / dados.length);
      return { texto: media + ' pts/m\u00eas', cor: 'var(--verde)' };
    }
    if (id === 'pct-descartes') {
      const c = dados.filter(d => (d.qtd_sais || 0) + (d.qtd_analises || 0) + (d.qtd_descartes || 0) > 0);
      if (!c.length) return { texto: '0%', cor: 'var(--verde)' };
      const totalDesc = c.reduce((s, d) => s + (d.qtd_descartes || 0), 0);
      const totalSais = c.reduce((s, d) => s + (d.qtd_sais || 0), 0);
      const totalAnal = c.reduce((s, d) => s + (d.qtd_analises || 0), 0);
      const totalDenom = totalSais + totalAnal;
      const pct = totalDenom > 0 ? Math.round(totalDesc / totalDenom * 100) : 0;
      return { texto: pct + '%', cor: pct <= 30 ? corOk : corNok };
    }
    if (id === 'controle-descartes') {
      const c = dados.filter(d => d.qtd_psais > 0);
      if (!c.length) return null;
      const totalPsais = c.reduce((s, d) => s + (d.qtd_psais || 0), 0);
      const somaT = c.reduce((s, d) => s + ((d.media || 0) * (d.qtd_psais || 0)), 0);
      const avg = totalPsais > 0 ? Math.round(somaT / totalPsais) : 0;
      return { texto: avg + ' min', cor: avg <= 300 ? corOk : corNok };
    }
    return null;
  }

  const LABELS_CURTO = {
    'pontos-definicao': 'Defini\u00e7\u00e3o',
    'pontos-atividade-principal': 'Atividade Principal',
    'psais-definidas': 'PSAIs Definidas',
    'pontos-gerados': 'SAIs Geradas',
    'sais-definidas-esp': 'SAIs Definidas',
    'tempo-trabalho-analise': 'Tempo Afins',
    'indice-revisoes-sal': 'SAL', 'indice-revisoes-ne': 'NE',
    'indice-revisoes-sail': 'SAIL', 'indice-revisoes-sam-imp': 'SAM Imp',
    'indice-revisoes-sam-esc': 'SAM Esc',
    'indice-retornos-sal': 'SAL', 'indice-retornos-sail-sam': 'SAIL/SAM',
  };
  const IDS_TOT_PONTOS = ['pontos-definicao', 'pontos-atividade-principal', 'psais-definidas', 'pontos-gerados', 'sais-definidas-esp'];
  const IDS_TOT_TEMPOS = ['tempo-trabalho-analise', 'tempo-trabalho-principal', 'tempo-trabalho-geracao', 'tempo-gerando-sai'];
  const IDS_TOT_DESCARTES = ['controle-descartes', 'pct-descartes'];
  const IDS_TOT_DIVERSOS = ['tempo-medio-sal', 'respostas-ss-3d', 'gerar-sai-ne-sal-3d', 'gerar-sai-sal-5d', 'gerar-sai-sail-sam-7d'];
  const META_LABEL = {
    'indice-revisoes-sal': '\u2264 0,50', 'indice-revisoes-ne': '\u2264 0,50',
    'indice-revisoes-sail': '\u2264 1,15', 'indice-revisoes-sam-imp': '\u2264 0,80',
    'indice-revisoes-sam-esc': '\u2264 0,50',
    'indice-retornos-sal': '\u2264 1,00', 'indice-retornos-sail-sam': '\u2264 1,50',
  };

  const ZERO_DEC_IDS = new Set(['indice-revisoes-sal','indice-revisoes-ne','indice-revisoes-sail',
    'indice-revisoes-sam-imp','indice-revisoes-sam-esc','indice-retornos-sal','indice-retornos-sail-sam']);

  function renderCard(id, d, metas, valorMap, curto) {
    if (!d.total) {
      const label = curto ? (LABELS_CURTO[id] || LABELS[id] || id) : (LABELS[id] || id);
      const metaLabel = META_LABEL[id] || '';
      const zeroTxt = ZERO_DEC_IDS.has(id) ? '0,00' : '0';
      return '<div class="eq-tot-meta">' +
        '<span class="eq-tot-meta__label">' + label + (metaLabel ? ' <span style="font-weight:400;opacity:0.7">' + metaLabel + '</span>' : '') + '</span>' +
        '<span class="eq-tot-meta__valor" style="color:var(--verde)">' + zeroTxt + '</span>' +
        '</div>';
    }
    const p = Math.round((d.atingidas / d.total) * 100);
    const resumo = metas && metas[id] ? computeResumoMeta(id, metas[id].mensal, valorMap && valorMap[id]) : null;
    const texto = resumo ? resumo.texto : (d.atingidas + '/' + d.total);
    const cor = resumo ? resumo.cor : corPct(p);
    const label = curto ? (LABELS_CURTO[id] || LABELS[id] || id) : (LABELS[id] || id);
    const metaLabel = META_LABEL[id] || '';
    return '<div class="eq-tot-meta">' +
      '<span class="eq-tot-meta__label">' + label + (metaLabel ? ' <span style="font-weight:400;opacity:0.7">' + metaLabel + '</span>' : '') + '</span>' +
      '<span class="eq-tot-meta__valor" style="color:' + cor + '">' + texto + '</span>' +
      '</div>';
  }

  function pickTotIds(entries, ids) {
    return ids.map(id => entries.find(([k]) => k === id)).filter(Boolean);
  }

  function grupoCards(titulo, itens, metas, valorMap, curto) {
    return '<div class="eq-tot-grupo">' +
      '<span class="eq-tot-grupo__titulo">' + titulo + '</span>' +
      '<div class="eq-tot-grupo__cards">' +
      itens.map(([id, d]) => renderCard(id, d, metas, valorMap, curto !== false)).join('') +
      '</div></div>';
  }

  function grupoDiversos(itens, metas, valorMap) {
    const nePh = '<div class="eq-tot-meta" id="ne-def-tot-placeholder">' +
      '<span class="eq-tot-meta__label">NEs Def.</span>' +
      '<span class="eq-tot-meta__valor" style="color:var(--cor-texto-sec)">...</span></div>';
    return '<div class="eq-tot-grupo">' +
      '<span class="eq-tot-grupo__titulo">Diversos</span>' +
      '<div class="eq-tot-grupo__cards">' +
      itens.map(([id, d]) => renderCard(id, d, metas, valorMap, false)).join('') +
      nePh + '</div></div>';
  }

  function resumoMetas(pm, metas, valorMap) {
    if (!pm) return '';
    const todos = Object.entries(pm);
    if (!todos.length) return '';
    const used = new Set([...IDS_TOT_PONTOS, ...IDS_TOT_TEMPOS, ...IDS_TOT_DESCARTES, ...IDS_TOT_DIVERSOS,
      'indice-revisoes-sal', 'indice-revisoes-ne', 'indice-revisoes-sail', 'indice-revisoes-sam-imp', 'indice-revisoes-sam-esc',
      'indice-retornos-sal', 'indice-retornos-sail-sam']);
    const pontos = pickTotIds(todos, IDS_TOT_PONTOS);
    const revisoes = todos.filter(([id]) => id.startsWith('indice-revisoes'));
    const retornos = todos.filter(([id]) => id.startsWith('indice-retornos'));
    const tempos = pickTotIds(todos, IDS_TOT_TEMPOS);
    const descartes = pickTotIds(todos, IDS_TOT_DESCARTES);
    const diversos = pickTotIds(todos, IDS_TOT_DIVERSOS)
      .concat(todos.filter(([id]) => !used.has(id)));
    const linha1 = [
      pontos.length ? grupoCards('Pontos', pontos, metas, valorMap, true) : '',
      revisoes.length ? grupoCards('Revis\u00f5es', revisoes, metas, valorMap, true) : '',
      retornos.length ? grupoCards('Retornos', retornos, metas, valorMap, true) : ''
    ].join('');
    const linha2 = [
      tempos.length ? grupoCards('Tempos', tempos, metas, valorMap, false) : '',
      descartes.length ? grupoCards('Descartes', descartes, metas, valorMap, false) : '',
      grupoDiversos(diversos, metas, valorMap)
    ].join('');
    return '<div class="eq-tot-linhas">' +
      '<div class="eq-tot-linha">' + linha1 + '</div>' +
      '<div class="eq-tot-linha eq-tot-linha--sec">' + linha2 + '</div></div>';
  }

  function renderExplicacao(metaId) {
    const exp = EXPLICACOES[metaId];
    if (!exp) return '';
    return '<div class="eq-explicacao"><strong>Calculo:</strong> ' + exp.formula +
      '<ul>' + exp.considerado.map(c => '<li>' + c + '</li>').join('') + '</ul></div>';
  }

  function totalizadorRetornos(metaId, mensal, metaValor) {
    const dados = [];
    const _ma = new Date().getMonth(); // meses fechados
    for (let m = 1; m <= _ma; m++) { if (mensal[m]) dados.push(mensal[m]); }
    if (!dados.length) return '';
    const totalPsais = dados.reduce((s, d) => s + (d.total_psais || 0), 0);
    const totalRet = dados.reduce((s, d) => s + (d.total_retornos || 0), 0);
    const indiceAcum = totalPsais > 0 ? Math.round((totalRet / totalPsais) * 100) / 100 : 0;
    const atingidos = dados.filter(d => d.atingida).length;
    const metaNum = metaValor || (metaId === 'indice-retornos-sal' ? 1.00 : 1.50);
    const ok = indiceAcum <= metaNum;
    const cor = ok ? 'var(--verde)' : 'var(--vermelho)';
    const corAt = atingidos === dados.length ? 'var(--verde)' : atingidos > 0 ? 'var(--amarelo)' : 'var(--vermelho)';
    return '<div class="eq-tot-pontos">' +
      '<h4 class="eq-tot-pontos__titulo">\uD83D\uDCCA Acumulado do Ano</h4>' +
      '<div class="eq-dados-grid">' +
      '<div class="eq-dado"><span class="eq-dado__valor">' + dados.length + '</span><span class="eq-dado__label">Meses com dados</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor">' + totalPsais + '</span><span class="eq-dado__label">Total PSAIs</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor">' + totalRet + '</span><span class="eq-dado__label">Total Retornos</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + cor + '">' + fmtDecimal(indiceAcum) + '</span><span class="eq-dado__label">\u00cdndice acumulado</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + corAt + '">' + atingidos + '/' + dados.length + '</span><span class="eq-dado__label">Meses atingidos</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + cor + ';font-size:1.4rem">' + (ok ? '\u2713' : '\u2717') + '</span><span class="eq-dado__label">Meta acumulada (\u2264 ' + fmtDecimal(metaNum) + ')</span></div>' +
      '</div></div>';
  }

  function totalizadorIndice(metaId, mensal, metaValor) {
    const dados = [];
    const _ma = new Date().getMonth();
    for (let m = 1; m <= _ma; m++) { if (mensal[m]) dados.push(mensal[m]); }
    if (!dados.length) return '';
    const totalSais = dados.reduce((s, d) => s + (d.total_sais || 0), 0);
    const totalRev = dados.reduce((s, d) => s + (d.total_revisoes || 0), 0);
    const indiceAcum = totalSais > 0 ? Math.round((totalRev / totalSais) * 100) / 100 : 0;
    const atingidos = dados.filter(d => d.atingida).length;
    const metaNum = metaValor || (metaId === 'indice-revisoes-sam-imp' ? 0.80 : 0.50);
    const ok = indiceAcum <= metaNum;
    const cor = ok ? 'var(--verde)' : 'var(--vermelho)';
    const corAt = atingidos === dados.length ? 'var(--verde)' : atingidos > 0 ? 'var(--amarelo)' : 'var(--vermelho)';
    const metaStr = fmtDecimal(metaNum);
    return '<div class="eq-tot-pontos">' +
      '<h4 class="eq-tot-pontos__titulo">\uD83D\uDCCA Acumulado do Ano</h4>' +
      '<div class="eq-dados-grid">' +
      '<div class="eq-dado"><span class="eq-dado__valor">' + dados.length + '</span><span class="eq-dado__label">Meses com dados</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor">' + totalSais + '</span><span class="eq-dado__label">Total SAIs</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor">' + totalRev + '</span><span class="eq-dado__label">Total Revis\u00f5es</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + cor + '">' + fmtDecimal(indiceAcum) + '</span><span class="eq-dado__label">\u00cdndice acumulado</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + corAt + '">' + atingidos + '/' + dados.length + '</span><span class="eq-dado__label">Meses atingidos</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + cor + ';font-size:1.4rem">' + (ok ? '\u2713' : '\u2717') + '</span><span class="eq-dado__label">Meta acumulada (\u2264 ' + metaStr + ')</span></div>' +
      '</div></div>';
  }

  function totalizadorPctDescartes(mensal) {
    const dados = [];
    const _ma = new Date().getMonth();
    for (let m = 1; m <= _ma; m++) { if (mensal[m]) dados.push(mensal[m]); }
    if (!dados.length) return '';
    const totalDesc = dados.reduce((s, d) => s + (d.qtd_descartes || 0), 0);
    const totalSais = dados.reduce((s, d) => s + (d.qtd_sais || 0), 0);
    const totalAnal = dados.reduce((s, d) => s + (d.qtd_analises || 0), 0);
    const totalDenom = totalSais + totalAnal;
    const pct = totalDenom > 0 ? Math.round(totalDesc / totalDenom * 100) : 0;
    const atingidos = dados.filter(d => d.atingida).length;
    const ok = pct <= 30;
    const cor = ok ? 'var(--verde)' : 'var(--vermelho)';
    const corAt = atingidos === dados.length ? 'var(--verde)' : atingidos > 0 ? 'var(--amarelo)' : 'var(--vermelho)';
    return '<div class="eq-tot-pontos">' +
      '<h4 class="eq-tot-pontos__titulo">\uD83D\uDCCA Acumulado do Ano</h4>' +
      '<div class="eq-dados-grid">' +
      '<div class="eq-dado"><span class="eq-dado__valor">' + dados.length + '</span><span class="eq-dado__label">Meses com dados</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor">' + totalDesc + '</span><span class="eq-dado__label">Total descartes</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor">' + totalSais + '</span><span class="eq-dado__label">Total SAIs</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor">' + totalAnal + '</span><span class="eq-dado__label">Total an\u00e1lises</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + cor + '">' + pct + '%</span><span class="eq-dado__label">% Descarte acumulado</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + corAt + '">' + atingidos + '/' + dados.length + '</span><span class="eq-dado__label">Meses atingidos</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + cor + ';font-size:1.4rem">' + (ok ? '\u2713' : '\u2717') + '</span><span class="eq-dado__label">Meta acumulada (\u2264 30%)</span></div>' +
      '</div></div>';
  }

  function totalizadorDescartes(mensal) {
    const dados = [];
    const _ma = new Date().getMonth();
    for (let m = 1; m <= _ma; m++) { if (mensal[m]) dados.push(mensal[m]); }
    if (!dados.length) return '';
    const totalPsais = dados.reduce((s, d) => s + (d.qtd_psais || 0), 0);
    const somaTotal = dados.reduce((s, d) => s + ((d.media || 0) * (d.qtd_psais || 0)), 0);
    const mediaAcum = totalPsais > 0 ? Math.round(somaTotal / totalPsais) : 0;
    const atingidos = dados.filter(d => d.atingida).length;
    const ok = mediaAcum <= 300;
    const cor = ok ? 'var(--verde)' : 'var(--vermelho)';
    const corAt = atingidos === dados.length ? 'var(--verde)' : atingidos > 0 ? 'var(--amarelo)' : 'var(--vermelho)';
    return '<div class="eq-tot-pontos">' +
      '<h4 class="eq-tot-pontos__titulo">\uD83D\uDCCA Acumulado do Ano</h4>' +
      '<div class="eq-dados-grid">' +
      '<div class="eq-dado"><span class="eq-dado__valor">' + dados.length + '</span><span class="eq-dado__label">Meses com dados</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor">' + totalPsais + '</span><span class="eq-dado__label">Total PSAIs</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + cor + '">' + mediaAcum + ' min</span><span class="eq-dado__label">M\u00e9dia acumulada</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + corAt + '">' + atingidos + '/' + dados.length + '</span><span class="eq-dado__label">Meses atingidos</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + cor + ';font-size:1.4rem">' + (ok ? '\u2713' : '\u2717') + '</span><span class="eq-dado__label">Meta acumulada (\u2264 300min)</span></div>' +
      '</div></div>';
  }

  function totalizadorMedioSal(mensal) {
    const dados = [];
    const _ma = new Date().getMonth();
    for (let m = 1; m <= _ma; m++) { if (mensal[m]) dados.push(mensal[m]); }
    if (!dados.length) return '';
    const comSal = dados.filter(d => d.qtd_sal > 0);
    const totalSal = comSal.reduce((s, d) => s + (d.qtd_sal || 0), 0);
    const somaS = comSal.reduce((s, d) => s + ((d.media_sal || 0) * (d.qtd_sal || 0)), 0);
    const mediaSal = totalSal > 0 ? Math.round(somaS / totalSal) : null;
    const atingidos = dados.filter(d => d.atingida).length;
    const ok = mediaSal != null ? mediaSal <= 800 : true;
    const cor = ok ? 'var(--verde)' : 'var(--vermelho)';
    const corAt = atingidos === dados.length ? 'var(--verde)' : atingidos > 0 ? 'var(--amarelo)' : 'var(--vermelho)';
    const totalNe = dados.reduce((s, d) => s + (d.qtd_ne || 0), 0);
    const totalSail = dados.reduce((s, d) => s + (d.qtd_sail || 0), 0);
    const totalSam = dados.reduce((s, d) => s + (d.qtd_sam || 0), 0);
    return '<div class="eq-tot-pontos">' +
      '<h4 class="eq-tot-pontos__titulo">\uD83D\uDCCA Acumulado do Ano</h4>' +
      '<div class="eq-dados-grid">' +
      '<div class="eq-dado"><span class="eq-dado__valor">' + dados.length + '</span><span class="eq-dado__label">Meses com dados</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + cor + '">' + (mediaSal != null ? mediaSal + ' min' : '-') + '</span><span class="eq-dado__label">M\u00e9dia SAL (meta \u2264800)</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + corAt + '">' + atingidos + '/' + dados.length + '</span><span class="eq-dado__label">Meses atingidos</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor">' + totalSal + ' SAL / ' + totalNe + ' NE / ' + totalSail + ' SAIL / ' + totalSam + ' SAM</span><span class="eq-dado__label">Qtd analisadas no ano</span></div>' +
      '</div></div>';
  }

  function totalizadorAtivPrincipal(mensal) {
    const mesAtual = new Date().getMonth(); // meses fechados
    const dados = Array.from({ length: mesAtual }, (_, i) => mensal[i + 1]).filter(Boolean);
    if (!dados.length) return '';
    const totalPontos = dados.reduce((s, d) => s + (d.pontos || 0), 0);
    const totalMeta = dados.reduce((s, d) => s + (d.meta_ajustada || 0), 0);
    const mediaPontos = Math.round(totalPontos / mesAtual);
    const mediaMeta = Math.round(totalMeta / dados.length);
    const atingidos = dados.filter(d => d.atingida).length;
    const ok = mediaPontos >= mediaMeta;
    const cor = ok ? 'var(--verde)' : 'var(--vermelho)';
    const corAt = atingidos === dados.length ? 'var(--verde)' : atingidos > 0 ? 'var(--amarelo)' : 'var(--vermelho)';
    return '<div class="eq-tot-pontos">' +
      '<h4 class="eq-tot-pontos__titulo">\uD83D\uDCCA Acumulado do Ano</h4>' +
      '<div class="eq-dados-grid">' +
      '<div class="eq-dado"><span class="eq-dado__valor">' + mesAtual + '</span><span class="eq-dado__label">Meses avaliados</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + cor + '">' + mediaPontos + '</span><span class="eq-dado__label">M\u00e9dia pontos/m\u00eas</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + corAt + '">' + atingidos + '/' + dados.length + '</span><span class="eq-dado__label">Meses atingidos</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + cor + '">' + mediaPontos + '/' + mediaMeta + '</span><span class="eq-dado__label">M\u00e9dia pts / Meta ajustada</span></div>' +
      '</div></div>';
  }

  function totalizadorPontosGerados(mensal, metaId) {
    const isPsais = metaId === 'psais-definidas';
    const mesAtual = new Date().getMonth(); // meses fechados
    const temDados = Object.values(mensal).some(d => d && d.qtd_sais > 0);
    if (!temDados) return '<div class="eq-sem-dados" style="margin-top:0.5rem">' + (isPsais ? 'Nenhuma PSAI sem SAI gerada no ano' : 'Nenhuma SAI gerada por outros analistas no ano') + '</div>';
    const dados = Array.from({ length: mesAtual }, (_, i) => mensal[i + 1] || { pontos: 0, qtd_sais: 0 });
    const total = dados.reduce((s, d) => s + (d.pontos || 0), 0);
    const totalSais = dados.reduce((s, d) => s + (d.qtd_sais || 0), 0);
    const media = Math.round(total / dados.length);
    const mediaSais = Math.round(totalSais / dados.length);
    const cor = 'var(--cor-primaria)';
    const titulo = isPsais ? 'PSAIs Analisadas sem SAI' : 'SAIs Geradas';
    const labelQtd = isPsais ? 'Total de PSAIs' : 'Total de SAIs';
    const labelMedia = isPsais ? 'M\u00e9dia mensal (PSAIs)' : 'M\u00e9dia mensal (SAIs)';
    return '<div class="eq-tot-pontos">' +
      '<h4 class="eq-tot-pontos__titulo">\uD83D\uDCCA Acumulado do Ano \u2014 ' + titulo + '</h4>' +
      '<div class="eq-dados-grid">' +
      '<div class="eq-dado"><span class="eq-dado__valor">' + dados.length + '</span><span class="eq-dado__label">Meses avaliados</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + cor + '">' + total + '</span><span class="eq-dado__label">Total de pontos</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + cor + '">' + media + '</span><span class="eq-dado__label">M\u00e9dia mensal (pts)</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + cor + '">' + totalSais + '</span><span class="eq-dado__label">' + labelQtd + '</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + cor + '">' + mediaSais + '</span><span class="eq-dado__label">' + labelMedia + '</span></div>' +
      '</div></div>';
  }

  function totalizadorSaisDefinidas(mensal) {
    const mesAtual = new Date().getMonth(); // meses fechados
    const temDados = Object.values(mensal).some(d => d && d.qtd_sais > 0);
    if (!temDados) return '<div class="eq-sem-dados" style="margin-top:0.5rem">Nenhuma SAI definida no ano</div>';
    const dados = Array.from({ length: mesAtual }, (_, i) => mensal[i + 1] || { pontos: 0, qtd_sais: 0 });
    const totalSais = dados.reduce((s, d) => s + (d.qtd_sais || 0), 0);
    const mediaSais = Math.round(totalSais / (dados.length || 1));
    const cor = 'var(--cor-primaria)';
    return '<div class="eq-tot-pontos">' +
      '<h4 class="eq-tot-pontos__titulo">\uD83D\uDCCA Acumulado do Ano \u2014 SAIs Definidas</h4>' +
      '<div class="eq-dados-grid">' +
      '<div class="eq-dado"><span class="eq-dado__valor">' + dados.length + '</span><span class="eq-dado__label">Meses avaliados</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + cor + '">' + totalSais + '</span><span class="eq-dado__label">Total de SAIs</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + cor + '">' + mediaSais + '</span><span class="eq-dado__label">M\u00e9dia mensal</span></div>' +
      '</div></div>';
  }

  function totalizadorTempo(metaId, mensal, metaValor) {
    const dados = [];
    const _ma = new Date().getMonth();
    for (let m = 1; m <= _ma; m++) { if (mensal[m]) dados.push(mensal[m]); }
    if (!dados.length) return '';
    const totalTrab = dados.reduce((s, d) => s + (d.trabalhoSai || 0), 0);
    const totalGeral = dados.reduce((s, d) => s + (d.efetivo || 0), 0);
    const media = totalGeral > 0 ? Math.round((totalTrab / totalGeral) * 10000) / 100 : 0;
    const atingidos = dados.filter(d => d.atingida).length;
    const metaVal = metaId === 'tempo-trabalho-analise' ? 85 : metaId === 'tempo-trabalho-geracao' ? 80 : (metaValor || 70);
    const ok = media >= metaVal;
    const cor = ok ? 'var(--verde)' : 'var(--vermelho)';
    const corAt = atingidos === dados.length ? 'var(--verde)' : atingidos > 0 ? 'var(--amarelo)' : 'var(--vermelho)';
    return '<div class="eq-tot-pontos">' +
      '<h4 class="eq-tot-pontos__titulo">\uD83D\uDCCA Acumulado do Ano</h4>' +
      '<div class="eq-dados-grid">' +
      '<div class="eq-dado"><span class="eq-dado__valor">' + dados.length + '</span><span class="eq-dado__label">Meses com dados</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + cor + '">' + media + '%</span><span class="eq-dado__label">M\u00e9dia acumulada</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + corAt + '">' + atingidos + '/' + dados.length + '</span><span class="eq-dado__label">Meses atingidos</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + cor + ';font-size:1.4rem">' + (ok ? '\u2713' : '\u2717') + '</span><span class="eq-dado__label">Meta acumulada (\u2265 ' + metaVal + '%)</span></div>' +
      '</div></div>';
  }

  function totalizadorPontos(mensal) {
    const mesAtual = new Date().getMonth(); // meses fechados (0-based = meses anteriores)
    // Verifica se ha dados em algum mes (para nao exibir para analistas sem nenhum registro)
    const temDados = Object.values(mensal).some(d => d && (d.pontos > 0 || d.qtd_sais > 0));
    if (!temDados) return '';
    // Considera apenas meses fechados: meses sem SAIs contam como 0 (nao atingido)
    const dados = [];
    for (let m = 1; m <= mesAtual; m++) {
      dados.push(mensal[m] || { pontos: 0, qtd_sais: 0, atingida: false });
    }
    const total = dados.reduce((s, d) => s + (d.pontos || 0), 0);
    const media = Math.round(total / dados.length);
    const atingidos = dados.filter(d => d.atingida).length;
    const ok = media >= 80;
    const cor = ok ? 'var(--verde)' : 'var(--vermelho)';
    const corAt = atingidos === dados.length ? 'var(--verde)' : atingidos > 0 ? 'var(--amarelo)' : 'var(--vermelho)';
    return '<div class="eq-tot-pontos">' +
      '<h4 class="eq-tot-pontos__titulo">\uD83D\uDCCA Acumulado do Ano</h4>' +
      '<div class="eq-dados-grid">' +
      '<div class="eq-dado"><span class="eq-dado__valor">' + dados.length + '</span><span class="eq-dado__label">Meses com dados</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor">' + total + '</span><span class="eq-dado__label">Total de pontos</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + cor + '">' + media + '</span><span class="eq-dado__label">M\u00e9dia mensal</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + corAt + '">' + atingidos + '/' + dados.length + '</span><span class="eq-dado__label">Meses atingidos</span></div>' +
      '<div class="eq-dado"><span class="eq-dado__valor" style="color:' + cor + ';font-size:1.4rem">' + (ok ? '\u2713' : '\u2717') + '</span><span class="eq-dado__label">Meta acumulada (\u2265 80)</span></div>' +
      '</div></div>';
  }

  function renderTabela(metaId, metaData, metaValor) {
    if (!metaData || !metaData.mensal) return '<div class="eq-sem-dados">Dados indisponiveis</div>';
    const mensal = metaData.mensal;
    const cols = colunas(metaId, metaValor);
    const mesAtual = new Date().getMonth() + 1;
    let html = '<table class="eq-tabela"><thead><tr><th>Mes</th>';
    cols.forEach(c => { html += '<th>' + c.label + '</th>'; });
    html += (metaId === 'pontos-gerados' || metaId === 'psais-definidas' ? '' : '<th>Status</th>') + '<th></th></tr></thead><tbody>';
    for (let m = 1; m <= 12; m++) { html += linhaMes(m, mensal[m], cols, metaId, mesAtual); }
    html += '</tbody></table>';
    html += '<div class="eq-detalhe-container" data-detalhe-meta="' + metaId + '"></div>';
    if (metaId === 'pontos-definicao') html += totalizadorPontos(mensal);
    if (metaId === 'pontos-gerados') html += totalizadorPontosGerados(mensal, metaId);
    if (metaId === 'psais-definidas') html += totalizadorPontosGerados(mensal, metaId);
    if (metaId === 'sais-definidas-esp') html += totalizadorSaisDefinidas(mensal);
    if (metaId === 'pontos-atividade-principal') html += totalizadorAtivPrincipal(mensal);
    if (metaId.startsWith('tempo-trabalho')) html += totalizadorTempo(metaId, mensal, metaValor);
    if (metaId.startsWith('indice-revisoes')) html += totalizadorIndice(metaId, mensal, metaValor);
    if (metaId.startsWith('indice-retornos')) html += totalizadorRetornos(metaId, mensal, metaValor);
    if (metaId === 'controle-descartes') html += totalizadorDescartes(mensal);
    if (metaId === 'pct-descartes') html += totalizadorPctDescartes(mensal);
    if (metaId === 'tempo-medio-sal') html += totalizadorMedioSal(mensal);
    return html;
  }

  function linhaMes(m, d, cols, metaId, mesAtual) {
    const isGerados = metaId === 'pontos-gerados' || metaId === 'psais-definidas';
    const btnDetalhe = m <= mesAtual && (!isGerados || (d && d.qtd_sais > 0))
      ? '<button class="eq-btn-detalhe" data-meta="' + metaId + '" data-mes="' + m + '">Ver</button>'
      : '';
    if (!d) {
      if (isGerados && m <= mesAtual) {
        // Pontos gerados sem dados = 0, verde, sem Ver
        return '<tr class="eq-tr--ok"><td>' + MESES[m] + '</td><td style="color:var(--verde)">0</td><td>0</td>' +
          '<td class="eq-status">\u2713</td><td></td></tr>';
      }
      if (metaId === 'pontos-definicao' && m <= mesAtual) {
        // Mes passado sem SAIs = 0 pontos, nao atingido
        return '<tr class="eq-tr--nok"><td>' + MESES[m] + '</td>' +
          '<td>0</td><td>0</td><td>\u2265 80</td>' +
          '<td class="eq-status">\u2717</td><td>' + btnDetalhe + '</td></tr>';
      }
      const v = cols.map(c => c.isEsperado
        ? '<td style="color:#94a3b8">' + fmtMin(esperadoHoras(m)) + '</td>'
        : '<td>-</td>'
      ).join('');
      return '<tr class="eq-tr--vazio"><td>' + MESES[m] + '</td>' + v + '<td>-</td><td>' + btnDetalhe + '</td></tr>';
    }
    const cls = d.atingida ? 'eq-tr--ok' : 'eq-tr--nok';
    const ico = d.atingida ? '\u2713' : '\u2717';
    const cells = cols.map(c => {
      if (c.isEsperado) {
        const esp = esperadoHoras(m);
        return '<td style="color:#94a3b8">' + fmtMin(esp) + '</td>';
      }
      return '<td>' + c.render(d) + '</td>';
    }).join('');
    const statusCol = isGerados ? '' : '<td class="eq-status">' + ico + '</td>';
    return '<tr class="' + cls + '"><td>' + MESES[m] + '</td>' + cells + statusCol +
      '<td>' + btnDetalhe + '</td></tr>';
  }

  function colunas(id, metaValor) {
    if (id.startsWith('tempo-trabalho')) {
      const metaLabel = id === 'tempo-trabalho-analise' ? '\u2265 85%'
        : id === 'tempo-trabalho-principal' ? '\u2265 ' + (metaValor || 70) + '%'
        : '\u2265 80%';
      return [
        { label: '% Atividade', render: d => d.pct + '%' },
        { label: 'Tempo', render: d => fmtMin(d.trabalhoSai) },
        { label: 'Total', render: d => fmtMin(d.total) },
        { label: 'Esperado', isEsperado: true, render: () => '' },
        { label: 'Meta', render: () => metaLabel }
      ];
    }
    if (id.startsWith('indice-revisoes')) {
      const metaStr = metaValor ? fmtDecimal(metaValor) : (id === 'indice-revisoes-sam-imp' ? '0,80' : '0,50');
      return [
        { label: 'Indice', render: d => fmtDecimal(d.indice) },
        { label: 'SAIs', render: d => d.total_sais },
        { label: 'Revisoes (A/C)', render: d => d.total_revisoes },
        { label: 'Meta', render: () => '\u2264 ' + metaStr }
      ];
    }
    if (id === 'pontos-atividade-principal') return [
      { label: 'Pontos', render: d => d.pontos },
      { label: 'SAIs', render: d => d.qtd_sais },
      { label: '% Atividade', render: d => d.pct_atividade + '%' },
      { label: 'Meta Ajustada', render: d => '\u2265 ' + d.meta_ajustada }
    ];
    if (id === 'pontos-gerados' || id === 'sais-definidas-esp' || id === 'psais-definidas') return [
      { label: 'Pontos', render: d => d.pontos || 0 },
      { label: id === 'psais-definidas' ? 'PSAIs' : 'SAIs', render: d => d.qtd_sais || 0 }
    ];
    if (id === 'pontos-definicao') return [
      { label: 'Pontos', render: d => d.pontos },
      { label: 'SAIs', render: d => d.qtd_sais + (d.qtd_sem_pontos > 0 ? ' <span class="eq-alerta-pontos" title="' + d.qtd_sem_pontos + ' SAI(s) sem pontuacao no SGD">⚠</span>' : '') },
      { label: 'Meta', render: () => '\u2265 80' }
    ];
    if (id.startsWith('gerar-sai')) {
      const maxDias = id.includes('-7d') ? 7 : id.includes('-5d') ? 5 : 3;
      return [
        { label: 'Media (d.u.)', render: d => d.media_dias },
        { label: '% prazo', render: d => d.pct + '%' },
        { label: 'Dentro/Total', render: d => d.dentro_prazo + '/' + d.total },
        { label: 'Meta', render: () => 'Media \u2264 ' + maxDias + ' d.u.' }
      ];
    }
    if (id === 'respostas-ss-3d') return [
      { label: '% em 3d', render: d => d.pct + '%' },
      { label: 'Dentro/Total', render: d => d.dentro_3d + '/' + d.total },
      { label: 'Media dias', render: d => d.media_dias + 'd' },
      { label: 'Meta', render: () => '100%' }
    ];
    if (id === 'pct-descartes') return [
      { label: 'Descartes', render: d => d.qtd_descartes },
      { label: 'SAIs', render: d => d.qtd_sais || 0 },
      { label: 'An\u00e1lises', render: d => d.qtd_analises || 0 },
      { label: '% Descarte', render: d => d.pct + '%' },
      { label: 'Meta', render: () => '\u2264 30%' }
    ];
    if (id === 'controle-descartes') return [
      { label: 'PSAIs', render: d => d.qtd_psais },
      { label: 'M\u00e9dia (min)', render: d => d.media + ' min' },
      { label: 'M\u00e9dia (h)', render: d => fmtMin(d.media) },
      { label: 'Meta', render: () => '\u2264 300min' }
    ];
    if (id === 'tempo-medio-sal') return [
      { label: 'SAL (qtd)', render: d => d.qtd_sal || 0 },
      { label: 'SAL \u2264800min', render: d => d.media_sal != null ? d.media_sal + ' min' : '-', isMeta: true },
      { label: 'NE (qtd)', render: d => d.qtd_ne || 0 },
      { label: 'NE (min)', render: d => d.media_ne != null ? d.media_ne + ' min' : '-' },
      { label: 'SAIL (qtd)', render: d => d.qtd_sail || 0 },
      { label: 'SAIL (min)', render: d => d.media_sail != null ? d.media_sail + ' min' : '-' },
      { label: 'SAM (qtd)', render: d => d.qtd_sam || 0 },
      { label: 'SAM (min)', render: d => d.media_sam != null ? d.media_sam + ' min' : '-' }
    ];
    if (id.startsWith('indice-retornos')) {
      const metaVal = id === 'indice-retornos-sal' ? '1,00' : '1,50';
      return [
        { label: 'Indice', render: d => fmtDecimal(d.indice) },
        { label: 'PSAIs', render: d => d.total_psais },
        { label: 'Retornos', render: d => d.total_retornos },
        { label: 'Meta', render: () => '\u2264 ' + metaVal }
      ];
    }
    if (id === 'tempo-gerando-sai') return [
      { label: '% Atividade', render: d => d.pct + '%' },
      { label: 'Tempo', render: d => fmtMin(d.trabalhoSai) },
      { label: 'Total', render: d => fmtMin(d.total) },
      { label: 'Esperado', isEsperado: true, render: () => '' },
      { label: 'Meta', render: () => '\u2265 50%' }
    ];
    return [{ label: 'Valor', render: d => JSON.stringify(d) }];
  }

  return { renderTotalizador, renderExplicacao, renderTabela };
})();
