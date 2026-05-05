/**
 * liberacoes-sa.js - Analise de liberacoes de SA (SAM, SAL, SAIL) por versao
 *
 * Coleta liberacoes de Solicitacoes de Atendimento por versao (2022+)
 * e calcula estatisticas, complexidade, correlacao com NE e previsao.
 *
 * Tipos:
 *   SAM  = Solicitacao de Melhoria
 *   SAL  = Solicitacao de Alteracao Legal
 *   SAIL = Solicitacao de Implementacao Legal
 *
 * Campos-chave:
 *   nivel_alteracao (bethadba.psai): 1=Baixo, 2=Medio, 3=Alto, null=Nao informado
 *   tempoPrevistoTotal (SAI_PSAI): tempo previsto em minutos (proxy de complexidade)
 *   tempoRealizadoTotal (SAI_PSAI): tempo realizado em minutos
 *   qtde_ssc (SAI_PSAI): qtde subitens de construcao (abrangencia)
 *
 * Algoritmo IIL (Indice de Impacto de Liberacao) - 0 a 100:
 *   Mede o risco de uma versao gerar NEs na versao seguinte.
 *   Fatores: Volume (20pts), Complexidade (30pts), Perfil de Risco (25pts),
 *            Desvio Estimativa (15pts), Abrangencia (10pts)
 *
 * Modelo de Previsao:
 *   Regressao linear: Carga Ponderada (versao N) -> NEs previstas (versao N+1)
 *   Carga = soma(pesoComplexidade * pesoTipo * pesoDesvio * pesoAbrangencia) por SA
 *
 * Cache: data/cache/estudos-liberacoes-sa.json
 */

const path = require('path');
const fs = require('fs');

const versao = require('../core/versao');

const CACHE_DIR = path.join(__dirname, '..', '..', 'data', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'estudos-liberacoes-sa.json');

const VERSAO_INICIO = { ano: 2022, mes: 2 };

const NIVEIS_LABEL = { 1: 'Baixo', 2: 'Medio', 3: 'Alto', null: 'Nao informado' };

const FAIXAS_COMPLEXIDADE = [
  { id: 'baixa',      label: 'Baixa (ate 2h)',            max: 120,      peso: 1 },
  { id: 'media',      label: 'Media (2h-8h)',             max: 480,      peso: 2 },
  { id: 'alta',       label: 'Alta (8h-40h)',             max: 2400,     peso: 4 },
  { id: 'muito_alta', label: 'Muito Alta (mais de 40h)',  max: Infinity, peso: 8 }
];

const PESO_TIPO = { SAM: 1.0, SAL: 1.3, SAIL: 1.5 };

/* ============== UTILITARIOS MATH ============== */

function round2(v) { return Math.round(v * 100) / 100; }

function mediana(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function media(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function desvioPadrao(arr) {
  if (arr.length < 2) return 0;
  const m = media(arr);
  return Math.sqrt(arr.map(v => (v - m) ** 2).reduce((a, b) => a + b, 0) / arr.length);
}

/* ============== CACHE DISCO ============== */

let cacheSA = { _meta: { atualizado_em: null, versao_schema: 4 }, versoes: {} };

function garantirDiretorio() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function restaurarCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return;
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed._meta && parsed._meta.versao_schema === 4) {
      cacheSA = parsed;
    } else {
      console.log('[liberacoes-sa] Cache schema antigo, sera recalculado');
      cacheSA = { _meta: { atualizado_em: null, versao_schema: 4 }, versoes: {} };
    }
    if (!cacheSA.versoes) cacheSA.versoes = {};
    console.log('[liberacoes-sa] Cache restaurado: %d versoes', Object.keys(cacheSA.versoes).length);
  } catch (err) {
    console.error('[liberacoes-sa] Erro ao restaurar cache:', err.message);
    cacheSA = { _meta: { atualizado_em: null, versao_schema: 4 }, versoes: {} };
  }
}

function salvarCache() {
  garantirDiretorio();
  cacheSA._meta.atualizado_em = new Date().toISOString();
  cacheSA._meta.versao_schema = 4;
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheSA, null, 2), 'utf-8');
  } catch (err) {
    console.error('[liberacoes-sa] Erro ao salvar cache:', err.message);
  }
}

/* ============== LISTAGEM DE VERSOES ============== */

