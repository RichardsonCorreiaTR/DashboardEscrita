/**
 * Sobrescreve entrada (CadastroPSAI exibido) para pares SAI+PSAI — config/dirf-extrator-overrides.json
 */

const fs = require('fs');
const path = require('path');

const CONFIG = path.join(__dirname, '..', '..', 'config', 'dirf-extrator-overrides.json');

function isoMeioDia(yyyyMmDd) {
  return `${yyyyMmDd}T12:00:00.000Z`;
}

function carregarOverridesEntrada() {
  try {
    const j = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
    return Array.isArray(j.entradas_psai) ? j.entradas_psai : [];
  } catch {
    return [];
  }
}

function combina(ov, it) {
  const saiOk = Number(it.i_sai) === Number(ov.i_sai);
  const psaiOk = ov.i_psai == null || Number(it.i_psai) === Number(ov.i_psai);
  return saiOk && psaiOk && ov.entrada_exibir;
}

function aplicarEmItem(it, ov) {
  const dia = String(ov.entrada_exibir).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return;
  it.entrada_sgd_original = it.entrada;
  it.entrada = isoMeioDia(dia);
  it.entrada_ajuste_manual = ov.nota || 'Data de cadastro PSAI ajustada manualmente para exibição.';
}

function aplicarEmAncora(ancora, ovs) {
  if (!ancora || ancora.i_sai == null) return;
  for (const ov of ovs) {
    if (!combina(ov, ancora)) continue;
    const dia = String(ov.entrada_exibir).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) continue;
    ancora.entrada_sgd_original = ancora.entrada;
    ancora.entrada = dia;
    ancora.entrada_ajuste_manual = ov.nota || null;
    return;
  }
}

function aplicarEntradaOverrides(payload) {
  const ovs = carregarOverridesEntrada();
  if (!ovs.length) return;
  for (const it of payload.itens || []) {
    for (const ov of ovs) {
      if (combina(ov, it)) aplicarEmItem(it, ov);
    }
  }
  aplicarEmAncora(payload.ancora, ovs);
  if (payload.itens && payload.itens.length) {
    payload.itens.sort((a, b) => new Date(a.entrada).getTime() - new Date(b.entrada).getTime());
  }
}

module.exports = { aplicarEntradaOverrides, carregarOverridesEntrada };
