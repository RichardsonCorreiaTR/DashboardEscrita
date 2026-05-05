@echo off
chcp 65001 >nul
cd /d "%~dp0."
cd ..
set PATH=C:\Program Files\nodejs;%PATH%
echo Capturando screenshot ISV... Servidor deve estar em http://localhost:4000
node scripts\screenshot-isv.js
if %ERRORLEVEL% equ 0 (echo Screenshot salvo em output\screenshot-isv-10.6A-02.png) else (echo Erro ao capturar.)
pause