function listarVersoesEsperadas() {
  const nomes = [];
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;
  let ano = VERSAO_INICIO.ano;
  let mes = VERSAO_INICIO.mes;
  while (ano < anoAtual || (ano === anoAtual && mes <= mesAtual)) {
    nomes.push(versao.nomeDaVersao(ano, mes));
    mes++;
    if (mes > 12) { mes = 1; ano++; }
  }
  nomes.push(versao.nomeDaVersao(ano, mes));
  return nomes;
}

/* ============== QUERIES ============== */

function queryLiberacoesSA(nomeVersao) {
  return `
    SELECT sai_psai.i_psai,
           sai_psai.tipoSAI,
           psai.nivel_alteracao,
           sai_psai.Liberacao,
           sai_psai.tempoPrevistoTotal,
           sai_psai.tempoRealizadoTotal,
           sai_psai.qtde_ssc,
           CAST(SUBSTRING(psai.descricao, 1, 150) AS BINARY) AS descricao
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI IN ('SAM', 'SAL', 'SAIL')
      AND sai_psai.nomeVersao = '${nomeVersao}'
      AND sai_psai.Liberacao IS NOT NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
  `;
}

function queryLiberacoesArquivo(nomeVersao) {
  const anterior = versao.versaoAnterior(nomeVersao);
  if (!anterior) return null;
  return `
    SELECT sai_psai.i_psai,
           sai_psai.tipoSAI,
           psai.nivel_alteracao,
           sai_psai.Liberacao,
           sai_psai.tempoPrevistoTotal,
           sai_psai.tempoRealizadoTotal,
           sai_psai.qtde_ssc,
           CAST(SUBSTRING(psai.descricao, 1, 150) AS BINARY) AS descricao
    FROM UP.SAI_PSAI sai_psai
    JOIN bethadba.psai psai ON sai_psai.i_psai = psai.i_psai
    WHERE sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI IN ('SAM', 'SAL', 'SAIL')
      AND sai_psai.nomeVersao LIKE '${anterior}.%'
      AND sai_psai.Liberacao IS NOT NULL
      AND COALESCE(psai.i_produto_grupo, 1) = 1
  `;
}

/* ============== COMPLEXIDADE ============== */

function classificarFaixa(tempoMin) {
  if (!tempoMin || tempoMin <= 0) return FAIXAS_COMPLEXIDADE[0];
  for (const f of FAIXAS_COMPLEXIDADE) {
    if (tempoMin <= f.max) return f;
  }
  return FAIXAS_COMPLEXIDADE[FAIXAS_COMPLEXIDADE.length - 1];
}

function calcularCargaRegistro(r) {
  const faixa = classificarFaixa(r.tempoPrevistoTotal);
  const pesoComplex = faixa.peso;
  const pesoTipo = PESO_TIPO[r.tipoSAI] || 1;
  let pesoDesvio = 1;
  if (r.tempoPrevistoTotal > 0 && r.tempoRealizadoTotal > 0) {
    pesoDesvio = Math.min(r.tempoRealizadoTotal / r.tempoPrevistoTotal, 2.5);
    pesoDesvio = Math.max(pesoDesvio, 0.5);
  }
  const ssc = r.qtde_ssc || 0;
  const pesoAbrangencia = 1 + Math.min(ssc, 10) * 0.08;
  return round2(pesoComplex * pesoTipo * pesoDesvio * pesoAbrangencia);
}

/* ============== COLETA E AGREGACAO ============== */

