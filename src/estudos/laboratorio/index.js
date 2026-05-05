/**
 * laboratorio/index.js - Orquestrador do Laboratorio de Previsibilidade
 *
 * Coordena indice de tags, rastreabilidade, mapa de risco,
 * sinais e backtest. Ponto de entrada para a rota API.
 */

const fs = require('fs');
const path = require('path');
const indiceTags = require('./indice-tags');
const rastreabilidade = require('./rastreabilidade');
const mapaRisco = require('./mapa-risco');
const sinais = require('./sinais');
const backtestLab = require('./backtest-lab');
const versaoUtil = require('../../core/versao');

const IA_DIR = path.join(__dirname, '..', '..', '..', 'data', 'ia');
const CONTROLE_PATH = path.join(IA_DIR, 'controle-enriquecimento.json');

function obterPainelIA() {
  const controle = carregarControle();
  const versoes = listarVersoesDesde2022();
  const statusPorVersao = [];

  for (const v of versoes) {
    const info = controle.versoes[v] || null;
    statusPorVersao.push({
      versao: v,
      total: info ? info.total : 0,
      auto: info ? info.auto : 0,
      classificados_ia: info ? info.classificados_ia : 0,
      pendentes: info ? info.pendentes_ia : 0,
      status: info ? info.status : 'nao_preparado'
    });
  }

  const pendentes = statusPorVersao.filter(v => v.status !== 'completa');
  const proxima = pendentes.find(v => v.status === 'pendente') || pendentes[0] || null;

  return {
    versoes: statusPorVersao,
    proxima_classificacao: proxima,
    resumo: {
      total_versoes: versoes.length,
      completas: statusPorVersao.filter(v => v.status === 'completa').length,
      pendentes: statusPorVersao.filter(v => v.status === 'pendente').length,
      nao_preparadas: statusPorVersao.filter(v => v.status === 'nao_preparado').length
    }
  };
}

async function obterMapaRisco(executor, force) {
  const rast = await obterRastreabilidade(executor, force);
  if (!rast || rast.erro) return rast || { erro: 'Rastreabilidade indisponivel' };
  return mapaRisco.calcular(rast);
}

async function obterBacktest(executor, force) {
  const rast = await obterRastreabilidade(executor, force);
  if (!rast || rast.erro) return rast || { erro: 'Rastreabilidade indisponivel' };

  const mapa = mapaRisco.calcular(rast);
  if (mapa.erro) return mapa;

  const sinaisPorVersao = sinais.calcularSinaisPorVersao(rast, mapa.ranking);
  const nomes = listarVersoesDesde2022();
  const resultados = backtestLab.executarTodos(nomes, sinaisPorVersao);

  return { estrategias: resultados, sinais: sinaisPorVersao };
}

async function obterRastreabilidade(executor, force) {
  const rast = rastreabilidade.carregar();
  if (rast && !force) return rast;

  try {
    return await rastreabilidade.coletar(executor);
  } catch (err) {
    console.warn('[lab] ODBC erro coleta rastreabilidade:', err.message);
    if (rast) return rast;
    return { erro: 'Cache vazio. Rode: node scripts/coletar-rastreabilidade.js', sem_cache: true };
  }
}

function gerarIndiceTags() {
  return indiceTags.gerar();
}

function carregarControle() {
  try {
    if (!fs.existsSync(CONTROLE_PATH)) return { versoes: {} };
    return JSON.parse(fs.readFileSync(CONTROLE_PATH, 'utf-8'));
  } catch { return { versoes: {} }; }
}

function listarVersoesDesde2022() {
  const nomes = [];
  const hoje = new Date();
  let ano = 2022, mes = 2;
  while (ano < hoje.getFullYear() || (ano === hoje.getFullYear() && mes <= hoje.getMonth() + 1)) {
    nomes.push(versaoUtil.nomeDaVersao(ano, mes));
    mes++;
    if (mes > 12) { mes = 1; ano++; }
  }
  nomes.push(versaoUtil.nomeDaVersao(ano, mes));
  return nomes;
}

module.exports = {
  obterPainelIA, obterMapaRisco, obterBacktest,
  obterRastreabilidade, gerarIndiceTags
};
