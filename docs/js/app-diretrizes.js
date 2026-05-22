/**
 * app-diretrizes.js - Logica principal do dashboard de Diretrizes
 *
 * Responsabilidades:
 * - Carregar dados da API (ODBC ou cache)
 * - Renderizar cards com semaforo
 * - Gerenciar seletor de versao
 * - Exibir banner quando dado vem do cache
 * - Delegar detalhes para Detalhes.renderizar()
 */

/* globals API, Detalhes */
const App = (() => {
  let estado = { versaoAtual: null, versoes: [], resultados: {}, cardAtivo: null };
  const els = {};

  function cachearElementos() {
    els.loading = document.getElementById('loading');
    els.erroGlobal = document.getElementById('erro-global');
    els.erroMsg = document.getElementById('erro-mensagem');
    els.cards = document.getElementById('cards-container');
    els.detalhes = document.getElementById('detalhes-container');
    els.detalhesTitulo = document.getElementById('detalhes-titulo');
    els.detalhesBody = document.getElementById('detalhes-body');
    els.seletorVersao = document.getElementById('seletor-versao');
    els.periodoLabel = document.getElementById('periodo-label');
    els.atualizadoLabel = document.getElementById('atualizado-label');
    els.btnOdbc = document.getElementById('btn-odbc');
    els.btnCache = document.getElementById('btn-cache');
    els.btnRetry = document.getElementById('btn-retry');
    els.btnFechar = document.getElementById('btn-fechar-detalhes');
    els.bannerOffline = document.getElementById('banner-offline');
    els.bannerMsg = document.getElementById('banner-offline-msg');
  }

  function mostrarLoading(v) {
    els.loading.hidden = !v;
    els.cards.style.display = v ? 'none' : '';
  }
  function mostrarErro(msg) { els.erroGlobal.hidden = false; els.erroMsg.textContent = msg; mostrarLoading(false); }
  function esconderErro() { els.erroGlobal.hidden = true; }

  function mostrarBannerOffline(atualizado, aviso) {
    if (!els.bannerOffline) return;
    const dataFmt = atualizado
      ? new Date(atualizado).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
      : 'desconhecido';
    els.bannerMsg.textContent = aviso
      || `Exibindo dados do cache (ultima atualizacao: ${dataFmt}). Verifique a conexao ODBC.`;
    els.bannerOffline.hidden = false;
  }

  function esconderBannerOffline() {
    if (els.bannerOffline) els.bannerOffline.hidden = true;
  }

  function popularVersoes(versaoDetectada) {
    els.seletorVersao.innerHTML = '';
    const versoes = [];
    const hoje = new Date();
    for (let i = 0; i < 4; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const base = d.getFullYear() - 2020;
      versoes.push(`10.${base}A-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    if (versaoDetectada && !versoes.includes(versaoDetectada)) {
      versoes.unshift(versaoDetectada);
    }
    estado.versoes = versoes;
    for (const v of versoes) {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      if (v === versaoDetectada) opt.selected = true;
      els.seletorVersao.appendChild(opt);
    }
  }

  function atualizarTimestamp(fonte, ts) {
    const agora = ts ? new Date(ts) : new Date();
    const prefixo = fonte === 'cache' ? 'Cache de' : 'Atualizado';
    els.atualizadoLabel.textContent = `${prefixo}: ${agora.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  function formatarPeriodo(inicio, fim) {
    if (!inicio || !fim) return '';
    const fmt = d => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return `${fmt(inicio)} - ${fmt(fim)}`;
  }

  /* ============== CARDS ============== */
  const CARD_CONFIG = {
    'saldo-ne': {
      titulo: 'Saldo NE', formato: r => String(r.valor),
      subtitulo: r => {
        const gA = r.detalhes && r.detalhes.grupo_a != null ? r.detalhes.grupo_a : null;
        const gB = r.detalhes && r.detalhes.grupo_b != null ? r.detalhes.grupo_b : null;
        const breakdown = (gA !== null && gB !== null)
          ? `<span class="card__grupo">com SAI: ${gA} | sem SAI: ${gB}</span>`
          : '';
        return `${breakdown}meta: ${r.meta}`;
      },
      extra: r => r.detalhes.variacao !== null ? `${r.detalhes.variacao >= 0 ? '+' : ''}${r.detalhes.variacao} vs anterior` : ''
    },
    'ne-95-dias': {
      titulo: 'NE > 95 Dias', formato: r => String(r.valor),
      subtitulo: r => {
        const internas = r.detalhes && r.detalhes.total_internas != null ? r.detalhes.total_internas : null;
        const total = r.detalhes && r.detalhes.total_geral != null ? r.detalhes.total_geral : null;
        const breakdown = internas !== null
          ? `<span class="card__grupo">externas: ${r.valor} | internas: ${internas} | total: ${total}</span>`
          : '';
        return `${breakdown}meta: ${r.meta}`;
      },
      extra: () => ''
    },
    'criticas-graves-5d': {
      titulo: 'Criticas/Graves 5d', formato: r => `${r.valor}%`,
      subtitulo: r => `meta: ${r.meta}%`,
      extra: r => {
        const ab = r.detalhes.total_abertas || (r.detalhes.abertas_agora || []).length;
        const prazo = `${r.detalhes.dentro_5d}/${r.detalhes.total_periodo} no prazo`;
        return ab > 0 ? (r.detalhes.total_periodo > 0 ? `${prazo} | ${ab} abertas` : `${ab} abertas no saldo`) : prazo;
      }
    },
    'tempo-correcao-ne': {
      titulo: 'Tempo Correcao', formato: r => `${r.valor}%`,
      subtitulo: r => `meta: ${r.meta}%`,
      extra: r => r.detalhes.projecao ? `real: ${r.detalhes.pct_real}%` : ''
    },
    'entrada-ne': {
      titulo: 'Entradas NE', formato: r => String(r.valor),
      subtitulo: r => `${r.detalhes.entradas} ent | ${r.detalhes.liberacoes} lib | ${r.detalhes.descartes} desc`,
      extra: r => `saldo: ${r.detalhes.variacao_saldo >= 0 ? '+' : ''}${r.detalhes.variacao_saldo}`
    }
  };

  function criarCard(id, resultado) {
    const cfg = CARD_CONFIG[id]; if (!cfg) return '';
    const status = resultado.status || 'info';
    const ativo = estado.cardAtivo === id ? ' card--ativo' : '';
    return `
      <div class="card card--${status}${ativo}" data-id="${id}" onclick="App.selecionarCard('${id}')">
        <span class="card__titulo">${cfg.titulo}</span>
        <div class="card__valor">${cfg.formato(resultado)}</div>
        <div class="card__meta">${cfg.subtitulo(resultado)}</div>
        ${cfg.extra(resultado) ? `<span class="card__badge">${cfg.extra(resultado)}</span>` : ''}
      </div>`;
  }

  function renderizarCards() {
    const ordem = ['saldo-ne', 'ne-95-dias', 'criticas-graves-5d', 'tempo-correcao-ne', 'entrada-ne'];
    let html = '';
    for (const id of ordem) {
      const r = estado.resultados[id];
      if (!r || r.status === 'erro') {
        html += `<div class="card card--info"><span class="card__titulo">${(CARD_CONFIG[id] || {}).titulo || id}</span><div class="card__valor">--</div><div class="card__meta">${r ? r.erro : 'Nao calculado'}</div></div>`;
        continue;
      }
      html += criarCard(id, r);
    }
    els.cards.innerHTML = html;
  }

  /* ============== DETALHES ============== */
  function selecionarCard(id) {
    if (estado.cardAtivo === id) { estado.cardAtivo = null; els.detalhes.hidden = true; renderizarCards(); return; }
    estado.cardAtivo = id;
    renderizarCards();
    const r = estado.resultados[id];
    if (!r) return;
    const cfg = CARD_CONFIG[id];
    els.detalhesTitulo.textContent = cfg ? cfg.titulo : id;
    els.detalhes.hidden = false;
    Detalhes.renderizar(id, r, els.detalhesBody);
    els.detalhes.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function fecharDetalhes() { estado.cardAtivo = null; els.detalhes.hidden = true; renderizarCards(); }

  /* ============== FLUXO PRINCIPAL ============== */

  /**
   * Carrega indicadores
   * @param {string} versao - Versao a consultar
   * @param {Object} [opcoes] - { force: bool, fonte: 'cache' }
   */
  async function carregar(versao, opcoes = {}) {
    esconderErro(); esconderBannerOffline(); mostrarLoading(true); fecharDetalhes();
    try {
      const dados = await API.calcularTodos(versao, opcoes);
      estado.resultados = dados.resultados;

      // Verificar fonte dos dados
      if (dados._fonte === 'cache') {
        mostrarBannerOffline(dados._atualizado_em, dados._aviso);
        atualizarTimestamp('cache', dados._atualizado_em);
      } else {
        atualizarTimestamp('odbc');
      }

      // Tentar obter periodo (pode falhar se ODBC estiver fora)
      try {
        const datas = await API.obterDatasVersao(versao || estado.versaoAtual);
        els.periodoLabel.textContent = formatarPeriodo(datas.inicio, datas.fim);
      } catch { /* manter periodo anterior */ }

      renderizarCards();
    } catch (err) { mostrarErro(`Erro ao carregar indicadores: ${err.message}`); }
    finally { mostrarLoading(false); }
  }

  async function iniciar() {
    cachearElementos();
    els.btnOdbc.addEventListener('click', () => carregar(els.seletorVersao.value, { force: true }));
    els.btnCache.addEventListener('click', () => carregar(els.seletorVersao.value, { fonte: 'cache' }));
    els.btnRetry.addEventListener('click', () => carregar(els.seletorVersao.value || estado.versaoAtual));
    els.btnFechar.addEventListener('click', fecharDetalhes);
    els.seletorVersao.addEventListener('change', e => carregar(e.target.value));
    mostrarLoading(true);
    try {
      const vInfo = await API.obterVersaoAtual();
      estado.versaoAtual = vInfo.versao;
      popularVersoes(vInfo.versao);
      els.periodoLabel.textContent = formatarPeriodo(vInfo.inicio, vInfo.fim);
      await carregar(vInfo.versao);
    } catch (err) {
      // ODBC indisponivel: tentar carregar via cache com versao estimada
      console.warn('[app] ODBC indisponivel, tentando cache:', err.message);
      const agora = new Date();
      const anoBase = agora.getFullYear() - 2020;
      const mes = String(agora.getMonth() + 1).padStart(2, '0');
      const versaoEstimada = `10.${anoBase}A-${mes}`;
      estado.versaoAtual = versaoEstimada;
      popularVersoes(versaoEstimada);
      try {
        await carregar(versaoEstimada, { fonte: 'cache' });
      } catch (errCache) {
        mostrarErro(`ODBC e cache indisponiveis: ${errCache.message}`);
        mostrarLoading(false);
      }
    }
  }

  return { iniciar, selecionarCard, fecharDetalhes };
})();

document.addEventListener('DOMContentLoaded', App.iniciar);
