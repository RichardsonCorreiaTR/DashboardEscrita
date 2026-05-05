/**
 * coleta.js - Coleta dados do banco para analise de conflitos
 *
 * Fase 1: Atividades dos analistas SA (ultimas 2 semanas)
 * Fase 2: PSAIs e SAIs sendo trabalhadas pelo time SA
 * Fase 3: NEs pendentes Escrita Fiscal
 * Fase 4: Responsaveis das PSAIs/SAIs
 */

const { executar } = require('../../src/core/query-executor');
const q = require('./queries');

async function coletarAtividadesSA() {
  console.log('\n=== FASE 1: Atividades dos analistas SA ===');

  console.log('  Coletando registro de atividades...');
  const atividades = await executar(q.queryAtividadesSA());

  console.log('  Coletando atividades com SAI vinculada...');
  const atividadesComSai = await executar(q.queryAtividadesSAComSai());

  return { atividades, atividadesComSai };
}

async function coletarTramitesSA() {
  console.log('\n=== FASE 2: PSAIs e SAIs trabalhadas pelo time SA ===');

  console.log('  Coletando tramites PSAI...');
  const psais = await executar(q.queryPsaisSendoTrabalhadas());

  console.log('  Coletando tramites SAI...');
  const sais = await executar(q.querySaisSendoTrabalhadas());

  return { psais, sais };
}

async function coletarNEsPendentes() {
  console.log('\n=== FASE 3: NEs pendentes Escrita Fiscal ===');

  console.log('  Coletando NEs pendentes...');
  const nesPendentes = await executar(q.queryNEsPendentesFolha());

  return nesPendentes;
}

async function coletarDetalhes(psaiIds, saiIds) {
  console.log('\n=== FASE 4: Detalhes e responsaveis ===');
  const resultado = { detalhes: [], respPsai: [], respSai: [] };

  if (psaiIds.length > 0) {
    console.log('  Coletando detalhes de %d PSAIs...', psaiIds.length);
    resultado.detalhes = await executar(
      q.queryDetalhesPsaiSai(psaiIds)
    );

    console.log('  Coletando responsaveis PSAI...');
    resultado.respPsai = await executar(
      q.queryResponsaveisPsai(psaiIds)
    );
  }

  if (saiIds.length > 0) {
    console.log('  Coletando responsaveis SAI...');
    resultado.respSai = await executar(
      q.querySaiResponsaveis(saiIds)
    );
  }

  return resultado;
}

module.exports = {
  coletarAtividadesSA,
  coletarTramitesSA,
  coletarNEsPendentes,
  coletarDetalhes
};
