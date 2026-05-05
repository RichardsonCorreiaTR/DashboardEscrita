/**
 * SSCs vinculados ao PSAI (forum_sa_psai) + clientes distintos + quebra por i_ssc_situacoes.
 * Ciclo: dias até Liberação, até Descarte ou em aberto (cadastro PSAI como origem).
 */

const { executar } = require('../../src/core/query-executor');

const BATCH = 40;

function emLotes(ids, n) {
  const u = [...new Set(ids)].filter(Boolean);
  const o = [];
  for (let i = 0; i < u.length; i += n) o.push(u.slice(i, i + n));
  return o;
}

async function buscarAgregadosSsc(iPsais) {
  const map = {};
  for (const lote of emLotes(iPsais, BATCH)) {
    const rows = await executar(`
      SELECT fsp.i_psai,
             COUNT(DISTINCT ssc.i_ssc) AS qtd_ssc,
             COUNT(DISTINCT ssc.i_clientes) AS qtd_clientes_ssc
      FROM bethadba.forum_sa_psai fsp
      JOIN bethadba.ssc ssc ON fsp.i_forum_sa = ssc.i_forum_sa
      WHERE fsp.i_psai IN (${lote.join(',')})
      GROUP BY fsp.i_psai`);
    for (const r of rows) {
      map[r.i_psai] = {
        qtd_ssc: r.qtd_ssc,
        qtd_clientes_ssc: r.qtd_clientes_ssc
      };
    }
  }
  return map;
}

async function buscarSscPorSituacao(iPsais) {
  const map = {};
  for (const lote of emLotes(iPsais, BATCH)) {
    const rows = await executar(`
      SELECT fsp.i_psai, ssc.i_ssc_situacoes,
             COUNT(DISTINCT ssc.i_ssc) AS n_ssc
      FROM bethadba.forum_sa_psai fsp
      JOIN bethadba.ssc ssc ON fsp.i_forum_sa = ssc.i_forum_sa
      WHERE fsp.i_psai IN (${lote.join(',')})
      GROUP BY fsp.i_psai, ssc.i_ssc_situacoes`);
    for (const r of rows) {
      if (!map[r.i_psai]) map[r.i_psai] = [];
      map[r.i_psai].push({ sit: r.i_ssc_situacoes, n: r.n_ssc });
    }
  }
  return map;
}

function formatarSituacoes(lista) {
  if (!lista || !lista.length) return '';
  return lista
    .map(x => {
      const k = x.sit == null ? '—' : String(x.sit);
      return k + '×' + x.n;
    })
    .join('; ');
}

function diasEntre(a, b) {
  if (!a || !b) return null;
  const t0 = new Date(a).getTime();
  const t1 = new Date(b).getTime();
  if (Number.isNaN(t0) || Number.isNaN(t1)) return null;
  return Math.round((t1 - t0) / 86400000);
}

function aplicarCiclo(it) {
  const ent = it.entrada;
  if (!ent) {
    it.ciclo_dias = null;
    it.ciclo_rotulo = '';
    return;
  }
  if (it.status === 'liberada' && it.Liberacao) {
    it.ciclo_dias = diasEntre(ent, it.Liberacao);
    it.ciclo_rotulo = 'até liberação';
    return;
  }
  if (it.status === 'descartada' && it.Descarte) {
    it.ciclo_dias = diasEntre(ent, it.Descarte);
    it.ciclo_rotulo = 'até descarte';
    return;
  }
  it.ciclo_dias = diasEntre(ent, new Date().toISOString());
  it.ciclo_rotulo = 'em aberto (até hoje)';
}

async function enriquecerSscTimeline(itens) {
  const ids = itens.map(i => i.i_psai).filter(Boolean);
  if (!ids.length) return;

  const agg = await buscarAgregadosSsc(ids);
  const sit = await buscarSscPorSituacao(ids);

  for (const it of itens) {
    const a = agg[it.i_psai];
    if (a) {
      it.qtd_ssc = a.qtd_ssc;
      it.qtd_clientes_ssc = a.qtd_clientes_ssc;
    } else {
      it.qtd_ssc = 0;
      it.qtd_clientes_ssc = 0;
    }
    it.ssc_por_situacao = formatarSituacoes(sit[it.i_psai]);
    aplicarCiclo(it);
  }
}

module.exports = { enriquecerSscTimeline };
