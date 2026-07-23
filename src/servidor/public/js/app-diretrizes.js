/**
 * app-diretrizes.js - Logica principal do dashboard de Diretrizes
 */
/* globals API, Detalhes, DiretrizesCards, DiretrizesSnapshot */
const App = (() => {
  let estado = { versaoAtual: null, versoes: [], resultados: {}, cardAtivo: null, area: 'Escrita' };
  const els = {};

  function cachearElementos() {
    els.loading = document.getElementById('loading');
    els.erroGlobal = document.getElementById('erro-global');
    els.erroMsg = document.getElementById('erro-mensagem');
    els.dashboard = document.getElementById('dashboard-main');
    els.cardsNe = document.getElementById('cards-ne');
    els.cardsSal = document.getElementById('cards-sal');
    els.detalhes = document.getElementById('detalhes-container');
    els.detalhesTitulo = document.getElementById('detalhes-titulo');
    els.detalhesBody = document.getElementById('detalhes-body');
    els.seletorVersao = document.getElementById('seletor-versao');
    els.seletorArea = document.getElementById('seletor-area');
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
    if (els.dashboard) els.dashboard.style.display = v ? 'none' : '';
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
  function esconderBannerOffline() { if (els.bannerOffline) els.bannerOffline.hidden = true; }

  function popularVersoes(versaoDetectada) {
    els.seletorVersao.innerHTML = '';
    const hoje = new Date();
    const m = versaoDetectada && versaoDetectada.match(/^10\.(\d+)A-(\d{2})$/);
    const base = m ? Number(m[1]) : hoje.getFullYear() - 2020;
    const mesAtual = m ? Number(m[2]) : hoje.getMonth() + 1;
    const versoes = [];
    for (let mes = mesAtual; mes >= 1; mes--) versoes.push(`10.${base}A-${String(mes).padStart(2, '0')}`);
    if (versaoDetectada && !versoes.includes(versaoDetectada)) versoes.unshift(versaoDetectada);
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

  function renderizarCards() {
    els.cardsNe.innerHTML = DiretrizesCards.htmlGrid(DiretrizesCards.ORDEM_NE, estado.resultados, estado.cardAtivo);
    els.cardsSal.innerHTML = DiretrizesCards.htmlGrid(DiretrizesCards.ORDEM_SAL, estado.resultados, estado.cardAtivo);
  }

  function aplicarDados(dados) {
    estado.resultados = dados.resultados;
    esconderBannerOffline();
    if (dados._fonte === 'cache') {
      mostrarBannerOffline(dados._atualizado_em, dados._aviso);
      atualizarTimestamp('cache', dados._atualizado_em);
    } else {
      atualizarTimestamp('odbc', dados._atualizado_em);
    }
    renderizarCards();
  }

  function selecionarCard(id) {
    if (estado.cardAtivo === id) { estado.cardAtivo = null; els.detalhes.hidden = true; renderizarCards(); return; }
    estado.cardAtivo = id;
    renderizarCards();
    const r = estado.resultados[id];
    if (!r) return;
    els.detalhesTitulo.textContent = DiretrizesCards.titulo(id);
    els.detalhes.hidden = false;
    Detalhes.renderizar(id, r, els.detalhesBody, { area: estado.area });
    els.detalhes.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function fecharDetalhes() { estado.cardAtivo = null; els.detalhes.hidden = true; renderizarCards(); }

  function tentarSnapshot(versao) {
    const snap = DiretrizesSnapshot.obter(versao, estado.area);
    if (!snap) return false;
    fecharDetalhes();
    aplicarDados(snap);
    return true;
  }

  async function carregar(versao, opcoes = {}) {
    esconderErro();
    if (opcoes.force) DiretrizesSnapshot.limparVersao(versao);
    if (!opcoes.force && !opcoes.fonte && tentarSnapshot(versao)) return;

    esconderBannerOffline();
    mostrarLoading(true);
    fecharDetalhes();
    try {
      const dados = await API.calcularTodos(versao, { ...opcoes, area: estado.area });
      DiretrizesSnapshot.salvar(versao, estado.area, dados);
      aplicarDados(dados);
      if (opcoes.force) DiretrizesSnapshot.prefetch(API, versao, estado.area);
      else if (opcoes.fonte === 'cache') DiretrizesSnapshot.prefetch(API, versao, estado.area, { fonte: 'cache' });

      try {
        const datas = await API.obterDatasVersao(versao || estado.versaoAtual);
        els.periodoLabel.textContent = formatarPeriodo(datas.inicio, datas.fim);
      } catch { /* manter periodo anterior */ }
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
    if (els.seletorArea) {
      els.seletorArea.addEventListener('change', e => {
        estado.area = e.target.value;
        carregar(els.seletorVersao.value || estado.versaoAtual);
      });
    }
    mostrarLoading(true);
    try {
      const vInfo = await API.obterVersaoAtual();
      estado.versaoAtual = vInfo.versao;
      popularVersoes(vInfo.versao);
      els.periodoLabel.textContent = formatarPeriodo(vInfo.inicio, vInfo.fim);
      await carregar(vInfo.versao);
    } catch (err) {
      console.warn('[app] ODBC indisponivel, tentando cache:', err.message);
      const agora = new Date();
      const versaoEstimada = `10.${agora.getFullYear() - 2020}A-${String(agora.getMonth() + 1).padStart(2, '0')}`;
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
