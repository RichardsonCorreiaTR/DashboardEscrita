/**
 * agregar.js - Agrega dados por ano e calcula indicadores de produtividade
 */

const { round1, horas } = require('./estilos');

const ANOS = [
  { ano: 2024, versoes: ['10.4A-01', '10.4A-02', '10.4A-03'] },
  { ano: 2025, versoes: ['10.5A-01', '10.5A-02', '10.5A-03'] },
  { ano: 2026, versoes: ['10.6A-01', '10.6A-02', '10.6A-03'] }
];

function somarAno(dados, versoes, campo) {
  return versoes.reduce((s, v) => s + (dados[v].entradas[campo] || 0), 0);
}

function pessoasDistintasTri(dados, versoes, nomes) {
  const pessoas = new Set();
  for (const v of versoes) {
    for (const id of dados[v].efetivos) pessoas.add(id);
  }
  return { ids: [...pessoas], qtd: pessoas.size, nomes: [...pessoas].map(id => nomes[id] || id) };
}

function mediaEfetivos(dados, versoes) {
  const soma = versoes.reduce((s, v) => s + dados[v].qtd_efetivos, 0);
  return round1(soma / versoes.length);
}

function agregarPorAno(coleta) {
  const { dados, nomes } = coleta;
  return ANOS.map(({ ano, versoes }) => {
    const entradas = somarAno(dados, versoes, 'total');
    const comSai = somarAno(dados, versoes, 'com_sai');
    const semSai = somarAno(dados, versoes, 'sem_sai');

    let descExcl26 = 0, reprovadas = 0, descartados = 0;
    let minAnalise = 0, minDefinicao = 0, minTotal = 0;
    let psaisComTempo = 0;

    for (const v of versoes) {
      const d = dados[v].descartes;
      descExcl26 += d.total_excl26;
      reprovadas += d.reprovada;
      descartados += d.descartado;

      const t = dados[v].tempos;
      minAnalise += t.min_analise;
      minDefinicao += t.min_definicao;
      minTotal += t.min_total;
      psaisComTempo += t.com_tempo;
    }

    const distintas = pessoasDistintasTri(dados, versoes, nomes);
    const mediaEf = mediaEfetivos(dados, versoes);

    return {
      ano, versoes, entradas, comSai, semSai,
      taxaConversao: round1((comSai / entradas) * 100),
      descExcl26, reprovadas, descartados,
      minAnalise, minDefinicao, minTotal,
      horasTotal: horas(minTotal),
      psaisComTempo,
      tempoMedioPsai: round1(horas(minTotal) / psaisComTempo),
      mediaEfetivos: mediaEf,
      pessoasTrimestre: distintas,
      nesPorPessoa: round1(entradas / mediaEf),
      horasPorPessoa: round1(horas(minTotal) / mediaEf),
      saisPorPessoa: round1(comSai / mediaEf)
    };
  });
}

function calcularVariacoes(agregados) {
  const a24 = agregados[0];
  const a26 = agregados[2];

  const varPessoas = round1(((a26.mediaEfetivos - a24.mediaEfetivos) / a24.mediaEfetivos) * 100);
  const varNEsPessoa = round1(((a26.nesPorPessoa - a24.nesPorPessoa) / a24.nesPorPessoa) * 100);
  const varHorasPessoa = round1(((a26.horasPorPessoa - a24.horasPorPessoa) / a24.horasPorPessoa) * 100);
  const varSaiPessoa = round1(((a26.saisPorPessoa - a24.saisPorPessoa) / a24.saisPorPessoa) * 100);
  const varTaxaConv = round1(a26.taxaConversao - a24.taxaConversao);

  return {
    varPessoas, varNEsPessoa, varHorasPessoa, varSaiPessoa, varTaxaConv,
    indiceProdutividade: round1((varHorasPessoa + varNEsPessoa + varSaiPessoa) / 3)
  };
}

module.exports = { ANOS, agregarPorAno, calcularVariacoes };
