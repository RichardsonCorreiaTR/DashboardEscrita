/**
 * sais-ne-pos-versao.js
 *
 * Lista SAIs NE trabalhadas durante a versao 10.6A-02 por desenvolvimento,
 * que foram liberadas somente em arquivo posterior ou continuam pendentes.
 *
 * Logica: NEs Folha commitadas na 10.6A-03 (proxima versao), ou com versao
 * vazia/nula liberadas apos o fim da 10.6A-02. Inclui liberadas (arquivo)
 * e pendentes.
 *
 * Uso: node scripts/sais-ne-pos-versao.js
 */

const path = require('path');
const fs = require('fs');
const { executar } = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');
const versao = require('../src/core/versao');

const VERSAO = '10.6A-02';
const PROXIMA = '10.6A-03';
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

function fmt(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR');
}

function pad(s, n) { return String(s).padEnd(n); }

function sqlLiberadasArquivoPosVersao() {
  const fim = versao.sqlFimVersao(VERSAO);
  const fimProx = versao.sqlFimVersao(PROXIMA);
  return (
    "SELECT sp.i_sai, sp.i_psai, sp.gravidade_ne, sp.nomeVersao," +
    " sp.Liberacao, sp.CadastroSAI, sp.CadastroPSAI," +
    " MAX(rd.data_conclusao) as dev_conclusao_ultima," +
    " SUM(CASE WHEN rd.data_conclusao IS NOT NULL THEN rd.tempo_realizado ELSE 0 END) as dev_realizado," +
    " SUM(rd.tempo_previsto) as dev_previsto" +
    " FROM UP.SAI_PSAI sp" +
    " JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai" +
    " LEFT JOIN bethadba.sai_roteiro_desenvolvimento rd" +
    "   ON rd.i_sai = sp.i_sai AND rd.data_exclusao IS NULL" +
    " WHERE sp.nomeArea = 'Escrita'" +
    "   AND sp.tipoSAI = 'NE'" +
    "   AND sp.Liberacao > " + fim +
    "   AND sp.Liberacao <= " + fimProx +
    "   AND COALESCE(psai.i_produto_grupo, 1) = 1" +
    "   AND sp.i_sai > 0" +
    " GROUP BY sp.i_sai, sp.i_psai, sp.gravidade_ne, sp.nomeVersao," +
    "   sp.Liberacao, sp.CadastroSAI, sp.CadastroPSAI" +
    " ORDER BY sp.Liberacao, sp.i_sai"
  );
}

function sqlPendentesProximaVersao() {
  return (
    "SELECT sp.i_sai, sp.i_psai, sp.gravidade_ne, sp.nomeVersao," +
    " sp.Liberacao, sp.CadastroSAI, sp.CadastroPSAI," +
    " MAX(rd.data_conclusao) as dev_conclusao_ultima," +
    " SUM(CASE WHEN rd.data_conclusao IS NOT NULL THEN rd.tempo_realizado ELSE 0 END) as dev_realizado," +
    " SUM(rd.tempo_previsto) as dev_previsto" +
    " FROM UP.SAI_PSAI sp" +
    " JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai" +
    " LEFT JOIN bethadba.sai_roteiro_desenvolvimento rd" +
    "   ON rd.i_sai = sp.i_sai AND rd.data_exclusao IS NULL" +
    " WHERE sp.nomeArea = 'Escrita'" +
    "   AND sp.tipoSAI = 'NE'" +
    "   AND sp.nomeVersao = '" + PROXIMA + "'" +
    "   AND sp.Liberacao IS NULL" +
    "   AND sp.Descarte IS NULL" +
    "   AND COALESCE(psai.i_produto_grupo, 1) = 1" +
    "   AND sp.i_sai > 0" +
    " GROUP BY sp.i_sai, sp.i_psai, sp.gravidade_ne, sp.nomeVersao," +
    "   sp.Liberacao, sp.CadastroSAI, sp.CadastroPSAI" +
    " ORDER BY sp.CadastroSAI"
  );
}

function imprimirLinha(cols) {
  console.log('  ' + cols.map(c => pad(c[0], c[1])).join(' | '));
}

