/**
 * aba-produtividade.js - Aba 6: Estudo de produtividade normalizado por pessoa
 */

const { COR, FONTE, fill, borda, pct, round1, horas, setTitulo, setSubtitulo, setCabecalhos, setSecao, setLinha } = require('./estilos');

function criarAbaProdutividade(wb, agregados, variacoes) {
  const ws = wb.addWorksheet('Produtividade', { properties: { tabColor: { argb: COR.verde } } });
  ws.columns = [
    { width: 40 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }
  ];
  const NC = 5;
  const [a24, a25, a26] = agregados;

  setTitulo(ws, 1, 'ESTUDO DE PRODUTIVIDADE - INDICADORES NORMALIZADOS POR PESSOA', NC, COR.verdeEscuro);
  setSubtitulo(ws, 2, 'Compara Q1 de cada ano. "Por pessoa" = valor / media efetivos por versao.', NC);

  setCabecalhos(ws, 4, ['Metrica', '2024', '2025', '2026', 'Var 24→26']);

  let r = 5;
  setSecao(ws, r, 'DADOS ABSOLUTOS (trimestre)', NC); r++;
  setLinha(ws, r, ['NEs (entradas brutas)', a24.entradas, a25.entradas, a26.entradas, pct(((a26.entradas - a24.entradas) / a24.entradas) * 100)]); r++;
  setLinha(ws, r, ['SAIs geradas', a24.comSai, a25.comSai, a26.comSai, pct(((a26.comSai - a24.comSai) / a24.comSai) * 100)]); r++;
  setLinha(ws, r, ['Horas analise+definicao', a24.horasTotal + 'h', a25.horasTotal + 'h', a26.horasTotal + 'h', pct(((a26.horasTotal - a24.horasTotal) / a24.horasTotal) * 100)]); r++;
  setLinha(ws, r, ['Media pessoas/versao', a24.mediaEfetivos, a25.mediaEfetivos, a26.mediaEfetivos, pct(variacoes.varPessoas)]); r++;

  r++;
  setSecao(ws, r, 'PRODUTIVIDADE POR PESSOA (por versao)', NC, COR.verdeBg); r++;
  setLinha(ws, r, ['NEs/pessoa/versao', a24.nesPorPessoa, a25.nesPorPessoa, a26.nesPorPessoa, pct(variacoes.varNEsPessoa)], { bold: true }); r++;
  setLinha(ws, r, ['Horas analise/pessoa/versao', a24.horasPorPessoa + 'h', a25.horasPorPessoa + 'h', a26.horasPorPessoa + 'h', pct(variacoes.varHorasPessoa)], { bold: true }); r++;
  setLinha(ws, r, ['SAIs/pessoa/versao', a24.saisPorPessoa, a25.saisPorPessoa, a26.saisPorPessoa, pct(variacoes.varSaiPessoa)], { bold: true }); r++;
  setLinha(ws, r, ['Taxa conversao PSAI→SAI', a24.taxaConversao + '%', a25.taxaConversao + '%', a26.taxaConversao + '%', (variacoes.varTaxaConv >= 0 ? '+' : '') + variacoes.varTaxaConv + 'pp']); r++;

  r++;
  setSecao(ws, r, 'INTERPRETACAO', NC); r++;

  const insights = [
    'Volume de NEs caiu ' + Math.abs(Math.round(((a26.entradas - a24.entradas) / a24.entradas) * 100)) + '% (316→' + a26.entradas + '), mas o time encolheu ' + Math.abs(Math.round(variacoes.varPessoas)) + '% (10.7→' + a26.mediaEfetivos + ' pessoas/versao).',
    'Cada analista absorveu ' + pct(variacoes.varHorasPessoa) + ' mais horas de analise por versao em 2026 vs 2024.',
    'A taxa de conversao PSAI→SAI se manteve estavel (' + a24.taxaConversao + '% → ' + a26.taxaConversao + '%).',
    'O time atual (4-5 pessoas fixas) demonstra maturidade e eficiencia superior ao time de 2024 (10-12 pessoas com rotatividade).',
    'Destaques individuais 2026: Ana Ligia (ate 191h/versao), Jessica e Mateus (crescimento rapido).'
  ];

  for (const txt of insights) {
    ws.mergeCells(r, 1, r, NC);
    ws.getCell(r, 1).value = '  • ' + txt;
    ws.getCell(r, 1).font = FONTE.normal;
    ws.getCell(r, 1).alignment = { wrapText: true };
    ws.getRow(r).height = 30;
    r++;
  }

  r++;
  ws.mergeCells(r, 1, r, NC);
  const cc = ws.getCell(r, 1);
  cc.value = 'INDICE DE PRODUTIVIDADE COMPOSTO (media das variacoes NE/pessoa, horas/pessoa, SAI/pessoa): ' + pct(variacoes.indiceProdutividade);
  cc.font = { name: 'Calibri', size: 12, bold: true, color: { argb: COR.verdeEscuro } };
  cc.fill = fill(COR.verdeBg);
  cc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cc.border = borda();
  ws.getRow(r).height = 36;

  return ws;
}

module.exports = { criarAbaProdutividade };
