/**
 * equipes-mensal.js - Tabelas mensais (Jan-Dez), totalizador e explicacoes
 *
 * Depende de format-utils.js e metas-config.js (LABELS, EXPLICACOES).
 */

/* eslint-disable no-unused-vars */
const EquipesMensal = (() => {
  const { LABELS, EXPLICACOES } = MetasConfig;
  const { MESES, fmtMin, fmtDecimal, corPct } = FormatUtils;

  function renderTotalizador(tot) {
    if (!tot || tot.total === 0) return '<div class="eq-sem-dados">Sem avaliacoes no ano</div>';
    const pct = Math.round((tot.atingidas / tot.total) * 100);
    return `<div class="eq-tot">
      <h3 class="eq-tot__titulo">Totalizador Anual</h3>
      <div class="eq-dados-grid">
        <div class="eq-dado"><span class="eq-dado__valor" style="color:${corPct(pct)}">${pct}%</span><span class="eq-dado__label">Atingimento geral</span></div>
        <div class="eq-dado"><span class="eq-dado__valor" style="color:var(--verde)">${tot.atingidas}</span><span class="eq-dado__label">Meses atingidos</span></div>
        <div class="eq-dado"><span class="eq-dado__valor" style="color:var(--vermelho)">${tot.nao_atingidas}</span><span class="eq-dado__label">Meses nao atingidos</span></div>
        <div class="eq-dado"><span class="eq-dado__valor">${tot.total}</span><span class="eq-dado__label">Total avaliacoes</span></div>
      </div>
      ${resumoMetas(tot.por_meta)}
    </div>`;
  }

  function resumoMetas(pm) {
    if (!pm) return '';
    const itens = Object.entries(pm).filter(([, d]) => d.total > 0);
    if (!itens.length) return '';
    return '<div class="eq-tot-metas">' + itens.map(([id, d]) => {
      const p = Math.round((d.atingidas / d.total) * 100);
      return '<div class="eq-tot-meta"><span class="eq-tot-meta__label">' + (LABELS[id] || id) +
        '</span><span class="eq-tot-meta__valor" style="color:' + corPct(p) + '">' +
        d.atingidas + '/' + d.total + ' meses</span></div>';
    }).join('') + '</div>';
  }

  function renderExplicacao(metaId) {
    const exp = EXPLICACOES[metaId];
    if (!exp) return '';
    return '<div class="eq-explicacao"><strong>Calculo:</strong> ' + exp.formula +
      '<ul>' + exp.considerado.map(c => '<li>' + c + '</li>').join('') + '</ul></div>';
  }

  function renderTabela(metaId, metaData) {
    if (!metaData || !metaData.mensal) return '<div class="eq-sem-dados">Dados indisponiveis</div>';
    const mensal = metaData.mensal;
    const cols = colunas(metaId);
    const mesAtual = new Date().getMonth() + 1;
    let html = '<table class="eq-tabela"><thead><tr><th>Mes</th>';
    cols.forEach(c => { html += '<th>' + c.label + '</th>'; });
    html += '<th>Status</th><th></th></tr></thead><tbody>';
    for (let m = 1; m <= 12; m++) { html += linhaMes(m, mensal[m], cols, metaId, mesAtual); }
    html += '</tbody></table>';
    html += '<div class="eq-detalhe-container" data-detalhe-meta="' + metaId + '"></div>';
    return html;
  }

  function linhaMes(m, d, cols, metaId, mesAtual) {
    const btnDetalhe = m <= mesAtual
      ? '<button class="eq-btn-detalhe" data-meta="' + metaId + '" data-mes="' + m + '">Ver</button>'
      : '';
    if (!d) {
      const v = cols.map(() => '<td>-</td>').join('');
      return '<tr class="eq-tr--vazio"><td>' + MESES[m] + '</td>' + v + '<td>-</td><td>' + btnDetalhe + '</td></tr>';
    }
    const cls = d.atingida ? 'eq-tr--ok' : 'eq-tr--nok';
    const ico = d.atingida ? '\u2713' : '\u2717';
    const cells = cols.map(c => '<td>' + c.render(d) + '</td>').join('');
    return '<tr class="' + cls + '"><td>' + MESES[m] + '</td>' + cells +
      '<td class="eq-status">' + ico + '</td>' +
      '<td>' + btnDetalhe + '</td></tr>';
  }

  function colunas(id) {
    if (id.startsWith('tempo-trabalho')) return [
      { label: '% SAI/NE', render: d => d.pct + '%' },
      { label: 'Trab. SAI', render: d => fmtMin(d.trabalhoSai) },
      { label: 'Efetivo', render: d => fmtMin(d.efetivo) },
      { label: 'Meta', render: () => '\u2265 80%' }
    ];
    if (id.startsWith('indice-revisoes')) return [
      { label: 'Indice', render: d => fmtDecimal(d.indice) },
      { label: 'SAIs', render: d => d.total_sais },
      { label: 'Revisoes (A/C)', render: d => d.total_revisoes },
      { label: 'Meta', render: () => '\u2264 0,60' }
    ];
    if (id === 'pontos-definicao') return [
      { label: 'Pontos', render: d => d.pontos },
      { label: 'SAIs', render: d => d.qtd_sais + (d.qtd_sem_pontos > 0 ? ' <span class="eq-alerta-pontos" title="' + d.qtd_sem_pontos + ' SAI(s) sem pontuacao no SGD">⚠</span>' : '') },
      { label: 'Meta', render: () => '\u2265 80' }
    ];
    if (id.startsWith('gerar-sai')) return [
      { label: 'Media (d.u.)', render: d => d.media_dias },
      { label: '% prazo', render: d => d.pct + '%' },
      { label: 'Dentro/Total', render: d => d.dentro_prazo + '/' + d.total },
      { label: 'Meta', render: () => 'Media \u2264 3 d.u.' }
    ];
    if (id === 'respostas-ss-3d') return [
      { label: '% em 3d', render: d => d.pct + '%' },
      { label: 'Dentro/Total', render: d => d.dentro_3d + '/' + d.total },
      { label: 'Media dias', render: d => d.media_dias + 'd' },
      { label: 'Meta', render: () => '100%' }
    ];
    return [{ label: 'Valor', render: d => JSON.stringify(d) }];
  }

  return { renderTotalizador, renderExplicacao, renderTabela };
})();
