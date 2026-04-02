import os
import threading
import sys
import webbrowser
import shutil
import time

try:
    import webview
    PYWEBVIEW_AVAILABLE = True
except ImportError:
    PYWEBVIEW_AVAILABLE = False

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
from flask import send_file, render_template_string

# Nuevos imports modulares
import config
from app import app
from services import library, database
from state import cleanup_inactive_users, cleanup_old_hls_sessions
from utils import check_ffmpeg
import alexa_handlers

APP_VERSION = "4.87"
OFFLINE_VERSION = "4.87"
OFFLINE_LIMIT = 500
GITHUB_REPO = "arsdaemonia-design/kraken-media-server"

# Nota: El blueprint hls_bp ya está registrado en app.py al importar


def _inject_template(template: str) -> str:
    import re
    
    # 1. Viewport & JS Variables
    template = re.sub(
        r'(<meta name=\"viewport\"[^>]+>)', 
        r'\1\n<script>const APP_VERSION="' + APP_VERSION + '"; const OFFLINE_VERSION="' + OFFLINE_VERSION + '"; const OFFLINE_LIMIT=' + str(OFFLINE_LIMIT) + '; const GITHUB_REPO="' + GITHUB_REPO + '";</script>', 
        template
    )

    # 2. Body toggle
    template = re.sub(r'(<body[^>]*>)', r'\1', template)

    # 3. Zoom -> add toggle
    offline_toggle = """
        <button id="offline-mode-btn" onclick="toggleOfflineMode()" class="flex items-center gap-2 px-2 py-1 rounded-full bg-[#18181b] border border-emerald-700">
          <span id="offline-mode-label" class="text-[9px] font-bold uppercase tracking-widest text-emerald-300">Online</span>
          <span id="offline-mode-track" class="relative inline-flex w-9 h-5 rounded-full bg-emerald-900/50 border border-emerald-700/60">
            <span id="offline-mode-knob" class="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-emerald-400 transition-transform"></span>
          </span>
        </button>
    """
    template = re.sub(r'(class=\"w-12 accent-emerald-500\"[^>]*oninput=\"changeZoom\(this\.value\)\">.*?</div>)', r'\1 ' + offline_toggle, template, flags=re.DOTALL)

    # 4. Mobile search + Wifi Toggle
    mobile_btn = """
            <button id="offline-mode-btn-mobile" onclick="toggleOfflineMode()" class="shrink-0 flex items-center gap-1.5 px-2 py-2 rounded-lg bg-[#18181b] border border-emerald-700 transition-all">
                <i id="offline-icon-mobile" class="fa-solid fa-wifi text-emerald-400 text-xs"></i>
                <span id="offline-mode-track-mobile" class="relative inline-flex w-7 h-4 rounded-full bg-emerald-900/50 border border-emerald-700/60">
                    <span id="offline-mode-knob-mobile" class="absolute left-0.5 top-0.5 w-3 h-3 rounded-full bg-emerald-400 transition-transform"></span>
                </span>
            </button>
    """
    template = re.sub(r'(<input type=\"text\" id=\"lib-search-mobile\"[^>]+>)', r'\1 ' + mobile_btn, template, flags=re.DOTALL)

    # 5. Sidebar Nav (Historial -> Offline Files)
    nav_offline = """        <div onclick="ver('offline')" id="nav-offline" class="sidebar-link"><i class="fa-solid fa-download w-4 text-center"></i> Offline Files</div>"""
    template = re.sub(r'(<div onclick=\"ver\(\'history\'\)\"[^>]*>.*?</div>)', r'\1\n' + nav_offline, template, flags=re.DOTALL)

    # 6. View Offline Container
    view_offline_block = """
              <div id="view-offline" class="hidden animate-fade-in pb-32 pt-10">
                <div class="flex justify-between items-start mb-4 ml-2 gap-3 flex-wrap">
                  <div class="flex items-center gap-3 min-w-[220px]">
                    <button onclick="ver('library')" class="md:hidden shrink-0 w-10 h-10 rounded-full bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-700/50 flex items-center justify-center transition">
                      <i class="fa-solid fa-arrow-left text-emerald-400 text-sm"></i>
                    </button>
                    <div>
                      <h2 class="text-2xl font-bold text-white">Offline Files</h2>
                      <div id="offline-version" class="text-[10px] text-emerald-400/70 tracking-widest uppercase mt-1"></div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <button onclick="refreshOfflineList()" class="bg-emerald-900/30 text-emerald-400 border border-emerald-900/50 hover:bg-emerald-900/50 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition">
                      <i class="fa-solid fa-arrows-rotate"></i> Actualizar
                    </button>
                    <button onclick="updateServiceWorker()" class="bg-blue-900/30 text-blue-300 border border-blue-900/50 hover:bg-blue-900/50 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition">
                      <i class="fa-solid fa-rotate-right"></i> Actualizar SW
                    </button>
                    <button onclick="clearOfflineCache()" class="bg-red-900/30 text-red-300 border border-red-900/50 hover:bg-red-900/50 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition">
                      <i class="fa-solid fa-trash-can"></i> Limpiar Offline
                    </button>
                  </div>
                </div>
                <div class="glass p-4 rounded-xl mb-4">
                  <div class="flex items-center justify-between flex-wrap gap-2">
                    <div class="text-xs text-emerald-300 font-bold tracking-widest uppercase">Capacidad Offline</div>
                    <div id="offline-quota-badge" class="text-xs font-bold px-2 py-1 rounded-full border border-emerald-700/50 bg-emerald-900/30">0 / 0</div>
                  </div>
                  <div class="w-full h-2 bg-black/40 rounded-full overflow-hidden mt-3">
                    <div id="offline-quota-bar" class="h-full w-0 bg-emerald-500 transition-all"></div>
                  </div>
                  <div id="offline-saver-status" class="text-[10px] text-emerald-400/60 mt-2"></div>
                </div>
                <div class="glass p-4 rounded-xl mb-4">
                  <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <div class="text-xs text-emerald-300 font-bold tracking-widest uppercase">Offline Playlists</div>
                    <div id="offline-playlist-count" class="text-[10px] text-emerald-400/70">0</div>
                  </div>
                  <div id="offline-playlists" class="space-y-2"></div>
                </div>
                <div class="glass p-4 rounded-xl" id="offline-list"></div>
              </div>
    """
    template = re.sub(r'(<div id=\"view-history\"[^>]*>)', view_offline_block + r'\n\1', template)

    # 7. Lyrics btn Mobile
    template = re.sub(r'(<button onclick=\"toggleLyrics\(\)\"[^>]*>.*?</button>)', r'\1\n            <button onclick="toggleOfflineSave()" id="btn-offline-save" class="text-zinc-600 px-2 transition" title="Guardar offline"><i class="fa-solid fa-arrow-down"></i></button>', template, count=1, flags=re.DOTALL)

    # 8. Lyrics btn Desktop
    template = re.sub(r'(id=\"btn-lyrics-bar\"[^>]*>.*?</button>)', r'\1\n            <button onclick="toggleOfflineSave()" id="btn-offline-save-desktop" class="text-zinc-400 hover:text-emerald-400 transition p-2" title="Guardar offline"><i class="fa-solid fa-arrow-down"></i></button>', template, count=1, flags=re.DOTALL)

    # 9. Offline Download Modal
    offline_modal = """
<div id="offline-batch-modal" class="fixed inset-0 z-[130] bg-black/80 hidden flex items-center justify-center p-4 backdrop-blur-sm">
    <div class="bg-[#0f172a] p-6 rounded-2xl w-full max-w-sm border border-emerald-700 shadow-2xl">
        <div id="offline-batch-title" class="font-bold text-lg mb-2 text-emerald-400">Descargando</div>
        <div class="flex items-center justify-between text-xs text-emerald-200 mb-2">
            <span><span id="offline-batch-count">0</span>/<span id="offline-batch-total">0</span> items</span>
            <span id="offline-batch-quota">0 / 0</span>
        </div>
        <div class="w-full h-2 bg-black/50 rounded-full overflow-hidden mb-4">
            <div id="offline-batch-bar" class="h-full w-0 bg-emerald-500 transition-all"></div>
        </div>
        <button onclick="cancelOfflineBatch()" class="w-full bg-red-900/40 text-red-300 border border-red-900/60 hover:bg-red-900/60 py-2 rounded-xl text-xs font-bold transition">Cancelar</button>
    </div>
</div>
"""
    template = re.sub(r'(</body>)', offline_modal + r'\n\1', template, flags=re.IGNORECASE)

    # 10. Service worker bootstrap
    init_call_with_offline = """
        initApp();
        (function() {
            const version = (typeof OFFLINE_VERSION !== 'undefined' && OFFLINE_VERSION) ? OFFLINE_VERSION : 'v2';
            const script = document.createElement('script');
            script.src = `/assets/offline.js?v=${encodeURIComponent(version)}`;
            script.onload = () => { if (typeof initOfflineBootstrap === 'function') initOfflineBootstrap(); };
            document.body.appendChild(script);
        })();
"""
    template = re.sub(r'(initApp\(\);)', init_call_with_offline, template)

    return template

