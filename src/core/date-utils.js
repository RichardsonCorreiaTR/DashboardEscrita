/**
 * date-utils.js - Utilitarios de data robustos para multiplos formatos
 *
 * O banco Sybase retorna datas em formatos variaveis. Este modulo
 * centraliza todo o parsing e formatacao de datas do projeto.
 *
 * Formatos conhecidos do banco:
 * - "2026-02-14" (ISO date)
 * - "2026-02-14 10:30:00" (ISO datetime)
 * - "14/02/2026" (BR date)
 * - "Feb 14 2026" (Sybase default)
 * - Date objects do driver ODBC
 */

/**
 * Faz parse de uma data em qualquer formato conhecido
 * @param {string|Date|null} valor - Valor da data
 * @returns {Date|null} Date valido ou null
 */
function parsearData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;

  const str = String(valor).trim();
  if (!str) return null;

  // ISO: 2026-02-14 ou 2026-02-14T10:30:00
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  // BR: 14/02/2026
  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    const d = new Date(`${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`);
    return isNaN(d.getTime()) ? null : d;
  }

  // Tentativa generica
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formata uma data no padrao brasileiro (dd/mm/yyyy)
 * @param {Date|string|null} valor - Data a formatar
 * @returns {string} Data formatada ou '-'
 */
function formatarBR(valor) {
  const d = parsearData(valor);
  if (!d) return '-';

  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

/**
 * Formata data e hora no padrao brasileiro
 * @param {Date|string|null} valor - Data a formatar
 * @returns {string} Data e hora formatada ou '-'
 */
function formatarBRHora(valor) {
  const d = parsearData(valor);
  if (!d) return '-';

  const data = formatarBR(d);
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${data} ${hora}:${min}`;
}

/**
 * Formata uma data no padrao ISO (yyyy-mm-dd)
 * @param {Date|string|null} valor - Data a formatar
 * @returns {string} Data ISO ou '-'
 */
function formatarISO(valor) {
  const d = parsearData(valor);
  if (!d) return '-';

  return d.toISOString().slice(0, 10);
}

/**
 * Retorna a data/hora atual formatada para logs e timestamps
 * @returns {string} ISO timestamp
 */
function agora() {
  return new Date().toISOString();
}

/**
 * Verifica se uma data esta dentro de um periodo
 * @param {Date|string} data - Data a verificar
 * @param {Date|string} inicio - Inicio do periodo
 * @param {Date|string} fim - Fim do periodo
 * @returns {boolean}
 */
function estaDentroDoPeriodo(data, inicio, fim) {
  const d = parsearData(data);
  const i = parsearData(inicio);
  const f = parsearData(fim);

  if (!d || !i || !f) return false;
  return d >= i && d <= f;
}

/**
 * Retorna o primeiro e ultimo dia do mes atual
 * @returns {{inicio: Date, fim: Date}}
 */
function mesAtual() {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);
  return { inicio, fim };
}

/**
 * Conta dias uteis entre duas datas (exclui sabados e domingos)
 * @param {Date|string} inicio - Data inicio
 * @param {Date|string} fim - Data fim
 * @returns {number} Quantidade de dias uteis (0 se datas invalidas)
 */
function contarDiasUteis(inicio, fim) {
  const di = parsearData(inicio);
  const df = parsearData(fim);
  if (!di || !df || df < di) return 0;

  let count = 0;
  const cursor = new Date(di);
  cursor.setHours(0, 0, 0, 0);
  const limite = new Date(df);
  limite.setHours(0, 0, 0, 0);

  while (cursor <= limite) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

/**
 * Verifica se uma data e dia util (seg-sex)
 * @param {Date|string} data - Data a verificar
 * @returns {boolean}
 */
function eDiaUtil(data) {
  const d = parsearData(data);
  if (!d) return false;
  const dow = d.getDay();
  return dow !== 0 && dow !== 6;
}

/**
 * Dias uteis entre duas datas — mesma logica SQL das metas gerar-sai (Sybase DOW),
 * exclui sab/dom e feriados nacionais (config/feriados.json).
 */
function diasUteisSybase(inicio, fim) {
  const { feriadosNoIntervalo } = require('./feriados');
  const di = parsearData(inicio);
  const df = parsearData(fim);
  if (!di || !df || df < di) return 0;
  const a = new Date(di.getFullYear(), di.getMonth(), di.getDate());
  const b = new Date(df.getFullYear(), df.getMonth(), df.getDate());
  const n = Math.round((b - a) / 86400000);
  const dow = a.getDay() + 1;
  let du = n - Math.floor((n + dow - 2) / 7) - Math.floor((n + dow - 1) / 7);
  du -= feriadosNoIntervalo(inicio, fim);
  return Math.max(0, du);
}

module.exports = {
  parsearData,
  formatarBR,
  formatarBRHora,
  formatarISO,
  agora,
  estaDentroDoPeriodo,
  mesAtual,
  contarDiasUteis,
  eDiaUtil,
  diasUteisSybase
};
