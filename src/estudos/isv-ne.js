/**
 * isv-ne.js - Indice de Saude da Versao e Projecao Realista
 * ISV 0-100 pts: Ritmo(39) + Tendencia(28) + Projecao(22) + Aceleracao(11)
 * + modificador gravidade (±3). Mais NE = PIOR.
 */
const { mediana, media, round2, acumuladosNoEstagio } = require('./estatisticas-ne');
const { calcularModificador: calcularModGravidade } = require('./isv-gravidade');
const impacto = require('./isv-impacto');

/** Projecao baseada no padrao historico de distribuicao semanal. */
function calcularProjecaoRealista(dadosVersao, historico) {
  const sc = dadosVersao.semanasConcluidas !== undefined ? dadosVersao.semanasConcluidas : 4;

  let acumuladoAtual = dadosVersao.totais.entradasBrutas;
  if (sc > 0 && sc <= 4 && dadosVersao.semanas && dadosVersao.semanas.length >= sc) {
    const semAlvo = dadosVersao.semanas[sc - 1];
    if (semAlvo && semAlvo.acumuladoEntradas !== undefined && !isNaN(semAlvo.acumuladoEntradas)) {
      acumuladoAtual = semAlvo.acumuladoEntradas;
    } else {
      acumuladoAtual = 0;
      for (let i = 0; i < sc; i++) {
        acumuladoAtual += (dadosVersao.semanas[i] ? dadosVersao.semanas[i].entradasBrutas : 0);
      }
    }
  }

  const completas = historico.filter(v => !v.versaoEmAndamento && (v.semanasConcluidas !== undefined ? v.semanasConcluidas : 4) === 4);

  const projecaoLinear = dadosVersao.projecao ? dadosVersao.projecao.linear : null;

  let projecaoHistorica = null;
  let percentualEstagio = null;
  if (sc > 0 && sc < 4 && completas.length >= 3) {
    const percentuais = completas.map(v => {
      let acum = 0;
      for (let i = 0; i < sc; i++) acum += v.semanas[i].entradasBrutas;
      return v.totais.entradasBrutas > 0 ? acum / v.totais.entradasBrutas : 0;
    }).filter(p => p > 0);

    if (percentuais.length > 0) {
      percentualEstagio = round2(mediana(percentuais) * 100);
      const medianaPerc = mediana(percentuais);
      projecaoHistorica = medianaPerc > 0
        ? Math.round(acumuladoAtual / medianaPerc) : null;
    }
  }

  const projecaoConservadora = projecaoLinear && projecaoHistorica
    ? Math.max(projecaoLinear, projecaoHistorica)
    : projecaoLinear || projecaoHistorica;

  const totaisHist = completas.map(v => v.totais.entradasBrutas);
  const mediaHistTotal = round2(media(totaisHist));
  const medianaHistTotal = round2(mediana(totaisHist));

  const acumHist = acumuladosNoEstagio(sc, completas);
  const mediaNoEstagio = round2(media(acumHist));
  const medianaNoEstagio = round2(mediana(acumHist));

  const desvioVsEstagio = medianaNoEstagio > 0
    ? round2(((acumuladoAtual - medianaNoEstagio) / medianaNoEstagio) * 100) : 0;

  return {
    acumuladoAtual,
    percentualConcluido: dadosVersao.projecao ? dadosVersao.projecao.percentualConcluido : 100,
    diasRestantes: dadosVersao.projecao ? dadosVersao.projecao.diasRestantes : 0,
    linear: projecaoLinear, historica: projecaoHistorica, conservadora: projecaoConservadora,
    percentualEstagio,
    comparativoEstagio: { acumuladoAtual, mediaHistorica: mediaNoEstagio, medianaHistorica: medianaNoEstagio, desvioPercentual: desvioVsEstagio, posicao: desvioVsEstagio > 10 ? 'acima' : desvioVsEstagio < -10 ? 'abaixo' : 'na_media' },
    historicoTotal: { media: mediaHistTotal, mediana: medianaHistTotal }
  };
}

