/* globals */
const DiretrizesResumo = (() => {
  const CARD_CONFIG = {
    'saldo-ne': {
      titulo: 'Saldo NE',
      formato: r => String(r.valor),
      subtitulo: r => 'meta: ' + r.meta,
      extra: r => r.detalhes.variacao !== null
        ? (r.detalhes.variacao >= 0 ? '+' : '') + r.detalhes.variacao + ' vs anterior'
        : '',
      tooltip: 'Total de NEs abertas no periodo da versao'
    },
    'ne-95-dias': {
      titulo: 'NE > 95 Dias',
      formato: r => String(r.valor),
      subtitulo: r => 'meta: ' + r.meta,
      extra: () => '',
      tooltip: 'NEs abertas ha mais de 95 dias corridos'
    },
    'criticas-graves-5d': {
      titulo: 'Criticas/Graves 5d',
      formato: r => r.valor + '%',
      subtitulo: r => 'meta: ' + r.meta + '%',
      extra: r => {
        const ab = r.detalhes.total_abertas || (r.detalhes.abertas_agora || []).length;
        const prazo = r.detalhes.dentro_5d + '/' + r.detalhes.total_periodo + ' no prazo';
        return ab > 0 ? prazo + ' | ' + ab + ' abertas' : prazo;
      },
      tooltip: 'Percentual de NEs criticas/graves corrigidas em ate 5 dias'
    },
    'tempo-correcao-ne': {
      titulo: 'Tempo Correcao',
      formato: r => r.valor + '%',
      subtitulo: r => 'meta: ' + r.meta + '%',
      extra: r => r.detalhes.projecao ? 'real: ' + r.detalhes.pct_real + '%' : '',
      tooltip: 'Percentual de NEs corrigidas dentro do tempo-meta'
    },
    'entrada-ne': {
      titulo: 'Entradas NE',
      formato: r => String(r.valor),
      subtitulo: r => r.detalhes.entradas + ' ent | ' + r.detalhes.liberacoes + ' lib | ' + r.detalhes.descartes + ' desc',
      extra: r => 'saldo: ' + (r.detalhes.variacao_saldo >= 0 ? '+' : '') + r.detalhes.variacao_saldo,
      tooltip: 'Entradas brutas de NE na versao atual'
    }
  };

  function contarStatus(resultados) {
    let verde = 0, amarelo = 0, vermelho = 0;
    const ids = Object.keys(CARD_CONFIG);
    for (const id of ids) {
      const r = resultados[id];
      if (!r || r.status === 'erro') continue;
      if (r.status === 'verde') verde++;
      else if (r.status === 'amarelo') amarelo++;
      else vermelho++;
    }
    return { verde, amarelo, vermelho, total: verde + amarelo + vermelho };
  }

  function renderHeroResumo(el, resultados) {
    const s = contarStatus(resultados);
    let cls = 'badge--green', label = 'Todos dentro da meta';
    if (s.vermelho > 0) {
      cls = 'badge--red';
      label = s.vermelho + ' fora da meta';
    } else if (s.amarelo > 0) {
      cls = 'badge--yellow';
      label = s.amarelo + ' em atencao';
    }
    const pct = s.total > 0 ? Math.round((s.verde / s.total) * 100) : 0;
    const barCls = s.vermelho > 0 ? 'red' : s.amarelo > 0 ? 'yellow' : 'green';

    el.innerHTML =
      '<div class="hero-row">' +
        '<div class="hero-group">' +
          '<span class="hero-group__label">No prazo</span>' +
          '<span class="hero-group__value">' + s.verde +
            '<span class="hero-group__unit"> de ' + s.total + '</span></span>' +
        '</div>' +
        '<span class="hero-sep">|</span>' +
        '<div class="hero-group hero-right">' +
          '<span class="badge ' + cls + '">' + label + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="progress-wrap">' +
        '<div class="progress-bar progress-bar--' + barCls + '">' +
          '<div class="progress-bar__fill" style="width:' + pct + '%"></div>' +
        '</div>' +
        '<div class="progress-labels">' +
          '<span>' + pct + '% dos indicadores no prazo</span>' +
          (s.vermelho > 0 ? '<span style="color:var(--vermelho)">' + s.vermelho + ' critico(s)</span>' : '') +
        '</div>' +
      '</div>';
  }

  function gerarLeitura(resultados) {
    const partes = [];
    const saldo = resultados['saldo-ne'];
    if (saldo && saldo.status !== 'erro') {
      const dir = saldo.valor <= saldo.meta ? 'dentro da meta' : '<strong>acima da meta</strong>';
      partes.push('Saldo NE em <strong>' + saldo.valor + '</strong> (meta ' + saldo.meta + ') \u2014 ' + dir);
    }
    const ne95 = resultados['ne-95-dias'];
    if (ne95 && ne95.status !== 'erro') {
      const ok = ne95.valor <= ne95.meta;
      partes.push('<strong>' + ne95.valor + '</strong> NE(s) acima de 95 dias (meta ' + ne95.meta + ')' +
        (ok ? '' : ' \u2014 <strong>atencao</strong>'));
    }
    const cg = resultados['criticas-graves-5d'];
    if (cg && cg.status !== 'erro') {
      const ab = cg.detalhes.total_abertas || (cg.detalhes.abertas_agora || []).length;
      partes.push('Criticas/Graves: <strong>' + cg.valor + '%</strong> no prazo de 5 dias' +
        (ab > 0 ? ', ' + ab + ' aberta(s)' : ''));
    }
    const tc = resultados['tempo-correcao-ne'];
    if (tc && tc.status !== 'erro') {
      partes.push('Tempo de correcao: <strong>' + tc.valor + '%</strong> (meta ' + tc.meta + '%)');
    }
    const en = resultados['entrada-ne'];
    if (en && en.status !== 'erro') {
      const d = en.detalhes;
      partes.push('Entradas: ' + d.entradas + ' | Liberacoes: ' + d.liberacoes + ' | Descartes: ' + d.descartes);
    }
    if (partes.length === 0) return '';
    return partes.join('. ') + '.';
  }

  return { CARD_CONFIG, contarStatus, renderHeroResumo, gerarLeitura };
})();
