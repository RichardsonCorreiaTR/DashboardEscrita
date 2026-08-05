/**
 * nes-definicao-parser.js - Parseia Excel de NEs com Definicao
 * Le abas Escrita/Importacao. Com coluna "Considera", so entra "Sim".
 */
const ExcelJS = require('exceljs');
const { normalizarNome, nomeParaSlug } = require('./nes-definicao-nomes');

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

function detectarColunas(ws) {
  const hr = ws.getRow(3);
  let colConsidera = null, colGravidade = null;
  for (let c = 1; c <= 12; c++) {
    const raw = (cellText(hr.getCell(c)) || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (raw === 'considera') colConsidera = c;
    else if (raw.includes('grave') || raw.includes('critic')) colGravidade = c;
  }
  return { colConsidera, colGravidade };
}

function parseAba(ws) {
  const titulo = cellText(ws.getRow(1).getCell(1));
  const info = parseTitulo(titulo);
  const nes = [];
  const totais = { total_liberadas: 0, com_definicao: 0 };
  const { colConsidera, colGravidade } = detectarColunas(ws);

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
    const neNum = parseInt(col1);
    if (!neNum || isNaN(neNum)) return;

    // Coluna "Considera" presente: so entram NEs com "Sim"
    if (colConsidera) {
      const considera = normalizarNome(cellText(row.getCell(colConsidera)) || '');
      if (considera !== 'sim') return;
    }

    const saiOrigem = cellText(row.getCell(2));
    const anoSai = cellText(row.getCell(3));
    const tipoSai = cellText(row.getCell(4));
    const psai = cellText(row.getCell(5));
    const sai = cellText(row.getCell(6));
    const analise = cellText(row.getCell(7));
    const colGrav = colGravidade || (colConsidera ? null : 8);
    const gravidade = colGrav ? cellText(row.getCell(colGrav)) : null;
    nes.push({
      ne: neNum,
      sai_origem: saiOrigem ? parseInt(saiOrigem) || saiOrigem : null,
      ano_sai: anoSai ? parseInt(anoSai) || null : null,
      tipo_sai: tipoSai || null,
      responsavel_psai: psai || null,
      responsavel_psai_slug: nomeParaSlug(psai),
      responsavel_sai: sai || null,
      responsavel_sai_slug: nomeParaSlug(sai),
      analise: analise || null,
      grave: gravidade ? gravidade.toLowerCase().includes('grav') : false,
    });
  });

  return { ...info, nome_aba: ws.name, nes, totais };
}

function labelDeNomeAba(nomeAba) {
  const m = nomeAba.match(/^(\S+)\s+(\d{4})/);
  if (!m) return null;
  const mesNorm = m[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const abrev = MESES_ABREV[mesNorm];
  if (!abrev) return null;
  const ano = parseInt(m[2]);
  return { label: `${abrev}/${String(ano).slice(2)}`, ano };
}

function adicionarNe(porAnalista, slug, label, ne) {
  if (!slug) return;
  if (!porAnalista[slug]) porAnalista[slug] = {};
  if (!porAnalista[slug][label]) porAnalista[slug][label] = [];
  const bucket = porAnalista[slug][label];
  if (bucket.some(x => x.ne === ne.ne)) return;
  bucket.push(ne);
}

async function parsearExcel(caminhoArquivo) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(caminhoArquivo);

  const versoes = [];
  wb.worksheets.forEach(ws => {
    const nome = ws.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!nome.includes('escrita') && !nome.includes('importa')) return;
    const dados = parseAba(ws);
    const infoNome = labelDeNomeAba(ws.name);
    if (infoNome) {
      dados.label = infoNome.label;
      dados.ano = infoNome.ano;
    }
    if (dados.versao || dados.nes.length) versoes.push(dados);
  });

  const porAnalista = {};
  versoes.forEach(v => {
    const label = v.label || v.nome_aba;
    v.nes.forEach(ne => {
      adicionarNe(porAnalista, ne.responsavel_psai_slug, label, ne);
      if (ne.responsavel_sai_slug && ne.responsavel_sai_slug !== ne.responsavel_psai_slug) {
        adicionarNe(porAnalista, ne.responsavel_sai_slug, label, ne);
      }
    });
  });

  return {
    versoes,
    por_analista: porAnalista,
    labels: [...new Set(versoes.map(v => v.label || v.nome_aba))],
    gerado_em: new Date().toISOString()
  };
}

module.exports = { parsearExcel };
