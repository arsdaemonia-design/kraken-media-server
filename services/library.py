import os
import re
import json
import time
import random
from urllib.parse import unquote
import config
import state
import utils
from services.metadata import obtener_metadata_completa
from services.media_analyzer import extract_video_metadata

from services.database import get_db, init_db as init_db

# Mapeo de carpetas a idiomas (basado en la estructura real del usuario)
LANG_FOLDER_MAP = {
    'es': [
        'español', 'espanol', 'spanish', 'latin',
        'banda', 'cumbia', 'reggaeton', 'salsa', 'bachata', 'regional',
        'tumbado', 'trap',
        'trova', 'protesta', 'mexa',
        'rap en español', 'rock antaño', 'español variado',
        'cuba', 'reggaeton oldie',
        'rap blanco',
        'indie',  # indie del usuario es en español
        'pop',  # pop sin especificar = español
    ],
    'en': [
        'english', 'inglés', 'ingles',  # carpetas que dicen explícitamente inglés
        'alternative', 'hip hop',
        'electro rock', 'electro alternative',
        'metal', 'oldies', 'oldies rock',
        'pop ingles', 'uju ingles',
        'rock pop',
    ],
    'world': [
        'internacional',  # Ska punk Internacional, Reggae Internacional, etc.
        'discograf', 'darkie',
    ],
    'ja': ['japanese', 'japonés', 'japones', 'anime', 'j-pop', 'jpop', 'j-rock'],
    'ko': ['korean', 'coreano', 'k-pop', 'kpop'],
    'fr': ['french', 'francés', 'frances'],
    'de': ['german', 'alemán', 'aleman', 'deutsch'],
    'pt': ['portuguese', 'portugués', 'portugues', 'brasileiro'],
}

def detect_language_from_folder(folder_path):
    """
    Detecta el idioma basándose en el nombre de la carpeta.
    Recorre CADA parte de la ruta buscando coincidencias.
    """
    if not folder_path or folder_path == '.':
        return 'unknown'
    
    parts = folder_path.lower().replace('\\', '/').split('/')
    
    for part in parts:
        for lang_code, keywords in LANG_FOLDER_MAP.items():
            for kw in keywords:
                if kw in part:
                    return lang_code
    
    return 'unknown'

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


def extract_tmdb_id_from_path(file_path):
    """
    Extrae TMDB ID de cualquier parte de la ruta
    Soporta: (tmdb-123), {tmdb-123}, [tmdb=123]
    """
    path_str = str(file_path).replace('\\', '/')
    
    patterns = [
        r'\(tmdb[-=_]?(\d+)\)',      # (tmdb-12345)
        r'\{tmdb[-=_]?(\d+)\}',      # {tmdb-12345}
        r'\[tmdb[-=_]?(\d+)\]',      # [tmdb=12345]
        r'(?i)tmdb[-=_](\d+)',       # tmdb-12345
    ]
    
    for pattern in patterns:
        match = re.search(pattern, path_str)
        if match:
            return int(match.group(1))
    
    return None


def detect_folder_type(file_path):
    """
    Detecta si es movie o series basado en la estructura de carpetas
    Series: Si la ruta contiene Temporada o Season
    Movies: Todo lo demás
    """
    path_lower = str(file_path).lower()
    
    series_keywords = ['temporada', 'season', 'temp']
    for keyword in series_keywords:
        if keyword in path_lower:
            return 'series'
    
    return 'movie'


