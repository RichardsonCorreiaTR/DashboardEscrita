/**
 * metas-anual.js - Transformacao de dados anuais para metas da equipe
 *
 * Agrupa resultados de queries (com campo 'mes') por usuario+mes
 * e calcula atingimento mensal + totalizador.
 */

const {
  isAusencia, isGerandoSai, isTrabalhoSai, isOutrasAtividades,
  isPrincipalAnalista, isPrincipalEspecialista, isPrincipalQualquer
} = require('./atividades-classifier');
const tempoSal = require('./tempo-sal-calculador');

function extrairQtdMes(mapMes) {
  if (!mapMes) return null;
  const m = {};
  for (const [mes, val] of Object.entries(mapMes)) {
    m[mes] = typeof val === 'object' ? (val.qtd || 0) : (val || 0);
  }
  return m;
}
const descartesCalc = require('./descartes-calculador');
const pontosAtiv = require('./pontos-atividade-calc');

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


function mensalAtividades(mapMes, meta, filtro) {
  const ehRelevante = filtro || isTrabalhoSai;
  const mensal = {};
  for (let m = 1; m <= 12; m++) {
    const ativs = mapMes ? mapMes[m] : null;
    if (!ativs || ativs.length === 0) { mensal[m] = null; continue; }
    let total = 0, ausencia = 0, trabalhoSai = 0;
    ativs.forEach(a => {
      total += a.minutos;
      if (isOutrasAtividades(a.atividade)) { /* outras: nao conta em nenhum bucket */ }
      else if (isAusencia(a.atividade)) ausencia += a.minutos;
      else if (ehRelevante(a.atividade)) trabalhoSai += a.minutos;
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

function mensalTempo(mapMes, maxDias) {
  const limite = maxDias || 3;
  const mensal = {};
  for (let m = 1; m <= 12; m++) {
    const row = mapMes ? mapMes[m] : null;
    if (!row || !row.total_ciclos) { mensal[m] = null; continue; }
    const pct = Math.round((row.dentro_prazo / row.total_ciclos) * 10000) / 100;
    const media = Math.round(Number(row.media_dias) * 100) / 100;
    mensal[m] = { pct, media_dias: media, total: row.total_ciclos, dentro_prazo: row.dentro_prazo, atingida: media <= limite };
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

function mensalRetornos(mapMes, meta) {
  const mensal = {};
  for (let m = 1; m <= 12; m++) {
    const row = mapMes ? mapMes[m] : null;
    if (!row || !row.total_psais) { mensal[m] = null; continue; }
    const indice = Math.round((row.total_retornos / row.total_psais) * 100) / 100;
    mensal[m] = { indice, total_psais: row.total_psais, total_retornos: row.total_retornos, atingida: indice <= meta };
  }
  return mensal;
}


// Metas informativas: aparecem nos cards mas NAO entram no total geral
const EXCLUIR_DO_TOTAL = new Set(['tempo-medio-sal', 'controle-descartes', 'tempo-trabalho-principal', 'pontos-gerados', 'pontos-atividade-principal', 'pct-descartes', 'sais-definidas-esp']);

function totalizador(metasObj) {
  const mesAtual = new Date().getMonth() + 1;
  const mesAcum = mesAtual - 1; // Somente meses fechados (< mes atual)
  let atingidas = 0, nao = 0;
  const porMeta = {};
  for (const [id, data] of Object.entries(metasObj)) {
    if (!data || !data.mensal) continue;
    const contaNoTotal = !EXCLUIR_DO_TOTAL.has(id);
    const temDados = mesAcum > 0 &&
      Array.from({ length: mesAcum }, (_, i) => data.mensal[i + 1]).some(d => d !== null && d !== undefined);
    let ma = 0, mn = 0;
    if (!temDados) {
      // Sem dados em meses fechados = considera atingida (total=0 para exibir "0" no card)
      ma = 0; mn = 0;
      if (contaNoTotal) atingidas++;
    } else {
      for (let m = 1; m <= mesAcum; m++) {
        const d = data.mensal[m];
        if (d && d.atingida) { ma++; if (contaNoTotal) atingidas++; }
        else { mn++; if (contaNoTotal) nao++; }
      }
    }
    porMeta[id] = { atingidas: ma, nao_atingidas: mn, total: ma + mn };
  }
  return { atingidas, nao_atingidas: nao, total: atingidas + nao, por_meta: porMeta };
}

function calcularMetas(analista, dados, metaIds) {
  const sgd = analista['codigo-sgd'], uid = analista['i-usuarios'];
  const isEsp = analista.senioridade === 'especialista';
  const metaTempoAnalise = 85;
  const metaTempoGeracao = 80;
  // Ambos usam revCtrl.def keyed por codigo-sgd (responsavel do PSAI)
  const rev = dados.revCtrl.def;
  const revKey = sgd;
  // Calcular atividade principal separado para uso em pontos-atividade-principal
  const podeGerar = isEsp || analista.senioridade === 'pleno';
  const mensalAtivPrincipal = mensalAtividades(dados.ativs[uid], isEsp ? 50 : 70,
    podeGerar ? isPrincipalQualquer : isPrincipalAnalista);
  const todas = {
    'tempo-trabalho-analise': { mensal: mensalAtividades(dados.ativs[uid], metaTempoAnalise) },
    'tempo-trabalho-geracao': { mensal: mensalAtividades(dados.ativs[uid], metaTempoGeracao) },
    'tempo-trabalho-principal': { mensal: mensalAtivPrincipal },
    'tempo-gerando-sai':      { mensal: mensalAtividades(dados.ativs[uid], 50, isGerandoSai) },
    'indice-revisoes-sal':     { mensal: mensalIndice(rev.sal[revKey], 0.50) },
    'indice-revisoes-ne':      { mensal: mensalIndice(rev.ne[revKey], 0.50) },
    'indice-revisoes-sail':    { mensal: mensalIndice(rev.sail[revKey], 1.15) },
    'indice-revisoes-sam-imp': { mensal: mensalIndice(rev.samImp[revKey], 0.80) },
    'indice-revisoes-sam-esc': { mensal: mensalIndice(rev.samEsc[revKey], 0.50) },
    'pontos-definicao': { mensal: mensalPontos(dados.pontos[sgd], 80) },
    'pontos-atividade-principal': { mensal: pontosAtiv.mensalPontosAtivPrincipal(
      dados.pontos[sgd], mensalAtivPrincipal
    ) },
    'pontos-gerados':   { mensal: (m => {
      const base = mensalPontos(dados.pontosGerados?.[uid], 0);
      for (let i = 1; i <= 12; i++) { if (!base[i]) base[i] = { pontos: 0, qtd_sais: 0, atingida: true }; }
      return base;
    })() },
    'sais-definidas-esp': { mensal: (m => {
      const base = mensalPontos(dados.pontos?.[sgd], 0);
      for (let i = 1; i <= 12; i++) { if (!base[i]) base[i] = { pontos: 0, qtd_sais: 0, atingida: true }; }
      return base;
    })() },
    'gerar-sai-ne-sal-3d':    { mensal: mensalTempo(dados.tempoGer[sgd], 3) },
    'gerar-sai-sal-5d':       { mensal: mensalTempo(dados.tempoGerSal?.[sgd], 5) },
    'gerar-sai-sail-sam-7d':  { mensal: mensalTempo(dados.tempoGerSailSam?.[sgd], 7) },
    'respostas-ss-3d': { mensal: mensalSS(dados.ss[uid]) },
    'tempo-medio-sal': { mensal: tempoSal.mensalTempoSal(dados.tempoMedioSal?.[sgd]) },
    'controle-descartes': { mensal: descartesCalc.mensalDescartes(dados.descartes?.[sgd]) },
    'pct-descartes': { mensal: descartesCalc.mensalPctDescartes(
      dados.pontos?.[sgd],
      dados.descartesDataSit?.[sgd],
      extrairQtdMes(dados.analisesSemSai?.[sgd])
    ) },
    'indice-retornos-sal':      { mensal: mensalRetornos(dados.retornos?.[sgd]?.sal, 1.00) },
    'indice-retornos-sail-sam': { mensal: mensalRetornos(dados.retornos?.[sgd]?.sailSam, 1.50) }
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
  mensalAtividades, mensalIndice, mensalPontos, mensalTempo, mensalSS, mensalRetornos,
  totalizador, calcularMetas
};
