
from flask import Flask, render_template_string, request, jsonify, send_from_directory, Response, send_file
import yt_dlp
from PIL import Image
import os
import threading
import time
import shutil
import re
import json
import hashlib
import copy
import requests
import random
import sys
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
from mutagen.easyid3 import EasyID3
from mutagen.id3 import ID3, APIC, USLT
from mutagen.mp3 import MP3
from mutagen.mp4 import MP4
from mutagen import File as MutagenFile
from flask_compress import Compress
import subprocess  # <--- AGREGA ESTA LÍNEA
from urllib.parse import unquote
# Alexa SDK imports
from ask_sdk_core.skill_builder import SkillBuilder
from ask_sdk_core.dispatch_components import AbstractRequestHandler
from ask_sdk_core.utils import is_request_type, is_intent_name
from flask_ask_sdk.skill_adapter import SkillAdapter
 


app = Flask(__name__)
Compress(app)
# ==================== CONFIGURACIÓN ====================
from config import LASTFM_API_KEY, BASE_DIR, DOWNLOAD_FOLDER, FILES_CACHE_FILE, THUMBNAILS_FOLDER, HISTORY_FILE, RATINGS_FILE, PLAYLISTS_FILE, STATS_FILE, TEMP_FOLDER


# 3. DICCIONARIO MAESTRO DE GÉNEROS
# Last.fm devuelve tags raros ("britpop", "90s", "sexy"). 
# Esto los agrupa en categorías limpias para tu filtro.
GENRE_MAPPING = {
    # --- ROCK ---
    'Alternative Rock': ['alternative rock', 'alt-rock', 'alt rock', 'alternative'],
    'Indie Rock': ['indie rock', 'indie'], # Indie suele ser rock
    'Hard Rock': ['hard rock'],
    'Classic Rock': ['classic rock'],
    'Progressive Rock': ['progressive rock', 'prog rock', 'prog-rock'],
    'Punk Rock': ['punk rock', 'punk'],
    'Post-Rock': ['post-rock', 'post rock'],
    'Garage Rock': ['garage rock'],
    'Psychedelic Rock': ['psychedelic rock', 'psych rock', 'psychedelic'],
    'Rock': ['rock'], # <--- IMPORTANTE: El genérico al final como red de seguridad

    # --- POP ---
    'Indie Pop': ['indie pop', 'indiepop'],
    'Synth-Pop': ['synth-pop', 'synthpop', 'synth pop'],
    'Electropop': ['electropop', 'electro-pop'],
    'K-Pop': ['k-pop', 'kpop', 'korean pop'],
    'Dream Pop': ['dream pop', 'dreampop'],
    'Pop': ['pop'], # Genérico al final

    # --- ELECTRONIC ---
    'House': ['house', 'deep house', 'tech house'],
    'Techno': ['techno', 'detroit techno', 'minimal techno'],
    'Dubstep': ['dubstep'],
    'Drum & Bass': ['drum and bass', 'dnb', 'drum n bass'],
    'Trance': ['trance', 'progressive trance'],
    'Ambient': ['ambient', 'ambient electronic'],
    'IDM': ['idm', 'intelligent dance music'],
    'Breakbeat': ['breakbeat', 'breaks'],
    'Electronic': ['electronic', 'electronica', 'edm'], # Genérico

    # --- HIP-HOP ---
    'Trap': ['trap', 'trap music'],
    'Conscious Hip-Hop': ['conscious hip hop', 'conscious rap'],
    'Boom Bap': ['boom bap'],
    'Cloud Rap': ['cloud rap'],
    'Hip-Hop': ['hip hop', 'hip-hop', 'rap'], # Genérico

    # --- LATINO ---
    'Reggaeton': ['reggaeton', 'reguetón'],
    'Latin Trap': ['latin trap'],
    'Salsa': ['salsa'],
    'Bachata': ['bachata'],
    'Cumbia': ['cumbia'],
    'Latin': ['latin', 'latino'], # Genérico

    # --- METAL ---
    'Death Metal': ['death metal'],
    'Black Metal': ['black metal'],
    'Thrash Metal': ['thrash metal', 'thrash'],
    'Doom Metal': ['doom metal', 'doom'],
    'Metalcore': ['metalcore'],
    'Deathcore': ['deathcore'],
    'Heavy Metal': ['heavy metal', 'metal'], # Genérico

    # --- JAZZ / SOUL ---
    'Bebop': ['bebop'],
    'Smooth Jazz': ['smooth jazz'],
    'Jazz Fusion': ['jazz fusion', 'fusion'],
    'Jazz': ['jazz'], # Genérico
    
    'Neo Soul': ['neo soul', 'neo-soul'],
    'Funk': ['funk'],
    'Soul': ['soul'],
    'R&B': ['r&b', 'rnb', 'r and b'],

    # --- OTROS ---
    'Country': ['country'],
    'Folk': ['folk', 'folk music'],
    'Reggae': ['reggae'],
    'Ska': ['ska'],
    'Blues': ['blues'],
    'Classical': ['classical', 'classical music']
}

def normalize_genre(tags):
    """
    Busca coincidencias exactas en el diccionario GENRE_MAPPING.
    Prioriza los géneros específicos sobre los genéricos.
    """
    # Recorremos los tags que nos dio Last.fm
    for tag in tags:
        tag_lower = tag.lower().strip()
        
        # Comparamos contra nuestro diccionario maestro
        for clean_genre, keywords in GENRE_MAPPING.items():
            if tag_lower in keywords:
                return clean_genre
                
    return "Otros"

def get_best_lastfm_image(images):
    if not images:
        return None
    for img in reversed(images):
        url = img.get('#text')
        if url:
            return url.replace('http://', 'https://', 1)
    return None

def get_lastfm_data(method, params):
    """Función genérica para no repetir código"""
    base_params = {
        'api_key': LASTFM_API_KEY,
        'format': 'json',
        'method': method
    }
    base_params.update(params)
    try:
        # Timeout corto para no congelar el servidor
        response = requests.get("https://ws.audioscrobbler.com/2.0/", params=base_params, timeout=3)
        return response.json()
    except Exception as e:
        print(f"⚠️ Error Last.fm ({method}): {e}")
        return None


@app.route('/api/status')
def api_status():
    """Endpoint para verificar autenticación de Cloudflare"""
    return jsonify({"status": "ok", "authenticated": True})

# Endpoint 1: Info del Artista
@app.route('/api/artist/<path:artist_name>')
def artist_info(artist_name):
    # Decodificar el nombre por si tiene espacios (%20)
    decoded_name = unquote(artist_name)
    
    data = get_lastfm_data('artist.getinfo', {'artist': decoded_name, 'lang': 'es', 'autocorrect': 1})
    
    if data and 'artist' in data:
        art = data['artist']
        return jsonify({
            'name': art.get('name'),
            'bio': art['bio'].get('summary', 'Sin biografía disponible.'),
            'image': get_best_lastfm_image(art.get('image')),
            'similar': [a['name'] for a in art['similar']['artist'][:5]] if 'similar' in art else [],
            'tags': [t['name'] for t in art['tags']['tag'][:3]] if 'tags' in art else []
        })
    return jsonify({'error': 'Not found'}), 404

