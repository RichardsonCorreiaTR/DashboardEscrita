/**
 * estudo-fevereiro-ne.js
 *
 * Estudo paralelo: comparacao dos fevereiros NE Folha (ultimos 5 anos).
 * Periodo: inicio da versao de fevereiro ate fim do mes calendario.
 * SSCs contados via forum_sa_psai + bethadba.ssc (chamados reais).
 *
 * Uso: node scripts/estudo-fevereiro-ne.js
 */

const path = require('path');
const fs = require('fs');
const { executar } = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');
const gerarExcel = require('./estudo-fevereiro-excel');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const ANOS = [2022, 2023, 2024, 2025, 2026];

function versaoFev(ano) { return `10.${ano - 2020}A-02`; }

function filtroNE(versao, ano) {
  return `sai_psai.nomeArea = 'Escrita'
      AND sai_psai.tipoSAI = 'NE'
      AND sai_psai.CadastroPSAI > PIAZZA.FG_GET_DATA_INICIO_VERSAO('${versao}', 1)
      AND sai_psai.CadastroPSAI < '${ano}-03-01'
      AND (EXISTS (SELECT 1 FROM bethadba.sai sai
           WHERE sai_psai.i_sai = sai.i_sai
           AND (sai.i_produto_grupo IS NULL OR sai.i_produto_grupo = 1))
        OR sai_psai.i_sai = 0)`;
}

function sqlNEs(versao, ano) {
  return `
    SELECT sai_psai.i_psai, sai_psai.i_sai,
           sai_psai.CadastroPSAI, sai_psai.gravidade_ne,
           sai_psai.nomeVersao, sai_psai.Liberacao
    FROM UP.SAI_PSAI sai_psai
    WHERE ${filtroNE(versao, ano)}
    ORDER BY sai_psai.CadastroPSAI`;
}

function sqlSSCs(versao, ano) {
  return `
    SELECT fsp.i_psai, COUNT(ssc.i_ssc) as total_ssc
    FROM bethadba.forum_sa_psai fsp
    JOIN bethadba.ssc ssc ON fsp.i_forum_sa = ssc.i_forum_sa
    WHERE fsp.i_psai IN (
      SELECT sai_psai.i_psai FROM UP.SAI_PSAI sai_psai
      WHERE ${filtroNE(versao, ano)})
    GROUP BY fsp.i_psai`;
}

function sqlInicioVersao(versao) {
  return `SELECT PIAZZA.FG_GET_DATA_INICIO_VERSAO('${versao}', 1) as inicio`;
}

function classificarLib(row, ano) {
  if (!row.Liberacao) return 'Nao liberada';
  const d = new Date(row.Liberacao);
  if (d.getFullYear() === ano && d.getMonth() === 1) return 'Lib. fev';
  if (d.getFullYear() === ano && d.getMonth() === 2) return 'Lib. mar';
  return `Lib. ${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

async function coletarDados() {
  const dados = {};
  for (const ano of ANOS) {
    const versao = versaoFev(ano);
    console.log(`\nColetando ${versao} (fev/${ano})...`);

    const [dateRow] = await executar(sqlInicioVersao(versao));
    const inicioVersao = dateRow.inicio;
    console.log(`  Periodo: ${new Date(inicioVersao).toLocaleDateString('pt-BR')} ate 28-29/02/${ano}`);

    const rows = await executar(sqlNEs(versao, ano));

    let sscMap = {};
    try {
      console.log('  Contando SSCs (forum_sa_psai + ssc)...');
      const sscRows = await executar(sqlSSCs(versao, ano));
      for (const r of sscRows) sscMap[r.i_psai] = r.total_ssc;
      console.log('  SSCs mapeados: %d NEs com SSC', sscRows.length);
    } catch (err) {
      console.warn('  AVISO SSC: %s', err.message);
    }

    const graves = rows.filter(r => r.gravidade_ne === 'Grave');
    const criticas = rows.filter(r => r.gravidade_ne === 'Critica');
    const totalSSC = Object.values(sscMap).reduce((s, v) => s + v, 0);
    const libFev = rows.filter(r => r.Liberacao && new Date(r.Liberacao).getMonth() === 1);
    const libMar = rows.filter(r => r.Liberacao && new Date(r.Liberacao).getMonth() === 2);

    const mapNE = r => ({
      i_psai: r.i_psai, i_sai: r.i_sai, gravidade: r.gravidade_ne,
      entrada: r.CadastroPSAI, versao: r.nomeVersao || '-',
      liberacao: r.Liberacao, ssc: sscMap[r.i_psai] || 0,
      statusLib: classificarLib(r, ano)
    });

    dados[ano] = {
      ano, versao, inicioVersao, total: rows.length,
      graves: graves.length, criticas: criticas.length,
      totalSSC, liberadasFev: libFev.length, liberadasMar: libMar.length,
      detalhesGC: [...criticas, ...graves].map(mapNE),
      todasNEs: rows.map(mapNE)
    };
    console.log('  %d NEs | %dG %dC | %d SSCs | %d lib.fev %d lib.mar',
      rows.length, graves.length, criticas.length, totalSSC, libFev.length, libMar.length);
  }
  return dados;
}

function r1(v) { return Math.round(v * 10) / 10; }

function analisar(dados) {
  const hist = ANOS.slice(0, -1).map(a => dados[a]);
  const at = dados[2026];
  const mE = hist.reduce((s, d) => s + d.total, 0) / hist.length;
  const mGC = hist.reduce((s, d) => s + d.graves + d.criticas, 0) / hist.length;
  const mSSC = hist.reduce((s, d) => s + d.totalSSC, 0) / hist.length;
  const vE = mE > 0 ? r1(((at.total - mE) / mE) * 100) : 0;
  return {
    mediaEntradas: r1(mE), mediaGC: r1(mGC), mediaSSC: r1(mSSC),
    variacaoEntradas: vE,
    veredicto: at.total <= mE ? 'MELHOR' : 'PIOR',
    nota: at.total <= mE
      ? `Fev/2026 abaixo da media historica (${Math.round(mE)} NEs)`
      : `Fev/2026 acima da media historica (${Math.round(mE)} NEs)`,
    notaParcial: 'Fev/2026 ainda em andamento (dados parciais ate 27/02)'
  };
}

async function main() {
  console.log('=== Estudo: Fevereiros NE Folha (por versao, 5 anos) ===');
  const dados = await coletarDados();
  const analise = analisar(dados);

  console.log('\n--- Analise ---');
  console.log('Media historica: %s NEs', analise.mediaEntradas);
  const sinal = analise.variacaoEntradas > 0 ? '+' : '';
  console.log('Fev/2026: %d NEs (%s%s%% vs media)', dados[2026].total, sinal, analise.variacaoEntradas);
  console.log('Veredicto: %s - %s', analise.veredicto, analise.nota);
  console.log('OBS: %s', analise.notaParcial);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const arquivo = await gerarExcel(dados, analise, OUTPUT_DIR);
  console.log('\nExcel: %s', arquivo);
  await conexao.fechar();
}

main().catch(err => {
  console.error('Erro:', err);
  conexao.fechar().then(() => process.exit(1));
});
