/**
 * ss-respondidas-shared.js - Query e agregacao SS (resposta do membro + D.U.)
 *
 * Usado pela pagina SS Respondidas e pela meta respostas-ss-3d.
 * ss_tramites.i_usuarios = codigo-sgd.
 *
 * Regra: par pergunta->resposta pela situacao do trâmite:
 *   - pergunta = situacao 6 (Aguardando Resposta Gerencia de Produtos) -> data inicial
 *   - resposta = situacao 7 (Respondido Gerencia de Produtos)          -> data final + responsavel
 * Ligacao entre os dois: pergunta.data_resposta = resposta.entrada.
 * Cada ciclo pergunta->resposta e UMA linha (ex.: T3->T5 e T6->T8 = 2 linhas).
 * So mescla respostas que se sobrepoem (analista repergunta antes de responder).
 * Prazo = pergunta.entrada ate resposta.entrada. Exibe nº do trâmite-resposta.
 */

const { diasUteisSybase } = require('./date-utils');

// Situacoes SS (bethadba.ss_situacoes)
const SIT_PERGUNTA_GP = 6; // Aguardando Resposta Gerencia de Produtos
const SIT_RESPOSTA_GP = 7; // Respondido Gerencia de Produtos

const PERGUNTA_JOIN = `JOIN bethadba.ss_tramites perg ON perg.i_ss = st.i_ss
  AND perg.i_usuarios <> st.i_usuarios
  AND perg.situacao = ${SIT_PERGUNTA_GP}
  AND perg.data_resposta = st.entrada
  AND perg.i_ss_tramites = (
    SELECT MAX(p2.i_ss_tramites) FROM bethadba.ss_tramites p2
    WHERE p2.i_ss = st.i_ss AND p2.i_usuarios <> st.i_usuarios
      AND p2.situacao = ${SIT_PERGUNTA_GP}
      AND p2.data_resposta = st.entrada
  )`;

function calcularDu(entrada, resposta) {
  return diasUteisSybase(entrada, resposta);
}

function recalcularRegistro(r) {
  if (!r || !r.entrada || !r.data_resposta) return r;
  const du = calcularDu(r.entrada, r.data_resposta);
  r.dias_uteis = du;
  r.dias = du;
  r.dias_corridos = Math.max(0, Math.round(
    (new Date(r.data_resposta) - new Date(r.entrada)) / 86400000
  ));
  return r;
}

function dedupePorPergunta(rows) {
  const map = new Map();
  rows.forEach(r => {
    const key = r.i_ss + '-' + r.i_ss_tramites;
    const cur = map.get(key);
    if (!cur || new Date(r.data_resposta) > new Date(cur.data_resposta)) map.set(key, r);
  });
  return [...map.values()];
}

function colapsarPorAnalista(rows) {
  const sorted = [...rows].sort((a, b) =>
    a.i_ss - b.i_ss ||
    a.membro_sgd - b.membro_sgd ||
    a.pergunta_sgd - b.pergunta_sgd ||
    new Date(a.data_resposta) - new Date(b.data_resposta)
  );
  const out = [];
  let cur = null;
  sorted.forEach(r => {
    const same = cur &&
      cur.i_ss === r.i_ss &&
      cur.membro_sgd === r.membro_sgd &&
      cur.pergunta_sgd === r.pergunta_sgd;
    // Mescla APENAS respostas que se sobrepoem: o analista voltou a perguntar
    // ANTES de o membro responder (mesma resposta fecha varias perguntas).
    // Ciclos distintos (pergunta -> resposta -> NOVA pergunta -> resposta)
    // permanecem como linhas separadas.
    const merge = same && new Date(r.entrada) <= new Date(cur.data_resposta);
    if (!merge) {
      if (cur) out.push(cur);
      cur = { ...r };
      return;
    }
    // Ao mesclar, a resposta final define pergunta+entrada+resposta
    // (entrada = pergunta que a resposta final fechou, NAO o minimo do ciclo).
    if (new Date(r.data_resposta) >= new Date(cur.data_resposta)) {
      cur.entrada = r.entrada;
      cur.pergunta_sgd = r.pergunta_sgd;
      cur.data_resposta = r.data_resposta;
      cur.i_ss_tramites_resp = r.i_ss_tramites_resp;
      cur.mes = r.mes;
    }
  });
  if (cur) out.push(cur);
  return out.map(r => {
    r.i_ss_tramites = r.i_ss_tramites_resp;
    return r;
  });
}

function querySsEnvolvimento(codigoSgdList, ano, mes) {
  const ids = codigoSgdList.join(', ');
  const filtroMes = mes ? `AND MONTH(st.entrada) = ${mes}` : '';
  return `
    SELECT st.i_ss,
      perg.i_ss_tramites,
      st.i_ss_tramites as i_ss_tramites_resp,
      st.i_usuarios as membro_sgd,
      st.i_usuarios as resp_tramite,
      perg.i_usuarios as pergunta_sgd,
      perg.entrada as entrada,
      st.entrada as data_resposta,
      MONTH(st.entrada) as mes
    FROM bethadba.ss_tramites st
    JOIN bethadba.ss s ON st.i_ss = s.i_ss
    ${PERGUNTA_JOIN}
    WHERE st.i_usuarios IN (${ids})
      AND st.situacao = ${SIT_RESPOSTA_GP}
      AND YEAR(st.entrada) = ${ano}
      ${filtroMes}
      AND COALESCE(s.i_produto_grupo, 1) = 1
    ORDER BY st.i_ss ASC, st.i_ss_tramites ASC
  `;
}

function mapearLinhas(rows) {
  return colapsarPorAnalista(dedupePorPergunta(rows)).map(r => recalcularRegistro({
    i_ss: r.i_ss,
    i_ss_tramites: r.i_ss_tramites,
    i_ss_tramites_resp: r.i_ss_tramites_resp,
    membro_sgd: r.membro_sgd,
    resp_tramite: r.resp_tramite,
    pergunta_sgd: r.pergunta_sgd,
    mes: r.mes,
    entrada: r.entrada,
    data_resposta: r.data_resposta,
    dias_corridos: 0,
    dias_uteis: 0,
    dias: 0
  }));
}

function agruparPorMembroMes(registros) {
  const m = {};
  registros.forEach(raw => {
    const r = recalcularRegistro({ ...raw });
    const sgd = r.membro_sgd;
    if (!m[sgd]) m[sgd] = {};
    if (!m[sgd][r.mes]) m[sgd][r.mes] = { total_respostas: 0, dentro_3d: 0, soma_du: 0 };
    const row = m[sgd][r.mes];
    row.total_respostas++;
    row.soma_du += r.dias_uteis;
    if (r.dias_uteis <= 3) row.dentro_3d++;
    row.media_dias = Math.round(row.soma_du / row.total_respostas * 10) / 10;
  });
  return m;
}

function filtrarMembroMes(registros, sgd, mes) {
  return registros
    .filter(r => r.membro_sgd === sgd && r.mes === mes)
    .map(r => recalcularRegistro({ ...r }))
    .sort((a, b) => a.i_ss - b.i_ss || a.i_ss_tramites - b.i_ss_tramites);
}

module.exports = {
  diasUteisSybase, recalcularRegistro, querySsEnvolvimento,
  mapearLinhas, agruparPorMembroMes, filtrarMembroMes, dedupePorPergunta, colapsarPorAnalista
};
