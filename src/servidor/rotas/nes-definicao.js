/**
 * rotas/nes-definicao.js - API REST para NEs com Definicao
 *
 * Rotas:
 * - GET  /api/nes-definicao/dados    -> dados parseados (usa cache JSON)
 * - POST /api/nes-definicao/upload   -> envia novo Excel (octet-stream)
 * - POST /api/nes-definicao/atualizar -> re-parseia do arquivo salvo
 */
const fs = require('fs');
const path = require('path');
const { Router } = require('express');
const { parsearExcel } = require('../../core/nes-definicao-parser');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const EXCEL_PATH = path.join(DATA_DIR, 'nes-definicao.xlsx');
const CACHE_PATH = path.join(DATA_DIR, 'nes-definicao-cache.json');
const ORIGINAL_PATH = 'C:\\1 - A\\B\\Programas\\Análise de NEs.xlsx';
const router = Router();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function copiarOriginalSeNecessario() {
  if (fs.existsSync(EXCEL_PATH)) return;
  if (fs.existsSync(ORIGINAL_PATH)) {
    try { fs.copyFileSync(ORIGINAL_PATH, EXCEL_PATH); } catch { /* sem acesso */ }
  }
}

function lerCache() {
  try {
    if (fs.existsSync(CACHE_PATH)) return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch { /* cache corrompido */ }
  return null;
}

function salvarCache(dados) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(dados), 'utf8');
}

async function parsearESalvar() {
  const dados = await parsearExcel(EXCEL_PATH);
  salvarCache(dados);
  return dados;
}

// Inicializar: copiar original se necessario
ensureDataDir();
copiarOriginalSeNecessario();

router.get('/nes-definicao/dados', async (req, res) => {
  const forcar = req.query.forcar === '1';
  if (!forcar) {
    const cache = lerCache();
    if (cache) return res.json({ ...cache, _fonte: 'cache' });
  }
  if (!fs.existsSync(EXCEL_PATH)) {
    return res.status(404).json({ erro: 'Arquivo Excel nao encontrado. Faca o upload da planilha.' });
  }
  try {
    const dados = await parsearESalvar();
    res.json({ ...dados, _fonte: 'excel' });
  } catch (e) {
    res.status(500).json({ erro: 'Erro ao parsear Excel: ' + e.message });
  }
});

// Upload de novo Excel (Content-Type: application/octet-stream)
router.post('/nes-definicao/upload',
  require('express').raw({ type: 'application/octet-stream', limit: '50mb' }),
  async (req, res) => {
    if (!req.session || req.session.papel !== 'coordenador') {
      return res.status(403).json({ erro: 'Apenas coordenadores podem atualizar o arquivo' });
    }
    if (!req.body || !req.body.length) {
      return res.status(400).json({ erro: 'Nenhum arquivo recebido' });
    }
    ensureDataDir();
    fs.writeFileSync(EXCEL_PATH, req.body);
    try {
      const dados = await parsearESalvar();
      res.json({ ok: true, versoes: dados.versoes.length, _fonte: 'upload' });
    } catch (e) {
      res.status(500).json({ erro: 'Arquivo salvo mas erro ao parsear: ' + e.message });
    }
  }
);

router.post('/nes-definicao/atualizar', async (req, res) => {
  if (!req.session || req.session.papel !== 'coordenador') {
    return res.status(403).json({ erro: 'Apenas coordenadores podem atualizar' });
  }
  if (!fs.existsSync(EXCEL_PATH)) {
    return res.status(404).json({ erro: 'Arquivo Excel nao encontrado' });
  }
  try {
    const dados = await parsearESalvar();
    res.json({ ok: true, versoes: dados.versoes.length });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
