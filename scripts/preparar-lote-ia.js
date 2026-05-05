/**
 * scripts/preparar-lote-ia.js - Gera lotes de entrada para classificacao IA
 *
 * Uso: node scripts/preparar-lote-ia.js <versao>
 * Ex:  node scripts/preparar-lote-ia.js 10.6A-01
 *
 * Le sai-psai-folha.json do BuscaSaiFolha, filtra por versao,
 * aplica Camada 1 (regras automaticas) e gera lote pendente para IA.
 */

const fs = require('fs');
const path = require('path');
const { classificarAuto } = require('../src/estudos/laboratorio/regras-auto');
const indiceTags = require('../src/estudos/laboratorio/indice-tags');

const BUSCA_SAI_JSON = path.join(
  'C:', 'Users', '6038243',
  'OneDrive - Thomson Reuters Incorporated',
  'Aplicacoes Cursor', 'BuscaSaiFolha', 'data', 'cache', 'sai-psai-folha.json'
);
const IA_DIR = path.join(__dirname, '..', 'data', 'ia');

function carregarDadosBrutos() {
  console.log('[preparar] Carregando sai-psai-folha.json...');
  const raw = fs.readFileSync(BUSCA_SAI_JSON, 'utf-8');
  const parsed = JSON.parse(raw);
  console.log('[preparar] %d registros carregados', parsed.totalRegistros);
  return parsed.dados;
}

function filtrarPorVersao(dados, versao) {
  return dados.filter(d =>
    d.nomeVersao === versao && d.nomeArea === 'Escrita'
  );
}

function extrairRefsCruzadas(texto) {
  if (!texto) return [];
  const matches = texto.match(/SAI\s+(\d+)/gi) || [];
  return [...new Set(matches.map(m => m.replace(/SAI\s+/i, 'SAI ')))];
}

const SAIS_DIR = path.join(
  'C:', 'Users', '6038243',
  'OneDrive - Thomson Reuters Incorporated',
  'Aplicacoes Cursor', 'BuscaSaiFolha', 'data', 'sais'
);

function resolverArquivoMd(tipo, iPsai, iSai) {
  const dir = path.join(SAIS_DIR, tipo);
  const tentativas = [
    'PSAI-' + iPsai + '-SAI-' + iSai + '.md',
    'PSAI-' + iPsai + '.md'
  ];
  for (const nome of tentativas) {
    const full = path.join(dir, nome);
    if (fs.existsSync(full)) {
      return { caminho: full, tamanho_kb: Math.round(fs.statSync(full).size / 1024) };
    }
  }
  return null;
}

function prepararItem(d) {
  const md = resolverArquivoMd(d.tipoSAI, d.i_psai, d.i_sai);
  return {
    i_psai: d.i_psai, i_sai: d.i_sai, tipo: d.tipoSAI,
    tags: [], gravidade: d.gravidade_ne || 'Normal',
    nivel_alteracao: d.nivel_alteracao,
    tempoPrevistoTotal: d.tempoPrevistoTotal || 0,
    descricao: (d.sai_descricao || '').trim(),
    arquivo_md: md ? md.caminho : null,
    tamanho_md_kb: md ? md.tamanho_kb : 0,
    refs_cruzadas: extrairRefsCruzadas(
      (d.sai_descricao || '') + ' ' + (d.comportamento || '') +
      ' ' + (d.definicao || '').substring(0, 2000)
    ),
    status: d.situacaoSai
  };
}

function processarVersao(versao) {
  if (!fs.existsSync(IA_DIR)) fs.mkdirSync(IA_DIR, { recursive: true });

  const indice = indiceTags.carregar();
  const dados = carregarDadosBrutos();
  const filtrados = filtrarPorVersao(dados, versao);
  console.log('[preparar] Versao %s: %d SAIs encontradas', versao, filtrados.length);

  if (filtrados.length === 0) {
    console.log('[preparar] Nenhuma SAI para versao %s', versao);
    return;
  }

  const autoClassificados = [];
  const pendentesIA = [];

  for (const d of filtrados) {
    const item = prepararItem(d);
    if (indice && indice.por_psai[item.i_psai]) {
      item.tags = indice.por_psai[item.i_psai].tags || [];
    }
    const classif = classificarAuto(item, item.tags);
    if (classif._completa) {
      autoClassificados.push(classif);
    } else {
      pendentesIA.push(item);
    }
  }

  salvarArquivos(versao, autoClassificados, pendentesIA, filtrados.length);
}

function salvarArquivos(versao, auto, pendentes, total) {
  const autoPath = path.join(IA_DIR, `classificados-auto-${versao}.json`);
  fs.writeFileSync(autoPath, JSON.stringify({
    versao, gerado_em: new Date().toISOString(),
    total_auto: auto.length, itens: auto
  }, null, 2), 'utf-8');

  const lotePath = path.join(IA_DIR, `lote-entrada-${versao}.json`);
  fs.writeFileSync(lotePath, JSON.stringify({
    versao, gerado_em: new Date().toISOString(),
    instrucoes: 'Classificar conforme data/ia/PROMPT-CLASSIFICACAO.md',
    total_itens: pendentes.length, itens: pendentes
  }, null, 2), 'utf-8');

  console.log('[preparar] Resultado para %s:', versao);
  console.log('  Total: %d | Auto (Camada 1): %d | Pendentes IA: %d',
    total, auto.length, pendentes.length);
  console.log('  Salvo: %s', autoPath);
  console.log('  Salvo: %s', lotePath);

  atualizarControle(versao, total, auto.length, pendentes.length);
}