/** ISV - 4 fatores (100pts) + gravidade (±3pts). */
function calcularISV(dadosVersao, historicoVersoes) {
  if (!historicoVersoes || historicoVersoes.length < 3) {
    return { total: 50, classificacao: 'indefinido', fatores: {}, insuficiente: true };
  }

  const completas = historicoVersoes.filter(v => {
    if (v.versaoEmAndamento) return false;
    const sc = v.semanasConcluidas !== undefined ? v.semanasConcluidas : 4;
    return sc === 4;
  });
  if (completas.length < 3) {
    return { total: 50, classificacao: 'indefinido', fatores: {}, insuficiente: true };
  }

  const pontuacao = {};
  const sc = dadosVersao.semanasConcluidas !== undefined ? dadosVersao.semanasConcluidas : 4;
  const ehEmAndamento = dadosVersao.versaoEmAndamento;

  // === 1. RITMO VS ESTAGIO (39 pts) ===
  let acumAtual = dadosVersao.totais.entradasBrutas;
  if (sc > 0 && sc <= 4 && dadosVersao.semanas && dadosVersao.semanas.length >= sc) {
    const semAlvo = dadosVersao.semanas[sc - 1];
    if (semAlvo && semAlvo.acumuladoEntradas !== undefined && !isNaN(semAlvo.acumuladoEntradas)) {
      acumAtual = semAlvo.acumuladoEntradas;
    } else {
      acumAtual = 0;
      for (let i = 0; i < sc; i++) {
        acumAtual += (dadosVersao.semanas[i] ? dadosVersao.semanas[i].entradasBrutas : 0);
      }
    }
  }
  const acumHist = acumuladosNoEstagio(Math.min(sc, 4), completas);
  const medianaEstagio = mediana(acumHist);

  if (medianaEstagio > 0) {
    const ratio = acumAtual / medianaEstagio;
    if (ratio <= 0.85) pontuacao.ritmo = 39;
    else if (ratio <= 1.0) pontuacao.ritmo = round2(39 - (ratio - 0.85) * 126.7);
    else if (ratio <= 1.3) pontuacao.ritmo = round2(20 - (ratio - 1.0) * 66.7);
    else pontuacao.ritmo = 0;
  } else {
    pontuacao.ritmo = 19.5;
  }

  // === 2. PROJECAO VS HISTORICO (22 pts) ===
  const totalFinal = ehEmAndamento
    ? calcularProjecaoRealista(dadosVersao, completas).conservadora
    : dadosVersao.totais.entradasBrutas;
  const medianaTotal = mediana(completas.map(v => v.totais.entradasBrutas));

  if (totalFinal && medianaTotal > 0) {
    const ratio = totalFinal / medianaTotal;
    if (ratio <= 0.85) pontuacao.projecao = 22;
    else if (ratio <= 1.0) pontuacao.projecao = round2(22 - (ratio - 0.85) * 73.3);
    else if (ratio <= 1.3) pontuacao.projecao = round2(11 - (ratio - 1.0) * 36.7);
    else pontuacao.projecao = 0;
  } else {
    pontuacao.projecao = 11;
  }

  // === 3. TENDENCIA 6 MESES (28 pts) ===
  const ultimos6 = historicoVersoes.slice(-6);
  const media6m = media(ultimos6.map(v => v.totais.mediaDiaUtil));
  const taxaAtual = dadosVersao.totais.mediaDiaUtil;

  if (media6m > 0) {
    const ratio = taxaAtual / media6m;
    if (ratio <= 0.9) pontuacao.tendencia = 28;
    else if (ratio <= 1.1) pontuacao.tendencia = round2(28 - (ratio - 0.9) * 70);
    else if (ratio <= 1.4) pontuacao.tendencia = round2(14 - (ratio - 1.1) * 46.7);
    else pontuacao.tendencia = 0;
  } else {
    pontuacao.tendencia = 14;
  }

  // === 4. ACELERACAO (11 pts) ===
  const vals = dadosVersao.semanas
    .filter(s => s.entradasBrutas > 0)
    .map(s => s.mediaDiaUtil);

  if (vals.length >= 2) {
    const n = vals.length;
    const xMean = (n - 1) / 2;
    const yMean = media(vals);
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (vals[i] - yMean);
      den += (i - xMean) ** 2;
    }
    const slope = den ? num / den : 0;
    const slopeNorm = yMean > 0 ? slope / yMean : 0;

    if (slopeNorm <= -0.1) pontuacao.aceleracao = 11;
    else if (slopeNorm <= 0.05) pontuacao.aceleracao = round2(11 - (slopeNorm + 0.1) * 40);
    else if (slopeNorm <= 0.3) pontuacao.aceleracao = round2(5 - (slopeNorm - 0.05) * 20);
    else pontuacao.aceleracao = 0;
  } else {
    pontuacao.aceleracao = 5.5;
  }

  // === 5. GRAVIDADE (modificador legado ±3 pts, mantido para referencia) ===
  let gravidadeInfo = null;
  const gAtual = dadosVersao.totais && dadosVersao.totais.gravidade;
  if (gAtual && gAtual.indice > 0) {
    const indicesHist = historicoVersoes
      .filter(v => v.totais && v.totais.gravidade && v.totais.gravidade.indice > 0)
      .map(v => v.totais.gravidade.indice);
    gravidadeInfo = calcularModGravidade(gAtual.indice, indicesHist);
  }

  // === 6. IMPACTO AO CLIENTE (modificador ±8 pts, combina SSC + gravidade) ===
  let impactoInfo = null;
  const sscAtual = dadosVersao.totais && dadosVersao.totais.ssc;
  if (sscAtual && sscAtual.totalSSC >= 0) {
    const criticas = gAtual ? gAtual.contagens.Critica : 0;
    const graves = gAtual ? gAtual.contagens.Grave : 0;
    const idxAtual = impacto.calcularIndice(sscAtual.totalSSC, dadosVersao.totais.entradasBrutas, criticas, graves);

    const idxHist = historicoVersoes
      .filter(v => v.totais && v.totais.ssc && v.totais.entradasBrutas > 0)
      .map(v => {
        const g = v.totais.gravidade || { contagens: { Critica: 0, Grave: 0 } };
        return impacto.calcularIndice(
          v.totais.ssc.totalSSC, v.totais.entradasBrutas,
          g.contagens.Critica || 0, g.contagens.Grave || 0
        );
      });

    impactoInfo = impacto.calcularModificador(idxAtual, idxHist);
    impactoInfo.indice = idxAtual;
    impactoInfo.ssc = sscAtual;
  }

  // === TOTAL E CLASSIFICACAO ===
  const baseTotal = round2(
    pontuacao.ritmo + pontuacao.projecao + pontuacao.tendencia +
    pontuacao.aceleracao
  );
  const modImpacto = impactoInfo ? impactoInfo.modificador : 0;
  const modGrav = (!impactoInfo && gravidadeInfo) ? gravidadeInfo.modificador : 0;
  const total = Math.max(0, Math.min(100, round2(baseTotal + modImpacto + modGrav)));

  let classificacao;
  if (total >= 75) classificacao = 'confortavel';
  else if (total >= 55) classificacao = 'normal';
  else if (total >= 35) classificacao = 'atencao';
  else classificacao = 'critico';

  const ratioEstagio = medianaEstagio > 0 ? round2((acumAtual / medianaEstagio - 1) * 100) : 0;
  const ratioProj = medianaTotal > 0 && totalFinal ? round2((totalFinal / medianaTotal - 1) * 100) : 0;
  const ratioTend = media6m > 0 ? round2((taxaAtual / media6m - 1) * 100) : 0;

  return {
    total,
    classificacao,
    pontuacao,
    maxPontos: { ritmo: 39, tendencia: 28, projecao: 22, aceleracao: 11 },
    gravidade: gAtual ? {
      contagens: gAtual.contagens, indice: gAtual.indice,
      modificador: modGrav, interpretacao: gravidadeInfo ? gravidadeInfo.interpretacao : null
    } : null,
    impacto: impactoInfo ? {
      modificador: impactoInfo.modificador,
      percentil: impactoInfo.percentil,
      interpretacao: impactoInfo.interpretacao,
      ratio: impactoInfo.indice.ratio,
      indiceComposto: impactoInfo.indice.indiceComposto,
      ssc: impactoInfo.ssc
    } : null,
    referencias: { acumuladoAtual: acumAtual, medianaNoEstagio: round2(medianaEstagio), projecaoConservadora: totalFinal, medianaHistoricaTotal: round2(medianaTotal), taxaAtual, media6meses: round2(media6m) },
    fatores: {
      ritmo: ratioEstagio >= 0 ? `${acumAtual} NEs acum: ${ratioEstagio > 0 ? '+' : ''}${ratioEstagio}% vs mediana (${round2(medianaEstagio)}) no estagio` : `${acumAtual} NEs acum vs mediana ${round2(medianaEstagio)}`,
      projecao: `Proj conserv: ${totalFinal || '?'} NEs vs mediana ${round2(medianaTotal)} (${ratioProj > 0 ? '+' : ''}${ratioProj}%)`,
      tendencia: `${taxaAtual} NE/dia vs media 6m ${round2(media6m)} (${ratioTend > 0 ? '+' : ''}${ratioTend}%)`,
      aceleracao: pontuacao.aceleracao >= 8 ? 'Desacelerando' : pontuacao.aceleracao >= 4 ? 'Estavel' : 'Acelerando (piora)'
    }
  };
}

module.exports = { calcularProjecaoRealista, calcularISV };
