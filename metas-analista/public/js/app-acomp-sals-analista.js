/**
 * app-acomp-sals-analista.js - Resumo Tempo Descarte (somente o logado)
 * CFG: window.ACOMP_CFG = { apiBase, label }
 */
const AppAcompSalsAnalista = (() => {
  const CFG = window.ACOMP_CFG || { apiBase: '/api/acomp-sals', label: 'SAL' };
  const L = CFG.label;
  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const META_ATV = 0.20, META_DESC = 0.30;
  let _ano = new Date().getFullYear();

  function fmtMin(min) {
    if (!min) return '—';
    const h = Math.floor(min / 60), m = min % 60;
    return h > 0 ? h + 'h ' + m + 'min' : m + 'min';
  }

  function calcStatus(atual, base, meta) {
    if (!base) return { cor: '#94a3b8', texto: 'Sem base', atingiu: false };
    const metaVal = base * (1 - meta);
    const reducao = base > 0 ? Math.round(((base - atual) / base) * 100) : 0;
    const atingiu = atual <= metaVal;
    const cor = atingiu ? '#22c55e' : reducao > 0 ? '#eab308' : '#ef4444';
    return {
      cor, atingiu, reducao,
      texto: atingiu ? '✓ Atingido (' + reducao + '% reduzido)'
        : (reducao > 0 ? reducao + '% reduzido' : 'Sem redução') + ' — meta: ' + Math.round(meta * 100) + '%'
    };
  }

  function renderCard(a, base) {
    const stAtv = calcStatus(a.media_min, base ? base.media_min : null, META_ATV);
    const stDsc = calcStatus(a.tempo_total_descartadas, base ? base.tempo_total_descartadas : null, META_DESC);
    const linha = (label, atual, baseVal, st, meta) =>
      '<div class="sal-metrica"><div class="sal-metrica__label">' + label + '</div>' +
      '<div class="sal-metrica__valor" style="color:' + st.cor + '">' + fmtMin(atual) + '</div>' +
      '<div class="sal-metrica__base">Base ' + (_ano - 1) + ': ' + fmtMin(baseVal) +
      ' → meta: ' + fmtMin(baseVal ? Math.round(baseVal * (1 - meta)) : null) + '</div>' +
      '<div class="sal-metrica__status" style="color:' + st.cor + '">' + st.texto + '</div></div>';
    return '<div class="sal-card' + (stAtv.atingiu && stDsc.atingiu ? ' sal-card--ok' : '') + '">' +
      '<div class="sal-card__header"><span class="sal-card__nome">' + a.apelido + '</span>' +
      '<span class="sal-card__cargo">' + a.senioridade + '</span>' +
      '<span class="sal-card__psais">' + a.total_psais + ' ' + L + 's · ' + a.total_descartadas + ' desc.</span></div>' +
      linha('Tempo médio/' + L + ' (−20%)', a.media_min, base && base.media_min, stAtv, META_ATV) +
      linha('Tempo ' + L + 's descartadas (−30%)', a.tempo_total_descartadas, base && base.tempo_total_descartadas, stDsc, META_DESC) +
      '<div class="sal-card__detalhe"><button class="btn btn--sm btn--outline" id="btn-detalhe-mes">▾ Detalhe mensal</button></div>' +
      '<div id="sal-tabela-self" class="sal-tabela" style="display:none">' + renderTabela(a) + '</div></div>';
  }

  function renderTabela(a) {
    return '<table class="eq-tabela" style="margin-top:.75rem;font-size:.75rem">' +
      '<thead><tr><th>Mês</th><th>' + L + 's</th><th>Média</th><th>Descartadas</th><th>Tempo Desc.</th></tr></thead><tbody>' +
      MESES.map((mes, i) => {
        const m = i + 1;
        const av = a.mensal_ativas[m] || { tempo: 0, qtd: 0 };
        const dc = a.mensal_descartadas[m] || { tempo: 0, qtd: 0 };
        if (!av.qtd && !dc.qtd) return '<tr style="opacity:.35"><td>' + mes + '</td><td colspan="4">—</td></tr>';
        return '<tr><td><strong>' + mes + '</strong></td><td>' + av.qtd + '</td><td>' +
          fmtMin(av.qtd > 0 ? Math.round(av.tempo / av.qtd) : 0) + '</td><td>' + dc.qtd +
          '</td><td>' + fmtMin(dc.tempo) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  async function carregar(anoSel) {
    _ano = anoSel || _ano;
    const el = document.getElementById('sal-conteudo');
    el.innerHTML = '<div class="loading"><div class="loading__spinner"></div><span>Consultando banco...</span></div>';
    try {
      const dados = await (await fetch(CFG.apiBase + '/tempo-descarte?ano=' + _ano)).json();
      if (dados.erro) throw new Error(dados.erro);
      const a = (dados.analistas || [])[0];
      const base = (dados.baseline || [])[0];
      if (!a) { el.innerHTML = '<p class="eq-sem-dados">Nenhum dado para o período.</p>'; return; }
      el.innerHTML = renderCard(a, base);
      const btn = document.getElementById('btn-detalhe-mes');
      if (btn) btn.onclick = () => {
        const t = document.getElementById('sal-tabela-self');
        t.style.display = t.style.display === 'none' ? '' : 'none';
      };
    } catch (e) {
      el.innerHTML = '<p class="eq-sem-dados">Erro: ' + e.message + '</p>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const sel = document.getElementById('sal-ano');
    const btn = document.getElementById('sal-btn-consultar');
    if (btn) btn.addEventListener('click', () => carregar(Number(sel && sel.value)));
    carregar(_ano);
  });

  return {};
})();
