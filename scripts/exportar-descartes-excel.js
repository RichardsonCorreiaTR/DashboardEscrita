/**
 * exportar-descartes-excel.js
 *
 * Gera Excel completo da analise de Descartes (CsD/Repr/Presc)
 * com dados, graficos nativos e metodologia "Como se calcula?".
 *
 * Uso: node scripts/exportar-descartes-excel.js
 */

const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');

const CACHE_FILE = path.join(__dirname, '..', 'data', 'cache', 'estudos-descartes-ne.json');
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'analise-descartes-reprovada-prescrita.xlsx');

/* ============== CORES ============== */
const COR = {
  azulEscuro: 'FF1E3A5F', azulMedio: 'FF2B5797', azulClaro: 'FFD6E4F0',
  verde: 'FF22C55E', verdeBg: 'FFDCFCE7', verdeEscuro: 'FF166534',
  amarelo: 'FFEAB308', amareloBg: 'FFFEF9C3', amareloEscuro: 'FF854D0E',
  vermelho: 'FFEF4444', vermelhoBg: 'FFFEE2E2', vermelhoEscuro: 'FF991B1B',
  cinzaClaro: 'FFF3F4F6', cinzaMedio: 'FF9CA3AF', branco: 'FFFFFFFF',
  preto: 'FF1F2937', cinzaTexto: 'FF6B7280'
};

/* ============== ESTATISTICAS (mesmo algoritmo do backend) ============== */

function round2(v) { return Math.round(v * 100) / 100; }

function calcEWMA(valores, span) {
  if (valores.length === 0) return [];
  const alpha = 2 / (span + 1);
  const result = [valores[0]];
  for (let i = 1; i < valores.length; i++) {
    result.push(round2(alpha * valores[i] + (1 - alpha) * result[i - 1]));
  }
  return result;
}

function calcDesvioPadrao(arr) {
  if (arr.length === 0) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variancia = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
  return round2(Math.sqrt(variancia));
}

