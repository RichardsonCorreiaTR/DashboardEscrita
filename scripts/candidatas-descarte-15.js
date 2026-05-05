/**
 * candidatas-descarte-15.js
 *
 * Identifica 15 NEs candidatas a descarte com criterios:
 * - Cadastro >= 1 ano
 * - 5 SSCs ou menos vinculadas
 * - Ultima vinculacao SSC > 1 ano (ou sem SSC)
 * - Provavelmente especifica demais (poucos clientes, descricao restrita)
 *
 * Uso: node scripts/candidatas-descarte-15.js
 */

const { executar } = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

const LIMITE = '2025-03-21';

const SQL_NES_VELHAS = `
  SELECT sai_psai.i_psai, sai_psai.i_sai,
         sai_psai.CadastroPSAI as entrada,
         sai_psai.gravidade_ne,
         sai_psai.nomeVersao,
         sai_psai.i_sai_situacoes,
         sai_psai.i_versoes,
         DATEDIFF(day, sai_psai.CadastroPSAI, CURRENT DATE) as idade_dias,
         CAST(psai.descricao AS BINARY) as descricao --allow-blob
  FROM UP.SAI_PSAI sai_psai
  JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI = 'NE'
    AND sai_psai.CadastroPSAI < '${LIMITE}'
    AND sai_psai.Liberacao IS NULL
    AND sai_psai.Descarte IS NULL
    AND COALESCE(psai.i_produto_grupo, 1) = 1
  ORDER BY sai_psai.CadastroPSAI`;

function fd(d) {
  return d ? new Date(d).toLocaleDateString('pt-BR') : '-';
}

function decodificar(val) {
  if (!val) return '';
  let buf;
  if (val instanceof ArrayBuffer) buf = Buffer.from(val);
  else if (Buffer.isBuffer(val)) buf = val;
  else return String(val);
  let end = buf.length;
  while (end > 0 && buf[end - 1] === 0x00) end--;
  return buf.slice(0, end).toString('latin1');
}

function truncar(txt, max) {
  if (!txt) return '-';
  return txt.length > max ? txt.substring(0, max) + '...' : txt;
}

async function buscarSSCDetalhes(psaiIds) {
  const resultado = {};
  const BATCH = 40;

  for (let i = 0; i < psaiIds.length; i += BATCH) {
    const batch = psaiIds.slice(i, i + BATCH);
    const rows = await executar(`
      SELECT fsp.i_psai,
             COUNT(DISTINCT ssc.i_ssc) as total_ssc,
             COUNT(DISTINCT ssc.i_clientes) as total_clientes,
             MAX(ssc.entrada) as ultima_ssc
      FROM bethadba.forum_sa_psai fsp
      JOIN bethadba.ssc ssc ON fsp.i_forum_sa = ssc.i_forum_sa
      WHERE fsp.i_psai IN (${batch.join(',')})
      GROUP BY fsp.i_psai`);

    for (const r of rows) {
      resultado[r.i_psai] = {
        totalSSC: r.total_ssc,
        totalClientes: r.total_clientes,
        ultimaSSC: r.ultima_ssc
      };
    }

    const pct = Math.floor(((i + BATCH) / psaiIds.length) * 100);
    process.stdout.write(
      `  [SSC] ${Math.min(pct, 100)}% processado...\r`
    );
  }
  console.log('');
  return resultado;
}

/**
 * Pontua especificidade: quanto maior, mais especifica/restrita a NE.
 * Fatores: poucos clientes, poucos SSCs, muita idade, sem versao alocada.
 */
function pontuar(ne) {
  let score = 0;

  if (ne.totalSSC === 0) score += 50;
  else if (ne.totalSSC <= 2) score += 35;
  else if (ne.totalSSC <= 5) score += 20;

  if (ne.totalClientes === 0) score += 30;
  else if (ne.totalClientes === 1) score += 25;
  else if (ne.totalClientes <= 3) score += 15;

  if (ne.idade_dias > 1095) score += 20;
  else if (ne.idade_dias > 730) score += 15;
  else if (ne.idade_dias > 365) score += 10;

  if (!ne.versao && !ne.i_versoes) score += 15;

  if (ne.gravidade === 'Normal') score += 5;

  return score;
}

