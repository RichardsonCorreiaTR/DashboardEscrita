/**
 * metas-loader.js - Busca de dados e calculo de metas da equipe
 * Extraido de metas-equipe.js para manter arquivos abaixo de 200 linhas.
 */

const fs = require('fs');
const path = require('path');
const qe = require('../../core/query-executor');
const queries = require('./consultas-metas');
const detalhe = require('./consultas-metas-detalhe');
const anual = require('./metas-anual');
const planilha = require('../../core/planilha-escrita');
const cruzamento = require('../../core/planilha-cruzamento');
const retornos = require('./retornos-planilha');
const pontosCalc = require('./pontos-calculador');
const tempoSalCalc = require('./tempo-sal-calculador');
const descartesCalc = require('./descartes-calculador');

function buildCargoMapGlobal() {
  try {
    const equipe = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'config', 'equipe.json'), 'utf8'));
    const m = {};
    (equipe.analistas || []).forEach(a => { m[a['codigo-sgd']] = a.senioridade; });
    return m;
  } catch { return {}; }
}

const ANO_PADRAO = new Date().getFullYear();
let ANO = ANO_PADRAO; // pode ser sobrescrito via setAno()

function setAno(ano) { ANO = Number(ano) || ANO_PADRAO; }
function getAno() { return ANO; }

function metasDoAnalista(a, metasJson) {
  const tmpl = metasJson.templates[a.senioridade] || [];
  const extras = (metasJson.overrides[a.slug] || {})['metas-adicionais'] || [];
  return [...tmpl, ...extras].filter(id => id !== 'diretrizes-95');
}

async function buscarCruzamentoPlanilha(a, mes, sgdRows) {
  try {
    const saisPlanilha = await planilha.obterSaisAnalista(mes, a);
    return cruzamento.cruzar(sgdRows, saisPlanilha);
  } catch (e) {
    return { erro: e.message };
  }
}

