/**
 * app.js - Servidor do portal individual de metas (projeto filho)
 */
const fs = require('fs');
const express = require('express');
const path = require('path');
const session = require('express-session');
const auth = require('./auth');
const { configFiltrada, ROOT, STANDALONE, PKG } = require('./config-analista');
const rotasLocal = require('./rotas-metas-local');
const rotasAcomp = require('./rotas-acomp');
const rotasNesDef = require('./rotas-nes-definicao');

const PORT = process.env.PORT_ANALISTA || 4002;
const PUBLIC = path.join(PKG, 'public');
const SHARED = STANDALONE ? path.join(PKG, 'shared') : path.join(ROOT, 'src/servidor/public');

const app = express();
app.use(express.json());
app.use(session({
  secret: 'metas-analista-escrita-2026',
  resave: false, saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));

function exigeLogin(req, res, next) {
  if (req.session.usuario) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ erro: 'Nao autenticado' });
  return res.redirect('/login.html');
}

app.post('/auth/login', (req, res) => {
  const u = auth.validarLogin(req.body && req.body.usuario, req.body && req.body.senha);
  if (!u) return res.json({ ok: false });
  req.session.usuario = u.usuario;
  req.session.slug = u.slug;
  req.session.papel = 'analista';
  if (u.trocar_senha) return res.json({ ok: true, redirect: '/trocar-senha.html' });
  res.json({ ok: true, redirect: '/metas.html' });
});

app.post('/auth/trocar-senha', (req, res) => {
  if (!req.session.usuario) return res.status(401).json({ erro: 'Nao autenticado' });
  const nova = req.body && req.body.nova_senha;
  if (!nova || nova.length < 6) return res.json({ ok: false, erro: 'Senha muito curta' });
  auth.salvarSenha(nova);
  res.json({ ok: true, redirect: '/metas.html' });
});

app.get('/auth/logout', (req, res) => req.session.destroy(() => res.redirect('/login.html')));
app.get('/auth/me', (req, res) => {
  if (!req.session.usuario) return res.status(401).json({ logado: false });
  const cfg = auth.lerUsuario();
  res.json({
    logado: true, usuario: req.session.usuario, slug: req.session.slug,
    papel: 'analista', apelido: cfg ? cfg.apelido : req.session.usuario
  });
});

app.get('/login.html', (_req, res) => res.sendFile(path.join(PUBLIC, 'login.html')));
app.get('/trocar-senha.html', exigeLogin, (_req, res) => {
  const html = path.join(SHARED, 'trocar-senha.html');
  if (fs.existsSync(html)) return res.sendFile(html);
  res.redirect('/metas.html');
});

app.use(exigeLogin);
app.use(express.static(PUBLIC));
app.use('/shared', express.static(SHARED));

app.get('/api/metas-equipe/config', (req, res) => {
  const cfg = configFiltrada(req.session.slug);
  if (!cfg) return res.status(404).json({ erro: 'Colaborador nao encontrado' });
  res.json(cfg);
});

const slugPacote = () => (auth.lerUsuario() || {}).slug;

if (STANDALONE) {
  app.use('/api', rotasLocal.criarRotas(ROOT, slugPacote()));
} else {
  const cacheMetas = require(path.join(ROOT, 'src/core/cache-metas'));
  const loader = require(path.join(ROOT, 'src/indicadores/equipe/metas-loader'));
  const rotasMetas = require(path.join(ROOT, 'src/servidor/rotas/metas-equipe'));
  app.use('/api/metas-equipe', (req, res, next) => {
    if (req.method === 'GET' && (req.path === '/' || req.path === '')) {
      return res.status(403).json({ erro: 'Acesso restrito' });
    }
    next();
  });
  app.use('/api/metas-equipe/:slug', (req, res, next) => {
    if (req.params.slug && req.params.slug !== req.session.slug) {
      return res.status(403).json({ erro: 'Acesso restrito as suas metas' });
    }
    next();
  });
  app.use('/api', rotasMetas);
  cacheMetas.restaurar();
  loader.setAno(new Date().getFullYear());
}

app.use('/api', rotasAcomp.criarRotas(STANDALONE ? slugPacote() : null));
app.use('/api', rotasNesDef.criarRotas(STANDALONE ? slugPacote() : null));
app.use('/api', (_req, res) => res.status(404).json({ erro: 'Rota nao disponivel neste portal' }));
app.get('/', (_req, res) => res.redirect('/metas.html'));
app.get('/metas.html', (_req, res) => res.sendFile(path.join(PUBLIC, 'metas.html')));
app.get('/acomp-sals.html', (_req, res) => res.sendFile(path.join(PUBLIC, 'acomp-sals.html')));
app.get('/acomp-sals-tempo.html', (_req, res) => res.sendFile(path.join(PUBLIC, 'acomp-sals-tempo.html')));
app.get('/acomp-sams.html', (_req, res) => res.sendFile(path.join(PUBLIC, 'acomp-sams.html')));
app.get('/acomp-sams-tempo.html', (_req, res) => res.sendFile(path.join(PUBLIC, 'acomp-sams-tempo.html')));
app.get('/acomp-nes-tempo.html', (_req, res) => res.sendFile(path.join(PUBLIC, 'acomp-nes-tempo.html')));
app.get('/nes-definicao.html', (_req, res) => res.sendFile(path.join(PUBLIC, 'nes-definicao.html')));

function iniciar() {
  const u = auth.lerUsuario();
  if (!u) {
    console.error('[metas-analista] Crie config/usuario.json');
    process.exit(1);
  }
  const modo = STANDALONE ? 'standalone (somente seus dados)' : 'integrado ao projeto pai';
  app.listen(PORT, '0.0.0.0', () => {
    console.log('[metas-analista] %s (%s) — %s', u.apelido || u.usuario, u.slug, modo);
    console.log('[metas-analista] http://localhost:%d', PORT);
  });
}

iniciar();
