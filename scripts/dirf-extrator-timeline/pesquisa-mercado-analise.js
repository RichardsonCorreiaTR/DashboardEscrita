/**
 * Pesquisa de mercado: parse por tópicos, síntese e leitura cruzada com a timeline (não cópia solta).
 */

const {
  carregarRawPrimeiroMd,
  removerFrontmatter,
  normalizarEol,
  carregarTrechosPesquisaMercado
} = require('./pesquisa-mercado');

function extrairMetaYaml(raw) {
  const t = normalizarEol(raw);
  if (!t.startsWith('---\n')) return {};
  const m = t.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const o = {};
  m[1].split('\n').forEach(line => {
    const i = line.indexOf(':');
    if (i < 1) return;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    o[k] = v;
  });
  return o;
}

function limparMdInline(s) {
  return String(s || '').replace(/\*\*/g, '');
}

function resumirTexto(s, max) {
  const t = limparMdInline(s)
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= max) return t;
  const c = t.slice(0, max);
  const sp = c.lastIndexOf(' ');
  return (sp > max * 0.6 ? c.slice(0, sp) : c) + '…';
}

function extrairNarrativaBulletsLinks(corpoSec) {
  const narrM = corpoSec.match(/\*\*Narrativa\.\*\*\s*([\s\S]*?)(?=\*\*Bullets|\*\*Links|---|\n##|$)/i);
  const narr = narrM ? narrM[1].replace(/\s+/g, ' ').trim() : '';
  const bullM = corpoSec.match(/\*\*Bullets[^*]*\*\*([\s\S]*?)(?=\*\*Links|---|\n##|$)/i);
  const bullets = [];
  if (bullM) {
    bullM[1].split('\n').forEach(l => {
      const x = l.replace(/^[-*]\s*/, '').replace(/\*\*/g, '').trim();
      if (x.length > 12) bullets.push(x);
    });
  }
  const links = [];
  const linkM = corpoSec.match(/\*\*Links:\*\*([\s\S]*?)(?=---|\n##|$)/i);
  if (linkM) {
    const re = /\[([^\]]+)\]\(([^)]+)\)/g;
    let mm;
    while ((mm = re.exec(linkM[1])) !== null) links.push({ texto: mm[1], url: mm[2] });
  }
  return { narr, bullets, links };
}

function extrairContextoRegulatorio(bloco) {
  const texto = bloco.replace(/^##[^\n]+\n/, '').replace(/\n---\s*$/g, '').trim();
  const paras = texto
    .split(/\n\n+/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 30 && !p.startsWith('---'));
  const j = paras.slice(0, 2).join(' ');
  return resumirTexto(j, 520);
}

function fatiarPorH2(corpo) {
  return corpo
    .split(/\n(?=## )/)
    .map(s => s.trim())
    .filter(Boolean);
}

function construirConexaoJornada(payload) {
  const t = payload.totais || {};
  const it = payload.itens || [];
  const nes = it.filter(i => i.ramo === 'ne').length;
  const sas = it.filter(i => i.ramo === 'sa').length;
  const meses = {};
  it.forEach(i => {
    const ym = (i.entrada || '').slice(0, 7);
    if (ym) meses[ym] = (meses[ym] || 0) + 1;
  });
  const ent = Object.entries(meses).sort((a, b) => b[1] - a[1])[0];
  const mesesN = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  let pico = '';
  if (ent) {
    const [y, mm] = ent[0].split('-');
    pico = ` Pico de cadastro PSAI: ${mesesN[parseInt(mm, 10) - 1]}/${y} (${ent[1]} itens).`;
  }
  return (
    `Leitura cruzada com esta página: ${t.itens || 0} registro(s) na cronologia (${nes} NE, ${sas} SA), ` +
    `${t.liberadas || 0} liberada(s), ${t.pendentes || 0} pendente(s).${pico} ` +
    'Os tópicos abaixo sintetizam o que o mercado discute (eSocial, extrator, múltiplas folhas, etc.) — contexto para a narrativa, não substituto do SGD.'
  );
}

function parsearTopicos(corpo) {
  const topicos = [];
  let contexto = '';
  let intro = '';
  fatiarPorH2(corpo).forEach(bloco => {
    const l1 = bloco.split('\n')[0].trim();
    if (l1.startsWith('# ') && !l1.startsWith('##')) {
      const resto = bloco
        .split('\n')
        .slice(1)
        .join('\n')
        .trim();
      intro = resumirTexto(resto.replace(/\s+/g, ' '), 320);
      return;
    }
    if (/^##\s*Contexto\s/i.test(l1)) {
      contexto = extrairContextoRegulatorio(bloco);
      return;
    }
    if (/^##\s*Tópico\s*\d+/i.test(l1)) {
      const tit = l1.replace(/^##\s*/, '').trim();
      const corpoSec = bloco.split('\n').slice(1).join('\n');
      const { narr, bullets, links } = extrairNarrativaBulletsLinks(corpoSec);
      topicos.push({
        titulo: limparMdInline(tit),
        sintese: resumirTexto(narr, 240),
        bullets: bullets.slice(0, 4).map(limparMdInline),
        links: links.slice(0, 4)
      });
    }
  });
  return { contexto: contexto || intro, topicos, intro };
}

function analisarMarkdownPesquisa(raw, payload) {
  const meta = extrairMetaYaml(raw);
  const corpo = removerFrontmatter(raw);
  const { contexto, topicos } = parsearTopicos(corpo);
  return {
    meta,
    contexto_curto: limparMdInline(contexto),
    topicos,
    conexao_jornada: construirConexaoJornada(payload)
  };
}

function carregarPesquisaMercadoAnalisada(payload) {
  const carregado = carregarRawPrimeiroMd();
  if (!carregado.ok) {
    return {
      ok: false,
      trechos: [],
      arquivos: [],
      origem: null,
      nota: 'Nenhum .md encontrado na pasta de pesquisa.',
      formato: 'vazio'
    };
  }
  const analise = analisarMarkdownPesquisa(carregado.raw, payload);
  if (!analise.topicos.length) {
    const leg = carregarTrechosPesquisaMercado();
    return {
      ok: leg.ok,
      origem: leg.origem,
      arquivos: leg.arquivos || [],
      formato: 'legado',
      meta: analise.meta,
      contexto_curto: analise.contexto_curto || '',
      topicos: [],
      conexao_jornada: construirConexaoJornada(payload),
      trechos: leg.trechos || [],
      nota: leg.nota
    };
  }
  return {
    ok: true,
    origem: carregado.origem,
    arquivos: [carregado.rel],
    formato: 'estruturado',
    meta: analise.meta,
    contexto_curto: analise.contexto_curto,
    topicos: analise.topicos,
    conexao_jornada: analise.conexao_jornada,
    trechos: [],
    nota: null
  };
}

module.exports = { carregarPesquisaMercadoAnalisada, construirConexaoJornada, analisarMarkdownPesquisa };
