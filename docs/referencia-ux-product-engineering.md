# Referência UX — Product Engineering / ONVIO BR (dashboard externo)

Documento de **referência para análise e evolução** do **Dashboard Diretrizes** (Escrita Fiscal). **Não descreve o código deste repositório**: registra o que foi **observado** em auditoria de interface num produto TR de engenharia (ONVIO BR), para extrair padrões reutilizáveis.

**Backlog deste repositório vs. essa referência:** [gap-ux-dashboard-diretrizes-vs-pe.md](./gap-ux-dashboard-diretrizes-vs-pe.md)

| Campo | Valor |
|--------|--------|
| **Fonte auditada** | `http://dashboardadoonviobr.dominiosistemas.com.br/` |
| **Data da auditoria** | 2026-04-06 |
| **Método** | Navegador integrado (MCP): navegação por URL, snapshots de acessibilidade (profundidade até ~50), capturas full-page (incl. viewport 1280×800 em Flow Metrics) |
| **Idioma da UI** | Português (BR) |

---

## Como usar este documento com os agentes (Cursor)

Três skills especializam o trabalho de interface no projeto. **Cada uma tem escopo próprio** — ver `.cursor/skills/ux-writer/SKILL.md`, `ux-experience/SKILL.md`, `ui-design/SKILL.md`.

| Agente | O que este site de referência ensina | Seções úteis |
|--------|--------------------------------------------|----------------|
| **UX Writer** | Frases de leitura (“Leitura:”), títulos com contexto temporal, microcopy de filtros e estados, tom PT-BR alinhado ao negócio | §5–8 (exemplos de narrativa), §11 (checklist de texto) |
| **UX Experience** | Uma promessa por rota, hierarquia em F, navegação superior, drill-down com instrução, progressivo, regra dos 5s / 15s / 30s | §3–4, §7–9, §11 (fluxo e hierarquia) |
| **UI Design** | Cards, contraste, laranja TR na navegação ativa, tokens Tech TOC, alinhamento ao Saffron e paleta corporativa | §9, §12–13 |

**Ordem sugerida quando a mudança toca os três:** experiência (estrutura) → texto (copy) → visual (tokens e componentes). Detalhe: `.cursor/rules/ux-dashboard.mdc`.

---

## 1. Artefatos visuais no repositório

Screenshots guardados para comparação local (opcional no Git):

| Arquivo | Descrição |
|---------|-----------|
| `output/ux-referencia-product-engineering/00-hub-home.png` | Raiz `/` (registro visual; SPA pode sobrepor conteúdo) |
| `output/ux-referencia-product-engineering/01-home.png` | Mesma sessão / captura adicional |
| `output/ux-referencia-product-engineering/02-sprint-health.png` | `/sprint-health` carregado |
| `output/ux-referencia-product-engineering/03-quarter-plan.png` | `/quarter-plan` em carregamento |
| `output/ux-referencia-product-engineering/03-quarter-plan-loaded.png` | `/quarter-plan` com dados |
| `output/ux-referencia-product-engineering/04-planejamento.png` | `/planejamento` |
| `output/ux-referencia-product-engineering/05-flow-metrics-desktop.png` | `/flow-metrics` largura ~1280px |

---

## 2. Mapa de rotas e títulos (`document.title`)

| Rota | Título observado |
|------|------------------|
| `/` | Product Engineering \| Thomson Reuters |
| `/flow-metrics` | Flow Metrics \| ONVIO BR |
| `/sprint-health` | Sprint Health Check \| ONVIO BR · Messenger (varia com área) |
| `/quarter-plan` | Quarter Plan \| ONVIO BR |
| `/planejamento` | Planejamento \| ONVIO BR |

*UX Experience:* título da aba coerente com a promessa da página — útil para replicar como `Secão | Escrita Fiscal` no nosso dashboard.

---

## 3. Navegação global (hub)

No topo, padrão recorrente:

- Link **Thomson Reuters Product Engineering** (home / marca).
- Links: **Flow Metrics**, **Sprint Health**, **Quarter Plan**, **Planejamento**.
- Landmark **`navigation`** com nome acessível **“Navegação principal”**.
- Ícones de contexto (ex.: velocímetro, pulso, calendário, lista) com **destaque laranja** na área ativa — reforço visual + marca TR.

**Síntese:** uma **promessa por rota**, alinhada entre título da aba, H1 e primeiros blocos — alinhado à regra “título = promessa” do agente de experiência.

---

## 4. Fluxo — filtros e ações comuns

Padrão de **contrato de contexto**:

