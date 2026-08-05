/**
 * detalhes-tempo.js - Detalhe Tempo Correcao NE / Implementacao SAL / SAM-SAIL
 */
/* eslint-disable no-unused-vars */
const DetalhesTempo = (() => {
  function ehTipoFoco(tipo, f) {
    return f === 'SAM/SAIL' ? (tipo === 'SAM' || tipo === 'SAIL') : tipo === f;
  }

  function labelTipo(row) {
    if (row.tipo === 'NE' && row.interna) return 'NE interna';
    return row.tipo || '--';
  }

  function render(r, body, h) {
    const d = r.detalhes;
    const foco = d.tipo_foco || 'NE';
    const ehNe = foco === 'NE';
    const pctBarra = Math.min(100, (r.valor / (r.meta || 1)) * 100);
    const cor = r.status === 'verde' ? 'var(--verde)'
      : r.status === 'amarelo' ? 'var(--amarelo)' : 'var(--vermelho)';
    const bk = d.breakdown_tipo || {};
    const tiposHTML = Object.entries(bk).map(([t, q]) => h.infoBox(t, q)).join('');
    const fm = v => v != null ? v.toLocaleString('pt-BR') : '0';
    const dv = d.tempo_dev || {};
    const ts = d.tempo_teste || {};
    const pr = d.tempo_prep || {};
    const sm = d.tempo_soma || {};
    const par = d.tempo_paralelo || {};
    const sais = d.sais || [];
    const saisPar = d.sais_paralelo || [];
    const saisFoco = sais.filter(s => ehTipoFoco(s.tipo, foco) && !s.interna);
    const saisInt = ehNe ? sais.filter(s => s.tipo === 'NE' && s.interna) : [];
    const saisOutras = sais.filter(s => !ehTipoFoco(s.tipo, foco));

    const colsDet = [...h.colsSaiPsai,
      { label: 'Tipo', render: row => labelTipo(row) },
      { label: 'Via', render: row => row.via || '--' },
      { label: 'Dev (min)', render: row => fm(row.dev) },
      { label: 'Teste (min)', render: row => fm(row.teste) },
      { label: 'Prep (min)', render: row => fm(row.prep) },
      { label: 'Total (min)', render: row => `<strong>${fm(row.total)}</strong>` }
    ];

    const cabFoco = ehNe
      ? '<th style="text-align:right;padding:4px 8px;">NE (min)</th>' +
        '<th style="text-align:right;padding:4px 8px;">NE int. (min)</th>' +
        '<th style="text-align:right;padding:4px 8px;">NE total (min)</th>'
      : `<th style="text-align:right;padding:4px 8px;">${foco} (min)</th>`;

    const celFoco = (c) => ehNe
      ? `<td style="text-align:right;padding:4px 8px;">${fm(c.ne_ext)}</td>` +
        `<td style="text-align:right;padding:4px 8px;">${fm(c.ne_int)}</td>` +
        `<td style="text-align:right;padding:4px 8px;">${fm(c.ne)}</td>`
      : `<td style="text-align:right;padding:4px 8px;">${fm(c.ne)}</td>`;

    const timeRows = [['Desenvolvimento', dv], ['Teste', ts], ['Preparacao', pr]]
      .map(([n, c]) =>
        `<tr><td style="padding:4px 8px;">${n}</td>` +
        `<td style="text-align:right;padding:4px 8px;">${fm(c.total)}</td>${celFoco(c)}</tr>`
      ).join('');

    const abas = [
      { id: 'tempo-ne', titulo: foco + 's', qtd: saisFoco.length, html: h.tbl(colsDet, saisFoco) }
    ];
    if (ehNe) {
      abas.push({
        id: 'tempo-ne-int', titulo: 'NEs Internas', qtd: saisInt.length,
        html: h.tbl(colsDet, saisInt)
      });
    }
    abas.push(
      { id: 'tempo-outras', titulo: 'Outras SAIs', qtd: saisOutras.length, html: h.tbl(colsDet, saisOutras) },
      { id: 'tempo-paralelo', titulo: 'Paralelo', qtd: saisPar.length, html: h.tbl(colsDet, saisPar) },
      { id: 'tempo-todas', titulo: 'Todas', qtd: sais.length + saisPar.length,
        html: h.tbl(colsDet, [...sais, ...saisPar]) }
    );

    body.innerHTML = `
      <div class="info-grid">
        ${h.infoBox(`% Tempo ${foco}`, r.valor + '%')}
        ${h.infoBox('Meta Mes', (r.meta != null ? r.meta : '--') + (r.meta != null ? '%' : ''))}
        ${h.infoBox(`${foco}s`, d.total_sai_ne)}
        ${h.infoBox(`${foco}s Internas`, d.total_sai_ne_internas ?? '--')}
        ${h.infoBox('SAIs Liberadas', d.total_sai_liberada)}
        ${h.infoBox('SAIs Paralelo', d.qtd_paralelo != null ? d.qtd_paralelo : '0')}
        ${h.infoBox('Na Versao', d.qtd_versao != null ? d.qtd_versao : '--')}
      </div>
      <div style="margin:1rem 0;">
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:0.3rem;">
          <span>${foco}: ${r.valor}%</span><span>Meta: ${r.meta != null ? r.meta + '%' : '--'}</span>
        </div>
        <div style="background:#e2e8f0;border-radius:8px;height:24px;overflow:hidden;">
          <div style="background:${cor};height:100%;width:${pctBarra}%;border-radius:8px;transition:width 0.5s;"></div>
        </div>
      </div>
      <div style="background:var(--cor-fundo);padding:1rem;border-radius:8px;font-size:0.8rem;margin-top:0.8rem;">
        <table style="width:100%;border-collapse:collapse;">
          <tr style="border-bottom:1px solid var(--cor-borda);">
            <th style="text-align:left;padding:4px 8px;">Componente</th>
            <th style="text-align:right;padding:4px 8px;">Total (min)</th>
            ${cabFoco}
          </tr>
          ${timeRows}
          <tr style="border-top:1px solid var(--cor-borda);font-weight:600;">
            <td style="padding:4px 8px;">Subtotal Liberadas</td>
            <td style="text-align:right;padding:4px 8px;">${fm(d.tempo_liberadas)}</td>
            ${celFoco(sm)}
          </tr>
          ${par.total > 0 ? `
          <tr style="color:#6366f1;">
            <td style="padding:4px 8px;">Paralelo (Dev)</td>
            <td style="text-align:right;padding:4px 8px;">${fm(par.dev)}</td>
            ${ehNe ? '<td>--</td><td>--</td><td>--</td>' : '<td style="text-align:right;padding:4px 8px;">--</td>'}
          </tr>
          <tr style="color:#6366f1;">
            <td style="padding:4px 8px;">Paralelo (Teste+Prep)</td>
            <td style="text-align:right;padding:4px 8px;">${fm(par.teste + par.prep)}</td>
            ${ehNe ? '<td>--</td><td>--</td><td>--</td>' : '<td style="text-align:right;padding:4px 8px;">--</td>'}
          </tr>` : ''}
          <tr style="border-top:2px solid var(--cor-borda);font-weight:700;">
            <td style="padding:4px 8px;">TOTAL GERAL</td>
            <td style="text-align:right;padding:4px 8px;">${fm(sm.total)}</td>
            ${celFoco(sm)}
          </tr>
        </table>
        <div style="margin-top:0.6rem;"><strong>Formula:</strong> ${d.formula || '--'}</div>
      </div>
      <div style="margin-top:0.8rem;">
        <div style="font-size:0.85rem;font-weight:600;margin-bottom:0.4rem;">SAIs Liberadas por Tipo</div>
        <div class="info-grid">${tiposHTML}</div>
      </div>
      <h3 style="margin:1.2rem 0 0.5rem;font-size:0.95rem;">Detalhamento por SAI</h3>
      ${h.abasHTML(abas)}
    `;
    h.inicializarAbas(body);
  }

  return { render };
})();