def escanear_archivos_fisicos():
    """PASO 1 (DELTA): Lee disco y solo reprocesa archivos nuevos/modificados."""
    import state
    
    # Inicializar estado de escaneo
    state.RESCAN_STATUS = {
        "active": True,
        "stage": "counting",
        "total": 0,
        "processed": 0,
        "percent": 0,
        "message": "Contando archivos...",
        "start_time": time.time()
    }
    
    print("📀 Iniciando escaneo físico de disco...")
    
    conn = get_db()
    c = conn.cursor()
    
    c.execute("SELECT rel_path, size_bytes, date_added, genre, video_resolution, audio_codec FROM media")
    existing_rows = {row['rel_path']: row for row in c.fetchall()}
    existing_genres = {
        rel_path: row['genre']
        for rel_path, row in existing_rows.items()
        if row['genre'] not in [None, '', 'Otros', 'Unknown']
    }
    
    scanned_paths = set()
    unchanged_count = 0
    upserted_count = 0
    
    # Contar archivos totales primero
    total_files = 0
    for root, dirs, files in os.walk(config.DOWNLOAD_FOLDER):
        if 'thumbnails' in root: 
            continue
        for f in files:
            ext = f.split('.')[-1].lower()
            if ext in ['mp3', 'm4a', 'wav', 'mp4', 'webm', 'mkv']:
                total_files += 1
    
    state.RESCAN_STATUS["total"] = total_files
    state.RESCAN_STATUS["stage"] = "scanning"
    state.RESCAN_STATUS["message"] = f"Escaneando 0/{total_files} archivos..."
    
    processed = 0
    batch_size = 100  # Commit cada 100 archivos
    batch_count = 0
    
    for root, dirs, files in os.walk(config.DOWNLOAD_FOLDER):
        if 'thumbnails' in root: 
            continue
        
        folder_name = os.path.relpath(root, config.DOWNLOAD_FOLDER)
        serie_name = "Raíz" if folder_name == '.' else get_smart_folder_name(root)
        
        for f in files:
            ext = f.split('.')[-1].lower()
            if ext not in ['mp3', 'm4a', 'wav', 'mp4', 'webm', 'mkv']: 
                continue
            
            processed += 1
            
            # Actualizar progreso cada 10 archivos
            if processed % 10 == 0:
                percent = int((processed / total_files) * 100) if total_files > 0 else 0
                state.RESCAN_STATUS["processed"] = processed
                state.RESCAN_STATUS["percent"] = percent
                state.RESCAN_STATUS["message"] = f"Escaneando {processed}/{total_files} ({percent}%)"
            
            path = os.path.join(root, f)
            rel_path = os.path.relpath(path, config.DOWNLOAD_FOLDER).replace('\\', '/')
            scanned_paths.add(rel_path)
            
            try:
                stat = os.stat(path)
                existing = existing_rows.get(rel_path)

                # Helper seguro para sqlite3.Row: retorna None si columna no existe
                def _safe_get(row, key, default=None):
                    try:
                        return row[key]
                    except (KeyError, IndexError):
                        return default

                # Delta skip: si tamaño y mtime no cambiaron, no reprocesar
                # EXCEPCIÓN: Si es video y le faltan columnas de metadata, re-procesar completo
                if existing:
                    same_size = int(_safe_get(existing, 'size_bytes', 0) or 0) == int(stat.st_size)
                    previous_mtime = float(_safe_get(existing, 'date_added', 0) or 0)
                    same_mtime = abs(previous_mtime - float(stat.st_mtime)) < 0.0001
                    if same_size and same_mtime:
                        ext_lower = ext.lower()
                        if ext_lower in ['mp4', 'webm', 'mkv']:
                            # v4.92: Re-escanear si faltan columnas de metadata técnica
                            if not _safe_get(existing, 'video_resolution'):
                                # Necesita metadata nueva → NO hacer skip, caer al procesamiento
                                pass
                            else:
                                # Ya tiene metadata completa → saltar
                                unchanged_count += 1
                                continue
                        else:
                            # No es video → saltar
                            unchanged_count += 1
                            continue
                
                meta = obtener_metadata_completa(path, f)
                
                # Restaurar el género modificado manualmente si existe y el actual es malo
                if rel_path in existing_genres:
                    if meta.get('genre') in ['Otros', 'Unknown', '', 'Generos']:
                        meta['genre'] = existing_genres[rel_path]
                
                tipo_archivo = 'video' if ext in ['mp4', 'webm', 'mkv'] else 'audio'

                # Extraer TMDB ID de la ruta y detectar tipo
                tmdb_id = extract_tmdb_id_from_path(rel_path)
                folder_type = detect_folder_type(rel_path) if tipo_archivo == 'video' else None

                # ═══ Extraer metadata técnica de video (v4.92) ═══
                # Solo para videos nuevos o modificados
                video_meta = None
                if tipo_archivo == 'video':
                    video_meta = extract_video_metadata(path)

                # Limpiar título - quitar TMDB ID, deixar solo o nome limpo
                raw_title = meta['title'] or f
                # Primero quitar (tmdb-123) ou [tmdb-123] ou {tmdb-123}
                clean_title = re.sub(r'\s*[\(\[\{]?tmdb[-_]?\d+[\)\]\}]?', '', raw_title, flags=re.IGNORECASE).strip()
                # Quitar guiones extra al final
                clean_title = re.sub(r'[\s\-_]+$', '', clean_title).strip()
                # Si quedó vacío, usar el nombre del archivo
                if not clean_title:
                    clean_title = f
                final_title = clean_title
                
                # Detect language from folder name
                lang = detect_language_from_folder(folder_name)

                # Preparar valores de metadata de video (v4.92)
                if video_meta:
                    vm_resolution = video_meta.get('video_resolution')
                    vm_codec = video_meta.get('video_codec')
                    vm_audio_codec = video_meta.get('audio_codec')
                    vm_audio_channels = video_meta.get('audio_channels', 0)
                    vm_audio_tracks = video_meta.get('audio_tracks')
                    vm_subtitle_tracks = video_meta.get('subtitle_tracks')
                    vm_bit_rate = video_meta.get('bit_rate', 0)
                    vm_aspect_ratio = video_meta.get('aspect_ratio')
                    vm_frame_rate = video_meta.get('frame_rate', 0.0)
                    vm_file_format = video_meta.get('file_format')
                else:
                    vm_resolution = None
                    vm_codec = None
                    vm_audio_codec = None
                    vm_audio_channels = 0
                    vm_audio_tracks = None
                    vm_subtitle_tracks = None
                    vm_bit_rate = 0
                    vm_aspect_ratio = None
                    vm_frame_rate = 0.0
                    vm_file_format = None

                c.execute('''
                INSERT INTO media (
                    rel_path, filename, folder, full_folder, media_type,
                    title, artist, album, genre, duration_sec, size_bytes, date_added, language,
                    tmdb_id, folder_type,
                    video_resolution, video_codec, audio_codec, audio_channels,
                    audio_tracks, subtitle_tracks, bit_rate, aspect_ratio,
                    frame_rate, file_format
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(rel_path) DO UPDATE SET
                filename=excluded.filename, folder=excluded.folder,
                full_folder=excluded.full_folder, media_type=excluded.media_type,
                title=excluded.title, artist=excluded.artist,
                album=excluded.album, genre=excluded.genre,
                duration_sec=excluded.duration_sec, size_bytes=excluded.size_bytes,
                language=excluded.language,
                tmdb_id=excluded.tmdb_id, folder_type=excluded.folder_type,
                video_resolution=excluded.video_resolution, video_codec=excluded.video_codec,
                audio_codec=excluded.audio_codec, audio_channels=excluded.audio_channels,
                audio_tracks=excluded.audio_tracks, subtitle_tracks=excluded.subtitle_tracks,
                bit_rate=excluded.bit_rate, aspect_ratio=excluded.aspect_ratio,
                frame_rate=excluded.frame_rate, file_format=excluded.file_format
                ''', (
                    rel_path, f, serie_name, folder_name, tipo_archivo,
                    final_title, meta['artist'], meta['album'], meta['genre'],
                    video_meta.get('duration_sec', 0) if video_meta else meta['duration'],
                    stat.st_size, stat.st_mtime, lang,
                    tmdb_id, folder_type,
                    vm_resolution, vm_codec, vm_audio_codec, vm_audio_channels,
                    vm_audio_tracks, vm_subtitle_tracks, vm_bit_rate, vm_aspect_ratio,
                    vm_frame_rate, vm_file_format
                ))
                upserted_count += 1
                batch_count += 1
                
                # Commit en lotes para mejor rendimiento
                if batch_count >= batch_size:
                    conn.commit()
                    batch_count = 0
                    
            except Exception as e:
                print("Error indexando archivo:", rel_path, e)
    
    # Commit final de lotes pendientes
    if batch_count > 0:
        conn.commit()
    
    # Eliminar de la base de datos los archivos que ya no existen en disco
    state.RESCAN_STATUS["stage"] = "cleaning"
    state.RESCAN_STATUS["message"] = "Limpiando archivos inexistentes..."
    
    deleted_count = 0
    for dp in existing_rows.keys():
        if dp not in scanned_paths:
            c.execute("DELETE FROM media WHERE rel_path = ?", (dp,))
            deleted_count += 1
    
    conn.commit()
    conn.close()
    
    # Finalizar estado
    elapsed = time.time() - state.RESCAN_STATUS["start_time"]
    state.RESCAN_STATUS["active"] = False
    state.RESCAN_STATUS["stage"] = "done"
    state.RESCAN_STATUS["percent"] = 100
    state.RESCAN_STATUS["message"] = f"Escaneo completado en {elapsed:.1f}s"
    
    print(
        f"✅ Escaneo físico terminado. "
        f"{len(scanned_paths)} encontrados | "
        f"{upserted_count} actualizados | "
        f"{unchanged_count} sin cambios | "
        f"{deleted_count} eliminados."
    )
    return []


