/**
 * Timeline DIRF/Extrator: cronologia (desde 2024), SSC, ciclo, SGSAI, PesquisaMercado.
 *
 * TIMELINE_DESDE — corte da lista (padrão 2024-01-01). TIMELINE_JORNADA_INTENSA — marco out/2025 (só texto).
 * TIMELINE_FILTRO=amplo | config sgsai | PESQUISA_MERCADO_DIR | config/pesquisa-mercado.json
 *
 * Uso: node scripts/gerar-timeline-dirf-extrator.js
 */

const path = require('path');
const fs = require('fs');
const { executar } = require('../src/core/query-executor');
const conexao = require('../src/core/conexao');
const {
  fecharPoolSgsai,
  executarSgsai,
  sgsaiHabilitadoNaConfig
} = require('../src/core/conexao-sgsai');
const {
  dataInicioCronologia,
  dataJornadaIntensa,
  sqlLinhaTempo,
  sqlLinhaTempoPorPsaisChecklist
} = require('./dirf-extrator-timeline/queries');
const { carregarChecklistConfig, mesclarLinhaTempoComChecklist } = require('./dirf-extrator-timeline/checklist-merge');
const { montarValidacaoExtrator } = require('./dirf-extrator-timeline/validacao-extrator');
const {
  ancoraSintetica,
  resolverAncoraAmplo,
  resolverAncoraEstrito
} = require('./dirf-extrator-timeline/resolve-ancora');
const decode = require('./dirf-extrator-timeline/decode');
const { montarPayload, gerarHtml } = require('./dirf-extrator-timeline/html');
const { aplicarEntradaOverrides } = require('./dirf-extrator-timeline/entrada-overrides');
const { enriquecerSscTimeline } = require('./dirf-extrator-timeline/ssc-timeline');
const {
  enriquecerPorPsais,
  enriquecerFeedbackPorSais,
  aplicarMapa,
  aplicarFeedback
} = require('./dirf-extrator-timeline/sgsai-enriquecimento');
const { montarHistoria, resumoModulosParaPayload } = require('./dirf-extrator-timeline/historia');
const { carregarPesquisaMercadoAnalisada } = require('./dirf-extrator-timeline/pesquisa-mercado-analise');
const { envAmplo, enriquecerTopComResumo, metaFiltro } = require('./dirf-extrator-timeline/gerar-timeline-meta');

const OUT = path.join(__dirname, '..', 'output', 'dirf-extrator-timeline.html');

async function fecharTudo() {
  await fecharPoolSgsai();
  await conexao.fechar();
}

async function main() {
  const cronologia = dataInicioCronologia();
  const intensa = dataJornadaIntensa();
  const forcarAmplo = envAmplo();
  let aviso = null;
  let amplo = forcarAmplo;

  console.log('=== Timeline DIRF/Extrator ===');
  console.log('Cronologia (corte lista): %s | Marco intensificação: %s\n', cronologia, intensa);

  let res;
  if (amplo) {
    res = await resolverAncoraAmplo(cronologia);
  } else {
    res = await resolverAncoraEstrito(cronologia);
    if (res.estritoVazio) {
      console.warn('[timeline] Sem dirf+extrator no corte; modo amplo.\n');
      aviso =
        'Sem PSAI dirf+extrator no corte; filtro amplo. TIMELINE_FILTRO=amplo força amplo.';
      amplo = true;
      res = await resolverAncoraAmplo(cronologia);
    }
  }

  let ancora;
  if (res.erro) {
    console.warn('[timeline] %s Usando data do corte como referência.\n', res.erro);
    ancora = ancoraSintetica(
      cronologia,
      'Nenhuma SAI âncora no corte; narrativa usa só a data inicial da cronologia.'
    );
  } else {
    ancora = res.ancora;
  }

  const rowsTema = await executar(sqlLinhaTempo(cronologia, amplo));
  const checkCfg = carregarChecklistConfig();
  let rowsCheck = [];
  const sqlChk =
    checkCfg.ok && checkCfg.ids.length ? sqlLinhaTempoPorPsaisChecklist(checkCfg.ids) : '';
  if (sqlChk) {
    rowsCheck = await executar(sqlChk);
    console.log(
      '[checklist] %d PSAI(s) configurados | %d linha(s) na query checklist',
      checkCfg.ids.length,
      rowsCheck.length
    );
  }
  const { rows, faltando, totalChecklist } = mesclarLinhaTempoComChecklist(
    rowsTema,
    rowsCheck,
    checkCfg.ids
  );
  if (faltando.length) console.warn('[checklist] PSAI sem linha (Folha/produto): %s\n', faltando.join(', '));
  console.log('Registros (tema + checklist): %d\n', rows.length);

  const payload = montarPayload(ancora, rows, decode, {
    filtro: metaFiltro(amplo, aviso, cronologia, intensa)
  });
  payload.jornada = { cronologiaDesde: cronologia, intensificacaoDesde: intensa };

  aplicarEntradaOverrides(payload);

  const ac = payload.ancora;
  console.log(
    'Ancora: SAI %s PSAI %s (%s)%s',
    ac.i_sai ?? '—',
    ac.i_psai ?? '—',
    ac.entrada,
    ac.entrada_ajuste_manual ? ' [data exibida ajustada manualmente]' : ''
  );
  console.log('%s\n', ac.motivo);

  await enriquecerSscTimeline(payload.itens);

  const enr = await enriquecerPorPsais(payload.itens.map(it => it.i_psai));
  aplicarMapa(payload.itens, enr.porPsai);

  const saiIds = [...new Set(payload.itens.map(it => it.i_sai).filter(Boolean))];
  const fb = await enriquecerFeedbackPorSais(saiIds, cronologia);
  aplicarFeedback(payload.itens, fb.porSai);

  let avisoSgsai = enr.aviso;
  if (fb.erro && enr.ok) {
    avisoSgsai = [avisoSgsai, 'feedback_sa: ' + fb.erro].filter(Boolean).join(' ');
  }

  payload.sgsai = {
    ok: enr.ok,
    aviso: avisoSgsai,
    topModulos: resumoModulosParaPayload(payload.itens),
    total_feedback_eventos: fb.total,
    topFeedbackSai: enriquecerTopComResumo(fb.topList, payload.itens)
  };

  payload.validacao = await montarValidacaoExtrator({
    itens: payload.itens,
    checkCfg,
    faltandoPsais: faltando,
    executarSgsai,
    sgsaiHabilitadoNaConfig,
    decode
  });
  if (!checkCfg.ok && checkCfg.erro) payload.validacao.config_erro = checkCfg.erro;
  if (payload.validacao.pares_faltantes && payload.validacao.pares_faltantes.length) {
    console.warn(
      '[validação] %d par(es) da lista oficial sem correspondência exata na timeline.',
      payload.validacao.pares_faltantes.length
    );
  } else if (payload.validacao.pares_esperados) {
    console.log('[validação] Pares SAI+PSAI: %d OK.', payload.validacao.pares_esperados);
  }

  payload.pesquisaMercado = carregarPesquisaMercadoAnalisada(payload);
  payload.historia = montarHistoria(payload);

  fs.writeFileSync(OUT, gerarHtml(payload), 'utf8');
  console.log('Gerado: %s', OUT);

  await fecharTudo();
}

main().catch(err => {
  console.error(err);
  fecharTudo().then(() => process.exit(1));
});
