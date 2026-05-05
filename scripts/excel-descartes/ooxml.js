/**
 * ooxml.js - Injecao de graficos nativos Excel via manipulacao OOXML/ZIP
 */

const JSZip = require('jszip');

const { gerarChartLineXML, gerarChartBarXML } = require('./ooxml-charts');

/** Gera o drawing XML que posiciona os 2 graficos na aba */
function gerarDrawingXML() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
          xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>7</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>2</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>17</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>22</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr>
        <xdr:cNvPr id="2" name="Grafico1"/>
        <xdr:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></xdr:cNvGraphicFramePr>
      </xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId1"/>
        </a:graphicData>
      </a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>7</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>24</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>17</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>44</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr>
        <xdr:cNvPr id="3" name="Grafico2"/>
        <xdr:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></xdr:cNvGraphicFramePr>
      </xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId2"/>
        </a:graphicData>
      </a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`;
}

/** Injeta graficos nativos no buffer XLSX via manipulacao ZIP */
async function injetarGraficos(buffer, numVersoes, chart1Start, chart1End, chart2Start, chart2End) {
  const zip = await JSZip.loadAsync(buffer);
  const sheetName = 'Graficos';
  const sheetIdx = 2;

  zip.file('xl/charts/chart1.xml', gerarChartLineXML(sheetName, chart1Start, chart1End));
  zip.file('xl/charts/chart2.xml', gerarChartBarXML(sheetName, chart2Start, chart2End));

  const emptyRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  zip.file('xl/charts/_rels/chart1.xml.rels', emptyRels);
  zip.file('xl/charts/_rels/chart2.xml.rels', emptyRels);
  zip.file('xl/drawings/drawing1.xml', gerarDrawingXML());
  zip.file('xl/drawings/_rels/drawing1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart2.xml"/>
</Relationships>`);

  const sheetFile = `xl/worksheets/sheet${sheetIdx + 1}.xml`;
  let sheetXML = await zip.file(sheetFile).async('string');
  if (!sheetXML.includes('<drawing')) {
    sheetXML = sheetXML.replace('</worksheet>', '<drawing r:id="rId10"/></worksheet>');
  }
  zip.file(sheetFile, sheetXML);

  const sheetRelsFile = `xl/worksheets/_rels/sheet${sheetIdx + 1}.xml.rels`;
  const drawingRel = `<Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>`;
  if (zip.file(sheetRelsFile)) {
    let sr = await zip.file(sheetRelsFile).async('string');
    zip.file(sheetRelsFile, sr.replace('</Relationships>', `${drawingRel}</Relationships>`));
  } else {
    zip.file(sheetRelsFile, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${drawingRel}</Relationships>`);
  }

  let ct = await zip.file('[Content_Types].xml').async('string');
  if (!ct.includes('chart+xml')) {
    ct = ct.replace('</Types>',
      `<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
       <Override PartName="/xl/charts/chart2.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
       <Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
  }
  zip.file('[Content_Types].xml', ct);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = { injetarGraficos };
