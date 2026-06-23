# setup-automatico.ps1
# Executa todos os passos para configurar o DashboardEscrita em uma nova maquina.
# Como usar: clique com botao direito -> "Executar com PowerShell"

$ErrorActionPreference = "Stop"
$REPO = "https://github.com/RichardsonCorreiaTR/DashboardEscrita.git"
$DESTINO = "C:\1 - A\B\Programas\DashboardEscrita"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup - Dashboard Escrita Fiscal" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Verificar Node.js
Write-Host "`n[1/4] Verificando Node.js..." -ForegroundColor Yellow
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
try {
    $nodeVer = node --version 2>&1
    Write-Host "      Node.js encontrado: $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "      ERRO: Node.js nao encontrado." -ForegroundColor Red
    Write-Host "      Instale em https://nodejs.org e tente novamente." -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

# 2. Verificar Git
Write-Host "`n[2/4] Verificando Git..." -ForegroundColor Yellow
try {
    $gitVer = git --version 2>&1
    Write-Host "      Git encontrado: $gitVer" -ForegroundColor Green
} catch {
    Write-Host "      ERRO: Git nao encontrado." -ForegroundColor Red
    Write-Host "      Instale em https://git-scm.com e tente novamente." -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

# 3. Clonar ou atualizar repositorio
Write-Host "`n[3/4] Configurando repositorio..." -ForegroundColor Yellow
$pastaParent = "C:\1 - A\B\Programas"
if (-not (Test-Path $pastaParent)) {
    New-Item -ItemType Directory -Force -Path $pastaParent | Out-Null
}

if (Test-Path "$DESTINO\.git") {
    Write-Host "      Repositorio ja existe. Atualizando..." -ForegroundColor Cyan
    Set-Location $DESTINO
    git pull origin master
} else {
    Write-Host "      Clonando repositorio..." -ForegroundColor Cyan
    Set-Location $pastaParent
    git clone $REPO
    Set-Location $DESTINO
}
Write-Host "      Repositorio pronto." -ForegroundColor Green

# 4. Instalar dependencias
Write-Host "`n[4/4] Instalando dependencias npm..." -ForegroundColor Yellow
npm install
Write-Host "      Dependencias instaladas." -ForegroundColor Green

# 5. Criar atalho de inicializacao automatica (opcional)
Write-Host "`n[Opcional] Configurar inicio automatico com Windows..." -ForegroundColor Yellow
$resp = Read-Host "      Deseja iniciar o servidor automaticamente ao ligar o PC? (S/N)"
if ($resp -eq "S" -or $resp -eq "s") {
    $startupPath = [System.Environment]::GetFolderPath('Startup')
    $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut("$startupPath\DashboardEscritaFiscal.lnk")
    $shortcut.TargetPath = "$DESTINO\start-server.bat"
    $shortcut.WorkingDirectory = $DESTINO
    $shortcut.WindowStyle = 7
    $shortcut.Save()
    Write-Host "      Inicio automatico configurado!" -ForegroundColor Green
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Setup concluido com sucesso!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para iniciar o servidor:" -ForegroundColor White
Write-Host "  - Duplo clique em start-server.bat" -ForegroundColor White
Write-Host "  - Ou execute: npm start" -ForegroundColor White
Write-Host ""
Write-Host "Acesso: http://localhost:4000" -ForegroundColor Cyan
Write-Host ""

$iniciar = Read-Host "Deseja iniciar o servidor agora? (S/N)"
if ($iniciar -eq "S" -or $iniciar -eq "s") {
    Start-Process "cmd.exe" -ArgumentList "/c `"$DESTINO\start-server.bat`""
    Write-Host "Servidor iniciando... Acesse http://localhost:4000" -ForegroundColor Green
}

Read-Host "Pressione Enter para fechar"
