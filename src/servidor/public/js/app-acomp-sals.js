/**
 * app-acomp-sals.js - Acompanhamento SALs: Tempo Descarte
 * Diretriz: -20% tempo medio SAL | -30% tempo em PSAIs SAL descartadas
 * 3 abas: Resumo por Analista | Acumulado | Por Funcionario
 */
/* global AcompSalsAcumulado, AcompSalsFuncionario */
const AppAcompSals = (() => {
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const META_ATV = 0.20, META_DESC = 0.30;

  function fmtMin(min) {
    if (!min) return '—';
    const h = Math.floor(min / 60), m = min % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  }

  function calcStatus(atual, base, meta) {
    if (!base) return { cor: '#94a3b8', texto: 'Sem base' };
    const metaVal = base * (1 - meta);
    const reducao = base > 0 ? Math.round(((base - atual) / base) * 100) : 0;
    const atingiu = atual <= metaVal;
    const cor = atingiu ? '#22c55e' : reducao > 0 ? '#eab308' : '#ef4444';
    return { cor, atingiu, reducao, texto: atingiu
      ? `✓ Atingido (${reducao}% reduzido)`
      : `${reducao > 0 ? reducao + '% reduzido' : 'Sem redução'} — meta: ${Math.round(meta*100)}%` };
  }

  function renderCard(a, base) {
    const stAtv = calcStatus(a.media_min, base ? base.media_min : null, META_ATV);
    const stDsc = calcStatus(a.tempo_total_descartadas, base ? base.tempo_total_descartadas : null, META_DESC);
    const linha = (label, atual, baseVal, st) => `
      <div class="sal-metrica">
        <div class="sal-metrica__label">${label}</div>
        <div class="sal-metrica__valor" style="color:${st.cor}">${fmtMin(atual)}</div>
        <div class="sal-metrica__base">Base ${_ano-1}: ${fmtMin(baseVal)} → meta: ${fmtMin(baseVal ? Math.round(baseVal*(1-(label.includes('20')?.20:.30))) : null)}</div>
        <div class="sal-metrica__status" style="color:${st.cor}">${st.texto}</div>
      </div>`;
    return `<div class="sal-card${stAtv.atingiu && stDsc.atingiu ? ' sal-card--ok' : ''}">
      <div class="sal-card__header">
        <span class="sal-card__nome">${a.apelido}</span>
        <span class="sal-card__cargo">${a.senioridade}</span>
        <span class="sal-card__psais">${a.total_psais} SALs · ${a.total_descartadas} desc.</span>
      </div>
      ${linha('Tempo médio/SAL (−20%)', a.media_min, base?.media_min, stAtv)}
      ${linha('Tempo SALs descartadas (−30%)', a.tempo_total_descartadas, base?.tempo_total_descartadas, stDsc)}
      <div class="sal-card__detalhe">
        <button class="btn btn--sm btn--outline" onclick="AppAcompSals.toggleTabela('${a.slug}')">▾ Detalhe mensal</button>
      </div>
      <div id="sal-tabela-${a.slug}" class="sal-tabela" style="display:none">${renderTabela(a)}</div>
    </div>`;
  }

  function renderTabela(a) {
    return `<table class="eq-tabela" style="margin-top:.75rem;font-size:.75rem">
      <thead><tr><th>Mês</th><th>SALs</th><th>Média/SAL</th><th>Descartadas</th><th>Tempo Desc.</th></tr></thead>
      <tbody>${MESES.map((mes,i) => {
        const m = i+1, av = a.mensal_ativas[m]||{tempo:0,qtd:0}, dc = a.mensal_descartadas[m]||{tempo:0,qtd:0};
        if (!av.qtd && !dc.qtd) return `<tr style="opacity:.35"><td>${mes}</td><td colspan="4">—</td></tr>`;
        return `<tr><td><strong>${mes}</strong></td><td>${av.qtd}</td><td>${fmtMin(av.qtd>0?Math.round(av.tempo/av.qtd):0)}</td><td>${dc.qtd}</td><td>${fmtMin(dc.tempo)}</td></tr>`;
      }).join('')}</tbody>
    </table>`;
  }

  let _dados = null, _detalhe = null, _ano = new Date().getFullYear();

  async function carregar(anoSel) {
    _ano = anoSel || _ano;
    setLoading(true);
    try {
      [_dados, _detalhe] = await Promise.all([
        fetch(`/api/acomp-sals/tempo-descarte?ano=${_ano}`).then(r => r.json()),
        fetch(`/api/acomp-sals/detalhe?ano=${_ano}`).then(r => r.json())
      ]);
      ativarAba(document.querySelector('.sal-aba--ativa')?.dataset.aba || 'resumo');
    } catch (e) { document.getElementById('sal-conteudo').innerHTML = `<p class="eq-sem-dados">Erro: ${e.message}</p>`; }
    setLoading(false);
  }

  function ativarAba(aba) {
    document.querySelectorAll('.sal-aba').forEach(b => b.classList.toggle('sal-aba--ativa', b.dataset.aba === aba));
    document.querySelectorAll('.sal-painel').forEach(p => p.style.display = p.dataset.painel === aba ? '' : 'none');
    if (aba === 'resumo') renderResumo();
    if (aba === 'acumulado' && _detalhe) AcompSalsAcumulado.renderizar(_detalhe.analistas);
    if (aba === 'funcionario' && _detalhe) AcompSalsFuncionario.renderControles(_detalhe.analistas);
  }

  function renderResumo() {
    if (!_dados) return;
    const el = document.getElementById('sal-conteudo');
    const baseMap = {};
    _dados.baseline.forEach(b => { baseMap[b.slug] = b; });
    const comDados = _dados.analistas.filter(a => a.total_psais > 0 || a.total_descartadas > 0);
    el.innerHTML = comDados.length
      ? comDados.map(a => renderCard(a, baseMap[a.slug])).join('')
      : '<p class="eq-sem-dados">Nenhum dado para o período.</p>';
  }

  function setLoading(show) {
    const el = document.getElementById('sal-conteudo');
    if (show) el.innerHTML = '<div class="loading"><div class="loading__spinner"></div><span>Consultando banco...</span></div>';
  }

  function toggleTabela(slug) {
    const el = document.getElementById(`sal-tabela-${slug}`);
    if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.sal-aba').forEach(btn => {
      btn.addEventListener('click', () => ativarAba(btn.dataset.aba));
    });
    const sel = document.getElementById('sal-ano');
    const btn = document.getElementById('sal-btn-consultar');
    if (btn) btn.addEventListener('click', () => carregar(Number(sel?.value)));
    carregar(_ano);
  });

  return { toggleTabela };
})();
