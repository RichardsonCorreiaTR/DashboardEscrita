/**
 * tempo-correcao-ne.js - % Tempo gasto em NEs (Dev + Teste + Preparacao)
 *
 * Diretriz 1.4.4 (codigo SGD: 143636)
 *
 * Formula v7:
 *   % = Tempo NE / (Tempo Liberadas + Tempo Paralelo) * 100
 *
 * Onde:
 *   Tempo Liberadas = Dev+Teste+Prep de SAIs Escrita liberadas (versao + arquivo)
 *   Tempo Paralelo  = Dev+Teste+Prep de SAIs em versoes paralelas
 *                     (ex: PacotesIA, ImportacaoEsoci) com roteiros
 *                     concluidos (data_conclusao) no periodo da versao
 */

const fs = require('fs');
const path = require('path');

const versaoUtil = require('../../core/versao');
const q = require('./tempo-correcao-queries');

const CONFIG_PATH = path.join(__dirname, '..', '..', '..', 'config', 'projecoes-2026.json');

function carregarProjecoes() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function determinarSemaforo(pctReal, metaMes) {
  if (metaMes == null) return 'verde';
  if (pctReal <= metaMes) return 'verde';
  if (pctReal <= metaMes + 5) return 'amarelo';
  return 'vermelho';
}

/** Monta array de detalhe por SAI cruzando dev e teste */
function montarDetalhe(devRows, testeRows, label) {
  const mapa = {};
  for (const r of devRows) {
    mapa[r.i_sai] = {
      i_sai: r.i_sai, i_psai: r.i_psai,
      tipo: r.tipoSAI, nomeVersao: r.nomeVersao,
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
    ...s,
    total: s.dev + s.teste + s.prep,
    via: label || s.nomeVersao
  })).sort((a, b) => b.total - a.total);
}

module.exports = {
  id: 'tempo-correcao-ne',
  nome: 'Tempo Trabalhado para Correcao de NEs',
  categoria: 'produto',
  cacheTTL: 30 * 60 * 1000,

  async calcular(executor, opcoes = {}) {
    const nomeVersao = opcoes.versao
      || versaoUtil.nomeDaVersao(
        opcoes.ano || new Date().getFullYear(),
        opcoes.mes || (new Date().getMonth() + 1)
      );

    const parsed = versaoUtil.parsearNomeVersao(nomeVersao);
    const indice = parsed ? parsed.indice : (new Date().getMonth());
    const metaMes = carregarProjecoes().metas['tempo-correcao-ne-pct'][indice];

    const [
      saisPorTipo, devAgg, testeAgg, devDet, testeDet,
      parDevAgg, parTesteAgg, parDevDet, parTesteDet
    ] = await Promise.all([
      executor.executar(q.querySaisPorTipo(nomeVersao)),
      executor.executar(q.queryTempoDev(nomeVersao)),
      executor.executar(q.queryTempoTeste(nomeVersao)),
      executor.executar(q.queryDetalheDev(nomeVersao)),
      executor.executar(q.queryDetalheTeste(nomeVersao)),
      executor.executar(q.queryParaleloDev(nomeVersao)),
      executor.executar(q.queryParaleloTeste(nomeVersao)),
      executor.executar(q.queryDetalheParaleloDev(nomeVersao)),
      executor.executar(q.queryDetalheParaleloTeste(nomeVersao))
    ]);

    const totalSais = saisPorTipo.reduce((s, r) => s + r.total, 0);
    const neRow = saisPorTipo.find(r => r.tipoSAI === 'NE') || {};
    const totalNe = neRow.total || 0;
    const totalNeInternas = neRow.ne_internas || 0;
    const totalNeExternas = totalNe - totalNeInternas;

    if (totalSais === 0) {
      return {
        valor: null, meta: metaMes, pct: null, status: 'erro',
        detalhes: { versao: nomeVersao },
        validacao: { ok: false, registros_lidos: 0,
          problemas: ['Nenhuma SAI liberada na versao'] }
      };
    }

    const da = devAgg[0] || {};
    const ta = testeAgg[0] || {};
    const dev = { total: da.dev_total || 0, ne: da.dev_ne || 0 };
    const teste = { total: ta.teste_total || 0, ne: ta.teste_ne || 0 };
    const prep = { total: ta.prep_total || 0, ne: ta.prep_ne || 0 };

    const pa = parDevAgg[0] || {};
    const pt = parTesteAgg[0] || {};
    const paralelo = {
      dev: pa.par_dev || 0,
      teste: pt.par_teste || 0,
      prep: pt.par_prep || 0
    };
    paralelo.total = paralelo.dev + paralelo.teste + paralelo.prep;

    const somaLib = dev.total + teste.total + prep.total;
    const somaNe = dev.ne + teste.ne + prep.ne;
    const somaTotal = somaLib + paralelo.total;

    const pctReal = somaTotal > 0
      ? Math.round((somaNe / somaTotal) * 1000) / 10
      : 0;

    const breakdown = {};
    saisPorTipo.forEach(r => { breakdown[r.tipoSAI] = r.total; });

    const saisLib = montarDetalhe(devDet, testeDet, null)
      .map(s => ({ ...s, via: s.nomeVersao === nomeVersao ? 'Versao' : s.nomeVersao }));
    const saisPar = montarDetalhe(parDevDet, parTesteDet, null)
      .map(s => ({ ...s, via: 'Paralelo (' + s.nomeVersao + ')' }));

    const qtdVersao = saisLib.filter(s => s.via === 'Versao').length;
    const qtdArquivo = saisLib.filter(s => s.via !== 'Versao').length;

    return {
      valor: pctReal,
      meta: metaMes,
      pct: metaMes > 0 ? Math.round((pctReal / metaMes) * 100) : null,
      status: determinarSemaforo(pctReal, metaMes),
      detalhes: {
        versao: nomeVersao,
        total_sai_liberada: totalSais,
        total_sai_ne: totalNeExternas,
        total_sai_ne_internas: totalNeInternas,
        qtd_versao: qtdVersao,
        qtd_arquivo: qtdArquivo,
        qtd_paralelo: saisPar.length,
        breakdown_tipo: breakdown,
        tempo_dev: { total: dev.total, ne: dev.ne },
        tempo_teste: { total: teste.total, ne: teste.ne },
        tempo_prep: { total: prep.total, ne: prep.ne },
        tempo_liberadas: somaLib,
        tempo_paralelo: paralelo,
        tempo_soma: { total: somaTotal, ne: somaNe },
        formula: `${somaNe} / (${somaLib} + ${paralelo.total}) = ${pctReal}%`,
        sais: saisLib,
        sais_paralelo: saisPar
      },
      validacao: {
        ok: true,
        registros_lidos: totalSais + saisPar.length,
        registros_usados: totalSais + saisPar.length,
        avisos: somaTotal === 0
          ? ['Tempo total zerado - roteiros sem tempo preenchido'] : []
      }
    };
  }
};
