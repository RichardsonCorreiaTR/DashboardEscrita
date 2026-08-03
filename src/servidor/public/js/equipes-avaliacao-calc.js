/**
 * equipes-avaliacao-calc.js - Calculo da nota composta por colaborador
 */
/* eslint-disable no-unused-vars */
const EquipesAvaliacaoCalc = (() => {
  const META_PONTOS = 80;
  const META_TEMPO_GER = 80;
  const META_REV = {
    'indice-revisoes-sal': 0.50, 'indice-revisoes-ne': 0.50,
    'indice-revisoes-sail': 1.15, 'indice-revisoes-sam-imp': 0.80,
    'indice-revisoes-sam-esc': 0.50
  };
  const META_RET = { 'indice-retornos-sal': 1.00, 'indice-retornos-sail-sam': 1.50 };
  const REV_IDS = Object.keys(META_REV);
  const RET_IDS = Object.keys(META_RET);
  const PERIODOS = {
    s1: { label: '1\u00ba semestre', mesIni: 1, mesFim: 6 },
    s2: { label: '2\u00ba semestre', mesIni: 7, mesFim: 12 },
    anual: { label: 'Anual', mesIni: 1, mesFim: 12 }
  };

  function mesLimiteAno(ano) {
    const now = new Date();
    if (ano < now.getFullYear()) return 12;
    if (ano > now.getFullYear()) return 0;
    return Math.max(0, now.getMonth());
  }

  function mesesPeriodo(periodo, ano) {
    const cfg = PERIODOS[periodo] || PERIODOS.anual;
    const limite = mesLimiteAno(ano);
    const meses = [];
    for (let m = cfg.mesIni; m <= cfg.mesFim && m <= limite; m++) meses.push(m);
    return meses;
  }

  function labelPeriodo(periodo) { return (PERIODOS[periodo] || PERIODOS.anual).label; }

  function pts(mensal, mes) {
    const d = mensal && mensal[mes];
    if (!d) return null;
    return Number(d.pontos) || 0;
  }

  function linhaTemDados(d) {
    if (!d) return false;
    if ((Number(d.qtd_sais) || 0) > 0) return true;
    if ((Number(d.pontos) || 0) > 0) return true;
    return false;
  }

  function mesTemPontos(m, metas, esp) {
    if (esp) {
      return pilarGeradas(m, metas) != null || pilarTempoGeracao(m, metas) != null
        || pilarIndice(m, metas, REV_IDS, META_REV, 'total_revisoes', 'total_sais') != null;
    }
    const def = metas['pontos-definicao'] && metas['pontos-definicao'].mensal && metas['pontos-definicao'].mensal[m];
    const atv = metas['pontos-atividade-principal'] && metas['pontos-atividade-principal'].mensal && metas['pontos-atividade-principal'].mensal[m];
    return linhaTemDados(def) || linhaTemDados(atv);
  }

  function scoreRatio(valor, meta, menorMelhor) {
    if (!meta || meta <= 0) return 100;
    if (menorMelhor) {
      if (!valor || valor <= 0) return 100;
      return Math.min(100, Math.round((meta / valor) * 100));
    }
    return Math.min(100, Math.round((valor / meta) * 100));
  }

  function pilarGeradas(m, metas) {
    const ger = (metas['pontos-gerados'] && metas['pontos-gerados'].mensal) || {};
    if (!linhaTemDados(ger[m])) return null;
    return scoreRatio(pts(ger, m) || 0, META_PONTOS, false);
  }

  function pilarTempoGeracao(m, metas) {
    const tg = metas['tempo-trabalho-geracao'] && metas['tempo-trabalho-geracao'].mensal && metas['tempo-trabalho-geracao'].mensal[m];
    if (!tg || !(Number(tg.efetivo) > 0)) return null;
    return scoreRatio(Number(tg.pct) || 0, META_TEMPO_GER, false);
  }

  function pilarPontos(m, metas, esp) {
    if (esp) return { score: pilarGeradas(m, metas), via: 'SAIs geradas' };
    const psais = (metas['psais-definidas'] && metas['psais-definidas'].mensal) || {};
    const def = (metas['pontos-definicao'] && metas['pontos-definicao'].mensal) || {};
    const atv = (metas['pontos-atividade-principal'] && metas['pontos-atividade-principal'].mensal) || {};
    const s1 = scoreRatio((pts(def, m) || 0) + (pts(psais, m) || 0), META_PONTOS, false);
    const dAtv = atv[m];
    const s2 = scoreRatio((pts(atv, m) || 0) + (pts(psais, m) || 0), (dAtv && Number(dAtv.meta_ajustada)) || META_PONTOS, false);
    if (s2 > s1) return { score: s2, via: 'Atividade + PSAIs' };
    return { score: s1, via: 'Definicao + PSAIs' };
  }

  function pilarIndice(m, metas, ids, metasVal, nField, dField) {
    const scores = [];
    ids.forEach(id => {
      const d = metas[id] && metas[id].mensal && metas[id].mensal[m];
      if (!d || !(d[dField] || d[nField])) return;
      const den = Number(d[dField]) || 0;
      scores.push(scoreRatio(den > 0 ? (Number(d[nField]) || 0) / den : 0, metasVal[id], true));
    });
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  }

  function compPonderado(pesos) {
    const ativos = pesos.filter(x => x.v != null);
    const pt = ativos.reduce((s, x) => s + x.w, 0);
    return pt > 0 ? Math.round(ativos.reduce((s, x) => s + x.v * (x.w / pt), 0)) : null;
  }

  function mesComposto(m, metas, esp) {
    if (!mesTemPontos(m, metas, esp)) return { comp: null, pontos: null, tempoGeracao: null, revisoes: null, retornos: null, via: null };
    const rev = pilarIndice(m, metas, REV_IDS, META_REV, 'total_revisoes', 'total_sais');
    if (esp) {
      const g = pilarGeradas(m, metas), t = pilarTempoGeracao(m, metas);
      return { comp: compPonderado([{ v: g, w: 0.3333 }, { v: t, w: 0.3333 }, { v: rev, w: 0.3334 }]),
        pontos: g, tempoGeracao: t, revisoes: rev, retornos: null, via: 'SAIs geradas' };
    }
    const p = pilarPontos(m, metas, false);
    const ret = pilarIndice(m, metas, RET_IDS, META_RET, 'total_retornos', 'total_psais');
    return { comp: compPonderado([{ v: p.score, w: 0.5 }, { v: rev, w: 0.25 }, { v: ret, w: 0.25 }]),
      pontos: p.score, tempoGeracao: null, revisoes: rev, retornos: ret, via: p.via };
  }

  function media(arr) {
    return arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length) : null;
  }

  function calcTendencia(valid) {
    if (valid.length < 2) return 'estavel';
    const metade = Math.floor(valid.length / 2);
    const mUlt = media(valid.slice(metade).map(s => s.comp));
    const mAnt = media(valid.slice(0, metade).map(s => s.comp));
    if (mUlt != null && mAnt != null) {
      if (mUlt > mAnt + 3) return 'ascendente';
      if (mUlt < mAnt - 3) return 'descendente';
    }
    return 'estavel';
  }

  function pilaresMedios(valid, esp) {
    if (esp) {
      const pm = { geradas: [], tempo: [], rev: [] };
      valid.forEach(s => {
        if (s.pontos != null) pm.geradas.push(s.pontos);
        if (s.tempoGeracao != null) pm.tempo.push(s.tempoGeracao);
        if (s.revisoes != null) pm.rev.push(s.revisoes);
      });
      return [
        { label: 'SAIs geradas (33,33%)', val: media(pm.geradas) },
        { label: 'Tempo gera\u00e7\u00e3o (33,33%)', val: media(pm.tempo) },
        { label: 'Revis\u00f5es (33,34%)', val: media(pm.rev) }
      ].filter(p => p.val != null);
    }
    const pm = { pontos: [], rev: [], ret: [] };
    valid.forEach(s => {
      if (s.pontos != null) pm.pontos.push(s.pontos);
      if (s.revisoes != null) pm.rev.push(s.revisoes);
      if (s.retornos != null) pm.ret.push(s.retornos);
    });
    return [
      { label: 'Pontos (50%)', val: media(pm.pontos) },
      { label: 'Revis\u00f5es (25%)', val: media(pm.rev) },
      { label: 'Retornos (25%)', val: media(pm.ret) }
    ].filter(p => p.val != null);
  }

  function avaliarMembro(m, opts) {
    const periodo = (opts && opts.periodo) || 'anual';
    const ano = (opts && opts.ano) || new Date().getFullYear();
    const metas = m.metas || {};
    const esp = m.senioridade === 'especialista';
    const meses = mesesPeriodo(periodo, ano);
    const serie = meses.map(mes => ({ mes, ...mesComposto(mes, metas, esp) }));
    const valid = serie.filter(s => s.comp != null);
    const pilares = pilaresMedios(valid, esp);
    const ultimo = valid.length ? valid[valid.length - 1] : null;
    return {
      slug: m.slug, apelido: m.apelido, cargo: m.cargo || m.senioridade, esp,
      serie, compAtual: media(valid.map(s => s.comp)), tendencia: calcTendencia(valid),
      viaPontos: ultimo ? ultimo.via : '', periodo, ano,
      periodoLabel: labelPeriodo(periodo), mesesComDados: valid.length,
      destaque: pilares.length ? pilares.reduce((a, b) => (b.val > a.val ? b : a)) : null,
      atencao: pilares.length ? pilares.reduce((a, b) => (b.val < a.val ? b : a)) : null,
      pilares
    };
  }

  return { avaliarMembro, labelPeriodo, mesesPeriodo };
})();
