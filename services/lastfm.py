import requests
import json
import time
import config
from services.database import get_db

def normalize_genre(tags):
    """
    Busca coincidencias exactas en el diccionario GENRE_MAPPING.
    Prioriza los géneros específicos sobre los genéricos.
    """
    if not tags:
        return "Otros"
    for tag in tags:
        tag_lower = tag.lower().strip()
        for clean_genre, keywords in config.GENRE_MAPPING.items():
            if tag_lower in keywords:
                return clean_genre
    return "Otros"

def get_similar_artists(artist_name):
    """
    Obtiene artistas similares desde la DB (cache) o desde Last.fm.
    """
    if not artist_name or artist_name == 'Desconocido':
        return []

    conn = get_db()
    c = conn.cursor()
    
    # 1. Consultar Cache
    c.execute("SELECT similar_json, updated_at FROM similar_artists WHERE artist_name = ?", (artist_name,))
    row = c.fetchone()
    
    # Si existe en cache y no es muy viejo (30 días)
    if row and (time.time() - row['updated_at'] < (30 * 86400)):
        conn.close()
        return json.loads(row['similar_json'])

    # 2. Consultar Last.fm
    print(f"📡 Consultando Last.fm para artistas similares a: {artist_name}")
    data = get_lastfm_data('artist.getsimilar', {'artist': artist_name, 'limit': 20})
    
    similar_names = []
    if data and 'similarartists' in data:
        artists = data['similarartists'].get('artist', [])
        similar_names = [a['name'] for a in artists]

    # 3. Guardar en Cache
    c.execute('''
        INSERT OR REPLACE INTO similar_artists (artist_name, similar_json, updated_at)
        VALUES (?, ?, ?)
    ''', (artist_name, json.dumps(similar_names), time.time()))
    
    conn.commit()
    conn.close()
    
    return similar_names

def get_best_lastfm_image(images):
    if not images:
        return None
    # Last.fm devuelve un placeholder genérico desde ~2020 (hash: 2a96cbd8b46e442fc41c2b86b821562f)
    LASTFM_PLACEHOLDER = '2a96cbd8b46e442fc41c2b86b821562f'
    for img in reversed(images):
        url = img.get('#text')
        if url and LASTFM_PLACEHOLDER not in url:
            return url.replace('http://', 'https://', 1)
    return None

def get_artist_image_deezer(artist_name):
    """Obtiene la imagen del artista desde Deezer (gratis, sin API key)"""
    try:
        r = requests.get(
            'https://api.deezer.com/search/artist',
            params={'q': artist_name, 'limit': 1},
            timeout=config.LASTFM_TIMEOUT
        )
        data = r.json()
        if data.get('data') and len(data['data']) > 0:
            result = data['data'][0]
            # Verificar que el nombre coincida razonablemente
            if result.get('name', '').lower().strip() == artist_name.lower().strip():
                return result.get('picture_xl') or result.get('picture_big') or result.get('picture_medium')
    except Exception as e:
        print(f"⚠️ Error Deezer image ({artist_name}): {e}")
    return None

def get_lastfm_data(method, params):
    """Función genérica para Last.fm"""
    base_params = {
        'api_key': config.LASTFM_API_KEY,
        'format': 'json',
        'method': method
    }
    base_params.update(params)
    try:
        response = requests.get("https://ws.audioscrobbler.com/2.0/", params=base_params, timeout=config.LASTFM_TIMEOUT)
        return response.json()
    except Exception as e:
        print(f"⚠️ Error Last.fm ({method}): {e}")
        return None
