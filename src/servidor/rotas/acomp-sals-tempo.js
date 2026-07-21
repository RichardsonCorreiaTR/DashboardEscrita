/**
 * rotas/acomp-sals-tempo.js - Detalhamento de tempo por SAL
 *
 * Lista SALs (tipoSAI='SAL') por analista/nivel/ano com PSAI, SAI, nivel,
 * tempo de analise/definicao/total (min) e situacao da SAI. Agrupavel por mes.
 *
 * GET /api/acomp-sals/tempo-detalhado?ano=2026&analista=<sgd|todos>&nivel=<1..4|todos>
 */
const path = require('path');
const { Router } = require('express');
const qe = require('../../core/query-executor');
const { decodificarBinario } = require('../../core/consultas-ne');

const equipe = require(path.join(__dirname, '../../../config/equipe.json'));
const analistas = equipe.analistas.filter(a => a.papel === 'analista');
const MAPA = {};
analistas.forEach(a => { MAPA[String(a['codigo-sgd'])] = { apelido: a.apelido, slug: a.slug, senioridade: a.senioridade }; });

const AREA = "sp.nomeArea IN ('Escrita', 'Importacao', 'ONVIO ESCRITA')";
const NIVEL_NOME = { 1: 'Baixa', 2: 'Média', 3: 'Alta', 4: 'Extra Alta' };
const router = Router();

function queryLinhas(ano, idsSgd, nivel) {
  const filtroNivel = nivel ? `AND COALESCE(p.nivel_alteracao, 1) = ${nivel}` : '';
  return `
    SELECT p.i_responsaveis as i_usuarios, sp.i_psai, sp.i_sai,
      COALESCE(p.nivel_alteracao, 1) as nivel,
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
    WHERE ${AREA}
      AND sp.tipoSAI = 'SAL'
      AND COALESCE(p.i_produto_grupo, 1) = 1
      AND p.i_responsaveis IN (${idsSgd})
      AND YEAR(sp.CadastroPSAI) = ${ano}
      ${filtroNivel}
    ORDER BY MONTH(sp.CadastroPSAI), sp.i_psai
  `;
}

// Deduplica por i_psai somando tempos (uma PSAI pode ter varias linhas de responsavel)
function mapearLinhas(rows) {
  const porPsai = new Map();
  rows.forEach(r => {
    const key = r.i_psai;
    const cur = porPsai.get(key);
    const tA = Number(r.tempo_analise) || 0;
    const tD = Number(r.tempo_definicao) || 0;
    if (cur) {
      cur.tempo_analise += tA;
      cur.tempo_definicao += tD;
      cur.tempo_total = cur.tempo_analise + cur.tempo_definicao;
      return;
    }
    const sgd = String(r.i_usuarios);
    const nivel = Number(r.nivel) || 1;
    porPsai.set(key, {
      i_usuarios: sgd,
      apelido: (MAPA[sgd] && MAPA[sgd].apelido) || sgd,
      i_psai: r.i_psai,
      i_sai: r.i_sai || 0,
      nivel,
      nivel_nome: NIVEL_NOME[nivel] || String(nivel),
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
    niveis: Object.entries(NIVEL_NOME).map(([id, nome]) => ({ id: Number(id), nome }))
  };
}

router.get('/acomp-sals/tempo-detalhado', async (req, res) => {
  // Modo leve: so retorna os filtros (para popular os selects sem consulta pesada)
  if (req.query.filtros === '1') {
    return res.json({ filtros: montarFiltros(), linhas: [] });
  }

  const ano = Number(req.query.ano) || new Date().getFullYear();
  const nivelParam = req.query.nivel && req.query.nivel !== 'todos' ? Number(req.query.nivel) : null;
  const analistaParam = req.query.analista && req.query.analista !== 'todos' ? String(req.query.analista) : null;

  const idsSgd = analistaParam && MAPA[analistaParam]
    ? analistaParam
    : Object.keys(MAPA).join(', ');

  try {
    const rows = await qe.executar(queryLinhas(ano, idsSgd, nivelParam));
    const linhas = mapearLinhas(rows);
    res.json({ ano, filtros: montarFiltros(), linhas });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
