"""
Auto-tagger para videos usando TMDB API
Busca metadata de películas, series y anime automáticamente
Inspirado en Plex/Radarr/Sonarr
"""

import requests
import os
import re
from pathlib import Path

TMDB_API_KEY = "e0e4b911fdae8ee5cd6b64446f416da4"
TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"

# Cache simple para evitar consultas repetidas
_TMDB_CACHE = {}


def search_movie(title, year=None):
    """Busca una película en TMDB"""
    params = {
        'api_key': TMDB_API_KEY,
        'query': title,
        'language': 'es-MX'
    }
    if year:
        params['year'] = year
    
    try:
        response = requests.get(f"{TMDB_BASE_URL}/search/movie", params=params, timeout=10)
        data = response.json()
        if data.get('results') and len(data['results']) > 0:
            return data['results'][0]
    except Exception as e:
        print(f"Error buscando película: {e}")
    return None


def search_tv_show(title, year=None):
    """Busca una serie de TV en TMDB"""
    params = {
        'api_key': TMDB_API_KEY,
        'query': title,
        'language': 'es-MX'
    }
    if year:
        params['first_air_date_year'] = year
    
    try:
        response = requests.get(f"{TMDB_BASE_URL}/search/tv", params=params, timeout=10)
        data = response.json()
        if data.get('results') and len(data['results']) > 0:
            return data['results'][0]
    except Exception as e:
        print(f"Error buscando serie: {e}")
    return None


def get_movie_details(movie_id):
    """Obtiene detalles completos de una película incluyendo rating"""
    cache_key = f"movie_{movie_id}"
    if cache_key in _TMDB_CACHE:
        return _TMDB_CACHE[cache_key]

    params = {
        'api_key': TMDB_API_KEY,
        'language': 'es-MX',
        'append_to_response': 'credits,release_dates'
    }

    try:
        response = requests.get(f"{TMDB_BASE_URL}/movie/{movie_id}", params=params, timeout=10)
        result = response.json()
        
        # Extraer rating de certificación
        rating = extract_movie_rating(result)
        result['content_rating'] = rating
        
        _TMDB_CACHE[cache_key] = result
        return result
    except Exception as e:
        print(f"Error obteniendo detalles: {e}")
        return None


def get_tv_details(tv_id):
    """Obtiene detalles completos de una serie incluyendo rating"""
    cache_key = f"tv_{tv_id}"
    if cache_key in _TMDB_CACHE:
        return _TMDB_CACHE[cache_key]

    params = {
        'api_key': TMDB_API_KEY,
        'language': 'es-MX',
        'append_to_response': 'credits,content_ratings'
    }

    try:
        response = requests.get(f"{TMDB_BASE_URL}/tv/{tv_id}", params=params, timeout=10)
        result = response.json()
        
        # Extraer rating de certificación
        rating = extract_tv_rating(result)
        result['content_rating'] = rating
        
        _TMDB_CACHE[cache_key] = result
        return result
    except Exception as e:
        print(f"Error obteniendo detalles: {e}")
        return None


def extract_movie_rating(tmdb_data):
    """Extrae el rating de certificación de película (MX > US > otros)"""
    release_dates = tmdb_data.get('release_dates', {}).get('results', [])
    
    # Buscar certificación MX primero, luego US, luego cualquiera
    for country in ['MX', 'US']:
        for entry in release_dates:
            if entry.get('iso_3166_1') == country:
                for release in entry.get('release_dates', []):
                    cert = release.get('certification')
                    if cert:
                        return normalize_rating(cert)
    
    # Si no encontramos, buscar cualquier certificación
    for entry in release_dates:
        for release in entry.get('release_dates', []):
            cert = release.get('certification')
            if cert:
                return normalize_rating(cert)
    
    return None


def extract_tv_rating(tmdb_data):
    """Extrae el rating de certificación de serie (MX > US > otros)"""
    content_ratings = tmdb_data.get('content_ratings', {}).get('results', [])
    
    # Buscar rating MX primero, luego US, luego cualquiera
    for country in ['MX', 'US']:
        for entry in content_ratings:
            if entry.get('iso_3166_1') == country:
                rating = entry.get('rating')
                if rating:
                    return normalize_rating(rating)
    
    # Si no encontramos, buscar cualquier rating
    for entry in content_ratings:
        rating = entry.get('rating')
        if rating:
            return normalize_rating(rating)
    
    return None


