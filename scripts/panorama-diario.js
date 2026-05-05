/**
 * panorama-diario.js
 *
 * Panorama completo: hoje, ontem, semana, versão 10.6A-03.
 * Inclui NEs de toda a Folha (não só DIRF), assuntos recorrentes
 * e pontos de preocupação.
 *
 * Uso: node scripts/panorama-diario.js
 */

const { executar } = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');

const VERSAO = '10.6A-03';

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

// -- 1. Entradas HOJE e ONTEM (Folha completa)
const SQL_ENTRADAS_DIA = `
  SELECT sai_psai.i_psai, sai_psai.i_sai,
         sai_psai.CadastroPSAI as entrada,
         sai_psai.gravidade_ne,
         CAST(psai.descricao AS BINARY) as descricao --allow-blob
  FROM UP.SAI_PSAI sai_psai
  JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI = 'NE'
    AND sai_psai.CadastroPSAI >= ? AND sai_psai.CadastroPSAI < ?
    AND (EXISTS (SELECT 1 FROM bethadba.sai sai
         WHERE sai_psai.i_sai = sai.i_sai
         AND (sai.i_produto_grupo IS NULL OR sai.i_produto_grupo = 1))
      OR sai_psai.i_sai = 0)
  ORDER BY sai_psai.CadastroPSAI`;

// -- 2. Liberações HOJE e ONTEM
const SQL_LIBERADAS_DIA = `
  SELECT sai_psai.i_psai, sai_psai.i_sai,
         sai_psai.Liberacao, sai_psai.nomeVersao,
         CAST(psai.descricao AS BINARY) as descricao --allow-blob
  FROM UP.SAI_PSAI sai_psai
  JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI = 'NE'
    AND sai_psai.Liberacao >= ? AND sai_psai.Liberacao < ?
    AND COALESCE(psai.i_produto_grupo, 1) = 1
  ORDER BY sai_psai.Liberacao`;

// -- 3. Descartes HOJE e ONTEM
const SQL_DESCARTES_DIA = `
  SELECT sai_psai.i_psai, sai_psai.i_sai,
         sai_psai.Descarte,
         CAST(psai.descricao AS BINARY) as descricao --allow-blob
  FROM UP.SAI_PSAI sai_psai
  JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI = 'NE'
    AND sai_psai.Descarte >= ? AND sai_psai.Descarte < ?
    AND (EXISTS (SELECT 1 FROM bethadba.sai sai
         WHERE sai_psai.i_sai = sai.i_sai
         AND (sai.i_produto_grupo IS NULL OR sai.i_produto_grupo = 1))
      OR sai_psai.i_sai = 0)
  ORDER BY sai_psai.Descarte`;

// -- 4. Entradas na SEMANA
const SQL_ENTRADAS_SEMANA = `
  SELECT sai_psai.i_psai, sai_psai.i_sai,
         sai_psai.CadastroPSAI as entrada,
         sai_psai.gravidade_ne,
         CAST(psai.descricao AS BINARY) as descricao --allow-blob
  FROM UP.SAI_PSAI sai_psai
  JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI = 'NE'
    AND sai_psai.CadastroPSAI >= ? AND sai_psai.CadastroPSAI < ?
    AND (EXISTS (SELECT 1 FROM bethadba.sai sai
         WHERE sai_psai.i_sai = sai.i_sai
         AND (sai.i_produto_grupo IS NULL OR sai.i_produto_grupo = 1))
      OR sai_psai.i_sai = 0)
  ORDER BY sai_psai.CadastroPSAI`;

// -- 5. VERSÃO completa: entradas, liberadas, descartes, pendentes, saldo
const SQL_VERSAO_ENTRADAS = `
  SELECT COUNT(*) as total,
         SUM(CASE WHEN gravidade_ne = 'Critica' THEN 1 ELSE 0 END) as criticas,
         SUM(CASE WHEN gravidade_ne = 'Grave' THEN 1 ELSE 0 END) as graves,
         SUM(CASE WHEN gravidade_ne = 'Normal' THEN 1 ELSE 0 END) as normais
  FROM UP.SAI_PSAI sai_psai
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI = 'NE'
    AND sai_psai.CadastroPSAI > PIAZZA.FG_GET_DATA_INICIO_VERSAO('${VERSAO}', 1)
    AND sai_psai.CadastroPSAI <= PIAZZA.FG_GET_DATA_FIM_VERSAO('${VERSAO}', 1)
    AND (EXISTS (SELECT 1 FROM bethadba.sai sai
         WHERE sai_psai.i_sai = sai.i_sai
         AND (sai.i_produto_grupo IS NULL OR sai.i_produto_grupo = 1))
      OR sai_psai.i_sai = 0)`;

