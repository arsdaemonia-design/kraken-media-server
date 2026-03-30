#!/bin/bash
# Kraken Media Server - Lanzador para Mac
cd "$(dirname "$0")"
echo "🐙 Levantando Kraken en Mac..."

# Activar venv si existe
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "⚠️ venv no encontrado. ¿Ejecutaste instalar_mac.sh?"
    python3 --version || exit 1
fi

# Iniciar servidor
echo "🚀 Servidor arrancando..."
python3 app_offline.py
