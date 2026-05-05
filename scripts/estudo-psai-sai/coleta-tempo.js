/**
 * coleta-tempo.js - Extrai dados de tempo/atividades dos analistas
 *
 * Periodo: Nov/2025 a Mar/2026
 * Fontes: vanalise_registro_atividades, psai_tramites
 */

const path = require('path');
const fs = require('fs');
const { executar } = require('../../src/core/query-executor');
const q = require('./queries');

const CACHE_DIR = path.join(__dirname, '..', '..', 'data', 'cache', 'estudo-psai-sai');

function salvar(nome, dados) {
  const arq = path.join(CACHE_DIR, `${nome}.json`);
  fs.writeFileSync(arq, JSON.stringify(dados, null, 2), 'utf-8');
  console.log('  Salvo: %s (%d bytes)', arq, fs.statSync(arq).size);
}

function categorizarAtividade(nome) {
  if (!nome) return 'outros';
  const n = nome.toLowerCase();
  if (/\bne\b|notifica/.test(n)) return 'ne';
  if (/\bsai\b|solicita/.test(n)) return 'sai';
  if (/\bss\b|suporte/.test(n)) return 'ss';
  if (/defini[cç]/.test(n)) return 'definicao';
  if (/teste|retorno/.test(n)) return 'teste';
  if (/reuni[aã]o|meet/.test(n)) return 'reuniao';
  if (/f[eé]rias|feriado|folga|afasta|sa[ií]da/.test(n)) return 'ausencia';
  return 'outros';
}

async function coletarAtividades() {
  console.log('\n--- Registro de Atividades (Nov/2025 - Mar/2026) ---');
  const rows = await executar(q.queryAtividades(11, 2025, 3, 2026));
  console.log('  Total registros brutos: %d', rows.length);

  const porAnalista = {};
  for (const e of q.EQUIPE) {
    porAnalista[e.iu] = { ...e, meses: {} };
  }

  for (const r of rows) {
    const analista = porAnalista[r.i_usuarios];
    if (!analista) continue;
    const mesKey = r.dia.substring(0, 7);
    if (!analista.meses[mesKey]) {
      analista.meses[mesKey] = { total: 0, categorias: {}, registros: 0 };
    }
    const m = analista.meses[mesKey];
    const cat = categorizarAtividade(r.atividade);
    m.total += r.minutos;
    m.categorias[cat] = (m.categorias[cat] || 0) + r.minutos;
    m.registros += r.registros;
  }

  salvar('atividades', porAnalista);
  for (const e of q.EQUIPE) {
    const a = porAnalista[e.iu];
    const meses = Object.keys(a.meses).sort();
    const totalH = meses.reduce((s, m) => s + a.meses[m].total, 0) / 60;
    console.log('  %s: %d meses, %.1fh total', e.nome, meses.length, totalH);
  }
  return porAnalista;
}

async function coletarTramitacoes() {
  console.log('\n--- Tramitacoes PSAI (Nov/2025 - Mar/2026) ---');
  const rows = await executar(q.queryTramitacoesPsai(11, 2025, 3, 2026));
  console.log('  Total tramitacoes brutas: %d', rows.length);

  const comEnvio = rows.filter(r => r.data_envio);
  console.log('  Com data_envio (ciclo completo): %d', comEnvio.length);

  const ciclos = comEnvio.map(r => {
    const envio = new Date(r.data_envio);
    const resp = new Date(r.data_resposta);
    const diffDias = Math.round((resp - envio) / 86400000);
    return {
      i_psai: r.i_psai, i_usuarios: r.i_usuarios,
      data_envio: r.data_envio, data_resposta: r.data_resposta,
      i_situacoes: r.i_situacoes, dias_corridos: diffDias
    };
  });

  salvar('tramitacoes', ciclos);
  const media = ciclos.length > 0
    ? (ciclos.reduce((s, c) => s + c.dias_corridos, 0) / ciclos.length).toFixed(1)
    : 'N/A';
  console.log('  Media dias corridos (envio->resposta): %s', media);
  return ciclos;
}

async function executarColetaTempo() {
  console.log('=== COLETA DE TEMPO/ATIVIDADES (Nov/2025 - Mar/2026) ===');
  const atividades = await coletarAtividades();
  const tramitacoes = await coletarTramitacoes();
  return { atividades, tramitacoes };
}

module.exports = { executarColetaTempo, categorizarAtividade };
