/**
 * format-utils.js - Funcoes de formatacao compartilhadas (equipes)
 *
 * Evita duplicacao de helpers entre equipes-mensal.js e equipes-detalhe.js.
 * Carregar ANTES dos modulos que dependem dele.
 */

/* eslint-disable no-unused-vars */
const FormatUtils = (() => {
  const MESES = ['', 'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio',
    'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  function fmtMin(m) {
    if (m == null) return '-';
    return m >= 60
      ? Math.floor(m / 60) + 'h' + (m % 60 > 0 ? String(m % 60).padStart(2, '0') : '')
      : m + 'min';
  }

  function fmtDecimal(v) { return v.toFixed(2).replace('.', ','); }

  function fmtData(d) {
    if (!d) return '-';
    const s = String(d);
    return s.length >= 10 ? s.substring(8, 10) + '/' + s.substring(5, 7) : s;
  }

  function corPct(p) {
    return p >= 80 ? 'var(--verde)' : p >= 60 ? 'var(--amarelo)' : 'var(--vermelho)';
  }

  function isTrabalho(nome) {
    const n = nome.toLowerCase();
    return n.includes('ne') || n.includes('sai') || n.includes('ss') || n.includes('vida') ||
      n.includes('sal') || n.includes('sam');
  }

  return { MESES, fmtMin, fmtDecimal, fmtData, corPct, isTrabalho };
})();
