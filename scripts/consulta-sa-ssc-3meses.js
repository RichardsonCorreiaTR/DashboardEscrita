/**
 * consulta-sa-ssc-3meses.js
 *
 * Lista SAs (SAM/SAL/SAIL) da Folha que entraram nos ultimos 3 meses,
 * com SSCs vinculadas a cada uma.
 *
 * Nota: campo descricao (psai/sai) indisponivel via ODBC no momento
 * (driver falha em campos varchar longos). Listagem usa i_psai/i_sai como ID.
 * Quando o ODBC voltar a funcionar com descricao, ativar flag DESC_HABILITADA.
 *
 * Uso: node scripts/consulta-sa-ssc-3meses.js
 */

const path = require('path');
const fs = require('fs');
const { executar } = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const DESC_HABILITADA = false;

function fmt(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR');
}

function pad(s, n) { return String(s).padEnd(n); }

function sqlSAsRecentes() {
  let desc = '';
  if (DESC_HABILITADA) {
    desc = ", CAST(SUBSTRING(psai.descricao, 1, 200) AS BINARY) AS descricao_psai --allow-blob";
  }
  return (
    "SELECT sp.i_sai, sp.i_psai, sp.tipoSAI," +
    " sp.CadastroSAI, sp.CadastroPSAI," +
    " sp.i_sai_situacoes, sp.nomeVersao, sp.Liberacao," +
    " sp.gravidade_ne, sp.nomeArea" +
    desc +
    " FROM UP.SAI_PSAI sp" +
    " JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai" +
    " WHERE sp.nomeArea = 'Escrita'" +
    "   AND sp.tipoSAI IN ('SAM', 'SAL', 'SAIL')" +
    "   AND sp.CadastroPSAI >= DATEADD(month, -3, CURRENT DATE)" +
    "   AND COALESCE(psai.i_produto_grupo, 1) = 1" +
    " ORDER BY sp.CadastroPSAI DESC"
  );
}

function sqlSSCsPorPSAIs(psais) {
  return (
    "SELECT fsp.i_psai, ssc.i_ssc, ssc.entrada AS ssc_entrada," +
    " ssc.i_ssc_situacoes" +
    " FROM bethadba.forum_sa_psai fsp" +
    " JOIN bethadba.ssc ssc ON ssc.i_forum_sa = fsp.i_forum_sa" +
    " WHERE fsp.i_psai IN (" + psais.join(',') + ")" +
    " ORDER BY fsp.i_psai, ssc.entrada DESC"
  );
}

function imprimirSAs(sas, sscMap) {
  console.log('\n' + '='.repeat(120));
  console.log(
    'SAs (SAM/SAL/SAIL) ESCRITA - ULTIMOS 3 MESES: %d itens', sas.length
  );
  console.log('='.repeat(120));

  for (const sa of sas) {
    const sscs = sscMap.get(sa.i_psai) || [];

    console.log(
      '\n  [%s] PSAI %d | SAI %d | Entrada: %s | Sit: %d | Versao: %s | SSCs: %d',
      sa.tipoSAI.trim(), sa.i_psai, sa.i_sai,
      fmt(sa.CadastroPSAI), sa.i_sai_situacoes,
      (sa.nomeVersao || '-').trim(),
      sscs.length
    );

    if (sa.descricao_psai) {
      console.log('    Descricao: %s', sa.descricao_psai.substring(0, 120));
    }

    if (sscs.length > 0) {
      for (const ssc of sscs) {
        console.log(
          '      SSC %d | Entrada: %s | Situacao: %d',
          ssc.i_ssc, fmt(ssc.ssc_entrada), ssc.i_ssc_situacoes
        );
      }
    }
  }
}

