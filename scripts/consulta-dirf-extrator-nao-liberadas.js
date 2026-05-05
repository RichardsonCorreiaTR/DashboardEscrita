/**
 * consulta-dirf-extrator-nao-liberadas.js
 *
 * Lista NEs de DIRF Extrator que ainda NÃO foram liberadas,
 * com entradas (CadastroPSAI) a partir de janeiro/2026.
 * Uso: node scripts/consulta-dirf-extrator-nao-liberadas.js
 */

const { executar } = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

const SQL_DIRF_NAO_LIBERADAS = `
  SELECT sai_psai.i_psai, sai_psai.i_sai,
         sai_psai.CadastroPSAI as entrada,
         sai_psai.gravidade_ne,
         sai_psai.nomeVersao,
         sai_psai.Liberacao,
         sai_psai.Descarte,
         sai_psai.i_sai_situacoes,
         sit_sai.descricao as situacao_sai,
         CAST(psai.descricao AS BINARY) as descricao --allow-blob
  FROM UP.SAI_PSAI sai_psai
  JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
  LEFT JOIN bethadba.sai_situacoes sit_sai
    ON sai_psai.i_sai_situacoes = sit_sai.i_sai_situacoes
    AND sit_sai.i_sai_linhas = 1
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI = 'NE'
    AND sai_psai.CadastroPSAI >= '2026-01-01'
    AND sai_psai.Liberacao IS NULL
    AND (EXISTS (SELECT 1 FROM bethadba.sai sai
         WHERE sai_psai.i_sai = sai.i_sai
         AND (sai.i_produto_grupo IS NULL OR sai.i_produto_grupo = 1))
      OR sai_psai.i_sai = 0)
    AND (LOWER(psai.descricao) LIKE '%dirf%'
      OR LOWER(psai.descricao) LIKE '%extrator%')
  ORDER BY sai_psai.CadastroPSAI`;

function fd(d) {
  return d ? new Date(d).toLocaleDateString('pt-BR') : '-';
}

function truncar(txt, max) {
  if (!txt) return '-';
  return txt.length > max ? txt.substring(0, max) + '...' : txt;
}

function decodificarBinario(val) {
  if (!val) return '';
  let buf;
  if (val instanceof ArrayBuffer) buf = Buffer.from(val);
  else if (Buffer.isBuffer(val)) buf = val;
  else return String(val);
  let end = buf.length;
  while (end > 0 && buf[end - 1] === 0x00) end--;
  return buf.slice(0, end).toString('latin1');
}

async function main() {
  console.log('=== NEs DIRF/Extrator NAO LIBERADAS - Entrada >= Jan/2026 ===\n');

  const rows = await executar(SQL_DIRF_NAO_LIBERADAS);
  console.log('Total encontrado: %d NE(s)\n', rows.length);

  if (rows.length === 0) {
    console.log('Nenhuma NE de DIRF/Extrator pendente de liberacao encontrada.');
    await conexao.fechar();
    return;
  }

  const dirf = [];
  const extrator = [];

  for (const r of rows) {
    const descricao = decodificarBinario(r.descricao);
    const desc = descricao.toLowerCase();
    
    const item = {
      i_psai: r.i_psai,
      i_sai: r.i_sai,
      entrada: fd(r.entrada),
      descarte: fd(r.Descarte),
      gravidade: r.gravidade_ne,
      versao: r.nomeVersao || 'NAO COMMITADA',
      situacao: r.situacao_sai || '-',
      i_situacao: r.i_sai_situacoes,
      descricao: descricao
    };

    if (desc.includes('dirf')) dirf.push(item);
    if (desc.includes('extrator')) extrator.push(item);
  }

  // Separar por status
  const descartadas = rows.filter(r => r.Descarte != null);
  const alocadas = rows.filter(r => r.Descarte == null && !r.nomeVersao);
  const pendentes = rows.filter(r => r.Descarte == null && r.nomeVersao);

  console.log('=== STATUS DAS NES ===');
  console.log('Descartadas:      %d', descartadas.length);
  console.log('Em Desenvolvimento: %d (alocadas, sem commit)', alocadas.length);
  console.log('Pendentes Lib:    %d (commitadas, aguardando)', pendentes.length);
  console.log('');

  if (dirf.length > 0) {
    console.log('\n--- DIRF (%d NE%s) ---', dirf.length, dirf.length > 1 ? 's' : '');
    for (const ne of dirf) {
      console.log('\n  PSAI: %d | SAI: %d | Gravidade: %s', ne.i_psai, ne.i_sai, ne.gravidade);
      console.log('  Entrada:   %s', ne.entrada);
      console.log('  Versao:    %s (situacao: %s [%s])', ne.versao, ne.situacao, ne.i_situacao);
      if (ne.descarte !== '-') console.log('  Descarte:  %s', ne.descarte);
      console.log('  Descricao: %s', truncar(ne.descricao, 200));
    }
  }

  if (extrator.length > 0) {
    console.log('\n--- EXTRATOR (%d NE%s) ---', extrator.length, extrator.length > 1 ? 's' : '');
    for (const ne of extrator) {
      console.log('\n  PSAI: %d | SAI: %d | Gravidade: %s', ne.i_psai, ne.i_sai, ne.gravidade);
      console.log('  Entrada:   %s', ne.entrada);
      console.log('  Versao:    %s (situacao: %s [%s])', ne.versao, ne.situacao, ne.i_situacao);
      if (ne.descarte !== '-') console.log('  Descarte:  %s', ne.descarte);
      console.log('  Descricao: %s', truncar(ne.descricao, 200));
    }
  }

  const ambas = rows.filter(r => {
    const desc = decodificarBinario(r.descricao).toLowerCase();
    return desc.includes('dirf') && desc.includes('extrator');
  });
  if (ambas.length > 0) {
    console.log('\n--- Mencionam AMBOS (Dirf + Extrator): %d NE(s) ---', ambas.length);
    for (const r of ambas) console.log('  PSAI: %d', r.i_psai);
  }

  console.log('\n=== RESUMO ===');
  console.log('DIRF:     %d NE(s)', dirf.length);
  console.log('Extrator: %d NE(s)', extrator.length);
  console.log('Total:    %d NE(s) unica(s)', rows.length);

  await conexao.fechar();
}

main().catch(err => {
  console.error('Erro:', err);
  conexao.fechar().then(() => process.exit(1));
});
