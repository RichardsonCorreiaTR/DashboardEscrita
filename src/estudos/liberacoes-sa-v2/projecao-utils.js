/**
 * liberacoes-sa-v2/projecao-utils.js - Helpers de projecao
 *
 * Funcoes utilitarias para obter valores efetivos (projetados quando
 * disponivel, reais caso contrario) de uma versao processada.
 * Evita duplicacao de logica nos modulos de estatistica,
 * correlacao, volatilidade e recomendacoes.
 */

function obterTotalEfetivo(v) {
  return v.totalProjetado != null ? v.totalProjetado : v.totalLiberacoes;
}

function obterCargaEfetiva(v) {
  return v.cargaProjetada != null ? v.cargaProjetada : v.carga.total;
}

function obterPorTipoEfetivo(v) {
  return v.porTipoProjetado || v.porTipo;
}

module.exports = { obterTotalEfetivo, obterCargaEfetiva, obterPorTipoEfetivo };
