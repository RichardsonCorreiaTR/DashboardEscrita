/**
 * consulta-arquivo-10-6a-02.js
 *
 * Verifica quais NEs da versao 10.6A-02 foram liberadas em arquivo
 * vs na versao oficial.
 *
 * Uso: node scripts/consulta-arquivo-10-6a-02.js
 */

const { executar } = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

const SQL_VERSAO_REGULAR = `
  SELECT sai_psai.i_psai, sai_psai.i_sai,
         sai_psai.CadastroPSAI as entrada,
         sai_psai.gravidade_ne,
         sai_psai.nomeVersao,
         sai_psai.Liberacao,
         sai_psai.liberacaoOficial
  FROM UP.SAI_PSAI sai_psai
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI = 'NE'
    AND sai_psai.nomeVersao = '10.6A-02'
    AND sai_psai.Liberacao IS NOT NULL
    AND (EXISTS (SELECT 1 FROM bethadba.sai sai
         WHERE sai_psai.i_sai = sai.i_sai
         AND (sai.i_produto_grupo IS NULL OR sai.i_produto_grupo = 1))
      OR sai_psai.i_sai = 0)
  ORDER BY sai_psai.Liberacao`;

const SQL_ARQUIVO = `
  SELECT sai_psai.i_psai, sai_psai.i_sai,
         sai_psai.CadastroPSAI as entrada,
         sai_psai.gravidade_ne,
         sai_psai.nomeVersao,
         sai_psai.Liberacao,
         sai_psai.liberacaoOficial
  FROM UP.SAI_PSAI sai_psai
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI = 'NE'
    AND sai_psai.nomeVersao LIKE '10.6A-01.%'
    AND sai_psai.Liberacao IS NOT NULL
    AND (EXISTS (SELECT 1 FROM bethadba.sai sai
         WHERE sai_psai.i_sai = sai.i_sai
         AND (sai.i_produto_grupo IS NULL OR sai.i_produto_grupo = 1))
      OR sai_psai.i_sai = 0)
  ORDER BY sai_psai.Liberacao`;

function fd(d) {
  return d ? new Date(d).toLocaleDateString('pt-BR') : '-';
}

async function main() {
  console.log('=== NEs 10.6A-02: Versao Regular vs Arquivo ===\n');

  const regular = await executar(SQL_VERSAO_REGULAR);
  console.log('NEs com nomeVersao = "10.6A-02" (versao regular): %d', regular.length);

  console.log('\n  Detalhes:');
  for (const r of regular) {
    console.log('  SAI: %d | PSAI: %d | Entrada: %s | Lib: %s | LibOficial: %s | %s',
      r.i_sai, r.i_psai, fd(r.entrada), fd(r.Liberacao),
      fd(r.liberacaoOficial), r.gravidade_ne);
  }

  const porDataLib = {};
  for (const r of regular) {
    const d = fd(r.Liberacao);
    porDataLib[d] = (porDataLib[d] || 0) + 1;
  }
  console.log('\n  Agrupamento por data de liberacao:');
  for (const [d, q] of Object.entries(porDataLib)) {
    console.log('    %s: %d NE(s)', d, q);
  }

  console.log('\n---');
  const arquivo = await executar(SQL_ARQUIVO);
  console.log('NEs com nomeVersao LIKE "10.6A-01.%%" (arquivo): %d', arquivo.length);

  if (arquivo.length > 0) {
    console.log('\n  Detalhes:');
    for (const r of arquivo) {
      console.log('  SAI: %d | PSAI: %d | Entrada: %s | Lib: %s | LibOficial: %s | Versao: %s | %s',
        r.i_sai, r.i_psai, fd(r.entrada), fd(r.Liberacao),
        fd(r.liberacaoOficial), r.nomeVersao, r.gravidade_ne);
    }

    const porArquivo = {};
    for (const r of arquivo) {
      porArquivo[r.nomeVersao] = (porArquivo[r.nomeVersao] || 0) + 1;
    }
    console.log('\n  Por arquivo:');
    for (const [v, q] of Object.entries(porArquivo).sort()) {
      console.log('    %s: %d NE(s)', v, q);
    }
  }

  console.log('\n=== Resumo ===');
  console.log('Versao regular (10.6A-02): %d NE(s)', regular.length);
  console.log('Arquivo (10.6A-01.XX):     %d NE(s)', arquivo.length);
  console.log('Total:                     %d NE(s)', regular.length + arquivo.length);

  await conexao.fechar();
}

main().catch(err => {
  console.error('Erro:', err);
  conexao.fechar().then(() => process.exit(1));
});
