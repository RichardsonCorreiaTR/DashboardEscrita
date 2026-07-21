/** Regenera o cache de NEs com Definicao a partir do Excel salvo. */
const fs = require('fs');
const path = require('path');
const { parsearExcel } = require('../src/core/nes-definicao-parser');

const EXCEL = path.join(__dirname, '..', 'data', 'nes-definicao.xlsx');
const CACHE = path.join(__dirname, '..', 'data', 'nes-definicao-cache.json');

(async () => {
  const dados = await parsearExcel(EXCEL);
  fs.writeFileSync(CACHE, JSON.stringify(dados), 'utf8');
  console.log('Cache regenerado:', dados.versoes.length, 'versoes,', dados.labels.length, 'labels unicos');
})().catch(e => { console.error(e); process.exit(1); });