# Endpoint 2: AUTO-TAGGER DE GÉNEROS
@app.route('/api/autotag_library', methods=['POST'])
def autotag_library():
	"""
	Auto-completar géneros desde Last.fm CON INTELIGENCIA:
	- Solo procesa archivos SIN género o con género = "Otros"
	- Guarda en archivos físicos (.m4a, .mp3)
	- Maneja artistas múltiples (separa por ";" o ";")
	"""
	print("\n" + "="*60)
	print("🎯 INICIANDO AUTO-TAGGER INTELIGENTE V2")
	print("="*60)
	
	# 1. Cargar biblioteca
	if not os.path.exists(FILES_CACHE_FILE):
		print("❌ ERROR: No se encontró cache_files.json")
		return jsonify({'ok': False, 'msg': 'No hay biblioteca cargada'})
	
	try:
		with open(FILES_CACHE_FILE, 'r', encoding='utf-8') as f:
			files = json.load(f)
	except Exception as e:
		print(f"❌ ERROR leyendo caché: {e}")
		return jsonify({'ok': False, 'msg': f'Error leyendo caché: {str(e)}'})
	
	if not files:
		print("⚠️ ADVERTENCIA: La biblioteca está vacía")
		return jsonify({'ok': False, 'msg': 'No hay archivos en la biblioteca'})
	
	print(f"📚 Archivos en biblioteca: {len(files)}")
	
	# 2. Filtrar SOLO archivos que NECESITAN género
	files_to_tag = []
	for f in files:
		genre = f.get('genre', '').strip()
		if not genre or genre in ['Otros', 'Unknown', 'Desconocido', '']:
			files_to_tag.append(f)
	
	print(f"🔍 Archivos sin género: {len(files_to_tag)}/{len(files)}")
	
	if not files_to_tag:
		print("✅ Todos los archivos ya tienen género asignado")
		return jsonify({
			'ok': True,
			'msg': '✅ Todos los archivos ya tienen género',
			'stats': {'total': 0, 'tagged': 0, 'skipped': 0, 'failed': 0}
		})
	
	# 3. Extraer artistas únicos (LIMPIANDO separadores)
	artists_to_process = {}
	for f in files_to_tag:
		artist_raw = f.get('artist', '').strip()
		
		# NUEVO: Separar artistas múltiples
		# "Arroba Nat; Bruses" → ["Arroba Nat", "Bruses"]
		artist_clean = clean_artist_name(artist_raw)
		
		if artist_clean and artist_clean != 'Artista Desconocido':
			if artist_clean not in artists_to_process:
				artists_to_process[artist_clean] = []
			artists_to_process[artist_clean].append(f)
	
	print(f"👥 Artistas a procesar: {len(artists_to_process)}")
	
	if not artists_to_process:
		print("⚠️ No hay artistas válidos para procesar")
		return jsonify({'ok': False, 'msg': 'No hay artistas válidos'})
	
	# 4. Procesar artistas
	tagged = 0
	failed = 0
	skipped = 0
	files_updated = 0
	total = len(artists_to_process)
	
	print(f"\n🚀 Procesando {total} artistas...")
	print("-" * 60)
	
	for idx, (artist, artist_files) in enumerate(artists_to_process.items(), 1):
		try:
			# Progreso
			if idx % 5 == 0 or idx == 1 or idx == total:
				progress = (idx / total) * 100
				print(f"\n📊 Progreso: {idx}/{total} ({progress:.1f}%)")
			
			print(f"  🔍 [{idx}/{total}] {artist[:40]} ({len(artist_files)} archivos)")
			
			# Consultar Last.fm
			data = get_lastfm_data('artist.gettoptags', {
				'artist': artist,
				'autocorrect': 1
			})
			
			if not data or 'toptags' not in data:
				print(f"     ⚠️ Sin respuesta de Last.fm")
				failed += 1
				time.sleep(0.3)
				continue
			
			tags_raw = data['toptags'].get('tag', [])
			if not tags_raw:
				print(f"     ⚠️ Sin tags disponibles")
				skipped += 1
				time.sleep(0.3)
				continue
			
			# Normalizar género
			tag_names = [t['name'] for t in tags_raw[:10]]
			genre = normalize_genre(tag_names)
			
			print(f"     📌 Género detectado: {genre}")
			
			# Actualizar archivos FÍSICOS y caché
			updated_count = 0
			for file_obj in artist_files:
				file_path_rel = file_obj.get('path')
				if not file_path_rel:
					print(f"       ⚠️ Sin ruta en caché")
					continue
				
				# ARREGLO: Convertir ruta relativa a absoluta
				# "Musica/Darkie/song.m4a" → "E:/Kraken/descargas/Musica/Darkie/song.m4a"
				file_path = os.path.join(DOWNLOAD_FOLDER, file_path_rel)
				
				if not os.path.exists(file_path):
					print(f"       ⚠️ Archivo no existe: {file_path}")
					continue
				
				try:
					# Escribir en archivo físico (NUEVA VERSIÓN CON DEBUG)
					success, error_msg = write_genre_to_file(file_path, genre)
					
					if success:
						# Actualizar caché
						file_obj['genre'] = genre
						updated_count += 1
					else:
						print(f"       ❌ {os.path.basename(file_path)}: {error_msg}")
					
				except Exception as e:
					print(f"       ⚠️ Excepción en '{os.path.basename(file_path)}': {e}")
			
			if updated_count > 0:
				print(f"     ✅ {updated_count}/{len(artist_files)} archivos actualizados")
				tagged += 1
				files_updated += updated_count
			else:
				print(f"     ⚠️ No se pudo actualizar ningún archivo")
				failed += 1
			
			# Rate limiting
			time.sleep(0.5)
			
		except Exception as e:
			print(f"     ❌ ERROR: {e}")
			failed += 1
			time.sleep(0.5)
	
	# 5. Guardar caché
	print("\n" + "-" * 60)
	print("💾 Guardando cambios en cache_files.json...")
	
	try:
		with open(FILES_CACHE_FILE, 'w', encoding='utf-8') as f:
			json.dump(files, f, ensure_ascii=False, indent=2)
		print("✅ Caché actualizado")
	except Exception as e:
		print(f"❌ ERROR al guardar: {e}")
		return jsonify({'ok': False, 'msg': f'Error guardando: {str(e)}'})
	
	# 6. Resultado
	print("\n" + "="*60)
	print("🎉 AUTO-TAGGER COMPLETADO")
	print("="*60)
	print(f"✅ Artistas etiquetados: {tagged}/{total}")
	print(f"📁 Archivos actualizados: {files_updated}")
	print(f"⚠️ Sin tags: {skipped}")
	print(f"❌ Errores: {failed}")
	print("="*60 + "\n")
	
	return jsonify({
		'ok': True,
		'msg': f'✅ {tagged} artistas, {files_updated} archivos actualizados',
		'stats': {
			'total': total,
			'tagged': tagged,
			'files_updated': files_updated,
			'skipped': skipped,
			'failed': failed
		}
	})


# ==================== FUNCIÓN 2: LIMPIAR NOMBRES DE ARTISTAS ====================

def clean_artist_name(artist_raw):
	"""
	Limpia nombres de artistas múltiples y devuelve el PRIMERO
	
	Ejemplos:
	- "Arroba Nat; Bruses" → "Arroba Nat"
	- "Paul McCartney; Linda McCartney" → "Paul McCartney"
	- "Drake feat. The Weeknd" → "Drake"
	- "Simple Artist" → "Simple Artist"
	"""
	if not artist_raw:
		return ""
	
	# Separadores comunes: punto y coma, "feat", "ft.", "&", "featuring"
	separators = [';', ';', ' feat. ', ' feat ', ' ft. ', ' ft ', ' featuring ', ' & ']
	
	artist = artist_raw
	for sep in separators:
		if sep in artist:
			# Tomar solo el PRIMER artista
			artist = artist.split(sep)[0].strip()
			break
	
	return artist.strip()


# ==================== FUNCIÓN 3: ESCRIBIR GÉNERO EN ARCHIVOS ====================

