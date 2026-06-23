# Setup — Dashboard Escrita Fiscal

Guia para instalar e rodar o projeto em uma nova máquina Windows.

---

## Pré-requisitos obrigatórios

| O que | Onde baixar | Obs |
|-------|------------|-----|
| **Node.js 18+** | https://nodejs.org | Marcar "Add to PATH" na instalação |
| **Git** | https://git-scm.com | Usar opções padrão |
| **Driver ODBC Sybase ASA 9** | Instalação do Domínio/SGD | Já instalado nas máquinas da TR |
| **DSN `pbcvs9`** | Administrador ODBC do Windows | Precisa estar configurado |

> ⚠️ Sem o driver ODBC e o DSN `pbcvs9`, o dashboard não consegue buscar dados do banco.

---

## Passo a Passo

### 1. Abrir o Cursor (ou terminal PowerShell)

Abra o **Cursor** ou o **PowerShell** como usuário normal (não precisa de admin).

### 2. Clonar o repositório

```powershell
cd "C:\1 - A\B\Programas"
git clone https://github.com/RichardsonCorreiaTR/DashboardEscrita.git
cd DashboardEscrita
```

### 3. Instalar as dependências

```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
npm install
```

Aguarde terminar (pode demorar 1-2 minutos).

### 4. Iniciar o servidor

```powershell
npm start
```

Ou simplesmente execute o arquivo `start-server.bat` com duplo clique.

### 5. Acessar no browser

Abra o browser e acesse:
- **http://localhost:4000**

---

## Login

| Usuário | Senha inicial |
|---------|--------------|
| `richardson` | `0181286` |
| `felipi` | `6121925` |
| (demais) | ID do colaborador |

> No primeiro acesso, cada analista será redirecionado para criar sua própria senha.

---

## Configurar inicialização automática (opcional)

Para o servidor iniciar automaticamente ao ligar a máquina:

1. Pressione `Win + R`, digite `shell:startup` e clique OK
2. Crie um atalho para o arquivo `start-server.bat` na pasta que abrir

---

## Verificar DSN ODBC

Se o servidor não conectar ao banco:

1. Abra o **Painel de Controle** → **Ferramentas Administrativas** → **Fontes de Dados ODBC (64 bits)**
2. Na aba **DSN de Sistema**, verifique se existe `pbcvs9`
3. Se não existir, crie apontando para o servidor Sybase da TR

---

## Estrutura rápida do projeto

```
DashboardEscrita/
├── config/
│   ├── equipe.json          ← membros da equipe
│   ├── usuarios.json        ← credenciais de login
│   ├── metas-equipe.json    ← configuração das metas
│   └── pontos-definicao.json ← tabela de pontos
├── src/servidor/
│   ├── app.js               ← servidor Express
│   └── public/              ← frontend HTML/CSS/JS
├── start-server.bat         ← iniciar com duplo clique
└── package.json
```

---

## Suporte

Dúvidas ou problemas: falar com Richardson (coordenador Escrita Fiscal).
