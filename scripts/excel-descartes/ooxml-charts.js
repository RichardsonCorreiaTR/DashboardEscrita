/**
 * ooxml-charts.js - Templates XML dos graficos nativos Excel (OOXML)
 */

/** Grafico de linhas: % Descarte vs EWMA com faixas de controle */
function gerarChartLineXML(sheetName, startRow, endRow) {
  const sn = `'${sheetName}'`;
  const ns = 'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const cat = `<c:cat><c:strRef><c:f>${sn}!$B$${startRow}:$B$${endRow}</c:f></c:strRef></c:cat>`;

  function serie(idx, col, cor, width, dash) {
    const estilo = dash ? `<a:prstDash val="${dash}"/>` : '';
    const marker = idx === 0 ? '<c:marker><c:symbol val="circle"/><c:size val="5"/></c:marker>' : '<c:marker><c:symbol val="none"/></c:marker>';
    return `<c:ser><c:idx val="${idx}"/><c:order val="${idx}"/>
      <c:tx><c:strRef><c:f>${sn}!$${col}$${startRow - 1}</c:f></c:strRef></c:tx>
      <c:spPr><a:ln w="${width}"><a:solidFill><a:srgbClr val="${cor}"/></a:solidFill>${estilo}</a:ln></c:spPr>
      ${marker}${cat}
      <c:val><c:numRef><c:f>${sn}!$${col}$${startRow}:$${col}$${endRow}</c:f></c:numRef></c:val>
      <c:smooth val="0"/></c:ser>`;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace ${ns}>
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/>
      <a:p><a:r><a:rPr lang="pt-BR" sz="1200" b="1"/><a:t>% Descarte vs EWMA com Faixas de Controle</a:t></a:r></a:p>
    </c:rich></c:tx><c:overlay val="0"/></c:title>
    <c:autoTitleDeleted val="0"/>
    <c:plotArea><c:layout/>
      <c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>
        ${serie(0, 'C', '3B82F6', '25400', '')}
        ${serie(1, 'D', '22C55E', '19050', 'dash')}
        ${serie(2, 'E', 'EAB308', '9525', 'lgDash')}
        ${serie(3, 'F', 'EF4444', '9525', 'lgDash')}
        <c:marker val="1"/><c:axId val="1"/><c:axId val="2"/>
      </c:lineChart>
      <c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="b"/><c:crossAx val="2"/>
        <c:txPr><a:bodyPr rot="-5400000"/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="800"/></a:pPr><a:endParaRPr lang="pt-BR"/></a:p></c:txPr>
      </c:catAx>
      <c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="l"/><c:crossAx val="1"/>
        <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="pt-BR" sz="900"/><a:t>% Descarte</a:t></a:r></a:p></c:rich></c:tx></c:title>
        <c:numFmt formatCode="0.0&quot;%&quot;" sourceLinked="0"/>
      </c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="t"/><c:overlay val="0"/></c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`;
}

/** Grafico de barras empilhadas: Descartes por motivo */
function gerarChartBarXML(sheetName, startRow, endRow) {
  const sn = `'${sheetName}'`;
  const ns = 'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const cat = `<c:cat><c:strRef><c:f>${sn}!$B$${startRow}:$B$${endRow}</c:f></c:strRef></c:cat>`;

  function serie(idx, col, cor) {
    return `<c:ser><c:idx val="${idx}"/><c:order val="${idx}"/>
      <c:tx><c:strRef><c:f>${sn}!$${col}$${startRow - 1}</c:f></c:strRef></c:tx>
      <c:spPr><a:solidFill><a:srgbClr val="${cor}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>
      ${cat}<c:val><c:numRef><c:f>${sn}!$${col}$${startRow}:$${col}$${endRow}</c:f></c:numRef></c:val>
    </c:ser>`;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace ${ns}>
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/>
      <a:p><a:r><a:rPr lang="pt-BR" sz="1200" b="1"/><a:t>Descartes por Motivo (CsD / Repr / Presc)</a:t></a:r></a:p>
    </c:rich></c:tx><c:overlay val="0"/></c:title>
    <c:autoTitleDeleted val="0"/>
    <c:plotArea><c:layout/>
      <c:barChart><c:barDir val="col"/><c:grouping val="stacked"/><c:varyColors val="0"/>
        ${serie(0, 'C', '60A5FA')}
        ${serie(1, 'D', 'EF4444')}
        ${serie(2, 'E', 'EAB308')}
        <c:overlap val="100"/><c:axId val="3"/><c:axId val="4"/>
      </c:barChart>
      <c:catAx><c:axId val="3"/><c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="b"/><c:crossAx val="4"/>
        <c:txPr><a:bodyPr rot="-5400000"/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="800"/></a:pPr><a:endParaRPr lang="pt-BR"/></a:p></c:txPr>
      </c:catAx>
      <c:valAx><c:axId val="4"/><c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="l"/><c:crossAx val="3"/>
        <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="pt-BR" sz="900"/><a:t>Qtde Descartes</a:t></a:r></a:p></c:rich></c:tx></c:title>
      </c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="t"/><c:overlay val="0"/></c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`;
}

module.exports = { gerarChartLineXML, gerarChartBarXML };
