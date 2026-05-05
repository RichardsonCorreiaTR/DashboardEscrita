/**
 * Script standalone: roda simulacao de calibracao e imprime resultados.
 * Uso: node scripts/simular-calibracao.js
 */
const { executarCalibracao } = require('../src/estudos/liberacoes-sa-v2/calibracao');
const resultados = executarCalibracao();

console.log('');
console.log('SIMULACAO DE ESTRATEGIAS DE PREVISAO (NE Liquida)');
console.log('Backtest historico completo desde 2022');
console.log('='.repeat(70));
console.log('');

const header = 'Rank  MAPE    AcertoDir  Testes  Estrategia';
console.log(header);
console.log('='.repeat(70));

for (let i = 0; i < resultados.length; i++) {
  const r = resultados[i];
  const rank = String(i + 1).padStart(4);
  const mape = (r.mape + '%').padStart(7);
  const acerto = (r.acerto + '%').padStart(9);
  const testes = String(r.testes).padStart(6);
  const flag = r.nome.includes('ATUAL') ? '  <<<' : '';
  console.log(rank + '  ' + mape + '  ' + acerto + '  ' + testes + '  ' + r.nome + flag);
}

console.log('');
console.log('MELHOR ESTRATEGIA: ' + resultados[0].nome);
console.log('MAPE: ' + resultados[0].mape + '%');

const atual = resultados.find(r => r.nome.includes('ATUAL'));
if (atual) {
  const idx = resultados.indexOf(atual) + 1;
  console.log('');
  console.log('ESTRATEGIA ATUAL: ' + atual.nome + ' (posicao #' + idx + ')');
  console.log('MAPE ATUAL: ' + atual.mape + '%');
  console.log('Reducao possivel: ' + (atual.mape - resultados[0].mape).toFixed(1) + ' pp');
}

console.log('');
console.log('TOP 3 DETALHES (ultimos 10 backtests)');
console.log('='.repeat(70));
for (let i = 0; i < 3 && i < resultados.length; i++) {
  const r = resultados[i];
  console.log('');
  console.log('#' + (i + 1) + ' ' + r.nome + ' (MAPE=' + r.mape + '%)');
  console.log('Versao         Previsto  Real  Erro%');
  for (const b of r.bt.resultados.slice(-10)) {
    const row = b.versaoAlvo.padEnd(15)
      + String(b.previsto).padStart(8)
      + String(b.real).padStart(6)
      + ('  ' + b.erroPct + '%');
    console.log(row);
  }
}

console.log('');
console.log('ANALISE: 6 MESES RECENTES vs HISTORICO COMPLETO');
console.log('='.repeat(70));
for (let i = 0; i < 5 && i < resultados.length; i++) {
  const r = resultados[i];
  const recentes = r.bt.resultados.slice(-6);
  const mapeRecente = recentes.length > 0
    ? (recentes.reduce((s, x) => s + x.erroPct, 0) / recentes.length).toFixed(1)
    : 'N/A';
  console.log(r.nome);
  console.log('  Historico completo MAPE: ' + r.mape + '% (' + r.testes + ' testes)');
  console.log('  Ultimos 6 meses  MAPE: ' + mapeRecente + '% (' + recentes.length + ' testes)');
}
