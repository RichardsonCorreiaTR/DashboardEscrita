/**
 * analise-classificacoes.js - Agregacao dos dados de classificacao IA
 *
 * Le contexto-consolidado.json + lotes de entrada/auto por versao
 * e fornece dados prontos para os dashboards.
 */

const fs = require('fs');
const path = require('path');
const metaSais = require('./metadata-sais');

const IA_DIR = path.join(__dirname, '..', '..', '..', 'data', 'ia');
const CONTEXTO_PATH = path.join(IA_DIR, 'contexto-consolidado.json');

const PESO_COMPLEX = { trivial: 1, baixa: 2, media: 3, alta: 4, sistemica: 5 };
const PESO_RISCO = { baixo: 1, medio: 2, alto: 3, critico: 4 };

const LABELS_AREA = {
  motor_calculo: 'Motor de Calculo', api_esocial: 'eSocial',
  integracao_contabil: 'Integ. Contabil', processamento_lote: 'Proc. em Lote',
  relatorio: 'Relatorios', relatorios: 'Relatorios',
  importacao_exportacao: 'Import/Export', parametrizacao: 'Parametrizacao',
  interface_web: 'Interface Web', interface_usuario: 'Interface',
  banco_dados: 'Banco de Dados', autenticacao: 'Autenticacao',
  cadastros: 'Cadastros', seguranca: 'Seguranca',
  obrigacoes_acessorias: 'Obrig. Acessorias', beneficios: 'Beneficios',
  sem_classificacao: 'Sem classif.'
};

let _cache = null;

function carregar() {
  if (_cache) return _cache;
  if (!fs.existsSync(CONTEXTO_PATH)) return null;

  const porPsai = JSON.parse(fs.readFileSync(CONTEXTO_PATH, 'utf-8')).por_psai || {};
  const files = fs.readdirSync(IA_DIR);
  const versoes = {};

  for (const f of files.filter(f => /^lote-entrada-.+\.json$/.test(f))) {
    const lote = JSON.parse(fs.readFileSync(path.join(IA_DIR, f), 'utf-8'));
    const v = lote.versao;
    if (!versoes[v]) versoes[v] = [];
    for (const it of (lote.itens || [])) {
      versoes[v].push(mesclar(it, porPsai[String(it.i_psai)], v));
    }
  }

  for (const f of files.filter(f => /^classificados-auto-.+\.json$/.test(f))) {
    const auto = JSON.parse(fs.readFileSync(path.join(IA_DIR, f), 'utf-8'));
    const v = auto.versao;
    if (!versoes[v]) versoes[v] = [];
    for (const it of (auto.itens || [])) {
      const c = porPsai[String(it.i_psai)] || it;
      versoes[v].push({
        i_psai: it.i_psai, tipo: null, versao: v,
        descricao: '', tags: [], gravidade: null,
        area_tecnica: c.area_tecnica || null,
        complexidade_real: c.complexidade_real || null,
        risco_regressao: c.risco_regressao || null,
        escopo_impacto: c.escopo_impacto || null,
        resumo_tecnico: null, pontos_criticos: [], fonte: 'auto'
      });
    }
  }

  const meta = metaSais.carregar();
  for (const lista of Object.values(versoes)) {
    for (const item of lista) {
      const m = meta[item.i_psai];
      if (!m) continue;
      item.i_sai = item.i_sai || m.i_sai;
      item.tipo = item.tipo || m.tipo;
      item.descricao = item.descricao || m.descricao;
      item.status = m.status;
      item.gravidade = item.gravidade || m.gravidade;
    }
  }

  const total = Object.values(versoes).reduce((s, v) => s + v.length, 0);
  _cache = { versoes, total };
  return _cache;
}

function mesclar(item, classif, versao) {
  const c = classif || {};
  return {
    i_psai: item.i_psai, tipo: item.tipo, versao,
    descricao: item.descricao || '', tags: item.tags || [],
    gravidade: item.gravidade,
    area_tecnica: c.area_tecnica || null,
    complexidade_real: c.complexidade_real || null,
    risco_regressao: c.risco_regressao || null,
    escopo_impacto: c.escopo_impacto || null,
    resumo_tecnico: c.resumo_tecnico || null,
    pontos_criticos: c.pontos_criticos || [],
    fonte: c._fonte || 'ia'
  };
}

function invalidarCache() { _cache = null; }

function listarVersoes() {
  const d = carregar();
  return d ? Object.keys(d.versoes).sort() : [];
}

