#!/bin/bash
# Kraken Media Server - Instalador para Mac
echo "🍏 Iniciando instalación en Mac..."

# Crear venv si no existe
if [ ! -d "venv" ]; then
    echo "📦 Creando entorno virtual (venv)..."
    python3 -m venv venv
fi

# Activar y actualizar pip
source venv/bin/activate
echo "🆙 Actualizando pip..."
pip install --upgrade pip

# Instalar dependencias
if [ -f "requirements.txt" ]; then
    echo "📥 Instalando librerías desde requirements.txt..."
    pip install -r requirements.txt
else
    echo "⚠️requirements.txt no encontrado. Instalando básicas..."
    pip install flask flask-compress mutagen Pillow requests yt-dlp
fi

echo "✅ Instalación completada. Usa iniciar_mac.command para arrancar."