def write_genre_to_file(file_path, genre):
	"""
	Escribe el género en el archivo físico (.mp3, .m4a, .flac, etc.)
	
	Retorna: (success: bool, error_msg: str)
	"""
	try:
		# Detectar extensión
		ext = os.path.splitext(file_path)[1].lower()
		
		# ========== MP3 ==========
		if ext == '.mp3':
			try:
				# Método 1: EasyID3 (más simple)
				audio = EasyID3(file_path)
				audio['genre'] = genre
				audio.save()
				return (True, "")
			except Exception as e1:
				try:
					# Método 2: ID3 directo (para archivos sin tags previos)
					from mutagen.id3 import ID3, TCON
					audio = ID3(file_path)
					audio.add(TCON(encoding=3, text=genre))
					audio.save()
					return (True, "")
				except Exception as e2:
					return (False, f"EasyID3: {e1} | ID3: {e2}")
		
		# ========== M4A / MP4 ==========
		elif ext in ['.m4a', '.mp4']:
			try:
				audio = MP4(file_path)
				audio['\xa9gen'] = [genre]
				audio.save()
				return (True, "")
			except Exception as e:
				return (False, f"MP4 error: {e}")
		
		# ========== FLAC / OGG / WMA ==========
		else:
			try:
				audio = MutagenFile(file_path, easy=True)
				if audio is None:
					return (False, "Mutagen no puede leer este formato")
				audio['genre'] = genre
				audio.save()
				return (True, "")
			except Exception as e:
				return (False, f"Mutagen error: {e}")
		
	except Exception as e:
		return (False, f"Error general: {e}")



for folder in [DOWNLOAD_FOLDER, THUMBNAILS_FOLDER, TEMP_FOLDER]:
    if not os.path.exists(folder):
        os.makedirs(folder)
def init_db():
    for f in [HISTORY_FILE, RATINGS_FILE, PLAYLISTS_FILE, STATS_FILE]:
        if not os.path.exists(f):
            with open(f, 'w', encoding='utf-8') as outfile: json.dump({}, outfile)
    
    # 🧹 LIMPIEZA AUTOMÁTICA DE PLAYLISTS
    clean_playlists()

def clean_playlists():
    """Normaliza todas las rutas en playlists.json para evitar problemas de encoding"""
    try:
        playlists = load_json(PLAYLISTS_FILE)
        modified = False
        
        for pl_name, paths in playlists.items():
            cleaned_paths = []
            for path in paths:
                try:
                    # Intentar decodificar
                    clean_path = unquote(path)
                    cleaned_paths.append(clean_path)
                    if clean_path != path:
                        modified = True
                except Exception:
                    # Si falla, mantener la ruta original
                    cleaned_paths.append(path)
            
            playlists[pl_name] = cleaned_paths
        
        if modified:
            save_json(PLAYLISTS_FILE, playlists)
            print("✅ Playlists normalizadas automáticamente")
    except Exception as e:
        print(f"⚠️ Error limpiando playlists: {e}")


from pathlib import Path

BASE_PATH = Path(DOWNLOAD_FOLDER).resolve()

def validar_path(user_path, base=BASE_PATH):
    """
    Previene directory traversal y accesos fuera del directorio permitido.
    """
    try:
        requested = (base / user_path).resolve()
        requested.relative_to(base)
        return requested
    except Exception:
        raise ValueError(f"Ruta inválida: {user_path}")
# ==================== UTILIDADES ====================
progress_status = { "percent": "0%", "filename": "", "details": "Esperando...", "active": False, "current_index": -1, "completed_indices": [] }
stop_download = False
LAST_ALEXA_COMMAND = {"action": None, "time": 0}
BIB_CACHE = None
BIB_CACHE_TIME = 0
MIXES_CACHE = []
RESCAN_IN_PROGRESS = False
ACTIVE_USERS = {} 
PENDING_COMMANDS = {} # <--- NUEVO: Aquí guardamos las órdenes
USERS_LOCK = threading.Lock()
def cleanup_inactive_users():
    """Hilo conserje: Borra usuarios que llevan 10 segundos sin reportarse."""
    while True:
        time.sleep(5) # Revisa cada 5 segundos
        now = time.time()
        with USERS_LOCK:
            # Detectar fantasmas
            inactive = [sid for sid, data in ACTIVE_USERS.items() if now - data['last_ping'] > 10]
            
            for sid in inactive:
                print(f"🔴 Usuario desconectado: {ACTIVE_USERS[sid]['name']}")
                del ACTIVE_USERS[sid]

def load_json(filepath):
    if not os.path.exists(filepath): return {}
    try:
        with open(filepath, 'r', encoding='utf-8') as f: return json.load(f)
    except Exception as e:
        print("Error cargando JSON:", filepath, e)
        return {}

def save_json(filepath, data):
    try:
        with open(filepath, 'w', encoding='utf-8') as f: json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Error guardando JSON:", filepath, e)

def check_ffmpeg():
    if shutil.which("ffmpeg") is None: print("⚠️ FFmpeg no encontrado.")

def get_video_streams(video_path):
    """Detecta pistas de audio y subtítulos usando ffprobe"""
    try:
        kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
        result = subprocess.run([
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            video_path
        ], capture_output=True, text=True, timeout=10, **kwargs)
        
        data = json.loads(result.stdout)
        streams = data.get('streams', [])
        
        audio_tracks = []
        subtitle_tracks = []
        
        for idx, stream in enumerate(streams):
            codec_type = stream.get('codec_type')
            
            if codec_type == 'audio':
                audio_tracks.append({
                    'index': idx,
                    'language': stream.get('tags', {}).get('language', 'und'),
                    'title': stream.get('tags', {}).get('title', f'Audio {len(audio_tracks) + 1}'),
                    'codec': stream.get('codec_name', 'unknown')
                })
            
            elif codec_type == 'subtitle':
                subtitle_tracks.append({
                    'index': idx,
                    'language': stream.get('tags', {}).get('language', 'und'),
                    'title': stream.get('tags', {}).get('title', f'Subtitle {len(subtitle_tracks) + 1}'),
                    'codec': stream.get('codec_name', 'unknown')
                })
        
        return {
            'audio': audio_tracks,
            'subtitles': subtitle_tracks
        }
    
    except Exception as e:
        print(f"Error detectando streams: {e}")
        return {'audio': [], 'subtitles': []}

def sanitize_name(name):
    if not name:
        return "sin_titulo"

    # Elimina caracteres peligrosos para el sistema de archivos
    name = re.sub(r'[\\/*?:"<>|\'`]', "", name)

    # Normaliza espacios
    name = re.sub(r'\s+', ' ', name).strip()

    # Evita nombres vacíos
    return name if name else "sin_titulo"

def format_duration(seconds):
    if not seconds: return "0:00"
    try: m, s = divmod(int(seconds), 60); return f"{m}:{s:02d}"
    except Exception as e:
        print("Error formateando duración:", seconds, e)
        return "0:00"

def progress_hook(d):
    global stop_download
    if stop_download: raise Exception("Stop")
    if d['status'] == 'downloading':
        total = d.get('total_bytes') or d.get('total_bytes_estimate')
        downloaded = d.get('downloaded_bytes', 0)
        p = (downloaded / total) * 100 if total else 0
        progress_status["percent"] = f"{p:.1f}%"
        progress_status["filename"] = os.path.basename(d.get('filename', ''))
        s = d.get('speed', 0); progress_status["details"] = f"🚀 {s/1048576:.1f} MB/s" if s else "Descargando..."

