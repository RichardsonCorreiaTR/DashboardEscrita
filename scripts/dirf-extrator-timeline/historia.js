/**
 * Narrativa orientada a decisão — "frase de leitura" do UX Writer skill.
 * Formato: número + base + significado + ação (quando couber).
 * Máx. 3–4 parágrafos curtos; o resto vai para seções colapsáveis.
 */

function fmtData(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 10).split('-').reverse().join('/');
}

function topN(mapa, n) {
  return Object.entries(mapa)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function contarPorCampo(itens, campo) {
  const m = {};
  for (const it of itens) {
    const k = it[campo] || '(não informado)';
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

function mesMaisMovimentado(itens) {
  const m = {};
  for (const it of itens) {
    const ym = (it.entrada || '').slice(0, 7);
    if (!ym) continue;
    m[ym] = (m[ym] || 0) + 1;
  }
  const t = topN(m, 1)[0];
  if (!t) return null;
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const [yy, mm] = t[0].split('-');
  return `${meses[parseInt(mm, 10) - 1]}/${yy} (${t[1]} SAIs)`;
}

function fraseSituacao(totais, itens) {
  const pendPct = totais.itens
    ? Math.round((totais.pendentes / totais.itens) * 100)
    : 0;
  const nes = itens.filter(i => i.ramo === 'ne').length;
  const sas = itens.length - nes;
  const pico = mesMaisMovimentado(itens);

  let sinal;
  if (pendPct > 50) sinal = 'Atenção';
  else if (pendPct > 30) sinal = 'Em acompanhamento';
  else sinal = 'Situação controlada';

  let txt =
    `${sinal}: ${totais.pendentes} de ${totais.itens} SAIs permanecem pendentes (${pendPct}%). ` +
    `${totais.liberadas} já liberadas, ${totais.descartadas} descartadas. ` +
    `Composição: ${nes} NE e ${sas} SA.`;

  if (pico) txt += ` Pico de cadastro PSAI: ${pico}.`;
  return txt;
}

function fraseAncora(ancora) {
  const dt = fmtData(ancora.entrada);
  let txt = `Âncora narrativa: SAI ${ancora.i_sai ?? '—'}, PSAI ${ancora.i_psai ?? '—'} em ${dt}.`;
  if (ancora.entrada_ajuste_manual) {
    txt += ` Data exibida corrigida manualmente (SGD refletia registro antigo).`;
  }
  return txt;
}

function fraseChecklist(validacao) {
  if (!validacao || validacao.pares_esperados == null) return null;
  if (validacao.pares_faltantes && validacao.pares_faltantes.length) {
    return (
      `Checklist: ${validacao.pares_faltantes.length} par(es) SAI+PSAI da lista oficial sem correspondência ` +
      `na linha do tempo — verifique os avisos acima.`
    );
  }
  return `Checklist: ${validacao.pares_esperados} pares SAI+PSAI da lista oficial conferem.`;
}

function montarHistoria(payload) {
  const { ancora, totais, itens, validacao } = payload;
  const ps = [];

  ps.push(fraseSituacao(totais, itens));
  ps.push(fraseAncora(ancora));

  const chk = fraseChecklist(validacao);
  if (chk) ps.push(chk);

  return ps;
}

function resumoModulosParaPayload(itens) {
  const c = contarPorCampo(itens.filter(i => i.nome_modulo), 'nome_modulo');
  return topN(c, 5);
}

module.exports = { montarHistoria, resumoModulosParaPayload };
