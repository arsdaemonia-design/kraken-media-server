@echo off
color 0B
echo ==================================================
echo 🦾 KRAKEN - INSTALACION "FULL ARMOR" (REPARACION)
echo ==================================================
echo.

:: 1. DESTRUIR VENV (Limpieza total)
if exist venv (
    echo [1/4] 🗑️  Eliminando basura anterior...
    rmdir /s /q venv
)

:: 2. CREAR VENV
echo.
echo [2/4] 🏗️  Creando base de operaciones...
python -m venv venv

:: 3. ACTUALIZAR PIP
echo.
echo [3/4] 🆙 Afilando herramientas (PIP)...
.\venv\Scripts\python.exe -m pip install --upgrade pip

:: 4. INSTALACION ROBUSTA
echo.
echo [4/4] 📦 Instalando YT-DLP con esteroides + Dependencias...
echo.

:: 👇 ESTA ES LA LINEA PODEROSA (Actualizada para pywebview + Librosa + Soporte multi-disco)
venv\Scripts\python.exe -m pip install --no-cache-dir --force-reinstall "yt-dlp[default]" pycryptodomex brotli mutagen flask waitress requests flask-compress ask-sdk-core flask-ask-sdk urllib3 werkzeug Pillow websockets pywebview "pythonnet==3.1.0rc0" proxy_tools bottle langdetect librosa numpy

echo.
echo ==================================================
echo ✅ SISTEMA BLINDADO Y LISTO.
echo 🐙 INICIANDO KRAKEN...
echo ==================================================
echo.

:: 👇 ESTO LE FALTABA A TU CODIGO PARA ARRANCAR AL TERMINAR
.\venv\Scripts\python.exe app_offline.py

if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ❌ ERROR: Algo fallo.
    pause
)