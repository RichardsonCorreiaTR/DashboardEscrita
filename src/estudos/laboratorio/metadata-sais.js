/**
 * metadata-sais.js - Carrega metadados originais das SAIs
 *
 * Le sai-psai-folha.json do BuscaSaiFolha e constroi um mapa
 * PSAI -> { i_sai, tipo, descricao, status, gravidade }.
 * Usado para enriquecer itens auto-classificados que nao
 * tiveram metadados preservados.
 */

const fs = require('fs');
const path = require('path');

const BUSCA_SAI_PATH = path.join(
  'C:', 'Users', '6038243',
  'OneDrive - Thomson Reuters Incorporated',
  'Aplicacoes Cursor', 'BuscaSaiFolha', 'data', 'cache', 'sai-psai-folha.json'
);

let _meta = null;

function carregar() {
  if (_meta) return _meta;
  _meta = {};
  try {
    if (!fs.existsSync(BUSCA_SAI_PATH)) return _meta;
    const raw = JSON.parse(fs.readFileSync(BUSCA_SAI_PATH, 'utf-8'));
    for (const d of raw.dados) {
      if (d.nomeArea !== 'Escrita') continue;
      _meta[d.i_psai] = {
        i_sai: d.i_sai, tipo: d.tipoSAI,
        descricao: (d.sai_descricao || '').trim(),
        status: d.situacaoSai || '',
        gravidade: d.gravidade_ne || 'Normal'
      };
    }
    console.log('[meta-sais] %d SAIs Escrita indexadas', Object.keys(_meta).length);
  } catch (err) {
    console.warn('[meta-sais] Nao carregou metadata:', err.message);
  }
  return _meta;
}

function invalidar() { _meta = null; }

module.exports = { carregar, invalidar };