- **Area Path** (combobox com paths ADO longos).
- **Tempo:** intervalo de datas (Flow); sprint nomeada (Sprint Health); quarter (Quarter Plan).
- **Tipo de item:** Feature + User Story, Request Type, etc.
- Ações recorrentes: **Atualizar dados** / **Atualizar**, **Comparar times**, vários **Exportar CSV** (Flow), **Abrir no ADO** (Quarter Plan).

**Estados de sistema:**

- Botões/combos **disabled** durante a carga.
- Mensagem explícita de carregamento (ex.: **“Carregando Quarter Plan…”**).

*UX Writer:* loading com nome da seção bate com os estados padrão da skill. *UX Experience:* feedback explícito evita “silêncio” durante fetch.

---

## 5. Flow Metrics — estrutura semântica (snapshot)

**Filtros / controles (exemplos de nomes acessíveis):**

- Botão **Atualizar dados**
- Combobox **Atendimento** (e demais áreas)
- **Data início** / **Data fim** (caixa com valor ISO exibido)
- Combobox **Feature + User Story** (opções: Both, Feature, User Story)
- Combobox **Request Type** (lista extensa)
- **Comparar times**
- Vários **Exportar CSV**
- Checkbox **Desconsiderar New** (readonly no snapshot)
- Spinbutton (ex.: **20**)
- Segundo combobox **Todos** (filtro por tipo de demanda para o gráfico)

**Seções (headings H3 salvo indicado):**

1. **Performance contra Datas-Alvo** — No Prazo / Atrasados / Pendentes + texto interpretativo com percentual e base (ex.: 118 itens).
2. **Quantidade de entregas por semana** — bloco **“Leitura:”** com variação %, meta de previsibilidade (&lt;30%), semanas fora do padrão.
3. **Tempo de entrega por item** — **Leitura:** percentis, dispersão, sugestão de filtrar por tipo.
4. **Lead Time — Breakdown por Etapa** — etapa dominante, % espera.
5. **Eficiência de Fluxo** — lista Ativo (h), Fila (h), Eficiência % + **Leitura:**.
6. **Itens em Andamento — WIP Aging** — SLE, zonas de atenção, estado concentrado.
7. **Ações Prioritárias** — lista numerada; cada item com **H4** (título da ação), parágrafo e **benefício** (ex.: “Entregas mais rápidas e previsíveis”).
8. **Monte Carlo — Previsão de Entrega** — campos 50% / 75% / 95%, **Leitura:** com 10.000 iterações, uso de percentil 75–85%, comunicação de faixa de datas.

**Ideia central para o nosso projeto:** cada gráfico relevante traz **narrativa orientada à decisão** — número + amostra + interpretação + ação quando couber — exatamente o padrão da skill **UX Writer** (frase de leitura).

---

## 6. Sprint Health — estrutura semântica (snapshot)

**Controles:**

- Sprint (combobox com muitas opções, ex.: `2026_S07_Mar25-Apr07 (atual)`)
- Area Path
- Alternância **Sprint** / **Trends**
- **Comparar times**
- Botões de escopo (ex.: itens sem estimativa, adicionados, removidos)
- **Burndown:** Remaining Work, User Stories, Tasks, **Recarregar burndown**
- Combobox agregação (**Tipo de WI** vs **Request Type**)
- Filtros de status (**New**, **Closed**, **Active**, **Resolved**)
- **Expandir todas** / **Minimizar todas**
- Filtros por tipo e severidade; **Ver detalhes**

**Seções (headings):**

- **H1** Sprint Health Check — **H2** com nome do time (ex.: Messenger)
- KPIs: **Previsto**, **Realizado**, **Progresso**
- **Composição da Sprint**
- **Aderência do Planejamento** (Escopo Inicial, Escopo Atual, Aderência, Variação)
- **Burndown** (legenda Ideal / Real)
- **Tipos de work item na sprint**
- **Progresso por pessoa**
- **Esforço por Tipo de Demanda (h)** e **Esforço por Tipo de Atividade (h)**
- **Distribuição por status** + instrução **“Clique em um status para filtrar a tabela de User Stories abaixo.”**
- **User Stories**
- **Análise de bugs** (Por severidade / Por estado / Insights da operação)
- **Refinamento próximas versões** (fases com contagem de SAIs)

**Acessibilidade:** em estado inicial de carga, alguns **button** apareceram **sem nome** no snapshot — risco de ícone sem `aria-label` (checklist **UI Design** + critérios gerais de acessibilidade).

---

## 7. Quarter Plan — estrutura semântica (snapshot)

