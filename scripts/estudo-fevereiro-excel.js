/**
 * estudo-fevereiro-excel.js
 *
 * Gera Excel do estudo comparativo dos fevereiros NE Folha.
 * Abas: Resumo (versao + analise), Graves/Criticas, Todas NEs.
 */

const path = require('path');
const ExcelJS = require('exceljs');

const COR = {
  azulEscuro: 'FF1E3A5F', azulMedio: 'FF2B5797', azulClaro: 'FFD6E4F0',
  verde: 'FF22C55E', verdeBg: 'FFDCFCE7', vermelho: 'FFEF4444', vermelhoBg: 'FFFEE2E2',
  amarelo: 'FFEAB308', cinzaClaro: 'FFF3F4F6', branco: 'FFFFFFFF',
  preto: 'FF1F2937', cinzaTexto: 'FF6B7280', laranja: 'FFEA580C'
};

const BORDA = (() => {
  const b = { style: 'thin', color: { argb: 'FFD1D5DB' } };
  return { top: b, bottom: b, left: b, right: b };
})();

function sH() {
  return {
    font: { bold: true, color: { argb: COR.branco }, size: 10, name: 'Segoe UI' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.azulMedio } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: BORDA
  };
}

function sC(z, bold) {
  return {
    font: { size: 10, name: 'Segoe UI', bold: !!bold },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: z ? COR.cinzaClaro : COR.branco } },
    alignment: { horizontal: 'center', vertical: 'middle' }, border: BORDA
  };
}

function sT(sz) {
  return { font: { bold: true, size: sz, color: { argb: COR.azulEscuro }, name: 'Segoe UI' } };
}

function fd(d) { return d ? new Date(d).toLocaleDateString('pt-BR') : '-'; }

function criarAbaResumo(wb, dados, analise) {
  const ws = wb.addWorksheet('Resumo', { properties: { tabColor: { argb: COR.azulMedio } } });
  ws.columns = [
    { width: 3 }, { width: 26 }, { width: 12 }, { width: 20 },
    { width: 12 }, { width: 10 }, { width: 10 }, { width: 14 },
    { width: 12 }, { width: 12 }, { width: 3 }
  ];

  ws.mergeCells('B2:J2');
  ws.getCell('B2').value = 'Estudo Comparativo - Fevereiros NE Folha (5 Anos)';
  ws.getCell('B2').style = sT(16);
  ws.mergeCells('B3:J3');
  ws.getCell('B3').value = `Periodo: inicio versao fev ate fim do mes | Gerado ${fd(new Date())}`;
  ws.getCell('B3').style = { font: { size: 9, color: { argb: COR.cinzaTexto }, name: 'Segoe UI' } };

  const hdrs = ['Ano', 'Versao', 'Periodo', 'Entradas', 'Graves', 'Criticas', 'SSCs', 'Lib.Fev', 'Lib.Mar'];
  hdrs.forEach((h, i) => { ws.getCell(5, i + 2).value = h; ws.getCell(5, i + 2).style = sH(); });
  ws.getRow(5).height = 28;

  const anos = [2022, 2023, 2024, 2025, 2026];
  anos.forEach((ano, idx) => {
    const d = dados[ano];
    const r = 6 + idx;
    const isAt = ano === 2026;
    const periodo = `${fd(d.inicioVersao)} a 28/02/${ano}`;
    const vals = [isAt ? `${ano} *` : ano, d.versao, periodo, d.total,
      d.graves, d.criticas, d.totalSSC, d.liberadasFev, d.liberadasMar];
    vals.forEach((v, ci) => {
      const cell = ws.getCell(r, ci + 2);
      cell.value = v;
      cell.style = sC(idx % 2 === 0, isAt);
      if (isAt) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.azulClaro } };
      if (ci === 2) cell.alignment = { horizontal: 'left', vertical: 'middle' };
    });
  });

  ws.getCell('B12').value = '* Fev/2026 com dados parciais (mes em andamento)';
  ws.getCell('B12').style = { font: { size: 9, italic: true, color: { argb: COR.cinzaTexto }, name: 'Segoe UI' } };

  ws.mergeCells('B14:J14');
  ws.getCell('B14').value = 'Analise: Fevereiro 2026 vs Media Historica (2022-2025)';
  ws.getCell('B14').style = sT(13);

  const isPior = analise.veredicto === 'PIOR';
  const gc26 = dados[2026].graves + dados[2026].criticas;
  const kpis = [
    ['Media hist. entradas', `${analise.mediaEntradas} NEs`],
    ['Fev/2026 entradas', `${dados[2026].total} NEs`],
    ['Variacao', `${analise.variacaoEntradas > 0 ? '+' : ''}${analise.variacaoEntradas}%`],
    ['Media hist. Graves+Criticas', `${analise.mediaGC}`],
    ['Fev/2026 Graves+Criticas', `${gc26}`],
    ['Media hist. SSCs', `${analise.mediaSSC}`],
    ['Fev/2026 SSCs', `${dados[2026].totalSSC}`],
    ['Veredicto', analise.veredicto]
  ];

  kpis.forEach(([label, valor], idx) => {
    const r = 15 + idx;
    ws.getCell(`B${r}`).value = label;
    ws.getCell(`B${r}`).style = {
      font: { size: 10, name: 'Segoe UI' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.cinzaClaro } },
      border: BORDA, alignment: { vertical: 'middle' }
    };
    const isV = label === 'Veredicto';
    ws.getCell(`C${r}`).value = valor;
    ws.getCell(`C${r}`).style = {
      font: { bold: isV, size: isV ? 12 : 10, name: 'Segoe UI',
        color: { argb: isV ? (isPior ? COR.vermelho : COR.verde) : COR.preto } },
      fill: isV ? { type: 'pattern', pattern: 'solid',
        fgColor: { argb: isPior ? COR.vermelhoBg : COR.verdeBg } } : undefined,
      alignment: { horizontal: 'center' }, border: BORDA
    };
  });

  ws.getCell('B24').value = analise.nota;
  ws.getCell('B24').style = { font: { size: 10, italic: true, name: 'Segoe UI' } };
  ws.getCell('B25').value = analise.notaParcial;
  ws.getCell('B25').style = { font: { size: 9, italic: true, color: { argb: COR.amarelo }, name: 'Segoe UI' } };
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
}

