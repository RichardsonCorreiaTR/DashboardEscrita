/**
 * liberacoes-sa-v2/qualidade.js - Metricas de qualidade de dados
 *
 * Calcula completude de campos obrigatorios por versao.
 * Gera alertas quando dados sao insuficientes para analise confiavel.
 */

const { round2 } = require('../estatisticas-ne');

const THRESHOLDS = {
  completudeNivel: 0.40,
  completudeTempo: 0.50,
  minimoSAs: 3,
  minimoPares: 5
};

function avaliarVersao(itens) {
  const n = itens.length;
  if (n === 0) {
    return {
      totalItens: 0, completudeNivel: 0, completudeTempo: 0,
      completudeSSC: 0, completudeGeral: 0, alertas: ['Versao sem SAs liberadas']
    };
  }

  const comNivel = itens.filter(i => i.nivelRaw !== null && i.nivelRaw !== undefined).length;
  const comTempo = itens.filter(i => i.tempoPrev > 0).length;
  const comSSC = itens.filter(i => i.ssc > 0).length;

  const completudeNivel = round2(comNivel / n);
  const completudeTempo = round2(comTempo / n);
  const completudeSSC = round2(comSSC / n);
  const completudeGeral = round2(((completudeNivel + completudeTempo + completudeSSC) / 3));

  const alertas = [];
  if (completudeNivel < THRESHOLDS.completudeNivel) {
    alertas.push(`Nivel de alteracao indisponivel em ${round2((1 - completudeNivel) * 100)}% dos itens`);
  }
  if (completudeTempo < THRESHOLDS.completudeTempo) {
    alertas.push(`Tempo previsto ausente em ${round2((1 - completudeTempo) * 100)}% - carga pode estar subestimada`);
  }
  if (n < THRESHOLDS.minimoSAs) {
    alertas.push(`Apenas ${n} SAs - amostra pequena para analise`);
  }

  return {
    totalItens: n, comNivel, comTempo, comSSC,
    completudeNivel, completudeTempo, completudeSSC, completudeGeral,
    alertas
  };
}

function avaliarModelo(correlacao, backtest) {
  const alertas = [];
  if (!correlacao || !correlacao.suficiente) {
    alertas.push('Correlacao insuficiente. Previsao usa baseline de mediana historica.');
  } else if (!correlacao.significativa) {
    alertas.push(`Correlacao nao significativa (p=${correlacao.melhorP}). Usar previsao com cautela.`);
  }

  if (backtest && backtest.mape !== null) {
    if (backtest.mape > 35) {
      alertas.push(`Modelo impreciso (MAPE=${backtest.mape}%). Considerar mediana historica como referencia.`);
    }
  } else {
    alertas.push('Sem backtest disponivel. Confianca da previsao desconhecida.');
  }

  return alertas;
}

module.exports = { avaliarVersao, avaliarModelo, THRESHOLDS };
