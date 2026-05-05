/**
 * ne-95-dias.js - Indicador: NEs no saldo com mais de 95 dias
 *
 * Diretriz 1.4.2 (codigo SGD: 143631)
 * Meta 2026: 2 (Escrita Fiscal) - ano inteiro
 *
 * Formula: Dentre as NEs no SALDO da versao, quantas tem
 *          DATEDIFF(CadastroPSAI, FIM_VERSAO) > 95 dias
 *
 * Usa a mesma logica de saldo da versao (JOIN psai, produto_grupo)
 *
 * Doc: docs/diretrizes/1-produto/1.4-controladas-coordenacao/1.4.2-ne-95-dias.md
 */

const versao = require('../../core/versao');

/** Metas mensais Escrita Fiscal 2026 (jan a dez) - meta fixa: 2 */
const METAS_MENSAIS = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
//                    jan fev mar abr mai jun jul ago set out nov dez

function queryTotal(nomeVersao) {
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT COUNT(*) as qtd
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (COALESCE(sai_psai.Liberacao, '3000-12-01') > ${fim})
      AND (COALESCE(sai_psai.Descarte, '3000-12-01') > ${fim})
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) > 95
  `;
}

function queryFaixas(nomeVersao) {
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT
      CASE
        WHEN DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) BETWEEN 96 AND 120 THEN '096-120d'
        WHEN DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) BETWEEN 121 AND 180 THEN '121-180d'
        WHEN DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) BETWEEN 181 AND 365 THEN '181-365d'
        WHEN DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) > 365 THEN '+365d'
      END as faixa,
      COALESCE(sai_psai.NE_PREVENCAO, 0) as NE_PREVENCAO,
      COUNT(*) as qtd
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (COALESCE(sai_psai.Liberacao, '3000-12-01') > ${fim})
      AND (COALESCE(sai_psai.Descarte, '3000-12-01') > ${fim})
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) > 95
    GROUP BY
      CASE
        WHEN DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) BETWEEN 96 AND 120 THEN '096-120d'
        WHEN DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) BETWEEN 121 AND 180 THEN '121-180d'
        WHEN DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) BETWEEN 181 AND 365 THEN '181-365d'
        WHEN DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) > 365 THEN '+365d'
      END,
      COALESCE(sai_psai.NE_PREVENCAO, 0)
    ORDER BY faixa
  `;
}

function queryTopAntigas(nomeVersao) {
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT TOP 10
      sai_psai.i_sai, sai_psai.i_psai, sai_psai.gravidade_ne,
      sai_psai.CadastroPSAI, sai_psai.i_sai_situacoes, sai_psai.NE_PREVENCAO,
      sai_psai.nomeVersao, sai_psai.i_versoes,
      DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) as dias
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (COALESCE(sai_psai.Liberacao, '3000-12-01') > ${fim})
      AND (COALESCE(sai_psai.Descarte, '3000-12-01') > ${fim})
      AND COALESCE(psai.i_produto_grupo, 1) = 1
    ORDER BY sai_psai.CadastroPSAI ASC
  `;
}

function queryPorFaixaDetalhe(nomeVersao, diasMin, diasMax) {
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT sai_psai.i_sai, sai_psai.i_psai, sai_psai.gravidade_ne,
           sai_psai.CadastroPSAI, sai_psai.i_sai_situacoes, sai_psai.NE_PREVENCAO,
           sai_psai.nomeVersao, sai_psai.i_versoes,
           DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) as dias
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (COALESCE(sai_psai.Liberacao, '3000-12-01') > ${fim})
      AND (COALESCE(sai_psai.Descarte, '3000-12-01') > ${fim})
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) BETWEEN ${diasMin} AND ${diasMax}
    ORDER BY sai_psai.CadastroPSAI ASC
  `;
}

function queryExternasPorStatus(nomeVersao) {
  const fim = versao.sqlFimVersao(nomeVersao);
  // Usa codigo numerico (1/2/3) para evitar problemas de comparacao de string via ODBC
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
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (COALESCE(sai_psai.Liberacao, '3000-12-01') > ${fim})
      AND (COALESCE(sai_psai.Descarte, '3000-12-01') > ${fim})
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) > 95
      AND COALESCE(sai_psai.NE_PREVENCAO, 0) <> 1
    GROUP BY
      CASE
        WHEN sai_psai.nomeVersao IS NOT NULL THEN 1
        WHEN sai_psai.i_versoes IS NOT NULL AND sai_psai.i_versoes <> 0 THEN 2
        ELSE 3
      END
  `;
}

function queryTotalInternas(nomeVersao) {
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT COUNT(*) as qtd
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.CadastroPSAI <= ${fim}
      AND (COALESCE(sai_psai.Liberacao, '3000-12-01') > ${fim})
      AND (COALESCE(sai_psai.Descarte, '3000-12-01') > ${fim})
      AND COALESCE(psai.i_produto_grupo, 1) = 1
      AND DATEDIFF(day, sai_psai.CadastroPSAI, ${fim}) > 95
      AND sai_psai.NE_PREVENCAO = 1
  `;
}

