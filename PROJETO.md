# Dashboard Diretrizes - Blueprint do Projeto

> Documento de referencia para o agente Cursor que vai construir este projeto.
> Criado em: 14/02/2026
> Autor da decisao arquitetural: Richardson Picinini Correia (coordenador Escrita Fiscal) + agente Cursor (conversa de planejamento)
> Consulte a secao relevante deste documento quando necessario. Leia-o inteiro APENAS para mudancas estruturais.
> Ele e a fonte de verdade do projeto.

---

## O QUE E ESTE PROJETO

Dashboard Diretrizes e um projeto Node.js **independente** para calcular indicadores de produto e equipe da Escrita Fiscal (Thomson Reuters/Betha), gerar dashboards interativos e relatorios estaticos compartilhaveis.

O projeto consulta **diretamente** o banco Sybase ASA 9.0 via ODBC (DSN: pbcvs9), calcula indicadores, mantem historico, e gera HTMLs para compartilhamento via OneDrive/Teams.

---

## POR QUE ESTE PROJETO EXISTE

Existia um projeto anterior (`pbcvs-consultas`) que tentava fazer tudo: extrair dados, gerar CSVs, calcular indicadores, servir dashboard, gerar relatorios. Os problemas foram:

### Problemas do projeto anterior
1. **server.js monolito de 2.111 linhas** - tudo empilhado em um arquivo
2. **Relatorios HTML saiam com zeros** - a cadeia CSV intermediaria quebrava (encoding, formato de datas, filtros case-sensitive) e ninguem sabia onde estava o problema
3. **Sem validacao** - se os dados zeravam, o relatorio era gerado com zeros sem nenhum alerta
4. **Sem historico** - CSVs sobrescritos diariamente, indicadores calculados nunca persistidos
5. **Arquitetura nao seguida** - guidelines pedidas pelo usuario nao eram respeitadas, arquivos acumulavam sem organizacao
6. **Camada CSV intermediaria desnecessaria** - extrair para CSV e depois parsear de volta introduzia pontos de falha evitaveis

### Decisoes tomadas
- **Projeto NOVO e independente** (nao e extensao do anterior)
- **Consulta direta via ODBC** (sem CSV intermediario)
- **Cada arquivo com UMA responsabilidade** (nenhum arquivo acima de 200 linhas)
- **Indicadores definidos pelo usuario do zero** (sem herdar premissas do projeto anterior)
- **Validacao obrigatoria** (nunca gerar relatorio com dados zerados sem explicar por que)
- **Historico persistido** (cache append-only para rastrear evolucao e entender mudancas)

---

## NOTA IMPORTANTE: PROCESSOS EXISTENTES

> Ao iniciar este projeto, os processos do `pbcvs-consultas` (queries automaticas, cron, exportacao CSV) devem ser **INTERROMPIDOS** para evitar concorrencia no banco ODBC.
> A **exclusao definitiva** do projeto anterior sera avaliada apos a conclusao do Dashboard Diretrizes.
> Manter o pbcvs-consultas parado mas intacto ate la.

---

## CONEXAO COM O BANCO

### Dados de conexao
| Parametro | Valor |
|-----------|-------|
| Banco | Sybase SQL Anywhere (ASA 9.0) |
| Conexao | ODBC via DSN |
| DSN | pbcvs9 |
| Usuario | marcelo |
| Senha | marcelo |
| Timeout conexao | 60s |
| Timeout query | 600s |

### Restricoes criticas do banco
1. **NUNCA usar `SELECT *`** em tabelas com campos TEXT/BLOB - causa travamento da conexao
2. **Campos perigosos** (long varchar): DESCRICAO, ANTECIPACOES, CORRECOES, situacao_descricao, comportamento, definicao, descricao_destaque, motivo_descricao
3. **Tabelas grandes**: usar paginacao (`TOP N START AT X`)
4. **JOIN entre gaGerenciadorAtividades e UDUSUARIOS**: usar `CAST(U.CODIGO_SGD AS INT)`, NAO `U.I_USUARIOS`
5. **Sempre listar colunas explicitamente** - nunca SELECT *, sempre SELECT col1, col2, col3
6. **Node.js PATH**: `$env:PATH = "C:\Program Files\nodejs;$env:PATH"` (obrigatorio no Windows)

### Owners/Schemas relevantes
| Owner | Uso |
|-------|-----|
| BETHADBA | Schema principal - tabelas de negocio |
| UP | Views de consolidacao (ex: SAI_PSAI) |
| DBA | Dados complementares |
| PIAZZA | Funcoes de datas de versao |

---

## PBCVS DISCOVERY - BASE DE CONHECIMENTO DO BANCO

O projeto **PBCVS Discovery** contem a documentacao completa do banco. Ele deve ser consultado SEMPRE que for necessario entender tabelas, colunas, relacionamentos ou montar queries.

### Localizacao
```
C:\Users\6038243\OneDrive - Thomson Reuters Incorporated\Aplicações Cursor\PBCVS Discovery
```

### Arquivos-chave para consulta

