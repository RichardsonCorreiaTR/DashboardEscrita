const qe = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');
const { isAusencia, isTrabalhoSai, isOutrasAtividades } = require('../src/indicadores/equipe/atividades-classifier');

async function main() {
  await conexao.inicializar();
  const felipi_uid = 943; // i-usuarios do Felipi

  console.log('=== Atividades de Felipi em Marco/2026 ===');
  const rows = await qe.executar(`
    SELECT CAST(v.NomeAtividade AS BINARY) as atividade, SUM(v.tempo) as minutos, COUNT(*) as registros
    FROM bethadba.vanalise_registro_atividades v
    WHERE v.i_usuarios = ${felipi_uid}
      AND MONTH(v.dia) = 3 AND YEAR(v.dia) = 2026
    GROUP BY v.NomeAtividade
    ORDER BY minutos DESC
  `);

  let total = 0, ausencia = 0, trabalhoSai = 0, outras = 0;
  rows.forEach(r => {
    const n = String(r.atividade).trim();
    const min = Number(r.minutos);
    total += min;
    const eAus = isAusencia(n);
    const eTrab = isTrabalhoSai(n);
    const eOutras = isOutrasAtividades(n);
    let cat = eAus ? 'AUSENCIA' : (eTrab ? 'TRABALHO_SAI' : (eOutras ? 'OUTRAS' : '???'));
    if (eAus) ausencia += min;
    else if (eTrab) trabalhoSai += min;
    const h = Math.floor(min/60), m = min % 60;
    const label = n.includes('rias') ? ` <-- "rias" detectado` : '';
    console.log(`  [${cat}] "${n}" | ${h}h${m.toString().padStart(2,'0')}${label}`);
  });

  const efetivo = total - ausencia;
  const pct = efetivo > 0 ? Math.round((trabalhoSai / efetivo) * 10000) / 100 : 0;
  console.log('\n=== RESUMO ===');
  console.log(`Total:      ${Math.floor(total/60)}h${total%60}`);
  console.log(`Ausencias:  ${Math.floor(ausencia/60)}h${ausencia%60}`);
  console.log(`Efetivo:    ${Math.floor(efetivo/60)}h${efetivo%60}`);
  console.log(`TrabalhoSai:${Math.floor(trabalhoSai/60)}h${trabalhoSai%60}`);
  console.log(`% calculado: ${pct}%  (exibido: 87.67%)`);

  await conexao.fechar();
}
main().catch(e => console.error(e.message));
