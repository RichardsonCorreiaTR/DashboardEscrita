/**
 * nav-analista.js - Menu lateral (metas + acompanhamentos individuais)
 */
/* eslint-disable no-unused-vars */
const Nav = (() => {
  function ativo(href) {
    return location.pathname === href ? ' sidebar__link--ativo' : '';
  }

  function renderizar() {
    const el = document.getElementById('nav-container');
    if (!el) return;
    el.className = 'sidebar';
    el.innerHTML =
      '<div class="sidebar__header"><span class="sidebar__sigla">EF</span>' +
      '<span class="sidebar__titulo">Minhas Metas</span></div>' +
      '<ul class="sidebar__menu">' +
        '<li><a href="/metas.html" class="sidebar__link' + ativo('/metas.html') + '">Minhas Metas</a></li>' +
        '<li class="sidebar__grupo"><span class="sidebar__grupo-titulo">Acomp. SALs</span></li>' +
        '<li><a href="/acomp-sals.html" class="sidebar__link' + ativo('/acomp-sals.html') + '">Tempo Descarte</a></li>' +
        '<li><a href="/acomp-sals-tempo.html" class="sidebar__link' + ativo('/acomp-sals-tempo.html') + '">Tempo por SAL</a></li>' +
        '<li class="sidebar__grupo"><span class="sidebar__grupo-titulo">Acomp. NEs</span></li>' +
        '<li><a href="/acomp-nes-tempo.html" class="sidebar__link' + ativo('/acomp-nes-tempo.html') + '">Tempo por NE</a></li>' +
      '</ul>' +
      '<div class="sidebar__footer"><a href="/auth/logout" class="sidebar__link">Sair</a></div>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderizar);
  else renderizar();

  return { filtrarNavEquipes: () => {} };
})();
