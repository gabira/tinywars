@echo off
chcp 65001 >nul
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js nao foi encontrado neste computador.
  echo Instale em https://nodejs.org e tente de novo.
  echo.
  pause
  exit /b 1
)

call npm run play
echo.
pause
