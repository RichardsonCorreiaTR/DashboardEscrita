/**
 * analise.js - Cruzamento de dados e identificacao de conflitos
 *
 * Recebe dados coletados e identifica:
 * 1. PSAIs/SAIs em que ambos os times trabalham
 * 2. NEs pendentes que podem estar em duplicidade
 * 3. Retrabalho potencial
 */

const q = require('./queries');

function mapearAnalistaSA(iuOuSgd) {
  return q.EQUIPE_SA.find(
    e => e.iu === iuOuSgd || e.sgd === iuOuSgd
  );
}

function mapearAnalistaNE(sgd) {
  return q.EQUIPE_NE.find(e => e.sgd === sgd);
}

function extrairPsaisSATrabalhou(tramitesPsai, atividadesComSai) {
  const psaiSet = new Set();
  const saiSet = new Set();
  const detalhePorPsai = {};
  const detalhePorSai = {};

  for (const t of tramitesPsai) {
    psaiSet.add(t.i_psai);
    if (!detalhePorPsai[t.i_psai]) detalhePorPsai[t.i_psai] = [];
    const analista = mapearAnalistaSA(t.sgd_analista);
    detalhePorPsai[t.i_psai].push({
      analista: analista?.apelido || `SGD:${t.sgd_analista}`,
      data: t.entrada,
      situacao: t.situacao
    });
  }

  for (const a of atividadesComSai) {
    if (a.i_sai && a.i_sai > 0) {
      saiSet.add(a.i_sai);
      if (!detalhePorSai[a.i_sai]) detalhePorSai[a.i_sai] = [];
      const analista = mapearAnalistaSA(a.i_usuarios);
      detalhePorSai[a.i_sai].push({
        analista: analista?.apelido || `IU:${a.i_usuarios}`,
        data: a.inicio,
        tempo: a.tempo,
        atividade: a.atividade_nome
      });
    }
  }

  return { psaiSet, saiSet, detalhePorPsai, detalhePorSai };
}

function cruzarComNEsPendentes(detalhesSaiPsai, nesPendentes) {
  const nesMap = new Map();
  for (const ne of nesPendentes) {
    nesMap.set(ne.i_psai, ne);
    if (ne.i_sai > 0) nesMap.set(`sai:${ne.i_sai}`, ne);
  }

  const conflitos = [];

  for (const d of detalhesSaiPsai) {
    const nePorPsai = nesMap.get(d.i_psai);
    const nePorSai = d.i_sai > 0 ? nesMap.get(`sai:${d.i_sai}`) : null;
    const ne = nePorPsai || nePorSai;

    if (ne && d.nomeArea === 'Escrita' && d.tipoSAI === 'NE') {
      conflitos.push({
        i_psai: d.i_psai,
        i_sai: d.i_sai,
        gravidade: d.gravidade_ne,
        cadastroPsai: d.CadastroPSAI,
        situacaoSai: d.i_sai_situacoes,
        situacaoPsai: d.i_psai_situacoes,
        nomeVersao: d.nomeVersao,
        liberacao: d.Liberacao,
        descarte: d.Descarte,
        tipo: 'NE_ESCRITA_EM_AMBOS_TIMES'
      });
    }
  }

  return conflitos;
}

function identificarDuplicidades(nesPendentes) {
  const porPsai = new Map();

  for (const ne of nesPendentes) {
    if (ne.i_sai > 0) continue;
    if (!porPsai.has(ne.i_psai)) porPsai.set(ne.i_psai, []);
    porPsai.get(ne.i_psai).push(ne);
  }

  const duplicidades = [];
  for (const [psai, nes] of porPsai) {
    if (nes.length > 1) {
      duplicidades.push({ i_psai: psai, count: nes.length, items: nes });
    }
  }

  return duplicidades;
}

function classificarRisco(conflito) {
  let score = 0;

  if (conflito.gravidade === 'Critica') score += 3;
  else if (conflito.gravidade === 'Grave') score += 2;
  else score += 1;

  if (conflito.situacaoSai >= 7 && conflito.situacaoSai <= 15) score += 2;
  if (conflito.nomeVersao) score += 1;

  if (score >= 5) return 'CRITICO';
  if (score >= 3) return 'ALTO';
  if (score >= 2) return 'MEDIO';
  return 'BAIXO';
}

function analisar(dados) {
  const { atividades, atividadesComSai, tramitesPsai, tramitesSai,
    nesPendentes, detalhesSaiPsai, respPsai, respSai } = dados;

  const extracaoSA = extrairPsaisSATrabalhou(
    tramitesPsai, atividadesComSai
  );

  const conflitos = cruzarComNEsPendentes(
    detalhesSaiPsai, nesPendentes
  );

  for (const c of conflitos) {
    c.risco = classificarRisco(c);
    c.trabalhadoPorSA = extracaoSA.detalhePorPsai[c.i_psai] || [];
    if (c.i_sai > 0) {
      c.atividadesSA = extracaoSA.detalhePorSai[c.i_sai] || [];
    }

    const rp = respPsai.filter(r => r.i_psai === c.i_psai);
    c.responsaveisPsai = rp.map(r => r.nome_responsavel);

    if (c.i_sai > 0) {
      const rs = respSai.filter(r => r.i_sai === c.i_sai);
      c.responsaveisSai = rs.map(r => r.nome_responsavel);
    }
  }

  const duplicidades = identificarDuplicidades(nesPendentes);

  const resumoAtividadesSA = resumirAtividades(
    atividades, atividadesComSai
  );

  const psaisTrabalhadasSA = [...extracaoSA.psaiSet];
  const saisTrabalhadasSA = [...extracaoSA.saiSet];

  return {
    resumoAtividadesSA,
    psaisTrabalhadasSA,
    saisTrabalhadasSA,
    detalhePorPsai: extracaoSA.detalhePorPsai,
    detalhePorSai: extracaoSA.detalhePorSai,
    conflitos: conflitos.sort(
      (a, b) => nivelRisco(b.risco) - nivelRisco(a.risco)
    ),
    duplicidades,
    totalNEsPendentes: nesPendentes.length,
    totalPsaisSA: extracaoSA.psaiSet.size,
    totalSaisSA: extracaoSA.saiSet.size
  };
}

function nivelRisco(r) {
  const mapa = { CRITICO: 4, ALTO: 3, MEDIO: 2, BAIXO: 1 };
  return mapa[r] || 0;
}

function resumirAtividades(atividades, atividadesComSai) {
  const porAnalista = {};

  for (const a of atividades) {
    const analista = mapearAnalistaSA(a.i_usuarios);
    const nome = analista?.apelido || `IU:${a.i_usuarios}`;
    if (!porAnalista[nome]) {
      porAnalista[nome] = {
        totalMinutos: 0,
        dias: new Set(),
        atividades: {}
      };
    }
    porAnalista[nome].totalMinutos += a.minutos;
    porAnalista[nome].dias.add(a.dia?.toString?.().slice(0, 10) || a.dia);
    const atv = a.atividade || 'Sem nome';
    porAnalista[nome].atividades[atv] =
      (porAnalista[nome].atividades[atv] || 0) + a.minutos;
  }

  for (const key of Object.keys(porAnalista)) {
    porAnalista[key].diasTrabalhados = porAnalista[key].dias.size;
    delete porAnalista[key].dias;
  }

  return porAnalista;
}

module.exports = { analisar };
