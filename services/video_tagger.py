"""
Auto-tagger para videos usando TMDB API
Busca metadata de películas, series y anime automáticamente
"""

import requests
import os
import re
from pathlib import Path

TMDB_API_KEY = "e0e4b911fdae8ee5cd6b64446f416da4"
TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"


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


def search_tv_show(title):
    """Busca una serie de TV en TMDB"""
    params = {
        'api_key': TMDB_API_KEY,
        'query': title,
        'language': 'es-MX'
    }
    
    try:
        response = requests.get(f"{TMDB_BASE_URL}/search/tv", params=params, timeout=10)
        data = response.json()
        if data.get('results') and len(data['results']) > 0:
            return data['results'][0]
    except Exception as e:
        print(f"Error buscando serie: {e}")
    return None


def get_movie_details(movie_id):
    """Obtiene detalles completos de una película"""
    params = {
        'api_key': TMDB_API_KEY,
        'language': 'es-MX',
        'append_to_response': 'credits'
    }
    
    try:
        response = requests.get(f"{TMDB_BASE_URL}/movie/{movie_id}", params=params, timeout=10)
        return response.json()
    except Exception as e:
        print(f"Error obteniendo detalles: {e}")
    return None


def get_tv_details(tv_id):
    """Obtiene detalles completos de una serie"""
    params = {
        'api_key': TMDB_API_KEY,
        'language': 'es-MX'
    }
    
    try:
        response = requests.get(f"{TMDB_BASE_URL}/tv/{tv_id}", params=params, timeout=10)
        return response.json()
    except Exception as e:
        print(f"Error obteniendo detalles: {e}")
    return None


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


def extract_year_from_filename(filename):
    """Extrae el año del nombre del archivo (ej: Inception (2010).mkv)"""
    match = re.search(r'\b(19\d{2}|20\d{2})\b', filename)
    if match:
        return int(match.group(1))
    return None


def extract_tmdb_id_from_filename(filename):
    """Busca un ID de TMDB en el nombre (ej. {tmdb-12345} o [tmdb=12345])"""
    match = re.search(r'(?i)tmdb[-=\s]*(\d+)', filename)
    if match:
        return match.group(1)
    return None


def clean_title_for_search(filename):
    """El Filtro Kraken: Limpia el título a la perfección para TMDB"""
    title = os.path.splitext(filename)[0]
    
    # Reemplazar puntos y guiones bajos por espacios
    title = title.replace('.', ' ').replace('_', ' ')
    
    # Quitar llaves {} que usan Sonarr/Radarr
    title = re.sub(r'\{.*?\}', '', title)
    title = re.sub(r'\[.*?\]', '', title)
    title = re.sub(r'\(.*?\)', '', title)
    
    # Destruir palabras basura
    basura = [
        '1080p', '720p', '480p', '4k', '2160p',
        'h264', 'h265', 'x264', 'x265', 'hevc',
        'bluray', 'webdl', 'web-dl', 'brrip', 'bdrip',
        'dual', 'latino', 'castellano', 'subtitulado',
        'remastered', 'dvdrip', 'hdrip', 'dvd', 'tv'
    ]
    
    for b in basura:
        title = re.sub(rf'(?i)\b{b}\b', '', title)
    
    # Detectar y limpiar episodios
    title = re.sub(r'(?i)(s\d{1,2}e\d{1,2}|temporada\s*\d+|episode\s*\d+|ep\.?\s*\d+).*', '', title)
    
    # Quitar años
    title = re.sub(r'\b(19\d{2}|20\d{2})\b', '', title)
    
    # Limpiar espacios
    title = re.sub(r'[\-\s]+', ' ', title).strip()
    
    return title


def auto_tag_video(file_path, video_type='movie'):
    """
    Auto-taguea un video usando el ID si existe, o buscando por nombre
    
    Args:
        file_path: Ruta del archivo
        video_type: 'movie', 'tv', o 'anime'
    
    Returns:
        dict con metadata o None
    """
    filename = os.path.basename(file_path)
    
    # Plan A: Intentar sacar el ID de TMDB
    tmdb_id = extract_tmdb_id_from_filename(filename)
    
    # Plan B: Sacar año y título
    year = extract_year_from_filename(filename)
    title = clean_title_for_search(filename)
    
    result = None
    
    # Plan A: Usar ID exacto
    if tmdb_id:
        print(f"🎯 ¡ID detectado! Buscando directamente TMDB ID: {tmdb_id}...")
        if video_type == 'movie':
            result = get_movie_details(tmdb_id)
            if result:
                result['media_type'] = 'movie'
        else:
            result = get_tv_details(tmdb_id)
            if result:
                result['media_type'] = 'tv'
    
    # Plan B: Búsqueda por texto
    if not result:
        print(f"🔍 Buscando por texto: '{title}' (Año: {year or 'No detectado'}) - Tipo: {video_type}")
        
        if video_type == 'movie':
            movie = search_movie(title, year)
            if movie:
                result = get_movie_details(movie['id'])
                if result:
                    result['media_type'] = 'movie'
        else:
            tv_show = search_tv_show(title)
            if tv_show:
                result = get_tv_details(tv_show['id'])
                if result:
                    result['media_type'] = 'tv'
    
    if result:
        print(f"✅ Éxito: {result.get('title') or result.get('name')}")
    else:
        print(f"❌ No encontrado en TMDB: {filename}")
    
    return result


def detect_video_type(file_path):
    """Detecta si es película, serie o anime basado en la ruta"""
    path_lower = file_path.lower()
    
    if 'anime' in path_lower:
        return 'anime'
    elif 'pelicula' in path_lower or 'movie' in path_lower:
        return 'movie'
    elif 'serie' in path_lower or 'tv' in path_lower:
        return 'tv'
    
    parts = Path(file_path).parts
    if len(parts) >= 3:
        parent_folder = parts[-2].lower()
        if 'temporada' in parent_folder or 'season' in parent_folder:
            return 'tv'
    
    return 'movie'
