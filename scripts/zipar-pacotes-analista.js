#!/usr/bin/env node
/**
 * zipar-pacotes-analista.js - Compacta pastas Metas-<slug> em ZIP para envio
 *
 * Uso: node scripts/zipar-pacotes-analista.js
 * Saida: output/pacotes-analista/zip/Metas-<slug>.zip
 */
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const ROOT = path.join(__dirname, '..');
const BASE = path.join(ROOT, 'output', 'pacotes-analista');
const ZIP_DIR = path.join(BASE, 'zip');
const ZIP_ESP_DIR = path.join(ZIP_DIR, 'especialistas');

function slugsEspecialistas() {
  const equipe = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'equipe.json'), 'utf8'));
  return equipe.analistas
    .filter(a => a.papel === 'analista' && a.senioridade === 'especialista')
    .map(a => ({ slug: a.slug, apelido: a.apelido || a.nome }));
}

function addPasta(zip, dir, prefix) {
  fs.readdirSync(dir).forEach(nome => {
    const full = path.join(dir, nome);
    const rel = prefix ? prefix + '/' + nome : nome;
    if (fs.statSync(full).isDirectory()) addPasta(zip, full, rel);
    else zip.file(rel, fs.readFileSync(full));
  });
}

async function ziparPasta(pasta, destZip) {
  const zip = new JSZip();
  const nome = path.basename(pasta);
  addPasta(zip, pasta, nome);
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(destZip, buf);
}

async function main() {
  if (!fs.existsSync(BASE)) {
    console.error('[zip] Pasta nao encontrada:', BASE);
    console.error('[zip] Execute antes: npm run exportar-pacotes-mes');
    process.exit(1);
  }

  const pastas = fs.readdirSync(BASE)
    .filter(n => n.startsWith('Metas-') && fs.statSync(path.join(BASE, n)).isDirectory())
    .sort();

  if (!pastas.length) {
    console.error('[zip] Nenhuma pasta Metas-* encontrada. Rode exportar-pacotes-mes.');
    process.exit(1);
  }

  fs.mkdirSync(ZIP_DIR, { recursive: true });
  const ok = [], falhas = [];

  for (const nome of pastas) {
    const pasta = path.join(BASE, nome);
    const dest = path.join(ZIP_DIR, nome + '.zip');
    try {
      await ziparPasta(pasta, dest);
      const kb = Math.round(fs.statSync(dest).size / 1024);
      ok.push({ nome, kb });
      console.log('OK', nome + '.zip', '(' + kb + ' KB)');
    } catch (err) {
      falhas.push({ nome, erro: err.message });
      console.warn('FALHA', nome, '-', err.message);
    }
  }

  const indice = {
    gerado_em: new Date().toISOString(),
    total: pastas.length,
    ok: ok.length,
    pasta: ZIP_DIR,
    arquivos: ok.map(o => o.nome + '.zip')
  };
  fs.writeFileSync(path.join(ZIP_DIR, 'INDICE-ZIPS.json'), JSON.stringify(indice, null, 2));

  const especialistas = slugsEspecialistas();
  fs.mkdirSync(ZIP_ESP_DIR, { recursive: true });
  const espOk = [];
  especialistas.forEach(({ slug, apelido }) => {
    const nome = 'Metas-' + slug + '.zip';
    const orig = path.join(ZIP_DIR, nome);
    const dest = path.join(ZIP_ESP_DIR, nome);
    if (!fs.existsSync(orig)) {
      console.warn('FALHA especialista', apelido, '- zip nao encontrado');
      return;
    }
    fs.copyFileSync(orig, dest);
    espOk.push({ slug, apelido, arquivo: nome });
    console.log('ESP', nome, '-> especialistas/');
  });
  fs.writeFileSync(path.join(ZIP_ESP_DIR, 'INDICE-ESPECIALISTAS.json'),
    JSON.stringify({ gerado_em: new Date().toISOString(), total: espOk.length, membros: espOk }, null, 2));

  console.log('\n[zip] Concluido:', ok.length + '/' + pastas.length);
  console.log('[zip] Especialistas:', espOk.length + '/' + especialistas.length, 'em', ZIP_ESP_DIR);
  console.log('[zip] Pasta:', ZIP_DIR);
  if (falhas.length) process.exitCode = 1;
}

main().catch(err => { console.error(err.message); process.exit(1); });
