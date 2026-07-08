/**
 * equipes-ne-definicao.js - Tab "NE Definição" na pagina de equipes
 * Exibe contagem mensal de NEs com Definicao por analista/especialista.
 * Dados vindos do Excel parseado (nao ODBC).
 */
/* eslint-disable no-unused-vars */
const EquipesNeDefinicao = (() => {
  const ABREV_MES = { jan:1, fev:2, mar:3, abr:4, mai:5, jun:6,
    jul:7, ago:8, set:9, out:10, nov:11, dez:12 };
  const NOMES_MES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  let _dadosNe = null; // cache global da sessao

  async function obterDados() {
    if (_dadosNe) return _dadosNe;
    try {
      const r = await fetch('/api/nes-definicao/dados');
      if (!r.ok) return null;
      _dadosNe = await r.json();
      return _dadosNe;
    } catch { return null; }
  }

  function parsearLabel(label) {
    // "Jan/24 (10.4A-01)" ou "Jan/2024 (...)"
    if (!label) return null;
    const m = label.match(/^([A-Za-z]+)\/(\d{2,4})/);
    if (!m) return null;
    const mesAbrev = m[1].toLowerCase().slice(0, 3);
    const anoRaw = m[2].length === 2 ? 2000 + parseInt(m[2]) : parseInt(m[2]);
    const mes = ABREV_MES[mesAbrev];
    return mes ? { mes, ano: anoRaw } : null;
  }

  function contarPorMes(slug, dados, ano) {
    const contagem = {};
    NOMES_MES.forEach((_, i) => { contagem[i + 1] = { qtd: 0, nes: [] }; });
    if (!dados || !dados.por_analista || !dados.por_analista[slug]) return contagem;
    Object.entries(dados.por_analista[slug]).forEach(([label, nes]) => {
      const info = parsearLabel(label);
      if (!info || info.ano !== parseInt(ano)) return;
      contagem[info.mes].qtd += nes.length;
      nes.forEach(ne => contagem[info.mes].nes.push({ ...ne, label }));
    });
    return contagem;
  }

  function corQtd(qtd) {
    if (qtd === 0) return 'var(--verde)';
    if (qtd >= 3) return 'var(--vermelho)';
    return 'var(--amarelo)';
  }

  function renderTabela(slug, dados, ano) {
    const contagem = contarPorMes(slug, dados, ano);
    const mesAtual = new Date().getMonth() + 1;
    const anoAtual = new Date().getFullYear();
    let html = '<table class="eq-tabela"><thead><tr>' +
      '<th>Mês</th><th>Qtd</th><th>NE</th><th>SAI Origem</th><th>Ano</th><th>Tipo</th><th>Status</th></tr></thead><tbody>';
    for (let m = 1; m <= 12; m++) {
      const { qtd, nes } = contagem[m];
      const isFuturo = (parseInt(ano) === anoAtual && m > mesAtual) || parseInt(ano) > anoAtual;
      const cor = isFuturo ? 'var(--cor-texto-sec)' : corQtd(qtd);
      const statusTxt = isFuturo ? '—' : qtd === 0 ? '✓ OK' : qtd >= 3 ? '⚠ Elevado' : '⚡ Atenção';
      if (!nes.length) {
        html += '<tr' + (isFuturo ? ' style="opacity:.45"' : '') + '>' +
          '<td><strong>' + NOMES_MES[m - 1] + '</strong></td>' +
          '<td style="text-align:center;font-weight:700;color:' + cor + '">' + (isFuturo ? '—' : 0) + '</td>' +
          '<td colspan="4" style="font-size:0.75rem;color:var(--cor-texto-sec)">' + (isFuturo ? '—' : 'Nenhuma') + '</td>' +
          '<td style="color:' + cor + ';font-size:0.78rem">' + statusTxt + '</td></tr>';
      } else {
        nes.forEach((n, i) => {
          html += '<tr>' +
            (i === 0 ? '<td rowspan="' + nes.length + '"><strong>' + NOMES_MES[m - 1] + '</strong></td>' +
              '<td rowspan="' + nes.length + '" style="text-align:center;font-weight:700;color:' + cor + '">' + qtd + '</td>' : '') +
            '<td style="font-size:0.78rem">NE ' + n.ne + '</td>' +
            '<td style="font-size:0.75rem;color:var(--cor-texto-sec)">' + (n.sai_origem || '—') + '</td>' +
            '<td style="font-size:0.75rem;color:var(--cor-texto-sec)">' + (n.ano_sai || '—') + '</td>' +
            '<td style="font-size:0.75rem">' + (n.tipo_sai || '—') + '</td>' +
            (i === 0 ? '<td rowspan="' + nes.length + '" style="color:' + cor + ';font-size:0.78rem">' + statusTxt + '</td>' : '') +
            '</tr>';
        });
      }
    }
    const totalAno = Object.values(contagem).reduce((s, c) => s + c.qtd, 0);
    html += '<tfoot><tr><td><strong>Total</strong></td>' +
      '<td style="text-align:center;font-weight:800;color:' + corQtd(Math.round(totalAno / 12)) + '">' + totalAno + '</td>' +
      '<td colspan="5" style="font-size:0.75rem;color:var(--cor-texto-sec)">Meta: a definir</td></tr></tfoot>';
    return html + '</table>';
  }

  function renderInfo() {
    return '<div class="eq-meta"><h3 class="eq-meta__titulo">NEs com Definição</h3>' +
      '<p class="eq-meta__detalhe">Quantidade de NEs com falha de definição atribuídas ao analista/especialista como Responsável PSAI, por mês. Quanto menos, melhor.</p>' +
      '<div class="eq-meta__info">' +
      '<div class="eq-meta__bloco"><span class="eq-meta__bloco-label">Valor esperado</span><span class="eq-meta__bloco-valor">Meta a definir</span></div>' +
      '<div class="eq-meta__bloco"><span class="eq-meta__bloco-label">Fonte</span><span class="eq-meta__bloco-valor">Planilha Análise de NEs</span></div>' +
      '</div></div>';
  }

  async function injetarTotalizador(slug, ano) {
    const el = document.getElementById('ne-def-tot-placeholder');
    if (!el) return;
    const dados = await obterDados();
    const valEl = el.querySelector('.eq-tot-meta__valor');
    if (!dados) { if (valEl) valEl.textContent = '—'; return; }
    const contagem = contarPorMes(slug, dados, ano);
    const total = Object.values(contagem).reduce((s, c) => s + c.qtd, 0);
    const cor = corQtd(Math.round(total / 12));
    if (valEl) { valEl.textContent = total; valEl.style.color = cor; }
  }

  async function carregar(slug, ano, container) {
    const el = container.querySelector('[data-meta-id="ne-definicao"]');
    if (!el) return;
    el.innerHTML = '<div class="eq-sem-dados">Carregando NEs...</div>';
    const dados = await obterDados();
    if (!dados) {
      el.innerHTML = '<div class="eq-sem-dados">Planilha não carregada. Acesse "NEs com Definição" no menu para importar.</div>';
      return;
    }
    el.innerHTML = renderTabela(slug, dados, ano);
  }

  return { renderInfo, carregar, injetarTotalizador };
})();