| Arquivo | Conteudo |
|---------|----------|
| `CONTEXTO.md` | Visao geral do banco e do negocio |
| `analise/MAPA-COMPLETO.md` | Todas as tabelas, volumes, star-schema, campos BLOB |
| `analise/RELACIONAMENTOS.md` | FKs reais e relacionamentos por convencao |
| `analise/GLOSSARIO-SGD.md` | Siglas (SAI, PSAI, NE, SSC, etc.) e significados |
| `analise/DUPLICACOES.md` | Tabelas duplicadas e o que descartar |
| `analise/DECISOES.md` | Decisoes de modelagem tomadas |
| `resultados/01-tabelas.json` | Inventario completo de tabelas |
| `resultados/02-colunas.json` | Inventario completo de colunas |
| `resultados/03-foreign-keys.json` | Foreign Keys do banco |
| `resultados/05-contagem.json` | Contagem de registros por tabela |
| `resultados/06-amostras.json` | Amostras de dados de cada tabela |
| `resultados/07-datas.json` | Analise de campos de data |
| `config/connection.json` | Configuracao de conexao ODBC |

### Como usar o Discovery para montar queries
1. Ler `MAPA-COMPLETO.md` para entender quais tabelas contem os dados necessarios
2. Ler `resultados/02-colunas.json` para saber nomes exatos das colunas
3. Ler `RELACIONAMENTOS.md` para saber como JOINar tabelas
4. Ler `GLOSSARIO-SGD.md` para entender siglas e termos do negocio
5. Verificar `resultados/06-amostras.json` para ver formato real dos dados (datas, valores)
6. Cruzar com campos BLOB em `MAPA-COMPLETO.md` para nunca incluir colunas perigosas

---

## CONTEXTO DO NEGOCIO

### Equipe Escrita Fiscal

Equipe: i_equipes = 12 | i_departamentos = 2 | i_area = 6

**Gerencia**
| Nome | Cargo |
|------|-------|
| Mariana Sartori | Gerente |

**Coordenadores**
| Nome | I_USUARIOS | CODIGO_SGD | Papel |
|------|------------|------------|-------|
| Richardson Correia | 73 | 6828 | coordenador |
| Marielli Neves | 186 | 110669 | coordenador |

**Equipe Richardson**
| Nome | I_USUARIOS | CODIGO_SGD | Senioridade |
|------|------------|------------|-------------|
| Victor Ferreira | 479 | 54762 | especialista |
| Giovani Cunha | 251 | 5867 | especialista |
| Jennifer Rodrigues | 91 | 79127 | especialista |
| Laís de Andrade | - | - | especialista |
| Carolina Esmeraldino | 947 | 501722 | senior |
| Bárbara De Melo Teixeira | 864 | 999820 | pleno |
| Daniela Stupp Ferreira | 778 | 427967 | pleno |
| Erick Pacheco Vicente | 1237 | 1306310 | pleno |
| Fabio Coral Sasso | 1192 | 769104 | pleno |
| Felipi Ferreira | 943 | 1059913 | pleno |
| Flávia Cardoso Felipe | 1282 | 1220798 | junior |
| Mateus Do Canto Alves | 1010 | 1116513 | junior |

**Equipe Marielli**
| Nome | I_USUARIOS | CODIGO_SGD | Senioridade |
|------|------------|------------|-------------|
| Bruna Ferro | 191 | 119694 | especialista |
| Patricia Costa | 181 | 108955 | especialista |
| Bárbara Leite | 952 | 1069309 | pleno |
| Juliana Kuerten Guizoni | 771 | 865290 | pleno |
| Renan das Neves Maiato | 890 | 1025089 | pleno |
| Gabriely Marques Jesuina | 1284 | 1079572 | junior |
| Laysa Gabriela da Silva Daleffe Barbosa | 1309 | 1242239 | junior |
| Rafaela Gubert Ribeiro | 620 | 1146992 | junior |
| Rafaela Silva Sampaio | 1244 | 1317326 | junior |
| Sabrina Neves | 944 | 1061056 | junior |
| Vinicyos Gonçalves Magnus | 1283 | 1382400 | junior |

### Fluxo do SGD (workflow de demandas)
```
SSC/SA/NE (entrada pelo suporte)
    |
  PSAI (pre-analise pelo time de produto)
    |
  SAI (Solicitacao de Alteracao Interna - em desenvolvimento)
    |
  Estimativas → Tramitacao → Roteiro Dev → Roteiro Testes
    |
  Liberacao em Versao (ou descarte)
```

Paralelo: colaboradores registram tempo no **Gerenciador de Atividades** (gaGerenciadorAtividades).

### Tabelas centrais do banco para indicadores

**Fatos (tabelas grandes, dados transacionais)**
| Tabela | Registros | Descricao |
|--------|-----------|-----------|
| UP.SAI_PSAI | ~160.000 | View principal: liga PSAI a SAI com todos os dados |
| bethadba.sai_tramites | 2.511.399 | Historico de tramitacao de SAIs |
| bethadba.psai_tramites | 581.193 | Historico de tramitacao de PSAIs |
| bethadba.gaGerenciadorAtividades | 5.042.683 | Registro de tempo dos colaboradores |
| bethadba.sai_roteiro_testes | 723.000 | Roteiros de teste por SAI |
| bethadba.sai_roteiro_desenvolvimento | 674.000 | Roteiros de dev por SAI |
| bethadba.sai_responsaveis | 438.000 | Responsaveis por SAI |
| bethadba.sai_classif | 96.000 | Classificacoes de SAIs |
| bethadba.sai_versoes | 91.000 | Versoes associadas a SAIs |
| bethadba.sgd_retornos_testes | 188.000 | Retornos de teste |

