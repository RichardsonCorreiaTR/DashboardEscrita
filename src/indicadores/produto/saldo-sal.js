/**
 * saldo-sal.js - Indicador: Saldo de SALs (mesma logica do saldo-ne, tipo SAL)
 */
const versao = require('../../core/versao');
const consultasSAL = require('../../core/consultas-sal');
const { enriquecerNomeArea } = require('../../core/consultas-ne-enriquecer');
const queries = require('./saldo-sal-queries');

const METAS_MENSAIS = [120, 125, 110, 115, 110, 115, 120, 110, 110, 107, 110, 115];
const META_ANUAL = 115;

function obterMeta(indice) { return METAS_MENSAIS[indice] || META_ANUAL; }

function determinarSemaforo(saldo, meta) {
  if (meta == null) return 'info';
  if (saldo <= meta) return 'verde';
  if (saldo <= meta * 1.10) return 'amarelo';
  return 'vermelho';
}

module.exports = {
  id: 'saldo-sal',
  nome: 'Saldo de SALs',
  categoria: 'produto',
  cacheTTL: 30 * 60 * 1000,

  async calcular(executor, opcoes = {}) {
    const nomeVersao = opcoes.versao
      || versao.nomeDaVersao(opcoes.ano || new Date().getFullYear(), opcoes.mes || (new Date().getMonth() + 1));
    const area = opcoes.area || 'Escrita';
    const parsed = versao.parsearNomeVersao(nomeVersao);
    const indice = parsed ? parsed.indice : (new Date().getMonth());
    const versaoAnteriorNome = versao.versaoAnterior(nomeVersao);
    const qLibArq = consultasSAL.queryLiberadasArquivo(nomeVersao, area);
    const qEmArq = consultasSAL.queryEmArquivo(nomeVersao, area);

    const [saldoResult, gravidadeResult, saldoAnteriorResult,
      entradasResult, descartesResult, liberadasResult, pendentesResult,
      libArquivoResult, emArquivoResult, alocadasResult,
      grupoAResult, grupoBResult
    ] = await Promise.all([
      executor.executar(queries.querySaldo(nomeVersao, area)),
      executor.executar(queries.queryGravidade(nomeVersao, area)),
      versaoAnteriorNome ? executor.executar(queries.querySaldo(versaoAnteriorNome, area)) : Promise.resolve(null),
      executor.executar(consultasSAL.queryEntradas(nomeVersao, area)),
      executor.executar(consultasSAL.queryDescartes(nomeVersao, area)),
      executor.executar(consultasSAL.queryLiberadas(nomeVersao, area)),
      executor.executar(consultasSAL.queryPendentes(nomeVersao, area)),
      qLibArq ? executor.executar(qLibArq) : Promise.resolve([]),
      qEmArq ? executor.executar(qEmArq) : Promise.resolve([]),
      executor.executar(consultasSAL.queryAlocadas(nomeVersao, area)),
      executor.executar(queries.queryGrupoA(nomeVersao, area)),
      executor.executar(queries.queryGrupoB(nomeVersao, area))
    ]);

    if (!saldoResult || saldoResult.length === 0) {
      return {
        valor: null, meta: null, pct: null, status: 'erro', detalhes: {},
        validacao: { ok: false, registros_lidos: 0, problemas: ['Query retornou vazio'] }
      };
    }

    const saldo = saldoResult[0].saldo;
    const meta = opcoes.meta || obterMeta(indice);
    const pct = meta ? Math.round((saldo / meta) * 100 * 10) / 10 : null;
    const saldoAnterior = saldoAnteriorResult ? saldoAnteriorResult[0].saldo : null;
    const nEnt = (entradasResult || []).length;
    const nDesc = (descartesResult || []).length;
    const nLib = (liberadasResult || []).length + (libArquivoResult || []).length;
    const movimentacao = {
      entradas: entradasResult || [], descartes: descartesResult || [],
      liberadas: liberadasResult || [], pendentes: pendentesResult || [],
      liberadas_arquivo: libArquivoResult || [], em_arquivo: emArquivoResult || [],
      alocadas: alocadasResult || []
    };
    if (area === 'Ambas') {
      await enriquecerNomeArea(executor,
        movimentacao.entradas, movimentacao.descartes, movimentacao.liberadas,
        movimentacao.pendentes, movimentacao.liberadas_arquivo, movimentacao.em_arquivo,
        movimentacao.alocadas);
    }

    return {
      valor: saldo, meta, pct, status: determinarSemaforo(saldo, meta),
      detalhes: {
        versao: nomeVersao, versao_anterior: versaoAnteriorNome,
        saldo_versao_anterior: saldoAnterior,
        variacao: saldoAnterior !== null ? saldo - saldoAnterior : null,
        variacao_movimento: nEnt - nDesc - nLib,
        grupo_a: grupoAResult?.[0]?.qtd ?? null,
        grupo_b: grupoBResult?.[0]?.qtd ?? null,
        por_gravidade: gravidadeResult || [],
        meta_anual: META_ANUAL, metas_mensais: METAS_MENSAIS,
        movimentacao
      },
      validacao: {
        ok: true, registros_lidos: saldo, registros_usados: saldo,
        avisos: saldo === 0 ? ['Saldo zerado - verificar filtros'] : []
      }
    };
  }
};