function agregarLiberacoes(registros) {
  const porTipo = { SAM: 0, SAL: 0, SAIL: 0 };
  const porNivel = {};
  const porTipoENivel = { SAM: {}, SAL: {}, SAIL: {} };
  const porFaixa = {};
  FAIXAS_COMPLEXIDADE.forEach(f => { porFaixa[f.id] = 0; });

  let cargaTotal = 0;
  let horasPrevistas = 0;
  let horasRealizadas = 0;
  let somaSSC = 0;
  let countComTempo = 0;

  for (const r of registros) {
    const tipo = r.tipoSAI;
    const nivelRaw = r.nivel_alteracao;
    const nivel = NIVEIS_LABEL[nivelRaw] || NIVEIS_LABEL[null];

    if (porTipo[tipo] !== undefined) porTipo[tipo]++;
    porNivel[nivel] = (porNivel[nivel] || 0) + 1;
    if (porTipoENivel[tipo]) {
      porTipoENivel[tipo][nivel] = (porTipoENivel[tipo][nivel] || 0) + 1;
    }

    const faixa = classificarFaixa(r.tempoPrevistoTotal);
    porFaixa[faixa.id]++;
    cargaTotal += calcularCargaRegistro(r);

    const tp = r.tempoPrevistoTotal || 0;
    const tr = r.tempoRealizadoTotal || 0;
    if (tp > 0) { horasPrevistas += tp; countComTempo++; }
    horasRealizadas += tr;
    somaSSC += (r.qtde_ssc || 0);
  }

  const n = registros.length || 1;
  const desvioEstimativa = horasPrevistas > 0
    ? round2(((horasRealizadas - horasPrevistas) / horasPrevistas) * 100) : 0;

  return {
    totalLiberacoes: registros.length,
    porTipo, porNivel, porTipoENivel,
    complexidade: {
      porFaixa,
      cargaPonderada: round2(cargaTotal),
      horasPrevistoTotal: round2(horasPrevistas / 60),
      horasRealizadoTotal: round2(horasRealizadas / 60),
      desvioEstimativa,
      mediaSSC: round2(somaSSC / n),
      mediaTempoPrevisto: countComTempo > 0 ? round2(horasPrevistas / countComTempo) : 0,
      faixaPredominante: Object.entries(porFaixa).sort((a, b) => b[1] - a[1])[0][0]
    }
  };
}

function extrairItens(registros, origem) {
  return registros.map(r => ({
    psai: r.i_psai,
    tipo: r.tipoSAI,
    descricao: (r.descricao || '').trim(),
    nivel: NIVEIS_LABEL[r.nivel_alteracao] || NIVEIS_LABEL[null],
    tempoPrev: r.tempoPrevistoTotal || 0,
    tempoReal: r.tempoRealizadoTotal || 0,
    ssc: r.qtde_ssc || 0,
    faixa: classificarFaixa(r.tempoPrevistoTotal).id,
    origem
  }));
}

async function coletarVersao(executor, nomeVersao, forceOdbc) {
  if (!forceOdbc && cacheSA.versoes[nomeVersao]) {
    return cacheSA.versoes[nomeVersao];
  }
  try {
    const regDiretos = await executor.executar(queryLiberacoesSA(nomeVersao));
    let regArquivo = [];
    const qArq = queryLiberacoesArquivo(nomeVersao);
    if (qArq) { try { regArquivo = await executor.executar(qArq); } catch { /* ok */ } }

    const todosReg = [...regDiretos, ...regArquivo];
    const agregado = agregarLiberacoes(todosReg);

    const itens = [
      ...extrairItens(regDiretos, 'versao'),
      ...extrairItens(regArquivo, 'arquivo')
    ];

    const dados = {
      versao: nomeVersao,
      ...agregado,
      itens,
      liberacoesVersao: regDiretos.length,
      liberacoesArquivo: regArquivo.length
    };
    cacheSA.versoes[nomeVersao] = dados;
    return dados;
  } catch (err) {
    console.warn('[liberacoes-sa] Erro em %s: %s', nomeVersao, err.message);
    return cacheSA.versoes[nomeVersao] || null;
  }
}

/* ============== ESTATISTICAS ============== */

function calcularEstatisticas(versoes) {
  if (versoes.length === 0) return null;

  const totais = versoes.map(v => v.totalLiberacoes);
  const sams = versoes.map(v => v.porTipo.SAM);
  const sals = versoes.map(v => v.porTipo.SAL);
  const sails = versoes.map(v => v.porTipo.SAIL);
  const cargas = versoes.map(v => v.complexidade ? v.complexidade.cargaPonderada : 0);
  const horasP = versoes.map(v => v.complexidade ? v.complexidade.horasPrevistoTotal : 0);

  const dp = desvioPadrao(totais);
  const m = media(totais);
  const outliers = versoes.filter(v => Math.abs(v.totalLiberacoes - m) > 2 * dp).map(v => v.versao);

  const proporcoes = versoes.map(v => {
    const t = v.totalLiberacoes || 1;
    return { SAM: round2((v.porTipo.SAM / t) * 100), SAL: round2((v.porTipo.SAL / t) * 100), SAIL: round2((v.porTipo.SAIL / t) * 100) };
  });

  return {
    totalVersoes: versoes.length,
    total: { media: round2(media(totais)), mediana: round2(mediana(totais)), min: Math.min(...totais), max: Math.max(...totais), desvioPadrao: round2(dp) },
    porTipo: {
      SAM: { media: round2(media(sams)), mediana: round2(mediana(sams)) },
      SAL: { media: round2(media(sals)), mediana: round2(mediana(sals)) },
      SAIL: { media: round2(media(sails)), mediana: round2(mediana(sails)) }
    },
    proporcaoMedia: { SAM: round2(media(proporcoes.map(p => p.SAM))), SAL: round2(media(proporcoes.map(p => p.SAL))), SAIL: round2(media(proporcoes.map(p => p.SAIL))) },
    carga: { media: round2(media(cargas)), mediana: round2(mediana(cargas)), desvioPadrao: round2(desvioPadrao(cargas)) },
    horasPrevistas: { media: round2(media(horasP)), mediana: round2(mediana(horasP)) },
    outliers
  };
}

