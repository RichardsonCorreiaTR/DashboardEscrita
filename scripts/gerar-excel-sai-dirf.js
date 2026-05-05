const ExcelJS = require('exceljs');
const path = require('path');

const dados = [
  { entrada: '22/10/2025', tipo: 'SAM', grav: '—', sai: 98201, psai: 123614, status: 'liberada', sscs: 320, clientes: 287, liberacao: '22/01/2026', ciclo: '92d · até liberação', versao: '10.6A-01', resumo: 'Criar novo relatório unificando os valores de IRRF folha e IRRF eSocial para conferência com o novo Extrator da DIRF' },
  { entrada: '12/11/2025', tipo: 'SAM', grav: '—', sai: 0, psai: 124243, status: 'pendente', sscs: 1, clientes: 1, liberacao: '—', ciclo: '146d · em aberto (até hoje)', versao: '—', resumo: 'Criar novo relatório unificando os valores de IRRF para conferência da DIRF DIGITAL Mensal para reclamatória trabalhista' },
  { entrada: '21/11/2025', tipo: 'SAM', grav: '—', sai: 98695, psai: 124575, status: 'pendente', sscs: 29, clientes: 27, liberacao: '—', ciclo: '137d · em aberto (até hoje)', versao: '—', resumo: 'Permitir a emissão do relatório extrator da DIRF de forma unificada por beneficiário(Colaborador)' },
  { entrada: '15/12/2025', tipo: 'SAM', grav: '—', sai: 0, psai: 125491, status: 'pendente', sscs: 13, clientes: 12, liberacao: '—', ciclo: '113d · em aberto (até hoje)', versao: '—', resumo: 'Incluir no relatório extrator da DIRF uma nova opção de emissão que permita gerar o relatório somente para colaboradores que possuam IRRF retido' },
  { entrada: '19/01/2026', tipo: 'SAM', grav: '—', sai: 99447, psai: 126702, status: 'pendente', sscs: 52, clientes: 49, liberacao: '—', ciclo: '78d · em aberto (até hoje)', versao: '—', resumo: "Incluir opção para permitir a emissão multi-empresas no relatório 'Extrator da DIRF'" },
  { entrada: '23/01/2026', tipo: 'NE', grav: 'Normal', sai: 99460, psai: 126989, status: 'liberada', sscs: 1, clientes: 1, liberacao: '29/01/2026', ciclo: '6d · até liberação', versao: '10.6A-02', resumo: 'Está demonstrando a base zerada na coluna eSocial no relatório Extrator da DIRF para empregado com transferência entre matriz e filial' },
  { entrada: '27/01/2026', tipo: 'SAM', grav: '—', sai: 0, psai: 127083, status: 'pendente', sscs: 1, clientes: 1, liberacao: '—', ciclo: '70d · em aberto (até hoje)', versao: '—', resumo: 'Avaliar os pontos de impacto no relatório do extrator da DIRF devido as alterações da tela feitas pelo módulo Escrita' },
  { entrada: '28/01/2026', tipo: 'NE', grav: 'Grave', sai: 99642, psai: 127150, status: 'liberada', sscs: 59, clientes: 51, liberacao: '10/02/2026', ciclo: '13d · até liberação', versao: '10.6A-02', resumo: 'Em algumas situações está demonstrando incorretamente o campo de Indenização e Resc. de Contrato, Inclusive a Título de PDV e Acidente de Trabalho' },
  { entrada: '28/01/2026', tipo: 'SAM', grav: '—', sai: 99532, psai: 127183, status: 'liberada', sscs: 2, clientes: 2, liberacao: '06/02/2026', ciclo: '9d · até liberação', versao: '10.6A-02', resumo: 'Avaliar a emissão do relatório "Extrator da DIRF" quando a geração incluir, simultaneamente, os dados dos módulos Folha e Escrita Fiscal.' },
  { entrada: '28/01/2026', tipo: 'NE', grav: 'Normal', sai: 99641, psai: 127186, status: 'liberada', sscs: 36, clientes: 36, liberacao: '16/02/2026', ciclo: '19d · até liberação', versao: '10.6A-02', resumo: 'Está duplicando o valor de plano de saúde no relatório Extrator da DIRF quando o empregado possui férias/13°salário integral.' },
  { entrada: '28/01/2026', tipo: 'NE', grav: 'Normal', sai: 99672, psai: 127187, status: 'liberada', sscs: 48, clientes: 44, liberacao: '16/02/2026', ciclo: '19d · até liberação', versao: '10.6A-02', resumo: 'Está demonstrando incorretamente a Previdência oficial no relatório Extrator da DIRF quando há cálculo de diferença de INSS descontado à maior' },
  { entrada: '28/01/2026', tipo: 'NE', grav: 'Normal', sai: 99670, psai: 127189, status: 'liberada', sscs: 56, clientes: 55, liberacao: '10/02/2026', ciclo: '13d · até liberação', versao: '10.6A-02', resumo: 'Não está gerando o valor do abono pecuniário de férias na coluna "Valor Sistema" do relatório Extrator da DIRF, quando a rubrica está configurada' },
  { entrada: '29/01/2026', tipo: 'NE', grav: 'Normal', sai: 99681, psai: 127258, status: 'liberada', sscs: 70, clientes: 63, liberacao: '16/02/2026', ciclo: '18d · até liberação', versao: '10.6A-02', resumo: 'Está duplicando o valor do INSS na coluna "Valor Sistema" do relatório Extrator da DIRF, quando há mais de um cálculo com a mesma data de pagamento' },
  { entrada: '02/02/2026', tipo: 'SAM', grav: '—', sai: 99973, psai: 127369, status: 'liberada', sscs: 1079, clientes: 856, liberacao: '24/03/2026', ciclo: '50d · até liberação', versao: '10.6A-03', resumo: "Ajustar a consideração de algumas rubricas padrão com incidência de IRRF igual a '9' e '79' na emissão do relatório 'Extrator DIRF', e adequar" },
  { entrada: '04/02/2026', tipo: 'NE', grav: 'Normal', sai: 99778, psai: 127591, status: 'liberada', sscs: 22, clientes: 21, liberacao: '16/02/2026', ciclo: '12d · até liberação', versao: '10.6A-02', resumo: 'Não está criando o XML do evento S-1210 - Pagamentos em 01/2026, quando não há empregados ativos na empresa e foi cadastrado um dependente para RPA' },
  { entrada: '05/02/2026', tipo: 'NE', grav: 'Normal', sai: 99805, psai: 127617, status: 'liberada', sscs: 206, clientes: 191, liberacao: '19/02/2026', ciclo: '14d · até liberação', versao: '10.6A-02', resumo: 'Não está demonstrando o desconto do Dependente na coluna do Sistema do Extrator da DIRF quando utilizada a Dedução Simplificada e há imposto retido' },
  { entrada: '12/02/2026', tipo: 'SAL', grav: '—', sai: 0, psai: 127954, status: 'pendente', sscs: 22, clientes: 21, liberacao: '—', ciclo: '54d · em aberto (até hoje)', versao: '—', resumo: 'Alterar no cadastro de algumas rubricas padrões no sistema as configurações da DIRF, natureza eSocial e incidências.' },
  { entrada: '19/02/2026', tipo: 'NE', grav: 'Normal', sai: 100206, psai: 128226, status: 'liberada', sscs: 75, clientes: 69, liberacao: '30/03/2026', ciclo: '39d · até liberação', versao: '10.6A-04', resumo: 'Não está demonstrando os valores de alguns campos como plano de saúde, pensão alimentícia e verbas indenizadas no Extrator da DIRF' },
  { entrada: '23/02/2026', tipo: 'NE', grav: 'Normal', sai: 100140, psai: 128316, status: 'pendente', sscs: 59, clientes: 55, liberacao: '—', ciclo: '43d · em aberto (até hoje)', versao: '10.6A-04', resumo: 'Está duplicando o valor da Indenização e Resc. de Contrato, Inclusive a Título de PDV e Acidente de Trabalho na coluna "Valor Sistema" do relatório Extrator da DIRF' },
  { entrada: '23/02/2026', tipo: 'NE', grav: 'Normal', sai: 100126, psai: 128325, status: 'liberada', sscs: 37, clientes: 33, liberacao: '24/03/2026', ciclo: '29d · até liberação', versao: '10.6A-03', resumo: 'Está somando indevidamente as rubricas de desconto por antecipação salarial referentes ao abono pecuniário de férias na coluna Valor Sistema do Extrator da DIRF' },
  { entrada: '23/02/2026', tipo: 'NE', grav: 'Normal', sai: 100192, psai: 128368, status: 'pendente', sscs: 23, clientes: 21, liberacao: '—', ciclo: '43d · em aberto (até hoje)', versao: '10.6A-04', resumo: 'Não está demonstrando no Valor Sistema em Rendimento Não tributável ou Isento do IRRF, no campo Outros do relatório Extrator da DIRF' },
  { entrada: '24/02/2026', tipo: 'NE', grav: 'Normal', sai: 100268, psai: 128402, status: 'liberada', sscs: 55, clientes: 52, liberacao: '16/03/2026', ciclo: '20d · até liberação', versao: '10.6A-03', resumo: 'Está duplicando incorretamente o valor do desconto do Dependente na coluna eSocial do Extrator da DIRF quando há Férias em mais de uma competência' },
  { entrada: '25/02/2026', tipo: 'NE', grav: 'Grave', sai: 100165, psai: 128445, status: 'liberada', sscs: 127, clientes: 125, liberacao: '26/02/2026', ciclo: '1d · até liberação', versao: '10.6A-03', resumo: "Em algumas situações está ocorrendo Erro de banco de dados 'Primary key for table FOESOCIAL_ARQUIVO_RETORNO_S_5002 is not unique'" },
  { entrada: '25/02/2026', tipo: 'NE', grav: 'Normal', sai: 100158, psai: 128529, status: 'liberada', sscs: 2, clientes: 2, liberacao: '02/03/2026', ciclo: '5d · até liberação', versao: '10.6A-03', resumo: "Realizar testes no Módulo Folha pois em alguns casos está sendo gerado incorretamente o valor na linha 'Rendimento Não Tributável ou Isento do IRRF'" },
  { entrada: '26/02/2026', tipo: 'NE', grav: 'Normal', sai: 100324, psai: 128572, status: 'pendente', sscs: 32, clientes: 30, liberacao: '—', ciclo: '40d · em aberto (até hoje)', versao: '10.6A-04', resumo: 'Em algumas situações está demonstrando indevidamente valores repetidos em mais de um campo na coluna Valor Sistema do tópico Rendimentos Não Tributáveis do Extrator da DIRF' },
  { entrada: '27/02/2026', tipo: 'NE', grav: 'Normal', sai: 100322, psai: 128625, status: 'pendente', sscs: 59, clientes: 53, liberacao: '—', ciclo: '39d · em aberto (até hoje)', versao: '10.6A-04', resumo: 'Está demonstrando incorretamente os campos Previdência Oficial, Plano Privado Coletivo de Assistência à Saúde e Pensão alimentícia da coluna Valor Sistema do Extrator da DIRF' },
  { entrada: '02/03/2026', tipo: 'NE', grav: 'Normal', sai: 100384, psai: 128698, status: 'pendente', sscs: 29, clientes: 28, liberacao: '—', ciclo: '36d · em aberto (até hoje)', versao: '—', resumo: 'Não está demonstrando a dedução do Dependente do 13º integral no Extrator da DIRF quando há cálculo de diferença de IRRF 13º na folha mensal' },
  { entrada: '03/03/2026', tipo: 'SAM', grav: '—', sai: 100547, psai: 105827, status: 'liberada', sscs: 177, clientes: 162, liberacao: '30/03/2026', ciclo: '27d · até liberação', versao: '10.6A-04', resumo: "Alterar o comportamento do sistema nos relatórios 'Demonstrativo de IRRF...' e 'Extrator da DIRF' para que seja considerado o mesmo valor de IRRF" },
  { entrada: '04/03/2026', tipo: 'NE', grav: 'Normal', sai: 100512, psai: 128770, status: 'pendente', sscs: 5, clientes: 5, liberacao: '—', ciclo: '34d · em aberto (até hoje)', versao: '10.6A-04', resumo: 'Não está gerando o Comprovante de Rendimentos, está demonstrando base negativa na coluna Valor Sistema do Extrator da DIRF e base zerada na coluna eSocial' },
  { entrada: '05/03/2026', tipo: 'NE', grav: 'Normal', sai: 100358, psai: 128834, status: 'liberada', sscs: 78, clientes: 70, liberacao: '10/03/2026', ciclo: '5d · até liberação', versao: '10.6A-03', resumo: "Está demonstrando na tela de RPA o valor incorreto no campo 'Base IRRF', quando configurado 'Dedução Favorável ao Colaborador' e se trata de RPA" },
  { entrada: '09/03/2026', tipo: 'NE', grav: 'Normal', sai: 100471, psai: 128909, status: 'pendente', sscs: 84, clientes: 75, liberacao: '—', ciclo: '29d · em aberto (até hoje)', versao: '10.6A-03.05', resumo: "Está considerando indevidamente os valores das rubricas com classificação igual a 'Serviços Frete' no relatório do 'Extrator da DIRF' e somando valores incorretos" },
  { entrada: '12/03/2026', tipo: 'SAM', grav: '—', sai: 0, psai: 129055, status: 'pendente', sscs: 52, clientes: 47, liberacao: '—', ciclo: '26d · em aberto (até hoje)', versao: '—', resumo: 'Alterar o sistema para considerar a rubrica 9506 na base de IRRF dos relatórios no sistema, quando empregado era intermitente e foi alterado para mensalista' },
  { entrada: '12/03/2026', tipo: 'NE', grav: 'Normal', sai: 100657, psai: 129083, status: 'pendente', sscs: 21, clientes: 20, liberacao: '—', ciclo: '26d · em aberto (até hoje)', versao: '—', resumo: 'Está demonstrando incorretamente a Previdência oficial no relatório Extrator da DIRF quando há cálculo de diferença de INSS descontado à maior' },
  { entrada: '19/03/2026', tipo: 'NE', grav: 'Normal', sai: 100750, psai: 129309, status: 'pendente', sscs: 9, clientes: 9, liberacao: '—', ciclo: '19d · em aberto (até hoje)', versao: '—', resumo: 'Está duplicando o valor do Plano Saúde na coluna Valor Sistema do relatório Extrator da DIRF, quando há mais de uma folha sendo paga na mesma competência' },
  { entrada: '23/03/2026', tipo: 'NE', grav: 'Normal', sai: 0, psai: 129414, status: 'pendente', sscs: 2, clientes: 2, liberacao: '—', ciclo: '15d · em aberto (até hoje)', versao: '—', resumo: 'REANÁLISE - Não está demonstrando o valor de Ajuda de Custo na coluna Valor Sistema do Extrator da DIRF quando o colaborador é do tipo Autônomo' },
  { entrada: '25/03/2026', tipo: 'NE', grav: 'Normal', sai: 0, psai: 129532, status: 'pendente', sscs: 2, clientes: 2, liberacao: '—', ciclo: '13d · em aberto (até hoje)', versao: '—', resumo: 'REANÁLISE - Está gerando incorretamente o valor no extrator quando possui pensão alimentícia no PLR.' },
  { entrada: '26/03/2026', tipo: 'NE', grav: 'Grave', sai: 100897, psai: 129550, status: 'pendente', sscs: 100, clientes: 86, liberacao: '—', ciclo: '12d · em aberto (até hoje)', versao: '10.6A-03.05', resumo: "Está duplicando o valor Sistema do Salário Família do Campo Outros no Extrator da DIRF quando possui mais de um cálculo na mesma competência" },
  { entrada: '26/03/2026', tipo: 'NE', grav: 'Grave', sai: 100923, psai: 129551, status: 'pendente', sscs: 90, clientes: 82, liberacao: '—', ciclo: '12d · em aberto (até hoje)', versao: '10.6A-03.05', resumo: "Está demonstrando indevidamente em duas competências o valor das rubricas configuradas para o campo 'Outros' no Extrator da DIRF, quando emitido por beneficiário" },
  { entrada: '26/03/2026', tipo: 'NE', grav: 'Grave', sai: 100929, psai: 129579, status: 'pendente', sscs: 87, clientes: 71, liberacao: '—', ciclo: '12d · em aberto (até hoje)', versao: '10.6A-03.05', resumo: "Está duplicando o valor no campo 'Outros' da coluna 'Valor Sistema' do relatório Extrator da DIRF quando possui mais de um tipo de cálculo por competência" },
  { entrada: '26/03/2026', tipo: 'NE', grav: 'Normal', sai: 0, psai: 129580, status: 'pendente', sscs: 16, clientes: 11, liberacao: '—', ciclo: '12d · em aberto (até hoje)', versao: '—', resumo: 'REANÁLISE - Restruturação do Extrator da DIRF.' },
  { entrada: '30/03/2026', tipo: 'NE', grav: 'Normal', sai: 0, psai: 129645, status: 'pendente', sscs: 7, clientes: 7, liberacao: '—', ciclo: '8d · em aberto (até hoje)', versao: '—', resumo: "Está considerando indevidamente o valor de 'Dependente' da tag 'perAnt' enviado como retificação no evento S-1210 em 01/2026, para os relatórios Demonstrativo de IRRF e Extrator da DIRF" },
  { entrada: '30/03/2026', tipo: 'SAM', grav: '—', sai: 0, psai: 129678, status: 'pendente', sscs: 5, clientes: 5, liberacao: '—', ciclo: '8d · em aberto (até hoje)', versao: '—', resumo: "Refatoração do relatório 'Extrator da DIRF'" },
  { entrada: '06/04/2026', tipo: 'NE', grav: 'Normal', sai: 0, psai: 129864, status: 'pendente', sscs: 11, clientes: 11, liberacao: '—', ciclo: '1d · em aberto (até hoje)', versao: '—', resumo: "Está demonstrando o erro 'Ocorreram erros durante a consulta, por favor tente novamente mais tarde' ao gerar extrator da DIRF." },
];

