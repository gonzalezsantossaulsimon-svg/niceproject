@echo off
title NiceProject
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: Node.js no esta instalado.
    echo Instala Node.js y vuelve a intentarlo.
    echo.
    pause
    exit /b 1
)

if not exist "backend\node_modules" (
    echo Instalando dependencias del backend...
    cd /d "%~dp0backend"
    call npm.cmd install
    cd /d "%~dp0"
)

echo Iniciando backend...
start "NiceProject Backend" cmd /k "cd /d ""%~dp0backend"" && npm.cmd start"

echo Iniciando frontend...
start "NiceProject Frontend" cmd /k "cd /d ""%~dp0"" && node frontend-server.js"

timeout /t 2 /nobreak >nul

echo Abriendo NiceProject...
start "" "http://localhost:5500/login.html"

exit
