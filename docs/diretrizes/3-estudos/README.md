# Estudos Adicionais

> Analises exploratorias e deep-dives que nao estao vinculados a uma diretriz especifica.
> Podem virar diretrizes no futuro ou servir como insumo para decisoes.

## Estudos ativos

| # | Nome | Tipo | Arquivo | Status |
|---|------|------|---------|--------|
| 1 | Analise Semanal NE por Versao | Semanal | `src/estudos/analise-semanal-ne.js` | Ativo |
| 2 | Analise Historica NE | Historica | `src/estudos/analise-historica-ne.js` | Ativo |
| 3 | Liberacoes de SA (V1) | Preditivo | `src/estudos/liberacoes-sa.js` | Legado |
| 4 | **Liberacoes de SA (V2)** | Preditivo | `src/estudos/liberacoes-sa-v2/` | **Ativo** |

---

## Liberacoes de SA V2 - Documentacao Completa

Modelo preditivo que estima NEs na versao N+1 a partir das liberacoes de SA da versao N.

### Diferencias do V1 para V2

| Aspecto | V1 | V2 |
|---------|----|----|
| Arquivo | Monolitico (565 linhas) | 9 modulos (<130 linhas cada) |
| Correlacao | Pearson (assume normalidade) | Spearman (rank, sem premissas) |
| Significancia | Nenhuma | p-valor calculado, so declara se p<0.05 |
| Previsao | Regressao linear (pode prever negativo) | Mediana movel + fator de carga (sempre positivo) |
| IIL | Pesos heuristicos sem validacao | Removido (aguardando validacao por backtest) |
| Outliers | Deteccao apenas | Winsoizacao p5/p95 + flag visual |
| Qualidade dados | Nenhuma | % completude por versao + alertas |
| Backtest | Nenhum | MAPE retroativo automatico + acerto direcao |
| Volatilidade | Nenhuma | **Analise multi-lag N+1, N+2, N+3** |
| Recomendacoes | Nenhuma | Acoes automaticas por estado |
| Dashboard | Lista de metricas | Narrativa executiva + prova do algoritmo |

### Algoritmo V2 - Passo a passo

#### Etapa 1: Coleta de SAs liberadas
Para cada versao desde fev/2022, coletamos SAM, SAL e SAIL liberadas na area Escrita.

#### Etapa 2: Calculo de carga ponderada
Cada SA recebe um peso composto:
```
Carga = peso_faixa * peso_tipo * peso_desvio * peso_abrangencia
```

| Componente | Valores |
|-----------|---------|
| `peso_faixa` | Baixa=1 (ate 2h), Media=2 (2-8h), Alta=4 (8-40h), Muito Alta=8 (+40h) |
| `peso_tipo` | SAM=1.0, SAL=1.3, SAIL=1.5 |
| `peso_desvio` | tempoReal/tempoPrevisto, limitado [0.5, 2.5] |
| `peso_abrangencia` | 1 + min(qtde_ssc, 10) * 0.08 |

#### Etapa 3: Baseline por mediana movel
```
baseline = mediana(NE das ultimas 6 versoes)
```
Usamos mediana (nao media) para robustez contra outliers.

#### Etapa 4: Fator de ajuste por carga
```
fator = carga_atual / mediana(carga das ultimas 6 versoes)
fator = clamp(fator, 0.5, 2.0)
```

#### Etapa 5: Previsao final
```
NE_prevista = baseline * fator
intervalo = [percentil_25 * fator, percentil_75 * fator]
```

### Validacao do algoritmo

#### Backtest retroativo
Para cada versao historica (da 7a em diante), o modelo simula uma previsao
usando apenas dados disponiveis ate aquele ponto, e compara com o valor real.

Metricas:
- **MAPE**: Erro medio percentual absoluto
- **Acerto de direcao**: % de vezes que o modelo acertou se NE subiria ou desceria
- **Melhor/Pior previsao**: Versoes onde o modelo foi mais/menos preciso

#### Analise de volatilidade (multi-lag)
Algumas SAs podem impactar NEs em 2-3 versoes a frente (efeito cascata).
O modulo `volatilidade.js` calcula correlacao Spearman para cada defasagem:

| Defasagem | Significado |
|-----------|-------------|
| N+1 | Impacto direto na proxima versao |
| N+2 | Impacto residual 2 versoes a frente |
| N+3 | Impacto residual 3 versoes a frente |

**Dispersao**: Mede quanto do impacto se espalha alem de N+1.
- < 30%: Concentrado (modelo N+1 e adequado)
- 30-50%: Moderado (considerar ajustes)
- > 50%: Disperso (modelo multi-lag necessario)

### Como o algoritmo pode melhorar

1. Incluir analise multi-lag se dispersao > 30%
2. Ajustar pesos por tipo conforme dados historicos acumulados
3. Considerar sazonalidade (versoes de dezembro/janeiro)
4. Recalibrar janela de mediana conforme MAPE evolui
5. Acompanhar evolucao do MAPE ao longo do tempo

### Modulos

| Modulo | Responsabilidade | Linhas |
|--------|-----------------|--------|
| `coleta.js` | Queries SQL, cache disco, extracao registros | ~130 |
| `carga.js` | Classificacao faixa, calculo carga por SA | ~90 |
| `estatisticas.js` | Descritivas, winsoirzacao, percentis | ~65 |
| `correlacao.js` | Spearman, p-valor, analise correlacao | ~105 |
| `previsao.js` | Mediana movel, fator ajuste, backtest | ~140 |
| `qualidade.js` | Completude dados, alertas qualidade | ~70 |
| `recomendacoes.js` | Acoes automaticas por estado | ~110 |
| `volatilidade.js` | **Analise multi-lag N+1/N+2/N+3** | ~100 |
| `index.js` | Orquestrador + documentacao do algoritmo | ~130 |

### Dashboard (reestruturado)

1. **Resumo executivo** - Frase narrativa com a conclusao principal
2. **KPIs** - Versao atual: SAs, carga, complexidade, desvio, qualidade
3. **Graficos** - SAs por tipo, carga historica, doughnut de complexidade
4. **Impacto estimado** - Previsao de NE em linguagem executiva (sem jargao)
5. **Recomendacoes** - Acoes concretas ordenadas por prioridade
6. **Prova do Algoritmo** - Backtest visual (previsto vs real), volatilidade multi-lag, explicacao passo-a-passo
7. **Tabela detalhada** - Versoes com drill-down por SA individual

### API

```
GET /api/estudos/liberacoes-sa-v2?force=1
```

### Frontend (dividido em modulos)

| Arquivo | Responsabilidade | Linhas |
|---------|------------------|--------|
| `app-liberacoes-v2.js` | Orquestrador + Blocos 1-3 | ~190 |
| `app-liberacoes-v2-graficos.js` | Charts (tipo, carga, complex) | ~120 |
| `app-liberacoes-v2-prova.js` | Backtest + volatilidade + algoritmo | ~195 |
| `app-liberacoes-v2-tabela.js` | Tabela com drill-down | ~90 |
