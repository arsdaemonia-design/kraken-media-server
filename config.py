import os
import sys
import json

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# GitHub Repository for Auto-Update
GITHUB_REPO = "arsdaemonia-design/kraken-media-server"
USER_HOME = os.path.expanduser("~")

# ============= RUNTIME CONFIG (persistente, funciona en EXE) =============
if sys.platform == 'win32':
    app_data_dir = os.path.join(os.getenv('APPDATA'), 'Kraken Media Server')
else:
    app_data_dir = os.path.join(os.path.expanduser('~'), 'Library', 'Application Support', 'Kraken Media Server')

os.makedirs(app_data_dir, exist_ok=True)
RUNTIME_CONFIG_FILE = os.path.join(app_data_dir, 'runtime_config.json')

DEFAULT_RUNTIME = {
    'media_path': r'F:\Kraken Media Server\descargas',
    'pin': '3041'
}

def load_runtime_config():
    if os.path.exists(RUNTIME_CONFIG_FILE):
        try:
            with open(RUNTIME_CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    
    # Si no existe JSON, usar config.py local como fallback
    return {
        'media_path': os.getenv('KRAKEN_MEDIA_PATH', DEFAULT_RUNTIME['media_path']),
        'pin': os.getenv('MASTER_PIN', DEFAULT_RUNTIME['pin'])
    }

def save_runtime_config_sync(key, value):
    """Guarda en JSON y sincroniza con config.py local"""
    # 1. Guardar en JSON
    config_data = load_runtime_config()
    config_data[key] = value
    with open(RUNTIME_CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(config_data, f, indent=4)
    
    # 2. Sincronizar con config.py local (solo si NO está frozen)
    if not getattr(sys, 'frozen', False):
        config_path = os.path.join(BASE_DIR, 'config.py')
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            with open(config_path, 'w', encoding='utf-8') as f:
                for line in lines:
                    if key == 'media_path' and line.startswith('KRAKEN_MEDIA_PATH'):
                        f.write(f"KRAKEN_MEDIA_PATH = os.getenv('KRAKEN_MEDIA_PATH', r'{value}')\n")
                    elif key == 'pin' and line.startswith('MASTER_PIN'):
                        f.write(f"MASTER_PIN = os.getenv('MASTER_PIN', '{value}')\n")
                    else:
                        f.write(line)

_runtime = load_runtime_config()

# Media Paths - LEE DESDE JSON SI EXISTE
KRAKEN_MEDIA_PATH = os.getenv('KRAKEN_MEDIA_PATH', r'D:\\Skazo\\Music')
DOWNLOAD_FOLDER = os.path.join(KRAKEN_MEDIA_PATH, 'Kraken Media')
FILES_CACHE_FILE = os.path.join(DOWNLOAD_FOLDER, 'cache_files.json')
THUMBNAILS_FOLDER = os.path.join(DOWNLOAD_FOLDER, 'thumbnails')
HISTORY_FILE = os.path.join(DOWNLOAD_FOLDER, 'historial.json')
RATINGS_FILE = os.path.join(DOWNLOAD_FOLDER, 'ratings.json')
PLAYLISTS_FILE = os.path.join(DOWNLOAD_FOLDER, 'playlists.json')
STATS_FILE = os.path.join(DOWNLOAD_FOLDER, 'stats.json')
TEMP_FOLDER = os.path.join(BASE_DIR, '_tmp')

# HLS Streaming Temp Directory
if sys.platform == "win32":
    HLS_TEMP_DIR = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), 'Kraken Media Server', 'temp_streams')
else:
    HLS_TEMP_DIR = os.path.join(os.path.expanduser('~'), 'Library', 'Application Support', 'Kraken Media Server', 'temp_streams')
os.makedirs(HLS_TEMP_DIR, exist_ok=True)

# FFmpeg/FFprobe Paths
if getattr(sys, 'frozen', False):
    # Running as PyInstaller bundle
    bundle_dir = sys._MEIPASS
    FFMPEG_PATH = os.path.join(bundle_dir, 'ffmpeg.exe')
    FFPROBE_PATH = os.path.join(bundle_dir, 'ffprobe.exe')
