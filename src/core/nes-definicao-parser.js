/**
 * nes-definicao-parser.js - Parseia Excel de NEs com Definicao
 * Le apenas abas "* Escrita*" e retorna dados estruturados por versao e analista.
 */
const ExcelJS = require('exceljs');

const NOME_SLUG = {
  'felipi': 'felipi', 'felipi ferreira': 'felipi',
  'fabio': 'fabio', 'fabio coral': 'fabio',
  'giovani': 'giovani', 'giovani cunha': 'giovani',
  'jennifer': 'jennifer', 'jennifer rodrigues': 'jennifer',
  'victor': 'victor', 'victor ferreira': 'victor',
  'barbara melo': 'barbara-melo', 'barbara mello': 'barbara-melo',
  'carolina': 'carolina', 'daniela': 'daniela',
  'erick': 'erick', 'flavia': 'flavia', 'flavia cardoso': 'flavia',
  'mateus': 'mateus', 'mateus alves': 'mateus',
  'bruna': 'bruna', 'bruna ferro': 'bruna',
  'patricia': 'patricia', 'patricia costa': 'patricia',
  'patricia machado': 'patricia', 'patricia macedo': 'patricia',
  'barbara leite': 'barbara-leite',
  'gabriely': 'gabriely', 'gabriely marques': 'gabriely',
  'juliana': 'juliana', 'juliana kuerten': 'juliana',
  'lais': 'laysa', 'laysa': 'laysa',
  'rafaela ribeiro': 'rafaela-ribeiro',
  'rafaela sampaio': 'rafaela-sampaio',
  'renan': 'renan', 'sabrine': 'sabrine', 'sabrina': 'sabrine',
  'vinicyos': 'vinicyos',
  'richardson': 'richardson', 'marielli': 'marielli',
};

const MESES_ABREV = {
  'janeiro': 'Jan', 'fevereiro': 'Fev', 'favereiro': 'Fev',
  'marco': 'Mar', 'março': 'Mar', 'abril': 'Abr', 'maio': 'Mai',
  'junho': 'Jun', 'julho': 'Jul', 'agosto': 'Ago',
  'setembro': 'Set', 'outubro': 'Out', 'novembro': 'Nov', 'dezembro': 'Dez'
};

function cellText(cell) {
  if (!cell || cell.value === null || cell.value === undefined) return null;
  const v = cell.value;
  if (typeof v === 'object') {
    if (v.text !== undefined) return String(v.text).trim();
    if (v.result !== undefined) return v.result;
  }
  return String(v).trim();
}

function normalizarNome(nome) {
  if (!nome || nome === '-' || nome === 'null' || nome === '') return null;
  return nome.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function nomeParaSlug(nome) {
  if (!nome) return null;
  const normalized = normalizarNome(nome);
  if (!normalized || normalized === '-') return null;
  // Handle "Nome/Outro" → pega o primeiro
  const primeiro = normalized.split('/')[0].trim();
  return NOME_SLUG[primeiro] || NOME_SLUG[normalized] || null;
}

function parseTitulo(titulo) {
  if (!titulo) return {};
  const verMatch = titulo.match(/\(([0-9]+\.[0-9]+[A-Z]-[0-9]+)\)/i);
  const mesMatch = titulo.match(/vers[aã]o de ([A-ZÁÀÂÃÉÈÊÍÓÔÕÚÇ]+)\/(\d{4})/i);
  const mes = mesMatch ? mesMatch[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : null;
  const abrev = mes ? (MESES_ABREV[mes] || mes.slice(0, 3)) : null;
  return {
    versao: verMatch ? verMatch[1] : null,
    label: abrev && mesMatch ? `${abrev}/${mesMatch[2].slice(2)} (${verMatch ? verMatch[1] : ''})` : null,
    ano: mesMatch ? parseInt(mesMatch[2]) : null,
  };
}

function parseAba(ws) {
  const titulo = cellText(ws.getRow(1).getCell(1));
  const info = parseTitulo(titulo);
  const nes = [];
  const totais = { total_liberadas: 0, com_definicao: 0 };

  ws.eachRow((row, n) => {
    if (n < 4) return;
    const col1 = cellText(row.getCell(1));
    if (!col1) return;
    if (String(col1).toLowerCase().includes('total de nes')) {
      totais.total_liberadas = parseInt(cellText(row.getCell(3))) || 0;
      return;
    }
    if (String(col1).toLowerCase().includes("ne's com defini")) {
      totais.com_definicao = parseInt(cellText(row.getCell(3))) || 0;
      return;
    }
    // Linha de NE (col1 é numero ou hyperlink de numero)
    const neNum = parseInt(col1);
    if (!neNum || isNaN(neNum)) return;
    const psai = cellText(row.getCell(5));
    const sai = cellText(row.getCell(6));
    const analise = cellText(row.getCell(7));
    const gravidade = cellText(row.getCell(8));
    const slugPsai = nomeParaSlug(psai);
    nes.push({
      ne: neNum,
      responsavel_psai: psai || null,
      responsavel_psai_slug: slugPsai,
      responsavel_sai: sai || null,
      analise: analise || null,
      grave: gravidade ? gravidade.toLowerCase().includes('grav') : false,
    });
  });

  return { ...info, nome_aba: ws.name, nes, totais };
}

async function parsearExcel(caminhoArquivo) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(caminhoArquivo);

  const versoes = [];
  wb.worksheets.forEach(ws => {
    if (!ws.name.toLowerCase().includes('escrita')) return;
    const dados = parseAba(ws);
    if (dados.versao || dados.nes.length) versoes.push(dados);
  });

  // Agregar por analista
  const porAnalista = {};
  versoes.forEach(v => {
    v.nes.forEach(ne => {
      const slug = ne.responsavel_psai_slug;
      if (!slug) return;
      if (!porAnalista[slug]) porAnalista[slug] = {};
      const label = v.label || v.nome_aba;
      if (!porAnalista[slug][label]) porAnalista[slug][label] = [];
      porAnalista[slug][label].push(ne);
    });
  });

  return {
    versoes,
    por_analista: porAnalista,
    labels: versoes.map(v => v.label || v.nome_aba),
    gerado_em: new Date().toISOString()
  };
}

module.exports = { parsearExcel };
