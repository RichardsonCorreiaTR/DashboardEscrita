/**
 * retornos-planilha.js - Agrega retornos (Qtde Tramite) por analista/mes da planilha
 *
 * Formula: indice = SUM(qtdTramite) / COUNT(PSAIs) por tipo (NE | SAL | SAIL+SAM)
 * Fonte: planilha-escrita-2026.xlsm, coluna "Qtde Tramite" (col 12)
 */

const planilha = require('../../core/planilha-escrita');

function novoAcum() {
  return { ne: {}, sal: {}, sailSam: {} };
}

function chaveTipo(tipo) {
  if (tipo === 'NE') return 'ne';
  if (tipo === 'SAL') return 'sal';
  if (tipo === 'SAIL' || tipo === 'SAM') return 'sailSam';
  return null;
}

function acumularSais(acum, mes, sais) {
  const vistos = new Set();
  for (const s of sais) {
    const chave = chaveTipo((s.tipoSAI || '').toUpperCase());
    if (!chave) continue;
    const chaveUnica = (s.i_psai || s.i_sai) + '_' + chave;
    if (vistos.has(chaveUnica)) continue;
    vistos.add(chaveUnica);
    if (!acum[chave][mes]) acum[chave][mes] = { total_psais: 0, total_retornos: 0 };
    acum[chave][mes].total_psais++;
    acum[chave][mes].total_retornos += Number(s.qtdTramite) || 0;
  }
}

async function carregarRetornosAnalista(analista) {
  const mesAtual = new Date().getMonth() + 1;
  const meses = Array.from({ length: mesAtual }, (_, i) => i + 1);
  const acum = novoAcum();
  await Promise.all(meses.map(async mes => {
    try {
      const sais = await planilha.obterSaisAnalista(mes, analista);
      acumularSais(acum, mes, sais);
    } catch (_) {}
  }));
  return acum;
}

async function carregarRetornosTodos(analistas) {
  const mesAtual = new Date().getMonth() + 1;
  const meses = Array.from({ length: mesAtual }, (_, i) => i + 1);
  const res = {};
  for (const a of analistas) res[a['codigo-sgd']] = novoAcum();
  await Promise.all(
    meses.flatMap(mes =>
      analistas.map(async a => {
        try {
          const sais = await planilha.obterSaisAnalista(mes, a);
          acumularSais(res[a['codigo-sgd']], mes, sais);
        } catch (_) {}
      })
    )
  );
  return res;
}

module.exports = { carregarRetornosAnalista, carregarRetornosTodos };
