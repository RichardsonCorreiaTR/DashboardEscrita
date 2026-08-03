/**
 * config-analista.js - Config filtrada (somente o colaborador logado)
 */
const fs = require('fs');
const path = require('path');

const PKG = path.join(__dirname, '..');
const STANDALONE = fs.existsSync(path.join(PKG, '.standalone'));
const ROOT = STANDALONE ? PKG : path.resolve(PKG, '..');

const CARGO_LABEL = {
  junior: 'Analista J\u00fanior', pleno: 'Analista Pleno',
  senior: 'Analista S\u00eanior', especialista: 'Especialista'
};

function configFiltrada(slug) {
  const equipPath = path.join(ROOT, 'config', 'equipe.json');
  const metasPath = path.join(ROOT, 'config', 'metas-equipe.json');
  const equipe = JSON.parse(fs.readFileSync(equipPath, 'utf8'));
  const metasJson = JSON.parse(fs.readFileSync(metasPath, 'utf8'));
  const metasMap = {};
  metasJson.metas.forEach(m => { metasMap[m.id] = m; });
  const colab = equipe.analistas.find(a => a.slug === slug && a.papel === 'analista');
  if (!colab) return null;
  return {
    colaboradores: [{
      slug: colab.slug, nome: colab.nome, apelido: colab.apelido,
      senioridade: colab.senioridade, cargo: CARGO_LABEL[colab.senioridade] || colab.senioridade,
      'coordenador-slug': colab['coordenador-slug'] || null
    }],
    metas: metasMap, templates: metasJson.templates, overrides: metasJson.overrides || {}
  };
}

module.exports = { configFiltrada, ROOT, STANDALONE, PKG };
