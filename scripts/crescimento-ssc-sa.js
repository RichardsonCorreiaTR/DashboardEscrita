/**
 * crescimento-ssc-sa.js
 *
 * Gera planilha Excel mostrando SAs da Folha que receberam novas SSCs
 * nos ultimos 90 dias, com heatmap diario. Objetivo: identificar SAs
 * (inclusive antigas) ganhando volume de SSC sem visibilidade.
 *
 * Uso: node scripts/crescimento-ssc-sa.js
 */

const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { executar } = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const DIAS = 90;

function fmt(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR');
}

function fmtDia(d) {
  if (!d) return '-';
  return new Date(d).toISOString().slice(0, 10);
}

function sqlSSCsRecentes() {
  return (
    "SELECT fsp.i_psai, fsp.i_forum_sa," +
    " ssc.i_ssc, ssc.entrada AS ssc_entrada," +
    " ssc.i_ssc_situacoes" +
    " FROM bethadba.forum_sa_psai fsp" +
    " JOIN bethadba.ssc ssc ON ssc.i_forum_sa = fsp.i_forum_sa" +
    " WHERE ssc.entrada >= DATEADD(day, -" + DIAS + ", CURRENT DATE)" +
    "   AND fsp.i_psai IN (" +
    "     SELECT DISTINCT sp.i_psai FROM UP.SAI_PSAI sp" +
    "     WHERE sp.nomeArea = 'Escrita'" +
    "       AND sp.tipoSAI IN ('SAM','SAL','SAIL','NE')" +
    "   )" +
    " ORDER BY fsp.i_forum_sa, ssc.entrada DESC"
  );
}

function sqlDadosSAs(ids) {
  return (
    "SELECT fs.i_controle, fs.entrada," +
    " fs.status, fs.tipo_sa, fs.motivo, fs.assunto" +
    " FROM bethadba.forum_sa fs" +
    " WHERE fs.i_controle IN (" + ids.join(',') + ")"
  );
}

function sqlPSAIInfo(ids) {
  return (
    "SELECT sp.i_psai, sp.i_sai, sp.tipoSAI, sp.CadastroPSAI," +
    " sp.i_sai_situacoes, sp.nomeVersao, sp.gravidade_ne" +
    " FROM UP.SAI_PSAI sp" +
    " WHERE sp.i_psai IN (" + ids.join(',') + ")" +
    "   AND sp.nomeArea = 'Escrita'"
  );
}

function tipoSA(motivo, tipoSa) {
  if (tipoSa === 2) return 'NE';
  if (motivo === 1) return 'SAM';
  if (motivo === 2) return 'SAL';
  if (motivo === 3) return 'SAIL';
  return 'SA';
}

function limpar(s) {
  if (!s) return '';
  return String(s).replace(/\0+$/g, '').trim();
}

async function batchQuery(sqlFn, ids, batch, keyField) {
  const map = new Map();
  for (let i = 0; i < ids.length; i += batch) {
    const lote = ids.slice(i, i + batch);
    console.log('  batch %d-%d de %d...', i + 1, Math.min(i + batch, ids.length), ids.length);
    const rows = await executar(sqlFn(lote));
    for (const r of rows) map.set(r[keyField], r);
  }
  return map;
}

function montarResumo(sscRows, saMap, psaiMap) {
  const porSA = new Map();

  for (const ssc of sscRows) {
    const key = ssc.i_forum_sa;
    if (!porSA.has(key)) {
      const sa = saMap.get(key) || {};
      const psai = psaiMap.get(ssc.i_psai) || {};
      porSA.set(key, {
        i_forum_sa: key,
        assunto: limpar(sa.assunto),
        sa_entrada: sa.entrada,
        tipo: sa.tipo_sa != null ? tipoSA(sa.motivo, sa.tipo_sa) : (psai.tipoSAI || '').trim(),
        i_psai: ssc.i_psai,
        tipoSAI: (psai.tipoSAI || '').trim(),
        i_sai: psai.i_sai || 0,
        cadastroPSAI: psai.CadastroPSAI,
        versao: (psai.nomeVersao || '').trim(),
        gravidade: (psai.gravidade_ne || '').trim(),
        situacao: psai.i_sai_situacoes,
        porDia: {},
        totalSSCs: 0,
        sscs: []
      });
    }
    const entry = porSA.get(key);
    const dia = fmtDia(ssc.ssc_entrada);
    entry.porDia[dia] = (entry.porDia[dia] || 0) + 1;
    entry.totalSSCs++;
    entry.sscs.push({
      i_ssc: ssc.i_ssc, entrada: ssc.ssc_entrada,
      dia, situacao: ssc.i_ssc_situacoes
    });
  }

  return [...porSA.values()].sort((a, b) => b.totalSSCs - a.totalSSCs);
}

function coletarDias(resumo) {
  const s = new Set();
  for (const r of resumo) for (const d of Object.keys(r.porDia)) s.add(d);
  return [...s].sort();
}