def obtener_metadata_completa(path, filename):
    nombre_base = os.path.splitext(filename)[0]
    meta = {'artist': 'Desconocido', 'title': nombre_base, 'album': '', 'genre': 'Otros', 'duration': 0}
    try:
        audio_file = MutagenFile(path)
        if audio_file and hasattr(audio_file.info, 'length'): meta['duration'] = int(audio_file.info.length)
        if filename.lower().endswith('.mp3'):
            audio = MP3(path, ID3=EasyID3)
            if 'artist' in audio: meta['artist'] = audio['artist'][0]
            if 'title' in audio: meta['title'] = audio['title'][0]
            if 'album' in audio: meta['album'] = audio['album'][0]
            if 'genre' in audio: meta['genre'] = audio['genre'][0]
        elif filename.lower().endswith(('.m4a', '.mp4')):
            audio = MP4(path)
            if '\xa9ART' in audio: meta['artist'] = audio['\xa9ART'][0]
            if '\xa9nam' in audio: meta['title'] = audio['\xa9nam'][0]
            if '\xa9alb' in audio: meta['album'] = audio['\xa9alb'][0]
            if '\xa9gen' in audio: meta['genre'] = audio['\xa9gen'][0]
    except Exception as e:
        print("Error leyendo metadata:", path, e)

    
    
    if meta['artist'] == 'Desconocido' and " - " in nombre_base:
        partes = nombre_base.split(" - ")
        meta['artist'] = partes[0].strip()
        if meta['title'] == nombre_base: meta['title'] = " - ".join(partes[1:]).strip()
    
    basura = [r"\(.*Official.*\)", r"\(.*Video.*\)", r"Official Video", r"Video Oficial", r"HD", r"HQ", r"4K", r"ft\.", r"feat\.", r"\(.*Letra.*\)"]
    for b in basura: meta['title'] = re.sub(b, "", meta['title'], flags=re.IGNORECASE).strip()
    return meta

def get_smart_folder_name(root_path):
    # Logica para agrupar temporadas en una sola serie
    folder_name = os.path.basename(root_path)
    parent_name = os.path.basename(os.path.dirname(root_path))
    
    # Si la carpeta actual parece una temporada, usar el padre como nombre de serie
    season_keywords = ['temporada', 'season', 's0', 't0', 'season', 'temp']
    if any(k in folder_name.lower() for k in season_keywords):
        # Evitar usar "Video" o "Descargas" como nombre de serie
        if parent_name.lower() not in ['video', 'descargas', 'downloads']:
            return parent_name
    return folder_name

def escanear_archivos_fisicos():
    """PASO 1 (ULTRA RÁPIDO): Lee el disco duro y guarda un archivo JSON crudo."""
    print("📀 Iniciando escaneo físico de disco...")
    files_data = []
    
    # Cargar cache existente
    existing_cache = load_json(FILES_CACHE_FILE) if os.path.exists(FILES_CACHE_FILE) else []
    cache_by_path = {f.get('path'): f for f in existing_cache if isinstance(f, dict)}
    
    # Usamos SETS en lugar de listas para búsquedas O(1) hiper rápidas
    VALID_EXTS = {
        # Audio
        'mp3', 'm4a', 'wav', 'aac', 'flac', 'ogg', 'opus', 'wma',
        # Video
        'mp4', 'webm', 'mkv', 'avi', 'mov', 'flv', 'm4v'
    }
    
    # Separamos los de video para que asigne el "type" correctamente
    VIDEO_EXTS = {'mp4', 'webm', 'mkv', 'avi', 'mov', 'flv', 'm4v'}
    GENEROS_VACIOS = {'Otros', 'Unknown', '', 'Generos', 'Desconocido'}

    # Usamos os.walk pero lo optimizamos combinándolo con la ruta
    for root, dirs, files in os.walk(DOWNLOAD_FOLDER):
        # Ignorar la carpeta de thumbnails inmediatamente
        if 'thumbnails' in root:
            continue
        
        folder_name = os.path.relpath(root, DOWNLOAD_FOLDER)
        serie_name = "Raíz" if folder_name == '.' else get_smart_folder_name(root)

        for f in files:
            ext = f.split('.')[-1].lower()
            
            # Filtro rápido con SET
            if ext not in VALID_EXTS: 
                continue
            
            path = os.path.join(root, f)
            rel_path = os.path.relpath(path, DOWNLOAD_FOLDER).replace('\\', '/')
            
            try:
                # Obtener estadísticas del archivo
                stat = os.stat(path)
                file_size = stat.st_size
                file_date = stat.st_mtime
                
                cached = cache_by_path.get(rel_path)
                
                # 🔥 OPTIMIZACIÓN DELTA: Mismo tamaño y misma fecha = Saltar lectura profunda
                if cached and cached.get('size_bytes') == file_size and cached.get('date') == file_date:
                    files_data.append(cached)
                    continue

                # 🐢 Lectura profunda: Si es nuevo o fue modificado
                meta = obtener_metadata_completa(path, f)
                
                # Protección para heredar el género si el nuevo es basura
                if cached:
                    cached_genre = cached.get('genre', '')
                    meta_genre = meta.get('genre', '').strip()
                    
                    if cached_genre and (not meta_genre or meta_genre in GENEROS_VACIOS):
                        meta['genre'] = cached_genre

                tipo_archivo = 'video' if ext in VIDEO_EXTS else 'audio'
                
                files_data.append({
                    'filename': f, 
                    'path': rel_path, 
                    'folder': serie_name, 
                    'full_folder': folder_name,
                    'type': tipo_archivo,
                    'size_bytes': file_size,
                    'artist': meta.get('artist', ''), 
                    'title': meta.get('title', ''), 
                    'album': meta.get('album', ''), 
                    'genre': meta.get('genre', ''),
                    'duration_sec': meta.get('duration', 0),
                    'date': file_date
                })
                
            except Exception as e:
                print(f"⚠️ Error indexando archivo: {rel_path} - {e}")

    # Guardar el nuevo estado de la realidad
    save_json(FILES_CACHE_FILE, files_data)
    print(f"✅ Escaneo físico terminado. {len(files_data)} archivos indexados.")
    
    return files_data


def calcular_similitud(cancion_actual, cancion_candidata):
    """
    Calcula qué tan similar es una canción a otra.
    Retorna un puntaje de 0-130 puntos.
    """
    score = 0
    
    # 1. Mismo artista (60 puntos) - MUY CONFIABLE
    if cancion_actual.get('artist') and cancion_candidata.get('artist'):
        if cancion_actual['artist'].lower() == cancion_candidata['artist'].lower():
            score += 60
    
    # 2. Mismo álbum (40 puntos) - SUPER CONFIABLE
    if cancion_actual.get('album') and cancion_candidata.get('album'):
        if cancion_actual['album'].lower() == cancion_candidata['album'].lower():
            score += 40
    
    # 3. Género similar (20 puntos) - Ayuda pero no es crítico
    if cancion_actual.get('genre') and cancion_candidata.get('genre'):
        if (cancion_actual['genre'].lower() == cancion_candidata['genre'].lower() 
            and cancion_actual['genre'].lower() not in ['otros', 'unknown', '']):
            score += 20
    
    # 4. Rating similar (10 puntos) - Calidad parecida
    rating_actual = cancion_actual.get('rating', 0)
    rating_candidata = cancion_candidata.get('rating', 0)
    if abs(rating_actual - rating_candidata) <= 1:
        score += 10
    
    return score

