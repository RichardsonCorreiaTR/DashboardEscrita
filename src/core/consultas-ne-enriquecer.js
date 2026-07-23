/**
 * consultas-ne-enriquecer.js - Preenche nomeArea em linhas (Ambas / cache legado)
 */
const { COL_NOME_AREA } = require('./consultas-ne');

const BATCH = 80;

/**
 * @param {Function} executor
 * @param {...Array} listas
 */
async function enriquecerNomeArea(executor, ...listas) {
  const rows = listas.flat().filter(r => r && r.i_psai);
  if (!rows.length) return;

  const faltando = rows.filter(r => !r.nomeArea && !r.NOMEAREA);
  if (!faltando.length) return;

  const ids = [...new Set(faltando.map(r => r.i_psai))];
  const map = new Map();

  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const sql = `
      SELECT sai_psai.i_psai, ${COL_NOME_AREA}
      FROM UP.SAI_PSAI sai_psai
      WHERE sai_psai.i_psai IN (${batch.join(',')})
    `;
    const found = await executor.executar(sql);
    for (const r of found) map.set(r.i_psai, r.nomeArea);
  }

  for (const row of rows) {
    if (!row.nomeArea && map.has(row.i_psai)) row.nomeArea = map.get(row.i_psai);
  }
}

module.exports = { enriquecerNomeArea };
