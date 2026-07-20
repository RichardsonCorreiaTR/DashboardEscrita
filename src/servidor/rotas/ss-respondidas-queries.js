/**
 * ss-respondidas-queries.js - Tramites respondidos em SS com envolvimento da equipe
 */

const { querySsEnvolvimento } = require('../../core/ss-respondidas-shared');

function querySsRespondidas(codigoSgdList, ano, mes) {
  return querySsEnvolvimento(codigoSgdList, ano, mes || null);
}

module.exports = { querySsRespondidas };
