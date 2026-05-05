/**
 * analise-v2.js - Analise completa de conflitos usando dados do cache
 *
 * Executa offline (sem banco) a partir do cache salvo pela coleta.
 * Gera relatorio detalhado com cruzamentos.
 */

const fs = require('fs');
const path = require('path');
const q = require('./queries');

const CACHE_FILE = path.join(__dirname, '..', '..', 'data', 'cache', 'analise-conflitos.json');
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'output');

function mapearAnalistaSA(valor) {
  return q.EQUIPE_SA.find(e => e.iu === valor || e.sgd === valor);
}

function mapearAnalistaNE(nome) {
  return q.EQUIPE_NE.find(e =>
    nome && nome.toLowerCase().includes(e.apelido.toLowerCase())
  );
}

function executar() {
  console.log('Carregando cache...');
  const dados = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));

  const { tramitesPsai, nesPendentes, detalhesSaiPsai, respPsai, atividades, atividadesComSai } = dados;

  const linhas = [];
  const dt = new Date().toLocaleDateString('pt-BR');

  linhas.push('='.repeat(90));
  linhas.push('  ANALISE DE CONFLITOS E RETRABALHO - ESCRITA FISCAL vs TIME SA (Sabrina)');
  linhas.push(`  Data da analise: ${dt} | Periodo analisado: 04/03 a 18/03/2026`);
  linhas.push(`  Versao corrente: 10.6A-03 (23/02 a 23/03/2026)`);
  linhas.push('='.repeat(90));

  // === SECAO 1: RESUMO NUMERICO ===
  const psaisSA = [...new Set(tramitesPsai.map(t => t.i_psai))];
  const psaisNE = [...new Set(nesPendentes.map(n => n.i_psai))];
  const intersecao = psaisSA.filter(p => psaisNE.includes(p));

  const detNE = detalhesSaiPsai.filter(d => d.tipoSAI === 'NE');
  const detSAM = detalhesSaiPsai.filter(d => d.tipoSAI === 'SAM');
  const detSAL = detalhesSaiPsai.filter(d => d.tipoSAI === 'SAL');
  const detSAIL = detalhesSaiPsai.filter(d => d.tipoSAI === 'SAIL');

  linhas.push('\n' + '-'.repeat(90));
  linhas.push('  1. RESUMO EXECUTIVO');
  linhas.push('-'.repeat(90));
  linhas.push(`  NEs pendentes Escrita Fiscal (saldo atual):           ${nesPendentes.length}`);
  linhas.push(`  PSAIs com tramite do time SA (2 semanas):       ${psaisSA.length}`);
  linhas.push(`    - Tipo NE:   ${detNE.filter(d => psaisSA.includes(d.i_psai)).length}`);
  linhas.push(`    - Tipo SAM:  ${detSAM.filter(d => psaisSA.includes(d.i_psai)).length}`);
  linhas.push(`    - Tipo SAL:  ${detSAL.filter(d => psaisSA.includes(d.i_psai)).length}`);
  linhas.push(`    - Tipo SAIL: ${detSAIL.filter(d => psaisSA.includes(d.i_psai)).length}`);
  linhas.push(`  PSAIs em COMUM (SA trabalhou + e NE pendente):  ${intersecao.length}`);

  // === SECAO 2: ATIVIDADES SA RESUMIDAS ===
  linhas.push('\n' + '-'.repeat(90));
  linhas.push('  2. ATIVIDADES DO TIME SA - ULTIMAS 2 SEMANAS');
  linhas.push('-'.repeat(90));

  const porAnalista = {};
  for (const a of atividades) {
    const analista = mapearAnalistaSA(a.i_usuarios);
    const nome = analista?.apelido || `IU:${a.i_usuarios}`;
    if (!porAnalista[nome]) {
      porAnalista[nome] = { totalMin: 0, dias: new Set(), atividades: {} };
    }
    porAnalista[nome].totalMin += a.minutos;
    porAnalista[nome].dias.add(String(a.dia).slice(0, 10));
    const atv = a.atividade || 'Sem nome';
    porAnalista[nome].atividades[atv] = (porAnalista[nome].atividades[atv] || 0) + a.minutos;
  }

  for (const [nome, d] of Object.entries(porAnalista).sort((a, b) => b[1].totalMin - a[1].totalMin)) {
    const horas = (d.totalMin / 60).toFixed(1);
    linhas.push(`\n  ${nome}: ${horas}h em ${d.dias.size} dias`);

    const atvNE = Object.entries(d.atividades)
      .filter(([k]) => k.toLowerCase().includes('ne'))
      .reduce((s, [, v]) => s + v, 0);
    if (atvNE > 0) linhas.push(`    >>> Tempo em atividades NE: ${(atvNE / 60).toFixed(1)}h <<<`);

    const tops = Object.entries(d.atividades).sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [atv, min] of tops) {
      linhas.push(`    - ${atv}: ${(min / 60).toFixed(1)}h`);
    }
  }

  // === SECAO 3: PSAIs TRABALHADAS PELO SA ===
  linhas.push('\n' + '-'.repeat(90));
  linhas.push('  3. PSAIs TRABALHADAS PELO TIME SA (com tramite nas ultimas 2 semanas)');
  linhas.push('-'.repeat(90));

  const tramitePorPsai = {};
  for (const t of tramitesPsai) {
    if (!tramitePorPsai[t.i_psai]) tramitePorPsai[t.i_psai] = [];
    const analista = mapearAnalistaSA(t.sgd_analista);
    tramitePorPsai[t.i_psai].push({
      analista: analista?.apelido || `SGD:${t.sgd_analista}`,
      data: t.entrada,
      situacao: t.situacao
    });
  }

  for (const psaiId of psaisSA) {
    const detalhe = detalhesSaiPsai.find(d => d.i_psai === psaiId);
    const tramites = tramitePorPsai[psaiId] || [];
    const analistas = [...new Set(tramites.map(t => t.analista))].join(', ');
    const situacoes = [...new Set(tramites.map(t => t.situacao))].join(', ');
    const tipo = detalhe?.tipoSAI || '?';
    const sai = detalhe?.i_sai || 0;
    const versao = detalhe?.nomeVersao || '-';
    const sitSai = detalhe?.i_sai_situacoes ?? '?';

    const eNEPendente = intersecao.includes(psaiId) ? ' *** NE PENDENTE ***' : '';

    linhas.push(`\n  PSAI ${psaiId} [${tipo}] SAI: ${sai} | Versao: ${versao} | Sit SAI: ${sitSai}${eNEPendente}`);
    linhas.push(`    Analistas SA: ${analistas}`);
    linhas.push(`    Tramites: ${situacoes}`);

    const resp = respPsai.filter(r => r.i_psai === psaiId);
    if (resp.length > 0) {
      const nomes = [...new Set(resp.map(r => r.nome_responsavel))];
      const doNE = nomes.filter(n => mapearAnalistaNE(n));
      if (doNE.length > 0) {
        linhas.push(`    Responsaveis NE nesta PSAI: ${doNE.join(', ')}`);
      }
    }
  }

  // === SECAO 4: CONFLITOS DIRETOS ===
  linhas.push('\n' + '-'.repeat(90));
  linhas.push('  4. CONFLITOS DIRETOS - PSAIs que sao NEs pendentes E o time SA trabalhou');
  linhas.push('-'.repeat(90));

  if (intersecao.length === 0) {
    linhas.push('\n  Nenhuma PSAI em comum entre as trabalhadas pelo SA e as NEs pendentes.');
  } else {
    for (const psaiId of intersecao) {
      const ne = nesPendentes.find(n => n.i_psai === psaiId);
      const detalhe = detalhesSaiPsai.find(d => d.i_psai === psaiId);
      const tramites = tramitePorPsai[psaiId] || [];
      const analistasSA = [...new Set(tramites.map(t => t.analista))].join(', ');
      const resp = respPsai.filter(r => r.i_psai === psaiId);
      const responsaveis = [...new Set(resp.map(r => r.nome_responsavel))];
      const responsaveisNE = responsaveis.filter(n => mapearAnalistaNE(n));

      const gravidade = ne?.gravidade_ne || 'Normal';
      const sitSai = detalhe?.i_sai_situacoes ?? 0;
      const versao = detalhe?.nomeVersao || '-';
      const sai = detalhe?.i_sai || 0;

      let risco = 'BAIXO';
      if (gravidade === 'Critica') risco = 'CRITICO';
      else if (gravidade === 'Grave') risco = 'ALTO';
      else if (sitSai >= 7 && sitSai <= 15) risco = 'ALTO';
      else if (versao !== '-' && versao) risco = 'MEDIO';

      linhas.push(`\n  [RISCO ${risco}] PSAI ${psaiId} / SAI ${sai}`);
      linhas.push(`    Gravidade: ${gravidade} | Sit SAI: ${sitSai} | Versao: ${versao}`);
      linhas.push(`    Cadastro PSAI: ${formatarData(ne?.CadastroPSAI)}`);
      linhas.push(`    Analistas SA que tramitaram: ${analistasSA}`);
      linhas.push(`    Responsaveis PSAI (todos): ${responsaveis.join(', ') || 'nenhum registrado'}`);
      if (responsaveisNE.length > 0) {
        linhas.push(`    >>> RESPONSAVEIS DO TIME NE: ${responsaveisNE.join(', ')} <<<`);
      }
      for (const t of tramites) {
        linhas.push(`      Tramite: ${t.analista} em ${formatarData(t.data)} -> ${t.situacao}`);
      }
    }
  }

  // === SECAO 5: NEs PENDENTES COM RESPONSAVEIS DO NE E DO SA ===
  linhas.push('\n' + '-'.repeat(90));
  linhas.push('  5. NEs PENDENTES COM ENVOLVIMENTO DE AMBOS OS TIMES (via responsaveis)');
  linhas.push('-'.repeat(90));

  const nomesSA = q.EQUIPE_SA.map(e => e.nome.toLowerCase());
  const nesComSA = [];
  for (const ne of nesPendentes) {
    const resp = respPsai.filter(r => r.i_psai === ne.i_psai);
    const nomes = resp.map(r => r.nome_responsavel);
    const temSA = nomes.some(n => n && nomesSA.some(sa => n.toLowerCase().includes(sa.split(' ')[0].toLowerCase())));
    const temNE = nomes.some(n => n && mapearAnalistaNE(n));

    if (temSA && temNE) {
      nesComSA.push({ ...ne, responsaveis: nomes, temSA: true, temNE: true });
    } else if (temSA) {
      nesComSA.push({ ...ne, responsaveis: nomes, temSA: true, temNE: false });
    }
  }

  if (nesComSA.length === 0) {
    linhas.push('\n  Nenhuma NE pendente com responsaveis de ambos os times.');
  } else {
    const comAmbos = nesComSA.filter(n => n.temSA && n.temNE);
    const soSA = nesComSA.filter(n => n.temSA && !n.temNE);

    if (comAmbos.length > 0) {
      linhas.push(`\n  NEs com responsaveis de AMBOS os times (${comAmbos.length}):`);
      for (const ne of comAmbos) {
        const resp = [...new Set(ne.responsaveis)].join(', ');
        linhas.push(`    PSAI ${ne.i_psai} / SAI ${ne.i_sai || '-'} | Grav: ${ne.gravidade_ne} | Resp: ${resp}`);
      }
    }

    if (soSA.length > 0) {
      linhas.push(`\n  NEs pendentes com responsavel do time SA (mas sem NE) (${soSA.length}):`);
      for (const ne of soSA.slice(0, 20)) {
        const resp = [...new Set(ne.responsaveis)].join(', ');
        linhas.push(`    PSAI ${ne.i_psai} / SAI ${ne.i_sai || '-'} | Grav: ${ne.gravidade_ne} | Resp: ${resp}`);
      }
      if (soSA.length > 20) linhas.push(`    ... e mais ${soSA.length - 20}`);
    }
  }

  // === SECAO 6: NEs PENDENTES NA VERSAO CORRENTE ===
  linhas.push('\n' + '-'.repeat(90));
  linhas.push('  6. NEs PENDENTES NA VERSAO 10.6A-03 (maior risco de impacto)');
  linhas.push('-'.repeat(90));

  const nesVersao = nesPendentes.filter(n => n.nomeVersao === '10.6A-03');
  linhas.push(`\n  Total NEs commitadas/alocadas na 10.6A-03: ${nesVersao.length}`);

  for (const ne of nesVersao) {
    const resp = respPsai.filter(r => r.i_psai === ne.i_psai);
    const nomes = [...new Set(resp.map(r => r.nome_responsavel))];
    const responsaveisNE = nomes.filter(n => mapearAnalistaNE(n));
    const sit = ne.i_sai_situacoes;
    let fase = 'Desconhecida';
    if (sit === 7) fase = 'Definicao de Dev';
    else if (sit === 10) fase = 'Em Desenvolvimento';
    else if (sit === 11) fase = 'Dev Concluido';
    else if (sit === 14) fase = 'Em Teste';
    else if (sit === 15) fase = 'Teste Concluido';
    else if (sit === 25) fase = 'SAI Aprovada';
    else if (sit === 3) fase = 'A Desenvolver';
    else if (sit === 24) fase = 'A Estimar Tempo';

    const eConflito = intersecao.includes(ne.i_psai) ? ' *** CONFLITO ***' : '';
    linhas.push(`    PSAI ${ne.i_psai} / SAI ${ne.i_sai} | ${fase} (sit ${sit}) | Grav: ${ne.gravidade_ne}${eConflito}`);
    if (responsaveisNE.length > 0) {
      linhas.push(`      Responsaveis NE: ${responsaveisNE.join(', ')}`);
    }
  }

  // === SECAO 7: ANALISE DE RISCO E RECOMENDACOES ===
  linhas.push('\n' + '-'.repeat(90));
  linhas.push('  7. ANALISE DE RISCO E RECOMENDACOES');
  linhas.push('-'.repeat(90));

  // NEs com atividade NE pelo time SA
  const atvNEAnalistas = {};
  for (const a of atividades) {
    if (a.atividade && a.atividade.toLowerCase().includes('ne')) {
      const analista = mapearAnalistaSA(a.i_usuarios);
      const nome = analista?.apelido || `IU:${a.i_usuarios}`;
      atvNEAnalistas[nome] = (atvNEAnalistas[nome] || 0) + a.minutos;
    }
  }

  if (Object.keys(atvNEAnalistas).length > 0) {
    linhas.push('\n  [ATENCAO] Analistas SA com tempo registrado em atividades NE:');
    for (const [nome, min] of Object.entries(atvNEAnalistas).sort((a, b) => b[1] - a[1])) {
      linhas.push(`    ${nome}: ${(min / 60).toFixed(1)}h em atividades NE`);
    }
    linhas.push('    -> Verificar se essas NEs nao conflitam com o backlog do time NE');
  }

  if (intersecao.length > 0) {
    linhas.push(`\n  [CRITICO] ${intersecao.length} PSAI(s) sendo trabalhada(s) por ambos os times:`);
    for (const psaiId of intersecao) {
      const tramites = tramitePorPsai[psaiId] || [];
      const analistasSA = [...new Set(tramites.map(t => t.analista))].join(', ');
      const resp = respPsai.filter(r => r.i_psai === psaiId);
      const responsaveisNE = [...new Set(resp.map(r => r.nome_responsavel).filter(n => mapearAnalistaNE(n)))];
      linhas.push(`    PSAI ${psaiId}: SA(${analistasSA}) + NE(${responsaveisNE.join(', ') || '-'})`);
      linhas.push(`      -> ALINHAR IMEDIATAMENTE para evitar retrabalho`);
    }
  }

  linhas.push('\n  RECOMENDACOES GERAIS:');
  linhas.push('  1. Alinhar com o time SA (Sabrina) as PSAIs em comum listadas na secao 4');
  linhas.push('  2. Analistas SA que registraram tempo em NE (secao 7) podem estar');
  linhas.push('     duplicando esforco - verificar quais NEs especificas');
  linhas.push('  3. Estabelecer ritual semanal de 15min entre coordenadores para');
  linhas.push('     sincronizar PSAIs em andamento');
  linhas.push('  4. NEs na versao 10.6A-03 (secao 6) sao as de maior risco de');
  linhas.push('     impacto - monitorar qualquer mudanca de situacao');

  const nesComSAambos = nesComSA.filter(n => n.temSA && n.temNE);
  if (nesComSAambos.length > 0) {
    linhas.push(`\n  5. ${nesComSAambos.length} NE(s) pendente(s) tem responsaveis de ambos os times`);
    linhas.push('     (secao 5) - alto risco de sobreposicao de trabalho');
  }

  // === RODAPE ===
  linhas.push('\n' + '='.repeat(90));
  linhas.push('  FIM DO RELATORIO');
  linhas.push('='.repeat(90));

  const texto = linhas.join('\n');
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, `conflitos-completo-${new Date().toISOString().slice(0, 10)}.txt`);
  fs.writeFileSync(outputPath, texto, 'utf-8');
  console.log('Relatorio salvo em:', outputPath);
  console.log('\n' + texto);
}

function formatarData(dt) {
  if (!dt) return '-';
  const d = new Date(dt);
  if (isNaN(d.getTime())) return String(dt);
  return d.toLocaleDateString('pt-BR');
}

executar();
