/**
 * consultas-ne.js - Queries compartilhadas para detalhamento de NEs
 *
 * Fornece query builders reutilizaveis para movimentacao de NEs por versao.
 * Usado por: indicadores/produto/saldo-ne.js, indicadores/produto/entrada-ne.js
 *
 * Filtro padrao: nomeArea = Escrita, tipoSAI = NE, produto_grupo = 1 via psai
 *
 * IMPORTANTE: bethadba.sai_situacoes tem chave composta (i_sai_situacoes + i_sai_linhas).
 * i_sai_linhas = 1 corresponde a NE. Sem esse filtro, o JOIN duplica registros.
 *
 * Situacoes de descarte: quando i_sai_situacoes = 0 (sem situacao SAI), o motivo
 * pode estar em bethadba.psai_situacoes via i_psai_situacoes (ex: 5 = CsD, 23 = Prescrita).
 * Usamos COALESCE(sit_sai.descricao, sit_psai.descricao) para cobrir ambos os casos.
 */

const versao = require('./versao');

/**
 * Filtro padrao para entradas/descartes de NE por periodo.
 * Usa EXISTS bethadba.sai (nao JOIN bethadba.psai) + i_sai=0.
 * Fonte: negocio-sql.mdc "SQL padrao: Entradas + Descartes na versao"
 */
const FILTRO_PRODUTO_ENTRADA = `
      AND (
        EXISTS (SELECT 1 FROM bethadba.sai sai
          WHERE sai_psai.i_sai = sai.i_sai
            AND (sai.i_produto_grupo IS NULL OR sai.i_produto_grupo = 1))
        OR sai_psai.i_sai = 0
      )`;

/**
 * NEs que entraram no periodo com detalhamento completo:
 * situacao atual, origem (interna/externa), status de versao (nomeVersao/i_versoes).
 */
function queryEntradasDetalhe(nomeVersao) {
  const inicio = versao.sqlInicioVersao(nomeVersao);
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT sai_psai.i_sai, sai_psai.i_psai, sai_psai.CadastroPSAI,
           sai_psai.gravidade_ne, sai_psai.NE_PREVENCAO,
           sai_psai.i_sai_situacoes, sai_psai.nomeVersao, sai_psai.i_versoes,
           CAST(TRIM(COALESCE(sit.descricao, psai_sit.descricao)) AS BINARY(64)) as situacao_nome --allow-blob
    FROM UP.SAI_PSAI sai_psai
    LEFT JOIN bethadba.sai_situacoes sit
      ON sai_psai.i_sai_situacoes = sit.i_sai_situacoes
      AND sit.i_sai_linhas = 1
    LEFT JOIN bethadba.psai_situacoes psai_sit
      ON sai_psai.i_psai_situacoes = psai_sit.i_situacoes
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.CadastroPSAI > ${inicio}
      AND sai_psai.CadastroPSAI <= ${fim}
      ${FILTRO_PRODUTO_ENTRADA}
    ORDER BY sai_psai.CadastroPSAI DESC
  `;
}

/**
 * NEs que entraram no periodo da versao (CadastroPSAI entre inicio e fim)
 */
function queryEntradas(nomeVersao) {
  const inicio = versao.sqlInicioVersao(nomeVersao);
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT sai_psai.i_sai, sai_psai.i_psai, sai_psai.CadastroPSAI,
           sai_psai.gravidade_ne, sai_psai.NE_PREVENCAO
    FROM UP.SAI_PSAI sai_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.CadastroPSAI > ${inicio}
      AND sai_psai.CadastroPSAI <= ${fim}
      ${FILTRO_PRODUTO_ENTRADA}
  `;
}

/**
 * NEs descartadas no periodo com motivo.
 * JOIN sai_situacoes para situacao SAI + psai_situacoes para situacao PSAI (fallback).
 */