**Dimensoes (tabelas pequenas, cadastros)**
| Tabela | Registros | Descricao |
|--------|-----------|-----------|
| bethadba.sistemas | 208 | Sistemas (Folha, EF, CT, etc.) |
| bethadba.modulos | 4.024 | Modulos de cada sistema |
| bethadba.area | 22 | Areas (Folha, Escrita Fiscal, etc.) |
| bethadba.GAVERSOES | 4.878 | Versoes de software |
| bethadba.UDUSUARIOS | 1.094 | Usuarios do SGD |
| bethadba.equipes | 24 | Equipes |
| bethadba.GASAI_SITUACOES | 211 | Situacoes possiveis de SAI |
| bethadba.psai_situacoes | 34 | Situacoes possiveis de PSAI |
| bethadba.GAATIVIDADES | 588 | Tipos de atividade |
| bethadba.sai_causas_retornos | 20 | Causas de retornos |
| bethadba.sai_tramite_motivos | 177 | Motivos de tramite |

### Funcoes especiais do banco
- `PIAZZA.FG_GET_DATA_INICIO_VERSAO(i_versoes, i_sistemas)` - retorna data inicio de uma versao
- `PIAZZA.FG_GET_DATA_FIM_VERSAO(i_versoes, i_sistemas)` - retorna data fim de uma versao

---

## ORGANIZACAO DAS DIRETRIZES (DOCUMENTACAO VIVA)

> **IMPORTANTE**: O usuario vai definir CADA diretriz do zero durante a construcao.
> NAO existe nenhuma definicao previa de metas ou formulas.
> O agente deve PERGUNTAR ao usuario sobre cada diretriz antes de implementar.
> As diretrizes serao explicadas uma a uma pelo usuario.

### Estrutura documental obrigatoria

Cada diretriz DEVE ter sua documentacao propria. A pasta `docs/diretrizes/` e o repositorio de conhecimento do projeto. Esta pasta e **tao importante quanto o codigo** - sem ela o projeto perde sentido.

```
docs/
├── diretrizes/
│   ├── README.md                            ← Indice geral de todas as diretrizes
│   │
│   ├── 1-produto/                           ← Diretrizes do Produto (gerais)
│   │   ├── README.md                        ← Indice das diretrizes de produto
│   │   ├── 1.1-[nome-diretriz-a].md         ← Diretriz A detalhada
│   │   ├── 1.2-[nome-diretriz-b].md         ← Diretriz B detalhada
│   │   ├── 1.3-[nome-diretriz-c].md         ← Diretriz C detalhada
│   │   └── 1.4-controladas-coordenacao/     ← Diretrizes que sao do produto mas controladas pelo Vitor
│   │       ├── README.md
│   │       ├── 1.4.1-[nome].md
│   │       └── 1.4.2-[nome].md
│   │
│   ├── 2-equipe/                            ← Diretrizes da Equipe
│   │   ├── README.md                        ← Indice das diretrizes de equipe
│   │   ├── 2.1-individuais/                 ← Diretrizes Individuais por analista
│   │   │   ├── README.md
│   │   │   ├── 2.1.1-laiz-velho.md
│   │   │   ├── 2.1.2-ana-ligia.md
│   │   │   ├── 2.1.3-flavia-felipe-cardoso.md
│   │   │   ├── 2.1.4-jessica-maximiano.md
│   │   │   └── 2.1.5-mateus-alves.md
│   │   └── 2.2-[nome-diretriz-equipe].md
│   │
│   └── 3-estudos/                           ← Estudos adicionais (nao vinculados a diretriz)
│       ├── README.md
│       └── [nome-do-estudo].md              ← Analises exploratórias, deep-dives
```

### Conteudo obrigatorio de cada arquivo de diretriz

Cada arquivo `.md` de diretriz DEVE seguir este modelo:

```markdown
# [Numero] [Nome da Diretriz]

## Identificacao
- **Categoria**: Produto / Equipe / Individual
- **Responsavel**: [quem responde por esta diretriz]
- **Data de criacao**: [quando foi definida]
- **Periodicidade de revisao**: Mensal / Quinzenal / Semanal
- **Stakeholders**: [quem se interessa por esta diretriz]

## Descricao
[O que esta diretriz mede e por que ela existe. Contexto do negocio.]

## Meta
- **Meta quantitativa**: [valor numerico ou faixa]
- **Baseline**: [valor de referencia / ponto de partida]
- **Target**: [onde se quer chegar]
- **Prazo**: [ate quando]
- **Unidade**: [%, quantidade, minutos, dias, etc.]

## Calculo
- **Formula**: [como o valor e calculado, passo a passo]
- **O que e considerado**: [quais registros entram no calculo, filtros]
- **O que NAO e considerado**: [exclusoes, excecoes]
- **Fonte de dados**: [tabelas do banco, queries]

## Semaforo
- **Verde**: [criterio]
- **Amarelo**: [criterio]
- **Vermelho**: [criterio]

## Analises pertinentes
[Que cruzamentos, drill-downs ou decomposicoes ajudam a entender esta diretriz?]
- [Ex: quebrar por analista, por modulo, por semana, por gravidade]
- [Ex: correlacionar com outra diretriz]
- [Ex: comparar com versoes anteriores]

## Dados adicionais que enriquecem
[Dados do banco que nao fazem parte do calculo principal mas ajudam na analise]

## Aplicacao em gestao (GPD / RDM / PDCA)
- **GPD (Gerenciamento pelas Diretrizes)**: Como esta diretriz se desdobra em acoes?
- **RDM (Reuniao de Monitoramento)**: O que reportar? Qual a frequencia?
- **PDCA**: 
  - Plan: O que foi planejado para esta diretriz?
  - Do: Quais acoes foram executadas?
  - Check: Como verificar se esta funcionando?
  - Act: O que ajustar se nao estiver funcionando?

## Progresso atual
- **Status**: [Em definicao / Ativo / Suspenso]
- **Ultima atualizacao**: [data]
- **Bloqueios**: [o que impede avanco, se houver]

## Historico de decisoes
[Registro de mudancas na definicao, formula ou meta desta diretriz]
- [Data] - [O que mudou e por que]
```

