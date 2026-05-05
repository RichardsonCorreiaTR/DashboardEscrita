/**
 * consulta-lib-fev-detalhes.js
 *
 * Analisa TODAS as NEs liberadas em fev/2026:
 * - Quantas entraram em fevereiro vs antes
 * - Quantas foram liberadas em arquivo vs versao regular
 *
 * Uso: node scripts/consulta-lib-fev-detalhes.js
 */

const { executar } = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

const SQL = `
  SELECT sai_psai.i_psai, sai_psai.i_sai,
         sai_psai.CadastroPSAI as entrada,
         sai_psai.gravidade_ne,
         sai_psai.nomeVersao,
         sai_psai.Liberacao
  FROM UP.SAI_PSAI sai_psai
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI = 'NE'
    AND sai_psai.Liberacao >= '2026-02-01'
    AND sai_psai.Liberacao < '2026-03-01'
    AND (EXISTS (SELECT 1 FROM bethadba.sai sai
         WHERE sai_psai.i_sai = sai.i_sai
         AND (sai.i_produto_grupo IS NULL OR sai.i_produto_grupo = 1))
      OR sai_psai.i_sai = 0)
  ORDER BY sai_psai.CadastroPSAI`;

function fd(d) {
  return d ? new Date(d).toLocaleDateString('pt-BR') : '-';
}

function ehArquivo(nomeVersao) {
  if (!nomeVersao) return false;
  return /^\d+\.\d+A-\d+\.\d+/.test(nomeVersao);
}

async function main() {
  console.log('=== Todas NEs Liberadas em Fev/2026 ===\n');

  const rows = await executar(SQL);
  console.log('Total liberadas em fevereiro: %d NE(s)\n', rows.length);

  const entradaFev = rows.filter(r => {
    const d = new Date(r.entrada);
    return d.getFullYear() === 2026 && d.getMonth() === 1;
  });
  const entradaAntes = rows.filter(r => {
    const d = new Date(r.entrada);
    return !(d.getFullYear() === 2026 && d.getMonth() === 1);
  });

  console.log('--- ENTRADA ---');
  console.log('Entraram em fevereiro:       %d (%s%%)',
    entradaFev.length, (entradaFev.length / rows.length * 100).toFixed(1));
  console.log('Entraram antes de fevereiro: %d (%s%%)',
    entradaAntes.length, (entradaAntes.length / rows.length * 100).toFixed(1));

  const porMesEntrada = {};
  for (const r of rows) {
    const d = new Date(r.entrada);
    const chave = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    porMesEntrada[chave] = (porMesEntrada[chave] || 0) + 1;
  }
  console.log('\nDistribuicao por mes de entrada:');
  for (const [mes, qtd] of Object.entries(porMesEntrada).sort()) {
    console.log('  %s: %d NE(s)', mes, qtd);
  }

  const arquivo = rows.filter(r => ehArquivo(r.nomeVersao));
  const versaoRegular = rows.filter(r => r.nomeVersao && !ehArquivo(r.nomeVersao));
  const semVersao = rows.filter(r => !r.nomeVersao);

  console.log('\n--- TIPO DE LIBERACAO ---');
  console.log('Versao regular:  %d (%s%%)',
    versaoRegular.length, (versaoRegular.length / rows.length * 100).toFixed(1));
  console.log('Arquivo (patch): %d (%s%%)',
    arquivo.length, (arquivo.length / rows.length * 100).toFixed(1));
  if (semVersao.length > 0) {
    console.log('Sem versao:      %d', semVersao.length);
  }

  const porVersao = {};
  for (const r of rows) {
    const v = r.nomeVersao || '(sem versao)';
    porVersao[v] = (porVersao[v] || 0) + 1;
  }
  console.log('\nDistribuicao por versao:');
  const versoes = Object.entries(porVersao).sort((a, b) => b[1] - a[1]);
  for (const [v, qtd] of versoes) {
    const tipo = ehArquivo(v) ? ' [ARQUIVO]' : '';
    console.log('  %s: %d NE(s)%s', v, qtd, tipo);
  }

  if (arquivo.length > 0) {
    console.log('\n--- DETALHES: NEs LIBERADAS EM ARQUIVO ---');
    for (const r of arquivo) {
      console.log('  PSAI: %d | SAI: %d | Entrada: %s | Lib: %s | Versao: %s | %s',
        r.i_psai, r.i_sai, fd(r.entrada), fd(r.Liberacao),
        r.nomeVersao, r.gravidade_ne);
    }
  }

  console.log('\n--- DETALHES: NEs QUE ENTRARAM EM FEVEREIRO ---');
  for (const r of entradaFev) {
    const tipo = ehArquivo(r.nomeVersao) ? '[ARQ]' : '[VER]';
    console.log('  %s PSAI: %d | SAI: %d | Entrada: %s | Lib: %s | Versao: %s | %s',
      tipo, r.i_psai, r.i_sai, fd(r.entrada), fd(r.Liberacao),
      r.nomeVersao || '-', r.gravidade_ne);
  }

  console.log('\n--- DETALHES: NEs QUE ENTRARAM ANTES DE FEVEREIRO ---');
  for (const r of entradaAntes) {
    const tipo = ehArquivo(r.nomeVersao) ? '[ARQ]' : '[VER]';
    console.log('  %s PSAI: %d | SAI: %d | Entrada: %s | Lib: %s | Versao: %s | %s',
      tipo, r.i_psai, r.i_sai, fd(r.entrada), fd(r.Liberacao),
      r.nomeVersao || '-', r.gravidade_ne);
  }

  await conexao.fechar();
}

main().catch(err => {
  console.error('Erro:', err);
  conexao.fechar().then(() => process.exit(1));
});
