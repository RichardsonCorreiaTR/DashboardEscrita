---
name: ui-design
description: >-
  Agente de UI Design para o Dashboard Diretrizes (Escrita Fiscal).
  Garante que componentes, cores, fontes e espacamentos sigam o padrao
  Thomson Reuters (Saffron + Dominio + Tech TOC).
  Use quando pedir revisao UI, cores, componentes, visual, padrao TR,
  Saffron, tokens, "agente de UI" ou "agente visual".
---

# Skill: UI Design — Dashboard Diretrizes

## Objetivo

Garantir que toda interface tenha **visual profissional Thomson Reuters**:
limpo, moderno, acessivel (WCAG 2.1 AA), e visualmente coerente com os
produtos da familia TR (Saffron, Dominio, PE dashboard).

**NAO** alterar logica de calculo, SQL ou validacoes.
**NAO** alterar textos/copy (isso e do agente UX-Writer).
**NAO** alterar hierarquia/fluxo (isso e do agente UX-Experience).

## Fontes de referencia visual (prioridade)

1. **Saffron** — design system oficial TR (`saffron.thomsonreuters.com`, SAML)
2. **Dominio** — `dominiosistemas.com.br` (produto TR brasileiro, nosso publico)
3. **PE Dashboard** — `docs/referencia-ux-product-engineering.md`
4. **Tech TOC** — tokens CSS corporativos (`--tr-*` em `app-v2.css`)
5. **TR Brand** — paleta oficial da marca

## Tokens do projeto (usar no codigo)

```css
/* Projeto (app-v2.css :root) */
--fundo: #f5f5f5;       --card: #ffffff;
--texto: #1a1a1a;        --texto-sec: #6b7280;    --texto-leve: #9ca3af;
--borda: #e5e5e5;        --accent: #e05929;        --accent-bg: #fef3ee;
--primario: #2563eb;     --primario-bg: #eff6ff;
--verde: #16a34a;        --amarelo: #ca8a04;       --vermelho: #dc2626;
--font: 'Segoe UI', -apple-system, sans-serif;
--radius: 12px;          --radius-sm: 8px;
```

## Tokens corporativos TR (referencia, usar `--tr-*`)

```css
--tr-text: #404040;      --tr-link: #005DA2;
--tr-orange: #FA6400;    --tr-orange-sec: #FF8000;
--tr-header-bg: #3b3f4a; --tr-border: #dadada;
--tr-card-border: #edeff5; --tr-card-shadow: 0px 2px 12px 0px rgba(0,0,0,.04);
--tr-table-head-bg: #f5f7ff; --tr-page-bg: #fafafd; --tr-focus: #083899;
```

## Paleta oficial da marca TR

| Nome | Hex | Uso |
|------|-----|-----|
| Flush Orange | `#FF8000` | Marca TR (accent principal) |
| WCAG Orange | `#FA6400` | Versao acessivel do laranja |
| Tundora | `#444444` | Texto escuro |
| Emperor | `#555555` | Texto secundario |
| Dove Gray | `#666666` | Texto terciario |
| Silver | `#CCCCCC` | Bordas leves |
| Mercury | `#E9E9E9` | Fundos neutros |
| Wild Sand | `#F7F7F7` | Page background |
| Corporate Blue | `#005DA2` | Links corporativos |

## Escala tipografica (Saffron)

| Nivel | Tamanho | Peso | Uso no dashboard |
|-------|---------|------|------------------|
| h1 | 2rem / 2.5rem | 600 | Titulo da pagina |
| h2 | 1.5rem / 1.75rem | 600 | Titulo de secao |
| h3 | 1.25rem / 1.5rem | 600 | Subtitulo |
| Hero stat | >= 2rem | 700 | Numero grande (KPI) |
| Body | 1rem / 1.5rem | 400 | Texto corrido |
| Caption | 0.875rem / 1rem | 400 | Labels, metadata |

## Componentes (padrao flat TR)

### Cards

```css
.card { background: var(--card); border: 1px solid var(--borda);
  border-radius: var(--radius); padding: 24px; }
.card:hover { box-shadow: var(--tr-card-shadow); }
```

Sem box-shadow em repouso. Sem `::before` decorativo. Sem borda-esquerda colorida.

### Botoes

- Primario: `background: var(--primario)`, texto branco, radius 8px
- Secundario: `border: 1px solid var(--borda)`, texto `var(--texto)`
- Accent: reservado para CTA unico por tela (laranja TR)

