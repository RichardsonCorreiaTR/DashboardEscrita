/**
 * equipes-matriz-volume.js - Tabela Volume x Complexidade no painel do time
 *
 * Volume = qtd entregas (meses fechados). Complexidade = pts medios/entrega.
 * Faixas por quartis relativos ao time. Avaliacao via matriz de textos.
 */
/* eslint-disable no-unused-vars */
const EquipesMatrizVolume = (() => {
  const META_IDS = ['pontos-definicao', 'pontos-atividade-principal', 'psais-definidas'];
  const FAIXAS = ['Baixo', 'Médio', 'Alto', 'Muito Alto'];
  const ORD = { Baixo: 0, Médio: 1, Alto: 2, 'Muito Alto': 3 };

  function mesLimite() {
    return Math.max(0, new Date().getMonth()); // meses fechados (< mes atual)
  }

  function acumular(membro) {
    const metas = membro.metas || {};
    let qtd = 0, pts = 0;
    const limite = mesLimite();
    META_IDS.forEach(id => {
      const mensal = metas[id] && metas[id].mensal;
      if (!mensal) return;
      for (let m = 1; m <= limite; m++) {
        const d = mensal[m];
        if (!d) continue;
        qtd += Number(d.qtd_sais) || 0;
        pts += Number(d.pontos) || 0;
      }
    });
    if (qtd === 0 && pts > 0) qtd = 1;
    return {
      slug: membro.slug,
      apelido: membro.apelido,
      senioridade: membro.senioridade || membro.cargo || '',
      volume: qtd,
      complexidade: qtd > 0 ? Math.round((pts / qtd) * 10) / 10 : 0,
      pontos: pts
    };
  }

  function classificarQuartil(valores) {
    const n = valores.length;
    if (!n) return [];
    const sorted = valores.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v || a.i - b.i);
    const out = new Array(n);
    sorted.forEach((item, rank) => {
      const pct = n === 1 ? 0.5 : rank / (n - 1);
      let faixa = 'Baixo';
      if (pct >= 0.75) faixa = 'Muito Alto';
      else if (pct >= 0.5) faixa = 'Alto';
      else if (pct >= 0.25) faixa = 'Médio';
      out[item.i] = faixa;
    });
    return out;
  }

  function textoAvaliacao(vol, cx, junior) {
    const v = ORD[vol], c = ORD[cx];
    if (v === 0 && c === 0) return { txt: 'Necessita acompanhamento', alerta: true };
    if (v === 0) return { txt: 'Atenção para resultado global', alerta: true };
    if (v >= 3 && c >= 2) return { txt: 'Destaque do time', alerta: false };
    if (v >= 3 && c >= 1) return { txt: 'Forte produtividade', alerta: false };
    if (v === 2 && c >= 1) {
      if (junior && c >= 1) return { txt: 'Melhor júnior', alerta: false };
      return { txt: 'Boa evolução', alerta: false };
    }
    if (v === 1 && c >= 3) return { txt: 'Destaque do time', alerta: false };
    if (v === 1 && c === 2) return { txt: 'Acima da expectativa', alerta: false };
    if (v === 1 && c === 1) return { txt: 'Evolução consistente', alerta: false };
    if (v === 1 && c === 0) return { txt: 'Em linha com o time', alerta: false };
    return { txt: 'Em linha com o time', alerta: false };
  }

  function ehJunior(s) {
    const t = String(s || '').toLowerCase();
    return t.includes('júnior') || t.includes('junior');
  }

  function calcular(analistas) {
    const base = (analistas || []).map(acumular);
    const comDados = base.filter(r => r.volume > 0 || r.pontos > 0);
    if (!comDados.length) return [];
    const fxVol = classificarQuartil(comDados.map(r => r.volume));
    const fxCx = classificarQuartil(comDados.map(r => r.complexidade));
    return comDados.map((r, i) => {
      const vol = fxVol[i];
      const cx = fxCx[i];
      const av = textoAvaliacao(vol, cx, ehJunior(r.senioridade));
      return { ...r, faixaVolume: vol, faixaComplexidade: cx, avaliacao: av.txt, alerta: av.alerta };
    }).sort((a, b) => {
      if (a.alerta !== b.alerta) return a.alerta ? 1 : -1;
      return (ORD[b.faixaVolume] - ORD[a.faixaVolume]) || (ORD[b.faixaComplexidade] - ORD[a.faixaComplexidade]);
    });
  }

  function render(analistas) {
    const rows = calcular(analistas);
    if (!rows.length) {
      return '<div class="eq-matriz" style="margin:1.5rem 0">' +
        '<h4 style="color:var(--accent);margin:0 0 0.5rem;font-size:0.85rem;text-transform:uppercase">' +
        'Volume x Complexidade</h4>' +
        '<p class="eq-sem-dados">Sem entregas nos meses fechados para montar a matriz.</p></div>';
    }
    const tr = rows.map(r => {
      const bg = r.alerta ? 'background:#fff7ed' : '';
      return '<tr style="' + bg + '">' +
        '<td style="padding:6px 8px;font-weight:600">' +
          '<a href="/equipes.html?colaborador=' + r.slug + '" style="color:inherit;text-decoration:none">' +
          r.apelido + '</a></td>' +
        '<td style="text-align:center;padding:6px">' + r.faixaVolume +
          '<br><span style="font-size:0.65rem;opacity:0.6">' + r.volume + ' entregas</span></td>' +
        '<td style="text-align:center;padding:6px">' + r.faixaComplexidade +
          '<br><span style="font-size:0.65rem;opacity:0.6">' + r.complexidade + ' pts/entrega</span></td>' +
        '<td style="padding:6px 8px;font-size:0.82rem' + (r.alerta ? ';font-weight:600;color:#c2410c' : '') + '">' +
          r.avaliacao + '</td></tr>';
    }).join('');
    return '<div class="eq-matriz" style="margin:1.5rem 0 2rem">' +
      '<h4 style="color:var(--accent);margin:0 0 0.35rem;font-size:0.85rem;text-transform:uppercase">' +
      'Volume x Complexidade</h4>' +
      '<p style="font-size:0.75rem;opacity:0.65;margin:0 0 0.75rem">' +
      'Faixas relativas ao time (quartis) · meses fechados · Definição + Atividade + PSAIs Definidas</p>' +
      '<table class="eq-tabela" style="width:100%;font-size:0.8rem;border-collapse:collapse">' +
      '<thead><tr style="background:var(--card)">' +
        '<th style="text-align:left;padding:6px 8px">Analista</th>' +
        '<th style="padding:6px">Volume</th>' +
        '<th style="padding:6px">Complexidade (Pontos)</th>' +
        '<th style="text-align:left;padding:6px 8px">Avaliação</th>' +
      '</tr></thead><tbody>' + tr + '</tbody></table></div>';
  }

  return { calcular, render };
})();
