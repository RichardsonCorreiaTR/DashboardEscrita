/**
 * tempo-implementacao-sam-sail.js - % Tempo gasto em SAM + SAIL (Dev + Teste + Prep)
 */
const versaoUtil = require('../../core/versao');
const q = require('./tempo-implementacao-sam-sail-queries');

const FOCO = 'SAM/SAIL';

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
      i_sai: r.i_sai, i_psai: r.i_psai, tipo: r.tipoSAI,
      nomeVersao: r.nomeVersao, nomeArea: r.nomeArea,
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

function ehFoco(tipo) {
  return tipo === 'SAM' || tipo === 'SAIL';
}

module.exports = {
  id: 'tempo-implementacao-sam-sail',
  nome: 'Tempo Implementacao SAM/SAIL',
  categoria: 'produto',
  cacheTTL: 30 * 60 * 1000,

  async calcular(executor, opcoes = {}) {
    const nomeVersao = opcoes.versao
      || versaoUtil.nomeDaVersao(opcoes.ano || new Date().getFullYear(), opcoes.mes || (new Date().getMonth() + 1));
    const area = opcoes.area || 'Escrita';
    const metaMes = opcoes.meta ?? null;

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
    const bk = {};
    saisPorTipo.forEach(r => { bk[r.tipoSAI] = r.total; });
    const totalFoco = (bk.SAM || 0) + (bk.SAIL || 0);

    if (totalSais === 0) {
      return {
        valor: null, meta: metaMes, pct: null, status: 'erro',
        detalhes: { versao: nomeVersao, tipo_foco: FOCO },
        validacao: { ok: false, registros_lidos: 0, problemas: ['Nenhuma SAI liberada na versao'] }
      };
    }

    const da = devAgg[0] || {};
    const ta = testeAgg[0] || {};
    const dev = { total: da.dev_total || 0, ne: da.dev_foco || 0 };
    const teste = { total: ta.teste_total || 0, ne: ta.teste_foco || 0 };
    const prep = { total: ta.prep_total || 0, ne: ta.prep_foco || 0 };

    const pa = parDevAgg[0] || {};
    const pt = parTesteAgg[0] || {};
    const paralelo = { dev: pa.par_dev || 0, teste: pt.par_teste || 0, prep: pt.par_prep || 0 };
    paralelo.total = paralelo.dev + paralelo.teste + paralelo.prep;

    const somaLib = dev.total + teste.total + prep.total;
    const somaFoco = dev.ne + teste.ne + prep.ne;
    const somaTotal = somaLib + paralelo.total;
    const pctReal = somaTotal > 0 ? Math.round((somaFoco / somaTotal) * 1000) / 10 : 0;

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
        tipo_foco: FOCO,
        por_tipo: { SAM: bk.SAM || 0, SAIL: bk.SAIL || 0 },
        total_sai_liberada: totalSais,
        total_sai_ne: totalFoco,
        total_sai_ne_internas: 0,
        qtd_versao: saisLib.filter(s => ehFoco(s.tipo) && s.via === 'Versao').length,
        qtd_arquivo: saisLib.filter(s => ehFoco(s.tipo) && s.via !== 'Versao').length,
        qtd_paralelo: saisPar.filter(s => ehFoco(s.tipo)).length,
        breakdown_tipo: bk,
        tempo_dev: dev,
        tempo_teste: teste,
        tempo_prep: prep,
        tempo_liberadas: somaLib,
        tempo_paralelo: paralelo,
        tempo_soma: { total: somaTotal, ne: somaFoco },
        formula: `${somaFoco} / (${somaLib} + ${paralelo.total}) = ${pctReal}%`,
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
