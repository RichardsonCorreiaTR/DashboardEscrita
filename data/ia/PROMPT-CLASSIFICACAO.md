# Prompt para Classificacao IA de SAIs

## Como usar

1. Rode: `node scripts/preparar-lote-ia.js {VERSAO}` (ex: `10.6A-01`)
2. Abra uma NOVA sessao do Cursor (Ctrl+L)
3. Cole o prompt gerado no Painel IA (ou o modelo abaixo)
4. Aguarde a classificacao (~10-20 min, a IA le cada arquivo .md completo)
5. Apos o agente salvar, rode: `node scripts/importar-classificacao-ia.js {VERSAO}`

---ece

## Prompt para colar no Cursor

```
Preciso que voce classifique um lote de SAIs (Solicitacoes de Alteracao de Implementacao)
do produto Folha de Pagamento (Betha/Thomson Reuters).

ARQUIVO DE ENTRADA:
  data/ia/lote-entrada-{VERSAO}.json

INSTRUCOES:

1. Leia o arquivo de entrada acima.
2. Para CADA item do array "itens", LEIA O ARQUIVO MARKDOWN COMPLETO
   indicado no campo "arquivo_md". Esse arquivo contem a especificacao
   completa da SAI: descricao, comportamento esperado, definicao tecnica,
   tags, referencias cruzadas, etc. E FUNDAMENTAL que voce leia e analise
   o conteudo INTEIRO do .md para classificar corretamente.
3. Com base na analise completa, gere a classificacao conforme schema abaixo.
4. Salve o resultado em: data/ia/lote-classificacao-{VERSAO}.json

SCHEMA DE CLASSIFICACAO (para cada item):

{
  "i_psai": (copiar do item de entrada),
  "tipo_causa_raiz": "logica | edge_case | regressao | performance | integracao | legislacao | dados | configuracao | ambiente | null",
  "area_tecnica": "motor_calculo | interface_web | relatorio | importacao_exportacao | api_esocial | banco_dados | integracao_contabil | autenticacao | processamento_lote | parametrizacao",
  "modulos_afetados": ["lista", "dos", "modulos/rotinas", "que", "a", "SAI", "altera"],
  "complexidade_real": "trivial | baixa | media | alta | sistemica",
  "risco_regressao": "baixo | medio | alto | critico",
  "escopo_impacto": "pontual | modulo | transversal",
  "padrao_recorrencia": "novo | variacao_existente | regressao_correcao_anterior",
  "confianca": 1-5,
  "resumo_tecnico": "resumo de 1-3 frases do que a SAI altera tecnicamente",
  "pontos_criticos": ["lista de pontos de atencao/risco identificados na analise"],
  "observacao": "insight relevante sobre risco, padrao ou impacto"
}

CRITERIOS DE CLASSIFICACAO:

1. tipo_causa_raiz - Qual a causa tecnica do problema?
   - logica: erro na regra de calculo ou processamento
   - edge_case: cenario nao previsto (valores limites, combinacoes raras)
   - regressao: funcionava antes, quebrou apos outra mudanca
   - performance: lentidao, timeout, consumo excessivo
   - integracao: falha na comunicacao entre modulos/sistemas
   - legislacao: mudanca legal nao implementada ou implementada errada
   - dados: corrupcao, inconsistencia ou migracoes de dados
   - configuracao: parametro incorreto ou faltante
   - ambiente: problema especifico de infraestrutura
   - null: para SAMs/SALs/SAILs que nao sao erros (sao melhorias/legislacao)

2. area_tecnica - Qual subsistema principal?
   - motor_calculo: calculos de folha (salario, ferias, rescisao, 13o, encargos, INSS, IRRF)
   - interface_web: telas, campos, validacoes de input, UX
   - relatorio: geracao de relatorios, PDFs, demonstrativos
   - importacao_exportacao: SEFIP, CAGED, RAIS, DIRF, DCTFWeb, GPS, arquivos
   - api_esocial: eventos S-xxxx, protocolos, retornos, XML
   - banco_dados: schema, FK, constraints, migracoes, atualizacao de banco
   - integracao_contabil: Dominio Contabil, lancamentos, conciliacao
   - autenticacao: login, permissoes, certificado digital
   - processamento_lote: rotinas automaticas, processamento em massa, agente
   - parametrizacao: cadastros, configuracoes, convencoes coletivas

3. modulos_afetados - Quais modulos/rotinas a SAI altera?
   Extraia do arquivo .md: telas, processos, relatorios, eventos eSocial,
   rotinas de calculo mencionados. Ex: ["Calculo Ferias", "SEFIP", "S-1200", "Provisao"]

4. complexidade_real - Qual a dificuldade REAL baseada no .md completo?
   - trivial: ajuste pontual em 1 campo/validacao
   - baixa: alteracao em 1 rotina clara
   - media: alteracao em 2-3 rotinas relacionadas
   - alta: alteracao em modulo inteiro ou logica complexa com muitas regras
   - sistemica: afeta multiplos modulos, altera arquitetura ou fluxo core

5. risco_regressao - Probabilidade de causar efeito colateral?
   - baixo: mudanca isolada, sem dependencias
   - medio: compartilha funcoes com outras rotinas
   - alto: altera calculo base usado por varias rotinas (ex: INSS, IRRF base)
   - critico: altera estrutura (tabelas, APIs, fluxo de calculo principal)

6. escopo_impacto - Quantas funcionalidades sao afetadas?
   - pontual: 1 tela/rotina
   - modulo: varias telas/rotinas do mesmo modulo
   - transversal: afeta multiplos modulos (ex: ferias + rescisao + 13o)

7. padrao_recorrencia
   - novo: sem indicios de problemas anteriores similares
   - variacao_existente: variante de algo ja tratado (pista: referencia outra SAI)
   - regressao_correcao_anterior: correcao anterior reintroduziu problema

8. confianca (1-5) - Quao segura e a classificacao?
   1=.md vago/incompleto, 3=razoavel, 5=.md muito detalhado e claro

9. resumo_tecnico - Resumo de 1-3 frases do que a SAI faz tecnicamente.
   Precisa ser conciso mas capturar a essencia.

10. pontos_criticos - Lista dos pontos de atencao/risco que voce identificou
    ao ler o .md completo. Ex: "Altera formula base do IRRF que impacta todos
    os tipos de calculo", "Modifica estrutura do banco sem migracao explicita".

REGRAS IMPORTANTES:
- LEIA O ARQUIVO .md INTEIRO de cada SAI antes de classificar. Nao se baseie
  apenas na descricao curta ou nas tags. O .md tem a especificacao completa.
- Para NEs: foque no PROBLEMA (tipo_causa_raiz, padrao_recorrencia, pontos_criticos)
- Para SAMs/SALs/SAILs: tipo_causa_raiz=null, foque no IMPACTO
  (complexidade_real, risco_regressao, modulos_afetados, pontos_criticos)
- Se houver referencia a outra SAI, considere padrao_recorrencia="variacao_existente"
- Seja criterioso com risco_regressao: SAIs que alteram motor de calculo,
  encargos (INSS/IRRF/FGTS) ou eventos eSocial tendem a risco alto/critico.

FORMATO DE SAIDA (salvar em data/ia/lote-classificacao-{VERSAO}.json):

{
  "versao": "{VERSAO}",
  "classificado_em": "(data atual ISO)",
  "modelo_ia": "cursor-agent",
  "total_itens": N,
  "itens": [ ... array de classificacoes ... ]
}
```

---

## Notas

- A IA lera cada arquivo .md completo (~1-99 KB por SAI). Lotes devem ter 5-15 itens.
- O script `preparar-lote-ia.js` ja classifica automaticamente SAIs simples via regras;
  so as que precisam de analise detalhada vao no lote.
- Apos importar, os dados ficam em `data/ia/contexto-consolidado.json`
- Para versoes com muitas SAIs pendentes, rode o script e siga as instrucoes do Painel IA.