function pesoGravidade(g) {
  if (g === 'Grave') return 0;
  if (g === 'Normal') return 1;
  return 2;
}

function pesoStatus(s) {
  return s === 'liberada' ? 0 : 1;
}

function pesoVersao(v) {
  if (!v || v === '—') return 'ZZZZ';
  return v;
}

dados.sort((a, b) => {
  const ds = pesoStatus(a.status) - pesoStatus(b.status);
  if (ds !== 0) return ds;
  const dg = pesoGravidade(a.grav) - pesoGravidade(b.grav);
  if (dg !== 0) return dg;
  const va = pesoVersao(a.versao);
  const vb = pesoVersao(b.versao);
  if (va < vb) return -1;
  if (va > vb) return 1;
  return 0;
});

async function gerar() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dashboard Diretrizes';
  wb.created = new Date();
  const ws = wb.addWorksheet('SAIs DIRF - Extrator', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const colunas = [
    { header: 'Entrada', key: 'entrada', width: 13 },
    { header: 'Tipo', key: 'tipo', width: 7 },
    { header: 'Grav.', key: 'grav', width: 9 },
    { header: 'SAI', key: 'sai', width: 9 },
    { header: 'PSAI', key: 'psai', width: 9 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'SSCs', key: 'sscs', width: 8 },
    { header: 'Clientes', key: 'clientes', width: 10 },
    { header: 'Liberação', key: 'liberacao', width: 13 },
    { header: 'Ciclo', key: 'ciclo', width: 26 },
    { header: 'Versão', key: 'versao', width: 14 },
    { header: 'Resumo', key: 'resumo', width: 90 },
  ];
  ws.columns = colunas;

  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A5C' } };
  const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const headerBorder = {
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
  };
  ws.getRow(1).eachCell(cell => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = headerBorder;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  ws.getRow(1).height = 22;

  const corGrave = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } };
  const fontGrave = { bold: true, color: { argb: 'FFC62828' }, size: 10 };
  const corLiberada = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
  const corPendente = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
  const fontNormal = { size: 10 };
  const borderFino = {
    bottom: { style: 'hair', color: { argb: 'FFBDBDBD' } },
  };

  let secaoAnterior = '';

  for (const d of dados) {
    const secaoAtual = d.status;
    if (secaoAtual !== secaoAnterior && secaoAnterior !== '') {
      const sepRow = ws.addRow([]);
      sepRow.height = 6;
      sepRow.eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF90A4AE' } };
      });
      for (let i = 1; i <= colunas.length; i++) {
        sepRow.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF90A4AE' } };
      }
    }
    secaoAnterior = secaoAtual;

    const saiDisplay = d.sai === 0 ? '—' : d.sai;
    const row = ws.addRow([
      d.entrada, d.tipo, d.grav, saiDisplay, d.psai,
      d.status, d.sscs, d.clientes, d.liberacao,
      d.ciclo, d.versao, d.resumo,
    ]);

    row.eachCell(cell => {
      cell.font = fontNormal;
      cell.border = borderFino;
      cell.alignment = { vertical: 'middle', wrapText: false };
    });

    if (d.grav === 'Grave') {
      row.eachCell(cell => {
        cell.fill = corGrave;
        cell.font = fontGrave;
      });
    } else if (d.status === 'liberada') {
      row.getCell(6).fill = corLiberada;
      row.getCell(6).font = { ...fontNormal, color: { argb: 'FF2E7D32' }, bold: true };
    } else {
      row.getCell(6).fill = corPendente;
      row.getCell(6).font = { ...fontNormal, color: { argb: 'FFF57F17' }, bold: true };
    }

    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(12).alignment = { vertical: 'middle', wrapText: true };
  }

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: ws.rowCount, column: colunas.length },
  };

  const totalLib = dados.filter(d => d.status === 'liberada').length;
  const totalPend = dados.filter(d => d.status === 'pendente').length;
  const totalGraves = dados.filter(d => d.grav === 'Grave').length;

  const wsSumario = wb.addWorksheet('Resumo');
  wsSumario.columns = [
    { header: 'Indicador', key: 'ind', width: 30 },
    { header: 'Qtd', key: 'qtd', width: 10 },
  ];
  wsSumario.getRow(1).eachCell(c => {
    c.fill = headerFill; c.font = headerFont;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  const resumoData = [
    ['Total de SAIs', dados.length],
    ['Liberadas', totalLib],
    ['Pendentes', totalPend],
    ['Graves (total)', totalGraves],
    ['Graves liberadas', dados.filter(d => d.grav === 'Grave' && d.status === 'liberada').length],
    ['Graves pendentes', dados.filter(d => d.grav === 'Grave' && d.status === 'pendente').length],
  ];
  for (const [ind, qtd] of resumoData) {
    const r = wsSumario.addRow([ind, qtd]);
    r.getCell(1).font = { bold: true, size: 11 };
    r.getCell(2).font = { size: 11 };
    r.getCell(2).alignment = { horizontal: 'center' };
  }

  const versoes = [...new Set(dados.map(d => d.versao))].filter(v => v !== '—').sort();
  wsSumario.addRow([]);
  const rTit = wsSumario.addRow(['Por Versão', 'Lib.', 'Pend.']);
  wsSumario.getColumn(3).width = 10;
  rTit.eachCell(c => {
    c.fill = headerFill; c.font = headerFont;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  for (const v of versoes) {
    const lib = dados.filter(d => d.versao === v && d.status === 'liberada').length;
    const pend = dados.filter(d => d.versao === v && d.status === 'pendente').length;
    const r = wsSumario.addRow([v, lib, pend]);
    r.getCell(1).font = { bold: true, size: 11 };
    r.getCell(2).alignment = { horizontal: 'center' };
    r.getCell(3).alignment = { horizontal: 'center' };
  }
  const semVersao = dados.filter(d => d.versao === '—');
  if (semVersao.length) {
    const r = wsSumario.addRow(['Sem versão', semVersao.filter(d => d.status === 'liberada').length, semVersao.filter(d => d.status === 'pendente').length]);
    r.getCell(1).font = { bold: true, size: 11, italic: true };
    r.getCell(2).alignment = { horizontal: 'center' };
    r.getCell(3).alignment = { horizontal: 'center' };
  }

  const destino = path.join(__dirname, '..', 'output', 'SAIs-DIRF-Extrator-NE.xlsx');
  await wb.xlsx.writeFile(destino);
  console.log(`Arquivo gerado: ${destino}`);
  console.log(`  Liberadas: ${totalLib} | Pendentes: ${totalPend} | Graves: ${totalGraves}`);
}

gerar().catch(err => { console.error(err); process.exit(1); });
