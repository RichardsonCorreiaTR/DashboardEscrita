const { executar } = require('../src/core/query-executor.js');

async function main() {
  // 1. NEs novas esta semana (ultimos 5 dias para cobrir seg-qui)
  const semana = await executar(`
    SELECT p.i_psai, p.i_sai, p.entrada, p.gravidade_ne, p.i_situacoes,
           p.i_modulos, p.nivel_alteracao, CAST(p.descricao AS BINARY) as descricao
    FROM bethadba.psai p
    WHERE p.tipo = 'NE'
      AND p.entrada >= DATEADD(day, -5, CURRENT DATE)
      AND p.i_modulos_sistema = 1
    ORDER BY p.entrada DESC --allow-blob
  `, 'nes-semana');

  console.log('=== NEs NOVAS (ultimos 5 dias) === Total: ' + semana.length);
  for (const r of semana) {
    const desc = String(r.descricao || '').replace(/\r\n/g, ' ').slice(0, 250);
    console.log(r.i_psai + ' | ' + String(r.entrada || '').slice(0, 16) + ' | grav:' + (r.gravidade_ne || '-') + ' | sit:' + (r.i_situacoes || '?') + ' | mod:' + (r.i_modulos || '?') + ' | niv:' + (r.nivel_alteracao || '?'));
    console.log('  ' + desc);
    console.log();
  }

  // 2. NEs semana passada (6-12 dias atras)
  const passada = await executar(`
    SELECT p.i_psai, p.entrada, p.gravidade_ne, p.i_modulos,
           CAST(p.descricao AS BINARY) as descricao
    FROM bethadba.psai p
    WHERE p.tipo = 'NE'
      AND p.entrada >= DATEADD(day, -12, CURRENT DATE)
      AND p.entrada < DATEADD(day, -5, CURRENT DATE)
      AND p.i_modulos_sistema = 1
    ORDER BY p.entrada DESC --allow-blob
  `, 'nes-passada');

  console.log('=== NEs SEMANA PASSADA === Total: ' + passada.length);
  for (const r of passada) {
    console.log(r.i_psai + ' | ' + String(r.entrada || '').slice(0, 10) + ' | grav:' + (r.gravidade_ne || '-') + ' | mod:' + (r.i_modulos || '?'));
    console.log('  ' + String(r.descricao || '').replace(/\r\n/g, ' ').slice(0, 200));
  }

  // 3. Snapshot geral pendentes por situacao (nomes das situacoes)
  const situacoes = await executar(`
    SELECT sit.i_situacoes, TRIM(sit.descricao) as nome, COUNT(*) as qtd
    FROM bethadba.psai p
    JOIN bethadba.psai_situacoes sit ON p.i_situacoes = sit.i_situacoes
    WHERE p.tipo = 'NE'
      AND p.i_modulos_sistema = 1
      AND NOT EXISTS (SELECT 1 FROM bethadba.sai s WHERE s.i_sai = p.i_sai AND s.data_liberacao IS NOT NULL)
      AND p.i_situacoes NOT IN (5, 6, 7)
    GROUP BY sit.i_situacoes, sit.descricao
    ORDER BY qtd DESC
  `, 'nes-por-situacao');

  console.log('\n=== NEs PENDENTES POR SITUACAO ===');
  let total = 0;
  for (const r of situacoes) { console.log('  ' + String(r.nome || '').trim() + ' (' + r.i_situacoes + '): ' + r.qtd); total += r.qtd; }
  console.log('  TOTAL: ' + total);

  // 4. Por gravidade
  const gravidades = await executar(`
    SELECT p.gravidade_ne, COUNT(*) as qtd
    FROM bethadba.psai p
    WHERE p.tipo = 'NE'
      AND p.i_modulos_sistema = 1
      AND p.i_situacoes NOT IN (5, 6, 7)
    GROUP BY p.gravidade_ne
    ORDER BY qtd DESC
  `, 'nes-por-gravidade');

  console.log('\n=== NEs POR GRAVIDADE ===');
  for (const r of gravidades) { console.log('  ' + (r.gravidade_ne || 'null') + ': ' + r.qtd); }

  // 5. Top modulos
  const modulos = await executar(`
    SELECT m.descricao as modulo, COUNT(*) as qtd
    FROM bethadba.psai p
    JOIN bethadba.modulos m ON p.i_modulos = m.i_modulos
    WHERE p.tipo = 'NE'
      AND p.i_modulos_sistema = 1
      AND p.i_situacoes NOT IN (5, 6, 7)
    GROUP BY m.descricao
    ORDER BY qtd DESC
  `, 'nes-por-modulo');

  console.log('\n=== NEs POR MODULO (top) ===');
  for (const r of modulos.slice(0, 15)) { console.log('  ' + String(r.modulo || '').trim() + ': ' + r.qtd); }

  // 6. Ultimas 30 NEs pra ver padroes
  const ultimas = await executar(`
    SELECT TOP 30 p.i_psai, p.entrada, p.gravidade_ne, p.i_modulos,
           CAST(p.descricao AS BINARY) as descricao
    FROM bethadba.psai p
    WHERE p.tipo = 'NE'
      AND p.i_modulos_sistema = 1
    ORDER BY p.entrada DESC --allow-blob
  `, 'nes-ultimas30');

  console.log('\n=== ULTIMAS 30 NEs ===');
  for (const r of ultimas) {
    const desc = String(r.descricao || '').replace(/\r\n/g, ' ').slice(0, 200);
    console.log(r.i_psai + ' | ' + String(r.entrada || '').slice(0, 10) + ' | grav:' + (r.gravidade_ne || '-') + ' | mod:' + (r.i_modulos || '?'));
    console.log('  ' + desc);
  }
}

main().catch(e => console.error(e));
