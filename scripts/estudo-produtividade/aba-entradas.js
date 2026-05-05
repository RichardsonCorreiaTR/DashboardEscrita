/**
 * aba-entradas.js - Aba 2: Dados Brutos de Entradas por versao
 */

const { COR, setTitulo, setSubtitulo, setCabecalhos, setSecao, setLinha } = require('./estilos');

function criarAbaEntradas(wb, coleta, agregados) {
  const ws = wb.addWorksheet('Entradas', { properties: { tabColor: { argb: COR.azulMedio } } });
  ws.columns = [
    { width: 14 }, { width: 12 }, { width: 24 }, { width: 24 },
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 42 }
  ];
  const NC = 8;
  const { dados } = coleta;

  setTitulo(ws, 1, 'DADOS BRUTOS - ENTRADAS DE NE POR VERSAO', NC);
  setSubtitulo(ws, 2, 'Fonte: UP.SAI_PSAI (CadastroPSAI entre PIAZZA inicio/fim) | Filtro: Escrita, NE, produto_grupo 1 ou NULL', NC);

  setCabecalhos(ws, 4, ['Versao', 'Ano', 'Periodo Inicio', 'Periodo Fim', 'Entradas', 'Com SAI', 'Sem SAI', 'Query/Fonte']);

  let r = 5;
  const anos = [
    { label: '2024', vs: ['10.4A-01', '10.4A-02', '10.4A-03'], idx: 0 },
    { label: '2025', vs: ['10.5A-01', '10.5A-02', '10.5A-03'], idx: 1 },
    { label: '2026', vs: ['10.6A-01', '10.6A-02', '10.6A-03'], idx: 2 }
  ];

  for (const { label, vs, idx } of anos) {
    setSecao(ws, r, label + ' (3 primeiras versoes)', NC); r++;
    for (const v of vs) {
      const d = dados[v];
      const dtIni = (d.datas.inicio || '').substring(0, 19);
      const dtFim = (d.datas.fim || '').substring(0, 19);
      setLinha(ws, r, [
        v, label, dtIni, dtFim,
        d.entradas.total, d.entradas.com_sai, d.entradas.sem_sai,
        'COUNT(*) SAI_PSAI CadastroPSAI > PIAZZA_INI AND <= PIAZZA_FIM'
      ]);
      r++;
    }
    const a = agregados[idx];
    setLinha(ws, r, [
      'TOTAL ' + label, '', '', '', a.entradas, a.comSai, a.semSai, ''
    ], { bold: true, bg: COR.azulClaro });
    r += 2;
  }

  setSecao(ws, r, 'COMPARATIVO ACUMULADO', NC, COR.verdeBg); r++;
  setCabecalhos(ws, r, ['', '2024', '2025', '2026', 'Var 24→26', '', '', '']); r++;
  setLinha(ws, r, ['Entradas', agregados[0].entradas, agregados[1].entradas, agregados[2].entradas, '', '', '', ''], { bold: true }); r++;
  setLinha(ws, r, ['Com SAI', agregados[0].comSai, agregados[1].comSai, agregados[2].comSai, '', '', '', '']); r++;
  setLinha(ws, r, ['Tx Conv.', agregados[0].taxaConversao + '%', agregados[1].taxaConversao + '%', agregados[2].taxaConversao + '%', '', '', '', '']); r++;

  return ws;
}

module.exports = { criarAbaEntradas };
