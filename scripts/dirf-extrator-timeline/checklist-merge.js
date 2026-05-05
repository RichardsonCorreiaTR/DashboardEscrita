/**
 * Checklist fixa de PSAIs (Extrator DIRF): merge com a lista filtrada por tema.
 */

const fs = require('fs');
const path = require('path');

const CHECKLIST_PATH = path.join(__dirname, '..', '..', 'config', 'dirf-extrator-checklist.json');

const { normalizarParesExpectativa } = require('./validacao-extrator');

function carregarChecklistConfig() {
  try {
    const j = JSON.parse(fs.readFileSync(CHECKLIST_PATH, 'utf8'));
    const rawIds = j.psais || [];
    const idsPsais = [...new Set(rawIds.map(Number).filter(n => Number.isInteger(n) && n > 0))];
    let pares = normalizarParesExpectativa(j.pares);
    if (!pares.length && idsPsais.length) {
      pares = idsPsais.map(i_psai => ({ i_psai, i_sai: null }));
    }
    const idsPares = [...new Set(pares.map(p => p.i_psai))];
    const ids = [...new Set([...idsPsais, ...idsPares])].sort((a, b) => a - b);
    return {
      ids,
      pares,
      titulo: j.titulo || 'Checklist Extrator DIRF',
      ok: true
    };
  } catch (e) {
    return { ids: [], pares: [], titulo: '', ok: false, erro: String(e.message) };
  }
}

function chaveRow(r) {
  return `${r.i_psai}:${r.i_sai}`;
}

function ultimaLinhaPorPsai(rows) {
  const m = new Map();
  for (const r of rows) {
    const id = r.i_psai;
    const prev = m.get(id);
    if (!prev || new Date(r.entrada) > new Date(prev.entrada)) m.set(id, r);
  }
  return [...m.values()];
}

function mesclarLinhaTempoComChecklist(rowsMain, rowsChecklistBrutos, idsChecklist) {
  const setCheck = new Set(idsChecklist);
  const merged = new Map();

  for (const r of rowsMain) {
    const k = chaveRow(r);
    merged.set(k, {
      ...r,
      somente_checklist: false,
      checklist_solicitacao: setCheck.has(r.i_psai)
    });
  }

  const checkDedup = ultimaLinhaPorPsai(rowsChecklistBrutos);
  for (const r of checkDedup) {
    const k = chaveRow(r);
    if (!merged.has(k)) {
      merged.set(k, {
        ...r,
        somente_checklist: true,
        checklist_solicitacao: setCheck.has(r.i_psai)
      });
    } else {
      const row = merged.get(k);
      row.checklist_solicitacao = row.checklist_solicitacao || setCheck.has(r.i_psai);
    }
  }

  const arr = [...merged.values()].sort(
    (a, b) => new Date(a.entrada).getTime() - new Date(b.entrada).getTime()
  );
  const temPsai = new Set(arr.map(x => x.i_psai));
  const faltando = idsChecklist.filter(id => !temPsai.has(id));
  return { rows: arr, faltando, totalChecklist: idsChecklist.length };
}

module.exports = { carregarChecklistConfig, mesclarLinhaTempoComChecklist };
