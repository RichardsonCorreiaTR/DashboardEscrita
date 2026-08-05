# Prompt para Classificacao IA de SAIs — Escrita Fiscal

## Como usar

1. Rode: `node scripts/preparar-lote-ia.js {VERSAO}` (ex: `10.6A-06`)
2. Abra uma NOVA sessao do Cursor
3. Cole o prompt abaixo (troque `{VERSAO}`)
4. A IA usa o campo `texto_spec` de cada item (nao precisa de .md externo)
5. Apos salvar o JSON, rode: `node scripts/importar-classificacao-ia.js {VERSAO}`

---

## Prompt para colar no Cursor

```
Preciso que voce classifique um lote de SAIs (Solicitacoes de Alteracao de Implementacao)
do produto Escrita Fiscal / Dominio Escrita (Betha/Thomson Reuters).

ARQUIVO DE ENTRADA:
  data/ia/lote-entrada-{VERSAO}.json

INSTRUCOES:

1. Leia o arquivo de entrada acima.
2. Para CADA item do array "itens", leia o campo "texto_spec" por completo
   (descricao + comportamento + definicao da SAI). Classifique com base nisso.
3. Gere a classificacao conforme o schema abaixo.
4. Salve o resultado em: data/ia/lote-classificacao-{VERSAO}.json

SCHEMA DE CLASSIFICACAO (para cada item):

{
  "i_psai": (copiar do item de entrada),
  "tipo_causa_raiz": "logica | edge_case | regressao | performance | integracao | legislacao | dados | configuracao | ambiente | null",
  "area_tecnica": "obrigacoes_acessorias | impostos_tributos | gps_inss | darf_recolhimento | lancamento | calculo_apuracao | importacao_integracao | relatorios | parametrizacao | infraestrutura | outros",
  "modulos_afetados": ["lista", "de", "modulos/rotinas", "citados"],
  "complexidade_real": "trivial | baixa | media | alta | sistemica",
  "risco_regressao": "baixo | medio | alto | critico",
  "escopo_impacto": "pontual | modulo | transversal",
  "padrao_recorrencia": "novo | variacao_existente | regressao_correcao_anterior",
  "confianca": 1-5,
  "resumo_tecnico": "resumo de 1-3 frases do que a SAI altera tecnicamente",
  "pontos_criticos": ["lista de pontos de atencao/risco"],
  "observacao": "insight relevante sobre risco, padrao ou impacto"
}

CRITERIOS DE CLASSIFICACAO:

1. tipo_causa_raiz — causa tecnica do problema (NEs). Para SAM/SAL/SAIL use null.

2. area_tecnica — subsistema Escrita:
   - obrigacoes_acessorias: SPED, EFD, ECF, DCTF, Reinf, DEFIS, DESTDA, escrituracao digital
   - impostos_tributos: ISS, ICMS, IPI, PIS, COFINS, IRPJ, CSLL, retencoes, bases
   - gps_inss: INSS, GPS, previdenciario no contexto fiscal
   - darf_recolhimento: DARF, DAS, guias de recolhimento
   - lancamento: lancamento/estorno contabil-fiscal, partidas
   - calculo_apuracao: apuracao, competencia, recalculo de valores fiscais
   - importacao_integracao: importacao/exportacao/integracao de dados
   - relatorios: relatorios, listagens, conferencias, demonstrativos
   - parametrizacao: CFOP, CST, natureza operacao, regime tributario, aliquotas
   - infraestrutura: erros de sistema, requisicoes, falhas de plataforma
   - outros: nao encaixa nas categorias acima

3. complexidade_real — dificuldade real pela especificacao:
   trivial / baixa / media / alta / sistemica

4. risco_regressao — efeito colateral:
   baixo / medio / alto / critico
   (apuracao de impostos, SPED e bases compartilhadas tendem a alto/critico)

5. escopo_impacto — pontual | modulo | transversal

6. padrao_recorrencia — novo | variacao_existente (se cita outra SAI) |
   regressao_correcao_anterior

7. confianca 1-5 — quao segura e a classificacao dado o texto_spec

REGRAS:
- Use SOMENTE os valores do enum de area_tecnica acima (nao use api_esocial nem motor_calculo de Folha).
- Para NEs: foque em tipo_causa_raiz e pontos_criticos.
- Para SAM/SAL/SAIL: tipo_causa_raiz=null; foque em impacto e complexidade.
- Se texto_spec estiver vazio/pobre, confianca baixa e area_tecnica="outros" se necessario.

FORMATO DE SAIDA (data/ia/lote-classificacao-{VERSAO}.json):

{
  "versao": "{VERSAO}",
  "classificado_em": "(ISO)",
  "modelo_ia": "cursor-agent",
  "total_itens": N,
  "itens": [ ... ]
}
```

---

## Notas

- Fonte: ODBC Escrita (`preparar-lote-ia.js`), sem BuscaSaiFolha.
- Camada 1 ja classifica itens simples; so pendentes entram no lote-entrada.
- Apos importar: `data/ia/contexto-consolidado.json` alimenta o Laboratorio.
