/**
 * detalhes-tabela.js - Tabelas de detalhe com ordenacao por coluna (SAI/PSAI)
 */
/* eslint-disable no-unused-vars */
const DetalhesTabela = (() => {
  const _store = new Map();
  let _seq = 0;

  function limparStore() { _store.clear(); _seq = 0; }

  function renderRows(colunas, dados, opcoes = {}) {
    const clsFn = opcoes.rowClass;
    return dados.map(row => {
      const cls = clsFn ? clsFn(row) : '';
      return `<tr${cls ? ` class="${cls}"` : ''}>${colunas.map(c => `<td>${c.render(row)}</td>`).join('')}</tr>`;
    }).join('');
  }

  function tabela(colunas, dados, opcoes = {}) {
    if (!dados || dados.length === 0) {
      return '<p style="color:var(--cor-texto-sec);font-size:0.8rem;padding:0.5rem;">Nenhum registro</p>';
    }
    const id = 't' + (++_seq);
    _store.set(id, { colunas, original: dados, sort: { key: null, asc: true }, opcoes });
    const ths = colunas.map(c => c.sortKey
      ? `<th class="th-sort" data-key="${c.sortKey}" title="Clique para ordenar">${c.label}<span class="sort-icon"></span></th>`
      : `<th>${c.label}</th>`
    ).join('');
    return `<table class="tabela-detalhes" data-sort-id="${id}"><thead><tr>${ths}</tr></thead><tbody>${renderRows(colunas, dados, opcoes)}</tbody></table>`;
  }

  function valorColuna(col, row) {
    if (col.sortValue) return col.sortValue(row);
    return row[col.sortKey];
  }

  function comparar(col, a, b, asc) {
    const va = valorColuna(col, a);
    const vb = valorColuna(col, b);
    if (!col.sortValue) {
      const na = Number(va);
      const nb = Number(vb);
      if (!Number.isNaN(na) && !Number.isNaN(nb) && String(va).trim() !== '') {
        return asc ? na - nb : nb - na;
      }
    }
    const cmp = String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR', { sensitivity: 'base' });
    return asc ? cmp : -cmp;
  }

  function inicializarOrdenacao(container) {
    if (!container) return;
    container.querySelectorAll('[data-sort-id]').forEach(tbl => {
      if (tbl.dataset.sortInit) return;
      tbl.dataset.sortInit = '1';
      tbl.querySelectorAll('th.th-sort').forEach(th => {
        th.addEventListener('click', () => {
          const st = _store.get(tbl.dataset.sortId);
          if (!st) return;
          const { key } = th.dataset;
          const col = st.colunas.find(c => c.sortKey === key);
          if (!col) return;
          if (st.sort.key === key) st.sort.asc = !st.sort.asc;
          else { st.sort.key = key; st.sort.asc = true; }
          const sorted = [...st.original].sort((a, b) => comparar(col, a, b, st.sort.asc));
          tbl.querySelector('tbody').innerHTML = renderRows(st.colunas, sorted, st.opcoes || {});
          tbl.querySelectorAll('.sort-icon').forEach(s => { s.textContent = ''; });
          th.querySelector('.sort-icon').textContent = st.sort.asc ? ' ▲' : ' ▼';
        });
      });
    });
  }

  return { tabela, inicializarOrdenacao, limparStore };
})();