function raioXVersao(versao) {
  const d = carregar();
  if (!d) return { erro: 'Sem dados de classificacao' };
  const sais = d.versoes[versao];
  if (!sais || sais.length === 0) return { erro: 'Versao sem dados: ' + versao };

  const total = sais.length;
  const altoRisco = s => s.risco_regressao === 'alto' || s.risco_regressao === 'critico';
  const altaComplex = s => s.complexidade_real === 'alta' || s.complexidade_real === 'sistemica';

  const ordenadas = [...sais].sort((a, b) =>
    (PESO_RISCO[b.risco_regressao] || 0) - (PESO_RISCO[a.risco_regressao] || 0)
  );

  return {
    versao, total,
    idx_complexidade: mediaIdx(sais, 'complexidade_real', PESO_COMPLEX),
    idx_risco: mediaIdx(sais, 'risco_regressao', PESO_RISCO),
    pct_alto_risco: pct(sais, altoRisco),
    total_criticas: sais.filter(s => altoRisco(s) || altaComplex(s)).length,
    complexidades: contar(sais, 'complexidade_real'),
    riscos: contar(sais, 'risco_regressao'),
    areas: contar(sais, 'area_tecnica'),
    sais: ordenadas.map(resumirSai)
  };
}

function evolucao() {
  const d = carregar();
  if (!d) return [];
  const altoRisco = s => s.risco_regressao === 'alto' || s.risco_regressao === 'critico';

  return Object.keys(d.versoes).sort().map(v => {
    const sais = d.versoes[v];
    if (sais.length === 0) return { versao: v, total: 0 };
    return {
      versao: v, total: sais.length,
      idx_complexidade: mediaIdx(sais, 'complexidade_real', PESO_COMPLEX),
      idx_risco: mediaIdx(sais, 'risco_regressao', PESO_RISCO),
      pct_alto_risco: pct(sais, altoRisco),
      areas: contarTop(sais, 'area_tecnica', 5)
    };
  });
}

function dnaTecnico() {
  const d = carregar();
  if (!d) return [];
  const todas = Object.values(d.versoes).flat();
  const porArea = {};
  for (const s of todas) {
    const a = s.area_tecnica || 'sem_classificacao';
    (porArea[a] = porArea[a] || []).push(s);
  }
  const totalGeral = todas.length;
  const altoRisco = s => s.risco_regressao === 'alto' || s.risco_regressao === 'critico';

  return Object.entries(porArea)
    .map(([area, sais]) => ({
      area, label: LABELS_AREA[area] || area,
      total: sais.length,
      pct: Math.round(sais.length / totalGeral * 100),
      idx_complexidade: mediaIdx(sais, 'complexidade_real', PESO_COMPLEX),
      idx_risco: mediaIdx(sais, 'risco_regressao', PESO_RISCO),
      pct_alto_risco: pct(sais, altoRisco),
      escopos: contar(sais, 'escopo_impacto')
    }))
    .sort((a, b) => b.total - a.total);
}

function resumirSai(s) {
  const ar = s.risco_regressao === 'alto' || s.risco_regressao === 'critico';
  const ac = s.complexidade_real === 'alta' || s.complexidade_real === 'sistemica';
  return {
    i_psai: s.i_psai, i_sai: s.i_sai || null, tipo: s.tipo,
    descricao: s.descricao, status: s.status || '',
    complexidade: s.complexidade_real, risco: s.risco_regressao,
    area: s.area_tecnica, resumo: s.resumo_tecnico,
    critico: ar || ac
  };
}

function contar(arr, campo) {
  const m = {};
  for (const i of arr) m[i[campo] || 'N/A'] = (m[i[campo] || 'N/A'] || 0) + 1;
  return m;
}

function contarTop(arr, campo, n) {
  return Object.entries(contar(arr, campo))
    .sort((a, b) => b[1] - a[1]).slice(0, n)
    .reduce((o, [k, v]) => { o[k] = v; return o; }, {});
}

function mediaIdx(arr, campo, pesos) {
  let soma = 0, n = 0;
  for (const i of arr) { const p = pesos[i[campo]]; if (p !== undefined) { soma += p; n++; } }
  return n > 0 ? Math.round(soma / n * 10) / 10 : 0;
}

function pct(arr, fn) {
  return arr.length > 0 ? Math.round(arr.filter(fn).length / arr.length * 100) : 0;
}

module.exports = {
  carregar, invalidarCache, listarVersoes,
  raioXVersao, evolucao, dnaTecnico, LABELS_AREA
};
