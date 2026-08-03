/**
 * diretrizes-cards.js - Configuracao e render dos cards de indicadores
 */
/* eslint-disable no-unused-vars */
const DiretrizesCards = (() => {
  const fmtMeta = v => (v != null ? v : '--');

  const CONFIG = {
    'saldo-ne': {
      titulo: 'Saldo NE', formato: r => String(r.valor),
      subtitulo: r => {
        const gA = r.detalhes?.grupo_a ?? null;
        const gB = r.detalhes?.grupo_b ?? null;
        const breakdown = (gA !== null && gB !== null)
          ? `<span class="card__grupo">com SAI: ${gA} | sem SAI: ${gB}</span>`
          : '';
        return `${breakdown}meta: ${fmtMeta(r.meta)}`;
      },
      extra: r => r.detalhes.variacao !== null ? `${r.detalhes.variacao >= 0 ? '+' : ''}${r.detalhes.variacao} vs anterior` : ''
    },
    'ne-95-dias': {
      titulo: 'NE > 95 Dias', formato: r => String(r.valor),
      subtitulo: r => `meta: ${fmtMeta(r.meta)}`, extra: () => ''
    },
    'criticas-graves-5d': {
      titulo: 'Criticas/Graves 5d', formato: r => `${r.valor}%`,
      subtitulo: r => `meta: ${fmtMeta(r.meta)}%`,
      extra: r => {
        const ab = r.detalhes.total_abertas || (r.detalhes.abertas_agora || []).length;
        const prazo = `${r.detalhes.dentro_5d}/${r.detalhes.total_periodo} no prazo`;
        return ab > 0 ? (r.detalhes.total_periodo > 0 ? `${prazo} | ${ab} abertas` : `${ab} abertas no saldo`) : prazo;
      }
    },
    'tempo-correcao-ne': {
      titulo: 'Tempo Correcao', formato: r => `${r.valor}%`,
      subtitulo: r => `meta: ${fmtMeta(r.meta)}%`,
      extra: r => r.detalhes.projecao ? `real: ${r.detalhes.pct_real}%` : ''
    },
    'entrada-ne': {
      titulo: 'Entradas NE', formato: r => String(r.valor),
      subtitulo: r => `${r.detalhes.entradas} ent | ${r.detalhes.liberacoes} lib | ${r.detalhes.descartes} desc`,
      extra: r => `saldo: ${r.detalhes.variacao_saldo >= 0 ? '+' : ''}${r.detalhes.variacao_saldo}`
    },
    'saldo-sal': {
      titulo: 'Saldo de SAL', formato: r => String(r.valor),
      subtitulo: r => {
        const gA = r.detalhes?.grupo_a ?? null;
        const gB = r.detalhes?.grupo_b ?? null;
        const breakdown = (gA !== null && gB !== null)
          ? `<span class="card__grupo">com SAI: ${gA} | sem SAI: ${gB}</span>`
          : '';
        return `${breakdown}meta: ${fmtMeta(r.meta)}`;
      },
      extra: r => r.detalhes?.variacao != null ? `${r.detalhes.variacao >= 0 ? '+' : ''}${r.detalhes.variacao} vs anterior` : ''
    },
    'tempo-implementacao-sal': {
      titulo: 'Tempo Implementacao', formato: r => `${r.valor}%`,
      subtitulo: r => `meta: ${fmtMeta(r.meta)}%`, extra: () => ''
    },
    'idade-sal': {
      titulo: 'Idade da SAL', formato: r => String(r.valor),
      subtitulo: r => r.meta != null ? `meta: ${r.meta}` : `corte: ${r.detalhes?.limite_dias || 140}d`,
      extra: () => ''
    },
    'entrada-sal': {
      titulo: 'Entrada de SAL', formato: r => String(r.valor),
      subtitulo: r => `${r.detalhes.entradas} ent | ${r.detalhes.liberacoes} lib | ${r.detalhes.descartes} desc · meta: ${fmtMeta(r.meta)}`,
      extra: r => `saldo: ${r.detalhes.variacao_saldo >= 0 ? '+' : ''}${r.detalhes.variacao_saldo}`
    },
    'liberadas-sam-sail': {
      titulo: 'Liberadas Versao', formato: r => String(r.valor),
      subtitulo: r => {
        const d = r.detalhes || {};
        return `SAM: ${d.qtd_sam ?? d.por_tipo?.SAM ?? 0} | SAIL: ${d.qtd_sail ?? d.por_tipo?.SAIL ?? 0}${r.meta != null ? ` · meta: ${fmtMeta(r.meta)}` : ''}`;
      },
      extra: r => {
        const d = r.detalhes || {};
        return d.qtd_versao != null ? `${d.qtd_versao} versao + ${d.qtd_arquivo || 0} arquivo` : '';
      }
    },
    'tempo-implementacao-sam-sail': {
      titulo: 'Tempo Implementacao', formato: r => `${r.valor}%`,
      subtitulo: r => {
        const d = r.detalhes || {};
        const bk = `SAM: ${d.por_tipo?.SAM ?? d.breakdown_tipo?.SAM ?? 0} | SAIL: ${d.por_tipo?.SAIL ?? d.breakdown_tipo?.SAIL ?? 0}`;
        return r.meta != null ? `${bk} · meta: ${fmtMeta(r.meta)}%` : bk;
      },
      extra: () => ''
    }
  };

  const ORDEM_NE = ['saldo-ne', 'ne-95-dias', 'criticas-graves-5d', 'tempo-correcao-ne', 'entrada-ne'];
  const ORDEM_SAL = ['saldo-sal', 'tempo-implementacao-sal', 'idade-sal', 'entrada-sal'];
  const ORDEM_SAM_SAIL = ['liberadas-sam-sail', 'tempo-implementacao-sam-sail'];

  function htmlGrid(ordem, resultados, cardAtivo) {
    let out = '';
    for (const id of ordem) {
      const r = resultados[id];
      const cfg = CONFIG[id];
      if (!r || r.status === 'erro') {
        out += `<div class="card card--info"><span class="card__titulo">${cfg?.titulo || id}</span><div class="card__valor">--</div><div class="card__meta">${r ? r.erro : 'Nao calculado'}</div></div>`;
        continue;
      }
      const ativo = cardAtivo === id ? ' card--ativo' : '';
      out += `
      <div class="card card--${r.status || 'info'}${ativo}" data-id="${id}" onclick="App.selecionarCard('${id}')">
        <span class="card__titulo">${cfg.titulo}</span>
        <div class="card__valor">${cfg.formato(r)}</div>
        <div class="card__meta">${cfg.subtitulo(r)}</div>
        ${cfg.extra(r) ? `<span class="card__badge">${cfg.extra(r)}</span>` : ''}
      </div>`;
    }
    return out;
  }

  function titulo(id) {
    return CONFIG[id]?.titulo || id;
  }

  return { htmlGrid, titulo, ORDEM_NE, ORDEM_SAL, ORDEM_SAM_SAIL };
})();