function calcMediana(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return round2(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
}

function calcularEstatisticas(versoes) {
  const pcts = versoes.map(v => v.percentual);
  const media = round2(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  const mediana = calcMediana(pcts);
  const dp = calcDesvioPadrao(pcts);
  const ewmaSerie = calcEWMA(pcts, 6);
  const ewmaAtual = ewmaSerie[ewmaSerie.length - 1] || media;
  const faixaNormal = round2(ewmaAtual + dp);
  const faixaAtencao = round2(ewmaAtual + 2 * dp);
  const recentes = pcts.slice(-6);
  const mediaRecente = round2(recentes.reduce((a, b) => a + b, 0) / recentes.length);
  const totEntradas = versoes.reduce((s, v) => s + v.entradas, 0);
  const totConcl = versoes.reduce((s, v) => s + (v.conclSemDev || 0), 0);
  const totRepr = versoes.reduce((s, v) => s + v.reprovadas, 0);
  const totPresc = versoes.reduce((s, v) => s + v.prescritas, 0);
  const totFoco = totConcl + totRepr + totPresc;
  const pctGlobal = totEntradas > 0 ? round2((totFoco / totEntradas) * 100) : 0;

  return {
    media, mediana, dp, ewmaSerie, ewmaAtual, faixaNormal, faixaAtencao,
    mediaRecente, totEntradas, totConcl, totRepr, totPresc, totFoco, pctGlobal,
    min: round2(Math.min(...pcts)), max: round2(Math.max(...pcts))
  };
}

/* ============== CARREGAR DADOS ============== */

function carregarDados() {
  if (!fs.existsSync(CACHE_FILE)) {
    console.error('Cache nao encontrado:', CACHE_FILE);
    console.error('Execute o dashboard primeiro: npm start');
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  const versoes = Object.values(raw.versoes)
    .filter(v => v && v.entradas > 0)
    .sort((a, b) => a.versao.localeCompare(b.versao));

  if (versoes.length === 0) {
    console.error('Nenhum dado de versao encontrado no cache');
    process.exit(1);
  }
  return { versoes, meta: raw._meta };
}

/* ============== ESTILOS REUTILIZAVEIS ============== */

function estiloCabecalho() {
  return {
    font: { bold: true, color: { argb: COR.branco }, size: 11, name: 'Segoe UI' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.azulMedio } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: bordaFina()
  };
}

function estiloTitulo(size = 16) {
  return {
    font: { bold: true, color: { argb: COR.azulEscuro }, size, name: 'Segoe UI' },
    alignment: { vertical: 'middle' }
  };
}

function bordaFina() {
  const b = { style: 'thin', color: { argb: 'FFD1D5DB' } };
  return { top: b, bottom: b, left: b, right: b };
}

function numFmt(fmt) { return { numFmt: fmt }; }

/* ============== ABA RESUMO ============== */

function criarAbaResumo(wb, versoes, stats) {
  const ws = wb.addWorksheet('Resumo', {
    properties: { tabColor: { argb: COR.azulMedio } }
  });

  ws.columns = [
    { width: 4 }, { width: 28 }, { width: 20 }, { width: 20 },
    { width: 20 }, { width: 20 }, { width: 4 }
  ];

  let row = 2;

  // Titulo principal
  ws.mergeCells(`B${row}:E${row}`);
  const titulo = ws.getCell(`B${row}`);
  titulo.value = 'Analise de Descartes - Concl.s/Dev / Reprovada / Prescrita';
  titulo.style = estiloTitulo(18);
  row++;

  ws.mergeCells(`B${row}:E${row}`);
  const sub = ws.getCell(`B${row}`);
  sub.value = `Escrita Fiscal - Thomson Reuters/Betha | Atualizado: ${new Date().toLocaleDateString('pt-BR')}`;
  sub.style = { font: { size: 10, color: { argb: COR.cinzaTexto }, name: 'Segoe UI' } };
  row += 2;

  // KPIs
  const kpis = [
    ['Versoes Analisadas', versoes.length, ''],
    ['Total de Entradas', stats.totEntradas, ''],
    ['Total Descartes (CsD+Repr+Presc)', stats.totFoco, `${stats.totConcl} CsD + ${stats.totRepr} repr + ${stats.totPresc} presc`],
    ['% Global de Descarte', `${stats.pctGlobal}%`, `De todas as entradas desde ${versoes[0].versao}`],
    ['Media Historica', `${stats.media}%`, `Min: ${stats.min}% | Max: ${stats.max}%`],
    ['Mediana Historica', `${stats.mediana}%`, `DP: ${stats.dp}%`],
    ['EWMA Esperado (span=6)', `${round2(stats.ewmaAtual)}%`, 'Tendencia recente ponderada'],
    ['Faixa Normal (EWMA+1DP)', `ate ${stats.faixaNormal}%`, 'Variacao natural do processo'],
    ['Faixa Atencao (EWMA+2DP)', `ate ${stats.faixaAtencao}%`, 'Possivel mudanca no padrao'],
    ['Media Recente (6 versoes)', `${stats.mediaRecente}%`, 'Ultimas 6 versoes']
  ];

  ws.mergeCells(`B${row}:C${row}`);
  ws.getCell(`B${row}`).value = 'Indicadores-Chave (KPIs)';
  ws.getCell(`B${row}`).style = estiloTitulo(13);
  row++;

  for (const [label, valor, obs] of kpis) {
    const cLabel = ws.getCell(`B${row}`);
    cLabel.value = label;
    cLabel.style = {
      font: { size: 10, name: 'Segoe UI', color: { argb: COR.preto } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.cinzaClaro } },
      border: bordaFina(), alignment: { vertical: 'middle' }
    };

    const cValor = ws.getCell(`C${row}`);
    cValor.value = valor;
    cValor.style = {
      font: { bold: true, size: 11, name: 'Segoe UI', color: { argb: COR.azulEscuro } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: bordaFina()
    };

    if (obs) {
      ws.mergeCells(`D${row}:E${row}`);
      const cObs = ws.getCell(`D${row}`);
      cObs.value = obs;
      cObs.style = {
        font: { size: 9, italic: true, color: { argb: COR.cinzaTexto }, name: 'Segoe UI' },
        alignment: { vertical: 'middle' }, border: bordaFina()
      };
    }
    row++;
  }

  row += 1;

  // Diagnostico versao atual
  const vAtual = versoes[versoes.length - 1];
  const ewmaAtual = round2(stats.ewmaAtual);
  const pctAtual = vAtual.percentual;
  const desvio = round2(pctAtual - ewmaAtual);
  const desvioSigmas = stats.dp > 0 ? round2(desvio / stats.dp) : 0;
  let classificacao, cor;
  if (pctAtual <= stats.faixaNormal) { classificacao = 'NORMAL'; cor = COR.verde; }
  else if (pctAtual <= stats.faixaAtencao) { classificacao = 'ATENCAO'; cor = COR.amarelo; }
  else { classificacao = 'CRITICO'; cor = COR.vermelho; }

  ws.mergeCells(`B${row}:E${row}`);
  ws.getCell(`B${row}`).value = `Diagnostico: ${vAtual.versao} (Versao Atual)`;
  ws.getCell(`B${row}`).style = estiloTitulo(13);
  row++;

  const diagDados = [
    ['Versao', vAtual.versao],
    ['Entradas', vAtual.entradas],
    ['Concl. sem Dev', vAtual.conclSemDev || 0],
    ['Reprovadas', vAtual.reprovadas],
    ['Prescritas', vAtual.prescritas],
    ['% Descarte', `${pctAtual}%`],
    ['EWMA Esperado', `${ewmaAtual}%`],
    ['Desvio vs EWMA', `${desvio > 0 ? '+' : ''}${desvio}pp (${desvioSigmas}σ)`],
    ['Classificacao', classificacao]
  ];

  for (const [label, valor] of diagDados) {
    const cL = ws.getCell(`B${row}`);
    cL.value = label;
    cL.style = {
      font: { size: 10, name: 'Segoe UI' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.cinzaClaro } },
      border: bordaFina()
    };
    const cV = ws.getCell(`C${row}`);
    cV.value = valor;
    const isClass = label === 'Classificacao';
    cV.style = {
      font: {
        bold: true, size: isClass ? 12 : 11, name: 'Segoe UI',
        color: { argb: isClass ? cor : COR.preto }
      },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: bordaFina(),
      fill: isClass
        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: cor === COR.verde ? COR.verdeBg : cor === COR.amarelo ? COR.amareloBg : COR.vermelhoBg } }
        : undefined
    };
    row++;
  }

  // Composicao
  row += 1;
  ws.mergeCells(`B${row}:E${row}`);
  ws.getCell(`B${row}`).value = 'Composicao dos Descartes';
  ws.getCell(`B${row}`).style = estiloTitulo(13);
  row++;

  const pctConcl = stats.totFoco > 0 ? round2((stats.totConcl / stats.totFoco) * 100) : 0;
  const pctRepr = stats.totFoco > 0 ? round2((stats.totRepr / stats.totFoco) * 100) : 0;
  const pctPresc = stats.totFoco > 0 ? round2((stats.totPresc / stats.totFoco) * 100) : 0;

  const comp = [
    ['Concl. sem Dev (motivo 5)', stats.totConcl, `${pctConcl}% dos descartes`],
    ['Reprovadas (motivo 6)', stats.totRepr, `${pctRepr}% dos descartes`],
    ['Prescritas (motivo 23)', stats.totPresc, `${pctPresc}% dos descartes`]
  ];
  for (const [label, valor, obs] of comp) {
    ws.getCell(`B${row}`).value = label;
    ws.getCell(`B${row}`).style = {
      font: { size: 10, name: 'Segoe UI' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.cinzaClaro } },
      border: bordaFina()
    };
    ws.getCell(`C${row}`).value = valor;
    ws.getCell(`C${row}`).style = {
      font: { bold: true, size: 11, name: 'Segoe UI' },
      alignment: { horizontal: 'center' }, border: bordaFina()
    };
    ws.getCell(`D${row}`).value = obs;
    ws.getCell(`D${row}`).style = {
      font: { size: 9, italic: true, color: { argb: COR.cinzaTexto }, name: 'Segoe UI' },
      border: bordaFina()
    };
    row++;
  }

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
  return ws;
}

