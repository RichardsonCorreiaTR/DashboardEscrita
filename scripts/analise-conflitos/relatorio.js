/**
 * relatorio.js - Gera relatorio textual da analise de conflitos
 */

const fs = require('fs');
const path = require('path');

const RISCO_EMOJI = {
  CRITICO: '[!!!]',
  ALTO: '[!!]',
  MEDIO: '[!]',
  BAIXO: '[-]'
};

function gerarRelatorio(resultado, outputPath) {
  const linhas = [];
  const dt = new Date().toLocaleDateString('pt-BR');

  linhas.push('='.repeat(80));
  linhas.push('  ANALISE DE CONFLITOS PSAI/SAI - ESCRITA FISCAL vs TIME SA');
  linhas.push(`  Data: ${dt} | Periodo: ultimas 2 semanas`);
  linhas.push('='.repeat(80));

  secaoResumo(linhas, resultado);
  secaoAtividadesSA(linhas, resultado.resumoAtividadesSA);
  secaoPsaisSA(linhas, resultado);
  secaoConflitos(linhas, resultado.conflitos);
  secaoDuplicidades(linhas, resultado.duplicidades);
  secaoRecomendacoes(linhas, resultado);

  const texto = linhas.join('\n');
  fs.writeFileSync(outputPath, texto, 'utf-8');
  console.log('\nRelatorio salvo em: %s', outputPath);
  return texto;
}

function secaoResumo(linhas, r) {
  linhas.push('\n' + '-'.repeat(80));
  linhas.push('  1. RESUMO EXECUTIVO');
  linhas.push('-'.repeat(80));
  linhas.push(`  Total NEs pendentes Escrita Fiscal: ${r.totalNEsPendentes}`);
  linhas.push(`  PSAIs trabalhadas pelo time SA (2 sem): ${r.totalPsaisSA}`);
  linhas.push(`  SAIs com atividade do time SA (2 sem):  ${r.totalSaisSA}`);
  linhas.push(`  Conflitos identificados: ${r.conflitos.length}`);
  linhas.push(`  Duplicidades em NEs pendentes: ${r.duplicidades.length}`);

  const criticos = r.conflitos.filter(c => c.risco === 'CRITICO').length;
  const altos = r.conflitos.filter(c => c.risco === 'ALTO').length;
  if (criticos > 0 || altos > 0) {
    linhas.push(`\n  ** ATENCAO: ${criticos} conflito(s) CRITICO(S), ${altos} ALTO(S) **`);
  }
}

function secaoAtividadesSA(linhas, resumo) {
  linhas.push('\n' + '-'.repeat(80));
  linhas.push('  2. ATIVIDADES DO TIME SA (ultimas 2 semanas)');
  linhas.push('-'.repeat(80));

  for (const [nome, dados] of Object.entries(resumo)) {
    const horas = (dados.totalMinutos / 60).toFixed(1);
    linhas.push(`\n  ${nome}: ${horas}h em ${dados.diasTrabalhados} dias`);

    const tops = Object.entries(dados.atividades)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    for (const [atv, min] of tops) {
      linhas.push(`    - ${atv}: ${(min / 60).toFixed(1)}h`);
    }
  }
}

function secaoPsaisSA(linhas, resultado) {
  linhas.push('\n' + '-'.repeat(80));
  linhas.push('  3. PSAIs E SAIs TRABALHADAS PELO TIME SA');
  linhas.push('-'.repeat(80));

  const { psaisTrabalhadasSA, saisTrabalhadasSA,
    detalhePorPsai, detalhePorSai } = resultado;

  if (psaisTrabalhadasSA.length > 0) {
    linhas.push(`\n  PSAIs (${psaisTrabalhadasSA.length}):`);
    for (const psai of psaisTrabalhadasSA) {
      const detalhe = detalhePorPsai[psai] || [];
      const analistas = [...new Set(detalhe.map(d => d.analista))].join(', ');
      const situacoes = [...new Set(detalhe.map(d => d.situacao))].join(', ');
      linhas.push(`    PSAI ${psai}: ${analistas} | ${situacoes}`);
    }
  }

  if (saisTrabalhadasSA.length > 0) {
    linhas.push(`\n  SAIs com atividade registrada (${saisTrabalhadasSA.length}):`);
    for (const sai of saisTrabalhadasSA.slice(0, 50)) {
      const detalhe = detalhePorSai[sai] || [];
      const analistas = [...new Set(detalhe.map(d => d.analista))].join(', ');
      const minTotal = detalhe.reduce((s, d) => s + (d.tempo || 0), 0);
      linhas.push(`    SAI ${sai}: ${analistas} | ${(minTotal / 60).toFixed(1)}h`);
    }
    if (saisTrabalhadasSA.length > 50) {
      linhas.push(`    ... e mais ${saisTrabalhadasSA.length - 50} SAIs`);
    }
  }
}

