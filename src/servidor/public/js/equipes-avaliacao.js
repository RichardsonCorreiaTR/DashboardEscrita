/**
 * equipes-avaliacao.js - Secao "Avaliacao equipe" com filtros de periodo e colaborador
 */
/* globals EquipesAvaliacaoCalc, EquipesAvaliacaoMeses, EquipesAvaliacaoCharts */
/* eslint-disable no-unused-vars */
const EquipesAvaliacao = (() => {
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const LS_PERIODO = 'eq-aval-periodo';
  let cacheLista = [];
  let rawMembros = [];
  let anoRef = new Date().getFullYear();

  function tendenciaTxt(t) {
    if (t === 'ascendente') return { txt: 'Ascendente', cor: 'var(--verde)' };
    if (t === 'descendente') return { txt: 'Descendente', cor: 'var(--vermelho)' };
    return { txt: 'Est\u00e1vel', cor: 'var(--amarelo)' };
  }

  function corNota(v) {
    if (v == null) return 'var(--cor-texto-sec)';
    if (v >= 80) return 'var(--verde)';
    if (v >= 50) return 'var(--amarelo)';
    return 'var(--vermelho)';
  }

  function periodoAtual() {
    const sel = document.getElementById('eq-aval-periodo');
    return (sel && sel.value) || localStorage.getItem(LS_PERIODO) || 'anual';
  }

  function recalcular() {
    cacheLista = rawMembros.map(m => EquipesAvaliacaoCalc.avaliarMembro(m, { periodo: periodoAtual(), ano: anoRef }));
  }

  function legendaPeriodo() {
    const a = cacheLista[0];
    const lbl = a ? a.periodoLabel : EquipesAvaliacaoCalc.labelPeriodo(periodoAtual());
    return lbl + ' / ' + anoRef + ' \u2014 somente meses fechados com dados';
  }

  function destruirCharts() { EquipesAvaliacaoCharts.destruir(); }

  function btnMeses(slug) {
    return '<button type="button" class="btn btn--outline eq-aval-btn-meses" data-slug="' + slug + '" title="Ver detalhamento m\u00eas a m\u00eas">Detalhamento</button>';
  }

  function bindBtnMeses(root) {
    (root || document).querySelectorAll('.eq-aval-btn-meses').forEach(btn => {
      btn.addEventListener('click', () => {
        const a = cacheLista.find(x => x.slug === btn.dataset.slug);
        if (a) EquipesAvaliacaoMeses.abrir(a);
      });
    });
  }

  function explicacao(a) {
    const t = tendenciaTxt(a.tendencia);
    const mesesTxt = a.mesesComDados ? a.mesesComDados + ' m\u00eas(es) com dados' : 'sem dados no per\u00edodo';
    const formula = a.esp
      ? 'SAIs geradas (33,33%), tempo de gera\u00e7\u00e3o (33,33%) e revis\u00f5es (33,34%).'
      : 'pontos (50%), revis\u00f5es (25%) e retornos (25%). Nos pontos, usa a melhor faixa entre ' +
        '<em>Defini\u00e7\u00e3o + PSAIs</em> e <em>Atividade + PSAIs</em>.';
    return '<div class="eq-aval-detalhe__texto">' +
      '<p><strong>Como ler:</strong> Nota m\u00e9dia do per\u00edodo (' + a.periodoLabel + ' / ' + a.ano + '). Combina ' + formula + '</p>' +
      '<p><strong>' + a.apelido + '</strong> — m\u00e9dia <span style="color:' + corNota(a.compAtual) + ';font-weight:700">' +
      (a.compAtual != null ? a.compAtual + '%' : '--') + '</span> (' + mesesTxt + '), tend\u00eancia ' +
      '<span style="color:' + t.cor + '">' + t.txt + '</span>. Faixa de pontos: <strong>' + (a.viaPontos || '\u2014') + '</strong>.</p>' +
      (a.destaque ? '<p>Destaque em <strong>' + a.destaque.label + '</strong> (' + a.destaque.val + '%).' : '') +
      (a.atencao && a.atencao.label !== a.destaque?.label
        ? ' Ponto de aten\u00e7\u00e3o: <strong>' + a.atencao.label + '</strong> (' + a.atencao.val + '%).' : '') +
      '</div>';
  }

  function renderDetalhe(a) {
    const t = tendenciaTxt(a.tendencia);
    const cont = document.getElementById('eq-aval-conteudo');
    if (!cont) return;
    destruirCharts();
    if (!a.mesesComDados) {
      cont.innerHTML = '<p class="eq-sem-dados">Sem dados fechados para ' + a.apelido + ' em ' + a.periodoLabel + ' / ' + a.ano + '.</p>';
      return;
    }
    cont.innerHTML =
      '<div class="eq-aval-detalhe">' +
      '<div class="eq-aval-detalhe__header">' +
        '<div><h4 class="eq-aval-detalhe__nome">' + a.apelido + '</h4>' +
        '<span class="eq-aval-detalhe__cargo">' + (a.cargo || '') + ' \u2014 ' + a.periodoLabel + ' / ' + a.ano + '</span></div>' +
        '<div class="eq-aval-detalhe__nota" style="color:' + corNota(a.compAtual) + '">' +
          (a.compAtual != null ? a.compAtual + '%' : '--') + '</div></div>' +
      '<span class="eq-aval-detalhe__tend" style="color:' + t.cor + '">' + t.txt + '</span>' +
      explicacao(a) +
      '<div class="eq-aval-detalhe__acoes">' + btnMeses(a.slug) + '</div>' +
      '<div class="eq-aval-detalhe__charts">' +
        '<div class="eq-aval-detalhe__chart"><span class="eq-aval-detalhe__chart-label">Pilares (m\u00e9dia do per\u00edodo)</span><canvas id="eq-aval-bar-one"></canvas></div>' +
        '<div class="eq-aval-detalhe__chart"><span class="eq-aval-detalhe__chart-label">Evolu\u00e7\u00e3o mensal</span><canvas id="eq-aval-lin-one"></canvas></div></div>' +
      '<a href="/equipes.html?colaborador=' + a.slug + '" class="btn btn--outline eq-aval-detalhe__link">Ver metas detalhadas</a></div>';
    bindBtnMeses(cont);
    requestAnimationFrame(() => {
      EquipesAvaliacaoCharts.bar('eq-aval-bar-one', (a.pilares || []).map(p => p.label.replace(/ \(\d+%\)/, '')), (a.pilares || []).map(p => p.val));
      const ok = a.serie.filter(s => s.comp != null);
      EquipesAvaliacaoCharts.linha('eq-aval-lin-one', ok.map(s => MESES[s.mes - 1]), ok.map(s => s.comp));
    });
  }

  function renderTodos(lista) {
    const cont = document.getElementById('eq-aval-conteudo');
    if (!cont) return;
    destruirCharts();
    const comDados = lista.filter(a => a.mesesComDados > 0);
    if (!comDados.length) {
      cont.innerHTML = '<p class="eq-sem-dados">Sem dados fechados para o per\u00edodo selecionado (' + legendaPeriodo() + ').</p>';
      return;
    }
    const ordenada = comDados.slice().sort((a, b) => (b.compAtual || 0) - (a.compAtual || 0));
    const linhas = ordenada.map(a => {
      const t = tendenciaTxt(a.tendencia);
      return '<tr><td><a href="#" class="eq-aval-link" data-slug="' + a.slug + '">' + a.apelido + '</a></td>' +
        '<td style="text-align:center;font-weight:700;color:' + corNota(a.compAtual) + '">' +
        (a.compAtual != null ? a.compAtual + '%' : '--') + '</td>' +
        '<td style="text-align:center;color:' + t.cor + '">' + t.txt + '</td>' +
        '<td style="font-size:0.72rem">' + (a.destaque ? a.destaque.label.replace(/ \(\d+%\)/, '') : '\u2014') + '</td>' +
        '<td style="font-size:0.72rem">' + (a.atencao ? a.atencao.label.replace(/ \(\d+%\)/, '') : '\u2014') + '</td>' +
        '<td style="text-align:center">' + btnMeses(a.slug) + '</td></tr>';
    }).join('');
    cont.innerHTML =
      '<p class="eq-aval__legenda">' + legendaPeriodo() + '. Clique no nome para ver a avalia\u00e7\u00e3o individual.</p>' +
      '<div class="eq-aval-detalhe__chart eq-aval-detalhe__chart--wide"><span class="eq-aval-detalhe__chart-label">Nota m\u00e9dia por colaborador</span><canvas id="eq-aval-bar-todos"></canvas></div>' +
      '<table class="eq-tabela eq-aval-tabela"><thead><tr>' +
      '<th>Membro</th><th>Nota m\u00e9dia</th><th>Tend\u00eancia</th><th>Destaque</th><th>Aten\u00e7\u00e3o</th><th></th></tr></thead><tbody>' +
      linhas + '</tbody></table>';
    cont.querySelectorAll('.eq-aval-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const sel = document.getElementById('eq-aval-select');
        if (sel) { sel.value = link.dataset.slug; renderSelecao(link.dataset.slug); }
      });
    });
    bindBtnMeses(cont);
    requestAnimationFrame(() => {
      EquipesAvaliacaoCharts.bar('eq-aval-bar-todos', ordenada.map(a => a.apelido.split(' ')[0]), ordenada.map(a => a.compAtual || 0));
    });
  }

  function renderSelecao(slug) {
    if (!slug || slug === '__todos__') renderTodos(cacheLista);
    else { const a = cacheLista.find(x => x.slug === slug); if (a) renderDetalhe(a); }
  }

  function onFiltroChange() {
    localStorage.setItem(LS_PERIODO, periodoAtual());
    recalcular();
    const sel = document.getElementById('eq-aval-select');
    renderSelecao(sel ? sel.value : '__todos__');
  }

  function init(membros, container, ano) {
    if (!container || !membros.length) return;
    rawMembros = membros;
    anoRef = ano || new Date().getFullYear();
    const periodoSalvo = localStorage.getItem(LS_PERIODO) || 'anual';
    recalcular();
    const optsColab = '<option value="__todos__">Todos os colaboradores</option>' +
      cacheLista.slice().sort((a, b) => a.apelido.localeCompare(b.apelido, 'pt-BR'))
        .map(a => '<option value="' + a.slug + '">' + a.apelido + '</option>').join('');
    container.innerHTML =
      '<section class="eq-aval-secao"><div class="eq-aval-secao__head">' +
        '<h3 class="eq-aval-secao__titulo">Avalia\u00e7\u00e3o equipe</h3>' +
        '<div class="eq-aval-secao__filtros">' +
          '<label class="eq-aval-secao__filtro">Per\u00edodo' +
            '<select id="eq-aval-periodo" class="eq-aval-select">' +
              '<option value="s1"' + (periodoSalvo === 's1' ? ' selected' : '') + '>1\u00ba semestre</option>' +
              '<option value="s2"' + (periodoSalvo === 's2' ? ' selected' : '') + '>2\u00ba semestre</option>' +
              '<option value="anual"' + (periodoSalvo === 'anual' ? ' selected' : '') + '>Anual</option>' +
            '</select></label>' +
          '<label class="eq-aval-secao__filtro">Colaborador' +
            '<select id="eq-aval-select" class="eq-aval-select">' + optsColab + '</select></label>' +
        '</div></div>' +
      '<div id="eq-aval-conteudo" class="eq-aval-secao__body"></div></section>';
    document.getElementById('eq-aval-periodo').addEventListener('change', onFiltroChange);
    document.getElementById('eq-aval-select').addEventListener('change', e => renderSelecao(e.target.value));
    renderTodos(cacheLista);
  }

  return { init };
})();
