/** Regenera cache SS Respondidas para um ano/mes (sem HTTP). */
const conexao = require('../src/core/conexao');
const qe = require('../src/core/query-executor');
const cacheSs = require('../src/core/cache-ss-respondidas');
const { querySsRespondidas } = require('../src/servidor/rotas/ss-respondidas-queries');
const { mapearRegistros } = require('../src/servidor/rotas/ss-respondidas-utils');
const equipe = require('../config/equipe.json');

const ANO = Number(process.argv[2]) || 2026;
const MES = process.argv[3] ? Number(process.argv[3]) : null;

const membros = equipe.analistas.filter(a => a.papel === 'analista');
const MAPA = {};
membros.forEach(a => { MAPA[a['codigo-sgd']] = { nome: a.apelido, senioridade: a.senioridade }; });

async function main() {
  cacheSs.restaurar();
  await conexao.inicializar();
  const rows = await qe.executar(querySsRespondidas(membros.map(a => a['codigo-sgd']), ANO, MES));
  const registros = mapearRegistros(rows, MAPA);
  if (MES) {
    cacheSs.salvarMes(ANO, MES, registros);
    console.log('Mes', MES, 'salvo:', registros.length, 'registros');
  } else {
    const porMes = {};
    registros.forEach(r => { if (!porMes[r.mes]) porMes[r.mes] = []; porMes[r.mes].push(r); });
    Object.entries(porMes).forEach(([m, rs]) => cacheSs.salvarMes(ANO, Number(m), rs));
    console.log('Ano', ANO, 'salvo:', registros.length, 'registros em', Object.keys(porMes).length, 'meses');
  }
  const g = registros.filter(r => r.nome === 'Giovani' && r.i_ss === 1088353);
  console.log('Giovani SS 1088353:', g.map(r => 'T' + r.i_ss_tramites).join(', ') || '(nenhum)');
  const t15 = registros.filter(r => r.nome === 'Giovani' && r.i_ss === 1088353 && r.i_ss_tramites === 15);
  console.log('T15?', t15.length ? 'ERRO' : 'OK removido');
  await conexao.fechar();
}

main().catch(e => { console.error(e); process.exit(1); });
