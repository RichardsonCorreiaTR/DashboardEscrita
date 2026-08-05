/**
 * acomp-sa-helpers.js - Agregacao compartilhada (SAL / SAM / SAIL)
 */
const qe = require('../../core/query-executor');
const { decodificarBinario } = require('../../core/consultas-ne');
const q = require('./acomp-sa-queries');

function agrupar(rows, campoTempo, campoQtd) {
  const por = {};
  rows.forEach(r => {
    const id = String(r.I_USUARIOS || r.i_usuarios);
    const mes = r.MES || r.mes;
    if (!por[id]) por[id] = {};
    por[id][mes] = {
      tempo: Number(r[campoTempo] || r[campoTempo.toLowerCase()]) || 0,
      qtd: Number(r[campoQtd] || r[campoQtd.toLowerCase()]) || 0
    };
  });
  return por;
}

function calcularAnualistas(ativas, descartadas) {
  return Object.entries(q.MAPA).map(([sgd, info]) => {
    const av = ativas[sgd] || {};
    const dc = descartadas[sgd] || {};
    let totalTempoAtivas = 0, totalQtdAtivas = 0, totalTempoDesc = 0, totalQtdDesc = 0;
    for (let m = 1; m <= 12; m++) {
      totalTempoAtivas += (av[m] && av[m].tempo) || 0;
      totalQtdAtivas += (av[m] && av[m].qtd) || 0;
      totalTempoDesc += (dc[m] && dc[m].tempo) || 0;
      totalQtdDesc += (dc[m] && dc[m].qtd) || 0;
    }
    return {
      sgd, slug: info.slug, apelido: info.apelido, senioridade: info.senioridade,
      mensal_ativas: av, mensal_descartadas: dc,
      total_psais: totalQtdAtivas, tempo_total_ativas: totalTempoAtivas,
      media_min: totalQtdAtivas > 0 ? Math.round(totalTempoAtivas / totalQtdAtivas) : 0,
      total_descartadas: totalQtdDesc, tempo_total_descartadas: totalTempoDesc
    };
  });
}

async function tempoDescarte(ano, tipoSql) {
  const anoBase = ano - 1;
  const [rAtivas, rDesc, rAtivasBase, rDescBase] = await Promise.all([
    qe.executar(q.queryTempoAtivas(ano, tipoSql)),
    qe.executar(q.queryTempoDescartadas(ano, tipoSql)),
    qe.executar(q.queryTempoAtivas(anoBase, tipoSql)),
    qe.executar(q.queryTempoDescartadas(anoBase, tipoSql))
  ]);
  return {
    ano, ano_base: anoBase,
    analistas: calcularAnualistas(agrupar(rAtivas, 'TEMPO_TOTAL', 'TOTAL_PSAIS'), agrupar(rDesc, 'TEMPO_DESC', 'TOTAL_DESCARTADAS')),
    baseline: calcularAnualistas(agrupar(rAtivasBase, 'TEMPO_TOTAL', 'TOTAL_PSAIS'), agrupar(rDescBase, 'TEMPO_DESC', 'TOTAL_DESCARTADAS'))
  };
}

