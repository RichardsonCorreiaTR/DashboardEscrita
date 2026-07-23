/**
 * detalhes-area.js - Coluna e cores de area (Escrita / Importacao) em tabelas Ambas
 */
/* eslint-disable no-unused-vars */
const DetalhesArea = (() => {
  let _mostrar = false;

  function setContext(area) {
    _mostrar = area === 'Ambas';
  }

  function mostrar() { return _mostrar; }

  function decodificarBin(val) {
    if (!(val instanceof ArrayBuffer)) return null;
    const buf = new Uint8Array(val);
    let end = buf.length;
    while (end > 0 && buf[end - 1] === 0) end--;
    let s = '';
    for (let i = 0; i < end; i++) s += String.fromCharCode(buf[i]);
    return s.trim() || null;
  }

  function lerArea(row) {
    if (!row) return null;
    const v = row.nomeArea ?? row.NOMEAREA ?? row.nomearea;
    if (v == null || v === '') return null;
    if (v instanceof ArrayBuffer) return decodificarBin(v);
    const s = String(v).trim();
    return s || null;
  }

  function label(nomeArea) {
    const v = typeof nomeArea === 'object' ? lerArea(nomeArea) : nomeArea;
    if (!v) return '--';
    const n = String(v).toLowerCase();
    if (n.startsWith('import') || n.includes('importa')) return 'Importação';
    return 'Escrita';
  }

  function slug(nomeArea) {
    return label(nomeArea) === 'Importação' ? 'importacao' : 'escrita';
  }

  function badge(nomeArea) {
    const s = slug(nomeArea);
    return `<span class="badge-area badge-area--${s}">${label(nomeArea)}</span>`;
  }

  function coluna() {
    return {
      label: 'Área',
      sortKey: 'nomeArea',
      sortValue: r => label(lerArea(r)),
      render: r => badge(lerArea(r))
    };
  }

  function rowClass(r) {
    const a = lerArea(r);
    return a ? `row-area--${slug(a)}` : '';
  }

  function cols(colunas) {
    if (!_mostrar) return colunas;
    if (colunas.length >= 2 && colunas[0].sortKey === 'i_sai') {
      return [colunas[0], colunas[1], coluna(), ...colunas.slice(2)];
    }
    return [coluna(), ...colunas];
  }

  function tbl(colunas, dados) {
    return DetalhesTabela.tabela(
      cols(colunas),
      dados,
      _mostrar ? { rowClass } : {}
    );
  }

  function legendaHTML() {
    return `<p class="area-legenda">
      <span class="badge-area badge-area--escrita">Escrita</span>
      <span class="badge-area badge-area--importacao">Importação</span>
      <span class="area-legenda__txt">Identificação da área em cada linha</span>
    </p>`;
  }

  function avisoCacheHTML() {
    return `<p class="area-legenda area-legenda--aviso">
      Áreas indisponíveis no cache. Clique <strong>ODBC</strong> para atualizar os dados.
    </p>`;
  }

  /** Detecta snapshot antigo (sem nomeArea) em listas de movimentacao. */
  function faltaAreaNasListas(resultado) {
    if (!_mostrar || !resultado?.detalhes) return false;
    const d = resultado.detalhes;
    const listas = [];
    if (d.movimentacao) {
      const m = d.movimentacao;
      listas.push(m.entradas, m.descartes, m.liberadas, m.pendentes, m.excluidas_liberadas);
    }
    listas.push(d.entradas_lista, d.descartes_lista, d.casos, d.abertas_agora,
      d.top_10_mais_antigas, d.proximas_entrar, d.sais, d.sais_paralelo);
    const rows = listas.filter(Array.isArray).flat();
    if (!rows.length) return false;
    return !rows.some(r => lerArea(r));
  }

  return {
    setContext, mostrar, cols, tbl, legendaHTML, avisoCacheHTML,
    faltaAreaNasListas, lerArea, badge, label
  };
})();
