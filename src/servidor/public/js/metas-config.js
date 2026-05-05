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
    'tempo-trabalho-analise': {
      formula: '% = Tempo em atividades SAI-NE / (Total registrado - Ausencias) x 100',
      considerado: [
        'Atividades com NE, SAI, SS ou Esclarecimento de Duvidas no nome',
        'Excluido: Feriado, Ferias, Folga, Saida Particular, Afastamento',
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
    'indice-revisoes-sail':    { formula: 'Indice = Total Revisoes (A/C) / Total SAIs no mes', considerado: ['SAIL, area Escrita | Analistas: psai.i_responsaveis | Especialistas: sai.i_usuarios', 'Revisoes: Alteracao (1,4) e Complemento (2,5) | Meta: <= 0,50'] },
    'indice-revisoes-sam-imp': { formula: 'Indice = Total Revisoes (A/C) / Total SAIs no mes', considerado: ['SAM Importacao (area != Escrita) | Analistas: psai.i_responsaveis | Especialistas: sai.i_usuarios', 'Revisoes: Alteracao (1,4) e Complemento (2,5) | Meta: <= 0,80'] },
    'indice-revisoes-sam-esc': { formula: 'Indice = Total Revisoes (A/C) / Total SAIs no mes', considerado: ['SAM Escrita (area = Escrita) | Analistas: psai.i_responsaveis | Especialistas: sai.i_usuarios', 'Revisoes: Alteracao (1,4) e Complemento (2,5) | Meta: <= 0,50'] },
    'respostas-ss-3d': {
      formula: '% = (SSs respondidas em ate 3 dias / Total respostas) x 100',
      considerado: [
        'Respostas de SS com data_resposta no mes, produto grupo 1',
        'Prazo: DATEDIFF(day, entrada, data_resposta) <= 3',
        'Vinculado por ss_tramites.i_usuarios'
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
    }
  };

  const LABELS = {
    'tempo-trabalho-analise': 'Tempo Analise',
    'tempo-trabalho-geracao': 'Tempo Geracao',
    'pontos-definicao': 'Pontos Definicao',
    'indice-revisoes-sal':     'Revisoes SAL',
    'indice-revisoes-ne':      'Revisoes NE',
    'indice-revisoes-sail':    'Revisoes SAIL',
    'indice-revisoes-sam-imp': 'Revisoes SAM Imp',
    'indice-revisoes-sam-esc': 'Revisoes SAM Esc',
    'respostas-ss-3d': 'Respostas SS',
    'gerar-sai-ne-sal-3d': 'Gerar SAI NE'
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
    return ids.map(id => {
      const m = _config.metas[id];
      if (!m) return null;
      return {
        id, desc: m.descricao, det: m.detalhes,
        valor: m['valor-esperado'], un: m.unidade, dir: m.direcao, fonte: m.fonte
      };
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
    'indice-revisoes-sail':    { titulo: 'SAIL',          meta: '\u2264 0,50' },
    'indice-revisoes-sam-imp': { titulo: 'SAM Importa\u00e7\u00e3o', meta: '\u2264 0,80' },
    'indice-revisoes-sam-esc': { titulo: 'SAM Escrita',  meta: '\u2264 0,50' }
  };

  function agruparMetas(metas) {
    const pos = metas.findIndex(m => GRUPO_REVISOES_IDS.includes(m.id));
    if (pos === -1) return metas;
    const subIds = metas.filter(m => GRUPO_REVISOES_IDS.includes(m.id)).map(m => m.id);
    const outros = metas.filter(m => !GRUPO_REVISOES_IDS.includes(m.id));
    return [...outros.slice(0, pos), { id: 'controle-revisoes', isGrupo: true, subIds }, ...outros.slice(pos)];
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

  return { EXPLICACOES, LABELS, carregar, colaboradores, coordenadores, coordenador,
    obterMetas, formatarValor, agruparMetas, renderConteudoGrupoRevisoes };
})();