### Framework de pensamento para cada diretriz

Antes de implementar QUALQUER diretriz, o agente deve percorrer esta checklist mental:

| Categoria | Inputs que o agente precisa coletar com o usuario |
|-----------|---------------------------------------------------|
| **Identificacao** | Nome da diretriz, categoria (produto/equipe/individual), responsavel, data de criacao |
| **Metas** | Meta quantitativa, prazo, baseline (ponto de partida), target (onde quer chegar) |
| **Progresso** | Status atual (%), ultima atualizacao, bloqueios |
| **Priorizacao** | Nivel de urgencia, impacto no negocio, dependencias com outras diretrizes |
| **Contexto** | Descricao, justificativa, stakeholders envolvidos, historico |
| **Periodicidade** | Frequencia de revisao, alertas/lembretes, janela de calculo |
| **Calculo** | Formula, filtros, exclusoes, fonte de dados, validacoes |
| **Analise** | Decomposicoes uteis, correlacoes, dados adicionais |
| **Gestao** | Aplicacao em GPD, RDM, PDCA |

O agente NAO deve implementar uma diretriz ate ter todos esses inputs (ou ate o usuario dizer explicitamente "isso nao se aplica aqui").

### O que se sabe ate agora (escopo geral)
- Existem diretrizes de **produto** (gerais e controladas pela coordenacao)
- Existem diretrizes de **equipe** (coletivas e individuais por analista)
- Existem **estudos adicionais** (analises exploratórias nao vinculadas a diretriz especifica)
- As metas podem ser mensais e/ou anuais
- A apresentacao e organizada por **versao** de software (cada versao tem periodo com data inicio e data fim)
- A organizacao documental e tao importante quanto o dashboard em si

---

## CACHE E HISTORICO

O cache neste projeto tem **duas funcoes distintas**:

### 1. Cache de performance
- Evitar consultar o banco a cada request HTTP
- TTL configuravel por indicador (ex: dados de saldo = 30min, dimensoes = 24h)
- Invalidacao manual disponivel via API

### 2. Cache historico (rastreamento de mudancas)
- Registrar o valor de cada indicador a cada calculo
- Formato: arquivo JSONL (uma linha JSON por registro, append-only, nunca sobrescreve)
- Permite: "qual era o saldo de NE dia 10/02?" ou "por que o indicador mudou de ontem pra hoje?"
- O historico e a memoria do projeto - NUNCA deve ser perdido ou sobrescrito

### Estrutura do historico
```jsonl
{"ts":"2026-02-14T10:00:00","indicador":"saldo-ne","versao":"10.6A-02","valor":287,"meta":301,"status":"verde","detalhes":{...}}
{"ts":"2026-02-14T10:00:00","indicador":"liberacoes","versao":"10.6A-02","valor":12,"meta":30,"status":"vermelho","detalhes":{...}}
{"ts":"2026-02-15T10:00:00","indicador":"saldo-ne","versao":"10.6A-02","valor":289,"meta":301,"status":"verde","detalhes":{...}}
```

---

## ARQUITETURA DO PROJETO

### Principios obrigatorios
1. **Nenhum arquivo acima de 200 linhas** - se passar, dividir
2. **Cada arquivo tem UMA responsabilidade** - nao misturar calculo com rota com template
3. **Cada indicador e UM arquivo** em `src/indicadores/{categoria}/`
4. **Cada indicador exporta interface padrao**: id, nome, categoria, fontes, calcular()
5. **calcular() SEMPRE retorna**: { valor, meta, pct, status, validacao }
6. **NUNCA gerar relatorio com dados zerados sem validacao** - mostrar banner de erro
7. **Templates HTML sao componentes** reutilizaveis (header, card, tabela, grafico)
8. **CSS fica em UM arquivo** reutilizado por todos os relatorios
9. **Rotas Express ficam em arquivos separados** por dominio (indicadores, relatorios, historico)
10. **NUNCA colocar logica de calculo dentro de rotas ou templates**

### Regras de arquitetura detalhadas (.cursor/rules)

O agente DEVE criar e manter os arquivos `.mdc` abaixo desde o inicio do projeto. Eles sao a lei viva do codigo e devem ser atualizados conforme o projeto evolui.

#### Estrutura obrigatoria de .cursor/rules/
```
.cursor/rules/
├── projeto.mdc              ← Visao geral, contexto, o que o projeto faz
├── tech-stack.mdc           ← Tecnologias usadas (Node.js, Express, ODBC, Chart.js CDN, etc.)
├── architecture.mdc         ← Padrao arquitetural, separacao de camadas, fluxo de dados
├── naming-conventions.mdc   ← Padroes de nomeacao de arquivos, variaveis, funcoes, classes
├── indicadores.mdc          ← Registro de cada indicador (preenchido durante construcao)
├── relatorios.mdc           ← Convencoes visuais de dashboards e relatorios
├── negocio.mdc              ← Regras de negocio aprendidas (SGD, PSAI, SAI, fluxo, termos)
└── duvidas.mdc              ← Registro de duvidas pendentes e decisoes em aberto
```

#### Conteudo esperado de cada .mdc

