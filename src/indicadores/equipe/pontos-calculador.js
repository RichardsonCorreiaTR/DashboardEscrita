/**
 * pontos-calculador.js - Calculo de pontos de definicao por tabela configuravel
 *
 * Substitui o uso de sai.pontuacao (SGD) pelo calculo baseado em:
 *   cargo (junior/pleno/senior) x tipoSAI x nivel_alteracao
 *
 * Tabela de pontos: config/pontos-definicao.json
 * nivel_alteracao: 1=Baixa, 2=Media, 3=Alta, 4=Extra Alta
 */

const path = require('path');
const fs = require('fs');
const TABELA = require(path.join(__dirname, '..', '..', '..', 'config', 'pontos-definicao.json'));
const OVERRIDES_PATH = path.join(__dirname, '..', '..', '..', 'config', 'pontos-overrides.json');

const NIVEL_PARA_CHAVE_DB = { 'baixa': '1', 'media': '2', 'média': '2', 'alta': '3', 'extra alta': '4' };

function carregarOverrides() {
  try {
    const raw = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8'));
    const map = {};
    (raw.overrides || []).filter(o => o.conferido && o.i_sai).forEach(o => {
      map[String(o.i_sai)] = {
        nivel: o.nivel,
        chave: NIVEL_PARA_CHAVE_DB[(o.nivel || '').toLowerCase().trim()] || '1'
      };
    });
    return map;
  } catch (_) { return {}; }
}

let _overridesCache = null;
function getOverrides() {
  if (!_overridesCache) _overridesCache = carregarOverrides();
  return _overridesCache;
}

function limparCacheOverrides() { _overridesCache = null; }

const NIVEL_LABEL = { 1: 'Baixa', 2: 'Media', 3: 'Alta', 4: 'Extra Alta' };

function pontosSai(tipo, nivel, cargo) {
  const tabTipo = TABELA.pontos[tipo];
  if (!tabTipo) return 0;
  const tabCargo = tabTipo[cargo];
  if (!tabCargo) return 0;
  return tabCargo[String(nivel)] || 0;
}

function nivelLabel(nivel) {
  return NIVEL_LABEL[nivel] || 'Nao informado';
}

// Agrega linhas individuais de SAI em { uid -> { mes -> { pontos, qtd_sais } } }
// cargoMap: { codigo_sgd -> senioridade }
function agruparPontosNivel(rows, cargoMap) {
  const m = {};
  rows.forEach(r => {
    const uid = r.i_usuarios, mes = r.mes;
    const cargo = cargoMap[uid] || 'pleno';
    const pts = pontosSai(r.tipoSAI, r.nivel_alteracao, cargo);
    if (!m[uid]) m[uid] = {};
    if (!m[uid][mes]) m[uid][mes] = { pontos: 0, qtd_sais: 0 };
    m[uid][mes].pontos += pts;
    m[uid][mes].qtd_sais++;
  });
  return m;
}

// Versao para analista individual (cargo conhecido)
function agruparPontosNivelAnalista(rows, cargo) {
  const m = {};
  rows.forEach(r => {
    const uid = r.i_usuarios, mes = r.mes;
    const pts = pontosSai(r.tipoSAI, r.nivel_alteracao, cargo);
    if (!m[uid]) m[uid] = {};
    if (!m[uid][mes]) m[uid][mes] = { pontos: 0, qtd_sais: 0 };
    m[uid][mes].pontos += pts;
    m[uid][mes].qtd_sais++;
  });
  return m;
}

// Mapeamento de texto da planilha para chave numerica da tabela
const NIVEL_PARA_CHAVE = {
  'baixa': '1', 'media': '2', 'm\u00e9dia': '2',
  'alta': '3', 'extra alta': '4', 'extra': '4'
};

function pontosPlanilha(tipo, nivelTexto, cargo, fallbackPontos) {
  const chave = NIVEL_PARA_CHAVE[(nivelTexto || '').toLowerCase().trim()] || '1';
  const calculado = pontosSai(tipo, chave, cargo);
  // Fallback para pontos da planilha quando combinacao nao esta na tabela (ex: SAM Extra Alta)
  if (calculado === 0 && fallbackPontos) return Number(fallbackPontos) || 0;
  return calculado;
}

// Retorna se os pontos vieram do fallback da planilha (para destacar no detalhe)
function isFallbackPlanilha(tipo, nivelTexto, cargo) {
  const chave = NIVEL_PARA_CHAVE[(nivelTexto || '').toLowerCase().trim()] || '1';
  return pontosSai(tipo, chave, cargo) === 0;
}

// Nivel do banco: 1=Baixa, 2=Media, 3=Alta, 4=Extra Alta, null→Baixa
const NIVEL_DB_LABEL = { 1: 'Baixa', 2: 'M\u00e9dia', 3: 'Alta', 4: 'Extra Alta' };

function nivelDbLabel(n) { return NIVEL_DB_LABEL[n] || null; }

function resolverNivel(iSai, nivelAlteracao) {
  const ov = getOverrides()[String(iSai)];
  return ov ? ov.chave : String(nivelAlteracao || 1);
}

// Agrega rows do queryPontosDefinicao (banco) em { uid -> { mes -> { pontos, qtd_sais } } }
// cargoMap: { codigo_sgd -> senioridade }
function agruparPontosDb(rows, cargoMap) {
  const m = {};
  rows.forEach(r => {
    const uid = r.i_usuarios, mes = r.mes;
    const cargo = cargoMap[uid] || 'pleno';
    const nivelChave = resolverNivel(r.i_sai, r.nivel_alteracao);
    const pts = pontosSai(r.tipoSAI, nivelChave, cargo);
    if (!m[uid]) m[uid] = {};
    if (!m[uid][mes]) m[uid][mes] = { pontos: 0, qtd_sais: 0 };
    m[uid][mes].pontos += pts;
    m[uid][mes].qtd_sais++;
  });
  return m;
}

function agruparPontosDbAnalista(rows, cargo) {
  const m = {};
  rows.forEach(r => {
    const uid = r.i_usuarios, mes = r.mes;
    const nivelChave = resolverNivel(r.i_sai, r.nivel_alteracao);
    const pts = pontosSai(r.tipoSAI, nivelChave, cargo);
    if (!m[uid]) m[uid] = {};
    if (!m[uid][mes]) m[uid][mes] = { pontos: 0, qtd_sais: 0 };
    m[uid][mes].pontos += pts;
    m[uid][mes].qtd_sais++;
  });
  return m;
}

// Agrega rows de queryPontosGerados (sai.i_usuarios = codigo-sgd) usando cargo do analista
function agruparPontosGerados(rows, cargo) {
  const m = {};
  rows.forEach(r => {
    const chave = r.codigo_sgd || r.i_usuarios, mes = r.mes;
    const pts = pontosSai(r.tipoSAI, String(r.nivel_alteracao || 1), cargo);
    if (!m[chave]) m[chave] = {};
    if (!m[chave][mes]) m[chave][mes] = { pontos: 0, qtd_sais: 0 };
    m[chave][mes].pontos += pts;
    m[chave][mes].qtd_sais++;
  });
  return m;
}

module.exports = {
  pontosSai, nivelLabel, nivelDbLabel, pontosPlanilha, isFallbackPlanilha,
  agruparPontosNivel, agruparPontosNivelAnalista, agruparPontosDb, agruparPontosDbAnalista,
  agruparPontosGerados, getOverrides, limparCacheOverrides
};
