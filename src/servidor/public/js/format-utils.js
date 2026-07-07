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
    return (
      n.includes('ne') || n.includes('sai') || n.includes('ss') || n.includes('vida') ||
      n.includes('sal') || n.includes('sam') || n.includes('validando') ||
      n.includes('performance') || n.includes('esclarecimento') || n.includes('reuni') ||
      n.includes('treinamento') || n.includes('backlog') || n.includes('checando') ||
      n.includes('avaliando') || n.includes('desenvolvendo') || n.includes('incluindo') ||
      n.includes('lendo') || n.includes('controle dos') || n.includes('informativo') ||
      n.includes('e-mail da') || n.includes('gp - testes')
    );
  }

  const OUTRAS_SIMPLES = [
    '**', 'interrompida', 'pessoal', 'lanche', 'manuten', 'feedback', 'formata',
    'recepcionar', 'retrospectiva', 'legisla', 'my time', 'mytime',
    'atendimento a unidade', '1:1', 'checkin', 'workshop', 'town hall',
    'particular', 'afastamento', 'banco de horas'
  ];

  function isOutrasAtividades(nome) {
    const n = nome.toLowerCase();
    if (OUTRAS_SIMPLES.some(p => n.includes(p))) return true;
    if (n.includes('treinamento') && (n.includes('receb') || n.includes('participando'))) return true;
    if (n.includes('esclarecimento') && (n.includes('suporte') || n.includes('rh'))) return true;
    if (n.includes('reuni') && n.length <= 12) return true;
    return n.includes('reuni') && (n.includes('rh') || n.includes('apresenta'));
  }

  function isPrincipalAnalista(nome) {
    const n = nome.toLowerCase();
    const temTipo = n.includes('sal') || n.includes('sail') || n.includes('sam') ||
      n.includes('ne') || n.includes('importa') || n.includes('testando');
    if (n.includes('analisando') && temTipo) return true;
    if (n.includes('definindo')) return true;
    if (n.includes('sai') && n.includes('revis') && !n.includes('especialista')) return true;
    if (n.includes('sai') && (n.includes('defin') || n.includes('testes'))) return true;
    if (n.includes('sai - an') && !n.includes('reuni')) return true;
    if (n.includes('reuni') && (n.includes('defin') || n.includes('psai'))) return true;
    return n.includes(' ss') || n.startsWith('ss');
  }

  function isPrincipalQualquer(nome) {
    return isPrincipalAnalista(nome) || (nome.toLowerCase().includes('gerando') && nome.toLowerCase().includes('sai'));
  }

  return { MESES, fmtMin, fmtDecimal, fmtData, corPct, isTrabalho, isOutrasAtividades, isPrincipalAnalista, isPrincipalQualquer };
})();
