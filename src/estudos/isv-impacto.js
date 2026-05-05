/**
 * isv-impacto.js - Fator "Impacto ao Cliente" para o ISV
 *
 * Combina SSC/NE ratio com gravidade (Critica/Grave) para gerar
 * um modificador de ±8 pts no ISV. Substitui o antigo modificador
 * de gravidade (±3 pts), incorporando dados de SSC vinculadas.
 *
 * Baseado em estudo historico de 49 versoes (2022-2026):
 *   Ratio SSC/NE: P25=3.3, Med=4.7, P75=9.9, P90=15.5
 *   Usa escala logaritmica para amortecer outliers.
 */

const MAX_MODIFICADOR = 8;

/**
 * Calcula SSC/NE ratio e indice composto de impacto
 * @param {number} totalSSC - Total de SSCs vinculadas na versao
 * @param {number} totalNE - Total de NEs da versao
 * @param {number} criticas - Quantidade de NEs Criticas
 * @param {number} graves - Quantidade de NEs Graves
 * @returns {{ ratio: number, logRatio: number, indiceComposto: number }}
 */
function calcularIndice(totalSSC, totalNE, criticas, graves) {
  if (!totalNE || totalNE === 0) {
    return { ratio: 0, logRatio: 0, indiceComposto: 0 };
  }
  const ratio = Math.round((totalSSC / totalNE) * 10) / 10;
  const logRatio = Math.round(Math.log(1 + ratio) * 100) / 100;
  const pesoGravidade = 1 + criticas * 0.3 + graves * 0.15;
  const indiceComposto = Math.round(logRatio * pesoGravidade * 100) / 100;
  return { ratio, logRatio, indiceComposto };
}

/**
 * Calcula o modificador ISV baseado no impacto atual vs historico.
 * Impacto BAIXO (poucas SSCs, poucas criticas) → bonus.
 * Impacto ALTO (muitas SSCs, criticas/graves) → penalidade.
 *
 * @param {{ ratio: number, logRatio: number, indiceComposto: number }} impactoAtual
 * @param {{ ratio: number, logRatio: number, indiceComposto: number }[]} impactosHistorico
 * @returns {{ modificador: number, percentil: number, interpretacao: string }}
 */
function calcularModificador(impactoAtual, impactosHistorico) {
  if (!impactosHistorico || impactosHistorico.length < 3) {
    return { modificador: 0, percentil: 50, interpretacao: 'insuficiente' };
  }

  const vals = impactosHistorico.map(h => h.indiceComposto).sort((a, b) => a - b);
  const n = vals.length;
  const p25 = vals[Math.floor(n * 0.25)];
  const p50 = vals[Math.floor(n * 0.50)];
  const p75 = vals[Math.floor(n * 0.75)];
  const p90 = vals[Math.floor(n * 0.90)];
  const atual = impactoAtual.indiceComposto;

  let rank = 0;
  for (const v of vals) { if (atual >= v) rank++; }
  const percentil = Math.round((rank / n) * 100);

  let modificador = 0;
  let interpretacao = 'medio';

  if (atual <= p25) {
    modificador = MAX_MODIFICADOR;
    interpretacao = 'impacto_baixo';
  } else if (atual <= p50) {
    const frac = (atual - p25) / (p50 - p25 || 1);
    modificador = Math.round((MAX_MODIFICADOR * (1 - frac)) * 10) / 10;
    interpretacao = 'impacto_abaixo_media';
  } else if (atual <= p75) {
    const frac = (atual - p50) / (p75 - p50 || 1);
    modificador = Math.round((-MAX_MODIFICADOR * 0.5 * frac) * 10) / 10;
    interpretacao = 'impacto_acima_media';
  } else {
    const frac = Math.min((atual - p75) / (p90 - p75 || 1), 1);
    modificador = Math.round((-MAX_MODIFICADOR * (0.5 + 0.5 * frac)) * 10) / 10;
    interpretacao = 'impacto_alto';
  }

  return { modificador, percentil, interpretacao };
}

module.exports = { calcularIndice, calcularModificador, MAX_MODIFICADOR };
