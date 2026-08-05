/**
 * Composicao do tempo de implementacao por tipoSAI (denominador dos 3 indicadores).
 * Mostra por que NE% + SAL% + SAM/SAIL% nao fecha 100%.
 *
 * Uso: node scripts/diag-tempo-composicao.js [versao]
 */
const conexao = require('../src/core/conexao');
const qe = require('../src/core/query-executor');
const versaoUtil = require('../src/core/versao');
const { condAreaNE } = require('../src/core/consultas-ne');

const V = process.argv[2] || '10.6A-08';
const AREA = 'Escrita';
const PARALELO = "SUBSTR(sp.nomeVersao, 1, 1) NOT BETWEEN '0' AND '9'";

function filtroLib(v) {
  const p = versaoUtil.padraoArquivoVersao(v);
  return p ? `(sp.nomeVersao = '${v}' OR sp.nomeVersao LIKE '${p}')` : `sp.nomeVersao = '${v}'`;
}

const CHAVE = `sp.tipoSAI, COALESCE(sp.NE_PREVENCAO, 0) as interna`;

function qDevLib(v) {
  return `
    SELECT ${CHAVE}, SUM(rd.tempo_realizado) as dev
    FROM bethadba.sai_roteiro_desenvolvimento rd
    JOIN UP.SAI_PSAI sp ON rd.i_sai = sp.i_sai
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE rd.data_exclusao IS NULL AND ${condAreaNE(AREA, 'sp')} AND ${filtroLib(v)}
      AND sp.Liberacao IS NOT NULL AND COALESCE(psai.i_produto_grupo, 1) = 1 AND sp.i_sai > 0
    GROUP BY sp.tipoSAI, COALESCE(sp.NE_PREVENCAO, 0)`;
}

function qTesteLib(v) {
  return `
    SELECT ${CHAVE}, SUM(rt.tempo_teste_realizado) as teste,
           SUM(rt.tempo_preparacao_realizado) as prep
    FROM bethadba.sai_roteiro_testes rt
    JOIN UP.SAI_PSAI sp ON rt.i_sai = sp.i_sai
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE rt.data_exclusao IS NULL AND ${condAreaNE(AREA, 'sp')} AND ${filtroLib(v)}
      AND sp.Liberacao IS NOT NULL AND COALESCE(psai.i_produto_grupo, 1) = 1 AND sp.i_sai > 0
    GROUP BY sp.tipoSAI, COALESCE(sp.NE_PREVENCAO, 0)`;
}

function qDevPar(v) {
  const ini = versaoUtil.sqlInicioVersao(v), fim = versaoUtil.sqlFimVersao(v);
  return `
    SELECT ${CHAVE}, SUM(rd.tempo_realizado) as dev
    FROM bethadba.sai_roteiro_desenvolvimento rd
    JOIN UP.SAI_PSAI sp ON rd.i_sai = sp.i_sai
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE rd.data_exclusao IS NULL AND rd.data_conclusao >= ${ini} AND rd.data_conclusao <= ${fim}
      AND ${condAreaNE(AREA, 'sp')} AND ${PARALELO}
      AND COALESCE(psai.i_produto_grupo, 1) = 1 AND sp.i_sai > 0
    GROUP BY sp.tipoSAI, COALESCE(sp.NE_PREVENCAO, 0)`;
}

function qTestePar(v) {
  const ini = versaoUtil.sqlInicioVersao(v), fim = versaoUtil.sqlFimVersao(v);
  return `
    SELECT ${CHAVE}, SUM(rt.tempo_teste_realizado) as teste,
           SUM(rt.tempo_preparacao_realizado) as prep
    FROM bethadba.sai_roteiro_testes rt
    JOIN UP.SAI_PSAI sp ON rt.i_sai = sp.i_sai
    JOIN bethadba.psai psai ON sp.i_psai = psai.i_psai
    WHERE rt.data_exclusao IS NULL AND rt.data_conclusao >= ${ini} AND rt.data_conclusao <= ${fim}
      AND ${condAreaNE(AREA, 'sp')} AND ${PARALELO}
      AND COALESCE(psai.i_produto_grupo, 1) = 1 AND sp.i_sai > 0
    GROUP BY sp.tipoSAI, COALESCE(sp.NE_PREVENCAO, 0)`;
}

function acumular(mapa, rows, origem) {
  rows.forEach(r => {
    const tipo = (r.tipoSAI || '(sem tipo)').trim();
    const chave = `${origem}|${tipo}|${r.interna === 1 ? 'interna' : 'externa'}`;
    if (!mapa[chave]) mapa[chave] = { origem, tipo, interna: r.interna === 1, min: 0 };
    mapa[chave].min += (r.dev || 0) + (r.teste || 0) + (r.prep || 0);
  });
}

function pct(v, total) { return total ? (v / total * 100).toFixed(1) : '0.0'; }

async function main() {
  await conexao.inicializar();
  const [devLib, testeLib, devPar, testePar] = await Promise.all([
    qe.executar(qDevLib(V)), qe.executar(qTesteLib(V)),
    qe.executar(qDevPar(V)), qe.executar(qTestePar(V))
  ]);

  const mapa = {};
  acumular(mapa, devLib, 'liberadas');
  acumular(mapa, testeLib, 'liberadas');
  acumular(mapa, devPar, 'paralelo');
  acumular(mapa, testePar, 'paralelo');

  const linhas = Object.values(mapa).filter(l => l.min > 0)
    .sort((a, b) => b.min - a.min);
  const total = linhas.reduce((s, l) => s + l.min, 0);

  console.log('\nVersao', V, '| denominador total =', total, 'min\n');
  console.log('ORIGEM     TIPO      VISIB     MINUTOS      % DO TOTAL');
  linhas.forEach(l => {
    console.log(
      l.origem.padEnd(11) + l.tipo.padEnd(10) +
      (l.interna ? 'interna' : 'externa').padEnd(10) +
      String(l.min).padStart(8) + pct(l.min, total).padStart(14) + '%'
    );
  });

  const numerador = t => linhas
    .filter(l => l.origem === 'liberadas' && !l.interna && t.includes(l.tipo))
    .reduce((s, l) => s + l.min, 0);

  const ne = numerador(['NE']), sal = numerador(['SAL']), sam = numerador(['SAM', 'SAIL']);
  console.log('\n--- Numeradores dos cards (so liberadas + externas) ---');
  console.log('NE       ', ne, '=>', pct(ne, total) + '%');
  console.log('SAL      ', sal, '=>', pct(sal, total) + '%');
  console.log('SAM/SAIL ', sam, '=>', pct(sam, total) + '%');
  const resto = total - ne - sal - sam;
  console.log('SOMA     ', pct(ne + sal + sam, total) + '%  | FORA DOS CARDS:', resto, '=>', pct(resto, total) + '%');

  console.log('\n--- Composicao do que fica fora ---');
  linhas.filter(l => l.origem === 'paralelo' || l.interna ||
      !['NE', 'SAL', 'SAM', 'SAIL'].includes(l.tipo))
    .forEach(l => console.log(' ', l.origem, l.tipo, l.interna ? 'interna' : 'externa',
      l.min, 'min', '=>', pct(l.min, total) + '%'));

  await conexao.fechar();
}

main().catch(e => { console.error(e); process.exit(1); });
