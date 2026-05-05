/**
 * descartes-ne.js - Analise historica de descartes (Repr/Presc/CsD)
 *
 * Coleta entradas e descartes com motivo 5 (Concl. sem Dev),
 * 6 (Reprovada) e 23 (Prescrita) para todas as versoes desde 2022.
 */

const path = require('path');
const fs = require('fs');

const versao = require('../core/versao');
const { calcularEstatisticasDescartes } = require('./descartes-estatisticas');

const CACHE_DIR = path.join(__dirname, '..', '..', 'data', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'estudos-descartes-ne.json');

const VERSAO_INICIO = { ano: 2022, mes: 2 };
const MOTIVOS = [5, 6, 23];

let cache = { _meta: { atualizado_em: null }, versoes: {} };

function restaurarCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return;
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    if (!cache.versoes) cache.versoes = {};
    const n = Object.keys(cache.versoes).length;
    console.log('[descartes-ne] Cache restaurado: %d versoes', n);
  } catch (err) {
    console.error('[descartes-ne] Erro cache:', err.message);
    cache = { _meta: { atualizado_em: null }, versoes: {} };
  }
}

function salvarCache() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  cache._meta.atualizado_em = new Date().toISOString();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
}

/** Total de entradas de NE no periodo da versao */
function queryEntradas(nomeVersao) {
  const inicio = versao.sqlInicioVersao(nomeVersao);
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT COUNT(*) as total
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.nomeArea = 'Escrita' AND sp.tipoSAI = 'NE'
      AND sp.CadastroPSAI > ${inicio} AND sp.CadastroPSAI <= ${fim}
      AND COALESCE(p.i_produto_grupo, 1) = 1
  `;
}

/** Descartes agrupados por motivo (5=CsD, 6=Reprovada, 23=Prescrita) */
function queryDescartesFoco(nomeVersao) {
  const inicio = versao.sqlInicioVersao(nomeVersao);
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT
      COALESCE(NULLIF(sp.i_sai_situacoes, 0), sp.i_psai_situacoes) as motivo_id,
      COUNT(*) as qtd
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.nomeArea = 'Escrita' AND sp.tipoSAI = 'NE'
      AND sp.Descarte > ${inicio} AND sp.Descarte <= ${fim}
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND COALESCE(NULLIF(sp.i_sai_situacoes, 0), sp.i_psai_situacoes) IN (${MOTIVOS.join(',')})
    GROUP BY COALESCE(NULLIF(sp.i_sai_situacoes, 0), sp.i_psai_situacoes)
  `;
}

/** Detalhes dos descartes (motivo 5/6/23) com descricao truncada */
function queryDetalhesDescartes(nomeVersao) {
  const inicio = versao.sqlInicioVersao(nomeVersao);
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT
      sp.i_psai, sp.i_sai, sp.gravidade_ne,
      COALESCE(NULLIF(sp.i_sai_situacoes, 0), sp.i_psai_situacoes) as motivo_id,
      CAST(TRIM(COALESCE(sit.descricao, psit.descricao)) AS BINARY(80)) as motivo_nome,
      CAST(TRIM(p.descricao_destaque) AS BINARY(180)) as descricao
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    LEFT JOIN bethadba.sai_situacoes sit
      ON sp.i_sai_situacoes = sit.i_sai_situacoes AND sit.i_sai_linhas = 1
    LEFT JOIN bethadba.psai_situacoes psit
      ON sp.i_psai_situacoes = psit.i_situacoes
    WHERE sp.nomeArea = 'Escrita' AND sp.tipoSAI = 'NE'
      AND sp.Descarte > ${inicio} AND sp.Descarte <= ${fim}
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND COALESCE(NULLIF(sp.i_sai_situacoes, 0), sp.i_psai_situacoes) IN (${MOTIVOS.join(',')})
  `;
}

/** Coleta dados de uma versao (ODBC ou cache) */
async function coletarVersao(executor, nomeVersao, forceOdbc) {
  if (!forceOdbc && cache.versoes[nomeVersao]) return cache.versoes[nomeVersao];

  try {
    const [entResult, descResult, detalheResult] = await Promise.all([
      executor.executar(queryEntradas(nomeVersao)),
      executor.executar(queryDescartesFoco(nomeVersao)),
      executor.executar(queryDetalhesDescartes(nomeVersao))
    ]);

    const entradas = entResult && entResult[0] ? entResult[0].total : 0;
    const porMotivo = { 5: 0, 6: 0, 23: 0 };
    if (descResult) {
      for (const r of descResult) porMotivo[r.motivo_id] = r.qtd;
    }
    const totalFoco = porMotivo[5] + porMotivo[6] + porMotivo[23];
    const pct = entradas > 0 ? Math.round((totalFoco / entradas) * 10000) / 100 : 0;

    const detalhes = (detalheResult || []).map(r => ({
      i_psai: r.i_psai, i_sai: r.i_sai, gravidade: r.gravidade_ne,
      motivo_id: r.motivo_id,
      motivo_nome: limparBuffer(r.motivo_nome),
      descricao: limparBuffer(r.descricao)
    }));

    const dados = {
      versao: nomeVersao, entradas,
      conclSemDev: porMotivo[5], reprovadas: porMotivo[6], prescritas: porMotivo[23],
      totalDescartesFoco: totalFoco, percentual: pct, detalhes
    };
    cache.versoes[nomeVersao] = dados;
    return dados;
  } catch (err) {
    console.warn('[descartes-ne] Erro %s: %s', nomeVersao, err.message);
    return cache.versoes[nomeVersao] || null;
  }
}

function limparBuffer(val) {
  if (!val) return '';
  if (Buffer.isBuffer(val)) return val.toString('utf-8').trim();
  return String(val).trim();
}

function listarVersoes() {
  const nomes = [];
  const hoje = new Date();
  let ano = VERSAO_INICIO.ano;
  let mes = VERSAO_INICIO.mes;
  while (ano < hoje.getFullYear() || (ano === hoje.getFullYear() && mes <= hoje.getMonth() + 1)) {
    nomes.push(versao.nomeDaVersao(ano, mes));
    if (++mes > 12) { mes = 1; ano++; }
  }
  return nomes;
}

async function detectarAtual(executor) {
  try { return await versao.detectarVersaoAtual(executor); }
  catch { return versao.nomeDaVersao(new Date().getFullYear(), new Date().getMonth() + 1); }
}

/** Executa analise historica completa de descartes (CsD/Repr/Presc) */
async function calcularDescartes(executor, opts = {}) {
  restaurarCache();
  const nomes = listarVersoes();
  const atual = await detectarAtual(executor);
  const resultados = [];

  for (const nome of nomes) {
    const ehAtual = nome === atual;
    const force = opts.forceTodas || (ehAtual && opts.forceAtual !== false);
    const dados = await coletarVersao(executor, nome, force);
    if (dados && dados.entradas > 0) resultados.push(dados);
  }

  salvarCache();
  const estatisticas = calcularEstatisticasDescartes(resultados, atual);

  return {
    versoes: resultados,
    versaoAtual: atual,
    estatisticas,
    _meta: {
      atualizado_em: new Date().toISOString(),
      total_versoes: resultados.length,
      periodo: resultados.length > 0
        ? { de: resultados[0].versao, ate: resultados[resultados.length - 1].versao }
        : null
    }
  };
}

restaurarCache();

module.exports = { calcularDescartes, listarVersoes };
