/**
 * equipes-avaliacao-meses.js - Painel mês a mês e explicação da tendência
 */
/* eslint-disable no-unused-vars */
const EquipesAvaliacaoMeses = (() => {
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  function media(arr) {
    return arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length) : null;
  }

  function nomesMeses(lista) {
    return lista.map(s => MESES[s.mes - 1]).join(', ');
  }

  function explicarTendencia(a) {
    const valid = a.serie.filter(s => s.comp != null);
    const t = a.tendencia;
    if (valid.length < 2) {
      return 'Com apenas um m\u00eas com dados no per\u00edodo, a tend\u00eancia \u00e9 considerada <strong>Est\u00e1vel</strong>.';
    }
    const metade = Math.floor(valid.length / 2);
    const ini = valid.slice(0, metade);
    const fim = valid.slice(metade);
    const mIni = media(ini.map(s => s.comp));
    const mFim = media(fim.map(s => s.comp));
    const diff = (mFim != null && mIni != null) ? mFim - mIni : 0;
    const lbl = nomesMeses(ini) + ' \u2192 ' + nomesMeses(fim);
    if (t === 'ascendente') {
      return 'Tend\u00eancia <strong>Ascendente</strong>: a m\u00e9dia da 2\u00aa parte do per\u00edodo (' + mFim + '%, ' +
        nomesMeses(fim) + ') supera a 1\u00aa parte (' + mIni + '%, ' + nomesMeses(ini) +
        ') em <strong>+' + diff + ' p.p.</strong> (limite: 3 p.p.). Meses: ' + lbl + '.';
    }
    if (t === 'descendente') {
      return 'Tend\u00eancia <strong>Descendente</strong>: a m\u00e9dia da 2\u00aa parte (' + mFim + '%, ' +
        nomesMeses(fim) + ') ficou <strong>' + diff + ' p.p.</strong> abaixo da 1\u00aa parte (' + mIni + '%, ' +
        nomesMeses(ini) + ') — queda maior que 3 p.p. Meses: ' + lbl + '.';
    }
    return 'Tend\u00eancia <strong>Est\u00e1vel</strong>: diferen\u00e7a de <strong>' +
      (diff >= 0 ? '+' : '') + diff + ' p.p.</strong> entre a 1\u00aa parte (' + mIni + '%, ' + nomesMeses(ini) +
      ') e a 2\u00aa (' + mFim + '%, ' + nomesMeses(fim) + ') — dentro do limite de \u00b13 p.p. Meses: ' + lbl + '.';
  }

  function cel(v) { return v != null ? v + '%' : '\u2014'; }

  function linhasTabela(a) {
    const valid = a.serie.filter(s => s.comp != null);
    if (a.esp) {
      return valid.map(s =>
        '<tr><td><strong>' + MESES[s.mes - 1] + '</strong></td>' +
        '<td style="text-align:center;font-weight:700">' + cel(s.comp) + '</td>' +
        '<td style="text-align:center">' + cel(s.pontos) + '</td>' +
        '<td style="text-align:center">' + cel(s.tempoGeracao) + '</td>' +
        '<td style="text-align:center">' + cel(s.revisoes) + '</td></tr>'
      ).join('');
    }
    return valid.map(s =>
      '<tr><td><strong>' + MESES[s.mes - 1] + '</strong></td>' +
      '<td style="text-align:center;font-weight:700">' + cel(s.comp) + '</td>' +
      '<td style="text-align:center">' + cel(s.pontos) + '</td>' +
      '<td style="text-align:center">' + cel(s.revisoes) + '</td>' +
      '<td style="text-align:center">' + cel(s.retornos) + '</td></tr>'
    ).join('');
  }

  function cabecalhoTabela(a) {
    if (a.esp) {
      return '<th>M\u00eas</th><th>Nota</th><th>SAIs geradas</th><th>Tempo gera\u00e7\u00e3o</th><th>Revis\u00f5es</th>';
    }
    return '<th>M\u00eas</th><th>Nota</th><th>Pontos</th><th>Revis\u00f5es</th><th>Retornos</th>';
  }

  function garantirModal() {
    let el = document.getElementById('eq-aval-modal');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'eq-aval-modal';
    el.className = 'eq-aval-modal';
    el.hidden = true;
    el.innerHTML =
      '<div class="eq-aval-modal__box" role="dialog" aria-modal="true">' +
        '<div class="eq-aval-modal__head">' +
          '<h4 id="eq-aval-modal-titulo" class="eq-aval-modal__titulo"></h4>' +
          '<button type="button" class="eq-aval-modal__fechar" aria-label="Fechar">&times;</button></div>' +
        '<div id="eq-aval-modal-corpo"></div></div>';
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) fechar(); });
    el.querySelector('.eq-aval-modal__fechar').addEventListener('click', fechar);
    return el;
  }

  function abrir(a) {
    if (!a || !a.mesesComDados) return;
    const modal = garantirModal();
    document.getElementById('eq-aval-modal-titulo').textContent =
      a.apelido + ' \u2014 ' + a.periodoLabel + ' / ' + a.ano;
    document.getElementById('eq-aval-modal-corpo').innerHTML =
      '<p class="eq-aval-modal__explic">' + explicarTendencia(a) + '</p>' +
      '<p class="eq-aval-modal__sub">Valores em % de atingimento da meta em cada pilar. Nota = m\u00e9dia ponderada do m\u00eas.</p>' +
      '<table class="eq-tabela eq-aval-modal__tabela"><thead><tr>' + cabecalhoTabela(a) +
      '</tr></thead><tbody>' + linhasTabela(a) + '</tbody></table>';
    modal.hidden = false;
  }

  function fechar() {
    const el = document.getElementById('eq-aval-modal');
    if (el) el.hidden = true;
  }

  return { abrir, fechar };
})();
