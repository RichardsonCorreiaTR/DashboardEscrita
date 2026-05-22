/**
 * equipes-coordenador.js - Visao consolidada por coordenador
 *
 * Exibe tabela com valores acumulados iguais ao totalizador individual.
 */

/* eslint-disable no-unused-vars */
const EquipesCoordenador = (() => {
  const MESES_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const MES_ATUAL = new Date().getMonth() + 1;

  // Colunas informativas que nao devem aparecer no painel
  const EXCLUIR_COLS = new Set(['tempo-medio-sal', 'controle-descartes', 'pct-descartes']);

  // Meta de referencia para cada meta (valor limite)
  const META_VALOR = {
    'indice-revisoes-sal': 0.50, 'indice-revisoes-ne': 0.50,
    'indice-revisoes-sail': 1.15, 'indice-revisoes-sam-imp': 0.80,
    'indice-revisoes-sam-esc': 0.50,
    'indice-retornos-sal': 1.00, 'indice-retornos-sail-sam': 1.50,
    'pontos-definicao': 80, 'tempo-trabalho-analise': 85,
    'tempo-trabalho-principal': 70
  };

  function indiceAcumulado(mensal, campoNum, campoDen, metaVal) {
    if (!mensal) return null;
    let num = 0, den = 0;
    for (let m = 1; m <= MES_ATUAL; m++) {
      const d = mensal[m];
      if (d && (d[campoDen] || d[campoNum])) {
        num += Number(d[campoNum]) || 0;
        den += Number(d[campoDen]) || 0;
      }
    }
    if (!den) return { txt: '0,00', cor: 'var(--verde)' };
    const val = Math.round((num / den) * 100) / 100;
    const cor = val <= metaVal ? 'var(--verde)' : 'var(--vermelho)';
    return { txt: val.toFixed(2).replace('.', ','), cor };
  }

  function tempoTrabalhoAcum(mensal, metaVal) {
    if (!mensal) return null;
    let tt = 0, te = 0;
    for (let m = 1; m <= MES_ATUAL; m++) {
      const d = mensal[m];
      if (d) { tt += d.trabalhoSai || 0; te += d.efetivo || 0; }
    }
    if (!te) return { txt: '0%', cor: 'var(--verde)' };
    const pct = Math.round(tt / te * 100);
    return { txt: pct + '%', cor: pct >= metaVal ? 'var(--verde)' : 'var(--vermelho)' };
  }

  function pontosAcum(mensal, metaId) {
    if (!mensal) return null;
    let soma = 0;
    for (let m = 1; m <= MES_ATUAL; m++) { soma += (mensal[m] && mensal[m].pontos) || 0; }
    const media = Math.round(soma / MES_ATUAL);
    if (metaId === 'pontos-atividade-principal') {
      let somaMeta = 0, count = 0;
      for (let m = 1; m <= MES_ATUAL; m++) {
        const d = mensal[m];
        if (d && d.pct_atividade != null) { somaMeta += d.meta_ajustada || 0; count++; }
      }
      const mediaMeta = count ? Math.round(somaMeta / count) : 0;
      const ok = media >= mediaMeta;
      return { txt: media + '/' + mediaMeta, cor: ok ? 'var(--verde)' : 'var(--vermelho)' };
    }
    return { txt: media + ' pts', cor: media >= (META_VALOR[metaId] || 80) ? 'var(--verde)' : 'var(--vermelho)' };
  }

  const ZERO_DEC = new Set(['indice-revisoes-sal','indice-revisoes-ne','indice-revisoes-sail',
    'indice-revisoes-sam-imp','indice-revisoes-sam-esc','indice-retornos-sal','indice-retornos-sail-sam']);

  function statusCelula(porMeta, metaId, mensal) {
    const zeroTxt = ZERO_DEC.has(metaId) ? '0,00' : '0';
    if (!porMeta || !(metaId in porMeta)) return { txt: zeroTxt, cor: 'var(--verde)' };
    const d = porMeta[metaId];
    if (!d || d.total === 0) return { txt: zeroTxt, cor: 'var(--verde)' };

    if (metaId.startsWith('indice-revisoes')) {
      const r = indiceAcumulado(mensal, 'total_revisoes', 'total_sais', META_VALOR[metaId]);
      if (r) return r;
    }
    if (metaId.startsWith('indice-retornos')) {
      const r = indiceAcumulado(mensal, 'total_retornos', 'total_psais', META_VALOR[metaId]);
      if (r) return r;
    }
    if (metaId === 'pontos-definicao' || metaId === 'pontos-atividade-principal') {
      const r = pontosAcum(mensal, metaId);
      if (r) return r;
    }
    if (metaId === 'pontos-gerados') {
      if (!mensal) return { txt: '0 pts', cor: 'var(--verde)' };
      let soma = 0;
      for (let m = 1; m <= MES_ATUAL; m++) soma += (mensal[m] && mensal[m].pontos) || 0;
      const media = Math.round(soma / MES_ATUAL);
      return { txt: media + ' pts', cor: 'var(--verde)' };
    }
    if (metaId.startsWith('tempo-trabalho')) {
      const r = tempoTrabalhoAcum(mensal, META_VALOR[metaId] || 70);
      if (r) return r;
    }

    const pct = Math.round((d.atingidas / d.total) * 100);
    const cor = pct >= 80 ? 'var(--verde)' : pct >= 50 ? 'var(--amarelo)' : 'var(--vermelho)';
    return { txt: d.atingidas + '/' + d.total, cor };
  }

  function buildColunas(membros) {
    const todos = new Set();
    membros.forEach(m => {
      if (m.totalizador && m.totalizador.por_meta)
        Object.keys(m.totalizador.por_meta).forEach(id => { if (!EXCLUIR_COLS.has(id)) todos.add(id); });
    });
    const LABELS = typeof MetasConfig !== 'undefined' ? MetasConfig.LABELS : {};
    return Array.from(todos).map(id => ({
      id,
      label: (LABELS[id] || id).replace('indice-revisoes-', 'Rev. ').replace('indice-retornos-', 'Ret. ')
    }));
  }

  function renderTabela(membros) {
    if (!membros.length) return '<p class="eq-sem-dados">Nenhum membro encontrado.</p>';
    const colunas = buildColunas(membros);
    const th = colunas.map(c =>
      '<th title="' + c.id + '" style="font-size:0.6rem;padding:3px 4px;text-align:center;max-width:60px;' +
      'word-break:break-word;line-height:1.2;text-transform:uppercase;letter-spacing:0.02em">' + c.label + '</th>'
    ).join('');
    const linhas = membros.map(m => {
      const tot = m.totalizador || {};
      const por = tot.por_meta || {};
      const metas = m.metas || {};
      const pctGeral = tot.total > 0 ? Math.round((tot.atingidas / tot.total) * 100) : 0;
      const corGeral = pctGeral >= 80 ? 'var(--verde)' : pctGeral >= 50 ? 'var(--amarelo)' : 'var(--vermelho)';
      const cells = colunas.map(c => {
        const mensal = metas[c.id] ? metas[c.id].mensal : null;
        const s = statusCelula(por, c.id, mensal);
        return '<td style="text-align:center;color:' + s.cor + ';font-weight:600;font-size:0.72rem;padding:4px 2px">' + s.txt + '</td>';
      }).join('');
      return '<tr>' +
        '<td style="white-space:nowrap;padding:5px 8px">' +
          '<a href="/equipes.html?colaborador=' + m.slug + '" style="color:inherit;text-decoration:none;font-weight:600;font-size:0.8rem">' + m.apelido + '</a>' +
          '<br><span style="font-size:0.62rem;opacity:0.6">' + (m.cargo || m.senioridade) + '</span>' +
        '</td>' +
        cells + '</tr>';
    });
    return '<table class="eq-tabela" style="width:100%;font-size:0.72rem;border-collapse:collapse">' +
      '<thead><tr style="background:var(--card);position:sticky;top:0">' +
        '<th style="text-align:left;padding:6px 8px;font-size:0.7rem">Membro</th>' +
        th + '</tr></thead><tbody>' + linhas.join('') + '</tbody></table>';
  }

  async function render(coordSlug, container) {
    container.innerHTML = '<div class="eq-sem-dados">Carregando...</div>';
    try {
      const resp = await fetch('/api/metas-equipe?fonte=cache');
      const json = await resp.json();
      await MetasConfig.carregar();
      const coords = MetasConfig.coordenadores();
      const coord = coords.find(c => c.slug === coordSlug);
      const todos = MetasConfig.colaboradores();
      const membros = (json.analistas || [])
        .filter(a => todos.find(t => t.slug === a.slug && t['coordenador-slug'] === coordSlug))
        .map(a => {
          const cfg = todos.find(t => t.slug === a.slug) || {};
          return { ...a, apelido: cfg.apelido || cfg.nome || a.slug, cargo: cfg.cargo || cfg.senioridade, senioridade: cfg.senioridade };
        });
      const esp = membros.filter(m => m.senioridade === 'especialista');
      const ana = membros.filter(m => m.senioridade !== 'especialista');
      const secao = (titulo, lista) => !lista.length ? '' :
        '<div style="margin-bottom:2rem">' +
          '<h4 style="color:var(--accent);margin-bottom:0.75rem;font-size:0.85rem;text-transform:uppercase">' + titulo + '</h4>' +
          renderTabela(lista) + '</div>';
      container.innerHTML =
        '<div style="margin-bottom:1.5rem">' +
          '<h2 style="font-size:1.1rem;margin:0">\uD83D\uDCCB Painel do Coordenador \u2014 ' +
          (coord ? coord.apelido || coord.nome : coordSlug) + '</h2>' +
          '<p style="font-size:0.8rem;opacity:0.6;margin:4px 0 0">M\u00eas atual: ' +
          MESES_LABEL[MES_ATUAL - 1] + ' / ' + new Date().getFullYear() + ' \u2014 ' +
          membros.length + ' colaboradores</p></div>' +
        secao('Especialistas', esp) + secao('Analistas', ana);
    } catch (e) {
      container.innerHTML = '<p class="eq-sem-dados">Erro ao carregar dados: ' + e.message + '</p>';
    }
  }

  return { render };
})();