from flask import make_response

def offline_index():
    template_path = os.path.join(config.BASE_DIR, 'templates', 'index.html')
    with open(template_path, 'r', encoding='utf-8') as f:
        html = f.read()
    
    # INYECTAR SUPERADMIN DENTRO DE INDEX.HTML DIRECTAMENTE AL INICIO
    html = html.replace('<head>', '<head>\n<script>window.MY_EMAIL = "' + config.SUPERADMIN_EMAIL + '";</script>')

    html = _inject_template(html)
    response = make_response(render_template_string(html))
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

# Overrides the media index to serve the offline-injected template
app.view_functions['media.index'] = offline_index

@app.route('/sw.js')
def service_worker():
    sw_path = os.path.join(config.BASE_DIR, 'sw.js')
    response = send_file(sw_path, mimetype='application/javascript')
    response.headers['Cache-Control'] = 'no-cache'
    return response


def _open_browser_soon(url: str, delay_seconds: float = 1.2):
    def _open():
        try:
            webbrowser.open(url)
        except Exception:
            pass

    timer = threading.Timer(delay_seconds, _open)
    timer.daemon = True
    timer.start()


def main(open_browser: bool = True):
    check_ffmpeg()
    database.init_db()
    library.generar_biblioteca_viva()

    print("🐙  KRAKEN V4 - OFFLINE (Private Playlists Edition)")
    print("🧹 Iniciando Radar de Usuarios...")
    radar_thread = threading.Thread(target=cleanup_inactive_users, daemon=True)
    radar_thread.start()

    print("🧹 Iniciando limpiador de sesiones HLS...")
    if os.path.exists(config.HLS_TEMP_DIR):
        try:
            shutil.rmtree(config.HLS_TEMP_DIR)
            os.makedirs(config.HLS_TEMP_DIR, exist_ok=True)
            print("✅ Limpieza de streams temporales completada")
        except Exception as e:
            print(f"⚠️  No se pudo limpiar temp_streams: {e}")
    hls_cleanup_thread = threading.Thread(target=cleanup_old_hls_sessions, daemon=True)
    hls_cleanup_thread.start()

    if PYWEBVIEW_AVAILABLE:
        # Arrancar Flask en un hilo daemon
        flask_thread = threading.Thread(
            target=lambda: app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False),
            daemon=True
        )
        flask_thread.start()
        # Esperar a que Flask levante
        time.sleep(1.5)
        # Abrir ventana nativa pywebview
        window = webview.create_window(
            'Kraken Media Server',
            'http://127.0.0.1:5000',
            width=1400,
            height=900,
            resizable=True,
            min_size=(800, 600),
            maximized=True
        )
        webview.start()
    else:
        # Fallback: abrir en navegador externo
        if open_browser:
            _open_browser_soon('http://127.0.0.1:5000')
        app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)

if __name__ == '__main__':
    main(open_browser=True)
