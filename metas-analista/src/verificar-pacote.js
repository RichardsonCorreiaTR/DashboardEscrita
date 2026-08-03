#!/usr/bin/env node
/**
 * verificar-pacote.js - Autodiagnostico do pacote individual de metas
 *
 * Uso: npm run verificar
 * Aponta o que falta e o que fazer, sem precisar de apoio do coordenador.
 */
const fs = require('fs');
const path = require('path');

const PKG = path.join(__dirname, '..');
const problemas = [];
const avisos = [];

const ARQUIVOS = [
  'config/usuario.json', 'config/equipe.json', 'config/metas-equipe.json',
  'config/conexao.json', 'config/pontos-definicao.json', 'config/pontos-overrides.json',
  'config/feriados.json', 'data/cache/metas-equipe.json',
  'data/planilha-escrita-2026.xlsm'
];

function checarNode() {
  const maior = Number(process.versions.node.split('.')[0]);
  if (maior < 18) {
    problemas.push('Node.js ' + process.versions.node + ' e antigo. Instale a versao 18 ou superior: https://nodejs.org');
  }
}

function checarDependencias() {
  if (!fs.existsSync(path.join(PKG, 'node_modules'))) {
    problemas.push('Dependencias nao instaladas. Rode: npm install');
    return false;
  }
  if (!fs.existsSync(path.join(PKG, 'node_modules', 'odbc'))) {
    problemas.push('Pacote odbc nao instalado. Rode: npm install');
  }
  return true;
}

function checarArquivos() {
  ARQUIVOS.forEach(rel => {
    if (fs.existsSync(path.join(PKG, rel))) return;
    if (rel === 'config/usuario.json') {
      problemas.push('Falta config/usuario.json. Extraia o ZIP novamente sem renomear pastas.');
    } else {
      problemas.push('Falta ' + rel + '. Peca ao coordenador o ZIP mais recente.');
    }
  });
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
  if (fs.existsSync(alvo + '.js')) return true;
  if (fs.existsSync(alvo) && fs.statSync(alvo).isFile()) return true;
  return fs.existsSync(path.join(alvo, 'index.js'));
}

// Um require faltando derruba o botao Atualizar com "Cannot find module"
function checarModulos() {
  const faltando = new Set();
  listarJs(path.join(PKG, 'src')).forEach(arq => {
    const txt = fs.readFileSync(arq, 'utf8');
    const re = /require\(\s*['"](\.[^'"]+)['"]\s*\)/g;
    let m;
    while ((m = re.exec(txt))) {
      const alvo = path.resolve(path.dirname(arq), m[1]);
      if (!resolverJs(alvo)) faltando.add(path.relative(PKG, alvo).replace(/\\/g, '/'));
    }
  });
  if (faltando.size) {
    problemas.push('Pacote incompleto, faltam modulos: ' + [...faltando].join(', ') +
      '. Peca ao coordenador o ZIP mais recente.');
  }
}

async function checarOdbc() {
  if (!fs.existsSync(path.join(PKG, 'node_modules', 'odbc'))) return;
  const cfgPath = path.join(PKG, 'config', 'conexao.json');
  if (!fs.existsSync(cfgPath)) return;
  const dsn = (JSON.parse(fs.readFileSync(cfgPath, 'utf8')).dsn) || 'pbcvs9';
  try {
    const odbc = require(path.join(PKG, 'node_modules', 'odbc'));
    const con = await odbc.connect('DSN=' + dsn);
    await con.close();
    console.log('  OK   Conexao ODBC (DSN ' + dsn + ')');
  } catch (err) {
    problemas.push('Nao conectou no banco pelo DSN "' + dsn + '". Configure o DSN no ' +
      'Windows (Painel de Controle > Ferramentas Administrativas > Fontes de Dados ODBC, ' +
      'aba DSN de Usuario) apontando para o PBCVS. Detalhe: ' + err.message);
  }
}

function checarCache() {
  const p = path.join(PKG, 'data', 'cache', 'metas-equipe.json');
  if (!fs.existsSync(p)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    const quando = raw._meta && raw._meta.atualizado_em;
    if (quando) console.log('  OK   Cache de metas de ' + new Date(quando).toLocaleString('pt-BR'));
  } catch {
    avisos.push('Cache local ilegivel. Use o botao Atualizar para buscar os dados no banco.');
  }
}

async function main() {
  console.log('\nVerificacao do pacote Minhas Metas\n');
  checarNode();
  const temDeps = checarDependencias();
  checarArquivos();
  checarModulos();
  checarCache();
  if (temDeps) await checarOdbc();

  if (!problemas.length) {
    console.log('\nTudo certo. Inicie com: npm start  e abra http://localhost:4002\n');
  } else {
    console.log('\nProblemas encontrados:\n');
    problemas.forEach((p, i) => console.log('  ' + (i + 1) + ') ' + p));
    console.log('');
  }
  avisos.forEach(a => console.log('  Aviso: ' + a));
  process.exitCode = problemas.length ? 1 : 0;
}

main().catch(err => { console.error('Erro na verificacao:', err.message); process.exit(1); });