**projeto.mdc** - Deve conter:
- O que o projeto faz (1 paragrafo)
- Quem usa (Vitor, equipe Escrita Fiscal)
- Onde mora (caminhos de pastas)
- Como rodar
- Referencia ao PBCVS Discovery

**tech-stack.mdc** - Deve conter:
- Runtime: Node.js (adicionar ao PATH: `$env:PATH = "C:\Program Files\nodejs;$env:PATH"`)
- Servidor: Express (minimo de middleware)
- Banco: Sybase ASA 9.0 via ODBC (DSN: pbcvs9)
- Graficos: Chart.js via CDN (nenhuma lib pesada)
- Dependencias npm aceitas e suas versoes

**architecture.mdc** - Deve conter:
- Diagrama de camadas (core → indicadores → relatorios → servidor)
- Regra de dependencia: camadas superiores dependem das inferiores, NUNCA o contrario
- Fluxo de dados: banco → query-executor → cache → indicador → gerador → output
- Nenhuma camada pode pular outra (ex: rota nao pode acessar banco diretamente)

**naming-conventions.mdc** - Deve conter:
- Arquivos: kebab-case (ex: `saldo-ne.js`, `date-utils.js`)
- Variaveis e funcoes: camelCase (ex: `calcularSaldo`, `totalEntradas`)
- Constantes: UPPER_SNAKE_CASE (ex: `MAX_CACHE_TTL`, `ODBC_TIMEOUT`)
- Pastas: kebab-case (ex: `src/indicadores/produto/`)
- Configs JSON: kebab-case para chaves (ex: `"cache-ttl": 1800000`)
- Indicadores: id em kebab-case (ex: `saldo-ne`, `tempo-correcao`)

### Boas praticas de codigo obrigatorias

1. **Funcional > OO** - Preferir funcoes puras e modulos. Evitar classes a nao ser que a complexidade exija
2. **Funcoes pequenas** - Maximo 30 linhas por funcao. Se passar, extrair subfuncoes
3. **Buscar antes de criar** - Antes de criar qualquer funcao, verificar se ja existe algo similar no projeto
4. **Documentacao inline** - Toda funcao publica deve ter comentario JSDoc explicando: o que faz, parametros, retorno
5. **Tratamento de erros explicito** - Todo catch deve logar E propagar o erro de forma util
6. **Sem magic numbers** - Usar constantes nomeadas (ex: `const CACHE_TTL_30MIN = 30 * 60 * 1000`)
7. **Imports organizados** - Primeiro node built-in, depois npm, depois modulos locais, separados por linha em branco

### .cursorignore obrigatorio

Criar `.cursorignore` na raiz para que a IA nao indexe lixo:
```
node_modules/
data/historico.jsonl
output/arquivo/
logs/
*.log
```

### Estrutura de pastas
```
Dashboard Diretrizes/
|
├── config/
│   ├── conexao.json             ← dados ODBC (DSN, usuario, timeouts)
│   ├── equipe.json              ← analistas Escrita Fiscal
│   └── indicadores.json         ← registro de indicadores ativos e suas configs
|
├── docs/
│   └── diretrizes/
│       ├── README.md            ← Indice geral de todas as diretrizes
│       ├── 1-produto/           ← Diretrizes do Produto
│       │   ├── README.md
│       │   ├── 1.1-[nome].md
│       │   └── 1.4-controladas-coordenacao/
│       ├── 2-equipe/            ← Diretrizes da Equipe
│       │   ├── README.md
│       │   └── 2.1-individuais/
│       │       ├── 2.1.1-laiz-velho.md
│       │       └── ...
│       └── 3-estudos/           ← Estudos adicionais (analises exploratórias)
│           └── README.md
|
├── src/
│   ├── core/
│   │   ├── conexao.js           ← conexao ODBC propria (DSN: pbcvs9)
│   │   ├── query-executor.js    ← executa queries com tratamento de erro e retry
│   │   ├── cache.js             ← cache em memoria + persistencia em disco
│   │   ├── date-utils.js        ← parse de datas robusto (multiplos formatos)
│   │   └── validator.js         ← validacao de dados (nunca mais zeros silenciosos)
│   |
│   ├── indicadores/
│   │   ├── index.js             ← registra e expoe todos os indicadores
│   │   ├── produto/             ← indicadores de produto (um arquivo por indicador)
│   │   └── equipe/              ← indicadores de equipe/individual
│   |
│   ├── estudos/
│   │   ├── semanas.js            ← divisao do periodo da versao em S1-S4
│   │   ├── analise-semanal-ne.js ← analise semanal de NE por versao
│   │   ├── analise-historica-ne.js ← analise historica agregada (2022+), ISV
│   │   └── liberacoes-sa.js      ← liberacoes SA (SAM/SAL/SAIL) por versao
│   |
│   ├── historico/
│   │   ├── registrador.js       ← salva indicadores calculados (append-only JSONL)
│   │   └── consulta.js          ← consulta historico, compara periodos
│   |
│   ├── relatorios/
│   │   ├── gerador.js           ← motor de geracao (generico, usa templates)
│   │   ├── templates/
│   │   │   ├── produto.html     ← template do relatorio de produto
│   │   │   ├── equipe.html      ← template do relatorio de equipe
│   │   │   ├── individual.html  ← template do relatorio individual
│   │   │   └── componentes/
│   │   │       ├── header.html
│   │   │       ├── card.html
│   │   │       ├── tabela.html
│   │   │       └── semaforo.html
│   │   └── estilos/
│   │       └── dashboard.css    ← CSS unico reutilizado por todos
│   |
│   ├── publicador/
│   │   ├── index.js             ← orquestra publicacao
│   │   ├── onedrive.js          ← copia para pasta OneDrive compartilhada
│   │   └── manifesto.js         ← registra tudo que foi publicado (quando, o que, onde)
│   |
│   └── servidor/
│       ├── app.js               ← Express enxuto (porta 4000, rotas + static)
│       ├── rotas/
│       │   ├── indicadores.js   ← GET /api/indicadores/*, GET /api/versao/*
│       │   ├── estudos.js       ← GET /api/estudos/* (semanal, historico, liberacoes)
│       │   └── historico.js     ← GET /api/historico/*
│       └── public/
│           ├── index.html       ← hub principal (links para diretrizes e estudos)
│           ├── diretrizes.html  ← dashboard de diretrizes/indicadores
│           ├── estudos.html     ← dashboard de estudos e analises
│           ├── css/
│           │   └── app.css
│           └── js/
│               ├── nav.js       ← navegacao lateral (sidebar)
│               ├── api.js       ← cliente HTTP para a API REST
│               ├── app-diretrizes.js ← logica do dashboard de diretrizes
│               ├── app-estudos.js    ← logica do dashboard de estudos
│               ├── detalhes.js       ← renderizacao de detalhes dos indicadores
│               └── charts.js         ← graficos Chart.js
|
├── data/
│   ├── historico.jsonl           ← indicadores calculados (append-only)
│   └── manifesto.json            ← registro de relatorios publicados
|
├── output/
│   ├── latest/                   ← relatorios mais recentes (sobrescreve)
│   │   ├── produto.html
│   │   ├── equipe.html
│   │   └── individual/
│   └── arquivo/                  ← relatorios historicos (nunca sobrescreve)
│       └── 2026-02/
|
├── .cursor/
│   └── rules/
│       ├── projeto.mdc           ← visao geral, contexto, como rodar
│       ├── tech-stack.mdc        ← tecnologias (Node.js, Express, ODBC, Chart.js)
│       ├── architecture.mdc      ← padrao arquitetural, camadas, fluxo de dados
│       ├── naming-conventions.mdc ← padroes de nomeacao
│       ├── indicadores.mdc       ← formulas e fontes (preenchido durante construcao)
│       ├── relatorios.mdc        ← convencoes visuais de geracao
│       ├── negocio.mdc           ← regras de negocio aprendidas (SGD, PSAI, SAI)
│       └── duvidas.mdc           ← duvidas pendentes e decisoes em aberto
|
├── .cursorignore                 ← evita indexacao de node_modules, logs, data
├── package.json
├── start.bat
└── README.md
```

