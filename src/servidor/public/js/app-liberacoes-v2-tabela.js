/**
 * app-liberacoes-v2-tabela.js - Tabela de SAs por versao com drill-down
 *
 * Renderiza tabela com todas as versoes, expandivel por SA individual.
 */
/* eslint-disable no-unused-vars */
const AppLiberacoesV2Tabela = (() => {

  function r1(v) { return Math.round(v * 10) / 10; }
  function r0(v) { return Math.round(v); }

  function renderizar(dados) {
    const thead = document.querySelector('#tabela-v2 thead');
    const tbody = document.querySelector('#tabela-v2 tbody');
    if (!thead || !tbody || !dados.versoes) return;

    thead.innerHTML = `<tr>
      <th style="width:1.5rem"></th><th>Versao</th><th>Total SAs</th>
      <th>SAM</th><th>SAL</th><th>SAIL</th>
      <th>Carga</th><th>Desvio Est.</th><th>Qualid.</th></tr>`;

    const outliers = new Set(dados.estatisticas ? dados.estatisticas.outliers : []);

    tbody.innerHTML = dados.versoes.map((v, idx) => {
      const bg = v.versao === dados.versaoAtual ? ' style="background:var(--info-bg)"'
        : outliers.has(v.versao) ? ' style="background:var(--amarelo-bg)"' : '';
      const qPct = r0(v.qualidade.completudeGeral * 100);
      const qCor = qPct >= 70 ? 'var(--verde)' : qPct >= 50 ? 'var(--amarelo)' : 'var(--vermelho)';
      const detId = `v2d-${idx}`;

      const detHtml = (v.itens || []).map(item => `
        <tr class="hist-detalhe hist-detalhe--${detId}" style="display:none">
          <td></td>
          <td style="padding-left:1rem;font-size:0.72rem">
            <strong>${item.tipo}</strong> ${item.psai}</td>
          <td colspan="2" style="font-size:0.72rem;max-width:280px;word-break:break-word">
            ${item.descricao || '-'}</td>
          <td style="font-size:0.72rem">${item.nivel}</td>
          <td style="font-size:0.72rem">${item.faixa || '-'}</td>
          <td style="font-size:0.72rem">${r1(item.carga || 0)}</td>
          <td style="font-size:0.72rem">${item.ssc > 0 ? item.ssc + ' SSC' : '-'}</td>
          <td style="font-size:0.72rem">${formatHoras(item.tempoReal)} h</td>
        </tr>`).join('');

      return `
        <tr${bg} class="hist-row">
          <td style="cursor:pointer;text-align:center" class="hist-toggle" data-target="${detId}">
            <span class="hist-toggle__seta">&#9654;</span>
          </td>
          <td><strong>${v.versao}</strong>${outliers.has(v.versao) ? ' *' : ''}${v.versao === dados.versaoAtual ? ' (atual)' : ''}</td>
          <td><strong>${v.totalLiberacoes}</strong></td>
          <td>${v.porTipo.SAM}</td><td>${v.porTipo.SAL}</td><td>${v.porTipo.SAIL}</td>
          <td>${r1(v.carga.total)}</td>
          <td>${v.tempos.desvioEstimativa > 0 ? '+' : ''}${v.tempos.desvioEstimativa}%</td>
          <td><span style="color:${qCor}">${qPct}%</span></td>
        </tr>${detHtml}`;
    }).join('');

    tbody.querySelectorAll('.hist-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.target;
        const seta = btn.querySelector('.hist-toggle__seta');
        const linhas = tbody.querySelectorAll(`.hist-detalhe--${t}`);
        const aberto = linhas[0] && linhas[0].style.display !== 'none';
        linhas.forEach(l => { l.style.display = aberto ? 'none' : 'table-row'; });
        seta.style.transform = aberto ? '' : 'rotate(90deg)';
      });
    });
  }

  function formatHoras(min) {
    if (!min || min === 0) return '0';
    return r1(min / 60);
  }

  return { renderizar };
})();
