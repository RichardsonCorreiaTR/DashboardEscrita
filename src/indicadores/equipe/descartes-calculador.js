/**
 * descartes-calculador.js - Calculo de tempo medio em PSAIs descartadas
 *
 * Situacoes de descarte (i_psai_situacoes em UP.SAI_PSAI):
 *   5 = Concluido sem Desenvolvimento
 *   6 = Reprovada
 *  23 = Prescrita (automatica)
 *  33 = Sistema Descontinuado
 *
 * Meta: media de (tempo_analise + tempo_definicao) por PSAI <= 300 min
 */

const META_DESCARTES = 300; // minutos
const SITS_DESCARTE = [5, 6, 23, 33];

// rows: [{ i_usuarios, mes, i_psai, total_analise, total_definicao }]
function agruparDescartes(rows) {
  const m = {};
  rows.forEach(r => {
    const uid = r.i_usuarios, mes = r.mes;
    if (!m[uid]) m[uid] = {};
    const k = m[uid][mes] || (m[uid][mes] = { total: 0, qtd: 0 });
    k.total += (Number(r.total_analise) || 0) + (Number(r.total_definicao) || 0);
    k.qtd++;
  });
  return m;
}

function mensalDescartes(mapMes) {
  const mensal = {};
  for (let m = 1; m <= 12; m++) {
    const r = mapMes?.[m];
    if (!r?.qtd) { mensal[m] = null; continue; }
    const media = Math.round(r.total / r.qtd);
    mensal[m] = { media, qtd_psais: r.qtd, atingida: media <= META_DESCARTES };
  }
  return mensal;
}

const META_PCT_DESCARTE = 30; // %

// descartesMapMes: { mes -> qtd } (data da situacao)
// analisesSemSaiMapMes: { mes -> qtd } (PSAIs sem SAI)
function mensalPctDescartes(pontosMapMes, descartesMapMes, analisesSemSaiMapMes) {
  const mensal = {};
  for (let m = 1; m <= 12; m++) {
    const sais = pontosMapMes?.[m]?.qtd_sais || 0;
    const analises = analisesSemSaiMapMes?.[m] || 0;
    const desc = descartesMapMes?.[m] || 0;
    const total = sais + analises;
    if (!total && !desc) { mensal[m] = null; continue; }
    const pct = total > 0 ? Math.round(desc / total * 100) : (desc > 0 ? 100 : 0);
    mensal[m] = { qtd_descartes: desc, qtd_sais: sais, qtd_analises: analises, pct, atingida: pct <= META_PCT_DESCARTE };
  }
  return mensal;
}

module.exports = { agruparDescartes, mensalDescartes, mensalPctDescartes, META_DESCARTES, META_PCT_DESCARTE, SITS_DESCARTE };
