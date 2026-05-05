/**
 * analise-historica-ne.js - Analise historica semanal de NE (2022+)
 *
 * Orquestra a coleta de dados de todas as versoes desde 10.2A-02,
 * gerencia cache em disco e compoe o resultado final com ISV.
 *
 * Modulos extraidos:
 * - estatisticas-ne.js: funcoes matematicas e estatisticas agregadas
 * - isv-ne.js: Indice de Saude da Versao e projecao realista
 */

const path = require('path');
const fs = require('fs');

const versao = require('../core/versao');
const analiseSemanal = require('./analise-semanal-ne');
const { calcularEstatisticas } = require('./estatisticas-ne');
const { calcularISV, calcularProjecaoRealista } = require('./isv-ne');

const CACHE_DIR = path.join(__dirname, '..', '..', 'data', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'estudos-historico.json');

/** Primeira versao com dados confiaveis (fev/2022) */
const VERSAO_INICIO = { ano: 2022, mes: 2 };

/* ============== CACHE DISCO ============== */

let cacheHistorico = { _meta: { atualizado_em: null }, versoes: {} };

function garantirDiretorio() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function restaurarCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return;
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    cacheHistorico = JSON.parse(raw);
    if (!cacheHistorico._meta) cacheHistorico._meta = { atualizado_em: null };
    if (!cacheHistorico.versoes) cacheHistorico.versoes = {};

    const n = Object.keys(cacheHistorico.versoes).length;
    console.log('[historico-ne] Cache restaurado: %d versoes', n);
  } catch (err) {
    console.error('[historico-ne] Erro ao restaurar cache:', err.message);
    cacheHistorico = { _meta: { atualizado_em: null }, versoes: {} };
  }
}

function salvarCache() {
  garantirDiretorio();
  cacheHistorico._meta.atualizado_em = new Date().toISOString();
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheHistorico, null, 2), 'utf-8');
  } catch (err) {
    console.error('[historico-ne] Erro ao salvar cache:', err.message);
  }
}

/* ============== LISTAGEM DE VERSOES ============== */

/**
 * Gera lista de nomes de versao de VERSAO_INICIO ate hoje
 * @returns {string[]}
 */
function listarVersoesEsperadas() {
  const nomes = [];
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;

  let ano = VERSAO_INICIO.ano;
  let mes = VERSAO_INICIO.mes;

  while (ano < anoAtual || (ano === anoAtual && mes <= mesAtual)) {
    nomes.push(versao.nomeDaVersao(ano, mes));
    mes++;
    if (mes > 12) { mes = 1; ano++; }
  }

  // Versao seguinte (pode já ter iniciado antes da virada do mês)
  nomes.push(versao.nomeDaVersao(ano, mes));

  return nomes;
}

/* ============== COLETA DE DADOS ============== */

/**
 * Coleta analise semanal de uma versao (ODBC ou cache)
 */
async function coletarVersao(executor, nomeVersao, forceOdbc) {
  if (!forceOdbc && cacheHistorico.versoes[nomeVersao]) {
    return cacheHistorico.versoes[nomeVersao];
  }

  try {
    const dados = await analiseSemanal.calcular(executor, nomeVersao);
    cacheHistorico.versoes[nomeVersao] = dados;
    return dados;
  } catch (err) {
    console.warn('[historico-ne] Erro em %s: %s', nomeVersao, err.message);
    return cacheHistorico.versoes[nomeVersao] || null;
  }
}

/**
 * Coleta dados de TODAS as versoes historicas
 * @param {Object} executor - Query executor
 * @param {Object} opts - { forceAtual: bool, forceTodas: bool }
 * @returns {Promise<Object[]>} Array de analises semanais
 */
async function coletarHistorico(executor, opts = {}) {
  restaurarCache();
  const nomes = listarVersoesEsperadas();
  const versaoAtual = await detectarAtual(executor);
  const resultados = [];

  for (const nome of nomes) {
    const ehAtual = nome === versaoAtual;
    const force = opts.forceTodas || (ehAtual && opts.forceAtual !== false);
    const dados = await coletarVersao(executor, nome, force);
    if (dados && dados.totais) resultados.push(dados);
  }

  salvarCache();
  return resultados;
}

