/**
 * liberacoes-sa-v2/recomendacoes.js - Recomendacoes automaticas
 *
 * Gera acoes concretas baseadas nos indicadores.
 * Cada recomendacao tem: tipo (info/atencao/alerta/critico),
 * mensagem e acao sugerida.
 */

const { round2 } = require('../estatisticas-ne');
const { obterCargaEfetiva } = require('./projecao-utils');

function gerarRecomendacoes(versaoProc, previsao, stats, qualidade) {
  const recs = [];
  if (!versaoProc || !stats) return recs;

  recCarga(recs, versaoProc, stats);
  recDesvio(recs, versaoProc);
  recComplexidade(recs, versaoProc);
  recPrevisao(recs, previsao);
  recQualidade(recs, qualidade);
  recPipeline(recs, versaoProc);

  return recs.sort((a, b) => prioridade(a.tipo) - prioridade(b.tipo));
}

function prioridade(tipo) {
  return { critico: 0, alerta: 1, atencao: 2, info: 3 }[tipo] || 4;
}

function recCarga(recs, v, stats) {
  if (!stats.carga.mediana || stats.carga.mediana === 0) return;
  const ratio = obterCargaEfetiva(v) / stats.carga.mediana;
  if (ratio > 1.5) {
    recs.push({
      tipo: 'critico', area: 'carga',
      mensagem: `Carga ${round2(ratio)}x acima da mediana: versao muito pesada.`,
      acao: 'Priorizar revisao de codigo nos itens de alta complexidade antes da liberacao.'
    });
  } else if (ratio > 1.2) {
    recs.push({
      tipo: 'atencao', area: 'carga',
      mensagem: `Carga ${round2(ratio)}x da mediana: levemente acima do padrao.`,
      acao: 'Monitorar NEs na proxima versao com mais atencao.'
    });
  } else if (ratio < 0.7) {
    recs.push({
      tipo: 'info', area: 'carga',
      mensagem: `Carga ${round2(ratio)}x da mediana: versao leve.`,
      acao: 'Sem acao especial necessaria.'
    });
  }
}

function recDesvio(recs, v) {
  const desvio = v.tempos.desvioEstimativa;
  if (desvio > 30) {
    recs.push({
      tipo: 'alerta', area: 'estimativa',
      mensagem: `Desvio de estimativa em +${desvio}%: tempo realizado excedeu significativamente o previsto.`,
      acao: 'Investigar processo de estimativa. Subestimacao consistente aumenta risco de testes insuficientes.'
    });
  } else if (desvio < -20) {
    recs.push({
      tipo: 'info', area: 'estimativa',
      mensagem: `Desvio em ${desvio}%: equipe entregou mais rapido que o previsto.`,
      acao: 'Positivo, mas verificar se houve corte de escopo.'
    });
  }
}

function recComplexidade(recs, v) {
  const pctAlta = v.pctAltaComplexidadeProj != null
    ? v.pctAltaComplexidadeProj : v.pctAltaComplexidade;
  if (pctAlta > 40) {
    recs.push({
      tipo: 'alerta', area: 'complexidade',
      mensagem: `${pctAlta}% dos itens sao de alta/muito alta complexidade.`,
      acao: 'Concentracao de risco. Garantir cobertura de testes proporcional.'
    });
  }
}

function recPrevisao(recs, previsao) {
  if (!previsao || previsao.fallbackUsado) return;
  if (previsao.risco === 'critico') {
    recs.push({
      tipo: 'critico', area: 'previsao',
      mensagem: `Previsao de ${previsao.prevPontual} NEs: significativamente acima do historico.`,
      acao: 'Preparar plano de contingencia. Considerar reforco na equipe de triagem.'
    });
  } else if (previsao.risco === 'elevado') {
    recs.push({
      tipo: 'atencao', area: 'previsao',
      mensagem: `Previsao de ${previsao.prevPontual} NEs: acima do padrao.`,
      acao: 'Manter monitoramento reforçado nas primeiras semanas da proxima versao.'
    });
  } else if (previsao.risco === 'favoravel') {
    recs.push({
      tipo: 'info', area: 'previsao',
      mensagem: `Previsao de ${previsao.prevPontual} NEs: abaixo do historico.`,
      acao: 'Cenario favoravel. Oportunidade para reduzir backlog.'
    });
  }
}

function recQualidade(recs, qualidade) {
  if (!qualidade) return;
  if (qualidade.completudeGeral < 0.5) {
    recs.push({
      tipo: 'atencao', area: 'dados',
      mensagem: `Qualidade dos dados em ${round2(qualidade.completudeGeral * 100)}%.`,
      acao: 'Preencher nivel de alteracao e tempo previsto nas SAs futuras para melhorar previsoes.'
    });
  }
}

function recPipeline(recs, v) {
  if (!v.pipeline || !v.totalProjetado) return;
  const pipeQtd = v.pipeline.totalLiberacoes;
  if (pipeQtd <= 0) return;
  const pctPipe = round2((pipeQtd / v.totalProjetado) * 100);
  if (pctPipe >= 50) {
    recs.push({
      tipo: 'atencao', area: 'pipeline',
      mensagem: `${pipeQtd} SAs em pipeline (${pctPipe}% do total projetado). Versao ainda em andamento.`,
      acao: 'Totais projetados podem mudar significativamente. Acompanhar diariamente.'
    });
  } else if (pipeQtd > 0) {
    recs.push({
      tipo: 'info', area: 'pipeline',
      mensagem: `${pipeQtd} SAs em pipeline (${pctPipe}% do projetado). Projecao inclui itens nao liberados.`,
      acao: 'Valores finais serao confirmados ao encerrar a versao.'
    });
  }
}

module.exports = { gerarRecomendacoes };
