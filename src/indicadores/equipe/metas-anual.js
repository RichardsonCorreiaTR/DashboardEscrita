/**
 * metas-anual.js - Transformacao de dados anuais para metas da equipe
 *
 * Agrupa resultados de queries (com campo 'mes') por usuario+mes
 * e calcula atingimento mensal + totalizador.
 */

function agrupar(rows) {
  const m = {};
  rows.forEach(r => {
    if (!m[r.i_usuarios]) m[r.i_usuarios] = {};
    m[r.i_usuarios][r.mes] = r;
  });
  return m;
}

function agruparAtividades(rows) {
  const m = {};
  rows.forEach(r => {
    const uid = r.i_usuarios;
    const mes = r.mes;
    if (!m[uid]) m[uid] = {};
    if (!m[uid][mes]) m[uid][mes] = [];
    m[uid][mes].push({ atividade: String(r.atividade).trim(), minutos: r.minutos, registros: r.registros });
  });
  return m;
}

function isAusencia(nome) {
  const n = nome.toLowerCase();
  return n.includes('feriado') || n.includes('rias') || n.includes('folga') ||
    n.includes('particular') || n.includes('afastamento');
}

function isTrabalhoSai(nome) {
  const n = nome.toLowerCase();
  return n.includes('ne') || n.includes('sai') || n.includes('ss') || n.includes('vida') ||
    n.includes('sal') || n.includes('sam') || n.includes('validando') || n.includes('performance');
}

function mensalAtividades(mapMes, meta) {
  const mensal = {};
  for (let m = 1; m <= 12; m++) {
    const ativs = mapMes ? mapMes[m] : null;
    if (!ativs || ativs.length === 0) { mensal[m] = null; continue; }
    let total = 0, ausencia = 0, trabalhoSai = 0;
    ativs.forEach(a => {
      total += a.minutos;
      if (isAusencia(a.atividade)) ausencia += a.minutos;
      else if (isTrabalhoSai(a.atividade)) trabalhoSai += a.minutos;
    });
    const efetivo = total - ausencia;
    const pct = efetivo > 0 ? Math.round((trabalhoSai / efetivo) * 10000) / 100 : 0;
    mensal[m] = { pct, total, ausencia, trabalhoSai, efetivo, atingida: pct >= meta };
  }
  return mensal;
}

function mensalIndice(mapMes, meta) {
  const mensal = {};
  for (let m = 1; m <= 12; m++) {
    const row = mapMes ? mapMes[m] : null;
    if (!row || !row.total_sais) { mensal[m] = null; continue; }
    const indice = Math.round((row.total_revisoes / row.total_sais) * 100) / 100;
    mensal[m] = { indice, total_sais: row.total_sais, total_revisoes: row.total_revisoes, atingida: indice <= meta };
  }
  return mensal;
}

function mensalPontos(mapMes, meta) {
  const mensal = {};
  for (let m = 1; m <= 12; m++) {
    const row = mapMes ? mapMes[m] : null;
    if (!row) { mensal[m] = null; continue; }
    const pontos = Number(row.pontos) || 0;
    const qtd_sem_pontos = Number(row.qtd_sem_pontos) || 0;
    mensal[m] = { pontos, qtd_sais: row.qtd_sais || 0, qtd_sem_pontos, atingida: pontos >= meta };
  }
  return mensal;
}

function mensalTempo(mapMes) {
  const mensal = {};
  for (let m = 1; m <= 12; m++) {
    const row = mapMes ? mapMes[m] : null;
    if (!row || !row.total_ciclos) { mensal[m] = null; continue; }
    const pct = Math.round((row.dentro_prazo / row.total_ciclos) * 10000) / 100;
    const media = Math.round(Number(row.media_dias) * 100) / 100;
    mensal[m] = { pct, media_dias: media, total: row.total_ciclos, dentro_prazo: row.dentro_prazo, atingida: media <= 3 };
  }
  return mensal;
}

