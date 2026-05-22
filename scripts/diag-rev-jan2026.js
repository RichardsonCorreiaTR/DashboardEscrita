const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

async function main() {
  await conexao.inicializar();
  const ANO = 2026, MES = 1;

  // Nova logica: SAIs liberadas (i_sai_situacoes=16) em jan/2026, todas as revisoes
  console.log('=== Nova logica: SAIs liberadas em jan/2026 com revisoes ===');
  const r = await qe.executar(`
    SELECT sp.i_sai, sp.tipoSAI, sp.nomeArea,
      COUNT(DISTINCT CASE WHEN sr.i_motivos IN (1,2) THEN sr.i_revisoes ELSE NULL END) as total_revisoes,
      p.i_responsaveis
    FROM UP.SAI_PSAI sp
    JOIN bethadba.psai p ON sp.i_psai = p.i_psai
    LEFT JOIN bethadba.sai_revisoes sr ON sr.i_sai = sp.i_sai AND sr.i_motivos IN (1, 2)
    WHERE COALESCE(p.i_produto_grupo, 1) = 1
      AND sp.tipoSAI IN ('NE', 'SAL', 'SAIL', 'SAM')
      AND sp.i_sai_situacoes = 16
      AND MONTH(sp.Liberacao) = ${MES} AND YEAR(sp.Liberacao) = ${ANO}
      AND sp.nomeArea = 'Escrita'
    GROUP BY sp.i_sai, sp.tipoSAI, sp.nomeArea, p.i_responsaveis
    ORDER BY total_revisoes DESC, sp.i_sai
  `);
  console.log('Total SAIs liberadas em jan/2026:', r.length);
  r.forEach(row => console.log(`  SAI ${row.i_sai} | ${row.tipoSAI} | resp ${row.i_responsaveis} | revisoes: ${row.total_revisoes}`));

  // SAIs da imagem para verificar
  const saisImagem = [98425, 98653, 98707, 97238, 97716, 97985, 98333, 98383, 98520, 98567, 98843, 99218, 99464];
  console.log('\n=== Verificando SAIs da imagem ===');
  const found = r.filter(row => saisImagem.includes(Number(row.i_sai)));
  const missing = saisImagem.filter(sai => !r.find(row => Number(row.i_sai) === sai));
  console.log('Encontradas na nova logica:', found.map(x => x.i_sai).join(', '));
  console.log('NAO encontradas:', missing.join(', ') || 'nenhuma');

  // Verificar as ausentes - estao liberadas em jan/2026?
  if (missing.length > 0) {
    console.log('\n=== Situacao das SAIs ausentes em SAI_PSAI ===');
    const check = await qe.executar(`
      SELECT sp.i_sai, sp.i_sai_situacoes, sp.Liberacao, sp.tipoSAI, sp.nomeArea, p.i_responsaveis
      FROM UP.SAI_PSAI sp
      JOIN bethadba.psai p ON sp.i_psai = p.i_psai
      WHERE sp.i_sai IN (${missing.join(',')})
    `);
    check.forEach(row => console.log(`  SAI ${row.i_sai} | sit_sai=${row.i_sai_situacoes} | lib=${String(row.Liberacao||'').slice(0,10)} | area=${row.nomeArea} | tipo=${row.tipoSAI}`));
  }

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
