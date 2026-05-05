/**
 * liberacoes-sa-v2/coleta.js - Coleta de dados de SA
 *
 * Queries SQL, cache em disco (schema V5), extracao de registros.
 * O cache V2 armazena itens brutos (sem agregacao) para permitir
 * reprocessamento com algoritmos diferentes.
 */

const path = require('path');
const fs = require('fs');
const versao = require('../../core/versao');

const CACHE_DIR = path.join(__dirname, '..', '..', '..', 'data', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'estudos-liberacoes-sa-v2.json');
const VERSAO_INICIO = { ano: 2022, mes: 2 };
const NIVEIS_LABEL = { 1: 'Baixo', 2: 'Medio', 3: 'Alto', null: 'Nao informado' };

let cache = { _meta: { atualizado_em: null, versao_schema: 5 }, versoes: {}, backtest: [] };

function garantirDiretorio() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function restaurarCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    if (parsed._meta && parsed._meta.versao_schema === 5) {
      cache = parsed;
    } else {
      cache = { _meta: { atualizado_em: null, versao_schema: 5 }, versoes: {}, backtest: [] };
    }
    if (!cache.versoes) cache.versoes = {};
    if (!cache.backtest) cache.backtest = [];
    console.log('[sa-v2] Cache restaurado: %d versoes', Object.keys(cache.versoes).length);
  } catch (err) {
    console.error('[sa-v2] Erro restaurar cache:', err.message);
  }
}

function salvarCache() {
  garantirDiretorio();
  cache._meta.atualizado_em = new Date().toISOString();
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[sa-v2] Erro salvar cache:', err.message);
  }
}

function obterCache() { return cache; }

function listarVersoesEsperadas() {
  const nomes = [];
  const hoje = new Date();
  let ano = VERSAO_INICIO.ano, mes = VERSAO_INICIO.mes;
  while (ano < hoje.getFullYear() || (ano === hoje.getFullYear() && mes <= hoje.getMonth() + 1)) {
    nomes.push(versao.nomeDaVersao(ano, mes));
    mes++;
    if (mes > 12) { mes = 1; ano++; }
  }
  nomes.push(versao.nomeDaVersao(ano, mes));
  return nomes;
}

function querySA(nomeVersao) {
  return `
    SELECT sai_psai.i_psai, sai_psai.tipoSAI, psai.nivel_alteracao,
           sai_psai.Liberacao, sai_psai.tempoPrevistoTotal,
           sai_psai.tempoRealizadoTotal, sai_psai.qtde_ssc,
           CAST(SUBSTRING(psai.descricao, 1, 150) AS BINARY) AS descricao
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI IN ('SAM', 'SAL', 'SAIL')
      AND sai_psai.nomeVersao = '${nomeVersao}'
      AND sai_psai.Liberacao IS NOT NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1`;
}

/** SAs alocadas na versao mas ainda nao liberadas (pipeline) */
function queryPipeline(nomeVersao) {
  return `
    SELECT sai_psai.i_psai, sai_psai.tipoSAI, psai.nivel_alteracao,
           sai_psai.tempoPrevistoTotal, sai_psai.tempoRealizadoTotal,
           sai_psai.qtde_ssc,
           CAST(SUBSTRING(psai.descricao, 1, 150) AS BINARY) AS descricao
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI IN ('SAM', 'SAL', 'SAIL')
      AND sai_psai.nomeVersao = '${nomeVersao}'
      AND sai_psai.Liberacao IS NULL
      AND sai_psai.Descarte IS NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1`;
}

function queryArquivo(nomeVersao) {
  const ant = versao.versaoAnterior(nomeVersao);
  if (!ant) return null;
  return `
    SELECT sai_psai.i_psai, sai_psai.tipoSAI, psai.nivel_alteracao,
           sai_psai.Liberacao, sai_psai.tempoPrevistoTotal,
           sai_psai.tempoRealizadoTotal, sai_psai.qtde_ssc,
           CAST(SUBSTRING(psai.descricao, 1, 150) AS BINARY) AS descricao
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI IN ('SAM', 'SAL', 'SAIL')
      AND sai_psai.nomeVersao LIKE '${ant}.%'
      AND sai_psai.Liberacao IS NOT NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1`;
}

function extrairItem(r, origem) {
  return {
    psai: r.i_psai, tipo: r.tipoSAI,
    descricao: (r.descricao || '').trim(),
    nivel: NIVEIS_LABEL[r.nivel_alteracao] || NIVEIS_LABEL[null],
    nivelRaw: r.nivel_alteracao,
    tempoPrev: r.tempoPrevistoTotal || 0,
    tempoReal: r.tempoRealizadoTotal || 0,
    ssc: r.qtde_ssc || 0, origem
  };
}

async function coletarVersao(executor, nomeVersao, forceOdbc, opts = {}) {
  if (!forceOdbc && cache.versoes[nomeVersao]) return cache.versoes[nomeVersao];
  try {
    const diretos = await executor.executar(querySA(nomeVersao));
    let arquivo = [];
    const qArq = queryArquivo(nomeVersao);
    if (qArq) { try { arquivo = await executor.executar(qArq); } catch { /* ok */ } }
    const itens = [
      ...diretos.map(r => extrairItem(r, 'versao')),
      ...arquivo.map(r => extrairItem(r, 'arquivo'))
    ];

    let pipeline = [];
    if (opts.incluirPipeline) {
      try {
        const pipe = await executor.executar(queryPipeline(nomeVersao));
        pipeline = pipe.map(r => extrairItem(r, 'pipeline'));
      } catch { /* ok */ }
    }

    const dados = {
      versao: nomeVersao, itens, pipeline,
      coletadoEm: new Date().toISOString()
    };
    cache.versoes[nomeVersao] = dados;
    return dados;
  } catch (err) {
    console.warn('[sa-v2] Erro %s: %s', nomeVersao, err.message);
    return cache.versoes[nomeVersao] || null;
  }
}

restaurarCache();

module.exports = {
  listarVersoesEsperadas, coletarVersao,
  restaurarCache, salvarCache, obterCache, NIVEIS_LABEL
};