function atualizarControle(versao, total, auto, pendentes) {
  const controlePath = path.join(IA_DIR, 'controle-enriquecimento.json');
  let controle = { versoes: {} };
  try {
    if (fs.existsSync(controlePath)) {
      controle = JSON.parse(fs.readFileSync(controlePath, 'utf-8'));
    }
  } catch { /* novo arquivo */ }

  controle.versoes[versao] = {
    total, auto, pendentes_ia: pendentes, classificados_ia: 0,
    status: pendentes === 0 ? 'completa' : 'pendente',
    preparado_em: new Date().toISOString()
  };
  controle.atualizado_em = new Date().toISOString();
  fs.writeFileSync(controlePath, JSON.stringify(controle, null, 2), 'utf-8');
}

function processarTodas() {
  const versaoUtil = require('../src/core/versao');
  const hoje = new Date();
  const versoes = [];
  let ano = 2022, mes = 2;
  while (ano < hoje.getFullYear() || (ano === hoje.getFullYear() && mes <= hoje.getMonth() + 1)) {
    versoes.push(versaoUtil.nomeDaVersao(ano, mes));
    mes++;
    if (mes > 12) { mes = 1; ano++; }
  }

  if (!fs.existsSync(IA_DIR)) fs.mkdirSync(IA_DIR, { recursive: true });
  const indice = indiceTags.carregar();
  const dados = carregarDadosBrutos();
  const plano = [];
  let totalAuto = 0, totalPend = 0;

  for (const v of versoes) {
    const filtrados = filtrarPorVersao(dados, v);
    if (filtrados.length === 0) continue;

    const auto = [], pend = [];
    for (const d of filtrados) {
      const item = prepararItem(d);
      if (indice && indice.por_psai[item.i_psai]) {
        item.tags = indice.por_psai[item.i_psai].tags || [];
      }
      const classif = classificarAuto(item, item.tags);
      if (classif._completa) auto.push(classif);
      else pend.push(item);
    }
    salvarArquivos(v, auto, pend, filtrados.length);
    totalAuto += auto.length;
    totalPend += pend.length;

    if (pend.length > 0) {
      const mdKb = pend.reduce((s, i) => s + (i.tamanho_md_kb || 0), 0);
      plano.push({ versao: v, pendentes: pend.length, md_kb: mdKb });
    }
  }

  gerarPlanoSessoes(plano, totalAuto, totalPend);
}

function gerarPlanoSessoes(plano, totalAuto, totalPend) {
  const MAX_KB = 400;
  const sessoes = [];
  let sessaoAtual = { versoes: [], itens: 0, md_kb: 0 };

  for (const v of plano) {
    if (v.md_kb > MAX_KB) {
      if (sessaoAtual.versoes.length > 0) {
        sessoes.push(sessaoAtual);
        sessaoAtual = { versoes: [], itens: 0, md_kb: 0 };
      }
      sessoes.push({ versoes: [v.versao], itens: v.pendentes, md_kb: v.md_kb, grande: true });
    } else if (sessaoAtual.md_kb + v.md_kb > MAX_KB) {
      sessoes.push(sessaoAtual);
      sessaoAtual = { versoes: [v.versao], itens: v.pendentes, md_kb: v.md_kb };
    } else {
      sessaoAtual.versoes.push(v.versao);
      sessaoAtual.itens += v.pendentes;
      sessaoAtual.md_kb += v.md_kb;
    }
  }
  if (sessaoAtual.versoes.length > 0) sessoes.push(sessaoAtual);

  const planPath = path.join(IA_DIR, 'plano-sessoes.json');
  const planData = {
    gerado_em: new Date().toISOString(),
    resumo: {
      total_auto: totalAuto, total_pendentes_ia: totalPend,
      total_sessoes: sessoes.length,
      tempo_estimado: sessoes.length * 15 + ' min (~' + Math.round(sessoes.length * 15 / 60) + 'h)'
    },
    sessoes: sessoes.map((s, i) => ({
      sessao: i + 1, versoes: s.versoes, itens: s.itens,
      md_kb: s.md_kb, grande: s.grande || false
    }))
  };
  fs.writeFileSync(planPath, JSON.stringify(planData, null, 2), 'utf-8');

  console.log('\n=== PLANO DE SESSOES ===');
  console.log('Auto-classificadas: %d | Pendentes IA: %d', totalAuto, totalPend);
  console.log('Sessoes necessarias: %d (~%dh a 15min/sessao)',
    sessoes.length, Math.round(sessoes.length * 15 / 60));
  for (let i = 0; i < sessoes.length; i++) {
    const s = sessoes[i];
    console.log('  Sessao %d: %s (%d itens, %d KB)%s',
      i + 1, s.versoes.join(' + '), s.itens, s.md_kb,
      s.grande ? ' [GRANDE]' : '');
  }
  console.log('\nPlano salvo em: %s', planPath);
}

const arg = process.argv[2];
if (!arg) {
  console.error('Uso: node scripts/preparar-lote-ia.js <versao>');
  console.error('      node scripts/preparar-lote-ia.js --todas');
  process.exit(1);
}
if (arg === '--todas') processarTodas();
else processarVersao(arg);
