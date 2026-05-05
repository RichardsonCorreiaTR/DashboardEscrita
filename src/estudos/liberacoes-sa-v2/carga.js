/**
 * liberacoes-sa-v2/carga.js - Calculo de carga ponderada
 *
 * Classifica SAs por faixa de complexidade e calcula
 * carga ponderada por item e por versao.
 *
 * Carga = pesoFaixa * pesoTipo * pesoDesvio * pesoAbrangencia
 */

const { round2 } = require('../estatisticas-ne');

const FAIXAS_COMPLEXIDADE = [
  { id: 'baixa',      label: 'Baixa (ate 2h)',            max: 120,      peso: 1 },
  { id: 'media',      label: 'Media (2h-8h)',             max: 480,      peso: 2 },
  { id: 'alta',       label: 'Alta (8h-40h)',             max: 2400,     peso: 4 },
  { id: 'muito_alta', label: 'Muito Alta (mais de 40h)',  max: Infinity, peso: 8 }
];

const PESO_TIPO = { SAM: 1.0, SAL: 1.3, SAIL: 1.5 };
const CAP_DESVIO = { min: 0.5, max: 2.5 };
const WINSOR_DESVIO_PCT = 500;

function classificarFaixa(tempoMin) {
  if (!tempoMin || tempoMin <= 0) return FAIXAS_COMPLEXIDADE[0];
  for (const f of FAIXAS_COMPLEXIDADE) {
    if (tempoMin <= f.max) return f;
  }
  return FAIXAS_COMPLEXIDADE[FAIXAS_COMPLEXIDADE.length - 1];
}

function calcularCargaItem(item) {
  const faixa = classificarFaixa(item.tempoPrev);
  const pesoTipo = PESO_TIPO[item.tipo] || 1;
  let pesoDesvio = 1;
  if (item.tempoPrev > 0 && item.tempoReal > 0) {
    pesoDesvio = item.tempoReal / item.tempoPrev;
    pesoDesvio = Math.max(CAP_DESVIO.min, Math.min(pesoDesvio, CAP_DESVIO.max));
  }
  const pesoAbrang = 1 + Math.min(item.ssc, 10) * 0.08;
  return { carga: round2(faixa.peso * pesoTipo * pesoDesvio * pesoAbrang), faixa: faixa.id };
}

function agregarVersao(itens) {
  const porTipo = { SAM: 0, SAL: 0, SAIL: 0 };
  const porFaixa = { baixa: 0, media: 0, alta: 0, muito_alta: 0 };
  let cargaTotal = 0;
  let horasPrev = 0, horasReal = 0, somaSSC = 0, comTempo = 0;

  for (const item of itens) {
    const calc = calcularCargaItem(item);
    item.carga = calc.carga;
    item.faixa = calc.faixa;
    if (porTipo[item.tipo] !== undefined) porTipo[item.tipo]++;
    porFaixa[calc.faixa]++;
    cargaTotal += calc.carga;
    if (item.tempoPrev > 0) { horasPrev += item.tempoPrev; comTempo++; }
    horasReal += item.tempoReal;
    somaSSC += item.ssc;
  }

  const n = itens.length || 1;
  const desvioRaw = horasPrev > 0
    ? round2(((horasReal - horasPrev) / horasPrev) * 100) : 0;

  return {
    totalLiberacoes: itens.length,
    porTipo,
    carga: {
      total: round2(cargaTotal),
      porFaixa,
      faixaPredominante: Object.entries(porFaixa)
        .sort((a, b) => b[1] - a[1])[0][0]
    },
    tempos: {
      horasPrevistoTotal: round2(horasPrev / 60),
      horasRealizadoTotal: round2(horasReal / 60),
      desvioEstimativaRaw: desvioRaw,
      desvioEstimativa: round2(
        Math.min(Math.max(desvioRaw, -WINSOR_DESVIO_PCT), WINSOR_DESVIO_PCT)
      ),
      mediaSSC: round2(somaSSC / n)
    },
    pctAltaComplexidade: round2(
      ((porFaixa.alta + porFaixa.muito_alta) / n) * 100
    )
  };
}

module.exports = {
  FAIXAS_COMPLEXIDADE, PESO_TIPO, WINSOR_DESVIO_PCT,
  classificarFaixa, calcularCargaItem, agregarVersao
};
