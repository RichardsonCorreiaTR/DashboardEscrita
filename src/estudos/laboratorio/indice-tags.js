/**
 * laboratorio/indice-tags.js - Indexa tags do BuscaSaiFolha
 *
 * Parseia _INDICE-NE.md, _INDICE-SAM.md, _INDICE-SAL.md, _INDICE-SAIL.md
 * e gera data/cache/lab-indice-tags.json com mapa PSAI->tags e SAI->PSAI.
 *
 * NAO precisa de ODBC. Roda offline.
 */

const fs = require('fs');
const path = require('path');

const BUSCA_SAI_DIR = path.join(
  'C:', 'Users', '6038243',
  'OneDrive - Thomson Reuters Incorporated',
  'Aplicacoes Cursor', 'BuscaSaiFolha', 'data', 'sais'
);

const CACHE_DIR = path.join(__dirname, '..', '..', '..', 'data', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'lab-indice-tags.json');
const RE_PSAI = /\*\*PSAI (\d+)(?: \/ SAI (\d+))?\*\*/;

const INDICES = [
  { arquivo: '_INDICE-NE.md', tipo: 'NE' },
  { arquivo: '_INDICE-SAM.md', tipo: 'SAM' },
  { arquivo: '_INDICE-SAL.md', tipo: 'SAL' },
  { arquivo: '_INDICE-SAIL.md', tipo: 'SAIL' }
];

function parsearLinha(linha, tipo) {
  const m = RE_PSAI.exec(linha);
  if (!m) return null;
  const iPsai = m[1];
  const iSai = m[2] ? parseInt(m[2], 10) : null;
  const resto = linha.replace(RE_PSAI, '').replace(/^[\s\-|]+/, '');
  const partes = resto.split(' | ').map(s => s.trim()).filter(Boolean);
  if (partes.length < 3) return null;

  const gravidade = partes[0];
  const status = partes[1];
  const competencia = partes.length >= 4 ? partes[3] : partes[2];
  const tagsRaw = partes.length >= 5 ? partes.slice(4).join(', ') : '';
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  return { iPsai, iSai, tipo, gravidade, status, competencia, tags };
}

function parsearArquivo(nomeArquivo, tipo) {
  const caminho = path.join(BUSCA_SAI_DIR, nomeArquivo);
  if (!fs.existsSync(caminho)) {
    console.warn('[indice-tags] Arquivo nao encontrado: %s', caminho);
    return [];
  }
  const linhas = fs.readFileSync(caminho, 'utf-8').split('\n');
  const registros = [];
  for (const linha of linhas) {
    if (!linha.startsWith('- **PSAI')) continue;
    const reg = parsearLinha(linha, tipo);
    if (reg) registros.push(reg);
  }
  console.log('[indice-tags] %s: %d registros', nomeArquivo, registros.length);
  return registros;
}

function construirIndice() {
  const porPsai = {};
  const porSai = {};
  const contagemTags = {};

  for (const { arquivo, tipo } of INDICES) {
    const registros = parsearArquivo(arquivo, tipo);
    for (const r of registros) {
      porPsai[r.iPsai] = {
        i_sai: r.iSai, tipo: r.tipo, tags: r.tags,
        gravidade: r.gravidade, status: r.status, competencia: r.competencia
      };
      if (r.iSai) porSai[r.iSai] = parseInt(r.iPsai, 10);
      contarTags(contagemTags, r.tags, r.tipo);
    }
  }

  const resumoTags = montarResumoTags(contagemTags);
  return { porPsai, porSai, resumoTags };
}

function contarTags(contagem, tags, tipo) {
  for (const tag of tags) {
    if (!contagem[tag]) contagem[tag] = { total: 0, NE: 0, SAM: 0, SAL: 0, SAIL: 0 };
    contagem[tag].total++;
    if (contagem[tag][tipo] !== undefined) contagem[tag][tipo]++;
  }
}

function montarResumoTags(contagem) {
  const entries = Object.entries(contagem);
  entries.sort((a, b) => b[1].total - a[1].total);
  const resumo = {};
  for (const [tag, dados] of entries) resumo[tag] = dados;
  return resumo;
}

function gerar() {
  const { porPsai, porSai, resumoTags } = construirIndice();
  const resultado = {
    _meta: {
      versao_schema: 1,
      gerado_em: new Date().toISOString(),
      fonte: 'BuscaSaiFolha',
      total_psai: Object.keys(porPsai).length,
      total_sai: Object.keys(porSai).length,
      total_tags: Object.keys(resumoTags).length
    },
    por_psai: porPsai,
    por_sai: porSai,
    resumo_tags: resumoTags
  };

  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(resultado, null, 2), 'utf-8');
  console.log('[indice-tags] Salvo: %s (%d PSAIs, %d SAIs, %d tags)',
    CACHE_FILE, resultado._meta.total_psai, resultado._meta.total_sai, resultado._meta.total_tags);
  return resultado;
}

function carregar() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  } catch (err) {
    console.warn('[indice-tags] Erro ao carregar cache:', err.message);
    return null;
  }
}

module.exports = { gerar, carregar, CACHE_FILE };
