/**
 * analise.js - Base = PSAI (inclui SAI, descartada, pendente).
 * Agrupa por analista + versao, consolida totais, depois media.
 *
 * tempoTotal = tempo_analise + tempo_definicao (psai_responsaveis) por PSAI
 */

const path = require('path');
const fs = require('fs');
const q = require('./queries');

const CACHE = path.join(__dirname, '..', '..', 'data', 'cache', 'estudo-psai-sai');
const ler = n => JSON.parse(fs.readFileSync(path.join(CACHE, `${n}.json`), 'utf-8'));

const NOMES_EQUIPE = [
  'Ana Ligia Passarelli', 'Laiz Velho de Almeida',
  'Mateus Alves', 'Flávia Felipe Cardoso', 'Jessica Maximiano'
];

function versaoPorData(data, datas) {
  const d = new Date(data).getTime();
  for (const v of q.VERSOES) {
    const ini = new Date(datas[v].inicio).getTime();
    const fim = new Date(datas[v].fim).getTime();
    if (d > ini && d <= fim) return v;
  }
  return null;
}

function montarNEs() {
  const psais = ler('psai-detalhe');
  const temposPsai = ler('tempos-psai');
  const saisDetalhe = ler('sai-detalhe');
  const datas = ler('datas-versoes');

  const tempoMap = {};
  for (const t of temposPsai) {
    if (!tempoMap[t.i_psai]) tempoMap[t.i_psai] = 0;
    tempoMap[t.i_psai] += (t.tempo_analise || 0) + (t.tempo_definicao || 0);
  }

  const saiMap = {};
  for (const s of saisDetalhe) saiMap[s.i_sai] = s;

  return psais.map(p => {
    const tempoTotal = tempoMap[p.i_psai] || 0;
    const sai = p.i_sai > 0 ? saiMap[p.i_sai] : null;

    let status = 'PSAI pendente';
    if (p.Descarte) status = 'Descartada';
    else if (p.Liberacao) status = 'Liberada';
    else if (p.i_sai > 0 && p.nomeVersao) status = 'SAI commitada';
    else if (p.i_sai > 0) status = 'SAI gerada';

    return {
      versao: versaoPorData(p.CadastroPSAI, datas),
      i_psai: p.i_psai, i_sai: p.i_sai,
      descricao: (p.descricao || '').substring(0, 120),
      gravidade: p.gravidade_ne,
      analista: p.analista_nome, isEquipe: NOMES_EQUIPE.includes(p.analista_nome),
      cadastroPSAI: p.CadastroPSAI,
      tempoTotal,
      temDefinicao: sai ? sai.tem_definicao === 1 : false,
      complexidade: sai ? sai.pontuacao : null,
      status
    };
  });
}

function porAnalistaVersao(nes) {
  const mapa = {};
  for (const ne of nes) {
    const chave = `${ne.analista}|${ne.versao}`;
    if (!mapa[chave]) {
      mapa[chave] = {
        analista: ne.analista, versao: ne.versao,
        isEquipe: ne.isEquipe,
        nes: 0, minutos: 0, comDef: 0,
        sais: 0, descartadas: 0, pendentes: 0
      };
    }
    const m = mapa[chave];
    m.nes++;
    m.minutos += ne.tempoTotal;
    if (ne.temDefinicao) m.comDef++;
    if (ne.i_sai > 0) m.sais++;
    else if (ne.status === 'Descartada') m.descartadas++;
    else m.pendentes++;
  }
  return Object.values(mapa);
}

function consolidarAnalista(detalhe) {
  const mapa = {};
  for (const d of detalhe) {
    if (!mapa[d.analista]) {
      mapa[d.analista] = {
        analista: d.analista, isEquipe: d.isEquipe,
        nes: 0, minutos: 0, comDef: 0,
        sais: 0, descartadas: 0, pendentes: 0
      };
    }
    const m = mapa[d.analista];
    m.nes += d.nes; m.minutos += d.minutos; m.comDef += d.comDef;
    m.sais += d.sais; m.descartadas += d.descartadas; m.pendentes += d.pendentes;
  }
  return Object.values(mapa)
    .filter(a => a.analista !== 'Vitor Justino')
    .map(a => ({ ...a, mediaPorNE: a.nes > 0 ? Math.round(a.minutos / a.nes) : 0 }))
    .sort((a, b) => b.minutos - a.minutos);
}