function obterMeta(indice) {
  return METAS_MENSAIS[indice] || 0;
}

function determinarSemaforo(qtd, meta) {
  if (qtd <= meta) return 'verde';
  if (qtd <= meta * 1.15) return 'amarelo';
  return 'vermelho';
}

module.exports = {
  id: 'ne-95-dias',
  nome: 'NEs no Saldo com Mais de 95 Dias',
  categoria: 'produto',
  cacheTTL: 30 * 60 * 1000,

  async calcular(executor, opcoes = {}) {
    const nomeVersao = opcoes.versao
      || versao.nomeDaVersao(
        opcoes.ano || new Date().getFullYear(),
        opcoes.mes || (new Date().getMonth() + 1)
      );

    const parsed = versao.parsearNomeVersao(nomeVersao);
    const indice = parsed ? parsed.indice : (new Date().getMonth());

    const [totalResult, faixasResult, topResult, recemResult, proximasResult, datas, internasResult, statusExternasResult] =
      await Promise.all([
        executor.executar(queryTotal(nomeVersao)),
        executor.executar(queryFaixas(nomeVersao)),
        executor.executar(queryTopAntigas(nomeVersao)),
        executor.executar(queryPorFaixaDetalhe(nomeVersao, 96, 120)),
        executor.executar(queryPorFaixaDetalhe(nomeVersao, 65, 95)),
        versao.obterDatas(executor, nomeVersao),
        executor.executar(queryTotalInternas(nomeVersao)),
        executor.executar(queryExternasPorStatus(nomeVersao))
      ]);

    if (!totalResult || totalResult.length === 0) {
      return {
        valor: null, meta: null, pct: null, status: 'erro',
        detalhes: {},
        validacao: { ok: false, registros_lidos: 0, problemas: ['Query retornou vazio'] }
      };
    }

    const fimDate = datas ? new Date(datas.fim) : null;
    const corte95 = fimDate
      ? new Date(fimDate.getTime() - 95 * 24 * 60 * 60 * 1000) : null;

    const qtdTotal = totalResult[0].qtd;
    const qtdInternas = internasResult && internasResult.length ? internasResult[0].qtd : 0;
    const qtdExternas = qtdTotal - qtdInternas;
    const meta = opcoes.meta || obterMeta(indice);
    const pct = meta > 0 ? Math.round((qtdExternas / meta) * 100 * 10) / 10 : null;

    const statusRaw = statusExternasResult || [];
    console.log('[ne-95-dias] statusExternasResult:', JSON.stringify(statusRaw));
    const getQtdStatus = (code) => {
      const row = statusRaw.find(r => {
        const v = r.status_code !== undefined ? r.status_code : r.STATUS_CODE;
        return Number(v) === code;
      });
      return row ? (Number(row.qtd !== undefined ? row.qtd : row.QTD) || 0) : 0;
    };
    const externasPorStatus = {
      na_versao:  getQtdStatus(1),
      alocada:    getQtdStatus(2),
      sem_versao: getQtdStatus(3)
    };

    const ORDEM_FAIXAS = ['096-120d', '121-180d', '181-365d', '+365d'];
    const faixasRaw = faixasResult || [];
    const porFaixaInternas = ORDEM_FAIXAS.map(f => ({
      faixa: f,
      qtd: faixasRaw.filter(r => r.faixa === f && r.NE_PREVENCAO === 1).reduce((s, r) => s + r.qtd, 0)
    }));
    const porFaixaExternas = ORDEM_FAIXAS.map(f => ({
      faixa: f,
      qtd: faixasRaw.filter(r => r.faixa === f && r.NE_PREVENCAO !== 1).reduce((s, r) => s + r.qtd, 0)
    }));

    return {
      valor: qtdExternas,
      meta,
      pct,
      status: determinarSemaforo(qtdExternas, meta),
      detalhes: {
        versao: nomeVersao,
        data_referencia: datas ? datas.fim : null,
        data_corte_95d: corte95 ? corte95.toISOString().split('T')[0] : null,
        total_geral: qtdTotal,
        total_internas: qtdInternas,
        total_externas: qtdExternas,
        por_faixa_internas: porFaixaInternas,
        por_faixa_externas: porFaixaExternas,
        externas_por_status: externasPorStatus,
        por_faixa: faixasRaw,
        top_10_mais_antigas: topResult || [],
        recem_incluidas: recemResult || [],
        proximas_entrar: proximasResult || [],
        metas_mensais: METAS_MENSAIS
      },
      validacao: {
        ok: true,
        registros_lidos: qtdTotal,
        registros_usados: qtdExternas,
        avisos: []
      }
    };
  }
};
