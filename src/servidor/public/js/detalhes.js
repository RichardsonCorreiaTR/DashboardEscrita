/**
 * detalhes.js - Renderizadores de detalhes dos indicadores
 *
 * Responsabilidades:
 * - Hiperlinks para SAI/PSAI no SGD
 * - Tabelas detalhadas com movimentacao
 * - Sistema de abas para organizar informacoes
 * - Graficos via Charts.js
 */

/* globals Charts, DetalhesSaldo, DetalhesTabela, DetalhesArea, DetalhesSamSail */
/* eslint-disable no-unused-vars */
const Detalhes = (() => {
  const URL_SAI = 'https://sgsai.dominiosistemas.com.br/sgsai/faces/sai.html?sai=';
  const URL_PSAI = 'https://sgd.dominiosistemas.com.br/sgsa/faces/psai.html?psai=';

  function linkSai(id) {
    if (!id) return '--';
    return `<a href="${URL_SAI}${id}" target="_blank" class="link-sgd">${id}</a>`;
  }

  function linkPsai(id) {
    if (!id) return '--';
    return `<a href="${URL_PSAI}${id}" target="_blank" class="link-sgd">${id}</a>`;
  }

  function fmtData(d) {
    if (!d) return '--';
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  function infoBox(label, valor) {
    return `<div class="info-box"><div class="info-box__label">${label}</div><div class="info-box__valor">${valor}</div></div>`;
  }

  function tbl(colunas, dados) { return DetalhesArea.tbl(colunas, dados); }

  /** Sistema de abas */
  function abasHTML(abas) {
    const btns = abas.map((a, i) =>
      `<button class="aba${i === 0 ? ' aba--ativa' : ''}" data-aba="aba-${a.id}">${a.titulo} (${a.qtd})</button>`
    ).join('');
    const conteudos = abas.map((a, i) =>
      `<div id="aba-${a.id}" class="aba-conteudo${i === 0 ? ' aba-conteudo--ativo' : ''}">${a.html}</div>`
    ).join('');
    return `<div class="abas-container"><div class="abas">${btns}</div>${conteudos}</div>`;
  }

  function inicializarAbas(container) {
    container.querySelectorAll('.abas').forEach(nav => {
      nav.querySelectorAll('.aba').forEach(btn => {
        btn.addEventListener('click', () => {
          const parent = btn.closest('.abas-container');
          parent.querySelectorAll('.aba').forEach(b => b.classList.remove('aba--ativa'));
          parent.querySelectorAll('.aba-conteudo').forEach(c => c.classList.remove('aba-conteudo--ativo'));
          btn.classList.add('aba--ativa');
          const alvo = parent.querySelector(`#${btn.dataset.aba}`);
          if (alvo) alvo.classList.add('aba-conteudo--ativo');
        });
      });
    });
  }

  /* ============== RENDERERS ============== */

  const colsSaiPsai = [
    { label: 'SAI', sortKey: 'i_sai', render: r => linkSai(r.i_sai) },
    { label: 'PSAI', sortKey: 'i_psai', render: r => linkPsai(r.i_psai) }
  ];

  /** SALDO NE — delegado a detalhes-saldo.js */
  function renderSaldo(r, body) {
    DetalhesSaldo.render(r, body, {
      infoBox, tbl, abasHTML, inicializarAbas, fmtData, colsSaiPsai,
      inicializarOrdenacao: () => DetalhesTabela.inicializarOrdenacao(body)
    });
  }

  /** NE > 95 DIAS */
  function render95d(r, body) {
    const d = r.detalhes;
    const lim = d.limite_dias || 95;
    const tl = d.tipo_label || 'NE';
    const fimStr = d.data_referencia ? fmtData(d.data_referencia) : '--';
    const corteStr = d.data_corte_95d ? fmtData(d.data_corte_95d) : '--';

    const proximas = d.proximas_entrar || [];
    const proximasComVersao = proximas.filter(x => x.nomeVersao || x.i_versoes);
    const proximasSemVersao = proximas.filter(x => !x.nomeVersao && !x.i_versoes);

    const colsProximas = [...colsSaiPsai,
      { label: 'Gravidade', render: r => r.gravidade_ne || '--' },
      { label: 'Cadastro', render: r => fmtData(r.CadastroPSAI) },
      { label: 'Dias', render: r => `<strong>${r.dias}</strong>` },
      { label: 'Situacao', render: r => r.i_sai_situacoes || '--' },
      { label: 'Versao', render: r => r.nomeVersao
          ? `<span style="color:var(--verde);font-weight:600">${r.nomeVersao}</span>`
          : (r.i_versoes != null && r.i_versoes !== 0 && r.i_versoes !== '0')
            ? `<span style="color:var(--amarelo);font-weight:600">Alocada</span>`
            : `<span style="color:var(--vermelho)">Sem versao</span>` }
    ];

    body.innerHTML = `
      <div style="background:var(--info-bg);padding:0.6rem 0.8rem;border-radius:6px;margin-bottom:1rem;font-size:0.82rem;line-height:1.6">
        A contagem usa a <strong>data de fim da versao</strong> como referencia, nao a data de hoje.<br>
        <strong>Fim ${d.versao}:</strong> ${fimStr} · <strong>Corte ${lim} dias:</strong> ${corteStr}<br>
        ${tl}s cadastradas ate ${corteStr} que nao forem liberadas/descartadas entram na contagem.
      </div>
      <div class="info-grid">
        ${infoBox(`${tl}s > ${lim}d`, r.valor)}
        ${infoBox('Meta', r.meta)}
        ${infoBox('Prox. c/ Versao', proximasComVersao.length)}
        ${infoBox('Prox. Sem Versao', proximasSemVersao.length)}
      </div>
      <div class="graficos-grid">
        <div class="grafico-container"><canvas id="chart-faixas"></canvas></div>
        <div class="grafico-container"><canvas id="chart-status"></canvas></div>
      </div>
      ${abasHTML([
        { id: 'ne95-antigas', titulo: 'Top 10 Mais Antigas', qtd: (d.top_10_mais_antigas||[]).length, html: tbl(colsProximas, d.top_10_mais_antigas||[]) },
        { id: 'ne95-recem', titulo: `Recem-incluidas (${lim === 140 ? '141-180d' : '96-120d'})`, qtd: (d.recem_incluidas||[]).length, html: tbl(colsProximas, d.recem_incluidas||[]) },
        { id: 'ne95-prox', titulo: `Proximas a entrar (${lim === 140 ? '110-140d' : '65-95d'})`, qtd: proximas.length,
          html: tbl(colsProximas, proximas) }
      ])}
    `;
    const faixas = d.por_faixa || [];
    const statusExt = d.por_status || { na_versao: 0, alocada: 0, sem_versao: 0 };
    if (faixas.some(f => f.qtd > 0)) Charts.barrasFaixas('chart-faixas', faixas, `${tl}s por Faixa de Idade`);
    Charts.barrasStatusVersao('chart-status', statusExt);
    inicializarAbas(body);
  }

  /** CRITICAS/GRAVES 5D */
  function renderCriticas(r, body) {
    const d = r.detalhes;
    const todos = d.casos || [];
    const fora = d.casos_fora_5d || [];
    const abertas = d.abertas_agora || [];
    const colsCasos = [...colsSaiPsai,
      { label: 'Gravidade', render: r => r.gravidade || '--' },
      { label: 'Cadastro', render: r => fmtData(r.cadastro) },
      { label: 'Liberacao', render: r => fmtData(r.liberacao) },
      { label: 'Via', render: r => r.via || '--' },
      { label: 'Dias Uteis', render: r => `<strong>${r.dias_uteis}</strong>` },
      { label: 'Prazo', render: r => r.dentro_5d
        ? '<span style="color:var(--verde)">OK</span>'
        : '<span style="color:var(--vermelho)">FORA</span>' }
    ];
    const alertaAbertas = abertas.length > 0
      ? `<div style="background:#fef3c7;border-left:4px solid var(--amarelo);padding:0.6rem 0.8rem;border-radius:6px;margin-bottom:1rem;font-size:0.85rem;">
          <strong>${abertas.length} Critica(s)/Grave(s) aberta(s)</strong> no saldo atual. Veja aba "Abertas Agora".
        </div>` : '';
    body.innerHTML = `
      ${alertaAbertas}
      <div class="info-grid">
        ${infoBox('Percentual', r.valor + '%')}
        ${infoBox('Dentro 5d', d.dentro_5d)}
        ${infoBox('Fora 5d', d.fora_5d)}
        ${infoBox('Total Periodo', d.total_periodo)}
        ${infoBox('Abertas no Saldo', abertas.length)}
      </div>
      <div class="grafico-container"><canvas id="chart-criticas"></canvas></div>
      ${abasHTML([
        { id: 'crit-todos', titulo: 'Todas', qtd: todos.length, html: tbl(colsCasos, todos) },
        { id: 'crit-fora', titulo: 'Fora do Prazo', qtd: fora.length, html: tbl(colsCasos, fora) },
        { id: 'crit-abertas', titulo: 'Abertas Agora', qtd: abertas.length,
          html: tbl([...colsSaiPsai,
            { label: 'Gravidade', render: r => r.gravidade_ne || '--' },
            { label: 'Cadastro', render: r => fmtData(r.CadastroPSAI) },
            { label: 'Dias Corridos', render: r => `<strong>${r.dias_corridos}</strong>` }
          ], abertas) }
      ])}
    `;
    Charts.doughnutPercentual('chart-criticas', d.dentro_5d || 0, d.fora_5d || 0);
    inicializarAbas(body);
  }

  /** ENTRADAS NE */
  function renderEntradas(r, body) {
    const d = r.detalhes;
    const ant = d.versao_anterior;
    const descSit = d.descartes_por_situacao || [];
    const descLista = d.descartes_lista || [];
    const entLista = d.entradas_lista || [];
    const colsEnt = [...colsSaiPsai,
      { label: 'Gravidade', render: r => r.gravidade_ne || '--' },
      { label: 'Cadastro', render: r => fmtData(r.CadastroPSAI) },
      { label: 'Situacao', render: r => r.situacao_nome || (r.i_sai_situacoes ? `ID: ${r.i_sai_situacoes}` : '--') },
      { label: 'Versao', render: r => r.nomeVersao
          ? `<span style="color:var(--verde);font-weight:600">${r.nomeVersao}</span>`
          : (r.i_versoes != null && r.i_versoes !== 0 && r.i_versoes !== '0')
            ? `<span style="color:var(--amarelo);font-weight:600">Alocada</span>`
            : `<span style="color:var(--vermelho)">Sem versao</span>` }
    ];
    body.innerHTML = `
      <div class="info-grid">
        ${infoBox('Entradas', d.entradas)}
        ${infoBox('Liberacoes', d.liberacoes)}
        ${infoBox('Descartes', d.descartes)}
        ${infoBox('Variacao Saldo', (d.variacao_saldo >= 0 ? '+' : '') + d.variacao_saldo)}
      </div>
      <div class="graficos-grid">
        <div class="grafico-container"><canvas id="chart-entrada-saida"></canvas></div>
        <div class="grafico-container"><canvas id="chart-origem"></canvas></div>
      </div>
      <h3 style="margin:1.2rem 0 0.5rem;font-size:0.95rem;">Detalhamento dos Descartes</h3>
      ${abasHTML([
        { id: 'ent-entradas', titulo: 'Entradas', qtd: entLista.length,
          html: tbl(colsEnt, entLista) },
        { id: 'ent-situacao', titulo: 'Descartes por Situacao', qtd: descSit.length,
          html: tbl([
            { label: 'Cod', render: r => r.i_sai_situacoes || '--' },
            { label: 'Situacao', render: r => r.situacao_nome || '--' },
            { label: 'Qtd', render: r => `<strong>${r.qtd}</strong>` }
          ], descSit) },
        { id: 'ent-lista', titulo: 'Lista Descartes', qtd: descLista.length,
          html: tbl([...colsSaiPsai,
            { label: 'Data', render: r => fmtData(r.Descarte) },
            { label: 'Gravidade', render: r => r.gravidade_ne || '--' },
            { label: 'Situacao', render: r => r.situacao_nome || `ID: ${r.i_sai_situacoes}` }
          ], descLista) }
      ])}
      ${ant ? `
        <h3 style="margin:1.2rem 0 0.5rem;font-size:0.95rem;">Versao Anterior: ${ant.versao}</h3>
        <div class="info-grid">
          ${infoBox('Entradas', ant.entradas)}
          ${infoBox('Liberacoes', ant.liberacoes)}
          ${infoBox('Descartes', ant.descartes)}
          ${infoBox('Variacao', (ant.variacao_saldo >= 0 ? '+' : '') + ant.variacao_saldo)}
        </div>
      ` : ''}
    `;
    Charts.barrasEntradaSaida('chart-entrada-saida', { entradas: d.entradas, liberacoes: d.liberacoes, descartes: d.descartes });
    if (d.origem) Charts.barrasOrigem('chart-origem', d.origem);
    inicializarAbas(body);
  }

  /** Ponto de entrada unico */
  function renderizar(id, resultado, body, ctx = {}) {
    DetalhesArea.setContext(ctx.area || 'Escrita');
    const mapa = {
      'saldo-ne': renderSaldo,
      'saldo-sal': renderSaldo,
      'ne-95-dias': render95d,
      'idade-sal': render95d,
      'criticas-graves-5d': renderCriticas,
      'tempo-correcao-ne': (r, body) => DetalhesTempo.render(r, body, {
        colsSaiPsai, infoBox, abasHTML, tbl, fmtData, inicializarAbas
      }),
      'tempo-implementacao-sal': (r, body) => DetalhesTempo.render(r, body, {
        colsSaiPsai, infoBox, abasHTML, tbl, fmtData, inicializarAbas
      }),
      'tempo-implementacao-sam-sail': (r, body) => DetalhesTempo.render(r, body, {
        colsSaiPsai, infoBox, abasHTML, tbl, fmtData, inicializarAbas
      }),
      'liberadas-sam-sail': (r, body) => DetalhesSamSail.renderLiberadas(r, body, {
        colsSaiPsai, infoBox, abasHTML, tbl, fmtData, inicializarAbas
      }),
      'entrada-ne': renderEntradas,
      'entrada-sal': renderEntradas
    };
    const fn = mapa[id];
    DetalhesTabela.limparStore();
    if (fn) fn(resultado, body);
    else body.innerHTML = `<pre>${JSON.stringify(resultado, null, 2)}</pre>`;
    if (DetalhesArea.mostrar()) {
      if (DetalhesArea.faltaAreaNasListas(resultado)) {
        body.insertAdjacentHTML('afterbegin', DetalhesArea.avisoCacheHTML());
      } else {
        body.insertAdjacentHTML('afterbegin', DetalhesArea.legendaHTML());
      }
    }
    DetalhesTabela.inicializarOrdenacao(body);
  }

  return { renderizar };
})();