function mensalSS(mapMes) {
  const mensal = {};
  for (let m = 1; m <= 12; m++) {
    const row = mapMes ? mapMes[m] : null;
    if (!row || !row.total_respostas) { mensal[m] = null; continue; }
    const pct = Math.round((row.dentro_3d / row.total_respostas) * 10000) / 100;
    const media = Math.round(Number(row.media_dias) * 10) / 10;
    mensal[m] = { pct, total: row.total_respostas, dentro_3d: row.dentro_3d, media_dias: media, atingida: pct >= 100 };
  }
  return mensal;
}

function totalizador(metasObj) {
  let atingidas = 0, nao = 0;
  const porMeta = {};
  for (const [id, data] of Object.entries(metasObj)) {
    if (!data || !data.mensal) continue;
    let ma = 0, mn = 0;
    for (let m = 1; m <= 12; m++) {
      if (!data.mensal[m]) continue;
      if (data.mensal[m].atingida) { ma++; atingidas++; }
      else { mn++; nao++; }
    }
    porMeta[id] = { atingidas: ma, nao_atingidas: mn, total: ma + mn };
  }
  return { atingidas, nao_atingidas: nao, total: atingidas + nao, por_meta: porMeta };
}

function calcularMetas(analista, dados, metaIds) {
  const sgd = analista['codigo-sgd'], uid = analista['i-usuarios'];
  const isEsp = analista.senioridade === 'especialista';
  const metaTempo = 80;
  const rev = isEsp ? dados.revCtrl.ger : dados.revCtrl.def;
  const todas = {
    'tempo-trabalho-analise': { mensal: mensalAtividades(dados.ativs[uid], metaTempo) },
    'tempo-trabalho-geracao': { mensal: mensalAtividades(dados.ativs[uid], metaTempo) },
    'indice-revisoes-sal':     { mensal: mensalIndice(rev.sal[sgd], 0.50) },
    'indice-revisoes-ne':      { mensal: mensalIndice(rev.ne[sgd], 0.50) },
    'indice-revisoes-sail':    { mensal: mensalIndice(rev.sail[sgd], 0.50) },
    'indice-revisoes-sam-imp': { mensal: mensalIndice(rev.samImp[sgd], 0.80) },
    'indice-revisoes-sam-esc': { mensal: mensalIndice(rev.samEsc[sgd], 0.50) },
    'pontos-definicao': { mensal: mensalPontos(dados.pontos[sgd], 80) },
    'gerar-sai-ne-sal-3d': { mensal: mensalTempo(dados.tempoGer[sgd]) },
    'respostas-ss-3d': { mensal: mensalSS(dados.ss[uid]) }
  };
  const metas = {};
  metaIds.forEach(id => { if (todas[id]) metas[id] = todas[id]; });
  return { metas, totalizador: totalizador(metas) };
}

function agruparControleRevisoes(rows) {
  const grupos = { sal: {}, ne: {}, sail: {}, samEsc: {}, samImp: {} };
  rows.forEach(r => {
    const tipo = (r.tipo || '').toUpperCase();
    const area = (r.nomeArea || '').toLowerCase();
    let chave;
    if (tipo === 'SAL') chave = 'sal';
    else if (tipo === 'NE') chave = 'ne';
    else if (tipo === 'SAIL') chave = 'sail';
    else if (tipo === 'SAM' && area === 'escrita') chave = 'samEsc';
    else if (tipo === 'SAM') chave = 'samImp';
    else return;
    const uid = r.i_usuarios;
    if (!grupos[chave][uid]) grupos[chave][uid] = {};
    const prev = grupos[chave][uid][r.mes];
    if (prev) {
      prev.total_sais += Number(r.total_sais) || 0;
      prev.total_revisoes += Number(r.total_revisoes) || 0;
    } else {
      grupos[chave][uid][r.mes] = { total_sais: Number(r.total_sais) || 0, total_revisoes: Number(r.total_revisoes) || 0 };
    }
  });
  return grupos;
}

module.exports = {
  agrupar, agruparAtividades, agruparControleRevisoes,
  mensalAtividades, mensalIndice, mensalPontos, mensalTempo, mensalSS,
  totalizador, calcularMetas
};
