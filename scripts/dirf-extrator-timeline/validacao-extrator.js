/**
 * Valida cobertura: pares SAI+PSAI (PBCVS) e definição do PSAI (SGSAI — psai.descricao não existe no PBCVS).
 */

function sqlDescricaoPsaisSgsai(psaiIds) {
  const clean = [...new Set(psaiIds.map(Number))].filter(n => Number.isInteger(n) && n > 0);
  if (!clean.length) return '';
  return `
  SELECT psai.i_psai, CAST(psai.descricao AS BINARY) as descricao --allow-blob
  FROM bethadba.psai psai
  WHERE psai.i_psai IN (${clean.join(',')})
  ORDER BY psai.i_psai ASC`;
}

function normalizarParesExpectativa(paresRaw) {
  if (!paresRaw || !paresRaw.length) return [];
  return paresRaw
    .map(p => ({
      i_psai: Number(p.i_psai),
      i_sai:
        p.i_sai === null || p.i_sai === undefined || p.i_sai === '' ? null : Number(p.i_sai)
    }))
    .filter(p => Number.isInteger(p.i_psai) && p.i_psai > 0);
}

function validarParesEsperados(itens, pares) {
  const keys = new Set(itens.map(it => `${Number(it.i_psai)}:${Number(it.i_sai)}`));
  const porPsai = new Map();
  for (const it of itens) {
    const p = Number(it.i_psai);
    if (!porPsai.has(p)) porPsai.set(p, []);
    porPsai.get(p).push(Number(it.i_sai));
  }
  const faltantes = [];
  for (const par of pares) {
    const psai = par.i_psai;
    const sai = par.i_sai;
    if (sai == null || !Number.isInteger(sai)) {
      if (!porPsai.has(psai)) {
        faltantes.push({ i_psai: psai, i_sai: null, motivo: 'PSAI sem linha em SAI_PSAI' });
      }
      continue;
    }
    if (!keys.has(`${psai}:${sai}`)) {
      const alt = porPsai.get(psai);
      faltantes.push({
        i_psai: psai,
        i_sai: sai,
        motivo: 'Par SAI+PSAI não encontrado na timeline',
        i_sai_encontrados_no_psai: alt && alt.length ? alt.join(', ') : '—'
      });
    }
  }
  return { total: pares.length, faltantes };
}

function analisarDefinicoes(rows, decode) {
  const detalhes = [];
  let ambos = 0;
  let soDirf = 0;
  let soExt = 0;
  let nenhum = 0;
  for (const r of rows) {
    const t = (decode.decodificarBinario(r.descricao) || '').replace(/\s+/g, ' ').trim();
    const low = t.toLowerCase();
    const d = low.includes('dirf');
    const e = low.includes('extrator');
    let cat = 'nenhum_termo';
    if (d && e) {
      ambos++;
      cat = 'dirf_e_extrator';
    } else if (d) {
      soDirf++;
      cat = 'so_dirf';
    } else if (e) {
      soExt++;
      cat = 'so_extrator';
    } else nenhum++;
    detalhes.push({
      i_psai: r.i_psai,
      categoria: cat,
      trecho: decode.truncar(t, 160)
    });
  }
  const resumoTexto =
    `Definição no SGSAI (bethadba.psai.descricao): ${ambos} com \"dirf\" e \"extrator\"; ${soDirf} só \"dirf\"; ` +
    `${soExt} só \"extrator\"; ${nenhum} sem esses termos (o escopo pode ser Extrator DIRF mesmo assim).`;
  return {
    detalhes,
    resumoTexto,
    contagens: { ambos, so_dirf: soDirf, so_extrator: soExt, nenhum }
  };
}

function packDefSemTexto(resumoDef, aviso) {
  const z = { ambos: 0, so_dirf: 0, so_extrator: 0, nenhum: 0 };
  return {
    defDet: [],
    resumoDef,
    contagens: z,
    fonteDefinicao: 'indisponivel',
    avisoDefinicao: aviso
  };
}

async function obterBlocoDefinicaoSgsai(checkCfg, executarSgsai, sgsaiHabilitadoNaConfig, decode) {
  if (!sgsaiHabilitadoNaConfig() || !checkCfg.ids.length) {
    return packDefSemTexto(
      'Definição do PSAI (descricao): só no SGSAI — habilite "sgsai" em config/conexao.json. O PBCVS não traz esse texto.',
      null
    );
  }
  const rows = await executarSgsai(sqlDescricaoPsaisSgsai(checkCfg.ids));
  if (rows === null) {
    return packDefSemTexto(
      'Definição só no SGSAI; a consulta falhou. Verifique config/conexao.json (sgsai).',
      'Consulta à definição no SGSAI não retornou (conexão ou permissão).'
    );
  }
  if (!rows.length) {
    return packDefSemTexto(
      'SGSAI sem linhas em bethadba.psai para os PSAIs da lista (IDs conferidos).',
      null
    );
  }
  const a = analisarDefinicoes(rows, decode);
  return {
    defDet: a.detalhes,
    resumoDef: a.resumoTexto,
    contagens: a.contagens,
    fonteDefinicao: 'sgsai',
    avisoDefinicao: null
  };
}

async function montarValidacaoExtrator({
  itens,
  checkCfg,
  faltandoPsais,
  executarSgsai,
  sgsaiHabilitadoNaConfig,
  decode
}) {
  const pares =
    checkCfg.pares && checkCfg.pares.length
      ? checkCfg.pares
      : checkCfg.ids.map(i_psai => ({ i_psai, i_sai: null }));
  const v = validarParesEsperados(itens, pares);
  const def = await obterBlocoDefinicaoSgsai(checkCfg, executarSgsai, sgsaiHabilitadoNaConfig, decode);
  const temPsai = new Set(itens.map(i => i.i_psai));
  const psaiOk = checkCfg.ids.filter(id => temPsai.has(id)).length;
  return {
    titulo_checklist: checkCfg.titulo,
    psais_esperados: checkCfg.ids.length,
    psais_com_registro: psaiOk,
    psais_sem_registro: faltandoPsais,
    pares_esperados: pares.length,
    pares_faltantes: v.faltantes,
    definicoes_psai: def.defDet,
    resumo_definicao: def.resumoDef,
    definicoes_contagens: def.contagens,
    definicao_fonte: def.fonteDefinicao,
    definicao_aviso: def.avisoDefinicao
  };
}

module.exports = {
  normalizarParesExpectativa,
  validarParesEsperados,
  analisarDefinicoes,
  sqlDescricaoPsaisSgsai,
  montarValidacaoExtrator
};
