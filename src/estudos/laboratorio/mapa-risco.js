/**
 * laboratorio/mapa-risco.js - Calculo de metricas de risco por tag
 *
 * Consome rastreabilidade (SA->NE) e gera:
 * - Taxa NE/SA por tag
 * - Gravidade media por tag
 * - Tempo medio de deteccao por tag
 * - Matriz tag x nivel de alteracao
 */

const { round2 } = require('../estatisticas-ne');

function calcular(rastreabilidade) {
  if (!rastreabilidade || !rastreabilidade.por_versao) return null;

  const acumTag = {};
  const acumTagNivel = {};

  for (const [, dados] of Object.entries(rastreabilidade.por_versao)) {
    acumularSAs(acumTag, acumTagNivel, dados.sas);
    acumularNEs(acumTag, dados.nes);
  }

  const ranking = montarRanking(acumTag);
  const matrizTagNivel = montarMatriz(acumTagNivel, acumTag);

  return {
    ranking,
    matriz_tag_nivel: matrizTagNivel,
    _meta: {
      gerado_em: new Date().toISOString(),
      total_tags: ranking.length
    }
  };
}

function acumularSAs(acumTag, acumTagNivel, sas) {
  for (const sa of sas) {
    for (const tag of sa.tags) {
      garantirTag(acumTag, tag);
      acumTag[tag].sas_total++;
      if (sa.tipo === 'SAM') acumTag[tag].sas_sam++;
      else if (sa.tipo === 'SAL') acumTag[tag].sas_sal++;
      else if (sa.tipo === 'SAIL') acumTag[tag].sas_sail++;

      const nKey = `${tag}|${sa.nivel || 'null'}`;
      if (!acumTagNivel[nKey]) acumTagNivel[nKey] = { tag, nivel: sa.nivel, sas: 0, nes: 0 };
      acumTagNivel[nKey].sas++;
    }
  }
}

function acumularNEs(acumTag, nes) {
  for (const ne of nes) {
    for (const tag of ne.tags_origem) {
      garantirTag(acumTag, tag);
      acumTag[tag].nes_geradas++;
      if (ne.gravidade === 'Grave') acumTag[tag].nes_graves++;
      else if (ne.gravidade === 'Critica') acumTag[tag].nes_criticas++;
      if (ne.dias_deteccao !== null) {
        acumTag[tag].dias_deteccao_soma += ne.dias_deteccao;
        acumTag[tag].dias_deteccao_count++;
      }
    }
  }
}

function garantirTag(acum, tag) {
  if (acum[tag]) return;
  acum[tag] = {
    sas_total: 0, sas_sam: 0, sas_sal: 0, sas_sail: 0,
    nes_geradas: 0, nes_graves: 0, nes_criticas: 0,
    dias_deteccao_soma: 0, dias_deteccao_count: 0
  };
}

function montarRanking(acumTag) {
  const ranking = [];
  for (const [tag, d] of Object.entries(acumTag)) {
    if (d.sas_total === 0) continue;
    const taxa = round2(d.nes_geradas / d.sas_total);
    const gravMedia = d.nes_geradas > 0
      ? round2((d.nes_geradas + d.nes_graves + d.nes_criticas * 2) / d.nes_geradas)
      : 0;
    const mediaDias = d.dias_deteccao_count > 0
      ? Math.round(d.dias_deteccao_soma / d.dias_deteccao_count) : null;

    ranking.push({
      tag, sas_total: d.sas_total, nes_geradas: d.nes_geradas,
      taxa_ne_sa: taxa, gravidade_media: gravMedia,
      tempo_medio_deteccao: mediaDias,
      pct_graves: d.nes_geradas > 0
        ? round2(((d.nes_graves + d.nes_criticas) / d.nes_geradas) * 100) : 0
    });
  }
  ranking.sort((a, b) => b.taxa_ne_sa - a.taxa_ne_sa);
  return ranking;
}

function montarMatriz(acumTagNivel, acumTag) {
  const matriz = [];
  for (const [, d] of Object.entries(acumTagNivel)) {
    if (d.sas === 0) continue;
    matriz.push({
      tag: d.tag, nivel: d.nivel, sas: d.sas, nes: d.nes,
      taxa: round2(d.nes / d.sas)
    });
  }
  return matriz;
}

module.exports = { calcular };