function salvarJSON(sas, sscMap) {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const registros = sas.map(sa => {
    const sscs = sscMap.get(sa.i_psai) || [];
    return {
      i_psai: sa.i_psai,
      i_sai: sa.i_sai,
      tipoSAI: (sa.tipoSAI || '').trim(),
      cadastroPSAI: sa.CadastroPSAI,
      cadastroSAI: sa.CadastroSAI,
      situacao: sa.i_sai_situacoes,
      versao: (sa.nomeVersao || '').trim(),
      liberacao: sa.Liberacao,
      descricao: (sa.descricao_psai || '').trim() || null,
      totalSSCs: sscs.length,
      sscs: sscs.map(s => ({
        i_ssc: s.i_ssc,
        entrada: s.ssc_entrada,
        situacao: s.i_ssc_situacoes
      }))
    };
  });

  const resultado = {
    geradoEm: new Date().toISOString(),
    periodo: 'ultimos 3 meses (base: ' + fmt(new Date()) + ')',
    descricaoDisponivel: DESC_HABILITADA,
    totalSAs: sas.length,
    totalSSCs: registros.reduce((s, r) => s + r.totalSSCs, 0),
    resumoPorTipo: resumoPorTipo(sas),
    registros
  };

  const arq = path.join(OUTPUT_DIR, 'sa-ssc-3meses.json');
  fs.writeFileSync(arq, JSON.stringify(resultado, null, 2));
  console.log('\nJSON salvo em: %s', arq);
}

function resumoPorTipo(sas) {
  const m = {};
  for (const sa of sas) {
    const t = (sa.tipoSAI || '').trim();
    m[t] = (m[t] || 0) + 1;
  }
  return m;
}

async function buscarSSCsEmBatch(psais) {
  const BATCH = 200;
  const mapa = new Map();

  for (let i = 0; i < psais.length; i += BATCH) {
    const lote = psais.slice(i, i + BATCH);
    console.log(
      '  Lote SSC %d-%d de %d PSAIs...',
      i + 1, Math.min(i + BATCH, psais.length), psais.length
    );
    const rows = await executar(sqlSSCsPorPSAIs(lote));
    for (const r of rows) {
      if (!mapa.has(r.i_psai)) mapa.set(r.i_psai, []);
      mapa.get(r.i_psai).push(r);
    }
  }

  return mapa;
}

async function main() {
  console.log('=== SAs (SAM/SAL/SAIL) Folha + SSCs - Ultimos 3 meses ===');
  console.log('Data base: %s\n', fmt(new Date()));

  console.log('[1/2] Buscando SAs dos ultimos 3 meses...');
  const sas = await executar(sqlSAsRecentes());
  console.log('  -> %d SAs encontradas', sas.length);

  const psaisUnicos = [...new Set(sas.map(s => s.i_psai))];
  console.log('[2/2] Buscando SSCs vinculadas (%d PSAIs)...', psaisUnicos.length);

  const sscMap = psaisUnicos.length > 0
    ? await buscarSSCsEmBatch(psaisUnicos)
    : new Map();

  const totalSSCs = [...sscMap.values()].reduce((s, arr) => s + arr.length, 0);
  console.log('  -> %d SSCs encontradas no total', totalSSCs);

  imprimirSAs(sas, sscMap);

  console.log('\n' + '='.repeat(80));
  console.log('RESUMO');
  console.log('='.repeat(80));
  console.log('  Total SAs (SAM/SAL/SAIL): %d', sas.length);
  console.log('  SAs com SSC vinculada:    %d', psaisUnicos.filter(p => sscMap.has(p)).length);
  console.log('  Total SSCs:               %d', totalSSCs);

  const porTipo = resumoPorTipo(sas);
  console.log('\n  Por tipo:');
  for (const [t, n] of Object.entries(porTipo).sort((a, b) => b[1] - a[1])) {
    console.log('    %s: %d', t, n);
  }

  const porSit = {};
  for (const sa of sas) {
    porSit[sa.i_sai_situacoes] = (porSit[sa.i_sai_situacoes] || 0) + 1;
  }
  console.log('\n  Por situacao SAI:');
  for (const [s, n] of Object.entries(porSit).sort((a, b) => b[1] - a[1])) {
    console.log('    Sit %s: %d', s, n);
  }

  salvarJSON(sas, sscMap);
  await conexao.fechar();
}

main().catch(err => {
  console.error('Erro:', err);
  conexao.fechar().then(() => process.exit(1));
});
