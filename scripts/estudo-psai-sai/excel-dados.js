/**
 * excel-dados.js - Abas "Descartes" e "Dados Brutos" (atividades por SAI se disponivel)
 */

const { COR, sHeader, sCell, sTitulo, sSubtitulo, fd, aplicarHeaders, aplicarLinha } = require('./excel-estilos');
const q = require('./queries');

function nomeAnalista(id) {
  const e = q.EQUIPE.find(e => e.sgd === id || e.iu === id);
  return e ? e.nome : `ID:${id}`;
}

function criarAbaDescartes(wb, analise) {
  const ws = wb.addWorksheet('Descartes', { properties: { tabColor: { argb: COR.laranja } } });
  ws.columns = [
    { width: 3 }, { width: 9 }, { width: 9 }, { width: 14 }, { width: 18 },
    { width: 10 }, { width: 20 }, { width: 40 }, { width: 3 }
  ];

  ws.mergeCells('B1:H1');
  ws.getCell('B1').value = `Descartes Detalhados - ${analise.descartes.length} NEs descartadas`;
  ws.getCell('B1').style = sTitulo(14);
  ws.getRow(1).height = 28;

  aplicarHeaders(ws, 3, ['PSAI', 'SAI', 'Data', 'Motivo', 'Gravidade', 'Analista', 'Descricao']);
  let row = 4;
  for (const d of analise.descartes) {
    const vals = [d.i_psai, d.i_sai || '-', fd(d.Descarte), d.motivo || '-',
      d.gravidade_ne, d.analista_nome, (d.descricao || '').substring(0, 100)];
    vals.forEach((v, i) => {
      ws.getCell(row, i + 2).value = v;
      ws.getCell(row, i + 2).style = sCell((row - 4) % 2 === 0);
    });
    ws.getCell(row, 8).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    row++;
  }

  if (row > 4) ws.autoFilter = { from: { row: 3, column: 2 }, to: { row: row - 1, column: 8 } };
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
}

function criarAbaImpactoDefinicao(wb, analise) {
  const ws = wb.addWorksheet('Impacto Definicao', { properties: { tabColor: { argb: COR.vermelho } } });
  ws.columns = [
    { width: 3 }, { width: 14 }, { width: 10 }, { width: 10 }, { width: 10 },
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 3 }
  ];

  ws.mergeCells('B2:H2');
  ws.getCell('B2').value = 'Impacto do Campo Definicao no Tempo por NE';
  ws.getCell('B2').style = sTitulo(14);
  ws.mergeCells('B3:H3');
  ws.getCell('B3').value = 'Base = todas as NEs (SAIs + descartadas + pendentes) | Tempo em minutos';
  ws.getCell('B3').style = sSubtitulo();

  const g = analise.geral;
  const eq = analise.equipe;
  const dif = g.mediaComDef - g.mediaSemDef;
  const difEq = eq.mediaComDef - eq.mediaSemDef;

  ws.mergeCells('B5:H5');
  ws.getCell('B5').value = 'COM Definicao vs SEM Definicao';
  ws.getCell('B5').style = sTitulo(12);

  aplicarHeaders(ws, 6, ['Escopo', 'NEs COM', 'Media COM', 'NEs SEM', 'Media SEM', 'Diferenca', '-']);
  aplicarLinha(ws, 7, [
    'Todos', g.comDef, `${g.mediaComDef} min`, g.semDef, `${g.mediaSemDef} min`,
    `${dif > 0 ? '+' : ''}${dif} min`, ''
  ], true);
  aplicarLinha(ws, 8, [
    'Equipe', eq.comDef, `${eq.mediaComDef} min`, eq.semDef, `${eq.mediaSemDef} min`,
    `${difEq > 0 ? '+' : ''}${difEq} min`, ''
  ], false);

  let row = 10;
  ws.mergeCells(`B${row}:H${row}`);
  ws.getCell(`B${row}`).value = 'Evolucao por versao: % NEs com Definicao e media (Todos)';
  ws.getCell(`B${row}`).style = sTitulo(12);
  row++;
  aplicarHeaders(ws, row, ['Versao', 'NEs', 'Com Def.', '% Def.', 'Media/NE', 'Med. COM', 'Med. SEM']);
  row++;
  for (const v of analise.porVersaoTodos) {
    const doV = analise.nes.filter(n => n.versao === v.versao);
    const cDef = doV.filter(n => n.temDefinicao);
    const sDef = doV.filter(n => !n.temDefinicao);
    const pct = doV.length > 0 ? Math.round(cDef.length / doV.length * 100) : 0;
    const mCom = cDef.length > 0 ? Math.round(cDef.reduce((s, n) => s + n.tempoTotal, 0) / cDef.length) : 0;
    const mSem = sDef.length > 0 ? Math.round(sDef.reduce((s, n) => s + n.tempoTotal, 0) / sDef.length) : 0;
    aplicarLinha(ws, row, [
      v.versao, v.nes, cDef.length, `${pct}%`,
      `${v.mediaPorNE} min`, cDef.length > 0 ? `${mCom} min` : '-', `${mSem} min`
    ], row % 2 === 0);
    row++;
  }

  row += 1;
  ws.mergeCells(`B${row}:H${row}`);
  ws.getCell(`B${row}`).value = 'NEs COM campo Definicao preenchido (lista)';
  ws.getCell(`B${row}`).style = sTitulo(12);
  row++;
  aplicarHeaders(ws, row, ['PSAI', 'SAI', 'Versao', 'Analista', 'Equipe?', 'Tempo (min)', 'Descricao']);
  row++;

  const comDefList = analise.nes.filter(n => n.temDefinicao)
    .sort((a, b) => b.tempoTotal - a.tempoTotal);
  for (const ne of comDefList) {
    aplicarLinha(ws, row, [
      ne.i_psai, ne.i_sai || '-', ne.versao || '-', ne.analista,
      ne.isEquipe ? 'Sim' : 'Nao', `${ne.tempoTotal} min`,
      (ne.descricao || '').substring(0, 70)
    ], row % 2 === 0);
    ws.getCell(row, 8).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    row++;
  }

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
}

module.exports = { criarAbaDescartes, criarAbaImpactoDefinicao };
