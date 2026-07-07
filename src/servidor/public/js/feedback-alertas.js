/**
 * feedback-alertas.js - Alertas de notificacao para sessoes 1:1
 * Usa Notification API: avisa 5 min antes do inicio e 5 min antes do encerramento.
 */
/* eslint-disable no-unused-vars */
const FeedbackAlertas = (() => {
  const MIN_ANTES = 5;
  const _timeouts = {};

  function podNotificar() {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  async function solicitarPermissao() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const resp = await Notification.requestPermission();
    return resp === 'granted';
  }

  function disparar(titulo, corpo) {
    if (!podNotificar()) return;
    try { new Notification(titulo, { body: corpo }); } catch { /* sem suporte */ }
  }

  function agendarSessao(sessao, nomeColab) {
    if (!sessao || !sessao.horario || !sessao.data || !sessao.id) return;
    const duracao = parseInt(sessao.duracao || '60', 10);
    const tsInicio = new Date(sessao.data + 'T' + sessao.horario + ':00').getTime();
    const tsFim = tsInicio + duracao * 60000;
    const hora = sessao.horario;

    const diffInicio = tsInicio - MIN_ANTES * 60000 - Date.now();
    const diffFim = tsFim - MIN_ANTES * 60000 - Date.now();

    if (diffInicio > 0) {
      if (_timeouts[sessao.id + '_i']) clearTimeout(_timeouts[sessao.id + '_i']);
      _timeouts[sessao.id + '_i'] = setTimeout(() => disparar(
        `\u23F0 1:1 começa em ${MIN_ANTES} min`,
        `Reunião com ${nomeColab} às ${hora}`
      ), diffInicio);
    }

    if (diffFim > 0) {
      if (_timeouts[sessao.id + '_f']) clearTimeout(_timeouts[sessao.id + '_f']);
      _timeouts[sessao.id + '_f'] = setTimeout(() => disparar(
        `\u23F3 1:1 encerra em ${MIN_ANTES} min`,
        `Reunião com ${nomeColab} — reserve os últimos minutos para conclusões`
      ), diffFim);
    }
  }

  function cancelarSessao(sessaoId) {
    ['_i', '_f'].forEach(sfx => {
      if (_timeouts[sessaoId + sfx]) {
        clearTimeout(_timeouts[sessaoId + sfx]);
        delete _timeouts[sessaoId + sfx];
      }
    });
  }

  function agendarTodos(sessoes, colaboradores) {
    if (!podNotificar()) return;
    const hoje = new Date().toISOString().slice(0, 10);
    sessoes
      .filter(s => s.status === 'agendado' && s.data >= hoje && s.horario)
      .forEach(s => {
        const colab = colaboradores.find(c => c.slug === s.colaborador_slug);
        agendarSessao(s, colab ? colab.apelido : s.colaborador_slug);
      });
  }

  function mostrarHint() {
    const el = document.getElementById('fb-alerta-hint');
    if (el) el.style.display = '';
  }

  async function solicitarEMostrar() {
    const ok = await solicitarPermissao();
    if (ok) mostrarHint();
    return ok;
  }

  return { solicitarPermissao: solicitarEMostrar, agendarSessao, cancelarSessao, agendarTodos };
})();
