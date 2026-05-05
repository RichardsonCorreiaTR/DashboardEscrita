/**
 * laboratorio/sinais.js - Sinais numericos por versao para previsao
 *
 * Calcula features derivadas do mapa de risco para usar como
 * preditores no backtest. Cada sinal e um numero por versao.
 */

const { round2 } = require('../estatisticas-ne');

function calcularSinaisPorVersao(rastreabilidade, ranking) {
  if (!rastreabilidade || !ranking) return {};
  const taxaPorTag = construirMapaTaxa(ranking);
  const resultado = {};

  for (const [versao, dados] of Object.entries(rastreabilidade.por_versao)) {
    resultado[versao] = calcularSinaisVersao(dados, taxaPorTag);
  }
  return resultado;
}

function construirMapaTaxa(ranking) {
  const mapa = {};
  for (const r of ranking) mapa[r.tag] = r.taxa_ne_sa;
  return mapa;
}

function calcularSinaisVersao(dados, taxaPorTag) {
  const sas = dados.sas || [];
  if (sas.length === 0) return sinaisVazios();

  const s1 = calcularRiscoTematico(sas, taxaPorTag);
  const s2 = calcularConcentracao(sas);
  const s3 = calcularGravidadeEsperada(sas, taxaPorTag);
  const s4 = 0;
  const s5 = round2(s1 * 0.5 + s3 * 0.3 + s2 * 0.2);

  return {
    risco_tematico: s1, concentracao: s2,
    gravidade_esperada: s3, refs_cruzadas: s4,
    combinado: s5, total_sas: sas.length
  };
}

function sinaisVazios() {
  return {
    risco_tematico: 0, concentracao: 0,
    gravidade_esperada: 0, refs_cruzadas: 0,
    combinado: 0, total_sas: 0
  };
}

function calcularRiscoTematico(sas, taxaPorTag) {
  let soma = 0, count = 0;
  for (const sa of sas) {
    for (const tag of sa.tags) {
      if (taxaPorTag[tag] !== undefined) {
        soma += taxaPorTag[tag];
        count++;
      }
    }
  }
  return count > 0 ? round2(soma / count) : 0;
}

function calcularConcentracao(sas) {
  const contagem = {};
  let totalTags = 0;
  for (const sa of sas) {
    for (const tag of sa.tags) {
      contagem[tag] = (contagem[tag] || 0) + 1;
      totalTags++;
    }
  }
  if (totalTags === 0) return 0;
  let hhi = 0;
  for (const count of Object.values(contagem)) {
    const share = count / totalTags;
    hhi += share * share;
  }
  return round2(hhi);
}

function calcularGravidadeEsperada(sas, taxaPorTag) {
  let soma = 0, count = 0;
  for (const sa of sas) {
    const nivelPeso = sa.nivel === 3 ? 2.0 : sa.nivel === 2 ? 1.3 : 1.0;
    for (const tag of sa.tags) {
      const taxa = taxaPorTag[tag] || 0;
      soma += taxa * nivelPeso;
      count++;
    }
  }
  return count > 0 ? round2(soma / count) : 0;
}

module.exports = { calcularSinaisPorVersao };