def generar_radio_inteligente(cancion_referencia, biblioteca, limite=50):
    """
    Genera una lista de canciones similares a la de referencia.
    Prioriza: mismo artista > mismo álbum > género > rating
    """
    if not cancion_referencia or not biblioteca:
        # Fallback: radio aleatorio tradicional
        rnd = list(biblioteca)
        random.shuffle(rnd)
        return rnd[:limite]
    
    # Calcular score de similitud para cada canción
    candidatas = []
    for cancion in biblioteca:
        # No incluir la misma canción
        if cancion.get('path') == cancion_referencia.get('path'):
            continue
        
        score = calcular_similitud(cancion_referencia, cancion)
        candidatas.append({
            'cancion': cancion,
            'score': score
        })
    
    # Ordenar por score descendente
    candidatas.sort(key=lambda x: x['score'], reverse=True)
    
    # Estrategia mixta:
    # - Top 30: Las más similares (score alto)
    # - 10 aleatorias de score medio (para variedad)
    # - 10 aleatorias de score bajo (para descubrir)
    
    resultado = []
    
    # Grupo 1: Las más similares (score >= 60)
    muy_similares = [c for c in candidatas if c['score'] >= 60]
    resultado.extend([c['cancion'] for c in muy_similares[:30]])
    
    # Grupo 2: Medianamente similares (score 20-59)
    medio_similares = [c for c in candidatas if 20 <= c['score'] < 60]
    if medio_similares:
        random.shuffle(medio_similares)
        resultado.extend([c['cancion'] for c in medio_similares[:10]])
    
    # Grupo 3: Poco similares pero para descubrir (score < 20)
    poco_similares = [c for c in candidatas if c['score'] < 20]
    if poco_similares:
        random.shuffle(poco_similares)
        resultado.extend([c['cancion'] for c in poco_similares[:10]])
    
    # Si no llegamos al límite, rellenar con aleatorios
    if len(resultado) < limite:
        resto = [c['cancion'] for c in candidatas if c['cancion'] not in resultado]
        random.shuffle(resto)
        resultado.extend(resto[:limite - len(resultado)])
    
    # Limitar al número solicitado
    return resultado[:limite]

def recalcular_mixes(files_data):
    global MIXES_CACHE
    print("🍹 Preparando cócteles (Smart Mixes)...")
    
    # 🔥 LIMPIAR ANTES DE CREAR NUEVOS
    smart_mixes = []
    audio_only = [f for f in files_data if f['type'] == 'audio']
    
    if not audio_only:
        MIXES_CACHE = []
        return []  # 🔥 RETORNAR LISTA VACÍA

    # 1. Top 50 Más Escuchadas
    top = sorted([f for f in audio_only if f['play_count'] > 0], key=lambda x: x['play_count'], reverse=True)[:50]
    if top: 
        smart_mixes.append({'id':'smart_top50', 'name':'Top 50 Más Escuchadas', 'icon':'fa-fire', 'color':'text-orange-500', 'files':[x['path'] for x in top], 'cover':top[0]['path']})
    
    # 2. Joyas Olvidadas
    month_ago = time.time() - (30 * 86400)
    # Joyas: Rating alto (>4) pero no escuchadas en el último mes
    gems = [f for f in audio_only if f.get('rating', 0) >= 4 and f.get('last_played', 0) < month_ago]
    if gems:
        random.shuffle(gems) # Mezclar para que no sean siempre las mismas
        smart_mixes.append({'id': 'smart_gems', 'name': 'Joyas Olvidadas', 'icon': 'fa-gem', 'color': 'text-purple-400', 'files': [x['path'] for x in gems[:50]], 'cover': gems[0]['path']})

    # 3. Radar de Novedades (Últimos 7 días)
    week_ago = time.time() - (7 * 86400)
    new_f = sorted([f for f in audio_only if f['date'] > week_ago], key=lambda x: x['date'], reverse=True)
    if new_f: 
        smart_mixes.append({'id':'smart_new', 'name':'Radar de Novedades', 'icon':'fa-rss', 'color':'text-emerald-400', 'files':[x['path'] for x in new_f], 'cover':new_f[0]['path']})
    
    # 4. Radio Kraken (Antes Mix Aleatorio)
    rnd = list(audio_only)
    random.shuffle(rnd)
    rnd = rnd[:50] # Generamos una lista inicial para que la tarjeta tenga portada
    
    smart_mixes.append({
        'id': 'smart_shuffle', 
        'name': 'Radio Kraken',       # <--- CAMBIO DE NOMBRE
        'icon': 'fa-broadcast-tower', # <--- CAMBIO DE ÍCONO
        'color': 'text-cyan-400',     # <--- CAMBIO DE COLOR (Opcional, cyan se ve radioactivo)
        'files': [x['path'] for x in rnd], 
        'cover': rnd[0]['path'] if rnd else '' 
    })
    
    MIXES_CACHE = smart_mixes
    return smart_mixes

def generar_biblioteca_viva():
    """PASO 2 (RÁPIDO): Lee el JSON crudo y calcula Artistas, Mixes y Playlists al vuelo."""
    
    # 1. Cargar caché (o crear si no existe)
    if os.path.exists(FILES_CACHE_FILE):
        files_data = load_json(FILES_CACHE_FILE)
    else:
        files_data = escanear_archivos_fisicos()

    # 2. Cargar datos dinámicos
    ratings = load_json(RATINGS_FILE)
    playlists = load_json(PLAYLISTS_FILE)
    stats = load_json(STATS_FILE)
    
    # Normalizar rutas en playlist_map (decodificar %20, etc.)
    playlist_map = {}
    for pl_name, paths in playlists.items():
        for path in paths:
            # Normalizar la ruta (quitar URL encoding)
            try:
                normalized_path = unquote(path)
            except:
                normalized_path = path
            
            if normalized_path not in playlist_map: 
                playlist_map[normalized_path] = []
            playlist_map[normalized_path].append(pl_name)

    # 3. Reconstruir variables (artist_tree, genres, etc.)
    artist_tree = {}
    genre_set = set()
    folders = set()
    total_size = 0
    final_files = []

    for f in files_data:
        rel_path = f['path']
        
        # Inyectar datos vivos
        f['rating'] = ratings.get(rel_path, 0)
        file_stats = stats.get(rel_path, {'count': 0, 'last_played': 0})
        f['play_count'] = file_stats['count']
        f['last_played'] = file_stats['last_played']
        f['playlists'] = playlist_map.get(rel_path, [])
        
        # Formatear para visualización
        f['size'] = f"{f['size_bytes']/(1024*1024):.1f} MB"
        f['duration'] = format_duration(f['duration_sec'])
        
        # Reconstruir Árboles
        if f['type'] == 'audio':
            art = f['artist']; alb = f['album'] or "Sencillos"
            if art not in artist_tree: artist_tree[art] = set()
            artist_tree[art].add(alb)
        
        if f['genre']: genre_set.add(f['genre'])
        if f['full_folder'] != '.': folders.add(f['full_folder'])
        total_size += f['size_bytes']
        
        final_files.append(f)

    # Ordenar
    final_files.sort(key=lambda x: (x['folder'], x['title']))
    final_artist_tree = {k: sorted(list(v)) for k, v in artist_tree.items()}

    global MIXES_CACHE
    if not MIXES_CACHE: # Si están vacíos, los calculamos por primera vez
        recalcular_mixes(final_files)
    return {
        "files": final_files, 
        "folders": sorted(list(folders)), 
        "artist_tree": final_artist_tree, 
        "genres": sorted(list(genre_set)), 
        "playlists": playlists, 
        "smart_mixes": MIXES_CACHE,
        "total_size": f"{total_size/(1024*1024*1024):.2f} GB"
    }

def make_uid(info):
    base = f"{info.get('extractor','')}|{info.get('webpage_url','')}|{info.get('title','')}"
    return hashlib.sha1(base.encode('utf-8')).hexdigest()