def normalize_rating(rating):
    """Normaliza el rating a formato estándar (G, PG, PG-13, R, NC-17)"""
    if not rating:
        return None
    
    rating = rating.strip().upper()
    
    # Mapeo de ratings MX (México)
    mx_map = {
        'AA': 'G',      # Aptas para todos
        'A': 'G',       # Aptas para todos
        'B': 'PG',      # Recomendadas para mayores de 12 años
        'B-15': 'PG-13', # Mayores de 15 años
        'C': 'R',       # Mayores de 18 años
        'D': 'NC-17',   # Contenido para adultos
    }
    
    # Mapeo de ratings US
    us_map = {
        'G': 'G',
        'PG': 'PG',
        'PG-13': 'PG-13',
        'R': 'R',
        'NC-17': 'NC-17',
        'TV-Y': 'G',
        'TV-Y7': 'PG',
        'TV-G': 'G',
        'TV-PG': 'PG',
        'TV-14': 'PG-13',
        'TV-MA': 'R',
    }
    
    # Intentar mapeo MX o US
    normalized = mx_map.get(rating) or us_map.get(rating)
    if normalized:
        return normalized
    
    # Si no hay mapeo, devolver el rating original
    return rating


def download_poster(poster_path, thumbnails_folder, filename_base):
    """Descarga el poster y guarda localmente"""
    if not poster_path:
        return None
    
    try:
        poster_url = f"{TMDB_IMAGE_BASE}{poster_path}"
        response = requests.get(poster_url, timeout=15)
        if response.status_code == 200:
            safe_name = re.sub(r'[^\w\s-]', '', filename_base).strip()
            poster_filename = f"{safe_name}.jpg"
            poster_path_local = os.path.join(thumbnails_folder, poster_filename)
            
            with open(poster_path_local, 'wb') as f:
                f.write(response.content)
            
            print(f"✅ Poster descargado: {poster_filename}")
            return poster_filename
    except Exception as e:
        print(f"❌ Error descargando poster: {e}")
    return None


# ============================================================
# FUNCIONES DE EXTRACCIÓN (NUEVAS)
# ============================================================

def extract_tmdb_id_from_path(file_path):
    """
    Busca TMDB ID en CUALQUIER parte de la ruta
    Soporta: (tmdb-123), {tmdb-123}, [tmdb=123], tmdb-123
    """
    path_str = str(file_path).replace('\\', '/')
    
    # Patrones a buscar en orden de prioridad
    patterns = [
        r'\(tmdb[-=_]?(\d+)\)',      # (tmdb-12345) o (tmdb=12345)
        r'\{tmdb[-=_]?(\d+)\}',      # {tmdb-12345}
        r'\[tmdb[-=_]?(\d+)\]',      # [tmdb=12345]
        r'(?i)tmdb[-=_](\d+)',       # tmdb-12345
    ]
    
    for pattern in patterns:
        match = re.search(pattern, path_str)
        if match:
            return match.group(1)
    
    return None


def extract_year_from_path(file_path):
    """
    Extrae el año de la ruta (carpeta o nombre de archivo)
    Busca: (2010) o simplemente 2010
    """
    path_str = str(file_path)
    
    # Buscar año en paréntesis: (2010)
    match = re.search(r'\((\d{4})\)', path_str)
    if match:
        return int(match.group(1))
    
    # Buscar año libre: 2010
    match = re.search(r'\b(19\d{2}|20\d{2})\b', path_str)
    if match:
        return int(match.group(1))
    
    return None


def is_series_pattern(file_path):
    """
    Detecta si la ruta corresponde a una serie
    Busca: Temporada, Season en la ruta
    """
    path_lower = str(file_path).lower()
    
    series_keywords = ['temporada', 'season', 'temp']
    
    for keyword in series_keywords:
        if keyword in path_lower:
            return True
    
    return False


