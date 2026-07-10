/**
 * rotas/acomp-sals.js - Acompanhamento de SALs: Tempo Descarte
 *
 * Diretriz:
 *   - Reduzir 20% o tempo medio por PSAI SAL (ativas/concluidas)
 *   - Reduzir 30% o tempo em PSAIs SAL descartadas
 * Baseline: ano anterior (ano - 1)
 *
 * GET /api/acomp-sals/tempo-descarte?ano=2026
 */
const path = require('path');
const { Router } = require('express');
const qe = require('../../core/query-executor');

const equipe = require(path.join(__dirname, '../../../config/equipe.json'));
const analistas = equipe.analistas.filter(a => a.papel === 'analista');
const IDS_SGD = analistas.map(a => a['codigo-sgd']).join(', ');
const MAPA = {};
analistas.forEach(a => { MAPA[a['codigo-sgd']] = { apelido: a.apelido, slug: a.slug, senioridade: a.senioridade }; });

const AREA = "sp.nomeArea IN ('Escrita', 'Importacao', 'ONVIO ESCRITA')";
const SITS_DESC = '(5, 6, 23, 33)';
const router = Router();

function queryTempoAtivas(ano) {
  return `
    SELECT p.i_responsaveis as i_usuarios, MONTH(sp.CadastroPSAI) as mes,
      COUNT(DISTINCT sp.i_psai) as total_psais,
      COALESCE(SUM(pr.tempo_analise), 0) + COALESCE(SUM(pr.tempo_definicao), 0) as tempo_total
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    LEFT JOIN bethadba.psai_responsaveis pr ON pr.i_psai = sp.i_psai
      AND pr.i_usuarios = p.i_responsaveis
    WHERE ${AREA}
      AND sp.tipoSAI = 'SAL'
      AND sp.i_psai_situacoes NOT IN ${SITS_DESC}
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND p.i_responsaveis IN (${IDS_SGD})
      AND YEAR(sp.CadastroPSAI) = ${ano}
    GROUP BY p.i_responsaveis, MONTH(sp.CadastroPSAI)
  `;
}

function queryTempoDescartadas(ano) {
  return `
    SELECT p.i_responsaveis as i_usuarios, MONTH(sp.CadastroPSAI) as mes,
      COUNT(DISTINCT sp.i_psai) as total_descartadas,
      COALESCE(SUM(pr.tempo_analise), 0) + COALESCE(SUM(pr.tempo_definicao), 0) as tempo_desc
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    LEFT JOIN bethadba.psai_responsaveis pr ON pr.i_psai = sp.i_psai
      AND pr.i_usuarios = p.i_responsaveis
    WHERE ${AREA}
      AND sp.tipoSAI = 'SAL'
      AND sp.i_psai_situacoes IN ${SITS_DESC}
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND p.i_responsaveis IN (${IDS_SGD})
      AND YEAR(sp.CadastroPSAI) = ${ano}
    GROUP BY p.i_responsaveis, MONTH(sp.CadastroPSAI)
  `;
}

function agrupar(rows, campoTempo, campoQtd) {
  const por = {};
  rows.forEach(r => {
    const id = String(r.I_USUARIOS || r.i_usuarios);
    const mes = r.MES || r.mes;
    if (!por[id]) por[id] = {};
    por[id][mes] = {
      tempo: Number(r[campoTempo] || r[campoTempo.toLowerCase()]) || 0,
      qtd: Number(r[campoQtd] || r[campoQtd.toLowerCase()]) || 0
    };
  });
  return por;
}

function calcularAnualistas(ativas, descartadas) {
  return Object.entries(MAPA).map(([sgd, info]) => {
    const av = ativas[sgd] || {};
    const dc = descartadas[sgd] || {};
    let totalTempoAtivas = 0, totalQtdAtivas = 0;
    let totalTempoDesc = 0, totalQtdDesc = 0;
    for (let m = 1; m <= 12; m++) {
      totalTempoAtivas += (av[m] && av[m].tempo) || 0;
      totalQtdAtivas   += (av[m] && av[m].qtd)   || 0;
      totalTempoDesc   += (dc[m] && dc[m].tempo)  || 0;
      totalQtdDesc     += (dc[m] && dc[m].qtd)    || 0;
    }
    const mediaMin = totalQtdAtivas > 0 ? Math.round(totalTempoAtivas / totalQtdAtivas) : 0;
    return {
      sgd, slug: info.slug, apelido: info.apelido, senioridade: info.senioridade,
      mensal_ativas: av, mensal_descartadas: dc,
      total_psais: totalQtdAtivas, tempo_total_ativas: totalTempoAtivas, media_min: mediaMin,
      total_descartadas: totalQtdDesc, tempo_total_descartadas: totalTempoDesc
    };
  });
}

router.get('/acomp-sals/tempo-descarte', async (req, res) => {
  const ano = Number(req.query.ano) || new Date().getFullYear();
  const anoBase = ano - 1;
  try {
    const [rAtivas, rDesc, rAtivasBase, rDescBase] = await Promise.all([
      qe.executar(queryTempoAtivas(ano)),
      qe.executar(queryTempoDescartadas(ano)),
      qe.executar(queryTempoAtivas(anoBase)),
      qe.executar(queryTempoDescartadas(anoBase))
    ]);
    const atv = agrupar(rAtivas, 'TEMPO_TOTAL', 'TOTAL_PSAIS');
    const dsc = agrupar(rDesc, 'TEMPO_DESC', 'TOTAL_DESCARTADAS');
    const atvBase = agrupar(rAtivasBase, 'TEMPO_TOTAL', 'TOTAL_PSAIS');
    const dscBase = agrupar(rDescBase, 'TEMPO_DESC', 'TOTAL_DESCARTADAS');
    const analistas_ano  = calcularAnualistas(atv, dsc);
    const analistas_base = calcularAnualistas(atvBase, dscBase);
    res.json({ ano, ano_base: anoBase, analistas: analistas_ano, baseline: analistas_base });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
