@echo off
echo ========================================
echo   Dashboard Diretrizes - Escrita Fiscal
echo ========================================
echo.

:: Adicionar Node.js ao PATH
set PATH=C:\Program Files\nodejs;%PATH%

:: Navegar para o diretorio do projeto
cd /d "%~dp0"

:: Verificar se node_modules existe
if not exist "node_modules" (
    echo [INFO] Instalando dependencias...
    call npm install
    echo.
)

:: Iniciar o servidor
echo [INFO] Iniciando servidor...
node src/servidor/app.js

pause
