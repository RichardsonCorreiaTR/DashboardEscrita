/**
 * app-ss-respondidas.js - Listagem de SS respondidas pela equipe
 */
(() => {
  const $conteudo = document.getElementById('conteudo');
  const $loading = document.getElementById('loading');
  const $loadingMsg = document.getElementById('loading-msg');
  const $fonte = document.getElementById('ss-fonte-info');
  const $ano = document.getElementById('seletor-ano');
  const $btn = document.getElementById('btn-carregar');
  const $btnAtualizar = document.getElementById('btn-atualizar');
  const CORES = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const URL_SS = 'https://sgd.dominiosistemas.com.br/sgsa/faces/ss.html?ss=';

  function linkSs(id) {
    return '<a href="' + URL_SS + id + '" target="_blank" rel="noopener" class="link-sgd">' + id + '</a>';
  }

  $btn.addEventListener('click', () => carregar(false));
  $btnAtualizar.addEventListener('click', () => carregar(true));
  carregar(false);

  async function carregar(force) {
    const mesSel = document.getElementById('filtro-mes')?.value || '';
    $loading.hidden = false;
    $loadingMsg.textContent = force ? 'Atualizando via ODBC...' : 'Carregando dados...';
    if (force) { $btnAtualizar.textContent = 'Atualizando...'; $btnAtualizar.disabled = true; }
    $conteudo.innerHTML = '';
    try {
      const params = new URLSearchParams({ ano: $ano.value });
      if (force) {
        params.set('force', '1');
        if (mesSel) params.set('mes', mesSel);
      }
      const res = await fetch('/api/ss-respondidas?' + params);
      const dados = await res.json();
      if (dados.erro) throw new Error(dados.erro);
      renderizar(dados, mesSel);
      mostrarFonte(dados);
    } catch (err) {
      $conteudo.innerHTML = `<div class="card"><p style="color:#991b1b">Erro: ${err.message}</p></div>`;
    } finally {
      $loading.hidden = true;
      $btnAtualizar.textContent = 'Atualizar';
      $btnAtualizar.disabled = false;
    }
  }

  function mostrarFonte(dados) {
    if (!$fonte) return;
    const ts = dados._atualizado_em
      ? new Date(dados._atualizado_em).toLocaleString('pt-BR')
      : '-';
    const aviso = dados._aviso ? ' | ' + dados._aviso : '';
    const meses = dados._meses_cache ? ` (${dados._meses_cache} mes(es) em cache)` : '';
    const fonte = dados._fonte === 'odbc' ? 'odbc' : 'cache';
    $fonte.hidden = false;
    $fonte.className = 'fonte-info fonte-info--' + fonte;
    $fonte.innerHTML = fonte === 'cache'
      ? '\uD83D\uDCBE Cache salvo em ' + ts + meses + aviso
      : '\u2713 Atualizado via ODBC em ' + ts + meses;
  }

  function fmtData(v) {
    return v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
  }

  function renderizar({ resumo, registros, ano }, mesPreservar) {
    const total = registros.length;
    const ate3 = registros.filter(r => r.dentro_3du).length;
    const pct = total ? Math.round(ate3 / total * 100) : 0;

    $conteudo.innerHTML = `
      <div class="ss-legenda">
        <strong>${total}</strong> tramites respondidos em ${ano} (membro fecha a pergunta) |
        <strong>${ate3}/${total}</strong> em ate 3 dias uteis (${pct}%) |
        D.U. = dias uteis | D.C. = dias corridos | Tramite = pergunta respondida
      </div>
      <div class="ss-cards">${renderCards(resumo)}</div>
      <div class="card">
        <h2 style="margin:0 0 10px;font-size:1rem">Detalhe por tramite</h2>
        <div class="ss-filtros">
          <label>Membro: <select id="filtro-membro"><option value="">Todos</option></select></label>
          <label>Mes: <select id="filtro-mes"><option value="">Todos</option></select></label>
        </div>
        <div id="tabela-container">${renderTabela(registros)}</div>
      </div>`;

    iniciarFiltros(registros, mesPreservar);
  }

  function renderCards(resumo) {
    return Object.entries(resumo).map(([nome, r], i) => `
      <div class="ss-card" style="border-left-color:${CORES[i % CORES.length]}">
        <h3>${nome}</h3>
        <small>${r.total ? '' : 'Sem respostas no ano'}</small>
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
      return `<tr data-membro="${r.nome}" data-mes="${r.mes}">
        <td>${r.nome}<br><small style="color:#64748b">${r.senioridade}</small></td>
        <td>${linkSs(r.i_ss)}</td>
        <td>${r.i_ss_tramites}</td>
        <td>${r.resp_nome}</td>
        <td>${fmtData(r.entrada)}</td>
        <td>${fmtData(r.data_resposta)}</td>
        <td>${MESES[r.mes - 1] || r.mes}</td>
        <td class="${cls}">${r.dias_uteis}</td>
        <td>${r.dias_corridos}</td>
        <td class="${cls}">${r.dentro_3du ? 'Sim' : 'Nao'}</td>
      </tr>`;
    }).join('');
    return `<table class="ss-tabela">
      <thead><tr>
        <th>Membro</th><th>SS</th><th>Tramite</th><th>Respondeu</th><th>Entrada</th><th>Resposta</th>
        <th>Mes</th><th>D.U.</th><th>D.C.</th><th>Ate 3 D.U.</th>
      </tr></thead><tbody>${linhas}</tbody></table>`;
  }

  function iniciarFiltros(registros, mesPreservar) {
    const $membro = document.getElementById('filtro-membro');
    const $mes = document.getElementById('filtro-mes');
    if (!$membro || !$mes) return;

    [...new Set(registros.map(r => r.nome))].sort().forEach(n => {
      $membro.innerHTML += `<option value="${n}">${n}</option>`;
    });
    [...new Set(registros.map(r => r.mes))].sort((a, b) => a - b).forEach(m => {
      $mes.innerHTML += `<option value="${m}">${MESES[m - 1] || m}</option>`;
    });
    if (mesPreservar) $mes.value = mesPreservar;

    const filtrar = () => {
      const fm = $membro.value;
      const fmes = $mes.value;
      document.querySelectorAll('.ss-tabela tbody tr').forEach(tr => {
        const ok = (!fm || tr.dataset.membro === fm) && (!fmes || tr.dataset.mes === fmes);
        tr.style.display = ok ? '' : 'none';
      });
    };
    $membro.addEventListener('change', filtrar);
    $mes.addEventListener('change', filtrar);
    if (mesPreservar) filtrar();
  }
})();