function normNome(n) {
  return (n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// Calcula pontos de SAIs geradas (responsavel_sai = analista, responsavel_psai != analista)
// usando o cargo do proprio analista
async function calcularPontosGeradosPlanilha(a) {
  const mesAtual = new Date().getMonth() + 1;
  const meses = Array.from({ length: mesAtual }, (_, i) => i + 1);
  const apelido = normNome(a.apelido);
  const nomeComp = normNome(a.nome);
  const result = {};
  await Promise.all(meses.map(async mes => {
    const sais = await planilha.obterSaisPorMes(mes).catch(() => []);
    const geradas = sais.filter(s => {
      const rSai = normNome(s.responsavel_sai);
      const rPsai = normNome(s.responsavel_psai);
      const eGerador = rSai === apelido || rSai.includes(apelido) || nomeComp.startsWith(rSai);
      const eResponsavel = rPsai === apelido || rPsai.includes(apelido);
      return eGerador && !eResponsavel;
    });
    if (!geradas.length) return;
    let pts = 0;
    geradas.forEach(s => { pts += pontosCalc.pontosPlanilha(s.tipoSAI, s.nivel, a.senioridade, s.pontos); });
    result[mes] = { pontos: pts, qtd_sais: geradas.length, sais: geradas };
  }));
  return result;
}

// Mapa { i_sai -> nivel } lido da planilha (para enriquecer linhas de tempo SAL)
async function buildNivelMap(analistas) {
  const mesAtual = new Date().getMonth() + 1;
  const meses = Array.from({ length: mesAtual }, (_, i) => i + 1);
  const nivelMap = {};
  await Promise.all(analistas.map(async a => {
    await Promise.all(meses.map(async mes => {
      const sais = await planilha.obterSaisAnalista(mes, a).catch(() => []);
      sais.forEach(s => { if (s.i_sai && s.nivel) nivelMap[s.i_sai] = s.nivel; });
    }));
  }));
  return nivelMap;
}

// Calcula pontos mensais usando planilha + tabela cargo x tipo x nivel
async function calcularPontosAnuaisPlaniha(analistas) {
  const mesAtual = new Date().getMonth() + 1;
  const meses = Array.from({ length: mesAtual }, (_, i) => i + 1);
  const result = {};
  await Promise.all(analistas.map(async a => {
    const sgd = a['codigo-sgd'];
    result[sgd] = {};
    await Promise.all(meses.map(async mes => {
      const sais = await planilha.obterSaisAnalista(mes, a).catch(() => []);
      let pts = 0;
      sais.forEach(s => { pts += pontosCalc.pontosPlanilha(s.tipoSAI, s.nivel, a.senioridade, s.pontos); });
      result[sgd][mes] = { pontos: pts, qtd_sais: sais.length };
    }));
  }));
  return result;
}

async function buscarDados(analistas) {
  const idsUsuarios = analistas.map(a => a['i-usuarios']);
  const idsSgd = analistas.map(a => a['codigo-sgd']);
  const cargoMap = {};
  analistas.forEach(a => { cargoMap[a['codigo-sgd']] = a.senioridade; });
  // cargoMap por i_usuarios para pontosGerados
  const cargoMapUid = {};
  analistas.forEach(a => { cargoMapUid[a['i-usuarios']] = a.senioridade; });
  const [revDef, revGer, tempoGer, tempoGerSal, tempoGerSailSam, ss, ativs, ret, pontosRaw, tMedSalRaw, nivelMap, descRaw, pontosGeradosRaw, descSitRaw, analSemSaiRaw, psaisDefRaw] = await Promise.all([
    qe.executar(queries.queryControleRevisoes(ANO)),
    qe.executar(queries.queryControleRevisoesPorGerador(ANO)),
    qe.executar(queries.queryTramitacoesPsai(idsSgd, 3, ANO, ['NE'])),
    qe.executar(queries.queryTramitacoesPsai(idsSgd, 5, ANO, ['SAL'])),
    qe.executar(queries.queryTramitacoesPsai(idsSgd, 7, ANO, ['SAIL', 'SAM'])),
    qe.executar(queries.queryRespostasSS(idsUsuarios, ANO)),
    qe.executar(queries.queryTempoAtividades(idsUsuarios, ANO)),
    retornos.carregarRetornosTodos(analistas),
    qe.executar(queries.queryPontosDefinicao(ANO)),
    qe.executar(queries.queryTempoMedioSal(ANO, idsSgd)),
    buildNivelMap(analistas),
    qe.executar(queries.queryControleDescartes(ANO, idsSgd)),
    Promise.all(analistas.map(a => qe.executar(queries.queryPontosGerados(ANO, a['codigo-sgd'])))).then(r => r.flat()),
    qe.executar(queries.queryDescartesDataSituacao(ANO, idsSgd)),
    qe.executar(queries.queryAnalisesSemSai(ANO, idsSgd)),
    qe.executar(queries.queryPsaisDefinidas(ANO))
  ]);
  const tMedSal = tMedSalRaw.map(r => ({ ...r, nivel: nivelMap[r.i_sai] || null }));
  const pontosGeradosMap = {};
  analistas.forEach(a => {
    const sgdRows = pontosGeradosRaw.filter(r => Number(r.codigo_sgd) === a['codigo-sgd']);
    const grouped = pontosCalc.agruparPontosGerados(sgdRows, a.senioridade, cargoMap);
    pontosGeradosMap[a['i-usuarios']] = grouped[a['codigo-sgd']] || {};
  });
  return {
    revCtrl: { def: anual.agruparControleRevisoes(revDef), ger: anual.agruparControleRevisoes(revGer) },
    pontos: pontosCalc.agruparPontosDb(pontosRaw, cargoMap),
    pontosGerados: pontosGeradosMap,
    psaisDefinidas: pontosCalc.agruparPontosDb(psaisDefRaw, cargoMap),
    tempoGer: anual.agrupar(tempoGer),
    tempoGerSal: anual.agrupar(tempoGerSal), tempoGerSailSam: anual.agrupar(tempoGerSailSam),
    ss: anual.agrupar(ss), ativs: anual.agruparAtividades(ativs), retornos: ret,
    tempoMedioSal: tempoSalCalc.agruparTempoSal(tMedSal),
    descartes: descartesCalc.agruparDescartes(descRaw),
    descartesDataSit: agruparContagem(descSitRaw),
    analisesSemSai: anual.agrupar(analSemSaiRaw)
  };
}

function agruparContagem(rows) {
  const m = {};
  rows.forEach(r => {
    const uid = r.i_usuarios, mes = r.mes;
    if (!m[uid]) m[uid] = {};
    m[uid][mes] = (m[uid][mes] || 0) + 1;
  });
  return m;
}

async function buscarDadosAnalista(a) {
  const sgd = a['codigo-sgd'], uid = a['i-usuarios'];
  const [revDef, revGer, tempoGer, tempoGerSal, tempoGerSailSam, ss, ativs, ret, pontosRaw, tMedSalRaw, nivelMap, descRaw, pontosGeradosRaw, descSitRaw, analSemSaiRaw, psaisDefRaw] = await Promise.all([
    qe.executar(queries.queryControleRevisoes(ANO, sgd)),
    qe.executar(queries.queryControleRevisoesPorGerador(ANO, sgd)),
    qe.executar(queries.queryTramitacoesPsai([sgd], 3, ANO, ['NE'])),
    qe.executar(queries.queryTramitacoesPsai([sgd], 5, ANO, ['SAL'])),
    qe.executar(queries.queryTramitacoesPsai([sgd], 7, ANO, ['SAIL', 'SAM'])),
    qe.executar(queries.queryRespostasSS([uid], ANO)),
    qe.executar(queries.queryTempoAtividades([uid], ANO)),
    retornos.carregarRetornosAnalista(a),
    qe.executar(queries.queryPontosDefinicao(ANO, sgd)),
    qe.executar(queries.queryTempoMedioSal(ANO, [sgd])),
    buildNivelMap([a]),
    qe.executar(queries.queryControleDescartes(ANO, [sgd])),
    qe.executar(queries.queryPontosGerados(ANO, sgd)),
    qe.executar(queries.queryDescartesDataSituacao(ANO, [sgd])),
    qe.executar(queries.queryAnalisesSemSai(ANO, [sgd])),
    qe.executar(queries.queryPsaisDefinidas(ANO, sgd))
  ]);
  const tMedSal = tMedSalRaw.map(r => ({ ...r, nivel: nivelMap[r.i_sai] || null }));
  const cargoMapLocal = {};
  cargoMapLocal[sgd] = a.senioridade;
  return {
    revCtrl: { def: anual.agruparControleRevisoes(revDef), ger: anual.agruparControleRevisoes(revGer) },
    pontos: pontosCalc.agruparPontosDbAnalista(pontosRaw, a.senioridade),
    pontosGerados: { [uid]: pontosCalc.agruparPontosGerados(pontosGeradosRaw, a.senioridade, buildCargoMapGlobal())[sgd] || {} },
    psaisDefinidas: pontosCalc.agruparPontosDb(psaisDefRaw, cargoMapLocal),
    tempoMedioSal: tempoSalCalc.agruparTempoSal(tMedSal),
    descartes: descartesCalc.agruparDescartes(descRaw),
    descartesDataSit: agruparContagem(descSitRaw),
    analisesSemSai: anual.agrupar(analSemSaiRaw),
    tempoGer: anual.agrupar(tempoGer),
    tempoGerSal: anual.agrupar(tempoGerSal), tempoGerSailSam: anual.agrupar(tempoGerSailSam),
    ss: anual.agrupar(ss), ativs: anual.agruparAtividades(ativs),
    retornos: { [sgd]: ret }
  };
}

function montarResposta(a, dados, metasJson) {
  const ids = metasDoAnalista(a, metasJson);
  const calc = anual.calcularMetas(a, dados, ids);
  return { slug: a.slug, nome: a.nome, senioridade: a.senioridade, ...calc };
}

async function detalheRetornos(a, metaId, mes) {
  const tipos = metaId === 'indice-retornos-sal' ? ['SAL'] : ['SAIL', 'SAM'];
  const sais = await planilha.obterSaisAnalista(mes, a);
  const vistos = new Set();
  return sais
    .filter(s => {
      if (!tipos.includes((s.tipoSAI || '').toUpperCase())) return false;
      const k = (s.i_psai || s.i_sai) + '';
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    })
    .map(s => ({ i_psai: s.i_psai, i_sai: s.i_sai, tipoSAI: s.tipoSAI, qtdTramite: s.qtdTramite || 0 }));
}

async function buscarDetalhe(a, metaId, mes) {
  const sgd = a['codigo-sgd'], uid = a['i-usuarios'];
  const isEsp = a.senioridade === 'especialista';
  // Ambos usam codigo-sgd: psai.i_responsaveis (analista) e sai.i_usuarios (especialista) = codigo-sgd
  if (metaId.startsWith('indice-revisoes')) return qe.executar(detalhe.detalheRevisoes(sgd, ANO, mes, isEsp, metaId));
  if (metaId === 'pontos-definicao') {
    const rows = await qe.executar(detalhe.detalhePontos(sgd, ANO, mes));
    return rows.map(r => {
      const ov = pontosCalc.getOverrides()[String(r.i_sai)];
      const nivelChave = ov ? ov.chave : String(r.nivel_alteracao || 1);
      const pontuacao = pontosCalc.pontosSai(r.tipoSAI, nivelChave, a.senioridade);
      return {
        i_sai: r.i_sai, tipoSAI: r.tipoSAI, CadastroSAI: r.CadastroSAI,
        nivel: ov ? ov.nivel + ' \u270F' : (pontosCalc.nivelDbLabel(r.nivel_alteracao) || 'N\u00e3o definido'),
        nivel_alteracao: r.nivel_alteracao,
        nivel_inferido: !r.nivel_alteracao && !ov,
        pontos_fallback: false,
        pontuacao,
        override: !!ov
      };
    });
  }
  if (metaId.startsWith('gerar-sai')) {
    const tipos = metaId === 'gerar-sai-sal-5d' ? ['SAL']
      : metaId === 'gerar-sai-sail-sam-7d' ? ['SAIL', 'SAM']
      : ['NE'];
    return qe.executar(detalhe.detalheTramitacoesPsai(sgd, ANO, mes, tipos));
  }
  if (metaId === 'pontos-gerados') {
    const rows = await qe.executar(detalhe.detalhePontosGerados(uid, sgd, ANO, mes));
    return rows.map(r => ({
      i_sai: r.i_sai, i_psai: r.i_psai, tipoSAI: r.tipoSAI,
      resp_psai_sgd: r.i_responsaveis,
      nivel: pontosCalc.nivelDbLabel(r.nivel_alteracao) || 'N\u00e3o definido',
      nivel_inferido: !r.nivel_alteracao,
      pontuacao: pontosCalc.pontosSai(r.tipoSAI, String(r.nivel_alteracao || 1), a.senioridade)
    }));
  }
  if (metaId === 'psais-definidas') {
    const rows = await qe.executar(`
      SELECT p.i_responsaveis as i_usuarios, sp.i_psai, sp.tipoSAI, p.nivel_alteracao,
        sp.CadastroPSAI, pt_max.max_ent as data_tramite
      FROM UP.SAI_PSAI sp
      JOIN bethadba.psai p ON sp.i_psai = p.i_psai
      JOIN (SELECT i_psai, MAX(entrada) as max_ent FROM bethadba.psai_tramites GROUP BY i_psai) pt_max
        ON pt_max.i_psai = sp.i_psai
      WHERE sp.nomeArea IN ('Escrita', 'Importacao', 'ONVIO ESCRITA')
        AND sp.i_sai = 0 AND COALESCE(p.i_produto_grupo, 1) = 1
        AND p.i_responsaveis = ${sgd}
        AND YEAR(pt_max.max_ent) = ${ANO} AND MONTH(pt_max.max_ent) = ${mes}
    `);
    return rows.map(r => ({
      i_psai: r.i_psai, tipoSAI: r.tipoSAI, CadastroSAI: r.CadastroPSAI,
      nivel: pontosCalc.nivelDbLabel(r.nivel_alteracao) || 'N\u00e3o definido',
      nivel_inferido: !r.nivel_alteracao,
      pontuacao: pontosCalc.pontosSai(r.tipoSAI, String(r.nivel_alteracao || 1), a.senioridade)
    }));
  }
  if (metaId === 'sais-definidas-esp') {
    const rows = await qe.executar(detalhe.detalhePontos(sgd, ANO, mes));
    return rows.map(r => {
      const ov = pontosCalc.getOverrides()[String(r.i_sai)];
      const nivelChave = ov ? ov.chave : String(r.nivel_alteracao || 1);
      const pontuacao = pontosCalc.pontosSai(r.tipoSAI, nivelChave, a.senioridade);
      return {
        i_sai: r.i_sai, tipoSAI: r.tipoSAI, CadastroSAI: r.CadastroSAI,
        nivel: ov ? ov.nivel + ' \u270F' : (pontosCalc.nivelDbLabel(r.nivel_alteracao) || 'N\u00e3o definido'),
        nivel_alteracao: r.nivel_alteracao,
        nivel_inferido: !r.nivel_alteracao && !ov,
        pontuacao,
        override: !!ov
      };
    });
  }
  if (metaId === 'pct-descartes') {
    const [analisadas, descartadas] = await Promise.all([
      qe.executar(detalhe.detalhePctDescartes_Analisadas(sgd, ANO, mes)),
      qe.executar(detalhe.detalhePctDescartes_Descartadas(sgd, ANO, mes))
    ]);
    return [...descartadas, ...analisadas];
  }
  if (metaId === 'controle-descartes') return qe.executar(detalhe.detalheDescartes(sgd, ANO, mes));
  if (metaId === 'tempo-medio-sal') {
    const [rows, nm] = await Promise.all([
      qe.executar(detalhe.detalheTempoSal(sgd, ANO, mes)),
      buildNivelMap([a])
    ]);
    return rows.map(r => ({ ...r, nivel: nm[r.i_sai] || null }));
  }
  if (metaId.startsWith('tempo-trabalho') || metaId === 'tempo-gerando-sai') return qe.executar(detalhe.detalheAtividades(uid, ANO, mes));
  if (metaId === 'respostas-ss-3d') return qe.executar(detalhe.detalheRespostasSS(uid, ANO, mes));
  if (metaId.startsWith('indice-retornos')) return detalheRetornos(a, metaId, mes);
  if (metaId === 'pontos-atividade-principal') {
    const rows = await qe.executar(detalhe.detalhePontos(sgd, ANO, mes));
    return rows.map(r => {
      const ov = pontosCalc.getOverrides()[String(r.i_sai)];
      const nivelChave = ov ? ov.chave : String(r.nivel_alteracao || 1);
      const pontuacao = pontosCalc.pontosSai(r.tipoSAI, nivelChave, a.senioridade);
      return {
        i_sai: r.i_sai, tipoSAI: r.tipoSAI, CadastroSAI: r.CadastroSAI,
        nivel: ov ? ov.nivel + ' \u270F' : (pontosCalc.nivelDbLabel(r.nivel_alteracao) || 'N\u00e3o definido'),
        nivel_alteracao: r.nivel_alteracao, nivel_inferido: !r.nivel_alteracao && !ov,
        pontuacao, override: !!ov
      };
    });
  }
  return [];
}

module.exports = {
  metasDoAnalista, buscarCruzamentoPlanilha, buscarDados,
  buscarDadosAnalista, montarResposta, buscarDetalhe,
  setAno, getAno, ANO_PADRAO
};
