/**
 * agendador.js - Agendamento de snapshots do historico
 *
 * Salva o historico de indicadores 3x por dia util (8h, 12h, 18h).
 * Verifica a cada minuto se esta no horario certo.
 * Ignora sabados e domingos.
 * Se o valor nao mudou desde o ultimo snapshot, nao regrava.
 */

const { eDiaUtil } = require('./date-utils');
const { registrar } = require('../historico/registrador');
const versao = require('./versao');

const HORARIOS = [8, 12, 18];
const INTERVALO_MS = 60 * 1000; // verifica a cada 1 minuto

/** Controle para nao gravar duplicado no mesmo horario */
const jaExecutado = new Set();
let intervalId = null;

/**
 * Executa o snapshot: calcula todos os indicadores e salva no historico
 * @param {Object} indicadores - Modulo indicadores (require('../indicadores'))
 * @param {Object} executor - Query executor
 */
async function executarSnapshot(indicadores, executor) {
  const agora = new Date();
  const hora = agora.getHours();
  const chave = `${agora.toISOString().slice(0, 10)}-${hora}h`;

  if (jaExecutado.has(chave)) return;

  console.log('[agendador] Iniciando snapshot historico (%s)', chave);

  try {
    const nomeVersao = await versao.detectarVersaoAtual(executor);
    const lista = indicadores.listar();

    for (const ind of lista) {
      try {
        const resultado = await indicadores.calcular(ind.id, executor, {
          versao: nomeVersao, force: true
        });

        registrar(ind.id, resultado, {
          versao: nomeVersao,
          snapshot: chave
        });
      } catch (err) {
        console.warn('[agendador] Erro em %s: %s', ind.id, err.message);
      }
    }

    jaExecutado.add(chave);
    console.log('[agendador] Snapshot concluido (%s, %d indicadores)', chave, lista.length);
  } catch (err) {
    console.error('[agendador] Erro no snapshot:', err.message);
  }
}

/**
 * Verifica se eh hora de executar o snapshot
 * @param {Object} indicadores - Modulo indicadores
 * @param {Object} executor - Query executor
 */
function verificar(indicadores, executor) {
  const agora = new Date();

  if (!eDiaUtil(agora)) return;

  const hora = agora.getHours();
  if (!HORARIOS.includes(hora)) return;

  const chave = `${agora.toISOString().slice(0, 10)}-${hora}h`;
  if (jaExecutado.has(chave)) return;

  executarSnapshot(indicadores, executor);
}

/**
 * Inicia o agendador
 * @param {Object} indicadores - Modulo indicadores
 * @param {Object} executor - Query executor
 */
function iniciar(indicadores, executor) {
  if (intervalId) return;

  intervalId = setInterval(() => verificar(indicadores, executor), INTERVALO_MS);
  console.log('[agendador] Iniciado - snapshots em dias uteis as %s',
    HORARIOS.map(h => h + 'h').join(', '));

  // Verificar imediatamente na startup
  verificar(indicadores, executor);
}

/** Para o agendador */
function parar() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[agendador] Parado');
  }
}

module.exports = { iniciar, parar };
