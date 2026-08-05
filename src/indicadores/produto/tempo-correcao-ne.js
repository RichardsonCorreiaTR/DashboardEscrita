/**
 * tempo-correcao-ne.js - % Tempo gasto em NEs (Dev + Teste + Preparacao)
 *
 * Diretriz 1.4.4 (codigo SGD: 143636)
 *
 * Formula:
 *   % = Tempo NE (externa + interna) / (Tempo Liberadas + Tempo Paralelo) * 100
 *
 * Detalhe mantem NE e NE interna separados.
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

function montarDetalhe(devRows, testeRows, label) {
  const mapa = {};
  for (const r of devRows) {
    const interna = Number(r.ne_prevencao) === 1;
    mapa[r.i_sai] = {
      i_sai: r.i_sai, i_psai: r.i_psai,
      tipo: r.tipoSAI, nomeVersao: r.nomeVersao, nomeArea: r.nomeArea,
      ne_prevencao: interna ? 1 : 0,
      interna,
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

function blocoTempo(total, ext, int) {
  return { total: total || 0, ne: (ext || 0) + (int || 0), ne_ext: ext || 0, ne_int: int || 0 };
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
    const area = opcoes.area || 'Escrita';
    const parsed = versaoUtil.parsearNomeVersao(nomeVersao);
    const indice = parsed ? parsed.indice : (new Date().getMonth());
    const metaMes = carregarProjecoes().metas['tempo-correcao-ne-pct'][indice];

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
    const dev = blocoTempo(da.dev_total, da.dev_ne, da.dev_ne_int);
    const teste = blocoTempo(ta.teste_total, ta.teste_ne, ta.teste_ne_int);
    const prep = blocoTempo(ta.prep_total, ta.prep_ne, ta.prep_ne_int);

    const pa = parDevAgg[0] || {};
    const pt = parTesteAgg[0] || {};
    const paralelo = {
      dev: pa.par_dev || 0, teste: pt.par_teste || 0, prep: pt.par_prep || 0
    };
    paralelo.total = paralelo.dev + paralelo.teste + paralelo.prep;

    const somaLib = dev.total + teste.total + prep.total;
    const somaNeExt = dev.ne_ext + teste.ne_ext + prep.ne_ext;
    const somaNeInt = dev.ne_int + teste.ne_int + prep.ne_int;
    const somaNe = somaNeExt + somaNeInt;
    const somaTotal = somaLib + paralelo.total;
    const pctReal = somaTotal > 0 ? Math.round((somaNe / somaTotal) * 1000) / 10 : 0;

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
        total_sai_liberada: totalSais,
        total_sai_ne: totalNeExternas,
        total_sai_ne_internas: totalNeInternas,
        qtd_versao: saisLib.filter(s => s.via === 'Versao').length,
        qtd_arquivo: saisLib.filter(s => s.via !== 'Versao').length,
        qtd_paralelo: saisPar.length,
        breakdown_tipo: breakdown,
        tempo_dev: { total: dev.total, ne: dev.ne, ne_ext: dev.ne_ext, ne_int: dev.ne_int },
        tempo_teste: { total: teste.total, ne: teste.ne, ne_ext: teste.ne_ext, ne_int: teste.ne_int },
        tempo_prep: { total: prep.total, ne: prep.ne, ne_ext: prep.ne_ext, ne_int: prep.ne_int },
        tempo_liberadas: somaLib,
        tempo_paralelo: paralelo,
        tempo_soma: {
          total: somaTotal, ne: somaNe, ne_ext: somaNeExt, ne_int: somaNeInt
        },
        formula: `${somaNe} (${somaNeExt} ext + ${somaNeInt} int) / (${somaLib} + ${paralelo.total}) = ${pctReal}%`,
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
