/**
 * validacao.js - Conferencia cruzada dos dados coletados
 *
 * Verifica consistencia entre:
 * - Entradas vs saldo (saldo[N] = saldo[N-1] + entradas - descartes - liberadas)
 * - Totais de atividades vs limites razoaveis
 * - Tramitacoes dentro do periodo esperado
 * - Definicao: NEs com SAI devem ter registro em definicao
 */

const path = require('path');
const fs = require('fs');
const q = require('./queries');

const CACHE_DIR = path.join(__dirname, '..', '..', 'data', 'cache', 'estudo-psai-sai');

function ler(nome) {
  return JSON.parse(fs.readFileSync(path.join(CACHE_DIR, `${nome}.json`), 'utf-8'));
}

function validarEntradasVsSaldo() {
  const entradas = ler('entradas');
  const descartes = ler('descartes');
  const pendentes = ler('pendentes');
  const checks = [];

  for (let i = 1; i < q.VERSOES.length; i++) {
    const vAtual = q.VERSOES[i];
    const vAnterior = q.VERSOES[i - 1];
    const saldoAnt = pendentes[vAnterior].total_saldo;
    const ent = entradas[vAtual].length;
    const desc = descartes[vAtual].length;
    const lib = entradas[vAtual].filter(r => r.Liberacao).length;
    const saldoAtual = pendentes[vAtual].total_saldo;
    const esperado = saldoAnt + ent - desc - lib;
    const diff = saldoAtual - esperado;

    checks.push({
      teste: `Saldo ${vAtual} = saldo ${vAnterior} + entradas - descartes - liberadas`,
      saldoAnterior: saldoAnt, entradas: ent, descartes: desc, liberadas: lib,
      esperado, real: saldoAtual, diff,
      ok: Math.abs(diff) <= 10
    });
  }
  return checks;
}

function validarAtividades() {
  const atividades = ler('atividades');
  const checks = [];

  for (const e of q.EQUIPE) {
    const a = atividades[e.iu];
    if (!a) { checks.push({ teste: `Atividades ${e.nome}`, ok: false, erro: 'sem dados' }); continue; }
    const meses = Object.keys(a.meses);
    const totalMin = meses.reduce((s, m) => s + a.meses[m].total, 0);
    const horas = totalMin / 60;
    const mediaMensal = horas / Math.max(meses.length, 1);

    checks.push({
      teste: `Atividades ${e.nome}`,
      meses: meses.length, totalHoras: Math.round(horas),
      mediaMensalH: Math.round(mediaMensal),
      ok: meses.length >= 3 && mediaMensal > 20 && mediaMensal < 250
    });
  }
  return checks;
}

function validarTramitacoes() {
  const tramitacoes = ler('tramitacoes');
  const checks = [];
  const negativos = tramitacoes.filter(t => t.dias_corridos < 0);
  const extremos = tramitacoes.filter(t => t.dias_corridos > 60);

  checks.push({
    teste: 'Tramitacoes com dias negativos', total: negativos.length,
    ok: negativos.length === 0
  });
  checks.push({
    teste: 'Tramitacoes com >60 dias (outliers)', total: extremos.length,
    ok: extremos.length <= tramitacoes.length * 0.05,
    nota: extremos.length > 0 ? `${extremos.length} de ${tramitacoes.length} (${(extremos.length / tramitacoes.length * 100).toFixed(1)}%)` : 'OK'
  });

  const media = tramitacoes.length > 0
    ? tramitacoes.reduce((s, t) => s + t.dias_corridos, 0) / tramitacoes.length : 0;
  checks.push({
    teste: 'Media dias tramitacao', valor: Math.round(media * 10) / 10,
    ok: media >= 0 && media < 30
  });
  return checks;
}

function validarDefinicaoVsEntradas() {
  const entradas = ler('entradas');
  const definicao = ler('definicao');
  const checks = [];

  for (const v of q.VERSOES) {
    const entradasComSAI = entradas[v].filter(r => r.i_sai > 0).length;
    const defTotal = definicao[v] ? definicao[v].length : 0;

    checks.push({
      teste: `Definicao ${v}: SAIs com entrada vs definicao`,
      entradasComSAI, definicaoRegistros: defTotal,
      diff: Math.abs(entradasComSAI - defTotal),
      ok: Math.abs(entradasComSAI - defTotal) <= 5
    });
  }
  return checks;
}

function executarValidacao() {
  console.log('\n=== VALIDACAO DOS DADOS COLETADOS ===\n');
  const grupos = {
    'Saldo vs Entradas/Descartes': validarEntradasVsSaldo(),
    'Atividades por Analista': validarAtividades(),
    'Tramitacoes PSAI': validarTramitacoes(),
    'Definicao vs Entradas': validarDefinicaoVsEntradas()
  };

  let totalOk = 0, totalFalha = 0;
  for (const [grupo, checks] of Object.entries(grupos)) {
    console.log('--- %s ---', grupo);
    for (const c of checks) {
      const status = c.ok ? 'OK' : 'ATENCAO';
      console.log('  [%s] %s', status, c.teste);
      if (!c.ok) {
        console.log('         Detalhes: %s', JSON.stringify(c));
        totalFalha++;
      } else {
        totalOk++;
      }
    }
  }

  console.log('\n--- RESUMO VALIDACAO ---');
  console.log('  Passou: %d | Atencao: %d | Total: %d', totalOk, totalFalha, totalOk + totalFalha);
  return { ok: totalFalha === 0, totalOk, totalFalha, grupos };
}

module.exports = { executarValidacao };
