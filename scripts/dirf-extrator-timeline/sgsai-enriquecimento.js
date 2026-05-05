/**
 * SGSAI: psai, modulos, psai_tramites e agregados de feedback_sa (voz do cliente).
 * feedback_sa: milhões de linhas — sempre filtrar por i_sai IN (...) e entrada >= data jornada.
 */

const { sgsaiHabilitadoNaConfig, executarSgsai } = require('../../src/core/conexao-sgsai');

const LOTE = 90;
const LOTE_SAI = 80;

function emLotes(ids, tamanho) {
  const u = [...new Set(ids)].filter(Boolean);
  const out = [];
  for (let i = 0; i < u.length; i += tamanho) out.push(u.slice(i, i + tamanho));
  return out;
}

function sqlPsaiModulo(lista) {
  return `
  SELECT p.i_psai, p.entrada AS entrada_psai_sgsai, p.ultima_modificacao AS ultima_modif_psai,
         m.nome AS nome_modulo
  FROM bethadba.psai p
  LEFT JOIN bethadba.modulos m
    ON m.i_sistemas = p.i_modulos_sistema AND m.i_modulos = p.i_modulos
  WHERE p.i_psai IN (${lista.join(',')})`;
}

function sqlTramites(lista) {
  return `
  SELECT i_psai, COUNT(*) AS qtd_tramites_psai
  FROM bethadba.psai_tramites
  WHERE i_psai IN (${lista.join(',')})
  GROUP BY i_psai`;
}

function sqlFeedbackAgg(listaSai, dataMin) {
  return `
  SELECT i_sai, COUNT(*) AS qtd_feedback_sa,
         MIN(entrada) AS primeiro_feedback,
         MAX(entrada) AS ultimo_feedback
  FROM bethadba.feedback_sa
  WHERE i_sai IN (${listaSai.join(',')})
    AND i_sai IS NOT NULL
    AND entrada >= '${dataMin}'
  GROUP BY i_sai`;
}

async function enriquecerPorPsais(iPsais) {
  const avisoNaoConfig =
    'SGSAI não habilitado em config/conexao.json — módulo, trâmites e feedback não foram enriquecidos.';

  if (!sgsaiHabilitadoNaConfig()) {
    return { porPsai: {}, ok: false, aviso: avisoNaoConfig };
  }

  const porPsai = {};
  const lotes = emLotes(iPsais, LOTE);

  try {
    for (const lote of lotes) {
      const rowsP = await executarSgsai(sqlPsaiModulo(lote));
      if (!rowsP) {
        return {
          porPsai: {},
          ok: false,
          aviso: 'Falha ao consultar SGSAI (psai). Verifique DSN e permissões.'
        };
      }
      for (const r of rowsP) {
        porPsai[r.i_psai] = {
          nome_modulo: r.nome_modulo || null,
          entrada_psai_sgsai: r.entrada_psai_sgsai,
          ultima_modif_psai: r.ultima_modif_psai
        };
      }

      const rowsT = await executarSgsai(sqlTramites(lote));
      if (rowsT) {
        for (const r of rowsT) {
          if (!porPsai[r.i_psai]) porPsai[r.i_psai] = {};
          porPsai[r.i_psai].qtd_tramites_psai = r.qtd_tramites_psai;
        }
      }
    }
    return { porPsai, ok: true, aviso: null };
  } catch (e) {
    console.error('[sgsai-enriquecimento]', e.message);
    return { porPsai: {}, ok: false, aviso: 'Erro SGSAI: ' + e.message };
  }
}

async function enriquecerFeedbackPorSais(iSais, dataMin) {
  const vazio = { porSai: {}, total: 0, topList: [] };
  if (!sgsaiHabilitadoNaConfig() || !iSais.length) return vazio;

  const porSai = {};
  let total = 0;

  try {
    for (const lote of emLotes(iSais, LOTE_SAI)) {
      const rows = await executarSgsai(sqlFeedbackAgg(lote, dataMin));
      if (!rows) return { ...vazio, erro: 'Falha ao ler feedback_sa' };
      for (const r of rows) {
        const q = Number(r.qtd_feedback_sa) || 0;
        porSai[r.i_sai] = {
          qtd: q,
          primeiro: r.primeiro_feedback,
          ultimo: r.ultimo_feedback
        };
        total += q;
      }
    }

    const topList = Object.entries(porSai)
      .map(([k, v]) => ({
        i_sai: Number(k),
        qtd: v.qtd,
        primeiro: v.primeiro,
        ultimo: v.ultimo
      }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 12);

    return { porSai, total, topList };
  } catch (e) {
    console.error('[sgsai-feedback]', e.message);
    return { ...vazio, erro: e.message };
  }
}

function aplicarMapa(itens, porPsai) {
  for (const it of itens) {
    const x = porPsai[it.i_psai];
    if (!x) continue;
    it.nome_modulo = x.nome_modulo;
    it.qtd_tramites_psai = x.qtd_tramites_psai;
    it.entrada_psai_sgsai = x.entrada_psai_sgsai;
    it.ultima_modif_psai = x.ultima_modif_psai;
  }
}

function aplicarFeedback(itens, porSai) {
  for (const it of itens) {
    const f = porSai[it.i_sai];
    if (!f) continue;
    it.qtd_feedback_sa = f.qtd;
    it.primeiro_feedback = f.primeiro;
    it.ultimo_feedback = f.ultimo;
  }
}

module.exports = {
  enriquecerPorPsais,
  enriquecerFeedbackPorSais,
  aplicarMapa,
  aplicarFeedback
};