/* ============== ABA DADOS ============== */

function criarAbaDados(wb, versoes, stats) {
  const ws = wb.addWorksheet('Dados por Versao', {
    properties: { tabColor: { argb: COR.verde } }
  });

  ws.columns = [
    { header: '', width: 4 },
    { header: 'Versao', width: 14, key: 'versao' },
    { header: 'Entradas', width: 12, key: 'entradas' },
    { header: 'CsD (5)', width: 12, key: 'conclSemDev' },
    { header: 'Reprovadas (6)', width: 14, key: 'reprovadas' },
    { header: 'Prescritas (23)', width: 14, key: 'prescritas' },
    { header: 'Total Foco', width: 13, key: 'totalFoco' },
    { header: '% Descarte', width: 13, key: 'percentual' },
    { header: 'EWMA', width: 10, key: 'ewma' },
    { header: 'Faixa Normal', width: 14, key: 'faixaNormal' },
    { header: 'Faixa Atencao', width: 14, key: 'faixaAtencao' },
    { header: 'Status', width: 12, key: 'status' }
  ];

  // Titulo
  ws.mergeCells('B1:L1');
  ws.getCell('B1').value = 'Dados Historicos - Descartes por Versao';
  ws.getCell('B1').style = estiloTitulo(14);
  ws.getRow(1).height = 30;

  // Cabecalho na linha 3
  const headerRow = 3;
  const headers = ['Versao', 'Entradas', 'CsD (5)', 'Repr (6)', 'Presc (23)', 'Total Foco', '% Descarte', 'EWMA', 'Faixa Normal', 'Faixa Atencao', 'Status'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(headerRow, i + 2);
    cell.value = h;
    cell.style = estiloCabecalho();
  });
  ws.getRow(headerRow).height = 28;

  // Dados
  const dataStartRow = headerRow + 1;
  versoes.forEach((v, idx) => {
    const r = dataStartRow + idx;
    const ewma = round2(stats.ewmaSerie[idx] || 0);
    const fn = round2(ewma + stats.dp);
    const fa = round2(ewma + 2 * stats.dp);
    let status;
    if (v.percentual <= fn) status = 'Normal';
    else if (v.percentual <= fa) status = 'Atencao';
    else status = 'Critico';

    const isLast = idx === versoes.length - 1;
    const zebra = idx % 2 === 0 ? COR.branco : COR.cinzaClaro;

    const vals = [v.versao, v.entradas, v.conclSemDev || 0, v.reprovadas, v.prescritas, v.totalDescartesFoco, v.percentual, ewma, fn, fa, status];

    vals.forEach((val, ci) => {
      const cell = ws.getCell(r, ci + 2);
      cell.value = val;
      cell.border = bordaFina();
      cell.font = { name: 'Segoe UI', size: 10 };
      cell.alignment = { horizontal: ci === 0 ? 'left' : 'center', vertical: 'middle' };

      if (isLast) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.azulClaro } };
        cell.font = { name: 'Segoe UI', size: 10, bold: true };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } };
      }

      if (ci === 6) cell.numFmt = '0.00"%"';
      if (ci === 7 || ci === 8 || ci === 9) cell.numFmt = '0.00"%"';

      if (ci === 10) {
        const corStatus = status === 'Normal' ? COR.verdeEscuro : status === 'Atencao' ? COR.amareloEscuro : COR.vermelhoEscuro;
        const bgStatus = status === 'Normal' ? COR.verdeBg : status === 'Atencao' ? COR.amareloBg : COR.vermelhoBg;
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: corStatus } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgStatus } };
      }
    });
  });

  // Linha totais
  const totalRow = dataStartRow + versoes.length;
  const totais = [
    'TOTAL', stats.totEntradas, stats.totConcl, stats.totRepr, stats.totPresc,
    stats.totFoco, stats.pctGlobal, '-', '-', '-', '-'
  ];
  totais.forEach((val, ci) => {
    const cell = ws.getCell(totalRow, ci + 2);
    cell.value = val;
    cell.style = {
      font: { bold: true, size: 10, name: 'Segoe UI', color: { argb: COR.branco } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.azulEscuro } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: bordaFina()
    };
    if (ci === 6) cell.numFmt = '0.00"%"';
  });
  ws.getRow(totalRow).height = 24;

  // Autofilter
  ws.autoFilter = { from: { row: headerRow, column: 2 }, to: { row: totalRow - 1, column: 12 } };

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
  return { ws, dataStartRow, headerRow };
}

