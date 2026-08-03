/**
 * auth.js - Autenticacao do portal individual (um usuario por instalacao)
 */
const fs = require('fs');
const path = require('path');

const USUARIO_PATH = path.join(__dirname, '..', 'config', 'usuario.json');

function lerUsuario() {
  if (!fs.existsSync(USUARIO_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(USUARIO_PATH, 'utf8')); } catch { return null; }
}

function validarLogin(usuario, senha) {
  const u = lerUsuario();
  if (!u) return null;
  if (u.usuario.toLowerCase() !== (usuario || '').toLowerCase() || u.senha !== senha) return null;
  return u;
}

function salvarSenha(novaSenha) {
  const u = lerUsuario();
  if (!u) return false;
  u.senha = novaSenha;
  u.trocar_senha = false;
  fs.writeFileSync(USUARIO_PATH, JSON.stringify(u, null, 2), 'utf8');
  return u;
}

module.exports = { lerUsuario, validarLogin, salvarSenha, USUARIO_PATH };
