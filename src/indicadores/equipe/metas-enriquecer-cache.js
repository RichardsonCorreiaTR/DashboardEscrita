/**
 * metas-enriquecer-cache.js - Completa metas faltantes no cache (retornos da planilha)
 */
const anual = require('./metas-anual');
const retornos = require('./retornos-planilha');

const METAS_RETORNOS = {
  'indice-retornos-ne': { chave: 'ne', meta: 0.50 },
  'indice-retornos-sal': { chave: 'sal', meta: 1.00 },
  'indice-retornos-sail-sam': { chave: 'sailSam', meta: 1.50 }
};

function templateTem(a, metasJson, id) {
  const tmpl = (metasJson.templates || {})[a.senioridade] || [];
  const extras = ((metasJson.overrides || {})[a.slug] || {})['metas-adicionais'] || [];
  return [...tmpl, ...extras].includes(id);
}

/** Preenche indice-retornos-* ausentes no cache usando a planilha. */
async function enriquecerRetornosMetas(resp, a, metasJson) {
  if (!resp || !resp.metas) return resp;
  const faltando = Object.keys(METAS_RETORNOS).filter(
    id => templateTem(a, metasJson, id) && !resp.metas[id]
  );
  if (!faltando.length) return resp;

  const acum = await retornos.carregarRetornosAnalista(a);
  faltando.forEach(id => {
    const cfg = METAS_RETORNOS[id];
    resp.metas[id] = { mensal: anual.mensalRetornos(acum[cfg.chave], cfg.meta) };
  });
  resp.totalizador = anual.totalizador(resp.metas);
  return resp;
}

module.exports = { enriquecerRetornosMetas };
