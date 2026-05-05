/**
 * analise-dirf-extrator-detalhada.js
 *
 * Analisa NEs de DIRF Extrator com entradas >= jan/2026:
 * 1. PSAIs sem SAI (i_sai = 0)
 * 2. SAIs não alocadas em versão (i_versoes IS NULL ou vazio)
 *
 * Uso: node scripts/analise-dirf-extrator-detalhada.js
 */

const { executar } = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

// PSAIs de DIRF/Extrator sem SAI criada
const SQL_PSAIS_SEM_SAI = `
  SELECT sai_psai.i_psai,
         sai_psai.CadastroPSAI as entrada,
         sai_psai.gravidade_ne,
         sai_psai.Descarte,
         sai_psai.i_psai_situacoes,
         psai_sit.descricao as situacao_psai,
         CAST(psai.descricao AS BINARY) as descricao --allow-blob
  FROM UP.SAI_PSAI sai_psai
  JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
  LEFT JOIN bethadba.psai_situacoes psai_sit
    ON sai_psai.i_psai_situacoes = psai_sit.i_situacoes
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI = 'NE'
    AND sai_psai.CadastroPSAI >= '2026-01-01'
    AND sai_psai.i_sai = 0
    AND sai_psai.Liberacao IS NULL
    AND (LOWER(psai.descricao) LIKE '%dirf%'
      OR LOWER(psai.descricao) LIKE '%extrator%')
  ORDER BY sai_psai.CadastroPSAI`;

// SAIs de DIRF/Extrator não alocadas em versão
const SQL_SAIS_SEM_VERSAO = `
  SELECT sai_psai.i_psai, sai_psai.i_sai,
         sai_psai.CadastroPSAI as entrada,
         sai_psai.gravidade_ne,
         sai_psai.i_versoes,
         sai_psai.nomeVersao,
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
    AND sai_psai.i_sai > 0
    AND sai_psai.Liberacao IS NULL
    AND (sai_psai.i_versoes IS NULL OR sai_psai.i_versoes = 0)
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
  console.log('=== ANALISE DETALHADA: DIRF/Extrator (Entrada >= Jan/2026) ===\n');

  // 1. PSAIs sem SAI
  console.log('1️⃣  BUSCANDO PSAIs SEM SAI (i_sai = 0)...\n');
  const psaisSemSai = await executar(SQL_PSAIS_SEM_SAI);
  
  const psaisAtivos = psaisSemSai.filter(p => !p.Descarte);
  const psaisDescartados = psaisSemSai.filter(p => p.Descarte);

  console.log('Total PSAIs sem SAI: %d', psaisSemSai.length);
  console.log('  - Ativos (não descartados): %d', psaisAtivos.length);
  console.log('  - Descartados: %d', psaisDescartados.length);

  if (psaisAtivos.length > 0) {
    console.log('\n--- PSAIs ATIVOS SEM SAI ---');
    for (const p of psaisAtivos) {
      const desc = decodificarBinario(p.descricao);
      console.log('\n  PSAI: %d | Entrada: %s | Gravidade: %s',
        p.i_psai, fd(p.entrada), p.gravidade_ne);
      console.log('  Situacao: %s [%s]', p.situacao_psai || '-', p.i_psai_situacoes || 0);
      console.log('  Descricao: %s', truncar(desc, 180));
    }
  }

  if (psaisDescartados.length > 0) {
    console.log('\n--- PSAIs DESCARTADOS (sem SAI) ---');
    for (const p of psaisDescartados) {
      console.log('  PSAI: %d | Entrada: %s | Descarte: %s',
        p.i_psai, fd(p.entrada), fd(p.Descarte));
    }
  }

  // 2. SAIs sem alocação de versão
  console.log('\n\n2️⃣  BUSCANDO SAIs SEM ALOCACAO DE VERSAO (i_versoes IS NULL/0)...\n');
  const saisSemVersao = await executar(SQL_SAIS_SEM_VERSAO);

  const saisAtivas = saisSemVersao.filter(s => !s.Descarte);
  const saisDescartadas = saisSemVersao.filter(s => s.Descarte);

  console.log('Total SAIs sem versao: %d', saisSemVersao.length);
  console.log('  - Ativas (não descartadas): %d', saisAtivas.length);
  console.log('  - Descartadas: %d', saisDescartadas.length);

  if (saisAtivas.length > 0) {
    console.log('\n--- SAIs ATIVAS SEM VERSAO ALOCADA ---');
    for (const s of saisAtivas) {
      const desc = decodificarBinario(s.descricao);
      console.log('\n  PSAI: %d | SAI: %d | Entrada: %s | Gravidade: %s',
        s.i_psai, s.i_sai, fd(s.entrada), s.gravidade_ne);
      console.log('  i_versoes: %s | nomeVersao: %s', 
        s.i_versoes || 'NULL', s.nomeVersao || 'NULL');
      console.log('  Situacao: %s [%s]', s.situacao_sai || '-', s.i_sai_situacoes || 0);
      console.log('  Descricao: %s', truncar(desc, 180));
    }
  }

  if (saisDescartadas.length > 0) {
    console.log('\n--- SAIs DESCARTADAS (sem versao) ---');
    for (const s of saisDescartadas) {
      console.log('  PSAI: %d | SAI: %d | Entrada: %s | Descarte: %s',
        s.i_psai, s.i_sai, fd(s.entrada), fd(s.Descarte));
    }
  }

  // Resumo final
  console.log('\n\n=== RESUMO EXECUTIVO ===');
  console.log('\n📋 PSAIs sem SAI criada:');
  console.log('   - Ativos pendentes: %d', psaisAtivos.length);
  console.log('   - Descartados: %d', psaisDescartados.length);
  
  console.log('\n📦 SAIs criadas mas sem versão alocada:');
  console.log('   - Ativas pendentes: %d', saisAtivas.length);
  console.log('   - Descartadas: %d', saisDescartadas.length);

  console.log('\n💡 TOTAL PENDENTE DE ACAO: %d', 
    psaisAtivos.length + saisAtivas.length);

  await conexao.fechar();
}

main().catch(err => {
  console.error('Erro:', err);
  conexao.fechar().then(() => process.exit(1));
});
