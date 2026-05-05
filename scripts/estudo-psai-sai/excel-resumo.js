/**
 * excel-resumo.js - Base = PSAI. Consolida por analista, por versao, media por NE.
 */

const { COR, sTitulo, sSubtitulo, aplicarHeaders, aplicarLinha } = require('./excel-estilos');

function criarAbaResumo(wb, analise) {
  const ws = wb.addWorksheet('Resumo', { properties: { tabColor: { argb: COR.azulEscuro } } });
  ws.columns = [
    { width: 3 }, { width: 20 }, { width: 10 }, { width: 10 }, { width: 10 },
    { width: 10 }, { width: 13 }, { width: 13 }, { width: 3 }
  ];

  ws.mergeCells('B2:H2');
  ws.getCell('B2').value = 'Estudo NE Folha - Tempo Total por PSAI (minutos)';
  ws.getCell('B2').style = sTitulo(16);
  ws.mergeCells('B3:H3');
  const g = analise.geral;
  ws.getCell('B3').value = `${g.totalNEs} NEs (SAIs + descartadas + pendentes) | Gerado ${new Date().toLocaleDateString('pt-BR')}`;
  ws.getCell('B3').style = sSubtitulo();

  ws.mergeCells('B5:H5');
  ws.getCell('B5').value = 'PANORAMA';
  ws.getCell('B5').style = sTitulo(13);

  aplicarHeaders(ws, 6, ['Escopo', 'NEs', 'Total (min)', 'Media/NE', 'COM Def.', 'Media COM', 'Media SEM']);
  const escopos = [analise.geral, analise.equipe];
  escopos.forEach((m, i) => {
    aplicarLinha(ws, 7 + i, [
      m.label, m.totalNEs, `${m.totalMin} min`, `${m.mediaPorNE} min`,
      `${m.comDef} NEs`, `${m.mediaComDef} min`, `${m.mediaSemDef} min`
    ], i % 2 === 0);
  });

  let row = 10;
  ws.mergeCells(`B${row}:H${row}`);
  ws.getCell(`B${row}`).value = 'POR ANALISTA (consolidado do periodo)';
  ws.getCell(`B${row}`).style = sTitulo(13);
  row++;
  aplicarHeaders(ws, row, [
    'Analista', 'Equipe?', 'NEs', 'SAIs', 'Descart.',
    'Total (min)', 'Media/NE'
  ]);
  row++;
  for (const a of analise.porAnalista) {
    aplicarLinha(ws, row, [
      a.analista, a.isEquipe ? 'Sim' : 'Nao', a.nes, a.sais,
      a.descartadas, `${a.minutos} min`, `${a.mediaPorNE} min`
    ], row % 2 === 0);
    row++;
  }

  row += 1;
  ws.mergeCells(`B${row}:H${row}`);
  ws.getCell(`B${row}`).value = 'POR VERSAO - Todos';
  ws.getCell(`B${row}`).style = sTitulo(13);
  row++;
  aplicarHeaders(ws, row, [
    'Versao', 'NEs', 'SAIs', 'Descart.', 'Pendentes',
    'Total (min)', 'Media/NE'
  ]);
  row++;
  for (const v of analise.porVersaoTodos) {
    aplicarLinha(ws, row, [
      v.versao, v.nes, v.sais, v.descartadas, v.pendentes,
      `${v.minutos} min`, `${v.mediaPorNE} min`
    ], row % 2 === 0);
    row++;
  }

  row += 1;
  ws.mergeCells(`B${row}:H${row}`);
  ws.getCell(`B${row}`).value = 'POR VERSAO - Equipe';
  ws.getCell(`B${row}`).style = sTitulo(13);
  row++;
  aplicarHeaders(ws, row, [
    'Versao', 'NEs', 'SAIs', 'Descart.', 'Pendentes',
    'Total (min)', 'Media/NE'
  ]);
  row++;
  for (const v of analise.porVersaoEquipe) {
    aplicarLinha(ws, row, [
      v.versao, v.nes, v.sais, v.descartadas, v.pendentes,
      `${v.minutos} min`, `${v.mediaPorNE} min`
    ], row % 2 === 0);
    row++;
  }

  row += 1;
  ws.mergeCells(`B${row}:H${row}`);
  ws.getCell(`B${row}`).value = 'DETALHE: Analista x Versao';
  ws.getCell(`B${row}`).style = sTitulo(13);
  row++;
  aplicarHeaders(ws, row, [
    'Analista', 'Versao', 'NEs', 'SAIs', 'Descart.',
    'Total (min)', 'Media/NE'
  ]);
  row++;
  const detalheOrdenado = [...analise.detalheAV]
    .sort((a, b) => a.analista.localeCompare(b.analista) || (a.versao || '').localeCompare(b.versao || ''));
  for (const d of detalheOrdenado) {
    if (d.analista === 'Vitor Justino') continue;
    const media = d.nes > 0 ? Math.round(d.minutos / d.nes) : 0;
    aplicarLinha(ws, row, [
      d.analista, d.versao || '-', d.nes, d.sais, d.descartadas,
      `${d.minutos} min`, `${media} min`
    ], row % 2 === 0);
    row++;
  }

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
}

module.exports = { criarAbaResumo };