const SQL_VERSAO_LIBERADAS = `
  SELECT COUNT(*) as total
  FROM UP.SAI_PSAI sai_psai
  JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI = 'NE'
    AND sai_psai.nomeVersao = '${VERSAO}'
    AND sai_psai.Liberacao IS NOT NULL
    AND COALESCE(psai.i_produto_grupo, 1) = 1`;

const SQL_VERSAO_DESCARTES = `
  SELECT COUNT(*) as total
  FROM UP.SAI_PSAI sai_psai
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI = 'NE'
    AND sai_psai.Descarte > PIAZZA.FG_GET_DATA_INICIO_VERSAO('${VERSAO}', 1)
    AND sai_psai.Descarte <= PIAZZA.FG_GET_DATA_FIM_VERSAO('${VERSAO}', 1)
    AND (EXISTS (SELECT 1 FROM bethadba.sai sai
         WHERE sai_psai.i_sai = sai.i_sai
         AND (sai.i_produto_grupo IS NULL OR sai.i_produto_grupo = 1))
      OR sai_psai.i_sai = 0)`;

const SQL_VERSAO_PENDENTES = `
  SELECT COUNT(*) as total
  FROM UP.SAI_PSAI sai_psai
  JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI = 'NE'
    AND sai_psai.nomeVersao = '${VERSAO}'
    AND sai_psai.Liberacao IS NULL
    AND COALESCE(psai.i_produto_grupo, 1) = 1`;

const SQL_SALDO = `
  SELECT COUNT(*) as saldo
  FROM UP.SAI_PSAI sai_psai
  JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI = 'NE'
    AND sai_psai.CadastroPSAI <= PIAZZA.FG_GET_DATA_FIM_VERSAO('${VERSAO}', 1)
    AND (COALESCE(sai_psai.Liberacao, '3000-12-01') > PIAZZA.FG_GET_DATA_FIM_VERSAO('${VERSAO}', 1))
    AND (COALESCE(sai_psai.Descarte, '3000-12-01') > PIAZZA.FG_GET_DATA_FIM_VERSAO('${VERSAO}', 1))
    AND COALESCE(psai.i_produto_grupo, 1) = 1`;

// -- 6. Assuntos recorrentes na versão (por classificação funcional)
const SQL_ASSUNTOS_VERSAO = `
  SELECT sai_psai.i_psai, sai_psai.i_sai,
         sai_psai.CadastroPSAI as entrada,
         sai_psai.gravidade_ne,
         sai_psai.Liberacao, sai_psai.Descarte,
         CAST(psai.descricao AS BINARY) as descricao --allow-blob
  FROM UP.SAI_PSAI sai_psai
  JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI = 'NE'
    AND sai_psai.CadastroPSAI > PIAZZA.FG_GET_DATA_INICIO_VERSAO('${VERSAO}', 1)
    AND sai_psai.CadastroPSAI <= PIAZZA.FG_GET_DATA_FIM_VERSAO('${VERSAO}', 1)
    AND (EXISTS (SELECT 1 FROM bethadba.sai sai
         WHERE sai_psai.i_sai = sai.i_sai
         AND (sai.i_produto_grupo IS NULL OR sai.i_produto_grupo = 1))
      OR sai_psai.i_sai = 0)
  ORDER BY sai_psai.CadastroPSAI`;

// -- 7. NEs > 30 dias sem liberação (envelhecidas)
const SQL_ENVELHECIDAS = `
  SELECT sai_psai.i_psai, sai_psai.i_sai,
         sai_psai.CadastroPSAI as entrada,
         sai_psai.gravidade_ne,
         sai_psai.nomeVersao,
         sai_psai.i_sai_situacoes,
         DATEDIFF(day, sai_psai.CadastroPSAI, CURRENT DATE) as idade_dias,
         CAST(psai.descricao AS BINARY) as descricao --allow-blob
  FROM UP.SAI_PSAI sai_psai
  JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI = 'NE'
    AND sai_psai.Liberacao IS NULL
    AND sai_psai.Descarte IS NULL
    AND DATEDIFF(day, sai_psai.CadastroPSAI, CURRENT DATE) > 30
    AND sai_psai.CadastroPSAI > PIAZZA.FG_GET_DATA_INICIO_VERSAO('10.6A-01', 1)
    AND COALESCE(psai.i_produto_grupo, 1) = 1
  ORDER BY sai_psai.CadastroPSAI`;

