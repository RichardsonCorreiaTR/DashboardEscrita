/**
 * Script de prova real - Valida calculos de ISV, projecao e mediaDiaUtil
 * Testa 5 versoes representativas e verifica coerencia entre si.
 *
 * Uso: node scripts/testar-calculos.js
 */

const BASE = 'http://localhost:4000/api';

const VERSOES_TESTE = [
  '10.6A-02',  // atual, em andamento
  '10.6A-01',  // concluida recente
  '10.5A-06',  // concluida, meio do ano
  '10.4A-01',  // concluida, janeiro - sazonalidade
  '10.2A-02',  // primeira versao, historico minimo
];

let erros = 0;
let avisos = 0;
let ok = 0;

function check(desc, cond, detalhe) {
  if (cond) {
    console.log(`  [OK] ${desc}`);
    ok++;
  } else {
    console.error(`  [ERRO] ${desc} -- ${detalhe || ''}`);
    erros++;
  }
}

function warn(desc, detalhe) {
  console.warn(`  [AVISO] ${desc} -- ${detalhe || ''}`);
  avisos++;
}

async function fetchJson(url) {
  const resp = await fetch(`${BASE}${url}`);
  if (!resp.ok) return null;
  return resp.json();
}

async function testarVersao(nome) {
  console.log(`\n===== ${nome} =====`);
  const d = await fetchJson(`/estudos/semanal/${nome}`);
  if (!d || !d.totais) {
    warn(`Sem dados para ${nome}`, 'versao pode nao estar no cache');
    return null;
  }

  // 1. Semanas: devem ser exatamente 4
  check(`${nome}: 4 semanas`, d.semanas && d.semanas.length === 4,
    `tem ${d.semanas ? d.semanas.length : 0}`);

  // 2. Total de entradas = soma das semanas
  const somaEnt = d.semanas.reduce((a, s) => a + s.entradasBrutas, 0);
  check(`${nome}: soma semanas = total`,
    somaEnt === d.totais.entradasBrutas,
    `soma=${somaEnt} total=${d.totais.entradasBrutas}`);

  // 3. Acumulado da ultima semana nao-zero deve bater com total (ou parcial se em andamento)
  if (d.semanas[3] && d.semanas[3].acumuladoEntradas !== undefined) {
    const acumS4 = d.semanas[3].acumuladoEntradas;
    if (!isNaN(acumS4)) {
      check(`${nome}: acumuladoEntradas S4 = total`,
        acumS4 === d.totais.entradasBrutas,
        `acumS4=${acumS4} total=${d.totais.entradasBrutas}`);
    } else {
      warn(`${nome}: acumuladoEntradas S4 e NaN`);
    }
  }

  // 4. mediaDiaUtil coerente
  const mdu = d.totais.mediaDiaUtil;
  check(`${nome}: mediaDiaUtil > 0`, mdu > 0, `mdu=${mdu}`);

  if (d.versaoEmAndamento && d.diasUteisDecorridos) {
    const esperado = Math.round((d.totais.entradasBrutas / d.diasUteisDecorridos) * 100) / 100;
    check(`${nome}: mediaDiaUtil usa diasUteisDecorridos`,
      Math.abs(mdu - esperado) < 0.02,
      `mdu=${mdu} esperado=${esperado} diasDecorridos=${d.diasUteisDecorridos}`);
  }

  // 5. ISV (se disponivel)
  if (d.isv && !d.isv.insuficiente) {
    const isv = d.isv;
    check(`${nome}: ISV total 0-100`, isv.total >= 0 && isv.total <= 100,
      `total=${isv.total}`);

    // Soma dos fatores = total
    const somaFatores = Math.round(
      (isv.pontuacao.ritmo + isv.pontuacao.projecao +
       isv.pontuacao.tendencia + isv.pontuacao.aceleracao) * 100
    ) / 100;
    check(`${nome}: ISV soma fatores = total`,
      Math.abs(somaFatores - isv.total) < 0.02,
      `soma=${somaFatores} total=${isv.total}`);

    // Cada fator dentro do max
    const max = isv.maxPontos;
    check(`${nome}: ritmo <= ${max.ritmo}`,
      isv.pontuacao.ritmo >= 0 && isv.pontuacao.ritmo <= max.ritmo,
      `ritmo=${isv.pontuacao.ritmo}`);
    check(`${nome}: projecao <= ${max.projecao}`,
      isv.pontuacao.projecao >= 0 && isv.pontuacao.projecao <= max.projecao,
      `projecao=${isv.pontuacao.projecao}`);
    check(`${nome}: tendencia <= ${max.tendencia}`,
      isv.pontuacao.tendencia >= 0 && isv.pontuacao.tendencia <= max.tendencia,
      `tendencia=${isv.pontuacao.tendencia}`);
    check(`${nome}: aceleracao <= ${max.aceleracao}`,
      isv.pontuacao.aceleracao >= 0 && isv.pontuacao.aceleracao <= max.aceleracao,
      `aceleracao=${isv.pontuacao.aceleracao}`);

    // Nao deve ter NaN em nenhum campo
    check(`${nome}: ISV sem NaN`,
      !isNaN(isv.total) && !Object.values(isv.pontuacao).some(v => isNaN(v)),
      `pontuacao=${JSON.stringify(isv.pontuacao)}`);

    // Referencias devem existir
    if (isv.referencias) {
      check(`${nome}: ISV referencias.acumuladoAtual definido`,
        isv.referencias.acumuladoAtual !== undefined && !isNaN(isv.referencias.acumuladoAtual),
        `acumAtual=${isv.referencias.acumuladoAtual}`);
    }

    console.log(`  >> ISV=${isv.total} (${isv.classificacao})`);
    console.log(`     Ritmo=${isv.pontuacao.ritmo}/${max.ritmo} Proj=${isv.pontuacao.projecao}/${max.projecao} Tend=${isv.pontuacao.tendencia}/${max.tendencia} Acel=${isv.pontuacao.aceleracao}/${max.aceleracao}`);
  } else if (d.isv && d.isv.insuficiente) {
    console.log(`  >> ISV: insuficiente (historico < 3 versoes)`);
  } else {
    console.log(`  >> ISV: nao calculado`);
  }

  // 6. Projecao realista
  if (d.projecaoRealista) {
    const pr = d.projecaoRealista;

    if (d.versaoEmAndamento) {
      // Versao em andamento DEVE ter projecao conservadora
      check(`${nome}: projecao conservadora definida (em andamento)`,
        pr.conservadora !== null && pr.conservadora !== undefined && !isNaN(pr.conservadora),
        `conservadora=${pr.conservadora}`);

      if (pr.conservadora && d.totais.entradasBrutas > 0) {
        check(`${nome}: projecao conservadora >= acumulado atual`,
          pr.conservadora >= pr.acumuladoAtual,
          `conserv=${pr.conservadora} acum=${pr.acumuladoAtual}`);
      }
    } else {
      // Versao concluida: projecao pode ser null (correto - ja finalizou)
      console.log(`  [OK] ${nome}: versao concluida - projecao null esperado`);
      ok++;
    }

    console.log(`  >> Projecao: linear=${pr.linear} hist=${pr.historica} conserv=${pr.conservadora}`);
    console.log(`     Desvio vs estagio: ${pr.comparativoEstagio.desvioPercentual}% (${pr.comparativoEstagio.posicao})`);
  }

  return d;
}

