import sqlite3
import os
import json
import time
import config

# Ensure download folder exists
os.makedirs(config.DOWNLOAD_FOLDER, exist_ok=True)
DB_PATH = os.path.join(config.DOWNLOAD_FOLDER, 'kraken.db')

def init_db():
    """Initialize SQLite database with required tables."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Create tables
    c.execute('''
    CREATE TABLE IF NOT EXISTS media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rel_path TEXT UNIQUE NOT NULL,
        filename TEXT NOT NULL,
        folder TEXT NOT NULL,
        full_folder TEXT NOT NULL,
        media_type TEXT NOT NULL,
        title TEXT,
        artist TEXT,
        album TEXT,
        genre TEXT,
        duration_sec INTEGER DEFAULT 0,
        size_bytes INTEGER DEFAULT 0,
        date_added REAL DEFAULT (datetime('now')),
        rating INTEGER DEFAULT 0,
        play_count INTEGER DEFAULT 0,
        last_played REAL,
        language TEXT DEFAULT 'unknown',
        bpm REAL DEFAULT 0.0,
        energy REAL DEFAULT 0.0,
        folder_type TEXT DEFAULT NULL,
        tmdb_id INTEGER DEFAULT 0,
        tmdb_title TEXT DEFAULT NULL,
        tmdb_year TEXT DEFAULT NULL,
        tmdb_overview TEXT DEFAULT NULL,
        tmdb_genres TEXT DEFAULT NULL,
        tmdb_poster TEXT DEFAULT NULL
    )
    ''')
    
    c.execute('''
    CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        sid TEXT,
        username TEXT,
        avatar_url TEXT,
        theme_color TEXT,
        is_superadmin BOOLEAN DEFAULT 0,
        created_at REAL DEFAULT (datetime('now')),
        pin_hash TEXT DEFAULT NULL
    )
    ''')
    
    c.execute('''
    CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_email TEXT,
        created_at REAL DEFAULT (datetime('now')),
        share_token TEXT,
        UNIQUE(name, owner_email)
    )
    ''')
    
    c.execute('''
    CREATE TABLE IF NOT EXISTS playlist_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        playlist_id TEXT NOT NULL,
        media_path TEXT NOT NULL,
        position INTEGER DEFAULT 0,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (media_path) REFERENCES media(rel_path) ON DELETE CASCADE
    )
    ''')
    
    c.execute('''
    CREATE TABLE IF NOT EXISTS play_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT,
        media_path TEXT NOT NULL,
        played_at REAL DEFAULT (datetime('now')),
        duration_watched INTEGER DEFAULT 0,
        FOREIGN KEY (media_path) REFERENCES media(rel_path) ON DELETE CASCADE
    )
    ''')
    
    c.execute('''
    CREATE TABLE IF NOT EXISTS downloads_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT UNIQUE NOT NULL,
        filename TEXT,
        title TEXT,
        url TEXT,
        status TEXT DEFAULT 'completed',
        details TEXT,
        error TEXT,
        date REAL DEFAULT (datetime('now'))
    )
    ''')
    
    c.execute('''
    CREATE TABLE IF NOT EXISTS video_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT UNIQUE NOT NULL,
        tmdb_title TEXT,
        tmdb_year TEXT,
        tmdb_overview TEXT,
        tmdb_genres TEXT,
        tmdb_poster TEXT,
        tmdb_id INTEGER,
        tmdb_type TEXT,
        updated_at REAL DEFAULT (datetime('now'))
    )
    ''')
    
    conn.commit()
    
    # Add 'language' column to media table if it doesn't exist
    try:
        c.execute("ALTER TABLE media ADD COLUMN language TEXT DEFAULT 'unknown'")
    except sqlite3.OperationalError:
        pass # Column already exists
    
    # Add 'bpm' and 'energy' columns for Librosa analysis
    try:
        c.execute("ALTER TABLE media ADD COLUMN bpm REAL DEFAULT 0.0")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE media ADD COLUMN energy REAL DEFAULT 0.0")
    except sqlite3.OperationalError:
        pass
    
    # Add 'folder_type' column for video classification (movie vs series)
    try:
        c.execute("ALTER TABLE media ADD COLUMN folder_type TEXT DEFAULT NULL")
    except sqlite3.OperationalError:
        pass
    
    # Add TMDB columns to media table (for videos)
    try:
        c.execute("ALTER TABLE media ADD COLUMN tmdb_id INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE media ADD COLUMN tmdb_title TEXT DEFAULT NULL")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE media ADD COLUMN tmdb_year TEXT DEFAULT NULL")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE media ADD COLUMN tmdb_overview TEXT DEFAULT NULL")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE media ADD COLUMN tmdb_genres TEXT DEFAULT NULL")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE media ADD COLUMN tmdb_poster TEXT DEFAULT NULL")
    except sqlite3.OperationalError:
        pass
    
    try:
        c.execute("ALTER TABLE playlists ADD COLUMN owner_email TEXT")
        c.execute("DROP INDEX IF EXISTS sqlite_autoindex_playlists_1") # Remove old unique constraint on name
        c.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_playlist_name_owner ON playlists(name, owner_email)")
    except sqlite3.OperationalError:
        pass # Columns/indices exist
    
    try:
        c.execute("ALTER TABLE playlists ADD COLUMN share_token TEXT")
    except sqlite3.OperationalError:
        pass # Column already exists
    
    # Create video_metadata table if not exists
    try:
        c.execute('''
        CREATE TABLE IF NOT EXISTS video_metadata (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT UNIQUE NOT NULL,
            tmdb_title TEXT,
            tmdb_year TEXT,
            tmdb_overview TEXT,
            tmdb_genres TEXT,
            tmdb_poster TEXT,
            tmdb_id INTEGER,
            tmdb_type TEXT,
            updated_at REAL DEFAULT (datetime('now'))
        )
        ''')
    except sqlite3.OperationalError:
        pass # Table already exists
    
    # Backward-compatible users table migrations (old installs may miss these columns)
    user_columns = [
        ("sid", "TEXT"),
        ("username", "TEXT"),
        ("avatar_url", "TEXT"),
        ("theme_color", "TEXT"),
        ("is_superadmin", "BOOLEAN DEFAULT 0"),
        ("created_at", "REAL"),
        ("pin_hash", "TEXT DEFAULT NULL"),
    ]
    
    for col_name, col_type in user_columns:
        try:
            c.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
        except sqlite3.OperationalError:
            # Column already exists or table absent in very old schema.
            pass
    
    conn.commit()
    
    # Automatically migrate from JSON if the DB was just created
    # We check if media table is empty to be absolutely sure
    c.execute("SELECT COUNT(*) FROM media")
    count = c.fetchone()[0]
    
    if count == 0:
        print("🛠️ Migrando datos de JSON a SQLite...")
        _migrate_json_to_sqlite(conn)
    
    # Create performance indexes for faster queries
    _create_performance_indexes(c)
    
    conn.close()


def _create_performance_indexes(cursor):
    """Create indexes to speed up common queries."""
    indexes = [
        ("idx_media_type", "media(media_type)"),
        ("idx_media_folder", "media(folder)"),
        ("idx_media_genre", "media(genre)"),
        ("idx_media_tmdb_id", "media(tmdb_id)"),
        ("idx_media_folder_type", "media(folder_type)"),
        ("idx_playlist_items_playlist", "playlist_items(playlist_id)"),
        ("idx_playlist_items_media", "playlist_items(media_path)"),
        ("idx_history_user", "play_history(user_email)"),
        ("idx_history_played", "play_history(played_at)"),
    ]
    
    for idx_name, idx_def in indexes:
        try:
            cursor.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {idx_def}")
            print(f"  ✓ Index {idx_name} created/verified")
        except sqlite3.OperationalError as e:
            print(f"  ⚠ Index {idx_name} skipped: {e}")


def _migrate_json_to_sqlite(conn):
    c = conn.cursor()
    
    # 1. Migrate cache_files.json
    cache_path = getattr(config, 'FILES_CACHE_FILE', os.path.join(config.DOWNLOAD_FOLDER, 'cache_files.json'))
    if os.path.exists(cache_path):
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            for item in cache_data:
                c.execute('''
                INSERT OR REPLACE INTO media (
                    rel_path, filename, folder, full_folder, media_type,
                    title, artist, album, genre, duration_sec, size_bytes, date_added, language
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    item.get('path', ''),
                    item.get('name', ''),
                    item.get('folder', ''),
                    item.get('full_folder', ''),
                    item.get('type', ''),
                    item.get('title', ''),
                    item.get('artist', ''),
                    item.get('album', ''),
                    item.get('genre', ''),
                    item.get('duration_sec', 0),
                    0, # size_bytes default
                    item.get('date_added', 0),
                    'unknown'
                ))
            print(f"✅ Migrados {len(cache_data)} archivos multimedia a SQLite.")
        except Exception as e:
            print(f"⚠️ Error migrando cache_files.json: {e}")
    
    # 2. Migrate ratings.json
    ratings_path = getattr(config, 'RATINGS_FILE', os.path.join(config.DOWNLOAD_FOLDER, 'ratings.json'))
    if os.path.exists(ratings_path):
        try:
            with open(ratings_path, 'r', encoding='utf-8') as f:
                ratings_data = json.load(f)
            # ratings_data is a dict { rel_path: 1 } (or 5)
            for path, rating in ratings_data.items():
                c.execute("UPDATE media SET rating = ? WHERE rel_path = ?", (rating, path))
            print("✅ Calificaciones migradas.")
        except Exception as e:
            print(f"⚠️ Error migrando ratings.json: {e}")
    
    # 3. Migrate stats.json
    stats_path = getattr(config, 'STATS_FILE', os.path.join(config.DOWNLOAD_FOLDER, 'stats.json'))
    if os.path.exists(stats_path):
        try:
            with open(stats_path, 'r', encoding='utf-8') as f:
                stats_data = json.load(f)
            # stats_data is a dict { rel_path: { 'count': int, 'last_played': float } }
            for path, data in stats_data.items():
                if isinstance(data, dict):
                    c.execute("UPDATE media SET play_count = ?, last_played = ? WHERE rel_path = ?",
                        (data.get('count', 0), data.get('last_played', 0), path))
            print("✅ Estadísticas de reproducción migradas.")
        except Exception as e:
            print(f"⚠️ Error migrando stats.json: {e}")
    
    # 4. Migrate playlists.json
    playlists_path = getattr(config, 'PLAYLISTS_FILE', os.path.join(config.DOWNLOAD_FOLDER, 'playlists.json'))
    if os.path.exists(playlists_path):
        try:
            with open(playlists_path, 'r', encoding='utf-8') as f:
                playlists_data = json.load(f)
            # playlists_data is a dict { "Playlist Name": ["path1", "path2"] }
            
            import uuid
            for pl_name, tracks in playlists_data.items():
                if not isinstance(tracks, list): continue
                
                pl_id = str(uuid.uuid4())
                pl_date = time.time()
                
                try:
                    c.execute("INSERT OR IGNORE INTO playlists (id, name, created_at) VALUES (?, ?, ?)",
                        (pl_id, pl_name, pl_date))
                    
                    # Insert items
                    position = 0
                    for path in tracks:
                        c.execute("INSERT INTO playlist_items (playlist_id, rel_path, position) VALUES (?, ?, ?)",
                            (pl_id, path, position))
                        position += 1
                except sqlite3.IntegrityError:
                    print(f"⚠️ Playlist ignorada por nombre duplicado: {pl_name}")
            
            print(f"✅ Migradas {len(playlists_data)} playlists a SQLite.")
        except Exception as e:
            print(f"⚠️ Error migrando playlists.json: {e}")
    
    # 5. Migrate historial.json
    history_path = getattr(config, 'HISTORY_FILE', os.path.join(config.DOWNLOAD_FOLDER, 'historial.json'))
    if os.path.exists(history_path):
        try:
            with open(history_path, 'r', encoding='utf-8') as f:
                history_data = json.load(f)
            # history_data is { "uid": { "title": "...", "filename": "...", "date": ... } }
            for uid, item in history_data.items():
                if not isinstance(item, dict): continue
                c.execute('''
                INSERT OR REPLACE INTO downloads_history (
                    uid, filename, title, url, status, details, error, date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    uid,
                    item.get('filename', ''),
                    item.get('title', ''),
                    item.get('url', ''),
                    item.get('status', 'completed'),
                    item.get('details', ''),
                    item.get('error', ''),
                    item.get('date', 0)
                ))
            print(f"✅ Migrado el historial de {len(history_data)} descargas.")
        except Exception as e:
            print(f"⚠️ Error migrando historial.json: {e}")
    
    conn.commit()
    print("🎉 Migración a SQLite completada exitosamente.")
