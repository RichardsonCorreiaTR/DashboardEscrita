/**
 * exportar-pacote-lib.js - Logica compartilhada de exportacao de pacote individual
 */
const fs = require('fs');
const path = require('path');

const SHARED_JS = [
  'format-utils.js', 'metas-config.js', 'equipes-mensal.js', 'equipes-detalhe.js',
  'equipes-ne-definicao.js', 'equipes-conclusao-pontos.js'
];

const BACKEND_CORE = [
  'conexao.js', 'query-executor.js', 'planilha-escrita.js', 'planilha-cruzamento.js',
  'ss-respondidas-shared.js', 'cache-ss-respondidas.js', 'consultas-ne.js', 'versao.js'
];

function copiarBackendMetas(root, dest) {
  BACKEND_CORE.forEach(f => {
    const src = path.join(root, 'src/core', f);
    if (fs.existsSync(src)) copiar(src, path.join(dest, 'src/core', f));
  });
  copiarDir(path.join(root, 'src/indicadores/equipe'), path.join(dest, 'src/indicadores/equipe'));
  copiar(path.join(root, 'config/conexao.json'), path.join(dest, 'config/conexao.json'));
  copiar(path.join(root, 'config/pontos-definicao.json'), path.join(dest, 'config/pontos-definicao.json'));
  const planilha = path.join(root, 'data/planilha-escrita-2026.xlsm');
  if (fs.existsSync(planilha)) copiar(planilha, path.join(dest, 'data/planilha-escrita-2026.xlsm'));
}

function copiar(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copiarDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  fs.readdirSync(srcDir).forEach(f => {
    const s = path.join(srcDir, f), d = path.join(destDir, f);
    if (fs.statSync(s).isDirectory()) copiarDir(s, d);
    else copiar(s, d);
  });
}

function cacheFiltrado(root, slug) {
  const full = path.join(root, 'data', 'cache', 'metas-equipe.json');
  if (!fs.existsSync(full)) return null;
  const raw = JSON.parse(fs.readFileSync(full, 'utf8'));
  if (!raw[slug]) return null;
  return { _meta: raw._meta || { atualizado_em: null }, [slug]: raw[slug] };
}

function listarAnalistas(root) {
  const equipe = JSON.parse(fs.readFileSync(path.join(root, 'config', 'equipe.json'), 'utf8'));
  return equipe.analistas.filter(a => a.papel === 'analista');
}

function exportarPacote(root, slug, opts) {
  const saidaBase = (opts && opts.saidaBase) || path.join(root, 'output', 'pacotes-analista');
  const equipe = JSON.parse(fs.readFileSync(path.join(root, 'config', 'equipe.json'), 'utf8'));
  const usuarios = JSON.parse(fs.readFileSync(path.join(root, 'config', 'usuarios.json'), 'utf8'));
  const colab = equipe.analistas.find(a => a.slug === slug && a.papel === 'analista');
  const user = usuarios.find(u => u.slug === slug && u.papel === 'analista');
  const cache = cacheFiltrado(root, slug);
  if (!colab || !user) return { ok: false, slug, erro: 'Analista nao encontrado' };
  if (!cache) return { ok: false, slug, erro: 'Sem cache' };

  const dest = path.join(saidaBase, 'Metas-' + slug);
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });

  const srcPortal = path.join(root, 'metas-analista');
  copiarDir(path.join(srcPortal, 'public'), path.join(dest, 'public'));
  copiarDir(path.join(srcPortal, 'src'), path.join(dest, 'src'));
  copiar(path.join(srcPortal, 'package.json'), path.join(dest, 'package.json'));

  SHARED_JS.forEach(f => copiar(
    path.join(root, 'src/servidor/public/js', f), path.join(dest, 'shared/js', f)
  ));
  copiar(path.join(root, 'src/servidor/public/css/app.css'), path.join(dest, 'shared/css/app.css'));
  copiar(path.join(root, 'src/servidor/public/trocar-senha.html'), path.join(dest, 'shared/trocar-senha.html'));

  fs.mkdirSync(path.join(dest, 'config'), { recursive: true });
  fs.writeFileSync(path.join(dest, 'config', 'usuario.json'), JSON.stringify({
    usuario: user.usuario, senha: user.senha, slug: colab.slug,
    apelido: colab.apelido || colab.nome, trocar_senha: user.trocar_senha || false
  }, null, 2));
  fs.writeFileSync(path.join(dest, 'config', 'equipe.json'), JSON.stringify({
    modulo: equipe.modulo, nome: equipe.nome, analistas: [colab]
  }, null, 2));
  copiar(path.join(root, 'config/metas-equipe.json'), path.join(dest, 'config/metas-equipe.json'));
  copiarBackendMetas(root, dest);
  fs.mkdirSync(path.join(dest, 'data/cache'), { recursive: true });
  fs.writeFileSync(path.join(dest, 'data/cache/metas-equipe.json'), JSON.stringify(cache, null, 2));
  fs.writeFileSync(path.join(dest, '.standalone'), '');
  const ref = (opts && opts.referencia) || new Date().toISOString().slice(0, 7);
  fs.writeFileSync(path.join(dest, 'LEIA-ME.txt'),
    'Minhas Metas — Escrita Fiscal\r\nReferencia: ' + ref + '\r\n\r\n' +
    '1. Instale Node.js 18+\r\n2. npm install\r\n3. npm start\r\n4. http://localhost:4002\r\n\r\n' +
    'Use o botao Atualizar para buscar seus dados no banco (DSN pbcvs9).\r\n' +
    'Somente suas consultas SQL sao executadas.\r\n\r\n' +
    'Login: ' + user.usuario + '\r\n' +
    (user.trocar_senha ? 'Troque a senha no primeiro acesso.\r\n' : '') +
    '\r\nPacote individual — contem somente seus dados.\r\n'
  );
  return { ok: true, slug, apelido: colab.apelido, usuario: user.usuario, dest };
}

module.exports = { exportarPacote, listarAnalistas, cacheFiltrado, SHARED_JS, copiarBackendMetas };
