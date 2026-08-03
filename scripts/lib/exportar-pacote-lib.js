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
  'ss-respondidas-shared.js', 'cache-ss-respondidas.js', 'consultas-ne.js', 'versao.js',
  'date-utils.js'
];

function copiarBackendMetas(root, dest) {
  BACKEND_CORE.forEach(f => {
    const src = path.join(root, 'src/core', f);
    if (fs.existsSync(src)) copiar(src, path.join(dest, 'src/core', f));
  });
  copiarDir(path.join(root, 'src/indicadores/equipe'), path.join(dest, 'src/indicadores/equipe'));
  copiarDependenciasFaltantes(root, dest);
  copiar(path.join(root, 'config/conexao.json'), path.join(dest, 'config/conexao.json'));
  copiar(path.join(root, 'config/pontos-definicao.json'), path.join(dest, 'config/pontos-definicao.json'));
  copiar(path.join(root, 'config/feriados.json'), path.join(dest, 'config/feriados.json'));
  // Sem os overrides o recalculo local usa o nivel do SGD e divergo da planilha
  const overrides = path.join(root, 'config/pontos-overrides.json');
  if (!fs.existsSync(overrides)) throw new Error('config/pontos-overrides.json ausente');
  copiar(overrides, path.join(dest, 'config/pontos-overrides.json'));
  const planilha = path.join(root, 'data/planilha-escrita-2026.xlsm');
  if (fs.existsSync(planilha)) copiar(planilha, path.join(dest, 'data/planilha-escrita-2026.xlsm'));
}

function listarJs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap(f => {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) return listarJs(full);
    return f.endsWith('.js') ? [full] : [];
  });
}

function resolverJs(alvo) {
  if (fs.existsSync(alvo + '.js')) return alvo + '.js';
  if (fs.existsSync(alvo) && fs.statSync(alvo).isFile()) return alvo;
  const idx = path.join(alvo, 'index.js');
  return fs.existsSync(idx) ? idx : null;
}

function depsFaltantes(root, dest, arquivo) {
  const re = /require\(\s*['"](\.[^'"]+)['"]\s*\)/g;
  const txt = fs.readFileSync(arquivo, 'utf8');
  const out = [];
  let m;
  while ((m = re.exec(txt))) {
    const alvo = path.resolve(path.dirname(arquivo), m[1]);
    if (resolverJs(alvo)) continue;
    const noRoot = resolverJs(path.join(root, path.relative(dest, alvo)));
    if (noRoot) out.push(noRoot);
  }
  return out;
}

// Fecha a arvore de dependencias: um require faltando quebra o botao Atualizar
function copiarDependenciasFaltantes(root, dest) {
  for (let passo = 0; passo < 10; passo++) {
    let copiou = false;
    listarJs(path.join(dest, 'src')).forEach(arq => {
      depsFaltantes(root, dest, arq).forEach(noRoot => {
        copiar(noRoot, path.join(dest, path.relative(root, noRoot)));
        copiou = true;
      });
    });
    if (!copiou) return;
  }
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
  fs.writeFileSync(path.join(dest, 'LEIA-ME.txt'), textoLeiaMe(ref, user));
  return { ok: true, slug, apelido: colab.apelido, usuario: user.usuario, dest };
}

function textoLeiaMe(ref, user) {
  return [
    'Minhas Metas — Escrita Fiscal',
    'Referencia: ' + ref,
    '',
    'INSTALACAO (uma vez so)',
    '1. Instale o Node.js 18 ou superior: https://nodejs.org',
    '2. Extraia este ZIP em uma pasta sem acentos, ex.: C:\\Metas',
    '3. Abra o PowerShell na pasta que contem o arquivo package.json',
    '4. Rode: npm install',
    '5. Rode: npm run verificar   (confere se esta tudo no lugar)',
    '',
    'USO NO DIA A DIA',
    '1. Rode: npm start',
    '2. Abra http://localhost:4002',
    '3. Login: ' + user.usuario,
    (user.trocar_senha ? '4. Troque a senha no primeiro acesso' : '4. Use sua senha atual'),
    '5. Clique em Atualizar para buscar seus dados no banco',
    '',
    'PRE-REQUISITO DO BANCO',
    'O botao Atualizar usa o DSN ODBC "pbcvs9" do seu Windows.',
    'Se ele nao existir: Painel de Controle > Ferramentas Administrativas >',
    'Fontes de Dados ODBC (64 bits) > aba DSN de Usuario > Adicionar,',
    'escolha o driver do SQL Anywhere e nomeie o DSN como pbcvs9.',
    'Sem o DSN o portal ainda abre, mas mostra os dados do ultimo envio.',
    '',
    'SE DER ERRO',
    'Rode: npm run verificar — ele diz exatamente o que fazer.',
    '- "Cannot find module" ou "Pacote incompleto": peca o ZIP mais recente.',
    '- "npm nao e reconhecido": o Node.js nao foi instalado ou falta reabrir o PowerShell.',
    '- "porta em uso": feche a outra janela do portal e rode npm start de novo.',
    '',
    'Pacote individual — contem somente os seus dados.',
    'Somente as suas consultas SQL sao executadas.',
    ''
  ].join('\r\n');
}

module.exports = { exportarPacote, listarAnalistas, cacheFiltrado, SHARED_JS, copiarBackendMetas };