### Interface padrao de um indicador
```javascript
// Exemplo: src/indicadores/produto/saldo-ne.js
module.exports = {
  id: 'saldo-ne',
  nome: 'Saldo NE',
  categoria: 'produto',

  // Quais dados do banco este indicador precisa
  // O agente deve consultar o PBCVS Discovery para montar queries otimizadas
  query: `
    SELECT
      sp.i_psai, sp.i_sai, sp.nomeVersao,
      sp.CadastroPSAI, sp.Liberacao, sp.Descarte,
      sp.i_sai_situacoes, sp.ne_prevencao, sp.nomeArea, sp.tipoSAI
    FROM UP.SAI_PSAI sp
    WHERE sp.nomeArea = 'Escrita'
      AND sp.tipoSAI = 'NE'
  `,

  // TTL do cache de performance (ms)
  cacheTTL: 30 * 60 * 1000, // 30 minutos

  // Funcao de calculo - recebe dados brutos, retorna indicador padronizado
  async calcular(executor, opcoes) {
    const dados = await executor.executar(this.query);

    // VALIDACAO OBRIGATORIA
    if (dados.length === 0) {
      return {
        valor: null,
        meta: null,
        pct: null,
        status: 'erro',
        validacao: {
          ok: false,
          registros_lidos: 0,
          problemas: ['Nenhum registro retornado - verificar filtros ou conexao']
        }
      };
    }

    // ... calculo do indicador ...

    return {
      valor: saldo,
      meta: opcoes.meta || null,
      pct: opcoes.meta ? (saldo / opcoes.meta * 100) : null,
      status: determinarSemaforo(saldo, opcoes.meta),
      detalhes: { entradas, liberadas, descartadas, pendentes },
      validacao: {
        ok: true,
        registros_lidos: dados.length,
        registros_usados: registrosValidos,
        avisos: []
      }
    };
  }
};
```

---

## RELATORIOS E COMPARTILHAMENTO

### Tipos de saida

| Tipo | Destino | Interatividade | Formato |
|------|---------|----------------|---------|
| Dashboard interativo | localhost (servidor local) | Filtros, drill-down, tempo real | HTML + JS + CSS |
| Relatorio estatico | OneDrive / email / Teams | Abas via CSS puro (zero JS) | HTML + CSS inline |
| Manifesto | `data/manifesto.json` | - | JSON |

### Relatorio estatico - regras
1. HTML 100% autossuficiente (CSS inline, zero JS, zero dependencia externa)
2. Abre em qualquer navegador, qualquer dispositivo
3. Funciona offline
4. Gerado a partir de templates + dados calculados (nunca string concatenation manual)
5. Sempre inclui: data/hora de geracao, versao, periodo, quantidade de registros usados
6. Se houver problema de validacao, mostra BANNER DE ERRO em vez de dados zerados

