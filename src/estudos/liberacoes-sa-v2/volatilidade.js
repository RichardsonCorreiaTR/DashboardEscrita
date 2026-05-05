/**
 * liberacoes-sa-v2/volatilidade.js - Analise de impacto multi-versao
 *
 * Mede se as liberacoes de SA em versao N impactam NE nao apenas
 * em N+1, mas tambem em N+2 e N+3 (efeito cascata).
 *
 * Usa Spearman para cada lag e identifica:
 *   - Lag dominante (onde o impacto e mais forte)
 *   - SAs legais (SAL/SAIL) vs melhorias (SAM) por lag
 *   - Fator de dispersao (quanto do impacto se espalha)
 */

const { spearman, interpretarCorrelacao } = require('./correlacao');
const { round2 } = require('../estatisticas-ne');
const coleta = require('./coleta');
const { obterTotalEfetivo, obterCargaEfetiva, obterPorTipoEfetivo } = require('./projecao-utils');

const LAGS = [1, 2, 3];

/**
 * Calcula correlacao SA(N) vs NE(N+lag) para cada lag
 * @param {Array} versoesProc - Versoes processadas com carga
 * @param {Object} cacheNE - Cache do historico NE por versao
 * @param {Object} cacheDesc - Cache de descartes (CsD/repr/presc)
 * @returns {Object} Analise multi-lag
 */
function analisarVolatilidade(versoesProc, cacheNE, cacheDesc) {
  if (!versoesProc || !cacheNE) return null;
  const nomes = coleta.listarVersoesEsperadas();
  const resultado = { lags: [], lagDominante: null, dispersao: 0 };

  for (const lag of LAGS) {
    const pares = construirParesLag(nomes, versoesProc, cacheNE, lag, cacheDesc);
    if (pares.length < 5) {
      resultado.lags.push({
        lag, pares: pares.length, suficiente: false,
        corrTotal: { rho: null, p: null },
        corrCarga: { rho: null, p: null },
        interpretacao: `Insuficiente (${pares.length}/5 pares)`
      });
      continue;
    }

    const y = pares.map(p => p.ne);
    const corrTotal = spearman(pares.map(p => p.totalSA), y);
    const corrCarga = spearman(pares.map(p => p.carga), y);
    const melhor = Math.abs(corrCarga.rho || 0) >= Math.abs(corrTotal.rho || 0)
      ? corrCarga : corrTotal;

    resultado.lags.push({
      lag, pares: pares.length, suficiente: true,
      corrTotal, corrCarga,
      melhorRho: melhor.rho,
      significativa: melhor.p !== null && melhor.p < 0.05,
      interpretacao: interpretarCorrelacao(melhor.rho, melhor.p),
      pontos: pares
    });
  }

  classificarResultado(resultado);
  return resultado;
}

function construirParesLag(nomes, versoesProc, cacheNE, lag, cacheDesc) {
  const pares = [];
  for (let i = 0; i < nomes.length - lag; i++) {
    const vSA = versoesProc.find(v => v.versao === nomes[i]);
    const vNE = cacheNE[nomes[i + lag]];
    const totalEf = vSA ? obterTotalEfetivo(vSA) : 0;
    if (vSA && totalEf > 0 && vNE && vNE.totais) {
      const brutas = vNE.totais.entradasBrutas;
      let liquidas = brutas;
      if (cacheDesc && cacheDesc[nomes[i + lag]]) {
        const d = cacheDesc[nomes[i + lag]];
        liquidas = brutas - (d.conclSemDev || 0) - (d.reprovadas || 0) - (d.prescritas || 0);
      }
      const porTipo = obterPorTipoEfetivo(vSA);
      pares.push({
        versaoOrigem: nomes[i],
        versaoAlvo: nomes[i + lag],
        totalSA: totalEf,
        carga: obterCargaEfetiva(vSA),
        ne: liquidas,
        pctLegal: round2(
          ((porTipo.SAL || 0) + (porTipo.SAIL || 0))
          / totalEf * 100
        )
      });
    }
  }
  return pares;
}

function classificarResultado(resultado) {
  const validos = resultado.lags.filter(l => l.suficiente && l.melhorRho !== null);
  if (validos.length === 0) return;

  const rhoAbs = validos.map(l => ({ lag: l.lag, abs: Math.abs(l.melhorRho) }));
  rhoAbs.sort((a, b) => b.abs - a.abs);
  resultado.lagDominante = rhoAbs[0].lag;

  const somaRho = rhoAbs.reduce((s, r) => s + r.abs, 0);
  if (somaRho > 0 && rhoAbs.length > 1) {
    const pesoLag1 = rhoAbs.find(r => r.lag === 1);
    resultado.dispersao = pesoLag1
      ? round2(1 - (pesoLag1.abs / somaRho))
      : 1;
  }

  resultado.resumo = gerarResumo(resultado);
}

function gerarResumo(resultado) {
  const dom = resultado.lagDominante;
  const disp = resultado.dispersao;
  if (dom === 1 && disp < 0.3) {
    return 'Impacto concentrado na versao seguinte (N+1). Modelo atual e adequado.';
  }
  if (dom === 1 && disp >= 0.3) {
    return `Impacto principal em N+1, mas ${round2(disp * 100)}% se dispersa para N+2/N+3. Considerar modelo multi-lag.`;
  }
  return `Impacto dominante em N+${dom}. O modelo padrao (N+1) pode subestimar efeitos defasados.`;
}

module.exports = { analisarVolatilidade, LAGS };