/* ============== ABA GRAFICOS ============== */

function criarAbaGraficos(wb, versoes, stats) {
  const ws = wb.addWorksheet('Graficos', {
    properties: { tabColor: { argb: COR.vermelho } }
  });

  ws.columns = [
    { width: 4 }, { width: 14 }, { width: 12 }, { width: 12 },
    { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 },
    { width: 12 }, { width: 12 }
  ];

  // Titulo
  ws.mergeCells('B1:I1');
  ws.getCell('B1').value = 'Dados para Graficos (gere os graficos selecionando estas tabelas)';
  ws.getCell('B1').style = estiloTitulo(13);

  // Tabela 1: % Descarte + EWMA + Faixas
  let row = 3;
  ws.getCell(`B${row}`).value = 'Grafico 1: % Descarte vs EWMA com Faixas de Controle';
  ws.getCell(`B${row}`).style = estiloTitulo(11);
  row++;

  const h1 = ['Versao', '% Descarte', 'EWMA', 'Normal (+1σ)', 'Atencao (+2σ)'];
  h1.forEach((h, i) => {
    const cell = ws.getCell(row, i + 2);
    cell.value = h;
    cell.style = estiloCabecalho();
  });
  row++;

  const chart1Start = row;
  versoes.forEach((v, idx) => {
    const ewma = round2(stats.ewmaSerie[idx] || 0);
    ws.getCell(row, 2).value = v.versao;
    ws.getCell(row, 3).value = v.percentual;
    ws.getCell(row, 4).value = ewma;
    ws.getCell(row, 5).value = round2(ewma + stats.dp);
    ws.getCell(row, 6).value = round2(ewma + 2 * stats.dp);
    for (let c = 2; c <= 6; c++) {
      ws.getCell(row, c).border = bordaFina();
      ws.getCell(row, c).font = { name: 'Segoe UI', size: 9 };
      ws.getCell(row, c).alignment = { horizontal: 'center' };
      if (c >= 3) ws.getCell(row, c).numFmt = '0.00';
    }
    row++;
  });
  const chart1End = row - 1;

  row += 2;

  // Tabela 2: Descartes por motivo (stacked bar)
  ws.getCell(`B${row}`).value = 'Grafico 2: Descartes por Motivo (CsD / Repr / Presc)';
  ws.getCell(`B${row}`).style = estiloTitulo(11);
  row++;

  const h2 = ['Versao', 'CsD (5)', 'Repr (6)', 'Presc (23)', 'Total'];
  h2.forEach((h, i) => {
    const cell = ws.getCell(row, i + 2);
    cell.value = h;
    cell.style = estiloCabecalho();
  });
  row++;

  const chart2Start = row;
  versoes.forEach(v => {
    ws.getCell(row, 2).value = v.versao;
    ws.getCell(row, 3).value = v.conclSemDev || 0;
    ws.getCell(row, 4).value = v.reprovadas;
    ws.getCell(row, 5).value = v.prescritas;
    ws.getCell(row, 6).value = v.totalDescartesFoco;
    for (let c = 2; c <= 6; c++) {
      ws.getCell(row, c).border = bordaFina();
      ws.getCell(row, c).font = { name: 'Segoe UI', size: 9 };
      ws.getCell(row, c).alignment = { horizontal: 'center' };
    }
    row++;
  });
  const chart2End = row - 1;

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
  return { ws, chart1Start, chart1End, chart2Start, chart2End };
}

/* ============== ABA METODOLOGIA ============== */