**Controles:** **Atualizar**, Quarter (Q1 2026…), Area Path, **Comparar times**.

**Conteúdo carregado (exemplos):**

- **H2** `Q1 2026 — Delivery Status` com texto de contexto (ex.: “% do quarter decorrido”, “Atualizado HH:MM”)
- KPIs: Gap, Realizado %, Planejado %, meta para hoje, WIP, Blockers
- **Portfolio Q — Resumo** (planejado, entregues, não absorvido, texto de squads)
- **Riscos, Blockers e Alertas** — carry-over Q→Q+1 com cards clicáveis (título + mensagem de risco)
- Muitos links **Abrir no ADO**
- **Roadmap por Squad**
- **Qualidade da Execução** — matriz Features / Gaps / Squads + texto **“Clique em uma célula para filtrar os detalhes abaixo…”**
- Botões de filtro por tipo de gap (Target Date, Horas Executadas) com contagem

*UX Experience:* drill-down com frase explícita (“Clique em…”) — mesmo padrão recomendado no gap do nosso dashboard.

---

## 8. Planejamento — estrutura semântica (snapshot)

**Filtros tipo pill:** Todos, Plataforma, Folha, Contábil, Produtos para Contadores, Atendimento, Messenger, Processos, Documentos, Novo Documents.

**H1:** ex. `PI_Q2`

**Seções:**

- **Confiança de Entrega** — por área (Plataforma, Folha, Contábil) com percentuais e throughput
- Cards-resumo clicáveis com texto denso (risco, restantes, efetivas, feat/sem, lead time, maturidade, estados)
- **Recomendações (N)** com H3 por área (ex.: Folha — Reduzir escopo)
- Contadores: **Épicos**, **Features** + % ready, **Bloqueios**, **Carry-over**
- **Épicos da PI**, **Bloqueios & Dependências**, **Carry-over**

---

## 9. Design system e hierarquia visual (inferido + screenshots)

- Fundo **cinza claro**, **cards brancos**, **cantos arredondados**, sombra leve.
- **Laranja TR** em logo e estado ativo da navegação.
- **Azul** para ações primárias e destaque de “realizado” / progresso.
- **Semântica de status:** verde / vermelho / laranja para operação (prazo, atraso, pendente).
- Hierarquia **F:** título → KPI hero → contexto → detalhe → export / link fonte.
- **Tipografia:** sans limpa; labels em caixa alta ou peso menor; números grandes nos KPIs.

*UI Design:* comparar com tokens do projeto (`app-v2.css`) e com §12–13; *UX Experience:* hierarquia F e um hero forte por seção.

---

## 10. Riscos e melhorias (checklist transversal)

1. **SPA / rota:** clique na nav às vezes não atualizou a URL na primeira tentativa — preferir **navegação consistente** e feedback de transição.
2. **Botões sem nome acessível** em estados de loading — sempre **`aria-label`**.
3. **Mobile:** validar espaçamento entre pills/legendas para evitar sobreposição.
4. **Erro de API:** tela de falha clara além de loading infinito.

---

## 11. Checklists reutilizáveis por agente

Use ao evoluir dashboards e relatórios **neste** repositório. Itens do PE acima servem de **exemplo de bom comportamento**, não de cópia literal.

### UX Writer (texto e voz)

1. Cada seção com dados densos tem **título** no formato **[O quê] — [contexto temporal]** quando fizer sentido.
2. Cada visualização importante tem **frase de leitura**: número + base (amostra) + significado + ação opcional.
3. Estados **carregando / vazio / erro / cache** com mensagens claras em PT-BR (ver skill).
4. Termos do **glossário de domínio** (NE, SAI, versão, liberação, etc.) — ver skill.
5. Onde houver KPI, **tooltip** ou linha curta explica o cálculo.

### UX Experience (fluxo e hierarquia)

1. **Uma promessa** por rota ou bloco principal; o usuário sabe “o que vai ver” antes de rolar.
2. Em **5s:** “como estamos?” (hero + cor de status, se aplicável); em **15s:** “por quê?” (narrativa); em **30s:** “o quê fazer?” (ações / detalhe).
3. **Progressive disclosure:** resumo primeiro; detalhes sob demanda.
4. **Drill-down:** instrução visível quando o clique filtra outra área (“Clique em…”).
5. **Navegação:** topo horizontal, item ativo óbvio; sem sidebar como padrão principal (ver skill).
6. **Landmarks** e **headings** em ordem lógica.

### UI Design (visual e componentes)

