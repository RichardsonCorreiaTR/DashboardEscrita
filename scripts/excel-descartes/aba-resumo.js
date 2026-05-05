/**
 * aba-resumo.js - Cria aba "Resumo" do Excel de descartes
 */

const { COR, round2, bordaFina, estiloTitulo } = require('./utils');

function criarAbaResumo(wb, versoes, stats) {
  const ws = wb.addWorksheet('Resumo', {
    properties: { tabColor: { argb: COR.azulMedio } }
  });
  ws.columns = [
    { width: 4 }, { width: 28 }, { width: 20 }, { width: 20 },
    { width: 20 }, { width: 20 }, { width: 4 }
  ];

  let row = 2;
  ws.mergeCells(`B${row}:E${row}`);
  ws.getCell(`B${row}`).value = 'Analise de Descartes - Concl.s/Dev / Reprovada / Prescrita';
  ws.getCell(`B${row}`).style = estiloTitulo(18);
  row++;
  ws.mergeCells(`B${row}:E${row}`);
  ws.getCell(`B${row}`).value = `Escrita Fiscal - Thomson Reuters/Betha | Atualizado: ${new Date().toLocaleDateString('pt-BR')}`;
  ws.getCell(`B${row}`).style = { font: { size: 10, color: { argb: COR.cinzaTexto }, name: 'Segoe UI' } };
  row += 2;

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
    ws.getCell(`B${row}`).value = label;
    ws.getCell(`B${row}`).style = {
      font: { size: 10, name: 'Segoe UI', color: { argb: COR.preto } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.cinzaClaro } },
      border: bordaFina(), alignment: { vertical: 'middle' }
    };
    ws.getCell(`C${row}`).value = valor;
    ws.getCell(`C${row}`).style = {
      font: { bold: true, size: 11, name: 'Segoe UI', color: { argb: COR.azulEscuro } },
      alignment: { horizontal: 'center', vertical: 'middle' }, border: bordaFina()
    };
    if (obs) {
      ws.mergeCells(`D${row}:E${row}`);
      ws.getCell(`D${row}`).value = obs;
      ws.getCell(`D${row}`).style = {
        font: { size: 9, italic: true, color: { argb: COR.cinzaTexto }, name: 'Segoe UI' },
        alignment: { vertical: 'middle' }, border: bordaFina()
      };
    }
    row++;
  }
  row += 1;

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
    ['Versao', vAtual.versao], ['Entradas', vAtual.entradas],
    ['Concl. sem Dev', vAtual.conclSemDev || 0], ['Reprovadas', vAtual.reprovadas], ['Prescritas', vAtual.prescritas],
    ['% Descarte', `${pctAtual}%`], ['EWMA Esperado', `${ewmaAtual}%`],
    ['Desvio vs EWMA', `${desvio > 0 ? '+' : ''}${desvio}pp (${desvioSigmas}σ)`],
    ['Classificacao', classificacao]
  ];
  for (const [label, valor] of diagDados) {
    ws.getCell(`B${row}`).value = label;
    ws.getCell(`B${row}`).style = {
      font: { size: 10, name: 'Segoe UI' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.cinzaClaro } },
      border: bordaFina()
    };
    const isClass = label === 'Classificacao';
    ws.getCell(`C${row}`).value = valor;
    ws.getCell(`C${row}`).style = {
      font: { bold: true, size: isClass ? 12 : 11, name: 'Segoe UI', color: { argb: isClass ? cor : COR.preto } },
      alignment: { horizontal: 'center', vertical: 'middle' }, border: bordaFina(),
      fill: isClass ? { type: 'pattern', pattern: 'solid', fgColor: { argb: cor === COR.verde ? COR.verdeBg : cor === COR.amarelo ? COR.amareloBg : COR.vermelhoBg } } : undefined
    };
    row++;
  }

  row += 1;
  ws.mergeCells(`B${row}:E${row}`);
  ws.getCell(`B${row}`).value = 'Composicao dos Descartes';
  ws.getCell(`B${row}`).style = estiloTitulo(13);
  row++;
  const pctConcl = stats.totFoco > 0 ? round2((stats.totConcl / stats.totFoco) * 100) : 0;
  const pctRepr = stats.totFoco > 0 ? round2((stats.totRepr / stats.totFoco) * 100) : 0;
  const pctPresc = stats.totFoco > 0 ? round2((stats.totPresc / stats.totFoco) * 100) : 0;
  for (const [label, valor, obs] of [
    ['Concl. sem Dev (motivo 5)', stats.totConcl, `${pctConcl}% dos descartes`],
    ['Reprovadas (motivo 6)', stats.totRepr, `${pctRepr}% dos descartes`],
    ['Prescritas (motivo 23)', stats.totPresc, `${pctPresc}% dos descartes`]
  ]) {
    ws.getCell(`B${row}`).value = label;
    ws.getCell(`B${row}`).style = { font: { size: 10, name: 'Segoe UI' }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COR.cinzaClaro } }, border: bordaFina() };
    ws.getCell(`C${row}`).value = valor;
    ws.getCell(`C${row}`).style = { font: { bold: true, size: 11, name: 'Segoe UI' }, alignment: { horizontal: 'center' }, border: bordaFina() };
    ws.getCell(`D${row}`).value = obs;
    ws.getCell(`D${row}`).style = { font: { size: 9, italic: true, color: { argb: COR.cinzaTexto }, name: 'Segoe UI' }, border: bordaFina() };
    row++;
  }

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
  return ws;
}

module.exports = { criarAbaResumo };
