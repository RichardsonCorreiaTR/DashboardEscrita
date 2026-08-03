/**
 * app-analista.js - Pagina de metas individual (portal analista)
 */
/* eslint-disable no-unused-vars */
const AppAnalista = (() => {
  let slugAtual = '';
  let fonteAtual = 'cache';
  const ANO_PADRAO = new Date().getFullYear();

  function getAno() {
    return Number(localStorage.getItem('eq-ano-selecionado')) || ANO_PADRAO;
  }

  function initAno() {
    const sel = document.getElementById('eq-ano-select');
    if (!sel) return;
    for (let a = ANO_PADRAO; a >= ANO_PADRAO - 2; a--) {
      const opt = document.createElement('option');
      opt.value = a; opt.textContent = a;
      if (a === getAno()) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => {
      localStorage.setItem('eq-ano-selecionado', sel.value);
      window.location.reload();
    });
  }

  function renderMetaInfo(m) {
    const dir = m.dir === 'menor-melhor' ? ' (quanto menor, melhor)' : '';
    const bl = (l, v) => '<div class="eq-meta__bloco"><span class="eq-meta__bloco-label">' + l +
      '</span><span class="eq-meta__bloco-valor">' + v + '</span></div>';
    return '<div class="eq-meta"><h3 class="eq-meta__titulo">' + m.desc + '</h3>' +
      (m.det ? '<p class="eq-meta__detalhe">' + m.det + '</p>' : '') +
      '<div class="eq-meta__info">' + bl('Valor esperado', MetasConfig.formatarValor(m.valor, m.un) + dir) +
      bl('Fonte', m.fonte || 'Agregado') + '</div>' + EquipesMensal.renderExplicacao(m.id) + '</div>';
  }

  function ativarAbas(container) {
    container.querySelectorAll('.aba').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = btn.dataset.idx;
        container.querySelectorAll('.aba').forEach(b => b.classList.remove('aba--ativa'));
        container.querySelectorAll('.aba-conteudo').forEach(c => c.classList.remove('aba-conteudo--ativo'));
        btn.classList.add('aba--ativa');
        container.querySelector('.aba-conteudo[data-idx="' + idx + '"]').classList.add('aba-conteudo--ativo');
      });
    });
  }

  function ativarDetalhe(container) {
    container.querySelectorAll('.eq-btn-detalhe').forEach(btn => {
      btn.addEventListener('click', async () => {
        const meta = btn.dataset.meta, mes = btn.dataset.mes;
        const det = container.querySelector('[data-detalhe-meta="' + meta + '"]');
        if (!det) return;
        det.innerHTML = '<div class="eq-sem-dados">Carregando detalhes...</div>';
        try {
          const url = '/api/metas-equipe/' + slugAtual + '/detalhe/' + meta + '/' + mes + '?ano=' + getAno();
          let json = await (await fetch(url + '&fonte=cache')).json();
          if (json.erro || !json.registros) json = await (await fetch(url)).json();
          const colab = MetasConfig.colaboradores()[0];
          det.innerHTML = EquipesDetalhe.render(meta, parseInt(mes, 10), json.registros, json.planilha, colab.senioridade);
        } catch (_) { det.innerHTML = '<div class="eq-sem-dados">Erro ao carregar</div>'; }
      });
    });
  }

  function mostrarFonte(json) {
    const el = document.getElementById('eq-fonte-info');
    const btn = document.getElementById('btn-atualizar');
    if (btn) { btn.textContent = 'Atualizar'; btn.disabled = false; }
    fonteAtual = 'cache';
    if (!el) return;
    el.hidden = false;
    const fonte = json._fonte || 'cache';
    const ts = json._atualizado_em ? new Date(json._atualizado_em).toLocaleString('pt-BR') : '-';
    const aviso = json._aviso ? ' \u2014 ' + json._aviso : '';
    el.className = 'fonte-info fonte-info--' + fonte;
    el.innerHTML = fonte === 'cache'
      ? 'Cache salvo em ' + ts + aviso
      : '\u2713 Atualizado via ODBC em ' + ts;
  }

  async function carregar(colab, metas, main) {
    const qs = (fonteAtual === 'cache' ? '?fonte=cache' : '?') + '&ano=' + getAno();
    const json = await (await fetch('/api/metas-equipe/' + colab.slug + qs)).json();
    if (json.erro) throw new Error(json.erro);
    mostrarFonte(json);
    const totEl = document.getElementById('eq-totalizador');
    const valorMap = {};
    metas.forEach(m => { valorMap[m.id] = m.valor; });
    if (totEl && json.totalizador) totEl.innerHTML = EquipesMensal.renderTotalizador(json.totalizador, json.metas, valorMap);
    metas.forEach(m => {
      const node = main.querySelector('[data-meta-id="' + m.id + '"]');
      if (!node) return;
      node.innerHTML = json.metas[m.id]
        ? EquipesMensal.renderTabela(m.id, json.metas[m.id], m.valor)
        : '<div class="eq-sem-dados">Sem dados</div>';
    });
    ativarDetalhe(main);
    EquipesNeDefinicao.injetarTotalizador(colab.slug, getAno());
    if (typeof EquipesConclusaoPontos !== 'undefined') EquipesConclusaoPontos.renderizar(main, json.metas);
  }

  function recarregar(colab, metas, main) {
    metas.forEach(m => {
      const el = main.querySelector('[data-meta-id="' + m.id + '"]');
      if (el) el.innerHTML = '<div class="eq-sem-dados">Carregando...</div>';
    });
    const tot = document.getElementById('eq-totalizador');
    if (tot) tot.innerHTML = '<div class="eq-sem-dados">Carregando...</div>';
    carregar(colab, metas, main).catch(err => console.warn('[analista]', err.message));
  }

  function ativarAtualizar(colab, metas, main) {
    const btn = document.getElementById('btn-atualizar');
    if (!btn) return;
    btn.addEventListener('click', () => {
      fonteAtual = 'odbc';
      btn.textContent = 'Atualizando...';
      btn.disabled = true;
      recarregar(colab, metas, main);
    });
  }

  function render(colab) {
    slugAtual = colab.slug;
    document.getElementById('page-title').textContent = 'Minhas Metas — ' + colab.apelido;
    document.querySelector('.header__subtitle').textContent = colab.cargo + ' — ' + getAno();
    const el = document.getElementById('header-usuario');
    if (el) el.textContent = colab.apelido;
    const metas = MetasConfig.obterMetas(colab);
    const agrupadas = MetasConfig.agruparMetas(metas);
    const main = document.getElementById('equipes-main');
    main.innerHTML =
      '<div id="eq-totalizador"><div class="eq-sem-dados">Carregando...</div></div>' +
      '<div class="eq-abas-container"><div class="abas">' +
      MetasConfig.buildGruposVisuais(agrupadas).map(g => {
        const tabs = g.items.map(({ m, i, label }) =>
          '<button class="aba' + (i === 0 ? ' aba--ativa' : '') + '" data-idx="' + i + '">' + label + '</button>'
        ).join('');
        return g.titulo
          ? '<div class="aba-grupo"><span class="aba-grupo__titulo">' + g.titulo + '</span><div class="aba-grupo__abas">' + tabs + '</div></div>'
          : tabs;
      }).join('') +
      '</div>' + agrupadas.map((m, i) =>
        '<div class="aba-conteudo' + (i === 0 ? ' aba-conteudo--ativo' : '') + '" data-idx="' + i + '">' +
        (m.isGrupo && m.tipo === 'revisoes' ? MetasConfig.renderConteudoGrupoRevisoes(m.subIds)
          : m.isGrupo && m.tipo === 'retornos' ? MetasConfig.renderConteudoGrupoRetornos(m.subIds)
          : m.isGrupo && m.tipo === 'geracao' ? MetasConfig.renderConteudoGrupoGeracao(m.subIds)
          : m.id === 'ne-definicao'
            ? EquipesNeDefinicao.renderInfo() + '<div class="eq-meta__dados" data-meta-id="ne-definicao"><div class="eq-sem-dados">Carregando...</div></div>'
          : m.id === 'conclusao-pontos'
            ? EquipesConclusaoPontos.renderInfo() + '<div class="eq-meta__dados" data-meta-id="conclusao-pontos"><div class="eq-sem-dados">Carregando...</div></div>'
          : renderMetaInfo(m) + '<div class="eq-meta__dados" data-meta-id="' + m.id + '"><div class="eq-sem-dados">Carregando...</div></div>')
        + '</div>'
      ).join('') + '</div>';
    ativarAbas(main);
    ativarAtualizar(colab, metas, main);
    EquipesNeDefinicao.carregar(colab.slug, getAno(), main);
    carregar(colab, metas, main).catch(err => console.warn('[analista]', err.message));
  }

  async function init() {
    const me = await fetch('/auth/me').then(r => r.json()).catch(() => ({ logado: false }));
    if (!me.logado) { window.location.href = '/login.html'; return; }
    initAno();
    await MetasConfig.carregar();
    const colab = MetasConfig.colaboradores().find(c => c.slug === me.slug);
    document.getElementById('equipes-loading').hidden = true;
    if (!colab) {
      document.getElementById('equipes-main').innerHTML = '<p class="eq-sem-dados">Perfil n\u00e3o encontrado.</p>';
      return;
    }
    render(colab);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
