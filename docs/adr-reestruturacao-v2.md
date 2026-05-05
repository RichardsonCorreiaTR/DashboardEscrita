# ADR — Reestruturacao do Frontend (v2)

| Campo | Valor |
|-------|-------|
| **Data** | 2026-04-06 |
| **Status** | Aceito |
| **Motivacao** | Aplicar padroes UX (referencia PE/ONVIO) sem risco de quebrar o dashboard atual |

## Contexto

O Dashboard Diretrizes (porta 4000) funciona e e usado pela equipe Escrita Fiscal. A auditoria UX identificou lacunas (ver `gap-ux-dashboard-diretrizes-vs-pe.md`). A reestruturacao deve ser **incremental e segura**.

## Decisao

### 1. Manter atual intacto

| Componente | Mantido em |
|------------|-----------|
| `src/servidor/app.js` | **Porta 4000** — nao sera alterado |
| `src/servidor/app-offline.js` | **Porta 4001** — nao sera alterado |
| `src/servidor/public/` | Frontend atual (v1) — nenhuma mudanca |

### 2. Novo servidor v2

| Componente | Caminho |
|------------|---------|
| Entry point | `src/servidor/app-v2.js` |
| Porta | **5000** (env `PORT_V2`) |
| Frontend | `src/servidor/public-v2/` |
| npm script | `npm run start:v2` |

### 3. Reutilizar backend 100%

O `app-v2.js` **monta os mesmos routers** (indicadores, estudos, historico, metas, laboratorio, proposta, descartes) sob `/api`. Nenhuma rota e duplicada; os modulos em `src/servidor/rotas/` sao `require` diretos.

Diferenca: `express.static` aponta para `public-v2/` em vez de `public/`.

### 4. Estrutura do public-v2/

```
public-v2/
├── index.html            ← Hub redesenhado (uma decisao por card, hierarquia F)
├── css/
│   └── app-v2.css        ← Design tokens TR + componentes novos
├── js/
│   ├── api.js            ← Copia ou symlink (mesma API)
│   ├── nav-v2.js         ← Nav com aria, tokens, padroes da referencia
│   └── (apps por pagina — migrados um a um)
└── (paginas migradas conforme demanda)
```

### 5. Estrategia de migracao (pagina a pagina)

| Fase | Pagina | O que muda |
|------|--------|------------|
| F0 | `index.html` (hub) | Layout novo, cards com clareza, tokens CSS | **DONE** |
| F1 | `diretrizes.html` | Microcopy "Leitura", hierarquia, export CSV | **DONE** |
| F2 | `estudos.html` (7 views) | Semanal, Historica, ISV, YoY, Descartes, Liberacoes V1/V2 | **DONE** |
| F3 | `equipes.html` | Metas por colaborador, abas, totalizadores | **DONE** |
| F4 | `laboratorio.html` (4 views) | Raio-X, Evolucao, DNA, Backtest | **DONE** |
| F5 | `proposta-metas.html` | Secoes colapsaveis, retrospectiva, sugestoes | **DONE** |
| F6 | `descartes-tempo.html` | Cards por analista, tabela, graficos | **DONE** |

Todas as paginas foram migradas. A porta 4000 permanece como fallback.

### 6. Mapa atual → v2 (o que muda e o que fica)

```
                      ┌─────────────────────┐
                      │    src/core/         │
                      │    src/indicadores/  │  ← BACKEND COMPARTILHADO
                      │    src/estudos/      │     (zero duplicacao)
                      │    src/historico/    │
                      │    src/servidor/rotas/│
                      └─────────┬───────────┘
                                │
             ┌──────────────────┼──────────────────┐
             │                  │                   │
      app.js (4000)     app-offline.js (4001)   app-v2.js (5000)
      public/            (rotas offline)         public-v2/
      [ATUAL - NAO TOCAR]                        [NOVO - UX REDESIGN]
```

### 7. Criterio de "pronto para virar default"

Quando **todas as paginas** estiverem em `public-v2/` e validadas com a equipe:
1. `app.js` aponta `express.static` para `public-v2/`.
2. `public/` vira `public-v1-arquivo/` (ou se remove).
3. `app-v2.js` pode ser removido.
4. Porta volta a ser so 4000.

### 8. Vantagens

- **Zero risco**: porta 4000 continua funcionando.
- **Validacao incremental**: cada pagina pode ser testada na 5000 antes de "promover".
- **Backend unico**: nenhuma logica de calculo, SQL ou cache e duplicada.
- **Rollback trivial**: basta parar a porta 5000.

### 9. Restricoes

- Respeitar `tech-stack.mdc` (sem frameworks pesados, sem bundler).
- Respeitar `guardiao.mdc` (limites de linhas, nao mexer em calculos).
- CSS puro com design tokens; Chart.js via CDN onde necessario.
