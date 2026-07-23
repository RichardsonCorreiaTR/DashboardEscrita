/**
 * idade-sal.js - SALs no saldo com mais de 140 dias (equivalente ne-95-dias)
 */
const versao = require('../../core/versao');
const { condAreaNE, condNeExterna, COL_NOME_AREA } = require('../../core/consultas-ne');
const { enriquecerNomeArea } = require('../../core/consultas-ne-enriquecer');

const LIMITE_DIAS = 140;

function queryTotal(nomeVersao, area = 'Escrita') {
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT COUNT(*) as qtd
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE ${condAreaNE(area)}
      AND sai_psai.tipoSAI = 'SAL'
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (COALESCE(sai_psai.Liberacao, '3000-12-01') > ${fim})
      AND (COALESCE(sai_psai.Descarte, '3000-12-01') > ${fim})
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      ${condNeExterna()}
      AND DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) > ${LIMITE_DIAS}
  `;
}

function queryFaixas(nomeVersao, area = 'Escrita') {
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT
      CASE
        WHEN DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) BETWEEN 141 AND 180 THEN '141-180d'
        WHEN DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) BETWEEN 181 AND 365 THEN '181-365d'
        WHEN DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) > 365 THEN '+365d'
      END as faixa,
      COUNT(*) as qtd
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE ${condAreaNE(area)}
      AND sai_psai.tipoSAI = 'SAL'
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (COALESCE(sai_psai.Liberacao, '3000-12-01') > ${fim})
      AND (COALESCE(sai_psai.Descarte, '3000-12-01') > ${fim})
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      ${condNeExterna()}
      AND DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) > ${LIMITE_DIAS}
    GROUP BY
      CASE
        WHEN DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) BETWEEN 141 AND 180 THEN '141-180d'
        WHEN DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) BETWEEN 181 AND 365 THEN '181-365d'
        WHEN DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) > 365 THEN '+365d'
      END
    ORDER BY faixa
  `;
}

function queryTopAntigas(nomeVersao, area = 'Escrita') {
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT TOP 10
      sai_psai.i_sai, sai_psai.i_psai, ${COL_NOME_AREA}, sai_psai.gravidade_ne,
      sai_psai.CadastroPSAI, sai_psai.i_sai_situacoes,
      sai_psai.nomeVersao, sai_psai.i_versoes,
      DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) as dias
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE ${condAreaNE(area)}
      AND sai_psai.tipoSAI = 'SAL'
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (COALESCE(sai_psai.Liberacao, '3000-12-01') > ${fim})
      AND (COALESCE(sai_psai.Descarte, '3000-12-01') > ${fim})
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      ${condNeExterna()}
    ORDER BY sai_psai.CadastroPSAI ASC
  `;
}

function queryPorFaixaDetalhe(nomeVersao, diasMin, diasMax, area = 'Escrita') {
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT sai_psai.i_sai, sai_psai.i_psai, ${COL_NOME_AREA}, sai_psai.gravidade_ne,
           sai_psai.CadastroPSAI, sai_psai.i_sai_situacoes,
           sai_psai.nomeVersao, sai_psai.i_versoes,
           DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) as dias
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE ${condAreaNE(area)}
      AND sai_psai.tipoSAI = 'SAL'
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (COALESCE(sai_psai.Liberacao, '3000-12-01') > ${fim})
      AND (COALESCE(sai_psai.Descarte, '3000-12-01') > ${fim})
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      ${condNeExterna()}
      AND DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) BETWEEN ${diasMin} AND ${diasMax}
    ORDER BY sai_psai.CadastroPSAI ASC
  `;
}

