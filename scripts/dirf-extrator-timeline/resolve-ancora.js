/**
 * Resolve âncora narrativa (primeira SAI no critério dentro do corte de cronologia).
 */

const { executar } = require('../../src/core/query-executor');
const decode = require('./decode');
const {
  sqlAncoraDirfEExtrator,
  sqlAncoraSoExtrator,
  sqlAncoraAmplo
} = require('./queries');

function ancoraParaIso(row) {
  if (!row || !row.entrada) return null;
  return decode.isoDia(row.entrada);
}

function montarAncora(r, motivo) {
  const entrada = ancoraParaIso(r);
  if (!entrada) return null;
  return {
    i_psai: r.i_psai,
    i_sai: r.i_sai,
    tipoSAI: String(r.tipoSAI || '').trim(),
    entrada,
    motivo
  };
}

function ancoraSintetica(dataMin, motivo) {
  return {
    i_psai: null,
    i_sai: null,
    tipoSAI: '',
    entrada: dataMin,
    motivo
  };
}

async function resolverAncoraAmplo(dataMin) {
  let rows = await executar(sqlAncoraSoExtrator(dataMin));
  let motivo = 'Modo amplo: primeira SAI com "extrator" no PSAI (no corte cronológico)';
  if (!rows.length) {
    rows = await executar(sqlAncoraAmplo(dataMin));
    motivo = 'Modo amplo: primeira SAI com DIRF ou extrator no PSAI (no corte cronológico)';
  }
  if (!rows.length) return { erro: 'Nenhuma SAI âncora no período do corte.' };
  const ancora = montarAncora(rows[0], motivo);
  if (!ancora) return { erro: 'Data de cadastro da âncora inválida.' };
  return { ancora, amplo: true };
}

async function resolverAncoraEstrito(dataMin) {
  const rows = await executar(sqlAncoraDirfEExtrator(dataMin));
  if (!rows.length) return { estritoVazio: true };
  const ancora = montarAncora(
    rows[0],
    'Primeira SAI com DIRF e extrator no PSAI (no corte cronológico)'
  );
  if (!ancora) return { erro: 'Data de cadastro da âncora inválida.' };
  return { ancora, amplo: false };
}

module.exports = {
  montarAncora,
  ancoraSintetica,
  resolverAncoraAmplo,
  resolverAncoraEstrito
};
