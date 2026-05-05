/**
 * laboratorio/rastreabilidade.js - Rastreabilidade NE -> SA de origem
 *
 * Query ODBC em UP.sai_ne_com_origem para vincular cada NE
 * a sua SA de origem, cruzando com o indice de tags.
 * Fallback para cache em disco quando ODBC indisponivel.
 */

const fs = require('fs');
const path = require('path');
const indiceTags = require('./indice-tags');

const CACHE_DIR = path.join(__dirname, '..', '..', '..', 'data', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'lab-rastreabilidade.json');

function queryOrigem() {
  return `
    SELECT o.i_sai, o.i_sai_origem, o.cadastroSAI, o.liberacaoSaiOrigem,
           o.nomeArea, o.i_area,
           sp.nomeVersao, sp.tipoSAI, sp.gravidade_ne
    FROM UP.sai_ne_com_origem o
    JOIN UP.SAI_PSAI sp ON sp.i_sai = o.i_sai
    WHERE sp.nomeArea = 'Escrita'
      AND o.cadastroSAI >= '2022-01-01'
    ORDER BY o.cadastroSAI`;
}

function queryTodasSAs() {
  return `
    SELECT sp.i_sai, sp.i_psai, sp.tipoSAI, sp.nomeVersao,
           sp.Liberacao, sp.gravidade_ne,
           psai.nivel_alteracao
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE sp.nomeArea = 'Escrita'
      AND sp.tipoSAI IN ('SAM', 'SAL', 'SAIL')
      AND sp.Liberacao >= '2022-01-01'
      AND COALESCE(psai.i_produto_grupo, 1) = 1`;
}

function calcularDiasDeteccao(cadastroNE, liberacaoOrigem) {
  if (!cadastroNE || !liberacaoOrigem) return null;
  const d1 = new Date(liberacaoOrigem);
  const d2 = new Date(cadastroNE);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

function agruparPorVersao(nes, sas, indice) {
  const porVersao = {};
  for (const ne of nes) {
    const v = ne.nomeVersao;
    if (!v) continue;
    if (!porVersao[v]) porVersao[v] = { sas: [], nes: [], stats: {} };
    const tagsOrigem = buscarTagsOrigem(ne.i_sai_origem, indice);
    porVersao[v].nes.push({
      i_sai: ne.i_sai, i_sai_origem: ne.i_sai_origem,
      tags_origem: tagsOrigem, gravidade: ne.gravidade_ne,
      dias_deteccao: calcularDiasDeteccao(ne.cadastroSAI, ne.liberacaoSaiOrigem)
    });
  }
  for (const sa of sas) {
    const v = sa.nomeVersao;
    if (!porVersao[v]) porVersao[v] = { sas: [], nes: [], stats: {} };
    const tags = buscarTagsPsai(sa.i_psai, indice);
    porVersao[v].sas.push({
      i_sai: sa.i_sai, i_psai: sa.i_psai, tipo: sa.tipoSAI,
      tags, nivel: sa.nivel_alteracao
    });
  }
  for (const [v, dados] of Object.entries(porVersao)) {
    dados.stats = calcularStats(dados);
  }
  return porVersao;
}

function buscarTagsOrigem(iSaiOrigem, indice) {
  if (!indice || !iSaiOrigem) return [];
  const psai = indice.por_sai[iSaiOrigem];
  if (!psai || !indice.por_psai[psai]) return [];
  return indice.por_psai[psai].tags || [];
}

function buscarTagsPsai(iPsai, indice) {
  if (!indice || !indice.por_psai[iPsai]) return [];
  return indice.por_psai[iPsai].tags || [];
}

function calcularStats(dados) {
  const totalSAs = dados.sas.length;
  const totalNEs = dados.nes.length;
  const comOrigem = dados.nes.filter(n => n.i_sai_origem).length;
  const dias = dados.nes.map(n => n.dias_deteccao).filter(d => d !== null);
  const mediaDias = dias.length > 0
    ? Math.round(dias.reduce((s, d) => s + d, 0) / dias.length) : null;
  return {
    totalSAs, totalNEs, comOrigem,
    semOrigem: totalNEs - comOrigem,
    taxaNeSa: totalSAs > 0 ? Math.round((totalNEs / totalSAs) * 100) / 100 : null,
    mediaDiasDeteccao: mediaDias
  };
}

async function coletar(executor) {
  const indice = indiceTags.carregar();
  if (!indice) {
    console.warn('[rastreab] Indice de tags nao disponivel. Rode indice-tags.gerar() primeiro.');
  }

  const [nes, todasSAs] = await Promise.all([
    executor.executar(queryOrigem()),
    executor.executar(queryTodasSAs())
  ]);
  console.log('[rastreab] %d NEs com dados de origem, %d SAs liberadas', nes.length, todasSAs.length);

  const porVersao = agruparPorVersao(nes, todasSAs, indice);
  const resultado = {
    _meta: {
      versao_schema: 1, gerado_em: new Date().toISOString(),
      total_nes: nes.length, total_sas: todasSAs.length,
      versoes: Object.keys(porVersao).length
    },
    por_versao: porVersao
  };

  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(resultado, null, 2), 'utf-8');
  console.log('[rastreab] Salvo: %s', CACHE_FILE);
  return resultado;
}

function carregar() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  } catch (err) {
    console.warn('[rastreab] Erro ao carregar cache:', err.message);
    return null;
  }
}

module.exports = { coletar, carregar, CACHE_FILE };
