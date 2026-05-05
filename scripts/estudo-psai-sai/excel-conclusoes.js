/**
 * excel-conclusoes.js - Conclusoes baseadas em todas as NEs (PSAI como base)
 */

const { COR, BORDA, sTitulo } = require('./excel-estilos');

const FONTE = 'Segoe UI';

function txt(ws, row, col, valor, opts = {}) {
  const cell = ws.getCell(row, col);
  cell.value = valor;
  cell.style = {
    font: { size: opts.sz || 10, name: FONTE, bold: !!opts.b, italic: !!opts.i,
      color: { argb: opts.cor || COR.preto } },
    alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
    border: opts.borda ? BORDA : undefined,
    fill: opts.bg ? { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.bg } } : undefined
  };
  if (opts.h) ws.getRow(row).height = opts.h;
}

function criarAbaConclusoes(wb, analise) {
  const ws = wb.addWorksheet('Conclusoes', { properties: { tabColor: { argb: COR.vermelho } } });
  ws.columns = [{ width: 3 }, { width: 90 }, { width: 3 }];

  const g = analise.geral;
  const eq = analise.equipe;
  const naoAtrib = analise.nes.filter(n => n.analista === 'Nao atribuido');
  const desc = analise.nes.filter(n => n.status === 'Descartada').length;
  const pend = analise.nes.filter(n => n.status === 'PSAI pendente').length;

  const difTodos = g.mediaComDef - g.mediaSemDef;
  const difEquipe = eq.mediaComDef - eq.mediaSemDef;

  let r = 2;
  txt(ws, r, 2, 'ESTUDO NE ESCRITA - TEMPO DE TRABALHO POR NE', { sz: 16, b: true, cor: COR.azulEscuro });
  r += 2;

  txt(ws, r, 2, 'O QUE FOI MEDIDO', { sz: 13, b: true, cor: COR.azulEscuro, bg: COR.cinzaClaro, borda: true, h: 24 });
  r++;
  txt(ws, r, 2,
    `Base: TODAS as ${g.totalNEs} NEs do periodo (Nov/2025 a Mar/2026), incluindo as que viraram SAI, ` +
    `as descartadas (${desc}) e as pendentes (${pend}). O tempo e a soma de tempo_analise + tempo_definicao ` +
    `de psai_responsaveis, em MINUTOS. Isso captura todo o trabalho do analista em cada NE.`,
    { h: 45 });
  r += 2;

  txt(ws, r, 2, 'NUMEROS-CHAVE', { sz: 13, b: true, cor: COR.azulEscuro, bg: COR.cinzaClaro, borda: true, h: 24 });
  r++;
  txt(ws, r, 2,
    `TODOS: ${g.totalNEs} NEs, ${g.totalMin} min total, media ${g.mediaPorNE} min/NE.\n` +
    `EQUIPE (5 analistas): ${eq.totalNEs} NEs, ${eq.totalMin} min total, media ${eq.mediaPorNE} min/NE.\n` +
    `COM Definicao: ${g.comDef} NEs, media ${g.mediaComDef} min/NE.\n` +
    `SEM Definicao: ${g.semDef} NEs, media ${g.mediaSemDef} min/NE.\n` +
    `Diferenca: ${difTodos > 0 ? '+' : ''}${difTodos} min (Todos) | ${difEquipe > 0 ? '+' : ''}${difEquipe} min (Equipe).`,
    { h: 70 });
  r += 2;

  const c1titulo = difTodos > 0
    ? 'CONCLUSAO 1: NEs com Definicao custam mais minutos'
    : 'CONCLUSAO 1: NEs com Definicao NAO custam mais minutos';
  txt(ws, r, 2, c1titulo, { sz: 12, b: true, cor: COR.vermelho, bg: COR.vermelhoBg, borda: true, h: 24 });
  r++;
  if (difTodos > 0) {
    txt(ws, r, 2,
      `NEs COM Definicao: ${g.mediaComDef} min/NE. NEs SEM: ${g.mediaSemDef} min/NE. ` +
      `Diferenca de +${difTodos} min por NE. Com ${g.comDef} NEs com Definicao, isso representa ` +
      `${g.comDef * difTodos} min a mais no periodo.`,
      { h: 40 });
  } else {
    txt(ws, r, 2,
      `NEs COM Definicao: ${g.mediaComDef} min/NE. NEs SEM: ${g.mediaSemDef} min/NE. ` +
      `A Definicao nao esta adicionando tempo extra. O custo por NE e igual ou menor quando tem Definicao. ` +
      `O gargalo nao esta no campo Definicao.`,
      { h: 40 });
  }
  r += 2;

  const pcts = analise.porVersaoTodos.map(v => {
    const doV = analise.nes.filter(n => n.versao === v.versao);
    const cD = doV.filter(n => n.temDefinicao).length;
    return `${v.versao}: ${doV.length > 0 ? Math.round(cD / doV.length * 100) : 0}%`;
  }).join(' > ');
  txt(ws, r, 2, 'CONCLUSAO 2: Evolucao do % com Definicao', { sz: 12, b: true, cor: COR.vermelho, bg: COR.vermelhoBg, borda: true, h: 24 });
  r++;
  txt(ws, r, 2, `% de NEs com Definicao preenchida por versao:\n${pcts}`, { h: 35 });
  r += 2;

  const fev = analise.porVersaoTodos.find(v => v.versao === '10.6A-02');
  txt(ws, r, 2, 'CONCLUSAO 3: Volume e capacidade', { sz: 12, b: true, cor: COR.laranja, bg: COR.amareloBg, borda: true, h: 24 });
  r++;
  txt(ws, r, 2,
    `Fev/2026: ${fev.nes} NEs, ${fev.minutos} min total do time, media ${fev.mediaPorNE} min/NE. ` +
    `${naoAtrib.length} NEs sem analista atribuido. ${pend} NEs pendentes sem virar SAI.`,
    { h: 40 });
  r += 2;

  txt(ws, r, 2, 'RECOMENDACOES', { sz: 13, b: true, cor: COR.azulEscuro, bg: COR.cinzaClaro, borda: true, h: 24 });
  r++;
  const recs = [
    `1. Atribuir as ${naoAtrib.length} NEs sem responsavel.`,
    `2. Redistribuir carga entre analistas (ver aba Resumo).`,
    `3. Monitorar media min/NE por versao para detectar mudancas de produtividade.`,
    `4. Avaliar se NEs com Definicao justificam processo diferenciado.`
  ];
  for (const rec of recs) {
    txt(ws, r, 2, rec, { h: 24 });
    r++;
  }

  r++;
  txt(ws, r, 2,
    `Fonte: PBCVS (psai_responsaveis, bethadba.sai). Gerado em ${new Date().toLocaleDateString('pt-BR')}.`,
    { sz: 8, i: true, cor: COR.cinzaTexto });

  ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1 };
}

module.exports = { criarAbaConclusoes };
