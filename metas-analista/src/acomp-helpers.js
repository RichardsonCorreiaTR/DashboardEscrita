/**
 * acomp-helpers.js - Queries Acomp. filtradas por um unico codigo-sgd
 */
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./config-analista');

const AREA_SA = "sp.nomeArea IN ('Escrita', 'Importacao', 'ONVIO ESCRITA')";
const SITS_DESC = '(5, 6, 23, 33)';
const NIVEL_NOME = { 1: 'Baixa', 2: 'Média', 3: 'Alta', 4: 'Extra Alta' };
const TIPO_SAL = "sp.tipoSAI = 'SAL'";
/** SAM/SAIL: exclui PSAI A aprovar (14) — alinhado ao dashboard pai */
const TIPO_SAM = "sp.tipoSAI IN ('SAM', 'SAIL') AND sp.i_psai_situacoes <> 14";

function lerColab(slug) {
  const equipe = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/equipe.json'), 'utf8'));
  return equipe.analistas.find(a => a.slug === slug && a.papel === 'analista') || null;
}

function qe() { return require(path.join(ROOT, 'src/core/query-executor')); }

function queryTempoAtivas(ano, sgd, tipoSql) {
  return `
    SELECT p.i_responsaveis as i_usuarios, MONTH(sp.CadastroPSAI) as mes,
      COUNT(DISTINCT sp.i_psai) as total_psais,
      COALESCE(SUM(pr.tempo_analise), 0) + COALESCE(SUM(pr.tempo_definicao), 0) as tempo_total
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    LEFT JOIN bethadba.psai_responsaveis pr ON pr.i_psai = sp.i_psai AND pr.i_usuarios = p.i_responsaveis
    WHERE ${AREA_SA} AND ${tipoSql} AND sp.i_psai_situacoes NOT IN ${SITS_DESC}
      AND COALESCE(p.i_produto_grupo, 1) = 1 AND p.i_responsaveis = ${sgd}
      AND YEAR(sp.CadastroPSAI) = ${ano}
    GROUP BY p.i_responsaveis, MONTH(sp.CadastroPSAI)`;
}

function queryTempoDesc(ano, sgd, tipoSql) {
  return `
    SELECT p.i_responsaveis as i_usuarios, MONTH(sp.CadastroPSAI) as mes,
      COUNT(DISTINCT sp.i_psai) as total_descartadas,
      COALESCE(SUM(pr.tempo_analise), 0) + COALESCE(SUM(pr.tempo_definicao), 0) as tempo_desc
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    LEFT JOIN bethadba.psai_responsaveis pr ON pr.i_psai = sp.i_psai AND pr.i_usuarios = p.i_responsaveis
    WHERE ${AREA_SA} AND ${tipoSql} AND sp.i_psai_situacoes IN ${SITS_DESC}
      AND COALESCE(p.i_produto_grupo, 1) = 1 AND p.i_responsaveis = ${sgd}
      AND YEAR(sp.CadastroPSAI) = ${ano}
    GROUP BY p.i_responsaveis, MONTH(sp.CadastroPSAI)`;
}

function agruparMes(rows, campoTempo, campoQtd) {
  const por = {};
  rows.forEach(r => {
    const mes = r.MES || r.mes;
    por[mes] = {
      tempo: Number(r[campoTempo] || r[String(campoTempo).toLowerCase()]) || 0,
      qtd: Number(r[campoQtd] || r[String(campoQtd).toLowerCase()]) || 0
    };
  });
  return por;
}

function montarResumo(colab, ativas, descartadas) {
  let tAtv = 0, qAtv = 0, tDesc = 0, qDesc = 0;
  for (let m = 1; m <= 12; m++) {
    tAtv += (ativas[m] && ativas[m].tempo) || 0;
    qAtv += (ativas[m] && ativas[m].qtd) || 0;
    tDesc += (descartadas[m] && descartadas[m].tempo) || 0;
    qDesc += (descartadas[m] && descartadas[m].qtd) || 0;
  }
  return {
    sgd: String(colab['codigo-sgd']), slug: colab.slug,
    apelido: colab.apelido, senioridade: colab.senioridade,
    mensal_ativas: ativas, mensal_descartadas: descartadas,
    total_psais: qAtv, tempo_total_ativas: tAtv,
    media_min: qAtv > 0 ? Math.round(tAtv / qAtv) : 0,
    total_descartadas: qDesc, tempo_total_descartadas: tDesc
  };
}

async function tempoDescarte(slug, ano, tipoSql) {
  const colab = lerColab(slug);
  if (!colab) throw new Error('Colaborador nao encontrado');
  const sgd = colab['codigo-sgd'], tipo = tipoSql || TIPO_SAL, anoBase = ano - 1;
  const exec = qe();
  const [rA, rD, rAB, rDB] = await Promise.all([
    exec.executar(queryTempoAtivas(ano, sgd, tipo)),
    exec.executar(queryTempoDesc(ano, sgd, tipo)),
    exec.executar(queryTempoAtivas(anoBase, sgd, tipo)),
    exec.executar(queryTempoDesc(anoBase, sgd, tipo))
  ]);
  const a = montarResumo(colab, agruparMes(rA, 'TEMPO_TOTAL', 'TOTAL_PSAIS'), agruparMes(rD, 'TEMPO_DESC', 'TOTAL_DESCARTADAS'));
  const b = montarResumo(colab, agruparMes(rAB, 'TEMPO_TOTAL', 'TOTAL_PSAIS'), agruparMes(rDB, 'TEMPO_DESC', 'TOTAL_DESCARTADAS'));
  return { ano, ano_base: anoBase, analistas: [a], baseline: [b] };
}