// -- 8. Liberações via arquivo de versão (antecipações)
const SQL_ARQUIVO_LIB = `
  SELECT COUNT(*) as total
  FROM UP.SAI_PSAI sai_psai
  JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI = 'NE'
    AND sai_psai.nomeVersao LIKE '10.6A-02.%'
    AND sai_psai.Liberacao IS NOT NULL
    AND COALESCE(psai.i_produto_grupo, 1) = 1`;

const SQL_ARQUIVO_PEND = `
  SELECT COUNT(*) as total
  FROM UP.SAI_PSAI sai_psai
  JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI = 'NE'
    AND sai_psai.nomeVersao LIKE '10.6A-02.%'
    AND sai_psai.Liberacao IS NULL
    AND COALESCE(psai.i_produto_grupo, 1) = 1`;

// -- 9. Entradas por dia da versão (para tendência)
const SQL_ENTRADAS_POR_DIA = `
  SELECT sai_psai.CadastroPSAI as dia, COUNT(*) as entradas
  FROM UP.SAI_PSAI sai_psai
  WHERE sai_psai.nomeArea = 'Escrita'
    AND sai_psai.tipoSAI = 'NE'
    AND sai_psai.CadastroPSAI > PIAZZA.FG_GET_DATA_INICIO_VERSAO('${VERSAO}', 1)
    AND sai_psai.CadastroPSAI <= PIAZZA.FG_GET_DATA_FIM_VERSAO('${VERSAO}', 1)
    AND (EXISTS (SELECT 1 FROM bethadba.sai sai
         WHERE sai_psai.i_sai = sai.i_sai
         AND (sai.i_produto_grupo IS NULL OR sai.i_produto_grupo = 1))
      OR sai_psai.i_sai = 0)
  GROUP BY sai_psai.CadastroPSAI
  ORDER BY sai_psai.CadastroPSAI`;

function classificarArea(descricao) {
  if (!descricao) return 'Outros';
  const d = descricao.normalize('NFC').toLowerCase();
  if (/\bextrator\b.*\bdirf\b|\bdirf\b.*\bextrator\b/.test(d)) return 'Extrator DIRF';
  if (/\bdirf\b/.test(d)) return 'DIRF';
  if (/\bcomprovante\s+de\s+rendimento/.test(d)) return 'Comprovante Rendimentos';
  if (/\besocial\b|evento\s+s-\d/.test(d)) return 'eSocial';
  if (/\bsefip\b|\bgfip\b/.test(d)) return 'SEFIP/GFIP';
  if (/\brais\b|\bdctfweb\b|\befd.?reinf\b|\bfgts\s*digital\b/.test(d)) return 'Obrig. Acessorias';
  if (/\bf[ée]rias\b|\babono\s+pecuni/.test(d)) return 'Ferias';
  if (/\brescis[ãa]o\b|\btrct\b|\bdesligamento\b|\baviso\s+pr[ée]vio\b/.test(d)) return 'Rescisao';
  if (/\b13[°º]?\s*sal[aá]rio\b|\badiantamento\s+13\b|\b13[°º]?\b/.test(d)) return '13o Salario';
  if (/\binss\b|\bgps\b|\bfgts\b|\bgrrf\b|\bcontribui[çc][ãa]o\b|\bencargos?\b|\birrf\b/.test(d)) return 'Encargos/Tributos';
  if (/\bfolha\s+(de\s+)?pagamento\b|\bcalc[uú]l|\bcompet[eê]ncia\b|\bproventos?\b|\bdescontos?\b|\bcontracheque\b|\bhollerith\b|\brecalcul/.test(d)) return 'Folha/Calculo';
  if (/\bimporta[çc][ãa]o\b|\bexporta[çc][ãa]o\b|\bintegra[çc][ãa]o\b|\bapi\b/.test(d)) return 'Importacao/Integracao';
  if (/\brelat[oó]rio\b|\blistagem\b|\bextra[çc][ãa]o\b|\bconfer[eê]ncia\b|\bprovis[ãa]o\b|\bdemonstrat/.test(d)) return 'Relatorios';
  if (/\badmiss[ãa]o\b|\bcadastro\b|\bcolaborador\b|\bpar[aâ]metro/.test(d)) return 'Cadastro/Parametros';
  if (/\bafastamento\b|\batestado\b|\blicen[çc]a/.test(d)) return 'Afastamento';
  if (/\bpens[ãa]o\b/.test(d)) return 'Pensao Alimenticia';
  if (/\brubrica\b/.test(d)) return 'Rubricas';
  if (/\berro\b.*\bbanco\b|\bthread\b|\bfinalizando\b|\btravando\b/.test(d)) return 'Erro/Instabilidade';
  return 'Outros';
}

