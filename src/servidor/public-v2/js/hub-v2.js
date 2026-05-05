/* globals API */
const Hub = (() => {
  const els = {};

  function cachearElementos() {
    els.loading = document.getElementById('loading');
    els.erro = document.getElementById('erro');
    els.hero = document.getElementById('hub-hero');
    els.heroCount = document.getElementById('hero-count');
    els.heroVersao = document.getElementById('hero-versao');
    els.heroBadge = document.getElementById('hero-badge');
    els.heroTs = document.getElementById('hero-timestamp');
    els.narrativa = document.getElementById('hub-narrativa');
    els.grid = document.getElementById('hub-grid');
    els.sobre = document.getElementById('hub-sobre');
    els.sobreStatus = document.getElementById('sobre-status');
    els.sobreDetalhes = document.getElementById('sobre-detalhes');
  }

  function contarStatus(resultados) {
    let verde = 0, amarelo = 0, vermelho = 0;
    for (const id of Object.keys(resultados)) {
      const r = resultados[id];
      if (!r || r.status === 'erro') continue;
      if (r.status === 'verde') verde++;
      else if (r.status === 'amarelo') amarelo++;
      else vermelho++;
    }
    return { verde, amarelo, vermelho, total: verde + amarelo + vermelho };
  }

  function renderHero(versao, resultados, fonte) {
    const s = contarStatus(resultados);
    els.heroCount.textContent = String(s.verde);
    els.heroVersao.textContent = versao;

    let cls, label;
    if (s.vermelho > 0) {
      cls = 'badge--red';
      label = s.vermelho + ' indicador(es) fora da meta';
    } else if (s.amarelo > 0) {
      cls = 'badge--yellow';
      label = s.amarelo + ' indicador(es) em atencao';
    } else {
      cls = 'badge--green';
      label = 'Indicadores sob controle';
    }
    els.heroBadge.innerHTML = '<span class="badge ' + cls + '">' + label + '</span>';

    const ts = new Date().toLocaleString('pt-BR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
    els.heroTs.textContent = (fonte === 'cache' ? 'Cache de ' : 'Atualizado ') + ts;
    els.narrativa.innerHTML = gerarNarrativa(resultados);
    els.hero.hidden = false;
  }

  function gerarNarrativa(r) {
    const partes = [];
    const saldo = r['saldo-ne'];
    if (saldo && saldo.status !== 'erro') {
      const dir = saldo.valor <= saldo.meta ? 'dentro da meta' : 'acima da meta';
      partes.push('Saldo NE em <strong>' + saldo.valor + '</strong> (meta ' + saldo.meta + ') \u2014 ' + dir);
    }
    const ne95 = r['ne-95-dias'];
    if (ne95 && ne95.status !== 'erro') {
      partes.push('<strong>' + ne95.valor + '</strong> NE(s) acima de 95 dias (meta ' + ne95.meta + ')');
    }
    const tc = r['tempo-correcao-ne'];
    if (tc && tc.status !== 'erro') {
      partes.push('Tempo de correcao em <strong>' + tc.valor + '%</strong> (meta ' + tc.meta + '%)');
    }
    const en = r['entrada-ne'];
    if (en && en.status !== 'erro') {
      const d = en.detalhes;
      partes.push('Entradas: ' + d.entradas + ' | Liberacoes: ' + d.liberacoes + ' | Descartes: ' + d.descartes);
    }
    if (partes.length === 0) return 'Dados indisponiveis para gerar resumo.';
    return partes.join('. ') + '.';
  }

  function metricaDiretrizes(resultados) {
    const s = contarStatus(resultados);
    let cor = 'var(--verde)';
    if (s.vermelho > 0) cor = 'var(--vermelho)';
    else if (s.amarelo > 0) cor = 'var(--amarelo)';
    return { valor: s.verde + '/' + s.total, label: 'indicadores no prazo', cor: cor };
  }

  function renderCards(resultados) {
    const modulos = [
      { href: '/diretrizes.html', title: 'Diretrizes', desc: 'Indicadores de produto: Saldo NE, NE acima de 95 dias, Criticas/Graves, Tempo de correcao e Entradas.', metricFn: metricaDiretrizes },
      { href: '/estudos.html?view=semanal-versao', title: 'Analise Semanal', desc: 'NE por versao com projecao, medias diarias, descartes e Indice de Saude da Versao (ISV).' },
      { href: '/equipes.html', title: 'Metas da Equipe', desc: 'Acompanhamento individual por colaborador: pontos, revisoes, tempo e produtividade.' },
      { href: '/laboratorio.html?view=raio-x', title: 'Laboratorio IA', desc: 'Raio-X da versao, evolucao de complexidade, DNA tecnico e backtest de previsibilidade.' },
      { href: '/proposta-metas.html', title: 'Proposta de Metas', desc: 'Retrospectiva e calibracao de metas da equipe para o proximo ciclo.' },
      { href: '/descartes-tempo.html', title: 'Descartes x Tempo', desc: 'Validacao de tempo lancado no GA para PSAIs descartadas por ano.' }
    ];
    let html = '';
    for (const m of modulos) {
      const metric = m.metricFn ? m.metricFn(resultados) : null;
      html += '<a href="' + m.href + '" class="hub-card">';
      html += '<span class="hub-card__title">' + m.title + '</span>';
      html += '<span class="hub-card__desc">' + m.desc + '</span>';
      if (metric) {
        html += '<div class="hub-card__metric">';
        html += '<span class="hub-card__metric-value" style="color:' + metric.cor + '">' + metric.valor + '</span>';
        html += '<span class="hub-card__metric-label">' + metric.label + '</span>';
        html += '</div>';
      }
      html += '</a>';
    }
    els.grid.innerHTML = html;
    els.grid.hidden = false;
  }

  function renderSobre(saude) {
    if (!saude) { els.sobre.hidden = false; return; }
    const ok = saude.status === 'ok';
    const cls = ok ? 'badge--green' : 'badge--yellow';
    const label = ok ? 'Online' : 'Degradado';
    els.sobreStatus.innerHTML = '<span class="badge ' + cls + '">' + label + '</span>';
    els.sobreDetalhes.innerHTML =
      'Banco: Sybase ASA 9.0 (DSN: pbcvs9)<br>' +
      'Indicadores: ' + (saude.indicadores || '?') + '<br>' +
      'Versao API: ' + (saude.versao || 'v1') + '<br>' +
      'Servidor: localhost:' + window.location.port;
    els.sobre.hidden = false;
  }

  function setupExpandable() {
    const el = document.getElementById('sobre-expandable');
    if (!el) return;
    const trigger = el.querySelector('.expandable__trigger');
    trigger.addEventListener('click', () => el.classList.toggle('expandable--open'));
  }

  async function iniciar() {
    cachearElementos();
    setupExpandable();
    try {
      const [saude, vInfo] = await Promise.all([
        API.obterSaude().catch(() => null),
        API.obterVersaoAtual()
      ]);
      const dados = await API.calcularTodos(vInfo.versao);
      els.loading.hidden = true;
      renderHero(vInfo.versao, dados.resultados, dados._fonte);
      renderCards(dados.resultados);
      renderSobre(saude);
    } catch {
      els.loading.hidden = true;
      els.erro.textContent = 'Nao foi possivel conectar ao servidor. Verifique a rede e tente novamente.';
      els.erro.hidden = false;
      renderCards({});
      els.sobre.hidden = false;
    }
  }

  return { iniciar };
})();

document.addEventListener('DOMContentLoaded', Hub.iniciar);
