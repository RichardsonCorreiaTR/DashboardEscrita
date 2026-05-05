/**
 * liberacoes-sa-v2/index.js - Orquestrador do estudo V2
 *
 * Ponto de entrada: calcularHistorico(executor, opts)
 * Coordena coleta, agregacao, correlacao, previsao,
 * qualidade e recomendacoes.
 */

const path = require('path');
const fs = require('fs');
const versao = require('../../core/versao');
const coleta = require('./coleta');
const { agregarVersao } = require('./carga');
const { calcularEstatisticas } = require('./estatisticas');
const { calcularCorrelacao } = require('./correlacao');
const { preverProximaVersao } = require('./previsao');
const { avaliarVersao, avaliarModelo } = require('./qualidade');
const { gerarRecomendacoes } = require('./recomendacoes');
const { analisarVolatilidade } = require('./volatilidade');
const diario = require('./diario');
const { gerarExemploCalculo } = require('./exemplo');

const CACHE_NE_PATH = path.join(__dirname, '..', '..', '..', 'data', 'cache', 'estudos-historico.json');
const CACHE_DESC_PATH = path.join(__dirname, '..', '..', '..', 'data', 'cache', 'estudos-descartes-ne.json');

async function calcularHistorico(executor, opts = {}) {
  coleta.restaurarCache();
  const nomes = coleta.listarVersoesEsperadas();
  const versaoAtual = await detectarAtual(executor);
  const resultados = [];

  for (const nome of nomes) {
    const ehAtual = nome === versaoAtual;
    const force = opts.forceTodas || (ehAtual && opts.forceAtual !== false);
    const dados = await coleta.coletarVersao(executor, nome, force, {
      incluirPipeline: ehAtual
    });
    if (!dados) continue;

    const agregado = agregarVersao(dados.itens);
    const qualidade = avaliarVersao(dados.itens);
    const pipeline = ehAtual && dados.pipeline && dados.pipeline.length > 0
      ? agregarVersao(dados.pipeline) : null;

    const entrada = {
      versao: nome, ...agregado,
      qualidade, itens: dados.itens,
      ehVersaoAtual: ehAtual,
      pipeline: pipeline ? { ...pipeline, itens: dados.pipeline } : null
    };

    if (ehAtual && pipeline) {
      const combinados = [...dados.itens, ...dados.pipeline];
      const projAgregado = agregarVersao(combinados);
      entrada.totalProjetado = projAgregado.totalLiberacoes;
      entrada.cargaProjetada = projAgregado.carga.total;
      entrada.porTipoProjetado = projAgregado.porTipo;
      entrada.temposProjetados = projAgregado.tempos;
      entrada.pctAltaComplexidadeProj = projAgregado.pctAltaComplexidade;
    }

    resultados.push(entrada);
  }

  coleta.salvarCache();
  const stats = calcularEstatisticas(resultados);
  const cacheNE = carregarCacheNE();
  const cacheDesc = carregarCacheDescartes();

  let correlacao = null;
  let volatilidade = null;
  if (cacheNE) {
    correlacao = calcularCorrelacao(resultados, cacheNE, cacheDesc);
    volatilidade = analisarVolatilidade(resultados, cacheNE, cacheDesc);
  }

  const vAtual = resultados.find(v => v.versao === versaoAtual);
  let previsao = null;
  if (vAtual && cacheNE) {
    previsao = preverProximaVersao(vAtual, resultados, cacheNE, cacheDesc);
  }

  const alertasModelo = avaliarModelo(correlacao, previsao ? previsao.backtest : null);
  let recomendacoes = [];
  if (vAtual && stats) {
    recomendacoes = gerarRecomendacoes(vAtual, previsao, stats, vAtual.qualidade);
  }

  const parsed = versao.parsearNomeVersao(versaoAtual);
  const versaoFutura = parsed
    ? versao.nomeDaVersao(parsed.mes === 12 ? parsed.ano + 1 : parsed.ano, parsed.mes === 12 ? 1 : parsed.mes + 1)
    : null;

  garantirDiarioAtualizado(previsao, versaoFutura, cacheNE, cacheDesc);
  const exemplo = vAtual
    ? gerarExemploCalculo(versaoAtual, resultados, cacheNE, cacheDesc) : null;
  const resumoDiario = diario.gerarResumoParaFrontend(cacheNE, cacheDesc);

  return {
    versoes: resultados, estatisticas: stats,
    correlacao, volatilidade, previsao, recomendacoes,
    alertasModelo, versaoAtual, versaoFutura,
    algoritmo: gerarDocAlgoritmo(previsao, correlacao, volatilidade),
    exemplo, diario: resumoDiario,
    _meta: {
      modelo: 'liberacoes-sa-v3', algoritmo: 'mediana_pura_j4',
      atualizado_em: new Date().toISOString(),
      total_versoes: resultados.length,
      periodo: resultados.length > 0
        ? { de: resultados[0].versao, ate: resultados[resultados.length - 1].versao }
        : null
    }
  };
}

