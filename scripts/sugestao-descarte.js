/**
 * sugestao-descarte.js
 *
 * Sugere NEs para descarte com os seguintes critérios:
 * - Entrada (CadastroPSAI) > 1 ano
 * - Última SSC vinculada > 1 ano (ou sem SSC)
 * - 10 clientes ou menos vinculados (via SSC)
 * - Não liberadas, não descartadas
 * - Produto grupo = 1 (Folha)
 *
 * Uso: node scripts/sugestao-descarte.js
 */

const { executar } = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

const UM_ANO_ATRAS = '2025-03-10';

// NEs abertas (não liberadas, não descartadas) com > 1 ano de entrada
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
    AND sai_psai.CadastroPSAI < '${UM_ANO_ATRAS}'
    AND sai_psai.Liberacao IS NULL
    AND sai_psai.Descarte IS NULL
    AND COALESCE(psai.i_produto_grupo, 1) = 1
  ORDER BY sai_psai.CadastroPSAI`;

function fd(d) {
  return d ? new Date(d).toLocaleDateString('pt-BR') : '-';
}

function decodificarBinario(val) {
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

/**
 * Busca data da última SSC e total de clientes distintos para um lote de PSAIs.
 * Retorna mapa: { i_psai: { ultimaSSC, totalClientes, totalSSC } }
 */
async function buscarSSCeClientes(psaiIds) {
  const resultado = {};
  const BATCH = 40;

  for (let i = 0; i < psaiIds.length; i += BATCH) {
    const batch = psaiIds.slice(i, i + BATCH);
    const lista = batch.join(',');

    const rows = await executar(`
      SELECT fsp.i_psai,
             COUNT(DISTINCT ssc.i_ssc) as total_ssc,
             COUNT(DISTINCT ssc.i_clientes) as total_clientes,
             MAX(ssc.entrada) as ultima_ssc
      FROM bethadba.forum_sa_psai fsp
      JOIN bethadba.ssc ssc ON fsp.i_forum_sa = ssc.i_forum_sa
      WHERE fsp.i_psai IN (${lista})
      GROUP BY fsp.i_psai`);

    for (const r of rows) {
      resultado[r.i_psai] = {
        totalSSC: r.total_ssc,
        totalClientes: r.total_clientes,
        ultimaSSC: r.ultima_ssc
      };
    }

    if (i + BATCH < psaiIds.length) {
      process.stdout.write(`  [SSC] Processando batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(psaiIds.length / BATCH)}...\r`);
    }
  }

  return resultado;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          SUGESTAO DE DESCARTE - NEs ESCRITA            ║');
  console.log('║  Criterios: >1 ano, ultima SSC >1 ano, <=10 clientes  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('Buscando NEs com entrada anterior a %s...\n', UM_ANO_ATRAS);
  const nesVelhas = await executar(SQL_NES_VELHAS);
  console.log('NEs abertas com > 1 ano: %d\n', nesVelhas.length);

  if (nesVelhas.length === 0) {
    console.log('Nenhuma NE encontrada com esses criterios.');
    await conexao.fechar();
    return;
  }

  // Buscar SSC e clientes
  console.log('Buscando SSCs e clientes vinculados...\n');
  const psaiIds = nesVelhas.map(r => r.i_psai);
  const sscMap = await buscarSSCeClientes(psaiIds);

  // Filtrar: ultima SSC > 1 ano OU sem SSC, E <= 10 clientes
  const limiteSSC = new Date(UM_ANO_ATRAS);
  const candidatas = [];

  for (const ne of nesVelhas) {
    const ssc = sscMap[ne.i_psai];
    const totalClientes = ssc ? ssc.totalClientes : 0;
    const totalSSC = ssc ? ssc.totalSSC : 0;
    const ultimaSSC = ssc ? ssc.ultimaSSC : null;

    // Critério: <= 10 clientes
    if (totalClientes > 10) continue;

    // Critério: última SSC > 1 ano OU sem SSC
    if (ultimaSSC && new Date(ultimaSSC) >= limiteSSC) continue;

    const descricao = decodificarBinario(ne.descricao);

    candidatas.push({
      i_psai: ne.i_psai,
      i_sai: ne.i_sai,
      entrada: ne.entrada,
      idade_dias: ne.idade_dias,
      gravidade: ne.gravidade_ne,
      versao: ne.nomeVersao || null,
      i_versoes: ne.i_versoes,
      i_situacao: ne.i_sai_situacoes,
      totalSSC,
      totalClientes,
      ultimaSSC,
      descricao
    });
  }

  // Ordenar: mais velhas primeiro, depois por menos clientes
  candidatas.sort((a, b) => {
    if (b.idade_dias !== a.idade_dias) return b.idade_dias - a.idade_dias;
    return a.totalClientes - b.totalClientes;
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('CANDIDATAS A DESCARTE: %d NEs\n', candidatas.length);

  // Separar por faixa de idade
  const faixas = {
    'Mais de 2 anos (>730d)': [],
    'Entre 1.5 e 2 anos (548-730d)': [],
    'Entre 1 e 1.5 anos (366-547d)': []
  };

  for (const c of candidatas) {
    if (c.idade_dias > 730) faixas['Mais de 2 anos (>730d)'].push(c);
    else if (c.idade_dias > 547) faixas['Entre 1.5 e 2 anos (548-730d)'].push(c);
    else faixas['Entre 1 e 1.5 anos (366-547d)'].push(c);
  }

  for (const [faixa, nes] of Object.entries(faixas)) {
    if (nes.length === 0) continue;
    console.log('\n╔═ %s (%d NEs) ═╗', faixa, nes.length);
    
    for (const ne of nes) {
      const sscInfo = ne.totalSSC > 0
        ? `${ne.totalSSC} SSC, ${ne.totalClientes} cliente(s), ultima: ${fd(ne.ultimaSSC)}`
        : 'SEM SSC VINCULADA';
      const versaoInfo = ne.versao
        ? `commitada ${ne.versao}`
        : ne.i_versoes ? `alocada (i_versoes=${ne.i_versoes})` : 'NAO alocada';

      console.log('\n  PSAI: %d | SAI: %d | Idade: %d dias (%s)',
        ne.i_psai, ne.i_sai, ne.idade_dias, ne.gravidade);
      console.log('  Entrada: %s | Versao: %s', fd(ne.entrada), versaoInfo);
      console.log('  SSC: %s', sscInfo);
      console.log('  Descricao: %s', truncar(ne.descricao, 200));
    }
  }

  // Resumo por gravidade
  const graves = candidatas.filter(c => c.gravidade === 'Grave');
  const criticas = candidatas.filter(c => c.gravidade === 'Critica');
  const normais = candidatas.filter(c => c.gravidade === 'Normal');
  const semSSC = candidatas.filter(c => c.totalSSC === 0);
  const comSSC = candidatas.filter(c => c.totalSSC > 0);
  const alocadas = candidatas.filter(c => c.versao || c.i_versoes);

  console.log('\n\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                    RESUMO EXECUTIVO                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('Total candidatas a descarte: %d', candidatas.length);
  console.log('');
  console.log('Por gravidade:');
  console.log('  Criticas:  %d', criticas.length);
  console.log('  Graves:    %d', graves.length);
  console.log('  Normais:   %d', normais.length);
  console.log('');
  console.log('Por vinculo SSC:');
  console.log('  Sem SSC nenhuma:       %d  (descarte mais seguro)', semSSC.length);
  console.log('  Com SSC mas > 1 ano:   %d', comSSC.length);
  console.log('');
  console.log('Por faixa de idade:');
  for (const [faixa, nes] of Object.entries(faixas)) {
    if (nes.length > 0) console.log('  %s: %d', faixa, nes.length);
  }
  console.log('');
  
  if (alocadas.length > 0) {
    console.log('ATENCAO: %d NEs estao alocadas/commitadas em versao:', alocadas.length);
    for (const a of alocadas) {
      console.log('  PSAI %d - versao: %s (i_versoes: %s)',
        a.i_psai, a.versao || '-', a.i_versoes || '-');
    }
    console.log('  -> Essas podem exigir desalocacao antes do descarte.\n');
  }

  // TOP recomendações (sem SSC + mais velhas)
  const topDescarte = candidatas
    .filter(c => c.totalSSC === 0 && !c.versao && !c.i_versoes)
    .slice(0, 20);

  if (topDescarte.length > 0) {
    console.log('━━━ TOP %d RECOMENDACOES (sem SSC, sem alocacao, mais velhas) ━━━\n', topDescarte.length);
    console.log('%-8s %-8s %-6s %-10s %-8s %s', 'PSAI', 'SAI', 'Dias', 'Entrada', 'Grav.', 'Descricao');
    console.log('-'.repeat(100));
    for (const ne of topDescarte) {
      console.log('%-8d %-8d %-6d %-10s %-8s %s',
        ne.i_psai, ne.i_sai, ne.idade_dias, fd(ne.entrada), ne.gravidade,
        truncar(ne.descricao, 60));
    }
  }

  await conexao.fechar();
}

main().catch(err => {
  console.error('Erro:', err);
  conexao.fechar().then(() => process.exit(1));
});
