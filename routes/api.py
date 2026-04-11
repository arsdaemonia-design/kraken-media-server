from flask import Blueprint, request, jsonify, send_file, render_template_string, Response, send_from_directory
import os, time, json, shutil, subprocess, sys, threading, urllib.parse, re, copy
import io
import logging
from collections import deque
from functools import wraps
import requests
from urllib.parse import unquote
from pathlib import Path
import yt_dlp
from PIL import Image
from mutagen.id3 import ID3, USLT
from mutagen.mp4 import MP4
from mutagen.easyid3 import EasyID3
from mutagen.mp3 import MP3
import config
from config import *
import state
from state import *
import utils
from utils import *
from services.lastfm import *
from services.auth import (
    get_user_from_request, create_token, hash_password, verify_password,
    generate_invite_code, verify_token, validate_password_strength, MIN_PASSWORD_LENGTH
)
from services.metadata import *
from services.library import *
from services.media_analyzer import *
from services.video_tagger import *
from services.database import get_db
import traceback

api_bp = Blueprint("api", __name__)

# ═══ Security Audit Logger ═══
# Los logs se guardan en AppData (donde vive runtime_config.json en producción)
SECURITY_LOG_DIR = os.path.join(_app_data_dir, 'logs')
os.makedirs(SECURITY_LOG_DIR, exist_ok=True)
SECURITY_LOG_FILE = os.path.join(SECURITY_LOG_DIR, 'security.log')

security_logger = logging.getLogger('kraken_security')
security_logger.setLevel(logging.INFO)
if not security_logger.handlers:
    _fh = logging.FileHandler(SECURITY_LOG_FILE, encoding='utf-8')
    _fh.setFormatter(logging.Formatter('%(asctime)s | %(levelname)-8s | %(message)s', datefmt='%Y-%m-%d %H:%M:%S'))
    security_logger.addHandler(_fh)
    # También log a consola
    _ch = logging.StreamHandler()
    _ch.setFormatter(logging.Formatter('%(asctime)s [SECURITY] %(message)s', datefmt='%H:%M:%S'))
    security_logger.addHandler(_ch)

# ============= RUNTIME CONFIG HELPERS =============
if sys.platform == 'win32':
    _app_data_dir = os.path.join(os.getenv('APPDATA'), 'Kraken Media Server')
else:
    _app_data_dir = os.path.join(os.path.expanduser('~'), 'Library', 'Application Support', 'Kraken Media Server')

_RUNTIME_CONFIG_FILE = os.path.join(_app_data_dir, 'runtime_config.json')
_DEFAULT_RUNTIME = {'media_path': r'F:\Kraken Media Server\descargas', 'pin': '3041'}

# Rate limiting simple para auth
_AUTH_RATE_LIMIT = {'attempts': {}, 'locks': {}}
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION = 300  # 5 minutos

def _get_client_ip():
    """Get real client IP considering Cloudflare."""
    # Cloudflare puts real IP in this header
    return request.headers.get('CF-Connecting-IP') or \
           request.headers.get('X-Forwarded-For', '').split(',')[0].strip() or \
           request.remote_addr or 'unknown'

def _check_rate_limit(ip):
    """Check if IP is rate limited or locked out."""
    now = time.time()
    
    # Check if locked out
    if ip in _AUTH_RATE_LIMIT.get('locks', {}):
        lock_data = _AUTH_RATE_LIMIT['locks'][ip]
        if now < lock_data['until']:
            return {'locked': True, 'remaining': int(lock_data['until'] - now)}
        else:
            del _AUTH_RATE_LIMIT['locks'][ip]
    
    if ip in _AUTH_RATE_LIMIT.get('attempts', {}):
        _AUTH_RATE_LIMIT['attempts'][ip] = [
            t for t in _AUTH_RATE_LIMIT['attempts'][ip] 
            if now - t < 3600
        ]
    
    return {'locked': False}

def _record_failed_attempt(ip):
    """Record failed login attempt with progressive delay."""
    now = time.time()
    if 'attempts' not in _AUTH_RATE_LIMIT:
        _AUTH_RATE_LIMIT['attempts'] = {}
    if ip not in _AUTH_RATE_LIMIT['attempts']:
        _AUTH_RATE_LIMIT['attempts'][ip] = []
    
    _AUTH_RATE_LIMIT['attempts'][ip].append(now)
    attempts = len(_AUTH_RATE_LIMIT['attempts'][ip])
    
    if attempts >= MAX_LOGIN_ATTEMPTS:
        if 'locks' not in _AUTH_RATE_LIMIT:
            _AUTH_RATE_LIMIT['locks'] = {}
        _AUTH_RATE_LIMIT['locks'][ip] = {
            'until': now + LOCKOUT_DURATION,
            'reason': f'{attempts} intentos fallidos'
        }
        print(f'[SECURITY] IP {ip} locked for {LOCKOUT_DURATION}s after {attempts} failed attempts')
        _AUTH_RATE_LIMIT['attempts'][ip] = []
    
    return attempts

def _clear_failed_attempts(ip):
    """Clear failed attempts on successful login."""
    if ip in _AUTH_RATE_LIMIT.get('attempts', {}):
        _AUTH_RATE_LIMIT['attempts'][ip] = []