function garantirDiarioAtualizado(previsao, versaoFutura, cacheNE, cacheDesc) {
  const d = diario.obterDiario();
  if (!d.estrategia_atual) {
    diario.registrarEstrategia('mediana_pura_v3', { janela: 4 },
      'Calibracao V3: 16 estrategias testadas, mediana pura J=4 venceu');
  }
  if (previsao && !previsao.fallbackUsado && versaoFutura) {
    diario.registrarPrevisao(versaoFutura, previsao.prevPontual,
      previsao.intervalo, { tipo: previsao.modelo.tipo, params: { janela: 4 } });
  }
}

function carregarCacheNE() {
  try {
    if (!fs.existsSync(CACHE_NE_PATH)) return null;
    const dados = JSON.parse(fs.readFileSync(CACHE_NE_PATH, 'utf-8'));
    return dados.versoes || null;
  } catch (err) {
    console.warn('[sa-v2] Cache NE indisponivel:', err.message);
    return null;
  }
}

function carregarCacheDescartes() {
  try {
    if (!fs.existsSync(CACHE_DESC_PATH)) return null;
    const dados = JSON.parse(fs.readFileSync(CACHE_DESC_PATH, 'utf-8'));
    return dados.versoes || null;
  } catch (err) {
    console.warn('[sa-v2] Cache descartes indisponivel:', err.message);
    return null;
  }
}

async function detectarAtual(executor) {
  try { return await versao.detectarVersaoAtual(executor); }
  catch { return versao.nomeDaVersao(new Date().getFullYear(), new Date().getMonth() + 1); }
}

function gerarDocAlgoritmo(previsao, correlacao, volatilidade) {
  const etapas = [
    { passo: 1, titulo: 'Coleta de SAs liberadas', desc: 'SAM, SAL e SAIL liberadas na Escrita desde fev/2022. Na versao atual tambem coletamos pipeline.' },
    { passo: 2, titulo: 'Calculo de carga ponderada', desc: 'Peso por SA: faixa(1-8) x tipo(SAM=1,SAL=1.3,SAIL=1.5) x desvio x abrangencia.', formula: 'Carga = peso_faixa * peso_tipo * peso_desvio * peso_abrangencia' },
    { passo: 3, titulo: 'NE liquida', desc: 'Entradas brutas menos descartes (Concl.s/Dev(5), Reprovacao(6), Prescricao(23)).', formula: 'NE_liquida = entradas_brutas - CsD - reprovadas - prescritas' },
    { passo: 4, titulo: 'Mediana das ultimas 4 versoes (V3)', desc: 'Calibracao testou 16 estrategias em 40 backtests. Janela 4 superou janela 6. Fator carga REMOVIDO: introduzia ruido.', formula: 'NE_prevista = mediana(NE_liquida das ultimas 4 versoes)' },
    { passo: 5, titulo: 'Intervalo de confianca', desc: 'Percentis 25 e 75 da janela definem intervalo provavel.', formula: 'intervalo = [P25, P75] das ultimas 4 versoes' }
  ];
  const bt = previsao && previsao.backtest;
  const validacao = {
    backtest: bt ? { mape: bt.mape, mape6m: bt.mape6m, qualidade: bt.qualidade, testes: bt.totalTestes, acertoDirecao: bt.acertoDirecao } : null,
    calibracao: { estrategiasTested: 16, backtests: 40, vencedora: 'Mediana pura J=4 (MAPE ~32%)', descartada: 'Mediana+Carga J=6 (MAPE ~58%)', motivo: 'Fator carga amplifica ruido dos descartes (taxa varia 14-44%)' },
    correlacao: correlacao ? { tipo: 'Spearman', rho: correlacao.melhorRho, significativa: correlacao.significativa } : null,
    volatilidade: volatilidade ? { lagDominante: volatilidade.lagDominante, dispersao: volatilidade.dispersao, resumo: volatilidade.resumo } : null
  };
  const melhorias = [
    'Predizer taxa de descarte separadamente (NE bruta + descartes)',
    'Testar EWMA se dados ficarem mais estaveis',
    'Considerar sazonalidade (dez/jan)',
    'Ensemble: combinar mediana + EWMA',
    'Recalibrar trimestralmente'
  ];
  return { etapas, validacao, melhorias };
}

module.exports = {
  calcularHistorico,
  listarVersoesEsperadas: coleta.listarVersoesEsperadas
};