# ==================== RUTAS ====================
@app.route('/save_lyrics_to_file', methods=['POST'])
def save_lyrics_to_file():
    try:
        data = request.json
        rel_path = data.get('path')
        text = data.get('text')
        
        if not rel_path:
            return jsonify({'ok': False, 'error': 'Ruta inválida'})

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

        print(f"💾 Letra guardada en: {os.path.basename(full_path)}")
        return jsonify({'ok': True})

    except Exception as e:
        print(f"Error guardando: {e}")
        return jsonify({'ok': False, 'error': str(e)})
    
@app.route('/lyrics/<path:filename>')
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
            clean_artist = artist.split('•')[0].split(':')[0].strip()
            clean_title = re.sub(r"\(.*feat.*\)|\[.*\]|\(.*\)", "", title, flags=re.IGNORECASE).strip()
            
            try:
                url = "https://lrclib.net/api/get"
                
                # 👇 ESTO ES LO NUEVO: Nos disfrazamos de Chrome 👇
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
                
                # Intento 1: Buscar exacto primero (AGREGADO)
                print(f"🔍 Intento 1 exacto: {artist} - {title}")
                r = requests.get(url, params={'artist_name': artist, 'track_name': title}, headers=headers, timeout=10, verify=False)
                
                # Intento 2: Si falla, buscar con limpieza (ORIGINAL)
                if r.status_code != 200:
                    print(f"🔍 Intento 2 limpio: {clean_artist} - {clean_title}")
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
                print(f"⚠️ Error API: {e}")

        return jsonify({'found': False, 'text': 'No se encontró letra.'})

    except Exception as e:
        return jsonify({'found': False, 'error': str(e)})

@app.route('/api/delete_folder_batch', methods=['POST'])
def delete_folder_batch():
    data = request.json
    folder_rel_path = data.get('folder')
    
    if not folder_rel_path or '..' in folder_rel_path:
        return jsonify({'error': 'Ruta inválida'}), 400
        
    # Construimos la ruta absoluta
    folder_abs_path = os.path.join(DOWNLOAD_FOLDER, folder_rel_path)
    
    if os.path.exists(folder_abs_path) and os.path.isdir(folder_abs_path):
        try:
            # 🗑️ ELIMINACIÓN RECURSIVA (Borra carpeta y todo lo de adentro)
            shutil.rmtree(folder_abs_path)
            
            # Limpiamos la DB en memoria para no reiniciar todo el server si no quieres
            # (Opcional: aquí podrías llamar a init_db() de nuevo)
            
            return jsonify({'status': 'ok'})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    else:
        return jsonify({'error': 'La carpeta no existe'}), 404

@app.route('/control')
def remote_control():
    target_sid = request.args.get('target') # ¿A quién?
    action = request.args.get('action')     # ¿Qué hago? (pause, play, next, prev)
    
    if target_sid and action:
        # Guardamos la orden en el buzón del destinatario
        PENDING_COMMANDS[target_sid] = {
            'action': action,
            'time': time.time()
        }
        return jsonify({'status': 'sent', 'target': target_sid, 'action': action})
    
    return jsonify({'status': 'error', 'msg': 'Faltan datos'})

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    # Esto le dice a Python: "Busca en la carpeta 'assets' junto a app.py"
    assets_folder = os.path.join(BASE_DIR, 'assets')
    return send_from_directory(assets_folder, filename)
@app.route('/proxy_thumb')
def proxy_thumb():
    url = request.args.get('url')
    if not url: return "No URL", 400
    try:
        # Fingimos ser un navegador para que YouTube nos dé la imagen
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        r = requests.get(url, headers=headers, stream=True, timeout=5)
        return Response(r.content, mimetype=r.headers.get('Content-Type'))
    except Exception as e:
        print("Error en /proxy_thumb:", e, "URL:", url)
        return "Error", 500
    
@app.route('/manifest.json')
def manifest():
    return jsonify({
       "name": "KRAKEN Media", 
        "short_name": "KRAKEN", 
        "start_url": "/",
        "display": "standalone", 
        "background_color": "#020617", 
        "theme_color": "#10b981", # Verde Esmeralda
        "icons": [{"src": "/assets/kraken.svg", "sizes": "512x512", "type": "image/svg+xml"}] # ¡Usamos el mismo SVG!
    })

@app.route('/historial')
def historial():
    limit = int(request.args.get('limit', 200))
    h = load_json(HISTORY_FILE)
    items = list(h.items())[-limit:]
    return jsonify(dict(items))

@app.route('/playlist/remove_item', methods=['POST'])
def remove_playlist_item():
    try:
        data = request.json
        pl_name = data.get('playlist')
        file_path = data.get('file')
        
        # Decodificar URL encoding si viene codificado
        file_path = unquote(file_path)
        
        playlists = load_json(PLAYLISTS_FILE)
        
        if pl_name in playlists:
            # Buscar con normalización: comparar ambas versiones
            found = False
            for stored_path in playlists[pl_name]:
                # Comparar la ruta decodificada con la almacenada
                if unquote(stored_path) == file_path or stored_path == file_path:
                    playlists[pl_name].remove(stored_path)
                    save_json(PLAYLISTS_FILE, playlists)
                    found = True
                    break
            
            if found:
                return jsonify({"ok": True})
            else:
                print(f"⚠️ No encontrada: '{file_path}' en playlist '{pl_name}'")
                print(f"   Rutas disponibles: {playlists[pl_name][:3]}...")
            
    except Exception as e:
        print(f"❌ Error borrando de playlist: {e}")
        import traceback
        traceback.print_exc()
        
    return jsonify({"ok": False, "error": "No coincide el nombre"})

@app.route('/clean_ghosts', methods=['POST'])
def clean_ghosts():
    h = load_json(HISTORY_FILE); uids_to_del = []; names_deleted = []
    existing_filenames = set()
    for _, _, files in os.walk(DOWNLOAD_FOLDER):
        existing_filenames.update(files)

    for uid, data in h.items():
        fname = data.get('filename')
        if fname:
            if fname not in existing_filenames:
                uids_to_del.append(uid); names_deleted.append(data.get('title', fname))
    for uid in uids_to_del: del h[uid]
    save_json(HISTORY_FILE, h)
    return jsonify({"ok": True, "count": len(uids_to_del), "names": names_deleted})

@app.route('/log_play', methods=['POST'])
def log_play():
    path = request.json.get('path')
    if path:
        s = load_json(STATS_FILE)
        if path not in s: s[path] = {'count': 0, 'last_played': 0}
        s[path]['count'] += 1; s[path]['last_played'] = time.time()
        save_json(STATS_FILE, s)
        
       

        return jsonify({"ok": True})
    return jsonify({"error": "No path"})
# ==================== ENDPOINTS DE ALEXA ====================
@app.route('/alexa', methods=['POST'])
def alexa_endpoint():
    return skill_adapter.dispatch_request()

@app.route('/borrar_masivo', methods=['POST'])
def borrar_masivo():
    paths = request.json.get('paths', [])
    deleted_count = 0
    h = load_json(HISTORY_FILE)
    history_modified = False

    for rel_path in paths:
        full_path = os.path.join(DOWNLOAD_FOLDER, rel_path)
        base = os.path.splitext(os.path.basename(rel_path))[0]
        if os.path.exists(full_path):
            os.remove(full_path); deleted_count += 1
            for ext in ['.jpg', '.webp', '.png']:
                thumb = os.path.join(THUMBNAILS_FOLDER, base + ext)
                if os.path.exists(thumb): os.remove(thumb)
            id_to_del = None
            for uid, info in h.items():
                if info.get('filename') == os.path.basename(rel_path): id_to_del = uid; break
            if id_to_del:
                del h[id_to_del]
                history_modified = True

    if history_modified:
        save_json(HISTORY_FILE, h)

    return jsonify({"ok": True, "count": deleted_count})

