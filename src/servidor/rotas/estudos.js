/**
 * rotas/estudos.js - API REST para Estudos e Analises
 *
 * Rotas:
 * - GET /api/estudos/versoes           -> lista versoes disponiveis (2022+)
 * - GET /api/estudos/semanal/:versao   -> analise semanal de UMA versao
 * - GET /api/estudos/historico         -> analise historica completa com ISV
 * - GET /api/estudos/liberacoes-sa     -> liberacoes de SA (SAM/SAL/SAIL) historico
 *
 * Estrategia de cache:
 * - Versao atual: reconsulta ODBC (ou force=1)
 * - Versoes passadas: cache em disco (apenas reconsulta se force=1)
 */

const { Router } = require('express');

const qe = require('../../core/query-executor');
const versao = require('../../core/versao');
const analiseSemanal = require('../../estudos/analise-semanal-ne');
const analiseHistorica = require('../../estudos/analise-historica-ne');
const liberacoesSA = require('../../estudos/liberacoes-sa');
const liberacoesSAv2 = require('../../estudos/liberacoes-sa-v2');
const descartesNE = require('../../estudos/descartes-ne');

const router = Router();

/** GET /api/estudos/versoes */
router.get('/estudos/versoes', async (req, res) => {
  try {
    const nomes = analiseHistorica.listarVersoesEsperadas();
    const atual = await detectarAtualSafe();

    // Retornar lista rapida sem consultar datas individualmente
    // As datas serao obtidas sob demanda ao selecionar a versao
    const lista = nomes.map(nome => ({
      versao: nome,
      atual: nome === atual
    }));

    // Tentar obter datas apenas da versao atual (rapido, 1 query)
    try {
      const datas = await versao.obterDatas(qe, atual);
      const idx = lista.findIndex(v => v.versao === atual);
      if (idx >= 0 && datas) {
        lista[idx].inicio = datas.inicio;
        lista[idx].fim = datas.fim;
      }
    } catch { /* ignorar */ }

    res.json({ versoes: lista, atual });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/** GET /api/estudos/semanal/:versao?force=1 */
router.get('/estudos/semanal/:versao', async (req, res) => {
  try {
    const nomeVersao = req.params.versao;
    const force = req.query.force === '1';

    // Tenta ODBC; se force ou versao atual
    const atual = await detectarAtualSafe();
    const ehAtual = nomeVersao === atual;

    const dados = await analiseHistorica.coletarVersao(
      qe, nomeVersao, force || ehAtual
    );

    if (!dados) {
      return res.status(404).json({ erro: `Sem dados para versao ${nomeVersao}` });
    }

    // Enriquecer SSC se vier do cache sem esses dados
    analiseHistorica.enriquecerSSC([dados]);

    // Calcular ISV e projecao realista se houver historico suficiente
    const historico = analiseHistorica.obterHistoricoAnterior(nomeVersao);
    let isv = null;
    let projecaoRealista = null;
    if (historico.length >= 3) {
      isv = analiseHistorica.calcularISV(dados, historico);
      const completas = historico.filter(
        h => !h.versaoEmAndamento && (h.semanasConcluidas !== undefined ? h.semanasConcluidas : 4) === 4
      );
      if (completas.length >= 3) {
        projecaoRealista = analiseHistorica.calcularProjecaoRealista(dados, completas);
      }
    }

    res.json({
      ...dados,
      isv,
      projecaoRealista,
      _fonte: 'odbc',
      _atualizado_em: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/** GET /api/estudos/historico?force=1&area=Escrita|Importacao */
router.get('/estudos/historico', async (req, res) => {
  try {
    const force = req.query.force === '1';
    const area = req.query.area === 'Importacao' ? 'Importacao' : 'Escrita';
    const resultado = await analiseHistorica.calcularHistorico(qe, {
      forceAtual: true,
      forceTodas: force,
      area
    });

    res.json({ ...resultado, area });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/** GET /api/estudos/liberacoes-sa?force=1 */
router.get('/estudos/liberacoes-sa', async (req, res) => {
  try {
    const force = req.query.force === '1';
    const resultado = await liberacoesSA.calcularHistorico(qe, {
      forceAtual: true,
      forceTodas: force
    });

    res.json(resultado);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/** GET /api/estudos/liberacoes-sa-v2?force=1 */
router.get('/estudos/liberacoes-sa-v2', async (req, res) => {
  try {
    const force = req.query.force === '1';
    const resultado = await liberacoesSAv2.calcularHistorico(qe, {
      forceAtual: true,
      forceTodas: force
    });

    res.json(resultado);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/** GET /api/estudos/descartes-ne?force=1&area=Escrita|Importacao */
router.get('/estudos/descartes-ne', async (req, res) => {
  try {
    const force = req.query.force === '1';
    const area = req.query.area === 'Importacao' ? 'Importacao' : 'Escrita';
    const resultado = await descartesNE.calcularDescartes(qe, {
      forceAtual: true,
      forceTodas: force,
      area
    });

    res.json({ ...resultado, area });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/** GET /api/estudos/resumo/:versao - Resumo executivo da versao */
router.get('/estudos/resumo/:versao', async (req, res) => {
  try {
    const nomeVersao = req.params.versao;
    const consultas = require('../../core/consultas-ne');
    const rows = await qe.executar(consultas.queryResumoNEs(nomeVersao));
    if (!rows.length) return res.json({ versao: nomeVersao, nes: [], areas: [] });

    const psaiIds = rows.map(r => r.i_psai).filter(Boolean);
    const ssc = await consultas.querySSCsVinculadas(
      sql => qe.executar(sql), psaiIds
    );

    const nes = rows.map(r => {
      const descSai = consultas.decodificarBinario(r.descricao_bin);
      const descPsai = consultas.decodificarBinario(r.psai_descricao_bin);
      const desc = descSai || descPsai;
      const semSai = !descSai && r.i_sai === 0;
      return {
        i_psai: r.i_psai, i_sai: r.i_sai,
        gravidade: r.gravidade_ne, entrada: r.CadastroPSAI,
        liberacao: r.Liberacao, descricao: desc, semSai,
        area: consultas.classificarArea(desc),
        sscs: ssc.porNE[r.i_psai] || 0
      };
    });

    const areaMap = {};
    for (const ne of nes) {
      if (!areaMap[ne.area]) {
        areaMap[ne.area] = { area: ne.area, qtd: 0, sscs: 0, criticas: 0, graves: 0, normais: 0, topNE: [] };
      }
      const a = areaMap[ne.area];
      a.qtd++;
      a.sscs += ne.sscs;
      if (ne.gravidade === 'Critica') a.criticas++;
      else if (ne.gravidade === 'Grave') a.graves++;
      else a.normais++;
      if (ne.sscs > 0 && a.topNE.length < 3) a.topNE.push(ne);
    }
    const areas = Object.values(areaMap).sort((a, b) => b.sscs - a.sscs);

    const criticas = nes.filter(n => n.gravidade === 'Critica');
    const graves = nes.filter(n => n.gravidade === 'Grave');
    const topSSC = [...nes].sort((a, b) => b.sscs - a.sscs).filter(n => n.sscs > 0).slice(0, 10);

    const outros = nes.filter(n => n.area === 'Outros').sort((a, b) => b.sscs - a.sscs);

    res.json({
      versao: nomeVersao,
      totalNE: nes.length,
      resumo: {
        criticas: criticas.length, graves: graves.length,
        normais: nes.length - criticas.length - graves.length,
        totalSSC: ssc.totalSSC, neComSSC: ssc.neComSSC,
        ratio: nes.length > 0 ? Math.round(ssc.totalSSC / nes.length * 10) / 10 : 0
      },
      areas,
      topSSC,
      criticasGraves: [...criticas, ...graves].sort((a, b) => b.sscs - a.sscs),
      outros
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/** GET /api/estudos/diff-niveis - Diferenças de nivel entre Planilha e SGD */
router.get('/estudos/diff-niveis', async (req, res) => {
  const planilha = require('../../core/planilha-escrita');
  const MESES = [1,2,3,4,5,6,7,8,9,10,11,12];
  const NIVEL_DB = { 1: 'Baixa', 2: 'Média', 3: 'Alta', 4: 'Extra Alta' };
  const NIVEL_CHAVE = { 'baixa': 1, 'media': 2, 'média': 2, 'alta': 3, 'extra alta': 4 };
  try {
    // 1. Ler todas as SAIs da planilha com nivel
    const saiMap = {};
    for (const mes of MESES) {
      const rows = await planilha.obterSaisPorMes(mes).catch(() => []);
      rows.forEach(r => {
        if (r.i_sai && r.nivel) saiMap[r.i_sai] = { nivel_planilha: r.nivel, responsavel: r.responsavel_psai, tipo: r.tipoSAI };
      });
    }
    const ids = Object.keys(saiMap);
    if (!ids.length) return res.json({ divergencias: [], total: 0 });

    // 2. Buscar nivel no banco em lotes de 200
    const loteSize = 200;
    const dbMap = {};
    for (let i = 0; i < ids.length; i += loteSize) {
      const lote = ids.slice(i, i + loteSize).join(',');
      const rows = await qe.executar(`SELECT sp.i_sai, p.nivel_alteracao FROM UP.SAI_PSAI sp JOIN bethadba.psai p ON sp.i_psai = p.i_psai WHERE sp.i_sai IN (${lote})`);
      rows.forEach(r => { dbMap[r.i_sai] = r.nivel_alteracao; });
    }

    // 3. Comparar
    const divergencias = [];
    for (const [id, d] of Object.entries(saiMap)) {
      const nivelDb = dbMap[id];
      const nivelDbLabel = NIVEL_DB[nivelDb] || 'Não definido';
      const nivelPlanChave = NIVEL_CHAVE[(d.nivel_planilha || '').toLowerCase().trim()];
      if (nivelDb !== nivelPlanChave) {
        divergencias.push({ i_sai: parseInt(id), tipo: d.tipo, responsavel: d.responsavel, nivel_planilha: d.nivel_planilha, nivel_sgd: nivelDbLabel, nivel_sgd_raw: nivelDb });
      }
    }
    divergencias.sort((a, b) => a.responsavel?.localeCompare(b.responsavel || '') || a.i_sai - b.i_sai);
    res.json({ divergencias, total: divergencias.length, total_planilha: ids.length });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* ============== HELPERS ============== */

async function detectarAtualSafe() {
  try {
    return await versao.detectarVersaoAtual(qe);
  } catch {
    const h = new Date();
    return versao.nomeDaVersao(h.getFullYear(), h.getMonth() + 1);
  }
}

module.exports = router;
