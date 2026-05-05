/**
 * proposta-metas-dados.js - Definicao das 3 metas propostas
 *
 * Carregar ANTES de app-proposta-metas.js.
 */

/* eslint-disable no-unused-vars */
const PropostaDados = (() => {
  const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const CORES = [
    '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16'
  ];

  const METAS = [
    {
      id: 'tempo-ciclo-analise',
      nome: 'Tempo Medio de Ciclo de Analise',
      explicacao: `Mede quanto tempo (em dias uteis) cada pessoa leva para completar
        seu papel no ciclo de analise de uma PSAI. Para Jr/Pleno: tempo entre
        receber a PSAI e enviar a analise. Para Especialista: tempo entre receber
        a analise e responder. Quanto menor, mais agil o fluxo.`,
      comoFunciona: `Duas perspectivas combinadas: (1) o analista Jr/Pleno recebe a
        PSAI (via resposta anterior do coordenador ou criacao da PSAI) e envia a
        analise (sit 2); (2) o Especialista recebe a analise (sit 2) e responde
        (sit 4/11/12). Sabados e domingos sao excluidos.`,
      formula: 'MEDIA(dias uteis do ciclo de cada analista)',
      unidade: 'dias uteis',
      direcao: 'menor-melhor',
      fonte: 'psai_tramites (mesma base da meta gerar-sai-ne-sal-3d)',
      sugestao2026: { junior: '<= 5 dias', pleno: '<= 4 dias', especialista: '<= 3 dias' },
      campoValor: 'media_dias',
      campoCiclos: 'total_ciclos',
      tipoGrafico: 'line'
    },
    {
      id: 'complexidade-media',
      nome: 'Complexidade Media das SAIs',
      explicacao: `Cada SAI no SGD tem uma pontuacao que reflete sua complexidade.
        SAIs simples (ex: ajuste de label) valem 1-2 pontos; SAIs complexas
        (ex: novo calculo trabalhista) valem 5-10+. Essa meta acompanha a media
        de pontuacao por analista ao longo do ano.`,
      comoFunciona: `Agrupamos as SAIs por analista responsavel (quem definiu a PSAI)
        e calculamos a media de pontuacao por mes. Ao longo do ano, um Junior
        deveria ir assumindo SAIs mais complexas conforme ganha experiencia.
        Se a media sobe trimestre a trimestre, o analista esta evoluindo.`,
      formula: 'MEDIA(sai.pontuacao) por analista por mes',
      unidade: 'pontos',
      direcao: 'maior-melhor',
      fonte: 'sai.pontuacao + psai.i_responsaveis (mesma base de pontos-definicao)',
      sugestao2026: { junior: 'crescimento trimestral', pleno: '>= 3,0', especialista: 'referencia' },
      campoValor: 'media_pontuacao',
      campoCiclos: 'qtd_sais',
      tipoGrafico: 'line'
    },
    {
      id: 'cobertura-estimativa',
      nome: 'Cobertura de Estimativa',
      explicacao: `De todas as SAIs alocadas ao analista, quantas possuem estimativa
        de tempo preenchida (campo tempo_previsto > 0). Estimativas sao essenciais
        para o coordenador planejar entregas e distribuir carga de trabalho.`,
      comoFunciona: `Consultamos sai_responsaveis, que tem os campos tempo_previsto
        e tempo_trabalhado. Contamos quantas SAIs tem tempo_previsto > 0 vs o total.
        O resultado e uma porcentagem: 100% significa que todas as SAIs receberam
        estimativa antes de comecar.`,
      formula: '(SAIs com tempo_previsto > 0 / Total SAIs) * 100',
      unidade: '%',
      direcao: 'maior-melhor',
      fonte: 'sai_responsaveis (tempo_previsto, tempo_trabalhado)',
      sugestao2026: { junior: '>= 70%', pleno: '>= 80%', especialista: '>= 90%' },
      campoValor: null,
      campoCiclos: 'total_sais',
      tipoGrafico: 'bar'
    }
  ];

  return { MESES, CORES, METAS };
})();
