/**
 * planilha-cruzamento.js - Compara dados do SGD com a planilha de acompanhamento
 *
 * Regras:
 * - Planilha e verdade: SAI na planilha com pontos divergentes do SGD = divergencia
 * - SAI na planilha sem pontos = sem pontos na planilha (informativo)
 * - SAI so no SGD = manter (sem alertar)
 * - SAI so na planilha = incluir como ausente no SGD
 */

function cruzar(sgdRows, planilhaRows) {
  const sgdMap = new Map(sgdRows.map(r => [Number(r.i_sai), r]));
  const planMap = new Map(planilhaRows.map(r => [Number(r.i_sai), r]));

  const divergencias = [];
  const apenasNaPlanilha = [];
  const semPontosNaPlanilha = [];

  for (const [id, pRow] of planMap) {
    const sgd = sgdMap.get(id);
    const ptsPlanilha = pRow.pontos != null ? Number(pRow.pontos) : null;

    if (!sgd) {
      apenasNaPlanilha.push({ i_sai: id, tipoSAI: pRow.tipoSAI, nivel: pRow.nivel, pontos_planilha: ptsPlanilha });
      continue;
    }

    const ptsSgd = sgd.pontuacao != null ? Number(sgd.pontuacao) : null;

    if (ptsPlanilha === null) {
      semPontosNaPlanilha.push({ i_sai: id, tipoSAI: pRow.tipoSAI, nivel: pRow.nivel });
      continue;
    }

    if (ptsSgd === null || ptsSgd === 0) {
      divergencias.push({ i_sai: id, tipoSAI: pRow.tipoSAI, nivel: pRow.nivel,
        pontos_sgd: ptsSgd, pontos_planilha: ptsPlanilha, motivo: 'sgd_sem_pontos' });
      continue;
    }

    if (Math.abs(ptsSgd - ptsPlanilha) > 0.01) {
      divergencias.push({ i_sai: id, tipoSAI: pRow.tipoSAI, nivel: pRow.nivel,
        pontos_sgd: ptsSgd, pontos_planilha: ptsPlanilha, motivo: 'valor_diferente' });
    }
  }

  const temDivergencia = divergencias.length > 0 || apenasNaPlanilha.length > 0;
  const totalPlanilha = planilhaRows.reduce((s, r) => s + (r.pontos ? Number(r.pontos) : 0), 0);

  return { divergencias, apenasNaPlanilha, semPontosNaPlanilha, temDivergencia, totalPlanilha };
}

module.exports = { cruzar };