function criarAbaMetodologia(wb, stats) {
  const ws = wb.addWorksheet('Como se Calcula', {
    properties: { tabColor: { argb: COR.amarelo } }
  });

  ws.columns = [{ width: 4 }, { width: 90 }, { width: 4 }];

  let row = 2;
  const addTitulo = (texto, size = 14) => {
    ws.getCell(`B${row}`).value = texto;
    ws.getCell(`B${row}`).style = estiloTitulo(size);
    ws.getRow(row).height = size * 2;
    row++;
  };
  const addTexto = (texto, opts = {}) => {
    const cell = ws.getCell(`B${row}`);
    cell.value = texto;
    cell.style = {
      font: {
        size: opts.size || 10, name: 'Segoe UI', bold: opts.bold || false,
        italic: opts.italic || false,
        color: { argb: opts.color || COR.preto }
      },
      alignment: { wrapText: true, vertical: 'top' }
    };
    ws.getRow(row).height = opts.height || 20;
    row++;
  };
  const addEspaco = () => { row++; };

  addTitulo('Como se Calcula? - Metodologia da Analise de Descartes', 16);
  addTexto('Analise de Descartes - Concl.s/Dev / Reprovada / Prescrita | Escrita Fiscal - Thomson Reuters/Betha', { italic: true, color: COR.cinzaTexto });
  addEspaco();

  addTitulo('1. Percentual de Descarte por Versao', 13);
  addTexto('Formula:', { bold: true });
  addTexto('% descarte = (CsD + reprovada + prescrita) / entradas_versao x 100');
  addEspaco();
  addTexto('Definicoes:', { bold: true });
  addTexto('- Entradas: NEs com CadastroPSAI dentro do periodo da versao (campo CadastroPSAI > inicio AND <= fim)');
  addTexto('- Descartes: NEs com campo Descarte dentro do periodo da versao E situacao IN (5=CsD, 6=Reprovada, 23=Prescrita)');
  addTexto('- Motivo 5 (Concl. sem Dev): NE resolvida/fechada sem necessidade de gerar SAI para desenvolvimento');
  addTexto('- Motivo 6 (Reprovada): NE analisada e reprovada pelo time tecnico');
  addTexto('- Motivo 23 (Prescrita): NE que aguardou retorno do suporte e nao recebeu em tempo habil (automatico)');
  addTexto('- Filtro obrigatorio: COALESCE(psai.i_produto_grupo, 1) = 1 (produto principal)');
  addEspaco();

  addTitulo('2. EWMA (Exponential Weighted Moving Average)', 13);
  addTexto('Formula:', { bold: true });
  addTexto('EWMA_t = alpha x Pct_t + (1 - alpha) x EWMA_{t-1}');
  addTexto(`onde alpha = 2 / (span + 1) = 2 / 7 = ${round2(2 / 7)}`);
  addEspaco();
  addTexto('O que faz:', { bold: true });
  addTexto('- Span = 6 versoes: as ultimas 6 versoes tem peso exponencialmente maior');
  addTexto('- Captura tendencias: se o percentual vem subindo, o EWMA acompanha');
  addTexto('- Suaviza oscilacoes pontuais (ruido) sem ignorar mudancas reais');
  addTexto('- O primeiro valor do EWMA e igual a primeira observacao');
  addTexto(`- EWMA atual: ${round2(stats.ewmaAtual)}%`);
  addEspaco();

  addTitulo('3. Faixas de Controle (Banda Estatistica)', 13);
  addTexto('Baseadas no EWMA + Desvio Padrao historico (similar a carta de Shewhart):', { bold: true });
  addEspaco();
  addTexto(`Desvio Padrao (DP) historico: ${stats.dp}%`);
  addEspaco();
  addTexto(`NORMAL (verde): percentual <= EWMA + 1 x DP = ${stats.faixaNormal}%`);
  addTexto('Interpretacao: variacao natural do processo. Nao requer acao.', { italic: true, color: COR.cinzaTexto });
  addEspaco();
  addTexto(`ATENCAO (amarelo): EWMA + 1xDP < percentual <= EWMA + 2xDP = ${stats.faixaAtencao}%`);
  addTexto('Interpretacao: possivel mudanca no padrao. Monitorar de perto.', { italic: true, color: COR.cinzaTexto });
  addEspaco();
  addTexto(`CRITICO (vermelho): percentual > EWMA + 2 x DP = acima de ${stats.faixaAtencao}%`);
  addTexto('Interpretacao: sinal claro de anomalia. Investigar causas raiz.', { italic: true, color: COR.cinzaTexto });
  addEspaco();

  addTitulo('4. Por que EWMA + Desvio Padrao?', 13);
  addTexto('- EWMA captura a tendencia recente (se o percentual vem subindo ou caindo)');
  addTexto('- O desvio padrao mede a variabilidade natural do processo');
  addTexto('- Juntos, formam uma "banda de controle" estatistica');
  addTexto('- Analogia: similar a carta de controle Shewhart, usada em controle estatistico de processos (CEP)');
  addTexto('- Se o percentual sai da banda, ha evidencia estatistica de que algo mudou no processo');
  addEspaco();

  addTitulo('5. Diagnostico da Versao Atual', 13);
  addTexto('Para cada versao, calculamos:', { bold: true });
  addTexto('- Desvio vs EWMA: percentual_atual - EWMA_esperado (em pontos percentuais)');
  addTexto('- Desvio em sigmas: desvio / DP (quantos desvios padrao distante da media movel)');
  addTexto('- Classificacao: baseada nas faixas de controle (Normal / Atencao / Critico)');
  addEspaco();

  addTitulo('6. Fonte dos Dados', 13);
  addTexto('- Banco: Sybase SQL Anywhere 9.0 via ODBC (DSN: pbcvs9)');
  addTexto('- Tabelas: UP.SAI_PSAI (entradas/descartes) + bethadba.psai (produto)');
  addTexto('- Periodos: definidos por PIAZZA.FG_GET_DATA_INICIO_VERSAO / FG_GET_DATA_FIM_VERSAO');
  addTexto('- Area: Escrita | Tipo: NE | Produto grupo: 1 (principal)');
  addTexto('- Historico: desde versao 10.2A-02 (fevereiro 2022)');

  ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1 };
  return ws;
}

