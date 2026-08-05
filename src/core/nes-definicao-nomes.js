/**
 * nes-definicao-nomes.js - Mapeamento de nomes da planilha para slug
 */
const NOME_SLUG = {
  'felipi': 'felipi', 'felipi ferreira': 'felipi',
  'fabio': 'fabio', 'fabio coral': 'fabio', 'fabio sasso': 'fabio',
  'giovani': 'giovani', 'giovani cunha': 'giovani',
  'jennifer': 'jennifer', 'jennifer rodrigues': 'jennifer',
  'victor': 'victor', 'victor ferreira': 'victor',
  'barbara melo': 'barbara-melo', 'barbara mello': 'barbara-melo', 'barbara teixeira': 'barbara-melo',
  'carolina': 'carolina', 'carolina esmeraldino': 'carolina',
  'daniela': 'daniela', 'daniela stupp': 'daniela', 'daniela ferreira': 'daniela',
  'erick': 'erick', 'erick vicente': 'erick',
  'flavia': 'flavia', 'flavia cardoso': 'flavia', 'flavia felipe': 'flavia',
  'mateus': 'mateus', 'mateus alves': 'mateus',
  'bruna': 'bruna', 'bruna ferro': 'bruna',
  'patricia': 'patricia', 'patricia costa': 'patricia',
  'patricia machado': 'patricia', 'patricia macedo': 'patricia',
  'barbara leite': 'barbara-leite',
  'gabriely': 'gabriely', 'gabriely marques': 'gabriely',
  'juliana': 'juliana', 'juliana kuerten': 'juliana',
  'lais': 'lais', 'laysa': 'laysa', 'laysa gabriela': 'laysa',
  'rafaela ribeiro': 'rafaela-ribeiro', 'rafaela gubert': 'rafaela-ribeiro',
  'rafaela sampaio': 'rafaela-sampaio', 'rafaela silva': 'rafaela-sampaio',
  'renan': 'renan', 'renan maiato': 'renan',
  'sabrine': 'sabrine', 'sabrina': 'sabrine', 'sabrina neves': 'sabrine',
  'vinicyos': 'vinicyos', 'vinicyos magnus': 'vinicyos',
  'richardson': 'richardson', 'marielli': 'marielli',
};

function normalizarNome(nome) {
  if (!nome || nome === '-' || nome === 'null' || nome === '') return null;
  return nome.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function nomeParaSlug(nome) {
  if (!nome) return null;
  const normalized = normalizarNome(nome);
  if (!normalized || normalized === '-') return null;
  const primeiro = normalized.split('/')[0].trim();
  return NOME_SLUG[primeiro] || NOME_SLUG[normalized] || null;
}

module.exports = { normalizarNome, nomeParaSlug };
