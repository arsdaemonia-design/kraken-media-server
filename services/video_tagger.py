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
        'append_to_response': 'credits,release_dates,keywords,translations'
    }

    try:
        response = requests.get(f"{TMDB_BASE_URL}/movie/{movie_id}", params=params, timeout=10)
        result = response.json()

        # Si el título o nombre de colección viene en alfabeto no latino (coreano, tailandés, japonés), pedir fallback en-US
        title_es = (result.get('title') or '').strip()
        coll_es = ((result.get('belongs_to_collection') or {}).get('name') or '').strip()
        if (title_es and not re.search(r'[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]', title_es)) or (coll_es and not re.search(r'[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]', coll_es)):
            try:
                en_resp = requests.get(f"{TMDB_BASE_URL}/movie/{movie_id}", params={'api_key': TMDB_API_KEY, 'language': 'en-US'}, timeout=8)
                if en_resp.ok:
                    en_data = en_resp.json()
                    if title_es and not re.search(r'[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]', title_es) and en_data.get('title'):
                        result['title'] = en_data['title']
                    en_coll = (en_data.get('belongs_to_collection') or {}).get('name')
                    if coll_es and not re.search(r'[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]', coll_es) and en_coll and isinstance(result.get('belongs_to_collection'), dict):
                        result['belongs_to_collection']['name'] = en_coll
            except Exception:
                pass
        
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
        'append_to_response': 'credits,content_ratings,keywords,translations'
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


