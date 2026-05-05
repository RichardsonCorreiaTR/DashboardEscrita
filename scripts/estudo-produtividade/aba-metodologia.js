/**
 * aba-metodologia.js - Aba 7: Metodologia, fontes e queries SQL
 */

const { COR, FONTE, fill, borda, setTitulo, setSubtitulo, setSecao, setLinha } = require('./estilos');
const { SQL_TEXTOS } = require('./queries');
const { CORTE_PSAIS, CORTE_HORAS_MIN, CORTE_SAIS } = require('./coleta');

function criarAbaMetodologia(wb) {
  const ws = wb.addWorksheet('Metodologia', { properties: { tabColor: { argb: COR.cinzaMedio } } });
  ws.columns = [{ width: 25 }, { width: 85 }];
  const NC = 2;

  setTitulo(ws, 1, 'METODOLOGIA E FONTES DE DADOS', NC, COR.azulEscuro);
  setSubtitulo(ws, 2, 'Todos os dados foram extraidos ao vivo do banco via ODBC no momento da geracao deste arquivo.', NC);

  let r = 4;
  setSecao(ws, r, 'INFRAESTRUTURA', NC); r++;
  setLinha(ws, r, ['Banco de dados', 'Sybase SQL Anywhere (ASA 9.0)']); r++;
  setLinha(ws, r, ['Conexao', 'ODBC via DSN pbcvs9']); r++;
  setLinha(ws, r, ['Periodos', 'PIAZZA.FG_GET_DATA_INICIO_VERSAO / FG_GET_DATA_FIM_VERSAO']); r++;
  setLinha(ws, r, ['Versoes comparadas', '10.4A-01 a 03 (2024) | 10.5A-01 a 03 (2025) | 10.6A-01 a 03 (2026)']); r++;

  r++;
  setSecao(ws, r, 'DEFINICAO DAS METRICAS', NC); r++;
  const metricas = [
    ['Entrada bruta', 'COUNT de PSAIs com CadastroPSAI no periodo PIAZZA da versao. Area Escrita, tipo NE, filtro produto_grupo (NULL ou 1) via EXISTS em bethadba.sai.'],
    ['PSAI → SAI', 'i_sai > 0 = gerou SAI, i_sai = 0 = ainda PSAI. Contagem sobre as entradas brutas.'],
    ['Descartes excl. 26', 'PSAIs com Descarte no periodo. Motivo = COALESCE(NULLIF(i_sai_situacoes,0), i_psai_situacoes). Excluido motivo 26 (limpeza backlog).'],
    ['Tempo analise', 'SUM de psai_responsaveis.tempo_analise + tempo_definicao para PSAIs cadastradas no periodo. Multiplos responsaveis somados.'],
    ['Pessoa efetiva (PSAI)', '>= ' + CORTE_PSAIS + ' PSAIs analisadas OU >= ' + Math.round(CORTE_HORAS_MIN / 60) + 'h de tempo registrado na versao.'],
    ['Pessoa efetiva (SAI)', '>= ' + CORTE_SAIS + ' SAIs geradas na versao.'],
    ['Time efetivo', 'Uniao (PSAI + SAI) sem duplicatas. Se a mesma pessoa analisa e gera, conta 1 vez.'],
    ['Produtividade/pessoa', 'Metrica absoluta / media de efetivos por versao no trimestre.'],
    ['Indice composto', 'Media das variacoes % de NEs/pessoa, horas/pessoa e SAIs/pessoa entre 2024 e 2026.']
  ];
  for (const [nome, desc] of metricas) {
    setLinha(ws, r, [nome, desc]);
    ws.getRow(r).height = 30;
    ws.getCell(r, 2).alignment = { wrapText: true };
    r++;
  }

  r++;
  setSecao(ws, r, 'QUERIES SQL UTILIZADAS', NC); r++;
  const queries = [
    ['Entradas brutas', SQL_TEXTOS.entradas],
    ['Descartes por motivo', SQL_TEXTOS.descartes],
    ['Tempo analise/definicao', SQL_TEXTOS.tempos],
    ['Composicao do time', SQL_TEXTOS.time]
  ];
  for (const [nome, sql] of queries) {
    ws.mergeCells(r, 1, r, NC);
    ws.getCell(r, 1).value = nome + ':';
    ws.getCell(r, 1).font = FONTE.negrito;
    r++;
    ws.mergeCells(r, 1, r, NC);
    ws.getCell(r, 1).value = sql;
    ws.getCell(r, 1).font = { name: 'Consolas', size: 9 };
    ws.getCell(r, 1).alignment = { wrapText: true };
    ws.getRow(r).height = 80;
    r++;
  }

  r++;
  setSecao(ws, r, 'SITUACOES DE DESCARTE (REFERENCIA)', NC); r++;
  const sits = [
    ['4', 'Descartado'], ['5', 'Concluido sem Desenvolvimento'],
    ['6', 'Reprovada'], ['23', 'Prescrita (automatica)'],
    ['26', 'Liberado em versoes anteriores (EXCLUIDO)']
  ];
  for (const [id, desc] of sits) {
    setLinha(ws, r, ['Situacao ' + id, desc]);
    r++;
  }

  return ws;
}

module.exports = { criarAbaMetodologia };
