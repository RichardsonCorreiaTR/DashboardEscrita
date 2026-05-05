/**
 * aba-metodologia.js - Cria aba "Como se Calcula" do Excel de descartes
 */

const { COR, round2, estiloTitulo } = require('./utils');

function criarAbaMetodologia(wb, stats) {
  const ws = wb.addWorksheet('Como se Calcula', { properties: { tabColor: { argb: COR.amarelo } } });
  ws.columns = [{ width: 4 }, { width: 90 }, { width: 4 }];

  let row = 2;
  const addTitulo = (texto, size = 14) => {
    ws.getCell(`B${row}`).value = texto;
    ws.getCell(`B${row}`).style = estiloTitulo(size);
    ws.getRow(row).height = size * 2;
    row++;
  };
  const addTexto = (texto, opts = {}) => {
    ws.getCell(`B${row}`).value = texto;
    ws.getCell(`B${row}`).style = {
      font: { size: opts.size || 10, name: 'Segoe UI', bold: opts.bold || false, italic: opts.italic || false, color: { argb: opts.color || COR.preto } },
      alignment: { wrapText: true, vertical: 'top' }
    };
    ws.getRow(row).height = opts.height || 20;
    row++;
  };
  const addEspaco = () => { row++; };

  addTitulo('Como se Calcula? - Metodologia da Analise de Descartes', 16);
  addTexto('Analise de Descartes - Concl.s/Dev / Reprovada / Prescrita | Escrita Fiscal - Thomson Reuters/Betha', { italic: true, color: COR.cinzaTexto });
  addEspaco();

  addTitulo('1. Percentual de Descarte por Versao', 13);
  addTexto('Formula:', { bold: true });
  addTexto('% descarte = (CsD + reprovada + prescrita) / entradas_versao x 100');
  addEspaco();
  addTexto('Definicoes:', { bold: true });
  addTexto('- Entradas: NEs com CadastroPSAI dentro do periodo da versao (campo CadastroPSAI > inicio AND <= fim)');
  addTexto('- Descartes: NEs com campo Descarte dentro do periodo da versao E situacao IN (5=CsD, 6=Reprovada, 23=Prescrita)');
  addTexto('- Motivo 5 (Concl. sem Dev): NE resolvida/fechada sem necessidade de gerar SAI para desenvolvimento');
  addTexto('- Motivo 6 (Reprovada): NE analisada e reprovada pelo time tecnico');
  addTexto('- Motivo 23 (Prescrita): NE que aguardou retorno do suporte e nao recebeu em tempo habil (automatico)');
  addTexto('- Filtro obrigatorio: COALESCE(psai.i_produto_grupo, 1) = 1 (produto principal)');
  addEspaco();

  addTitulo('2. EWMA (Exponential Weighted Moving Average)', 13);
  addTexto('Formula:', { bold: true });
  addTexto('EWMA_t = alpha x Pct_t + (1 - alpha) x EWMA_{t-1}');
  addTexto(`onde alpha = 2 / (span + 1) = 2 / 7 = ${round2(2 / 7)}`);
  addEspaco();
  addTexto('O que faz:', { bold: true });
  addTexto('- Span = 6 versoes: as ultimas 6 versoes tem peso exponencialmente maior');
  addTexto('- Captura tendencias: se o percentual vem subindo, o EWMA acompanha');
  addTexto('- Suaviza oscilacoes pontuais sem ignorar mudancas reais');
  addTexto(`- EWMA atual: ${round2(stats.ewmaAtual)}%`);
  addEspaco();

  addTitulo('3. Faixas de Controle (Banda Estatistica)', 13);
  addTexto('Baseadas no EWMA + Desvio Padrao historico (carta de Shewhart):', { bold: true });
  addEspaco();
  addTexto(`Desvio Padrao (DP) historico: ${stats.dp}%`);
  addTexto(`NORMAL (verde): percentual <= EWMA + 1 x DP = ${stats.faixaNormal}%`);
  addTexto(`ATENCAO (amarelo): entre ${stats.faixaNormal}% e ${stats.faixaAtencao}%`);
  addTexto(`CRITICO (vermelho): percentual > ${stats.faixaAtencao}%`);
  addEspaco();

  addTitulo('4. Por que EWMA + Desvio Padrao?', 13);
  addTexto('- EWMA captura tendencia recente; DP mede variabilidade natural');
  addTexto('- Juntos formam banda de controle estatistica (similar a carta Shewhart/CEP)');
  addTexto('- Se o percentual sai da banda, ha evidencia de mudanca no processo');
  addEspaco();

  addTitulo('5. Fonte dos Dados', 13);
  addTexto('- Banco: Sybase SQL Anywhere 9.0 via ODBC (DSN: pbcvs9)');
  addTexto('- Tabelas: UP.SAI_PSAI + bethadba.psai | Periodos: funcoes PIAZZA');
  addTexto('- Area: Escrita | Tipo: NE | Produto grupo: 1 | Historico desde 10.2A-02 (fev 2022)');

  ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1 };
  return ws;
}

module.exports = { criarAbaMetodologia };
