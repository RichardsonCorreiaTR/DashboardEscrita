/**
 * app-acomp-sals.js - Acompanhamento SALs: Tempo Descarte
 * Diretriz: -20% tempo medio SAL | -30% tempo em PSAIs SAL descartadas
 */
/* global Chart */
const AppAcompSals = (() => {
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const META_ATIVAS_REDUCAO = 0.20;   // -20%
  const META_DESC_REDUCAO   = 0.30;   // -30%

  function fmtMin(min) {
    if (!min) return '—';
    const h = Math.floor(min / 60), m = min % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  }

  function calcStatus(atual, base, metaReducao) {
    if (!base) return { pct: null, cor: '#94a3b8', texto: 'Sem base' };
    const meta = base * (1 - metaReducao);
    const reducaoReal = base > 0 ? ((base - atual) / base) * 100 : 0;
    const atingiu = atual <= meta;
    const cor = atingiu ? '#22c55e' : reducaoReal > 0 ? '#eab308' : '#ef4444';
    return { pct: Math.round(reducaoReal), meta: Math.round(meta), atingiu, cor,
      texto: atingiu ? '✓ Meta atingida' : `${Math.round(reducaoReal)}% reduzido (meta: ${Math.round(metaReducao * 100)}%)` };
  }

  function renderCard(a, base) {
    const statusAtivas = calcStatus(a.media_min, base ? base.media_min : null, META_ATIVAS_REDUCAO);
    const statusDesc   = calcStatus(a.tempo_total_descartadas, base ? base.tempo_total_descartadas : null, META_DESC_REDUCAO);

    const linha = (label, atual, metaBase, status) => `
      <div class="sal-metrica">
        <div class="sal-metrica__label">${label}</div>
        <div class="sal-metrica__valor" style="color:${status.cor}">${fmtMin(atual)}</div>
        <div class="sal-metrica__base">Base ${ano-1}: ${fmtMin(metaBase)} → meta: ${fmtMin(status.meta)}</div>
        <div class="sal-metrica__status" style="color:${status.cor}">${status.texto}</div>
      </div>`;

    return `<div class="sal-card${statusAtivas.atingiu && statusDesc.atingiu ? ' sal-card--ok' : ''}">
      <div class="sal-card__header">
        <span class="sal-card__nome">${a.apelido}</span>
        <span class="sal-card__cargo">${a.senioridade}</span>
        <span class="sal-card__psais">${a.total_psais} SALs | ${a.total_descartadas} descartadas</span>
      </div>
      ${linha('Tempo médio/SAL (−20%)', a.media_min, base ? base.media_min : null, statusAtivas)}
      ${linha('Tempo em SALs descartadas (−30%)', a.tempo_total_descartadas, base ? base.tempo_total_descartadas : null, statusDesc)}
      <div class="sal-card__detalhe">
        <button class="btn btn--sm btn--outline" onclick="AppAcompSals.toggleTabela('${a.slug}')">Detalhe mensal</button>
      </div>
      <div id="sal-tabela-${a.slug}" class="sal-tabela" style="display:none">
        ${renderTabela(a)}
      </div>
    </div>`;
  }

  function renderTabela(a) {
    const linhas = MESES.map((mes, i) => {
      const m = i + 1;
      const av = a.mensal_ativas[m] || { tempo: 0, qtd: 0 };
      const dc = a.mensal_descartadas[m] || { tempo: 0, qtd: 0 };
      const media = av.qtd > 0 ? Math.round(av.tempo / av.qtd) : 0;
      if (!av.qtd && !dc.qtd) return `<tr style="opacity:.4"><td>${mes}</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`;
      return `<tr>
        <td><strong>${mes}</strong></td>
        <td>${av.qtd} PSAIs</td>
        <td>${fmtMin(media)}</td>
        <td>${dc.qtd} desc.</td>
        <td>${fmtMin(dc.tempo)}</td>
      </tr>`;
    }).join('');
    return `<table class="eq-tabela" style="margin-top:0.75rem;font-size:0.75rem">
      <thead><tr><th>Mês</th><th>SALs</th><th>Média/SAL</th><th>Descartadas</th><th>Tempo Desc.</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>`;
  }

  let _dados = null;
  let ano = new Date().getFullYear();

  function renderizar() {
    const container = document.getElementById('sal-conteudo');
    if (!_dados) return;
    const baseMap = {};
    _dados.baseline.forEach(b => { baseMap[b.slug] = b; });
    const comDados = _dados.analistas.filter(a => a.total_psais > 0 || a.total_descartadas > 0);
    if (!comDados.length) { container.innerHTML = '<p class="eq-sem-dados">Nenhum dado encontrado para o período.</p>'; return; }
    container.innerHTML = comDados.map(a => renderCard(a, baseMap[a.slug])).join('');
  }

  async function carregar(anoSel) {
    ano = anoSel || ano;
    const container = document.getElementById('sal-conteudo');
    container.innerHTML = '<div class="loading"><div class="loading__spinner"></div><span>Consultando banco...</span></div>';
    try {
      const r = await fetch(`/api/acomp-sals/tempo-descarte?ano=${ano}`);
      _dados = await r.json();
      if (_dados.erro) { container.innerHTML = `<p class="eq-sem-dados">Erro: ${_dados.erro}</p>`; return; }
      renderizar();
    } catch (e) { container.innerHTML = `<p class="eq-sem-dados">Erro de rede: ${e.message}</p>`; }
  }

  function toggleTabela(slug) {
    const el = document.getElementById(`sal-tabela-${slug}`);
    if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const sel = document.getElementById('sal-ano');
    if (sel) sel.addEventListener('change', e => carregar(Number(e.target.value)));
    const btn = document.getElementById('sal-btn-consultar');
    if (btn) btn.addEventListener('click', () => carregar(Number(document.getElementById('sal-ano').value)));
    carregar(ano);
  });

  return { toggleTabela };
})();
