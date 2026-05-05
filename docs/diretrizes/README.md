# Indice Geral de Diretrizes

> Repositorio de conhecimento vivo das diretrizes da Escrita Fiscal.
> Cada diretriz e documentada ANTES de ser implementada em codigo.
> Este indice e atualizado a cada nova diretriz criada.

## Como funciona
1. O usuario define a diretriz (nome, meta, formula, semaforo, etc.)
2. O agente documenta no arquivo `.md` correspondente
3. So entao o indicador e implementado em `src/indicadores/`
4. A documentacao e tao importante quanto o codigo

## Categorias

### [1. Produto](1-produto/README.md)
Diretrizes relacionadas ao produto (gerais e controladas pela coordenacao).
- Status: 4 diretrizes implementadas (controladas pela coordenacao)

### [2. Equipe](2-equipe/README.md)
Diretrizes da equipe (coletivas e individuais por analista).
- Status: aguardando definicao do usuario

### [3. Estudos](3-estudos/README.md)
Analises exploratorias nao vinculadas a uma diretriz especifica.
- Status: 4 estudos ativos (semanal por versao, historica, liberacoes SA V1, **liberacoes SA V2**)

## Diretrizes implementadas
| # | Nome | Categoria | Status | Arquivo |
|---|------|-----------|--------|---------|
| 1.4.1 | Saldo NE | Produto (coord.) | Ativo | [1.4.1-saldo-ne.md](1-produto/1.4-controladas-coordenacao/1.4.1-saldo-ne.md) |
| 1.4.2 | NE > 95 dias | Produto (coord.) | Ativo | [1.4.2-ne-95-dias.md](1-produto/1.4-controladas-coordenacao/1.4.2-ne-95-dias.md) |
| 1.4.3 | Criticas/Graves 5 dias | Produto (coord.) | Ativo | [1.4.3-criticas-graves-5-dias.md](1-produto/1.4-controladas-coordenacao/1.4.3-criticas-graves-5-dias.md) |
| 1.4.4 | Tempo correcao NE | Produto (coord.) | Ativo | [1.4.4-tempo-correcao-ne.md](1-produto/1.4-controladas-coordenacao/1.4.4-tempo-correcao-ne.md) |

## Modelo de diretriz
Cada arquivo de diretriz segue o modelo definido em `PROJETO.md` (secao "Conteudo obrigatorio de cada arquivo de diretriz").
