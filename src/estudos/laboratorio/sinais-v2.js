/**
 * sinais-v2.js - Sinais numericos do Liberacoes SA V2
 *
 * Agrega itens brutos do cache V2 via carga.agregarVersao()
 * e extrai features: carga ponderada, volume, % legal, complexidade.
 */

const fs = require('fs');
const path = require('path');
const { round2 } = require('../estatisticas-ne');
const { agregarVersao } = require('../liberacoes-sa-v2/carga');

const CACHE_V2 = path.join(__dirname, '..', '..', '..', 'data', 'cache', 'estudos-liberacoes-sa-v2.json');

function calcularPorVersao() {
  const resultado = {};
  try {
    if (!fs.existsSync(CACHE_V2)) return resultado;
    const raw = JSON.parse(fs.readFileSync(CACHE_V2, 'utf-8'));
    const versoes = raw.versoes || {};
    for (const [nome, dados] of Object.entries(versoes)) {
      const itens = dados.itens || [];
      if (itens.length === 0) continue;
      const ag = agregarVersao(itens);
      const total = ag.totalLiberacoes;
      const sal = (ag.porTipo.SAL || 0) + (ag.porTipo.SAIL || 0);
      resultado[nome] = {
        totalSAs: total,
        carga: round2(ag.carga.total),
        cargaMedia: total > 0 ? round2(ag.carga.total / total) : 0,
        pctLegal: total > 0 ? round2(sal / total) : 0,
        pctAlta: round2((ag.pctAltaComplexidade || 0) / 100),
        desvio: round2((ag.tempos.desvioEstimativa || 0) / 100)
      };
    }
    console.log('[sinais-v2] %d versoes com dados V2', Object.keys(resultado).length);
  } catch (err) {
    console.warn('[sinais-v2] Nao carregou:', err.message);
  }
  return resultado;
}

module.exports = { calcularPorVersao };