/* ============== CORRELACAO PONDERADA ============== */

function pearsonCalc(x, y) {
  if (x.length < 5) return null;
  const mx = media(x), my = media(y);
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < x.length; i++) {
    num += (x[i] - mx) * (y[i] - my);
    denX += (x[i] - mx) ** 2;
    denY += (y[i] - my) ** 2;
  }
  const den = Math.sqrt(denX * denY);
  return den > 0 ? round2(num / den) : 0;
}

function regressaoLinear(x, y) {
  const n = x.length;
  if (n < 3) return null;
  const mx = media(x), my = media(y);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (x[i] - mx) * (y[i] - my); den += (x[i] - mx) ** 2; }
  const slope = den > 0 ? num / den : 0;
  const intercept = my - slope * mx;
  const predicoes = x.map(xi => slope * xi + intercept);
  const ssRes = y.map((yi, i) => (yi - predicoes[i]) ** 2).reduce((a, b) => a + b, 0);
  const ssTot = y.map(yi => (yi - my) ** 2).reduce((a, b) => a + b, 0);
  const r2 = ssTot > 0 ? round2(1 - ssRes / ssTot) : 0;
  const erroPadrao = round2(Math.sqrt(ssRes / Math.max(n - 2, 1)));
  return { slope: round2(slope), intercept: round2(intercept), r2, erroPadrao };
}

function interpretarPearson(p) {
  if (p === null) return 'Dados insuficientes';
  const abs = Math.abs(p);
  let txt = abs < 0.2 ? 'Correlacao fraca ou inexistente' : abs < 0.5 ? 'Correlacao moderada' : abs < 0.7 ? 'Correlacao significativa' : 'Correlacao forte';
  if (p > 0.05) txt += ' (positiva: mais carga -> mais NEs)';
  else if (p < -0.05) txt += ' (negativa: mais carga -> menos NEs)';
  return txt;
}

function calcularCorrelacao(versoesSA, cacheNE) {
  const pontos = [];
  const nomes = listarVersoesEsperadas();
  for (let i = 0; i < nomes.length - 1; i++) {
    const vSA = versoesSA.find(v => v.versao === nomes[i]);
    const vNE = cacheNE[nomes[i + 1]];
    if (vSA && vNE && vNE.totais) {
      pontos.push({
        versao: nomes[i], versaoSeguinte: nomes[i + 1],
        totalSA: vSA.totalLiberacoes,
        cargaPonderada: vSA.complexidade ? vSA.complexidade.cargaPonderada : 0,
        horasPrevistas: vSA.complexidade ? vSA.complexidade.horasPrevistoTotal : 0,
        nesVersaoSeguinte: vNE.totais.entradasBrutas,
        porTipo: vSA.porTipo
      });
    }
  }

  const y = pontos.map(p => p.nesVersaoSeguinte);
  const pearsonSimples = pearsonCalc(pontos.map(p => p.totalSA), y);
  const pearsonCarga = pearsonCalc(pontos.map(p => p.cargaPonderada), y);
  const pearsonHoras = pearsonCalc(pontos.map(p => p.horasPrevistas), y);

  const candidatos = [
    { tipo: 'carga', r: pearsonCarga, x: pontos.map(p => p.cargaPonderada), label: 'Carga Ponderada' },
    { tipo: 'horas', r: pearsonHoras, x: pontos.map(p => p.horasPrevistas), label: 'Horas Previstas' },
    { tipo: 'simples', r: pearsonSimples, x: pontos.map(p => p.totalSA), label: 'Qtde SAs' }
  ];
  const melhor = candidatos.filter(c => c.r !== null).sort((a, b) => Math.abs(b.r) - Math.abs(a.r))[0] || candidatos[0];
  const reg = regressaoLinear(melhor.x, y);

  return {
    pearsonSimples, pearsonCarga, pearsonHoras,
    melhorPreditor: melhor.tipo, melhorPreditorLabel: melhor.label, melhorPreditorR: melhor.r,
    interpretacao: interpretarPearson(melhor.r),
    regressao: reg, pontos, totalPontos: pontos.length
  };
}

