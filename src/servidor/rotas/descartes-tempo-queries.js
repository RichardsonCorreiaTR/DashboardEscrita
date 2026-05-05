/**
 * descartes-tempo-queries.js - Queries para estudo Descartes x Tempo GA
 *
 * Cruza PSAIs descartadas com tempo lancado no Gerenciador de Atividades.
 * gaGerenciadorAtividades.i_usuarios = CAST(UDUSUARIOS.CODIGO_SGD AS INT)
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
      CASE WHEN sp.i_sai > 0 THEN
        COALESCE((SELECT SUM(ga.tempo)
          FROM bethadba.gaGerenciadorAtividades ga
          WHERE ga.i_sai = sp.i_sai AND ga.i_usuarios = p.i_responsaveis), 0)
      ELSE 0 END as minutos_lancados
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
