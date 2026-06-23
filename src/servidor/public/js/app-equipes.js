/**
 * app-equipes.js - Pagina de metas por colaborador
 *
 * Depende de format-utils.js, metas-config.js, equipes-mensal.js e equipes-detalhe.js.
 * Suporta toggle ODBC / Cache (mesma logica das diretrizes).
 */

/* eslint-disable no-unused-vars */
const AppEquipes = (() => {
  const { LABELS } = MetasConfig;
  let slugAtual = '';
  let fonteAtual = 'cache';

  async function init() {
    // Verificar sessao
    const me = await fetch('/auth/me').then(r => r.json()).catch(() => ({ logado: false }));
    if (!me.logado) { window.location.href = '/login.html'; return; }

    // Exibir nome do usuario no header
    const el = document.getElementById('header-usuario');
    if (el) el.textContent = me.usuario.charAt(0).toUpperCase() + me.usuario.slice(1);

    // Analistas so podem ver seus proprios dados
    const params = new URLSearchParams(window.location.search);
    const slugParam = params.get('colaborador');
    if (me.papel === 'analista' && slugParam && slugParam !== me.slug) {
      window.location.href = '/equipes.html?colaborador=' + me.slug;
      return;
    }

    await MetasConfig.carregar();
    slugAtual = slugParam || '';
    const coordParam = params.get('coord');
    document.getElementById('equipes-loading').hidden = true;
    if (coordParam) {
      Nav.filtrarNavEquipes(coordParam);
      const main = document.getElementById('equipes-main');
      document.querySelector('.header__title').textContent = 'Metas da Equipe';
      document.querySelector('.header__subtitle').textContent = 'Escrita Fiscal — Painel do Coordenador';
      // Exibir nome do coordenador visualizado no header
      const coords = MetasConfig.coordenadores ? MetasConfig.coordenadores() : [];
      const coordVisto = coords.find(c => c.slug === coordParam);
      const nomeCoord = coordVisto ? (coordVisto.apelido || coordVisto.nome) : coordParam;
      if (el) el.textContent = nomeCoord.charAt(0).toUpperCase() + nomeCoord.slice(1);
      EquipesCoordenador.render(coordParam, main);
      return;
    }
    const colab = MetasConfig.colaboradores().find(c => c.slug === slugAtual);
    if (!colab) { renderLista(); return; }
    renderColaborador(colab);
    ativarToggle();
  }

  function ativarToggle() {
    const btnAtualizar = document.getElementById('btn-atualizar');
    if (!btnAtualizar) return;
    btnAtualizar.addEventListener('click', () => {
      fonteAtual = 'odbc';
      btnAtualizar.textContent = 'Atualizando...';
      btnAtualizar.disabled = true;
      recarregar();
    });
  }

  function recarregar() {
    const colab = MetasConfig.colaboradores().find(c => c.slug === slugAtual);
    if (!colab) return;
    const main = document.getElementById('equipes-main');
    const metas = MetasConfig.obterMetas(colab);
    metas.forEach(m => {
      const el = main.querySelector('[data-meta-id="' + m.id + '"]');
      if (el) el.innerHTML = '<div class="eq-sem-dados">Carregando...</div>';
    });
    const tot = document.getElementById('eq-totalizador');
    if (tot) tot.innerHTML = '<div class="eq-sem-dados">Carregando...</div>';
    carregarDados(colab.slug, metas, main);
  }

  let coordSelecionado = localStorage.getItem('eq-coord-ativo') || null;

  function renderLista() {
    const btnAt = document.getElementById('btn-atualizar');
    if (btnAt) btnAt.hidden = true;
    document.querySelector('.header__title').textContent = 'Metas da Equipe';
    document.querySelector('.header__subtitle').textContent = 'Escrita Fiscal - Selecione um colaborador';
    const coords = MetasConfig.coordenadores();
    if (!coordSelecionado && coords.length > 0) coordSelecionado = coords[0].slug;
    const main = document.getElementById('equipes-main');
    main.innerHTML = renderSeletorCoord(coords) + '<section class="hub-grid" id="hub-grid"></section>';
    renderCards();
    main.querySelectorAll('.eq-coord-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        coordSelecionado = btn.dataset.slug;
        main.querySelectorAll('.eq-coord-btn').forEach(b => b.classList.remove('eq-coord-btn--ativo'));
        btn.classList.add('eq-coord-btn--ativo');
        renderCards();
        Nav.filtrarNavEquipes(coordSelecionado);
      });
    });
  }

  function renderSeletorCoord(coords) {
    const btns = coords.map(c =>
      '<button class="eq-coord-btn' + (c.slug === coordSelecionado ? ' eq-coord-btn--ativo' : '') +
      '" data-slug="' + c.slug + '">' + c.nome + '</button>'
    ).join('');
    return '<div class="eq-coord-bar"><span class="eq-coord-bar__label">Coordenador</span>' + btns + '</div>';
  }

  function renderCards() {
    const grid = document.getElementById('hub-grid');
    if (!grid) return;
    const colabs = MetasConfig.colaboradores().filter(c => c['coordenador-slug'] === coordSelecionado);
    if (!colabs.length) {
      grid.innerHTML = '<p class="eq-sem-dados">Nenhum colaborador nesta equipe.</p>';
      return;
    }
    const sort = arr => arr.slice().sort((a, b) => a.apelido.localeCompare(b.apelido, 'pt-BR'));
    const especialistas = sort(colabs.filter(c => c.senioridade === 'especialista'));
    const analistas = sort(colabs.filter(c => c.senioridade !== 'especialista'));
    const ico = s => s === 'especialista' ? '\u2605' : '\u25CF';
    const cards = arr => arr.map(c =>
      '<a href="/equipes.html?colaborador=' + c.slug + '" class="hub-card">' +
      '<span class="hub-card__icone">' + ico(c.senioridade) + '</span>' +
      '<h3 class="hub-card__titulo">' + c.apelido + '</h3>' +
      '<p class="hub-card__desc">' + c.cargo + '</p>' +
      '<span class="hub-card__status hub-card__status--ativo">' + MetasConfig.obterMetas(c).length + ' metas</span></a>'
    ).join('');
    const secao = (titulo, arr) => arr.length
      ? '<div class="hub-secao"><h4 class="hub-secao__titulo">' + titulo + '</h4>' +
        '<div class="hub-grid__row">' + cards(arr) + '</div></div>'
      : '';
    grid.innerHTML = secao('Especialistas', especialistas) + secao('Analistas', analistas);
  }

  function renderColaborador(colab) {
    const btnAt = document.getElementById('btn-atualizar');
    if (btnAt) btnAt.hidden = false;
    document.querySelector('.header__title').innerHTML =
      '<a href="/equipes.html" class="eq-back-link">\u2190 Equipe</a> ' + colab.apelido;
    document.querySelector('.header__subtitle').textContent = colab.cargo + ' - Escrita Fiscal - ' + new Date().getFullYear();
    // Exibir coordenador do colaborador visualizado no header
    const coordSlug = colab['coordenador-slug'];
    if (coordSlug) {
      Nav.filtrarNavEquipes(coordSlug);
      const coords = MetasConfig.coordenadores ? MetasConfig.coordenadores() : [];
      const coord = coords.find(c => c.slug === coordSlug);
      const nomeCoord = coord ? (coord.apelido || coord.nome) : coordSlug;
      const el = document.getElementById('header-usuario');
      if (el) el.textContent = nomeCoord.charAt(0).toUpperCase() + nomeCoord.slice(1);
    }
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
        (m.isGrupo && m.tipo === 'revisoes'
          ? MetasConfig.renderConteudoGrupoRevisoes(m.subIds)
          : m.isGrupo && m.tipo === 'retornos'
            ? MetasConfig.renderConteudoGrupoRetornos(m.subIds)
            : m.isGrupo && m.tipo === 'geracao'
              ? MetasConfig.renderConteudoGrupoGeracao(m.subIds)
          : renderMetaInfo(m) + '<div class="eq-meta__dados" data-meta-id="' + m.id + '"><div class="eq-sem-dados">Carregando...</div></div>')
        + '</div>'
      ).join('') + '</div>';
    ativarAbas(main);
    carregarDados(colab.slug, metas, main);
  }

  function renderMetaInfo(m) {
    const dir = m.dir === 'menor-melhor' ? ' (quanto menor, melhor)' : '';
    const bloco = (l, v) => '<div class="eq-meta__bloco"><span class="eq-meta__bloco-label">' + l +
      '</span><span class="eq-meta__bloco-valor">' + v + '</span></div>';
    return '<div class="eq-meta"><h3 class="eq-meta__titulo">' + m.desc + '</h3>' +
      (m.det ? '<p class="eq-meta__detalhe">' + m.det + '</p>' : '') +
      '<div class="eq-meta__info">' + bloco('Valor esperado', MetasConfig.formatarValor(m.valor, m.un) + dir) +
      bloco('Fonte', m.fonte || 'Agregado') + '</div>' + EquipesMensal.renderExplicacao(m.id) + '</div>';
  }

  async function carregarDados(slug, metas, container) {
    try {
      const qs = fonteAtual === 'cache' ? '?fonte=cache' : '';
      const json = await (await fetch('/api/metas-equipe/' + slug + qs)).json();
      mostrarFonte(json);
      const totEl = document.getElementById('eq-totalizador');
      const valorMap = {};
      metas.forEach(m => { valorMap[m.id] = m.valor; });
      if (totEl && json.totalizador) totEl.innerHTML = EquipesMensal.renderTotalizador(json.totalizador, json.metas, valorMap);
      metas.forEach(m => {
        const el = container.querySelector('[data-meta-id="' + m.id + '"]');
        if (!el) return;
        el.innerHTML = json.metas[m.id]
          ? EquipesMensal.renderTabela(m.id, json.metas[m.id], m.valor)
          : '<div class="eq-sem-dados">Fonte de dados a definir</div>';
      });
      ativarBotoesDetalhe(container);
    } catch (err) { console.warn('[equipes] Erro:', err.message); }
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
    const aviso = json._aviso ? ' \u2014 fallback: ' + json._aviso : '';
    el.className = 'fonte-info fonte-info--' + fonte;
    el.innerHTML = fonte === 'cache'
      ? '\uD83D\uDCBE Cache salvo em ' + ts + aviso
      : '\u2713 Atualizado via ODBC em ' + ts;
  }

  function ativarBotoesDetalhe(container) {
    container.querySelectorAll('.eq-btn-detalhe').forEach(btn => {
      btn.addEventListener('click', async () => {
        const meta = btn.dataset.meta, mes = btn.dataset.mes;
        const det = container.querySelector('[data-detalhe-meta="' + meta + '"]');
        if (!det) return;
        det.innerHTML = '<div class="eq-sem-dados">Carregando detalhes...</div>';
        try {
          const url = '/api/metas-equipe/' + slugAtual + '/detalhe/' + meta + '/' + mes;
          // pontos-definicao usa planilha - sempre ao vivo (cache pode ter dados antigos do banco)
          const semCache = meta === 'pontos-definicao';
          let json = semCache ? { erro: true } : await (await fetch(url + '?fonte=cache')).json();
          if (json.erro || !json.registros) {
            json = await (await fetch(url)).json();
          }
          det.innerHTML = EquipesDetalhe.render(meta, parseInt(mes, 10), json.registros, json.planilha);
        } catch (e) { det.innerHTML = '<div class="eq-sem-dados">Erro ao carregar</div>'; }
      });
    });
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return {};
})();
