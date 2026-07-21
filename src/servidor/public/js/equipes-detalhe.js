/**
 * equipes-detalhe.js - Drill-down mensal agrupado por componente do calculo
 *
 * Cada tabela mostra os registros separados por grupo da formula,
 * com subtotais e o calculo final.
 * Depende de format-utils.js (FormatUtils).
 */

/* eslint-disable no-unused-vars */
const EquipesDetalhe = (() => {
  const { MESES, fmtMin, fmtData, isTrabalho, isOutrasAtividades, isPrincipalAnalista, isPrincipalQualquer } = FormatUtils;
  const URL_SAI = 'https://sgsai.dominiosistemas.com.br/sgsai/faces/sai.html?sai=';
  const URL_PSAI = 'https://sgd.dominiosistemas.com.br/sgsa/faces/psai.html?psai=';
  const URL_SS = 'https://sgd.dominiosistemas.com.br/sgsa/faces/ss.html?ss=';
  function linkSai(id) { return '<a href="' + URL_SAI + id + '" target="_blank" class="link-sgd">' + id + '</a>'; }
  function linkPsai(id) { return '<a href="' + URL_PSAI + id + '" target="_blank" class="link-sgd">' + id + '</a>'; }
  function linkSs(id) { return '<a href="' + URL_SS + id + '" target="_blank" class="link-sgd">' + id + '</a>'; }

  function isAusencia(nome) {
    const n = nome.toLowerCase();
    return n.includes('feriado') || (n.includes('rias') && n.length < 12) ||
      (n.includes('folga') && !n.includes('banco de horas'));
  }

  function render(metaId, mes, registros, planilha, senioridade) {
    if (!registros || registros.length === 0) {
      return '<div class="eq-sem-dados">Nenhum registro encontrado em ' + MESES[mes] + '</div>';
    }
    const t = '<h4 class="eq-det__titulo">Detalhamento - ' + MESES[mes] + ' (' + registros.length + ' registros)</h4>';
    if (metaId.startsWith('tempo-trabalho')) return t + detAtividades(registros, metaId, senioridade);
    if (metaId.startsWith('indice-revisoes')) return t + detRevisoes(registros);
    if (metaId.startsWith('indice-retornos')) return t + detRetornos(registros, metaId);
    if (metaId === 'psais-definidas') return t + detPontos(registros, true);
    if (metaId === 'pontos-definicao' || metaId === 'sais-definidas-esp' || metaId === 'pontos-atividade-principal' || metaId === 'pontos-gerados') return t + detPontos(registros);
    if (metaId.startsWith('gerar-sai')) {
      const maxDias = metaId.includes('-7d') ? 7 : metaId.includes('-5d') ? 5 : 3;
      return t + detGeracao(registros, maxDias);
    }
    if (metaId === 'pct-descartes') return t + detPctDescartes(registros);
    if (metaId === 'controle-descartes') return t + detDescartes(registros);
    if (metaId === 'tempo-medio-sal') return t + detTempoSal(registros);
    if (metaId === 'respostas-ss-3d') return t + detSS(registros);
    return t + '<pre>' + JSON.stringify(registros, null, 2) + '</pre>';
  }

  function detAtividades(rows, metaId, senioridade) {
    const isPrincipal = metaId === 'tempo-trabalho-principal';
    const podeGerar = senioridade === 'especialista' || senioridade === 'pleno';
    const filtroPrincipal = podeGerar ? isPrincipalQualquer : isPrincipalAnalista;
    const trabalho = [], outras = [], ausencias = [];
    rows.forEach(r => {
      const a = String(r.atividade).trim();
      if (isAusencia(a)) ausencias.push(r);
      else if (isOutrasAtividades(a)) outras.push(r);
      else if (isPrincipal ? filtroPrincipal(a) : isTrabalho(a)) trabalho.push(r);
      else outras.push(r);
    });
    const sT = somaMin(trabalho), sO = somaMin(outras), sA = somaMin(ausencias);
    const total = sT + sO + sA, efetivo = total - sA;
    const pct = efetivo > 0 ? Math.round((sT / efetivo) * 10000) / 100 : 0;
    const metaStr = metaId === 'tempo-trabalho-analise' ? '85%'
      : metaId === 'tempo-trabalho-principal' ? '70% (an.) / 50% (esp.)' : '80%';

    return grupoAtiv('\u2705 Trabalho Principal (numerador)', trabalho, total, 'eq-det--destaque') +
      grupoAtiv('Outras atividades', outras, total, '') +
      grupoAtiv('\u26D4 Ausencias (excluidas do calculo)', ausencias, total, 'eq-det--ausencia') +
      '<div class="eq-det__formula"><strong>Calculo:</strong> ' +
      fmtMin(sT) + ' / ' + fmtMin(efetivo) + ' (Efetivo) = <strong>' +
      pct + '%</strong> [Meta: \u2265 ' + metaStr + ']</div>';
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

  function detRetornos(rows, metaId) {
    const comRet = rows.filter(r => (r.qtdTramite || 0) > 0);
    const semRet = rows.filter(r => !r.qtdTramite || r.qtdTramite === 0);
    const totalRet = rows.reduce((s, r) => s + (r.qtdTramite || 0), 0);
    const indice = rows.length > 0 ? Math.round((totalRet / rows.length) * 100) / 100 : 0;
    const metaStr = metaId === 'indice-retornos-sal' ? '\u2264 1,00' : '\u2264 1,50';
    return grupoRet('\u26A0 PSAIs com retorno', comRet, 'eq-det--alerta') +
      grupoRet('\u2705 PSAIs sem retorno', semRet, '') +
      '<div class="eq-det__formula"><strong>Calculo:</strong> ' + totalRet +
      ' retornos / ' + rows.length + ' PSAIs = <strong>' +
      indice.toFixed(2).replace('.', ',') + '</strong> [Meta: ' + metaStr + ']</div>';
  }

  function grupoRet(titulo, rows, cls) {
    if (rows.length === 0) return '';
    let html = '<div class="eq-det__grupo"><h5>' + titulo + ' (' + rows.length + ')</h5>' +
      '<table class="eq-tabela eq-tabela--det"><thead><tr>' +
      '<th>PSAI</th><th>SAI</th><th>Tipo</th><th>Retornos</th></tr></thead><tbody>';
    rows.forEach(r => {
      html += '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + linkPsai(r.i_psai) +
        '</td><td>' + linkSai(r.i_sai) + '</td><td>' + r.tipoSAI + '</td><td><strong>' +
        (r.qtdTramite || 0) + '</strong></td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function detRevisoes(rows) {
    var denom = rows;
    var numer = [];
    var denomComRev = denom.filter(function(r) { return r.revisoes > 0; });
    var denomSemRev = denom.filter(function(r) { return !r.revisoes || r.revisoes === 0; });
    var revDenom = denomComRev.reduce(function(s, r) { return s + r.revisoes; }, 0);
    var revNumer = numer.reduce(function(s, r) { return s + r.revisoes; }, 0);
    var totalRev = revDenom + revNumer;
    var totalSais = denom.length;
    var indice = totalSais > 0 ? Math.round((totalRev / totalSais) * 100) / 100 : 0;

    return grupoSai('\u26A0 SAIs liberadas no m\u00eas com revis\u00e3o (A/C)', denomComRev, 'revisoes', 'eq-det--alerta') +
      grupoSai('\u2705 SAIs liberadas no m\u00eas sem revis\u00e3o', denomSemRev, 'revisoes', '') +
      '<div class="eq-det__formula"><strong>C\u00e1lculo:</strong> ' +
      totalRev + ' revis\u00f5es totais / ' + totalSais + ' SAIs liberadas no m\u00eas = <strong>' +
      indice.toFixed(2).replace('.', ',') + '</strong></div>';
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

  function detPontos(rows, isPsai) {
    let soma = 0;
    const semNivel = rows.filter(r => r.nivel_inferido);
    let html = '';
    if (semNivel.length > 0) {
      html += '<div class="eq-det__aviso">\u26A0 ' + semNivel.length +
        (isPsai ? ' PSAI(s)' : ' SAI(s)') + ' sem n\u00edvel definido \u2014 consideradas como <strong>Baixa</strong></div>';
    }
    const colLabel = isPsai ? 'PSAI' : 'SAI';
    html += '<div class="eq-det__grupo"><h5>' + (isPsai ? 'PSAIs' : 'SAIs') + ' (' + rows.length + ')</h5>' +
      '<table class="eq-tabela eq-tabela--det"><thead><tr>' +
      '<th>' + colLabel + '</th><th>Tipo</th><th>N\u00edvel</th><th>Pontos</th></tr></thead><tbody>';
    rows.forEach(r => {
      const pts = Number(r.pontuacao) || 0;
      soma += pts;
      const isFallback = r.pontos_fallback;
      const isInferido = r.nivel_inferido;
      const isOverride = r.override;
      const cls = isOverride ? ' class="eq-det--override"' : (isFallback || isInferido) ? ' class="eq-det--alerta"' : '';
      const nivelLabel = isInferido ? 'Baixa *' : (r.nivel || 'Baixa');
      const ptLabel = isFallback ? pts + ' \u26A0' : pts;
      const idLink = isPsai ? linkPsai(r.i_psai) : linkSai(r.i_sai);
      html += '<tr' + cls + '><td>' + idLink + '</td><td>' + r.tipoSAI +
        '</td><td>' + nivelLabel + '</td><td>' + ptLabel + '</td></tr>';
    });
    html += '</tbody><tfoot><tr><td colspan="3"><strong>Total</strong></td><td><strong>' +
      soma + '</strong></td></tr></tfoot></table></div>' +
      '<div class="eq-det__formula"><strong>Total calculado:</strong> ' + soma +
      ' pontos (tabela cargo x tipo x n\u00edvel) [Meta: \u2265 80]' +
      (rows.some(r => r.pontos_fallback) ? ' \u2014 \u26A0 linhas vermelhas usam pontuacao da planilha (combinacao sem tabela)' : '') +
      '</div>';
    return html;
  }

  const SIT_LABELS = { 4: 'Respondida', 11: 'Em Analise Coord.', 12: 'A Desenvolver' };

  function detGeracao(rows, maxDias) {
    const limite = maxDias || 3;
    const dentro = rows.filter(r => (Number(r.dias_uteis) || 0) <= limite);
    const fora = rows.filter(r => (Number(r.dias_uteis) || 0) > limite);
    const pct = rows.length > 0 ? Math.round((dentro.length / rows.length) * 10000) / 100 : 0;

    return grupoGer('\u2705 Dentro do prazo (\u2264 3 dias uteis)', dentro, '') +
      grupoGer('\u26A0 Fora do prazo (> 3 dias uteis)', fora, 'eq-det--alerta') +
      '<div class="eq-det__formula"><strong>Calculo:</strong> ' +
      dentro.length + '/' + rows.length + ' dentro do prazo (' + pct + '%). ' +
      'Media: <strong>' + media(rows) + ' d.u.</strong> [Meta: media \u2264 ' + limite + ' d.u.]</div>';
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

  function duRegistro(r) {
    return Number(r.dias_uteis != null ? r.dias_uteis : r.dias) || 0;
  }

  function detSS(rows) {
    const ordenados = [...rows].sort((a, b) => a.i_ss - b.i_ss || (a.i_ss_tramites || 0) - (b.i_ss_tramites || 0));
    const dentro = ordenados.filter(r => duRegistro(r) <= 3);
    const fora = ordenados.filter(r => duRegistro(r) > 3);
    const pct = ordenados.length > 0 ? Math.round((dentro.length / ordenados.length) * 10000) / 100 : 0;

    return grupoSSItens('\u2705 Respondidas em \u2264 3 dias uteis', dentro, '') +
      grupoSSItens('\u26A0 Respondidas em > 3 dias uteis', fora, 'eq-det--alerta') +
      '<div class="eq-det__formula"><strong>Calculo:</strong> ' +
      dentro.length + '/' + ordenados.length + ' em \u2264 3 D.U. = <strong>' +
      pct + '%</strong> [Meta: \u2265 95%]</div>';
  }

  function grupoSSItens(titulo, rows, cls) {
    if (rows.length === 0) return '';
    let html = '<div class="eq-det__grupo"><h5>' + titulo + ' (' + rows.length + ')</h5>' +
      '<table class="eq-tabela eq-tabela--det"><thead><tr>' +
      '<th>SS</th><th>Tramite</th><th>Entrada</th><th>Resposta</th><th>D.U.</th><th>D.C.</th></tr></thead><tbody>';
    rows.forEach(r => {
      const du = duRegistro(r);
      const dc = Number(r.dias_corridos) || 0;
      html += '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + linkSs(r.i_ss) + '</td><td>' +
        (r.i_ss_tramites || '-') + '</td><td>' +
        fmtData(r.entrada) + '</td><td>' + fmtData(r.data_resposta) + '</td><td><strong>' +
        du + '</strong></td><td class="eq-det--muted">' + dc + '</td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function detCruzamentoPlanilha(p) {
    if (!p || p.erro) return '';
    if (!p.temDivergencia && !p.semPontosNaPlanilha.length) {
      return '<div class="eq-det__cruzamento eq-det__cruzamento--ok">' +
        '\u2705 Planilha x SGD: sem divergencias. Total planilha: <strong>' + p.totalPlanilha + ' pts</strong></div>';
    }
    let html = '<div class="eq-det__cruzamento"><h5>\uD83D\uDCCB Cruzamento Planilha x SGD</h5>';

    if (p.divergencias.length > 0) {
      html += '<p class="eq-det__cruzamento-sub">\u26A0 Divergencias de pontuacao</p>' +
        '<table class="eq-tabela eq-tabela--det"><thead><tr>' +
        '<th>SAI</th><th>Tipo</th><th>Nivel</th><th>SGD</th><th>Planilha</th><th>Situacao</th>' +
        '</tr></thead><tbody>';
      p.divergencias.forEach(r => {
        const sit = r.motivo === 'sgd_sem_pontos' ? 'Sem pontos no SGD' : 'Valor diferente';
        html += '<tr class="eq-det--alerta"><td>' + linkSai(r.i_sai) + '</td><td>' + r.tipoSAI +
          '</td><td>' + (r.nivel || '-') + '</td><td>' + (r.pontos_sgd != null ? r.pontos_sgd : '\u2014') +
          '</td><td><strong>' + r.pontos_planilha + '</strong></td><td>' + sit + '</td></tr>';
      });
      html += '</tbody></table>';
    }

    if (p.apenasNaPlanilha.length > 0) {
      html += '<p class="eq-det__cruzamento-sub">\uD83D\uDD0D SAIs na planilha nao encontradas no SGD</p>' +
        '<table class="eq-tabela eq-tabela--det"><thead><tr>' +
        '<th>SAI</th><th>Tipo</th><th>Nivel</th><th>Pontos planilha</th>' +
        '</tr></thead><tbody>';
      p.apenasNaPlanilha.forEach(r => {
        html += '<tr class="eq-det--alerta"><td>' + linkSai(r.i_sai) + '</td><td>' + r.tipoSAI +
          '</td><td>' + (r.nivel || '-') + '</td><td>' + (r.pontos_planilha != null ? r.pontos_planilha : '\u2014') + '</td></tr>';
      });
      html += '</tbody></table>';
    }

    html += '<div class="eq-det__formula">Total planilha: <strong>' + p.totalPlanilha + ' pts</strong></div></div>';
    return html;
  }

  const SIT_DESC_LABEL = { 5: 'Conc. sem Dev', 6: 'Reprovada', 23: 'Prescrita', 33: 'Sist. Desc.' };

  function detPctDescartes(rows) {
    if (!rows.length) return '<div class="eq-sem-dados">Nenhuma SAI no mes</div>';
    const descartadas = rows.filter(r => Number(r.descartada) === 1);
    const analisadas = rows.filter(r => Number(r.descartada) === 0);
    const pct = rows.length > 0 ? Math.round(descartadas.length / rows.length * 100) : 0;
    const tabelaRows = arr => arr.map(r => {
      const sit = SIT_DESC_LABEL[Number(r.i_psai_situacoes)] || '';
      return '<tr><td>' + linkPsai(r.i_psai) + '</td><td>' + linkSai(r.i_sai) +
        '</td><td>' + r.tipoSAI + '</td><td>' + fmtData(r.CadastroSAI) +
        (sit ? '</td><td>' + sit : '</td><td>—') + '</td></tr>';
    }).join('');
    const theadDesc = '<table class="eq-tabela eq-tabela--det"><thead><tr>' +
      '<th>PSAI</th><th>SAI</th><th>Tipo</th><th>Data Situa\u00e7\u00e3o</th><th>Situa\u00e7\u00e3o</th>' +
      '</tr></thead><tbody>';
    const theadAnal = '<table class="eq-tabela eq-tabela--det"><thead><tr>' +
      '<th>PSAI</th><th>SAI</th><th>Tipo</th><th>Cadastro</th><th>Situa\u00e7\u00e3o</th>' +
      '</tr></thead><tbody>';
    let html = '';
    if (descartadas.length) {
      html += '<div class="eq-det__grupo eq-det--alerta"><h5>\u26A0 Descartadas (' + descartadas.length + ')</h5>' +
        theadDesc + tabelaRows(descartadas) + '</tbody></table></div>';
    }
    if (analisadas.length) {
      html += '<div class="eq-det__grupo"><h5>\u2705 Analisadas (' + analisadas.length + ')</h5>' +
        theadAnal + tabelaRows(analisadas) + '</tbody></table></div>';
    }
    const totalDenom = analisadas.length + rows.filter(r => Number(r.descartada) === 0).length;
    html += '<div class="eq-det__formula"><strong>% Descarte:</strong> ' +
      descartadas.length + ' / (' + analisadas.filter(r => r.i_sai > 0).length + ' SAIs + ' +
      analisadas.filter(r => !r.i_sai || r.i_sai == 0).length + ' An\u00e1lises) = <strong>' + pct + '%</strong> [Meta: \u2264 30%]</div>';
    return html;
  }
  function detDescartes(rows) {
    if (!rows.length) return '<div class="eq-sem-dados">Nenhuma PSAI descartada no mes</div>';
    const soma = rows.reduce((s, r) => s + (Number(r.total_analise)||0) + (Number(r.total_definicao)||0), 0);
    const media = Math.round(soma / rows.length);
    let html = '<div class="eq-det__grupo"><table class="eq-tabela eq-tabela--det"><thead><tr>' +
      '<th>PSAI</th><th>Situa\u00e7\u00e3o</th><th>Cadastro</th><th>An\u00e1lise</th><th>Defini\u00e7\u00e3o</th><th>Total</th>' +
      '</tr></thead><tbody>';
    rows.forEach(r => {
      const anal = Number(r.total_analise)||0, def = Number(r.total_definicao)||0, tot = anal+def;
      const cls = tot > 300 ? ' class="eq-det--alerta"' : '';
      const sit = SIT_DESC_LABEL[Number(r.i_psai_situacoes)] || ('sit=' + r.i_psai_situacoes);
      html += '<tr' + cls + '><td>' + linkPsai(r.i_psai) + '</td><td>' + sit +
        '</td><td>' + fmtData(r.CadastroPSAI) + '</td><td>' + fmtMin(anal) +
        '</td><td>' + fmtMin(def) + '</td><td><strong>' + tot + ' min</strong></td></tr>';
    });
    html += '</tbody></table></div><div class="eq-det__formula"><strong>M\u00e9dia por PSAI:</strong> ' +
      media + ' min (' + fmtMin(media) + ') | PSAIs: ' + rows.length + ' | Meta: \u2264 300min</div>';
    return html;
  }

  function detTempoSal(rows) {
    if (!rows.length) return '<div class="eq-sem-dados">Nenhuma an\u00e1lise no mes</div>';
    const sal  = rows.filter(r => r.tipoSAI === 'SAL');
    const ne   = rows.filter(r => r.tipoSAI === 'NE');
    const sail = rows.filter(r => r.tipoSAI === 'SAIL');
    const sam  = rows.filter(r => r.tipoSAI === 'SAM');
    const outros = rows.filter(r => !['SAL','NE','SAIL','SAM'].includes(r.tipoSAI));
    const tabelaAnal = (grupo, limite) => {
      if (!grupo.length) return '';
      let t = '<table class="eq-tabela eq-tabela--det"><thead><tr>' +
        '<th>PSAI</th><th>SAI</th><th>Tipo</th><th>N\u00edvel</th><th>An\u00e1lise (min)</th><th>Defini\u00e7\u00e3o (min)</th><th>Total (min)</th>' +
        '</tr></thead><tbody>';
      grupo.forEach(r => {
        const anal = Number(r.total_analise)||0, def = Number(r.total_definicao)||0, tot = anal+def;
        const rowCls = limite && tot > limite ? ' class="eq-det--alerta"' : '';
        t += '<tr' + rowCls + '><td>' + linkPsai(r.i_psai) + '</td><td>' + linkSai(r.i_sai) +
          '</td><td>' + r.tipoSAI + '</td><td>' + (r.nivel||'N/D') +
          '</td><td>' + anal + '</td><td>' + def +
          '</td><td><strong>' + tot + '</strong></td></tr>';
      });
      return t + '</tbody></table>';
    };
    const somaTot = arr => arr.reduce((s, r) => s + (Number(r.total_analise)||0) + (Number(r.total_definicao)||0), 0);
    const mediaGrupo = arr => arr.length ? Math.round(somaTot(arr) / arr.length) : null;
    const mrSal = mediaGrupo(sal);
    const grupoHtml = (titulo, grupo, limite, ok) => {
      if (!grupo.length) return '';
      const icone = ok === true ? '\u2705' : ok === false ? '\u26A0' : '\u2139';
      return '<div class="eq-det__grupo"><h5>' + icone + ' ' + titulo + ' (' + grupo.length + ')</h5>' +
        tabelaAnal(grupo, limite) + '</div>';
    };
    const salOk = mrSal != null ? mrSal <= 800 : null;
    return grupoHtml('SAL \u2014 m\u00e9dia: ' + (mrSal != null ? mrSal + ' min' : '-') + ' | Meta \u2264 800min', sal, 800, salOk) +
      grupoHtml('NE', ne, null, null) +
      grupoHtml('SAIL', sail, null, null) +
      grupoHtml('SAM', sam, null, null) +
      (outros.length ? grupoHtml('Outros', outros, null, null) : '');
  }

  function somaMin(rows) { return rows.reduce((s, r) => s + (r.minutos || 0), 0); }
  function media(rows) {
    if (!rows.length) return '0';
    const s = rows.reduce((a, r) => a + (Number(r.dias_uteis) || 0), 0);
    return (Math.round((s / rows.length) * 100) / 100).toFixed(2).replace('.', ',');
  }

  return { render };
})();
