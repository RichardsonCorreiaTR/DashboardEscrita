/**
 * metas-config.js - Config de metas carregado da API + dados de apresentacao
 *
 * COLABORADORES e METAS vem do backend (fonte unica: config/*.json).
 * EXPLICACOES e LABELS sao dados de apresentacao do frontend.
 */

/* eslint-disable no-unused-vars */
const MetasConfig = (() => {
  let _config = null;

  const EXPLICACOES = {
    'controle-descartes': {
      formula: 'M\u00e9dia = SUM(tempo_analise + tempo_definicao) / COUNT(PSAIs descartadas) por mes',
      considerado: [
        'Situacoes: Concluido sem Desenvolvimento (5), Reprovada (6), Prescrita (23), Sistema Descontinuado (33)',
        'Tempo por PSAI: SUM de todos os registros do analista em psai_responsaveis',
        'Meta: media <= 300 min por PSAI descartada (quanto menor, melhor)',
        'Fonte: bethadba.psai_responsaveis + UP.SAI_PSAI'
      ]
    },
    'tempo-medio-sal': {
      formula: 'M\u00e9dia = SUM(tempoRealizadoTotal) / COUNT(SALs) por mes',
      considerado: [
        'SALs da area Escrita onde o analista e responsavel (psai.i_responsaveis)',
        'Colunas: tempoPrevistoTotal (planejado) e tempoRealizadoTotal (realizado)',
        'Meta: media realizada \u2264 800 min (quanto menor, melhor)',
        'Fonte: UP.SAI_PSAI por CadastroSAI'
      ]
    },
    'tempo-trabalho-principal': {
      formula: '% = Tempo em atividades principais / (Total registrado - Ausencias) x 100',
      considerado: [
        'Analistas: analisar/definir SAL/SAIL/SAM/NE, revisoes, reunioes de definicao, Respondendo SS',
        'Especialistas: SAI-Gerando SAI de SAL/SAIL/SAM/NE',
        'Ausencias excluidas: Feriado, Ferias, Folga aprovada',
        'Fonte: bethadba.vanalise_registro_atividades por i_usuarios e mes'
      ]
    },
    'tempo-trabalho-analise': {
      formula: '% = Tempo em atividades afins SAI/PSAI / (Total registrado - Ausencias) x 100',
      considerado: [
        'Atividades de analise, definicao, revisao, esclarecimento, reunioes SAI/PSAI etc.',
        'Ausencias excluidas: Feriado, Ferias, Folga aprovada',
        'Outras atividades (pessoal, treinamento recebido, RH etc.) nao contam',
        'Fonte: bethadba.vanalise_registro_atividades por i_usuarios e mes'
      ]
    },
    'tempo-trabalho-geracao': {
      formula: '% = Tempo em atividades SAI-NE / (Total registrado - Ausencias) x 100',
      considerado: [
        'Atividades com NE, SAI, SS ou Esclarecimento de Duvidas no nome',
        'Excluido: Feriado, Ferias, Folga, Saida Particular, Afastamento',
        'Fonte: bethadba.vanalise_registro_atividades por i_usuarios e mes'
      ]
    },
    'tempo-gerando-sai': {
      formula: '% = Tempo em atividades "Gerando SAI" / (Total registrado - Ausencias) x 100',
      considerado: [
        'Atividades cujo nome contem "Gerando SAI" (ex: SAI-Gerando SAI de NE/SAL/SAM)',
        'Excluido: Feriado, Ferias, Folga, Saida Particular, Afastamento',
        'Fonte: bethadba.vanalise_registro_atividades por i_usuarios e mes'
      ]
    },
    'pontos-definicao': {
      formula: 'Pontos = SUM(sai.pontuacao) das SAIs cadastradas no mes',
      considerado: [
        'SAIs com pontuacao atribuida, area Escrita, produto grupo 1',
        'Vinculado por psai.i_responsaveis = codigo-sgd do analista',
        'Filtro: YEAR/MONTH do CadastroSAI'
      ]
    },
    'indice-revisoes-sal':     { formula: 'Indice = Total Revisoes (A/C) / Total SAIs no mes', considerado: ['SAL, area Escrita | Analistas: psai.i_responsaveis | Especialistas: sai.i_usuarios', 'Revisoes: Alteracao (1,4) e Complemento (2,5) | Meta: <= 0,50'] },
    'indice-revisoes-ne':      { formula: 'Indice = Total Revisoes (A/C) / Total SAIs no mes', considerado: ['NE, area Escrita | Analistas: psai.i_responsaveis | Especialistas: sai.i_usuarios', 'Revisoes: Alteracao (1,4) e Complemento (2,5) | Meta: <= 0,50'] },
    'indice-revisoes-sail':    { formula: 'Indice = Total Revisoes (A/C) / Total SAIs no mes', considerado: ['SAIL, area Escrita | Analistas: psai.i_responsaveis | Especialistas: sai.i_usuarios', 'Revisoes: Alteracao (1,4) e Complemento (2,5) | Meta: <= 1,15'] },
    'indice-revisoes-sam-imp': { formula: 'Indice = Total Revisoes (A/C) / Total SAIs no mes', considerado: ['SAM Importacao (area != Escrita) | Analistas: psai.i_responsaveis | Especialistas: sai.i_usuarios', 'Revisoes: Alteracao (1,4) e Complemento (2,5) | Meta: <= 0,80'] },
    'indice-revisoes-sam-esc': { formula: 'Indice = Total Revisoes (A/C) / Total SAIs no mes', considerado: ['SAM Escrita (area = Escrita) | Analistas: psai.i_responsaveis | Especialistas: sai.i_usuarios', 'Revisoes: Alteracao (1,4) e Complemento (2,5) | Meta: <= 0,50'] },
    'respostas-ss-3d': {
      formula: '% = (tramites em ate 3 D.U. / Total tramites) x 100',
      considerado: [
        'Tramite em que o colaborador fecha a pergunta (pergunta.data_resposta = resposta.entrada)',
        'Respostas intermediarias do mesmo membro ao mesmo analista colapsam na ultima',
        'Produto grupo 1; prazo em dias uteis (D.U.)',
        'Mesma base da pagina SS Respondidas',
      ]
    },
    'gerar-sai-ne-sal-3d': {
      formula: '% no prazo = (Tramitacoes respondidas em <= 3 dias uteis / Total no mes) x 100',
      considerado: [
        'Ciclo: analista envia PSAI (sit=2 Analisada) -> coordenador responde',
        'Resposta = primeiro tramite do coordenador (sit 4, 11 ou 12) apos o envio',
        'Dias uteis = dias corridos excluindo sabados e domingos',
        'D.U. = Dias Uteis (usado no calculo) | D.C. = Dias Corridos (referencia)',
        'Conta apenas tramitacoes do proprio coordenador (psai_tramites.i_usuarios)',
        'Multiplos ciclos por PSAI sao contados individualmente'
      ]
    },
    'indice-retornos-sal': { formula: 'Indice = SUM(Qtde Tramite) / COUNT(PSAIs SAL) no mes', considerado: ['Retornos por complemento ou alteracao de definicao | Meta: <= 1,00', 'Fonte: planilha de acompanhamento (coluna Qtde Tramite)'] },
    'indice-retornos-sail-sam': { formula: 'Indice = SUM(Qtde Tramite) / COUNT(PSAIs SAIL+SAM) no mes', considerado: ['Retornos por complemento ou alteracao de definicao | Meta: <= 1,50', 'Fonte: planilha de acompanhamento (coluna Qtde Tramite)'] }
  };

  // Mapeamento de meta → grupo visual + label curto na aba
  const GRUPO_TABS = {
    'pontos-definicao':             { grupo: 'Pontos', label: 'Defini\u00e7\u00e3o' },
    'pontos-atividade-principal':   { grupo: 'Pontos', label: 'Atividade Principal' },
    'pontos-gerados':               { grupo: 'Pontos', label: 'SAIs Geradas' },
    'psais-definidas':              { grupo: 'Pontos', label: 'PSAIs Definidas' },
    'sais-definidas-esp':           { grupo: 'Pontos', label: 'SAIs Definidas' },
    'conclusao-pontos':             { grupo: 'Pontos', label: 'Conclusão' },
    'tempo-trabalho-analise':   { grupo: 'Tempos',   label: 'Atividade Afins' },
    'tempo-trabalho-geracao':   { grupo: 'Tempos',   label: 'Atividade' },
    'tempo-trabalho-principal': { grupo: 'Tempos',   label: 'Atividade Principal' },
    'tempo-gerando-sai':        { grupo: 'Tempos',   label: 'Gerando SAI' },
    'tempo-medio-sal':          { grupo: 'Tempos',   label: 'M\u00e9dia An\u00e1lise' },
    'controle-revisoes':        { grupo: 'Controle',  label: 'Revis\u00f5es' },
    'controle-retornos':        { grupo: 'Controle',  label: 'Retornos' },
    'ne-definicao':             { grupo: 'Diversos',  label: 'NE Defini\u00e7\u00e3o' },
    'controle-geracao':         { grupo: 'Diversos',  label: 'Gerar SAI' },
    'controle-descartes':       { grupo: 'Diversos',  label: 'Descartes' },
    'pct-descartes':            { grupo: 'Diversos',  label: '% Descartes' },
    'respostas-ss-3d':          { grupo: 'Diversos',  label: 'Respostas SS' },
  };

  function buildGruposVisuais(agrupadas) {
    const grupos = [];
    let grupoAtual = null;
    agrupadas.forEach((m, i) => {
      const key = m.isGrupo ? ('controle-' + m.tipo) : m.id;
      const gi = GRUPO_TABS[key];
      const titulo = gi ? gi.grupo : null;
      const label = gi ? gi.label : (LABELS[m.id] || m.id);
      if (titulo && grupoAtual && grupoAtual.titulo === titulo) {
        grupoAtual.items.push({ m, i, label });
      } else {
        grupoAtual = titulo ? { titulo, items: [{ m, i, label }] } : null;
        grupos.push(grupoAtual || { titulo: null, items: [{ m, i, label }] });
      }
    });
    return grupos;
  }

  const LABELS = {
    'tempo-trabalho-principal': 'Tempo Atividade Principal',
    'tempo-trabalho-analise': 'Tempo Atividade Afins',
    'tempo-medio-sal': 'M\u00e9dia An\u00e1lise',
    'controle-descartes': 'Controle Descartes',
    'pct-descartes': '% Descartes',
    'tempo-trabalho-geracao': 'Tempo Geracao',
    'tempo-gerando-sai': '% Tempo gerando SAI',
    'pontos-definicao': 'Pontos Defini\u00e7\u00e3o',
    'pontos-atividade-principal': 'Atividade Principal',
    'pontos-gerados': 'SAIs Geradas',
    'sais-definidas-esp': 'SAIs Definidas',
    'indice-revisoes-sal':     'Revisoes SAL',
    'indice-revisoes-ne':      'Revisoes NE',
    'indice-revisoes-sail':    'Revisoes SAIL',
    'indice-revisoes-sam-imp': 'Revisoes SAM Imp',
    'indice-revisoes-sam-esc': 'Revisoes SAM Esc',
    'respostas-ss-3d': 'Respostas SS',
    'gerar-sai-ne-sal-3d': 'Gerar SAI NE',
    'gerar-sai-sal-5d': 'Gerar SAI SAL',
    'gerar-sai-sail-sam-7d': 'Gerar SAI SAIL/SAM',
    'indice-retornos-sal': 'Retornos SAL',
    'indice-retornos-sail-sam': 'Retornos SAIL/SAM'
  };

  async function carregar() {
    const r = await fetch('/api/metas-equipe/config');
    _config = await r.json();
    return _config;
  }

  function colaboradores() { return _config ? _config.colaboradores : []; }
  function coordenadores() { return _config ? (_config.coordenadores || []) : []; }
  function coordenador() { return coordenadores()[0] || null; }

  function obterMetas(colab) {
    if (!_config) return [];
    const tmpl = _config.templates[colab.senioridade] || [];
    const extras = (_config.overrides[colab.slug] || {})['metas-adicionais'] || [];
    const ids = [...tmpl, ...extras].filter(id => id !== 'diretrizes-95');
    const isEsp = colab.senioridade === 'especialista';
    return ids.map(id => {
      const m = _config.metas[id];
      if (!m) return null;
      let desc = m.descricao, valor = m['valor-esperado'];
      if (id === 'tempo-trabalho-principal') {
        desc = isEsp
          ? 'Atingir 50% do tempo trabalhado na atividade principal'
          : 'Atingir 70% do tempo trabalhado na atividade principal';
        valor = isEsp ? 50 : 70;
      }
      return { id, desc, det: m.detalhes, valor, un: m.unidade, dir: m.direcao, fonte: m.fonte };
    }).filter(Boolean);
  }

  function formatarValor(val, un) {
    if (un === '%') return val + '%';
    if (un === 'indice') return val.toFixed(2).replace('.', ',');
    if (un === 'dias-uteis') return val + ' dias uteis';
    return val + ' ' + un;
  }

  const GRUPO_REVISOES_IDS = [
    'indice-revisoes-sal', 'indice-revisoes-ne', 'indice-revisoes-sail',
    'indice-revisoes-sam-imp', 'indice-revisoes-sam-esc'
  ];
  const GRUPO_REVISOES_META = {
    'indice-revisoes-sal':     { titulo: 'SAL',           meta: '\u2264 0,50' },
    'indice-revisoes-ne':      { titulo: 'NE',            meta: '\u2264 0,50' },
    'indice-revisoes-sail':    { titulo: 'SAIL',          meta: '\u2264 1,15' },
    'indice-revisoes-sam-imp': { titulo: 'SAM Importa\u00e7\u00e3o', meta: '\u2264 0,80' },
    'indice-revisoes-sam-esc': { titulo: 'SAM Escrita',  meta: '\u2264 0,50' }
  };

  const GRUPO_RETORNOS_IDS = ['indice-retornos-sal', 'indice-retornos-sail-sam'];
  const GRUPO_RETORNOS_META = {
    'indice-retornos-sal':      { titulo: 'SAL',       meta: '\u2264 1,00' },
    'indice-retornos-sail-sam': { titulo: 'SAIL / SAM', meta: '\u2264 1,50' }
  };

  function _gruparIds(metas, ids, grupoId, tipo) {
    const pos = metas.findIndex(m => ids.includes(m.id));
    if (pos === -1) return metas;
    const subIds = metas.filter(m => ids.includes(m.id)).map(m => m.id);
    const outros = metas.filter(m => !ids.includes(m.id));
    return [...outros.slice(0, pos), { id: grupoId, isGrupo: true, tipo, subIds }, ...outros.slice(pos)];
  }

  const GRUPO_GERACAO_IDS = ['gerar-sai-ne-sal-3d', 'gerar-sai-sal-5d', 'gerar-sai-sail-sam-7d'];
  const GRUPO_GERACAO_META = {
    'gerar-sai-ne-sal-3d':    { titulo: 'NE',        meta: 'M\u00e9dia \u2264 3 d.u.' },
    'gerar-sai-sal-5d':       { titulo: 'SAL',       meta: 'M\u00e9dia \u2264 5 d.u.' },
    'gerar-sai-sail-sam-7d':  { titulo: 'SAIL / SAM', meta: 'M\u00e9dia \u2264 7 d.u.' }
  };

  function agruparMetas(metas) {
    let result = _gruparIds(metas, GRUPO_REVISOES_IDS, 'controle-revisoes', 'revisoes');
    result = _gruparIds(result, GRUPO_RETORNOS_IDS, 'controle-retornos', 'retornos');
    result = _gruparIds(result, GRUPO_GERACAO_IDS, 'controle-geracao', 'geracao');
    // Injetar conclusao-pontos apos psais-definidas (somente para analistas)
    const saisDefIdx = result.findIndex(m => !m.isGrupo && m.id === 'psais-definidas');
    if (saisDefIdx >= 0) {
      result.splice(saisDefIdx + 1, 0, {
        id: 'conclusao-pontos', isGrupo: false, desc: 'Conclusão dos Pontos', valor: null, un: null
      });
    }
    // Injetar NE Definicao apos o grupo de retornos
    const retIdx = result.findIndex(m => m.isGrupo && m.tipo === 'retornos');
    const neEntry = { id: 'ne-definicao', isGrupo: false, desc: 'NEs com Defini\u00e7\u00e3o', valor: null, un: null, dir: 'menor-melhor', fonte: 'Planilha An\u00e1lise de NEs' };
    if (retIdx >= 0) result.splice(retIdx + 1, 0, neEntry);
    else result.push(neEntry);
    return result;
  }

  function renderConteudoGrupoGeracao(subIds) {
    const header = '<div class="eq-meta"><h3 class="eq-meta__titulo">Gerar SAI</h3>' +
      '<p class="eq-meta__detalhe">Gerar SAIs ou retornar ao analista dentro do prazo (dias \u00fateis). Ciclo: analista envia (sit=2) \u2192 coordenador responde (sit 4, 11 ou 12).</p></div>';
    const subtipos = subIds.map(id => {
      const cfg = GRUPO_GERACAO_META[id] || { titulo: id, meta: '' };
      return '<div class="eq-ctrl-rev__subtipo">' +
        '<h4 class="eq-ctrl-rev__titulo">' + cfg.titulo +
        '<span class="eq-ctrl-rev__meta">' + cfg.meta + '</span></h4>' +
        '<div data-meta-id="' + id + '"><div class="eq-sem-dados">Carregando...</div></div></div>';
    }).join('');
    return header + subtipos;
  }

  function renderConteudoGrupoRevisoes(subIds) {
    const header = '<div class="eq-meta"><h3 class="eq-meta__titulo">Controle de Revis\u00f5es</h3>' +
      '<p class="eq-meta__detalhe">Somente revis\u00f5es de Altera\u00e7\u00e3o (1,4) e Complemento (2,5) na defini\u00e7\u00e3o</p></div>';
    const subtipos = subIds.map(id => {
      const cfg = GRUPO_REVISOES_META[id] || { titulo: id, meta: '' };
      return '<div class="eq-ctrl-rev__subtipo">' +
        '<h4 class="eq-ctrl-rev__titulo">' + cfg.titulo +
        '<span class="eq-ctrl-rev__meta">' + cfg.meta + '</span></h4>' +
        '<div data-meta-id="' + id + '"><div class="eq-sem-dados">Carregando...</div></div></div>';
    }).join('');
    return header + subtipos;
  }

  function renderConteudoGrupoRetornos(subIds) {
    const header = '<div class="eq-meta"><h3 class="eq-meta__titulo">Controle de Retornos</h3>' +
      '<p class="eq-meta__detalhe">Retornos por complemento ou altera\u00e7\u00e3o de defini\u00e7\u00e3o. \u00cdndice = SUM(Qtde Tr\u00e2mite) / COUNT(PSAIs) por m\u00eas.</p></div>';
    const subtipos = subIds.map(id => {
      const cfg = GRUPO_RETORNOS_META[id] || { titulo: id, meta: '' };
      return '<div class="eq-ctrl-rev__subtipo">' +
        '<h4 class="eq-ctrl-rev__titulo">' + cfg.titulo +
        '<span class="eq-ctrl-rev__meta">' + cfg.meta + '</span></h4>' +
        '<div data-meta-id="' + id + '"><div class="eq-sem-dados">Carregando...</div></div></div>';
    }).join('');
    return header + subtipos;
  }

  return { EXPLICACOES, LABELS, carregar, colaboradores, coordenadores, coordenador,
    obterMetas, formatarValor, agruparMetas, buildGruposVisuais,
    renderConteudoGrupoRevisoes, renderConteudoGrupoRetornos, renderConteudoGrupoGeracao };
})();
