/**
 * nav-v2.js — Two-row top navigation matching PE/ONVIO reference.
 * Row 1: brand + page links (with icons)
 * Row 2: page title + action buttons (injected by page JS)
 */
const NavV2 = (() => {
  const PAGES = [
    { id: 'inicio', href: '/', label: 'Visao Geral', icon: '◎' },
    { id: 'diretrizes', href: '/diretrizes.html', label: 'Diretrizes', icon: '◈' },
    {
      id: 'estudos', label: 'Estudos', icon: '⊙',
      sub: [
        { id: 'semanal-versao', href: '/estudos.html?view=semanal-versao', label: 'Semanal por Versao' },
        { id: 'semanal-historica', href: '/estudos.html?view=semanal-historica', label: 'Semanal Historica' },
        { id: 'isv-ne', href: '/estudos.html?view=isv-ne', label: 'ISV - Saude da Versao' },
        { id: 'isv-yoy', href: '/estudos.html?view=isv-yoy', label: 'ISV Year by Year' },
        { id: 'descartes-ne', href: '/estudos.html?view=descartes-ne', label: 'Descartes (CsD/Repr)' },
        { id: 'liberacoes-sa-v2', href: '/estudos.html?view=liberacoes-sa-v2', label: 'Liberacoes SA (V2)' },
        { id: 'liberacoes-sa', href: '/estudos.html?view=liberacoes-sa', label: 'Liberacoes SA (V1)' }
      ]
    },
    {
      id: 'laboratorio', label: 'Laboratorio', icon: '⚗',
      sub: [
        { id: 'lab-raio-x', href: '/laboratorio.html?view=raio-x', label: 'Raio-X da Versao' },
        { id: 'lab-evolucao', href: '/laboratorio.html?view=evolucao', label: 'Evolucao' },
        { id: 'lab-dna', href: '/laboratorio.html?view=dna', label: 'DNA Tecnico' },
        { id: 'lab-backtest', href: '/laboratorio.html?view=backtest', label: 'Backtest' }
      ]
    },
    {
      id: 'equipes', label: 'Equipe', icon: '⊞',
      sub: [
        { tipo: 'header', label: 'Especialistas' },
        { id: 'eq-bruna', href: '/equipes.html?colaborador=bruna', label: 'Bruna' },
        { id: 'eq-giovani', href: '/equipes.html?colaborador=giovani', label: 'Giovani' },
        { id: 'eq-jennifer', href: '/equipes.html?colaborador=jennifer', label: 'Jennifer' },
        { id: 'eq-patricia', href: '/equipes.html?colaborador=patricia', label: 'Patricia' },
        { id: 'eq-victor', href: '/equipes.html?colaborador=victor', label: 'Victor' },
        { tipo: 'header', label: 'Analistas' },
        { id: 'eq-barbara-leite', href: '/equipes.html?colaborador=barbara-leite', label: 'Bárbara Leite (Pleno)' },
        { id: 'eq-barbara-melo', href: '/equipes.html?colaborador=barbara-melo', label: 'Bárbara Melo (Pleno)' },
        { id: 'eq-carolina', href: '/equipes.html?colaborador=carolina', label: 'Carolina (Sênior)' },
        { id: 'eq-daniela', href: '/equipes.html?colaborador=daniela', label: 'Daniela (Pleno)' },
        { id: 'eq-erick', href: '/equipes.html?colaborador=erick', label: 'Erick (Pleno)' },
        { id: 'eq-fabio', href: '/equipes.html?colaborador=fabio', label: 'Fabio (Pleno)' },
        { id: 'eq-felipi', href: '/equipes.html?colaborador=felipi', label: 'Felipi (Pleno)' },
        { id: 'eq-flavia', href: '/equipes.html?colaborador=flavia', label: 'Flávia (Jr)' },
        { id: 'eq-gabriely', href: '/equipes.html?colaborador=gabriely', label: 'Gabriely (Jr)' },
        { id: 'eq-juliana', href: '/equipes.html?colaborador=juliana', label: 'Juliana (Pleno)' },
        { id: 'eq-laysa', href: '/equipes.html?colaborador=laysa', label: 'Laysa (Jr)' },
        { id: 'eq-mateus', href: '/equipes.html?colaborador=mateus', label: 'Mateus (Jr)' },
        { id: 'eq-rafaela-ribeiro', href: '/equipes.html?colaborador=rafaela-ribeiro', label: 'Rafaela Ribeiro (Jr)' },
        { id: 'eq-rafaela-sampaio', href: '/equipes.html?colaborador=rafaela-sampaio', label: 'Rafaela Sampaio (Jr)' },
        { id: 'eq-renan', href: '/equipes.html?colaborador=renan', label: 'Renan (Pleno)' },
        { id: 'eq-sabrine', href: '/equipes.html?colaborador=sabrine', label: 'Sabrine (Jr)' },
        { id: 'eq-vinicyos', href: '/equipes.html?colaborador=vinicyos', label: 'Vinicyos (Jr)' }
      ]
    },
    { id: 'proposta-metas', href: '/proposta-metas.html', label: 'Proposta Metas', icon: '◇' },
    { id: 'descartes-tempo', href: '/descartes-tempo.html', label: 'Descartes x Tempo', icon: '◫' }
  ];

  function detectPage() {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (path === '/' || path === '/index.html') return 'inicio';
    if (path === '/proposta-metas.html') return 'proposta-metas';
    if (path === '/descartes-tempo.html') return 'descartes-tempo';
    if (path === '/diretrizes.html') return 'diretrizes';
    if (path === '/estudos.html') return view || 'semanal-versao';
    if (path === '/laboratorio.html') return view ? 'lab-' + view : 'lab-raio-x';
    const colab = params.get('colaborador');
    if (path === '/equipes.html') return colab ? 'eq-' + colab : 'eq-victor';
    return null;
  }

  function isInGroup(pageId, group) {
    if (!group.sub) return false;
    return group.sub.some(s => s.id === pageId);
  }

  function getPageTitle(current) {
    for (const p of PAGES) {
      if (p.id === current) return p.label;
      if (p.sub) {
        const sub = p.sub.find(s => s.id === current);
        if (sub) return sub.label;
      }
    }
    return '';
  }

  function render() {
    const container = document.getElementById('nav-v2');
    if (!container) return;

    const current = detectPage();
    container.className = 'topnav';
    container.setAttribute('role', 'navigation');
    container.setAttribute('aria-label', 'Navegacao principal');

    // ROW 1: brand + links
    let html = `<div class="topnav__row1">
      <a href="/" class="topnav__brand">
        <span class="topnav__brand-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/></svg></span>
        <span class="topnav__brand-text"><strong>Thomson Reuters</strong> Product Engineering</span>
      </a>`;

    for (const p of PAGES) {
      if (p.sub) {
        const groupActive = isInGroup(current, p);
        const activeLabel = groupActive ? p.sub.find(s => s.id === current) : null;
        const btnClass = 'topnav__dropdown-btn' + (groupActive ? ' topnav__dropdown-btn--ativo' : '');
        const displayLabel = activeLabel ? activeLabel.label : p.label;

        html += `<div class="topnav__dropdown" data-dropdown>
          <button class="${btnClass}" aria-expanded="false">${p.icon || ''} ${displayLabel} ▾</button>
          <div class="topnav__dropdown-menu">`;

        for (const s of p.sub) {
          if (s.tipo === 'header') {
            html += `<div class="topnav__dropdown-header">${s.label}</div>`;
            continue;
          }
          const cls = s.id === current ? 'topnav__dropdown-item topnav__dropdown-item--ativo' : 'topnav__dropdown-item';
          html += `<a href="${s.href}" class="${cls}" ${s.id === current ? 'aria-current="page"' : ''}>${s.label}</a>`;
        }
        html += '</div></div>';
      } else {
        const cls = p.id === current ? 'topnav__link topnav__link--ativo' : 'topnav__link';
        html += `<a href="${p.href}" class="${cls}" ${p.id === current ? 'aria-current="page"' : ''}>${p.icon || ''} ${p.label}</a>`;
      }
    }

    html += '</div>';

    // ROW 2: page title + action slot
    const title = getPageTitle(current);
    html += `<div class="topnav__row2">
      <div class="topnav__page-title">
        <span class="topnav__page-title-icon">✦</span>
        <span id="nav-page-title">${title}</span>
      </div>
      <div class="topnav__page-actions" id="nav-page-actions"></div>
    </div>`;

    container.innerHTML = html;

    // Dropdown interactions
    container.querySelectorAll('[data-dropdown]').forEach(dd => {
      const btn = dd.querySelector('.topnav__dropdown-btn');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOpen = dd.classList.contains('topnav__dropdown--open');
        container.querySelectorAll('.topnav__dropdown--open').forEach(d => {
          d.classList.remove('topnav__dropdown--open');
          d.querySelector('.topnav__dropdown-btn').setAttribute('aria-expanded', 'false');
        });
        if (!wasOpen) {
          dd.classList.add('topnav__dropdown--open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });

    document.addEventListener('click', () => {
      container.querySelectorAll('.topnav__dropdown--open').forEach(d => {
        d.classList.remove('topnav__dropdown--open');
        d.querySelector('.topnav__dropdown-btn').setAttribute('aria-expanded', 'false');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }

  return { PAGES, detectPage, getPageTitle };
})();
