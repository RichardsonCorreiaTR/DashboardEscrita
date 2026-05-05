/**
 * Queries para linha do tempo DIRF/Extrator (NE + SA).
 *
 * Cronologia (lista): CadastroPSAI >= data cronologia (padrão 2024-01-01 — inclui marco 2024).
 * TIMELINE_DESDE=YYYY-MM-DD altera o corte.
 * TIMELINE_JORNADA_INTENSA=YYYY-MM-DD = marco narrativo “intensificação” (padrão 2025-10-01).
 *
 * Modos de tema: estrito (dirf e extrator) | amplo — env TIMELINE_FILTRO=amplo
 */

const FILTRO_PRODUTO = `(
  EXISTS (SELECT 1 FROM bethadba.sai sai
    WHERE sai_psai.i_sai = sai.i_sai
    AND (sai.i_produto_grupo IS NULL OR sai.i_produto_grupo = 1))
  OR sai_psai.i_sai = 0)`;

const FILTRO_TEMA_AMPLIO = `(
  LOWER(psai.descricao) LIKE '%dirf%'
  OR LOWER(psai.descricao) LIKE '%extrator%')`;

const FILTRO_TEMA_ESTRITO = `(
  LOWER(psai.descricao) LIKE '%dirf%'
  AND LOWER(psai.descricao) LIKE '%extrator%')`;

const JOIN_SIT = `
  LEFT JOIN bethadba.sai_situacoes sit_sai
    ON sai_psai.i_sai_situacoes = sit_sai.i_sai_situacoes
    AND sit_sai.i_sai_linhas = 1
  LEFT JOIN bethadba.psai_situacoes sit_psai
    ON sai_psai.i_psai_situacoes = sit_psai.i_situacoes`;

/** Corte inferior da lista (inclui PSAI de 2024 no extrator DIRF). */
function dataInicioCronologia() {
  const e = process.env.TIMELINE_DESDE;
  if (e && /^\d{4}-\d{2}-\d{2}/.test(String(e).trim())) return String(e).trim().slice(0, 10);
  return '2024-01-01';
}

/** Marco narrativo “intensificação” (ex.: out/2025) — só rótulo/história, não corta a lista. */
function dataJornadaIntensa() {
  const e = process.env.TIMELINE_JORNADA_INTENSA;
  if (e && /^\d{4}-\d{2}-\d{2}/.test(String(e).trim())) return String(e).trim().slice(0, 10);
  return '2025-10-01';
}

function filtroTema(amplo) {
  return amplo ? FILTRO_TEMA_AMPLIO : FILTRO_TEMA_ESTRITO;
}

function clausulaDesde(dataMin) {
  return `AND sai_psai.CadastroPSAI >= '${dataMin}'`;
}

/** Primeira SAI com DIRF e extrator no período da jornada */
function sqlAncoraDirfEExtrator(dataMin) {
  return `
  SELECT TOP 1 sai_psai.i_psai, sai_psai.i_sai,
         sai_psai.CadastroPSAI as entrada,
         sai_psai.tipoSAI
  FROM UP.SAI_PSAI sai_psai
  JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI IN ('NE','SAM','SAL','SAIL')
    AND sai_psai.i_sai > 0
    AND ${FILTRO_PRODUTO}
    AND ${FILTRO_TEMA_ESTRITO}
    ${clausulaDesde(dataMin)}
  ORDER BY sai_psai.CadastroPSAI ASC, sai_psai.i_sai ASC`;
}

function sqlAncoraSoExtrator(dataMin) {
  return `
  SELECT TOP 1 sai_psai.i_psai, sai_psai.i_sai,
         sai_psai.CadastroPSAI as entrada,
         sai_psai.tipoSAI
  FROM UP.SAI_PSAI sai_psai
  JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI IN ('NE','SAM','SAL','SAIL')
    AND sai_psai.i_sai > 0
    AND ${FILTRO_PRODUTO}
    AND LOWER(psai.descricao) LIKE '%extrator%'
    ${clausulaDesde(dataMin)}
  ORDER BY sai_psai.CadastroPSAI ASC, sai_psai.i_sai ASC`;
}

function sqlAncoraAmplo(dataMin) {
  return `
  SELECT TOP 1 sai_psai.i_psai, sai_psai.i_sai,
         sai_psai.CadastroPSAI as entrada,
         sai_psai.tipoSAI
  FROM UP.SAI_PSAI sai_psai
  JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI IN ('NE','SAM','SAL','SAIL')
    AND sai_psai.i_sai > 0
    AND ${FILTRO_PRODUTO}
    AND ${FILTRO_TEMA_AMPLIO}
    ${clausulaDesde(dataMin)}
  ORDER BY sai_psai.CadastroPSAI ASC, sai_psai.i_sai ASC`;
}

/** Lista completa no período da jornada (sempre desde dataMin, independente da âncora exibida) */
function sqlLinhaTempo(dataMin, amplo) {
  const tema = filtroTema(amplo);
  return `
  SELECT sai_psai.i_psai, sai_psai.i_sai, sai_psai.tipoSAI,
         sai_psai.CadastroPSAI as entrada,
         sai_psai.Liberacao, sai_psai.Descarte,
         sai_psai.nomeVersao, sai_psai.gravidade_ne,
         COALESCE(sit_sai.descricao, sit_psai.descricao) as situacao,
         CAST(psai.descricao AS BINARY) as descricao --allow-blob
  FROM UP.SAI_PSAI sai_psai
  JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
  ${JOIN_SIT}
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI IN ('NE','SAM','SAL','SAIL')
    AND sai_psai.CadastroPSAI >= '${dataMin}'
    AND ${FILTRO_PRODUTO}
    AND ${tema}
  ORDER BY sai_psai.CadastroPSAI ASC, sai_psai.i_psai ASC`;
}

/** PSAIs da checklist: sem filtro de tema na descrição; sem corte de data; permite i_sai = 0. */
function sqlLinhaTempoPorPsaisChecklist(psaiIds) {
  const clean = [...new Set(psaiIds.map(Number))].filter(n => Number.isInteger(n) && n > 0);
  if (!clean.length) return '';
  const inList = clean.join(',');
  return `
  SELECT sai_psai.i_psai, sai_psai.i_sai, sai_psai.tipoSAI,
         sai_psai.CadastroPSAI as entrada,
         sai_psai.Liberacao, sai_psai.Descarte,
         sai_psai.nomeVersao, sai_psai.gravidade_ne,
         COALESCE(sit_sai.descricao, sit_psai.descricao) as situacao,
         CAST(psai.descricao AS BINARY) as descricao --allow-blob
  FROM UP.SAI_PSAI sai_psai
  JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
  ${JOIN_SIT}
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI IN ('NE','SAM','SAL','SAIL')
    AND sai_psai.i_psai IN (${inList})
    AND ${FILTRO_PRODUTO}
  ORDER BY sai_psai.CadastroPSAI ASC, sai_psai.i_psai ASC`;
}

module.exports = {
  dataInicioCronologia,
  dataJornadaIntensa,
  filtroTema,
  sqlAncoraDirfEExtrator,
  sqlAncoraSoExtrator,
  sqlAncoraAmplo,
  sqlLinhaTempo,
  sqlLinhaTempoPorPsaisChecklist
};
