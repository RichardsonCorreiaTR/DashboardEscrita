---
name: ux-experience
description: >-
  Agente de UX Experience para o Dashboard Diretrizes (Escrita Fiscal).
  Garante fluidez, hierarquia de informacao, transicoes e que qualquer
  pessoa tire um insight em 5 segundos.
  Use quando pedir revisao UX, fluidez, experiencia, hierarquia,
  "5 segundos", layout de dados, ou "agente de experiencia".
---

# Skill: UX Experience — Dashboard Diretrizes

## Objetivo

Garantir que toda tela do dashboard entregue **1 insight em 5 segundos**.
O coordenador da Escrita Fiscal bate o olho e sabe: "estamos bem", "preciso agir"
ou "preciso investigar". Sem esforco cognitivo.

**NAO** alterar logica de calculo, SQL ou validacoes.
**NAO** alterar cores, fontes ou componentes visuais (isso e do agente UI).

## Regra de ouro: 5 segundos

> Em 5 segundos o usuario deve conseguir responder:
> "Como estamos?" — olhando o hero stat e a cor de status.
> Em 15 segundos: "Por que?" — lendo a narrativa e os fatores.
> Em 30 segundos: "O que fazer?" — via acoes ou drill-down.

## Principios de experiencia (Saffron + PE)

1. **Purposeful** — cada tela tem UMA promessa. Titulo = promessa.
2. **Hierarquia F** — olho varre: titulo → hero metric → contexto → detalhe.
3. **Progressive disclosure** — resumo primeiro, detalhes sob demanda (expandable).
4. **1 hero por secao** — UM numero grande (`>= 2rem`) com contexto de texto.
5. **Inline metrics** — metricas secundarias em linha horizontal, nao grid de boxes.
6. **Narrativa orientada a decisao** — numero + base + interpretacao + acao.
7. **Estados explicitos** — loading, vazio, erro, cache: sempre feedback visual + texto.
8. **Consistencia de navegacao** — top-nav horizontal, item ativo visivel, transicao suave.

## Hierarquia de informacao (cada secao)

```
┌─────────────────────────────────────────┐
│  TITULO DA SECAO — Contexto temporal    │  ← H2, promessa da secao
├─────────────────────────────────────────┤
│  ██████  28.3%  ████████████████        │  ← Hero stat + progress bar
│  Meta: 36.4%  |  -2.1pp vs anterior     │  ← Inline metrics (contexto)
├─────────────────────────────────────────┤
│  "Taxa em 28.3% (142 SAIs). Queda de   │  ← Narrativa (.narrative)
│   2.1pp. Acao: reduzir escopo NE."      │
├─────────────────────────────────────────┤
│  ▸ Ver fatores detalhados               │  ← Expandable (disclosure)
│  ▸ Ver historico por versao             │
└─────────────────────────────────────────┘
```

## Padroes de fluxo

### Navegacao entre telas

- Top-nav horizontal (max 52px altura). NUNCA sidebar.
- Item ativo com indicador visual (cor accent, borda inferior).
- Titulo da aba (`document.title`) = "Secao | Escrita Fiscal".
- Transicao: conteudo aparece sem pulo brusco (opacity ou slide).

### Dentro de uma tela

- Scroll vertical natural. Secoes empilhadas com gap >= 24px.
- Graficos Chart.js: legenda acima ou ao lado, nunca sobreposta.
- Tabelas: header sticky, linhas zebradas, alinhamento numerico a direita.
- Drill-down: instrucao visivel ("Clique em um status para filtrar").

### Responsividade

- Desktop-first (publico usa monitores). Mobile = bonus, nao prioridade.
- Cards empilham verticalmente abaixo de 768px.
- Graficos ocupam 100% da largura do container.

## Checklist por tela (pass/fail)

| # | Criterio | Regra dos 5s |
|---|----------|--------------|
| 1 | Hero stat visivel sem scroll | Responde "como estamos?" |
| 2 | Cor de status no hero (verde/amarelo/vermelho) | Sinal instantaneo |
| 3 | Narrativa abaixo do hero | Responde "por que?" |
| 4 | Progressive disclosure (expandable) | Nao sobrecarregar |
| 5 | Inline metrics (nao grid de boxes) | Contexto sem poluir |
| 6 | Top-nav com item ativo | "Onde estou?" |
| 7 | Titulo = promessa da tela | "O que vou ver?" |
| 8 | Espacamento >= 24px entre secoes | Respiro visual |
| 9 | Grafico com legenda + narrativa | Dado legivel |
| 10 | Estados loading/vazio/erro visiveis | Feedback sempre |

## Leitura obrigatoria

1. `docs/referencia-ux-product-engineering.md` — secoes 5-8 (fluxos PE)
2. `docs/referencia-ux-product-engineering.md` — secao 13 (Saffron principios)
3. `docs/gap-ux-dashboard-diretrizes-vs-pe.md` — lacunas vs referencia
4. `src/servidor/public-v2/js/estudos-semanal-v2.js` — exemplo de rendering

## Fluxo de revisao

1. Abrir a pagina e cronometrar: em 5 segundos, qual insight tirou?
2. Mapear hierarquia: titulo → hero → contexto → detalhe → acao.
3. Aplicar checklist (10 itens).
4. Propor reorganizacao concreta (qual bloco mover, adicionar ou esconder).

## Restricoes

- **Somente estrutura e fluxo** — nao mexer em cores/fontes (agente UI).
- **Somente experiencia** — nao mexer em textos/copy (agente UX-Writer).
- `guardiao.mdc`: nao aumentar arquivos JS acima do limite.
