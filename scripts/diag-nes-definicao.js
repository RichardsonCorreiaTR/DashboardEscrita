/** Diagnostico NEs com Definicao: valida cache, labels duplicados e atribuicao por papel. */
const fs = require('fs');
const path = require('path');

const CACHE = path.join(__dirname, '..', 'data', 'nes-definicao-cache.json');
const SLUG = process.argv[2] || 'lais';
const ANO = process.argv[3] ? Number(process.argv[3]) : 2026;

const d = JSON.parse(fs.readFileSync(CACHE, 'utf8'));

console.log('gerado_em:', d.gerado_em);
console.log('versoes:', d.versoes.length, '| labels:', d.labels.length);

// 1) Labels duplicados
const cont = {};
d.labels.forEach(l => { cont[l] = (cont[l] || 0) + 1; });
const dup = Object.entries(cont).filter(([, n]) => n > 1);
console.log('\n=== Labels duplicados ===');
console.log(dup.length ? dup.map(([l, n]) => `${l} x${n}`).join('\n') : '(nenhum)');

// 2) Versoes do ano filtrado
const versoesAno = d.versoes.filter(v => Number(v.ano) === ANO);
console.log(`\n=== Versoes ano ${ANO}: ${versoesAno.length} ===`);
versoesAno.forEach(v => console.log(
  ' aba="' + v.nome_aba + '" label="' + v.label + '"',
  '| NEs=' + v.nes.length,
  '| total_liberadas=' + v.totais.total_liberadas,
  '| com_definicao=' + v.totais.com_definicao
));

// 3) Analista: NEs por label com papel (PSAI define / SAI gera)
const pa = d.por_analista[SLUG] || {};
const labelsAno = [...new Set(versoesAno.map(v => v.label || v.nome_aba))];
console.log(`\n=== ${SLUG} (ano ${ANO}) ===`);
let total = 0, comoPsai = 0, comoSai = 0;
labelsAno.forEach(label => {
  const arr = pa[label] || [];
  if (!arr.length) return;
  console.log('\n[' + label + '] ' + arr.length + ' NE(s):');
  arr.forEach(ne => {
    const papel = ne.responsavel_psai_slug === SLUG ? 'PSAI(define)'
      : ne.responsavel_sai_slug === SLUG ? 'SAI(gera)' : '???';
    if (papel === 'PSAI(define)') comoPsai++; else if (papel === 'SAI(gera)') comoSai++;
    total++;
    console.log('  NE ' + ne.ne, '| ' + papel,
      '| psai=' + (ne.responsavel_psai || '-'),
      '| sai=' + (ne.responsavel_sai || '-'),
      (ne.grave ? '| GRAVE' : ''));
  });
});
console.log(`\nTotal ${SLUG} (ano ${ANO}): ${total}  (como PSAI: ${comoPsai}, como SAI: ${comoSai})`);

// 4) Double counting global: soma de todos os analistas vs total com_definicao
let somaAnalistas = 0;
Object.values(d.por_analista).forEach(m => {
  labelsAno.forEach(l => { somaAnalistas += (m[l] || []).length; });
});
const totalDef = versoesAno.reduce((s, v) => s + v.totais.com_definicao, 0);
console.log(`\n=== Ano ${ANO}: soma por analista=${somaAnalistas} vs com_definicao(planilha)=${totalDef} ===`);
console.log('(diferenca indica NE contada para PSAI e SAI ao mesmo tempo, ou "Considera=Nao")');
