import os
import json
import time
import random
from urllib.parse import unquote
import config
import state
import utils
from services.metadata import obtener_metadata_completa

from services.database import get_db, init_db as db_init_db

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

def escanear_archivos_fisicos():
    """PASO 1 (DELTA): Lee disco y solo reprocesa archivos nuevos/modificados."""
    print("📀 Iniciando escaneo físico de disco...")
    
    conn = get_db()
    c = conn.cursor()
    
    c.execute("SELECT rel_path, size_bytes, date_added, genre FROM media")
    existing_rows = {row['rel_path']: row for row in c.fetchall()}
    existing_genres = {
        rel_path: row['genre']
        for rel_path, row in existing_rows.items()
        if row['genre'] not in [None, '', 'Otros', 'Unknown']
    }

    scanned_paths = set()
    unchanged_count = 0
    upserted_count = 0
    
    for root, dirs, files in os.walk(config.DOWNLOAD_FOLDER):
        if 'thumbnails' in root: continue
        
        folder_name = os.path.relpath(root, config.DOWNLOAD_FOLDER)
        serie_name = "Raíz" if folder_name == '.' else get_smart_folder_name(root)

        for f in files:
            ext = f.split('.')[-1].lower()
            if ext not in ['mp3', 'm4a', 'wav', 'mp4', 'webm', 'mkv']: continue
            
            path = os.path.join(root, f)
            rel_path = os.path.relpath(path, config.DOWNLOAD_FOLDER).replace('\\', '/')
            scanned_paths.add(rel_path)
            
            try:
                stat = os.stat(path)
                existing = existing_rows.get(rel_path)

                # Delta skip: si tamaño y mtime no cambiaron, no reprocesar
                if existing:
                    same_size = int(existing['size_bytes'] or 0) == int(stat.st_size)
                    previous_mtime = float(existing['date_added'] or 0)
                    same_mtime = abs(previous_mtime - float(stat.st_mtime)) < 0.0001
                    if same_size and same_mtime:
                        unchanged_count += 1
                        continue

                meta = obtener_metadata_completa(path, f)
                
                # Restaurar el género modificado manualmente si existe y el actual es malo
                if rel_path in existing_genres:
                    if meta.get('genre') in ['Otros', 'Unknown', '', 'Generos']:
                        meta['genre'] = existing_genres[rel_path]
                        
                tipo_archivo = 'video' if ext in ['mp4', 'webm', 'mkv'] else 'audio'
                
                # Detect language from folder name
                lang = detect_language_from_folder(folder_name)
                
                c.execute('''
                    INSERT INTO media (
                        rel_path, filename, folder, full_folder, media_type,
                        title, artist, album, genre, duration_sec, size_bytes, date_added, language
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(rel_path) DO UPDATE SET
                        filename=excluded.filename, folder=excluded.folder, 
                        full_folder=excluded.full_folder, media_type=excluded.media_type,
                        title=excluded.title, artist=excluded.artist, 
                        album=excluded.album, genre=excluded.genre, 
                        duration_sec=excluded.duration_sec, size_bytes=excluded.size_bytes,
                        language=excluded.language
                ''', (
                    rel_path, f, serie_name, folder_name, tipo_archivo,
                    meta['title'], meta['artist'], meta['album'], meta['genre'],
                    meta['duration'], stat.st_size, stat.st_mtime, lang
                ))
                upserted_count += 1
            except Exception as e:
                print("Error indexando archivo:", rel_path, e)

    # Eliminar de la base de datos los archivos que ya no existen en disco
    deleted_count = 0
    for dp in existing_rows.keys():
        if dp not in scanned_paths:
            c.execute("DELETE FROM media WHERE rel_path = ?", (dp,))
            deleted_count += 1
            
    conn.commit()
    conn.close()
    
    print(
        f"✅ Escaneo físico terminado. "
        f"{len(scanned_paths)} encontrados | "
        f"{upserted_count} actualizados | "
        f"{unchanged_count} sin cambios | "
        f"{deleted_count} eliminados."
    )
    return [] # We no longer return the huge JSON array