def extract_extended_tmdb_fields(details: dict, media_type: str = 'movie') -> dict:
    """Extrae colección, directores, reparto principal, estudio, keywords, score y país de un payload TMDB."""
    if not details or not isinstance(details, dict):
        return {}

    # 1. Colección / Saga (solo películas)
    coll = details.get('belongs_to_collection') or {}
    collection_id = coll.get('id') if isinstance(coll, dict) else None
    collection_name = (coll.get('name') or '').strip() if isinstance(coll, dict) else None
    if collection_name:
        # Limpiar sufijos redundantes como " - Colección", " Collection" o " シリーズ"
        collection_name = re.sub(r'\s*[-–—]?\s*Colecci[oó]n$', '', collection_name, flags=re.IGNORECASE).strip()
        collection_name = re.sub(r'\s+Collection$', '', collection_name, flags=re.IGNORECASE).strip()
        collection_name = re.sub(r'\s*シリーズ$', '', collection_name).strip()
    collection_poster = coll.get('poster_path') if isinstance(coll, dict) else None

    # 2. Directores / Creadores
    credits = details.get('credits') or {}
    crew = credits.get('crew') or []
    directors = [c.get('name', '').strip() for c in crew if c.get('job') in ('Director', 'Series Director') and c.get('name')]
    if media_type == 'tv' or not directors:
        creators = [c.get('name', '').strip() for c in (details.get('created_by') or []) if c.get('name')]
        directors = list(dict.fromkeys(directors + creators))
    directors_str = ', '.join(directors[:3]) if directors else None

    # 3. Actores principales (Top 8)
    cast_raw = credits.get('cast') or []
    cast_names = [c.get('name', '').strip() for c in cast_raw[:8] if c.get('name')]
    cast_str = ', '.join(cast_names) if cast_names else None

    # 4. Estudio / Productora / Cadena (Top 2)
    studios = []
    if media_type == 'tv':
        studios = [n.get('name', '').strip() for n in (details.get('networks') or []) if n.get('name')]
    if not studios:
        studios = [p.get('name', '').strip() for p in (details.get('production_companies') or []) if p.get('name')]
    studio_str = ', '.join(studios[:2]) if studios else None

    # 5. Keywords / Sub-temáticas
    kw_obj = details.get('keywords') or {}
    kw_list = kw_obj.get('keywords') or kw_obj.get('results') or []
    keywords = [k.get('name', '').strip() for k in kw_list[:15] if isinstance(k, dict) and k.get('name')]
    keywords_str = ', '.join(keywords) if keywords else None

    # 6. Calificación y País/Idioma
    vote_avg = round(float(details.get('vote_average') or 0.0), 1)
    countries = details.get('origin_country') or [
        c.get('iso_3166_1') for c in (details.get('production_countries') or []) if c.get('iso_3166_1')
    ]
    country_str = ','.join([str(c) for c in countries[:2] if c]) or (details.get('original_language') or '').upper()
    backdrop_path = details.get('backdrop_path')

    # 7. Títulos (Original, Inglés, Alternativos) y Tagline
    title_original = (details.get('original_title') or details.get('original_name') or '').strip() or None
    title_es = (details.get('title') or details.get('name') or '').strip()
    orig_lang = (details.get('original_language') or '').strip().lower()
    tagline = (details.get('tagline') or '').strip() or None

    title_en = title_original if orig_lang == 'en' else None
    es_variants = []
    translations = (details.get('translations') or {}).get('translations') or []
    for tr in translations:
        if not isinstance(tr, dict):
            continue
        iso639 = (tr.get('iso_639_1') or '').lower()
        iso3166 = (tr.get('iso_3166_1') or '').upper()
        tr_data = tr.get('data') or {}
        tr_title = (tr_data.get('title') or tr_data.get('name') or '').strip()
        if not tr_title:
            continue
        if iso639 == 'en':
            if not title_en or iso3166 == 'US':
                title_en = tr_title
        elif iso639 == 'es' and iso3166 in ('MX', 'ES', ''):
            es_variants.append(tr_title)

    alt_candidates = []
    seen_alt = set()
    for cand in [title_es, title_original, title_en, *es_variants]:
        if cand and cand.lower() not in seen_alt:
            seen_alt.add(cand.lower())
            alt_candidates.append(cand)
    alt_titles_str = ' | '.join(alt_candidates) if alt_candidates else None

    return {
        'tmdb_collection_id': collection_id,
        'tmdb_collection_name': collection_name or None,
        'tmdb_collection_poster': collection_poster,
        'tmdb_director': directors_str,
        'tmdb_cast': cast_str,
        'tmdb_studio': studio_str,
        'tmdb_keywords': keywords_str,
        'tmdb_vote_average': vote_avg,
        'tmdb_country': country_str or None,
        'tmdb_backdrop': backdrop_path,
        'tmdb_title_original': title_original,
        'tmdb_title_en': title_en,
        'tmdb_alt_titles': alt_titles_str,
        'tmdb_tagline': tagline,
    }


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
    Detecta si la ruta corresponde a una serie.
    Usa límites de palabra para evitar falsos positivos como 'templo' con 'temp'.
    """
    path_str = str(file_path).replace('\\', '/')
    if re.search(r'(?:^|/)((?:temporadas?|seasons?|temp)\b[\s._-]*\d*|s\d{1,2})(?:/|$)', path_str, re.IGNORECASE):
        return True
    if re.search(r'\b(?:temporada|season)\s*\d*\b', path_str, re.IGNORECASE):
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


# ============================================================
# EXTRACCIÓN DE SUBTÍTULOS EMBEBIDOS (integración subti.py)
# ============================================================

TEXT_SUBTITLE_CODECS = {'subrip', 'srt', 'ass', 'ssa', 'webvtt', 'mov_text', 'text'}


def _clean_sub_lang(val: str) -> str:
    val = (val or "").strip() or "unknown"
    return re.sub(r'[\\/:*?"<>|.\s]+', "_", val)


def extract_embedded_subtitles_for_video(full_video_path: str) -> int:
    """
    Inspecciona las pistas de subtítulos de texto embebidas en `full_video_path`
    y extrae en una sola pasada de FFmpeg los archivos `{stem}.{lang}.{stream_index}.srt`
    que aún no existan en disco.
    Retorna la cantidad de archivos .srt nuevos creados.
    """
    import subprocess
    import json
    import config

    if not full_video_path or not os.path.isfile(full_video_path):
        return 0

    ffprobe_bin = getattr(config, 'FFPROBE_PATH', 'ffprobe') or 'ffprobe'
    ffmpeg_bin = getattr(config, 'FFMPEG_PATH', 'ffmpeg') or 'ffmpeg'
    kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}

    probe_cmd = [
        ffprobe_bin, "-v", "error",
        "-select_streams", "s",
        "-show_entries", "stream=index,codec_name:stream_tags=language",
        "-of", "json",
        full_video_path
    ]
    try:
        res = subprocess.run(probe_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=20, **kwargs)
        data = json.loads(res.stdout or "{}")
    except Exception as e:
        print(f"[Subti] Error ffprobe en {os.path.basename(full_video_path)}: {e}")
        return 0

    streams = data.get("streams") or []
    if not streams:
        return 0

    video_dir = os.path.dirname(full_video_path)
    video_stem = os.path.splitext(os.path.basename(full_video_path))[0]

    missing_targets = []
    for s in streams:
        codec = (s.get("codec_name") or "").lower()
        if codec not in TEXT_SUBTITLE_CODECS:
            continue
        idx = s.get("index")
        if idx is None:
            continue
        tags = s.get("tags") or {}
        lang = _clean_sub_lang(tags.get("language") or "unknown")
        out_srt = os.path.join(video_dir, f"{video_stem}.{lang}.{idx}.srt")
        if os.path.isfile(out_srt) and os.path.getsize(out_srt) > 0:
            continue
        missing_targets.append((idx, lang, out_srt))

    if not missing_targets:
        return 0

    # Extraer todas las pistas faltantes en una sola pasada de FFmpeg
    cmd = [ffmpeg_bin, "-y", "-hide_banner", "-loglevel", "error", "-i", full_video_path]
    for idx, _lang, out_srt in missing_targets:
        cmd += ["-map", f"0:{idx}", "-c:s", "srt", out_srt]

    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=180, **kwargs)
    except Exception as e:
        print(f"[Subti] Error extrayendo subtítulos en {os.path.basename(full_video_path)}: {e}")

    created = 0
    for idx, lang, out_srt in missing_targets:
        if os.path.isfile(out_srt):
            if os.path.getsize(out_srt) > 0:
                created += 1
            else:
                try:
                    os.remove(out_srt)
                except OSError:
                    pass
    if created > 0:
        print(f"[Subti] Extraídos {created} subtítulos .srt para {os.path.basename(full_video_path)}")
    return created


_ENRICH_LOCK = False

def enrich_extended_tmdb_metadata_async():
    """
    Enriquece en segundo plano los videos que ya tienen tmdb_id en SQLite
    pero aún no tienen tmdb_director, tmdb_cast, tmdb_collection_name o tmdb_vote_average.
    Agrupa por (tmdb_id, folder_type) para hacer solo 1 petición por serie/película.
    """
    global _ENRICH_LOCK
    if _ENRICH_LOCK:
        return
    _ENRICH_LOCK = True
    try:
        import time
        import config
        from services.database import get_db
        conn = get_db()
        c = conn.cursor()
        c.execute('''
            SELECT DISTINCT tmdb_id, folder_type
            FROM media
            WHERE media_type = 'video'
              AND tmdb_id IS NOT NULL AND tmdb_id > 0
              AND (tmdb_director IS NULL OR tmdb_director = ''
                   OR tmdb_cast IS NULL OR tmdb_cast = ''
                   OR tmdb_vote_average IS NULL OR tmdb_vote_average = 0
                   OR tmdb_alt_titles IS NULL OR tmdb_alt_titles = '')
        ''')
        rows = c.fetchall()
        conn.close()
        if not rows:
            return

        print(f"[TMDB v5.0.2] Enriqueciendo {len(rows)} títulos únicos en segundo plano (Sagas, Directores, Reparto)...")
        updated_groups = 0
        for idx, row in enumerate(rows, 1):
            tmdb_id_val = row[0]
            f_type = row[1] or 'movie'
            try:
                time.sleep(0.15)
                details = get_tv_details(tmdb_id_val) if f_type in ('series', 'anime', 'tv') else get_movie_details(tmdb_id_val)
                if not details:
                    continue
                ext = extract_extended_tmdb_fields(details, 'tv' if f_type in ('series', 'anime', 'tv') else 'movie')
                coll_poster = None
                if ext.get('tmdb_collection_poster') and ext.get('tmdb_collection_id'):
                    coll_file = f"collection_{ext['tmdb_collection_id']}.jpg"
                    if not os.path.exists(os.path.join(config.THUMBNAILS_FOLDER, coll_file)):
                        download_poster(ext['tmdb_collection_poster'], config.THUMBNAILS_FOLDER, f"collection_{ext['tmdb_collection_id']}")
                    coll_poster = coll_file

                wconn = get_db()
                wconn.execute('''
                    UPDATE media SET
                        tmdb_collection_id = COALESCE(?, tmdb_collection_id),
                        tmdb_collection_name = COALESCE(?, tmdb_collection_name),
                        tmdb_collection_poster = COALESCE(?, tmdb_collection_poster),
                        tmdb_director = COALESCE(?, tmdb_director),
                        tmdb_cast = COALESCE(?, tmdb_cast),
                        tmdb_studio = COALESCE(?, tmdb_studio),
                        tmdb_keywords = COALESCE(?, tmdb_keywords),
                        tmdb_vote_average = COALESCE(?, tmdb_vote_average),
                        tmdb_country = COALESCE(?, tmdb_country),
                        tmdb_backdrop = COALESCE(?, tmdb_backdrop),
                        tmdb_title_original = COALESCE(?, tmdb_title_original),
                        tmdb_title_en = COALESCE(?, tmdb_title_en),
                        tmdb_alt_titles = COALESCE(?, tmdb_alt_titles),
                        tmdb_tagline = COALESCE(?, tmdb_tagline)
                    WHERE tmdb_id = ? AND media_type = 'video'
                ''', (
                    ext.get('tmdb_collection_id'),
                    ext.get('tmdb_collection_name'),
                    coll_poster or ext.get('tmdb_collection_poster'),
                    ext.get('tmdb_director'),
                    ext.get('tmdb_cast'),
                    ext.get('tmdb_studio'),
                    ext.get('tmdb_keywords'),
                    ext.get('tmdb_vote_average'),
                    ext.get('tmdb_country'),
                    ext.get('tmdb_backdrop'),
                    ext.get('tmdb_title_original'),
                    ext.get('tmdb_title_en'),
                    ext.get('tmdb_alt_titles'),
                    ext.get('tmdb_tagline'),
                    tmdb_id_val
                ))
                wconn.commit()
                wconn.close()
                updated_groups += 1
                if updated_groups % 15 == 0:
                    try:
                        from routes.api import BIB_CACHE_BY_OWNER
                        BIB_CACHE_BY_OWNER.clear()
                    except Exception:
                        pass
            except Exception as e:
                print(f"[TMDB v5.0.2] Error enriqueciendo tmdb_id={tmdb_id_val}: {e}")

        try:
            from routes.api import BIB_CACHE_BY_OWNER
            BIB_CACHE_BY_OWNER.clear()
        except Exception:
            pass
        print(f"✅ [TMDB v5.0.2] Enriquecimiento completado: {updated_groups}/{len(rows)} títulos actualizados.")
    except Exception as e:
        print(f"[TMDB v5.0.2] Error general en enrich_extended_tmdb_metadata_async: {e}")
    finally:
        _ENRICH_LOCK = False
