/**
 * descartes-tempo-queries.js - Queries para estudo Descartes x Tempo GA
 *
 * Cruza PSAIs descartadas com tempo registrado em bethadba.psai_responsaveis
 * (tempo_analise + tempo_definicao por PSAI). Fonte: tabela de responsaveis da PSAI.
 */

const FILTRO_AREA = "sp.nomeArea = 'Escrita'";

const MOTIVOS_DESCARTE = {
  4: 'Descartado',
  5: 'CsD',
  6: 'Reprovada',
  23: 'Prescrita',
  24: 'A Estimar Tempo',
  26: 'Lib. Versao Anterior'
};

function queryDescartesTempo(codigoSgdList, ano) {
  const ids = codigoSgdList.join(', ');
  return `
    SELECT
      p.i_responsaveis as i_usuarios,
      sp.i_psai, sp.i_sai,
      sp.Descarte as data_descarte,
      MONTH(sp.Descarte) as mes,
      COALESCE(NULLIF(sp.i_sai_situacoes, 0), sp.i_psai_situacoes) as motivo,
      COALESCE((SELECT SUM(COALESCE(pr.tempo_analise, 0) + COALESCE(pr.tempo_definicao, 0))
        FROM bethadba.psai_responsaveis pr
        WHERE pr.i_psai = sp.i_psai), 0) as minutos_lancados
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE ${FILTRO_AREA} AND sp.tipoSAI = 'NE'
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND sp.Descarte IS NOT NULL
      AND YEAR(sp.Descarte) = ${ano}
      AND p.i_responsaveis IN (${ids})
    ORDER BY sp.Descarte
  `;
}

module.exports = { queryDescartesTempo, MOTIVOS_DESCARTE };
