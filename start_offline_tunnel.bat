@echo off
setlocal
TITLE KRAKEN OFFLINE (Modo Remoto + Tunnel - Puerto 5000)

echo ==========================================
echo   INICIANDO KRAKEN OFFLINE + TUNNEL
echo   (Entorno Oficial - Puerto 5000)
echo ==========================================
echo.

cd /d "%~dp0"

set PORT=5000
set KRAKEN_PORT=5000

REM 1) Verificar venv
if not exist "venv\Scripts\python.exe" (
  echo [ERROR] No existe venv\Scripts\python.exe
  echo Crea el entorno con: python -m venv venv
  pause
  exit /b 1
)

REM 2) Verificar dependencias clave
echo Verificando dependencias...
venv\Scripts\python.exe -c "import flask, mutagen, yt_dlp, requests, webview, langdetect, librosa, numpy" >nul 2>&1
if errorlevel 1 (
  echo Instalando dependencias faltantes...
  if exist "requirements.txt" (
    venv\Scripts\python.exe -m pip install -r requirements.txt
  ) else (
    venv\Scripts\python.exe -m pip install flask mutagen yt-dlp requests pywebview "pythonnet==3.1.0rc0" proxy_tools bottle langdetect librosa numpy
  )
)

REM 3) Iniciar servidor en ventana aparte
echo Iniciando Kraken Offline en puerto 5000...
start "Kraken Offline (Modular 5000)" /D "%~dp0" cmd /k "set PORT=5000 & set KRAKEN_PORT=5000 & venv\Scripts\python.exe app_offline.py"

REM 4) Esperar a que el servidor arranque (pywebview abre la ventana)
timeout /t 5 /nobreak >nul

echo.
echo =====================================================
echo  CONECTANDO AL TUNNEL...
echo  COPIA EL LINK QUE TERMINA EN .trycloudflare.com
echo =====================================================
echo.

REM 5) Iniciar tunnel con ruta absoluta hacia puerto 5000
if not exist "%~dp0cloudflared-windows-amd64.exe" (
  echo [ERROR] No se encontro cloudflared-windows-amd64.exe en:
  echo %~dp0
  pause
  exit /b 1
)

"%~dp0cloudflared-windows-amd64.exe" tunnel --url http://127.0.0.1:5000

pause
endlocal
