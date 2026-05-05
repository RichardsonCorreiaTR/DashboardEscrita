const ExcelJS = require('exceljs');
const path = require('path');
const { estilosExcel, applyBorder, setTitulo, setSubtitulo, setSecao, addHeaderRow } = require('./lib/estilos-excel');

const FERIADOS = [new Date('2026-04-03')];

function contarDiasUteisComFeriado(inicio, fim) {
  const di = new Date(inicio); di.setHours(0, 0, 0, 0);
  const df = new Date(fim); df.setHours(0, 0, 0, 0);
  if (df < di) return 0;
  let count = 0;
  const c = new Date(di);
  while (c <= df) {
    const dow = c.getDay();
    const ehFeriado = FERIADOS.some(f => {
      const fc = new Date(f); fc.setHours(0, 0, 0, 0);
      return c.getTime() === fc.getTime();
    });
    if (dow !== 0 && dow !== 6 && !ehFeriado) count++;
    c.setDate(c.getDate() + 1);
  }
  return count;
}

function fmtDH(val) {
  if (!val) return '-';
  const d = new Date(val);
  if (isNaN(d)) return '-';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtD(val) {
  if (!val) return '-';
  const d = new Date(val);
  if (isNaN(d)) return '-';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const dow = (v) => { const d = new Date(v); return isNaN(d) ? '-' : DIAS[d.getDay()]; };

async function main() {
  const indicadores = require('../data/cache/indicadores.json');
  const cg = indicadores['10.6A-04']['criticas-graves-5d'];
  const est = estilosExcel();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dashboard Diretrizes';

  const ws = wb.addWorksheet('Criticas-Graves 10.6A-04', {
    properties: { tabColor: { argb: est.cores.vermelho } }
  });
  ws.columns = [
    { width: 12 }, { width: 12 }, { width: 14 }, { width: 20 }, { width: 14 },
    { width: 20 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 14 }
  ];
  const C = 10;

  setTitulo(ws, 1, C, 'NEs CRITICAS / GRAVES - VERSAO 10.6A-04', est);
  setSubtitulo(ws, 2, C, 'Periodo: 24/03/2026 a 23/04/2026 | Diretriz 1.4.3 | Meta: 90% em ate 5 dias uteis | Feriado: 03/04/2026 (Sexta-Feira Santa)', est);

  let row = 4;
  setSecao(ws, row, C, 'RESUMO DO INDICADOR', est); row++;

  const resumo = [
    ['Indicador', 'NEs Criticas/Graves em ate 5 Dias Uteis (Diretriz 1.4.3)'],
    ['Meta', '90%'],
    ['Resultado', `${cg.valor}% (${cg.detalhes.dentro_5d} de ${cg.detalhes.total_periodo} dentro do prazo)`],
    ['Status', cg.status.toUpperCase()],
    ['Total liberadas no periodo', String(cg.detalhes.total_periodo)],
    ['Dentro de 5 dias uteis', String(cg.detalhes.dentro_5d)],
    ['Fora de 5 dias uteis', String(cg.detalhes.fora_5d)],
    ['Abertas (pendentes agora)', String(cg.detalhes.total_abertas)],
    ['Feriado considerado', '03/04/2026 (Sexta-Feira Santa)'],
  ];
  resumo.forEach(([label, valor]) => {
    const rw = ws.getRow(row);
    rw.getCell(1).value = label; rw.getCell(1).font = est.fontes.negrito;
    ws.mergeCells(`B${row}:J${row}`);
    rw.getCell(2).value = valor;
    rw.getCell(2).font = (label === 'Status' || label === 'Resultado') ? est.fontes.vermelho : est.fontes.normal;
    applyBorder(ws, row, C, est);
    if (label === 'Status') {
      for (let i = 1; i <= C; i++) rw.getCell(i).fill = est.fills.vermelhoBg;
    }
    row++;
  });

  row += 2;
  setSecao(ws, row, C, 'DETALHAMENTO - NEs GRAVES/CRITICAS LIBERADAS', est); row++;
  const headers = ['SAI', 'PSAI', 'Gravidade', 'Cadastro', 'Dia Cad.', 'Liberacao', 'Dia Lib.', 'D.U. (s/ feriado)', 'D.U. (c/ feriado)', 'Dentro 5d?'];
  addHeaderRow(ws, row, headers, est); row++;

  cg.detalhes.casos.forEach((caso, idx) => {
    const diasCF = contarDiasUteisComFeriado(caso.cadastro, caso.liberacao);
    const rw = ws.getRow(row);
    const vals = [caso.i_sai, caso.i_psai, caso.gravidade, fmtDH(caso.cadastro), dow(caso.cadastro), fmtDH(caso.liberacao), dow(caso.liberacao), caso.dias_uteis, diasCF, diasCF <= 5 ? 'SIM' : 'NAO'];
    vals.forEach((v, i) => {
      const c = rw.getCell(i + 1);
      c.value = v; c.font = est.fontes.normal; c.alignment = { horizontal: 'center' }; c.border = est.borda;
    });
    rw.getCell(10).font = est.fontes.vermelho;
    const bg = idx % 2 === 0 ? est.fills.branco : est.fills.cinzaBg;
    for (let i = 1; i <= C; i++) rw.getCell(i).fill = bg;
    row++;
  });

  const rT = ws.getRow(row);
  ws.mergeCells(`A${row}:G${row}`);
  rT.getCell(1).value = `TOTAL: ${cg.detalhes.total_periodo} NEs Graves - ${cg.detalhes.dentro_5d} dentro / ${cg.detalhes.fora_5d} fora = ${cg.valor}%`;
  rT.getCell(1).alignment = { horizontal: 'center' };
  for (let i = 1; i <= C; i++) { rT.getCell(i).fill = est.fills.vermelho; rT.getCell(i).font = est.fontes.brancoNegrito; rT.getCell(i).border = est.borda; }

  if (cg.detalhes.abertas_agora.length > 0) {
    row += 3;
    setSecao(ws, row, C, 'NEs GRAVES/CRITICAS ABERTAS (PENDENTES)', est, 'FFE67E22'); row++;
    addHeaderRow(ws, row, ['SAI', 'PSAI', 'Gravidade', 'Cadastro', 'Dia Cad.', 'Dias Corridos', 'D.U. Hoje', 'Status', '', ''], est, 'FFE67E22'); row++;

    cg.detalhes.abertas_agora.forEach(ab => {
      const diasUH = contarDiasUteisComFeriado(ab.CadastroPSAI, '2026-04-07');
      const rw = ws.getRow(row);
      [ab.i_sai, ab.i_psai, ab.gravidade_ne, fmtDH(ab.CadastroPSAI), dow(ab.CadastroPSAI), ab.dias_corridos, diasUH, diasUH <= 5 ? 'DENTRO DO PRAZO' : 'FORA DO PRAZO', '', ''].forEach((v, i) => {
        const c = rw.getCell(i + 1);
        c.value = v; c.font = est.fontes.normal; c.alignment = { horizontal: 'center' }; c.border = est.borda;
      });
      rw.getCell(8).font = diasUH <= 5 ? est.fontes.verde : est.fontes.vermelho;
      for (let i = 1; i <= C; i++) rw.getCell(i).fill = est.fills.laranjaBg;
      row++;
    });
  }

  row += 2;
  setSecao(ws, row, C, 'CONTAGEM DE DIAS UTEIS (26/03 a 07/04/2026)', est); row++;
  addHeaderRow(ws, row, ['Data', 'Dia', 'Tipo', 'Dia Util #', '', '', '', '', '', ''], est); row++;

  const ini = new Date('2026-03-26'); const fi = new Date('2026-04-07'); const cur = new Date(ini);
  let du = 0;
  while (cur <= fi) {
    const d = cur.getDay(); const ehFim = d === 0 || d === 6;
    const ehFer = cur.getTime() === new Date('2026-04-03').setHours(0, 0, 0, 0);
    const tipo = ehFer ? 'FERIADO' : (ehFim ? 'Fim de semana' : 'Dia util');
    if (!ehFim && !ehFer) du++;
    const rw = ws.getRow(row);
    [fmtD(cur), DIAS[d], tipo, (!ehFim && !ehFer) ? du : '-'].forEach((v, i) => {
      const c = rw.getCell(i + 1); c.value = v; c.font = est.fontes.normal; c.alignment = { horizontal: 'center' }; c.border = est.borda;
    });
    for (let i = 5; i <= C; i++) rw.getCell(i).border = est.borda;
    const bgF = ehFer ? 'FFFFF3CD' : (ehFim ? est.cores.cinzaBg : est.cores.branco);
    for (let i = 1; i <= C; i++) rw.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgF } };
    if (ehFer) rw.getCell(3).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFD35400' } };
    cur.setDate(cur.getDate() + 1); row++;
  }

  row += 2;
  ws.mergeCells(`A${row}:J${row}`);
  ws.getCell(`A${row}`).value = 'Nota: A coluna "D.U. (s/ feriado)" e o calculo original do sistema. "D.U. (c/ feriado)" aplica o ajuste de 03/04/2026.';
  ws.getCell(`A${row}`).font = est.fontes.pequena;
  row++;
  ws.mergeCells(`A${row}:J${row}`);
  ws.getCell(`A${row}`).value = `Fonte: indicadores.json | Gerado em: ${new Date().toISOString().substring(0, 16).replace('T', ' ')}`;
  ws.getCell(`A${row}`).font = est.fontes.pequena;

  const outPath = path.join(__dirname, '..', 'output', 'criticas-graves-10.6A-04.xlsx');
  await wb.xlsx.writeFile(outPath);
  console.log('Excel salvo em: ' + outPath);
}

main().catch(e => { console.error(e); process.exit(1); });
