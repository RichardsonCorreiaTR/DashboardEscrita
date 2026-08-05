/**
 * pontos-credito.js - Credito compartilhado de SAI (config/pontos-overrides.json)
 * Duplica a SAI para para_slug; a origem (de_slug) continua contando.
 */
const fs = require('fs');
const path = require('path');
const pontosCalc = require('./pontos-calculador');

const OVERRIDES_PATH = path.join(__dirname, '..', '..', '..', 'config', 'pontos-overrides.json');
const EQUIPE_PATH = path.join(__dirname, '..', '..', '..', 'config', 'equipe.json');

let _cache = null;
let _mtime = null;

function slugParaSgd() {
  const eq = JSON.parse(fs.readFileSync(EQUIPE_PATH, 'utf8'));
  const m = {};
  (eq.analistas || []).forEach(a => { m[a.slug] = Number(a['codigo-sgd']); });
  return m;
}

function carregarCreditos() {
  try {
    const raw = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8'));
    const slugs = slugParaSgd();
    return (raw.creditos || [])
      .filter(c => c.conferido && c.i_sai && c.para_slug)
      .map(c => ({
        i_sai: Number(c.i_sai),
        i_psai: c.i_psai ? Number(c.i_psai) : null,
        de_sgd: c.de_slug ? slugs[c.de_slug] : null,
        para_sgd: slugs[c.para_slug],
        ano: c.ano ? Number(c.ano) : null,
        mes: c.mes ? Number(c.mes) : null,
        motivo: c.motivo || ''
      }))
      .filter(c => c.para_sgd);
  } catch (_) { return []; }
}

function getCreditos() {
  let mtime = null;
  try { mtime = fs.statSync(OVERRIDES_PATH).mtimeMs; } catch (_) {}
  if (!_cache || mtime !== _mtime) {
    _cache = carregarCreditos();
    _mtime = mtime;
  }
  return _cache;
}

function saisCreditoPara(sgd) {
  return getCreditos().filter(c => c.para_sgd === Number(sgd)).map(c => c.i_sai);
}

/** Mantem origem e duplica row para para_sgd (compartilha pontos+qtd). */
function aplicarNasRows(rows) {
  const bySai = {};
  getCreditos().forEach(c => { bySai[c.i_sai] = c; });
  if (!Object.keys(bySai).length) return rows;
  const out = [];
  rows.forEach(r => {
    out.push(r);
    const c = bySai[Number(r.i_sai)];
    if (!c) return;
    if (c.de_sgd && Number(r.i_usuarios) !== c.de_sgd) return;
    if (Number(r.i_usuarios) === c.para_sgd) return;
    out.push({
      ...r,
      i_usuarios: c.para_sgd,
      mes: c.mes || r.mes,
      _credito: true
    });
  });
  return out;
}

function queryPontosPorSais(ano, sais) {
  if (!sais.length) return null;
  return `
    SELECT p.i_responsaveis as i_usuarios, MONTH(sp.CadastroSAI) as mes,
      sp.i_sai, sp.tipoSAI, p.nivel_alteracao
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.nomeArea IN ('Escrita', 'Importacao', 'ONVIO ESCRITA')
      AND YEAR(sp.CadastroSAI) = ${ano}
      AND sp.i_sai IN (${sais.join(',')})
  `;
}

function queryDetalhePorSais(ano, sais) {
  if (!sais.length) return null;
  return `
    SELECT sp.i_sai, sp.tipoSAI, sp.CadastroSAI, p.nivel_alteracao
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    WHERE sp.nomeArea IN ('Escrita', 'Importacao', 'ONVIO ESCRITA')
      AND sp.i_sai IN (${sais.join(',')})
      AND YEAR(sp.CadastroSAI) = ${ano}
  `;
}

async function mesclarPontosAnalista(qe, pontosRaw, sgd, ano) {
  let rows = pontosRaw.slice();
  const receber = saisCreditoPara(sgd);
  if (receber.length) {
    const sql = queryPontosPorSais(ano, receber);
    if (sql) {
      const ja = new Set(rows.map(r => Number(r.i_sai)));
      const extra = (await qe.executar(sql)).filter(r => !ja.has(Number(r.i_sai)));
      rows = rows.concat(extra);
    }
  }
  return aplicarNasRows(rows);
}

function mapearLinhaDetalhe(r, senioridade, credito) {
  const ov = pontosCalc.getOverrides()[String(r.i_sai)];
  const nivelChave = ov ? ov.chave : String(r.nivel_alteracao || 1);
  const nivelTxt = ov
    ? ov.nivel + ' \u270F'
    : (pontosCalc.nivelDbLabel(r.nivel_alteracao) || 'N\u00e3o definido');
  return {
    i_sai: r.i_sai, tipoSAI: r.tipoSAI, CadastroSAI: r.CadastroSAI,
    nivel: credito ? nivelTxt + ' (cr\u00e9dito)' : nivelTxt,
    nivel_alteracao: r.nivel_alteracao,
    nivel_inferido: !r.nivel_alteracao && !ov,
    pontos_fallback: false,
    pontuacao: pontosCalc.pontosSai(r.tipoSAI, nivelChave, senioridade),
    override: !!ov,
    credito: !!credito
  };
}

async function detalhePontosComCredito(qe, detalheSql, a, ano, mes) {
  const sgd = a['codigo-sgd'];
  const rows = await qe.executar(detalheSql.detalhePontos(sgd, ano, mes));
  const base = rows.map(r => mapearLinhaDetalhe(r, a.senioridade, false));

  const receber = getCreditos().filter(c =>
    c.para_sgd === Number(sgd) &&
    (!c.mes || c.mes === Number(mes)) &&
    (!c.ano || c.ano === Number(ano))
  );
  if (!receber.length) return base;
  const sql = queryDetalhePorSais(ano, receber.map(c => c.i_sai));
  if (!sql) return base;
  const extras = await qe.executar(sql);
  const ja = new Set(base.map(x => Number(x.i_sai)));
  extras.forEach(r => {
    if (ja.has(Number(r.i_sai))) return;
    base.push(mapearLinhaDetalhe(r, a.senioridade, true));
  });
  return base;
}

module.exports = {
  getCreditos, aplicarNasRows, saisCreditoPara,
  mesclarPontosAnalista, detalhePontosComCredito, queryPontosPorSais
};
