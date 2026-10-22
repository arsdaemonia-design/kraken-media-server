@echo off
setlocal
TITLE KRAKEN MEDIA SERVER - BUILD MODULAR EN PRUEBAS (PUERTO 5000)

echo =========================================================
echo   KRAKEN MEDIA SERVER - BUILD MODULAR EN PRUEBAS
echo   Puerto Local: http://localhost:5000
echo =========================================================
echo.

cd /d "%~dp0"

REM 1) Verificar entorno virtual
if not exist "venv\Scripts\python.exe" (
  echo [ERROR] No se encontro venv\Scripts\python.exe
  echo El banco de pruebas modular requiere su entorno virtual.
  echo Crea o restaura el venv antes de iniciar el servidor.
  pause
  exit /b 1
)

echo Iniciando servidor en puerto 5000...
echo Presiona Ctrl+C para detener el servidor de pruebas.
echo.

set PORT=5000
set KRAKEN_PORT=5000

REM Iniciar con Python del venv
venv\Scripts\python.exe app.py
pause
