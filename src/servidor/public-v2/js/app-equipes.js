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
  let fonteAtual = 'odbc';

  async function init() {
    await MetasConfig.carregar();
    slugAtual = new URLSearchParams(window.location.search).get('colaborador') || '';
    document.getElementById('equipes-loading').hidden = true;
    const colab = MetasConfig.colaboradores().find(c => c.slug === slugAtual);
    if (!colab) { renderLista(); return; }
    renderColaborador(colab);
    ativarToggle();
  }

  function ativarToggle() {
    const btnOdbc = document.getElementById('btn-odbc');
    const btnCache = document.getElementById('btn-cache');
    if (!btnOdbc || !btnCache) return;
    btnOdbc.addEventListener('click', () => { fonteAtual = 'odbc'; recarregar(); });
    btnCache.addEventListener('click', () => { fonteAtual = 'cache'; recarregar(); });
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
    document.getElementById('eq-totalizador').innerHTML = '<div class="eq-sem-dados">Carregando...</div>';
    atualizarBotoes();
    carregarDados(colab.slug, metas, main);
  }

  function atualizarBotoes() {
    const btnOdbc = document.getElementById('btn-odbc');
    const btnCache = document.getElementById('btn-cache');
    if (!btnOdbc) return;
    btnOdbc.className = 'btn ' + (fonteAtual === 'odbc' ? 'btn--primario' : 'btn--outline');
    btnCache.className = 'btn ' + (fonteAtual === 'cache' ? 'btn--primario' : 'btn--outline');
  }

  function renderLista() {
    document.querySelector('.header__title').textContent = 'Metas da Equipe';
    document.querySelector('.header__subtitle').textContent = 'Escrita Fiscal - Selecione um colaborador';
    const main = document.getElementById('equipes-main');
    const colabs = MetasConfig.colaboradores();
    const ico = s => s === 'especialista' ? '\u2605' : '\u25CF';
    main.innerHTML = '<section class="hub-grid">' +
      colabs.map(c => '<a href="/equipes.html?colaborador=' + c.slug + '" class="hub-card">' +
        '<span class="hub-card__icone">' + ico(c.senioridade) + '</span>' +
        '<h3 class="hub-card__titulo">' + c.apelido + '</h3>' +
        '<p class="hub-card__desc">' + c.cargo + '</p>' +
        '<span class="hub-card__status hub-card__status--ativo">' + MetasConfig.obterMetas(c).length + ' metas</span></a>'
      ).join('') + '</section>';
  }

  function renderColaborador(colab) {
    document.querySelector('.header__title').textContent = 'Metas - ' + colab.apelido;
    document.querySelector('.header__subtitle').textContent = colab.cargo + ' - Escrita Fiscal - ' + new Date().getFullYear();
    const metas = MetasConfig.obterMetas(colab);
    const main = document.getElementById('equipes-main');
    main.innerHTML =
      '<div id="eq-totalizador"><div class="eq-sem-dados">Carregando...</div></div>' +
      '<div class="eq-abas-container"><div class="abas">' +
      metas.map((m, i) => '<button class="aba' + (i === 0 ? ' aba--ativa' : '') +
        '" data-idx="' + i + '">' + (LABELS[m.id] || m.id) + '</button>').join('') +
      '</div>' + metas.map((m, i) =>
        '<div class="aba-conteudo' + (i === 0 ? ' aba-conteudo--ativo' : '') +
        '" data-idx="' + i + '">' + renderMetaInfo(m) +
        '<div class="eq-meta__dados" data-meta-id="' + m.id + '">' +
        '<div class="eq-sem-dados">Carregando dados mensais...</div></div></div>'
      ).join('') + '</div>';
    ativarAbas(main);
    carregarDados(colab.slug, metas, main);
  }

  function renderMetaInfo(m) {
    const dir = m.dir === 'menor-melhor' ? ' (quanto menor, melhor)' : '';
    return '<div class="eq-meta"><h3 class="eq-meta__titulo">' + m.desc + '</h3>' +
      (m.det ? '<p class="eq-meta__detalhe">' + m.det + '</p>' : '') +
      '<div class="eq-meta__info">' +
      bloco('Valor esperado', MetasConfig.formatarValor(m.valor, m.un) + dir) +
      bloco('Fonte', m.fonte || 'Agregado') + '</div>' +
      EquipesMensal.renderExplicacao(m.id) + '</div>';
  }

  function bloco(l, v) {
    return '<div class="eq-meta__bloco"><span class="eq-meta__bloco-label">' + l +
      '</span><span class="eq-meta__bloco-valor">' + v + '</span></div>';
  }

  async function carregarDados(slug, metas, container) {
    try {
      const qs = fonteAtual === 'cache' ? '?fonte=cache' : '';
      const json = await (await fetch('/api/metas-equipe/' + slug + qs)).json();
      mostrarFonte(json);
      const totEl = document.getElementById('eq-totalizador');
      if (totEl && json.totalizador) totEl.innerHTML = EquipesMensal.renderTotalizador(json.totalizador);
      metas.forEach(m => {
        const el = container.querySelector('[data-meta-id="' + m.id + '"]');
        if (!el) return;
        el.innerHTML = json.metas[m.id]
          ? EquipesMensal.renderTabela(m.id, json.metas[m.id])
          : '<div class="eq-sem-dados">Fonte de dados a definir</div>';
      });
      ativarBotoesDetalhe(container);
    } catch (err) { console.warn('[equipes] Erro:', err.message); }
  }

  function mostrarFonte(json) {
    const el = document.getElementById('eq-fonte-info');
    if (!el) return;
    el.hidden = false;
    const fonte = json._fonte || 'odbc';
    const ts = json._atualizado_em ? new Date(json._atualizado_em).toLocaleString('pt-BR') : '-';
    const aviso = json._aviso ? ' (fallback: ' + json._aviso + ')' : '';
    el.className = 'fonte-info fonte-info--' + fonte;
    el.innerHTML = fonte === 'cache'
      ? '\u26A0 Dados do cache (salvo em ' + ts + ')' + aviso
      : '\u2713 Dados ao vivo via ODBC (' + ts + ')';
  }

  function ativarBotoesDetalhe(container) {
    container.querySelectorAll('.eq-btn-detalhe').forEach(btn => {
      btn.addEventListener('click', async () => {
        const meta = btn.dataset.meta, mes = btn.dataset.mes;
        const det = container.querySelector('[data-detalhe-meta="' + meta + '"]');
        if (!det) return;
        det.innerHTML = '<div class="eq-sem-dados">Carregando detalhes...</div>';
        try {
          const qs = fonteAtual === 'cache' ? '?fonte=cache' : '';
          const json = await (await fetch('/api/metas-equipe/' + slugAtual + '/detalhe/' + meta + '/' + mes + qs)).json();
          det.innerHTML = EquipesDetalhe.render(meta, parseInt(mes, 10), json.registros);
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