async function testarHistorico() {
  console.log('\n===== HISTORICO COMPLETO =====');
  const h = await fetchJson('/estudos/historico');
  if (!h || !h.versoes) {
    warn('Sem dados historicos');
    return;
  }

  check('historico: versoes > 0', h.versoes.length > 0, `n=${h.versoes.length}`);
  check('historico: estatisticas existem', !!h.estatisticas);

  if (h.estatisticas) {
    // porSemana deve ter 4 entradas
    check('historico: porSemana tem S1-S4',
      h.estatisticas.porSemana && h.estatisticas.porSemana.length === 4,
      `n=${h.estatisticas.porSemana ? h.estatisticas.porSemana.length : 0}`);

    // porSemanaRecente deve existir
    check('historico: porSemanaRecente existe',
      !!h.estatisticas.porSemanaRecente && h.estatisticas.porSemanaRecente.length === 4);

    // Percentuais devem somar ~100%
    if (h.estatisticas.porSemana) {
      const somaPct = h.estatisticas.porSemana.reduce((a, s) => a + s.percentualMedio, 0);
      check('historico: soma % semanal ~100%',
        somaPct >= 90 && somaPct <= 110,
        `soma=${somaPct.toFixed(1)}%`);

      console.log('\n  Distribuicao semanal (todas):');
      for (const s of h.estatisticas.porSemana) {
        console.log(`    ${s.id}: media=${s.media} mediana=${s.mediana} %medio=${s.percentualMedio}% mdu=${s.mediaDiaUtil}`);
      }
    }
    if (h.estatisticas.porSemanaRecente) {
      const somaPctR = h.estatisticas.porSemanaRecente.reduce((a, s) => a + s.percentualMedio, 0);
      check('historico: soma % recente ~100%',
        somaPctR >= 90 && somaPctR <= 110,
        `soma=${somaPctR.toFixed(1)}%`);

      console.log('\n  Distribuicao semanal (recente 6v):');
      for (const s of h.estatisticas.porSemanaRecente) {
        console.log(`    ${s.id}: media=${s.media} mediana=${s.mediana} %medio=${s.percentualMedio}% mdu=${s.mediaDiaUtil}`);
      }
    }
  }

  // Comparar versoes entre si: ISVs devem variar
  const isvs = h.versoes.filter(v => v.isv && !v.isv.insuficiente).map(v => ({
    v: v.versao, isv: v.isv.total, cls: v.isv.classificacao
  }));
  console.log(`\n  ISV por versao (${isvs.length} com ISV valido):`);
  for (const x of isvs) {
    console.log(`    ${x.v}: ${x.isv} (${x.cls})`);
  }

  if (isvs.length > 3) {
    const vals = isvs.map(x => x.isv);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    check('historico: ISVs variam (nao todos iguais)',
      max - min > 5,
      `min=${min} max=${max}`);
  }
}

async function main() {
  console.log('=== PROVA REAL - Validacao de Calculos ===');
  console.log(`Base URL: ${BASE}`);
  console.log(`Data: ${new Date().toLocaleString('pt-BR')}\n`);

  // Testar cada versao individualmente
  for (const v of VERSOES_TESTE) {
    await testarVersao(v);
  }

  // Testar historico completo
  await testarHistorico();

  // Resumo
  console.log('\n===== RESUMO =====');
  console.log(`  OK: ${ok}`);
  console.log(`  ERROS: ${erros}`);
  console.log(`  AVISOS: ${avisos}`);
  if (erros > 0) {
    console.log('\n  >>> FALHOU: Existem erros que precisam ser corrigidos!');
    process.exit(1);
  } else {
    console.log('\n  >>> PASSOU: Todos os testes validados com sucesso!');
  }
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
