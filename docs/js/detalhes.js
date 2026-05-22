/**
 * detalhes.js - Renderizadores de detalhes dos indicadores
 *
 * Responsabilidades:
 * - Hiperlinks para SAI/PSAI no SGD
 * - Tabelas detalhadas com movimentacao
 * - Sistema de abas para organizar informacoes
 * - Graficos via Charts.js
 */

/* globals Charts */
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

  function tabela(colunas, dados) {
    if (!dados || dados.length === 0) return '<p style="color:var(--cor-texto-sec);font-size:0.8rem;padding:0.5rem;">Nenhum registro</p>';
    const ths = colunas.map(c => `<th>${c.label}</th>`).join('');
    const trs = dados.map(row => {
      const tds = colunas.map(c => `<td>${c.render(row)}</td>`).join('');
      return `<tr>${tds}</tr>`;
    }).join('');
    return `<table class="tabela-detalhes"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  }

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
    { label: 'SAI', render: r => linkSai(r.i_sai) },
    { label: 'PSAI', render: r => linkPsai(r.i_psai) }
  ];

  /** SALDO NE */
  function renderSaldo(r, body) {
    const d = r.detalhes;
    const mov = d.movimentacao || {};
    const libArq = mov.liberadas_arquivo || [];
    const emArq = mov.em_arquivo || [];
    const aloc = mov.alocadas || [];
    const totalLib = (mov.liberadas ? mov.liberadas.length : 0) + libArq.length;
    const totalProj = (mov.pendentes ? mov.pendentes.length : 0) + emArq.length + aloc.length;
    const estSaldoFinal = r.valor - totalProj;

    // Consolidar liberadas (versao + arquivo) com coluna "Via"
    const todasLib = [
      ...(mov.liberadas || []).map(x => ({ ...x, _via: x.nomeVersao || d.versao })),
      ...libArq.map(x => ({ ...x, _via: x.nomeVersao || 'Arquivo' }))
    ];

    // Consolidar projecao (pendentes + em arquivo + alocadas) com coluna "Status"
    const todaProj = [
      ...(mov.pendentes || []).map(x => ({ ...x, _status: 'Pendente', _ref: x.nomeVersao || d.versao })),
      ...emArq.map(x => ({ ...x, _status: 'Em arquivo', _ref: x.nomeVersao || '--' })),
      ...aloc.map(x => ({ ...x, _status: 'Alocada', _ref: '--' }))
    ];

    // Calcular indice da versao atual (0-11)
    const parsedVersao = d.versao ? d.versao.match(/-(\d+)$/) : null;
    const indiceAtual = parsedVersao ? parseInt(parsedVersao[1], 10) - 1 : new Date().getMonth();

    // Dados de movimentacao para o grafico
    const nEntradas = mov.entradas ? mov.entradas.length : 0;
    const nDescartes = mov.descartes ? mov.descartes.length : 0;
    const nPendentes = mov.pendentes ? mov.pendentes.length : 0;

    body.innerHTML = `
      <div class="info-grid">
        ${infoBox('Saldo Atual', r.valor)}
        ${infoBox('Meta', r.meta)}
        ${infoBox('Anterior', d.saldo_versao_anterior ?? '--')}
        ${infoBox('Variacao', d.variacao !== null ? (d.variacao >= 0 ? '+' : '') + d.variacao : '--')}
        ${infoBox('Liberadas', totalLib)}
        ${infoBox('Proj. Liberacao', totalProj)}
      </div>
      <div class="estimativa-box">
        <span class="estimativa-box__label">Estimativa Saldo Final da Versao</span>
        <span class="estimativa-box__valor ${estSaldoFinal <= r.meta ? 'estimativa-box__valor--ok' : 'estimativa-box__valor--alerta'}">${estSaldoFinal}</span>
        <span class="estimativa-box__detalhe">
          ${r.valor} (atual) - ${totalProj} (proj. liberacao) = <strong>${estSaldoFinal}</strong>
          ${estSaldoFinal <= r.meta ? ' &check; dentro da meta' : ` &cross; meta: ${r.meta}`}
        </span>
      </div>
      <div class="grafico-container grafico-container--wide"><canvas id="chart-trajetoria"></canvas></div>
      <div class="graficos-grid">
        <div class="grafico-container"><canvas id="chart-movimentacao"></canvas></div>
        <div class="grafico-container"><canvas id="chart-projecao"></canvas></div>
      </div>
      <h3 style="margin:1.2rem 0 0.5rem;font-size:0.95rem;">Movimentacao da Versao ${d.versao}</h3>
      ${abasHTML([
        { id: 'entradas', titulo: 'Entradas', qtd: mov.entradas ? mov.entradas.length : 0,
          html: tabela([...colsSaiPsai,
            { label: 'Cadastro', render: r => fmtData(r.CadastroPSAI) },
            { label: 'Gravidade', render: r => r.gravidade_ne || '--' },
            { label: 'Origem', render: r => r.NE_PREVENCAO === 1 ? 'Interna' : 'Externa' }
          ], mov.entradas) },
        { id: 'descartes', titulo: 'Descartes', qtd: mov.descartes ? mov.descartes.length : 0,
          html: tabela([...colsSaiPsai,
            { label: 'Data', render: r => fmtData(r.Descarte) },
            { label: 'Gravidade', render: r => r.gravidade_ne || '--' },
            { label: 'Situacao', render: r => r.situacao_nome || `ID: ${r.i_sai_situacoes}` }
          ], mov.descartes) },
        { id: 'liberadas', titulo: 'Liberadas', qtd: todasLib.length,
          html: tabela([...colsSaiPsai,
            { label: 'Liberacao', render: r => fmtData(r.Liberacao) },
            { label: 'Gravidade', render: r => r.gravidade_ne || '--' },
            { label: 'Via', render: r => r._via || '--' }
          ], todasLib) },
        { id: 'projecao', titulo: 'Proj. Liberacao', qtd: todaProj.length,
          html: tabela([...colsSaiPsai,
            { label: 'Gravidade', render: r => r.gravidade_ne || '--' },
            { label: 'Status', render: r => r._status || '--' },
            { label: 'Ref.', render: r => r._ref || '--' }
          ], todaProj) }
      ])}
    `;
    // Grafico 1: Trajetoria Saldo vs Meta (linha)
    Charts.linhaTrajetoria('chart-trajetoria', {
      metas: d.metas_mensais || [],
      versaoAtual: d.versao,
      indiceAtual,
      saldoAtual: r.valor,
      saldoAnterior: d.saldo_versao_anterior,
      estimativa: estSaldoFinal
    });

    // Grafico 2: Movimentacao da versao (barras horizontais)
    Charts.barrasMovimentacao('chart-movimentacao', {
      entradas: nEntradas,
      liberadas: totalLib,
      descartes: nDescartes,
      projecao: totalProj
    });

    // Grafico 3: Composicao da projecao (doughnut)
    Charts.doughnutProjecao('chart-projecao', {
      pendentes: nPendentes,
      emArquivo: emArq.length,
      alocadas: aloc.length
    });

    inicializarAbas(body);
  }

  /** NE > 95 DIAS */
  function render95d(r, body) {
    const d = r.detalhes;
    const faixas = d.por_faixa || [];
    const fimStr = d.data_referencia ? fmtData(d.data_referencia) : '--';
    const corteStr = d.data_corte_95d ? fmtData(d.data_corte_95d) : '--';

    // Calcular breakdown das proximas a entrar (externas com/sem versao)
    const proximas = d.proximas_entrar || [];
    const proximasExternas = proximas.filter(x => x.NE_PREVENCAO !== 1);
    const proximasComVersao = proximasExternas.filter(x => x.nomeVersao || x.i_versoes);
    const proximasSemVersao = proximasExternas.filter(x => !x.nomeVersao && !x.i_versoes);

    const colsNE = [...colsSaiPsai,
      { label: 'Gravidade', render: r => r.gravidade_ne || '--' },
      { label: 'Cadastro', render: r => fmtData(r.CadastroPSAI) },
      { label: 'Dias', render: r => `<strong>${r.dias}</strong>` },
      { label: 'Situacao', render: r => r.i_sai_situacoes || '--' },
      { label: 'Origem', render: r => r.NE_PREVENCAO === 1 ? 'Interna' : 'Externa' }
    ];

    const colsProximas = [...colsSaiPsai,
      { label: 'Gravidade', render: r => r.gravidade_ne || '--' },
      { label: 'Cadastro', render: r => fmtData(r.CadastroPSAI) },
      { label: 'Dias', render: r => `<strong>${r.dias}</strong>` },
      { label: 'Situacao', render: r => r.i_sai_situacoes || '--' },
      { label: 'Origem', render: r => r.NE_PREVENCAO === 1 ? 'Interna' : 'Externa' },
      { label: 'Versao', render: r => r.nomeVersao
          ? `<span style="color:var(--verde);font-weight:600">${r.nomeVersao}</span>`
          : (r.i_versoes != null && r.i_versoes !== 0 && r.i_versoes !== '0')
            ? `<span style="color:var(--amarelo);font-weight:600">Alocada</span>`
            : `<span style="color:var(--vermelho)">Sem versao</span>` }
    ];

    body.innerHTML = `
      <div style="background:var(--info-bg);padding:0.6rem 0.8rem;border-radius:6px;margin-bottom:1rem;font-size:0.82rem;line-height:1.6">
        A contagem usa a <strong>data de fim da versao</strong> como referencia, nao a data de hoje.<br>
        <strong>Fim ${d.versao}:</strong> ${fimStr} · <strong>Corte 95 dias:</strong> ${corteStr}<br>
        NEs cadastradas ate ${corteStr} que nao forem liberadas/descartadas entram na contagem.
      </div>
      <div class="info-grid">
        ${infoBox('Externas > 95d', r.valor)}
        ${infoBox('Meta', r.meta)}
        ${infoBox('Internas', d.total_internas ?? '--')}
        ${infoBox('Total Geral', d.total_geral ?? '--')}
      </div>
      <div class="info-grid" style="margin-top:0.75rem">
        ${infoBox('Proximas Ext. c/ Versao', proximasComVersao.length)}
        ${infoBox('Proximas Ext. Sem Versao', proximasSemVersao.length)}
      </div>
      <div class="graficos-grid">
        <div class="grafico-container"><canvas id="chart-faixas-internas"></canvas></div>
        <div class="grafico-container"><canvas id="chart-faixas-externas"></canvas></div>
      </div>
      ${abasHTML([
        { id: 'ne95-antigas', titulo: 'Top 10 Mais Antigas', qtd: (d.top_10_mais_antigas||[]).length, html: tabela(colsProximas, d.top_10_mais_antigas||[]) },
        { id: 'ne95-recem', titulo: 'Recem-incluidas (96-120d)', qtd: (d.recem_incluidas||[]).length, html: tabela(colsProximas, d.recem_incluidas||[]) },
        { id: 'ne95-prox', titulo: 'Proximas a entrar (65-95d)', qtd: proximas.length,
          html: tabela(colsProximas, proximas) }
      ])}
    `;
    const faixasInt = d.por_faixa_internas || [];
    const statusExt = d.externas_por_status || { na_versao: 0, alocada: 0, sem_versao: 0 };
    if (faixasInt.some(f => f.qtd > 0)) Charts.barrasFaixas('chart-faixas-internas', faixasInt, 'NEs Internas por Faixa de Idade');
    Charts.barrasStatusVersao('chart-faixas-externas', statusExt);
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
        { id: 'crit-todos', titulo: 'Todas', qtd: todos.length, html: tabela(colsCasos, todos) },
        { id: 'crit-fora', titulo: 'Fora do Prazo', qtd: fora.length, html: tabela(colsCasos, fora) },
        { id: 'crit-abertas', titulo: 'Abertas Agora', qtd: abertas.length,
          html: tabela([...colsSaiPsai,
            { label: 'Gravidade', render: r => r.gravidade_ne || '--' },
            { label: 'Cadastro', render: r => fmtData(r.CadastroPSAI) },
            { label: 'Dias Corridos', render: r => `<strong>${r.dias_corridos}</strong>` }
          ], abertas) }
      ])}
    `;
    Charts.doughnutPercentual('chart-criticas', d.dentro_5d || 0, d.fora_5d || 0);
    inicializarAbas(body);
  }

  /** TEMPO CORRECAO */
  function renderTempo(r, body) {
    const d = r.detalhes;
    const pctBarra = Math.min(100, (r.valor / (r.meta || 1)) * 100);
    const cor = r.status === 'verde' ? 'var(--verde)' : r.status === 'amarelo' ? 'var(--amarelo)' : 'var(--vermelho)';
    const bk = d.breakdown_tipo || {};
    const tiposHTML = Object.entries(bk).map(([t, q]) => infoBox(t, q)).join('');
    const fm = v => v != null ? v.toLocaleString('pt-BR') : '0';
    const dv = d.tempo_dev || {}; const ts = d.tempo_teste || {};
    const pr = d.tempo_prep || {}; const sm = d.tempo_soma || {};
    const par = d.tempo_paralelo || {};
    const sais = d.sais || [];
    const saisNe = sais.filter(s => s.tipo === 'NE');
    const saisOutras = sais.filter(s => s.tipo !== 'NE');
    const saisPar = d.sais_paralelo || [];
    const colsDet = [...colsSaiPsai,
      { label: 'Tipo', render: r => r.tipo || '--' },
      { label: 'Via', render: r => r.via || '--' },
      { label: 'Dev (min)', render: r => fm(r.dev) },
      { label: 'Teste (min)', render: r => fm(r.teste) },
      { label: 'Prep (min)', render: r => fm(r.prep) },
      { label: 'Total (min)', render: r => `<strong>${fm(r.total)}</strong>` }
    ];
    const timeRows = [['Desenvolvimento',dv],['Teste',ts],['Preparacao',pr]].map(([n,c]) =>
      `<tr><td style="padding:4px 8px;">${n}</td><td style="text-align:right;padding:4px 8px;">${fm(c.total)}</td><td style="text-align:right;padding:4px 8px;">${fm(c.ne)}</td></tr>`
    ).join('');
    const temParalelo = par.total > 0;
    body.innerHTML = `
      <div class="info-grid">
        ${infoBox('% Tempo NE', r.valor + '%')}
        ${infoBox('Meta Mes', r.meta + '%')}
        ${infoBox('NEs Externas', d.total_sai_ne)}
        ${infoBox('NEs Internas', d.total_sai_ne_internas ?? '--')}
        ${infoBox('SAIs Liberadas', d.total_sai_liberada)}
        ${infoBox('SAIs Paralelo', d.qtd_paralelo != null ? d.qtd_paralelo : '0')}
        ${infoBox('Na Versao', d.qtd_versao != null ? d.qtd_versao : '--')}
      </div>
      <div style="margin:1rem 0;">
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:0.3rem;">
          <span>NE: ${r.valor}%</span><span>Meta: ${r.meta}%</span>
        </div>
        <div style="background:#e2e8f0;border-radius:8px;height:24px;overflow:hidden;">
          <div style="background:${cor};height:100%;width:${pctBarra}%;border-radius:8px;transition:width 0.5s;"></div>
        </div>
      </div>
      <div style="background:var(--cor-fundo);padding:1rem;border-radius:8px;font-size:0.8rem;margin-top:0.8rem;">
        <table style="width:100%;border-collapse:collapse;">
          <tr style="border-bottom:1px solid var(--cor-borda);">
            <th style="text-align:left;padding:4px 8px;">Componente</th>
            <th style="text-align:right;padding:4px 8px;">Total (min)</th>
            <th style="text-align:right;padding:4px 8px;">NE (min)</th>
          </tr>
          ${timeRows}
          <tr style="border-top:1px solid var(--cor-borda);font-weight:600;">
            <td style="padding:4px 8px;">Subtotal Liberadas</td>
            <td style="text-align:right;padding:4px 8px;">${fm(d.tempo_liberadas)}</td>
            <td style="text-align:right;padding:4px 8px;">${fm(sm.ne)}</td></tr>
          ${temParalelo ? `
          <tr style="color:#6366f1;">
            <td style="padding:4px 8px;">Paralelo (Dev)</td>
            <td style="text-align:right;padding:4px 8px;">${fm(par.dev)}</td>
            <td style="text-align:right;padding:4px 8px;">--</td></tr>
          <tr style="color:#6366f1;">
            <td style="padding:4px 8px;">Paralelo (Teste+Prep)</td>
            <td style="text-align:right;padding:4px 8px;">${fm(par.teste + par.prep)}</td>
            <td style="text-align:right;padding:4px 8px;">--</td></tr>` : ''}
          <tr style="border-top:2px solid var(--cor-borda);font-weight:700;">
            <td style="padding:4px 8px;">TOTAL GERAL</td>
            <td style="text-align:right;padding:4px 8px;">${fm(sm.total)}</td>
            <td style="text-align:right;padding:4px 8px;">${fm(sm.ne)}</td></tr>
        </table>
        <div style="margin-top:0.6rem;"><strong>Formula:</strong> ${d.formula || '--'}</div>
      </div>
      <div style="margin-top:0.8rem;">
        <div style="font-size:0.85rem;font-weight:600;margin-bottom:0.4rem;">SAIs Liberadas por Tipo</div>
        <div class="info-grid">${tiposHTML}</div>
      </div>
      <h3 style="margin:1.2rem 0 0.5rem;font-size:0.95rem;">Detalhamento por SAI</h3>
      ${abasHTML([
        { id: 'tempo-ne', titulo: 'NEs', qtd: saisNe.length, html: tabela(colsDet, saisNe) },
        { id: 'tempo-outras', titulo: 'Outras SAIs', qtd: saisOutras.length, html: tabela(colsDet, saisOutras) },
        { id: 'tempo-paralelo', titulo: 'Paralelo', qtd: saisPar.length, html: tabela(colsDet, saisPar) },
        { id: 'tempo-todas', titulo: 'Todas', qtd: sais.length + saisPar.length, html: tabela(colsDet, [...sais, ...saisPar]) }
      ])}
    `;
    inicializarAbas(body);
  }

  /** ENTRADAS NE */
  function renderEntradas(r, body) {
    const d = r.detalhes;
    const ant = d.versao_anterior;
    const descSit = d.descartes_por_situacao || [];
    const descLista = d.descartes_lista || [];
    const entLista = d.entradas_lista || [];
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
          html: tabela([...colsSaiPsai,
            { label: 'Gravidade', render: r => r.gravidade_ne || '--' },
            { label: 'Cadastro', render: r => fmtData(r.CadastroPSAI) },
            { label: 'Situacao', render: r => r.situacao_nome || (r.i_sai_situacoes ? `ID: ${r.i_sai_situacoes}` : '--') },
            { label: 'Origem', render: r => r.NE_PREVENCAO === 1 ? 'Interna' : 'Externa' },
            { label: 'Versao', render: r => r.nomeVersao
                ? `<span style="color:var(--verde);font-weight:600">${r.nomeVersao}</span>`
                : (r.i_versoes != null && r.i_versoes !== 0 && r.i_versoes !== '0')
                  ? `<span style="color:var(--amarelo);font-weight:600">Alocada</span>`
                  : `<span style="color:var(--vermelho)">Sem versao</span>` }
          ], entLista) },
        { id: 'ent-situacao', titulo: 'Descartes por Situacao', qtd: descSit.length,
          html: tabela([
            { label: 'Cod', render: r => r.i_sai_situacoes || '--' },
            { label: 'Situacao', render: r => r.situacao_nome || '--' },
            { label: 'Qtd', render: r => `<strong>${r.qtd}</strong>` }
          ], descSit) },
        { id: 'ent-lista', titulo: 'Lista Descartes', qtd: descLista.length,
          html: tabela([...colsSaiPsai,
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
  function renderizar(id, resultado, body) {
    const mapa = {
      'saldo-ne': renderSaldo,
      'ne-95-dias': render95d,
      'criticas-graves-5d': renderCriticas,
      'tempo-correcao-ne': renderTempo,
      'entrada-ne': renderEntradas
    };
    const fn = mapa[id];
    if (fn) fn(resultado, body);
    else body.innerHTML = `<pre>${JSON.stringify(resultado, null, 2)}</pre>`;
  }

  return { renderizar };
})();
