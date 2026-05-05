/**
 * semanas.js - Divisao do periodo de versao em "semanas" proporcionais (S1-S4)
 *
 * Divisao equilibrada:
 * - Total de dias dividido por 4
 * - Dias extras (totalDias % 4) distribuidos de S1 em diante
 * - Diferenca maxima entre qualquer par de semanas = 1 dia
 *
 * Exemplo: versao de 32 dias = S1(8d) S2(8d) S3(8d) S4(8d)   (0 extras)
 * Exemplo: versao de 27 dias = S1(7d) S2(7d) S3(7d) S4(6d)   (3 extras)
 * Exemplo: versao de 29 dias = S1(8d) S2(7d) S3(7d) S4(7d)   (1 extra)
 * Exemplo: versao de 30 dias = S1(8d) S2(8d) S3(7d) S4(7d)   (2 extras)
 */

const { parsearData, contarDiasUteis } = require('../core/date-utils');

/**
 * Divide o periodo de uma versao em 4 semanas proporcionais e equilibradas.
 * Usa timestamps exatos (PIAZZA) nas bordas para evitar perda de NEs.
 * @param {Date|string} inicio - Data de inicio da versao
 * @param {Date|string} fim - Data de fim da versao
 * @returns {{totalDias: number, totalDiasUteis: number, semanas: Array}}
 */
function dividirEmSemanas(inicio, fim) {
  const dtInicio = parsearData(inicio);
  const dtFim = parsearData(fim);

  if (!dtInicio || !dtFim) {
    throw new Error('Datas de inicio/fim invalidas');
  }

  const totalMs = dtFim - dtInicio;
  const totalDias = Math.round(totalMs / (1000 * 60 * 60 * 24));
  const totalDiasUteis = contarDiasUteis(dtInicio, dtFim);
  const diasBase = Math.floor(totalDias / 4);
  const extras = totalDias % 4;

  const semanas = [];
  let cursor = new Date(dtInicio);

  for (let i = 0; i < 4; i++) {
    const semInicio = new Date(cursor);
    const diasSemana = diasBase + (i < extras ? 1 : 0);
    const semFim = (i === 3) ? new Date(dtFim) : new Date(cursor);
    if (i < 3) semFim.setDate(semFim.getDate() + diasSemana);

    const dias = Math.round((semFim - semInicio) / (1000 * 60 * 60 * 24));
    const diasUteis = contarDiasUteis(semInicio, semFim);

    semanas.push({
      id: `S${i + 1}`,
      inicio: semInicio.toISOString().slice(0, 10),
      fim: semFim.toISOString().slice(0, 10),
      inicioExato: semInicio.toISOString(),
      fimExato: semFim.toISOString(),
      dias,
      diasUteis
    });

    cursor = new Date(semFim);
  }

  return { totalDias, totalDiasUteis, semanas };
}

/**
 * Determina em qual semana uma data cai.
 * Usa timestamps exatos (inicioExato/fimExato) quando disponiveis.
 * @param {Date|string} data - Data a verificar
 * @param {Array} semanas - Array retornado por dividirEmSemanas().semanas
 * @returns {string|null} ID da semana (S1-S4) ou null
 */
function identificarSemana(data, semanas) {
  const dt = parsearData(data);
  if (!dt) return null;

  for (const sem of semanas) {
    const ini = new Date(sem.inicioExato || sem.inicio);
    const fi = new Date(sem.fimExato || sem.fim);
    if (dt >= ini && dt < fi) return sem.id;
  }

  const ultima = semanas[semanas.length - 1];
  const fimUltima = new Date(ultima.fimExato || ultima.fim);
  if (dt.getTime() === fimUltima.getTime()) return ultima.id;

  return null;
}

module.exports = { dividirEmSemanas, identificarSemana };
