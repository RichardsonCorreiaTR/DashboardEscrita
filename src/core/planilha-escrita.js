/**
 * planilha-escrita.js - Leitor da planilha de acompanhamento SAIs 2026
 *
 * Le o arquivo data/planilha-escrita-2026.xlsm e retorna SAIs por mes/analista.
 * Cache em memoria (recarrega se o arquivo mudar).
 */

const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const PLANILHA_PATH = path.join(__dirname, '..', '..', 'data', 'planilha-escrita-2026.xlsm');
const EQUIPE_PATH = path.join(__dirname, '..', '..', 'config', 'equipe.json');
const MESES_NOMES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

let _cache = null;
let _mtimCache = null;
let _primeirosRepetidos = null;

async function carregarWorkbook() {
  const mtime = fs.existsSync(PLANILHA_PATH) ? fs.statSync(PLANILHA_PATH).mtimeMs : null;
  if (_cache && _mtimCache === mtime) return _cache;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(PLANILHA_PATH);
  _cache = wb;
  _mtimCache = mtime;
  return wb;
}

function encontrarHeaderRow(sheet) {
  let headerRow = null, headerNum = 0;
  sheet.eachRow((row, rn) => {
    if (headerRow) return;
    let hasSAI = false, hasTipo = false;
    row.eachCell(c => {
      if (String(c.value || '') === 'SAI') hasSAI = true;
      if (String(c.value || '').includes('Tipo')) hasTipo = true;
    });
    if (hasSAI && hasTipo) { headerRow = rn; }
  });
  return headerRow;
}

function parsearLinha(row) {
  const cel = col => String(row.getCell(col).value || '').trim();
  const num = col => { const v = parseFloat(String(row.getCell(col).value || '').replace(',', '.')); return isNaN(v) ? null : v; };
  const i_sai = parseInt(cel(4), 10);
  if (!i_sai || isNaN(i_sai)) return null;
  return {
    i_sai,
    i_psai: parseInt(cel(2), 10) || null,
    tipoSAI: cel(5),
    modulo: cel(6),
    responsavel_psai: cel(8),
    responsavel_sai: cel(9),
    nivel: cel(11),
    nivel_analista: cel(16),
    pontos: num(17),
    qtdTramite: num(12)
  };
}

async function obterSaisPorMes(mes) {
  if (!fs.existsSync(PLANILHA_PATH)) return [];
  const wb = await carregarWorkbook();
  const nomeMes = MESES_NOMES[mes];
  const sheet = wb.getWorksheet(nomeMes);
  if (!sheet) return [];
  const headerNum = encontrarHeaderRow(sheet);
  if (!headerNum) return [];
  const rows = [];
  sheet.eachRow((row, rn) => {
    if (rn <= headerNum) return;
    const parsed = parsearLinha(row);
    if (parsed) rows.push(parsed);
  });
  return rows;
}

function normalizarNome(nome) {
  return (nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function partesNome(nome) {
  return normalizarNome(nome).split(/\s+/).filter(Boolean);
}

// Primeiros nomes repetidos na equipe (ex.: duas Rafaelas): nesses casos
// o primeiro nome nao identifica a pessoa e o sobrenome passa a ser exigido.
function primeirosNomesRepetidos() {
  if (_primeirosRepetidos) return _primeirosRepetidos;
  const contagem = {};
  try {
    const equipe = JSON.parse(fs.readFileSync(EQUIPE_PATH, 'utf8'));
    (equipe.analistas || []).forEach(a => {
      new Set([partesNome(a.apelido)[0], partesNome(a.nome)[0]].filter(Boolean))
        .forEach(p => { contagem[p] = (contagem[p] || 0) + 1; });
    });
  } catch { /* sem config: mantem comportamento permissivo */ }
  _primeirosRepetidos = new Set(Object.keys(contagem).filter(p => contagem[p] > 1));
  return _primeirosRepetidos;
}

function encontrarNomePlanilha(analista) {
  const apelido = normalizarNome(analista.apelido);
  const nomeCompleto = normalizarNome(analista.nome);
  const termos = new Set([...partesNome(analista.apelido), ...partesNome(analista.nome)]);
  const primeiros = new Set([partesNome(analista.apelido)[0], partesNome(analista.nome)[0]].filter(Boolean));
  const repetidos = primeirosNomesRepetidos();
  const homonimo = [...primeiros].some(p => repetidos.has(p));
  return row => {
    // Pontos Definicao = responsabilidade do PSAI (quem definiu/analisou)
    const resp = normalizarNome(row.responsavel_psai);
    if (!resp) return false;
    if (resp === apelido || resp === nomeCompleto) return true;
    const partes = resp.split(/\s+/).filter(Boolean);
    if (!primeiros.has(partes[0])) return false;
    if (!homonimo) return true;
    return partes.slice(1).some(p => termos.has(p));
  };
}

async function obterSaisAnalista(mes, analista) {
  const rows = await obterSaisPorMes(mes);
  const matcher = encontrarNomePlanilha(analista);
  return rows.filter(matcher);
}

module.exports = { obterSaisPorMes, obterSaisAnalista, PLANILHA_PATH };