async function detectarAtual(executor) {
  try {
    return await versao.detectarVersaoAtual(executor);
  } catch {
    const h = new Date();
    return versao.nomeDaVersao(h.getFullYear(), h.getMonth() + 1);
  }
}

/* ============== API PRINCIPAL ============== */

/**
 * Executa analise historica completa
 * @param {Object} executor - Query executor
 * @param {Object} opts - { forceAtual, forceTodas }
 * @returns {Promise<Object>} Historico completo com estatisticas e ISV
 */
async function calcularHistorico(executor, opts = {}) {
  const versoes = await coletarHistorico(executor, opts);
  enriquecerSSC(versoes);
  const completas = versoes.filter(v => !v.versaoEmAndamento && (v.semanasConcluidas !== undefined ? v.semanasConcluidas : 4) === 4);
  const stats = calcularEstatisticas(versoes);

  const versoesComISV = versoes.map((v, i) => {
    const anteriores = versoes.slice(0, i);
    const isv = calcularISV(v, anteriores);

    const completasAnteriores = anteriores.filter(
      a => !a.versaoEmAndamento && (a.semanasConcluidas !== undefined ? a.semanasConcluidas : 4) === 4
    );
    const proj = completasAnteriores.length >= 3
      ? calcularProjecaoRealista(v, completasAnteriores)
      : null;

    return { ...v, isv, projecaoRealista: proj };
  });

  return {
    versoes: versoesComISV,
    estatisticas: stats,
    _meta: {
      atualizado_em: new Date().toISOString(),
      total_versoes: versoes.length,
      versoes_completas: completas.length,
      periodo: versoes.length > 0
        ? { de: versoes[0].versao, ate: versoes[versoes.length - 1].versao }
        : null
    }
  };
}

/**
 * Obtem dados de uma versao SOMENTE do cache (sem ODBC)
 * @param {string} nomeVersao
 * @returns {Object|null}
 */
function obterDoCache(nomeVersao) {
  return cacheHistorico.versoes[nomeVersao] || null;
}

/**
 * Retorna versoes anteriores a uma dada versao (somente do cache)
 * @param {string} versaoAlvo
 * @returns {Object[]}
 */
function obterHistoricoAnterior(versaoAlvo) {
  const nomes = listarVersoesEsperadas();
  const idx = nomes.indexOf(versaoAlvo);
  if (idx <= 0) return [];

  const resultado = [];
  for (let i = 0; i < idx; i++) {
    const dados = cacheHistorico.versoes[nomes[i]];
    if (dados && dados.totais) resultado.push(dados);
  }
  enriquecerSSC(resultado);
  return resultado;
}

/** Enriquece versoes sem SSC usando estudo historico pre-calculado */
function enriquecerSSC(versoes) {
  const SSC_FILE = path.join(CACHE_DIR, 'estudo-ssc-historico.json');
  let estudo;
  try { estudo = JSON.parse(fs.readFileSync(SSC_FILE, 'utf8')); }
  catch { return; }
  if (!estudo || !estudo.versoes) return;

  const mapaSSC = {};
  for (const v of estudo.versoes) mapaSSC[v.versao] = v;

  for (const v of versoes) {
    if (v.totais && !v.totais.ssc) {
      const s = mapaSSC[v.versao];
      if (s) {
        v.totais.ssc = {
          totalSSC: s.totalSSC, neComSSC: s.neComSSC, maxSSC: s.maxSSC,
          ratio: v.totais.entradasBrutas > 0
            ? Math.round(s.totalSSC / v.totais.entradasBrutas * 10) / 10 : 0
        };
      }
    }
  }
}

// Restaurar cache na carga do modulo
restaurarCache();

module.exports = {
  calcularHistorico,
  calcularISV,
  calcularProjecaoRealista,
  calcularEstatisticas,
  coletarVersao,
  listarVersoesEsperadas,
  restaurarCache,
  obterDoCache,
  obterHistoricoAnterior,
  enriquecerSSC
};
