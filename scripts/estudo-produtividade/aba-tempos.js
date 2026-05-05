/**
 * aba-tempos.js - Aba 4: Tempo de analise e definicao por versao
 */

const { COR, horas, round1, setTitulo, setSubtitulo, setCabecalhos, setSecao, setLinha } = require('./estilos');

function criarAbaTempos(wb, coleta, agregados) {
  const ws = wb.addWorksheet('Tempo Analise', { properties: { tabColor: { argb: COR.verde } } });
  ws.columns = [
    { width: 14 }, { width: 12 }, { width: 14 }, { width: 16 },
    { width: 16 }, { width: 16 }, { width: 16 }
  ];
  const NC = 7;
  const { dados } = coleta;

  setTitulo(ws, 1, 'TEMPO DE ANALISE DE PRODUTO + DEFINICAO POR VERSAO', NC, COR.verde);
  setSubtitulo(ws, 2, 'Fonte: bethadba.psai_responsaveis (tempo_analise + tempo_definicao) | PSAIs NE Escrita cadastradas no periodo', NC);

  setCabecalhos(ws, 4, ['Versao', 'Ano', 'PSAIs c/ tempo', 'Analise (h)', 'Definicao (h)', 'Total (h)', 'Media/PSAI (h)']);

  const anos = [
    { label: '2024', vs: ['10.4A-01', '10.4A-02', '10.4A-03'], idx: 0 },
    { label: '2025', vs: ['10.5A-01', '10.5A-02', '10.5A-03'], idx: 1 },
    { label: '2026', vs: ['10.6A-01', '10.6A-02', '10.6A-03'], idx: 2 }
  ];

  let r = 5;
  for (const { label, vs, idx } of anos) {
    setSecao(ws, r, label, NC); r++;
    for (const v of vs) {
      const t = dados[v].tempos;
      const hAn = horas(t.min_analise);
      const hDef = horas(t.min_definicao);
      const hTot = horas(t.min_total);
      const media = t.com_tempo > 0 ? round1(hTot / t.com_tempo) : 0;
      setLinha(ws, r, [v, label, t.com_tempo, hAn, hDef, hTot, media]);
      r++;
    }
    const a = agregados[idx];
    setLinha(ws, r, [
      'TOTAL', label, a.psaisComTempo,
      horas(a.minAnalise), horas(a.minDefinicao), a.horasTotal,
      a.tempoMedioPsai
    ], { bold: true, bg: COR.verdeBg });
    r += 2;
  }

  setSecao(ws, r, 'NOTA SOBRE MULTIPLOS RESPONSAVEIS', NC); r++;
  setLinha(ws, r, ['Uma PSAI pode ter multiplos registros em psai_responsaveis (varios analistas).', '', '', '', '', '', '']); r++;
  setLinha(ws, r, ['O SUM soma o tempo de TODOS os responsaveis de cada PSAI.', '', '', '', '', '', '']); r++;

  return ws;
}

module.exports = { criarAbaTempos };
