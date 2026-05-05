---
name: dashboard-diretrizes-ux
description: >-
  [SUPERADO] Este skill foi dividido em 3 agentes especializados:
  ux-writer (textos), ux-experience (fluidez), ui-design (visual).
  Use os novos agentes em vez deste.
  Mantido como referencia historica.
---

# Skill: UX — Dashboard Diretrizes [SUPERADO]

> **Este skill foi dividido em 3 agentes especializados (2026-04-06):**
> - **UX-Writer**: `.cursor/skills/ux-writer/SKILL.md`
> - **UX-Experience**: `.cursor/skills/ux-experience/SKILL.md`
> - **UI-Design**: `.cursor/skills/ui-design/SKILL.md`
>
> A regra orquestradora esta em `.cursor/rules/ux-dashboard.mdc`.

## Objetivo (historico)

Garantir que toda interface do projeto seja **leve, clara e fluida**, seguindo o
design system documentado em `docs/diagnostico-ux-v2-vs-referencia.md` e
`docs/referencia-ux-product-engineering.md`.

**NAO** alterar logica de calculo, SQL ou validacoes.

## Principios fundamentais (memorize)

1. **Ar** — padding 24-32px em cards, gap 24px entre secoes. Nunca apertar.
2. **1 hero por secao** — cada card tem UM numero grande e contexto em texto.
3. **Top-nav horizontal** — nunca sidebar. Conteudo usa 100% da largura.
4. **Cards flat** — borda 1px sutil, SEM box-shadow (exceto hover leve). SEM `::before` decorativo.
5. **Cor = significado** — fundo branco, texto escuro. Cor so em badges compactos para status.
6. **Narrativa legivel** — bloco `.narrative` com frase que interpreta os dados (nao labels tecnicos).
7. **Progressive disclosure** — detalhes em expandable, nao tudo visivel de uma vez.
8. **Rendering proprio** — cada pagina tem seu JS de rendering que gera HTML novo. NAO copiar JS v1.

## Leitura obrigatoria (nesta ordem)

1. `docs/diagnostico-ux-v2-vs-referencia.md` — o que errado e o que mudou.
2. `docs/referencia-ux-product-engineering.md` — padroes do dashboard PE (ONVIO).
3. `src/servidor/public-v2/css/app-v2.css` — design tokens e componentes atuais.
4. `src/servidor/public-v2/js/estudos-semanal-v2.js` — exemplo de rendering correto.

## Checklist por tela (pass/fail)

| # | Criterio | Como verificar |
|---|----------|----------------|
| 1 | Top-nav horizontal (nao sidebar) | `<nav id="nav-v2">` renderiza `.topnav` |
| 2 | Hero stat com numero grande | `.hero-stat__value` com `font-size >= 2rem` |
| 3 | Progress bar para % concluido | `.progress` com `.progress__fill` |
| 4 | Inline metrics (nao grid de KPI boxes) | `.inline-metrics` com 3-5 items em linha |
| 5 | Bloco narrativo | `<p class="narrative">` com frase legivel |
| 6 | Cards flat (borda, sem sombra) | `border: 1px solid var(--borda)`, sem `box-shadow` |
| 7 | ISV/score como ring colorido | `.score__ring` com cor de status |
| 8 | Factor bars (nao grid de KPI boxes) | `.factors` com `.factor__bar` |
| 9 | Expandable para detalhes | `.expandable` com `.expandable__trigger` |
| 10 | Whitespace adequado | Cards com `padding >= 24px`, gaps `>= 24px` |

## Paleta (usar SEMPRE)

```css
--fundo: #f5f5f5;       /* page background */
--card: #ffffff;         /* card background */
--texto: #1a1a1a;        /* primary text */
--texto-sec: #6b7280;    /* secondary text */
--texto-leve: #9ca3af;   /* tertiary / muted */
--borda: #e5e5e5;        /* borders */
--accent: #e05929;       /* TR orange - active nav only */
--primario: #2563eb;     /* actions, links */
--verde/amarelo/vermelho  /* status badges ONLY */
```

### Referencia TR oficial (Tech TOC, `--tr-*` no CSS)

Tokens extraidos de `github.com/tr/tech-toc_live` (2026-04-06). Disponibilizados como
`--tr-*` em `app-v2.css` para validacao de alinhamento corporativo. Detalhes completos
em `docs/referencia-ux-product-engineering.md` secao 12.

| Proposito | Nosso | TR oficial | Nota |
|-----------|-------|------------|------|
| Texto | `#1a1a1a` | `#404040` | Nosso mais escuro (contraste) |
| Links | `#2563eb` | `#005DA2` | Azul corporativo TR mais escuro |
| Laranja | `#e05929` | `#FA6400` | TR mais vibrante |
| Bordas | `#e5e5e5` | `#dadada` | Proximos |
| Font | Segoe UI | `clario-regular` | Clario licenciada; Segoe seguro |

## Anti-patterns (NUNCA fazer)

- Box-shadow em cards (exceto `:hover` leve)
- Grid de 5+ KPI boxes com labels uppercase
- Borda-esquerda colorida em cada KPI
- Background colorido + borda colorida + texto colorido no mesmo componente
- Sidebar de 240px
- Copiar JS v1 como rendering layer

## Fluxo de revisao

1. Ler a pagina alvo e seu JS de rendering.
2. Aplicar checklist (10 itens).
3. Cruzar com principios fundamentais.
4. Propor acoes concretas (arquivo + mudanca).

## Fonte autoritativa: Saffron Design System

O design system oficial da TR e o **Saffron** (`saffron.thomsonreuters.com`, Chromatic SAML).
60+ componentes, WCAG 2.1 AA, 255 repos, 200+ designers. Detalhes completos na secao 13
de `docs/referencia-ux-product-engineering.md`. Principios: purposeful, human-centered,
efficient, intuitive, dynamic.

## Restricoes

- `tech-stack.mdc`: sem frameworks CSS; Chart.js via CDN.
- `guardiao.mdc`: nao aumentar JS acima do limite; nao mudar calculos.
- Backend compartilhado: mesmas APIs, novo rendering.