async function gerarExcel(resumo, dias) {
  const wb = new ExcelJS.Workbook();

  const ws1 = wb.addWorksheet('Heatmap SSC por SA');
  const fixas = [
    { header: 'Forum SA', key: 'fsa', width: 11 },
    { header: 'PSAI', key: 'psai', width: 9 },
    { header: 'SAI', key: 'sai', width: 9 },
    { header: 'Tipo', key: 'tipo', width: 6 },
    { header: 'Grav.', key: 'grav', width: 8 },
    { header: 'Assunto', key: 'assunto', width: 55 },
    { header: 'SA Criada', key: 'criada', width: 12 },
    { header: 'PSAI Cad.', key: 'cadPsai', width: 12 },
    { header: 'Versao', key: 'versao', width: 11 },
    { header: 'Sit.', key: 'sit', width: 5 },
    { header: 'Total 90d', key: 'total', width: 10 },
    { header: 'Dias', key: 'dias', width: 5 }
  ];
  const colDias = dias.map(d => ({ header: d.slice(5), key: 'd_' + d, width: 7 }));
  ws1.columns = [...fixas, ...colDias];

  for (const r of resumo) {
    const row = {
      fsa: r.i_forum_sa, psai: r.i_psai,
      sai: r.i_sai || '-', tipo: r.tipo,
      grav: r.gravidade || '-',
      assunto: r.assunto || '(sem assunto)',
      criada: fmt(r.sa_entrada), cadPsai: fmt(r.cadastroPSAI),
      versao: r.versao || '-', sit: r.situacao,
      total: r.totalSSCs, dias: Object.keys(r.porDia).length
    };
    for (const d of dias) row['d_' + d] = r.porDia[d] || '';
    ws1.addRow(row);
  }
  estilizar(ws1);
  heatmap(ws1, fixas.length + 1, fixas.length + dias.length);

  const ws2 = wb.addWorksheet('Detalhe SSCs');
  ws2.columns = [
    { header: 'Forum SA', key: 'fsa', width: 11 },
    { header: 'PSAI', key: 'psai', width: 9 },
    { header: 'Assunto', key: 'assunto', width: 50 },
    { header: 'Tipo', key: 'tipo', width: 6 },
    { header: 'SSC', key: 'ssc', width: 11 },
    { header: 'Entrada SSC', key: 'entrada', width: 14 },
    { header: 'Dia', key: 'dia', width: 12 },
    { header: 'Sit SSC', key: 'sit', width: 8 }
  ];
  for (const r of resumo) {
    for (const s of r.sscs) {
      ws2.addRow({
        fsa: r.i_forum_sa, psai: r.i_psai,
        assunto: r.assunto || '-', tipo: r.tipo,
        ssc: s.i_ssc, entrada: fmt(s.entrada),
        dia: s.dia, sit: s.situacao
      });
    }
  }
  estilizar(ws2);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const arq = path.join(OUTPUT_DIR, 'crescimento-ssc-sa.xlsx');
  await wb.xlsx.writeFile(arq);
  return arq;
}

function estilizar(ws) {
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B579A' } };
  h.alignment = { horizontal: 'center', wrapText: true };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function heatmap(ws, ini, fim) {
  ws.eachRow((row, idx) => {
    if (idx === 1) return;
    for (let c = ini; c <= fim; c++) {
      const v = row.getCell(c).value;
      if (v && v > 0) {
        const cor = v >= 5 ? 'FFFF6B6B' : v >= 3 ? 'FFFFA07A' : v >= 2 ? 'FFFFD93D' : 'FFD4EDDA';
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cor } };
        if (v >= 5) row.getCell(c).font = { bold: true };
      }
    }
  });
}

async function main() {
  console.log('=== Crescimento SSC por SA (Folha) - Ultimos %d dias ===', DIAS);
  console.log('Data base: %s\n', fmt(new Date()));

  console.log('[1/3] Buscando SSCs vinculadas a SAs Folha...');
  console.log('  (query pesada, pode levar ~5-7 minutos)');
  const sscRows = await executar(sqlSSCsRecentes());
  console.log('  -> %d SSCs encontradas', sscRows.length);

  const forumSaIds = [...new Set(sscRows.map(r => r.i_forum_sa))];
  const psaiIds = [...new Set(sscRows.map(r => r.i_psai))];

  console.log('[2/3] Buscando dados SAs (%d) e PSAIs (%d)...', forumSaIds.length, psaiIds.length);
  const saMap = await batchQuery(sqlDadosSAs, forumSaIds, 500, 'i_controle');
  console.log('  -> %d SAs com assunto', saMap.size);
  const psaiMap = await batchQuery(sqlPSAIInfo, psaiIds, 500, 'i_psai');
  console.log('  -> %d PSAIs com info', psaiMap.size);

  const resumo = montarResumo(sscRows, saMap, psaiMap);
  const dias = coletarDias(resumo);

  console.log('\n  SAs com SSCs: %d', resumo.length);
  console.log('  Dias com atividade: %d (%s a %s)', dias.length, dias[0], dias[dias.length - 1]);
  console.log('  Total SSCs: %d', sscRows.length);

  console.log('\n  Top 15 SAs com mais SSCs:');
  for (const r of resumo.slice(0, 15)) {
    console.log(
      '    SA %d | PSAI %d | %d SSCs em %d dias | %s',
      r.i_forum_sa, r.i_psai, r.totalSSCs,
      Object.keys(r.porDia).length,
      (r.assunto || '?').substring(0, 50)
    );
  }

  console.log('\n[3/3] Gerando Excel...');
  const arq = await gerarExcel(resumo, dias);
  console.log('  Salvo em: %s', arq);

  await conexao.fechar();
}

main().catch(err => {
  console.error('Erro:', err);
  conexao.fechar().then(() => process.exit(1));
});
