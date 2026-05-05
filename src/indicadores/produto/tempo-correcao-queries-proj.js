/**
 * tempo-correcao-queries-proj.js - Queries de projecao (SAIs pendentes)
 *
 * Complementa tempo-correcao-queries.js incluindo SAIs ainda nao liberadas:
 *   - Commitadas: nomeVersao = versao, Liberacao IS NULL (dev concluido)
 *   - Arquivo pendente: nomeVersao LIKE anterior.%, Liberacao IS NULL
 *   - Alocadas: i_versoes da versao, nomeVersao IS NULL (em desenvolvimento)
 *
 * Usado por: tempo-correcao-ne.js
 */

const versaoUtil = require('../../core/versao');

function filtroPendentes(v) {
  const p = versaoUtil.padraoArquivoVersao(v);
  const partes = [`sp.nomeVersao = '${v}'`];
  if (p) partes.push(`sp.nomeVersao LIKE '${p}'`);
  partes.push(
    `(sp.i_versoes IN (SELECT DISTINCT sp2.i_versoes FROM UP.SAI_PSAI sp2`
    + ` WHERE sp2.nomeVersao = '${v}' AND sp2.nomeArea = 'Escrita')`
    + ` AND sp.nomeVersao IS NULL)`
  );
  return `(${partes.join(' OR ')})`;
}

function categoriaCase(v) {
  const p = versaoUtil.padraoArquivoVersao(v);
  let sql = `CASE WHEN sp.nomeVersao = '${v}' THEN 'commitada'`;
  if (p) sql += ` WHEN sp.nomeVersao LIKE '${p}' THEN 'arquivo-pendente'`;
  sql += ` ELSE 'alocada' END`;
  return sql;
}

function querySaisPendentes(v) {
  return `
    SELECT sp.tipoSAI, ${categoriaCase(v)} as categoria, COUNT(*) as total
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE sp.nomeArea = 'Escrita'
      AND ${filtroPendentes(v)}
      AND sp.Liberacao IS NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
    GROUP BY sp.tipoSAI, ${categoriaCase(v)}
  `;
}

function queryTempoDevPendente(v) {
  return `
    SELECT
      SUM(rd.tempo_realizado) as dev_total,
      SUM(CASE WHEN sp.tipoSAI = 'NE'
        THEN rd.tempo_realizado ELSE 0 END) as dev_ne
    FROM bethadba.sai_roteiro_desenvolvimento rd
    JOIN UP.SAI_PSAI sp ON rd.i_sai = sp.i_sai
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE rd.data_exclusao IS NULL
      AND sp.nomeArea = 'Escrita' AND ${filtroPendentes(v)}
      AND sp.Liberacao IS NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND sp.i_sai > 0
  `;
}

function queryTempoTestePendente(v) {
  return `
    SELECT
      SUM(rt.tempo_teste_realizado) as teste_total,
      SUM(rt.tempo_preparacao_realizado) as prep_total,
      SUM(CASE WHEN sp.tipoSAI = 'NE'
        THEN rt.tempo_teste_realizado ELSE 0 END) as teste_ne,
      SUM(CASE WHEN sp.tipoSAI = 'NE'
        THEN rt.tempo_preparacao_realizado ELSE 0 END) as prep_ne
    FROM bethadba.sai_roteiro_testes rt
    JOIN UP.SAI_PSAI sp ON rt.i_sai = sp.i_sai
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE rt.data_exclusao IS NULL
      AND sp.nomeArea = 'Escrita' AND ${filtroPendentes(v)}
      AND sp.Liberacao IS NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND sp.i_sai > 0
  `;
}

function queryDetalheDevPendente(v) {
  return `
    SELECT sp.i_sai, sp.i_psai, sp.tipoSAI, sp.nomeVersao,
           ${categoriaCase(v)} as categoria,
           COALESCE(SUM(rd.tempo_realizado), 0) as dev
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    LEFT JOIN bethadba.sai_roteiro_desenvolvimento rd
      ON rd.i_sai = sp.i_sai AND rd.data_exclusao IS NULL
    WHERE sp.nomeArea = 'Escrita'
      AND ${filtroPendentes(v)}
      AND sp.Liberacao IS NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND sp.i_sai > 0
    GROUP BY sp.i_sai, sp.i_psai, sp.tipoSAI, sp.nomeVersao
  `;
}

function queryDetalheTestePendente(v) {
  return `
    SELECT sp.i_sai,
           COALESCE(SUM(rt.tempo_teste_realizado), 0) as teste,
           COALESCE(SUM(rt.tempo_preparacao_realizado), 0) as prep
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    LEFT JOIN bethadba.sai_roteiro_testes rt
      ON rt.i_sai = sp.i_sai AND rt.data_exclusao IS NULL
    WHERE sp.nomeArea = 'Escrita'
      AND ${filtroPendentes(v)}
      AND sp.Liberacao IS NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND sp.i_sai > 0
    GROUP BY sp.i_sai
  `;
}

module.exports = {
  querySaisPendentes,
  queryTempoDevPendente,
  queryTempoTestePendente,
  queryDetalheDevPendente,
  queryDetalheTestePendente
};
