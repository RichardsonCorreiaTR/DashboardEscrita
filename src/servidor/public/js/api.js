/**
 * api.js - Cliente HTTP para comunicacao com a API REST
 *
 * Encapsula todas as chamadas fetch ao backend.
 * Suporta force (bypass cache) e fonte=cache (dados offline).
 */

/* eslint-disable no-unused-vars */
const API = (() => {
  const BASE = '/api';

  async function get(rota, timeoutMs) {
    const opts = {};
    if (timeoutMs) {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), timeoutMs);
      opts.signal = ctrl.signal;
    }
    const resp = await fetch(`${BASE}${rota}`, opts);
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.erro || `Erro HTTP ${resp.status}`);
    }
    return resp.json();
  }

  /** Versao atual com timeout curto (5s) para nao travar se ODBC offline */
  function obterVersaoAtual() { return get('/versao/atual', 5000); }
  function obterDatasVersao(nome) { return get(`/versao/${nome}/datas`); }
  function listarIndicadores() { return get('/indicadores'); }

  /**
   * Calcula todos os indicadores
   * @param {string} versao - Nome da versao
   * @param {Object} [opcoes] - { force: bool, fonte: 'cache'|undefined }
   */
  function calcularTodos(versao, opcoes = {}) {
    const params = new URLSearchParams();
    if (versao) params.set('versao', versao);
    if (opcoes.force) params.set('force', '1');
    if (opcoes.fonte) params.set('fonte', opcoes.fonte);
    if (opcoes.area && opcoes.area !== 'Escrita') params.set('area', opcoes.area);
    const qs = params.toString();
    return get(`/indicadores/todos${qs ? '?' + qs : ''}`);
  }

  function calcularUm(id, versao, force) {
    const params = new URLSearchParams();
    if (versao) params.set('versao', versao);
    if (force) params.set('force', '1');
    const qs = params.toString();
    return get(`/indicadores/${id}${qs ? '?' + qs : ''}`);
  }

  function obterHistorico(id, limite) {
    const query = limite ? `?limite=${limite}` : '';
    return get(`/historico/${id}${query}`);
  }

  function obterTendencia(id) { return get(`/historico/${id}/tendencia`); }

  return {
    obterVersaoAtual, obterDatasVersao, listarIndicadores,
    calcularTodos, calcularUm, obterHistorico, obterTendencia
  };
})();
