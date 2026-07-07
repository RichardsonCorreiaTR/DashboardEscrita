/**
 * nes-definicao-tabela.js - Renderiza tabela resumo e secao por analista
 * de NEs com Definicao. Inclui lista de NEs e grafico de tendencia por pessoa.
 */
/* eslint-disable no-unused-vars */
/* global NesGrafico */
const NesTabela = (() => {

  function valoresPorAnalista(slug, labels, porAnalista) {
    return labels.map(label => (porAnalista[slug] && porAnalista[slug][label])
      ? porAnalista[slug][label].length : 0);
  }

  function totalAnalista(slug, porAnalista) {
    if (!porAnalista[slug]) return 0;
    return Object.values(porAnalista[slug]).reduce((s, arr) => s + arr.length, 0);
  }

  function badgeTendencia(tend) {
    if (!tend) return '';
    return `<span class="ned-badge" style="background:${tend.cor}22;color:${tend.cor};border:1px solid ${tend.cor}66">
      ${tend.icone} ${tend.texto}</span>`;
  }

  function renderizarResumo(dados, container) {
    const { versoes, labels } = dados;
    const totalNes = versoes.reduce((s, v) => s + v.totais.com_definicao, 0);
    const totalLiberadas = versoes.reduce((s, v) => s + v.totais.total_liberadas, 0);
    const pct = totalLiberadas ? ((totalNes / totalLiberadas) * 100).toFixed(1) : 0;
    container.innerHTML = `
      <div class="ned-resumo-cards">
        <div class="ned-card"><span class="ned-card-num">${versoes.length}</span><span class="ned-card-label">Versões analisadas</span></div>
        <div class="ned-card"><span class="ned-card-num">${totalNes}</span><span class="ned-card-label">NEs com definição (total)</span></div>
        <div class="ned-card"><span class="ned-card-num">${pct}%</span><span class="ned-card-label">% do total liberado</span></div>
        <div class="ned-card"><span class="ned-card-num">${labels[labels.length - 1] || '—'}</span><span class="ned-card-label">Última versão</span></div>
      </div>`;
  }

  function renderizarSecaoAnalista(slug, nomeDisplay, dados, container, labelsFiltrados) {
    const labels = labelsFiltrados || dados.labels;
    const valores = valoresPorAnalista(slug, labels, dados.por_analista);
    const total = valores.reduce((a, b) => a + b, 0);

    const secao = document.createElement('div');
    secao.className = 'ned-analista-secao';
    secao.id = 'ned-' + slug;
    secao.innerHTML = `
      <div class="ned-analista-header">
        <h3 class="ned-analista-nome">${nomeDisplay}</h3>
        <div class="ned-analista-meta">
          <span class="ned-total-label">Total: <strong>${total}</strong> NEs</span>
          <span id="ned-tend-badge-${slug}"></span>
        </div>
      </div>
      <div class="ned-analista-body">
        <div class="ned-grafico-box">
          <canvas id="ned-chart-${slug}" height="160"></canvas>
        </div>
        <div class="ned-nes-lista" id="ned-lista-${slug}"></div>
      </div>`;
    container.appendChild(secao);

    // Render chart after DOM is attached
    requestAnimationFrame(() => {
      const tend = NesGrafico.renderizar(`ned-chart-${slug}`, nomeDisplay, labels, valores);
      if (tend) {
        const badgeEl = document.getElementById(`ned-tend-badge-${slug}`);
        if (badgeEl) badgeEl.innerHTML = badgeTendencia(tend);
      }
      renderizarListaNEs(slug, dados, labels, document.getElementById(`ned-lista-${slug}`));
    });
  }

  function renderizarListaNEs(slug, dados, labels, container) {
    if (!container) return;
    const porAnalista = dados.por_analista[slug] || {};
    const nesComNE = [];
    labels.forEach(label => {
      (porAnalista[label] || []).forEach(ne => nesComNE.push({ label, ne }));
    });
    if (!nesComNE.length) {
      container.innerHTML = '<p class="ned-vazio">Nenhuma NE atribuída neste período.</p>';
      return;
    }
    container.innerHTML = nesComNE.slice().reverse().map(({ label, ne }) => `
      <div class="ned-ne-item${ne.grave ? ' ned-ne-item--grave' : ''}">
        <span class="ned-ne-ver">${label}</span>
        <span class="ned-ne-num">NE ${ne.ne}</span>
        ${ne.grave ? '<span class="ned-ne-grave">⚠ Grave</span>' : ''}
        <span class="ned-ne-analise">${ne.analise || '(sem análise)'}</span>
      </div>`).join('');
  }

  function renderizarTabelaGeral(analistas, dados, container) {
    const { labels, por_analista } = dados;
    // Mostrar apenas ultimas 10 versoes no resumo
    const labelsExib = labels.slice(-10);
    const rows = analistas.map(a => {
      const slug = a.slug;
      const vals = valoresPorAnalista(slug, labelsExib, por_analista);
      const total = valoresPorAnalista(slug, labels, por_analista).reduce((s, v) => s + v, 0);
      if (total === 0) return null;
      const tend = NesGrafico.indicadorTendencia(
        NesGrafico.calcularTendencia(valoresPorAnalista(slug, labels, por_analista)),
        vals[vals.length - 1] || 0
      );
      const colunas = vals.map(v => `<td class="ned-td-num${v > 0 ? ' ned-td-num--red' : ' ned-td-num--green'}">${v > 0 ? v : '—'}</td>`).join('');
      return `<tr>
        <td class="ned-td-nome"><a href="#ned-${slug}">${a.apelido}</a></td>
        ${colunas}
        <td class="ned-td-total">${total}</td>
        <td style="color:${tend.cor};font-weight:700">${tend.icone}</td>
      </tr>`;
    }).filter(Boolean);

    container.innerHTML = `
      <div style="overflow-x:auto">
        <table class="ned-tabela">
          <thead><tr>
            <th>Analista/Esp.</th>
            ${labelsExib.map(l => `<th class="ned-th-ver">${l.split('(')[0].trim()}</th>`).join('')}
            <th>Total</th><th>Tend.</th>
          </tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>`;
  }

  return { renderizarResumo, renderizarSecaoAnalista, renderizarTabelaGeral, valoresPorAnalista };
})();