function queryPorStatus(nomeVersao, area = 'Escrita') {
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT
      CASE
        WHEN sai_psai.nomeVersao IS NOT NULL THEN 1
        WHEN sai_psai.i_versoes IS NOT NULL AND sai_psai.i_versoes <> 0 THEN 2
        ELSE 3
      END as status_code,
      COUNT(*) as qtd
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE ${condAreaNE(area)}
      AND sai_psai.tipoSAI = 'SAL'
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (COALESCE(sai_psai.Liberacao, '3000-12-01') > ${fim})
      AND (COALESCE(sai_psai.Descarte, '3000-12-01') > ${fim})
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      ${condNeExterna()}
      AND DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) > ${LIMITE_DIAS}
    GROUP BY
      CASE
        WHEN sai_psai.nomeVersao IS NOT NULL THEN 1
        WHEN sai_psai.i_versoes IS NOT NULL AND sai_psai.i_versoes <> 0 THEN 2
        ELSE 3
      END
  `;
}

function determinarSemaforo(qtd, meta) {
  if (meta == null) return 'info';
  if (qtd <= meta) return 'verde';
  if (qtd <= meta * 1.15) return 'amarelo';
  return 'vermelho';
}

module.exports = {
  id: 'idade-sal',
  nome: 'Idade da SAL',
  categoria: 'produto',
  cacheTTL: 30 * 60 * 1000,

  async calcular(executor, opcoes = {}) {
    const nomeVersao = opcoes.versao
      || versao.nomeDaVersao(opcoes.ano || new Date().getFullYear(), opcoes.mes || (new Date().getMonth() + 1));
    const area = opcoes.area || 'Escrita';

    const [totalResult, faixasResult, topResult, recemResult, proximasResult, datas, statusResult] =
      await Promise.all([
        executor.executar(queryTotal(nomeVersao, area)),
        executor.executar(queryFaixas(nomeVersao, area)),
        executor.executar(queryTopAntigas(nomeVersao, area)),
        executor.executar(queryPorFaixaDetalhe(nomeVersao, 141, 180, area)),
        executor.executar(queryPorFaixaDetalhe(nomeVersao, 110, 140, area)),
        versao.obterDatas(executor, nomeVersao),
        executor.executar(queryPorStatus(nomeVersao, area))
      ]);

    if (!totalResult || totalResult.length === 0) {
      return {
        valor: null, meta: null, pct: null, status: 'erro', detalhes: {},
        validacao: { ok: false, registros_lidos: 0, problemas: ['Query retornou vazio'] }
      };
    }

    const fimDate = datas ? new Date(datas.fim) : null;
    const corte = fimDate
      ? new Date(fimDate.getTime() - LIMITE_DIAS * 24 * 60 * 60 * 1000) : null;
    const qtd = totalResult[0].qtd;
    const meta = opcoes.meta ?? null;
    const pct = meta > 0 ? Math.round((qtd / meta) * 100 * 10) / 10 : null;

    const statusRaw = statusResult || [];
    const getQtdStatus = (code) => {
      const row = statusRaw.find(r => Number(r.status_code ?? r.STATUS_CODE) === code);
      return row ? (Number(row.qtd ?? row.QTD) || 0) : 0;
    };

    const listas = [topResult, recemResult, proximasResult].filter(Boolean);
    if (area === 'Ambas') await enriquecerNomeArea(executor, ...listas);

    const ORDEM_FAIXAS = ['141-180d', '181-365d', '+365d'];
    const faixasRaw = faixasResult || [];
    const porFaixa = ORDEM_FAIXAS.map(f => ({
      faixa: f,
      qtd: (faixasRaw.find(r => r.faixa === f) || {}).qtd || 0
    }));

    return {
      valor: qtd, meta, pct, status: determinarSemaforo(qtd, meta),
      detalhes: {
        versao: nomeVersao,
        limite_dias: LIMITE_DIAS,
        tipo_label: 'SAL',
        data_referencia: datas ? datas.fim : null,
        data_corte_95d: corte ? corte.toISOString().split('T')[0] : null,
        por_status: { na_versao: getQtdStatus(1), alocada: getQtdStatus(2), sem_versao: getQtdStatus(3) },
        por_faixa: porFaixa,
        top_10_mais_antigas: topResult || [],
        recem_incluidas: recemResult || [],
        proximas_entrar: proximasResult || []
      },
      validacao: { ok: true, registros_lidos: qtd, registros_usados: qtd, avisos: [] }
    };
  }
};
