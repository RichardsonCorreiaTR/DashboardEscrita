/**
 * app.js - Servidor Express do Dashboard Diretrizes
 *
 * Responsabilidades:
 * - Servir o dashboard SPA (arquivos estaticos)
 * - Expor API REST para indicadores, versao e historico
 * - Restaurar cache de disco na startup
 * - Iniciar agendador de snapshots do historico
 *
 * Porta: 4000 (configuravel via env PORT)
 */

const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');
const session = require('express-session');

const indicadores = require('../indicadores');
const conexao = require('../core/conexao');
const cache = require('../core/cache');
const cacheMetas = require('../core/cache-metas');
const agendador = require('../core/agendador');
const qe = require('../core/query-executor');

const rotasIndicadores = require('./rotas/indicadores');
const rotasHistorico = require('./rotas/historico');
const rotasEstudos = require('./rotas/estudos');
const rotasMetasEquipe = require('./rotas/metas-equipe');
const rotasLaboratorio = require('./rotas/laboratorio');
const rotasPropostaMetas = require('./rotas/proposta-metas');
const rotasDescartesTempo = require('./rotas/descartes-tempo');

const PORT = process.env.PORT || 4000;
const USUARIOS_PATH = path.join(__dirname, '..', '..', 'config', 'usuarios.json');

function lerUsuarios() {
  try { return JSON.parse(fs.readFileSync(USUARIOS_PATH, 'utf8')); } catch { return []; }
}

const app = express();

app.use(express.json());
app.use(session({
  secret: 'escrita-fiscal-2026-dashboard',
  resave: false, saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 horas
}));

// Rota de login
app.post('/auth/login', (req, res) => {
  const { usuario, senha } = req.body || {};
  const usuarios = lerUsuarios();
  const u = usuarios.find(x => x.usuario.toLowerCase() === (usuario || '').toLowerCase() && x.senha === senha);
  if (!u) return res.json({ ok: false });
  req.session.usuario = u.usuario;
  req.session.slug = u.slug;
  req.session.papel = u.papel;
  if (u.trocar_senha) return res.json({ ok: true, redirect: '/trocar-senha.html' });
  const redirect = u.papel === 'coordenador'
    ? '/equipes.html'
    : '/equipes.html?colaborador=' + u.slug;
  res.json({ ok: true, redirect });
});

// Rota para trocar senha no primeiro acesso
app.post('/auth/trocar-senha', (req, res) => {
  if (!req.session.usuario) return res.status(401).json({ erro: 'Nao autenticado' });
  const { nova_senha } = req.body || {};
  if (!nova_senha || nova_senha.length < 6) return res.json({ ok: false, erro: 'Senha muito curta' });
  const usuarios = lerUsuarios();
  const idx = usuarios.findIndex(x => x.usuario.toLowerCase() === (req.session.usuario || '').toLowerCase());
  if (idx < 0) return res.json({ ok: false, erro: 'Usuario nao encontrado' });
  usuarios[idx].senha = nova_senha;
  usuarios[idx].trocar_senha = false;
  fs.writeFileSync(USUARIOS_PATH, JSON.stringify(usuarios, null, 2), 'utf8');
  const u = usuarios[idx];
  const redirect = u.papel === 'coordenador' ? '/equipes.html' : '/equipes.html?colaborador=' + u.slug;
  res.json({ ok: true, redirect });
});

// Rota de logout
app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login.html'));
});

// Endpoint: retorna dados do usuario logado
app.get('/auth/me', (req, res) => {
  if (!req.session.usuario) return res.status(401).json({ logado: false });
  res.json({ logado: true, usuario: req.session.usuario, slug: req.session.slug, papel: req.session.papel });
});

// Middleware: proteger tudo exceto login e assets publicos
const PUBLICOS = ['/login.html', '/trocar-senha.html', '/auth/login', '/auth/trocar-senha', '/css/', '/js/', '/favicon'];
app.use((req, res, next) => {
  const livre = PUBLICOS.some(p => req.path.startsWith(p));
  if (livre || req.session.usuario) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ erro: 'Nao autenticado' });
  res.redirect('/login.html');
});

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', rotasIndicadores);
app.use('/api', rotasHistorico);
app.use('/api', rotasEstudos);
app.use('/api', rotasMetasEquipe);
app.use('/api', rotasLaboratorio);
app.use('/api', rotasPropostaMetas);
app.use('/api', rotasDescartesTempo);

app.get('/api/saude', (req, res) => {
  res.json({
    status: 'ok',
    indicadores: indicadores.listar().length,
    cache: cache.estatisticas(),
    cache_disco: cache.ultimaAtualizacaoDisco(),
    timestamp: new Date().toISOString()
  });
});

async function iniciar() {
  try {
    // Restaurar cache de disco (antes de tudo)
    cache.restaurarDoDisco();
    cacheMetas.restaurar();

    try {
      await conexao.inicializar();
      console.log('[servidor] Conexao ODBC inicializada');
    } catch (errOdbc) {
      console.warn('[servidor] ODBC indisponivel: %s', errOdbc.message);
      console.warn('[servidor] Iniciando em modo cache/offline');
    }

    indicadores.inicializar();
    console.log('[servidor] Indicadores carregados: %d', indicadores.listar().length);

    // Iniciar agendador de snapshots (8h, 12h, 18h em dias uteis)
    agendador.iniciar(indicadores, qe);

    app.listen(PORT, '0.0.0.0', () => {
      const ipLocal = Object.values(os.networkInterfaces())
        .flat()
        .find(i => i.family === 'IPv4' && !i.internal);
      console.log('[servidor] Dashboard rodando em http://localhost:%d', PORT);
      if (ipLocal) {
        console.log('[servidor] Acesso na rede:    http://%s:%d', ipLocal.address, PORT);
      }
    });
  } catch (err) {
    console.error('[servidor] Erro ao iniciar:', err.message);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\n[servidor] Encerrando...');
  agendador.parar();
  await conexao.fechar();
  process.exit(0);
});

iniciar();
