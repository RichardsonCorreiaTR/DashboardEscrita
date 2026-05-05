/**
 * validator.js - Validacao obrigatoria de dados de indicadores
 *
 * Responsabilidade unica: garantir que NUNCA um relatorio seja gerado
 * com dados zerados, nulos ou inconsistentes sem explicacao.
 *
 * Toda vez que um indicador for calculado, o resultado DEVE passar
 * por esta validacao antes de ser usado em relatorios ou historico.
 */

/**
 * Valida o resultado de um indicador calculado
 * @param {string} indicadorId - ID do indicador
 * @param {Object} resultado - Resultado do calcular()
 * @returns {{ok: boolean, problemas: string[], avisos: string[]}}
 */
function validarResultado(indicadorId, resultado) {
  const problemas = [];
  const avisos = [];

  if (!resultado) {
    problemas.push(`[${indicadorId}] Resultado nulo ou undefined`);
    return { ok: false, problemas, avisos };
  }

  // Verificar campos obrigatorios
  if (resultado.valor === undefined) {
    problemas.push(`[${indicadorId}] Campo 'valor' ausente`);
  }
  if (resultado.status === undefined) {
    problemas.push(`[${indicadorId}] Campo 'status' ausente`);
  }
  if (!resultado.validacao) {
    problemas.push(`[${indicadorId}] Campo 'validacao' ausente`);
  }

  // Verificar valor zero suspeito
  if (resultado.valor === 0 && resultado.status !== 'erro') {
    avisos.push(`[${indicadorId}] Valor e ZERO - verificar se e real ou falha na query`);
  }

  // Verificar valor null sem status de erro
  if (resultado.valor === null && resultado.status !== 'erro') {
    problemas.push(`[${indicadorId}] Valor null mas status nao e 'erro'`);
  }

  // Verificar validacao interna
  if (resultado.validacao) {
    if (resultado.validacao.ok === false) {
      problemas.push(
        `[${indicadorId}] Validacao interna falhou: ` +
        (resultado.validacao.problemas || []).join('; ')
      );
    }
    if (resultado.validacao.registros_lidos === 0 && resultado.status !== 'erro') {
      problemas.push(`[${indicadorId}] Zero registros lidos mas status nao e 'erro'`);
    }
  }

  // Verificar status valido
  const statusValidos = ['verde', 'amarelo', 'vermelho', 'erro', 'info'];
  if (resultado.status && !statusValidos.includes(resultado.status)) {
    problemas.push(`[${indicadorId}] Status invalido: '${resultado.status}'`);
  }

  return {
    ok: problemas.length === 0,
    problemas,
    avisos
  };
}

/**
 * Valida um lote de resultados de indicadores
 * @param {Object[]} resultados - Array de {id, resultado}
 * @returns {{ok: boolean, resumo: string, detalhes: Object[]}}
 */
function validarLote(resultados) {
  const detalhes = resultados.map(({ id, resultado }) => ({
    id,
    ...validarResultado(id, resultado)
  }));

  const comProblema = detalhes.filter(d => !d.ok);
  const comAviso = detalhes.filter(d => d.avisos.length > 0);

  const ok = comProblema.length === 0;
  const resumo = ok
    ? `${detalhes.length} indicador(es) validado(s) com sucesso` +
      (comAviso.length > 0 ? ` (${comAviso.length} com avisos)` : '')
    : `${comProblema.length} de ${detalhes.length} indicador(es) com problemas`;

  return { ok, resumo, detalhes };
}

/**
 * Gera mensagem de erro formatada para exibicao no relatorio
 * @param {Object} validacao - Resultado da validacao
 * @returns {string} Mensagem HTML-safe para banner de erro
 */
function mensagemErro(validacao) {
  if (validacao.ok) return '';

  const linhas = validacao.problemas.map(p => `- ${p}`);
  return [
    'ATENCAO: Dados com problemas de validacao',
    '',
    ...linhas,
    '',
    'Verifique a conexao com o banco e os filtros das queries.'
  ].join('\n');
}

module.exports = { validarResultado, validarLote, mensagemErro };
