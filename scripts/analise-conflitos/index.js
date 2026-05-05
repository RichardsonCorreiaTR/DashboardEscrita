/**
 * index.js - Orquestrador da analise de conflitos PSAI/SAI
 *
 * Uso:
 *   node scripts/analise-conflitos/index.js
 *   node scripts/analise-conflitos/index.js --skip-coleta  (usa cache)
 *
 * Etapas:
 * 1. Coleta atividades dos analistas SA (ultimas 2 semanas)
 * 2. Coleta tramites PSAI/SAI do time SA
 * 3. Coleta NEs pendentes Escrita Fiscal
 * 4. Coleta detalhes e responsaveis
 * 5. Cruzamento e identificacao de conflitos
 * 6. Geracao do relatorio
 */

const path = require('path');
const fs = require('fs');

const coleta = require('./coleta');
const { analisar } = require('./analise');
const { gerarRelatorio } = require('./relatorio');

const CACHE_DIR = path.join(__dirname, '..', '..', 'data', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'analise-conflitos.json');
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'output');
const OUTPUT_FILE = path.join(
  OUTPUT_DIR,
  `conflitos-${new Date().toISOString().slice(0, 10)}.txt`
);

async function executar() {
  const skipColeta = process.argv.includes('--skip-coleta');
  let dados;

  if (skipColeta && fs.existsSync(CACHE_FILE)) {
    console.log('Usando cache: %s', CACHE_FILE);
    dados = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  } else {
    dados = await coletarTudo();
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(dados, null, 2));
    console.log('Cache salvo: %s', CACHE_FILE);
  }

  console.log('\n=== FASE 5: Analise de conflitos ===');
  const resultado = analisar(dados);

  console.log('\n=== FASE 6: Geracao do relatorio ===');
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const texto = gerarRelatorio(resultado, OUTPUT_FILE);

  const jsonOut = OUTPUT_FILE.replace('.txt', '.json');
  fs.writeFileSync(jsonOut, JSON.stringify(resultado, null, 2));
  console.log('JSON salvo: %s', jsonOut);

  console.log('\n' + texto);
}

async function coletarTudo() {
  const { atividades, atividadesComSai } =
    await coleta.coletarAtividadesSA();

  const { psais: tramitesPsai, sais: tramitesSai } =
    await coleta.coletarTramitesSA();

  const nesPendentes = await coleta.coletarNEsPendentes();

  const psaiIds = new Set();
  for (const t of tramitesPsai) psaiIds.add(t.i_psai);
  for (const ne of nesPendentes) psaiIds.add(ne.i_psai);

  const saiIds = new Set();
  for (const a of atividadesComSai) {
    if (a.i_sai > 0) saiIds.add(a.i_sai);
  }
  for (const ne of nesPendentes) {
    if (ne.i_sai > 0) saiIds.add(ne.i_sai);
  }

  const { detalhes, respPsai, respSai } = await coleta.coletarDetalhes(
    [...psaiIds], [...saiIds]
  );

  return {
    atividades, atividadesComSai,
    tramitesPsai, tramitesSai,
    nesPendentes,
    detalhesSaiPsai: detalhes,
    respPsai, respSai
  };
}

executar()
  .then(() => {
    console.log('\nAnalise concluida com sucesso!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\nERRO:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