function queryDescartes(nomeVersao) {
  const inicio = versao.sqlInicioVersao(nomeVersao);
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT sai_psai.i_sai, sai_psai.i_psai, sai_psai.Descarte,
           sai_psai.gravidade_ne, sai_psai.i_sai_situacoes,
           CAST(TRIM(COALESCE(sit.descricao, psai_sit.descricao)) AS BINARY(64)) as situacao_nome --allow-blob
    FROM UP.SAI_PSAI sai_psai
    LEFT JOIN bethadba.sai_situacoes sit
      ON sai_psai.i_sai_situacoes = sit.i_sai_situacoes
      AND sit.i_sai_linhas = 1
    LEFT JOIN bethadba.psai_situacoes psai_sit
      ON sai_psai.i_psai_situacoes = psai_sit.i_situacoes
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.Descarte > ${inicio}
      AND sai_psai.Descarte <= ${fim}
      ${FILTRO_PRODUTO_ENTRADA}
  `;
}

/**
 * NEs liberadas na versao (nomeVersao + Liberacao preenchidos)
 */
function queryLiberadas(nomeVersao) {
  return `
    SELECT sai_psai.i_sai, sai_psai.i_psai, sai_psai.Liberacao,
           sai_psai.gravidade_ne, sai_psai.nomeVersao
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.nomeVersao = '${nomeVersao}'
      AND sai_psai.Liberacao IS NOT NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
  `;
}

/**
 * NEs pendentes de liberacao (commitadas na versao mas Liberacao IS NULL)
 */
function queryPendentes(nomeVersao) {
  return `
    SELECT sai_psai.i_sai, sai_psai.i_psai, sai_psai.gravidade_ne,
           sai_psai.i_sai_situacoes, sai_psai.nomeVersao
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.nomeVersao = '${nomeVersao}'
      AND sai_psai.Liberacao IS NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
  `;
}

/**
 * NEs liberadas via arquivo de versao (antecipacao).
 */
function queryLiberadasArquivo(nomeVersao) {
  const padrao = versao.padraoArquivoVersao(nomeVersao);
  if (!padrao) return null;
  return `
    SELECT sai_psai.i_sai, sai_psai.i_psai, sai_psai.Liberacao,
           sai_psai.gravidade_ne, sai_psai.nomeVersao
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.nomeVersao LIKE '${padrao}'
      AND sai_psai.Liberacao IS NOT NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
  `;
}

/**
 * NEs em arquivo de versao pendente publicacao.
 */
function queryEmArquivo(nomeVersao) {
  const padrao = versao.padraoArquivoVersao(nomeVersao);
  if (!padrao) return null;
  return `
    SELECT sai_psai.i_sai, sai_psai.i_psai, sai_psai.gravidade_ne,
           sai_psai.i_sai_situacoes, sai_psai.nomeVersao
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.nomeVersao LIKE '${padrao}'
      AND sai_psai.Liberacao IS NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
  `;
}

/**
 * NEs alocadas na versao mas sem commit (projecao de liberacao).
 */
function queryAlocadas(nomeVersao) {
  return `
    SELECT sai_psai.i_sai, sai_psai.i_psai, sai_psai.gravidade_ne,
           sai_psai.i_sai_situacoes, sai_psai.i_versoes
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.nomeVersao IS NULL
      AND sai_psai.Liberacao IS NULL
      AND sai_psai.Descarte IS NULL
      AND sai_psai.i_versoes IN (
        SELECT DISTINCT sp2.i_versoes
        FROM UP.SAI_PSAI sp2
        WHERE sp2.nomeVersao = '${nomeVersao}'
          AND sp2.nomeArea = 'Escrita'
      )
      AND COALESCE(psai.i_produto_grupo, 1) = 1
  `;
}

/**
 * Contagem de descartes agrupados por situacao (para breakdown).
 */
function queryDescartesPorSituacao(nomeVersao) {
  const inicio = versao.sqlInicioVersao(nomeVersao);
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT COALESCE(NULLIF(sai_psai.i_sai_situacoes, 0), sai_psai.i_psai_situacoes) as i_sai_situacoes,
           CAST(TRIM(MAX(COALESCE(sit.descricao, psai_sit.descricao))) AS BINARY(64)) as situacao_nome, --allow-blob
           COUNT(*) as qtd
    FROM UP.SAI_PSAI sai_psai
    LEFT JOIN bethadba.sai_situacoes sit
      ON sai_psai.i_sai_situacoes = sit.i_sai_situacoes
      AND sit.i_sai_linhas = 1
    LEFT JOIN bethadba.psai_situacoes psai_sit
      ON sai_psai.i_psai_situacoes = psai_sit.i_situacoes
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.Descarte > ${inicio}
      AND sai_psai.Descarte <= ${fim}
      ${FILTRO_PRODUTO_ENTRADA}
    GROUP BY COALESCE(NULLIF(sai_psai.i_sai_situacoes, 0), sai_psai.i_psai_situacoes)
    ORDER BY qtd DESC
  `;
}

