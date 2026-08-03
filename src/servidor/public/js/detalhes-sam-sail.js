/**
 * detalhes-sam-sail.js - Detalhes dos indicadores SAM/SAIL
 */
/* eslint-disable no-unused-vars */
const DetalhesSamSail = (() => {
  function renderLiberadas(r, body, h) {
    const d = r.detalhes;
    const lista = d.lista || [];
    const sam = lista.filter(x => x.tipoSAI === 'SAM');
    const sail = lista.filter(x => x.tipoSAI === 'SAIL');
    const cols = [...h.colsSaiPsai,
      { label: 'Tipo', render: row => row.tipoSAI || '--' },
      { label: 'Liberacao', render: row => h.fmtData(row.Liberacao) },
      { label: 'Gravidade', render: row => row.gravidade_ne || '--' },
      { label: 'Via', render: row => row._via || '--' }
    ];
    body.innerHTML = `
      <div class="info-grid">
        ${h.infoBox('Total SAM + SAIL', r.valor)}
        ${h.infoBox('SAM', d.qtd_sam ?? d.por_tipo?.SAM ?? 0)}
        ${h.infoBox('SAIL', d.qtd_sail ?? d.por_tipo?.SAIL ?? 0)}
        ${h.infoBox('Na Versao', d.qtd_versao ?? '--')}
        ${h.infoBox('Em Arquivo', d.qtd_arquivo ?? '--')}
        ${h.infoBox('Meta', r.meta != null ? r.meta : '--')}
      </div>
      <h3 style="margin:1.2rem 0 0.5rem;font-size:0.95rem;">Liberadas na Versao ${d.versao}</h3>
      ${h.abasHTML([
        { id: 'todas', titulo: 'Todas', qtd: lista.length, html: h.tbl(cols, lista) },
        { id: 'sam', titulo: 'SAM', qtd: sam.length, html: h.tbl(cols, sam) },
        { id: 'sail', titulo: 'SAIL', qtd: sail.length, html: h.tbl(cols, sail) }
      ])}
    `;
    h.inicializarAbas(body);
  }

  return { renderLiberadas };
})();
