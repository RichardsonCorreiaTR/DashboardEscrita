# Metas Analista — Portal Individual

Projeto filho do **Dashboard Diretrizes** para que cada analista consulte **somente as próprias metas**, sem acesso ao painel da equipe, diretrizes ou dados de colegas.

## O que o analista vê

- Login individual (usuário e senha próprios)
- Página **Minhas Metas** com abas, totalizador e detalhes mensais
- Mesma interface de metas do dashboard principal, sem menu lateral da equipe

## O que o analista NÃO vê

- Metas de outros colaboradores
- Painéis de coordenador/gerente
- Diretrizes, estudos, feedback 1:1, etc.

## Pré-requisitos

- Node.js 18+
- Repositório **DashboardEscrita** clonado (este portal usa o código e o cache do projeto pai)
- Cache de metas atualizado pelo coordenador em `data/cache/metas-equipe.json`

## Rotina mensual (coordenador)

Config registrada em `config/pacotes-analista.json`.

```powershell
cd "C:\1 - A\B\Programas\DashboardEscrita"

# Exportar TODOS os analistas (usa cache atual)
npm run exportar-pacotes-mes

# Atualizar cache via ODBC e exportar
npm run exportar-pacotes-mes -- --refresh

# Exportar um analista especifico
npm run exportar-analista -- carolina
```

Saida: `output/pacotes-analista/Metas-<slug>/` + `manifesto-YYYY-MM.json`

Compactar para envio (Teams):

```powershell
npm run zipar-pacotes-analista
```

ZIPs em `output/pacotes-analista/zip/Metas-<slug>.zip`

Agendar automatico (1o dia do mes, 9h — Windows):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/agendar-pacotes-mes.ps1
```

Distribuir cada pasta `Metas-<slug>` como ZIP pelo Teams.

## Instalação (coordenador — preparar para um analista)

```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
cd "C:\1 - A\B\Programas\DashboardEscrita"

# Gerar config do analista (exemplo: fabio)
node scripts/preparar-pacote-analista.js fabio

# Instalar dependências do portal (uma vez)
cd metas-analista
npm install
```

O arquivo `metas-analista/config/usuario.json` é **pessoal** e não deve ser commitado no Git.

## Instalação (analista — após clonar do Git)

1. Clonar o repositório `DashboardEscrita`
2. Copiar `metas-analista/config/usuario.example.json` → `usuario.json`
3. Preencher com usuário, senha e slug recebidos do coordenador
4. Na pasta `metas-analista`: `npm install`
5. Na raiz do projeto: `npm run start:analista`
6. Abrir `http://localhost:4002`

## Comandos

| Comando | Onde | Descrição |
|---------|------|-----------|
| `npm run start:analista` | raiz do DashboardEscrita | Inicia portal na porta **4002** |
| `node scripts/preparar-pacote-analista.js <slug>` | raiz | Gera `usuario.json` do analista |

## Atualização dos dados

O portal lê o **cache compartilhado** (`data/cache/metas-equipe.json`). O coordenador atualiza esse cache no servidor principal (`npm start` → botão Atualizar no painel). Depois:

- **Opção A:** analista faz `git pull` (se o cache for versionado ou copiado)
- **Opção B:** coordenador envia o arquivo `data/cache/metas-equipe.json` atualizado

## Publicar no GitHub para analistas

1. Manter `metas-analista/config/usuario.json` no `.gitignore`
2. Enviar o repositório completo (ou branch `metas-analista`)
3. Para cada analista, enviar **privado** o `usuario.json` ou rodar o script `preparar-pacote-analista.js` e entregar o arquivo por Teams/e-mail

## Segurança

- Um `usuario.json` por instalação — login aceita **apenas** esse usuário
- API bloqueia consulta a slug diferente do logado
- Lista geral de analistas (`GET /api/metas-equipe`) desabilitada
- Config da API retorna somente o próprio colaborador

## Estrutura

```
metas-analista/
  config/
    usuario.example.json   # modelo (versionado)
    usuario.json           # credenciais (NÃO versionar)
  public/
    login.html
    metas.html
    js/app-analista.js
  src/
    app.js                 # servidor restrito
    auth.js
    config-analista.js
```

## Porta

Padrão: **4002** — alterável com `$env:PORT_ANALISTA = 4003`
