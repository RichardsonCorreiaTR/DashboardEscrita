/**
 * feedback-formulario.js - Modal de formulario de feedback 1:1
 * Gerencia abertura, preenchimento, salvamento, e-mail e alertas.
 */
/* eslint-disable no-unused-vars */
/* global FeedbackAlertas */
const FeedbackFormulario = (() => {
  let _papel = null;
  let _slug = null;
  let _colaboradores = [];
  let _onSalvo = null;

  function abrir(dados) {
    const modal = document.getElementById('fb-modal');
    if (!modal) return;
    preencherModal(dados);
    modal.classList.add('fb-modal--visivel');
  }

  function fechar() {
    const modal = document.getElementById('fb-modal');
    if (modal) modal.classList.remove('fb-modal--visivel');
  }

  function setValor(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  }

  function preencherModal({ sessao, data, colaboradorSlug, coordenadorSlug }) {
    const slug = colaboradorSlug || (sessao && sessao.colaborador_slug) || '';
    const colab = _colaboradores.find(c => c.slug === slug);
    document.getElementById('fb-titulo').textContent = sessao
      ? `Feedback 1:1 — ${colab ? colab.nome : slug}`
      : `Agendar 1:1 — ${colab ? colab.apelido : slug}`;
    setValor('fb-sessao-id', sessao ? sessao.id : '');
    setValor('fb-data', (sessao ? sessao.data : data) || '');
    setValor('fb-colab-slug', slug);
    setValor('fb-coord-slug', coordenadorSlug || (sessao && sessao.coordenador_slug) || '');
    document.getElementById('fb-status').value = (sessao && sessao.status) || 'agendado';
    setValor('fb-horario', sessao ? sessao.horario : '09:00');
    document.getElementById('fb-duracao').value = (sessao && sessao.duracao) || '60';

    const dc = (sessao && sessao.dados_colaborador) || {};
    setValor('fb-col-positivos', dc.pontos_positivos);
    setValor('fb-col-melhora', dc.pontos_melhora);
    setValor('fb-col-comentarios', dc.comentarios);
    const dco = (sessao && sessao.dados_coordenador) || {};
    setValor('fb-coord-positivos', dco.pontos_positivos);
    setValor('fb-coord-melhora', dco.pontos_melhora);
    setValor('fb-coord-acoes', dco.acoes);

    document.getElementById('fb-secao-coord').style.display = _papel === 'coordenador' ? '' : 'none';
    // E-mail visível para coordenador sempre (mesmo ao criar)
    document.getElementById('fb-btn-email').style.display = _papel === 'coordenador' ? '' : 'none';
    document.getElementById('fb-btn-excluir').style.display = (_papel === 'coordenador' && sessao) ? '' : 'none';

    const preenchidoEm = dc.preenchido_em
      ? `Colaborador preencheu em: ${new Date(dc.preenchido_em).toLocaleDateString('pt-BR')}` : '';
    const infoEl = document.getElementById('fb-info-preenchimento');
    if (infoEl) infoEl.textContent = preenchidoEm;
  }

  function coletarDados() {
    return {
      id: document.getElementById('fb-sessao-id').value,
      data: document.getElementById('fb-data').value,
      horario: document.getElementById('fb-horario').value,
      duracao: document.getElementById('fb-duracao').value,
      colaborador_slug: document.getElementById('fb-colab-slug').value,
      coordenador_slug: document.getElementById('fb-coord-slug').value,
      status: document.getElementById('fb-status').value,
      dados_colaborador: {
        pontos_positivos: document.getElementById('fb-col-positivos').value,
        pontos_melhora: document.getElementById('fb-col-melhora').value,
        comentarios: document.getElementById('fb-col-comentarios').value
      },
      dados_coordenador: _papel === 'coordenador' ? {
        pontos_positivos: document.getElementById('fb-coord-positivos').value,
        pontos_melhora: document.getElementById('fb-coord-melhora').value,
        acoes: document.getElementById('fb-coord-acoes').value
      } : null
    };
  }

  async function salvar() {
    const d = coletarDados();
    const btnSalvar = document.getElementById('fb-btn-salvar');
    btnSalvar.disabled = true;
    try {
      let resp;
      if (d.id) {
        const body = { status: d.status, data: d.data, horario: d.horario, duracao: d.duracao, dados_colaborador: d.dados_colaborador };
        if (d.dados_coordenador) body.dados_coordenador = d.dados_coordenador;
        resp = await fetch(`/api/feedback-1on1/sessoes/${d.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      } else {
        resp = await fetch('/api/feedback-1on1/sessoes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: d.data, horario: d.horario, duracao: d.duracao,
            colaborador_slug: d.colaborador_slug, coordenador_slug: d.coordenador_slug })
        });
      }
      const resultado = await resp.json();
      if (resultado.ok) {
        agendarAlertaSessao(resultado.sessao);
        fechar();
        if (_onSalvo) _onSalvo(resultado.sessao);
      } else { alert('Erro: ' + (resultado.erro || 'Tente novamente')); }
    } catch (e) { alert('Erro de rede: ' + e.message); }
    finally { btnSalvar.disabled = false; }
  }

  function agendarAlertaSessao(sessao) {
    if (typeof FeedbackAlertas === 'undefined' || !sessao) return;
    const colab = _colaboradores.find(c => c.slug === sessao.colaborador_slug);
    FeedbackAlertas.agendarSessao(sessao, colab ? colab.apelido : sessao.colaborador_slug);
  }

  async function excluir() {
    const id = document.getElementById('fb-sessao-id').value;
    if (!id || !confirm('Remover esta sessão?')) return;
    if (typeof FeedbackAlertas !== 'undefined') FeedbackAlertas.cancelarSessao(id);
    await fetch(`/api/feedback-1on1/sessoes/${id}`, { method: 'DELETE' });
    fechar();
    if (_onSalvo) _onSalvo(null);
  }

  function abrirEmail() {
    const data = document.getElementById('fb-data').value;
    const horario = document.getElementById('fb-horario').value;
    const duracao = document.getElementById('fb-duracao').value;
    const slug = document.getElementById('fb-colab-slug').value;
    const colab = _colaboradores.find(c => c.slug === slug);
    const nome = colab ? colab.apelido : slug;
    const dataFmt = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR',
      { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const assunto = encodeURIComponent(`1:1 Agendado — ${dataFmt} às ${horario}`);
    const corpo = encodeURIComponent(
      `Olá ${nome},\n\nNossa reunião 1:1 está agendada para:\n` +
      `📅 ${dataFmt}\n⏰ ${horario} (duração: ${duracao} min)\n\n` +
      `Antes da reunião, acesse o dashboard e preencha seus pontos:\n` +
      `http://localhost:4000/feedback-1on1.html\n\n` +
      `Abs,\nCoordenação Escrita Fiscal`
    );
    const id = document.getElementById('fb-sessao-id').value;
    if (id) fetch(`/api/feedback-1on1/sessoes/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_enviado: true })
    });
    window.open(`mailto:?subject=${assunto}&body=${corpo}`, '_blank');
  }

  function configurar({ papel, slug, colaboradores, onSalvo }) {
    _papel = papel; _slug = slug;
    _colaboradores = colaboradores || [];
    _onSalvo = onSalvo;
    if (typeof FeedbackAlertas !== 'undefined') FeedbackAlertas.solicitarPermissao();
    document.getElementById('fb-btn-fechar').addEventListener('click', fechar);
    document.getElementById('fb-btn-salvar').addEventListener('click', salvar);
    document.getElementById('fb-btn-excluir').addEventListener('click', excluir);
    document.getElementById('fb-btn-email').addEventListener('click', abrirEmail);
    document.getElementById('fb-modal').addEventListener('click', e => {
      if (e.target === e.currentTarget) fechar();
    });
  }

  return { configurar, abrir, fechar };
})();
