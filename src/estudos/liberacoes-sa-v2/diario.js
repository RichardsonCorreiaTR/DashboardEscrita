/**
 * liberacoes-sa-v2/diario.js - Diario do modelo (auditoria imutavel)
 *
 * Registra CADA previsao feita e CADA troca de estrategia.
 * Previsoes passadas NUNCA sao recalculadas - ficam congeladas.
 * Quando o dado real chega, complementa o registro com o resultado.
 */

const path = require('path');
const fs = require('fs');

const DIARIO_PATH = path.join(__dirname, '..', '..', '..', 'data', 'cache', 'estudos-diario-modelo.json');
const SCHEMA = 1;

let diario = carregar();

function novoVazio() {
  return {
    _meta: { versao_schema: SCHEMA },
    estrategia_atual: null,
    historico_estrategias: [],
    previsoes: {},
    calibracoes: []
  };
}

function carregar() {
  try {
    if (!fs.existsSync(DIARIO_PATH)) return novoVazio();
    const d = JSON.parse(fs.readFileSync(DIARIO_PATH, 'utf-8'));
    if (!d._meta || d._meta.versao_schema !== SCHEMA) return novoVazio();
    return d;
  } catch { return novoVazio(); }
}

function salvar() {
  const dir = path.dirname(DIARIO_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DIARIO_PATH, JSON.stringify(diario, null, 2), 'utf-8');
}

function registrarEstrategia(tipo, params, motivo) {
  const agora = new Date().toISOString();
  const anterior = diario.estrategia_atual;
  if (anterior) {
    anterior.ate = agora;
    diario.historico_estrategias.push({ ...anterior });
  }
  diario.estrategia_atual = { tipo, params, desde: agora, motivo };
  salvar();
  console.log('[diario] Estrategia registrada:', tipo, '-', motivo);
}

function registrarPrevisao(versaoAlvo, previsto, intervalo, estrategia) {
  const chave = versaoAlvo;
  if (diario.previsoes[chave] && diario.previsoes[chave].congelada) return;
  diario.previsoes[chave] = {
    previsto, intervalo,
    estrategia: estrategia.tipo,
    params: estrategia.params || {},
    data: new Date().toISOString(),
    realizado: null,
    congelada: true
  };
  salvar();
}

function atualizarRealizado(versaoAlvo, realizado) {
  if (!diario.previsoes[versaoAlvo]) return;
  const p = diario.previsoes[versaoAlvo];
  p.realizado = realizado;
  p.erro = realizado > 0
    ? Math.round(Math.abs(p.previsto - realizado) / realizado * 1000) / 10
    : null;
  p.acertou_intervalo = realizado >= p.intervalo.baixo && realizado <= p.intervalo.alto;
  salvar();
}

function registrarCalibracao(resultado) {
  diario.calibracoes.push({
    data: new Date().toISOString(),
    estrategias_testadas: resultado.testadas,
    vencedora: resultado.vencedora,
    mape_vencedora: resultado.mape,
    mape6m_vencedora: resultado.mape6m,
    atual_antes: resultado.atual_antes,
    mape_atual: resultado.mape_atual,
    decisao: resultado.decisao,
    motivo: resultado.motivo
  });
  salvar();
}

function obterDiario() { return diario; }

function gerarResumoParaFrontend(cacheNE, cacheDesc) {
  const { neLiquida } = require('./previsao');
  const prevs = Object.entries(diario.previsoes).map(([v, p]) => {
    const real = p.realizado != null ? p.realizado : null;
    if (real === null && cacheNE && cacheNE[v]) {
      const liq = neLiquida(cacheNE, cacheDesc, v);
      if (liq !== null) {
        atualizarRealizado(v, liq);
        return { ...diario.previsoes[v], versao: v };
      }
    }
    return { ...p, versao: v };
  }).sort((a, b) => a.versao.localeCompare(b.versao));

  return {
    estrategia_atual: diario.estrategia_atual,
    historico_estrategias: diario.historico_estrategias,
    previsoes: prevs,
    calibracoes: diario.calibracoes.slice(-10)
  };
}

module.exports = {
  registrarEstrategia, registrarPrevisao, atualizarRealizado,
  registrarCalibracao, obterDiario, gerarResumoParaFrontend, carregar
};