def recalcular_mixes(files):
    """Regenera los mixes inteligentes basados en la biblioteca actual."""
    audio_only = [f for f in files if f.get('type') == 'audio']
    
    if not audio_only:
        return []
    
    smart_mixes = []
    
    # Top 50 más escuchadas
    top = sorted([f for f in audio_only if f.get('play_count', 0) > 0], 
                 key=lambda x: x.get('play_count', 0), reverse=True)[:50]
    if top:
        smart_mixes.append({
            'id': 'smart_top50',
            'name': 'Top 50 Más Escuchadas',
            'icon': 'fa-fire',
            'color': 'text-orange-500',
            'files': [x['path'] for x in top],
            'cover': top[0]['path']
        })
    
    # Joyas olvidadas (rating >= 4, no escuchadas en 30 días)
    month_ago = time.time() - (30 * 86400)
    gems = [f for f in audio_only if f.get('rating', 0) >= 4 and f.get('last_played', 0) < month_ago]
    if gems:
        random.shuffle(gems)
        smart_mixes.append({
            'id': 'smart_gems',
            'name': 'Joyas Olvidadas',
            'icon': 'fa-gem',
            'color': 'text-purple-400',
            'files': [x['path'] for x in gems[:50]],
            'cover': gems[0]['path']
        })
    
    # Radar de novedades (última semana)
    week_ago = time.time() - (7 * 86400)
    new_f = sorted([f for f in audio_only if f['date'] > week_ago],
                   key=lambda x: x['date'], reverse=True)[:50]
    if new_f:
        smart_mixes.append({
            'id': 'smart_new',
            'name': 'Radar de Novedades',
            'icon': 'fa-rss',
            'color': 'text-emerald-400',
            'files': [x['path'] for x in new_f],
            'cover': new_f[0]['path']
        })
    
    # Radio Kraken (aleatorio)
    rnd = list(audio_only)
    random.shuffle(rnd)
    rnd = rnd[:50]
    
    smart_mixes.append({
        'id': 'smart_shuffle',
        'name': 'Radio Kraken',
        'icon': 'fa-broadcast-tower',
        'color': 'text-cyan-400',
        'files': [x['path'] for x in rnd],
        'cover': rnd[0]['path'] if rnd else ''
    })
    
    state.MIXES_CACHE = smart_mixes
    return smart_mixes

