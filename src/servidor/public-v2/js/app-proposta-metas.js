/**
 * app-proposta-metas.js - Pagina de proposta com retrospectiva 2025
 *
 * Depende de: proposta-metas-dados.js, proposta-metas-charts.js, Chart.js
 */

/* eslint-disable no-unused-vars */
const PropostaMetas = (() => {
  const { METAS } = PropostaDados;

  function renderizar() {
    const main = document.getElementById('proposta-main');
    main.innerHTML = `
      <div class="proposta-intro">
        <strong>Proposta de novas metas - Retrospectiva 2025.</strong>
        Esta pagina analisa <strong>3 metas propostas</strong> com dados reais
        de 2025 para cada analista da equipe Escrita Fiscal. Clique em "Carregar dados 2025"
        para consultar o banco e visualizar a retrospectiva.
      </div>
      ${METAS.map((m, i) => renderSecao(m, i)).join('')}
    `;
    document.querySelectorAll('.secao-header').forEach(h => {
      h.addEventListener('click', () => {
        h.closest('.proposta-secao').classList.toggle('proposta-secao--aberta');
      });
    });
  }

  function renderSecao(meta, idx) {
    const sugs = Object.entries(meta.sugestao2026)
      .map(([cargo, val]) => `<span class="sug-item"><strong>${cargo}:</strong> ${val}</span>`)
      .join('');
    return `
      <div class="proposta-secao proposta-secao--aberta" data-meta="${meta.id}">
        <div class="secao-header">
          <h2><span class="secao-num">${idx + 1}</span> ${meta.nome}</h2>
          <span class="seta">\u25B8</span>
        </div>
        <div class="secao-body">
          <div class="secao-explicacao">
            <div class="exp-bloco">
              <div class="exp-label">O que mede</div>
              <div class="exp-texto">${meta.explicacao}</div>
            </div>
            <div class="exp-bloco">
              <div class="exp-label">Como funciona</div>
              <div class="exp-texto">${meta.comoFunciona}</div>
            </div>
            <div class="exp-grid">
              <div class="exp-campo"><span class="exp-label">Formula</span><br>${meta.formula}</div>
              <div class="exp-campo"><span class="exp-label">Unidade</span><br>${meta.unidade}</div>
              <div class="exp-campo"><span class="exp-label">Direcao</span><br>${meta.direcao}</div>
              <div class="exp-campo"><span class="exp-label">Fonte</span><br>${meta.fonte}</div>
            </div>
          </div>
          <div class="secao-retro">
            <div class="retro-header">
              <h3>Retrospectiva 2025</h3>
              <button class="btn--carregar" onclick="PropostaMetas.carregar('${meta.id}')">
                Carregar dados 2025
              </button>
            </div>
            <div class="retro-loading" id="loading-${meta.id}" hidden>
              <div class="loading__spinner"></div> Consultando banco...
            </div>
            <div class="retro-erro" id="erro-${meta.id}" hidden></div>
            <div class="retro-conteudo" id="conteudo-${meta.id}" hidden>
              <canvas id="chart-${meta.id}" height="100"></canvas>
              <div id="tabela-${meta.id}"></div>
            </div>
          </div>
          <div class="secao-sugestao">
            <h3>Sugestao de meta 2026</h3>
            <div class="sug-grid">${sugs}</div>
          </div>
        </div>
      </div>`;
  }

  async function carregar(metaId) {
    const meta = METAS.find(m => m.id === metaId);
    const loading = document.getElementById('loading-' + metaId);
    const erro = document.getElementById('erro-' + metaId);
    const conteudo = document.getElementById('conteudo-' + metaId);

    loading.hidden = false;
    erro.hidden = true;
    conteudo.hidden = true;

    try {
      const resp = await fetch(`/api/proposta-metas/retro/${metaId}?ano=2025`);
      const data = await resp.json();
      if (data.erro) throw new Error(data.erro);

      loading.hidden = true;
      conteudo.hidden = false;

      PropostaCharts.criarGrafico('chart-' + metaId, data.analistas, meta);
      PropostaCharts.criarTabela('tabela-' + metaId, data.analistas, meta);
    } catch (err) {
      loading.hidden = true;
      erro.hidden = false;
      erro.textContent = 'Erro: ' + err.message;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderizar);
  } else {
    renderizar();
  }

  return { carregar };
})();
