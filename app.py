from flask import Flask
from flask_compress import Compress
import threading
import sys
import webbrowser
import shutil
import os

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Modules
import config
from routes.api import api_bp
from routes.media import media_bp
from routes.hls import hls_bp
from services import library, database
from utils import check_ffmpeg
from state import cleanup_inactive_users, cleanup_old_hls_sessions
import alexa_handlers

app = Flask(__name__)
Compress(app)

# Register Blueprints
app.register_blueprint(api_bp)
app.register_blueprint(media_bp)
app.register_blueprint(hls_bp)

# Register Alexa Handlers
alexa_handlers.setup_alexa(app)


def _open_browser_soon(url: str, delay_seconds: float = 1.2):
    def _open():
        try:
            webbrowser.open(url)
        except Exception:
            pass

    timer = threading.Timer(delay_seconds, _open)
    timer.daemon = True
    timer.start()


def run_server(open_browser: bool = False):
    check_ffmpeg()
    database.init_db()

    print("🐙  KRAKEN V4 - SERVIDOR MULTIMEDIA (Private Playlists Edition)")

    print("📚 Precargando biblioteca...")
    library.generar_biblioteca_viva()
    print("✅ Biblioteca lista")

    print("🧹 Iniciando Radar de Usuarios...")
    radar_thread = threading.Thread(target=cleanup_inactive_users, daemon=True)
    radar_thread.start()

    print("🧹 Iniciando limpiador de sesiones HLS...")
    # Limpiar folder temporal HLS al iniciar
    if os.path.exists(config.HLS_TEMP_DIR):
        try:
            shutil.rmtree(config.HLS_TEMP_DIR)
            os.makedirs(config.HLS_TEMP_DIR, exist_ok=True)
            print("✅ Limpieza de streams temporales completada")
        except Exception as e:
            print(f"⚠️  No se pudo limpiar temp_streams: {e}")
    # Iniciar thread de cleanup de HLS
    hls_cleanup_thread = threading.Thread(target=cleanup_old_hls_sessions, daemon=True)
    hls_cleanup_thread.start()

    if open_browser:
        _open_browser_soon("http://127.0.0.1:5000")

    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)

if __name__ == '__main__':
    run_server(open_browser=False)