def _load_runtime_config():
    if os.path.exists(_RUNTIME_CONFIG_FILE):
        try:
            with open(_RUNTIME_CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return _DEFAULT_RUNTIME.copy()
    return _DEFAULT_RUNTIME.copy()

def get_master_pin():
    """Obtiene el PIN maestro desde el JSON (nunca desde config.py)."""
    return _load_runtime_config().get('pin', '3041')

def _save_runtime_config(key, value):
    """Guarda en JSON y sincroniza con config.py local"""
    # 1. Guardar en JSON
    config_data = _load_runtime_config()
    config_data[key] = value
    with open(_RUNTIME_CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(config_data, f, indent=4)
    
    # 2. Sincronizar con config.py local (solo si NO está frozen)
    if not getattr(sys, 'frozen', False):
        config_path = os.path.join(os.path.dirname(config.__file__), 'config.py')
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                
                with open(config_path, 'w', encoding='utf-8') as f:
                    for line in lines:
                        if key == 'media_path' and line.startswith('KRAKEN_MEDIA_PATH'):
                            safe_path = value.replace('\\', '\\\\')
                            f.write(f"KRAKEN_MEDIA_PATH = os.getenv('KRAKEN_MEDIA_PATH', r'{safe_path}')\n")
                        elif key == 'pin' and line.startswith('MASTER_PIN'):
                            f.write(f"MASTER_PIN = os.getenv('MASTER_PIN', '{value}')\n")
                        else:
                            f.write(line)
            except Exception:
                pass  # Si falla, el JSON ya está guardado

# ============= CONSOLE INTEGRADA =============
_console_buffer = deque(maxlen=500)

class _ConsoleRedirector(io.StringIO):
    def write(self, message):
        if message.strip():
            timestamp = time.strftime("%H:%M:%S")
            _console_buffer.append(f"[{timestamp}] {message.strip()}")
        # Verificar que sys.__stdout__ exista y no sea None
        _out = getattr(sys, '__stdout__', None)
        if _out is not None:
            try:
                _out.write(message)
            except Exception:
                pass

# Activar captura de logs (solo una vez al importar)
if not hasattr(sys, '_console_captured'):
    sys.stdout = _ConsoleRedirector()
    sys.stderr = _ConsoleRedirector()
    sys._console_captured = True

@api_bp.route('/api/logs')
def get_logs():
    return jsonify({"logs": list(_console_buffer)})

@api_bp.route('/api/logs/clear', methods=['POST'])
def clear_logs():
    _console_buffer.clear()
    return jsonify({"ok": True})

import hashlib
def make_uid(info):
    base = f"{info.get('extractor','')}|{info.get('webpage_url','')}|{info.get('title','')}"
    return hashlib.sha1(base.encode('utf-8')).hexdigest()

@api_bp.route('/api/status')
def api_status():
    """Endpoint para verificar autenticaciÃ³n de Cloudflare"""
    return jsonify({"status": "ok", "authenticated": True})

@api_bp.route('/api/artist/<path:artist_name>')
def artist_info(artist_name):
    # Decodificar el nombre por si tiene espacios (%20)
    decoded_name = unquote(artist_name)
    
    data = get_lastfm_data('artist.getinfo', {'artist': decoded_name, 'lang': 'es', 'autocorrect': 1})
    
    if data and 'artist' in data:
        art = data['artist']
        # Intentar Last.fm primero, si es placeholder, usar Deezer
        image = get_best_lastfm_image(art.get('image'))
        if not image:
            image = get_artist_image_deezer(decoded_name)
        
        return jsonify({
            'name': art.get('name'),
            'bio': art['bio'].get('summary', 'Sin biografÃ­a disponible.'),
            'image': image,
            'similar': [a['name'] for a in art['similar']['artist'][:5]] if 'similar' in art else [],
            'tags': [t['name'] for t in art['tags']['tag'][:3]] if 'tags' in art else []
        })
    return jsonify({'error': 'Not found'}), 404

@api_bp.route('/save_lyrics_to_file', methods=['POST'])
def save_lyrics_to_file():
    try:
        data = request.json
        rel_path = data.get('path')
        text = data.get('text')
        
        if not rel_path:
            return jsonify({'ok': False, 'error': 'Ruta invÃ¡lida'})

        full_path = os.path.join(DOWNLOAD_FOLDER, unquote(rel_path))
        
        if not os.path.exists(full_path):
            return jsonify({'ok': False, 'error': 'Archivo no encontrado'})

        # 1. Guardar en MP3
        if full_path.lower().endswith('.mp3'):
            try:
                tags = ID3(full_path)
            except:
                tags = ID3()
            # USLT = Unsynchronized Lyrics
            tags.add(USLT(encoding=3, lang='eng', desc='Kraken', text=text))
            tags.save(full_path)
            
        # 2. Guardar en M4A / MP4
        elif full_path.lower().endswith(('.m4a', '.mp4')):
            tags = MP4(full_path)
            tags['\xa9lyr'] = [text]
            tags.save()

        print(f"ðŸ’¾ Letra guardada en: {os.path.basename(full_path)}")
        return jsonify({'ok': True})

    except Exception as e:
        print(f"Error guardando: {e}")
        return jsonify({'ok': False, 'error': str(e)})

@api_bp.route('/lyrics/<path:filename>')
def lyrics(filename):
    try:
        decoded = unquote(filename).lstrip('/\\')
        full_path = os.path.join(DOWNLOAD_FOLDER, decoded)
        
        if not os.path.exists(full_path):
            return jsonify({'found': False, 'error': 'Archivo no encontrado'})

        lyrics_text = ""
        artist = ""
        title = ""

        # --- 1. LOCAL ---
        try:
            if full_path.lower().endswith('.mp3'):
                audio = ID3(full_path)
                if 'TPE1' in audio: artist = str(audio['TPE1'])
                if 'TIT2' in audio: title = str(audio['TIT2'])
                for key in audio.keys():
                    if key.startswith('USLT'):
                        lyrics_text = audio[key].text
                        break
            elif full_path.lower().endswith(('.m4a', '.mp4')):
                audio = MP4(full_path)
                if '\xa9ART' in audio: artist = audio['\xa9ART'][0]
                if '\xa9nam' in audio: title = audio['\xa9nam'][0]
                if '\xa9lyr' in audio: lyrics_text = audio['\xa9lyr'][0]
        except:
            pass

        if lyrics_text and len(lyrics_text) > 10:
            return jsonify({
                'found': True,
                'source': 'local',
                'text': lyrics_text,
                'plain_text': lyrics_text,
                'synced_text': '',
                'has_sync': False
            })

        # --- 2. INTERNET (MODO DISFRAZADO) ---
        if artist and title:
            clean_artist = artist.split('â€¢')[0].split(':')[0].strip()
            clean_title = re.sub(r"\(.*feat.*\)|\[.*\]|\(.*\)", "", title, flags=re.IGNORECASE).strip()
            
            try:
                url = "https://lrclib.net/api/get"
                
                # ðŸ‘‡ ESTO ES LO NUEVO: Nos disfrazamos de Chrome ðŸ‘‡
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
                
                # Intento 1: Buscar exacto primero (AGREGADO)
                print(f"ðŸ” Intento 1 exacto: {artist} - {title}")
                r = requests.get(url, params={'artist_name': artist, 'track_name': title}, headers=headers, timeout=10, verify=False)
                
                # Intento 2: Si falla, buscar con limpieza (ORIGINAL)
                if r.status_code != 200:
                    print(f"ðŸ” Intento 2 limpio: {clean_artist} - {clean_title}")
                    r = requests.get(url, params={'artist_name': clean_artist, 'track_name': clean_title}, headers=headers, timeout=10, verify=False) 
                
                if r.status_code == 200:
                    data = r.json()
                    plain = data.get('plainLyrics') or ''
                    synced = data.get('syncedLyrics') or ''
                    remoto = synced or plain
                    if remoto:
                        return jsonify({
                            'found': True,
                            'source': 'cloud',
                            'text': remoto,
                            'plain_text': plain,
                            'synced_text': synced,
                            'has_sync': bool(synced)
                        })
            except Exception as e:
                print(f"âš ï¸ Error API: {e}")

        return jsonify({'found': False, 'text': 'No se encontrÃ³ letra.'})

    except Exception as e:
        return jsonify({'found': False, 'error': str(e)})

@api_bp.route('/api/delete_folder_batch', methods=['POST'])
def delete_folder_batch():
    data = request.json
    folder_rel_path = data.get('folder')
    pin = data.get('pin')
    
    # Validar PIN Maestro
    import config
    if pin != get_master_pin():
        return jsonify({'error': 'PIN incorrecto. OperaciÃ³n denegada.'}), 401
    
    if not folder_rel_path or '..' in folder_rel_path:
        return jsonify({'error': 'Ruta invÃ¡lida'}), 400
        
    # Construimos la ruta absoluta
    folder_abs_path = os.path.join(DOWNLOAD_FOLDER, folder_rel_path)
    
    if os.path.exists(folder_abs_path) and os.path.isdir(folder_abs_path):
        try:
            # ðŸ—‘ï¸ ELIMINACIÃ“N RECURSIVA (Borra carpeta y todo lo de adentro)
            shutil.rmtree(folder_abs_path)
            
            # Limpiamos la DB en memoria para no reiniciar todo el server si no quieres
            # (Opcional: aquÃ­ podrÃ­as llamar a init_db() de nuevo)
            
            return jsonify({'status': 'ok'})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    else:
        return jsonify({'error': 'La carpeta no existe'}), 404

@api_bp.route('/control', methods=['POST'])
def remote_control():
    data = request.json or {}
    target_sid = data.get('target')
    action = data.get('action')
    from_name = data.get('from_name', 'Alguien')
    from_email = data.get('from_email', '')
    
    if target_sid and action:
        PENDING_COMMANDS[target_sid] = {
            'action': action,
            'time': time.time(),
            'from_name': from_name,
            'from_email': from_email
        }
        return jsonify({'status': 'sent', 'target': target_sid, 'action': action})
    
    return jsonify({'status': 'error', 'msg': 'Faltan datos'})

@api_bp.route('/assets/<path:filename>')
def serve_assets(filename):
    # Esto le dice a Python: "Busca en la carpeta 'assets' junto a app.py"
    assets_folder = os.path.join(BASE_DIR, 'assets')
    return send_from_directory(assets_folder, filename)

@api_bp.route('/proxy_thumb')
def proxy_thumb():
    url = request.args.get('url')
    if not url: return "No URL", 400
    try:
        # Fingimos ser un navegador para que YouTube nos dÃ© la imagen
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        r = requests.get(url, headers=headers, stream=True, timeout=5)
        return Response(r.content, mimetype=r.headers.get('Content-Type'))
    except Exception as e:
        print("Error en /proxy_thumb:", e, "URL:", url)
        return "Error", 500

@api_bp.route('/manifest.json')
def manifest():
    return jsonify({
       "name": "KRAKEN Media", 
        "short_name": "KRAKEN", 
        "start_url": "/",
        "display": "standalone", 
        "background_color": "#020617", 
        "theme_color": "#10b981", # Verde Esmeralda
        "icons": [
            {"src": "/assets/kraken-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
            {"src": "/assets/kraken-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
            {"src": "/assets/kraken.ico", "sizes": "16x16 24x24 32x32 48x48 64x64 128x128 256x256", "type": "image/x-icon"}
        ]
    })

@api_bp.route('/historial')
def historial():
    limit = int(request.args.get('limit', 200))
    h = load_json(HISTORY_FILE)
    items = list(h.items())[-limit:]
    return jsonify(dict(items))

@api_bp.route('/playlist/remove_item', methods=['POST'])
def remove_playlist_item():
    try:
        data = request.json
        pl_name = data.get('playlist')
        file_path = unquote(data.get('file'))
        owner = data.get('owner', 'public')
        
        conn = get_db()
        c = conn.cursor()
        
        c.execute("SELECT id FROM playlists WHERE name = ? AND owner_email = ?", (pl_name, owner))
        row = c.fetchone()
        if row:
            pl_id = row['id']
            # Borrar la coincidencia exacta
            c.execute("DELETE FROM playlist_items WHERE playlist_id = ? AND rel_path = ?", (pl_id, file_path))
            conn.commit()
            if c.rowcount > 0:
                conn.close()
                return jsonify({"ok": True})
            else:
                conn.close()
                return jsonify({"ok": False, "error": "Archivo no encontrado en la playlist"})
        
        conn.close()
            
    except Exception as e:
        print(f"âŒ Error borrando de playlist: {e}")
        import traceback
        traceback.print_exc()
        
    return jsonify({"ok": False, "error": "No coincide el nombre"})

@api_bp.route('/clean_ghosts', methods=['POST'])
def clean_ghosts():
    existing_filenames = set()
    for _, _, files in os.walk(DOWNLOAD_FOLDER):
        existing_filenames.update(files)

    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT uid, filename, title FROM downloads_history")
    rows = c.fetchall()
    
    uids_to_del = []
    names_deleted = []
    
    for row in rows:
        fname = row['filename']
        if fname and fname not in existing_filenames:
            uids_to_del.append(row['uid'])
            names_deleted.append(row['title'] or fname)
            
    if uids_to_del:
        # SQlite limit is usually 999 variables per query, so we do it in chunks
        chunk_size = 900
        for i in range(0, len(uids_to_del), chunk_size):
            chunk = uids_to_del[i:i + chunk_size]
            placeholders = ','.join(['?'] * len(chunk))
            c.execute(f"DELETE FROM downloads_history WHERE uid IN ({placeholders})", chunk)
        conn.commit()
        
    conn.close()
    return jsonify({"ok": True, "count": len(uids_to_del), "names": names_deleted})

@api_bp.route('/log_play', methods=['POST'])
def log_play():
    data = request.json or {}
    path = data.get('path')
    if path:
        try:
            conn = get_db()
            c = conn.cursor()
            
            # Update play count in media table
            c.execute('''
                UPDATE media 
                SET play_count = play_count + 1, last_played = ?
                WHERE rel_path = ?
            ''', (time.time(), path))
            
            # Get track info for history
            c.execute('SELECT title, artist, duration_sec FROM media WHERE rel_path = ?', (path,))
            row = c.fetchone()
            title = row[0] if row else None
            artist = row[1] if row else None
            duration_sec = row[2] if row else 0
            
            # Insert into play_history
            c.execute('''
                INSERT INTO play_history (track_path, title, artist, duration_sec, played_at)
                VALUES (?, ?, ?, ?, ?)
            ''', (path, title, artist, duration_sec, time.time()))
            
            conn.commit()
            conn.close()
            return jsonify({"ok": True})
        except Exception as e:
            return jsonify({"error": str(e)})
    return jsonify({"error": "No path"})


@api_bp.route('/api/stats')
def get_stats():
    try:
        conn = get_db()
        c = conn.cursor()
        
        # Get stats from last 30 days
        thirty_days_ago = time.time() - (30 * 24 * 60 * 60)
        
        # Top 10 artists by play count
        c.execute('''
            SELECT artist, COUNT(*) as plays, SUM(duration_sec) as total_time
            FROM play_history
            WHERE played_at > ? AND artist IS NOT NULL
            GROUP BY artist
            ORDER BY plays DESC
            LIMIT 10
        ''', (thirty_days_ago,))
        top_artists = [{"artist": r[0], "plays": r[1], "total_time": r[2] or 0} for r in c.fetchall()]
        
        # Top 20 tracks by play count
        c.execute('''
            SELECT title, artist, COUNT(*) as plays
            FROM play_history
            WHERE played_at > ? AND title IS NOT NULL
            GROUP BY track_path
            ORDER BY plays DESC
            LIMIT 20
        ''', (thirty_days_ago,))
        top_tracks = [{"title": r[0], "artist": r[1], "plays": r[2]} for r in c.fetchall()]
        
        # Total stats
        c.execute('''
            SELECT COUNT(*) as total_plays, SUM(duration_sec) as total_time
            FROM play_history
            WHERE played_at > ?
        ''', (thirty_days_ago,))
        row = c.fetchone()
        total_plays = row[0] or 0
        total_time = row[1] or 0
        
        conn.close()
        
        return jsonify({
            "ok": True,
            "period_days": 30,
            "total_plays": total_plays,
            "total_time_sec": total_time,
            "top_artists": top_artists,
            "top_tracks": top_tracks
        })
    except Exception as e:
        return jsonify({"error": str(e), "top_artists": [], "top_tracks": []})


@api_bp.route('/borrar_masivo', methods=['POST'])
def borrar_masivo():
    data = request.json or {}
    paths = data.get('paths', [])
    pin = data.get('pin')
    import config
    if pin != get_master_pin(): return jsonify({'error': 'PIN incorrecto'}), 401
    deleted_count = 0
    history_modified = False
    
    conn = get_db()
    c = conn.cursor()

    for rel_path in paths:
        full_path = os.path.join(DOWNLOAD_FOLDER, rel_path)
        base = os.path.splitext(os.path.basename(rel_path))[0]
        if os.path.exists(full_path):
            os.remove(full_path); deleted_count += 1
            for ext in ['.jpg', '.webp', '.png']:
                thumb = os.path.join(THUMBNAILS_FOLDER, base + ext)
                if os.path.exists(thumb): os.remove(thumb)
            
            fname = os.path.basename(rel_path)
            c.execute("DELETE FROM downloads_history WHERE filename = ?", (fname,))
            if c.rowcount > 0: history_modified = True
            
            c.execute("DELETE FROM media WHERE rel_path = ?", (rel_path,))

    conn.commit()
    conn.close()

    return jsonify({"ok": True, "count": deleted_count})

@api_bp.route('/mover_archivo', methods=['POST'])
def mover_archivo():
    try:
        data = request.json or {}
        rel_src = data.get('file')
        target = data.get('target')
        pin = data.get('pin')

        import config
        if pin != get_master_pin(): return jsonify({'error': 'PIN incorrecto'}), 401

        # ðŸ” Validar origen
        src = validar_path(rel_src)

        filename = os.path.basename(rel_src)

        # Resolver destino
        if target == "RaÃ­z":
            rel_dst = filename
        else:
            rel_dst = os.path.join(target, filename)

        dst = validar_path(rel_dst)

        # Crear carpeta destino si no existe
        dst.parent.mkdir(parents=True, exist_ok=True)

        if src.exists():
            src.rename(dst)

            # Actualizar rutas en BD SQLite
            new_rel = os.path.relpath(dst, DOWNLOAD_FOLDER).replace('\\', '/')

            conn = get_db()
            c = conn.cursor()
            
            # Actualizar main table
            c.execute("UPDATE media SET rel_path = ? WHERE rel_path = ?", (new_rel, rel_src))
            
            # Update playlist references
            c.execute("UPDATE playlist_items SET rel_path = ? WHERE rel_path = ?", (new_rel, rel_src))
            
            conn.commit()
            conn.close()
            
            return jsonify({"ok": True})

        return jsonify({"error": "Archivo no encontrado"}), 404

    except Exception as e:
        print("Error en /mover_archivo:", e)
        return jsonify({"error": str(e)}), 400

@api_bp.route('/update_cover', methods=['POST'])
def update_cover():
    try:
        data = request.json; paths = data.get('paths', []); url = data.get('url')
        if not url or not paths: return jsonify({"error": "Datos incompletos"})
        img_data = requests.get(url, timeout=10).content
        count = 0
        for rel_path in paths:
            base = os.path.splitext(os.path.basename(rel_path))[0]
            thumb_path = os.path.join(THUMBNAILS_FOLDER, base + '.jpg')
            with open(thumb_path, 'wb') as f: f.write(img_data)
            count += 1
        return jsonify({"ok": True, "count": count})
    except Exception as e: return jsonify({"error": str(e)})

@api_bp.route('/update_tags', methods=['POST'])
def update_tags():
    try:
        data = request.json or {}
        pin = data.get('pin')
        import config
        if pin != get_master_pin(): return jsonify({'error': 'PIN incorrecto'}), 401

        # Soporta tanto ediciÃ³n individual ('path') como masiva ('paths')
        rel_paths = data.get('paths', [])
        if not rel_paths and 'path' in data:
            rel_paths = [data.get('path')]

        # 1. ACTUALIZAR ARCHIVOS FÃSICOS (Tu cÃ³digo original)
        for rel_path in rel_paths:
            full_path = os.path.join(DOWNLOAD_FOLDER, rel_path)
            if not os.path.exists(full_path): continue
            
            try:
                if rel_path.lower().endswith('.mp3'):
                    audio = MP3(full_path, ID3=EasyID3)
                    if 'title' in data: audio['title'] = data['title']
                    if 'artist' in data: audio['artist'] = data['artist']
                    if 'album' in data: audio['album'] = data['album']
                    if 'genre' in data: audio['genre'] = data['genre']
                    audio.save()
                elif rel_path.lower().endswith(('.m4a', '.mp4')):
                    audio = MP4(full_path)
                    if 'title' in data: audio['\xa9nam'] = data['title']
                    if 'artist' in data: audio['\xa9ART'] = data['artist']
                    if 'album' in data: audio['\xa9alb'] = data['album']
                    if 'genre' in data: audio['\xa9gen'] = data['genre']
                    audio.save()
            except Exception as e:
                print(f"Error editando {rel_path}: {e}")

        # 2. ACTUALIZAR LA BASE DE DATOS MIENTRAS REESCANEA
        conn = get_db()
        c = conn.cursor()
        updated_count = 0
        
        for rel_path in rel_paths:
            updates = []
            params = []
            if 'title' in data: updates.append("title = ?"); params.append(data['title'])
            if 'artist' in data: updates.append("artist = ?"); params.append(data['artist'])
            if 'album' in data: updates.append("album = ?"); params.append(data['album'])
            if 'genre' in data: updates.append("genre = ?"); params.append(data['genre'])
            
            if updates:
                params.append(rel_path)
                query = f"UPDATE media SET {', '.join(updates)} WHERE rel_path = ?"
                c.execute(query, params)
                updated_count += c.rowcount
                
        if updated_count > 0:
            conn.commit()
        conn.close()

        return jsonify({"ok": True})
    except Exception as e: 
        print(f"Error fatal: {e}")
        return jsonify({"error": str(e)})

@api_bp.route('/api/favorite/toggle', methods=['POST'])
def toggle_favorite():
    try:
        data = request.json
        path = data.get('path')
        
        conn = get_db()
        c = conn.cursor()
        
        c.execute("SELECT rating FROM media WHERE rel_path = ?", (path,))
        row = c.fetchone()
        
        if row:
            current_rating = row['rating']
            new_rating = 0 if current_rating == 1 else 1
            is_fav = (new_rating == 1)
            
            c.execute("UPDATE media SET rating = ? WHERE rel_path = ?", (new_rating, path))
            conn.commit()
        else:
            # Archivo aÃºn no en DB, lo insertamos con favorito
            c.execute("INSERT INTO media (rel_path, rating) VALUES (?, ?)", (path, 1))
            conn.commit()
            is_fav = True
            
        conn.close()
        return jsonify({'success': True, 'is_favorite': is_fav})

    except Exception as e:
        print(f"Error toggle favorite: {e}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/playlist/create', methods=['POST'])
def create_playlist():
    n = request.json.get('name')
    owner = request.json.get('owner', 'public')
    if n:
        import uuid
        pl_id = str(uuid.uuid4())
        try:
            conn = get_db()
            conn.execute("INSERT INTO playlists (id, name, owner_email, created_at) VALUES (?, ?, ?, ?)", (pl_id, n, owner, time.time()))
            conn.commit()
            conn.close()
            return jsonify({"ok": True})
        except Exception:
            pass # Probably duplicate name for this owner
    return jsonify({"error": "Error"})

@api_bp.route('/playlist/rename', methods=['POST'])
def rename_playlist():
    old = request.json.get('old_name')
    new = request.json.get('new_name')
    owner = request.json.get('owner', 'public')
    if old and new:
        try:
            conn = get_db()
            conn.execute("UPDATE playlists SET name = ? WHERE name = ? AND owner_email = ?", (new, old, owner))
            conn.commit()
            conn.close()
            return jsonify({"ok": True})
        except Exception:
            pass
    return jsonify({"error": "Error"})

@api_bp.route('/playlist/add', methods=['POST'])
def add_to_playlist():
    n = request.json.get('name')
    path = request.json.get('path')
    owner = request.json.get('owner', 'public')
    if n and path:
        conn = get_db()
        c = conn.cursor()
        c.execute("SELECT id FROM playlists WHERE name = ? AND owner_email = ?", (n, owner))
        row = c.fetchone()
        if row:
            pl_id = row['id']
            # Check for duplicates using count
            c.execute("SELECT COUNT(*) FROM playlist_items WHERE playlist_id = ? AND rel_path = ?", (pl_id, path))
            if c.fetchone()[0] > 0:
                conn.close()
                return jsonify({"ok": True, "duplicate": True})
            
            c.execute("SELECT MAX(position) FROM playlist_items WHERE playlist_id = ?", (pl_id,))
            max_pos = c.fetchone()[0]
            new_pos = (max_pos + 1) if max_pos is not None else 0
            
            c.execute("INSERT INTO playlist_items (playlist_id, rel_path, position) VALUES (?, ?, ?)", (pl_id, path, new_pos))
            conn.commit()
            conn.close()
            return jsonify({"ok": True, "duplicate": False})
        conn.close()
    return jsonify({"error": "Error"})

@api_bp.route('/playlist/add_batch', methods=['POST'])
def add_to_playlist_batch():
    n = request.json.get('name')
    paths = request.json.get('paths', [])
    owner = request.json.get('owner', 'public')
    if n and paths:
        conn = get_db()
        c = conn.cursor()
        c.execute("SELECT id FROM playlists WHERE name = ? AND owner_email = ?", (n, owner))
        row = c.fetchone()
        if row:
            pl_id = row['id']
            added = 0
            ignored = 0
            
            c.execute("SELECT MAX(position) FROM playlist_items WHERE playlist_id = ?", (pl_id,))
            max_pos = c.fetchone()[0]
            curr_pos = (max_pos + 1) if max_pos is not None else 0
            
            for path in paths:
                c.execute("SELECT COUNT(*) FROM playlist_items WHERE playlist_id = ? AND rel_path = ?", (pl_id, path))
                if c.fetchone()[0] == 0:
                    c.execute("INSERT INTO playlist_items (playlist_id, rel_path, position) VALUES (?, ?, ?)", (pl_id, path, curr_pos))
                    added += 1
                    curr_pos += 1
                else:
                    ignored += 1
                    
            conn.commit()
            conn.close()
            return jsonify({"ok": True, "added": added, "ignored": ignored})
        conn.close()
    return jsonify({"error": "Error"})

@api_bp.route('/playlist/remove', methods=['POST'])
def remove_from_playlist():
    # Deprecated for /playlist/remove_item, mapping to the new one just in case
    return remove_playlist_item()

@api_bp.route('/playlist/delete', methods=['POST'])
def delete_playlist():
    n = request.json.get('name')
    owner = request.json.get('owner', 'public')
    if n:
        conn = get_db()
        conn.execute("DELETE FROM playlists WHERE name = ? AND owner_email = ?", (n, owner)) # cascade deletes items
        conn.commit()
        conn.close()
        return jsonify({"ok": True})
    return jsonify({"error": "Error"})

@api_bp.route('/caratula/<path:filename>')
def caratula(filename):
    decoded = unquote(filename).lstrip('/\\')

    # [FIX TMDB] Servir poster descargado de TMDB u otra metadata
    import os
    import re
    from flask import send_file
    direct_thumb_path = os.path.join(THUMBNAILS_FOLDER, os.path.basename(decoded))
    if os.path.exists(direct_thumb_path) and os.path.isfile(direct_thumb_path):
        resp = send_file(
            direct_thumb_path,
            mimetype='image/jpeg',
            max_age=31536000,
            conditional=True
        )
        resp.headers['Cache-Control'] = 'public, max-age=31536000'
        return resp

    # Fallback: intentar con variaciones del nombre (tmdb-ID vs _ID)
    # Solo aplicar a archivos que parezcan ser posters de series/peliculas
    basename = os.path.basename(decoded)
    name_no_ext = os.path.splitext(basename)[0]
    
    # Solo buscar TMDB ID si el nombre tiene patrón de TMDB explícito
    tmdb_match = re.search(r'\(tmdb[-_]?(\d+)\)', name_no_ext)
    if tmdb_match:
        tmdb_id = tmdb_match.group(1)
        # Buscar cualquier archivo que contenga el TMDB ID
        for f in os.listdir(THUMBNAILS_FOLDER):
            if tmdb_id in f and f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                fallback_path = os.path.join(THUMBNAILS_FOLDER, f)
                if os.path.isfile(fallback_path):
                    resp = send_file(
                        fallback_path,
                        mimetype='image/jpeg',
                        max_age=31536000,
                        conditional=True
                    )
                    resp.headers['Cache-Control'] = 'public, max-age=31536000'
                    return resp

    try:
        path = validar_path(decoded)
    except ValueError:
        return "Ruta invÃ¡lida", 400
    base = os.path.splitext(os.path.basename(decoded))[0]

    # 1ï¸âƒ£ Thumbnail ya generada (RÃPIDO + CACHEABLE)
    for ext in ['.jpg', '.webp', '.png']:
        thumb = os.path.join(THUMBNAILS_FOLDER, base + ext)
        if os.path.exists(thumb):
            # âœ… AQUÃ VA EL CAMBIO:
            response = send_file(
                thumb,
                mimetype='image/jpeg',
                max_age=31536000,
                conditional=True
            )
            response.headers['Cache-Control'] = 'public, max-age=31536000'
            return response

    # 2ï¸âƒ£ Fallback: carÃ¡tula embebida en el archivo (LENTO, pero seguro)
    try:
        if decoded.lower().endswith('.mp3'):
            tags = ID3(path)
            apic = tags.get("APIC:") or tags.get("APIC:Cover")
            if apic:
                resp = Response(apic.data, mimetype=apic.mime)
                resp.headers['Cache-Control'] = 'public, max-age=31536000'
                return resp

        elif decoded.lower().endswith(('.m4a', '.mp4')):
            tags = MP4(path)
            if 'covr' in tags:
                resp = Response(bytes(tags['covr'][0]), mimetype='image/jpeg')
                resp.headers['Cache-Control'] = 'public, max-age=31536000'
                return resp

    except Exception as e:
        print(f"Error leyendo carÃ¡tula embebida: {e}")

    # 3ï¸âƒ£ Fallback para VIDEO: generar thumbnail con FFmpeg
    VIDEO_EXTS = ('.mp4', '.mkv', '.avi', '.webm', '.mov', '.flv', '.wmv', '.m4v')
    if decoded.lower().endswith(VIDEO_EXTS):
        try:
            thumb_path = os.path.join(THUMBNAILS_FOLDER, base + '.jpg')
            os.makedirs(THUMBNAILS_FOLDER, exist_ok=True)
            
            # 1. Intentar generar thumbnail a los 3 minutos (para evitar intros visuales)
            cmd_ffmpeg = [
                'ffmpeg', '-y', '-ss', '00:03:00',
                '-i', str(path),
                '-vframes', '1',
                '-q:v', '2',
                thumb_path
            ]
            kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
            subprocess.run(cmd_ffmpeg, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15, **kwargs)
            
            # 2. Si fallÃ³ (ej. el video dura menos de 3 minutos), intentar a los 5 segundos
            if not os.path.exists(thumb_path) or os.path.getsize(thumb_path) == 0:
                cmd_ffmpeg_fallback = [
                    'ffmpeg', '-y', '-ss', '00:00:05',
                    '-i', str(path),
                    '-vframes', '1',
                    '-q:v', '2',
                    thumb_path
                ]
                subprocess.run(cmd_ffmpeg_fallback, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15, **kwargs)
            
            if os.path.exists(thumb_path):
                response = send_file(
                    thumb_path,
                    mimetype='image/jpeg',
                    max_age=31536000,
                    conditional=True
                )
                response.headers['Cache-Control'] = 'public, max-age=31536000'
                return response
            else:
                print(f"FFmpeg no pudo generar thumbnail para: {decoded}")
        except Exception as e:
            print(f"Error generando thumbnail de video con FFmpeg: {e}")

    return "No image", 404

@api_bp.route('/descargar', methods=['POST'])
def descargar():
    global stop_download
    stop_download = False
    data = request.json

    def job():
        progress_status.update({
            "active": True,
            "completed_indices": [],
            "failed": False,
            "details": "",
            "percent": "0%",
            "current_index": -1
        })

        items = data['items']
        tipo = data['type']
        speed = data.get('speed', 1)  # Concurrent fragments: 1, 2, 4

        opts = {
            'progress_hooks': [progress_hook],
            'quiet': True,
            'writethumbnail': True,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'postprocessors': [{'key': 'FFmpegMetadata', 'add_metadata': True}],
            'outtmpl': {'default': os.path.join(DOWNLOAD_FOLDER, '%(title)s.%(ext)s')},
            'concurrentfragments': speed  # Descarga más rápida
        }

        if tipo == 'mp3':
            opts['format'] = 'bestaudio/best'
            opts['postprocessors'].insert(0, {
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3'
            })
        else:
            opts['format'] = 'bestvideo+bestaudio/best'
            opts['merge_output_format'] = 'mp4'

        for i, item in enumerate(items):
            if stop_download:
                break

            progress_status["current_index"] = i
            url = item['url']
            clean = sanitize_name(item['title'])

            # ================== SPOTDL ==================
            if "spotify.com" in url:
                progress_status["filename"] = f"SpotDL: {item['title']}"
                progress_status["details"] = "Buscando equivalente en YouTubeâ€¦"
                progress_status["percent"] = "..."

                try:
                    kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
                    subprocess.run([
                        "spotdl",
                        "download",
                        url,
                        "--output", os.path.join(DOWNLOAD_FOLDER, "{artist} - {title}.{output-ext}")
                    ], check=True, **kwargs)

                    # Registrar en historial (SpotDL ya creÃ³ el archivo final)
                    h = load_json(HISTORY_FILE)
                    uid = item.get('id') or make_uid({'title': clean, 'url': url})
                    h[uid] = {
                        'title': clean,
                        'filename': clean,
                        'date': time.time()
                    }
                    save_json(HISTORY_FILE, h)

                    progress_status["completed_indices"].append(i)
                    continue

                except Exception as e:
                    print(f"âŒ Error con SpotDL ({url}): {e}")
                    progress_status.update({
                        "details": "Spotify: no se encontrÃ³ una fuente alternativa",
                        "failed": True,
                        "active": False
                    })
                    return

            # ================== YT-DLP ==================
            possible_mp3 = os.path.join(DOWNLOAD_FOLDER, f"{clean}.mp3")
            possible_mp4 = os.path.join(DOWNLOAD_FOLDER, f"{clean}.mp4")

            if os.path.exists(possible_mp3) or os.path.exists(possible_mp4):
                uploader = sanitize_name(item.get('uploader', ''))
                if uploader:
                    clean = f"{clean} - {uploader}"
                else:
                    clean = f"{clean} [{item['id']}]"

            cur_opts = copy.deepcopy(opts)
            cur_opts['outtmpl']['default'] = os.path.join(DOWNLOAD_FOLDER, f'{clean}.%(ext)s')

            try:
                with yt_dlp.YoutubeDL(cur_opts) as single:
                    single.download([url])

                # OptimizaciÃ³n de imagen
                for ext in ['.webp', '.jpg', '.png']:
                    src = os.path.join(DOWNLOAD_FOLDER, f"{clean}{ext}")
                    if os.path.exists(src):
                        try:
                            dst = os.path.join(THUMBNAILS_FOLDER, f"{clean}.jpg")
                            with Image.open(src) as img:
                                if img.mode != 'RGB':
                                    img = img.convert('RGB')
                                img.thumbnail((500, 500))
                                img.save(dst, "JPEG", quality=80, optimize=True)
                            os.remove(src)
                        except Exception as e:
                         print("Error procesando thumbnail:", e)
                         shutil.move(src, os.path.join(THUMBNAILS_FOLDER, f"{clean}{ext}"))
                        break

                h = load_json(HISTORY_FILE)
                uid = item.get('id') or make_uid({'title': clean, 'url': url})
                h[uid] = {
                    'title': clean,
                    'filename': f"{clean}.{'mp3' if tipo=='mp3' else 'mp4'}",
                    'date': time.time()
                }
                save_json(HISTORY_FILE, h)

                progress_status["completed_indices"].append(i)

            except Exception as e:
                print(f"âŒ Error descargando {url}: {e}")
                progress_status.update({
                    "details": "No compatible / Protegido",
                    "percent": "0%",
                    "active": False,
                    "failed": True
                })
                return

        def delayed_rescan():
            global RESCAN_IN_PROGRESS
            time.sleep(4)
            RESCAN_IN_PROGRESS = True
            escanear_archivos_fisicos()
            RESCAN_IN_PROGRESS = False
            progress_status.update({
                "active": False,
                "percent": "100%",
                "details": "Listo"
            })

        threading.Thread(target=delayed_rescan, daemon=True).start()

        global BIB_CACHE, MIXES_CACHE
        BIB_CACHE = None
        MIXES_CACHE = None
        print("âœ… Biblioteca actualizada en background.")

    threading.Thread(target=job).start()
    return jsonify({"ok": True})

@api_bp.route('/estado')
def estado():
    return jsonify({
        "rescan": RESCAN_IN_PROGRESS,
        "rescan_status": state.RESCAN_STATUS
    })

@api_bp.route('/analizar', methods=['POST'])
def analizar():
    try:
        url_input = request.json['url']
        hist = load_json(HISTORY_FILE)
        clean = []

        # ===== PARSEAR MÚLTIPLES URLs =====
        urls = [u.strip() for u in url_input.replace(',', '\n').split('\n') if u.strip()]
        
        for url in urls:
            # Procesar cada URL y agregar resultados
            entries = _analizar_single_url(url, hist)
            clean.extend(entries)
        
        return jsonify({"entries": clean})

    except Exception as e:
        print("Error en analizar:", e)
        return jsonify({"entries": [], "error": str(e)})


def _analizar_single_url(url, hist):
    """Procesa una sola URL y devuelve la lista de entries"""
    clean = []
    
    # ===== SPOTIFY =====
    if "spotify.com" in url:
        try:
            temp_file = os.path.join(TEMP_FOLDER, "spotdl_tmp.spotdl")

            kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
            subprocess.run(
                ["spotdl", "--user-auth", "--no-cache", "save", url, "--save-file", temp_file],
                timeout=25,
                check=True,
                **kwargs
            )

            if not os.path.exists(temp_file):
                return []

            with open(temp_file, "r", encoding="utf-8") as f:
                tracks = json.load(f)

            os.remove(temp_file)

            for t in tracks:
                titulo = f"{t['artist']} - {t['name']}"

                uid = make_uid({
                    'title': titulo,
                    'url': t['url']
                })

                clean.append({
                    'title': titulo,
                    'url': t['url'],
                    'thumbnail': t.get('thumbnail'),
                    'is_downloaded': uid in hist,
                    'uid': uid,
                    'source_id': t.get('track_id'),
                    'source': 'spotify'
                })

            return clean

        except Exception as e:
            print("SpotDL error:", e)
            return []

    # ===== YT-DLP =====
    ydl_opts = {
        'extract_flat': True,
        'quiet': True,
        'extractor_args': {
            'youtube': {
                'player_client': ['web_embedded', 'web', 'tv']
            }
        }
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            entries = info.get('entries') or [info]

            for e in entries:
                if not e:
                    continue

                source_id = e.get('id')
                uid = make_uid(e) if source_id else make_uid({
                    'title': e.get('title'),
                    'url': e.get('url')
                })

                thumb = e.get('thumbnail')
                if source_id and 'youtube' in (e.get('url') or ''):
                    thumb = f"https://i.ytimg.com/vi/{source_id}/mqdefault.jpg"

                clean.append({
                    'title': e.get('title'),
                    'url': e.get('url') or url,
                    'thumbnail': thumb,
                    'is_downloaded': uid in hist,
                    'uid': uid,
                    'source_id': source_id,
                    'source': 'generic'
                })
    except Exception as e:
        print("yt-dlp error:", e)
    
    return clean


BIB_CACHE_BY_OWNER = {}
BIB_CACHE_TIME = 0

def filtrar_contenido_kid_mode(data):
    """Filtra el contenido de la biblioteca para modo niños.
    
    Oculta contenido con rating PG-13, R, NC-17.
    Permite: G, PG, sin rating (asume seguro)
    """
    ratings_bloqueados = {'PG-13', 'R', 'NC-17', 'TV-14', 'TV-MA', '18', '16', '16+', '18+', 'MA15+', 'M', 'C', 'D', 'MA', 'R18+', 'R15+'}
    
    # Filtrar archivos
    files_filtrados = []
    for f in data.get('files', []):
        if f.get('type') != 'video':
            # Audio siempre permitido
            files_filtrados.append(f)
            continue
            
        r = f.get('tmdb_rating')
        rating = str(r).upper().strip() if r else ''
        
        # Si no hay rating, asumir seguro
        if not rating:
            files_filtrados.append(f)
            continue
        
        # Si el rating NO está en bloqueados, permitir
        if rating not in ratings_bloqueados:
            files_filtrados.append(f)
    
    data['files'] = files_filtrados
    
    # Actualizar totales
    data['total_files'] = len(files_filtrados)
    data['total_videos'] = sum(1 for f in files_filtrados if f.get('type') == 'video')
    
    return data


@api_bp.route('/biblioteca')
def biblioteca():
    global BIB_CACHE_BY_OWNER, BIB_CACHE_TIME

    force = request.args.get('fresh') == '1'
    owner_email = request.args.get('owner', 'public')
    
    # Verificar si el usuario está en modo niños
    user_email = get_user_from_request(request)
    is_kid_mode = False
    
    if user_email:
        conn = get_db()
        c = conn.cursor()
        c.execute("SELECT is_kid_mode FROM users WHERE email = ?", (user_email,))
        user_row = c.fetchone()
        if user_row:
            is_kid_mode = bool(user_row['is_kid_mode'])
        conn.close()

    # Si forzamos actualización, limpiamos solo el caché de ESTE usuario
    if force and owner_email in BIB_CACHE_BY_OWNER:
        del BIB_CACHE_BY_OWNER[owner_email]

    # Si hay caché válido para este usuario
    if owner_email in BIB_CACHE_BY_OWNER:
        data = BIB_CACHE_BY_OWNER[owner_email]
    else:
        # Generar exclusiva para este usuario (Playlists privadas)
        data = generar_biblioteca_viva(owner_email)
        
        # Si está en modo niños, filtrar contenido
        if is_kid_mode:
            data = filtrar_contenido_kid_mode(data)
        
        BIB_CACHE_BY_OWNER[owner_email] = data
        BIB_CACHE_TIME = time.time()

    # Agregar totales
    all_files = data.get('files', [])
    data['total_files'] = len(all_files)
    data['total_videos'] = sum(1 for f in all_files if f.get('type') == 'video')
    data['total_folders'] = len(data.get('folders', []))
    
    # Agregar info de modo niños a la respuesta
    data['is_kid_mode'] = is_kid_mode

    return jsonify(data)

@api_bp.route('/radio/artist/<path:artist_name>')
def search_similar_artists_radio(artist_name):
    """
    Crea una radio/playlist dinÃ¡mica basada en artistas similares.
    """
    artist_name = unquote(artist_name)
    similar_artists = get_similar_artists(artist_name)
    
    # Siempre incluimos al artista original en la lista de bÃºsqueda
    search_list = [artist_name] + similar_artists
    
    conn = get_db()
    c = conn.cursor()
    
    # Construimos la query dinÃ¡mica para buscar tracks de CUALQUIERA de esos artistas
    placeholders = ', '.join(['?'] * len(search_list))
    query = f"""
        SELECT rel_path FROM media 
        WHERE artist IN ({placeholders}) 
        AND media_type = 'audio'
        ORDER BY RANDOM() LIMIT 50
    """
    
    c.execute(query, search_list)
    rows = c.fetchall()
    conn.close()
    
    playlist = [row['rel_path'] for row in rows]
    return jsonify(playlist)

@api_bp.route('/similar/<path:filepath>')
def obtener_similares(filepath):
    """Endpoint para obtener canciones similares a una específica"""
    import random as _random

    def _calcular_similitud(ref, cand):
        score = 0
        if ref.get('artist') and cand.get('artist'):
            if ref['artist'].lower() == cand['artist'].lower():
                score += 60
        if ref.get('album') and cand.get('album'):
            if ref['album'].lower() == cand['album'].lower():
                score += 40
        if ref.get('genre') and cand.get('genre'):
            if (ref['genre'].lower() == cand['genre'].lower()
                    and ref['genre'].lower() not in ['otros', 'unknown', '']):
                score += 20
        r1 = ref.get('rating', 0) or 0
        r2 = cand.get('rating', 0) or 0
        if abs(r1 - r2) <= 1:
            score += 10
        return score

    def _generar_similares(referencia, biblioteca, limite=50):
        candidatas = []
        ref_path = (referencia.get('path') or '').replace('\\', '/')
        for c in biblioteca:
            if (c.get('path') or '').replace('\\', '/') == ref_path:
                continue
            candidatas.append({'cancion': c, 'score': _calcular_similitud(referencia, c)})
        candidatas.sort(key=lambda x: x['score'], reverse=True)
        resultado = []
        muy = [c for c in candidatas if c['score'] >= 60]
        resultado.extend([c['cancion'] for c in muy[:30]])
        medio = [c for c in candidatas if 20 <= c['score'] < 60]
        _random.shuffle(medio)
        resultado.extend([c['cancion'] for c in medio[:10]])
        poco = [c for c in candidatas if c['score'] < 20]
        _random.shuffle(poco)
        resultado.extend([c['cancion'] for c in poco[:10]])
        if len(resultado) < limite:
            resto = [c['cancion'] for c in candidatas if c['cancion'] not in resultado]
            _random.shuffle(resto)
            resultado.extend(resto[:limite - len(resultado)])
        return resultado[:limite]

    try:
        filepath_decoded = unquote(filepath).replace('\\', '/').lstrip('/')
        print(f"[Radio] Buscando similares para: {filepath_decoded}")

        bib = generar_biblioteca_viva()
        audios = [f for f in bib.get('files', []) if f.get('type') == 'audio']

        print(f"[Radio] Biblioteca cargada: {len(audios)} audios")
        if audios:
            print(f"[Radio] Ejemplo path en biblioteca: {audios[0].get('path', 'N/A')}")

        # Búsqueda normalizada
        cancion_ref = None
        for cancion in audios:
            cancion_path = (cancion.get('path') or '').replace('\\', '/').lstrip('/')
            if cancion_path == filepath_decoded:
                cancion_ref = cancion
                break

        # Fallback por sufijo
        if not cancion_ref:
            for cancion in audios:
                cancion_path = (cancion.get('path') or '').replace('\\', '/').lstrip('/')
                if cancion_path.endswith(filepath_decoded) or filepath_decoded.endswith(cancion_path):
                    cancion_ref = cancion
                    print(f"[Radio] Encontrada por sufijo: {cancion_path}")
                    break

        if not cancion_ref:
            print(f"[Radio] No encontrada en biblioteca, devolviendo aleatorio")
            aleatorio = audios[:]
            _random.shuffle(aleatorio)
            return jsonify({
                'referencia': {'title': 'Desconocido', 'artist': 'Desconocido', 'path': filepath_decoded},
                'similares': [s.get('path') for s in aleatorio[:50]],
                'total': len(aleatorio[:50])
            })

        print(f"[Radio] Referencia encontrada: {cancion_ref.get('title')} - {cancion_ref.get('artist')} | género: {cancion_ref.get('genre')}")
        similares = _generar_similares(cancion_ref, audios, limite=50)
        print(f"[Radio] Similares generados: {len(similares)}")

        return jsonify({
            'referencia': {
                'title': cancion_ref.get('title', 'Desconocido'),
                'artist': cancion_ref.get('artist', 'Desconocido'),
                'path': cancion_ref.get('path')
            },
            'similares': [s.get('path') for s in similares],
            'total': len(similares)
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[Radio] Error: {e}")
        return jsonify({'error': str(e), 'similares': []})

@api_bp.route('/update_ytdlp', methods=['POST'])
def update_ytdlp():
    def job():
        try:
            print("ðŸ”„ Actualizando yt-dlp...")

            # Usamos el Python del venv (sys.executable)
            kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
            result = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "pip",
                    "install",
                    "-U",
                    "yt-dlp",
                    "yt-dlp-ejs"
                ],
                capture_output=True,
                text=True,
                **kwargs
            )

            print(result.stdout)
            if result.stderr:
                print("âš ï¸ STDERR:", result.stderr)

            print("âœ… yt-dlp actualizado")

        except Exception as e:
            print("âŒ Error actualizando yt-dlp:", e)

    threading.Thread(target=job, daemon=True).start()
    return jsonify({"ok": True})

@api_bp.route('/actualizar_cache')
def actualizar_cache():
    pin = request.args.get('pin')
    import config
    if pin != get_master_pin(): return jsonify({'error': 'PIN incorrecto'}), 401
    
    # escaneo fÃ­sico
    escanear_archivos_fisicos()
    return jsonify({"ok": True})

@api_bp.route('/crear_carpeta', methods=['POST'])
def crear_carpeta():
    try:
        name = request.json['name']
        safe_path = validar_path(name)
        safe_path.mkdir(parents=True, exist_ok=True)
        return jsonify({"ok": True})
    except Exception as e:
        print("Error en /crear_carpeta:", e)
        return jsonify({"error": "Nombre de carpeta invÃ¡lido"}), 400

@api_bp.route('/borrar', methods=['POST'])
def borrar(): 
    try:
        data = request.json
        rel_path = data.get('file')
        pin = data.get('pin')
        
        # ðŸ” Validar PIN Maestro
        import config
        if pin != get_master_pin():
            return jsonify({'error': 'PIN incorrecto. OperaciÃ³n de borrado denegada.'}), 401

        # ðŸ” Ruta segura del archivo principal
        path = validar_path(rel_path)

        base = os.path.splitext(os.path.basename(rel_path))[0]
        
        # 1. Borrar archivo fÃ­sico (MP3/Video)
        if path.exists():
            path.unlink()
        
        # 2. Borrar miniaturas (tambiÃ©n protegidas)
        for ext in ['.jpg', '.webp', '.png']:
            thumb_rel = os.path.join(os.path.dirname(rel_path), base + ext)
            try:
                thumb = validar_path(thumb_rel, Path(THUMBNAILS_FOLDER).resolve())
                if thumb.exists():
                    thumb.unlink()
            except Exception as e:
             print("Error en Borrar", e)

        # 3. Borrar de Ratings y Historial
        r = load_json(RATINGS_FILE)
        if rel_path in r:
            del r[rel_path]
            save_json(RATINGS_FILE, r)
        
        h = load_json(HISTORY_FILE)
        id_to_del = None
        for uid, data in h.items():
            if data.get('filename') == os.path.basename(rel_path):
                id_to_del = uid
                break
        if id_to_del:
            del h[id_to_del]
            save_json(HISTORY_FILE, h)

        # 4. Limpiar de la base de datos (SQLite)
        from services.database import get_db
        conn = get_db()
        c = conn.cursor()
        c.execute("DELETE FROM media WHERE rel_path = ?", (rel_path,))
        conn.commit()
        conn.close()

        # Limpiar variable en memoria RAM si existe para forzar recarga
        try:
            import services.library
            services.library.BIB_CACHE = None
        except:
            pass

        return jsonify({"ok": True}) 

    except Exception as e: 
        print(f"Error borrando: {e}")
        return jsonify({"ok": False, "error": str(e)}), 400

@api_bp.route('/status')
def status():
    global LAST_ALEXA_COMMAND, ACTIVE_USERS
    
    # 1. RECIBIR DATOS (Ahora con Tiempo y DuraciÃ³n)
    session_id = request.args.get('sid')
    user_name_fallback = request.args.get('user', 'Invitado')
    is_speaker_param = request.args.get('is_speaker')
    current_song = request.args.get('song', '')
    current_artist = request.args.get('artist', '')
    current_path = request.args.get('path', '')
    current_time = request.args.get('time', '0')
    total_duration = request.args.get('duration', '0')
    is_speaker = (is_speaker_param == 'true')
    
    # --- INTERCEPCIÃ“N CLOUDFLARE ---
    # --- AUTENTICACIÓN: JWT local → Cloudflare fallback ---
    auth_email = get_user_from_request(request)
    
    # Valores por defecto para el Radar
    final_username = user_name_fallback
    avatar_url = None
    is_superadmin = False
    needs_registration = False
    
    import config
    db_email = auth_email if auth_email else config.SUPERADMIN_EMAIL

    # 2. CONSULTAR/CREAR USUARIO EN BD
    if session_id:
        try:
            conn = get_db()
            c = conn.cursor()
            c.execute("SELECT username, avatar_url, is_superadmin FROM users WHERE email = ?", (db_email,))
            user_row = c.fetchone()
            
            if user_row:
                final_username = user_row['username'] or final_username
                avatar_url = user_row['avatar_url']
                is_superadmin = bool(user_row['is_superadmin'])
                
                # Auto-PromociÃ³n a Super Admin via Config
                import config
                if config.SUPERADMIN_EMAIL and db_email.lower() == config.SUPERADMIN_EMAIL.lower() and not is_superadmin:
                    is_superadmin = True
                    c.execute("UPDATE users SET is_superadmin = 1 WHERE email = ?", (db_email,))
                
                c.execute("UPDATE users SET sid = ? WHERE email = ?", (session_id, db_email))
                conn.commit()
                
                # Exigir registro si no tienen avatar (perfil incompleto)
                if not avatar_url:
                    needs_registration = True
            else:
                needs_registration = True
                
                import config
                is_admin = 1 if (config.SUPERADMIN_EMAIL and db_email.lower() == config.SUPERADMIN_EMAIL.lower()) else 0
                is_superadmin = bool(is_admin)
                
                c.execute("INSERT INTO users (email, sid, username, is_superadmin, created_at) VALUES (?, ?, ?, ?, ?)", 
                          (db_email, session_id, final_username, is_admin, time.time()))
                conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error en Radar DB: {e}")

    # 3. ACTUALIZAR ESTADO EN MEMORIA (Para velocidad)
    if session_id:
        with USERS_LOCK:
            ACTIVE_USERS[session_id] = {
                'email': db_email,
                'name': final_username,
                'avatar': avatar_url,
                'is_superadmin': is_superadmin,
                'last_ping': time.time(),
                'is_speaker': is_speaker,
                'initial': final_username[0].upper() if final_username else '?',
                'song': current_song,
                'artist': current_artist,
                'path': current_path,
                'time': current_time,
                'duration': total_duration,
                'needs_registration': needs_registration
            }

    # 4. PREPARAR LISTA
    online_list = []
    with USERS_LOCK:
        for sid, data in ACTIVE_USERS.items():
            online_list.append({
                'session_id': sid,
                'email': data.get('email', ''),
                'name': data['name'],
                'avatar': data.get('avatar'),
                'is_superadmin': data.get('is_superadmin', False),
                'initial': data['initial'],
                'is_speaker': data['is_speaker'],
                'is_me': (sid == session_id),
                'song': data.get('song', ''),
                'artist': data.get('artist', ''),
                'path': data.get('path', ''),
                'time': data.get('time', '0'),
                'duration': data.get('duration', '0')
            })

    response = progress_status.copy()
    response['last_command'] = LAST_ALEXA_COMMAND
    response['online_users'] = online_list
    
    # Retornamos flag global para forzar al frontend de ESTE cliente a registrarse
    if session_id and session_id in ACTIVE_USERS:
        response['my_email'] = db_email
    
    # CHEQUEO DE BUZÃ“N (CONTROL REMOTO)
    if session_id in PENDING_COMMANDS:
        cmd = PENDING_COMMANDS[session_id]
        if time.time() - cmd['time'] < 10:
            response['remote_command'] = cmd['action']
            response['from_name'] = cmd.get('from_name', 'Alguien')
        del PENDING_COMMANDS[session_id]
    
    return jsonify(response)

@api_bp.route('/api/user/profile', methods=['POST'])
def update_profile():
    try:
        data = request.json
        email = data.get('email')
        username = data.get('username')
        avatar_url = data.get('avatar_url')
        
        if not email:
            return jsonify({"ok": False, "error": "Email is required"}), 400
        
        conn = get_db()
        c = conn.cursor()
        
        # ActualizaciÃ³n parcial: solo actualizar los campos que se envÃ­an
        if username and avatar_url:
            c.execute("UPDATE users SET username = ?, avatar_url = ? WHERE email = ?", (username, avatar_url, email))
        elif username:
            c.execute("UPDATE users SET username = ? WHERE email = ?", (username, email))
        elif avatar_url:
            c.execute("UPDATE users SET avatar_url = ? WHERE email = ?", (avatar_url, email))
        else:
            return jsonify({"ok": False, "error": "Nothing to update"}), 400
            
        conn.commit()
        conn.close()
        
        return jsonify({"ok": True, "message": "Profile updated"})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


# --- CUSTOM AVATARS ---
@api_bp.route('/api/avatars')
def list_avatars():
    import config
    avatars_dir = os.path.join(config.BASE_DIR, 'assets', 'avatars')
    if not os.path.isdir(avatars_dir):
        return jsonify({"avatars": []})
    
    valid_ext = {'.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'}
    files = []
    for f in sorted(os.listdir(avatars_dir)):
        if os.path.splitext(f)[1].lower() in valid_ext:
            files.append(f'/avatars/{f}')
    return jsonify({"avatars": files})

# --- PLAYLIST SHARING ---
@api_bp.route('/playlist/share', methods=['POST'])
def share_playlist():
    import secrets
    try:
        data = request.json
        name = data.get('name')
        owner = data.get('owner')
        if not name or not owner:
            return jsonify({"ok": False, "error": "name and owner required"}), 400
        
        conn = get_db()
        c = conn.cursor()
        c.execute("SELECT id, share_token FROM playlists WHERE name = ? AND owner_email = ?", (name, owner))
        row = c.fetchone()
        if not row:
            conn.close()
            return jsonify({"ok": False, "error": "Playlist not found"}), 404
        
        # Reusar token existente o generar uno nuevo
        token = row['share_token']
        if not token:
            token = secrets.token_urlsafe(4)[:6].upper()  # 6 chars
            c.execute("UPDATE playlists SET share_token = ? WHERE id = ?", (token, row['id']))
            conn.commit()
        
        conn.close()
        return jsonify({"ok": True, "code": token})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@api_bp.route('/playlist/import', methods=['POST'])
def import_playlist():
    import uuid
    try:
        data = request.json
        code = (data.get('code') or '').strip().upper()
        owner = data.get('owner')
        if not code or not owner:
            return jsonify({"ok": False, "error": "code and owner required"}), 400
        
        conn = get_db()
        c = conn.cursor()
        
        # Buscar playlist por share_token
        c.execute("SELECT id, name, owner_email FROM playlists WHERE share_token = ?", (code,))
        source = c.fetchone()
        if not source:
            conn.close()
            return jsonify({"ok": False, "error": "Codigo no encontrado"}), 404
        
        # No importar la propia
        if source['owner_email'] == owner:
            conn.close()
            return jsonify({"ok": False, "error": "Esta playlist ya es tuya"}), 400
        
        # Buscar nombre disponible (manejar UNIQUE constraints)
        base_name = source['name']
        new_name = base_name
        suffix = 0
        while True:
            c.execute("SELECT id FROM playlists WHERE name = ?", (new_name,))
            if not c.fetchone():
                break
            suffix += 1
            new_name = f"{base_name} (importada{'' if suffix == 1 else ' ' + str(suffix)})"
        
        # Crear copia de la playlist
        new_id = str(uuid.uuid4())
        import time as _time
        c.execute("INSERT INTO playlists (id, name, owner_email, created_at) VALUES (?, ?, ?, ?)",
                  (new_id, new_name, owner, _time.time()))
        
        # Copiar items
        c.execute("SELECT rel_path, position FROM playlist_items WHERE playlist_id = ? ORDER BY position", (source['id'],))
        items = c.fetchall()
        for item in items:
            c.execute("INSERT INTO playlist_items (playlist_id, rel_path, position) VALUES (?, ?, ?)",
                      (new_id, item['rel_path'], item['position']))
        
        conn.commit()
        conn.close()
        return jsonify({"ok": True, "name": new_name, "count": len(items)})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@api_bp.route('/stop', methods=['POST'])
def stop(): global stop_download; stop_download = True; return jsonify({"ok": True})

def _infer_subtitle_language(video_base, subtitle_name):
    name_no_ext = os.path.splitext(subtitle_name)[0]
    suffix = name_no_ext[len(video_base):].strip(" ._-").lower() if name_no_ext.lower().startswith(video_base.lower()) else ''
    token = suffix.split('.')[-1] if suffix else ''
    mapping = {
        'es': 'spa', 'spa': 'spa', 'esla': 'spa', 'lat': 'spa', 'la': 'spa',
        'en': 'eng', 'eng': 'eng',
        'jp': 'jpn', 'jpn': 'jpn',
        'pt': 'por', 'por': 'por',
        'fr': 'fra', 'fra': 'fra',
        'de': 'deu', 'deu': 'deu',
        'it': 'ita', 'ita': 'ita',
    }
    return mapping.get(token, 'und')

def _subtitle_matches_video_base(video_base, subtitle_name):
    subtitle_base = os.path.splitext(subtitle_name)[0].lower()
    video_base_l = video_base.lower()
    if subtitle_base == video_base_l:
        return True

    escaped = re.escape(video_base_l)
    return re.match(rf"^{escaped}([._\- ].+)$", subtitle_base) is not None

def _find_external_subtitles(full_video_path):
    video_dir = os.path.dirname(full_video_path)
    video_filename = os.path.basename(full_video_path)
    video_base = os.path.splitext(video_filename)[0]
    sub_dirs = [video_dir, os.path.join(video_dir, 'subs'), os.path.join(video_dir, 'subtitles')]
    supported_exts = {'.srt', '.vtt'}
    found = []
    seen = set()

    for sub_dir in sub_dirs:
        if not os.path.isdir(sub_dir):
            continue

        for entry in os.listdir(sub_dir):
            ext = os.path.splitext(entry)[1].lower()
            if ext not in supported_exts:
                continue

            if not _subtitle_matches_video_base(video_base, entry):
                continue

            full_sub_path = os.path.join(sub_dir, entry)
            rel_sub_path = os.path.relpath(full_sub_path, DOWNLOAD_FOLDER).replace('\\', '/')
            if rel_sub_path in seen:
                continue
            seen.add(rel_sub_path)

            language = _infer_subtitle_language(video_base, entry)
            label = f"Externo {len(found) + 1}"
            if language == 'spa':
                label = "Externo Español"
            elif language == 'eng':
                label = "Externo Inglés"

            found.append({
                'index': -(len(found) + 1),
                'language': language,
                'title': label,
                'codec': ext[1:],
                'url': f'/descargas/{rel_sub_path}',
                'external': True
            })

    return found

@api_bp.route('/api/video/streams', methods=['POST'])
def get_video_metadata():
    try:
        data = request.json
        rel_path = data.get('path')
        
        if not rel_path:
            return jsonify({'error': 'No path provided'}), 400
        
        full_path = os.path.join(DOWNLOAD_FOLDER, rel_path)
        
        if not os.path.exists(full_path):
            return jsonify({'error': 'File not found'}), 404
        
        streams = get_video_streams(full_path)
        streams['subtitles'] = streams.get('subtitles', []) + _find_external_subtitles(full_path)
        
        return jsonify({
            'ok': True,
            'streams': streams
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Endpoint 2: AUTO-TAGGER DE GÃ‰NEROS
@api_bp.route('/api/autotag_library', methods=['POST'])
def autotag_library():
	"""
	Auto-completar gÃ©neros desde Last.fm CON INTELIGENCIA:
	- Solo procesa archivos SIN gÃ©nero o con gÃ©nero = "Otros" / "Unknown"
	- Guarda en archivos fÃ­sicos (.m4a, .mp3)
	- Actualiza la base de datos SQLite directamente
	- Maneja artistas mÃºltiples (separa por ";" o ";")
	"""
	data = request.json or {}
	pin = data.get('pin')
	import config
	if pin != config.MASTER_PIN: return jsonify({'error': 'PIN incorrecto'}), 401
	from services.database import get_db
	from services.lastfm import get_lastfm_data
	from services.metadata import write_genre_to_file, clean_artist_name
	
	print("\n" + "="*60)
	print("ðŸŽ¯ INICIANDO AUTO-TAGGER INTELIGENTE V3 (SQLite)")
	print("="*60)
	
	conn = get_db()
	c = conn.cursor()
	
	# 1. Obtener archivos que necesitan gÃ©nero de la base de datos
	c.execute('''
		SELECT id, rel_path, artist, genre 
		FROM media 
		WHERE media_type = 'audio' 
		  AND (genre IS NULL 
		       OR TRIM(genre) = '' 
		       OR LOWER(TRIM(genre)) = 'otros' 
		       OR LOWER(TRIM(genre)) = 'unknown' 
		       OR LOWER(TRIM(genre)) = 'desconocido' 
		       OR LOWER(TRIM(genre)) = 'generos')
	''')
	files_to_tag = c.fetchall()
	
	print(f"ðŸ” Archivos sin gÃ©nero: {len(files_to_tag)}")
	
	if not files_to_tag:
		print("âœ… Todos los archivos ya tienen gÃ©nero asignado")
		conn.close()
		return jsonify({
			'ok': True,
			'msg': 'âœ… Todos los archivos ya tienen gÃ©nero',
			'stats': {'total': 0, 'tagged': 0, 'skipped': 0, 'failed': 0}
		})
		
	# 2. Agrupar por Artista
	artists_to_process = {}
	for f in files_to_tag:
		artist_raw = f['artist'].strip() if f['artist'] else ''
		artist_clean = clean_artist_name(artist_raw)
		
		if artist_clean and artist_clean != 'Artista Desconocido':
			if artist_clean not in artists_to_process:
				artists_to_process[artist_clean] = []
			artists_to_process[artist_clean].append(f)
			
	print(f"ðŸ‘¥ Artistas a procesar: {len(artists_to_process)}")
	
	if not artists_to_process:
		conn.close()
		return jsonify({'ok': False, 'msg': 'No hay artistas vÃ¡lidos para buscar'})

	# FunciÃ³n interna de normalizaciÃ³n rÃ¡pida
	def normalize_genre(tags_list):
		ignore_tags = ['seen live', 'favorites', 'awesome', 'good', 'my favorites', 'love at first listen']
		for t in tags_list:
			t_lower = t.lower()
			if t_lower not in ignore_tags and len(t) > 2:
				return t.title()
		return 'Otros'
		
	# 3. Procesar Artistas
	tagged = 0
	failed = 0
	skipped = 0
	files_updated = 0
	total = len(artists_to_process)
	
	print(f"\nðŸš€ Procesando {total} artistas...")
	print("-" * 60)
	
	for idx, (artist, artist_files) in enumerate(artists_to_process.items(), 1):
		try:
			if idx % 5 == 0 or idx == 1 or idx == total:
				progress = (idx / total) * 100
				print(f"\nðŸ“Š Progreso: {idx}/{total} ({progress:.1f}%)")
				
			print(f"  ðŸ” [{idx}/{total}] {artist[:40]} ({len(artist_files)} archivos)")
			
			# Consultar Last.fm
			data = get_lastfm_data('artist.gettoptags', {
				'artist': artist,
				'autocorrect': 1
			})
			
			if not data or 'toptags' not in data:
				print(f"     âš ï¸ Sin respuesta de Last.fm")
				failed += 1
				time.sleep(0.3)
				continue
				
			tags_raw = data['toptags'].get('tag', [])
			if not tags_raw:
				print(f"     âš ï¸ Sin tags disponibles en Last.fm")
				skipped += 1
				time.sleep(0.3)
				continue
				
			tag_names = [t['name'] for t in tags_raw[:10]]
			genre = normalize_genre(tag_names)
			
			print(f"     ðŸ“Œ GÃ©nero detectado: {genre}")
			
			if genre == 'Otros':
				skipped += 1
				continue

			# Escribir en archivos fÃ­sicos e SQLite
			updated_count = 0
			for file_obj in artist_files:
				rel_path = file_obj['rel_path']
				file_path = os.path.join(config.DOWNLOAD_FOLDER, rel_path)
				
				if not os.path.exists(file_path):
					print(f"       âš ï¸ Archivo no existe en disco: {file_path}")
					continue
					
				# Escribir etiqueta fÃ­sica (Mutagen)
				success, e_msg = write_genre_to_file(file_path, genre)
				
				if success:
					# Actualizar SQLite
					c.execute("UPDATE media SET genre = ? WHERE rel_path = ?", (genre, rel_path))
					updated_count += 1
				else:
					print(f"       âŒ Taggeador fallÃ³ en {os.path.basename(file_path)}: {e_msg}")
					
			if updated_count > 0:
				conn.commit()  # Hacer commit por cada artista para no perder info
				print(f"     âœ… {updated_count}/{len(artist_files)} archivos actualizados")
				tagged += 1
				files_updated += updated_count
			else:
				failed += 1
				
			time.sleep(0.5) # Respetar API LastFM
				
		except Exception as e:
			print(f"     âŒ ERROR en artista {artist}: {e}")
			failed += 1
			time.sleep(0.5)

	conn.close()
	
	print("\n" + "="*60)
	print("ðŸŽ‰ AUTO-TAGGER COMPLETADO")
	print("="*60)
	print(f"âœ… Artistas etiquetados: {tagged}/{total}")
	print(f"ðŸ“ Archivos actualizados: {files_updated}")
	print(f"âš ï¸ Sin tags nuevos: {skipped}")
	print(f"âŒ Errores: {failed}")
	print("="*60 + "\n")
	
	try:
	    # Invalidar cachÃ© en memoria principal si es posible
	    import services.library
	    from state import MIXES_CACHE
	    services.library.BIB_CACHE = None
	except:
	    pass
	
	return jsonify({
		'ok': True,
		'msg': f'âœ… {tagged} artistas y {files_updated} archivos actualizados con Ã©xito',
		'stats': {
			'total': total,
			'tagged': tagged,
			'files_updated': files_updated,
			'skipped': skipped,
			'failed': failed
		}
	})


# ============================================================
# SETUP WIZARD & SETTINGS
# ============================================================

@api_bp.route('/api/setup/status', methods=['GET'])
def setup_status():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) as count FROM users WHERE is_superadmin = 1")
    row = c.fetchone()
    conn.close()
    
    needs_setup = row['count'] == 0 if row else True
    runtime = _load_runtime_config()
    
    return jsonify({
        'needs_setup': needs_setup,
        'current_pin': '****' if runtime.get('pin') else None,
        'current_media_path': runtime.get('media_path', '')
    })


@api_bp.route('/api/setup/firsttime', methods=['POST'])
def setup_firsttime():
    """Primera configuración - crea admin con username/password y guarda PIN maestro."""
    data = request.json or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')
    pin = data.get('pin', '')
    media_path = data.get('media_path', '').strip()
    
    if not username:
        return jsonify({'error': 'Nombre de usuario requerido'}), 400
    valid, error_msg = validate_password_strength(password)
    if not valid:
        return jsonify({'error': error_msg}), 400
    if not pin or len(pin) < 4:
        return jsonify({'error': 'PIN mínimo 4 dígitos'}), 400
    
    try:
        # Guardar PIN maestro en JSON
        _save_runtime_config('pin', pin)
        
        if media_path:
            _save_runtime_config('media_path', media_path)
        
        # Crear usuario admin con contraseña
        safe_name = username.lower().replace(' ', '_')
        email = f"{safe_name}@kraken.local"
        password_hash = hash_password(password)
        
        conn = get_db()
        c = conn.cursor()
        c.execute("""
            INSERT INTO users (email, username, pin_hash, is_superadmin, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (email, username, password_hash, 1, time.time()))
        conn.commit()
        conn.close()
        
        return jsonify({'ok': True, 'email': email})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/api/settings', methods=['POST'])
def update_settings():
    data = request.json or {}
    current_pin = data.get('pin', '')
    new_pin = data.get('new_pin', '')
    new_media_path = data.get('media_path', '').strip()
    
    runtime = _load_runtime_config()
    if current_pin != runtime.get('pin'):
        return jsonify({'error': 'PIN incorrecto'}), 401
    
    changes = {}
    
    if new_pin:
        if len(new_pin) < 4:
            return jsonify({'error': 'PIN debe tener al menos 4 digitos'}), 400
        _save_runtime_config('pin', new_pin)
        changes['pin'] = new_pin
        
    if new_media_path:
        _save_runtime_config('media_path', new_media_path)
        changes['media_path'] = new_media_path
    
    if not changes:
        return jsonify({'error': 'No hay cambios para aplicar'}), 400
    
    return jsonify({"ok": True, "changes": changes})


@api_bp.route('/analyze/start', methods=['POST'])
def start_analysis():
    data = request.json or {}
    pin = data.get('pin')
    import config
    if pin != get_master_pin(): return jsonify({'error': 'PIN incorrecto'}), 401
    
    try:
        from services.audio_analyzer import start_library_analysis
        started = start_library_analysis()
        return jsonify({'ok': True, 'started': started})
    except ImportError:
        return jsonify({'error': 'Librosa no esta instalado.'}), 500

@api_bp.route('/analyze/status')
def analyze_status():
    try:
        from services.audio_analyzer import get_analysis_status
        return jsonify(get_analysis_status())
    except ImportError:
        return jsonify({'active': False, 'error': 'Librosa no disponible'})


# ============= AUTO-TAGGER DE VIDEOS (TMDB) =============
@api_bp.route('/api/auto_tag_video', methods=['POST'])
def auto_tag_video_endpoint():
    """
    Auto-tag de videos usando TMDB
    Busca metadata y descarga carátulas automáticamente
    """
    data = request.json or {}
    pin = data.get('pin')
    path = data.get('path')
    
    import config
    if pin != get_master_pin():
        return jsonify({'error': 'PIN incorrecto'}), 401
    
    if not path:
        return jsonify({'error': 'Falta la ruta del video'}), 400
    
    try:
        from services.video_tagger import (
            auto_tag_video, 
            detect_video_type, 
            download_poster,
            clean_title_for_search
        )
        
        # Detectar tipo de video
        video_type = detect_video_type(path)
        
        # Buscar metadata en TMDB
        result = auto_tag_video(path, video_type)
        
        if not result:
            return jsonify({'found': False, 'message': 'No se encontró en TMDB'}), 404
        
        # Preparar respuesta
        title = result.get('title') or result.get('name')
        overview = result.get('overview', '')
        year = (result.get('release_date') or result.get('first_air_date', ''))[:4]
        
        # Extraer géneros
        genres = [g['name'] for g in result.get('genres', [])]
        
        # Descargar poster
        poster_path = result.get('poster_path')
        tmdb_id = result.get('id')
        if poster_path:
            filename_base = clean_title_for_search(title or path)
            # Incluir TMDB ID para evitar colisiones entre secuelas
            if tmdb_id:
                filename_base = f"{filename_base}_{tmdb_id}"
            poster_filename = download_poster(
                poster_path, 
                config.THUMBNAILS_FOLDER,
                filename_base
            )
        else:
            poster_filename = None

        # Guardar en base de datos
        from services.database import get_db
        conn = get_db()
        c = conn.cursor()

        # Actualizar o insertar metadata
        c.execute('''
            INSERT OR REPLACE INTO video_metadata
            (path, tmdb_title, tmdb_year, tmdb_overview, tmdb_genres, tmdb_poster, tmdb_id, tmdb_type, tmdb_rating)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            path,
            title,
            year,
            overview,
            ','.join(genres),
            poster_filename,
            result.get('id'),
            result.get('media_type'),
            result.get('content_rating')
        ))
        conn.commit()
        conn.close()

        return jsonify({
            'found': True,
            'title': title,
            'year': year,
            'overview': overview[:200] + '...' if overview and len(overview) > 200 else overview,
            'genres': genres,
            'poster': poster_filename,
            'type': result.get('media_type')
        })
        
    except Exception as e:
        print(f"Error en auto_tag_video: {e}")
        return jsonify({'error': str(e)}), 500


@api_bp.route('/api/auto_tag_library_videos', methods=['POST'])
def auto_tag_library_videos():
    import time
    """
    Auto-tag de TODOS los videos de la biblioteca
    Procesa videos sin metadata de TMDB
    """
    data = request.json or {}
    pin = data.get('pin')
    
    import config
    if pin != get_master_pin():
        return jsonify({'error': 'PIN incorrecto'}), 401
    
    try:
        from services.database import get_db
        from services.video_tagger import (
            auto_tag_video, 
            detect_video_type, 
            download_poster,
            clean_title_for_search,
            is_series_episode,
            extract_series_name_from_path,
            get_series_folder_name
        )
        
        conn = get_db()
        c = conn.cursor()
        
        # Obtener videos sin metadata TMDB (primero agregar columnas si no existen)
        try:
            c.execute("ALTER TABLE media ADD COLUMN tmdb_id INTEGER DEFAULT 0")
        except:
            pass
        try:
            c.execute("ALTER TABLE media ADD COLUMN tmdb_title TEXT")
        except:
            pass
        try:
            c.execute("ALTER TABLE media ADD COLUMN tmdb_year TEXT")
        except:
            pass
        try:
            c.execute("ALTER TABLE media ADD COLUMN tmdb_overview TEXT")
        except:
            pass
        try:
            c.execute("ALTER TABLE media ADD COLUMN tmdb_genres TEXT")
        except:
            pass
        try:
            c.execute("ALTER TABLE media ADD COLUMN tmdb_poster TEXT")
        except:
            pass
        
        c.execute('''
            SELECT rel_path, title, folder_type FROM media 
            WHERE media_type = 'video' 
            AND (tmdb_title IS NULL OR tmdb_title = '')
        ''')
        
        videos = c.fetchall()
        
        # Paso 2: Encontrar carpetas de series que NO tienen poster
        c.execute('''
            SELECT DISTINCT folder FROM media 
            WHERE media_type = 'video' AND folder_type = 'series'
        ''')
        series_folders = [row[0] for row in c.fetchall()]
        
        folders_without_poster = []
        for folder in series_folders:
            poster_exists = os.path.exists(os.path.join(config.THUMBNAILS_FOLDER, f"{folder}.jpg"))
            if not poster_exists:
                # Obtener UN episodio de esta carpeta para hacer auto-tag
                c.execute('SELECT rel_path FROM media WHERE folder = ? AND media_type = ? LIMIT 1', (folder, 'video'))
                ep = c.fetchone()
                if ep:
                    folders_without_poster.append(ep[0])
        
        # Combinar: videos sin metadata + 1 episodio por carpeta sin poster
        all_to_process = list(set([v[0] for v in videos] + folders_without_poster))
        
        # Re-fetch full data for combined list
        placeholders = ','.join('?' for _ in all_to_process)
        c.execute(f'SELECT rel_path, title, folder_type FROM media WHERE rel_path IN ({placeholders})', all_to_process)
        videos = c.fetchall()
        
        if not videos:
            return jsonify({'message': 'No hay videos para procesar', 'processed': 0})
        
        # Inicializar barra de progreso para auto-tag
        state.RESCAN_STATUS = {
            "active": True,
            "stage": "auto_tag",
            "total": len(videos),
            "processed": 0,
            "percent": 0,
            "message": f"Preparando auto-tag de {len(videos)} videos...",
            "start_time": time.time()
        }
        
        processed = 0
        found = 0
        posters_downloaded = 0
        skipped_existing = 0
        
        # Track de posters de carpetas ya descargados
        folder_posters_cache = {}
        
        for video in videos:
            video_path = video[0]  # rel_path
            video_title = video[1] if len(video) > 1 else ''
            video_folder_type = video[2] if len(video) > 2 else 'movie'  # folder_type de la DB
            try:
                result = auto_tag_video(video_path, video_folder_type)

                if result:
                    title = result.get('title') or result.get('name')
                    year = (result.get('release_date') or result.get('first_air_date', ''))[:4]
                    overview = result.get('overview', '')
                    genres = [g['name'] for g in result.get('genres', [])]

                    poster_path = result.get('poster_path')
                    poster_filename = None

                    # Detectar si es episodio de serie
                    is_episode = is_series_episode(os.path.basename(video_path))

                    if is_episode:
                        # Episodio: NO guardar poster en DB
                        # Solo descargar el poster de la carpeta si no existe
                        series_name = extract_series_name_from_path(video_path)
                        folder_name = get_series_folder_name(video_path)

                        if folder_name:
                            # Nombre del poster de la carpeta
                            folder_poster_name = f"{folder_name}.jpg"
                            folder_poster_path = os.path.join(config.THUMBNAILS_FOLDER, folder_poster_name)

                            # Solo descargar si no existe y no está en cache
                            if folder_name not in folder_posters_cache:
                                if poster_path and not os.path.exists(folder_poster_path):
                                    folder_poster_filename = download_poster(
                                        poster_path,
                                        config.THUMBNAILS_FOLDER,
                                        clean_title_for_search(series_name)
                                    )
                                    if folder_poster_filename:
                                        old_path = os.path.join(config.THUMBNAILS_FOLDER, folder_poster_filename)
                                        if old_path != folder_poster_path:
                                            os.rename(old_path, folder_poster_path)
                                        posters_downloaded += 1
                                        print(f"  Poster de serie descargado: {folder_poster_name}")

                                folder_posters_cache[folder_name] = folder_poster_name

                        # NO asignar poster_filename - ya es None de la línea 2380
                        # Los episodios mostrarán thumbnail del video
                    else:
                        # Es película: descargar poster normalmente
                        if poster_path:
                            tmdb_id_val = result.get('id')
                            filename_base = clean_title_for_search(title or video_title or video_path)
                            # Incluir TMDB ID para evitar colisiones entre secuelas
                            if tmdb_id_val:
                                filename_base = f"{filename_base}_{tmdb_id_val}"
                            poster_filename = download_poster(
                                poster_path,
                                config.THUMBNAILS_FOLDER,
                                filename_base
                            )

                    # Guardar en la tabla media directamente
                    c.execute('''
                        UPDATE media SET
                        tmdb_id = ?,
                        tmdb_title = ?,
                        tmdb_year = ?,
                        tmdb_overview = ?,
                        tmdb_genres = ?,
                        tmdb_poster = ?,
                        tmdb_rating = ?
                        WHERE rel_path = ?
                    ''', (
                        result.get('id'),
                        title,
                        year,
                        overview,
                        ','.join(genres),
                        poster_filename,
                        result.get('content_rating'),
                        video_path
                    ))
                    conn.commit()
                    found += 1

                processed += 1

                # Actualizar barra de progreso cada 5 videos
                if processed % 5 == 0 or processed == len(videos):
                    percent = int((processed / len(videos)) * 100)
                    state.RESCAN_STATUS["processed"] = processed
                    state.RESCAN_STATUS["percent"] = percent
                    state.RESCAN_STATUS["message"] = f"Auto-tag {processed}/{len(videos)} ({percent}%) - {posters_downloaded} posters serie"

            except Exception as e:
                print(f"Error procesando {video_path}: {e}")
                continue
        
        # FASE 2: Actualizar Ratings
        c.execute("SELECT rel_path, tmdb_id, folder_type, tmdb_title FROM media WHERE tmdb_id IS NOT NULL AND tmdb_id > 0 AND (tmdb_rating IS NULL OR tmdb_rating = '') AND media_type = 'video'")
        rating_videos = c.fetchall()
        updated_ratings = 0
        if rating_videos:
            for i, video in enumerate(rating_videos):
                try:
                    import time as _time; _time.sleep(0.05)
                    if video[2] == 'movie':
                        from services.video_tagger import get_movie_details; res = get_movie_details(video[1])
                    else:
                        from services.video_tagger import get_tv_details; res = get_tv_details(video[1])
                        
                    if res and res.get('content_rating'):
                        c.execute('UPDATE media SET tmdb_rating = ? WHERE rel_path = ?', (res.get('content_rating'), video[0]))
                        conn.commit()
                        updated_ratings += 1
                        
                    if i % 3 == 0 or i == len(rating_videos):
                        if len(rating_videos) > 0:
                            pct = 50 + int((i / len(rating_videos)) * 50)
                            state.RESCAN_STATUS["percent"] = pct
                            state.RESCAN_STATUS["message"] = f"Clasificando: {i+1}/{len(rating_videos)} ({pct}%)"
                except: pass

        elapsed = time.time() - state.RESCAN_STATUS.get("start_time", time.time())
        state.RESCAN_STATUS["active"] = False
        state.RESCAN_STATUS["stage"] = "done"
        state.RESCAN_STATUS["percent"] = 100
        state.RESCAN_STATUS["message"] = f"Auto-tag completado en {elapsed:.1f}s - {posters_downloaded} posters y {updated_ratings} clasificaciones actualizadas"
        
        return jsonify({
            'message': f'Procesados {processed} videos, {posters_downloaded} posters descargados y {updated_ratings} clasificaciones actualizadas',
            'found': found, 'processed': processed, 'series_posters': posters_downloaded, 'ratings_updated': updated_ratings
        })
        
    except Exception as e:
        print(f"Error en auto_tag_library_videos: {e}")
        return jsonify({'error': str(e)}), 500


@api_bp.route('/api/update_video_ratings', methods=['POST'])
def update_video_ratings():
    """
    Actualiza SOLO los ratings/certificaciones de videos que YA tienen metadata.
    No descarga posters ni actualiza otros campos.
    """
    data = request.json or {}
    pin = data.get('pin')
    
    import config
    if pin != get_master_pin():
        return jsonify({'error': 'PIN incorrecto'}), 401
    
    from services.database import get_db
    from services.video_tagger import get_movie_details, get_tv_details
    
    conn = get_db()
    c = conn.cursor()
    
    # Obtener videos que tienen tmdb_id pero pueden no tener rating
    c.execute('''
        SELECT rel_path, tmdb_id, folder_type, tmdb_title
        FROM media
        WHERE tmdb_id IS NOT NULL AND tmdb_id > 0
        AND (tmdb_rating IS NULL OR tmdb_rating = '')
        AND media_type = 'video'
        LIMIT 200
    ''')
    
    videos = c.fetchall()
    
    if not videos:
        conn.close()
        return jsonify({'message': 'No hay videos sin rating para actualizar', 'updated': 0}), 200
    
    updated = 0
    errors = []
    
    for video in videos:
        try:
            video_path = video['rel_path']
            tmdb_id = video['tmdb_id']
            folder_type = video['folder_type']
            
            # Determinar si es película o serie
            is_movie = folder_type == 'movie'
            
            # Obtener detalles de TMDB
            if is_movie:
                result = get_movie_details(tmdb_id)
            else:
                result = get_tv_details(tmdb_id)
            
            if result:
                rating = result.get('content_rating')
                
                if rating:
                    # Actualizar solo el rating
                    c.execute('''
                        UPDATE media SET tmdb_rating = ? WHERE rel_path = ?
                    ''', (rating, video_path))
                    conn.commit()
                    updated += 1
                    print(f"✅ Rating actualizado: {video.get('tmdb_title', 'Unknown')} -> {rating}")
                else:
                    print(f"⚠️ No hay rating para: {video.get('tmdb_title', 'Unknown')}")
            else:
                errors.append(f"No se pudo obtener detalles de TMDB para {tmdb_id}")
                
        except Exception as e:
            errors.append(f"Error procesando {video_path}: {str(e)}")
            print(f"❌ Error: {e}")
            continue
    
    conn.close()
    
    return jsonify({
        'message': f'Ratings actualizados: {updated} videos',
        'updated': updated,
        'total': len(videos),
        'errors': errors if errors else None
    })


@api_bp.route('/api/check_update', methods=['GET'])
def check_update():
    """
    Consulta GitHub Releases para verificar si hay nueva versión
    """
    try:
        import config
        import requests
        import re

        def parse_version(raw):
            """Parse versions like v4.87, 4.87-beta, 4.87.1 into comparable tuple."""
            value = str(raw or '').strip().lower()
            value = re.sub(r'^[v\s]+', '', value)
            nums = [int(n) for n in re.findall(r'\d+', value)]
            nums = (nums + [0, 0, 0])[:3]
            return tuple(nums)
        
        repo = config.GITHUB_REPO
        api_url = f"https://api.github.com/repos/{repo}/releases/latest"
        current_version_raw = (request.args.get('current_version') or '').strip()
        
        response = requests.get(api_url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            # Extraer versión del tag
            tag_name_raw = data.get('tag_name', 'v0.0')
            tag_name = str(tag_name_raw).replace('v', '')
            latest_tuple = parse_version(tag_name_raw)
            current_tuple = parse_version(current_version_raw) if current_version_raw else None
            has_update = True if current_tuple is None else (latest_tuple > current_tuple)
            
            # Buscar archivos de descarga (exe o zip)
            assets = data.get('assets', [])
            download_url = None
            
            for asset in assets:
                name = asset.get('name', '').lower()
                if 'installer' in name and name.endswith('.exe'):
                    download_url = asset.get('browser_download_url')
                    break
                elif name.endswith('.exe'):
                    download_url = asset.get('browser_download_url')
                    break
            
            return jsonify({
                'has_update': has_update,
                'version': tag_name,
                'current_version': current_version_raw,
                'download_url': download_url,
                'release_notes': data.get('body', ''),
                'repo': repo
            })
        elif response.status_code == 404:
            return jsonify({'has_update': False, 'message': 'No releases found'})
        else:
            return jsonify({'has_update': False, 'error': f'GitHub API error: {response.status_code}'})
            
    except Exception as e:
        print(f"Error check_update: {e}")
        return jsonify({'has_update': False, 'error': str(e)})


# ═══════════════════════════════════════════════════
# HELPERS DE AUTENTICACIÓN
# ═══════════════════════════════════════════════════

def require_master_pin(f):
    """Decorator que requiere PIN maestro válido."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        pin = request.headers.get('X-Master-Pin') or request.json.get('pin') if request.json else None
        if not pin:
            return jsonify({'error': 'PIN requerido'}), 401
        runtime = _load_runtime_config()
        if pin != runtime.get('pin'):
            return jsonify({'error': 'PIN incorrecto'}), 403
        return f(*args, **kwargs)
    return wrapper

def require_admin(f):
    """Decorator que requiere usuario admin autenticado o master PIN (auditado)."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            req_json = request.get_json(silent=True) or {}
            master_pin = request.headers.get("X-Master-Pin") or req_json.get("pin")
            if master_pin and str(master_pin).strip() == str(get_master_pin()).strip():
                # PIN bypass — auditar siempre
                user_email = get_user_from_request(request) or 'no_user'
                client_ip = _get_client_ip()
                endpoint = f.__name__
                security_logger.warning(
                    f'PIN ADMIN BYPASS: email={user_email} IP={client_ip} '
                    f'endpoint={endpoint} path={request.path} method={request.method}'
                )
                return f(*args, **kwargs)
            user_email = get_user_from_request(request)
            if not user_email:
                return jsonify({'error': 'No autorizado'}), 401
            conn = get_db()
            c = conn.cursor()
            c.execute("SELECT is_superadmin FROM users WHERE email = ?", (user_email,))
            row = c.fetchone()
            conn.close()
            if not row or not row['is_superadmin']:
                return jsonify({'error': 'Solo admins'}), 403
            return f(*args, **kwargs)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({'error': str(e)}), 500
    return wrapper


# ═══════════════════════════════════════════════════
# SISTEMA DE AUTENTICACIÓN LOCAL (Plex-Style)
# ═══════════════════════════════════════════════════

@api_bp.route('/api/auth/users', methods=['GET'])
def auth_list_users():
    """Lista usuarios para la pantalla '¿Quién está viendo?'"""
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT email, username, avatar_url, is_superadmin, pin_hash FROM users ORDER BY created_at")
    users = []
    for row in c.fetchall():
        users.append({
            'email': row['email'],
            'username': row['username'] or 'Usuario',
            'avatar_url': row['avatar_url'],
            'is_superadmin': bool(row['is_superadmin']),
            'has_password': bool(row['pin_hash'])
        })
    conn.close()
    return jsonify({'users': users, 'has_admin': any(u['is_superadmin'] for u in users)})

@api_bp.route('/api/admin/users', methods=['GET'])
@require_admin
def admin_list_users():
    """Lista todos los usuarios (para panel de admin)."""
    try:
        conn = get_db()
        c = conn.cursor()
        # Ver qué columnas existen
        c.execute("PRAGMA table_info(users)")
        columns = [row[1] for row in c.fetchall()]
        print('[ADMIN] Columns in users table:', columns)

        # Construir query dinámicamente
        base_cols = ['email', 'username', 'avatar_url', 'is_superadmin', 'created_at']
        if 'is_kid_mode' in columns:
            base_cols.append('is_kid_mode')
        if 'id' in columns:
            base_cols.insert(0, 'id')
        
        query = f"SELECT {', '.join(base_cols)} FROM users ORDER BY created_at"
        print(f'[ADMIN] Query: {query}')
        c.execute(query)

        users = []
        for row in c.fetchall():
            user_data = {
                'email': row['email'],
                'username': row['username'] or 'Usuario',
                'avatar_url': row['avatar_url'],
                'is_superadmin': bool(row['is_superadmin']),
                'created_at': row['created_at'],
                'is_kid_mode': bool(row['is_kid_mode']) if 'is_kid_mode' in columns else False
            }
            if 'id' in columns:
                user_data['id'] = row['id']
            users.append(user_data)
        conn.close()
        return jsonify({'users': users})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@api_bp.route('/api/admin/users', methods=['POST'])
@require_admin
def admin_create_user():
    """Crear usuario directamente (solo admins)."""
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username:
        return jsonify({'error': 'Nombre requerido'}), 400
    valid, error_msg = validate_password_strength(password)
    if not valid:
        return jsonify({'error': error_msg}), 400
    
    conn = get_db()
    c = conn.cursor()
    
    safe_name = username.lower().replace(' ', '_')
    email = f"{safe_name}@kraken.local"
    
    c.execute("SELECT email FROM users WHERE email = ?", (email,))
    if c.fetchone():
        conn.close()
        return jsonify({'error': 'Este nombre de usuario ya está registrado'}), 409
    
    password_hash = hash_password(password)
    
    c.execute("""
        INSERT INTO users (email, username, avatar_url, is_superadmin, pin_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (email, username, None, 0, password_hash, time.time()))
    conn.commit()
    conn.close()

    security_logger.info(f'USER CREATED: email={email} username={username}')
    return jsonify({'ok': True, 'email': email})

@api_bp.route('/api/admin/users/<email>', methods=['DELETE'])
@require_admin
def admin_delete_user(email):
    """Eliminar usuario por email."""
    conn = get_db()
    c = conn.cursor()
    
    c.execute("SELECT is_superadmin FROM users WHERE email = ?", (email,))
    row = c.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    if row['is_superadmin']:
        conn.close()
        return jsonify({'error': 'No se puede eliminar al admin'}), 403
    
    c.execute("DELETE FROM users WHERE email = ?", (email,))
    conn.commit()
    conn.close()

    security_logger.info(f'USER DELETED: email={email}')
    return jsonify({'ok': True})

@api_bp.route('/api/admin/users/<email>/password', methods=['PUT'])
@require_admin
def admin_reset_password(email):
    """Resetear contraseña de usuario."""
    data = request.get_json() or {}
    new_password = data.get('password', '')

    valid, error_msg = validate_password_strength(new_password)
    if not valid:
        return jsonify({'error': error_msg}), 400
    
    conn = get_db()
    c = conn.cursor()
    password_hash = hash_password(new_password)
    c.execute("UPDATE users SET pin_hash = ? WHERE email = ?", (password_hash, email))
    conn.commit()
    conn.close()
    security_logger.info(f'PASSWORD RESET: email={email}')
    return jsonify({'ok': True})


@api_bp.route('/api/admin/users/<email>/kidmode', methods=['PUT'])
@require_admin
def admin_toggle_kid_mode(email):
    """Activar/desactivar modo niños para un usuario."""
    data = request.get_json() or {}
    is_kid_mode = data.get('is_kid_mode', False)
    
    conn = get_db()
    c = conn.cursor()
    
    # Verificar que el usuario existe
    c.execute("SELECT email FROM users WHERE email = ?", (email,))
    if not c.fetchone():
        conn.close()
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    # No permitir modo niños para el admin principal
    c.execute("SELECT is_superadmin FROM users WHERE email = ?", (email,))
    user = c.fetchone()
    if user and user['is_superadmin']:
        conn.close()
        return jsonify({'error': 'No se puede activar modo niños para el administrador'}), 400
    
    # Actualizar modo niños
    c.execute("UPDATE users SET is_kid_mode = ? WHERE email = ?", (1 if is_kid_mode else 0, email))
    conn.commit()
    conn.close()
    
    return jsonify({'ok': True, 'is_kid_mode': is_kid_mode})


@api_bp.route('/api/admin/invite', methods=['POST'])
@require_admin
def admin_create_invite():
    """Genera código de invitación con expiración configurable."""
    data = request.get_json() or {}
    # Duración en minutos: 0 = nunca expira, 5 = 5 min, 60 = 1 hora, 1440 = 24 horas
    duration_minutes = data.get('duration_minutes', 0)
    
    code = generate_invite_code()
    if '_invite_codes' not in state.STREAM_TOKENS:
        state.STREAM_TOKENS['_invite_codes'] = {}
    
    # Guardar tiempo de creación y duración
    state.STREAM_TOKENS['_invite_codes'][code] = {
        'created_at': time.time(),
        'duration_minutes': duration_minutes,
        'expires_at': time.time() + (duration_minutes * 60) if duration_minutes > 0 else None
    }
    
    response = {'code': code}
    if duration_minutes > 0:
        response['expires_at'] = state.STREAM_TOKENS['_invite_codes'][code]['expires_at']
        response['duration_text'] = f'{duration_minutes} minutos' if duration_minutes < 60 else f'{duration_minutes // 60} horas'
    
    return jsonify(response)

@api_bp.route('/api/admin/invite', methods=['DELETE'])
@require_admin
def admin_delete_invite():
    """Invalidar todos los códigos de invitación."""
    if '_invite_codes' in state.STREAM_TOKENS:
        state.STREAM_TOKENS['_invite_codes'] = {}
    return jsonify({'ok': True})

@api_bp.route('/api/admin/invite/validate', methods=['POST'])
def validate_invite_code():
    """Validar código de invitación sin consumirlo."""
    data = request.get_json() or {}
    code = data.get('code', '').strip().upper()
    
    if not code:
        return jsonify({'valid': False, 'error': 'Código requerido'}), 400
    
    codes = state.STREAM_TOKENS.get('_invite_codes', {})
    
    if code not in codes:
        return jsonify({'valid': False, 'error': 'Código inválido'}), 404
    
    code_data = codes[code]
    if isinstance(code_data, dict) and code_data.get('expires_at'):
        if time.time() > code_data['expires_at']:
            del state.STREAM_TOKENS['_invite_codes'][code]
            return jsonify({'valid': False, 'error': 'Código expirado'}), 410
    
    # Código válido - no lo consumimos, solo validamos
    response = {'valid': True}
    if isinstance(code_data, dict) and code_data.get('expires_at'):
        response['expires_at'] = code_data['expires_at']
    
    return jsonify(response)

@api_bp.route('/api/config/public', methods=['GET'])
def public_config():
    """Configuración pública expuesta al frontend (sin datos sensibles).
    Incluye el dominio público para Cast y otras settings no sensibles.
    """
    return jsonify({
        'cast_public_url': config.CAST_PUBLIC_URL,
    })

@api_bp.route('/api/admin/config', methods=['GET'])
def admin_get_config():
    """Obtener configuración actual (sin datos sensibles)."""
    runtime = _load_runtime_config()
    return jsonify({
        'media_path': runtime.get('media_path', ''),
        'has_pin': bool(runtime.get('pin'))
    })

@api_bp.route('/api/admin/config', methods=['PUT'])
@require_admin
def admin_update_config():
    """Actualizar configuración (PIN o media_path)."""
    data = request.get_json() or {}
    
    if 'media_path' in data:
        _save_runtime_config('media_path', data['media_path'])
    
    if 'pin' in data and data['pin']:
        if len(data['pin']) < 4:
            return jsonify({'error': 'PIN mínimo 4 caracteres'}), 400
        _save_runtime_config('pin', data['pin'])
    
    return jsonify({'ok': True})

@api_bp.route('/api/auth/login', methods=['POST'])
def auth_login():
    """Login por email + contraseña obligatoria."""
    try:
        # Get real client IP (handles Cloudflare)
        client_ip = _get_client_ip()
        
        # Check rate limit
        rate_check = _check_rate_limit(client_ip)
        if rate_check.get('locked'):
            return jsonify({
                "error": f"Demasiados intentos. Intenta en {rate_check['remaining']} segundos",
                "retry_after": rate_check['remaining']
            }), 429
        
        data = request.get_json() or {}
        email = data.get('email', '').strip()
        password = data.get('password', '')
        
        if not email:
            return jsonify({"error": "Email requerido"}), 400
        if not password:
            return jsonify({"error": "Contraseña requerida"}), 400
        
        conn = get_db()
        c = conn.cursor()
        c.execute("SELECT email, username, avatar_url, is_superadmin, pin_hash FROM users WHERE email = ?", (email,))
        user = c.fetchone()
        conn.close()
        
        if not user:
            return jsonify({"error": "Usuario no encontrado"}), 404
        
        # Verificar contraseña
        stored = user['pin_hash'] or ''
        if not verify_password(password, stored):
            attempts = _record_failed_attempt(client_ip)
            remaining = MAX_LOGIN_ATTEMPTS - attempts
            security_logger.warning(f'LOGIN FALLIDO: email={email} IP={client_ip} intentos={attempts}')
            return jsonify({
                "error": "Contraseña incorrecta",
                "remaining_attempts": max(0, remaining)
            }), 401

        # Login successful - clear failed attempts
        _clear_failed_attempts(client_ip)

        token = create_token(user['email'], user['username'] or '', bool(user['is_superadmin']))
        security_logger.info(f'LOGIN EXITOSO: email={email} IP={client_ip} username={user["username"]}')
        return jsonify({
            'token': token,
            'email': user['email'],
            'username': user['username'],
            'avatar_url': user['avatar_url'],
            'is_superadmin': bool(user['is_superadmin'])
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@api_bp.route('/api/auth/register', methods=['POST'])
def auth_register():
    """Registro de Admin (primer uso) o con código de invitación."""
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')
    invite_code = data.get('invite_code', '').strip().upper()

    if not username:
        return jsonify({"error": "Nombre requerido"}), 400
    valid, error_msg = validate_password_strength(password)
    if not valid:
        return jsonify({"error": error_msg}), 400
    
    conn = get_db()
    c = conn.cursor()
    
    # Verificar si ya hay admin
    c.execute("SELECT COUNT(*) FROM users WHERE is_superadmin = 1")
    has_admin = c.fetchone()[0] > 0
    
    if has_admin and not invite_code:
        # Ya hay admin, necesita código de invitación
        return jsonify({"error": "Se requiere código de invitación"}), 403
    
    if invite_code:
        # Validar código de invitación
        codes = state.STREAM_TOKENS.get('_invite_codes', {})
        if invite_code not in codes:
            conn.close()
            return jsonify({"error": "Código de invitación inválido"}), 403
        
        # Verificar expiración
        code_data = codes[invite_code]
        if isinstance(code_data, dict) and code_data.get('expires_at'):
            if time.time() > code_data['expires_at']:
                del state.STREAM_TOKENS['_invite_codes'][invite_code]
                conn.close()
                return jsonify({"error": "Código de invitación expirado"}), 403
        
        # Consumir el código (un solo uso)
        del state.STREAM_TOKENS['_invite_codes'][invite_code]
    
    # Crear email local
    safe_name = username.lower().replace(' ', '_')
    email = f"{safe_name}@kraken.local"
    
    # Verificar que no exista
    c.execute("SELECT email FROM users WHERE email = ?", (email,))
    if c.fetchone():
        conn.close()
        return jsonify({"error": "Este nombre de usuario ya está registrado"}), 409
    
    password_hash = hash_password(password)
    is_admin = 1 if not has_admin else 0
    
    c.execute("""
        INSERT INTO users (email, username, avatar_url, is_superadmin, pin_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (email, username, None, is_admin, password_hash, time.time()))
    conn.commit()
    conn.close()
    
    token = create_token(email, username, bool(is_admin))
    return jsonify({
        'token': token,
        'email': email,
        'username': username,
        'is_superadmin': bool(is_admin)
    })

@api_bp.route('/api/auth/invite', methods=['POST'])
def auth_create_invite():
    """Genera código de invitación (solo Admin)."""
    user_email = get_user_from_request(request)
    if not user_email:
        return jsonify({"error": "No autorizado"}), 401
    
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT is_superadmin FROM users WHERE email = ?", (user_email,))
    row = c.fetchone()
    conn.close()
    
    if not row or not row['is_superadmin']:
        return jsonify({"error": "Solo administradores pueden invitar"}), 403
    
    code = generate_invite_code()
    if '_invite_codes' not in state.STREAM_TOKENS:
        state.STREAM_TOKENS['_invite_codes'] = {}
    state.STREAM_TOKENS['_invite_codes'][code] = {
        'created_by': user_email,
        'created_at': time.time()
    }
    
    return jsonify({'code': code})

@api_bp.route('/api/auth/set_password', methods=['POST'])
def auth_set_password():
    """Establecer o cambiar contraseña."""
    user_email = get_user_from_request(request)
    if not user_email:
        return jsonify({"error": "No autorizado"}), 401

    data = request.get_json() or {}
    new_password = data.get('password', '')

    valid, error_msg = validate_password_strength(new_password)
    if not valid:
        return jsonify({"error": error_msg}), 400
    
    conn = get_db()
    password_hash = hash_password(new_password)
    conn.execute("UPDATE users SET pin_hash = ? WHERE email = ?", (password_hash, user_email))
    conn.commit()
    conn.close()
    
    return jsonify({"ok": True})

@api_bp.route('/api/auth/verify', methods=['GET'])
def auth_verify():
    """Verifica si el token actual es válido."""
    user_email = get_user_from_request(request)
    if not user_email:
        return jsonify({"valid": False}), 401
    
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT email, username, avatar_url, is_superadmin FROM users WHERE email = ?", (user_email,))
    user = c.fetchone()
    conn.close()
    
    if not user:
        return jsonify({"valid": False}), 401
    
    return jsonify({
        "valid": True,
        "email": user['email'],
        "username": user['username'],
        "avatar_url": user['avatar_url'],
        "is_superadmin": bool(user['is_superadmin'])
    })

@api_bp.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    """Logout - invalidar token (blacklist por JTI)."""
    try:
        auth = request.headers.get('Authorization', '')
        user_email = get_user_from_request(request) or 'unknown'
        client_ip = _get_client_ip()

        if auth.startswith('Bearer '):
            token = auth[7:]
            # Extraer JTI del token para blacklist
            payload = verify_token(token)  # Antes de blacklist, para obtener jti
            if payload and 'jti' in payload:
                jti = payload['jti']
                state.blacklist_token_jti(jti)
                security_logger.info(f'LOGOUT: email={user_email} IP={client_ip} jti={jti[:8]}...')
            else:
                security_logger.info(f'LOGOUT (sin token válido): email={user_email} IP={client_ip}')
        else:
            security_logger.info(f'LOGOUT (sin Bearer): email={user_email} IP={client_ip}')

        return jsonify({"ok": True, "message": "Sesión cerrada correctamente"})
    except Exception as e:
        security_logger.error(f'LOGOUT ERROR: {e}')
        return jsonify({"ok": True})  # Siempre retornar ok para no revelar errores

@api_bp.route('/api/stream/token', methods=['POST'])
def generate_stream_token():
    data = request.get_json() or {}
    media_id = data.get('id')
    session_id = data.get('session_id')  # Opcional: asociar sesión al token
    
    import uuid
    import time
    
    token = str(uuid.uuid4())
    token_data = {
        'id': media_id,
        'expires': time.time() + (4 * 3600),  # Expira en 4 horas
        'sessions': [session_id] if session_id else []
    }
    state.STREAM_TOKENS[token] = token_data
    
    return jsonify({'token': token, 'id': media_id})

# ============= PROGRESS TRACKING (Continue Watching) =============

@api_bp.route('/api/progress', methods=['POST'])
def save_progress():
    """Save watch progress for the current user. Called silently by ArtPlayer every ~10s."""
    try:
        user_email = get_user_from_request(request) or 'anonymous'
        data = request.get_json() or {}
        media_id = data.get('media_id')
        progress = float(data.get('progress_seconds', 0))
        duration = float(data.get('duration_seconds', 0))

        if not media_id:
            return jsonify({"error": "Missing media_id"}), 400

        is_finished = 1 if (duration > 0 and progress / duration >= 0.93) else 0

        conn = get_db()
        c = conn.cursor()
        c.execute("""
            INSERT INTO user_progress (user_email, media_id, progress_seconds, duration_seconds, is_finished, last_watched)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_email, media_id) DO UPDATE SET
                progress_seconds = excluded.progress_seconds,
                duration_seconds = excluded.duration_seconds,
                is_finished = CASE WHEN excluded.is_finished = 1 THEN 1 ELSE user_progress.is_finished END,
                last_watched = excluded.last_watched
        """, (user_email, media_id, progress, duration, is_finished, time.time()))
        conn.commit()
        conn.close()
        return jsonify({"ok": True})
    except Exception as e:
        print(f"Error saving progress: {e}")
        return jsonify({"error": str(e)}), 500


@api_bp.route('/api/progress/series')
def get_series_resume():
    """Get the resume point for a series (last watched episode for the current user).
       Query: ?tmdb_id=12345
    """
    try:
        user_email = get_user_from_request(request) or 'anonymous'
        tmdb_id = request.args.get('tmdb_id')

        if not tmdb_id:
            return jsonify({"error": "Missing tmdb_id"}), 400

        conn = get_db()
        c = conn.cursor()

        # Find all media items belonging to this series (by tmdb_id)
        c.execute("""
            SELECT m.id, m.rel_path, m.title, m.folder, m.tmdb_title, m.folder_type,
                   p.progress_seconds, p.duration_seconds, p.is_finished, p.last_watched
            FROM media m
            LEFT JOIN user_progress p ON p.media_id = m.id AND p.user_email = ?
            WHERE m.tmdb_id = ? AND m.media_type = 'video'
            ORDER BY m.rel_path ASC
        """, (user_email, tmdb_id))
        rows = c.fetchall()
        conn.close()

        if not rows:
            return jsonify({"has_progress": False, "first_episode": None})

        # Find the last watched non-finished episode, or the first unfinished one
        last_watched = None
        first_unfinished = None
        all_episodes = []

        for row in rows:
            ep = {
                "id": row["id"],
                "path": row["rel_path"],
                "title": row["title"],
                "folder": row["folder"],
                "progress_seconds": row["progress_seconds"] or 0,
                "duration_seconds": row["duration_seconds"] or 0,
                "is_finished": bool(row["is_finished"]),
                "last_watched": row["last_watched"] or 0
            }
            all_episodes.append(ep)

            if ep["last_watched"] > 0:
                if last_watched is None or ep["last_watched"] > last_watched["last_watched"]:
                    last_watched = ep
            if not ep["is_finished"] and first_unfinished is None:
                first_unfinished = ep

        # Determine resume point
        resume_episode = None
        if last_watched and not last_watched["is_finished"]:
            resume_episode = last_watched
        elif last_watched and last_watched["is_finished"]:
            # Find the next episode after the last finished one
            idx = next((i for i, e in enumerate(all_episodes) if e["id"] == last_watched["id"]), -1)
            if idx >= 0 and idx + 1 < len(all_episodes):
                resume_episode = all_episodes[idx + 1]
        if not resume_episode:
            resume_episode = first_unfinished or all_episodes[0]

        return jsonify({
            "has_progress": last_watched is not None,
            "resume_episode": resume_episode,
            "total_episodes": len(all_episodes),
            "watched_count": sum(1 for e in all_episodes if e["is_finished"])
        })
    except Exception as e:
        print(f"Error getting series resume: {e}")
        return jsonify({"error": str(e)}), 500


# ============= TMDB EXTENDED DETAILS (Live-Fetch) =============

@api_bp.route('/api/tmdb/details')
def tmdb_extended_details():
    """Get extended TMDB details (cast, overview, backdrop) without saving to DB.
       Query: ?id=12345&type=tv  (or type=movie)
    """
    tmdb_id = request.args.get('id')
    media_type = request.args.get('type', 'tv')  # 'tv' or 'movie'

    if not tmdb_id:
        return jsonify({"error": "Missing id parameter"}), 400

    try:
        from services.video_tagger import TMDB_API_KEY, TMDB_BASE_URL

        # 1. Get main details + credits in one call
        params = {
            'api_key': TMDB_API_KEY,
            'language': 'es-MX',
            'append_to_response': 'credits'
        }

        endpoint = f"{TMDB_BASE_URL}/{media_type}/{tmdb_id}"
        r = requests.get(endpoint, params=params, timeout=10)

        if r.status_code != 200:
            return jsonify({"error": "TMDB API error", "status": r.status_code}), 502

        data = r.json()

        # Extract cast (top 12)
        credits = data.get('credits', {})
        cast_raw = credits.get('cast', [])[:12]
        cast = [{
            'name': c.get('name', ''),
            'character': c.get('character', ''),
            'photo': f"https://image.tmdb.org/t/p/w185{c['profile_path']}" if c.get('profile_path') else None,
            'order': c.get('order', 99)
        } for c in cast_raw]

        # Extract crew (director / creator)
        crew_raw = credits.get('crew', [])
        directors = [c['name'] for c in crew_raw if c.get('job') in ('Director', 'Creator')][:3]

        # For TV shows, also grab creators from the main data
        if media_type == 'tv':
            creators = [c.get('name', '') for c in data.get('created_by', [])]
            if creators and not directors:
                directors = creators

        # Extract backdrop
        backdrop = f"https://image.tmdb.org/t/p/w1280{data['backdrop_path']}" if data.get('backdrop_path') else None

        # Build response
        title = data.get('title') or data.get('name', '')
        overview = data.get('overview', '')
        genres = [g['name'] for g in data.get('genres', [])]
        year = (data.get('release_date') or data.get('first_air_date') or '')[:4]
        vote = data.get('vote_average', 0)
        seasons = data.get('number_of_seasons')
        episodes = data.get('number_of_episodes')

        return jsonify({
            "ok": True,
            "title": title,
            "overview": overview,
            "genres": genres,
            "year": year,
            "vote_average": round(vote, 1),
            "backdrop": backdrop,
            "cast": cast,
            "directors": directors,
            "seasons": seasons,
            "episodes": episodes
        })

    except Exception as e:
        print(f"Error fetching TMDB details: {e}")
        return jsonify({"error": str(e)}), 500


@api_bp.route('/library/update_video_meta', methods=['POST'])
def update_video_meta():
    data = request.json
    pin = data.get('pin', '')
    path = data.get('path')
    is_virtual = data.get('is_virtual', False)
    
    if not get_master_pin() or pin != get_master_pin():
        return jsonify({'error': 'PIN incorrecto'}), 401
        
    if not path:
        return jsonify({'error': 'Falta path'}), 400
        
    from services.database import get_db
    conn = get_db()
    c = conn.cursor()
    
    tmdb_title = data.get('tmdb_title', '')
    tmdb_rating = data.get('tmdb_rating', '')
    tmdb_year = data.get('tmdb_year', '')
    tmdb_genres = data.get('tmdb_genres', '')
    tmdb_overview = data.get('tmdb_overview', '')
    
    try:
        paths_array = data.get('paths_array', [])
        
        if tmdb_rating == 'VACIO':
            tmdb_rating = None

        if paths_array and len(paths_array) > 0:
            # Modo BATCH Video
            for p in paths_array:
                fields_to_set = []
                values = []
                if tmdb_title:
                    fields_to_set.append("tmdb_title = ?")
                    values.append(tmdb_title)
                if tmdb_rating is not None or data.get('tmdb_rating') == 'VACIO':
                    fields_to_set.append("tmdb_rating = ?")
                    values.append(tmdb_rating)
                if tmdb_year:
                    fields_to_set.append("tmdb_year = ?")
                    values.append(tmdb_year)
                if tmdb_genres:
                    fields_to_set.append("tmdb_genres = ?")
                    values.append(tmdb_genres)
                if tmdb_overview:
                    fields_to_set.append("tmdb_overview = ?")
                    values.append(tmdb_overview)
                    
                if fields_to_set:
                    values.append(p)
                    query = f"UPDATE media SET {', '.join(fields_to_set)} WHERE rel_path = ?"
                    c.execute(query, tuple(values))
        elif is_virtual:
            # Actualiza todos los hijos (Single Click on Series)
            c.execute("""
                UPDATE media SET 
                tmdb_title = ?, 
                tmdb_rating = ?, 
                tmdb_year = ?, 
                tmdb_genres = ?, 
                tmdb_overview = ?
                WHERE rel_path LIKE ?
            """, (tmdb_title, tmdb_rating, tmdb_year, tmdb_genres, tmdb_overview, f"{path}/%"))
        elif path:
            # Archivo unico
            c.execute("""
                UPDATE media SET 
                tmdb_title = ?, 
                tmdb_rating = ?, 
                tmdb_year = ?, 
                tmdb_genres = ?, 
                tmdb_overview = ?
                WHERE rel_path = ?
            """, (tmdb_title, tmdb_rating, tmdb_year, tmdb_genres, tmdb_overview, path))
            
        conn.commit()
        
        # Limpiar cache
        global BIB_CACHE_BY_OWNER
        BIB_CACHE_BY_OWNER.clear()
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
