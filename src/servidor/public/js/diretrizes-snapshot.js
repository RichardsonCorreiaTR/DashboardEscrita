/**
 * diretrizes-snapshot.js - Cache de sessao por versao + area
 */
/* eslint-disable no-unused-vars */
const DiretrizesSnapshot = (() => {
  const AREAS = ['Escrita', 'Importacao', 'Ambas'];
  /** @type {Map<string, Object>} */
  const store = new Map();

  function chave(versao, area) {
    return `${versao || 'auto'}@${area || 'Escrita'}`;
  }

  function temNomeArea(resultados) {
    const mov = resultados?.['saldo-ne']?.detalhes?.movimentacao;
    if (!mov) return false;
    const rows = [...(mov.entradas || []), ...(mov.descartes || []), ...(mov.liberadas || [])];
    return rows.some(r => r?.nomeArea);
  }

  function valido(area, payload) {
    if (area !== 'Ambas' || !payload?.resultados) return true;
    const mov = payload.resultados['saldo-ne']?.detalhes?.movimentacao;
    if (!mov) return true;
    const total = (mov.entradas?.length || 0) + (mov.descartes?.length || 0) + (mov.liberadas?.length || 0);
    if (total === 0) return true;
    return temNomeArea(payload.resultados);
  }

  function salvar(versao, area, payload) {
    if (!payload?.resultados || !valido(area, payload)) return;
    store.set(chave(versao, area), payload);
  }

  function obter(versao, area) {
    const snap = store.get(chave(versao, area));
    if (snap && !valido(area, snap)) {
      store.delete(chave(versao, area));
      return null;
    }
    return snap || null;
  }

  function tem(versao, area) {
    return obter(versao, area) != null;
  }

  function remover(versao, area) {
    store.delete(chave(versao, area));
  }

  function limparVersao(versao) {
    for (const area of AREAS) store.delete(chave(versao, area));
  }

  function prefetch(API, versao, areaAtual, opcoes = {}) {
    for (const area of AREAS) {
      if (area === areaAtual || tem(versao, area)) continue;
      API.calcularTodos(versao, { ...opcoes, area, force: opcoes.force || false })
        .then(dados => salvar(versao, area, dados))
        .catch(() => {});
    }
  }

  return { salvar, obter, tem, remover, limparVersao, prefetch, valido, AREAS };
})();
