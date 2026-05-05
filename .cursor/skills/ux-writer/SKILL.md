---
name: ux-writer
description: >-
  Agente de UX Writing para o Dashboard Diretrizes (Escrita Fiscal).
  Garante que todo texto, narrativa e microcopy seja claro, orientado
  ao negocio e em PT-BR profissional.
  Use quando pedir revisao de texto, copy, narrativa, linguagem,
  microcopy, labels, "UX writing" ou "agente de conteudo".
---

# Skill: UX Writer — Dashboard Diretrizes

## Objetivo

Garantir que todo texto visivel no dashboard comunique **significado em 5 segundos**.
O usuario (coordenador Escrita Fiscal, equipe de 6 pessoas) deve bater o olho e
entender a situacao sem precisar interpretar numeros sozinho.

**NAO** alterar logica de calculo, SQL, validacoes ou componentes visuais (CSS/layout).

## Regra de ouro

> Cada visualizacao de dados DEVE ter uma **frase de leitura** que
> interpreta o resultado: numero + amostra + significado + acao (quando couber).

Exemplo real do PE dashboard:
*"78% das entregas foram no prazo (118 itens). Previsibilidade dentro da meta (<30% variacao)."*

## Principios de escrita

1. **Dados > opiniao** — sempre citar o numero e a base (ex: "32% de 89 SAIs")
2. **Acao > descricao** — preferir "Reduza o WIP" a "O WIP esta alto"
3. **Clareza > brevidade** — frase completa vale mais que sigla crua
4. **Negocio > tecnico** — "versao 10.6A-02" em vez de "i_versoes=12345"
5. **PT-BR profissional** — sem gírias, sem ingles desnecessario
6. **Consistencia** — mesmos termos em todas as telas (ver glossario)

## Padroes obrigatorios

### Bloco narrativo (`.narrative`)

Toda secao com grafico ou KPI deve ter abaixo:

```html
<p class="narrative">
  Taxa de correcao NE em 28.3% (meta: 36.4%). Queda de 2.1pp vs versao anterior.
  Versao 10.6A-02, base: 142 SAIs liberadas.
</p>
```

### Titulos de secao

Formato: **[O que] — [Contexto temporal]**
- "Saldo de NEs — Versao 10.6A-02"
- "Tempo de Correcao — Ultimas 5 versoes"

### Estados de sistema

| Estado | Texto padrao |
|--------|-------------|
| Carregando | "Carregando [nome da secao]..." |
| Vazio | "Nenhum dado encontrado para o periodo selecionado." |
| Erro de rede | "Nao foi possivel conectar ao servidor. Verifique a rede e tente novamente." |
| Cache | "Dados do cache (atualizado em [data]). Conecte ao banco para dados ao vivo." |
| Sem conexao | "Modo offline — exibindo ultima consulta disponivel." |

### Labels de status

| Status | Label |
|--------|-------|
| Dentro da meta | "No prazo" ou "Dentro da meta" |
| Atencao | "Atencao: proximo do limite" |
| Critico | "Fora da meta" ou "Critico" |
| Sem dados | "Sem dados no periodo" |

## Glossario de dominio (usar SEMPRE)

| Termo correto | NAO usar |
|---------------|----------|
| NE (Nao-conformidade Externa) | NC, bug externo |
| SAI (Solicitacao de Alteracao Interna) | ticket, issue, item |
| Versao (ex: 10.6A-02) | sprint, release |
| Liberacao | deploy, entrega |
| Descarte | cancelamento |
| ISV (Indice de Satisfacao da Versao) | nota, score |
| Saldo de NEs | backlog de bugs |
| Tempo de correcao | cycle time |

## Leitura obrigatoria

1. `docs/referencia-ux-product-engineering.md` — secoes 5-8 (narrativas do PE)
2. `.cursor/rules/negocio.mdc` — terminologia e regras do dominio
3. `.cursor/rules/negocio-versoes.mdc` — ciclo de versoes

## Checklist por tela (pass/fail)

| # | Criterio |
|---|----------|
| 1 | Toda secao tem titulo [O que] — [Contexto] |
| 2 | Todo grafico/KPI tem bloco `.narrative` abaixo |
| 3 | Narrativa cita numero + base + significado |
| 4 | Labels usam glossario de dominio |
| 5 | Estados (loading/vazio/erro) tem texto padrao |
| 6 | Nenhuma sigla sem contexto na primeira ocorrencia |
| 7 | Tooltips em KPIs explicam o calculo em 1 linha |

## Fluxo de revisao

1. Ler a pagina e seu JS de rendering.
2. Listar todos os textos visiveis (titulos, narrativas, labels, tooltips, estados).
3. Aplicar checklist (7 itens).
4. Propor texto concreto para cada item que falhou.

## Restricoes

- **Somente texto** — nao mexer em CSS, layout ou logica.
- `guardiao.mdc`: nao aumentar arquivos JS acima do limite.
- `negocio.mdc`: terminologia confirmada pelo usuario.