### Fluxo de publicacao
```
Indicadores calculados
    |
  Gerador monta HTML (templates + dados)
    |
  Validador confere (valores nao-zero, datas validas)
    |
  ├── output/latest/ (sobrescreve ultimo)
  ├── output/arquivo/YYYY-MM/ (historico imutavel)
  └── OneDrive (pasta compartilhada, link para Teams)
    |
  Manifesto registra: arquivo, data, indicadores incluidos, status validacao
```

### Pasta OneDrive para compartilhamento
```
C:\Users\6038243\OneDrive - Thomson Reuters Incorporated\Extração Dados NE
```
(Ou subpasta a definir com o usuario)

---

## PERFORMANCE

Prioridade: **rapidez e performance na maquina do usuario**.

### Estrategias
1. **Queries cirurgicas** - somente colunas necessarias, com WHERE restritivo
2. **Cache agressivo** - nao consultar o banco se o cache ainda e valido
3. **Calculo sob demanda** - indicadores calculados quando solicitados, nao em background constante
4. **Servidor Express leve** - sem middleware desnecessario
5. **Sem bibliotecas pesadas** - Chart.js via CDN para graficos, nada mais
6. **Dependencias minimas** - odbc (conexao), express (servidor), e pouco mais

---

## ORDEM DE CONSTRUCAO SUGERIDA

