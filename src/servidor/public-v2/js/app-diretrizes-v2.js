/* globals API, Detalhes, DiretrizesResumo */
const App = (() => {
  let estado = { versaoAtual: null, versoes: [], resultados: {}, cardAtivo: null };
  const els = {};

  function cachearElementos() {
    const mapa = {
      loading: 'loading', conteudo: 'conteudo', erroGlobal: 'erro-global',
      erroMsg: 'erro-mensagem', cards: 'cards-container', instrucao: 'instrucao',
      heroResumo: 'hero-resumo', leituraGeral: 'leitura-geral',
      detalhes: 'detalhes-container', detalhesTitulo: 'detalhes-titulo',
      detalhesBody: 'detalhes-body', seletorVersao: 'seletor-versao',
      periodoLabel: 'periodo-label', atualizadoLabel: 'atualizado-label',
      btnOdbc: 'btn-odbc', btnCache: 'btn-cache', btnRetry: 'btn-retry',
      btnFechar: 'btn-fechar-detalhes', bannerOffline: 'banner-offline',
      bannerMsg: 'banner-offline-msg'
    };
    for (const [k, id] of Object.entries(mapa)) els[k] = document.getElementById(id);
  }

  function mostrarLoading(v) {
    els.loading.hidden = !v;
    if (els.conteudo) els.conteudo.hidden = v;
  }
  function mostrarErro(msg) {
    els.erroGlobal.hidden = false;
    els.erroMsg.textContent = msg;
    mostrarLoading(false);
  }
  function esconderErro() { els.erroGlobal.hidden = true; }
  function esconderBannerOffline() { if (els.bannerOffline) els.bannerOffline.hidden = true; }

  function mostrarBannerOffline(atualizado, aviso) {
    if (!els.bannerOffline) return;
    const dataFmt = atualizado
      ? new Date(atualizado).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
      : 'desconhecido';
    els.bannerMsg.textContent = aviso || 'Dados do cache (atualizado em ' + dataFmt + '). Conecte ao banco para dados ao vivo.';
    els.bannerOffline.hidden = false;
  }

  function popularVersoes(versaoDetectada) {
    els.seletorVersao.innerHTML = '';
    const hoje = new Date();
    const versoes = Array.from({ length: 4 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      return '10.' + (d.getFullYear() - 2020) + 'A-' + String(d.getMonth() + 1).padStart(2, '0');
    });
    if (versaoDetectada && !versoes.includes(versaoDetectada)) versoes.unshift(versaoDetectada);
    estado.versoes = versoes;
    versoes.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      if (v === versaoDetectada) opt.selected = true;
      els.seletorVersao.appendChild(opt);
    });
  }

  function atualizarTimestamp(fonte, ts) {
    const agora = ts ? new Date(ts) : new Date();
    const prefixo = fonte === 'cache' ? 'Cache de' : 'Atualizado';
    const fmt = agora.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) +
      ' ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    els.atualizadoLabel.textContent = prefixo + ': ' + fmt;
  }

  function formatarPeriodo(inicio, fim) {
    if (!inicio || !fim) return '';
    const fmt = d => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return fmt(inicio) + ' \u2013 ' + fmt(fim);
  }

  function corDoStatus(status) {
    if (status === 'verde') return 'badge--green';
    if (status === 'amarelo') return 'badge--yellow';
    if (status === 'vermelho') return 'badge--red';
    return 'badge--blue';
  }

  function criarCard(id, resultado) {
    const cfg = DiretrizesResumo.CARD_CONFIG[id];
    if (!cfg) return '';
    const ativo = estado.cardAtivo === id ? ' indicator-card--ativo' : '';
    const extra = cfg.extra(resultado);
    return '<button class="indicator-card' + ativo + '" data-id="' + id + '"' +
      ' aria-pressed="' + (estado.cardAtivo === id) + '" title="' + (cfg.tooltip || '') + '">' +
      '<div class="indicator-card__header">' +
      '<span class="indicator-card__title">' + cfg.titulo + '</span>' +
      '<span class="badge ' + corDoStatus(resultado.status) + '">' + resultado.status + '</span></div>' +
      '<div class="indicator-card__value">' + cfg.formato(resultado) + '</div>' +
      '<span class="indicator-card__meta">' + cfg.subtitulo(resultado) + '</span>' +
      (extra ? '<span class="indicator-card__extra">' + extra + '</span>' : '') +
      '</button>';
  }

  function renderizarCards() {
    const ordem = ['saldo-ne', 'ne-95-dias', 'criticas-graves-5d', 'tempo-correcao-ne', 'entrada-ne'];
    let html = '';
    for (const id of ordem) {
      const r = estado.resultados[id];
      if (!r || r.status === 'erro') {
        const t = (DiretrizesResumo.CARD_CONFIG[id] || {}).titulo || id;
        html += '<div class="indicator-card" style="opacity:0.6"><div class="indicator-card__header">' +
          '<span class="indicator-card__title">' + t + '</span></div>' +
          '<div class="indicator-card__value">--</div>' +
          '<span class="indicator-card__meta">' + (r ? r.erro : 'Nao calculado') + '</span></div>';
        continue;
      }
      html += criarCard(id, r);
    }
    els.cards.innerHTML = html;
    els.cards.querySelectorAll('.indicator-card[data-id]').forEach(btn => {
      btn.addEventListener('click', () => selecionarCard(btn.dataset.id));
    });
  }

  function selecionarCard(id) {
    if (estado.cardAtivo === id) { fecharDetalhes(); return; }
    estado.cardAtivo = id;
    renderizarCards();
    const r = estado.resultados[id];
    if (!r) return;
    const cfg = DiretrizesResumo.CARD_CONFIG[id];
    els.detalhesTitulo.textContent = cfg ? cfg.titulo : id;
    els.detalhes.hidden = false;
    els.instrucao.hidden = true;
    Detalhes.renderizar(id, r, els.detalhesBody);
    els.detalhes.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function fecharDetalhes() {
    estado.cardAtivo = null;
    els.detalhes.hidden = true;
    els.instrucao.hidden = false;
    renderizarCards();
  }

  function processarResultado(versao, dados) {
    estado.resultados = dados.resultados;
    if (dados._fonte === 'cache') {
      mostrarBannerOffline(dados._atualizado_em, dados._aviso);
      atualizarTimestamp('cache', dados._atualizado_em);
    } else {
      atualizarTimestamp('odbc');
    }
    document.title = 'Diretrizes ' + (versao || '') + ' | Escrita Fiscal';
    DiretrizesResumo.renderHeroResumo(els.heroResumo, estado.resultados);
    renderizarCards();
    const leitura = DiretrizesResumo.gerarLeitura(estado.resultados);
    els.leituraGeral.innerHTML = leitura || '';
    els.leituraGeral.hidden = !leitura;
  }

  async function carregar(versao, opcoes) {
    opcoes = opcoes || {};
    esconderErro(); esconderBannerOffline(); mostrarLoading(true); fecharDetalhes();
    try {
      const dados = await API.calcularTodos(versao, opcoes);
      processarResultado(versao, dados);
      try {
        const datas = await API.obterDatasVersao(versao || estado.versaoAtual);
        els.periodoLabel.textContent = formatarPeriodo(datas.inicio, datas.fim);
      } catch { /* manter periodo anterior */ }
    } catch (err) {
      mostrarErro('Erro ao carregar indicadores: ' + err.message);
    } finally {
      mostrarLoading(false);
    }
  }

  async function fallbackCache(err) {
    console.warn('[diretrizes] ODBC indisponivel:', err.message);
    const agora = new Date();
    const v = '10.' + (agora.getFullYear() - 2020) + 'A-' + String(agora.getMonth() + 1).padStart(2, '0');
    estado.versaoAtual = v;
    popularVersoes(v);
    try { await carregar(v, { fonte: 'cache' }); }
    catch (e2) { mostrarErro('ODBC e cache indisponiveis: ' + e2.message); mostrarLoading(false); }
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
    } catch (err) { await fallbackCache(err); }
  }

  return { iniciar };
})();
document.addEventListener('DOMContentLoaded', App.iniciar);
