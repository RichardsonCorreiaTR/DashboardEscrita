/**
 * equipes-conclusao-pontos.js - Tab "Conclusao dos Pontos" para especialistas
 *
 * Grupo 1: Definicao + PSAIs Definidas vs meta 80 pts
 * Grupo 2: Atividade Principal + PSAIs Definidas vs meta_ajustada mensal
 */
/* eslint-disable no-unused-vars */
const EquipesConclusaoPontos = (() => {
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const MES_ATUAL = new Date().getMonth() + 1;
  const ANO_ATUAL = new Date().getFullYear();

  function renderInfo() {
    return '<div class="eq-meta">' +
      '<h3 class="eq-meta__titulo">Conclusão dos Pontos</h3>' +
      '<p class="eq-meta__detalhe">Consolidação dos pontos combinados: Definição + PSAIs Definidas (meta ≥ 80 pts) e Atividade Principal + PSAIs Definidas (meta ajustada mensal).</p>' +
      '</div>';
  }

  function pts(mensal, mes) {
    const d = mensal && mensal[mes];
    return d ? (Number(d.pontos) || 0) : null;
  }

  function corStatus(atingida) {
    return atingida ? 'var(--verde)' : 'var(--vermelho)';
  }

  function renderLinhas(grupo) {
    return MESES.map((label, i) => {
      const mes = i + 1;
      const d = grupo[mes];
      const futuro = mes > MES_ATUAL;
      if (futuro || !d || d.semDados) {
        return `<tr style="opacity:.35"><td>${label}</td><td>—</td><td>—</td><td>—</td></tr>`;
      }
      const { total, meta, atingida } = d;
      const cor = corStatus(atingida);
      return `<tr>
        <td><strong>${label}</strong></td>
        <td style="text-align:center;font-weight:700;color:${cor}">${total % 1 === 0 ? total : total.toFixed(1)} pts</td>
        <td style="text-align:center;color:var(--cor-texto-sec)">≥ ${meta % 1 === 0 ? meta : meta.toFixed(1)}</td>
        <td style="text-align:center;font-size:1rem;color:${cor}">${atingida ? '✓' : '✗'}</td>
      </tr>`;
    }).join('');
  }

  function renderTotalizador(grupo, label) {
    let somaTotal = 0, somaMeta = 0, atingidos = 0, mesesComDados = 0;
    for (let m = 1; m <= MES_ATUAL; m++) {
      const d = grupo[m];
      if (!d || d.semDados) continue;
      mesesComDados++;
      somaTotal += d.total;
      somaMeta  += d.meta;
      if (d.atingida) atingidos++;
    }
    if (!mesesComDados) return '';
    const mediaTotal = (somaTotal / mesesComDados).toFixed(1);
    const mediaMeta  = (somaMeta  / mesesComDados).toFixed(1);
    const cor = atingidos === mesesComDados ? 'var(--verde)' : atingidos === 0 ? 'var(--vermelho)' : 'var(--amarelo)';
    return `<div class="eq-det__formula" style="margin-top:0.5rem">
      <strong>${label}</strong> — Média: <span style="color:${cor};font-weight:700">${mediaTotal} pts</span>
      / meta: ${mediaMeta} pts &nbsp;|&nbsp;
      <span style="color:${cor}">✓ ${atingidos}/${mesesComDados} meses atingidos</span>
    </div>`;
  }

  function renderGrupo(titulo, grupo, labelTot) {
    return `<div class="eq-det__grupo" style="margin-bottom:1.5rem">
      <h5 style="color:var(--cor-primaria);margin-bottom:0.5rem">${titulo}</h5>
      <table class="eq-tabela eq-tabela--det" style="width:100%">
        <thead><tr><th>Mês</th><th>Pontos Combinados</th><th>Meta</th><th>Status</th></tr></thead>
        <tbody>${renderLinhas(grupo)}</tbody>
      </table>
      ${renderTotalizador(grupo, labelTot)}
    </div>`;
  }

  function renderizar(container, metas) {
    const el = container.querySelector('[data-meta-id="conclusao-pontos"]');
    if (!el || !metas) return;

    const def    = (metas['pontos-definicao']          && metas['pontos-definicao'].mensal)      || {};
    const saisDef = (metas['sais-definidas-esp']        && metas['sais-definidas-esp'].mensal)    || {};
    const atv    = (metas['pontos-atividade-principal'] && metas['pontos-atividade-principal'].mensal) || {};

    // Grupo 1: Definicao + PSAIs Definidas vs 80 pts
    const grupo1 = {};
    for (let m = 1; m <= 12; m++) {
      const pDef  = pts(def, m);
      const pSais = pts(saisDef, m);
      const semDados = pDef === null && pSais === null;
      const total = (pDef || 0) + (pSais || 0);
      grupo1[m] = { total, meta: 80, atingida: total >= 80, semDados };
    }

    // Grupo 2: Atividade Principal + PSAIs Definidas vs meta_ajustada
    const grupo2 = {};
    for (let m = 1; m <= 12; m++) {
      const pAtv  = pts(atv, m);
      const pSais = pts(saisDef, m);
      const dAtv  = atv[m];
      const meta  = (dAtv && Number(dAtv.meta_ajustada)) || 0;
      const semDados = pAtv === null && pSais === null;
      const total = (pAtv || 0) + (pSais || 0);
      grupo2[m] = { total, meta, atingida: meta > 0 ? total >= meta : false, semDados };
    }

    el.innerHTML =
      renderGrupo('Definição + PSAIs Definidas', grupo1, 'Grupo 1') +
      renderGrupo('Atividade Principal + PSAIs Definidas', grupo2, 'Grupo 2');
  }

  return { renderInfo, renderizar };
})();