/* ============== ABA DETALHES ============== */

function criarAbaDetalhes(wb, versoes) {
  const ws = wb.addWorksheet('Detalhes Descartes', {
    properties: { tabColor: { argb: COR.vermelho } }
  });

  ws.columns = [
    { width: 4 }, { width: 14 }, { width: 10 }, { width: 10 },
    { width: 12 }, { width: 14 }, { width: 16 }, { width: 50 }
  ];

  ws.mergeCells('B1:H1');
  ws.getCell('B1').value = 'Detalhes dos Descartes (CsD/Reprovada/Prescrita) - NEs Individuais';
  ws.getCell('B1').style = estiloTitulo(13);
  ws.getRow(1).height = 28;

  const headerRow = 3;
  const headers = ['Versao', 'i_psai', 'i_sai', 'Gravidade', 'Motivo ID', 'Motivo', 'Descricao'];
  headers.forEach((h, i) => {
    ws.getCell(headerRow, i + 2).value = h;
    ws.getCell(headerRow, i + 2).style = estiloCabecalho();
  });

  let row = headerRow + 1;
  let totalDetalhes = 0;

  for (const v of versoes) {
    if (!v.detalhes || v.detalhes.length === 0) continue;
    for (const d of v.detalhes) {
      const motNome = d.motivo_id === 5 ? 'Concl. sem Dev' : d.motivo_id === 6 ? 'Reprovada' : d.motivo_id === 23 ? 'Prescrita' : String(d.motivo_id);
      const vals = [v.versao, d.i_psai, d.i_sai, d.gravidade || 'N/D', d.motivo_id, motNome, d.descricao || ''];
      const zebra = totalDetalhes % 2 === 0 ? COR.branco : COR.cinzaClaro;
      vals.forEach((val, ci) => {
        const cell = ws.getCell(row, ci + 2);
        cell.value = val;
        cell.border = bordaFina();
        cell.font = { name: 'Segoe UI', size: 9 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } };
        cell.alignment = ci === 6 ? { wrapText: true, vertical: 'top' } : { horizontal: 'center', vertical: 'middle' };
      });
      row++;
      totalDetalhes++;
    }
  }

  ws.autoFilter = { from: { row: headerRow, column: 2 }, to: { row: row - 1, column: 8 } };
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
  return ws;
}

/* ============== INJETAR GRAFICOS OOXML ============== */

