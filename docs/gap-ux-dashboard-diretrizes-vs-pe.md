# Gap UX — Dashboard Diretrizes (Escrita Fiscal) vs referencia Product Engineering

Comparacao **funcional/de UX** entre este projeto e o dashboard documentado em `referencia-ux-product-engineering.md`. Objetivo: **backlog priorizado** para evolucao de clareza, nao copiar o produto externo literalmente.

| Campo | Valor |
|-------|--------|
| **Referencia** | `docs/referencia-ux-product-engineering.md` |
| **Data** | 2026-04-06 |

## O que o Dashboard Diretrizes ja faz bem

| Area | Evidencia |
|------|-----------|
| **Estados de sistema** | Loading com mensagem (`estudos.html`, `diretrizes.html`, etc.); erro global + retry em Diretrizes; banner offline. |
| **Contexto de dados** | Versao, periodo, "atualizado em" na header de Diretrizes; modo ODBC vs Cache com rotulo e `title`. |
| **Hub inicial** | `index.html` explica modulos com cards e texto de apoio. |
| **Idioma** | `lang="pt-BR"`, copy em portugues alinhado ao dominio Escrita Fiscal. |
| **Navegacao persistente** | `nav.js` + sidebar com item ativo por URL/view. |
| **Hierarquia basica** | `header` + `h1` + `main` em varias paginas. |

## Lacunas vs referencia (prioridade sugerida)

Legenda: **P0** = impacto alto em clareza ou acessibilidade; **P1** = padronizacao e narrativa; **P2** = polish / opcional.

| ID | Prioridade | Lacuna | Referencia (PE) | Sugestao no Diretrizes |
|----|------------|--------|-----------------|-------------------------|
| G1 | P0 | **Narrativa "Leitura"** junto de graficos/KPIs densos | Cada bloco traz interpretacao + numeros + amostra | Bloco curto padrao abaixo de charts/cards (texto estatistico vindo da API ou template), sem mudar formula. |
| G2 | P0 | **Nome acessivel do `nav` e toggles** | `navigation` com nome visivel na arquitetura de a11y | **Feito em `nav.js` (2026-04-06):** `aria-label` no container; botao mobile com `type`, `aria-label`, `aria-controls`, `aria-expanded` sincronizado; grupos com `role="button"`, `aria-expanded`, `aria-label`; links ativos com `aria-current="page"`; icones decorativos com `aria-hidden`. |
| G3 | P1 | **Exportacao tabular por visualizacao** | Multiplos "Exportar CSV" por secao | Onde houver tabela ou serie exportavel: botao CSV/JSON leve (sem nova dependencia pesada) ou instrucao de copiar — avaliar por tela. |
| G4 | P1 | **Instrucoes de interacao** ("Clique em…") | Filtros por clique documentados na UI | Onde drill-down existir (detalhes, abas), uma linha de ajuda acima da area interativa. |
| G5 | P1 | **Titulo da aba = modulo + contexto** | `Flow Metrics \| ONVIO BR` | Padronizar `document.title` por view em SPA-like (`estudos.html`, `laboratorio.html`) ex.: `Estudos - Semanal \| Escrita Fiscal`. |
| G6 | ~~P2~~ | ~~**Design tokens em CSS**~~ | Paleta e espacamento consistentes | **Resolvido (2026-04-06):** tokens do projeto (`--fundo`, `--card`, etc.) + tokens corporativos TR (`--tr-text`, `--tr-link`, `--tr-orange`, etc.) em `app-v2.css`. Fonte: `tr/tech-toc_live`. Mapeamento completo em `referencia-ux-product-engineering.md` secao 12. |
| G7 | P2 | **Microcopy de estados** | Mensagens explicitas de carregamento | Tabela fixa: vazio ("Nenhum dado no periodo"), erro de rede, cache desatualizado — alinhar textos entre paginas. |
| G8 | P2 | **Link para "fonte da verdade"** | "Abrir no ADO" | Onde aplicavel: link para PSAI/SGD/versao ou documentacao interna (sem expor credenciais). |

## Diferencas aceitas (nao sao "falhas")

- **Sidebar vs top icons**: modelo de navegacao diferente; manter coerencia interna basta.
- **Dominio**: indicadores Escrita Fiscal vs flow/sprint/quarter de produto ONVIO — a referencia e de **padrao de apresentacao**, nao de metricas.
- **Sem "Comparar times"**: so incluir se houver requisito de negocio.

## Proximos passos recomendados

1. ~~Implementar **G2**~~ (concluido em `nav.js`).
2. Piloto **G1** em **uma** tela densa (`diretrizes` ou uma view de `estudos`) para validar formato com a equipe.
3. Definir politica de **G3** (quais telas exportam dados).
4. Revisar este doc apos cada entrega maior de UX (marcar itens resolvidos).

## Politica dos PNGs de referencia

Os arquivos em `output/ux-referencia-product-engineering/*.png` podem ser **grandes**. O `.gitignore` do projeto pode ignora-los; quem clonar o repo ainda tem a **descricao** em `referencia-ux-product-engineering.md`. Para **versionar** os prints, remova a entrada correspondente do `.gitignore`.
