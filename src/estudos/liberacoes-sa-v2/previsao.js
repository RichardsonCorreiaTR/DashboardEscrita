/**
 * liberacoes-sa-v2/previsao.js - Previsao V3 (mediana pura, janela 4)
 *
 * Calibracao empirica (16 estrategias, 40 backtests) demonstrou:
 *   - Fator carga PIORA previsoes (ruido > sinal)
 *   - Janela 4 supera janela 6 (dados recentes pesam mais)
 *   - Mediana pura: MAPE 32%, ultimos 6m: 13%
 *   - Com fator carga: MAPE 58% (quase 2x pior)
 *
 * NE liquida = entradas - descartes(CsD+reprovada+prescrita)
 */

const { round2, mediana, media } = require('./estatisticas');
const { percentil } = require('./estatisticas');
const coleta = require('./coleta');
const { obterTotalEfetivo, obterCargaEfetiva } = require('./projecao-utils');

const JANELA = 4;

/** Calcula NE liquida: entradas - descartes(CsD+repr+presc) */
function neLiquida(cacheNE, cacheDesc, nomeVersao) {
  const vNE = cacheNE[nomeVersao];
  if (!vNE || !vNE.totais) return null;
  const brutas = vNE.totais.entradasBrutas;
  if (!cacheDesc || !cacheDesc[nomeVersao]) return brutas;
  const desc = cacheDesc[nomeVersao];
  return brutas - (desc.conclSemDev || 0) - (desc.reprovadas || 0) - (desc.prescritas || 0);
}

function preverProximaVersao(versaoAtual, versoesProc, cacheNE, cacheDesc) {
  if (!versaoAtual || !cacheNE) return fallback('Dados indisponiveis');

  const nomes = coleta.listarVersoesEsperadas();
  const idxAtual = nomes.indexOf(versaoAtual.versao);
  if (idxAtual < 0) return fallback('Versao nao encontrada na lista');

  const pares = construirPares(nomes, versoesProc, cacheNE, idxAtual, cacheDesc);
  if (pares.length < 3) return fallback('Menos de 3 pares historicos disponiveis');

  const janela = pares.slice(-JANELA);
  const nesJanela = janela.map(p => p.ne);
  const baselineNE = mediana(nesJanela);

  const prevPontual = Math.round(baselineNE);
  const p25 = percentil(nesJanela, 25);
  const p75 = percentil(nesJanela, 75);
  const intervBaixo = Math.max(0, Math.round(p25));
  const intervAlto = Math.round(p75);

  const mediaRecente = media(nesJanela);
  let risco = 'normal';
  if (mediaRecente > baselineNE * 1.2) risco = 'elevado';
  else if (mediaRecente < baselineNE * 0.8) risco = 'favoravel';

  const bt = executarBacktest(nomes, versoesProc, cacheNE, cacheDesc);
  const usaLiquida = !!cacheDesc;

  return {
    prevPontual, intervalo: { baixo: intervBaixo, alto: intervAlto },
    baselineNE: Math.round(baselineNE), medianaNE: Math.round(baselineNE),
    cargaAtual: obterCargaEfetiva(versaoAtual),
    totalSAAtual: obterTotalEfetivo(versaoAtual),
    risco, usaLiquida,
    explicacao: `Mediana das ultimas ${janela.length} versoes (${Math.round(baselineNE)} NEs`
      + `${usaLiquida ? ' liquidas' : ''}). Calibracao V3: sem fator carga (ruido > sinal).`,
    modelo: {
      tipo: 'mediana_pura_v3', janela: janela.length,
      formula: usaLiquida
        ? 'NE = mediana(entradas - descartes, ultimas 4 versoes)'
        : 'NE = mediana(NE ultimas 4 versoes)',
      calibracao: 'Testadas 16 estrategias em 40 backtests. Mediana pura J=4 venceu com MAPE 32%.'
    },
    backtest: bt, fallbackUsado: false
  };
}

function fallback(motivo) {
  return {
    prevPontual: null, intervalo: null, risco: 'indeterminado',
    explicacao: motivo, modelo: { tipo: 'fallback' },
    backtest: null, fallbackUsado: true
  };
}

function construirPares(nomes, versoesProc, cacheNE, limiteIdx, cacheDesc) {
  const pares = [];
  for (let i = 0; i < limiteIdx; i++) {
    const vSA = versoesProc.find(v => v.versao === nomes[i]);
    const ne = neLiquida(cacheNE, cacheDesc, nomes[i + 1]);
    if (vSA && vSA.totalLiberacoes > 0 && ne !== null) {
      const brutas = cacheNE[nomes[i + 1]].totais.entradasBrutas;
      pares.push({
        versao: nomes[i], ne, neBruta: brutas, carga: vSA.carga.total
      });
    }
  }
  return pares;
}

function executarBacktest(nomes, versoesProc, cacheNE, cacheDesc) {
  const resultados = [];
  for (let i = JANELA; i < nomes.length - 1; i++) {
    const vSA = versoesProc.find(v => v.versao === nomes[i]);
    const realLiq = neLiquida(cacheNE, cacheDesc, nomes[i + 1]);
    if (!vSA || vSA.totalLiberacoes === 0 || realLiq === null) continue;

    const pares = construirPares(nomes, versoesProc, cacheNE, i, cacheDesc);
    if (pares.length < 3) continue;

    const janela = pares.slice(-JANELA);
    const baseNE = mediana(janela.map(p => p.ne));
    const previsto = Math.round(baseNE);
    const real = realLiq;
    const brutas = cacheNE[nomes[i + 1]].totais.entradasBrutas;
    const erroAbs = Math.abs(previsto - real);
    const erroPct = real > 0 ? round2((erroAbs / real) * 100) : 0;
    const direcaoCorreta = (previsto >= baseNE && real >= baseNE)
      || (previsto < baseNE && real < baseNE);

    resultados.push({
      versaoOrigem: nomes[i], versaoAlvo: nomes[i + 1],
      previsto, real, neBruta: brutas, erroAbs, erroPct,
      baseNE: Math.round(baseNE), direcaoCorreta
    });
  }

  if (resultados.length === 0) return { mape: null, resultados: [], qualidade: 'sem_dados' };
  const mape = round2(media(resultados.map(r => r.erroPct)));
  const acertoDirecao = round2(
    resultados.filter(r => r.direcaoCorreta).length / resultados.length * 100
  );
  const rec6 = resultados.slice(-6);
  const mape6m = rec6.length > 0 ? round2(media(rec6.map(r => r.erroPct))) : null;

  const mRef = mape6m != null ? mape6m : mape;
  let qualidade = 'fraca';
  if (mRef <= 15) qualidade = 'boa';
  else if (mRef <= 25) qualidade = 'razoavel';
  else if (mRef <= 35) qualidade = 'aceitavel';

  return {
    mape, mape6m, qualidade, totalTestes: resultados.length, acertoDirecao,
    usaLiquida: !!cacheDesc,
    melhorPrevisao: resultados.reduce((m, r) => r.erroPct < m.erroPct ? r : m, resultados[0]),
    piorPrevisao: resultados.reduce((m, r) => r.erroPct > m.erroPct ? r : m, resultados[0]),
    resultados
  };
}

module.exports = { preverProximaVersao, executarBacktest, neLiquida, JANELA };
