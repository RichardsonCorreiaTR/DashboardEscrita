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
    'indice-revisoes-sal-ne': {
      formula: 'Indice = Total Revisoes (A/C) / Total SAIs no mes',
      considerado: [
        'SAIs de NE cadastradas no mes, area Escrita, produto grupo 1',
        'Somente revisoes: Alteracao na definicao (1,4) e Complemento (2,5)',
        'Analistas: por psai.i_responsaveis | Especialista: por sai.i_usuarios'
      ]
    },
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
    'indice-revisoes-sal-ne': 'Revisoes NE',
    'respostas-ss-3d': 'Respostas SS',
    'gerar-sai-ne-sal-3d': 'Gerar SAI NE'
  };

  async function carregar() {
    const r = await fetch('/api/metas-equipe/config');
    _config = await r.json();
    return _config;
  }

  function colaboradores() { return _config ? _config.colaboradores : []; }

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

  return { EXPLICACOES, LABELS, carregar, colaboradores, obterMetas, formatarValor };
})();