/* ============== IIL ============== */

function interpolarPontos(valor, rangeMin, ptsNoMin, rangeMax, ptsNoMax) {
  if (valor <= rangeMin) return ptsNoMin;
  if (valor >= rangeMax) return ptsNoMax;
  const frac = (valor - rangeMin) / (rangeMax - rangeMin);
  return round2(ptsNoMin + frac * (ptsNoMax - ptsNoMin));
}

function calcularIIL(dadosVersao, stats) {
  if (!stats || !dadosVersao.complexidade) return null;
  const c = dadosVersao.complexidade;
  const MAX = { volume: 20, complexidade: 30, perfil: 25, desvio: 15, abrangencia: 10 };

  const ratioVol = stats.total.mediana > 0 ? dadosVersao.totalLiberacoes / stats.total.mediana : 1;
  const ptsVolume = interpolarPontos(ratioVol, 0.5, 0, 1.5, MAX.volume);

  const ratioCarga = stats.carga.mediana > 0 ? c.cargaPonderada / stats.carga.mediana : 1;
  const ptsComplexidade = interpolarPontos(ratioCarga, 0.5, 0, 1.5, MAX.complexidade);

  const totalSA = dadosVersao.totalLiberacoes || 1;
  const altasMuito = (c.porFaixa.alta || 0) + (c.porFaixa.muito_alta || 0);
  const pctAltas = altasMuito / totalSA;
  const pctLegal = (dadosVersao.porTipo.SAL + dadosVersao.porTipo.SAIL) / totalSA;
  const riskScore = pctAltas * 0.6 + pctLegal * 0.4;
  const ptsPerfil = interpolarPontos(riskScore, 0, 0, 0.6, MAX.perfil);

  const ptsDesvio = interpolarPontos(c.desvioEstimativa, -20, 0, 50, MAX.desvio);
  const ratioSSC = c.mediaSSC / 2;
  const ptsAbrangencia = interpolarPontos(ratioSSC, 0, 0, 2, MAX.abrangencia);

  const total = round2(ptsVolume + ptsComplexidade + ptsPerfil + ptsDesvio + ptsAbrangencia);
  let classificacao = 'baixo';
  if (total >= 70) classificacao = 'critico';
  else if (total >= 50) classificacao = 'alto';
  else if (total >= 30) classificacao = 'moderado';

  return {
    total, classificacao, max: 100,
    pontuacao: { volume: round2(ptsVolume), complexidade: round2(ptsComplexidade), perfil: round2(ptsPerfil), desvio: round2(ptsDesvio), abrangencia: round2(ptsAbrangencia) },
    maxPontos: MAX,
    fatores: {
      volume: `${dadosVersao.totalLiberacoes} SAs vs mediana ${stats.total.mediana} (ratio ${round2(ratioVol)})`,
      complexidade: `Carga ${c.cargaPonderada} vs mediana ${stats.carga.mediana} (ratio ${round2(ratioCarga)})`,
      perfil: `${round2(pctAltas * 100)}% alta/muito alta, ${round2(pctLegal * 100)}% legais`,
      desvio: `Desvio estimativa ${c.desvioEstimativa > 0 ? '+' : ''}${c.desvioEstimativa}%`,
      abrangencia: `Media ${c.mediaSSC} SSC/SA`
    },
    referencias: { totalSA: dadosVersao.totalLiberacoes, carga: c.cargaPonderada, horasPrev: c.horasPrevistoTotal, desvio: c.desvioEstimativa, mediaSSC: c.mediaSSC }
  };
}

/* ============== PREVISAO ============== */

