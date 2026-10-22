@echo off
setlocal
TITLE KRAKEN MEDIA SERVER - WEBVIEW ESCRITORIO (PUERTO 5000)

echo =========================================================
echo   KRAKEN MEDIA SERVER - MODO ESCRITORIO WEBVIEW
echo   Puerto Oficial: http://127.0.0.1:5000
echo =========================================================
echo.

cd /d "%~dp0"

REM 1) Verificar entorno virtual
if not exist "venv\Scripts\python.exe" (
  echo [ERROR] No se encontro venv\Scripts\python.exe
  echo Crea o restaura el entorno virtual con: python -m venv venv
  pause
  exit /b 1
)

set PORT=5000
set KRAKEN_PORT=5000

echo Iniciando Kraken Offline en ventana nativa Webview...
echo.

REM Iniciar app_offline.py (levanta Flask en background y abre la ventana pywebview)
venv\Scripts\python.exe app_offline.py
pause
endlocal