/**
 * Conta SSCs vinculadas a um conjunto de i_psai.
 * Usa forum_sa_psai + ssc (chamados reais). Processa em batches
 * para evitar limites do IN() no ASA 9.
 * @param {Function} executar - fn(sql) => rows
 * @param {number[]} psaiIds - Lista de i_psai
 * @returns {Promise<{ totalSSC: number, neComSSC: number, maxSSC: number, porNE: Object }>}
 */
async function querySSCsVinculadas(executar, psaiIds) {
  if (!psaiIds || psaiIds.length === 0) {
    return { totalSSC: 0, neComSSC: 0, maxSSC: 0, porNE: {} };
  }
  let totalSSC = 0, neComSSC = 0, maxSSC = 0;
  const porNE = {};
  const BATCH = 50;
  for (let i = 0; i < psaiIds.length; i += BATCH) {
    const batch = psaiIds.slice(i, i + BATCH);
    const rows = await executar(`
      SELECT fsp.i_psai, COUNT(ssc.i_ssc) as total_ssc
      FROM bethadba.forum_sa_psai fsp
      JOIN bethadba.ssc ssc ON fsp.i_forum_sa = ssc.i_forum_sa
      WHERE fsp.i_psai IN (${batch.join(',')})
      GROUP BY fsp.i_psai`);
    for (const r of rows) {
      neComSSC++;
      totalSSC += r.total_ssc;
      if (r.total_ssc > maxSSC) maxSSC = r.total_ssc;
      porNE[r.i_psai] = r.total_ssc;
    }
  }
  return { totalSSC, neComSSC, maxSSC, porNE };
}

/**
 * Busca resumo executivo de NEs: descricao SAI (como binary p/ encoding), gravidade, SSC.
 * CAST AS BINARY para preservar bytes originais (latin1/cp1252 do ASA 9).
 */
