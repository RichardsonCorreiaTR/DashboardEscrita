/**
 * equipes-detalhe.js - Drill-down mensal agrupado por componente do calculo
 *
 * Cada tabela mostra os registros separados por grupo da formula,
 * com subtotais e o calculo final.
 * Depende de format-utils.js (FormatUtils).
 */

/* eslint-disable no-unused-vars */
const EquipesDetalhe = (() => {
  const { MESES, fmtMin, fmtData, isTrabalho } = FormatUtils;
  const URL_SAI = 'https://sgsai.dominiosistemas.com.br/sgsai/faces/sai.html?sai=';
  const URL_PSAI = 'https://sgd.dominiosistemas.com.br/sgsa/faces/psai.html?psai=';
  function linkSai(id) { return '<a href="' + URL_SAI + id + '" target="_blank" class="link-sgd">' + id + '</a>'; }
  function linkPsai(id) { return '<a href="' + URL_PSAI + id + '" target="_blank" class="link-sgd">' + id + '</a>'; }

  function isAusencia(nome) {
    const n = nome.toLowerCase();
    return n.includes('feriado') || n.includes('rias') || n.includes('folga') ||
      n.includes('particular') || n.includes('afastamento');
  }

  function render(metaId, mes, registros) {
    if (!registros || registros.length === 0) {
      return '<div class="eq-sem-dados">Nenhum registro encontrado em ' + MESES[mes] + '</div>';
    }
    const t = '<h4 class="eq-det__titulo">Detalhamento - ' + MESES[mes] + ' (' + registros.length + ' registros)</h4>';
    if (metaId.startsWith('tempo-trabalho')) return t + detAtividades(registros);
    if (metaId.startsWith('indice-revisoes')) return t + detRevisoes(registros);
    if (metaId === 'pontos-definicao') return t + detPontos(registros);
    if (metaId.startsWith('gerar-sai')) return t + detGeracao(registros);
    if (metaId === 'respostas-ss-3d') return t + detSS(registros);
    return t + '<pre>' + JSON.stringify(registros, null, 2) + '</pre>';
  }

  function detAtividades(rows) {
    const trabalho = [], outras = [], ausencias = [];
    rows.forEach(r => {
      const a = String(r.atividade).trim();
      if (isAusencia(a)) ausencias.push(r);
      else if (isTrabalho(a)) trabalho.push(r);
      else outras.push(r);
    });
    const sT = somaMin(trabalho), sO = somaMin(outras), sA = somaMin(ausencias);
    const total = sT + sO + sA, efetivo = total - sA;
    const pct = efetivo > 0 ? Math.round((sT / efetivo) * 10000) / 100 : 0;

    return grupoAtiv('\u2705 Trabalho SAI/PSAI (numerador)', trabalho, total, 'eq-det--destaque') +
      grupoAtiv('Outras atividades', outras, total, '') +
      grupoAtiv('\u26D4 Ausencias (excluidas do calculo)', ausencias, total, 'eq-det--ausencia') +
      '<div class="eq-det__formula"><strong>Calculo:</strong> ' +
      fmtMin(sT) + ' (SAI/PSAI) / ' + fmtMin(efetivo) + ' (Efetivo) = <strong>' +
      pct + '%</strong> [Meta: \u2265 80%]</div>';
  }

  function grupoAtiv(titulo, rows, total, cls) {
    if (rows.length === 0) return '';
    const sub = somaMin(rows);
    let html = '<div class="eq-det__grupo"><h5>' + titulo + '</h5>' +
      '<table class="eq-tabela eq-tabela--det"><thead><tr>' +
      '<th>Atividade</th><th>Tempo</th><th>Reg.</th><th>%</th></tr></thead><tbody>';
    rows.forEach(r => {
      const pct = total > 0 ? Math.round((r.minutos / total) * 100) : 0;
      html += '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + String(r.atividade).trim() +
        '</td><td>' + fmtMin(r.minutos) + '</td><td>' + r.registros + '</td><td>' + pct + '%</td></tr>';
    });
    html += '</tbody><tfoot><tr><td><strong>Subtotal</strong></td><td><strong>' +
      fmtMin(sub) + '</strong></td><td></td><td><strong>' +
      (total > 0 ? Math.round((sub / total) * 100) : 0) + '%</strong></td></tr></tfoot></table></div>';
    return html;
  }

  function detRevisoes(rows) {
    var denom = rows.filter(function(r) { return r.grupo === 'denominador' || !r.grupo; });
    var numer = rows.filter(function(r) { return r.grupo === 'numerador'; });
    var denomComRev = denom.filter(function(r) { return r.revisoes > 0; });
    var denomSemRev = denom.filter(function(r) { return !r.revisoes || r.revisoes === 0; });
    var revDenom = denomComRev.reduce(function(s, r) { return s + r.revisoes; }, 0);
    var revNumer = numer.reduce(function(s, r) { return s + r.revisoes; }, 0);
    var totalRev = revDenom + revNumer;
    var totalSais = denom.length;
    var indice = totalSais > 0 ? Math.round((totalRev / totalSais) * 100) / 100 : 0;

    return grupoSai('\u26A0 SAIs do mes com revisao (A/C)', denomComRev, 'revisoes', 'eq-det--alerta') +
      grupoSai('\u2705 SAIs do mes sem revisao', denomSemRev, 'revisoes', '') +
      (numer.length > 0 ? grupoSai('\u2139 Revisoes de SAIs de outros meses', numer, 'revisoes', 'eq-det--alerta') : '') +
      '<div class="eq-det__formula"><strong>Calculo:</strong> ' +
      totalRev + ' revisoes no mes / ' + totalSais + ' SAIs criadas no mes = <strong>' +
      indice.toFixed(2).replace('.', ',') + '</strong> [Meta: \u2264 0,60]</div>';
  }

  function grupoSai(titulo, rows, colExtra, cls) {
    if (rows.length === 0) return '';
    let html = '<div class="eq-det__grupo"><h5>' + titulo + ' (' + rows.length + ')</h5>' +
      '<table class="eq-tabela eq-tabela--det"><thead><tr>' +
      '<th>SAI</th><th>Tipo</th><th>Cadastro</th><th>' +
      (colExtra === 'revisoes' ? 'Rev.' : colExtra === 'pontos' ? 'Pts' : 'Dias') +
      '</th></tr></thead><tbody>';
    rows.forEach(r => {
      html += '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + linkSai(r.i_sai) + '</td><td>' +
        r.tipoSAI + '</td><td>' + fmtData(r.CadastroSAI || r.CadastroPSAI) + '</td><td>' +
        (r[colExtra] != null ? r[colExtra] : (r.dias_geracao != null ? r.dias_geracao : '-')) +
        '</td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function detPontos(rows) {
    let soma = 0;
    const semPontos = rows.filter(r => !r.pontuacao || Number(r.pontuacao) === 0);
    const comPontos = rows.filter(r => r.pontuacao && Number(r.pontuacao) > 0);
    let html = '';
    if (semPontos.length > 0) {
      html += '<div class="eq-det__grupo eq-det--alerta"><h5>\u26A0 SAIs sem pontuacao (' +
        semPontos.length + ') \u2014 corrigir no SGD</h5>' +
        '<table class="eq-tabela eq-tabela--det"><thead><tr>' +
        '<th>SAI</th><th>Tipo</th><th>Cadastro</th><th>Pontos</th></tr></thead><tbody>';
      semPontos.forEach(r => {
        html += '<tr class="eq-det--alerta"><td>' + linkSai(r.i_sai) + '</td><td>' + r.tipoSAI +
          '</td><td>' + fmtData(r.CadastroSAI) + '</td><td><strong>—</strong></td></tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '<div class="eq-det__grupo"><h5>SAIs com pontuacao (' + comPontos.length + ')</h5>' +
      '<table class="eq-tabela eq-tabela--det"><thead><tr>' +
      '<th>SAI</th><th>Tipo</th><th>Cadastro</th><th>Pontos</th></tr></thead><tbody>';
    comPontos.forEach(r => {
      soma += Number(r.pontuacao);
      html += '<tr><td>' + linkSai(r.i_sai) + '</td><td>' + r.tipoSAI +
        '</td><td>' + fmtData(r.CadastroSAI) + '</td><td>' + r.pontuacao + '</td></tr>';
    });
    html += '</tbody><tfoot><tr><td colspan="3"><strong>Total</strong></td><td><strong>' +
      soma + '</strong></td></tr></tfoot></table></div>' +
      '<div class="eq-det__formula"><strong>Total:</strong> ' + soma + ' pontos [Meta: \u2265 80]' +
      (semPontos.length > 0 ? ' \u2014 <span class="eq-det__aviso">' + semPontos.length +
        ' SAI(s) sem pontuacao (nao contabilizadas)</span>' : '') + '</div>';
    return html;
  }

  const SIT_LABELS = { 4: 'Respondida', 11: 'Em Analise Coord.', 12: 'A Desenvolver' };

  function detGeracao(rows) {
    const dentro = rows.filter(r => (Number(r.dias_uteis) || 0) <= 3);
    const fora = rows.filter(r => (Number(r.dias_uteis) || 0) > 3);
    const pct = rows.length > 0 ? Math.round((dentro.length / rows.length) * 10000) / 100 : 0;

    return grupoGer('\u2705 Dentro do prazo (\u2264 3 dias uteis)', dentro, '') +
      grupoGer('\u26A0 Fora do prazo (> 3 dias uteis)', fora, 'eq-det--alerta') +
      '<div class="eq-det__formula"><strong>Calculo:</strong> ' +
      dentro.length + '/' + rows.length + ' dentro do prazo (' + pct + '%). ' +
      'Media: <strong>' + media(rows) + ' d.u.</strong> [Meta: media \u2264 3 d.u.]</div>';
  }

  function grupoGer(titulo, rows, cls) {
    if (rows.length === 0) return '';
    let html = '<div class="eq-det__grupo"><h5>' + titulo + ' (' + rows.length + ')</h5>' +
      '<table class="eq-tabela eq-tabela--det"><thead><tr>' +
      '<th>PSAI</th><th>Envio (sit=2)</th><th>Resposta</th><th>Situacao</th><th>D.U.</th><th>D.C.</th></tr></thead><tbody>';
    rows.forEach(r => {
      const du = Number(r.dias_uteis) || 0;
      const dc = Number(r.dias_corridos) || 0;
      const sit = SIT_LABELS[r.i_situacoes] || ('sit=' + r.i_situacoes);
      html += '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + linkPsai(r.i_psai) + '</td><td>' +
        fmtData(r.data_envio) + '</td><td>' + fmtData(r.data_resposta) + '</td><td>' +
        sit + '</td><td><strong>' + du + '</strong></td><td class="eq-det--muted">' + dc + '</td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function detSS(rows) {
    const dentro = rows.filter(r => (Number(r.dias) || 0) <= 3);
    const fora = rows.filter(r => (Number(r.dias) || 0) > 3);
    const pct = rows.length > 0 ? Math.round((dentro.length / rows.length) * 10000) / 100 : 0;

    return grupoSSItens('\u2705 Respondidas em \u2264 3 dias', dentro, '') +
      grupoSSItens('\u26A0 Respondidas em > 3 dias', fora, 'eq-det--alerta') +
      '<div class="eq-det__formula"><strong>Calculo:</strong> ' +
      dentro.length + '/' + rows.length + ' em \u2264 3d = <strong>' +
      pct + '%</strong> [Meta: 100%]</div>';
  }

  function grupoSSItens(titulo, rows, cls) {
    if (rows.length === 0) return '';
    let html = '<div class="eq-det__grupo"><h5>' + titulo + ' (' + rows.length + ')</h5>' +
      '<table class="eq-tabela eq-tabela--det"><thead><tr>' +
      '<th>SS</th><th>Entrada</th><th>Resposta</th><th>Dias</th></tr></thead><tbody>';
    rows.forEach(r => {
      html += '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + r.i_ss + '</td><td>' +
        fmtData(r.entrada) + '</td><td>' + fmtData(r.data_resposta) + '</td><td>' + r.dias + '</td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function somaMin(rows) { return rows.reduce((s, r) => s + (r.minutos || 0), 0); }
  function media(rows) {
    if (!rows.length) return '0';
    const s = rows.reduce((a, r) => a + (Number(r.dias_uteis) || 0), 0);
    return (Math.round((s / rows.length) * 100) / 100).toFixed(2).replace('.', ',');
  }

  return { render };
})();