function calcularPrevisao(dadosVersao, correlacao, stats, cacheNE) {
  if (!correlacao || !correlacao.regressao || !dadosVersao.complexidade) return null;
  const reg = correlacao.regressao;
  const c = dadosVersao.complexidade;

  let xAtual;
  if (correlacao.melhorPreditor === 'carga') xAtual = c.cargaPonderada;
  else if (correlacao.melhorPreditor === 'horas') xAtual = c.horasPrevistoTotal;
  else xAtual = dadosVersao.totalLiberacoes;

  const prevPontual = round2(reg.slope * xAtual + reg.intercept);
  const prevOtimista = round2(prevPontual - reg.erroPadrao);
  const prevPessimista = round2(prevPontual + reg.erroPadrao);

  let medianaNE = null;
  if (cacheNE) {
    const nesArr = [];
    Object.values(cacheNE).forEach(v => { if (v.totais && v.totais.entradasBrutas > 0) nesArr.push(v.totais.entradasBrutas); });
    if (nesArr.length > 0) medianaNE = mediana(nesArr);
  }

  const variacaoVsMediana = medianaNE ? round2(((prevPontual - medianaNE) / medianaNE) * 100) : null;
  let risco = 'normal';
  if (prevPontual > (medianaNE || 999) * 1.2) risco = 'elevado';
  if (prevPontual > (medianaNE || 999) * 1.4) risco = 'critico';
  if (prevPontual < (medianaNE || 0) * 0.8) risco = 'favoravel';

  return {
    preditor: correlacao.melhorPreditorLabel, xAtual,
    prevPontual: Math.max(0, Math.round(prevPontual)),
    prevOtimista: Math.max(0, Math.round(prevOtimista)),
    prevPessimista: Math.round(prevPessimista),
    medianaNE: medianaNE ? Math.round(medianaNE) : null,
    variacaoVsMediana, risco,
    modelo: {
      formula: `NE = ${reg.slope} x ${correlacao.melhorPreditorLabel} + ${reg.intercept}`,
      r2: reg.r2, erroPadrao: reg.erroPadrao,
      qualidade: reg.r2 >= 0.3 ? 'razoavel' : reg.r2 >= 0.15 ? 'fraco' : 'insuficiente'
    }
  };
}

/* ============== API PRINCIPAL ============== */

async function calcularHistorico(executor, opts = {}) {
  restaurarCache();
  const nomes = listarVersoesEsperadas();
  const versaoAtual = await detectarAtual(executor);
  const resultados = [];

  for (const nome of nomes) {
    const ehAtual = nome === versaoAtual;
    const force = opts.forceTodas || (ehAtual && opts.forceAtual !== false);
    const dados = await coletarVersao(executor, nome, force);
    if (dados && dados.totalLiberacoes !== undefined) resultados.push(dados);
  }

  salvarCache();
  const stats = calcularEstatisticas(resultados);

  let cacheNE = null;
  let correlacao = { pearsonSimples: null, pearsonCarga: null, pearsonHoras: null, interpretacao: 'Cache NE nao disponivel', pontos: [], totalPontos: 0 };
  try {
    const cacheNEPath = path.join(CACHE_DIR, 'estudos-historico.json');
    if (fs.existsSync(cacheNEPath)) {
      const dadosNE = JSON.parse(fs.readFileSync(cacheNEPath, 'utf-8'));
      if (dadosNE.versoes) { cacheNE = dadosNE.versoes; correlacao = calcularCorrelacao(resultados, cacheNE); }
    }
  } catch (err) { console.warn('[liberacoes-sa] Erro correlacao:', err.message); }

  for (const v of resultados) { v.iil = calcularIIL(v, stats); }

  let previsao = null;
  const vAtual = resultados.find(v => v.versao === versaoAtual);
  if (vAtual) { previsao = calcularPrevisao(vAtual, correlacao, stats, cacheNE); }

  return {
    versoes: resultados, estatisticas: stats, correlacao, previsao, versaoAtual,
    _meta: {
      atualizado_em: new Date().toISOString(), total_versoes: resultados.length,
      periodo: resultados.length > 0 ? { de: resultados[0].versao, ate: resultados[resultados.length - 1].versao } : null
    }
  };
}

async function detectarAtual(executor) {
  try { return await versao.detectarVersaoAtual(executor); }
  catch { const h = new Date(); return versao.nomeDaVersao(h.getFullYear(), h.getMonth() + 1); }
}

restaurarCache();

module.exports = {
  calcularHistorico, coletarVersao, calcularEstatisticas, calcularCorrelacao,
  calcularIIL, calcularPrevisao, listarVersoesEsperadas, restaurarCache,
  NIVEIS_LABEL, FAIXAS_COMPLEXIDADE, PESO_TIPO
};
