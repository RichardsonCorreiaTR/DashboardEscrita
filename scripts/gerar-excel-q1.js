const ExcelJS = require('exceljs');
const path = require('path');

async function main() {
  const indicadores = require('../data/cache/indicadores.json');

  const va01 = indicadores['10.6A-02']['entrada-ne'].detalhes.versao_anterior;
  const e02 = indicadores['10.6A-02']['entrada-ne'].detalhes;
  const e03 = indicadores['10.6A-03']['entrada-ne'].detalhes;

  // Metas da planilha de diretrizes (guia Folha) - ATUALIZADAS
  const metaEntrada = { jan: 39, fev: 37, mar: 43 };
  const metaLiberacao = { jan: 39, fev: 37, mar: 43 };
  const metaSaldo = { jan: 301, fev: 301, mar: 301 };

  const dados = [
    {
      ver: '10.6A-01', mes: 'Janeiro', periodo: '26/dez/2025 a 22/jan/2026',
      entPrev: metaEntrada.jan, entReal: va01.entradas,
      descTotal: va01.descartes,
      libPrev: metaLiberacao.jan, libReal: va01.liberacoes,
      varSaldo: va01.variacao_saldo,
      desc26: va01.descartes - 12,
      reprovadas: 12, prescritas: 0,
      descExcl26: 12,
      metaSaldo: metaSaldo.jan,
    },
    {
      ver: '10.6A-02', mes: 'Fevereiro', periodo: '22/jan/2026 a 24/fev/2026',
      entPrev: metaEntrada.fev, entReal: e02.entradas,
      descTotal: e02.descartes,
      libPrev: metaLiberacao.fev, libReal: e02.liberacoes,
      varSaldo: e02.variacao_saldo,
      desc26: e02.descartes_por_situacao.find(s => s.i_sai_situacoes === 26).qtd,
      reprovadas: e02.descartes_por_situacao.find(s => s.i_sai_situacoes === 6)?.qtd || 0,
      prescritas: e02.descartes_por_situacao.find(s => s.i_sai_situacoes === 23)?.qtd || 0,
      descExcl26: e02.descartes - e02.descartes_por_situacao.find(s => s.i_sai_situacoes === 26).qtd,
      metaSaldo: metaSaldo.fev,
    },
    {
      ver: '10.6A-03', mes: 'Marco*', periodo: '24/fev/2026 a 23/mar/2026',
      entPrev: metaEntrada.mar, entReal: e03.entradas,
      descTotal: e03.descartes,
      libPrev: metaLiberacao.mar, libReal: e03.liberacoes,
      varSaldo: e03.variacao_saldo,
      desc26: e03.descartes_por_situacao.find(s => s.i_sai_situacoes === 26).qtd,
      reprovadas: e03.descartes_por_situacao.find(s => s.i_sai_situacoes === 6)?.qtd || 0,
      prescritas: e03.descartes_por_situacao.find(s => s.i_sai_situacoes === 23)?.qtd || 0,
      descExcl26: e03.descartes - e03.descartes_por_situacao.find(s => s.i_sai_situacoes === 26).qtd,
      metaSaldo: metaSaldo.mar,
    },
  ];

  const totQ1 = (fn) => dados.reduce((s, d) => s + fn(d), 0);
  const totalDesc26 = totQ1(d => d.desc26);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dashboard Diretrizes';
  wb.created = new Date();

  const azulEscuro = 'FF1B2A4A';
  const azulMedio = 'FF2E5090';
  const azulClaro = 'FFD6E4F0';
  const vermelho = 'FFC0392B';
  const vermelhoBg = 'FFFCE4EC';
  const verdeBg = 'FFE2EFDA';
  const laranjaBg = 'FFFDF2E9';
  const roxo = 'FF7B2D8E';
  const roxoBg = 'FFF3E5F5';
  const cinzaBg = 'FFF2F2F2';
  const branco = 'FFFFFFFF';

  const fonteTitulo = { name: 'Calibri', size: 14, bold: true, color: { argb: branco } };
  const fonteSubtitulo = { name: 'Calibri', size: 11, bold: true, color: { argb: branco } };
  const fonteSecao = { name: 'Calibri', size: 11, bold: true, color: { argb: azulEscuro } };
  const fonteNormal = { name: 'Calibri', size: 10 };
  const fonteNegrito = { name: 'Calibri', size: 10, bold: true };
  const fonteDestaque = { name: 'Calibri', size: 11, bold: true };
  const fontePequena = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF888888' } };

  const bordaFina = {
    top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
    left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
    bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
    right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
  };

  function addRow(ws, r, label, vals, opts = {}) {
    const rw = ws.getRow(r);
    rw.getCell(1).value = label;
    rw.getCell(1).font = opts.bold ? fonteNegrito : fonteNormal;
    if (opts.indent) rw.getCell(1).alignment = { indent: opts.indent };
    vals.forEach((v, i) => {
      const c = rw.getCell(i + 2);
      c.value = v;
      c.font = opts.bold ? fonteDestaque : fonteNormal;
      c.alignment = { horizontal: 'center' };
      if (opts.fontColor) c.font = { ...c.font, color: { argb: opts.fontColor } };
    });
    for (let i = 1; i <= 6; i++) rw.getCell(i).border = bordaFina;
    if (opts.bg) {
      for (let i = 1; i <= 6; i++) rw.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.bg } };
    }
    return r + 1;
  }

  function setSecao(ws, row, text, bgColor) {
    ws.mergeCells('A' + row + ':F' + row);
    ws.getCell('A' + row).value = text;
    ws.getCell('A' + row).font = fonteSecao;
    ws.getCell('A' + row).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    for (let i = 1; i <= 6; i++) ws.getRow(row).getCell(i).border = bordaFina;
  }

  // ===== ABA 1: CONSOLIDADO =====
  const ws1 = wb.addWorksheet('Consolidado Q1', { properties: { tabColor: { argb: azulMedio } } });
  ws1.columns = [
    { width: 45 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 18 }, { width: 18 }
  ];

  ws1.mergeCells('A1:F1');
  ws1.getCell('A1').value = 'ANALISE Q1 2026 - NEs ESCRITA';
  ws1.getCell('A1').font = fonteTitulo;
  ws1.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: azulEscuro } };
  ws1.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(1).height = 32;

  ws1.mergeCells('A2:F2');
  ws1.getCell('A2').value = 'Fonte: indicadores.json (' + indicadores._meta.atualizado_em.substring(0, 10) + ') | Metas: Diretrizes Produto 2026 - Metas.xlsx (guia Folha)';
  ws1.getCell('A2').font = fontePequena;
  ws1.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cinzaBg } };
  ws1.getCell('A2').alignment = { horizontal: 'center' };

  const header = ['Indicador', 'Jan (10.6A-01)', 'Fev (10.6A-02)', 'Mar* (10.6A-03)', 'Total Q1', 'Delta vs Meta'];
  const hRow = ws1.getRow(4);
  header.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value = h;
    c.font = fonteSubtitulo;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: azulMedio } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = bordaFina;
  });
  hRow.height = 28;

  // ---- ENTRADAS ----
  let row = 5;
  setSecao(ws1, row, 'ENTRADAS DE NE', azulClaro);
  row++;

  const tEntPrev = totQ1(d => d.entPrev);
  const tEntReal = totQ1(d => d.entReal);
  const tDescExcl26 = totQ1(d => d.descExcl26);
  const tEntLiq = tEntReal - tDescExcl26;

  row = addRow(ws1, row, 'Previsao (Diretrizes)', [dados[0].entPrev, dados[1].entPrev, dados[2].entPrev, tEntPrev, '-']);
  row = addRow(ws1, row, 'Realizado (bruto)', [dados[0].entReal, dados[1].entReal, dados[2].entReal, tEntReal, '+' + (tEntReal - tEntPrev)], { fontColor: vermelho });
  row = addRow(ws1, row, 'Descartes (excl. mot. 26)', [dados[0].descExcl26, dados[1].descExcl26, dados[2].descExcl26, tDescExcl26, '-'], { bg: laranjaBg });
  row = addRow(ws1, row, '   Reprovada', [dados[0].reprovadas, dados[1].reprovadas, dados[2].reprovadas, totQ1(d => d.reprovadas), '-'], { indent: 2 });
  row = addRow(ws1, row, '   Prescrita', [dados[0].prescritas, dados[1].prescritas, dados[2].prescritas, totQ1(d => d.prescritas), '-'], { indent: 2 });

  const entLiqArr = dados.map(d => d.entReal - d.descExcl26);
  row = addRow(ws1, row, 'Entrada liquida (Real - Desc excl.26)', [entLiqArr[0], entLiqArr[1], entLiqArr[2], tEntLiq, '+' + (tEntLiq - tEntPrev)], { bold: true, bg: vermelhoBg, fontColor: vermelho });

  // ---- LIBERACOES ----
  row++;
  setSecao(ws1, row, 'LIBERACOES DE NE', azulClaro);
  row++;

  const tLibPrev = totQ1(d => d.libPrev);
  const tLibReal = totQ1(d => d.libReal);

  row = addRow(ws1, row, 'Previsao (Diretrizes)', [dados[0].libPrev, dados[1].libPrev, dados[2].libPrev, tLibPrev, '-']);
  row = addRow(ws1, row, 'Realizado', [dados[0].libReal, dados[1].libReal, dados[2].libReal, tLibReal, tLibReal - tLibPrev], { bold: true, fontColor: vermelho });

  const saldoLib = dados.map(d => d.libReal - d.libPrev);
  const tSaldoLib = saldoLib.reduce((a, b) => a + b, 0);
  row = addRow(ws1, row, 'Saldo liberacao (debito por versao)', [saldoLib[0], saldoLib[1], saldoLib[2], tSaldoLib, tSaldoLib + ' NEs'], { bold: true, bg: vermelhoBg, fontColor: vermelho });

  const pcts = dados.map(d => Math.round(d.libReal / d.libPrev * 100) + '%');
  row = addRow(ws1, row, 'Atingimento (%)', [pcts[0], pcts[1], pcts[2], Math.round(tLibReal / tLibPrev * 100) + '%', '-'], { bg: cinzaBg });

  // ---- DESCARTES MOT.26 (SEPARADO) ----
  row++;
  setSecao(ws1, row, 'DESCARTES MOT. 26 - "Liberado em versoes anteriores"', roxoBg);
  row++;

  row = addRow(ws1, row, 'Qtd descartes mot. 26', [dados[0].desc26, dados[1].desc26, dados[2].desc26, totalDesc26, '-'], { bold: true, fontColor: roxo, bg: roxoBg });

  // ---- SALDOS ----
  row++;
  setSecao(ws1, row, 'SALDOS', azulClaro);
  row++;

  // Saldo SEM mot.26 = Entradas - Descartes(excl26) - Liberacoes
  const saldoSemMot26 = dados.map(d => d.entReal - d.descExcl26 - d.libReal);
  const tSaldoSem = saldoSemMot26.reduce((a, b) => a + b, 0);
  row = addRow(ws1, row, 'Saldo versao SEM mot.26 (Ent - DescExcl26 - Lib)', [saldoSemMot26[0], saldoSemMot26[1], saldoSemMot26[2], tSaldoSem, '-'], { bold: true });

  // Saldo FINAL = Entradas - Descartes TOTAL - Liberacoes = variacao_saldo
  row = addRow(ws1, row, 'Saldo versao FINAL (Ent - DescTotal - Lib)', [dados[0].varSaldo, dados[1].varSaldo, dados[2].varSaldo, totQ1(d => d.varSaldo), '-'], { bold: true, bg: verdeBg });

  // Meta saldo
  row = addRow(ws1, row, 'Meta saldo NE (Diretrizes)', [dados[0].metaSaldo, dados[1].metaSaldo, dados[2].metaSaldo, '-', '-']);

  // Saldo NE real do indicador
  const saldoNe02 = indicadores['10.6A-02']['saldo-ne']?.valor;
  const saldoNe03 = indicadores['10.6A-03']['saldo-ne']?.valor;
  row = addRow(ws1, row, 'Saldo NE real (ultimo indicador)', ['-', saldoNe02 || '-', saldoNe03 || '-', '-', '-'], { bold: true });

  // ---- NOTA ----
  row++;
  ws1.mergeCells('A' + row + ':F' + row);
  ws1.getCell('A' + row).value = '* Marco: versao 10.6A-03 em andamento (encerra 23/mar/2026). Dados atualizados em ' + indicadores._meta.atualizado_em.substring(0, 10) + '.';
  ws1.getCell('A' + row).font = fontePequena;
  row++;
  ws1.mergeCells('A' + row + ':F' + row);
  ws1.getCell('A' + row).value = 'Saldo SEM mot.26: desconsidera os descartes por "Liberado em versoes anteriores" (limpeza de backlog). Mostra o impacto real de entradas vs liberacoes.';
  ws1.getCell('A' + row).font = fontePequena;
  row++;
  ws1.mergeCells('A' + row + ':F' + row);
  ws1.getCell('A' + row).value = 'Saldo FINAL: considera TODOS os descartes incluindo mot.26. Variacao efetiva do saldo de NEs no periodo.';
  ws1.getCell('A' + row).font = fontePequena;

  // ---- PERIODOS ----
  row += 2;
  ws1.mergeCells('A' + row + ':F' + row);
  ws1.getCell('A' + row).value = 'PERIODOS DAS VERSOES (PIAZZA)';
  ws1.getCell('A' + row).font = fonteSecao;
  ws1.getCell('A' + row).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cinzaBg } };
  row++;
  ['Versao', 'Mes', 'Inicio', 'Fim', '', ''].forEach((h, i) => {
    ws1.getRow(row).getCell(i + 1).value = h;
    ws1.getRow(row).getCell(i + 1).font = fonteNegrito;
    ws1.getRow(row).getCell(i + 1).border = bordaFina;
    ws1.getRow(row).getCell(i + 1).alignment = { horizontal: 'center' };
  });
  row++;
  dados.forEach(d => {
    const rw = ws1.getRow(row);
    [d.ver, d.mes, d.periodo.split(' a ')[0], d.periodo.split(' a ')[1]].forEach((v, i) => {
      rw.getCell(i + 1).value = v;
      rw.getCell(i + 1).font = fonteNormal;
      rw.getCell(i + 1).alignment = { horizontal: 'center' };
      rw.getCell(i + 1).border = bordaFina;
    });
    row++;
  });

  // ===== ABA 2: DESCARTES MOT. 26 =====
  const ws2 = wb.addWorksheet('Descartes Mot.26', { properties: { tabColor: { argb: roxo } } });
  ws2.columns = [{ width: 16 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 18 }, { width: 14 }];

  ws2.mergeCells('A1:F1');
  ws2.getCell('A1').value = 'DESCARTES MOTIVO 26 - "Liberado em versoes anteriores"';
  ws2.getCell('A1').font = fonteTitulo;
  ws2.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: roxo } };
  ws2.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(1).height = 32;

  ws2.mergeCells('A2:F2');
  ws2.getCell('A2').value = 'Limpeza de backlog: NEs ja liberadas em versoes passadas. Total Q1: ' + totalDesc26 + ' NEs.';
  ws2.getCell('A2').font = fontePequena;
  ws2.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cinzaBg } };
  ws2.getCell('A2').alignment = { horizontal: 'center', wrapText: true };
  ws2.getRow(2).height = 28;

  const h2 = ['Versao', 'Mes', 'PSAI', 'SAI', 'Data Descarte', 'Gravidade'];
  const hRow2 = ws2.getRow(4);
  h2.forEach((h, i) => {
    const c = hRow2.getCell(i + 1);
    c.value = h;
    c.font = fonteSubtitulo;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: roxo } };
    c.alignment = { horizontal: 'center' };
    c.border = bordaFina;
  });

  let r2 = 5;

  const desc26Lista02 = (e02.descartes_lista || []).filter(d => d.i_sai_situacoes === 26);
  const desc26Lista03 = (e03.descartes_lista || []).filter(d => d.i_sai_situacoes === 26);

  ws2.mergeCells('A' + r2 + ':F' + r2);
  ws2.getCell('A' + r2).value = 'Janeiro (10.6A-01) - ' + dados[0].desc26 + ' descartes mot.26 (detalhe nao disponivel no cache atual)';
  ws2.getCell('A' + r2).font = { ...fonteNormal, italic: true, color: { argb: 'FF888888' } };
  ws2.getCell('A' + r2).alignment = { horizontal: 'center' };
  for (let i = 1; i <= 6; i++) ws2.getRow(r2).getCell(i).border = bordaFina;
  r2++;

  const allListas = [
    ...desc26Lista02.map(d => ({ ...d, ver: '10.6A-02', mes: 'Fevereiro', alt: true })),
    ...desc26Lista03.map(d => ({ ...d, ver: '10.6A-03', mes: 'Marco', alt: false })),
  ];

  allListas.forEach(d => {
    const rw = ws2.getRow(r2);
    [d.ver, d.mes, d.i_psai, d.i_sai || '-', (d.Descarte || '').substring(0, 10), d.gravidade_ne || 'Normal'].forEach((val, i) => {
      rw.getCell(i + 1).value = val;
      rw.getCell(i + 1).font = fonteNormal;
      rw.getCell(i + 1).alignment = { horizontal: 'center' };
      rw.getCell(i + 1).border = bordaFina;
    });
    if (d.alt) {
      for (let i = 1; i <= 6; i++) rw.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: roxoBg } };
    }
    r2++;
  });

  ws2.mergeCells('A' + r2 + ':D' + r2);
  ws2.getRow(r2).getCell(1).value = 'TOTAL Q1: ' + totalDesc26 + ' descartes motivo 26';
  ws2.getRow(r2).getCell(1).alignment = { horizontal: 'center' };
  for (let i = 1; i <= 6; i++) {
    ws2.getRow(r2).getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: roxo } };
    ws2.getRow(r2).getCell(i).font = { ...fonteDestaque, color: { argb: branco } };
    ws2.getRow(r2).getCell(i).border = bordaFina;
  }

  // ===== ABA 3: OVERVIEW =====
  const ws3 = wb.addWorksheet('Overview', { properties: { tabColor: { argb: vermelho } } });
  ws3.columns = [{ width: 55 }, { width: 18 }, { width: 18 }, { width: 20 }];

  ws3.mergeCells('A1:D1');
  ws3.getCell('A1').value = 'OVERVIEW Q1 2026 - IMPACTO';
  ws3.getCell('A1').font = fonteTitulo;
  ws3.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: vermelho } };
  ws3.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws3.getRow(1).height = 32;

  const ohRow = ws3.getRow(3);
  ['', 'Meta Q1', 'Realizado Q1', 'Delta'].forEach((h, i) => {
    ohRow.getCell(i + 1).value = h;
    ohRow.getCell(i + 1).font = fonteSubtitulo;
    ohRow.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: azulMedio } };
    ohRow.getCell(i + 1).alignment = { horizontal: 'center' };
    ohRow.getCell(i + 1).border = bordaFina;
  });

  const overviewRows = [
    { label: 'Entradas brutas', prev: tEntPrev, real: tEntReal, delta: '+' + (tEntReal - tEntPrev) + ' (+' + Math.round((tEntReal - tEntPrev) / tEntPrev * 100) + '%)' },
    { label: 'Descartes (excl. mot.26)', prev: '-', real: tDescExcl26, delta: '-' },
    { label: 'Entradas liquidas', prev: tEntPrev, real: tEntLiq, delta: '+' + (tEntLiq - tEntPrev), hl: true },
    { label: '' },
    { label: 'Liberacoes', prev: tLibPrev, real: tLibReal, delta: (tLibReal - tLibPrev) + ' (' + Math.round((tLibReal - tLibPrev) / tLibPrev * 100) + '%)', hl: true },
    { label: 'Debito liberacao Q1', prev: '-', real: '-', delta: tSaldoLib + ' NEs', hl: true },
    { label: '' },
    { label: 'Descartes mot. 26 (limpeza backlog)', prev: '-', real: totalDesc26, delta: '-' },
    { label: '' },
    { label: 'Saldo versao SEM mot.26 (Ent-DescExcl26-Lib)', prev: '-', real: tSaldoSem, delta: 'Impacto real' },
    { label: 'Saldo versao FINAL (Ent-DescTotal-Lib)', prev: '-', real: totQ1(d => d.varSaldo), delta: 'Variacao efetiva', hl: true },
    { label: '' },
    { label: 'Meta saldo NE (Diretrizes)', prev: 301, real: saldoNe03 || '-', delta: saldoNe03 ? (saldoNe03 - 301) : '-' },
  ];

  let r3 = 4;
  overviewRows.forEach(or => {
    const rw = ws3.getRow(r3);
    [or.label, or.prev || '', or.real || '', or.delta || ''].forEach((v, i) => {
      const c = rw.getCell(i + 1);
      c.value = v;
      c.font = or.hl ? fonteDestaque : fonteNormal;
      c.alignment = { horizontal: i === 0 ? 'left' : 'center' };
      if (v !== '') c.border = bordaFina;
    });
    if (or.hl) {
      for (let i = 1; i <= 4; i++) rw.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: vermelhoBg } };
    }
    r3++;
  });

  r3 += 2;
  ws3.getRow(r3).getCell(1).value = 'PONTOS DE ATENCAO:';
  ws3.getRow(r3).getCell(1).font = fonteDestaque;
  r3++;
  [
    'Fevereiro: 80 entradas brutas = mais que o dobro da meta (37)',
    'Marco: 67 entradas brutas vs meta de 43 (+56%), versao ainda em andamento',
    'Liberacoes: Jan ' + dados[0].libReal + '/' + dados[0].libPrev + ' (' + pcts[0] + '), Fev ' + dados[1].libReal + '/' + dados[1].libPrev + ' (' + pcts[1] + '), Mar ' + dados[2].libReal + '/' + dados[2].libPrev + ' (' + pcts[2] + ')',
    totalDesc26 + ' NEs descartadas por mot.26 (backlog) - Fev concentrou ' + dados[1].desc26 + ', Mar ' + dados[2].desc26,
    'Sem os descartes mot.26, o saldo teria subido ' + tSaldoSem + ' NEs no Q1',
    'Com mot.26 incluido, saldo efetivo variou ' + totQ1(d => d.varSaldo) + ' NEs no Q1',
  ].forEach(p => {
    ws3.getRow(r3).getCell(1).value = '  - ' + p;
    ws3.getRow(r3).getCell(1).font = fonteNormal;
    r3++;
  });

  const outPath = path.join(__dirname, '..', 'output', 'analise-q1-2026-nes.xlsx');
  await wb.xlsx.writeFile(outPath);
  console.log('Excel salvo em: ' + outPath);
  console.log('');
  console.log('DADOS (fonte: indicadores.json ' + indicadores._meta.atualizado_em + '):');
  console.log('Metas (Diretrizes Folha): Ent ' + metaEntrada.jan + '/' + metaEntrada.fev + '/' + metaEntrada.mar + ' | Lib ' + metaLiberacao.jan + '/' + metaLiberacao.fev + '/' + metaLiberacao.mar);
  dados.forEach(d => {
    const saldoSem = d.entReal - d.descExcl26 - d.libReal;
    console.log(d.mes + ' (' + d.ver + '): Ent=' + d.entReal + ' DescTotal=' + d.descTotal + ' (mot26=' + d.desc26 + ' repr=' + d.reprovadas + ' presc=' + d.prescritas + ') Lib=' + d.libReal + ' SaldoSem26=' + saldoSem + ' SaldoFinal=' + d.varSaldo);
  });
}

main().catch(e => { console.error(e); process.exit(1); });