def is_series_episode(filename):
    """
    Detecta si el nombre del archivo es un episodio
    Patrones: S01E01, 1x01, Episodio 1, Capítulo 1
    """
    filename_only = os.path.splitext(filename)[0]
    
    episode_patterns = [
        r'S\d{1,2}E\d{1,2}',        # S01E01, S1E1
        r'\d{1,2}x\d{1,2}',         # 1x01, 02x03
        r'episodio\s*\d+',           # Episodio 1
        r'cap[ií]tulo\s*\d+',       # Capítulo 1
        r'episode\s*\d+',            # Episode 1
    ]
    
    for pattern in episode_patterns:
        if re.search(pattern, filename_only, re.IGNORECASE):
            return True
    
    return False


def extract_series_name_from_path(file_path):
    """
    Extrae el nombre de la serie desde la estructura de carpetas
    Ignora: Video, Series, Anime, Peliculas, Season, Temporada
    """
    parts = Path(file_path).parts
    
    # Palabras a ignorar (categorías base)
    skip_words = {'video', 'series', 'anime', 'peliculas', 'movies', 'tv', 'documentales'}
    
    # Palabras que indican temporada (para ignorar)
    season_words = {'temporada', 'season', 'temp', 's0', 't0'}
    
    for part in parts:
        part_lower = part.lower()
        
        # Ignorar categorías base
        if part_lower in skip_words:
            continue
        
        # Ignorar carpetas de temporada
        if any(k in part_lower for k in season_words):
            continue
        
        # Ignorar si es solo un número de carpeta (1, 2, 3...)
        if re.match(r'^\d+$', part):
            continue
            
        # Limpiar TMDB ID del nombre
        clean_name = re.sub(r'\{[^}]*\}', '', part)
        clean_name = re.sub(r'\[[^\]]*\]', '', clean_name)
        clean_name = re.sub(r'\([^)]*\)', '', clean_name)  # También quitar paréntesis con año
        clean_name = clean_name.strip()
        
        if clean_name and len(clean_name) > 1:
            return clean_name
    
    return None


def get_series_folder_name(file_path):
    """
    Retorna el nombre EXACTO de la carpeta padre de la serie (con TMDB ID incluido).
    Ej: 'Dragon Ball (tmdb-12609)' → 'Dragon Ball (tmdb-12609)'
    """
    parts = Path(file_path).parts
    
    skip_words = {'video', 'series', 'anime', 'peliculas', 'movies', 'tv', 'documentales'}
    season_words = {'temporada', 'season', 'temp', 's0', 't0'}
    
    for part in parts:
        part_lower = part.lower()
        
        if part_lower in skip_words:
            continue
        
        if any(k in part_lower for k in season_words):
            continue
        
        if re.match(r'^\d+$', part):
            continue
        
        # Retornar nombre EXACTO de la carpeta (sin limpiar)
        if len(part) > 1:
            return part
    
    return None


def clean_title_for_search(title):
    """
    Limpia el título para búsqueda en TMDB
    Conserve el nombre limpio sin tags de calidad
    """
    # Obtener solo el nombre sin extensión
    title = os.path.splitext(title)[0]
    
    # Reemplazar puntos y guiones bajos por espacios
    title = title.replace('.', ' ').replace('_', ' ')
    
    # Quitar tags de calidad y otros unwanted
    trash = [
        '1080p', '720p', '480p', '4k', '2160p',
        'h264', 'h265', 'x264', 'x265', 'hevc',
        'bluray', 'webdl', 'web-dl', 'brrip', 'bdrip',
        'dual', 'latino', 'castellano', 'subtitulado',
        'remastered', 'dvdrip', 'hdrip', 'dvd', 'tv'
    ]
    
    for t in trash:
        title = re.sub(rf'(?i)\b{t}\b', '', title)
    
    # Quitar patrones de episodio del final
    title = re.sub(r'(?i)(s\d{1,2}e\d{1,2}|temporada\s*\d+|episode\s*\d+|ep\.?\s*\d+).*$', '', title)
    
    # Limpiar espacios múltiples
    title = re.sub(r'[\-\s]+', ' ', title).strip()
    
    return title