function criarAbaDetalhe(wb, dados, titulo, filtro) {
  const ws = wb.addWorksheet(titulo, {
    properties: { tabColor: { argb: filtro === 'gc' ? COR.vermelho : COR.verde } }
  });
  ws.columns = [
    { width: 3 }, { width: 8 }, { width: 12 }, { width: 10 }, { width: 10 },
    { width: 11 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 8 }, { width: 18 }, { width: 3 }
  ];

  ws.mergeCells('B1:K1');
  ws.getCell('B1').value = titulo;
  ws.getCell('B1').style = sT(14);
  ws.getRow(1).height = 28;

  const hdrs = ['Ano', 'Versao', 'i_psai', 'i_sai', 'Gravidade', 'Entrada', 'Versao Lib.', 'Liberacao', 'SSCs', 'Status'];
  hdrs.forEach((h, i) => { ws.getCell(3, i + 2).value = h; ws.getCell(3, i + 2).style = sH(); });

  let row = 4;
  let idx = 0;
  for (const ano of [2022, 2023, 2024, 2025, 2026]) {
    const lista = filtro === 'gc' ? dados[ano].detalhesGC : dados[ano].todasNEs;
    for (const ne of lista) {
      const vals = [ano, dados[ano].versao, ne.i_psai, ne.i_sai, ne.gravidade,
        fd(ne.entrada), ne.versao, fd(ne.liberacao), ne.ssc, ne.statusLib];
      vals.forEach((v, ci) => {
        const cell = ws.getCell(row, ci + 2);
        cell.value = v;
        cell.style = sC(idx % 2 === 0);
        if (ci === 4 && (v === 'Critica' || v === 'Grave')) {
          cell.font = { size: 10, name: 'Segoe UI', bold: true,
            color: { argb: v === 'Critica' ? COR.vermelho : COR.laranja } };
        }
      });
      row++;
      idx++;
    }
  }

  if (row > 4) ws.autoFilter = { from: { row: 3, column: 2 }, to: { row: row - 1, column: 12 } };
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
}

async function gerarExcel(dados, analise, outputDir) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dashboard Diretrizes - Estudo Fevereiro';
  wb.created = new Date();

  criarAbaResumo(wb, dados, analise);
  criarAbaDetalhe(wb, dados, 'Graves e Criticas', 'gc');
  criarAbaDetalhe(wb, dados, 'Todas NEs Fevereiro', 'todas');

  const arquivo = path.join(outputDir, 'estudo-fevereiro-ne.xlsx');
  await wb.xlsx.writeFile(arquivo);
  return arquivo;
}

module.exports = gerarExcel;
