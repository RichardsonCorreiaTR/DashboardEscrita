# Dashboard Diretrizes - Escrita Fiscal

Projeto Node.js para calcular indicadores de produto e equipe da Escrita Fiscal (Thomson Reuters/Betha), gerar dashboards interativos e relatorios estaticos compartilhaveis.

## Inicio rapido

```powershell
# 1. Adicionar Node.js ao PATH (obrigatorio no Windows)
$env:PATH = "C:\Program Files\nodejs;$env:PATH"

# 2. Instalar dependencias
npm install

# 3. Iniciar o servidor
npm start
```

Ou simplesmente execute `start.bat`.

## Estrutura do projeto

```
config/          ← Configuracoes (conexao, equipe, indicadores)
docs/diretrizes/ ← Documentacao viva de cada diretriz (tao importante quanto o codigo)
src/core/        ← Camada base (conexao ODBC, query-executor, cache, validacao)
src/indicadores/ ← Calculo de indicadores (1 arquivo = 1 indicador)
src/historico/   ← Registro historico append-only (JSONL)
src/relatorios/  ← Geracao de HTMLs (templates + dados)
src/publicador/  ← Publicacao no OneDrive e manifesto
src/servidor/    ← Express (API + dashboard interativo)
data/            ← Historico persistido e manifestos
output/          ← Relatorios gerados (latest + arquivo)
```

## Documentacao

- **Blueprint completo**: `PROJETO.md` (fonte de verdade do projeto)
- **Diretrizes**: `docs/diretrizes/README.md`
- **Regras para agentes**: `.cursor/rules/`
- **Base de conhecimento do banco**: PBCVS Discovery (projeto separado)

## Banco de dados

Sybase SQL Anywhere (ASA 9.0) via ODBC - DSN: `pbcvs9`

**Restricoes criticas:**
- NUNCA usar `SELECT *` em tabelas com campos TEXT/BLOB
- Sempre listar colunas explicitamente
- Tabelas grandes: usar paginacao (`TOP N START AT X`)
