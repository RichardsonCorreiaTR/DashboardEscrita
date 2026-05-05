/**
 * isv-gravidade.js - Indice de gravidade para enriquecer o ISV
 *
 * Calcula contagens e indice de gravidade ponderada a partir de rows
 * de entradas de NE (campo gravidade_ne).
 *
 * Pesos: Critica=3, Grave=2, Normal=1
 * Indice de gravidade: soma_ponderada / total_entradas
 *   (1.0 = todas Normal, 3.0 = todas Critica)
 */

const PESOS = { Critica: 3, Grave: 2, Normal: 1 };

/**
 * Conta gravidade a partir de rows de entradas (com campo gravidade_ne)
 * @param {Object[]} rows - Rows com campo gravidade_ne
 * @returns {{ contagens: Object, ponderado: number, total: number, indice: number }}
 */
function calcularContagens(rows) {
  const contagens = { Critica: 0, Grave: 0, Normal: 0 };
  for (const row of rows) {
    const g = row.gravidade_ne || 'Normal';
    if (contagens[g] !== undefined) contagens[g]++;
    else contagens.Normal++;
  }
  const total = contagens.Critica + contagens.Grave + contagens.Normal;
  const ponderado = contagens.Critica * PESOS.Critica
    + contagens.Grave * PESOS.Grave
    + contagens.Normal * PESOS.Normal;
  const indice = total > 0 ? Math.round((ponderado / total) * 100) / 100 : 1;
  return { contagens, ponderado, total, indice };
}

/**
 * Calcula modificador do ISV baseado na gravidade vs historico.
 * Penaliza versoes com gravidade acima da media historica.
 *
 * @param {number} indiceAtual - Indice de gravidade da versao avaliada
 * @param {number[]} indicesHistorico - Indices de gravidade de versoes anteriores
 * @returns {{ modificador: number, ratio: number, interpretacao: string }}
 */
function calcularModificador(indiceAtual, indicesHistorico) {
  if (!indicesHistorico || indicesHistorico.length < 3 || indiceAtual <= 0) {
    return { modificador: 0, ratio: 1, interpretacao: 'insuficiente' };
  }
  const media = indicesHistorico.reduce((a, b) => a + b, 0) / indicesHistorico.length;
  if (media <= 0) return { modificador: 0, ratio: 1, interpretacao: 'insuficiente' };

  const ratio = Math.round((indiceAtual / media) * 100) / 100;
  let modificador = 0;
  let interpretacao = 'dentro_da_media';

  if (ratio <= 0.85) {
    modificador = 3;
    interpretacao = 'gravidade_leve';
  } else if (ratio <= 0.95) {
    modificador = 1;
    interpretacao = 'gravidade_leve';
  } else if (ratio >= 1.2) {
    modificador = -3;
    interpretacao = 'gravidade_alta';
  } else if (ratio >= 1.05) {
    modificador = -1;
    interpretacao = 'gravidade_elevada';
  }

  return { modificador, ratio, interpretacao };
}

module.exports = { calcularContagens, calcularModificador, PESOS };
