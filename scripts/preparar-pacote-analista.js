#!/usr/bin/env node
/**
 * preparar-pacote-analista.js - Gera config/usuario.json para um analista
 *
 * Uso: node scripts/preparar-pacote-analista.js <slug>
 * Exemplo: node scripts/preparar-pacote-analista.js fabio
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const slug = process.argv[2];
if (!slug) {
  console.error('Uso: node scripts/preparar-pacote-analista.js <slug>');
  process.exit(1);
}

const equipe = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'equipe.json'), 'utf8'));
const usuarios = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'usuarios.json'), 'utf8'));
const colab = equipe.analistas.find(a => a.slug === slug && a.papel === 'analista');
const user = usuarios.find(u => u.slug === slug && u.papel === 'analista');
if (!colab || !user) {
  console.error('Analista nao encontrado:', slug);
  process.exit(1);
}

const out = {
  usuario: user.usuario,
  senha: user.senha,
  slug: colab.slug,
  apelido: colab.apelido || colab.nome,
  trocar_senha: user.trocar_senha || false
};

const dest = path.join(ROOT, 'metas-analista', 'config', 'usuario.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 2), 'utf8');
console.log('Gerado:', dest);
console.log('Analista:', out.apelido, '(' + out.slug + ')');
console.log('Iniciar: npm run start:analista');
