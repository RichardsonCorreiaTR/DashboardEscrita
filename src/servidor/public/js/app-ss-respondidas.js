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
      window.SsRespondidasUi.montarPagina(dados.registros || [], dados.ano, mesSel);
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
})();