function classificarTema(descricao) {
  if (!descricao) return [];
  const d = descricao.normalize('NFC').toLowerCase();
  const temas = [];
  if (/extrator.*dirf|dirf.*extrator|extrator\s+dirf/.test(d)) temas.push('Extrator DIRF');
  else if (/\bdirf\b/.test(d)) temas.push('DIRF');
  if (/\bcomprovante\s+de\s+rendimento/.test(d)) temas.push('Comprovante Rendimentos');
  if (/\bs-1210\b|\bs-1200\b|\bs-2299\b|\bs-2200\b/.test(d)) temas.push('eSocial Eventos');
  if (/\brescis[ãa]o\b|\btrct\b|\bdesligamento\b/.test(d)) temas.push('Rescisao');
  if (/\bf[ée]rias\b/.test(d)) temas.push('Ferias');
  if (/\b13[°º]?\b/.test(d)) temas.push('13o Salario');
  if (/\birrf\b/.test(d)) temas.push('IRRF');
  if (/\binss\b/.test(d)) temas.push('INSS');
  if (/\bfgts\b/.test(d)) temas.push('FGTS');
  if (/\bpens[ãa]o\b/.test(d)) temas.push('Pensao');
  if (/\bplano\s+de\s+sa[uú]de\b/.test(d)) temas.push('Plano Saude');
  if (/\bdependent/.test(d)) temas.push('Dependente');
  if (/\bdedu[çc][ãa]o\s+simplificad/.test(d)) temas.push('Deducao Simplificada');
  if (/\btransfer[eê]ncia\b/.test(d)) temas.push('Transferencia');
  if (/\bimporta[çc][ãa]o\b|\bapi\b/.test(d)) temas.push('Importacao/API');
  if (/\bprovis[ãa]o\b/.test(d)) temas.push('Provisao');
  if (/\berro\b.*\bbanco\b|\bthread\b/.test(d)) temas.push('Erro Banco');
  if (/\btravando\b|\bfinalizando\b/.test(d)) temas.push('Travamento');
  if (/\bsem[aá]n/.test(d)) temas.push('Semanalista');
  if (/\bintermitente\b/.test(d)) temas.push('Intermitente');
  return temas;
}