### Fase 0: Fundacao
1. **Estrutura de pastas completa** - todas as pastas, incluindo docs/diretrizes/
2. **package.json** com dependencias minimas
3. **.cursor/rules/** - todos os .mdc iniciais (projeto, tech-stack, architecture, naming-conventions, negocio, duvidas)
4. **.cursorignore** - configurado desde o inicio
5. **config/** - conexao.json, equipe.json
6. **docs/diretrizes/README.md** - indice geral (vazio, sera preenchido)

### Fase 1: Core funcional
7. **core/conexao.js** - conexao ODBC testada e funcionando
8. **core/query-executor.js** - executa queries com retry e log
9. **core/date-utils.js** - parse de datas robusto
10. **core/validator.js** - validacao obrigatoria
11. **core/cache.js** - cache de performance + persistencia

### Fase 2: Primeira diretriz completa (ponta a ponta)
12. **Usuario define a primeira diretriz** - agente coleta todos os inputs (framework completo)
13. **docs/diretrizes/[categoria]/[diretriz].md** - documentacao completa da diretriz
14. **src/indicadores/[categoria]/[diretriz].js** - calculo implementado
15. **historico/registrador.js** - persiste o resultado (JSONL)
16. **Teste ponta a ponta** - query → calculo → validacao → historico

### Fase 3: Visualizacao
17. **relatorios/estilos/dashboard.css** - CSS unico
18. **relatorios/templates/componentes/** - header, card, tabela, semaforo
19. **relatorios/gerador.js** - motor de geracao
20. **Primeiro relatorio estatico funcional** - HTML que abre no navegador com dados reais
21. **publicador/** - salva em output/latest + output/arquivo + OneDrive

### Fase 4: Dashboard interativo
22. **servidor/app.js** - Express enxuto
23. **servidor/rotas/** - APIs de indicadores, relatorios, historico
24. **servidor/public/** - SPA com dashboard interativo

### Fase 5: Demais diretrizes
25. **Uma por uma** - cada diretriz passa pelo framework completo (documentacao → calculo → visualizacao)
26. **negocio.mdc atualizado** a cada diretriz aprendida
27. **Estudos adicionais** conforme necessidade

Em CADA etapa, o usuario valida antes de avancar para a proxima.
O agente DEVE perguntar se esta tudo ok antes de seguir.

---

## PROJETOS RELACIONADOS

| Projeto | Localizacao | Status | Relacao |
|---------|-------------|--------|---------|
| PBCVS Discovery | `...\Aplicações Cursor\PBCVS Discovery` | Concluido | Base de conhecimento do banco (consultar para queries) |
| PBCVS Extrator | `...\Aplicações Cursor\PBCVS Extrator` | Interrompido | Exportacao CSV - nao usar, substituido por este projeto |
| pbcvs-consultas | `C:\Users\6038243\pbcvs-consultas` | A interromper | Dashboard anterior - sera avaliado para exclusao |
| Banco PBCVS | `...\Aplicações Cursor\Banco PCBCVS` | - | SQLite criado pelo Extrator - nao usar |

---

## REGRAS PARA O AGENTE

### Regras tecnicas
1. **Sempre responder em portugues do Brasil**
2. **Sempre consultar o PBCVS Discovery antes de montar queries SQL**
3. **Nunca assumir formulas ou metas** - perguntar ao usuario
4. **Nunca gerar arquivo acima de 200 linhas** - dividir
5. **Nunca usar SELECT *** - sempre listar colunas
6. **Nunca gerar relatorio com dados zerados** sem banner de erro explicando o motivo
7. **Registrar no historico** toda vez que um indicador for calculado
8. **Testar a conexao ODBC** antes de qualquer query
9. **Adicionar Node.js ao PATH** antes de executar: `$env:PATH = "C:\Program Files\nodejs;$env:PATH"`
10. **Nao duplicar o que ja existe no Discovery** - referenciar, nao copiar
11. **Manter .cursor/rules/ atualizado** - toda decisao arquitetural ou regra de negocio aprendida deve ser registrada nos .mdc
12. **Atualizar negocio.mdc** sempre que aprender algo novo sobre o SGD, fluxo de trabalho ou termos

### Regras de comunicacao (CRITICO)

O agente DEVE se comunicar proativamente com o usuario:

1. **Na duvida, PERGUNTE** - Se sentir que falta clareza sobre uma regra de negocio, formula, comportamento esperado, ou qualquer decisao: PARE e pergunte ao usuario. Nunca assuma.
2. **Registre duvidas em duvidas.mdc** - Se surgir uma duvida que nao e bloqueante no momento, registre em `.cursor/rules/duvidas.mdc` com data e contexto para ser resolvida depois.
3. **Sinalize riscos** - Se identificar que uma decisao pode causar problema futuro (performance, manutencao, dados incorretos), avise o usuario ANTES de implementar.
4. **Explique o que precisa** - Se o agente precisar de mais contexto para fazer um bom trabalho (um arquivo a mais, uma explicacao, um exemplo de dado), ele deve dizer ao usuario exatamente o que precisa e por que.
5. **Reporte o que aprendeu** - Ao final de cada interacao significativa, o agente deve resumir o que entendeu e registrar em negocio.mdc.

### A IA como analista de negocio (nao apenas construtora)

Este projeto exige que a IA va **alem de construir codigo**. Ela deve:

1. **Aprender o negocio** - Entender profundamente o SGD, o fluxo PSAI→SAI→Versao, como o time Escrita Fiscal trabalha, quais sao as dores do setor, o que significa cada metrica de gestao a vista. O arquivo `negocio.mdc` e o local onde esse conhecimento se acumula.

2. **Atuar na analise** - Quando um indicador for calculado, a IA nao deve apenas mostrar o numero. Deve interpretar: "o saldo subiu 15% em uma semana, isso e normal?" / "a taxa de liberacao caiu, pode ser por causa de X". A IA deve ser capaz de levantar hipoteses e sugerir investigacoes.

3. **Sugerir melhorias** - Se a IA perceber que um indicador poderia ser enriquecido com dados adicionais do banco (que ela conhece via Discovery), deve sugerir.

4. **Pedir o que precisa para evoluir** - Se para analisar melhor a IA precisar de:
   - Um arquivo de regras de negocio mais detalhado → pedir ao usuario
   - Amostras de dados reais → propor uma query para coletar
   - Contexto historico → pedir ao usuario que explique como era antes
   - Um agente/prompt especializado → sugerir a criacao
   - Uma LLM mais capaz para analise profunda → informar o usuario
   A IA deve ter clareza do que precisa e comunicar isso.

5. **Documentar o que aprendeu** - Toda regra de negocio, excecao, caso especial ou insight deve ser registrado em `negocio.mdc` para que conversas futuras nao percam esse conhecimento.

### Fontes de aprendizado do negocio

Para entender o SGD e as dores do setor, o agente deve:
1. Ler `PBCVS Discovery/CONTEXTO.md` e `GLOSSARIO-SGD.md` (terminologia)
2. Ler `PBCVS Discovery/analise/MAPA-COMPLETO.md` (estrutura de dados)
3. Ler `PBCVS Discovery/analise/RELACIONAMENTOS.md` (como as coisas se conectam)
4. Perguntar ao Vitor sobre cada diretriz quando for implementa-la
5. Registrar tudo em `negocio.mdc` de forma organizada

---

## ESCALABILIDADE - POC PARA OUTROS MODULOS

### Este projeto e uma POC (Prova de Conceito)

O Dashboard Diretrizes comeca focado na **Escrita Fiscal**, mas deve ser construido de forma que **possa ser ampliado para outros modulos** (Contabilidade, etc.) no futuro.

### Regras de escalabilidade
1. **Nenhum valor hardcoded** de equipe, area ou modulo - tudo vem de `config/`
2. **Equipe e area sao parametros**, nao constantes no codigo
3. **A estrutura de indicadores e generica** - o motor de calculo, cache, historico e publicacao funcionam para QUALQUER indicador, nao so da Escrita Fiscal
4. **Os templates HTML sao reutilizaveis** - o componente `card.html` funciona para qualquer metrica
5. **O config/ e o ponto de extensao** - para adicionar outro modulo, basta criar novos arquivos de config e indicadores, sem mexer no core

### Estrutura pensada para multi-modulo (futuro)
```
config/
├── modulos/
│   ├── escrita-fiscal.json    ← config da Escrita Fiscal (equipe, area, filtros) — legado: equipe.json
│   ├── escrita-fiscal.json    ← (futuro) config da EF
│   └── contabilidade.json     ← (futuro) config da CT

src/indicadores/
├── produto/                   ← indicadores genericos de produto (funcionam para qualquer modulo)
├── equipe/                    ← indicadores genericos de equipe
├── escrita-fiscal/            ← indicadores ESPECIFICOS da Escrita Fiscal (se houver)

docs/diretrizes/               ← cada modulo teria sua propria arvore de diretrizes
```

### Para ceder o projeto a outra area
O que a outra area precisaria configurar:
1. Criar `config/modulos/[nome-area].json` com equipe, i_area, filtros
2. Criar `docs/diretrizes/` com suas proprias diretrizes documentadas
3. Os indicadores genericos (saldo, liberacoes, tempo) funcionam sem mudanca
4. Indicadores especificos podem ser adicionados em `src/indicadores/[nome-area]/`
5. O core (conexao, cache, historico, relatorios) nao muda

### O que NAO deve ser feito agora (mas deve ser possivel depois)
- Multi-tenancy (varios modulos rodando ao mesmo tempo)
- Autenticacao/permissoes
- Deploy em servidor compartilhado
- Esses itens devem ser POSSIVEIS pela arquitetura, mas NAO implementados agora