def calcular_similitud(cancion_actual, cancion_candidata):
    """
    Calcula qué tan similar es una canción a otra.
    """
    score = 0
    if cancion_actual.get('artist') and cancion_candidata.get('artist'):
        if cancion_actual['artist'].lower() == cancion_candidata['artist'].lower():
            score += config.SIMILARITY_SCORE_SAME_ARTIST
    if cancion_actual.get('album') and cancion_candidata.get('album'):
        if cancion_actual['album'].lower() == cancion_candidata['album'].lower():
            score += config.SIMILARITY_SCORE_SAME_ALBUM
    if cancion_actual.get('genre') and cancion_candidata.get('genre'):
        if (cancion_actual['genre'].lower() == cancion_candidata['genre'].lower() 
            and cancion_actual['genre'].lower() not in ['otros', 'unknown', '']):
            score += config.SIMILARITY_SCORE_SIMILAR_GENRE
    rating_actual = cancion_actual.get('rating', 0)
    rating_candidata = cancion_candidata.get('rating', 0)
    if abs(rating_actual - rating_candidata) <= 1:
        score += config.SIMILARITY_SCORE_SIMILAR_RATING
    return score

def generar_radio_inteligente(cancion_referencia, biblioteca, limite=config.RADIO_LIMIT):
    if not cancion_referencia or not biblioteca:
        rnd = list(biblioteca)
        random.shuffle(rnd)
        return rnd[:limite]
    
    candidatas = []
    for cancion in biblioteca:
        if cancion.get('path') == cancion_referencia.get('path'):
            continue
        score = calcular_similitud(cancion_referencia, cancion)
        candidatas.append({
            'cancion': cancion,
            'score': score
        })
    
    candidatas.sort(key=lambda x: x['score'], reverse=True)
    
    resultado = []
    muy_similares = [c for c in candidatas if c['score'] >= 60]
    resultado.extend([c['cancion'] for c in muy_similares[:30]])
    
    medio_similares = [c for c in candidatas if 20 <= c['score'] < 60]
    if medio_similares:
        random.shuffle(medio_similares)
        resultado.extend([c['cancion'] for c in medio_similares[:10]])
    
    poco_similares = [c for c in candidatas if c['score'] < 20]
    if poco_similares:
        random.shuffle(poco_similares)
        resultado.extend([c['cancion'] for c in poco_similares[:10]])
    
    if len(resultado) < limite:
        resto = [c['cancion'] for c in candidatas if c['cancion'] not in resultado]
        random.shuffle(resto)
        resultado.extend(resto[:limite - len(resultado)])
    
    return resultado[:limite]

def recalcular_mixes(files_data):
    print("🍹 Preparando cócteles (Smart Mixes)...")
    
    smart_mixes = []
    audio_only = [f for f in files_data if f['type'] == 'audio']
    
    if not audio_only:
        state.MIXES_CACHE = []
        return []

    top = sorted([f for f in audio_only if f['play_count'] > 0], key=lambda x: x['play_count'], reverse=True)[:50]
    if top: 
        smart_mixes.append({'id':'smart_top50', 'name':'Top 50 Más Escuchadas', 'icon':'fa-fire', 'color':'text-orange-500', 'files':[x['path'] for x in top], 'cover':top[0]['path']})
    
    month_ago = time.time() - (30 * 86400)
    gems = [f for f in audio_only if f.get('rating', 0) >= 4 and f.get('last_played', 0) < month_ago]
    if gems:
        random.shuffle(gems)
        smart_mixes.append({'id': 'smart_gems', 'name': 'Joyas Olvidadas', 'icon': 'fa-gem', 'color': 'text-purple-400', 'files': [x['path'] for x in gems[:50]], 'cover': gems[0]['path']})

    week_ago = time.time() - (7 * 86400)
    new_f = sorted([f for f in audio_only if f['date'] > week_ago], key=lambda x: x['date'], reverse=True)
    if new_f: 
        smart_mixes.append({'id':'smart_new', 'name':'Radar de Novedades', 'icon':'fa-rss', 'color':'text-emerald-400', 'files':[x['path'] for x in new_f], 'cover':new_f[0]['path']})
    
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
               rating, play_count, last_played, language
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
            'path': row['rel_path'],
            'filename': row['filename'],
            'folder': row['folder'],
            'full_folder': row['full_folder'],
            'type': row['media_type'],
            'title': row['title'],
            'artist': row['artist'],
            'album': row['album'],
            'genre': row['genre'],
            'duration_sec': row['duration_sec'],
            'size_bytes': row['size_bytes'],
            'date': row['date_added'],
            'rating': row['rating'],
            'play_count': row['play_count'],
            'last_played': row['last_played'],
            'language': row['language']
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
