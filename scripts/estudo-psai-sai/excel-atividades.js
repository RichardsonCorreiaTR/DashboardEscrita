/**
 * excel-atividades.js - Aba "Tempo Analistas": tempo total por analista + atividades mensais
 */

const path = require('path');
const fs = require('fs');
const { COR, sTitulo, sSubtitulo, aplicarHeaders, aplicarLinha } = require('./excel-estilos');
const q = require('./queries');

const CACHE = path.join(__dirname, '..', '..', 'data', 'cache', 'estudo-psai-sai');

function criarAbaTempoAnalistas(wb, analise) {
  const ws = wb.addWorksheet('Tempo Analistas', { properties: { tabColor: { argb: COR.verde } } });
  ws.columns = [
    { width: 3 }, { width: 22 }, { width: 8 }, { width: 8 }, { width: 8 },
    { width: 8 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 3 }
  ];

  ws.mergeCells('B2:J2');
  ws.getCell('B2').value = 'Tempo Total por Analista (minutos)';
  ws.getCell('B2').style = sTitulo(14);
  ws.mergeCells('B3:J3');
  ws.getCell('B3').value = 'Tempo = tempo_analise + tempo_definicao por PSAI | Excl. Vitor (gestor)';
  ws.getCell('B3').style = sSubtitulo();

  aplicarHeaders(ws, 5, [
    'Analista', 'Equipe?', 'NEs', 'SAIs', 'Descart.',
    'Tempo Total', 'Media/NE', '-', '-'
  ]);
  let row = 6;
  for (const a of analise.porAnalista) {
    aplicarLinha(ws, row, [
      a.analista, a.isEquipe ? 'Sim' : 'Nao', a.nes,
      a.sais, a.descartadas, `${a.minutos} min`,
      `${a.mediaPorNE} min`, '', ''
    ], (row - 6) % 2 === 0);
    row++;
  }

  row += 2;
  ws.mergeCells(`B${row}:J${row}`);
  ws.getCell(`B${row}`).value = 'Registro de Atividades Mensal (vanalise_registro_atividades)';
  ws.getCell(`B${row}`).style = sTitulo(13);
  row++;
  ws.mergeCells(`B${row}:J${row}`);
  ws.getCell(`B${row}`).value = 'Foco produto: NE + SAI + SS = trabalho direto | Ausencias separadas';
  ws.getCell(`B${row}`).style = sSubtitulo();
  row++;

  let atividades;
  try { atividades = JSON.parse(fs.readFileSync(path.join(CACHE, 'atividades.json'), 'utf-8')); } catch { return; }

  const meses = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03'];
  const mesesLbl = ['Nov/25', 'Dez/25', 'Jan/26', 'Fev/26', 'Mar/26*'];

  for (const e of q.EQUIPE.filter(e => e.nome !== 'Vitor Justino')) {
    const a = atividades[e.iu];
    if (!a || !a.meses) continue;
    row++;
    ws.getCell(`B${row}`).value = e.nome;
    ws.getCell(`B${row}`).style = { font: { bold: true, size: 11, name: 'Segoe UI', color: { argb: COR.azulEscuro } } };
    row++;
    aplicarHeaders(ws, row, ['Categoria', ...mesesLbl, '-', '-', '-', '-']);
    row++;

    const cats = ['ne', 'sai', 'ss', 'teste', 'reuniao', 'outros', 'ausencia'];
    for (const cat of cats) {
      const vals = [cat.toUpperCase(), ...meses.map(m => {
        const mes = a.meses[m];
        return mes && mes.categorias[cat] ? Math.round(mes.categorias[cat] / 60) + 'h' : '-';
      }), '', '', '', ''];
      aplicarLinha(ws, row, vals, cats.indexOf(cat) % 2 === 0);
      if (cat === 'ne') {
        for (let c = 3; c <= 7; c++) {
          ws.getCell(row, c).font = { size: 10, name: 'Segoe UI', bold: true, color: { argb: COR.azulMedio } };
        }
      }
      row++;
    }
    const totais = meses.map(m => {
      const mes = a.meses[m];
      return mes ? Math.round(mes.total / 60) + 'h' : '-';
    });
    aplicarLinha(ws, row, ['TOTAL', ...totais, '', '', '', ''], false, true);
    row++;
  }

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
}

module.exports = { criarAbaTempoAnalistas };
