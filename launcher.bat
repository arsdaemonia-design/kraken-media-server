@echo off
TITLE KRAKEN MANAGER (Modo Remoto + Tunel Cloudflare - Puerto 5000)
echo ==========================================
echo   INICIANDO KRAKEN + TUNEL CLOUDFLARE
echo   (Entorno Oficial - Puerto 5000)
echo ==========================================

:: 1. Asegura que trabajamos en la carpeta correcta
cd /d "%~dp0"

set PORT=5000
set KRAKEN_PORT=5000

:: 2. Activar entorno virtual
call venv\Scripts\activate

:: 3. Verificar librerias
echo Verificando librerias...
pip install mutagen yt-dlp flask requests >nul 2>&1

:: 4. LANZAR SERVIDOR PYTHON (En ventana aparte para no bloquear)
echo Iniciando servidor en puerto 5000...
start "Kraken Server (Puerto 5000)" cmd /k "set PORT=5000 & set KRAKEN_PORT=5000 & call venv\Scripts\activate & python app.py"

:: 5. Esperar 5 segundos a que Python arranque bien
timeout /t 5 /nobreak >nul

:: 6. Abrir tu navegador local (Para ti en la PC)
start http://127.0.0.1:5000

:: 7. INICIAR TUNEL PARA EL CELULAR
echo.
echo =====================================================
echo  CONECTANDO AL SATELITE...
echo  COPIA EL LINK QUE TERMINA EN .trycloudflare.com
echo =====================================================
echo.

cloudflared-windows-amd64.exe tunnel --url http://127.0.0.1:5000

pause