function consolidarVersao(detalhe) {
  const mapa = {};
  for (const d of detalhe) {
    if (!mapa[d.versao]) {
      mapa[d.versao] = {
        versao: d.versao, nes: 0, minutos: 0, comDef: 0,
        sais: 0, descartadas: 0, pendentes: 0
      };
    }
    const m = mapa[d.versao];
    m.nes += d.nes; m.minutos += d.minutos; m.comDef += d.comDef;
    m.sais += d.sais; m.descartadas += d.descartadas; m.pendentes += d.pendentes;
  }
  return q.VERSOES.map(v => {
    const m = mapa[v] || { versao: v, nes: 0, minutos: 0, comDef: 0, sais: 0, descartadas: 0, pendentes: 0 };
    return { ...m, mediaPorNE: m.nes > 0 ? Math.round(m.minutos / m.nes) : 0 };
  });
}

function calcGeral(nes, label) {
  const total = nes.length;
  const minutos = nes.reduce((s, n) => s + n.tempoTotal, 0);
  const comDef = nes.filter(n => n.temDefinicao);
  const semDef = nes.filter(n => !n.temDefinicao);
  const minComDef = comDef.reduce((s, n) => s + n.tempoTotal, 0);
  const minSemDef = semDef.reduce((s, n) => s + n.tempoTotal, 0);
  return {
    label, totalNEs: total, totalMin: minutos,
    mediaPorNE: total > 0 ? Math.round(minutos / total) : 0,
    comDef: comDef.length, semDef: semDef.length,
    mediaComDef: comDef.length > 0 ? Math.round(minComDef / comDef.length) : 0,
    mediaSemDef: semDef.length > 0 ? Math.round(minSemDef / semDef.length) : 0
  };
}

function executarAnalise() {
  console.log('\n=== ANALISE: BASE = PSAI (TODAS AS NEs) ===\n');
  const nes = montarNEs();
  const nesEquipe = nes.filter(n => n.isEquipe);

  const detalheAV = porAnalistaVersao(nes);
  const detalheAVeq = detalheAV.filter(d => d.isEquipe);

  const porAnalista = consolidarAnalista(detalheAV);
  const porVersaoTodos = consolidarVersao(detalheAV);
  const porVersaoEquipe = consolidarVersao(detalheAVeq);

  const geral = calcGeral(nes, 'Todos');
  const equipe = calcGeral(nesEquipe, 'Equipe');

  const descartes = ler('descartes-detalhe');

  const resultado = {
    nes, detalheAV, porAnalista,
    porVersaoTodos, porVersaoEquipe,
    geral, equipe, descartes
  };

  const arq = path.join(CACHE, 'analise-v2.json');
  fs.writeFileSync(arq, JSON.stringify(resultado, null, 2), 'utf-8');

  const sais = nes.filter(n => n.i_sai > 0).length;
  const desc = nes.filter(n => n.status === 'Descartada').length;
  const pend = nes.filter(n => n.status === 'PSAI pendente').length;
  console.log('Total NEs: %d (SAIs: %d, Descartadas: %d, Pendentes: %d)', nes.length, sais, desc, pend);
  console.log('TODOS  - %d NEs, %d min total, media %d min/NE', geral.totalNEs, geral.totalMin, geral.mediaPorNE);
  console.log('EQUIPE - %d NEs, %d min total, media %d min/NE', equipe.totalNEs, equipe.totalMin, equipe.mediaPorNE);
  console.log('COM def: media %d min/NE (%d NEs) | SEM def: media %d min/NE (%d NEs)',
    geral.mediaComDef, geral.comDef, geral.mediaSemDef, geral.semDef);
  for (const v of porVersaoTodos) {
    console.log('  %s: %d NEs, %d min, media %d min/NE', v.versao, v.nes, v.minutos, v.mediaPorNE);
  }
  return resultado;
}

module.exports = { executarAnalise, NOMES_EQUIPE };