function secaoConflitos(linhas, conflitos) {
  linhas.push('\n' + '-'.repeat(80));
  linhas.push('  4. CONFLITOS IDENTIFICADOS (NEs Folha em que ambos os times atuam)');
  linhas.push('-'.repeat(80));

  if (conflitos.length === 0) {
    linhas.push('\n  Nenhum conflito direto identificado.');
    return;
  }

  for (const c of conflitos) {
    const badge = RISCO_EMOJI[c.risco] || '';
    linhas.push(`\n  ${badge} PSAI ${c.i_psai} / SAI ${c.i_sai || '-'} [Risco: ${c.risco}]`);
    linhas.push(`    Gravidade: ${c.gravidade || 'Normal'}`);
    linhas.push(`    Cadastro PSAI: ${formatarData(c.cadastroPsai)}`);
    linhas.push(`    Versao: ${c.nomeVersao || 'Sem versao'}`);
    linhas.push(`    Situacao SAI: ${c.situacaoSai} | Situacao PSAI: ${c.situacaoPsai}`);

    if (c.responsaveisPsai?.length > 0) {
      linhas.push(`    Responsaveis PSAI: ${c.responsaveisPsai.join(', ')}`);
    }
    if (c.responsaveisSai?.length > 0) {
      linhas.push(`    Responsaveis SAI: ${c.responsaveisSai.join(', ')}`);
    }

    if (c.trabalhadoPorSA?.length > 0) {
      linhas.push('    Tramites SA:');
      for (const t of c.trabalhadoPorSA) {
        linhas.push(`      - ${t.analista} em ${formatarData(t.data)}: ${t.situacao}`);
      }
    }

    if (c.atividadesSA?.length > 0) {
      const minTotal = c.atividadesSA.reduce((s, a) => s + (a.tempo || 0), 0);
      linhas.push(`    Tempo SA na SAI: ${(minTotal / 60).toFixed(1)}h`);
    }
  }
}

function secaoDuplicidades(linhas, duplicidades) {
  linhas.push('\n' + '-'.repeat(80));
  linhas.push('  5. DUPLICIDADES EM NEs PENDENTES');
  linhas.push('-'.repeat(80));

  if (duplicidades.length === 0) {
    linhas.push('\n  Nenhuma duplicidade identificada em PSAIs pendentes.');
    return;
  }

  for (const d of duplicidades) {
    linhas.push(`\n  PSAI ${d.i_psai}: ${d.count} ocorrencias`);
    for (const item of d.items) {
      linhas.push(`    - SAI ${item.i_sai}, Sit SAI: ${item.i_sai_situacoes}, Versao: ${item.nomeVersao || '-'}`);
    }
  }
}

function secaoRecomendacoes(linhas, resultado) {
  linhas.push('\n' + '-'.repeat(80));
  linhas.push('  6. RECOMENDACOES');
  linhas.push('-'.repeat(80));

  const criticos = resultado.conflitos.filter(c => c.risco === 'CRITICO');
  const altos = resultado.conflitos.filter(c => c.risco === 'ALTO');

  if (criticos.length > 0) {
    linhas.push('\n  [URGENTE] Conflitos criticos requerem alinhamento IMEDIATO:');
    for (const c of criticos) {
      linhas.push(`    - PSAI ${c.i_psai}: alinhar com ${c.responsaveisPsai?.join(', ') || 'responsavel nao identificado'}`);
    }
  }

  if (altos.length > 0) {
    linhas.push('\n  [IMPORTANTE] Conflitos altos requerem verificacao esta semana:');
    for (const c of altos) {
      linhas.push(`    - PSAI ${c.i_psai}: verificar com ${c.responsaveisPsai?.join(', ') || 'responsavel nao identificado'}`);
    }
  }

  if (resultado.duplicidades.length > 0) {
    linhas.push('\n  [VERIFICAR] Duplicidades em NEs pendentes:');
    linhas.push('    Revisar se as PSAIs listadas na secao 5 nao estao sendo tratadas em paralelo.');
  }

  linhas.push('\n  [GERAL]');
  linhas.push('    - Estabelecer comunicacao semanal entre times NE e SA sobre PSAIs em andamento');
  linhas.push('    - Verificar PSAIs listadas na secao 3 que nao apareceram como conflito');
  linhas.push('      (podem nao ser NE Folha, mas ainda assim impactar indiretamente)');
}

function formatarData(dt) {
  if (!dt) return '-';
  const d = new Date(dt);
  if (isNaN(d.getTime())) return String(dt);
  return d.toLocaleDateString('pt-BR');
}

module.exports = { gerarRelatorio };