async function main() {
  console.log('='.repeat(70));
  console.log('  15 NEs CANDIDATAS A DESCARTE - ANALISE DE ESPECIFICIDADE');
  console.log('  Criterios: >=1 ano, <=5 SSCs, ultima SSC >1 ano');
  console.log('='.repeat(70));
  console.log('');

  console.log('Buscando NEs com entrada anterior a %s...', LIMITE);
  const nesVelhas = await executar(SQL_NES_VELHAS);
  console.log('NEs abertas com >= 1 ano: %d\n', nesVelhas.length);

  if (nesVelhas.length === 0) {
    console.log('Nenhuma NE encontrada.');
    await conexao.fechar();
    return;
  }

  console.log('Buscando SSCs e clientes vinculados...');
  const psaiIds = nesVelhas.map(r => r.i_psai);
  const sscMap = await buscarSSCDetalhes(psaiIds);

  const limiteData = new Date(LIMITE);
  const candidatas = [];

  for (const ne of nesVelhas) {
    const ssc = sscMap[ne.i_psai];
    const totalSSC = ssc ? ssc.totalSSC : 0;
    const totalClientes = ssc ? ssc.totalClientes : 0;
    const ultimaSSC = ssc ? ssc.ultimaSSC : null;

    if (totalClientes >= 8) continue;

    if (ultimaSSC && new Date(ultimaSSC) >= limiteData) continue;

    candidatas.push({
      i_psai: ne.i_psai,
      i_sai: ne.i_sai,
      entrada: ne.entrada,
      idade_dias: ne.idade_dias,
      gravidade: ne.gravidade_ne,
      versao: ne.nomeVersao || null,
      i_versoes: ne.i_versoes,
      totalSSC,
      totalClientes,
      ultimaSSC,
      descricao: decodificar(ne.descricao)
    });
  }

  for (const c of candidatas) {
    c.score = pontuar(c);
  }

  candidatas.sort((a, b) => {
    if (b.idade_dias !== a.idade_dias) return b.idade_dias - a.idade_dias;
    return a.totalClientes - b.totalClientes;
  });

  const top15 = candidatas.slice(0, 15);

  console.log('\nTotal que atende aos criterios: %d', candidatas.length);
  console.log('Exibindo as 15 mais provaveis para descarte:\n');
  console.log('='.repeat(70));

  for (let idx = 0; idx < top15.length; idx++) {
    const ne = top15[idx];
    const sscInfo = ne.totalSSC > 0
      ? `${ne.totalSSC} SSC(s), ${ne.totalClientes} cliente(s), ultima: ${fd(ne.ultimaSSC)}`
      : 'NENHUMA SSC vinculada';
    const versaoInfo = ne.versao
      ? `Commitada: ${ne.versao}`
      : ne.i_versoes
        ? `Alocada (i_versoes=${ne.i_versoes})`
        : 'Nao alocada';
    const anos = (ne.idade_dias / 365).toFixed(1);

    console.log(
      '\n  %d) PSAI: %d | SAI: %d | Score: %d/120',
      idx + 1, ne.i_psai, ne.i_sai, ne.score
    );
    console.log(
      '     Idade: %d dias (~%s anos) | Gravidade: %s',
      ne.idade_dias, anos, ne.gravidade
    );
    console.log('     Entrada: %s | Versao: %s', fd(ne.entrada), versaoInfo);
    console.log('     SSC: %s', sscInfo);
    console.log('     Descricao: %s', truncar(ne.descricao, 200));
  }

  console.log('\n' + '='.repeat(70));
  console.log('RESUMO DAS 15 SELECIONADAS:');
  console.log('-'.repeat(70));
  console.log(
    '%-4s %-8s %-8s %-6s %-5s %-4s %-4s %-8s %s',
    '#', 'PSAI', 'SAI', 'Dias', 'Grav', 'SSC', 'Cli', 'Ult.SSC', 'Descricao'
  );
  console.log('-'.repeat(70));

  for (let idx = 0; idx < top15.length; idx++) {
    const ne = top15[idx];
    console.log(
      '%-4d %-8d %-8d %-6d %-5s %-4d %-4d %-8s %s',
      idx + 1,
      ne.i_psai,
      ne.i_sai,
      ne.idade_dias,
      ne.gravidade.substring(0, 5),
      ne.totalSSC,
      ne.totalClientes,
      ne.ultimaSSC ? fd(ne.ultimaSSC) : '-',
      truncar(ne.descricao, 50)
    );
  }

  console.log('\n' + '='.repeat(70));
  console.log('Legenda:');
  console.log('  Score: quanto maior, mais provavel que seja especifica demais');
  console.log('  SSC=0 + sem alocacao + muita idade = melhor candidata');
  console.log('  Avalie a descricao para confirmar especificidade');
  console.log('='.repeat(70));

  await conexao.fechar();
}

main().catch(err => {
  console.error('Erro:', err);
  conexao.fechar().then(() => process.exit(1));
});
