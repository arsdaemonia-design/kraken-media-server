import requests
import json
import time
import re
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


def get_deezer_artist_genre(artist_name):
    """Obtiene el genero principal de Deezer sin requerir una API key."""
    if not artist_name or artist_name == 'Desconocido':
        return None
    try:
        search = requests.get(
            'https://api.deezer.com/search/artist',
            params={'q': artist_name, 'limit': 5},
            timeout=config.LASTFM_TIMEOUT
        ).json()
        candidates = search.get('data') or []
        if not candidates:
            return None
        wanted = artist_name.strip().casefold()
        exact = next((item for item in candidates if item.get('name', '').strip().casefold() == wanted), candidates[0])
        artist_id = exact.get('id')
        if not artist_id:
            return None
        details = requests.get(
            f'https://api.deezer.com/artist/{artist_id}',
            timeout=config.LASTFM_TIMEOUT
        ).json()
        genre = (details.get('genre') or {}).get('name')
        return genre.strip() if genre else None
    except Exception as e:
        print(f"⚠️ Error Deezer genre ({artist_name}): {e}")
        return None


def get_musicbrainz_genres(artist_name, track_title=None):
    """Obtiene tags/generos de MusicBrainz para una grabacion o artista."""
    if not artist_name or artist_name == 'Desconocido':
        return []

    headers = {
        'User-Agent': 'KrakenMediaServer/4.98 (genre metadata lookup)'
    }

    def clean(value):
        return re.sub(r'[^a-z0-9]+', ' ', str(value or '').casefold()).strip()

    def collect(entity):
        values = []
        for item in entity.get('genres') or []:
            if item.get('name'):
                values.append(item['name'])
        for item in entity.get('tags') or []:
            if item.get('name'):
                values.append(item['name'])
        return values

    try:
        params = {
            'query': f'artist:"{artist_name}"',
            'fmt': 'json',
            'limit': 5,
        }
        if track_title:
            params['query'] = f'artist:"{artist_name}" AND recording:"{track_title}"'
            recording_data = requests.get(
                'https://musicbrainz.org/ws/2/recording/',
                params={**params, 'inc': 'genres+tags'},
                headers=headers,
                timeout=config.LASTFM_TIMEOUT,
            ).json()
            recordings = recording_data.get('recordings') or []
            wanted_artist = clean(artist_name)
            wanted_title = clean(track_title)
            recordings.sort(key=lambda item: (
                clean(item.get('title')) == wanted_title,
                any(clean(credit.get('artist', {}).get('name')) == wanted_artist for credit in item.get('artist-credit') or []),
                item.get('score', 0),
            ), reverse=True)
            if recordings:
                genres = collect(recordings[0])
                if genres:
                    return genres

        artist_data = requests.get(
            'https://musicbrainz.org/ws/2/artist/',
            params={**params, 'query': f'artist:"{artist_name}"', 'inc': 'genres+tags'},
            headers=headers,
            timeout=config.LASTFM_TIMEOUT,
        ).json()
        artists = artist_data.get('artists') or []
        if artists:
            wanted = clean(artist_name)
            artists.sort(key=lambda item: (clean(item.get('name')) == wanted, item.get('score', 0)), reverse=True)
            return collect(artists[0])
    except Exception as e:
        print(f"⚠️ Error MusicBrainz genre ({artist_name}): {e}")
    return []

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
