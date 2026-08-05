/**
 * nav-analista.js - Sidebar do portal individual (padrao visual do dashboard)
 */
/* eslint-disable no-unused-vars */
const Nav = (() => {
  const PAGINAS = [
    { id: 'metas', href: '/metas.html', titulo: 'Minhas Metas', icone: '\u25CF' },
    {
      id: 'acompanhamentos', titulo: 'Acompanhamentos', icone: '\u25C7',
      sub: [
        { tipo: 'header', titulo: 'SALs' },
        { id: 'sal-tempo-descarte', href: '/acomp-sals.html', titulo: 'Tempo Descarte' },
        { id: 'sal-tempo-detalhe', href: '/acomp-sals-tempo.html', titulo: 'Tempo por SAL' },
        { tipo: 'header', titulo: 'NEs' },
        { id: 'nes-definicao', href: '/nes-definicao.html', titulo: 'NEs com Definição' },
        { id: 'nes-tempo-detalhe', href: '/acomp-nes-tempo.html', titulo: 'Tempo por NE' },
        { tipo: 'header', titulo: 'SAMs/SAILs' },
        { id: 'sam-tempo-descarte', href: '/acomp-sams.html', titulo: 'Tempo Descarte' },
        { id: 'sam-tempo-detalhe', href: '/acomp-sams-tempo.html', titulo: 'Tempo por SAM/SAIL' }
      ]
    }
  ];

  function detectarPagina() {
    const path = window.location.pathname;
    if (path === '/acomp-sals.html') return 'sal-tempo-descarte';
    if (path === '/acomp-sals-tempo.html') return 'sal-tempo-detalhe';
    if (path === '/acomp-nes-tempo.html') return 'nes-tempo-detalhe';
    if (path === '/nes-definicao.html') return 'nes-definicao';
    if (path === '/acomp-sams.html') return 'sam-tempo-descarte';
    if (path === '/acomp-sams-tempo.html') return 'sam-tempo-detalhe';
    return 'metas';
  }

  function grupoAtivo(atual) {
    const p = PAGINAS.find(pg => pg.sub && pg.sub.some(s => s.id === atual));
    return p ? p.id : null;
  }

  function renderSub(s, atual) {
    if (s.tipo === 'header') return '<li class="sidebar__subheader">' + s.titulo + '</li>';
    return '<li><a href="' + s.href + '" class="sidebar__subitem' +
      (s.id === atual ? ' sidebar__subitem--ativo' : '') + '"' +
      (s.id === atual ? ' aria-current="page"' : '') + '>' +
      '<span class="sidebar__subtexto">' + s.titulo + '</span></a></li>';
  }

  function renderItem(p, atual, aberto) {
    if (p.sub) {
      const exp = aberto === p.id;
      return '<li class="sidebar__grupo' + (exp ? ' sidebar__grupo--aberto' : '') + '">' +
        '<a href="#" class="sidebar__item sidebar__grupo-toggle" role="button" aria-expanded="' +
        (exp ? 'true' : 'false') + '" aria-label="Submenu: ' + p.titulo + '">' +
        '<span class="sidebar__icone" aria-hidden="true">' + p.icone + '</span>' +
        '<span class="sidebar__texto">' + p.titulo + '</span>' +
        '<span class="sidebar__seta" aria-hidden="true">\u25B8</span></a>' +
        '<ul class="sidebar__submenu" role="group">' +
        p.sub.map(s => renderSub(s, atual)).join('') +
        '</ul></li>';
    }
    return '<li><a href="' + p.href + '" class="sidebar__item' +
      (p.id === atual ? ' sidebar__item--ativo' : '') + '"' +
      (p.id === atual ? ' aria-current="page"' : '') + '>' +
      '<span class="sidebar__icone" aria-hidden="true">' + p.icone + '</span>' +
      '<span class="sidebar__texto">' + p.titulo + '</span></a></li>';
  }

  function ativarSubmenus(container) {
    container.querySelectorAll('.sidebar__grupo-toggle').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const li = btn.closest('.sidebar__grupo');
        const aberto = li.classList.toggle('sidebar__grupo--aberto');
        btn.setAttribute('aria-expanded', aberto ? 'true' : 'false');
      });
    });
  }

  function ativarToggleMobile(container) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'sidebar__toggle';
    toggle.innerHTML = '\u2630';
    toggle.title = 'Menu';
    toggle.setAttribute('aria-label', 'Abrir ou fechar menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => {
      const aberto = container.classList.toggle('sidebar--aberta');
      toggle.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    });
    document.body.prepend(toggle);
    document.addEventListener('click', e => {
      if (!container.contains(e.target) && !toggle.contains(e.target)) {
        container.classList.remove('sidebar--aberta');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function renderizar() {
    const container = document.getElementById('nav-container');
    if (!container) return;
    const atual = detectarPagina();
    const aberto = grupoAtivo(atual);
    container.className = 'sidebar';
    container.setAttribute('aria-label', 'Navegacao principal');
    container.innerHTML =
      '<div class="sidebar__logo">' +
        '<span class="sidebar__logo-sigla">Metas</span>' +
        '<span class="sidebar__logo-texto">Escrita Fiscal</span>' +
      '</div>' +
      '<ul class="sidebar__menu">' +
        PAGINAS.map(p => renderItem(p, atual, aberto)).join('') +
      '</ul>' +
      '<div class="sidebar__rodape">Portal do Analista v1.2</div>';
    ativarSubmenus(container);
    ativarToggleMobile(container);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderizar);
  else renderizar();

  return { filtrarNavEquipes: () => {} };
})();