@app.route('/mover_archivo', methods=['POST'])
def mover_archivo():
    try:
        data = request.json
        rel_src = data['file']
        target = data['target']

        # 🔐 Validar origen
        src = validar_path(rel_src)

        filename = os.path.basename(rel_src)

        # Resolver destino
        if target == "Raíz":
            rel_dst = filename
        else:
            rel_dst = os.path.join(target, filename)

        dst = validar_path(rel_dst)

        # Crear carpeta destino si no existe
        dst.parent.mkdir(parents=True, exist_ok=True)

        if src.exists():
            src.rename(dst)

            # Actualizar rutas en JSON internos
            new_rel = os.path.relpath(dst, DOWNLOAD_FOLDER)

            r = load_json(RATINGS_FILE)
            s = load_json(STATS_FILE)

            if rel_src in r:
                r[new_rel] = r.pop(rel_src)
                save_json(RATINGS_FILE, r)

            if rel_src in s:
                s[new_rel] = s.pop(rel_src)
                save_json(STATS_FILE, s)

            return jsonify({"ok": True})

        return jsonify({"error": "Archivo no encontrado"}), 404

    except Exception as e:
        print("Error en /mover_archivo:", e)
        return jsonify({"error": str(e)}), 400

@app.route('/update_cover', methods=['POST'])
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

@app.route('/update_tags', methods=['POST'])
def update_tags():
    try:
        data = request.json
        # Soporta tanto edición individual ('path') como masiva ('paths')
        rel_paths = data.get('paths', [])
        if not rel_paths and 'path' in data:
            rel_paths = [data.get('path')]

        # 1. ACTUALIZAR ARCHIVOS FÍSICOS (Tu código original)
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

        # 2. ACTUALIZAR EL CACHÉ (LA MAGIA QUE FALTABA ✨)
        # Cargamos el "mapa" actual
        cache = load_json(FILES_CACHE_FILE)
        updated_count = 0
        
        # Recorremos el caché buscando los archivos que acabamos de editar
        for file_data in cache:
            if file_data['path'] in rel_paths:
                # Si encontramos uno, le actualizamos los datos en memoria
                if 'title' in data: file_data['title'] = data['title']
                if 'artist' in data: file_data['artist'] = data['artist']
                if 'album' in data: file_data['album'] = data['album']
                if 'genre' in data: file_data['genre'] = data['genre']
                updated_count += 1
        
        # Si cambiamos algo, guardamos el mapa nuevo
        if updated_count > 0:
            save_json(FILES_CACHE_FILE, cache)

        return jsonify({"ok": True})
    except Exception as e: 
        print(f"Error fatal: {e}")
        return jsonify({"error": str(e)})

@app.route('/api/favorite/toggle', methods=['POST'])
def toggle_favorite():
    try:
        data = request.json
        path = data.get('path')
        
        # Usamos RATINGS_FILE y load_json/save_json que ya tienes definidos
        # Así no rompes nada en el resto del código.
        if os.path.exists(RATINGS_FILE):
            favorites = load_json(RATINGS_FILE) # Asumo que tienes esta función helper
        else:
            favorites = {}
            
        # LOGICA: 
        # Si existe y es 1, lo borramos (quitamos like).
        # Si no existe, lo ponemos como 1 (damos like).
        current_status = favorites.get(path, 0)
        
        if current_status == 1:
            if path in favorites:
                del favorites[path] # Lo sacamos del archivo para no ocupar espacio
            is_fav = False
        else:
            favorites[path] = 1 # Lo marcamos como favorito
            is_fav = True
                
        # Guardamos en el mismo archivo de siempre
        save_json(RATINGS_FILE, favorites) 
            
        return jsonify({'success': True, 'is_favorite': is_fav})

    except Exception as e:
        print(f"Error toggle favorite: {e}")
        return jsonify({'error': str(e)}), 500
@app.route('/playlist/create', methods=['POST'])
def create_playlist():
    n = request.json.get('name'); p = load_json(PLAYLISTS_FILE)
    if n and n not in p: p[n] = []; save_json(PLAYLISTS_FILE, p); return jsonify({"ok": True})
    return jsonify({"error": "Error"})

@app.route('/playlist/rename', methods=['POST'])
def rename_playlist():
    old = request.json.get('old_name'); new = request.json.get('new_name'); p = load_json(PLAYLISTS_FILE)
    if old in p and new and new not in p: p[new] = p.pop(old); save_json(PLAYLISTS_FILE, p); return jsonify({"ok": True})
    return jsonify({"error": "Error"})

@app.route('/playlist/add', methods=['POST'])
def add_to_playlist():
    n = request.json.get('name'); path = request.json.get('path'); p = load_json(PLAYLISTS_FILE)
    if n in p:
        if path in p[n]: return jsonify({"ok": True, "duplicate": True})
        p[n].append(path); save_json(PLAYLISTS_FILE, p); return jsonify({"ok": True, "duplicate": False})
    return jsonify({"error": "Error"})

@app.route('/playlist/add_batch', methods=['POST'])
def add_to_playlist_batch():
    n = request.json.get('name'); paths = request.json.get('paths'); p = load_json(PLAYLISTS_FILE)
    added = 0; ignored = 0
    if n in p:
        for path in paths:
            if path not in p[n]: p[n].append(path); added += 1
            else: ignored += 1
        save_json(PLAYLISTS_FILE, p)
        return jsonify({"ok": True, "added": added, "ignored": ignored})
    return jsonify({"error": "Error"})

@app.route('/playlist/remove', methods=['POST'])
def remove_from_playlist():
    n = request.json.get('name'); path = request.json.get('path'); p = load_json(PLAYLISTS_FILE)
    if n in p and path in p[n]: p[n].remove(path); save_json(PLAYLISTS_FILE, p); return jsonify({"ok": True})
    return jsonify({"error": "Error"})

@app.route('/playlist/delete', methods=['POST'])
def delete_playlist():
    n = request.json.get('name'); p = load_json(PLAYLISTS_FILE)
    if n in p: del p[n]; save_json(PLAYLISTS_FILE, p); return jsonify({"ok": True})
    return jsonify({"error": "Error"})

@app.route('/caratula/<path:filename>')
def caratula(filename):
    decoded = unquote(filename).lstrip('/\\')
    try:
        path = validar_path(decoded)
    except ValueError:
        return "Ruta inválida", 400
    base = os.path.splitext(os.path.basename(decoded))[0]

    # 1️⃣ Thumbnail ya generada (RÁPIDO + CACHEABLE)
    for ext in ['.jpg', '.webp', '.png']:
        thumb = os.path.join(THUMBNAILS_FOLDER, base + ext)
        if os.path.exists(thumb):
            # ✅ AQUÍ VA EL CAMBIO:
            response = send_file(
                thumb,
                mimetype='image/jpeg',
                max_age=31536000,
                conditional=True
            )
            response.headers['Cache-Control'] = 'public, max-age=31536000'
            return response

    # 2️⃣ Fallback: carátula embebida en el archivo (LENTO, pero seguro)
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
        print(f"Error leyendo carátula embebida: {e}")

    return "No image", 404


