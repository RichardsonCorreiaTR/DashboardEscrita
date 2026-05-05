/**
 * aba-descartes.js - Aba 3: PSAI/SAI e Descartes por motivo
 */

const { COR, setTitulo, setSubtitulo, setCabecalhos, setSecao, setLinha } = require('./estilos');

const MOTIVOS = [
  { id: 6, nome: 'Reprovada' },
  { id: 4, nome: 'Descartado' },
  { id: 5, nome: 'CsD (Concl. s/ Dev)' },
  { id: 23, nome: 'Prescrita' }
];

function criarAbaDescartes(wb, coleta, agregados) {
  const ws = wb.addWorksheet('Descartes', { properties: { tabColor: { argb: COR.laranja } } });
  ws.columns = [
    { width: 14 }, { width: 12 }, { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }
  ];
  const NC = 8;
  const { dados } = coleta;

  setTitulo(ws, 1, 'DESCARTES E REPROVAS POR VERSAO (EXCL. MOTIVO 26)', NC, COR.laranja);
  setSubtitulo(ws, 2, 'Fonte: UP.SAI_PSAI.Descarte no periodo | Situacao via COALESCE(i_sai_situacoes, i_psai_situacoes)', NC);

  setCabecalhos(ws, 4, ['Versao', 'Ano', 'Total excl.26', 'Reprovada (6)', 'Descartado (4)', 'CsD (5)', 'Prescrita (23)', 'Outros']);

  const anos = [
    { label: '2024', vs: ['10.4A-01', '10.4A-02', '10.4A-03'], idx: 0 },
    { label: '2025', vs: ['10.5A-01', '10.5A-02', '10.5A-03'], idx: 1 },
    { label: '2026', vs: ['10.6A-01', '10.6A-02', '10.6A-03'], idx: 2 }
  ];

  let r = 5;
  for (const { label, vs, idx } of anos) {
    setSecao(ws, r, label, NC); r++;
    for (const v of vs) {
      const d = dados[v].descartes;
      setLinha(ws, r, [
        v, label, d.total_excl26, d.reprovada, d.descartado, d.csd, d.prescrita, d.outros
      ]);
      r++;
    }
    const a = agregados[idx];
    setLinha(ws, r, [
      'TOTAL', label, a.descExcl26, a.reprovadas, a.descartados, '', '', ''
    ], { bold: true, bg: COR.laranjaBg });
    r += 2;
  }

  setSecao(ws, r, 'OBSERVACAO SOBRE MOTIVO 26', NC, COR.roxoBg); r++;
  setLinha(ws, r, ['Motivo 26 = "Liberado em versoes anteriores" (limpeza de backlog).', '', '', '', '', '', '', '']); r++;
  setLinha(ws, r, ['Em 2026 houve limpeza massiva: sit 26 foi excluida para nao distorcer.', '', '', '', '', '', '', '']); r++;

  const sit26 = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    for (const v of anos[i].vs) sit26[i] += dados[v].descartes.sit26;
  }
  setLinha(ws, r, ['Sit 26 excluidas:', '2024: ' + sit26[0], '2025: ' + sit26[1], '2026: ' + sit26[2], '', '', '', ''], { bg: COR.roxoBg }); r++;

  return ws;
}

module.exports = { criarAbaDescartes };