1. **Tokens** do projeto e, quando útil, **`--tr-*`** alinhados ao Tech TOC (§12).
2. **Contraste** WCAG 2.1 AA em texto e estados de foco.
3. Cards **flat** conforme skill; sem anti-patterns listados na skill.
4. Gráficos: legenda legível, tooltip padronizado; paleta coerente com a skill.
5. Tabelas: cabeçalho destacado, números alinhados à direita, zebra se aplicável.

### Visão integrada (os dez pontos do PE, condensados)

| # | Princípio |
|---|-----------|
| 1 | Uma **rota ou seção = uma decisão**; título alinhado. |
| 2 | **Contexto visível:** filtros com rótulo + valor atual. |
| 3 | Visualização densa: **título**, **métrica-chave**, **texto de leitura**, **ação** quando couber. |
| 4 | **Cor** com significado + legenda ou rótulo. |
| 5 | Estados **loading / erro / vazio** explícitos. |
| 6 | **Exportação** ou **link para fonte** quando dados sustentam decisão. |
| 7 | **Landmarks:** `nav` nomeado; headings ordenados. |
| 8 | **Consistência** de espaçamento, cards, primário/secundário, microcopy PT-BR. |
| 9 | **Drill-down** com instrução onde houver filtro por clique. |
| 10 | **Progressivo:** resumo no topo, detalhes abaixo. |

---

## 12. Tokens corporativos TR (fonte: Tech TOC interno)

Extraídos de `github.com/tr/tech-toc_live` (repositório privado, org TR) em 2026-04-06. Tokens usados no portal interno de engenharia da Thomson Reuters.

### Paleta oficial TR

| Token | Valor | Uso no Tech TOC |
|-------|-------|-----------------|
| Texto principal | `#404040` | `--MAIN-TEXT-color` |
| Títulos | `#404040` | `--MAIN-TITLES-TEXT-color` |
| Links | `#005DA2` | `--MAIN-LINK-color` — azul corporativo TR |
| Accent / laranja | `#FA6400` | `--TOC-MAIN-NAV-color` — navegação ativa, marcadores |
| Laranja secundário | `#FF8000` | Âncoras, visitados, separadores |
| Header global (bg) | `#3b3f4a` | Barra superior escura |
| Fundo página | `#fafafd` | `--TOC-ALT-PAGE-BG-color` |
| Bordas | `#dadada` | `--TOC-BORDER-color` |
| Card bg | `#ffffff` | `--TOC-CARD-BG-color` |
| Card borda | `#edeff5` | `--TOC-CARD-BORDER-color` |
| Card sombra | `0px 2px 12px 0px rgba(0,0,0,.04)` | Sombra leve oficial |
| Tabela heading bg | `#f5f7ff` | `--TOC-TABLE-HEADING-BG-color` |
| Search outline | `#083899` | `--TOC-SEARCH-BOX-OUTLINE-color` |
| Menu ativo bg | `#f0f0f0` | Categoria selecionada |
| Menu ativo borda | `#FA6400` | Indicador lateral laranja |

### Tipografia oficial TR

| Nível | Valor | Peso |
|-------|-------|------|
| Font family | `clario-regular` (Monotype, licenciada) | — |
| Base size | `18px` / `28px` line-height | — |
| h1 | `2rem / 2.5rem` | 600 |
| h2 | `1.5rem / 1.75rem` | 600 |
| h3 | `1.25rem / 1.5rem` | 600 |
| h4 | `1.125rem / 1.5rem` | 600 |
| h5 | `1rem / 1.25rem` | 600 |
| h6 | `0.875rem / 1rem` | 600 |

### Mapeamento nosso vs TR oficial

| Propósito | Nosso token | Valor nosso | TR oficial | Nota |
|-----------|-------------|-------------|------------|------|
| Texto | `--texto` | `#1a1a1a` | `#404040` | Nosso mais escuro (contraste) |
| Links/primário | `--primario` | `#2563eb` | `#005DA2` | Azuis distintos |
| Accent/laranja | `--accent` | `#e05929` | `#FA6400` | Nosso mais terroso |
| Bordas | `--borda` | `#e5e5e5` | `#dadada` | Próximos |
| Fundo | `--fundo` | `#f5f5f5` | `#fafafd` | Próximos |
| Cards sombra | nenhuma (flat) | — | `rgba(0,0,0,.04)` | TR usa sombra sutil |
| Font | `--font` | Segoe UI stack | `clario-regular` | Clario licenciada; Segoe segura |

**Decisão do projeto:** manter tokens atuais (contraste e ausência de fonte licenciada obrigatória), expondo TR como `--tr-*` no CSS para referência e uso opcional — alinhado à skill **UI Design**.

