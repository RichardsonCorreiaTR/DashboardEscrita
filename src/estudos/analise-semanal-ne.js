/**
 * analise-semanal-ne.js - Analise semanal de NE por versao
 *
 * Divide o periodo de uma versao em S1-S4 (proporcional) e calcula:
 * - Entradas brutas por semana (sem descontar descartes)
 * - Descartes por semana
 * - Media diaria (dias uteis e dias corridos)
 * - Projecao de entradas para o restante da versao
 *
 * Usa queries eficientes que retornam todas as NEs de uma vez,
 * depois agrupa por semana em JavaScript.
 */

const versao = require('../core/versao');
const { parsearData } = require('../core/date-utils');
const { dividirEmSemanas, identificarSemana } = require('./semanas');
const { calcularContagens } = require('./isv-gravidade');
const { FILTRO_PRODUTO_ENTRADA, querySSCsVinculadas, condAreaNE } = require('../core/consultas-ne');

/**
 * Query: todas as entradas de NE no periodo com data
 */
function queryEntradasComData(nomeVersao, area) {
  const inicio = versao.sqlInicioVersao(nomeVersao);
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT sai_psai.i_psai, sai_psai.CadastroPSAI, sai_psai.gravidade_ne
    FROM UP.SAI_PSAI sai_psai
    WHERE ${condAreaNE(area)}
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.CadastroPSAI > ${inicio}
      AND sai_psai.CadastroPSAI <= ${fim}
      ${FILTRO_PRODUTO_ENTRADA}
  `;
}

/**
 * Query: todos os descartes de NE no periodo com data
 */
function queryDescartesComData(nomeVersao, area) {
  const inicio = versao.sqlInicioVersao(nomeVersao);
  const fim = versao.sqlFimVersao(nomeVersao);
  return `
    SELECT sai_psai.Descarte
    FROM UP.SAI_PSAI sai_psai
    WHERE ${condAreaNE(area)}
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.Descarte > ${inicio}
      AND sai_psai.Descarte <= ${fim}
      ${FILTRO_PRODUTO_ENTRADA}
  `;
}

/**
 * Agrupa registros por semana
 * @param {Array} registros - Rows com campo de data
 * @param {string} campoData - Nome do campo de data (CadastroPSAI ou Descarte)
 * @param {Array} semanas - Divisao de semanas
 * @returns {Object} Mapa semanaId -> contagem
 */
function agruparPorSemana(registros, campoData, semanas) {
  const contagem = {};
  for (const s of semanas) contagem[s.id] = 0;

  for (const reg of registros) {
    const dt = parsearData(reg[campoData]);
    if (!dt) continue;
    const semId = identificarSemana(dt, semanas);
    if (semId && contagem[semId] !== undefined) {
      contagem[semId]++;
    }
  }

  return contagem;
}

/**
 * Calcula a analise semanal completa para uma versao
 * @param {Object} executor - Query executor
 * @param {string} nomeVersao - Ex: '10.6A-02'
 * @returns {Promise<Object>} Resultado com semanas, totais, medias
 */
async function calcular(executor, nomeVersao, area = 'Escrita') {
  // 1. Obter datas da versao
  const datas = await versao.obterDatas(executor, nomeVersao);
  if (!datas || !datas.inicio || !datas.fim) {
    throw new Error(`Versao ${nomeVersao}: datas nao encontradas`);
  }

  // 2. Dividir em semanas
  const divisao = dividirEmSemanas(datas.inicio, datas.fim);

  // 3. Buscar entradas e descartes
  const [entradas, descartes] = await Promise.all([
    executor.executar(queryEntradasComData(nomeVersao, area)),
    executor.executar(queryDescartesComData(nomeVersao, area))
  ]);

  // 4. Agrupar por semana + gravidade + SSC
  const entradasPorSemana = agruparPorSemana(entradas, 'CadastroPSAI', divisao.semanas);
  const descartesPorSemana = agruparPorSemana(descartes, 'Descarte', divisao.semanas);
  const gravidade = calcularContagens(entradas);

  let ssc = { totalSSC: 0, neComSSC: 0, maxSSC: 0, porNE: {} };
  try {
    const psaiIds = entradas.map(r => r.i_psai).filter(Boolean);
    ssc = await querySSCsVinculadas(sql => executor.executar(sql), psaiIds);
  } catch (err) {
    console.warn('[semanal-ne] %s: erro coletando SSC: %s', nomeVersao, err.message);
  }

  // 5. Calcular metricas por semana com acumulado
  let acumEnt = 0;
  let acumDesc = 0;
  const semanas = divisao.semanas.map(s => {
    const ent = entradasPorSemana[s.id] || 0;
    const desc = descartesPorSemana[s.id] || 0;
    acumEnt += ent;
    acumDesc += desc;
    return {
      ...s,
      entradasBrutas: ent,
      descartes: desc,
      acumuladoEntradas: acumEnt,
      acumuladoDescartes: acumDesc,
      mediaDiaUtil: s.diasUteis > 0 ? round2(ent / s.diasUteis) : 0,
      mediaDiaCorrido: s.dias > 0 ? round2(ent / s.dias) : 0,
      mediaDiaUtilDescartes: s.diasUteis > 0 ? round2(desc / s.diasUteis) : 0,
      mediaDiaCorridoDescartes: s.dias > 0 ? round2(desc / s.dias) : 0
    };
  });

  // 6. Calcular totais + validacao cruzada
  const totalEntradas = semanas.reduce((s, w) => s + w.entradasBrutas, 0);
  const totalDescartes = semanas.reduce((s, w) => s + w.descartes, 0);

  if (totalEntradas !== entradas.length) {
    console.warn(
      '[semanal-ne] %s: %d NEs do SQL nao encaixaram nas semanas (SQL=%d, semanal=%d)',
      nomeVersao, entradas.length - totalEntradas, entradas.length, totalEntradas
    );
  }

  // 7. Determinar progresso da versao (qual semana estamos)
  const hoje = new Date();
  const dtInicio = parsearData(datas.inicio);
  const dtFim = parsearData(datas.fim);
  const semanaAtual = identificarSemana(hoje, divisao.semanas);
  const versaoEmAndamento = hoje >= dtInicio && hoje <= dtFim;

  // 8. Indice de semanas concluidas (0-4)
  // S1=0, S2=1, S3=2, S4=3 -> semanasConcluidas = indice da semana atual
  const semIdxMap = { S1: 0, S2: 1, S3: 2, S4: 3 };
  const semanasConcluidas = versaoEmAndamento
    ? (semanaAtual ? semIdxMap[semanaAtual] : 4)
    : 4;

  // 9. Calcular dias DECORRIDOS (somente semanas ja concluidas)
  // Para versao em andamento, nao conta S4 se ainda nao comecou
  let diasUteisDecorridos = divisao.totalDiasUteis;
  let diasDecorridos = divisao.totalDias;
  if (versaoEmAndamento && semanasConcluidas < 4) {
    diasUteisDecorridos = 0;
    diasDecorridos = 0;
    for (let i = 0; i < semanasConcluidas; i++) {
      diasUteisDecorridos += semanas[i].diasUteis;
      diasDecorridos += semanas[i].dias;
    }
  }

  // 10. Projecao simples (linear)
  let projecao = null;
  if (versaoEmAndamento && totalEntradas > 0) {
    const diasPassados = Math.max(1, Math.round((hoje - dtInicio) / (1000 * 60 * 60 * 24)));
    const taxaDiaria = totalEntradas / diasPassados;
    projecao = {
      linear: Math.round(taxaDiaria * divisao.totalDias),
      taxaDiaria: round2(taxaDiaria),
      diasPassados,
      diasRestantes: divisao.totalDias - diasPassados,
      percentualConcluido: round2((diasPassados / divisao.totalDias) * 100)
    };
  }

  const parsed = versao.parsearNomeVersao(nomeVersao);

  // Media real: usa dias decorridos para versao em andamento
  const mediaDiaUtilReal = diasUteisDecorridos > 0
    ? round2(totalEntradas / diasUteisDecorridos) : 0;
  const mediaDiaCorridoReal = diasDecorridos > 0
    ? round2(totalEntradas / diasDecorridos) : 0;

  return {
    versao: nomeVersao,
    area,
    mes: parsed ? parsed.mes : null,
    ano: parsed ? parsed.ano : null,
    periodo: {
      inicio: datas.inicio,
      fim: datas.fim
    },
    totalDias: divisao.totalDias,
    totalDiasUteis: divisao.totalDiasUteis,
    diasUteisDecorridos,
    diasDecorridos,
    semanas,
    semanasConcluidas,
    totais: {
      entradasBrutas: totalEntradas, descartes: totalDescartes,
      mediaDiaUtil: mediaDiaUtilReal, mediaDiaCorrido: mediaDiaCorridoReal,
      mediaDiaUtilVersaoCompleta: divisao.totalDiasUteis > 0 ? round2(totalEntradas / divisao.totalDiasUteis) : 0,
      mediaDiaUtilDescartes: diasUteisDecorridos > 0 ? round2(totalDescartes / diasUteisDecorridos) : 0,
      mediaDiaCorridoDescartes: diasDecorridos > 0 ? round2(totalDescartes / diasDecorridos) : 0,
      gravidade,
      ssc: { totalSSC: ssc.totalSSC, neComSSC: ssc.neComSSC, maxSSC: ssc.maxSSC,
        ratio: totalEntradas > 0 ? round2(ssc.totalSSC / totalEntradas) : 0 }
    },
    semanaAtual,
    versaoEmAndamento,
    projecao
  };
}

function round2(v) { return Math.round(v * 100) / 100; }

module.exports = { calcular };
