/**
 * rotas/acomp-nes-tempo.js - Detalhamento de tempo por NE
 *
 * Lista NEs (tipoSAI='NE') por analista/area/ano com PSAI, SAI, tempo de
 * analise/definicao/total (min) e situacao da SAI. Agrupavel por mes.
 * Sem filtro de nivel (NEs nao usam nivel de alteracao aqui).
 *
 * GET /api/acomp-nes/tempo-detalhado?ano=2026&analista=<sgd|todos>&area=Escrita|Importacao
 */
const path = require('path');
const { Router } = require('express');
const qe = require('../../core/query-executor');
const { decodificarBinario, condAreaNE } = require('../../core/consultas-ne');

const equipe = require(path.join(__dirname, '../../../config/equipe.json'));
const analistas = equipe.analistas.filter(a => a.papel === 'analista');
const MAPA = {};
analistas.forEach(a => { MAPA[String(a['codigo-sgd'])] = { apelido: a.apelido, slug: a.slug, senioridade: a.senioridade }; });

const router = Router();

function queryLinhas(ano, idsSgd, area) {
  return `
    SELECT p.i_responsaveis as i_usuarios, sp.i_psai, sp.i_sai,
      MONTH(sp.CadastroPSAI) as mes,
      COALESCE(pr.tempo_analise, 0) as tempo_analise,
      COALESCE(pr.tempo_definicao, 0) as tempo_definicao,
      CAST(TRIM(COALESCE(sit.descricao, psit.descricao)) AS BINARY(64)) as situacao_nome --allow-blob
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    LEFT JOIN bethadba.psai_responsaveis pr ON pr.i_psai = sp.i_psai
      AND pr.i_usuarios = p.i_responsaveis
    LEFT JOIN bethadba.sai_situacoes sit
      ON sp.i_sai_situacoes = sit.i_sai_situacoes AND sit.i_sai_linhas = 1
    LEFT JOIN bethadba.psai_situacoes psit
      ON sp.i_psai_situacoes = psit.i_situacoes
    WHERE ${condAreaNE(area, 'sp')}
      AND sp.tipoSAI = 'NE'
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND p.i_responsaveis IN (${idsSgd})
      AND YEAR(sp.CadastroPSAI) = ${ano}
    ORDER BY MONTH(sp.CadastroPSAI), sp.i_psai
  `;
}

// Deduplica por i_psai somando tempos (uma PSAI pode ter varias linhas de responsavel)
function mapearLinhas(rows) {
  const porPsai = new Map();
  rows.forEach(r => {
    const key = r.i_psai;
    const tA = Number(r.tempo_analise) || 0;
    const tD = Number(r.tempo_definicao) || 0;
    const cur = porPsai.get(key);
    if (cur) {
      cur.tempo_analise += tA;
      cur.tempo_definicao += tD;
      cur.tempo_total = cur.tempo_analise + cur.tempo_definicao;
      return;
    }
    const sgd = String(r.i_usuarios);
    porPsai.set(key, {
      i_usuarios: sgd,
      apelido: (MAPA[sgd] && MAPA[sgd].apelido) || sgd,
      i_psai: r.i_psai,
      i_sai: r.i_sai || 0,
      mes: Number(r.mes) || 0,
      tempo_analise: tA,
      tempo_definicao: tD,
      tempo_total: tA + tD,
      situacao: decodificarBinario(r.situacao_nome) || '(sem situação)'
    });
  });
  return [...porPsai.values()];
}

function montarFiltros() {
  return {
    analistas: Object.entries(MAPA).map(([sgd, i]) => ({ sgd, apelido: i.apelido, slug: i.slug, senioridade: i.senioridade }))
      .sort((a, b) => a.apelido.localeCompare(b.apelido, 'pt-BR')),
    areas: [{ id: 'Escrita', nome: 'Escrita' }, { id: 'Importacao', nome: 'Importação' }]
  };
}

router.get('/acomp-nes/tempo-detalhado', async (req, res) => {
  if (req.query.filtros === '1') {
    return res.json({ filtros: montarFiltros(), linhas: [] });
  }

  const ano = Number(req.query.ano) || new Date().getFullYear();
  const area = req.query.area === 'Importacao' ? 'Importacao' : 'Escrita';
  const analistaParam = req.query.analista && req.query.analista !== 'todos' ? String(req.query.analista) : null;
  const idsSgd = analistaParam && MAPA[analistaParam] ? analistaParam : Object.keys(MAPA).join(', ');

  try {
    const rows = await qe.executar(queryLinhas(ano, idsSgd, area));
    res.json({ ano, area, filtros: montarFiltros(), linhas: mapearLinhas(rows) });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