async function main() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  const dow = hoje.getDay();
  const seg = new Date(hoje);
  seg.setDate(seg.getDate() - ((dow + 6) % 7));
  const proxSeg = new Date(seg);
  proxSeg.setDate(proxSeg.getDate() + 7);

  const hojeStr = hoje.toISOString().split('T')[0];
  const ontemStr = ontem.toISOString().split('T')[0];
  const amanhaStr = amanha.toISOString().split('T')[0];
  const segStr = seg.toISOString().split('T')[0];
  const proxSegStr = proxSeg.toISOString().split('T')[0];

  // ========== HOJE ==========
  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const hojeLabel = `${fd(hoje)} (${diasSemana[hoje.getDay()]})`;
  const ontemLabel = `${fd(ontem)} (${diasSemana[ontem.getDay()]})`;

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           PANORAMA ESCRITA FISCAL - %s            ║', fd(hoje));
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const sqlHoje = SQL_ENTRADAS_DIA.replace(/\?/g, (_, i) => {
    return i === 0 ? `'${hojeStr}'` : `'${amanhaStr}'`;
  });
  let idx = 0;
  const entHoje = await executar(SQL_ENTRADAS_DIA
    .replace('?', `'${hojeStr}'`).replace('?', `'${amanhaStr}'`));
  const libHoje = await executar(SQL_LIBERADAS_DIA
    .replace('?', `'${hojeStr}'`).replace('?', `'${amanhaStr}'`));
  const descHoje = await executar(SQL_DESCARTES_DIA
    .replace('?', `'${hojeStr}'`).replace('?', `'${amanhaStr}'`));

  console.log('━━━ HOJE (%s) ━━━', hojeLabel);
  console.log('  Entradas:    %d', entHoje.length);
  console.log('  Liberadas:   %d', libHoje.length);
  console.log('  Descartadas: %d', descHoje.length);
  if (entHoje.length > 0) {
    console.log('\n  Entradas de hoje:');
    for (const r of entHoje) {
      const desc = decodificarBinario(r.descricao);
      console.log('    PSAI %d (SAI %d) [%s] %s',
        r.i_psai, r.i_sai, r.gravidade_ne, truncar(desc, 120));
    }
  }

  // ========== ONTEM ==========
  const entOntem = await executar(SQL_ENTRADAS_DIA
    .replace('?', `'${ontemStr}'`).replace('?', `'${hojeStr}'`));
  const libOntem = await executar(SQL_LIBERADAS_DIA
    .replace('?', `'${ontemStr}'`).replace('?', `'${hojeStr}'`));
  const descOntem = await executar(SQL_DESCARTES_DIA
    .replace('?', `'${ontemStr}'`).replace('?', `'${hojeStr}'`));

  console.log('\n━━━ ONTEM (%s) ━━━', ontemLabel);
  console.log('  Entradas:    %d', entOntem.length);
  console.log('  Liberadas:   %d', libOntem.length);
  console.log('  Descartadas: %d', descOntem.length);
  if (entOntem.length > 0) {
    console.log('\n  Entradas de ontem:');
    for (const r of entOntem) {
      const desc = decodificarBinario(r.descricao);
      console.log('    PSAI %d (SAI %d) [%s] %s',
        r.i_psai, r.i_sai, r.gravidade_ne, truncar(desc, 120));
    }
  }

  // ========== SEMANA ==========
  const entSemana = await executar(SQL_ENTRADAS_SEMANA
    .replace('?', `'${segStr}'`).replace('?', `'${proxSegStr}'`));

  console.log('\n━━━ SEMANA ATUAL (%s a %s) ━━━', fd(seg), fd(proxSeg));
  console.log('  Entradas acumuladas: %d', entSemana.length);
  const gravSemana = { Critica: 0, Grave: 0, Normal: 0 };
  for (const r of entSemana) gravSemana[r.gravidade_ne] = (gravSemana[r.gravidade_ne] || 0) + 1;
  console.log('  Criticas: %d | Graves: %d | Normais: %d',
    gravSemana.Critica, gravSemana.Grave, gravSemana.Normal);

  // ========== VERSÃO ==========
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                   VERSÃO %s                        ║', VERSAO);
  console.log('║              (23/02/2026 a 23/03/2026)                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const [vEntradas] = await executar(SQL_VERSAO_ENTRADAS);
  const [vLib] = await executar(SQL_VERSAO_LIBERADAS);
  const [vDesc] = await executar(SQL_VERSAO_DESCARTES);
  const [vPend] = await executar(SQL_VERSAO_PENDENTES);
  const [vSaldo] = await executar(SQL_SALDO);
  const [vArqLib] = await executar(SQL_ARQUIVO_LIB);
  const [vArqPend] = await executar(SQL_ARQUIVO_PEND);

  const diasRestantes = Math.ceil(
    (new Date('2026-03-23') - hoje) / (1000 * 60 * 60 * 24));

  console.log('━━━ NUMEROS DA VERSAO ━━━');
  console.log('  Entradas na versao:     %d (C: %d | G: %d | N: %d)',
    vEntradas.total, vEntradas.criticas, vEntradas.graves, vEntradas.normais);
  console.log('  Liberadas (versao):     %d', vLib.total);
  console.log('  Liberadas (arquivo):    %d', vArqLib.total);
  console.log('  Pendentes (arquivo):    %d', vArqPend.total);
  console.log('  Descartadas:            %d', vDesc.total);
  console.log('  Pendentes commit:       %d', vPend.total);
  console.log('  SALDO ACUMULADO:        %d', vSaldo.saldo);
  console.log('  Dias restantes:         %d', diasRestantes);

  // Tendência por semana (agrupando por dia e depois somando em semanas)
  const porDia = await executar(SQL_ENTRADAS_POR_DIA);
  if (porDia.length > 0) {
    const semanas = {};
    for (const d of porDia) {
      const dt = new Date(d.dia);
      const dow = dt.getDay();
      const seg = new Date(dt);
      seg.setDate(seg.getDate() - ((dow + 6) % 7));
      const chave = seg.toISOString().split('T')[0];
      semanas[chave] = (semanas[chave] || 0) + d.entradas;
    }
    console.log('\n━━━ TENDENCIA ENTRADAS POR SEMANA ━━━');
    for (const [sem, qtd] of Object.entries(semanas).sort()) {
      const barra = '█'.repeat(Math.min(qtd, 50));
      console.log('  Sem %s: %3d %s', sem, qtd, barra);
    }
  }

  // ========== ASSUNTOS RECORRENTES ==========
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║              ASSUNTOS RECORRENTES NA VERSAO             ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const todasNEs = await executar(SQL_ASSUNTOS_VERSAO);

  // Classificar por área funcional
  const porArea = {};
  const porTema = {};

  for (const r of todasNEs) {
    const desc = decodificarBinario(r.descricao);
    const area = classificarArea(desc);
    porArea[area] = (porArea[area] || 0) + 1;

    const temas = classificarTema(desc);
    for (const t of temas) porTema[t] = (porTema[t] || 0) + 1;
  }

  // Areas ordenadas por volume
  const areasOrdenadas = Object.entries(porArea)
    .sort((a, b) => b[1] - a[1]);
  
  console.log('━━━ POR AREA FUNCIONAL ━━━');
  for (const [area, qtd] of areasOrdenadas) {
    const pct = ((qtd / todasNEs.length) * 100).toFixed(1);
    const barra = '█'.repeat(Math.max(1, Math.round(qtd / 2)));
    console.log('  %-25s %3d (%5s%%) %s', area, qtd, pct, barra);
  }

  // Temas mais recorrentes
  const temasOrdenados = Object.entries(porTema)
    .sort((a, b) => b[1] - a[1]);

  console.log('\n━━━ TEMAS MAIS RECORRENTES (top 15) ━━━');
  for (const [tema, qtd] of temasOrdenados.slice(0, 15)) {
    const barra = '█'.repeat(Math.max(1, Math.round(qtd / 2)));
    console.log('  %-25s %3d %s', tema, qtd, barra);
  }

  // ========== PONTOS DE PREOCUPAÇÃO ==========
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║              PONTOS DE PREOCUPACAO                      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const envelhecidas = await executar(SQL_ENVELHECIDAS);
  console.log('━━━ NEs ENVELHECIDAS (> 30 dias sem liberacao/descarte) ━━━');
  console.log('  Total: %d\n', envelhecidas.length);

  if (envelhecidas.length > 0) {
    const faixas = { '31-45d': 0, '46-60d': 0, '61-90d': 0, '>90d': 0 };
    for (const r of envelhecidas) {
      if (r.idade_dias <= 45) faixas['31-45d']++;
      else if (r.idade_dias <= 60) faixas['46-60d']++;
      else if (r.idade_dias <= 90) faixas['61-90d']++;
      else faixas['>90d']++;
    }
    for (const [faixa, qtd] of Object.entries(faixas)) {
      if (qtd > 0) console.log('  %s: %d NEs', faixa, qtd);
    }

    const top5 = envelhecidas.slice(0, 10);
    console.log('\n  Top 10 mais antigas:');
    for (const r of top5) {
      const desc = decodificarBinario(r.descricao);
      console.log('    PSAI %d (SAI %d) | %d dias | versao: %s | %s',
        r.i_psai, r.i_sai, r.idade_dias,
        r.nomeVersao || 'NAO ALOCADA', truncar(desc, 100));
    }
  }

  // Graves/Críticas ABERTAS (não liberadas, não descartadas)
  const gravesAbertas = todasNEs.filter(r => 
    (r.gravidade_ne === 'Grave' || r.gravidade_ne === 'Critica')
    && !r.Liberacao && !r.Descarte);
  const gravesResolvidas = todasNEs.filter(r =>
    (r.gravidade_ne === 'Grave' || r.gravidade_ne === 'Critica')
    && (r.Liberacao || r.Descarte));

  if (gravesAbertas.length > 0) {
    console.log('\n━━━ NEs GRAVES/CRITICAS ABERTAS NA VERSAO ━━━');
    for (const r of gravesAbertas) {
      const desc = decodificarBinario(r.descricao);
      console.log('  PSAI %d [%s] entrada %s: %s',
        r.i_psai, r.gravidade_ne, fd(r.entrada), truncar(desc, 120));
    }
  } else {
    console.log('\n  Nenhuma NE Grave/Critica ABERTA na versao. ✓');
  }
  if (gravesResolvidas.length > 0) {
    console.log('  (%d Grave/Critica ja resolvida: %s)',
      gravesResolvidas.length,
      gravesResolvidas.map(r => `PSAI ${r.i_psai} [${r.Liberacao ? 'Liberada' : 'Descartada'}]`).join(', '));
  }

  await conexao.fechar();
}

main().catch(err => {
  console.error('Erro:', err);
  conexao.fechar().then(() => process.exit(1));
});
