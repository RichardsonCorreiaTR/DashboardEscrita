/**
 * app-ss-respondidas-ui.js - Render e filtros da pagina SS Respondidas
 */
(() => {
  const CORES = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const URL_SS = 'https://sgd.dominiosistemas.com.br/sgsa/faces/ss.html?ss=';

  function linkSs(id) {
    return '<a href="' + URL_SS + id + '" target="_blank" rel="noopener" class="link-sgd">' + id + '</a>';
  }

  function fmtData(v) {
    return v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
  }

  function gerarResumo(registros) {
    const por = {};
    registros.forEach(r => {
      if (!por[r.nome]) por[r.nome] = { total: 0, ate3du: 0, soma_du: 0, soma_dc: 0 };
      const p = por[r.nome];
      p.total++;
      p.soma_du += r.dias_uteis;
      p.soma_dc += r.dias_corridos;
      if (r.dias_uteis <= 3) p.ate3du++;
    });
    Object.values(por).forEach(p => {
      p.media_du = p.total ? Math.round(p.soma_du / p.total * 10) / 10 : 0;
      p.media_dc = p.total ? Math.round(p.soma_dc / p.total * 10) / 10 : 0;
      p.pct_3du = p.total ? Math.round(p.ate3du / p.total * 100) : 0;
    });
    return por;
  }

  function renderLegenda(regs, ano) {
    const total = regs.length;
    const ate3 = regs.filter(r => r.dentro_3du).length;
    const pct = total ? Math.round(ate3 / total * 100) : 0;
    return `<strong>${total}</strong> tramites respondidos em ${ano} (membro fecha a pergunta) |
      <strong>${ate3}/${total}</strong> em ate 3 dias uteis (${pct}%) |
      D.U. = dias uteis | D.C. = dias corridos | Tramite = pergunta respondida`;
  }

  function renderCards(resumo) {
    const entries = Object.entries(resumo);
    if (!entries.length) return '<p style="color:#64748b">Nenhum tramite com os filtros atuais.</p>';
    return entries.map(([nome, r], i) => `
      <div class="ss-card" style="border-left-color:${CORES[i % CORES.length]}">
        <h3>${nome}</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:0.84rem;margin-top:6px">
          <div><strong>${r.total}</strong> tramites</div>
          <div><strong>${r.pct_3du}%</strong> ate 3 D.U.</div>
          <div><strong>${r.media_du}</strong> media D.U.</div>
          <div><strong>${r.media_dc}</strong> media D.C.</div>
        </div>
      </div>`).join('');
  }

  function renderTabela(registros) {
    if (!registros.length) return '<p style="color:#64748b">Nenhuma SS respondida encontrada.</p>';
    const ordenados = [...registros].sort((a, b) => a.i_ss - b.i_ss || a.i_ss_tramites - b.i_ss_tramites);
    const linhas = ordenados.map(r => {
      const cls = r.dentro_3du ? 'ss-ok' : 'ss-nok';
      return `<tr>
        <td>${r.nome}<br><small style="color:#64748b">${r.senioridade}</small></td>
        <td>${linkSs(r.i_ss)}</td>
        <td>${r.i_ss_tramites}</td>
        <td>${r.resp_nome}</td>
        <td>${r.modulo || 'Sem módulo'}</td>
        <td>${fmtData(r.entrada)}</td>
        <td>${fmtData(r.data_resposta)}</td>
        <td>${MESES[r.mes - 1] || r.mes}</td>
        <td class="${cls}">${r.dias_uteis}</td>
        <td>${r.dias_corridos}</td>
        <td class="${cls}">${r.dentro_3du ? 'Sim' : 'Nao'}</td>
      </tr>`;
    }).join('');
    return `<table class="ss-tabela"><thead><tr>
      <th>Membro</th><th>SS</th><th>Tramite</th><th>Respondeu</th><th>Módulo</th>
      <th>Entrada</th><th>Resposta</th><th>Mes</th><th>D.U.</th><th>D.C.</th><th>Ate 3 D.U.</th>
    </tr></thead><tbody>${linhas}</tbody></table>`;
  }

  function opcoes(valores) {
    return valores.map(v => `<option value="${String(v).replace(/"/g, '&quot;')}">${v}</option>`).join('');
  }

  function montarPagina(registros, ano, mesPreservar) {
    const $conteudo = document.getElementById('conteudo');
    $conteudo.innerHTML = `
      <div id="ss-legenda" class="ss-legenda"></div>
      <div id="ss-cards" class="ss-cards"></div>
      <div class="card">
        <h2 style="margin:0 0 10px;font-size:1rem">Detalhe por tramite</h2>
        <div class="ss-filtros">
          <label>Membro: <select id="filtro-membro"><option value="">Todos</option></select></label>
          <label>Módulo: <select id="filtro-modulo"><option value="">Todos</option></select></label>
          <label>Mes: <select id="filtro-mes"><option value="">Todos</option></select></label>
        </div>
        <div id="tabela-container"></div>
      </div>`;

    const $membro = document.getElementById('filtro-membro');
    const $modulo = document.getElementById('filtro-modulo');
    const $mes = document.getElementById('filtro-mes');
    $membro.innerHTML += opcoes([...new Set(registros.map(r => r.nome))].sort());
    $modulo.innerHTML += opcoes(
      [...new Set(registros.map(r => r.modulo || 'Sem módulo'))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    );
    [...new Set(registros.map(r => r.mes))].sort((a, b) => a - b).forEach(m => {
      $mes.innerHTML += `<option value="${m}">${MESES[m - 1] || m}</option>`;
    });
    if (mesPreservar) $mes.value = mesPreservar;

    const aplicar = () => {
      const fm = $membro.value;
      const fmod = $modulo.value;
      const fmes = $mes.value;
      const filtrados = registros.filter(r =>
        (!fm || r.nome === fm) &&
        (!fmod || (r.modulo || 'Sem módulo') === fmod) &&
        (!fmes || String(r.mes) === fmes)
      );
      document.getElementById('ss-legenda').innerHTML = renderLegenda(filtrados, ano);
      document.getElementById('ss-cards').innerHTML = renderCards(gerarResumo(filtrados));
      document.getElementById('tabela-container').innerHTML = renderTabela(filtrados);
    };
    $membro.addEventListener('change', aplicar);
    $modulo.addEventListener('change', aplicar);
    $mes.addEventListener('change', aplicar);
    aplicar();
  }

  window.SsRespondidasUi = { montarPagina };
})();
