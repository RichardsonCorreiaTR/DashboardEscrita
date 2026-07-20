/**
 * ss-respondidas-utils.js - Helpers da rota SS Respondidas
 */

const { diasUteisSybase, recalcularRegistro } = require('../../core/ss-respondidas-shared');

function mesAtualRef() {
  const now = new Date();
  return { ano: now.getFullYear(), mes: now.getMonth() + 1 };
}

function mesAberto(ano, mes) {
  const { ano: a, mes: m } = mesAtualRef();
  if (ano < a) return false;
  if (ano > a) return true;
  return mes >= m;
}

function gerarResumo(registros) {
  const porMembro = {};
  registros.forEach(r => {
    if (!porMembro[r.nome]) {
      porMembro[r.nome] = { total: 0, ate3du: 0, soma_du: 0, soma_dc: 0 };
    }
    const p = porMembro[r.nome];
    p.total++;
    p.soma_du += r.dias_uteis;
    p.soma_dc += r.dias_corridos;
    if (r.dias_uteis <= 3) p.ate3du++;
  });
  Object.values(porMembro).forEach(p => {
    p.media_du = p.total ? Math.round(p.soma_du / p.total * 10) / 10 : 0;
    p.media_dc = p.total ? Math.round(p.soma_dc / p.total * 10) / 10 : 0;
    p.pct_3du = p.total ? Math.round(p.ate3du / p.total * 100) : 0;
  });
  return porMembro;
}

function mapearRegistros(rows, mapa) {
  const { mapearLinhas } = require('../../core/ss-respondidas-shared');
  return mapearLinhas(rows).map(r => {
    const info = mapa[r.membro_sgd] || { nome: String(r.membro_sgd), senioridade: '-' };
    const perg = mapa[r.pergunta_sgd];
    return {
      i_ss: r.i_ss,
      i_ss_tramites: r.i_ss_tramites,
      i_ss_tramites_resp: r.i_ss_tramites_resp,
      membro_sgd: r.membro_sgd,
      resp_tramite: r.resp_tramite,
      pergunta_sgd: r.pergunta_sgd,
      resp_nome: perg ? perg.nome : String(r.pergunta_sgd || r.resp_tramite),
      nome: info.nome,
      senioridade: info.senioridade,
      mes: r.mes,
      entrada: r.entrada,
      data_resposta: r.data_resposta,
      dias_corridos: r.dias_corridos,
      dias_uteis: r.dias_uteis,
      dentro_3du: r.dias_uteis <= 3
    };
  });
}

module.exports = { diasUteisSybase, mesAtualRef, mesAberto, gerarResumo, mapearRegistros };
