/**
 * atividades-classifier.js - Classificacao de atividades para metas da equipe
 *
 * Todos os padroes usam apenas ASCII para compatibilidade com
 * encoding Latin-1 do banco (CAST AS BINARY via ODBC).
 *
 * Ordem de precedencia (OBRIGATORIO seguir esta ordem nos chamadores):
 *   1. isOutrasAtividades → "Outras" tem prioridade maxima (inclui afastamento, particular)
 *   2. isAusencia          → exclui do calculo (feriado, ferias, folga aniversario)
 *   3. isTrabalhoSai       → conta no numerador de tempo SAI/PSAI
 *   4. residual            → "Outras" implicitas (nao entram no numerador)
 */

function isAusencia(nome) {
  const n = nome.toLowerCase();
  // Apenas ausencias que reduzem o tempo efetivo: feriados, ferias e folgas aprovadas
  // Saida Particular, Afastamento e Folga banco de horas sao tratados em isOutrasAtividades
  // 'rias' com length curto: captura 'ferias' (6-8 chars) mas nao 'melhorias' em nomes longos
  return n.includes('feriado') || (n.includes('rias') && n.length < 12) ||
    (n.includes('folga') && !n.includes('banco de horas'));
}

function isGerandoSai(nome) {
  return nome.toLowerCase().includes('gerando sai');
}

function isTrabalhoSai(nome) {
  const n = nome.toLowerCase();
  return (
    n.includes('ne') || n.includes('sai') || n.includes('ss') || n.includes('vida') ||
    n.includes('sal') || n.includes('sam') || n.includes('validando') ||
    n.includes('performance') || n.includes('esclarecimento') || n.includes('reuni') ||
    n.includes('treinamento') || n.includes('backlog') || n.includes('checando') ||
    n.includes('avaliando') || n.includes('desenvolvendo') || n.includes('incluindo') ||
    n.includes('lendo') || n.includes('controle dos') || n.includes('informativo') ||
    n.includes('e-mail da') || n.includes('gp - testes')
  );
}

// Padroes simples que sempre classificam como "Outras Atividades"
const OUTRAS_SIMPLES = [
  '**', 'interrompida', 'pessoal', 'lanche', 'manuten', 'feedback', 'formata',
  'recepcionar', 'retrospectiva', 'legisla', 'my time', 'mytime',
  'atendimento a unidade', '1:1', 'checkin', 'workshop', 'town hall',
  'particular', 'afastamento', 'banco de horas'
];

function isOutrasAtividades(nome) {
  const n = nome.toLowerCase();
  if (OUTRAS_SIMPLES.some(p => n.includes(p))) return true;
  // Treinamento RECEBIDO (vs fornecido/realizando que conta como trabalho)
  if (n.includes('treinamento') && (n.includes('receb') || n.includes('participando'))) return true;
  // Esclarecimento para SUPORTE ou RH (vs para Desenvolvimento/Testes/GP-SAI)
  if (n.includes('esclarecimento') && (n.includes('suporte') || n.includes('rh'))) return true;
  // Reuniao generica sem contexto SAI/PSAI (nome curto, ex: "Reuniao" sozinho)
  if (n.includes('reuni') && n.length <= 12) return true;
  // Reuniao de contexto pessoal/RH
  return n.includes('reuni') && (n.includes('rh') || n.includes('apresenta'));
}

// Atividades PRINCIPAIS para analistas (Jr/Pleno/Senior) - meta 70%
function isPrincipalAnalista(nome) {
  const n = nome.toLowerCase();
  const temTipo = n.includes('sal') || n.includes('sail') || n.includes('sam') ||
    n.includes('ne') || n.includes('importa') || n.includes('testando');
  if (n.includes('analisando') && temTipo) return true;
  if (n.includes('definindo')) return true;
  if (n.includes('sai') && n.includes('revis') && !n.includes('especialista')) return true;
  if (n.includes('sai') && (n.includes('defin') || n.includes('testes'))) return true;
  if (n.includes('sai - an') && !n.includes('reuni')) return true; // SAI - Analise (335)
  if (n.includes('reuni') && (n.includes('defin') || n.includes('psai'))) return true;
  return n.includes('ss'); // Respondendo SS
}

// Atividades PRINCIPAIS para especialistas - meta 50%
function isPrincipalEspecialista(nome) {
  const n = nome.toLowerCase();
  return n.includes('gerando') && n.includes('sai');
}

// Combinado para uso no frontend (detalhe) sem saber o cargo
function isPrincipalQualquer(nome) {
  return isPrincipalAnalista(nome) || isPrincipalEspecialista(nome);
}

module.exports = {
  isAusencia, isGerandoSai, isTrabalhoSai, isOutrasAtividades,
  isPrincipalAnalista, isPrincipalEspecialista, isPrincipalQualquer
};
