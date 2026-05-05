/**
 * descartes-estatisticas.js - Estatisticas e algoritmo de percentual aceitavel
 *
 * ALGORITMO DO PERCENTUAL ACEITAVEL:
 *   1. Calcula EWMA (Exponential Weighted Moving Average) com span=6
 *      -> Mais peso para versoes recentes, suaviza oscilacoes
 *   2. Calcula desvio padrao historico dos percentuais
 *   3. Define faixas:
 *      - Normal:  percentual <= EWMA + 1*DP
 *      - Atencao: EWMA + 1*DP < percentual <= EWMA + 2*DP
 *      - Critico: percentual > EWMA + 2*DP
 *
 * POR QUE EWMA + DESVIO PADRAO?
 *   - EWMA captura a tendencia recente (se o percentual vem subindo ou caindo)
 *   - O desvio padrao mede a variabilidade natural do processo
 *   - Juntos, formam uma "banda de controle" estatistica (similar a Shewhart)
 *   - Se o percentual sai da banda, ha evidencia de mudanca no processo
 */

/**
 * Calcula todas as estatisticas de descartes
 * @param {Object[]} versoes - Dados coletados por versao
 * @param {string} versaoAtual - Nome da versao atual
 * @returns {Object} Estatisticas completas
 */
function calcularEstatisticasDescartes(versoes, versaoAtual) {
  if (versoes.length === 0) return null;

  const pcts = versoes.map(v => v.percentual);
  const media = round2(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  const mediana = calcMediana(pcts);
  const dp = calcDesvioPadrao(pcts);

  const ewmaSerie = calcEWMA(pcts, 6);
  const ewmaAtual = ewmaSerie.length > 0 ? ewmaSerie[ewmaSerie.length - 1] : media;
  const faixaNormal = round2(ewmaAtual + dp);
  const faixaAtencao = round2(ewmaAtual + 2 * dp);

  const recentes = pcts.slice(-6);
  const mediaRecente = round2(recentes.reduce((a, b) => a + b, 0) / recentes.length);
  const medianaRecente = calcMediana(recentes);

  const totEntradas = versoes.reduce((s, v) => s + v.entradas, 0);
  const totConcl = versoes.reduce((s, v) => s + (v.conclSemDev || 0), 0);
  const totRepr = versoes.reduce((s, v) => s + v.reprovadas, 0);
  const totPresc = versoes.reduce((s, v) => s + v.prescritas, 0);
  const totFoco = totConcl + totRepr + totPresc;
  const pctGlobal = totEntradas > 0 ? round2((totFoco / totEntradas) * 100) : 0;

  const porMotivo = {
    conclSemDev: { total: totConcl, pct: totFoco > 0 ? round2((totConcl / totFoco) * 100) : 0 },
    reprovada: { total: totRepr, pct: totFoco > 0 ? round2((totRepr / totFoco) * 100) : 0 },
    prescrita: { total: totPresc, pct: totFoco > 0 ? round2((totPresc / totFoco) * 100) : 0 }
  };

  const vAtual = versoes.find(v => v.versao === versaoAtual);
  const diagnostico = vAtual
    ? diagnosticar(vAtual, ewmaAtual, dp, faixaNormal, faixaAtencao, mediana)
    : null;

  const analiseDescricoes = analisarDescricoes(versoes, versaoAtual);

  const serieEWMA = versoes.map((v, i) => ({
    versao: v.versao,
    ewma: round2(ewmaSerie[i] || 0),
    faixaNormal: round2((ewmaSerie[i] || 0) + dp),
    faixaAtencao: round2((ewmaSerie[i] || 0) + 2 * dp)
  }));

  return {
    totalVersoes: versoes.length,
    percentual: { media, mediana, dp, min: round2(Math.min(...pcts)), max: round2(Math.max(...pcts)) },
    recente: { media: mediaRecente, mediana: medianaRecente },
    ewma: { atual: round2(ewmaAtual), span: 6 },
    faixas: { normal: faixaNormal, atencao: faixaAtencao },
    totais: { entradas: totEntradas, conclSemDev: totConcl, reprovadas: totRepr, prescritas: totPresc, foco: totFoco, pctGlobal },
    porMotivo, diagnostico, analiseDescricoes, serieEWMA
  };
}

/** Diagnostica a versao atual em relacao ao historico */
function diagnosticar(v, ewma, dp, faixaNormal, faixaAtencao, mediana) {
  const pct = v.percentual;
  const desvioVsEWMA = round2(pct - ewma);
  const desvioSigmas = dp > 0 ? round2(desvioVsEWMA / dp) : 0;

  let classificacao, cor;
  if (pct <= faixaNormal) { classificacao = 'normal'; cor = 'verde'; }
  else if (pct <= faixaAtencao) { classificacao = 'atencao'; cor = 'amarelo'; }
  else { classificacao = 'critico'; cor = 'vermelho'; }

  return {
    versao: v.versao, percentual: pct,
    esperado: round2(ewma), mediaHistorica: mediana,
    desvio: desvioVsEWMA, desvioSigmas,
    classificacao, cor,
    entradas: v.entradas, conclSemDev: v.conclSemDev || 0, reprovadas: v.reprovadas, prescritas: v.prescritas
  };
}

/** Agrupa descricoes por gravidade e frequencia */
function analisarDescricoes(versoes, versaoAtual) {
  const todosDetalhes = [];
  const detalhesAtual = [];

  for (const v of versoes) {
    if (!v.detalhes) continue;
    for (const d of v.detalhes) {
      todosDetalhes.push(d);
      if (v.versao === versaoAtual) detalhesAtual.push(d);
    }
  }

  return {
    historico: agrupar(todosDetalhes),
    atual: agrupar(detalhesAtual)
  };
}

function agrupar(detalhes) {
  if (detalhes.length === 0) return { porGravidade: {}, porMotivo: {}, topDescricoes: [], total: 0 };

  const porGravidade = {};
  const porMotivo = { 5: 0, 6: 0, 23: 0 };
  const descFreq = {};

  for (const d of detalhes) {
    const grav = d.gravidade || 'N/D';
    porGravidade[grav] = (porGravidade[grav] || 0) + 1;
    porMotivo[d.motivo_id] = (porMotivo[d.motivo_id] || 0) + 1;

    const desc = (d.descricao || '').substring(0, 100).trim();
    if (desc) descFreq[desc] = (descFreq[desc] || { qtd: 0, motivo: d.motivo_id, grav: d.gravidade });
    if (desc) descFreq[desc].qtd++;
  }

  const topDescricoes = Object.entries(descFreq)
    .sort((a, b) => b[1].qtd - a[1].qtd)
    .slice(0, 15)
    .map(([desc, info]) => ({ descricao: desc, qtd: info.qtd, motivo: info.motivo, gravidade: info.grav }));

  return { porGravidade, porMotivo, topDescricoes, total: detalhes.length };
}

/* ============== FUNCOES MATEMATICAS ============== */

function calcMediana(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return round2(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
}

function calcDesvioPadrao(arr) {
  if (arr.length === 0) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variancia = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
  return round2(Math.sqrt(variancia));
}

/**
 * EWMA: Exponential Weighted Moving Average
 * alpha = 2/(span+1) -> span=6 -> alpha ~0.2857
 * Primeiro valor = observacao inicial; cada proximo = alpha*obs + (1-alpha)*ewma_anterior
 */
function calcEWMA(valores, span) {
  if (valores.length === 0) return [];
  const alpha = 2 / (span + 1);
  const result = [valores[0]];
  for (let i = 1; i < valores.length; i++) {
    result.push(round2(alpha * valores[i] + (1 - alpha) * result[i - 1]));
  }
  return result;
}

function round2(v) { return Math.round(v * 100) / 100; }

module.exports = { calcularEstatisticasDescartes };
