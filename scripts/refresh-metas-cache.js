/**
 * refresh-metas-cache.js - Recalcula data/cache/metas-equipe.json
 * Processa 1 analista por vez (evita OOM e disputa ODBC).
 * Uso: node --max-old-space-size=4096 scripts/refresh-metas-cache.js
 */
process.chdir(require('path').join(__dirname, '..'));
const fs = require('fs');
const conexao = require('../src/core/conexao');
const cacheMetas = require('../src/core/cache-metas');
const planilha = require('../src/core/planilha-escrita');
const loader = require('../src/indicadores/equipe/metas-loader');

async function aquecerPlanilha() {
  const mesAtual = new Date().getMonth() + 1;
  console.log('Aquecendo planilha (meses 1..' + mesAtual + ')...');
  for (let mes = 1; mes <= mesAtual; mes++) {
    const n = (await planilha.obterSaisPorMes(mes)).length;
    console.log('  mes', mes, '->', n, 'SAIs');
  }
}

async function main() {
  await conexao.inicializar();
  loader.setAno(2026);
  await aquecerPlanilha();

  const equipe = JSON.parse(fs.readFileSync('config/equipe.json', 'utf8'));
  const analistas = equipe.analistas.filter(a => a.papel === 'analista');
  const metasJson = JSON.parse(fs.readFileSync('config/metas-equipe.json', 'utf8'));
  console.log('Recalculando', analistas.length, 'analistas (sequencial)...');

  const result = [];
  const t0 = Date.now();
  for (let i = 0; i < analistas.length; i++) {
    const a = analistas[i];
    const t1 = Date.now();
    const dados = await loader.buscarDadosAnalista(a);
    result.push(loader.montarResposta(a, dados, metasJson));
    console.log('  [' + (i + 1) + '/' + analistas.length + ']', a.slug,
      Math.round((Date.now() - t1) / 1000) + 's');
  }

  cacheMetas.salvarTodos(result);
  const info = fs.statSync('data/cache/metas-equipe.json');
  console.log('Cache salvo:', info.size, 'bytes em', info.mtime.toISOString());
  console.log('Total:', Math.round((Date.now() - t0) / 1000) + 's,', result.length, 'colaboradores');
  await conexao.fechar();
}

main().catch(async e => {
  console.error(e);
  try { await conexao.fechar(); } catch { /* ignore */ }
  process.exit(1);
});
