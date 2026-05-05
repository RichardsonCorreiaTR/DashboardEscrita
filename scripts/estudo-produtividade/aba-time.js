/**
 * aba-time.js - Aba 5: Composicao do time por versao
 */

const { COR, horas, setTitulo, setSubtitulo, setCabecalhos, setSecao, setLinha } = require('./estilos');
const { CORTE_PSAIS, CORTE_HORAS_MIN, CORTE_SAIS } = require('./coleta');

function criarAbaTime(wb, coleta, agregados) {
  const ws = wb.addWorksheet('Time', { properties: { tabColor: { argb: COR.roxo } } });
  ws.columns = [
    { width: 14 }, { width: 12 }, { width: 12 }, { width: 12 },
    { width: 12 }, { width: 40 }
  ];
  const NC = 6;
  const { dados, nomes } = coleta;

  setTitulo(ws, 1, 'COMPOSICAO DO TIME NE POR VERSAO', NC, COR.roxo);
  const hMin = Math.round(CORTE_HORAS_MIN / 60);
  setSubtitulo(ws, 2,
    'Efetivo = >=' + CORTE_PSAIS + ' PSAIs OU >=' + hMin + 'h (analise PSAI) / >=' + CORTE_SAIS + ' SAIs (geracao) | PSAI+SAI unificado sem duplicatas', NC);

  const anos = [
    { label: '2024', vs: ['10.4A-01', '10.4A-02', '10.4A-03'], idx: 0 },
    { label: '2025', vs: ['10.5A-01', '10.5A-02', '10.5A-03'], idx: 1 },
    { label: '2026', vs: ['10.6A-01', '10.6A-02', '10.6A-03'], idx: 2 }
  ];

  setCabecalhos(ws, 4, ['Versao', 'Ano', 'Efetivos', 'Analise', 'Geracao', 'Nomes (efetivos)']);

  let r = 5;
  for (const { label, vs, idx } of anos) {
    setSecao(ws, r, label, NC); r++;
    for (const v of vs) {
      const d = dados[v];
      const nomesEf = d.efetivos.map(id => nomes[id] || String(id))
        .map(n => n.split(' ').slice(0, 2).join(' ')).sort().join(', ');
      const qtdPsai = d.analistas_psai.filter(a => {
        const tot = (a.min_analise || 0) + (a.min_definicao || 0);
        return a.psais >= CORTE_PSAIS || tot >= CORTE_HORAS_MIN;
      }).length;
      const qtdSai = d.geradores_sai.filter(g => g.sais >= CORTE_SAIS).length;
      setLinha(ws, r, [v, label, d.qtd_efetivos, qtdPsai, qtdSai, nomesEf]);
      r++;
    }
    const a = agregados[idx];
    setLinha(ws, r, [
      'MEDIA', label, a.mediaEfetivos, '', '',
      'Distintas tri: ' + a.pessoasTrimestre.qtd
    ], { bold: true, bg: COR.roxoBg });
    r += 2;
  }

  setSecao(ws, r, 'PESSOAS DISTINTAS POR TRIMESTRE', NC); r++;
  for (const { idx, label } of anos) {
    const a = agregados[idx];
    const ns = a.pessoasTrimestre.nomes
      .map(n => n.split(' ').slice(0, 2).join(' ')).sort().join(', ');
    setLinha(ws, r, [label, '', a.pessoasTrimestre.qtd + ' pessoas', '', '', ns]);
    r++;
  }

  return ws;
}

module.exports = { criarAbaTime };
