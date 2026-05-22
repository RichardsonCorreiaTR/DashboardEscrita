/**
 * app-liberacoes-v2-diario.js - Diario do modelo e exemplo do calculo
 * Mostra: exemplo passo-a-passo, historico de previsoes congeladas,
 * historico de estrategias e calibracoes.
 */
/* eslint-disable no-unused-vars */
const AppLiberacoesV2Diario = (() => {

  function renderizar(dados) {
    if (!dados) return;
    renderExemplo(dados.exemplo, dados.versaoFutura);
    renderHistoricoPrevisoes(dados.diario);
    renderHistoricoEstrategias(dados.diario);
  }

  function renderExemplo(ex, vFut) {
    const el = document.getElementById('v2-diario-exemplo');
    if (!el || !ex) { if (el) el.innerHTML = ''; return; }

    const passosH = ex.passos.map((p, i) => {
      const det = Array.isArray(p.detalhe)
        ? p.detalhe.map(d => `<div class="exemplo-detalhe">${d}</div>`).join('')
        : `<div class="exemplo-detalhe">${p.detalhe}</div>`;
      const cls = i === ex.passos.length - 1 ? ' exemplo-passo--final' : '';
      return `<div class="exemplo-passo${cls}">
        <div class="exemplo-passo__num">${i + 1}</div>
        <div class="exemplo-passo__body">
          <div class="exemplo-passo__titulo">${p.titulo}</div>
          ${det}
          <div class="exemplo-passo__resultado">${p.resultado}</div>
        </div></div>`;
    }).join('');

    el.innerHTML = `<div class="prova-card">
      <div class="prova-card__header">
        <span class="prova-card__titulo">Exemplo real: como chegamos na previsao para ${vFut || 'proxima versao'}</span>
        <span class="prova-card__badge" style="background:var(--info)">Estrategia: ${ex.estrategia}</span></div>
      <div class="prova-card__body">
        <div class="exemplo-intro">Usando dados reais da versao <strong>${ex.versaoBase}</strong>, 
          janela de <strong>${ex.janela} versoes</strong>:</div>
        <div class="exemplo-passos">${passosH}</div>
      </div></div>`;
  }

  function renderHistoricoPrevisoes(di) {
    const el = document.getElementById('v2-diario-previsoes');
    if (!el || !di || !di.previsoes || di.previsoes.length === 0) {
      if (el) el.innerHTML = '<p style="color:var(--cor-texto-sec);font-size:0.8rem">Nenhuma previsao registrada ainda. O diario começa a ser preenchido a partir de agora.</p>';
      return;
    }

    const rows = di.previsoes.map(p => {
      const real = p.realizado != null ? p.realizado : '-';
      const erro = p.erro != null ? p.erro + '%' : '-';
      const cE = p.erro != null ? (p.erro <= 15 ? 'var(--verde)' : p.erro <= 30 ? 'var(--amarelo)' : 'var(--vermelho)') : '';
      const interv = p.intervalo ? `[${p.intervalo.baixo}-${p.intervalo.alto}]` : '-';
      const dentroI = p.acertou_intervalo != null
        ? (p.acertou_intervalo ? '<span style="color:var(--verde)">Sim</span>' : '<span style="color:var(--vermelho)">Nao</span>')
        : '-';
      const dt = p.data ? new Date(p.data).toLocaleDateString('pt-BR') : '-';
      return `<tr>
        <td><strong>${p.versao}</strong></td><td>${dt}</td>
        <td>${p.estrategia || '-'}</td><td>${p.previsto}</td>
        <td>${interv}</td><td>${real}</td>
        <td style="color:${cE}">${erro}</td><td>${dentroI}</td></tr>`;
    }).join('');

    el.innerHTML = `<div class="prova-card">
      <div class="prova-card__header">
        <span class="prova-card__titulo">Historico de Previsoes (congeladas)</span>
        <span class="prova-card__badge" style="background:var(--info)">${di.previsoes.length} registros</span></div>
      <div class="prova-card__body">
        <div class="prova-legenda" style="margin-bottom:0.5rem">Cada previsao e registrada UMA VEZ e nunca recalculada. 
          Quando o dado real chega, o resultado e anotado ao lado para comparacao.</div>
        <table class="tabela-detalhes prova-tabela"><thead><tr>
          <th>Versao</th><th>Data</th><th>Estrategia</th><th>Previsto</th>
          <th>Intervalo</th><th>Real</th><th>Erro</th><th>No intervalo?</th>
        </tr></thead><tbody>${rows}</tbody></table>
      </div></div>`;
  }

  function renderHistoricoEstrategias(di) {
    const el = document.getElementById('v2-diario-estrategias');
    if (!el || !di) { if (el) el.innerHTML = ''; return; }

    const items = [];
    if (di.historico_estrategias && di.historico_estrategias.length > 0) {
      for (const h of di.historico_estrategias) {
        items.push(`<div class="timeline-item timeline-item--passado">
          <div class="timeline-item__data">${h.desde ? new Date(h.desde).toLocaleDateString('pt-BR') : '?'}
            ${h.ate ? ' a ' + new Date(h.ate).toLocaleDateString('pt-BR') : ''}</div>
          <div class="timeline-item__titulo">${h.tipo}</div>
          <div class="timeline-item__motivo">${h.motivo || ''}</div></div>`);
      }
    }
    if (di.estrategia_atual) {
      const a = di.estrategia_atual;
      items.push(`<div class="timeline-item timeline-item--atual">
        <div class="timeline-item__data">Desde ${a.desde ? new Date(a.desde).toLocaleDateString('pt-BR') : 'hoje'}
          <span class="prova-card__badge" style="background:var(--verde);margin-left:0.5rem">ATIVA</span></div>
        <div class="timeline-item__titulo">${a.tipo}</div>
        <div class="timeline-item__motivo">${a.motivo || ''}</div></div>`);
    }

    const calibH = di.calibracoes && di.calibracoes.length > 0
      ? `<details style="margin-top:0.75rem"><summary style="cursor:pointer;font-size:0.78rem;font-weight:600">Historico de calibracoes (${di.calibracoes.length})</summary>
        <div style="margin-top:0.5rem">${di.calibracoes.map(c => `<div class="exemplo-detalhe" style="margin-bottom:0.5rem">
          <strong>${new Date(c.data).toLocaleDateString('pt-BR')}</strong>: 
          Testadas ${c.estrategias_testadas} estrategias. Vencedora: ${c.vencedora} (MAPE ${c.mape_vencedora}%).
          Decisao: ${c.decisao}. ${c.motivo || ''}</div>`).join('')}</div></details>`
      : '';

    el.innerHTML = `<div class="prova-card">
      <div class="prova-card__header">
        <span class="prova-card__titulo">Linha do Tempo das Estrategias</span></div>
      <div class="prova-card__body">
        <div class="prova-legenda" style="margin-bottom:0.5rem">Cada troca de estrategia fica registrada com data e motivo. 
          Previsoes passadas nao mudam - foram feitas com a estrategia da epoca.</div>
        <div class="timeline">${items.join('')}</div>
        ${calibH}
      </div></div>`;
  }

  return { renderizar };
})();
