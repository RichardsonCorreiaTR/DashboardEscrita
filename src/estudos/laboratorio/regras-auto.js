/**
 * laboratorio/regras-auto.js - Regras deterministicas Camada 1 (Escrita Fiscal)
 *
 * Infere area_tecnica pela descricao (taxonomia Escrita) + risco/complexidade
 * por metadados. Campos incompletos ficam null para a IA.
 */
const { classificarArea } = require('../../core/consultas-ne');

const AREA_MAP = {
  'Obrig. Acessorias': 'obrigacoes_acessorias',
  'Impostos/Tributos': 'impostos_tributos',
  'GPS/INSS': 'gps_inss',
  'DARF/Recolhimento': 'darf_recolhimento',
  'Lancamento': 'lancamento',
  'Calculo/Apuracao': 'calculo_apuracao',
  'Importacao/Integracao': 'importacao_integracao',
  'Relatorios': 'relatorios',
  'Parametrizacao': 'parametrizacao',
  'Infraestrutura/Erro': 'infraestrutura'
};

function inferirAreaTecnica(item, tags) {
  const texto = [item.descricao, item.texto_spec, ...(tags || [])].filter(Boolean).join(' ');
  const area = classificarArea(texto);
  return AREA_MAP[area] || null;
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
  const tags = tagsIndex || item.tags || [];
  const area = inferirAreaTecnica(item, tags);
  const risco = inferirRiscoRegressao(item.nivel_alteracao);
  const complex = inferirComplexidade(item.tempoPrevistoTotal);
  const recorr = inferirRecorrencia(item.refs_cruzadas);

  const campos = {
    area_tecnica: area, risco_regressao: risco,
    complexidade_real: complex, padrao_recorrencia: recorr
  };
  const preenchidos = Object.values(campos).filter(v => v !== null).length;
  const confianca = preenchidos >= 3 ? 3 : preenchidos >= 2 ? 2 : 1;

  return {
    i_psai: item.i_psai,
    tipo_causa_raiz: null,
    area_tecnica: area,
    complexidade_real: complex,
    risco_regressao: risco,
    escopo_impacto: null,
    padrao_recorrencia: recorr,
    confianca,
    observacao: 'Classificacao automatica Escrita (Camada 1)',
    _auto: true,
    _completa: preenchidos >= 3
  };
}

module.exports = { classificarAuto, inferirAreaTecnica, AREA_MAP };
