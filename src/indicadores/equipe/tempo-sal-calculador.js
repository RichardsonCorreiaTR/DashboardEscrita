/**
 * tempo-sal-calculador.js - Calculo de tempo medio de analise por tipo de SAI
 *
 * Fonte: bethadba.psai_responsaveis (tempo_analise + tempo_definicao)
 * Todos os niveis sao considerados (sem filtro de nivel).
 * Meta (≤ 800 min) se aplica somente ao tipo SAL.
 * Outros tipos (NE, SAIL, SAM) sao exibidos para acompanhamento.
 */

const META_MIN = 800; // minutos — aplica-se apenas ao SAL

const TIPOS = ['SAL', 'NE', 'SAIL', 'SAM'];

// rows: [{ i_usuarios, i_sai, tipoSAI, mes, total_analise, total_definicao }]
function agruparTempoSal(rows) {
  const m = {};
  rows.forEach(r => {
    const uid = r.i_usuarios, mes = r.mes;
    const tipo = (r.tipoSAI || '').toUpperCase();
    if (!TIPOS.includes(tipo)) return;
    if (!m[uid]) m[uid] = {};
    if (!m[uid][mes]) m[uid][mes] = {};
    const k = tipo.toLowerCase();
    if (!m[uid][mes][k]) m[uid][mes][k] = { total: 0, qtd: 0 };
    const t = (Number(r.total_analise) || 0) + (Number(r.total_definicao) || 0);
    m[uid][mes][k].total += t;
    m[uid][mes][k].qtd++;
  });
  return m;
}

function mediaTipo(bucket) {
  if (!bucket || !bucket.qtd) return null;
  return Math.round(bucket.total / bucket.qtd);
}

function mensalTempoSal(mapMes) {
  const mensal = {};
  for (let m = 1; m <= 12; m++) {
    const r = mapMes?.[m];
    if (!r) { mensal[m] = null; continue; }

    const media_sal = mediaTipo(r.sal);
    const media_ne = mediaTipo(r.ne);
    const media_sail = mediaTipo(r.sail);
    const media_sam = mediaTipo(r.sam);

    const temDados = media_sal != null || media_ne != null || media_sail != null || media_sam != null;
    if (!temDados) { mensal[m] = null; continue; }

    const qtd_sal = r.sal?.qtd || 0;
    const atingida = media_sal != null ? media_sal <= META_MIN : true;

    mensal[m] = {
      media_realizado: media_sal,
      qtd_sais: qtd_sal,
      media_sal, qtd_sal: r.sal?.qtd || 0,
      media_ne,  qtd_ne:  r.ne?.qtd  || 0,
      media_sail, qtd_sail: r.sail?.qtd || 0,
      media_sam, qtd_sam:  r.sam?.qtd  || 0,
      atingida
    };
  }
  return mensal;
}

module.exports = { agruparTempoSal, mensalTempoSal, META_MIN };