def generar_biblioteca_viva(owner_email='public'):
    """Fetches all indexed items from SQLite to serve to the client."""
    print("📚 Cargando biblioteca viva desde la base de datos SQLite...")
    conn = get_db()
    c = conn.cursor()
    
    # Obtenemos TODOS los archivos y sus estadísticas de SQLite
    c.execute('''
        SELECT id, rel_path, filename, folder, full_folder, media_type,
               title, artist, album, genre, duration_sec, size_bytes, date_added,
               rating, play_count, last_played, language, folder_type, tmdb_id,
               tmdb_title, tmdb_year, tmdb_genres, tmdb_poster, tmdb_rating, is_adult
        FROM media
        ORDER BY folder, title
    ''')
    rows = c.fetchall()
    
    # Obtenemos playlist information map: { rel_path: [pl_name1, pl_name2] }
    c.execute('''
        SELECT p.name AS playlist_name, pi.rel_path
        FROM playlists p
        LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
        WHERE p.owner_email = ?
        ORDER BY p.name, pi.position
    ''', (owner_email,))
    playlist_rows = c.fetchall()
    
    # Obtenemos la información raw de playlists para mandarla al cliente como formato clásico json
    playlists_dict = {}

    conn.close()
    
    playlist_map = {}
    for r in playlist_rows:
        playlist_name = r['playlist_name']
        rel_path = r['rel_path']

        if playlist_name not in playlists_dict:
            playlists_dict[playlist_name] = []

        if not rel_path:
            continue

        playlists_dict[playlist_name].append(rel_path)
        if rel_path not in playlist_map:
            playlist_map[rel_path] = []
        playlist_map[rel_path].append(playlist_name)

    artist_tree = {}
    genre_set = set()
    folders = set()
    total_size = 0
    final_files = []

    for row in rows:
        # Reconstruir el diccionario que el cliente espera
        f = {
            'id': row['id'],
            'path': row['rel_path'],
            'filename': row['filename'],
            'folder': row['folder'],
            'full_folder': row['full_folder'],
            'type': row['media_type'],
            'title': row['title'],
            'artist': row['artist'],
            'album': row['album'],
            'genre': row['tmdb_genres'] if row['media_type'] == 'video' and row['tmdb_genres'] else row['genre'],
            'duration_sec': row['duration_sec'],
            'size_bytes': row['size_bytes'],
            'date': row['date_added'],
            'rating': row['rating'],
            'play_count': row['play_count'],
            'last_played': row['last_played'],
            'language': row['language'],
            'folder_type': row['folder_type'],
        'tmdb_id': row['tmdb_id'],
        'tmdb_title': row['tmdb_title'],
        'tmdb_year': row['tmdb_year'],
        'tmdb_genres': row['tmdb_genres'],
        'tmdb_poster': row['tmdb_poster'],
        'tmdb_rating': row['tmdb_rating'],
        'is_adult': row['is_adult']
    }
        
        rel_path = f['path']
        f['playlists'] = playlist_map.get(rel_path, [])
        f['size'] = f"{f['size_bytes']/(1024*1024):.1f} MB"
        f['duration'] = utils.format_duration(f['duration_sec'])
        
        if f['type'] == 'audio':
            art = f['artist']; alb = f['album'] or "Sencillos"
            if art not in artist_tree: artist_tree[art] = set()
            artist_tree[art].add(alb)
            
            # Crear campo separado para mixes (con idioma) sin tocar el género visible
            LANG_LABELS = {
                'es': 'Español', 'pt': 'Español', 'it': 'Español',
                'en': 'Inglés',
                'world': 'World',
                'ja': 'Japonés', 'ko': 'Coreano',
                'fr': 'Francés', 'de': 'Alemán'
            }
            lang_label = LANG_LABELS.get(f['language'])
            
            if f['genre'] and f['genre'] not in ['Otros', 'Unknown', ''] and lang_label:
                f['genre_lang'] = f"{f['genre']} ({lang_label})"
            else:
                f['genre_lang'] = f['genre']
            
        if f['genre']: genre_set.add(f['genre'])
        if f['full_folder'] != '.': folders.add(f['full_folder'])
        total_size += f['size_bytes']
        final_files.append(f)

    # El ordenamiento ya se hace por base de datos, pero aseguramos la estructura
    final_artist_tree = {k: sorted(list(v)) for k, v in artist_tree.items()}

    if not state.MIXES_CACHE:
        recalcular_mixes(final_files)
        
    return {
        "files": final_files, 
        "folders": sorted(list(folders)), 
        "artist_tree": final_artist_tree, 
        "genres": sorted(list(genre_set)), 
        "playlists": playlists_dict, 
        "smart_mixes": state.MIXES_CACHE,
        "total_size": f"{total_size/(1024*1024*1024):.2f} GB"
    }

def clean_playlists():
    # Playlists are now cleaned dynamically as part of the SQLite constraints,
    # or not strictly cleaned but normalized. This is effectively done in `init_db` now.
    pass

def init_db():
    for folder in [config.DOWNLOAD_FOLDER, config.THUMBNAILS_FOLDER, config.TEMP_FOLDER]:
        if not os.path.exists(folder):
            os.makedirs(folder)
            
    for f in [config.HISTORY_FILE, config.RATINGS_FILE, config.PLAYLISTS_FILE, config.STATS_FILE]:
        if not os.path.exists(f):
            with open(f, 'w', encoding='utf-8') as outfile: json.dump({}, outfile)
    clean_playlists()
