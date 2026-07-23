/**
 * detalhes-saldo.js - Renderizador de detalhes do indicador Saldo NE
 */
/* globals Charts */
/* eslint-disable no-unused-vars */
const DetalhesSaldo = (() => {
  function fmtSituacao(row, fallback) {
    const id = row.i_sai_situacoes;
    const nome = row.situacao_nome;
    if (nome) {
      const idNum = id != null && Number(id) !== 0 ? Number(id) : null;
      return idNum != null ? `${idNum} - ${nome}` : String(nome);
    }
    if (id != null && Number(id) !== 0) return `ID: ${id}`;
    return fallback || '--';
  }

  function render(r, body, h) {
    const d = r.detalhes;
    const mov = d.movimentacao || {};
    const listaInterna = (mov.excluidas_liberadas || []).map(x => ({
      ...x, _via: x.nomeVersao || d.versao
    }));
    const libArq = mov.liberadas_arquivo || [];
    const emArq = mov.em_arquivo || [];
    const aloc = mov.alocadas || [];
    const totalLib = (mov.liberadas?.length || 0) + libArq.length;
    const totalProj = (mov.pendentes?.length || 0) + emArq.length + aloc.length;
    const estSaldoFinal = r.valor - totalProj;
    const nEntradas = (mov.entradas || []).length;
    const nDescartes = (mov.descartes || []).length;
    const nPendentes = (mov.pendentes || []).length;
    const varMov = d.variacao_movimento;
    const varOk = d.variacao !== null && varMov === d.variacao;

    const todasLib = [
      ...(mov.liberadas || []).map(x => ({ ...x, _via: x.nomeVersao || d.versao })),
      ...libArq.map(x => ({ ...x, _via: x.nomeVersao || 'Arquivo' }))
    ];
    const todaProj = [
      ...(mov.pendentes || []).map(x => ({ ...x, _status: 'Pendente', _ref: x.nomeVersao || d.versao })),
      ...emArq.map(x => ({ ...x, _status: 'Em arquivo', _ref: x.nomeVersao || '--' })),
      ...aloc.map(x => ({ ...x, _status: 'Alocada', _ref: '--' }))
    ];
    const entradas = (mov.entradas || []).slice()
      .sort((a, b) => (Number(a.i_psai) || 0) - (Number(b.i_psai) || 0));

    const parsedVersao = d.versao?.match(/-(\d+)$/) ;
    const indiceAtual = parsedVersao ? parseInt(parsedVersao[1], 10) - 1 : new Date().getMonth();

    const abas = [
      { id: 'entradas', titulo: 'Entradas', qtd: entradas.length,
        html: h.tbl([...h.colsSaiPsai,
          { label: 'Cadastro', render: row => h.fmtData(row.CadastroPSAI) },
          { label: 'Gravidade', render: row => row.gravidade_ne || '--' }
        ], entradas) },
      { id: 'descartes', titulo: 'Descartes', qtd: nDescartes,
        html: h.tbl([...h.colsSaiPsai,
          { label: 'Data', render: row => h.fmtData(row.Descarte) },
          { label: 'Gravidade', render: row => row.gravidade_ne || '--' },
          { label: 'Situacao', render: row => fmtSituacao(row) }
        ], mov.descartes) },
      { id: 'liberadas', titulo: 'Liberadas', qtd: todasLib.length,
        html: h.tbl([...h.colsSaiPsai,
          { label: 'Liberacao', render: row => h.fmtData(row.Liberacao) },
          { label: 'Gravidade', render: row => row.gravidade_ne || '--' },
          { label: 'Via', render: row => row._via || '--' }
        ], todasLib) },
      { id: 'projecao', titulo: 'Proj. Liberacao', qtd: todaProj.length,
        html: h.tbl([...h.colsSaiPsai,
          { label: 'Gravidade', render: row => row.gravidade_ne || '--' },
          { label: 'Status', render: row => fmtSituacao(row, row._status) },
          { label: 'Ref.', render: row => row._ref || '--' }
        ], todaProj) },
      { id: 'interna', titulo: 'Interna', qtd: listaInterna.length,
        html: `<p style="font-size:0.75rem;color:var(--cor-texto-sec);margin:0 0 0.5rem">
          Liberadas fora do escopo do saldo: prevencao interna (NE_PREVENCAO) ou produto_grupo &ne; 1.</p>
        ${h.tbl([...h.colsSaiPsai,
          { label: 'Liberacao', render: row => h.fmtData(row.Liberacao) },
          { label: 'Gravidade', render: row => row.gravidade_ne || '--' },
          { label: 'Via', render: row => row._via || '--' },
          { label: 'Motivo', render: row => row._motivo || '--' }
        ], listaInterna)}` }
    ];

    body.innerHTML = `
      <div class="info-grid">
        ${h.infoBox('Saldo Atual', r.valor)}
        ${h.infoBox('Meta', r.meta)}
        ${h.infoBox('Anterior', d.saldo_versao_anterior ?? '--')}
        ${h.infoBox('Variacao', d.variacao !== null ? `${d.variacao >= 0 ? '+' : ''}${d.variacao}` : '--')}
        ${h.infoBox('Liberadas', totalLib)}
        ${h.infoBox('Proj. Liberacao', totalProj)}
      </div>
      <div class="estimativa-box" style="margin-bottom:0.75rem">
        <span class="estimativa-box__label">Reconciliacao da variacao (produto principal)</span>
        <span class="estimativa-box__detalhe">
          ${nEntradas} entradas &minus; ${nDescartes} descartes &minus; ${totalLib} liberadas
          = <strong>${varMov >= 0 ? '+' : ''}${varMov ?? '--'}</strong>
          ${varOk ? ' &check; bate com variacao' : ''}
        </span>
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
      ${h.abasHTML(abas)}
    `;

    Charts.linhaTrajetoria('chart-trajetoria', {
      metas: d.metas_mensais || [], versaoAtual: d.versao, indiceAtual,
      saldoAtual: r.valor, saldoAnterior: d.saldo_versao_anterior, estimativa: estSaldoFinal
    });
    Charts.barrasMovimentacao('chart-movimentacao', {
      entradas: nEntradas, liberadas: totalLib, descartes: nDescartes, projecao: totalProj
    });
    Charts.doughnutProjecao('chart-projecao', {
      pendentes: nPendentes, emArquivo: emArq.length, alocadas: aloc.length
    });
    h.inicializarAbas(body);
    if (h.inicializarOrdenacao) h.inicializarOrdenacao();
  }

  return { render };
})();