async function injetarGraficos(buffer, numVersoes, chart1Start, chart1End, chart2Start, chart2End) {
  const zip = await JSZip.loadAsync(buffer);

  const colLetras = { B: 'B', C: 'C', D: 'D', E: 'E', F: 'F' };
  const sheetName = 'Graficos';
  const sheetIdx = 2;

  const chart1XML = gerarChartLineXML(sheetName, chart1Start, chart1End);
  const chart2XML = gerarChartBarXML(sheetName, chart2Start, chart2End);

  zip.file('xl/charts/chart1.xml', chart1XML);
  zip.file('xl/charts/chart2.xml', chart2XML);

  const chartRels1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  zip.file('xl/charts/_rels/chart1.xml.rels', chartRels1);
  zip.file('xl/charts/_rels/chart2.xml.rels', chartRels1);

  const drawingXML = gerarDrawingXML();
  zip.file('xl/drawings/drawing1.xml', drawingXML);

  const drawingRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart2.xml"/>
</Relationships>`;
  zip.file('xl/drawings/_rels/drawing1.xml.rels', drawingRels);

  const sheetFile = `xl/worksheets/sheet${sheetIdx + 1}.xml`;
  let sheetXML = await zip.file(sheetFile).async('string');

  if (!sheetXML.includes('<drawing')) {
    sheetXML = sheetXML.replace('</worksheet>', '<drawing r:id="rId10"/></worksheet>');
  }
  zip.file(sheetFile, sheetXML);

  const sheetRelsFile = `xl/worksheets/_rels/sheet${sheetIdx + 1}.xml.rels`;
  let sheetRels = '';
  if (zip.file(sheetRelsFile)) {
    sheetRels = await zip.file(sheetRelsFile).async('string');
    sheetRels = sheetRels.replace('</Relationships>',
      `<Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`);
  } else {
    sheetRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`;
  }
  zip.file(sheetRelsFile, sheetRels);

  let contentTypes = await zip.file('[Content_Types].xml').async('string');
  if (!contentTypes.includes('chart+xml')) {
    contentTypes = contentTypes.replace('</Types>',
      `<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
       <Override PartName="/xl/charts/chart2.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
       <Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>
       </Types>`);
  }
  zip.file('[Content_Types].xml', contentTypes);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function gerarDrawingXML() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
          xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>7</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>2</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>17</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>22</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr>
        <xdr:cNvPr id="2" name="Grafico1"/>
        <xdr:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></xdr:cNvGraphicFramePr>
      </xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId1"/>
        </a:graphicData>
      </a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>7</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>24</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>17</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>44</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr>
        <xdr:cNvPr id="3" name="Grafico2"/>
        <xdr:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></xdr:cNvGraphicFramePr>
      </xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId2"/>
        </a:graphicData>
      </a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`;
}

function gerarChartLineXML(sheetName, startRow, endRow) {
  const sn = `'${sheetName}'`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
              xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
              xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title>
      <c:tx><c:rich><a:bodyPr/><a:lstStyle/>
        <a:p><a:r><a:rPr lang="pt-BR" sz="1200" b="1"/><a:t>% Descarte vs EWMA com Faixas de Controle</a:t></a:r></a:p>
      </c:rich></c:tx>
      <c:overlay val="0"/>
    </c:title>
    <c:autoTitleDeleted val="0"/>
    <c:plotArea>
      <c:layout/>
      <c:lineChart>
        <c:grouping val="standard"/>
        <c:varyColors val="0"/>
        <c:ser>
          <c:idx val="0"/><c:order val="0"/>
          <c:tx><c:strRef><c:f>${sn}!$C$${startRow - 1}</c:f></c:strRef></c:tx>
          <c:spPr><a:ln w="25400"><a:solidFill><a:srgbClr val="3B82F6"/></a:solidFill></a:ln></c:spPr>
          <c:marker><c:symbol val="circle"/><c:size val="5"/></c:marker>
          <c:cat><c:strRef><c:f>${sn}!$B$${startRow}:$B$${endRow}</c:f></c:strRef></c:cat>
          <c:val><c:numRef><c:f>${sn}!$C$${startRow}:$C$${endRow}</c:f></c:numRef></c:val>
          <c:smooth val="0"/>
        </c:ser>
        <c:ser>
          <c:idx val="1"/><c:order val="1"/>
          <c:tx><c:strRef><c:f>${sn}!$D$${startRow - 1}</c:f></c:strRef></c:tx>
          <c:spPr><a:ln w="19050"><a:solidFill><a:srgbClr val="22C55E"/></a:solidFill><a:prstDash val="dash"/></a:ln></c:spPr>
          <c:marker><c:symbol val="none"/></c:marker>
          <c:cat><c:strRef><c:f>${sn}!$B$${startRow}:$B$${endRow}</c:f></c:strRef></c:cat>
          <c:val><c:numRef><c:f>${sn}!$D$${startRow}:$D$${endRow}</c:f></c:numRef></c:val>
          <c:smooth val="0"/>
        </c:ser>
        <c:ser>
          <c:idx val="2"/><c:order val="2"/>
          <c:tx><c:strRef><c:f>${sn}!$E$${startRow - 1}</c:f></c:strRef></c:tx>
          <c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="EAB308"/></a:solidFill><a:prstDash val="lgDash"/></a:ln></c:spPr>
          <c:marker><c:symbol val="none"/></c:marker>
          <c:cat><c:strRef><c:f>${sn}!$B$${startRow}:$B$${endRow}</c:f></c:strRef></c:cat>
          <c:val><c:numRef><c:f>${sn}!$E$${startRow}:$E$${endRow}</c:f></c:numRef></c:val>
          <c:smooth val="0"/>
        </c:ser>
        <c:ser>
          <c:idx val="3"/><c:order val="3"/>
          <c:tx><c:strRef><c:f>${sn}!$F$${startRow - 1}</c:f></c:strRef></c:tx>
          <c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="EF4444"/></a:solidFill><a:prstDash val="lgDash"/></a:ln></c:spPr>
          <c:marker><c:symbol val="none"/></c:marker>
          <c:cat><c:strRef><c:f>${sn}!$B$${startRow}:$B$${endRow}</c:f></c:strRef></c:cat>
          <c:val><c:numRef><c:f>${sn}!$F$${startRow}:$F$${endRow}</c:f></c:numRef></c:val>
          <c:smooth val="0"/>
        </c:ser>
        <c:marker val="1"/>
        <c:axId val="1"/><c:axId val="2"/>
      </c:lineChart>
      <c:catAx>
        <c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="b"/><c:crossAx val="2"/>
        <c:txPr><a:bodyPr rot="-5400000"/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="800"/></a:pPr><a:endParaRPr lang="pt-BR"/></a:p></c:txPr>
      </c:catAx>
      <c:valAx>
        <c:axId val="2"/><c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="l"/><c:crossAx val="1"/>
        <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="pt-BR" sz="900"/><a:t>% Descarte</a:t></a:r></a:p></c:rich></c:tx></c:title>
        <c:numFmt formatCode="0.0&quot;%&quot;" sourceLinked="0"/>
      </c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="t"/><c:overlay val="0"/></c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`;
}

