/**
 * scripts/importar-classificacao-ia.js - Importa e consolida classificacoes da IA
 *
 * Uso: node scripts/importar-classificacao-ia.js <versao>
 * Ex:  node scripts/importar-classificacao-ia.js 10.6A-01
 *
 * Valida o JSON gerado pela IA, merge com classificacoes automaticas,
 * e atualiza o contexto consolidado.
 */

const fs = require('fs');
const path = require('path');

const IA_DIR = path.join(__dirname, '..', 'data', 'ia');
const CONSOLIDADO_PATH = path.join(IA_DIR, 'contexto-consolidado.json');
const CONTROLE_PATH = path.join(IA_DIR, 'controle-enriquecimento.json');

const VALORES_VALIDOS = {
  tipo_causa_raiz: ['logica', 'edge_case', 'regressao', 'performance',
    'integracao', 'legislacao', 'dados', 'configuracao', 'ambiente', null],
  area_tecnica: ['motor_calculo', 'interface_web', 'relatorio',
    'importacao_exportacao', 'api_esocial', 'banco_dados',
    'integracao_contabil', 'autenticacao', 'processamento_lote',
    'parametrizacao', null],
  complexidade_real: ['trivial', 'baixa', 'media', 'alta', 'sistemica', null],
  risco_regressao: ['baixo', 'medio', 'alto', 'critico', null],
  escopo_impacto: ['pontual', 'modulo', 'transversal', null],
  padrao_recorrencia: ['novo', 'variacao_existente',
    'regressao_correcao_anterior', null]
};

function validarItem(item, idx) {
  const erros = [];
  if (!item.i_psai) erros.push(`Item ${idx}: i_psai ausente`);
  for (const [campo, validos] of Object.entries(VALORES_VALIDOS)) {
    if (item[campo] !== undefined && item[campo] !== null && !validos.includes(item[campo])) {
      erros.push(`Item ${idx} (PSAI ${item.i_psai}): ${campo}="${item[campo]}" invalido`);
    }
  }
  if (item.confianca !== undefined) {
    const c = Number(item.confianca);
    if (isNaN(c) || c < 1 || c > 5) {
      erros.push(`Item ${idx} (PSAI ${item.i_psai}): confianca=${item.confianca} fora de 1-5`);
    }
  }
  return erros;
}

function carregarLoteIA(versao) {
  const lotePath = path.join(IA_DIR, `lote-classificacao-${versao}.json`);
  if (!fs.existsSync(lotePath)) {
    console.error('[importar] Arquivo nao encontrado: %s', lotePath);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(lotePath, 'utf-8'));
}

function carregarAutoClassificados(versao) {
  const autoPath = path.join(IA_DIR, `classificados-auto-${versao}.json`);
  if (!fs.existsSync(autoPath)) return { itens: [] };
  return JSON.parse(fs.readFileSync(autoPath, 'utf-8'));
}

function validarLote(lote) {
  const erros = [];
  if (!lote.itens || !Array.isArray(lote.itens)) {
    console.error('[importar] Formato invalido: campo "itens" ausente ou nao e array');
    process.exit(1);
  }
  for (let i = 0; i < lote.itens.length; i++) {
    erros.push(...validarItem(lote.itens[i], i));
  }
  return erros;
}

function mergeClassificacoes(auto, ia) {
  const mapa = {};
  for (const item of auto) mapa[item.i_psai] = { ...item, _fonte: 'auto' };
  for (const item of ia) mapa[item.i_psai] = { ...item, _fonte: 'ia' };
  return mapa;
}

function atualizarConsolidado(versao, mapa) {
  let consolidado = { atualizado_em: null, por_psai: {}, por_versao: {} };
  try {
    if (fs.existsSync(CONSOLIDADO_PATH)) {
      consolidado = JSON.parse(fs.readFileSync(CONSOLIDADO_PATH, 'utf-8'));
    }
  } catch { /* novo */ }

  for (const [psai, classif] of Object.entries(mapa)) {
    consolidado.por_psai[psai] = classif;
  }
  if (!consolidado.por_versao) consolidado.por_versao = {};
  consolidado.por_versao[versao] = {
    total: Object.keys(mapa).length,
    importado_em: new Date().toISOString()
  };
  consolidado.atualizado_em = new Date().toISOString();
  consolidado.total_classificados = Object.keys(consolidado.por_psai).length;

  fs.writeFileSync(CONSOLIDADO_PATH, JSON.stringify(consolidado, null, 2), 'utf-8');
  console.log('[importar] Consolidado atualizado: %d total', consolidado.total_classificados);
}

function atualizarControle(versao, qtdeIA) {
  let controle = { versoes: {} };
  try {
    if (fs.existsSync(CONTROLE_PATH)) {
      controle = JSON.parse(fs.readFileSync(CONTROLE_PATH, 'utf-8'));
    }
  } catch { /* novo */ }

  if (controle.versoes[versao]) {
    controle.versoes[versao].classificados_ia = qtdeIA;
    controle.versoes[versao].status = 'completa';
    controle.versoes[versao].importado_em = new Date().toISOString();
  }
  controle.atualizado_em = new Date().toISOString();
  fs.writeFileSync(CONTROLE_PATH, JSON.stringify(controle, null, 2), 'utf-8');
}

function importar(versao) {
  const loteIA = carregarLoteIA(versao);
  const erros = validarLote(loteIA);
  if (erros.length > 0) {
    console.error('[importar] %d erros de validacao:', erros.length);
    erros.forEach(e => console.error('  - %s', e));
    console.error('[importar] Corrija e rode novamente.');
    process.exit(1);
  }

  const auto = carregarAutoClassificados(versao);
  const mapa = mergeClassificacoes(auto.itens || [], loteIA.itens);
  atualizarConsolidado(versao, mapa);
  atualizarControle(versao, loteIA.itens.length);

  console.log('[importar] Versao %s importada: %d auto + %d IA = %d total',
    versao, (auto.itens || []).length, loteIA.itens.length, Object.keys(mapa).length);
}

const versao = process.argv[2];
if (!versao) {
  console.error('Uso: node scripts/importar-classificacao-ia.js <versao>');
  process.exit(1);
}
importar(versao);
