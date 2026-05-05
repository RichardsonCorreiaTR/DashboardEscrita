# Diretrizes Individuais por Analista

> Metricas e metas individuais de cada analista da Escrita Fiscal.
> Documentacao completa das formulas: [metas-individuais.md](metas-individuais.md)

## Analistas
| # | Nome | Senioridade | Metas |
|---|------|-------------|-------|
| 2.1.1 | Laiz Velho de Almeida | Especialista | 4 (tempo-geracao, revisoes, ss, gerar-sai) |
| 2.1.2 | Ana Ligia Vanella Passarelli | Pleno (+Sr) | 4 (tempo-analise, pontos, revisoes, gerar-sai) |
| 2.1.3 | Flávia Felipe Cardoso | Junior | 3 (tempo-analise, pontos, revisoes) |
| 2.1.4 | Jessica Vieira Maximiano | Junior | 3 (tempo-analise, pontos, revisoes) |
| 2.1.5 | Mateus Alves | Junior | 3 (tempo-analise, pontos, revisoes) |

## API
- Resumo anual: `GET /api/metas-equipe/:slug`
- Detalhe mensal: `GET /api/metas-equipe/:slug/detalhe/:metaId/:mes`
- Config: `GET /api/metas-equipe/config`
- Suporta `?fonte=cache` para dados salvos em disco