else:
    FFMPEG_PATH = 'ffmpeg'
    FFPROBE_PATH = 'ffprobe'

# Security - LEE DESDE JSON SI EXISTE
MASTER_PIN = os.getenv('MASTER_PIN', '3045')
SUPERADMIN_EMAIL = os.getenv('SUPERADMIN_EMAIL', 'arsdaemonia@gmail.com')
LASTFM_API_KEY = os.getenv('LASTFM_API_KEY', 'dfc4823f36b21278278f577357d8e7e7')

# Timeout Configs
LASTFM_TIMEOUT = 3
FFPROBE_TIMEOUT = 10

# Radio / Recommendation Configs
RADIO_LIMIT = 50
SIMILARITY_SCORE_SAME_ARTIST = 60
SIMILARITY_SCORE_SAME_ALBUM = 40
SIMILARITY_SCORE_SIMILAR_GENRE = 20
SIMILARITY_SCORE_SIMILAR_RATING = 10

# Genre Mappings
GENRE_MAPPING = {
    # --- ROCK ---
    'Alternative Rock': ['alternative rock', 'alt-rock', 'alt rock', 'alternative'],
    'Indie Rock': ['indie rock', 'indie'],
    'Hard Rock': ['hard rock'],
    'Classic Rock': ['classic rock'],
    'Progressive Rock': ['progressive rock', 'prog rock', 'prog-rock'],
    'Punk Rock': ['punk rock', 'punk'],
    'Post-Rock': ['post-rock', 'post rock'],
    'Garage Rock': ['garage rock'],
    'Psychedelic Rock': ['psychedelic rock', 'psych rock', 'psychedelic'],
    'Rock': ['rock'],

    # --- POP ---
    'Indie Pop': ['indie pop', 'indiepop'],
    'Synth-Pop': ['synth-pop', 'synthpop', 'synth pop'],
    'Electropop': ['electropop', 'electro-pop'],
    'K-Pop': ['k-pop', 'kpop', 'korean pop'],
    'Dream Pop': ['dream pop', 'dreampop'],
    'Pop': ['pop'],

    # --- ELECTRONIC ---
    'House': ['house', 'deep house', 'tech house'],
    'Techno': ['techno', 'detroit techno', 'minimal techno'],
    'Dubstep': ['dubstep'],
    'Drum & Bass': ['drum and bass', 'dnb', 'drum n bass'],
    'Trance': ['trance', 'progressive trance'],
    'Ambient': ['ambient', 'ambient electronic'],
    'IDM': ['idm', 'intelligent dance music'],
    'Breakbeat': ['breakbeat', 'breaks'],
    'Electronic': ['electronic', 'electronica', 'edm'],

    # --- HIP-HOP ---
    'Trap': ['trap', 'trap music'],
    'Conscious Hip-Hop': ['conscious hip hop', 'conscious rap'],
    'Boom Bap': ['boom bap'],
    'Cloud Rap': ['cloud rap'],
    'Hip-Hop': ['hip hop', 'hip-hop', 'rap'],

    # --- LATINO ---
    'Reggaeton': ['reggaeton', 'reguetón'],
    'Latin Trap': ['latin trap'],
    'Salsa': ['salsa'],
    'Bachata': ['bachata'],
    'Cumbia': ['cumbia'],
    'Latin': ['latin', 'latino'],

    # --- METAL ---
    'Death Metal': ['death metal'],
    'Black Metal': ['black metal'],
    'Thrash Metal': ['thrash metal', 'thrash'],
    'Doom Metal': ['doom metal', 'doom'],
    'Metalcore': ['metalcore'],
    'Deathcore': ['deathcore'],
    'Heavy Metal': ['heavy metal', 'metal'],

    # --- JAZZ / SOUL ---
    'Bebop': ['bebop'],
    'Smooth Jazz': ['smooth jazz'],
    'Jazz Fusion': ['jazz fusion', 'fusion'],
    'Jazz': ['jazz'],
    
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
