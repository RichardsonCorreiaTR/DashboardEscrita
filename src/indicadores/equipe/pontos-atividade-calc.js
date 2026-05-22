/**
 * pontos-atividade-calc.js - Calculo de Pontos Atividade Principal
 *
 * Meta dinamica por mes: se %AtivPrincipal >= 85% → meta = 80 pts
 *                         se %AtivPrincipal <  85% → meta = round(80 * pct / 85)
 */

const META_BASE = 80;
const META_PCT = 85;

function calcularMetaAjustada(pct) {
  if (!pct || pct >= META_PCT) return META_BASE;
  return Math.round(META_BASE * pct / META_PCT);
}

function mensalPontosAtivPrincipal(pontosMapMes, ativPrincipalMensal) {
  const mensal = {};
  for (let m = 1; m <= 12; m++) {
    const row = pontosMapMes ? pontosMapMes[m] : null;
    if (!row) { mensal[m] = null; continue; }
    const pontos = Number(row.pontos) || 0;
    const pct = ativPrincipalMensal?.[m]?.pct || 0;
    const meta = calcularMetaAjustada(pct);
    mensal[m] = {
      pontos, qtd_sais: row.qtd_sais || 0,
      pct_atividade: pct, meta_ajustada: meta,
      atingida: pontos >= meta
    };
  }
  return mensal;
}

module.exports = { mensalPontosAtivPrincipal, calcularMetaAjustada, META_BASE, META_PCT };
