/**
 * tempo-sal-calculador.js - Calculo de tempo medio de SAL por nivel
 *
 * Fonte de tempo: bethadba.psai_responsaveis (tempo_analise + tempo_definicao)
 *   - i_usuarios = CODIGO_SGD do analista
 * Fonte de nivel: planilha Excel (campo nivel, coluna 11)
 *
 * Meta aplica-se SOMENTE ao nivel Baixa.
 * SALs de outros niveis sao exibidas no detalhe mas NAO entram na meta.
 */

const META_MIN = 800; // minutos

function isBaixa(nivel) {
  return ['baixa', 'pequena'].includes((nivel || '').toLowerCase().trim());
}

// rows: [{ i_usuarios, i_sai, mes, total_analise, total_definicao, nivel }]
// nivel ja vem enriquecido pelo metas-loader via planilha
function agruparTempoSal(rows) {
  const m = {};
  rows.forEach(r => {
    const uid = r.i_usuarios, mes = r.mes;
    if (!m[uid]) m[uid] = {};
    if (!m[uid][mes]) m[uid][mes] = { realizado_baixa: 0, qtd_baixa: 0, qtd_total: 0 };
    m[uid][mes].qtd_total++;
    if (r.tipoSAI === 'SAL' && isBaixa(r.nivel)) {
      const total = (Number(r.total_analise) || 0) + (Number(r.total_definicao) || 0);
      m[uid][mes].realizado_baixa += total;
      m[uid][mes].qtd_baixa++;
    }
  });
  return m;
}

function mensalTempoSal(mapMes) {
  const mensal = {};
  for (let m = 1; m <= 12; m++) {
    const r = mapMes?.[m];
    if (!r?.qtd_baixa) { mensal[m] = null; continue; }
    const mr = Math.round(r.realizado_baixa / r.qtd_baixa);
    mensal[m] = { media_realizado: mr, qtd_sais: r.qtd_baixa, qtd_total: r.qtd_total, atingida: mr <= META_MIN };
  }
  return mensal;
}

module.exports = { isBaixa, agruparTempoSal, mensalTempoSal, META_MIN };
