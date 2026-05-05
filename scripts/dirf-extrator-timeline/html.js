'use strict';

const fs = require('fs');
const path = require('path');

const SHELL = path.join(__dirname, 'timeline-shell.html');

function classificar(it) {
  if (it.Descarte != null) return 'descartada';
  if (it.Liberacao != null) return 'liberada';
  return 'pendente';
}

function ehNe(tipo) {
  return String(tipo || '').trim().toUpperCase() === 'NE';
}

function montarPayload(ancora, rows, decode, meta = {}) {
  const itens = rows.map(r => {
    const desc = decode.decodificarBinario(r.descricao);
    const tipo = String(r.tipoSAI || '').trim();
    return {
      i_psai: r.i_psai,
      i_sai: r.i_sai,
      tipoSAI: tipo,
      entrada: r.entrada ? new Date(r.entrada).toISOString() : null,
      Liberacao: r.Liberacao,
      Descarte: r.Descarte,
      data_liberacao: r.Liberacao
        ? new Date(r.Liberacao).toISOString().slice(0, 10)
        : null,
      nomeVersao: r.nomeVersao,
      gravidade: r.gravidade_ne,
      situacao: r.situacao,
      resumo: decode.truncar(desc, 140),
      status: classificar(r),
      ramo: ehNe(tipo) ? 'ne' : 'sa'
    };
  });

  const lib = itens.filter(i => i.status === 'liberada').length;
  const pend = itens.filter(i => i.status === 'pendente').length;
  const dsc = itens.filter(i => i.status === 'descartada').length;

  return {
    geradoEm: new Date().toISOString(),
    ancora,
    totais: { itens: itens.length, liberadas: lib, pendentes: pend, descartadas: dsc },
    filtro: meta.filtro || {
      amplo: false,
      label: 'Modo estrito (padrão)',
      detalhe: 'Somente PSAI com dirf e extrator na descrição.',
      aviso: null
    },
    itens
  };
}

function gerarHtml(payload) {
  const json = JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const shell = fs.readFileSync(SHELL, 'utf8');
  return shell.replace('__DATA_JSON__', json);
}

module.exports = { montarPayload, gerarHtml, classificar };
