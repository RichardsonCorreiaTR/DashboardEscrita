/**
 * tempo-implementacao-sal.js - % Tempo gasto em SALs (Dev + Teste + Preparacao)
 */
const versaoUtil = require('../../core/versao');
const q = require('./tempo-implementacao-queries');

const METAS_MENSAIS = [22.7, 18.2, 19.9, 10.4, 15.4, 9.6, 14.6, 17.2, 12.4, 15.9, 11.9, 19.8];
const META_ANUAL = 19.8;

function obterMeta(indice) { return METAS_MENSAIS[indice] ?? META_ANUAL; }

function determinarSemaforo(pctReal, metaMes) {
  if (metaMes == null) return 'info';
  if (pctReal <= metaMes) return 'verde';
  if (pctReal <= metaMes + 5) return 'amarelo';
  return 'vermelho';
}

function montarDetalhe(devRows, testeRows, label) {
  const mapa = {};
  for (const r of devRows) {
    mapa[r.i_sai] = {
      i_sai: r.i_sai, i_psai: r.i_psai,
      tipo: r.tipoSAI, nomeVersao: r.nomeVersao, nomeArea: r.nomeArea,
      dev: r.dev || 0, teste: 0, prep: 0
    };
  }
  for (const r of testeRows) {
    if (mapa[r.i_sai]) {
      mapa[r.i_sai].teste = r.teste || 0;
      mapa[r.i_sai].prep = r.prep || 0;
    }
  }
  return Object.values(mapa).map(s => ({
    ...s, total: s.dev + s.teste + s.prep, via: label || s.nomeVersao
  })).sort((a, b) => b.total - a.total);
}

module.exports = {
  id: 'tempo-implementacao-sal',
  nome: 'Tempo de Implementacao SAL',
  categoria: 'produto',
  cacheTTL: 30 * 60 * 1000,

  async calcular(executor, opcoes = {}) {
    const nomeVersao = opcoes.versao
      || versaoUtil.nomeDaVersao(opcoes.ano || new Date().getFullYear(), opcoes.mes || (new Date().getMonth() + 1));
    const area = opcoes.area || 'Escrita';
    const parsed = versaoUtil.parsearNomeVersao(nomeVersao);
    const indice = parsed ? parsed.indice : (new Date().getMonth());
    const metaMes = opcoes.meta || obterMeta(indice);

    const [
      saisPorTipo, devAgg, testeAgg, devDet, testeDet,
      parDevAgg, parTesteAgg, parDevDet, parTesteDet
    ] = await Promise.all([
      executor.executar(q.querySaisPorTipo(nomeVersao, area)),
      executor.executar(q.queryTempoDev(nomeVersao, area)),
      executor.executar(q.queryTempoTeste(nomeVersao, area)),
      executor.executar(q.queryDetalheDev(nomeVersao, area)),
      executor.executar(q.queryDetalheTeste(nomeVersao, area)),
      executor.executar(q.queryParaleloDev(nomeVersao, area)),
      executor.executar(q.queryParaleloTeste(nomeVersao, area)),
      executor.executar(q.queryDetalheParaleloDev(nomeVersao, area)),
      executor.executar(q.queryDetalheParaleloTeste(nomeVersao, area))
    ]);

    const totalSais = saisPorTipo.reduce((s, r) => s + r.total, 0);
    const salRow = saisPorTipo.find(r => r.tipoSAI === 'SAL') || {};
    const totalSal = salRow.total || 0;

    if (totalSais === 0) {
      return {
        valor: null, meta: metaMes, pct: null, status: 'erro',
        detalhes: { versao: nomeVersao, tipo_foco: 'SAL' },
        validacao: { ok: false, registros_lidos: 0, problemas: ['Nenhuma SAI liberada na versao'] }
      };
    }

    const da = devAgg[0] || {};
    const ta = testeAgg[0] || {};
    const dev = { total: da.dev_total || 0, ne: da.dev_sal || 0 };
    const teste = { total: ta.teste_total || 0, ne: ta.teste_sal || 0 };
    const prep = { total: ta.prep_total || 0, ne: ta.prep_sal || 0 };

    const pa = parDevAgg[0] || {};
    const pt = parTesteAgg[0] || {};
    const paralelo = { dev: pa.par_dev || 0, teste: pt.par_teste || 0, prep: pt.par_prep || 0 };
    paralelo.total = paralelo.dev + paralelo.teste + paralelo.prep;

    const somaLib = dev.total + teste.total + prep.total;
    const somaSal = dev.ne + teste.ne + prep.ne;
    const somaTotal = somaLib + paralelo.total;
    const pctReal = somaTotal > 0 ? Math.round((somaSal / somaTotal) * 1000) / 10 : 0;

    const breakdown = {};
    saisPorTipo.forEach(r => { breakdown[r.tipoSAI] = r.total; });

    const saisLib = montarDetalhe(devDet, testeDet, null)
      .map(s => ({ ...s, via: s.nomeVersao === nomeVersao ? 'Versao' : s.nomeVersao }));
    const saisPar = montarDetalhe(parDevDet, parTesteDet, null)
      .map(s => ({ ...s, via: 'Paralelo (' + s.nomeVersao + ')' }));

    return {
      valor: pctReal,
      meta: metaMes,
      pct: metaMes > 0 ? Math.round((pctReal / metaMes) * 100) : null,
      status: determinarSemaforo(pctReal, metaMes),
      detalhes: {
        versao: nomeVersao,
        tipo_foco: 'SAL',
        meta_anual: META_ANUAL,
        metas_mensais: METAS_MENSAIS,
        total_sai_liberada: totalSais,
        total_sai_ne: totalSal,
        total_sai_ne_internas: 0,
        qtd_versao: saisLib.filter(s => s.via === 'Versao').length,
        qtd_arquivo: saisLib.filter(s => s.via !== 'Versao').length,
        qtd_paralelo: saisPar.length,
        breakdown_tipo: breakdown,
        tempo_dev: dev,
        tempo_teste: teste,
        tempo_prep: prep,
        tempo_liberadas: somaLib,
        tempo_paralelo: paralelo,
        tempo_soma: { total: somaTotal, ne: somaSal },
        formula: `${somaSal} / (${somaLib} + ${paralelo.total}) = ${pctReal}%`,
        sais: saisLib,
        sais_paralelo: saisPar
      },
      validacao: {
        ok: true,
        registros_lidos: totalSais + saisPar.length,
        registros_usados: totalSais + saisPar.length,
        avisos: somaTotal === 0 ? ['Tempo total zerado - roteiros sem tempo preenchido'] : []
      }
    };
  }
};
