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
  const mesAtual = new Date().getMonth() + 1;
  const mensal = {};
  for (let m = 1; m <= 12; m++) {
    const row = pontosMapMes ? pontosMapMes[m] : null;
    const temAtiv = ativPrincipalMensal?.[m] != null;
    // Mes futuro sem dados: mostra vazio
    if (!row && !temAtiv && m >= mesAtual) { mensal[m] = null; continue; }
    // Mes fechado sem pontos: preenche com 0 usando % atividade do mes (se houver)
    const pontos = row ? (Number(row.pontos) || 0) : 0;
    const qtd_sais = row ? (row.qtd_sais || 0) : 0;
    const pct = ativPrincipalMensal?.[m]?.pct || 0;
    const meta = calcularMetaAjustada(pct);
    mensal[m] = {
      pontos, qtd_sais,
      pct_atividade: pct, meta_ajustada: meta,
      atingida: pontos >= meta
    };
  }
  return mensal;
}

module.exports = { mensalPontosAtivPrincipal, calcularMetaAjustada, META_BASE, META_PCT };
