/**
 * liberacoes-sa-v2/exemplo.js - Gera exemplo passo-a-passo do calculo
 *
 * Produz uma explicacao intuitiva com numeros reais da versao atual,
 * mostrando exatamente como a previsao foi calculada.
 */

const { mediana } = require('./estatisticas');
const { percentil } = require('./estatisticas');
const { neLiquida, JANELA } = require('./previsao');
const coleta = require('./coleta');

function gerarExemploCalculo(versaoAtual, versoesProc, cacheNE, cacheDesc) {
  if (!versaoAtual || !cacheNE) return null;

  const nomes = coleta.listarVersoesEsperadas();
  const idxAtual = nomes.indexOf(versaoAtual);
  if (idxAtual < 0) return null;

  const passos = [];
  const pares = [];
  for (let i = 0; i < idxAtual; i++) {
    const vSA = versoesProc.find(v => v.versao === nomes[i]);
    const liq = neLiquida(cacheNE, cacheDesc, nomes[i + 1]);
    if (vSA && vSA.totalLiberacoes > 0 && liq !== null) {
      const vNE = cacheNE[nomes[i + 1]];
      const brutas = vNE.totais.entradasBrutas;
      const d = cacheDesc ? cacheDesc[nomes[i + 1]] : null;
      const csd = d ? (d.conclSemDev || 0) : 0;
      const repr = d ? (d.reprovadas || 0) : 0;
      const presc = d ? (d.prescritas || 0) : 0;
      pares.push({
        versao: nomes[i + 1], brutas, csd, repr, presc, liq, sas: vSA.totalLiberacoes
      });
    }
  }

  if (pares.length < 3) return null;
  const janela = pares.slice(-JANELA);

  // Passo 1: Coleta
  passos.push({
    titulo: 'Identificar as ultimas 4 versoes com dados completos',
    detalhe: janela.map(p =>
      `${p.versao}: ${p.brutas} brutas - ${p.csd} CsD - ${p.repr} repr - ${p.presc} presc = ${p.liq} liquidas`
    ),
    resultado: `Versoes usadas: ${janela.map(p => p.versao).join(', ')}`
  });

  // Passo 2: NE liquida
  const liqs = janela.map(p => p.liq);
  passos.push({
    titulo: 'Calcular NE liquida de cada versao',
    detalhe: janela.map(p =>
      `${p.versao}: NE_liq = ${p.brutas} - ${p.csd} - ${p.repr} - ${p.presc} = ${p.liq}`
    ),
    resultado: `NEs liquidas: [${liqs.join(', ')}]`
  });

  // Passo 3: Mediana
  const sorted = [...liqs].sort((a, b) => a - b);
  const med = mediana(liqs);
  const explicMed = sorted.length % 2 === 0
    ? `(${sorted[sorted.length / 2 - 1]} + ${sorted[sorted.length / 2]}) / 2 = ${med}`
    : `valor central = ${med}`;

  passos.push({
    titulo: 'Calcular a mediana (valor central, robusto contra outliers)',
    detalhe: [
      `Ordenar: [${sorted.join(', ')}]`,
      `Mediana: ${explicMed}`
    ],
    resultado: `Previsao pontual: ${Math.round(med)} NEs`
  });

  // Passo 4: Intervalo
  const p25 = percentil(liqs, 25);
  const p75 = percentil(liqs, 75);
  passos.push({
    titulo: 'Calcular intervalo de confianca (P25 a P75)',
    detalhe: [
      `Percentil 25: ${p25} (25% dos valores ficam abaixo)`,
      `Percentil 75: ${p75} (75% dos valores ficam abaixo)`
    ],
    resultado: `Intervalo provavel: ${Math.round(p25)} a ${Math.round(p75)} NEs`
  });

  // Passo 5: Resultado final
  passos.push({
    titulo: 'Resultado final',
    detalhe: [
      `Previsao: ${Math.round(med)} NEs liquidas`,
      `Intervalo: [${Math.round(p25)}, ${Math.round(p75)}]`,
      'Estrategia: Mediana pura (janela 4), calibrada com 16 estrategias'
    ],
    resultado: `A proxima versao deve gerar em torno de ${Math.round(med)} NEs`
  });

  return {
    versaoAlvo: nomes[idxAtual + 1] || 'proxima',
    versaoBase: versaoAtual,
    estrategia: 'mediana_pura_v3',
    janela: JANELA,
    passos,
    dadosUsados: janela
  };
}

module.exports = { gerarExemploCalculo };