function montarDetalhe(ano, rAtivas, rDesc, rNivel) {
  const porAnalista = {};
  q.analistas.forEach(a => {
    const sgd = String(a['codigo-sgd']);
    porAnalista[sgd] = {
      slug: a.slug, apelido: a.apelido, senioridade: a.senioridade,
      mensal: {}, mensal_desc: {}, mensal_nivel: {}
    };
  });
  rAtivas.forEach(r => {
    const id = String(r.I_USUARIOS || r.i_usuarios);
    const mes = r.MES || r.mes;
    if (!porAnalista[id]) return;
    const t = Number(r.TEMPO_TOTAL || r.tempo_total) || 0;
    const qq = Number(r.TOTAL_PSAIS || r.total_psais) || 0;
    porAnalista[id].mensal[mes] = { tempo: t, qtd: qq, media: qq > 0 ? Math.round(t / qq) : 0 };
  });
  rDesc.forEach(r => {
    const id = String(r.I_USUARIOS || r.i_usuarios);
    const mes = r.MES || r.mes;
    if (!porAnalista[id]) return;
    porAnalista[id].mensal_desc[mes] = {
      tempo: Number(r.TEMPO_DESC || r.tempo_desc) || 0,
      qtd: Number(r.TOTAL_DESCARTADAS || r.total_descartadas) || 0
    };
  });
  rNivel.forEach(r => {
    const id = String(r.I_USUARIOS || r.i_usuarios);
    const mes = r.MES || r.mes;
    const nivel = r.NIVEL || r.nivel || 1;
    if (!porAnalista[id]) return;
    if (!porAnalista[id].mensal_nivel[nivel]) porAnalista[id].mensal_nivel[nivel] = {};
    const t = Number(r.TEMPO_TOTAL || r.tempo_total) || 0;
    const qq = Number(r.TOTAL_PSAIS || r.total_psais) || 0;
    porAnalista[id].mensal_nivel[nivel][mes] = { tempo: t, qtd: qq, media: qq > 0 ? Math.round(t / qq) : 0 };
  });
  return { ano, analistas: Object.values(porAnalista).filter(a => a.apelido) };
}

async function detalhe(ano, tipoSql) {
  const [rAtivas, rDesc, rNivel] = await Promise.all([
    qe.executar(q.queryTempoAtivas(ano, tipoSql)),
    qe.executar(q.queryTempoDescartadas(ano, tipoSql)),
    qe.executar(q.queryDetalheNivel(ano, tipoSql))
  ]);
  return montarDetalhe(ano, rAtivas, rDesc, rNivel);
}

function mapearLinhas(rows) {
  const porPsai = new Map();
  rows.forEach(r => {
    const key = r.i_psai;
    const cur = porPsai.get(key);
    const tA = Number(r.tempo_analise) || 0;
    const tD = Number(r.tempo_definicao) || 0;
    if (cur) {
      cur.tempo_analise += tA;
      cur.tempo_definicao += tD;
      cur.tempo_total = cur.tempo_analise + cur.tempo_definicao;
      return;
    }
    const sgd = String(r.i_usuarios);
    const nivel = Number(r.nivel) || 1;
    porPsai.set(key, {
      i_usuarios: sgd, apelido: (q.MAPA[sgd] && q.MAPA[sgd].apelido) || sgd,
      i_psai: r.i_psai, i_sai: r.i_sai || 0, nivel,
      nivel_nome: q.NIVEL_NOME[nivel] || String(nivel), mes: Number(r.mes) || 0,
      tempo_analise: tA, tempo_definicao: tD, tempo_total: tA + tD,
      situacao: decodificarBinario(r.situacao_nome) || '(sem situação)'
    });
  });
  return [...porPsai.values()];
}

function montarFiltros() {
  return {
    analistas: Object.entries(q.MAPA).map(([sgd, i]) => ({
      sgd, apelido: i.apelido, slug: i.slug, senioridade: i.senioridade
    })).sort((a, b) => a.apelido.localeCompare(b.apelido, 'pt-BR')),
    niveis: Object.entries(q.NIVEL_NOME).map(([id, nome]) => ({ id: Number(id), nome }))
  };
}

async function tempoDetalhado(ano, analistaParam, nivelParam, tipoSql) {
  const idsSgd = analistaParam && q.MAPA[analistaParam]
    ? analistaParam
    : Object.keys(q.MAPA).join(', ');
  const rows = await qe.executar(q.queryLinhas(ano, idsSgd, nivelParam, tipoSql));
  return { ano, filtros: montarFiltros(), linhas: mapearLinhas(rows) };
}

module.exports = {
  TIPO_SAL: q.TIPO_SAL, TIPO_SAM: q.TIPO_SAM, MAPA: q.MAPA, montarFiltros,
  tempoDescarte, detalhe, tempoDetalhado
};