async function main() {
  console.log('=== SAIs NE trabalhadas na %s - Arquivo ou Pendentes ===\n', VERSAO);

  const [datas] = await executar(
    "SELECT PIAZZA.FG_GET_DATA_INICIO_VERSAO('" + VERSAO + "', 1) as inicio," +
    " PIAZZA.FG_GET_DATA_FIM_VERSAO('" + VERSAO + "', 1) as fim"
  );
  console.log('Periodo %s: %s a %s\n', VERSAO, fmt(datas.inicio), fmt(datas.fim));

  const liberadas = await executar(sqlLiberadasArquivoPosVersao());
  console.log('Liberadas em arquivo pos-versao: %d NEs', liberadas.length);

  const pendentes = await executar(sqlPendentesProximaVersao());
  console.log('Pendentes na %s: %d NEs\n', PROXIMA, pendentes.length);

  const rows = [...liberadas, ...pendentes];

  const W = [['SAI', 8], ['PSAI', 8], ['Grav.', 8], ['Entrada SAI', 12],
             ['Dev Concl.', 12], ['Liberacao', 12], ['Versao', 12], ['Dev(min)', 8]];

  console.log('='.repeat(105));
  console.log('LIBERADAS EM ARQUIVO POSTERIOR (%d NEs)', liberadas.length);
  console.log('='.repeat(105));
  imprimirLinha(W);
  console.log('  ' + '-'.repeat(101));
  for (const r of liberadas) {
    imprimirLinha([
      [r.i_sai, 8], [r.i_psai, 8], [r.gravidade_ne || '-', 8],
      [fmt(r.CadastroSAI), 12], [fmt(r.dev_conclusao_ultima), 12],
      [fmt(r.Liberacao), 12], [(r.nomeVersao || '').trim() || '(vazio)', 12],
      [r.dev_realizado || 0, 8]
    ]);
  }

  const W2 = [['SAI', 8], ['PSAI', 8], ['Grav.', 8], ['Entrada SAI', 12],
              ['Dev Concl.', 12], ['Versao', 12], ['Prev(min)', 9], ['Real(min)', 9]];

  console.log('\n' + '='.repeat(105));
  console.log('PENDENTES - AINDA EM TRABALHO (%d NEs)', pendentes.length);
  console.log('='.repeat(105));
  imprimirLinha(W2);
  console.log('  ' + '-'.repeat(101));
  for (const r of pendentes) {
    imprimirLinha([
      [r.i_sai, 8], [r.i_psai, 8], [r.gravidade_ne || '-', 8],
      [fmt(r.CadastroSAI), 12], [fmt(r.dev_conclusao_ultima), 12],
      [(r.nomeVersao || '').trim() || '(vazio)', 12],
      [r.dev_previsto || 0, 9], [r.dev_realizado || 0, 9]
    ]);
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESUMO');
  console.log('='.repeat(80));
  console.log('  Liberadas em arquivo posterior:  %d NEs', liberadas.length);
  console.log('  Pendentes (em trabalho):         %d NEs', pendentes.length);
  console.log('  TOTAL:                           %d NEs', rows.length);

  const porGrav = {};
  for (const r of rows) {
    const g = r.gravidade_ne || 'N/I';
    porGrav[g] = (porGrav[g] || 0) + 1;
  }
  console.log('\n  Por gravidade:');
  for (const [g, n] of Object.entries(porGrav).sort((a, b) => b[1] - a[1])) {
    console.log('    %s: %d', g, n);
  }

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const resultado = {
    versao: VERSAO,
    periodoVersao: { inicio: datas.inicio, fim: datas.fim },
    geradoEm: new Date().toISOString(),
    liberadasArquivo: liberadas.map(r => ({
      i_sai: r.i_sai, i_psai: r.i_psai,
      gravidade: r.gravidade_ne,
      entradaSAI: r.CadastroSAI,
      devConclusao: r.dev_conclusao_ultima,
      liberacao: r.Liberacao,
      versao: (r.nomeVersao || '').trim(),
      devRealizadoMin: r.dev_realizado || 0
    })),
    pendentes: pendentes.map(r => ({
      i_sai: r.i_sai, i_psai: r.i_psai,
      gravidade: r.gravidade_ne,
      entradaSAI: r.CadastroSAI,
      devConclusao: r.dev_conclusao_ultima,
      versao: (r.nomeVersao || '').trim(),
      devPrevistoMin: r.dev_previsto || 0,
      devRealizadoMin: r.dev_realizado || 0
    })),
    resumo: {
      liberadasArquivo: liberadas.length,
      pendentes: pendentes.length,
      total: rows.length,
      porGravidade: porGrav
    }
  };

  const arqSaida = path.join(OUTPUT_DIR, 'sais-ne-pos-versao.json');
  fs.writeFileSync(arqSaida, JSON.stringify(resultado, null, 2));
  console.log('\nJSON salvo em: %s', arqSaida);

  await conexao.fechar();
}

main().catch(err => {
  console.error('Erro:', err);
  conexao.fechar().then(() => process.exit(1));
});
