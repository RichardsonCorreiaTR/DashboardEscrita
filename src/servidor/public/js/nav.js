/**
 * nav.js - Componente de navegacao lateral compartilhado
 *
 * Renderiza o sidebar em qualquer pagina que inclua este script.
 * Detecta a pagina atual pela URL e destaca no menu.
 * Suporta submenus colapsaveis (expand/collapse).
 * Inclui toggle para mobile.
 *
 * Uso: colocar <nav id="nav-container"></nav> no HTML
 *      e incluir este script antes dos demais.
 */

/* eslint-disable no-unused-vars */
const Nav = (() => {
  const PAGINAS = [
    { id: 'inicio', href: '/', titulo: 'Visao Geral', icone: '\u25A3' },
    { id: 'diretrizes', href: '/diretrizes.html', titulo: 'Diretrizes', icone: '\u25C6' },
    { id: 'feedback-1on1', href: '/feedback-1on1.html', titulo: 'Feedback 1:1', icone: '\u25A1' },
    {
      id: 'equipes', titulo: 'Metas da Equipe', icone: '\u25CF', href: '/equipes.html',
      sub: [
        { tipo: 'header', titulo: 'Coordenadores' },
        { tipo: 'coord-header', titulo: 'Richardson', coord: 'richardson' },
        { id: 'eq-coord-richardson', href: '/equipes.html?coord=richardson', titulo: 'Painel', tipo: 'coord-item', coord: 'richardson' },
        { tipo: 'coord-header', titulo: 'Marielli', coord: 'marielli' },
        { id: 'eq-coord-marielli', href: '/equipes.html?coord=marielli', titulo: 'Painel', tipo: 'coord-item', coord: 'marielli' },
        { tipo: 'header', titulo: 'Especialistas' },
        { id: 'eq-giovani', href: '/equipes.html?colaborador=giovani', titulo: 'Giovani', coord: 'richardson' },
        { id: 'eq-jennifer', href: '/equipes.html?colaborador=jennifer', titulo: 'Jennifer', coord: 'richardson' },
        { id: 'eq-lais', href: '/equipes.html?colaborador=lais', titulo: 'Lais', coord: 'richardson' },
        { id: 'eq-victor', href: '/equipes.html?colaborador=victor', titulo: 'Victor', coord: 'richardson' },
        { id: 'eq-bruna', href: '/equipes.html?colaborador=bruna', titulo: 'Bruna', coord: 'marielli' },
        { id: 'eq-patricia', href: '/equipes.html?colaborador=patricia', titulo: 'Patricia', coord: 'marielli' },
        { tipo: 'header', titulo: 'Analistas' },
        { id: 'eq-barbara-melo', href: '/equipes.html?colaborador=barbara-melo', titulo: 'Bárbara Melo (Pleno)', coord: 'richardson' },
        { id: 'eq-carolina', href: '/equipes.html?colaborador=carolina', titulo: 'Carolina (Sênior)', coord: 'richardson' },
        { id: 'eq-daniela', href: '/equipes.html?colaborador=daniela', titulo: 'Daniela (Pleno)', coord: 'richardson' },
        { id: 'eq-erick', href: '/equipes.html?colaborador=erick', titulo: 'Erick (Pleno)', coord: 'richardson' },
        { id: 'eq-fabio', href: '/equipes.html?colaborador=fabio', titulo: 'Fabio (Pleno)', coord: 'richardson' },
        { id: 'eq-felipi', href: '/equipes.html?colaborador=felipi', titulo: 'Felipi (Pleno)', coord: 'richardson' },
        { id: 'eq-flavia', href: '/equipes.html?colaborador=flavia', titulo: 'Flávia (Júnior)', coord: 'richardson' },
        { id: 'eq-mateus', href: '/equipes.html?colaborador=mateus', titulo: 'Mateus (Júnior)', coord: 'richardson' },
        { id: 'eq-barbara-leite', href: '/equipes.html?colaborador=barbara-leite', titulo: 'Bárbara Leite (Pleno)', coord: 'marielli' },
        { id: 'eq-gabriely', href: '/equipes.html?colaborador=gabriely', titulo: 'Gabriely (Júnior)', coord: 'marielli' },
        { id: 'eq-juliana', href: '/equipes.html?colaborador=juliana', titulo: 'Juliana (Pleno)', coord: 'marielli' },
        { id: 'eq-laysa', href: '/equipes.html?colaborador=laysa', titulo: 'Laysa (Júnior)', coord: 'marielli' },
        { id: 'eq-rafaela-ribeiro', href: '/equipes.html?colaborador=rafaela-ribeiro', titulo: 'Rafaela Ribeiro (Júnior)', coord: 'marielli' },
        { id: 'eq-rafaela-sampaio', href: '/equipes.html?colaborador=rafaela-sampaio', titulo: 'Rafaela Sampaio (Júnior)', coord: 'marielli' },
        { id: 'eq-renan', href: '/equipes.html?colaborador=renan', titulo: 'Renan (Pleno)', coord: 'marielli' },
        { id: 'eq-sabrine', href: '/equipes.html?colaborador=sabrine', titulo: 'Sabrine (Júnior)', coord: 'marielli' },
        { id: 'eq-vinicyos', href: '/equipes.html?colaborador=vinicyos', titulo: 'Vinicyos (Júnior)', coord: 'marielli' }
      ]
    },
    {
      id: 'acomp-nes', titulo: 'Acomp. NEs', icone: '\u25C7',
      sub: [
        { id: 'nes-definicao', href: '/nes-definicao.html', titulo: 'NEs com Definição' },
        { id: 'semanal-versao', href: '/estudos.html?view=semanal-versao', titulo: 'Semanal - NE por Versao' },
        { id: 'semanal-historica', href: '/estudos.html?view=semanal-historica', titulo: 'Semanal - NE Historica' }
      ]
    },
    {
      id: 'acomp-sals', titulo: 'Acomp. SALs', icone: '\u25A1',
      sub: [
        { id: 'sal-tempo-descarte', href: '/acomp-sals.html', titulo: 'Tempo Descarte' }
      ]
    },
    { id: 'descartes-tempo', href: '/descartes-tempo.html', titulo: 'Descartes x Tempo', icone: '\u25D2' },
    { id: 'ss-respondidas', href: '/ss-respondidas.html', titulo: 'SS Respondidas', icone: '\u2709' },
    {
      id: 'estudos', titulo: 'Estudos e Analises', icone: '\u25B2',
      sub: [
        { id: 'isv-ne', href: '/estudos.html?view=isv-ne', titulo: 'ISV - Saude da Versao' },
        { id: 'isv-yoy', href: '/estudos.html?view=isv-yoy', titulo: 'ISV - Year by Year' },
        { id: 'descartes-ne', href: '/estudos.html?view=descartes-ne', titulo: 'Descartes (CsD/Repr/Presc)' },
        { id: 'liberacoes-sa-v2', href: '/estudos.html?view=liberacoes-sa-v2', titulo: 'Liberacoes de SA (V2)' },
        { id: 'liberacoes-sa', href: '/estudos.html?view=liberacoes-sa', titulo: 'Liberacoes de SA (V1)' },
        { id: 'diff-niveis', href: '/estudos.html?view=diff-niveis', titulo: 'Diferenças SGD x Planilha' }
      ]
    },
    {
      id: 'laboratorio', titulo: 'Laboratorio IA', icone: '\u2666',
      sub: [
        { id: 'lab-raio-x', href: '/laboratorio.html?view=raio-x', titulo: 'Raio-X da Versao' },
        { id: 'lab-evolucao', href: '/laboratorio.html?view=evolucao', titulo: 'Evolucao' },
        { id: 'lab-dna', href: '/laboratorio.html?view=dna', titulo: 'DNA Tecnico' },
        { id: 'lab-backtest', href: '/laboratorio.html?view=backtest', titulo: 'Backtest' }
      ]
    },
    { id: 'proposta-metas', href: '/proposta-metas.html', titulo: 'Proposta Metas', icone: '\u2605' }
  ];

  function detectarPagina() {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');

    if (path === '/' || path === '/index.html') return 'inicio';
    if (path === '/proposta-metas.html') return 'proposta-metas';
    if (path === '/descartes-tempo.html') return 'descartes-tempo';
    if (path === '/ss-respondidas.html') return 'ss-respondidas';
    if (path === '/feedback-1on1.html') return 'feedback-1on1';
    if (path === '/nes-definicao.html') return 'nes-definicao';
    if (path === '/acomp-sals.html') return 'sal-tempo-descarte';

    // Verificar subpaginas de estudos
    if (path === '/estudos.html' && view) return view;
    if (path === '/estudos.html') return 'semanal-versao';

    // Verificar subpaginas de laboratorio
    if (path === '/laboratorio.html' && view) return 'lab-' + view;
    if (path === '/laboratorio.html') return 'lab-raio-x';

    // Verificar subpaginas de equipes
    const colaborador = params.get('colaborador');
    const coord = params.get('coord');
    if (path === '/equipes.html' && colaborador) return 'eq-' + colaborador;
    if (path === '/equipes.html' && coord) return 'eq-coord-' + coord;
    if (path === '/equipes.html') return 'equipes';

    const p = PAGINAS.find(pg => pg.href && path === pg.href);
    return p ? p.id : null;
  }

  function detectarGrupoAtivo(paginaId) {
    for (const p of PAGINAS) {
      if (p.sub) {
        const subAtivo = p.sub.find(s => s.id === paginaId);
        if (subAtivo) return p.id;
      }
    }
    return null;
  }

  function renderizar() {
    const container = document.getElementById('nav-container');
    if (!container) return;

    const atual = detectarPagina();
    const grupoAtivo = detectarGrupoAtivo(atual);

    container.className = 'sidebar';
    container.setAttribute('aria-label', 'Navegacao principal');
    container.innerHTML = `
      <div class="sidebar__logo">
        <span class="sidebar__logo-sigla">Metas</span>
        <span class="sidebar__logo-texto">Escrita Fiscal</span>
      </div>
      <ul class="sidebar__menu">
        ${PAGINAS.map(p => renderizarItem(p, atual, grupoAtivo)).join('')}
      </ul>
      <div class="sidebar__rodape">
        Dashboard Diretrizes v0.2.0
      </div>
    `;

    // Event listeners para submenus
    container.querySelectorAll('.sidebar__grupo-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (btn.getAttribute('href') !== '#') return; // permite navegacao para grupos com href real
        e.preventDefault();
        const li = btn.closest('.sidebar__grupo');
        const aberto = li.classList.toggle('sidebar__grupo--aberto');
        btn.setAttribute('aria-expanded', aberto ? 'true' : 'false');
      });
    });

    // Toggle mobile
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'sidebar__toggle';
    toggle.innerHTML = '\u2630';
    toggle.title = 'Menu';
    toggle.setAttribute('aria-label', 'Abrir ou fechar menu de navegacao');
    toggle.setAttribute('aria-controls', 'nav-container');
    toggle.setAttribute('aria-expanded', 'false');

    function syncToggleExpanded() {
      const aberto = container.classList.contains('sidebar--aberta');
      toggle.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    }

    toggle.addEventListener('click', () => {
      container.classList.toggle('sidebar--aberta');
      syncToggleExpanded();
    });
    document.body.prepend(toggle);

    // Fechar sidebar ao clicar fora (mobile)
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target) && !toggle.contains(e.target)) {
        container.classList.remove('sidebar--aberta');
        syncToggleExpanded();
      }
    });
  }

  function renderizarItem(p, atual, grupoAtivo) {
    // Item com submenu
    if (p.sub) {
      const aberto = grupoAtivo === p.id;
      return `
        <li class="sidebar__grupo${aberto ? ' sidebar__grupo--aberto' : ''}">
          <a href="${p.href || '#'}" class="sidebar__item sidebar__grupo-toggle" role="button"
             aria-expanded="${aberto ? 'true' : 'false'}"
             aria-label="Submenu: ${p.titulo}">
            <span class="sidebar__icone" aria-hidden="true">${p.icone}</span>
            <span class="sidebar__texto">${p.titulo}</span>
            <span class="sidebar__seta" aria-hidden="true">\u25B8</span>
          </a>
          <ul class="sidebar__submenu" role="group">
            ${p.sub.map(s => {
              if (s.tipo === 'header') return `<li class="sidebar__subheader">${s.titulo}</li>`;
              if (s.tipo === 'coord-header') return `<li class="sidebar__subheader sidebar__subheader--coord" data-coord="${s.coord}">\u25B6 ${s.titulo}</li>`;
              const isCoordItem = s.tipo === 'coord-item';
              return `
                <li${s.coord ? ` data-coord="${s.coord}"` : ''}>
                  <a href="${s.href}"
                     class="sidebar__subitem${s.id === atual ? ' sidebar__subitem--ativo' : ''}${isCoordItem ? ' sidebar__subitem--coord-item' : ''}"
                     ${s.id === atual ? 'aria-current="page"' : ''}>
                    <span class="sidebar__subtexto">${isCoordItem ? '\u2514 ' : ''}${s.titulo}</span>
                  </a>
                </li>`;
            }).join('')}
          </ul>
        </li>
      `;
    }

    // Item simples
    return `
      <li>
        <a href="${p.futuro ? '#' : p.href}"
           class="sidebar__item${p.id === atual ? ' sidebar__item--ativo' : ''}${p.futuro ? ' sidebar__item--futuro' : ''}"
           ${p.id === atual && !p.futuro ? 'aria-current="page"' : ''}>
          <span class="sidebar__icone" aria-hidden="true">${p.icone}</span>
          <span class="sidebar__texto">${p.titulo}</span>
          ${p.futuro ? '<span class="sidebar__em-breve">Em breve</span>' : ''}
        </a>
      </li>
    `;
  }

  function filtrarNavEquipes(coordSlug) {
    if (!coordSlug) return;
    // 1. Filtrar todos os itens com data-coord (coord-header, coord-item, analistas)
    document.querySelectorAll('li[data-coord]').forEach(li => {
      li.style.display = li.dataset.coord === coordSlug ? '' : 'none';
    });
    // 2. Ocultar headers de secao sem itens visiveis (somente headers SEM data-coord)
    document.querySelectorAll('.sidebar__subheader:not([data-coord])').forEach(h => {
      let next = h.nextElementSibling, visible = false;
      while (next && !next.classList.contains('sidebar__subheader')) {
        if (next.style.display !== 'none') visible = true;
        next = next.nextElementSibling;
      }
      h.style.display = visible ? '' : 'none';
    });
    localStorage.setItem('eq-coord-ativo', coordSlug);
  }

  function inicializar() {
    renderizar();
    const coordSalvo = localStorage.getItem('eq-coord-ativo');
    if (coordSalvo) filtrarNavEquipes(coordSalvo);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }

  return { PAGINAS, detectarPagina, filtrarNavEquipes };
})();