function gerarChartBarXML(sheetName, startRow, endRow) {
  const sn = `'${sheetName}'`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
              xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
              xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title>
      <c:tx><c:rich><a:bodyPr/><a:lstStyle/>
        <a:p><a:r><a:rPr lang="pt-BR" sz="1200" b="1"/><a:t>Descartes por Motivo (CsD / Repr / Presc)</a:t></a:r></a:p>
      </c:rich></c:tx>
      <c:overlay val="0"/>
    </c:title>
    <c:autoTitleDeleted val="0"/>
    <c:plotArea>
      <c:layout/>
      <c:barChart>
        <c:barDir val="col"/>
        <c:grouping val="stacked"/>
        <c:varyColors val="0"/>
        <c:ser>
          <c:idx val="0"/><c:order val="0"/>
          <c:tx><c:strRef><c:f>${sn}!$C$${startRow - 1}</c:f></c:strRef></c:tx>
          <c:spPr><a:solidFill><a:srgbClr val="60A5FA"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>
          <c:cat><c:strRef><c:f>${sn}!$B$${startRow}:$B$${endRow}</c:f></c:strRef></c:cat>
          <c:val><c:numRef><c:f>${sn}!$C$${startRow}:$C$${endRow}</c:f></c:numRef></c:val>
        </c:ser>
        <c:ser>
          <c:idx val="1"/><c:order val="1"/>
          <c:tx><c:strRef><c:f>${sn}!$D$${startRow - 1}</c:f></c:strRef></c:tx>
          <c:spPr><a:solidFill><a:srgbClr val="EF4444"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>
          <c:cat><c:strRef><c:f>${sn}!$B$${startRow}:$B$${endRow}</c:f></c:strRef></c:cat>
          <c:val><c:numRef><c:f>${sn}!$D$${startRow}:$D$${endRow}</c:f></c:numRef></c:val>
        </c:ser>
        <c:ser>
          <c:idx val="2"/><c:order val="2"/>
          <c:tx><c:strRef><c:f>${sn}!$E$${startRow - 1}</c:f></c:strRef></c:tx>
          <c:spPr><a:solidFill><a:srgbClr val="EAB308"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>
          <c:cat><c:strRef><c:f>${sn}!$B$${startRow}:$B$${endRow}</c:f></c:strRef></c:cat>
          <c:val><c:numRef><c:f>${sn}!$E$${startRow}:$E$${endRow}</c:f></c:numRef></c:val>
        </c:ser>
        <c:overlap val="100"/>
        <c:axId val="3"/><c:axId val="4"/>
      </c:barChart>
      <c:catAx>
        <c:axId val="3"/><c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="b"/><c:crossAx val="4"/>
        <c:txPr><a:bodyPr rot="-5400000"/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="800"/></a:pPr><a:endParaRPr lang="pt-BR"/></a:p></c:txPr>
      </c:catAx>
      <c:valAx>
        <c:axId val="4"/><c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="l"/><c:crossAx val="3"/>
        <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="pt-BR" sz="900"/><a:t>Qtde Descartes</a:t></a:r></a:p></c:rich></c:tx></c:title>
      </c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="t"/><c:overlay val="0"/></c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`;
}

/* ============== MAIN ============== */

async function main() {
  console.log('=== Exportacao Excel: Analise de Descartes ===\n');

  const { versoes, meta } = carregarDados();
  console.log('Versoes carregadas: %d (%s a %s)', versoes.length, versoes[0].versao, versoes[versoes.length - 1].versao);

  const stats = calcularEstatisticas(versoes);
  console.log('Estatisticas calculadas: media=%s%%, EWMA=%s%%', stats.media, round2(stats.ewmaAtual));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dashboard Diretrizes - Escrita Fiscal';
  wb.created = new Date();
  wb.properties.date1904 = false;

  criarAbaResumo(wb, versoes, stats);
  criarAbaDados(wb, versoes, stats);
  const { chart1Start, chart1End, chart2Start, chart2End } = criarAbaGraficos(wb, versoes, stats);
  criarAbaMetodologia(wb, stats);
  criarAbaDetalhes(wb, versoes);

  console.log('Abas criadas: Resumo, Dados por Versao, Graficos, Como se Calcula, Detalhes');

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const buffer = await wb.xlsx.writeBuffer();

  console.log('Injetando graficos nativos Excel (OOXML)...');
  const finalBuffer = await injetarGraficos(buffer, versoes.length, chart1Start, chart1End, chart2Start, chart2End);

  fs.writeFileSync(OUTPUT_FILE, finalBuffer);
  console.log('\nExcel gerado com sucesso!');
  console.log('Arquivo: %s', OUTPUT_FILE);
  console.log('Tamanho: %s KB', Math.round(finalBuffer.length / 1024));
}

main().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