@app.route('/descargar', methods=['POST'])
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

        opts = {
            'progress_hooks': [progress_hook],
            'quiet': True,
            'writethumbnail': True,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'postprocessors': [{'key': 'FFmpegMetadata', 'add_metadata': True}],
            'outtmpl': {'default': os.path.join(DOWNLOAD_FOLDER, '%(title)s.%(ext)s')}
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
                progress_status["details"] = "Buscando equivalente en YouTube…"
                progress_status["percent"] = "..."

                try:
                    kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
                    subprocess.run([
                        "spotdl",
                        "download",
                        url,
                        "--output", os.path.join(DOWNLOAD_FOLDER, "{artist} - {title}.{output-ext}")
                    ], check=True, **kwargs)

                    # Registrar en historial (SpotDL ya creó el archivo final)
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
                    print(f"❌ Error con SpotDL ({url}): {e}")
                    progress_status.update({
                        "details": "Spotify: no se encontró una fuente alternativa",
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

                # Optimización de imagen
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
                print(f"❌ Error descargando {url}: {e}")
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
        print("✅ Biblioteca actualizada en background.")

    threading.Thread(target=job).start()
    return jsonify({"ok": True})

@app.route('/estado')
def estado():
    return jsonify({"rescan": RESCAN_IN_PROGRESS})

@app.route('/analizar', methods=['POST'])
def analizar():
    try:
        url = request.json['url']
        hist = load_json(HISTORY_FILE)
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
                    return jsonify({"entries": [], "error": "SpotDL no devolvió datos."})

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

                return jsonify({"entries": clean})

            except subprocess.TimeoutExpired:
                return jsonify({"entries": [], "error": "Spotify tardó demasiado en responder."})

            except Exception as e:
                print("SpotDL error:", e)
                return jsonify({"entries": [], "error": "SpotDL no pudo analizar este enlace."})

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

        return jsonify({"entries": clean})

    except Exception as e:
        return jsonify({"entries": [], "error": str(e)})

@app.route('/biblioteca')
def biblioteca():
    global BIB_CACHE, BIB_CACHE_TIME

    force = request.args.get('fresh') == '1'

    # Cache simple
    if BIB_CACHE and not force:
        data = BIB_CACHE
    else:
        data = generar_biblioteca_viva()
        BIB_CACHE = data
        BIB_CACHE_TIME = time.time()

    # Agregar totales
    all_files = data.get('files', [])
    data['total_files'] = len(all_files)
    data['total_videos'] = sum(1 for f in all_files if f.get('type') == 'video')
    data['total_folders'] = len(data.get('folders', []))

    return jsonify(data)

@app.route('/similar/<path:filepath>')
def obtener_similares(filepath):
    """Endpoint para obtener canciones similares a una específica"""
    try:
        filepath_decoded = unquote(filepath)
        
        # Cargar biblioteca
        bib = generar_biblioteca_viva()
        audios = [f for f in bib.get('files', []) if f.get('type') == 'audio']
        
        # Encontrar la canción de referencia
        cancion_ref = None
        for cancion in audios:
            if cancion.get('path') == filepath_decoded:
                cancion_ref = cancion
                break
        
        if not cancion_ref:
            return jsonify({'error': 'Canción no encontrada', 'similares': []})
        
        # Generar lista de similares
        similares = generar_radio_inteligente(cancion_ref, audios, limite=50)
        
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
        print(f"Error obteniendo similares: {e}")
        return jsonify({'error': str(e), 'similares': []})


@app.route('/update_ytdlp', methods=['POST'])
def update_ytdlp():
    def job():
        try:
            print("🔄 Actualizando yt-dlp...")

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
                print("⚠️ STDERR:", result.stderr)

            print("✅ yt-dlp actualizado")

        except Exception as e:
            print("❌ Error actualizando yt-dlp:", e)

    threading.Thread(target=job, daemon=True).start()
    return jsonify({"ok": True})

@app.route('/actualizar_cache')
def actualizar_cache():
    # Esta ruta fuerza el escaneo físico (usada por el botón o automáticos)
    escanear_archivos_fisicos()
    return jsonify({"ok": True})
@app.route('/descargas/<path:filename>')
def serve_file(filename):
    try:
        decoded = unquote(filename).lstrip('/\\')

        base = Path(DOWNLOAD_FOLDER).resolve()
        requested = (base / decoded).resolve()

        # 🔐 Evitar salir del directorio base
        requested.relative_to(base)

        if not requested.exists():
            return "No encontrado", 404

        return send_file(str(requested), conditional=True)

    except Exception as e:
        print("Intento inválido en serve_file:", e)
        return "Acceso denegado", 403
@app.route('/crear_carpeta', methods=['POST'])
def crear_carpeta():
    try:
        name = request.json['name']
        safe_path = validar_path(name)
        safe_path.mkdir(parents=True, exist_ok=True)
        return jsonify({"ok": True})
    except Exception as e:
        print("Error en /crear_carpeta:", e)
        return jsonify({"error": "Nombre de carpeta inválido"}), 400
@app.route('/borrar', methods=['POST'])
def borrar(): 
    try:
        rel_path = request.json['file']

        # 🔐 Ruta segura del archivo principal
        path = validar_path(rel_path)

        base = os.path.splitext(os.path.basename(rel_path))[0]
        
        # 1. Borrar archivo físico (MP3/Video)
        if path.exists():
            path.unlink()
        
        # 2. Borrar miniaturas (también protegidas)
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

        # 4. Limpiar caché visual
        cache = load_json(FILES_CACHE_FILE)
        new_cache = [f for f in cache if f['path'] != rel_path]
        save_json(FILES_CACHE_FILE, new_cache)

        return jsonify({"ok": True}) 

    except Exception as e: 
        print(f"Error borrando: {e}")
        return jsonify({"ok": False, "error": str(e)}), 400
@app.route('/status')
def status():
    global LAST_ALEXA_COMMAND, ACTIVE_USERS
    
    # 1. RECIBIR DATOS (Ahora con Tiempo y Duración)
    session_id = request.args.get('sid')
    user_name = request.args.get('user')
    is_speaker_param = request.args.get('is_speaker')
    current_song = request.args.get('song', '')
    current_artist = request.args.get('artist', '')
    
    # 👇 NUEVO: TIEMPO DE REPRODUCCIÓN 👇
    current_time = request.args.get('time', '0')     # En qué segundo va
    total_duration = request.args.get('duration', '0') # Cuánto dura
    
    is_speaker = (is_speaker_param == 'true')

    # 2. ACTUALIZAR ESTADO
    if session_id and user_name:
        with USERS_LOCK:
            ACTIVE_USERS[session_id] = {
                'name': user_name,
                'last_ping': time.time(),
                'is_speaker': is_speaker,
                'initial': user_name[0].upper(),
                'song': current_song,
                'artist': current_artist,
                'time': current_time,       # <--- Guardamos esto
                'duration': total_duration  # <--- Y esto
            }

    # 3. PREPARAR LISTA
    online_list = []
    with USERS_LOCK:
        for sid, data in ACTIVE_USERS.items():
            online_list.append({
                'session_id': sid,
                'name': data['name'],
                'initial': data['initial'],
                'is_speaker': data['is_speaker'],
                'is_me': (sid == session_id),
                'song': data.get('song', ''),
                'artist': data.get('artist', ''),
                'time': data.get('time', '0'),         # <--- Enviamos de vuelta
                'duration': data.get('duration', '0')  # <--- Enviamos de vuelta
            })

    response = progress_status.copy()
    response['last_command'] = LAST_ALEXA_COMMAND
    response['online_users'] = online_list
    
    # CHEQUEO DE BUZÓN (CONTROL REMOTO)
    if session_id in PENDING_COMMANDS:
        cmd = PENDING_COMMANDS[session_id]
        if time.time() - cmd['time'] < 10:
            response['remote_command'] = cmd['action']
        del PENDING_COMMANDS[session_id]
    
    return jsonify(response)
@app.route('/stop', methods=['POST'])
def stop(): global stop_download; stop_download = True; return jsonify({"ok": True})
@app.route('/')
def index(): return render_template_string(HTML_TEMPLATE)

@app.route('/api/video/streams', methods=['POST'])
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
        
        return jsonify({
            'ok': True,
            'streams': streams
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== HTML V71 (VIDEO INTELIGENCE + SMART FOLDER) ====================
