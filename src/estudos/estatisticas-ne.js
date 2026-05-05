/**
 * estatisticas-ne.js - Funcoes estatisticas para analise de NE
 *
 * Utilidades matematicas e calculo de estatisticas agregadas
 * usadas pela analise historica e pelo ISV.
 */

/**
 * Calcula mediana de um array numerico
 * @param {number[]} arr
 * @returns {number}
 */
function mediana(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calcula media aritmetica de um array numerico
 * @param {number[]} arr
 * @returns {number}
 */
function media(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Calcula desvio padrao populacional de um array numerico
 * @param {number[]} arr
 * @returns {number}
 */
function desvioPadrao(arr) {
  if (arr.length < 2) return 0;
  const m = media(arr);
  return Math.sqrt(arr.map(v => (v - m) ** 2).reduce((a, b) => a + b, 0) / arr.length);
}

/** Arredonda para 2 casas decimais */
function round2(v) { return Math.round(v * 100) / 100; }

/**
 * Calcula as entradas acumuladas no mesmo estagio para versoes historicas.
 * Ex: se a versao atual esta na S3 (semanasConcluidas=2), soma S1+S2 das historicas.
 * @param {number} semanasConcluidas - Quantas semanas JA passaram (0-4)
 * @param {Object[]} historico - Versoes historicas completas
 * @returns {number[]} Array de acumulados no mesmo estagio
 */
function acumuladosNoEstagio(semanasConcluidas, historico) {
  if (semanasConcluidas <= 0 || semanasConcluidas > 4) return [];
  return historico
    .filter(v => v.semanas && v.semanas.length >= semanasConcluidas)
    .map(v => {
      if (v.semanas[semanasConcluidas - 1] && v.semanas[semanasConcluidas - 1].acumuladoEntradas !== undefined) {
        return v.semanas[semanasConcluidas - 1].acumuladoEntradas;
      }
      let soma = 0;
      for (let i = 0; i < semanasConcluidas; i++) {
        soma += v.semanas[i].entradasBrutas;
      }
      return soma;
    });
}

/**
 * Calcula estatisticas agregadas de todas as versoes
 * @param {Object[]} versoes - Array de analises semanais
 * @returns {Object} Estatisticas globais
 */
function calcularEstatisticas(versoes) {
  if (versoes.length === 0) return null;

  const entradas = versoes.map(v => v.totais.entradasBrutas);
  const mediasDU = versoes.map(v => v.totais.mediaDiaUtil);
  const mediasDC = versoes.map(v => v.totais.mediaDiaCorrido);
  const descartes = versoes.map(v => v.totais.descartes);

  const dp = desvioPadrao(entradas);
  const m = media(entradas);
  const outliers = versoes.filter(v =>
    Math.abs(v.totais.entradasBrutas - m) > 2 * dp
  ).map(v => v.versao);

  const porSemana = { S1: [], S2: [], S3: [], S4: [] };
  const porSemanaDU = { S1: [], S2: [], S3: [], S4: [] };
  const porSemanaPct = { S1: [], S2: [], S3: [], S4: [] };
  for (const v of versoes) {
    const totalV = v.totais.entradasBrutas;
    for (const s of v.semanas) {
      if (porSemana[s.id]) {
        porSemana[s.id].push(s.entradasBrutas);
        porSemanaDU[s.id].push(s.mediaDiaUtil);
        if (totalV > 0) {
          porSemanaPct[s.id].push(round2((s.entradasBrutas / totalV) * 100));
        }
      }
    }
  }

  const semanasStats = Object.entries(porSemana).map(([id, vals]) => ({
    id,
    media: round2(media(vals)),
    mediana: round2(mediana(vals)),
    min: vals.length > 0 ? Math.min(...vals) : 0,
    max: vals.length > 0 ? Math.max(...vals) : 0,
    desvioPadrao: round2(desvioPadrao(vals)),
    mediaDiaUtil: round2(media(porSemanaDU[id])),
    medianaDiaUtil: round2(mediana(porSemanaDU[id])),
    percentualMedio: round2(media(porSemanaPct[id])),
    percentualMediano: round2(mediana(porSemanaPct[id]))
  }));

  const recentes = versoes.slice(-6);
  const porSemanaRecente = { S1: [], S2: [], S3: [], S4: [] };
  const porSemanaRecenteDU = { S1: [], S2: [], S3: [], S4: [] };
  const porSemanaRecentePct = { S1: [], S2: [], S3: [], S4: [] };
  for (const v of recentes) {
    const totalV = v.totais.entradasBrutas;
    for (const s of v.semanas) {
      if (porSemanaRecente[s.id]) {
        porSemanaRecente[s.id].push(s.entradasBrutas);
        porSemanaRecenteDU[s.id].push(s.mediaDiaUtil);
        if (totalV > 0) {
          porSemanaRecentePct[s.id].push(round2((s.entradasBrutas / totalV) * 100));
        }
      }
    }
  }

  const semanasStatsRecente = Object.entries(porSemanaRecente).map(([id, vals]) => ({
    id,
    media: round2(media(vals)),
    mediana: round2(mediana(vals)),
    mediaDiaUtil: round2(media(porSemanaRecenteDU[id])),
    medianaDiaUtil: round2(mediana(porSemanaRecenteDU[id])),
    percentualMedio: round2(media(porSemanaRecentePct[id])),
    percentualMediano: round2(mediana(porSemanaRecentePct[id]))
  }));

  return {
    totalVersoes: versoes.length,
    entradas: {
      media: round2(media(entradas)),
      mediana: round2(mediana(entradas)),
      min: Math.min(...entradas),
      max: Math.max(...entradas),
      desvioPadrao: round2(dp)
    },
    mediaDiaUtil: {
      media: round2(media(mediasDU)),
      mediana: round2(mediana(mediasDU))
    },
    mediaDiaCorrido: {
      media: round2(media(mediasDC)),
      mediana: round2(mediana(mediasDC))
    },
    descartes: {
      media: round2(media(descartes)),
      mediana: round2(mediana(descartes))
    },
    outliers,
    porSemana: semanasStats,
    porSemanaRecente: semanasStatsRecente
  };
}

module.exports = {
  mediana,
  media,
  desvioPadrao,
  round2,
  acumuladosNoEstagio,
  calcularEstatisticas
};
