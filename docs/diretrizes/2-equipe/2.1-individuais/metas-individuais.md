# Metas Individuais da Equipe Escrita Fiscal - 2026

> Modulo implementado em `src/indicadores/equipe/` e `src/servidor/rotas/metas-equipe.js`.
> Configuracoes em `config/metas-equipe.json` e `config/equipe.json`.

## Metas por Senioridade

### Analista Jr / Pleno
| Meta | Valor | Fonte | Direcao |
|------|-------|-------|---------|
| Tempo trabalhado analise | >= 80% | Registro de Atividades | maior-melhor |
| Pontos definicao | >= 80 pts/mes | SAI/PSAI | maior-melhor |
| Indice revisoes NE | <= 0,60 | SAI/Revisoes | menor-melhor |

### Especialista
| Meta | Valor | Fonte | Direcao |
|------|-------|-------|---------|
| Tempo trabalhado geracao | >= 80% | Registro de Atividades | maior-melhor |
| Indice revisoes NE | <= 0,60 | SAI/Revisoes | menor-melhor |
| Respostas SS 3d | 100% | SS Tramites | maior-melhor |
| Gerar SAI NE 3d | 100% em <= 3d | PSAI Tramites | menor-melhor |

### Override: Ana Ligia (Pleno)
Acumula metas de Analista + `gerar-sai-ne-sal-3d` (responsabilidade Sr.).

## Fontes de Dados e Formulas

### Tempo Trabalhado (analise/geracao)
- **Tabela**: `bethadba.vanalise_registro_atividades`
- **Vinculo**: `v.i_usuarios` = `equipe.json.i-usuarios`
- **Formula**: `% = Tempo SAI-NE / (Total - Ausencias) x 100`
- **SAI-NE**: atividades com "NE", "SAI", "SS" ou "Vida" no nome
- **Ausencias excluidas**: Feriado, Ferias, Folga, Saida Particular, Afastamento

### Pontos Definicao
- **Tabelas**: `UP.SAI_PSAI` JOIN `bethadba.psai` JOIN `bethadba.sai`
- **Vinculo**: `psai.i_responsaveis` = `equipe.json.codigo-sgd`
- **Formula**: `SUM(sai.pontuacao)` das SAIs cadastradas no mes
- **Filtros**: area Escrita, tipoSAI NE, produto_grupo 1

### Indice Revisoes NE
- **Tabelas**: `UP.SAI_PSAI` + `bethadba.sai_revisoes` + `bethadba.sai_revisoes_motivos`
- **Vinculo analistas**: `psai.i_responsaveis` = `codigo-sgd`
- **Vinculo especialista**: `sai.i_usuarios` = `codigo-sgd`
- **Formula**: `Total revisoes (A/C) no mes / Total SAIs criadas no mes`
- **Numerador**: revisoes contadas pela **data da revisao** (`sai_revisoes.entrada`)
- **Denominador**: SAIs contadas pela **data de cadastro** (`CadastroSAI`)
- **Motivos A/C**: Alteracao na definicao (1,4), Complemento na definicao (2,5)
- **NAO considerar**: Formatacao (F=7), Outros (O=8), motivo 6 (A de outro tipo), E (3, inativo)
- **Nota**: uma revisao feita em janeiro para uma SAI de dezembro conta em janeiro (pelo campo `entrada`)

### Respostas SS 3 dias
- **Tabelas**: `bethadba.ss` JOIN `bethadba.ss_tramites`
- **Vinculo**: `ss_tramites.i_usuarios` = `equipe.json.i-usuarios`
- **Formula**: `% = SSs em <= 3 dias / Total respostas x 100`

### Gerar SAI NE / Retornar PSAI - 3 dias
- **Tabelas**: `bethadba.psai_tramites` JOIN `bethadba.psai` JOIN `UP.SAI_PSAI`
- **Vinculo**: `psai_tramites.i_usuarios` = `equipe.json.codigo-sgd`
- **Ciclo**: analista envia (sit=2 Analisada) -> coordenador responde (sit 4, 11 ou 12)
- **Formula**: `% = ciclos respondidos em <= 3 dias uteis / Total ciclos no mes x 100`
- **Dias uteis**: exclui sabados e domingos (SQL: `N - (N+DOW-2)/7 - (N+DOW-1)/7`)
- **Filtros**: NE Escrita, produto_grupo 1, primeiro tramite do coordenador apos sit=2
- **Nota**: multiplos ciclos por PSAI sao contados individualmente; sit=3 nao e usado em NE 2026

## Arquivos do Modulo

| Arquivo | Responsabilidade |
|---------|-----------------|
| `config/equipe.json` | Dados da equipe (nome, slug, senioridade, IDs) |
| `config/metas-equipe.json` | Definicoes de metas, templates por cargo, overrides |
| `src/indicadores/equipe/consultas-metas.js` | Queries SQL anuais (agrupadas por mes) |
| `src/indicadores/equipe/consultas-metas-detalhe.js` | Queries SQL de detalhe mensal |
| `src/indicadores/equipe/metas-anual.js` | Agregacao mensal + totalizador + calculo |
| `src/servidor/rotas/metas-equipe.js` | API REST com suporte ODBC/Cache |
| `src/core/cache-metas.js` | Cache em disco para metas |
| `src/servidor/public/js/format-utils.js` | Formatacao compartilhada |
| `src/servidor/public/js/metas-config.js` | Config frontend (carrega da API) |
| `src/servidor/public/js/equipes-mensal.js` | Tabelas mensais e totalizador |
| `src/servidor/public/js/equipes-detalhe.js` | Drill-down de registros |
| `src/servidor/public/js/app-equipes.js` | Orquestrador da pagina |
