# Diagnostico UX: por que o v2 nao ficou igual a referencia

> Data: 2026-04-06
> Screenshots: `output/ux-referencia-product-engineering/ref-sprint-health.png` vs `v2-estudos-atual.png`

## O erro fundamental

Fizemos um **skin change**, nao um **redesign**.

Copiamos os 21 arquivos JS do v1 como estao. Esses JS **geram o HTML** — ou seja, a
estrutura, a densidade, o layout. Depois adicionamos uma "camada de compatibilidade CSS"
que mapeia variaveis de cor do v1 para tokens v2. Resultado: **cores novas, design velho**.

Trocar `--cor-primaria` por `--v2-primario` nao muda a quantidade de caixas na tela.

## O que a referencia faz e nos nao fazemos

### 1. Ar — o espaco e o design

| Referencia PE | Nosso v2 |
|---|---|
| Cards com `padding: 32px+`, margens de `24-32px` entre secoes | Cards com `padding: 16px`, gap de `12-16px` entre tudo |
| UMA barra de progresso ocupa a largura inteira | 4-5 KPI boxes empilhados em grid apertado |
| Fundo cinza claro (#f5f5f5) respira | Tudo branco com sombra empilha visualmente |

**Diagnostico**: Nossos JS geram grids de KPI com `minmax(160px, 1fr)` — cabe tudo mas
nao respira nada. Na referencia, os numeros sao **poucos e grandes**.

### 2. Hierarquia — um numero hero por secao

| Referencia PE | Nosso v2 |
|---|---|
| "249h x 207h = 83%" — 3 numeros contam a historia | 5-6 KPIs com labels uppercase, numeros grandes, subtextos, badges, bordas coloridas |
| Cor so aparece onde tem significado (vermelho = atencao) | Borda-esquerda colorida + background colorido + valor colorido em cada KPI |

**Diagnostico**: O v1 `app-estudos.js` gera `innerHTML` com `<div class="estudo-kpi">` em
loop para cada metrica. Na referencia, cada secao tem UM conceito central.

### 3. Navegacao — largura vs leveza

| Referencia PE | Nosso v2 |
|---|---|
| Barra horizontal no topo, 48px de altura | Sidebar fixa 240px de largura |
| Conteudo usa 100% da tela | Conteudo comeca em 240px, perde 25% da area |

**Diagnostico**: A sidebar com 7 submenus causa 2 problemas:
1. Rouba espaco horizontal do dashboard.
2. Cria ruido visual (lista longa de links ao lado dos dados).

### 4. Cards — flat vs pesado

| Referencia PE | Nosso v2 |
|---|---|
| `border: 1px solid #e5e5e5`, `border-radius: 12px`, **sem sombra** | `box-shadow` em TUDO: KPI, grafico, tabela, card |
| Borda so aparece para separar | `::before` com 4px colorido no topo + borda-bottom colorida + sombra |

**Diagnostico**: Box-shadow em todo componente cria peso visual. Na referencia,
os cards sao quase "flutuantes" sem esforco.

### 5. Microcopy — narrativa vs dado bruto

| Referencia PE | Nosso v2 |
|---|---|
| "31.1h /dia util (8 dias)  Meta ate hoje: 217.7h" — frase legivel | Labels como "PROJECAO CONSERVADORA" + valor 96 + subtexto tecnico |
| Badges inline: "Melhoria 7/18 106.8h" | Grid de caixas separadas |

**Diagnostico**: Nosso JS gera dados corretos mas apresenta como formulario de banco,
nao como narrativa para humanos.

### 6. Cor — economia vs saturacao

| Referencia PE | Nosso v2 |
|---|---|
| Laranja TR so no logo e destaque ativo | Vermelho + verde + amarelo + azul por toda tela |
| Fundo neutro, texto preto, cor = significado | Background colorido + borda colorida + texto colorido = tripla camada |

## O que precisa mudar (de verdade)

### A. Parar de copiar JS — o JS E o layout

Os v1 JS fazem `innerHTML += '<div class="estudo-kpi">...'`. Nao importa o CSS que
colocamos em cima: a ESTRUTURA HTML e densa porque o JS foi feito assim.

Para cada pagina, precisamos de um **novo modulo de renderizacao** que:
- Recebe os mesmos dados da API (backend compartilhado 100%)
- Gera HTML com a hierarquia certa (1 hero number, narrativa, disclosure)
- Usa os design tokens v2 direto (sem layer de compatibilidade)

### B. Trocar sidebar por top-nav

Uma barra horizontal no topo de 48-56px:
- Libera 240px de largura para o conteudo
- Alinha visualmente com a referencia
- Submenus viram dropdowns on-hover

### C. Redesenhar cada secao com a regra "1 conceito = 1 card"

Em vez de grid de 5 KPIs, cada card mostra:
- UM numero grande (hero)
- UMA frase de contexto
- Detalhes expandiveis (progressive disclosure)

### D. Limpar o CSS

- Remover `box-shadow` de tudo exceto cards hover
- Remover `::before` decorativos
- Border 1px sutil, border-radius 12px
- Gaps de 24-32px entre secoes
- Padding 24-32px dentro de cards

### E. Paleta minimalista

- Fundo: `#f8f9fa` (cinza quase branco)
- Cards: `#ffffff` com borda `#e5e7eb`
- Texto: `#111827` (quase preto)
- Texto sec: `#6b7280`
- Accent: laranja TR `#e05929` (so para ativo/destaque)
- Status: verde/amarelo/vermelho **somente em badges compactos**, nao em backgrounds inteiros

## Esforco estimado

| Item | Impacto visual | Esforco |
|---|---|---|
| Top-nav horizontal | Alto | ~2h (1 arquivo) |
| Novo CSS "light" | Alto | ~3h (1 arquivo) |
| Rewrite `app-estudos-v2.js` (render) | Muito alto | ~6-8h (pagina mais complexa) |
| Rewrite `app-equipes-v2.js` (render) | Alto | ~3h |
| Rewrite `app-laboratorio-v2.js` | Alto | ~3h |
| Rewrite `app-diretrizes-v2.js` (ja existe, ajustar) | Medio | ~2h |
| Rewrite `app-proposta-metas-v2.js` | Medio | ~2h |
| Rewrite `app-descartes-tempo-v2.js` | Medio | ~2h |
| **Total** | | **~20-25h** |

## Decisao

Duas opcoes:

1. **Rewrite completo** — refaz o rendering de cada pagina com design novo.
   Mais trabalho, resultado igual ao site.

2. **80/20** — comecar por top-nav + CSS light + rewrite de UMA pagina (estudos ou
   diretrizes) como prova de conceito. Se aprovar, continuar nas demais.

**Recomendacao**: opcao 2. Comecar por `estudos.html` (mais visivel, mais densa).

## POC — Prova de conceito (2026-04-06)

A POC foi implementada na view `semanal-versao` de `estudos.html`.
Screenshot: `output/ux-referencia-product-engineering/poc-estudos-novo.png`

### Arquivos criados

| Arquivo | O que faz |
|---------|-----------|
| `public-v2/css/app-v2.css` | Design system completo (reescrito do zero) |
| `public-v2/js/nav-v2.js` | Top-nav horizontal com dropdowns |
| `public-v2/js/estudos-semanal-v2.js` | Rendering novo da view semanal |
| `public-v2/estudos.html` | Shell HTML limpo |

### O que mudou visualmente

- **Top-nav horizontal** (52px) em vez de sidebar (240px)
- **Hero stat "27 entradas NE"** com barra de progresso
- **Projecao** como numero complementar alinhado a direita
- **Inline metrics** em linha (media/dia, descartes, vs historico)
- **Narrativa** com frase legivel interpretando os dados
- **ISV score ring** colorido (numero dentro de circulo)
- **Factor bars** horizontais em grid de 4
- **Expandable** para diagnostico detalhado
- **Charts** em containers flat (borda, sem sombra)
- **Tabela** limpa com estilos minimos

### Validacao

- Top-nav funcional com dropdowns
- Dados carregam da API real (mesma porta 5000)
- Graficos Chart.js renderizam
- Narrativa gera texto dinamico baseado nos dados