def detect_video_type(file_path):
    """
    Detecta si es película o serie basado en la estructura de carpetas
   Serie: Si la ruta contiene "Temporada" o "Season"
    Movie: Todo lo demás
    """
    if is_series_pattern(file_path):
        return 'series'
    
    return 'movie'


# ============================================================
# FUNCIÓN PRINCIPAL (REESCRITA)
# ============================================================

def auto_tag_video(file_path, video_type=None):
    """
    Auto-tagging folder-based (como Plex/Radarr)
    
    Flujo:
    1. Extraer TMDB ID de la ruta completa
    2. Detectar tipo (movie vs series) por estructura
    3. Si hay ID → consulta directa
    4. Si no hay ID → buscar por nombre
    
    Args:
        file_path: Ruta completa del archivo
        video_type: Forzar tipo ('movie', 'series', 'anime')
    
    Returns:
        dict con metadata o None
    """
    filename = os.path.basename(file_path)
    
    # 1. Extraer TMDB ID de la RUTA COMPLETA
    tmdb_id = extract_tmdb_id_from_path(file_path)
    
    # 2. Detectar tipo por estructura de carpetas
    if video_type is None:
        video_type = detect_video_type(file_path)
    
    is_series = (video_type in ['series', 'anime'])
    
    # 3. Extraer año de la ruta (para películas)
    year = extract_year_from_path(file_path)
    
    # 4. Extraer nombre de serie (si es serie)
    series_name = extract_series_name_from_path(file_path) if is_series else None
    
    result = None
    
    # === PLAN A: ID Directo (precisión 100%) ===
    if tmdb_id:
        print(f"🎯 ID encontrado en ruta: {tmdb_id} (tipo: {video_type})")
        
        if is_series:
            result = get_tv_details(tmdb_id)
            if result:
                result['media_type'] = 'tv'
        else:
            result = get_movie_details(tmdb_id)
            if result:
                result['media_type'] = 'movie'
    
    # === PLAN B: Buscar por nombre ===
    if not result:
        if is_series and series_name:
            # Serie sin ID → buscar por nombre de serie
            print(f"🔍 Buscando serie: '{series_name}' (año: {year or 'N/A'})")
            search_result = search_tv_show(series_name, year)
            if search_result:
                result = get_tv_details(search_result['id'])
                if result:
                    result['media_type'] = 'tv'
        else:
            # Película sin ID → buscar por nombre de archivo
            title = clean_title_for_search(filename)
            print(f"🔍 Buscando película: '{title}' (año: {year or 'N/A'})")
            search_result = search_movie(title, year)
            if search_result:
                result = get_movie_details(search_result['id'])
                if result:
                    result['media_type'] = 'movie'
    
    # === PLAN C: Fallback - episode sin ID ===
    if not result and is_series_episode(filename):
        title = clean_title_for_search(filename)
        print(f"🔍 Fallback episodio: '{title}'")
        search_result = search_tv_show(title) or search_movie(title)
        if search_result:
            if 'first_air_date' in search_result:
                result = get_tv_details(search_result['id'])
                if result:
                    result['media_type'] = 'tv'
            else:
                result = get_movie_details(search_result['id'])
                if result:
                    result['media_type'] = 'movie'
    
    # Resultado
    if result:
        print(f"✅ Éxito: {result.get('title') or result.get('name')}")
    else:
        print(f"❌ No encontrado en TMDB: {file_path}")
    
    return result


# ============================================================
# FUNCIÓN LEGACY (para compatibilidad)
# ============================================================

def extract_year_from_filename(filename):
    """Legacy: Extrae año del nombre del archivo"""
    match = re.search(r'\b(19\d{2}|20\d{2})\b', filename)
    if match:
        return int(match.group(1))
    return None


def extract_tmdb_id_from_filename(filename):
    """Legacy: Busca ID solo en el nombre del archivo"""
    match = re.search(r'(?i)tmdb[-=\s]*(\d+)', filename)
    if match:
        return match.group(1)
    return None
