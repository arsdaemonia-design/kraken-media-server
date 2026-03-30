@echo off
TITLE VORTEX MANAGER (Modo Remoto)
echo ==========================================
echo   INICIANDO VORTEX + TÚNEL CLOUDFLARE
echo ==========================================

:: 1. Asegura que trabajamos en la carpeta correcta
cd /d "%~dp0"

:: 2. Activar entorno virtual
call venv\Scripts\activate

:: 3. Verificar librerías (Agregué 'requests' que también la usamos)
echo Verificando librerias...
pip install mutagen yt-dlp flask requests >nul 2>&1

:: 4. LANZAR SERVIDOR PYTHON (En ventana aparte para no bloquear)
echo Iniciando el cerebro de Vortex...
start "Vortex Server" cmd /k "call venv\Scripts\activate & python app.py"

:: 5. Esperar 5 segundos a que Python arranque bien
timeout /t 5 /nobreak >nul

:: 6. Abrir tu navegador local (Para ti en la PC)
start http://127.0.0.1:5000

:: 7. INICIAR TÚNEL PARA EL CELULAR
echo.
echo =====================================================
echo  CONECTANDO AL SATELITE...
echo  COPIA EL LINK QUE TERMINA EN .trycloudflare.com
echo =====================================================
echo.

:: Asegúrate de que este nombre sea EXACTO al del archivo que descargaste
cloudflared-windows-amd64.exe tunnel --url http://127.0.0.1:5000

pause