function queryResumoNEs(nomeVersao) {
  const inicio = versao.sqlInicioVersao(nomeVersao);
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT sai_psai.i_psai, sai_psai.i_sai, sai_psai.CadastroPSAI,
           sai_psai.gravidade_ne, sai_psai.Liberacao,
           CAST(TRIM(sai.descricao) AS BINARY(400)) as descricao_bin, --allow-blob
           CAST(TRIM(psai.descricao) AS BINARY(400)) as psai_descricao_bin --allow-blob
    FROM UP.SAI_PSAI sai_psai
    LEFT JOIN bethadba.sai sai ON sai_psai.i_sai = sai.i_sai AND sai_psai.i_sai > 0
    LEFT JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.CadastroPSAI > ${inicio}
      AND sai_psai.CadastroPSAI <= ${fim}
      ${FILTRO_PRODUTO_ENTRADA}
    ORDER BY sai_psai.CadastroPSAI
  `;
}

/**
 * Decodifica Buffer de bytes latin1/cp1252 do ASA 9 para string UTF-8.
 * O ODBC retorna strings com replacement chars; CAST AS BINARY preserva os bytes originais.
 */
function decodificarBinario(val) {
  if (!val) return '';
  let buf;
  if (val instanceof ArrayBuffer) buf = Buffer.from(val);
  else if (Buffer.isBuffer(val)) buf = val;
  else return String(val);
  let end = buf.length;
  while (end > 0 && buf[end - 1] === 0x00) end--;
  return buf.slice(0, end).toString('latin1');
}

/**
 * Classificar NE em area funcional pela descricao.
 * Contexto: modulo Escrita Fiscal (Dominio).
 * Categorias baseadas em obrigacoes fiscais, tributos e escrituracao.
 */
function classificarArea(descricao) {
  if (!descricao) return 'Outros';
  const d = descricao.normalize('NFC').toLowerCase();

  // 1. Obrigacoes Acessorias (declaracoes e escrituracao digital)
  if (/\bsped\b|\befd\b|\becf\b|\bdirf\b|\bdctf(web)?\b|\bgfip\b|\bsefip\b|\brais\b|\bdefis\b|\bdestda\b|\befd.?reinf\b|\befd.?contribui|\bperd.?comp\b|\bdcbe\b/.test(d)) return 'Obrig. Acessorias';

  // 3. Impostos e tributos federais (calculo incorreto, apuracao, base)
  if (/\birpj\b|\birpf\b|\bcsll\b|\bcofins\b|\bpis\b|\biss\b|\bicms\b|\bipi\b|\bcsrf\b|\birrf\b|\bimposto\b|\btributo\b|\btfe\b|\btff\b|\bret[eé]n[çc][ãa]o\b|\bbase\s+de\s+c[aá]lculo\b|\bisenção\b|\bisen[çc][ãa]o\b/.test(d)) return 'Impostos/Tributos';

  // 4. GPS e INSS (previdencia social - relevante tambem em Escrita)
  if (/\binss\b|\bgps\b|\bprevidenci|\bcontribui[çc][ãa]o\s+(previdenci|social)\b/.test(d)) return 'GPS/INSS';

  // 5. DARF e recolhimento
  if (/\bdarf\b|\bdas\b|\bguia\s+de\s+recolhimento\b|\brecolhimento\b|\bpagamento\s+(do|de|dos)\s+(imposto|tributo|darf)\b/.test(d)) return 'DARF/Recolhimento';

  // 6. Lancamento contabil e fiscal
  if (/\blan[çc]amento\b|\blan[çc]ar\b|\bestorno\b|\bcontabiliza[çc][ãa]o\b|\bcontabilizar\b|\bpartida\b|\bdébito\b|\bcr[eé]dito\b|\bescritura[çc][ãa]o\b|\bregistro\s+(cont[áa]bil|fiscal)\b/.test(d)) return 'Lancamento';

  // 7. Calculo e apuracao
  if (/\bcalc[uú]l|\bapura[çc][ãa]o\b|\bcompet[eê]ncia\b|\bliquid|\brecalcul|\bprocessamento\b|\bcorr[eé][çc][ãa]o\s+(do|no|de)\s+(valor|campo|c[aá]lculo)\b/.test(d)) return 'Calculo/Apuracao';

  // 8. Importacao e integracao de dados
  if (/\bimporta[çc][ãa]o\b|\bexporta[çc][ãa]o\b|\bintegra[çc][ãa]o\b/.test(d)) return 'Importacao/Integracao';

  // 9. Relatorios e conferencia
  if (/\brelat[oó]rio\b|\blistagem\b|\bextra[çc][ãa]o\b|\bconfer[eê]ncia\b|\bdemonstrat[ií]vo\b/.test(d)) return 'Relatorios';

  // 10. Parametrizacao fiscal (CFOP, CST, natureza de operacao, regime tributario)
  if (/\bcfop\b|\bcst\b|\bnatureza\s+(de\s+)?opera[çc][ãa]o\b|\bregime\s+tribut[aá]rio\b|\blucro\s+(real|presumido|arbitrado)\b|\bsimples\s+nacional\b|\bpar[aâ]metr|\bcodifica[çc][ãa]o\b|\bclassifica[çc][ãa]o\s+(fiscal|tribut)\b|\bal[íi]quota\b/.test(d)) return 'Parametrizacao';

  // 11. Infraestrutura e erros de sistema
  if (/\brequisição\b|\brequisicao\b|\berro\s+(na|no|de)\s+(requisição|servidor|sistema|campo)\b|dom[ií]nio\b|\bfalha\s+no\s+sistema\b/.test(d)) return 'Infraestrutura/Erro';

  return 'Outros';
}

module.exports = {
  FILTRO_PRODUTO_ENTRADA,
  queryEntradasDetalhe,
  queryEntradas,
  queryDescartes,
  queryLiberadas,
  queryPendentes,
  queryLiberadasArquivo,
  queryEmArquivo,
  queryAlocadas,
  queryDescartesPorSituacao,
  querySSCsVinculadas,
  queryResumoNEs,
  decodificarBinario,
  classificarArea
};
