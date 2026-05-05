/**
 * coleta.js - Coleta de dados ODBC para todas as 9 versoes do estudo
 *
 * Retorna objeto com dados brutos por versao + nomes de analistas.
 */

const q = require('./queries');

const VERSOES = [
  '10.4A-01', '10.4A-02', '10.4A-03',
  '10.5A-01', '10.5A-02', '10.5A-03',
  '10.6A-01', '10.6A-02', '10.6A-03'
];

const CORTE_PSAIS = 3;
const CORTE_HORAS_MIN = 600;
const CORTE_SAIS = 3;

function classificarDescartes(rows) {
  const mapa = { reprovada: 0, descartado: 0, csd: 0, prescrita: 0, outros: 0, sit26: 0 };
  let total = 0;
  for (const r of rows) {
    total += r.qtd;
    if (r.motivo === 26) { mapa.sit26 += r.qtd; continue; }
    if (r.motivo === 6) mapa.reprovada += r.qtd;
    else if (r.motivo === 4) mapa.descartado += r.qtd;
    else if (r.motivo === 5) mapa.csd += r.qtd;
    else if (r.motivo === 23) mapa.prescrita += r.qtd;
    else mapa.outros += r.qtd;
  }
  mapa.total_bruto = total;
  mapa.total_excl26 = total - mapa.sit26;
  return mapa;
}

function filtrarEfetivos(analistasPsai, geradoresSai) {
  const efetivos = new Set();
  for (const a of analistasPsai) {
    const totalMin = (a.min_analise || 0) + (a.min_definicao || 0);
    if (a.psais >= CORTE_PSAIS || totalMin >= CORTE_HORAS_MIN) {
      efetivos.add(a.i_usuarios);
    }
  }
  for (const g of geradoresSai) {
    if (g.sais >= CORTE_SAIS) efetivos.add(g.gerador);
  }
  return efetivos;
}

async function coletarVersao(executor, v) {
  const [entradas, descartes, tempos, analistas, geradores, datas] = await Promise.all([
    executor(q.queryEntradas(v)),
    executor(q.queryDescartes(v)),
    executor(q.queryTempos(v)),
    executor(q.queryAnalistasPsai(v)),
    executor(q.queryGeradoresSai(v)),
    executor(q.queryDatas(v))
  ]);

  const efetivos = filtrarEfetivos(analistas, geradores);

  return {
    versao: v,
    datas: { inicio: datas[0].dt_ini, fim: datas[0].dt_fim },
    entradas: entradas[0],
    descartes: classificarDescartes(descartes),
    tempos: tempos[0],
    analistas_psai: analistas,
    geradores_sai: geradores,
    efetivos: [...efetivos],
    qtd_efetivos: efetivos.size
  };
}

async function coletarTudo(executarFn) {
  console.log('Coletando dados de %d versoes...', VERSOES.length);
  const dados = {};
  for (const v of VERSOES) {
    process.stdout.write('  ' + v + '... ');
    dados[v] = await coletarVersao(executarFn, v);
    console.log('OK (%d efetivos)', dados[v].qtd_efetivos);
  }

  const todosIds = new Set();
  for (const v of VERSOES) {
    for (const a of dados[v].analistas_psai) todosIds.add(a.i_usuarios);
    for (const g of dados[v].geradores_sai) todosIds.add(g.gerador);
  }

  console.log('Buscando nomes de %d pessoas...', todosIds.size);
  const nomesRows = await executarFn(q.queryNomes([...todosIds]));
  const nomes = {};
  for (const r of nomesRows) {
    nomes[r.CODIGO_SGD] = Buffer.isBuffer(r.nome)
      ? r.nome.toString('latin1').trim() : (r.nome || '').trim();
  }

  return { versoes: VERSOES, dados, nomes };
}

module.exports = { coletarTudo, VERSOES, CORTE_PSAIS, CORTE_HORAS_MIN, CORTE_SAIS };
