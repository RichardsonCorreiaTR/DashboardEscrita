/**
 * laboratorio/regras-auto.js - Regras deterministicas (Camada 1)
 *
 * Classifica SAIs automaticamente quando tags + metadados
 * sao suficientes. Retorna null nos campos que precisa de IA.
 */

const TAGS_ESOCIAL = [
  'S-1200', 'S-1210', 'S-1260', 'S-1270', 'S-1280', 'S-1299',
  'S-2190', 'S-2200', 'S-2205', 'S-2206', 'S-2210', 'S-2220',
  'S-2230', 'S-2240', 'S-2250', 'S-2298', 'S-2299', 'S-2300',
  'S-2306', 'S-2399', 'S-2400', 'S-2500', 'S-3000',
  'S-5001', 'S-5002', 'S-5003', 'S-5011', 'S-5012',
  'S-1000', 'FGTS Digital'
];

const TAGS_EXPORTACAO = [
  'SEFIP', 'CAGED', 'RAIS', 'DIRF', 'DCTFWeb', 'GPS', 'DARF',
  'Informe de Rendimentos', 'CTPS Digital', 'FAP', 'Certidão Negativa'
];

const TAGS_CALCULO = [
  'Cálculo', 'Décimo Terceiro', 'Adiantamento', 'PLR',
  'Provisão', 'Horas Extras', 'Adicional Noturno',
  'Insalubridade', 'Periculosidade', 'Banco de Horas'
];

function inferirAreaTecnica(tags) {
  if (!tags || tags.length === 0) return null;
  if (tags.some(t => TAGS_ESOCIAL.includes(t))) return 'api_esocial';
  if (tags.includes('Integração') || tags.includes('Domínio Contábil')
    || tags.includes('Contabilização')) return 'integracao_contabil';
  if (tags.some(t => TAGS_EXPORTACAO.includes(t))
    && !tags.includes('Cálculo')) return 'importacao_exportacao';
  if (tags.includes('Agente') || tags.includes('Rotinas Automáticas')
    || tags.includes('Ponto Eletrônico')) return 'processamento_lote';
  if (tags.includes('Certificado Digital')) return 'autenticacao';
  if (tags.includes('Relatórios') && !tags.includes('Cálculo')) return 'relatorio';
  if (tags.some(t => TAGS_CALCULO.includes(t))) return 'motor_calculo';
  if (tags.includes('Parâmetros') || tags.includes('Admissão')
    || tags.includes('Convenção Coletiva')
    || tags.includes('Tabelas')) return 'parametrizacao';
  if (tags.includes('Holerite') || tags.includes('Vale Transporte')
    || tags.includes('Vale Refeição')) return 'interface_web';
  return null;
}

function inferirRiscoRegressao(nivelAlteracao) {
  if (nivelAlteracao === 3 || nivelAlteracao === '3') return 'alto';
  if (nivelAlteracao === 2 || nivelAlteracao === '2') return 'medio';
  if (nivelAlteracao === 1 || nivelAlteracao === '1') return 'baixo';
  return null;
}

function inferirComplexidade(tempoPrevisto) {
  if (!tempoPrevisto || tempoPrevisto <= 0) return null;
  if (tempoPrevisto < 60) return 'trivial';
  if (tempoPrevisto <= 500) return 'baixa';
  if (tempoPrevisto <= 2000) return 'media';
  return null;
}

function inferirRecorrencia(refsCruzadas) {
  if (refsCruzadas && refsCruzadas.length > 0) return 'variacao_existente';
  return null;
}

function classificarAuto(item, tagsIndex) {
  const tags = tagsIndex || [];
  const area = inferirAreaTecnica(tags);
  const risco = inferirRiscoRegressao(item.nivel_alteracao);
  const complex = inferirComplexidade(item.tempoPrevistoTotal);
  const recorr = inferirRecorrencia(item.refs_cruzadas);

  const campos = { area_tecnica: area, risco_regressao: risco,
    complexidade_real: complex, padrao_recorrencia: recorr };
  const preenchidos = Object.values(campos).filter(v => v !== null).length;
  const confianca = preenchidos >= 3 ? 3 : preenchidos >= 2 ? 2 : 1;
  const completa = preenchidos >= 3;

  return {
    i_psai: item.i_psai,
    tipo_causa_raiz: item.tipoSAI === 'NE' ? null : null,
    area_tecnica: area,
    complexidade_real: complex,
    risco_regressao: risco,
    escopo_impacto: null,
    padrao_recorrencia: recorr,
    confianca,
    observacao: 'Classificacao automatica (Camada 1)',
    _auto: true,
    _completa: completa
  };
}

module.exports = { classificarAuto, inferirAreaTecnica };