---

## 13. Saffron — design system oficial TR (fonte autoritativa)

Registrado em 2026-04-06 via `saffron.thomsonreuters.com` (Storybook no Chromatic, SAML corporativo).

### O que é o Saffron

| Dimensão | Valor |
|----------|-------|
| Tipo | Design system enterprise oficial da Thomson Reuters |
| Designers/UX engineers | 200+ |
| Product engineers | milhares |
| Repositórios que usam | 255 |
| Produtos | Legal Research, Tax Compliance, Accounting |
| Compliance | WCAG 2.1 AA — 100% |
| Adoção em 6 meses | 82% |
| Prêmios | Finalista Best Collaboration + Innovation (Design System Awards 2025) |

### Cinco princípios do Saffron

1. **Purposeful** — cada escolha de design tem intenção clara  
2. **Human-centered** — centrado no usuário final  
3. **Efficient** — reduz fricção e retrabalho  
4. **Intuitive** — uso sem manual  
5. **Dynamic** — evolui com feedback real  

### Design foundations (secções do Storybook)

- **Content** — guidelines de conteúdo/copy  
- **Density** — níveis de densidade visual  
- **Design tokens** — cor, tipografia, espaçamento, elevação  
- **Responsive design** — breakpoints e adaptação  
- **States** — hover, focus, disabled, error  
- **Typography** — escala oficial  
- **Color** — estratégia de cor (marca TR + acessibilidade)  
- **Elevation** — sombras / profundidade  
- **Motion** — animações e transições  

### Catálogo de componentes (60+)

Accordion, Action card, Activity, AI Prompt, Alert, Anchor, Anchored region, Avatar, Back to top, Badge, Breadcrumb, **Button**, **Card**, Chat, Checkbox, Chip, Click away listener, Combobox, Date picker, Dialog, Disclosure, Divider, Drawer, Empty state, Faceted filter, File upload, Footer, Group focus manager, Icon, **Layout**, List, Listbox, Option, Logo, Menu, Message box, Metadata, Number field, **Pagination**, **Product header**, **Progress**, **Progress ring**, Progress text, Radio group, Search field, Select, **Side nav**, Skip link, Slider, Splitter, Sr-only, **Status**, Stepper, Switch, **Table**, **Tabs**, Text, Text area, Text field, Toolbar, Tooltip, Tree view, Windows, Wizard.

*(Em **negrito**: componentes mais relevantes para dashboards como o nosso.)*

### pAIella — IA + Saffron MCP server

A TR construiu o **Ask Saffron LLM** (treinado na biblioteca completa) e um **Saffron MCP server** que liga Figma ao LLM (Cursor, Copilot, Cline). Resultados divulgados: ganhos de velocidade e de aderência a padrões e acessibilidade.

**Para este repositório:** não há acesso ao MCP Saffron por defeito. Se for disponibilizado, pode configurar-se em `.cursor/mcp.json`.

### Paleta oficial da marca TR (cruzamento de fontes)

| Nome | Hex | Fonte |
|------|-----|-------|
| Flush Orange | `#FF8000` | Brand palette oficial |
| Accent Orange (WCAG) | `#FA6400` | Tech TOC |
| Tundora | `#444444` | Brand palette |
| Emperor | `#555555` | Brand palette |
| Dove Gray | `#666666` | Brand palette |
| Silver | `#CCCCCC` | Brand palette |
| Mercury | `#E9E9E9` | Brand palette |
| Wild Sand | `#F7F7F7` | Brand palette |
| Corporate Blue | `#005DA2` | Tech TOC |
| Dark header | `#3B3F4A` | Tech TOC |

### Acesso

- **URL:** `https://saffron.thomsonreuters.com/`  
- **Autenticação:** Chromatic SAML (SSO corporativo TR)  
- **Páginas úteis para exploração manual:** foundations de Color, Typography, Tokens (confirmar paths exatos no sidebar).  
- **Limitação:** conteúdo em iframe Storybook; automação pode não extrair texto do iframe por completo.

---

## 14. Limitações desta referência

- Não houve inspeção de **CSS/HTML fonte** nem de **rede/API**.  
- Snapshots **não capturam** todo o conteúdo de canvas/SVG; predomina texto acessível.  
- Números citados são **exemplos do momento da auditoria** (podem mudar no servidor).

---

**Manutenção:** ao rever o site externo, atualizar data, screenshots em `output/ux-referencia-product-engineering/` e as secções 5–8 se a estrutura mudar; alinhar novas descobertas às três skills se surgirem padrões novos de texto, fluxo ou visual.
