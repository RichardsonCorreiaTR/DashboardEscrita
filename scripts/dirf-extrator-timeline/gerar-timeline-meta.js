'use strict';

function envAmplo() {
  return String(process.env.TIMELINE_FILTRO || '').toLowerCase() === 'amplo';
}

function enriquecerTopComResumo(topList, itens) {
  return (topList || []).map(t => {
    const it = itens.find(x => x.i_sai === t.i_sai);
    return {
      i_sai: t.i_sai,
      qtd: t.qtd,
      tipoSAI: it ? it.tipoSAI : '',
      resumo: it ? it.resumo : ''
    };
  });
}

function metaFiltro(amplo, aviso, cronologia, intensa) {
  const rc = cronologia.split('-').reverse().join('/');
  const ri = intensa.split('-').reverse().join('/');
  const base = {
    amplo,
    jornadaDesde: cronologia,
    jornadaRotulo: rc,
    intensificacaoDesde: intensa,
    intensificacaoRotulo: ri,
    aviso
  };
  if (amplo) {
    return {
      ...base,
      label: 'Modo amplo',
      detalhe: `Lista: PSAI cadastrados desde ${rc} com DIRF ou extrator. Marco intensificação: ${ri}.`
    };
  }
  return {
    ...base,
    label: 'Modo estrito (padrão)',
    detalhe: `Lista: PSAI desde ${rc} com dirf e extrator. Marco intensificação: ${ri}.`
  };
}

module.exports = { envAmplo, enriquecerTopComResumo, metaFiltro };