### Badges de status

- Compactos: `padding: 2px 8px`, `border-radius: 4px`, `font-size: 0.75rem`
- Verde (`--verde`): bom / no prazo
- Amarelo (`--amarelo`): atencao / proximo do limite
- Vermelho (`--vermelho`): critico / fora da meta
- Fundo: versao `*-bg` da cor. Texto: versao forte da cor.

### Tabelas

- Header: `background: var(--tr-table-head-bg)`, `font-weight: 600`
- Bordas: `1px solid var(--borda)` entre linhas
- Numeros: alinhados a direita
- Zebra: linhas alternadas com `rgba(0,0,0,.02)`

### Graficos (Chart.js / SVG inline)

- Fundo do canvas/SVG: transparente (herda `--card`)
- Legenda: acima ou ao lado, nunca sobreposta aos dados

**Paletas nomeadas (usar como constantes no JS):**

| Nome | Cores | Quando usar |
|------|-------|-------------|
| Sequencial | `#2563eb` → `#60a5fa` → `#93c5fd` | Evolucao temporal, gradientes |
| Categorica | `#2563eb`, `#16a34a`, `#ca8a04`, `#dc2626`, `#9ca3af` | Tipos distintos (status, ramo) |
| Status | `--verde`, `--amarelo`, `--vermelho`, `--texto-leve` | Liberada, pendente, critica, descartada |
| Ramo | `#2563eb` (NE), `#ea580c` (SA) | Diferenciar NE vs SA |
| Versao | `#7c3aed` | Marcos de versao em timelines |

Nunca inventar cores ad-hoc; escolher da paleta acima.

**Tooltip padrao (Chart.js e SVG `<title>`):**

```css
.chart-tooltip {
  background: #1f2937; color: #fff;
  border-radius: 8px; padding: 6px 10px;
  font-size: 0.75rem; box-shadow: 0 2px 8px rgba(0,0,0,.15);
}
```

Em SVGs inline, usar `<title>` para hover nativo; em Chart.js, aplicar
o mesmo visual via `options.plugins.tooltip`.

**Responsividade de graficos:**

- SVGs devem usar `viewBox` + `width="100%"` — nunca largura fixa em px.
- Chart.js deve usar container com largura fluida (o chart herda).
- Em telas < 768px, graficos ocupam 100% da largura.

## Anti-patterns (NUNCA)

- Box-shadow em cards em repouso
- Grid de 5+ KPI boxes com labels uppercase e borda-esquerda colorida
- Background colorido + borda colorida + texto colorido no mesmo componente
- Sidebar de 240px comendo espaco
- Gradientes em backgrounds de secao
- Fontes diferentes da stack definida
- Cores fora da paleta definida

## Checklist por tela (pass/fail)

| # | Criterio |
|---|----------|
| 1 | Cards flat (borda sutil, sem sombra em repouso) |
| 2 | Cores apenas da paleta definida |
| 3 | Espacamento >= 24px entre cards/secoes |
| 4 | Hero stat >= 2rem, peso 700 |
| 5 | Badges de status compactos (nao blocos grandes) |
| 6 | Tabelas com header `--tr-table-head-bg`, numeros a direita |
| 7 | Graficos com legenda visivel e tooltip padrao |
| 8 | Radius consistente (12px cards, 8px botoes/badges) |
| 9 | Contraste >= 4.5:1 em todo texto (WCAG AA) |
| 10 | Nenhum anti-pattern presente |

## Leitura obrigatoria

1. `src/servidor/public-v2/css/app-v2.css` — tokens e componentes atuais
2. `docs/referencia-ux-product-engineering.md` — secoes 9, 12, 13
3. `output/ux-referencia-product-engineering/` — screenshots de referencia

## Fluxo de revisao

1. Ler o CSS e o HTML renderizado da pagina.
2. Comparar visualmente com Saffron/Dominio/PE.
3. Aplicar checklist (10 itens).
4. Propor mudancas concretas em CSS (arquivo + seletor + propriedade).

## Restricoes

- **Somente visual** — nao mexer em textos (agente UX-Writer) nem fluxo (agente UX).
- `tech-stack.mdc`: sem frameworks CSS; Chart.js via CDN.
- `guardiao.mdc`: nao aumentar arquivos acima do limite.