async function linhasTipo(slug, ano, nivel, tipoSql) {
  const colab = lerColab(slug);
  if (!colab) throw new Error('Colaborador nao encontrado');
  const { decodificarBinario } = require(path.join(ROOT, 'src/core/consultas-ne'));
  const sgd = colab['codigo-sgd'];
  const filtroNivel = nivel ? `AND COALESCE(p.nivel_alteracao, 1) = ${nivel}` : '';
  const sql = `
    SELECT p.i_responsaveis as i_usuarios, sp.i_psai, sp.i_sai,
      COALESCE(p.nivel_alteracao, 1) as nivel, MONTH(sp.CadastroPSAI) as mes,
      COALESCE(pr.tempo_analise, 0) as tempo_analise,
      COALESCE(pr.tempo_definicao, 0) as tempo_definicao,
      CAST(TRIM(COALESCE(sit.descricao, psit.descricao)) AS BINARY(64)) as situacao_nome --allow-blob
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    LEFT JOIN bethadba.psai_responsaveis pr ON pr.i_psai = sp.i_psai AND pr.i_usuarios = p.i_responsaveis
    LEFT JOIN bethadba.sai_situacoes sit ON sp.i_sai_situacoes = sit.i_sai_situacoes AND sit.i_sai_linhas = 1
    LEFT JOIN bethadba.psai_situacoes psit ON sp.i_psai_situacoes = psit.i_situacoes
    WHERE ${AREA_SA} AND ${tipoSql || TIPO_SAL} AND COALESCE(p.i_produto_grupo, 1) = 1
      AND p.i_responsaveis = ${sgd} AND YEAR(sp.CadastroPSAI) = ${ano} ${filtroNivel}
    ORDER BY MONTH(sp.CadastroPSAI), sp.i_psai`;
  return mapearLinhas(await qe().executar(sql), colab, decodificarBinario, true);
}

async function linhasNe(slug, ano, area) {
  const colab = lerColab(slug);
  if (!colab) throw new Error('Colaborador nao encontrado');
  const { decodificarBinario, condAreaNE } = require(path.join(ROOT, 'src/core/consultas-ne'));
  const sgd = colab['codigo-sgd'];
  const areaOk = area === 'Importacao' ? 'Importacao' : 'Escrita';
  const sql = `
    SELECT p.i_responsaveis as i_usuarios, sp.i_psai, sp.i_sai,
      MONTH(sp.CadastroPSAI) as mes,
      COALESCE(pr.tempo_analise, 0) as tempo_analise,
      COALESCE(pr.tempo_definicao, 0) as tempo_definicao,
      CAST(TRIM(COALESCE(sit.descricao, psit.descricao)) AS BINARY(64)) as situacao_nome --allow-blob
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    LEFT JOIN bethadba.psai_responsaveis pr ON pr.i_psai = sp.i_psai AND pr.i_usuarios = p.i_responsaveis
    LEFT JOIN bethadba.sai_situacoes sit ON sp.i_sai_situacoes = sit.i_sai_situacoes AND sit.i_sai_linhas = 1
    LEFT JOIN bethadba.psai_situacoes psit ON sp.i_psai_situacoes = psit.i_situacoes
    WHERE ${condAreaNE(areaOk, 'sp')} AND sp.tipoSAI = 'NE'
      AND COALESCE(p.i_produto_grupo, 1) = 1 AND p.i_responsaveis = ${sgd}
      AND YEAR(sp.CadastroPSAI) = ${ano}
    ORDER BY MONTH(sp.CadastroPSAI), sp.i_psai`;
  return mapearLinhas(await qe().executar(sql), colab, decodificarBinario, false);
}

function mapearLinhas(rows, colab, decodificarBinario, comNivel) {
  const porPsai = new Map();
  rows.forEach(r => {
    const key = r.i_psai, tA = Number(r.tempo_analise) || 0, tD = Number(r.tempo_definicao) || 0;
    const cur = porPsai.get(key);
    if (cur) {
      cur.tempo_analise += tA; cur.tempo_definicao += tD;
      cur.tempo_total = cur.tempo_analise + cur.tempo_definicao;
      return;
    }
    const item = {
      i_usuarios: String(colab['codigo-sgd']), apelido: colab.apelido,
      i_psai: r.i_psai, i_sai: r.i_sai || 0, mes: Number(r.mes) || 0,
      tempo_analise: tA, tempo_definicao: tD, tempo_total: tA + tD,
      situacao: decodificarBinario(r.situacao_nome) || '(sem situação)'
    };
    if (comNivel) {
      const nivel = Number(r.nivel) || 1;
      item.nivel = nivel;
      item.nivel_nome = NIVEL_NOME[nivel] || String(nivel);
    }
    porPsai.set(key, item);
  });
  return [...porPsai.values()];
}

function filtrosSelf(colab) {
  return {
    analistas: [{
      sgd: String(colab['codigo-sgd']), apelido: colab.apelido,
      slug: colab.slug, senioridade: colab.senioridade
    }],
    niveis: Object.entries(NIVEL_NOME).map(([id, nome]) => ({ id: Number(id), nome })),
    areas: [{ id: 'Escrita', nome: 'Escrita' }, { id: 'Importacao', nome: 'Importação' }]
  };
}

module.exports = {
  lerColab, tempoDescarte, linhasTipo, linhasNe, filtrosSelf,
  NIVEL_NOME, TIPO_SAL, TIPO_SAM,
  linhasSal: (slug, ano, nivel) => linhasTipo(slug, ano, nivel, TIPO_SAL)
};
