/**
 * explorar-pbcvs-sinais.js - Descobre sinais extras no PBCVS para previsao NE
 */

const path = require('path');
const fs = require('fs');
const conexao = require('../src/core/conexao');

const SAIDA = path.join(__dirname, '..', 'data', 'cache', 'sinais-pbcvs-extra.json');

function dec(rows) {
  for (const r of rows) for (const k of Object.keys(r))
    if (r[k] instanceof ArrayBuffer) r[k] = Buffer.from(r[k]).toString('latin1').replace(/\0+$/g, '').trim();
  return rows;
}

async function q(conn, sql, label) {
  console.log('[explorar] %s ...', label);
  try {
    const rows = await conn.query(sql);
    dec(rows);
    console.log('[explorar] %s: %d registros', label, rows.length);
    return rows;
  } catch (err) {
    console.warn('[explorar] %s FALHOU: %s', label, err.message);
    return [];
  }
}

async function explorar() {
  await conexao.inicializar();
  const conn = await conexao.obterConexao();

  try {
    const cronograma = await q(conn, `
      SELECT v.nome as nomeVersao,
             c.desenv_inicio, c.desenv_fim, c.teste_inicio, c.teste_fim,
             DATEDIFF(day, c.desenv_inicio, c.desenv_fim) as diasDesenv,
             DATEDIFF(day, c.teste_inicio, c.teste_fim) as diasTeste
      FROM bethadba.versoes_cronogramas c
      JOIN bethadba.versoes v ON c.i_versoes = v.i_versoes AND c.i_sistemas = v.i_sistemas
      WHERE v.nome LIKE '10.%A-%'
      ORDER BY v.nome`, 'Cronograma');

    const alteracoes = await q(conn, `
      SELECT nomeVersao, COUNT(*) as totalAlteracoes,
             COUNT(DISTINCT i_sai) as saisAlteradas
      FROM bethadba.sgd_sai_responsavel_versao_alteracoes
      WHERE nomeVersao LIKE '10.%A-%'
      GROUP BY nomeVersao
      ORDER BY nomeVersao`, 'Alteracoes');

    const metas = await q(conn, `
      SELECT nomeVersao, mes, inicio_versao, fim_versao,
             meta_entrada_ne, meta_saldo_ne
      FROM adriano.meta_versao
      WHERE nomeVersao LIKE '10.%A-%'
      ORDER BY nomeVersao`, 'Metas');

    const retornosDireto = await q(conn, `
      SELECT sp.nomeVersao, COUNT(*) as totalRetornos,
             COUNT(DISTINCT sp.i_psai) as saisComRetorno
      FROM bethadba.sgd_retornos_testes rt
      JOIN UP.SAI_PSAI sp ON rt.i_sai = sp.i_sai
      WHERE sp.nomeArea = 'Escrita'
        AND sp.tipoSAI IN ('SAM', 'SAL', 'SAIL')
      GROUP BY sp.nomeVersao
      ORDER BY sp.nomeVersao`, 'Retornos teste');

    const retornosV2 = await q(conn, `
      SELECT sp.nomeVersao, COUNT(*) as totalRetornos,
             COUNT(DISTINCT sp.i_psai) as saisComRetorno
      FROM bethadba.sgd_sai_retornos sr
      JOIN bethadba.sai_versoes sv ON sr.i_sai = sv.i_sai AND sr.i_versoes = sv.i_versoes
      JOIN bethadba.psai p ON sv.i_psai = p.i_psai
      JOIN UP.SAI_PSAI sp ON sp.i_psai = p.i_psai
      WHERE sp.nomeArea = 'Escrita'
        AND sp.tipoSAI IN ('SAM', 'SAL', 'SAIL')
      GROUP BY sp.nomeVersao
      ORDER BY sp.nomeVersao`, 'Retornos SAI');

    const revisoes = await q(conn, `
      SELECT sp.nomeVersao, COUNT(*) as totalRevisoes
      FROM bethadba.sai_revisoes r
      JOIN bethadba.sai_versoes sv ON r.i_sai = sv.i_sai
      JOIN bethadba.psai p ON sv.i_psai = p.i_psai
      JOIN UP.SAI_PSAI sp ON sp.i_psai = p.i_psai
      WHERE sp.nomeArea = 'Escrita'
      GROUP BY sp.nomeVersao
      ORDER BY sp.nomeVersao`, 'Revisoes');

    const retornos = retornosDireto.length > 0 ? retornosDireto : retornosV2;
    const resultado = { cronograma, alteracoes, metas, retornos, revisoes,
      _meta: { coletadoEm: new Date().toISOString() } };

    fs.writeFileSync(SAIDA, JSON.stringify(resultado, null, 2), 'utf-8');
    console.log('\n=== SALVO em %s ===', SAIDA);
    console.log('Cronograma: %d | Alteracoes: %d | Metas: %d | Retornos: %d | Revisoes: %d',
      cronograma.length, alteracoes.length, metas.length, retornos.length, revisoes.length);

    for (const [nome, arr] of Object.entries({ cronograma, alteracoes, metas, retornos })) {
      if (arr.length > 0) console.log('\n--- %s (amostra) ---\n%s', nome, JSON.stringify(arr.slice(-2), null, 2));
    }
  } finally {
    await conn.close();
    await conexao.fechar();
  }
}

explorar().catch(err => { console.error('[explorar] ERRO:', err.message); process.exit(1); });
