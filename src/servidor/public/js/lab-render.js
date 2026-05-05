/**
 * lab-render.js - Funcoes de renderizacao HTML do Laboratorio
 *
 * Gera KPIs, tabelas e popula selects.
 * Graficos ficam em app-laboratorio.js (usa Chart.js).
 */

/* eslint-disable no-unused-vars */
const LabRender = (() => {
  const LABELS_AREA = {
    motor_calculo: 'Motor de Calculo', api_esocial: 'eSocial',
    integracao_contabil: 'Integ. Contabil', processamento_lote: 'Proc. em Lote',
    relatorio: 'Relatorios', relatorios: 'Relatorios',
    importacao_exportacao: 'Import/Export', parametrizacao: 'Parametrizacao',
    interface_web: 'Interface Web', interface_usuario: 'Interface',
    banco_dados: 'Banco de Dados', autenticacao: 'Autenticacao',
    cadastros: 'Cadastros', seguranca: 'Seguranca',
    obrigacoes_acessorias: 'Obrig. Acessorias', beneficios: 'Beneficios'
  };

  function renderSeletorVersoes(versoes, select) {
    select.innerHTML = versoes.map(v =>
      '<option value="' + v + '">' + v + '</option>'
    ).join('');
  }

  function renderKPIs(data, container) {
    const corComplex = data.idx_complexidade <= 2.5 ? 'verde'
      : data.idx_complexidade <= 3.5 ? 'amarelo' : 'vermelho';
    const corRisco = data.idx_risco <= 1.5 ? 'verde'
      : data.idx_risco <= 2.5 ? 'amarelo' : 'vermelho';
    const corPctRisco = data.pct_alto_risco <= 15 ? 'verde'
      : data.pct_alto_risco <= 30 ? 'amarelo' : 'vermelho';

    container.innerHTML = [
      kpiCard('info', data.total, 'Total de SAIs', 'na versao'),
      kpiCard(corComplex, data.idx_complexidade, 'Complexidade', 'indice 1-5'),
      kpiCard(corRisco, data.idx_risco, 'Risco', 'indice 1-4'),
      kpiCard(corPctRisco, data.pct_alto_risco + '%', '% Alto Risco', 'alto + critico')
    ].join('');
  }

  function kpiCard(cor, valor, titulo, meta) {
    return '<div class="card card--' + cor + '">' +
      '<h3 class="card__titulo">' + esc(titulo) + '</h3>' +
      '<div class="card__valor">' + valor + '</div>' +
      '<span class="card__meta">' + esc(meta) + '</span></div>';
  }

  function renderSais(sais, container) {
    if (!sais || sais.length === 0) {
      container.innerHTML = '<p class="lab-vazio">Nenhuma SAI nesta versao</p>';
      return;
    }
    const rows = sais.map(c => {
      const corR = corRisco(c.risco);
      const corC = corComplex(c.complexidade);
      const desc = c.resumo || truncar(c.descricao, 100) || '-';
      const cls = c.critico ? ' class="lab-row--critico"' : '';
      return '<tr' + cls + '>' +
        '<td class="lab-id"><strong>' + (c.i_psai || '-') + '</strong></td>' +
        '<td class="lab-id">' + (c.i_sai || '-') + '</td>' +
        '<td>' + (c.tipo || '-') + '</td>' +
        '<td><span class="lab-pill ' + corC + '">' + (c.complexidade || '-') + '</span></td>' +
        '<td><span class="lab-pill ' + corR + '">' + (c.risco || '-') + '</span></td>' +
        '<td>' + labelArea(c.area) + '</td>' +
        '<td class="lab-desc" title="' + esc(c.resumo || c.descricao || '') + '">' +
        esc(desc) + '</td></tr>';
    }).join('');

    container.innerHTML = '<table class="tabela"><thead><tr>' +
      '<th>PSAI</th><th>SAI</th><th>Tipo</th>' +
      '<th>Complex.</th><th>Risco</th><th>Area</th><th>Resumo</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function renderDnaTabela(areas, container) {
    const rows = areas.map(a => {
      const corR = a.idx_risco <= 1.5 ? 'lab-pill--verde'
        : a.idx_risco <= 2.5 ? 'lab-pill--amarelo' : 'lab-pill--vermelho';
      return '<tr>' +
        '<td><strong>' + esc(a.label) + '</strong></td>' +
        '<td>' + a.total + '</td>' +
        '<td>' + a.pct + '%</td>' +
        '<td>' + a.idx_complexidade + '</td>' +
        '<td><span class="lab-pill ' + corR + '">' + a.idx_risco + '</span></td>' +
        '<td>' + a.pct_alto_risco + '%</td></tr>';
    }).join('');

    container.innerHTML = '<table class="tabela"><thead><tr>' +
      '<th>Area Tecnica</th><th>SAIs</th><th>%</th>' +
      '<th>Idx Complex.</th><th>Idx Risco</th><th>% Alto Risco</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }


  function labelArea(area) {
    return LABELS_AREA[area] || area || 'N/A';
  }

  function corRisco(r) {
    if (r === 'critico') return 'lab-pill--vermelho';
    if (r === 'alto') return 'lab-pill--vermelho';
    if (r === 'medio') return 'lab-pill--amarelo';
    return 'lab-pill--verde';
  }

  function corComplex(c) {
    if (c === 'sistemica' || c === 'alta') return 'lab-pill--vermelho';
    if (c === 'media') return 'lab-pill--amarelo';
    return 'lab-pill--verde';
  }

  function truncar(str, max) {
    if (!str) return '';
    return str.length > max ? str.substring(0, max) + '...' : str;
  }

  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { renderSeletorVersoes, renderKPIs, renderSais, renderDnaTabela, labelArea, LABELS_AREA };
})();
