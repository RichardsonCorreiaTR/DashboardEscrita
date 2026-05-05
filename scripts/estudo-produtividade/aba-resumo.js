/**
 * aba-resumo.js - Aba 1: Resumo Executivo com KPIs comparativos
 */

const { COR, FONTE, fill, borda, pct, setTitulo, setSubtitulo, setCabecalhos, setSecao, setLinha } = require('./estilos');

function criarAbaResumo(wb, agregados, variacoes, dataExtracao) {
  const ws = wb.addWorksheet('Resumo Executivo', { properties: { tabColor: { argb: COR.azulMedio } } });
  ws.columns = [{ width: 42 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 20 }];
  const NC = 5;

  setTitulo(ws, 1, 'ESTUDO DE PRODUTIVIDADE NE - Q1 2024 vs 2025 vs 2026', NC);
  setSubtitulo(ws, 2, 'Fonte: Banco Sybase ASA 9.0 via ODBC (DSN pbcvs9) | Extracao: ' + dataExtracao, NC);

  setCabecalhos(ws, 4, ['Indicador', '2024 (Q1)', '2025 (Q1)', '2026 (Q1)', 'Var 24→26']);
  const a = agregados;
  let r = 5;

  setSecao(ws, r, 'VOLUME', NC); r++;
  setLinha(ws, r, ['Entradas brutas', a[0].entradas, a[1].entradas, a[2].entradas, pct(((a[2].entradas - a[0].entradas) / a[0].entradas) * 100)]); r++;
  setLinha(ws, r, ['PSAIs que geraram SAI', a[0].comSai, a[1].comSai, a[2].comSai, pct(((a[2].comSai - a[0].comSai) / a[0].comSai) * 100)]); r++;
  setLinha(ws, r, ['Taxa conversao PSAI→SAI', a[0].taxaConversao + '%', a[1].taxaConversao + '%', a[2].taxaConversao + '%', (variacoes.varTaxaConv >= 0 ? '+' : '') + variacoes.varTaxaConv + 'pp']); r++;
  setLinha(ws, r, ['Descartes reais (excl. mot.26)', a[0].descExcl26, a[1].descExcl26, a[2].descExcl26, pct(((a[2].descExcl26 - a[0].descExcl26) / a[0].descExcl26) * 100)]); r++;

  r++;
  setSecao(ws, r, 'RECURSOS', NC); r++;
  setLinha(ws, r, ['Media pessoas/versao', a[0].mediaEfetivos, a[1].mediaEfetivos, a[2].mediaEfetivos, pct(variacoes.varPessoas)], { bold: true, bg: COR.laranjaBg }); r++;
  setLinha(ws, r, ['Distintas no trimestre', a[0].pessoasTrimestre.qtd, a[1].pessoasTrimestre.qtd, a[2].pessoasTrimestre.qtd, '-']); r++;

  r++;
  setSecao(ws, r, 'ESFORCO DE ANALISE', NC); r++;
  setLinha(ws, r, ['Tempo total (horas)', a[0].horasTotal + 'h', a[1].horasTotal + 'h', a[2].horasTotal + 'h', pct(((a[2].horasTotal - a[0].horasTotal) / a[0].horasTotal) * 100)]); r++;
  setLinha(ws, r, ['Tempo medio/PSAI (horas)', a[0].tempoMedioPsai + 'h', a[1].tempoMedioPsai + 'h', a[2].tempoMedioPsai + 'h', pct(((a[2].tempoMedioPsai - a[0].tempoMedioPsai) / a[0].tempoMedioPsai) * 100)]); r++;

  r++;
  setSecao(ws, r, 'PRODUTIVIDADE INDIVIDUAL (por pessoa/versao)', NC, COR.verdeBg); r++;
  setLinha(ws, r, ['NEs analisadas/pessoa', a[0].nesPorPessoa, a[1].nesPorPessoa, a[2].nesPorPessoa, pct(variacoes.varNEsPessoa)], { bold: true }); r++;
  setLinha(ws, r, ['Horas de analise/pessoa', a[0].horasPorPessoa + 'h', a[1].horasPorPessoa + 'h', a[2].horasPorPessoa + 'h', pct(variacoes.varHorasPessoa)], { bold: true }); r++;
  setLinha(ws, r, ['SAIs geradas/pessoa', a[0].saisPorPessoa, a[1].saisPorPessoa, a[2].saisPorPessoa, pct(variacoes.varSaiPessoa)], { bold: true }); r++;

  r++;
  const conclusaoRow = r;
  ws.mergeCells(r, 1, r, NC);
  const cc = ws.getCell(r, 1);
  const menos = Math.abs(Math.round(variacoes.varPessoas));
  const mais = Math.round(variacoes.varHorasPessoa);
  cc.value = 'CONCLUSAO: Com ' + menos + '% menos recursos, cada analista produziu ' + mais + '% mais horas de analise em 2026 vs 2024.';
  cc.font = { name: 'Calibri', size: 12, bold: true, color: { argb: COR.verdeEscuro } };
  cc.fill = fill(COR.verdeBg);
  cc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cc.border = borda();
  ws.getRow(r).height = 36;

  return ws;
}

module.exports = { criarAbaResumo };
