/**
 * liberadas-sam-sail.js - Quantidade de SAM + SAIL liberadas na versao
 */
const versao = require('../../core/versao');
const { enriquecerNomeArea } = require('../../core/consultas-ne-enriquecer');
const queries = require('./liberadas-sam-sail-queries');

module.exports = {
  id: 'liberadas-sam-sail',
  nome: 'Liberadas SAM/SAIL',
  categoria: 'produto',
  cacheTTL: 30 * 60 * 1000,

  async calcular(executor, opcoes = {}) {
    const nomeVersao = opcoes.versao
      || versao.nomeDaVersao(opcoes.ano || new Date().getFullYear(), opcoes.mes || (new Date().getMonth() + 1));
    const area = opcoes.area || 'Escrita';

    const [contagem, lista] = await Promise.all([
      executor.executar(queries.queryContagem(nomeVersao, area)),
      executor.executar(queries.queryLista(nomeVersao, area))
    ]);

    const porTipo = { SAM: 0, SAIL: 0 };
    for (const r of contagem || []) {
      porTipo[r.tipoSAI] = r.qtd || 0;
    }
    const total = porTipo.SAM + porTipo.SAIL;
    const itens = lista || [];
    if (area === 'Ambas') await enriquecerNomeArea(executor, itens);

    const qtdVersao = itens.filter(x => x.nomeVersao === nomeVersao).length;
    const qtdArquivo = itens.length - qtdVersao;

    return {
      valor: total,
      meta: opcoes.meta ?? null,
      pct: null,
      status: 'info',
      detalhes: {
        versao: nomeVersao,
        por_tipo: porTipo,
        qtd_sam: porTipo.SAM,
        qtd_sail: porTipo.SAIL,
        qtd_versao: qtdVersao,
        qtd_arquivo: qtdArquivo,
        lista: itens.map(x => ({
          ...x,
          _via: x.nomeVersao === nomeVersao ? 'Versao' : (x.nomeVersao || 'Arquivo')
        }))
      },
      validacao: {
        ok: true,
        registros_lidos: itens.length,
        registros_usados: total
      }
    };
  }
};
