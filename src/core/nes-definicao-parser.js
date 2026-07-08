/**
 * nes-definicao-parser.js - Parseia Excel de NEs com Definicao
 * Le apenas abas "* Escrita*" e retorna dados estruturados por versao e analista.
 */
const ExcelJS = require('exceljs');

const NOME_SLUG = {
  'felipi': 'felipi', 'felipi ferreira': 'felipi',
  'fabio': 'fabio', 'fabio coral': 'fabio', 'fabio sasso': 'fabio',
  'giovani': 'giovani', 'giovani cunha': 'giovani',
  'jennifer': 'jennifer', 'jennifer rodrigues': 'jennifer',
  'victor': 'victor', 'victor ferreira': 'victor',
  'barbara melo': 'barbara-melo', 'barbara mello': 'barbara-melo', 'barbara teixeira': 'barbara-melo',
  'carolina': 'carolina', 'carolina esmeraldino': 'carolina',
  'daniela': 'daniela', 'daniela stupp': 'daniela', 'daniela ferreira': 'daniela',
  'erick': 'erick', 'erick vicente': 'erick',
  'flavia': 'flavia', 'flavia cardoso': 'flavia', 'flavia felipe': 'flavia',
  'mateus': 'mateus', 'mateus alves': 'mateus',
  'bruna': 'bruna', 'bruna ferro': 'bruna',
  'patricia': 'patricia', 'patricia costa': 'patricia',
  'patricia machado': 'patricia', 'patricia macedo': 'patricia',
  'barbara leite': 'barbara-leite',
  'gabriely': 'gabriely', 'gabriely marques': 'gabriely',
  'juliana': 'juliana', 'juliana kuerten': 'juliana',
  'lais': 'laysa', 'laysa': 'laysa', 'laysa gabriela': 'laysa',
  'rafaela ribeiro': 'rafaela-ribeiro', 'rafaela gubert': 'rafaela-ribeiro',
  'rafaela sampaio': 'rafaela-sampaio', 'rafaela silva': 'rafaela-sampaio',
  'renan': 'renan', 'renan maiato': 'renan',
  'sabrine': 'sabrine', 'sabrina': 'sabrine', 'sabrina neves': 'sabrine',
  'vinicyos': 'vinicyos', 'vinicyos magnus': 'vinicyos',
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
    const saiOrigem = cellText(row.getCell(2));
    const anoSai = cellText(row.getCell(3));
    const tipoSai = cellText(row.getCell(4));
    const psai = cellText(row.getCell(5));
    const sai = cellText(row.getCell(6));
    const analise = cellText(row.getCell(7));
    const gravidade = cellText(row.getCell(8));
    const slugPsai = nomeParaSlug(psai);
    const slugSai  = nomeParaSlug(sai);
    nes.push({
      ne: neNum,
      sai_origem: saiOrigem ? parseInt(saiOrigem) || saiOrigem : null,
      ano_sai: anoSai ? parseInt(anoSai) || null : null,
      tipo_sai: tipoSai || null,
      responsavel_psai: psai || null,
      responsavel_psai_slug: slugPsai,
      responsavel_sai: sai || null,
      responsavel_sai_slug: slugSai,
      analise: analise || null,
      grave: gravidade ? gravidade.toLowerCase().includes('grav') : false,
    });
  });

  return { ...info, nome_aba: ws.name, nes, totais };
}

function labelDeNomeAba(nomeAba) {
  // "Janeiro 2026 - Importação " → { label: "Jan/26", ano: 2026 }
  const m = nomeAba.match(/^(\w+)\s+(\d{4})/);
  if (!m) return null;
  const mesNorm = m[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const abrev = MESES_ABREV[mesNorm];
  if (!abrev) return null;
  const ano = parseInt(m[2]);
  return { label: `${abrev}/${String(ano).slice(2)}`, ano };
}

async function parsearExcel(caminhoArquivo) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(caminhoArquivo);

  const versoes = [];
  wb.worksheets.forEach(ws => {
    const nome = ws.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!nome.includes('escrita') && !nome.includes('importa')) return;
    const dados = parseAba(ws);
    // Garante que o label/ano vêm do nome da aba (confiável), não do título da célula
    const infoNome = labelDeNomeAba(ws.name);
    if (infoNome) {
      const versaoStr = dados.versao ? ` (${dados.versao})` : '';
      dados.label = `${infoNome.label}${versaoStr}`;
      dados.ano = infoNome.ano;
    }
    if (dados.versao || dados.nes.length) versoes.push(dados);
  });

  // Agregar por analista (PSAI) e por especialista (SAI)
  const porAnalista = {};
  function adicionarNe(slug, label, ne) {
    if (!slug) return;
    if (!porAnalista[slug]) porAnalista[slug] = {};
    if (!porAnalista[slug][label]) porAnalista[slug][label] = [];
    porAnalista[slug][label].push(ne);
  }
  versoes.forEach(v => {
    const label = v.label || v.nome_aba;
    v.nes.forEach(ne => {
      // Responsável PSAI (analista que definiu)
      adicionarNe(ne.responsavel_psai_slug, label, ne);
      // Responsável SAI (especialista — só adiciona se for diferente do PSAI)
      if (ne.responsavel_sai_slug && ne.responsavel_sai_slug !== ne.responsavel_psai_slug) {
        adicionarNe(ne.responsavel_sai_slug, label, ne);
      }
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
