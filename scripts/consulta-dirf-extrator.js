/**
 * consulta-dirf-extrator.js
 *
 * Lista NEs liberadas em fevereiro/2026 referentes a Dirf ou extrator.
 * Uso: node scripts/consulta-dirf-extrator.js
 */

const { executar } = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

const SQL_DIRF_EXTRATOR = `
  SELECT sai_psai.i_psai, sai_psai.i_sai,
         sai_psai.CadastroPSAI as entrada,
         sai_psai.gravidade_ne,
         sai_psai.nomeVersao,
         sai_psai.Liberacao,
         CAST(psai.descricao AS BINARY) as descricao --allow-blob
  FROM UP.SAI_PSAI sai_psai
  JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI = 'NE'
    AND sai_psai.Liberacao >= '2026-02-01'
    AND sai_psai.Liberacao < '2026-03-01'
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

async function main() {
  console.log('=== NEs Liberadas em Fev/2026 - Dirf ou Extrator ===\n');

  const rows = await executar(SQL_DIRF_EXTRATOR);
  console.log('Total encontrado: %d NE(s)\n', rows.length);

  if (rows.length === 0) {
    console.log('Nenhuma NE liberada em fevereiro com "dirf" ou "extrator" na descricao.');
    await conexao.fechar();
    return;
  }

  const dirf = [];
  const extrator = [];

  for (const r of rows) {
    const desc = (r.descricao || '').toLowerCase();
    const item = {
      i_psai: r.i_psai,
      i_sai: r.i_sai,
      entrada: fd(r.entrada),
      liberacao: fd(r.Liberacao),
      gravidade: r.gravidade_ne,
      versao: r.nomeVersao || '-',
      descricao: r.descricao
    };

    if (desc.includes('dirf')) dirf.push(item);
    if (desc.includes('extrator')) extrator.push(item);
  }

  if (dirf.length > 0) {
    console.log('--- DIRF (%d NE%s) ---', dirf.length, dirf.length > 1 ? 's' : '');
    for (const ne of dirf) {
      console.log('\n  PSAI: %d | SAI: %d | Gravidade: %s', ne.i_psai, ne.i_sai, ne.gravidade);
      console.log('  Entrada:   %s', ne.entrada);
      console.log('  Liberacao: %s (versao %s)', ne.liberacao, ne.versao);
      console.log('  Descricao: %s', truncar(ne.descricao, 200));
    }
  }

  if (extrator.length > 0) {
    console.log('\n--- EXTRATOR (%d NE%s) ---', extrator.length, extrator.length > 1 ? 's' : '');
    for (const ne of extrator) {
      console.log('\n  PSAI: %d | SAI: %d | Gravidade: %s', ne.i_psai, ne.i_sai, ne.gravidade);
      console.log('  Entrada:   %s', ne.entrada);
      console.log('  Liberacao: %s (versao %s)', ne.liberacao, ne.versao);
      console.log('  Descricao: %s', truncar(ne.descricao, 200));
    }
  }

  const ambas = rows.filter(r => {
    const d = (r.descricao || '').toLowerCase();
    return d.includes('dirf') && d.includes('extrator');
  });
  if (ambas.length > 0) {
    console.log('\n--- Mencionam AMBOS (Dirf + Extrator): %d NE(s) ---', ambas.length);
    for (const r of ambas) console.log('  PSAI: %d', r.i_psai);
  }

  console.log('\n=== Resumo ===');
  console.log('Dirf:     %d NE(s)', dirf.length);
  console.log('Extrator: %d NE(s)', extrator.length);
  console.log('Total:    %d NE(s) unica(s)', rows.length);

  await conexao.fechar();
}

main().catch(err => {
  console.error('Erro:', err);
  conexao.fechar().then(() => process.exit(1));
});
