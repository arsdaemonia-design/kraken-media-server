"""Android TV catalog endpoints. Playback remains on Kraken's shared HLS API."""

import hashlib
import io
import json
import mimetypes
import os
import re
import requests

from flask import Blueprint, jsonify, request, send_file
from PIL import Image

import config
from routes.api import caratula, get_master_pin
from services.auth import get_user_from_request
from services.database import get_db

tv_bp = Blueprint("tv_api", __name__)

_KID_BLOCKED_RATINGS = (
    "PG-13", "R", "NC-17", "TV-14", "TV-MA", "18", "16", "16+", "18+",
    "MA15+", "M", "C", "D", "MA", "R18+", "R15+",
)


def _tv_genres(*values):
    """Normalize genre metadata from both current and legacy database fields."""
    genres = []
    for value in values:
        if not value:
            continue
        if isinstance(value, (list, tuple, set)):
            candidates = value
        else:
            text = str(value).strip()
            try:
                decoded = json.loads(text) if text.startswith("[") else None
            except (TypeError, ValueError):
                decoded = None
            candidates = decoded if isinstance(decoded, list) else re.split(r"[,;|]", text)
        for candidate in candidates:
            genre = str(candidate).strip()
            if genre and genre.casefold() not in {"otros", "unknown", "desconocido", "generos"}:
                if genre.casefold() not in {item.casefold() for item in genres}:
                    genres.append(genre)
    return genres


def _tv_library_category(parts, fallback):
    """Skip the structural Video/ container and return the user's library folder."""
    if parts and parts[0].casefold() in {"video", "videos", "media"}:
        if len(parts) > 1 and parts[1].strip():
            return parts[1].strip()
    if parts and parts[0].strip():
        return parts[0].strip()
    return fallback or "Videos"


def _tv_series_root(parts):
    """Return the series directory before its first season directory."""
    for index, part in enumerate(parts[:-1]):
        if re.match(r"^(?:temporadas?|seasons?|temp(?:orada)?)(?:\b|[\s._-]*\d+)", part, re.IGNORECASE):
            if index:
                return "/".join(parts[:index])
    # Preserve support for older libraries without a named season directory.
    return "/".join(parts[:3]) if len(parts) >= 3 else "/".join(parts[:-1])


def _tv_user_context(conn):
    email = get_user_from_request(request)
    if not email:
        return None, False, False
    user = conn.execute("SELECT is_kid_mode FROM users WHERE email = ?", (email,)).fetchone()
    kid_mode = bool(user and user["is_kid_mode"])
    has_pin = request.headers.get("X-Master-Pin") == get_master_pin()
    return email, kid_mode, has_pin


def _apply_tv_visibility(query, args, kid_mode, has_pin):
    if kid_mode or not has_pin:
        query += " AND COALESCE(is_adult, 0) = 0"
    if kid_mode:
        placeholders = ",".join("?" for _ in _KID_BLOCKED_RATINGS)
        query += f" AND UPPER(TRIM(COALESCE(tmdb_rating, ''))) NOT IN ({placeholders})"
        args.extend(_KID_BLOCKED_RATINGS)
    return query, args


@tv_bp.route("/api/tv/library")
def tv_library_page():
    """Return a paginated TV catalog with episodes grouped into series cards."""
    try:
        offset = max(0, int(request.args.get("offset", 0)))
        limit = min(60, max(1, int(request.args.get("limit", 40))))
    except (TypeError, ValueError):
        return jsonify({"error": "offset/limit inválidos"}), 400

    conn = get_db()
    try:
        _email, kid_mode, has_pin = _tv_user_context(conn)
        if not _email:
            return jsonify({"error": "Sesión requerida"}), 401

        query = """
            SELECT id, rel_path, filename, title, tmdb_title, tmdb_year,
                   tmdb_poster, tmdb_genres, genre, folder_type, is_adult, tmdb_rating
            FROM media
            WHERE media_type = 'video' AND COALESCE(is_hidden, 0) = 0
        """
        query, args = _apply_tv_visibility(query, [], kid_mode, has_pin)
        rows = conn.execute(query + " ORDER BY COALESCE(tmdb_title, title, filename), id", args).fetchall()

        catalog = {}
        genre_options = set()
        for row in rows:
            rel_path = (row["rel_path"] or "").replace("\\", "/").strip("/")
            parts = rel_path.split("/")
            row_genres = _tv_genres(row["tmdb_genres"], row["genre"])
            genre_options.update(row_genres)
            is_series = str(row["folder_type"] or "").lower() == "series" and len(parts) >= 2
            series_path = _tv_series_root(parts) if is_series else None
            key = f"series:{series_path}" if is_series else f"video:{row['id']}"

            if is_series and key in catalog:
                catalog[key]["episode_count"] += 1
                if not catalog[key].get("poster") and row["tmdb_poster"]:
                    catalog[key]["poster"] = row["tmdb_poster"]
                catalog[key]["genres"] = list(dict.fromkeys(catalog[key]["genres"] + [
                    genre for genre in row_genres
                ]))
                continue

            poster = row["tmdb_poster"]
            if is_series and not poster:
                series_poster = os.path.basename(series_path) + ".jpg"
                if os.path.isfile(os.path.join(config.THUMBNAILS_FOLDER, series_poster)):
                    poster = series_poster

            catalog[key] = {
                "id": row["id"],
                "title": row["tmdb_title"] or (os.path.basename(series_path) if is_series else row["title"]) or row["filename"],
                "path": series_path if is_series else rel_path,
                "poster": poster or row["rel_path"],
                "category": "Series" if is_series else (row["folder_type"] or "Videos"),
                "library_category": _tv_library_category(parts, row["folder_type"]),
                "year": row["tmdb_year"],
                "genres": row_genres,
                "is_adult": bool(row["is_adult"]),
                "kind": "series" if is_series else "movie",
                "episode_count": 1 if is_series else 0,
                "series_path": series_path,
            }

        items = list(catalog.values())
        total = len(items)
        page = items[offset:offset + limit]
        next_offset = offset + len(page)
        adult_exists = False if kid_mode else bool(conn.execute(
            "SELECT 1 FROM media WHERE media_type = 'video' AND COALESCE(is_adult, 0) = 1 LIMIT 1"
        ).fetchone())
        return jsonify({
            "items": page,
            "offset": offset,
            "limit": limit,
            "total": total,
            "next_offset": next_offset if next_offset < total else None,
            "has_adult_vault": adult_exists,
            "adult_unlocked": bool(has_pin and not kid_mode),
            "is_kid_mode": kid_mode,
            "genres": sorted(genre_options, key=str.casefold),
            "categories": sorted({item["library_category"] for item in items}, key=str.casefold),
            "types": ["movie", "series"],
        })
    finally:
        conn.close()


@tv_bp.route("/api/tv/backdrop/<int:media_id>")
def tv_backdrop(media_id):
    """Resolve a single wide TMDB image for the TV hero after checking visibility."""
    conn = get_db()
    try:
        email, kid_mode, has_pin = _tv_user_context(conn)
        if not email:
            return jsonify({"error": "Sesión requerida"}), 401
        row = conn.execute(
            "SELECT tmdb_id, folder_type, is_adult, tmdb_rating, is_hidden FROM media WHERE id = ? AND media_type = 'video'",
            (media_id,),
        ).fetchone()
        if not row or row["is_hidden"]:
            return jsonify({"url": None}), 404
        if (row["is_adult"] and (kid_mode or not has_pin)) or (
            kid_mode and str(row["tmdb_rating"] or "").strip().upper() in _KID_BLOCKED_RATINGS
        ):
            return jsonify({"error": "Contenido no disponible"}), 403
        tmdb_id = row["tmdb_id"]
        if not tmdb_id:
            return jsonify({"url": None})
        from services.video_tagger import TMDB_API_KEY, TMDB_BASE_URL

        media_type = "tv" if str(row["folder_type"] or "").lower() == "series" else "movie"
        response = requests.get(
            f"{TMDB_BASE_URL}/{media_type}/{tmdb_id}",
            params={"api_key": TMDB_API_KEY, "language": "es-MX"},
            timeout=8,
        )
        if response.status_code != 200:
            return jsonify({"url": None})
        backdrop_path = response.json().get("backdrop_path")
        if not backdrop_path:
            return jsonify({"url": None})
        return jsonify({"url": f"https://image.tmdb.org/t/p/w1280{backdrop_path}"})
    except requests.RequestException:
        return jsonify({"url": None})
    finally:
        conn.close()


@tv_bp.route("/api/tv/episodes")
def tv_series_episodes():
    """Return seasons and episodes for the selected series directory."""
    series_path = request.args.get("path", "").replace("\\", "/").strip("/")
    parts = series_path.split("/")
    if not series_path or any(part in ("", ".", "..") for part in parts):
        return jsonify({"error": "Ruta de serie inválida"}), 400

    conn = get_db()
    try:
        _email, kid_mode, has_pin = _tv_user_context(conn)
        if not _email:
            return jsonify({"error": "Sesión requerida"}), 401

        query = """
            SELECT id, rel_path, filename, title, is_adult, tmdb_rating
            FROM media
            WHERE media_type = 'video' AND folder_type = 'series'
              AND substr(replace(rel_path, '\\', '/'), 1, ?) = ?
              AND COALESCE(is_hidden, 0) = 0
        """
        args = [len(series_path) + 1, series_path + "/"]
        query, args = _apply_tv_visibility(query, args, kid_mode, has_pin)
        rows = conn.execute(query + " ORDER BY rel_path LIMIT 500", args).fetchall()

        episodes = []
        for row in rows:
            rel_path = (row["rel_path"] or "").replace("\\", "/").strip("/")
            relative = rel_path[len(series_path):].strip("/")
            path_parts = relative.split("/")
            if path_parts and path_parts[0].lower() in {"temporadas", "seasons", "season"}:
                season = path_parts[1] if len(path_parts) > 2 else "Episodios"
            else:
                season = path_parts[0] if len(path_parts) > 1 else "Episodios"
            episodes.append({
                "id": row["id"],
                "title": os.path.splitext(os.path.basename(rel_path))[0] or row["title"] or row["filename"],
                "path": rel_path,
                "season": season,
            })
        return jsonify({"items": episodes, "series_path": series_path})
    finally:
        conn.close()


@tv_bp.route("/api/tv/continue-watching")
def tv_continue_watching():
    """Return resumable items while applying the same TV vault visibility rules."""
    conn = get_db()
    try:
        email, kid_mode, has_pin = _tv_user_context(conn)
        if not email:
            return jsonify({"error": "Sesión requerida"}), 401

        query = """
            SELECT m.id, m.rel_path, m.filename, m.title, m.tmdb_title,
                   m.tmdb_year, m.tmdb_poster, m.tmdb_genres, m.genre, m.folder_type,
                   m.is_adult, m.tmdb_rating, p.progress_seconds, p.duration_seconds
            FROM user_progress p
            JOIN media m ON m.id = p.media_id
            WHERE p.user_email = ? AND m.media_type = 'video'
              AND COALESCE(m.is_hidden, 0) = 0 AND p.progress_seconds > 0
              AND p.duration_seconds > 0
              AND CAST(p.progress_seconds AS REAL) / p.duration_seconds >= 0.03
              AND CAST(p.progress_seconds AS REAL) / p.duration_seconds < 0.93
              AND p.is_finished = 0
        """
        query, args = _apply_tv_visibility(query, [email], kid_mode, has_pin)
        rows = conn.execute(query + " ORDER BY p.last_watched DESC LIMIT 24", args).fetchall()
        items = []
        for row in rows:
            path = (row["rel_path"] or "").replace("\\", "/").strip("/")
            items.append({
                "id": row["id"],
                "title": row["tmdb_title"] or row["title"] or row["filename"],
                "path": path,
                "poster": row["tmdb_poster"] or path,
                "category": row["folder_type"] or "Videos",
                "year": row["tmdb_year"],
                "genres": [g.strip() for g in (row["tmdb_genres"] or row["genre"] or "").split(",") if g.strip()],
                # This is a resumable episode/file, not a series card; the TV client must play it directly.
                "kind": "resume",
                "is_adult": bool(row["is_adult"]),
                "progress_seconds": row["progress_seconds"],
                "duration_seconds": row["duration_seconds"],
            })
        return jsonify({"items": items})
    finally:
        conn.close()


@tv_bp.route("/api/tv/poster/<path:filename>")
def tv_poster(filename):
    """Serve a cached 185x278 JPEG derivative for low-memory TV clients."""
    decoded = filename.lstrip("/\\")
    cache_dir = os.path.join(config.THUMBNAILS_FOLDER, "tv_cache")
    cache_path = os.path.join(cache_dir, hashlib.sha256(decoded.encode("utf-8", errors="ignore")).hexdigest() + ".jpg")
    if os.path.isfile(cache_path):
        return send_file(cache_path, mimetype="image/jpeg", conditional=True, max_age=31536000)

    source = caratula(decoded)
    if source.status_code != 200:
        return source
    try:
        source.direct_passthrough = False
        raw_image = source.get_data()
        source.close()
        os.makedirs(cache_dir, exist_ok=True)
        with Image.open(io.BytesIO(raw_image)) as image:
            image = image.convert("RGB")
            image.thumbnail((185, 278), Image.Resampling.LANCZOS)
            canvas = Image.new("RGB", (185, 278), (12, 18, 17))
            canvas.paste(image, ((185 - image.width) // 2, (278 - image.height) // 2))
            canvas.save(cache_path, "JPEG", quality=82, optimize=True)
        response = send_file(cache_path, mimetype="image/jpeg", conditional=True, max_age=31536000)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response
    except Exception:
        return source


@tv_bp.route("/api/tv/music/library")
def tv_music_library_page():
    """Return a small, authenticated page of audio tracks for Kraken TV."""
    try:
        offset = max(0, int(request.args.get("offset", 0)))
        limit = min(60, max(1, int(request.args.get("limit", 40))))
    except (TypeError, ValueError):
        return jsonify({"error": "offset/limit inválidos"}), 400

    query_text = request.args.get("q", "").strip()
    category = request.args.get("category", "").strip()
    genre = request.args.get("genre", "").strip()
    conn = get_db()
    try:
        email = get_user_from_request(request)
        if not email:
            return jsonify({"error": "Sesión requerida"}), 401

        where = ["media_type = 'audio'", "COALESCE(is_hidden, 0) = 0"]
        args = []
        if query_text:
            where.append("(title LIKE ? OR artist LIKE ? OR album LIKE ? OR rel_path LIKE ?)")
            pattern = f"%{query_text}%"
            args.extend([pattern] * 4)
        if category:
            # Library names are top-level folders relative to Kraken's media root.
            where.append("(rel_path = ? OR rel_path LIKE ?)")
            args.extend([category, f"{category}/%"])
        if genre:
            where.append("genre LIKE ?")
            args.append(f"%{genre}%")

        where_sql = " AND ".join(where)
        total = conn.execute(f"SELECT COUNT(*) FROM media WHERE {where_sql}", args).fetchone()[0]
        rows = conn.execute(
            f"""SELECT id, rel_path, filename, title, artist, album, genre,
                       duration_sec, play_count
                FROM media WHERE {where_sql}
                ORDER BY COALESCE(artist, ''), COALESCE(album, ''), COALESCE(title, filename), id
                LIMIT ? OFFSET ?""",
            [*args, limit, offset],
        ).fetchall()

        category_rows = conn.execute(
            "SELECT rel_path FROM media WHERE media_type = 'audio' AND COALESCE(is_hidden, 0) = 0"
        ).fetchall()
        categories = sorted({
            (row["rel_path"] or "").replace("\\", "/").strip("/").split("/")[0]
            for row in category_rows
            if (row["rel_path"] or "").strip("/\\")
        }, key=str.casefold)
        genre_rows = conn.execute(
            "SELECT DISTINCT genre FROM media WHERE media_type = 'audio' AND COALESCE(is_hidden, 0) = 0 AND genre IS NOT NULL AND TRIM(genre) != ''"
        ).fetchall()
        genres = sorted({part.strip() for row in genre_rows for part in re.split(r"[,;|]", row["genre"] or "") if part.strip()}, key=str.casefold)
        playlist_columns = {row["name"] for row in conn.execute("PRAGMA table_info(playlist_items)").fetchall()}
        playlist_path_col = "rel_path" if "rel_path" in playlist_columns else "media_path"
        playlist_rows = conn.execute(
            f"""SELECT p.id, p.name, COUNT(m.id) AS track_count
                FROM playlists p
                LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
                LEFT JOIN media m ON m.rel_path = pi.{playlist_path_col}
                    AND m.media_type = 'audio' AND COALESCE(m.is_hidden, 0) = 0
                WHERE p.owner_email = ?
                GROUP BY p.id, p.name ORDER BY p.name COLLATE NOCASE""",
            (email,),
        ).fetchall()
        playlists = []
        for playlist in playlist_rows:
            cover_row = conn.execute(
                f"""SELECT m.rel_path FROM playlist_items pi
                    JOIN media m ON m.rel_path = pi.{playlist_path_col}
                    WHERE pi.playlist_id = ? AND m.media_type = 'audio'
                        AND COALESCE(m.is_hidden, 0) = 0
                    ORDER BY pi.position LIMIT 1""",
                (playlist["id"],),
            ).fetchone()
            playlists.append({
                "id": playlist["id"],
                "name": playlist["name"],
                "track_count": playlist["track_count"],
                "cover": f"/api/tv/music/cover/{cover_row['rel_path']}" if cover_row else None,
            })
        items = []
        for row in rows:
            rel_path = (row["rel_path"] or "").replace("\\", "/").strip("/")
            items.append({
                "id": row["id"],
                "path": rel_path,
                "title": row["title"] or row["filename"],
                "artist": row["artist"] or "Artista desconocido",
                "album": row["album"] or "Sencillos",
                "genre": row["genre"] or "",
                "duration_seconds": row["duration_sec"] or 0,
                "play_count": row["play_count"] or 0,
                "mime_type": mimetypes.guess_type(row["filename"] or rel_path)[0] or "audio/mpeg",
                "cover": f"/api/tv/music/cover/{rel_path}",
                "library_category": rel_path.split("/")[0] if rel_path else "Música",
            })
        next_offset = offset + len(items)
        return jsonify({
            "items": items,
            "offset": offset,
            "limit": limit,
            "total": total,
            "next_offset": next_offset if next_offset < total else None,
            "categories": categories,
            "genres": genres,
            "playlists": playlists,
        })
    finally:
        conn.close()


@tv_bp.route("/api/tv/music/playlists/<playlist_id>")
def tv_music_playlist_page(playlist_id):
    """Return one of the authenticated user's audio playlists, preserving order."""
    try:
        offset = max(0, int(request.args.get("offset", 0)))
        limit = min(60, max(1, int(request.args.get("limit", 50))))
    except (TypeError, ValueError):
        return jsonify({"error": "offset/limit inválidos"}), 400

    email = get_user_from_request(request)
    if not email:
        return jsonify({"error": "Sesión requerida"}), 401
    conn = get_db()
    try:
        playlist = conn.execute(
            "SELECT id, name FROM playlists WHERE id = ? AND owner_email = ?",
            (playlist_id, email),
        ).fetchone()
        if not playlist:
            return jsonify({"error": "Playlist no encontrada"}), 404

        playlist_columns = {row["name"] for row in conn.execute("PRAGMA table_info(playlist_items)").fetchall()}
        playlist_path_col = "rel_path" if "rel_path" in playlist_columns else "media_path"
        base_sql = f"""FROM playlist_items pi
            JOIN media m ON m.rel_path = pi.{playlist_path_col}
            WHERE pi.playlist_id = ? AND m.media_type = 'audio'
                AND COALESCE(m.is_hidden, 0) = 0"""
        count = conn.execute(f"SELECT COUNT(*) {base_sql}", (playlist_id,)).fetchone()[0]
        rows = conn.execute(
            f"""SELECT m.id, m.rel_path, m.filename, m.title, m.artist, m.album,
                       m.genre, m.duration_sec
                {base_sql} ORDER BY pi.position, pi.id LIMIT ? OFFSET ?""",
            (playlist_id, limit, offset),
        ).fetchall()
        items = []
        for row in rows:
            rel_path = (row["rel_path"] or "").replace("\\", "/").strip("/")
            items.append({
                "id": row["id"], "path": rel_path,
                "title": row["title"] or row["filename"],
                "artist": row["artist"] or "Artista desconocido",
                "album": row["album"] or "Sencillos", "genre": row["genre"] or "",
                "duration_seconds": row["duration_sec"] or 0,
                "mime_type": mimetypes.guess_type(row["filename"] or rel_path)[0] or "audio/mpeg",
                "cover": f"/api/tv/music/cover/{rel_path}",
                "library_category": rel_path.split("/")[0] if rel_path else "Música",
            })
        next_offset = offset + len(items)
        return jsonify({
            "playlist_id": playlist["id"], "playlist_name": playlist["name"],
            "items": items, "offset": offset, "limit": limit,
            "total": count, "next_offset": next_offset if next_offset < count else None,
        })
    finally:
        conn.close()


@tv_bp.route("/api/tv/music/cover/<path:filename>")
def tv_music_cover(filename):
    """Serve a cached square derivative of a cover for the TV music catalog."""
    email = get_user_from_request(request)
    if not email:
        return jsonify({"error": "Sesión requerida"}), 401

    decoded = filename.replace("\\", "/").strip("/")
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT 1 FROM media WHERE media_type = 'audio' AND rel_path = ? AND COALESCE(is_hidden, 0) = 0",
            (decoded,),
        ).fetchone()
        if not row:
            return jsonify({"error": "Carátula no disponible"}), 404
    finally:
        conn.close()

    cache_dir = os.path.join(config.THUMBNAILS_FOLDER, "tv_music_cache")
    cache_path = os.path.join(cache_dir, hashlib.sha256(decoded.encode("utf-8", errors="ignore")).hexdigest() + ".jpg")
    if os.path.isfile(cache_path):
        return send_file(cache_path, mimetype="image/jpeg", conditional=True, max_age=31536000)

    source = caratula(decoded)
    if source.status_code != 200:
        return source
    try:
        source.direct_passthrough = False
        raw_image = source.get_data()
        source.close()
        os.makedirs(cache_dir, exist_ok=True)
        with Image.open(io.BytesIO(raw_image)) as image:
            image = image.convert("RGB")
            image.thumbnail((320, 320), Image.Resampling.LANCZOS)
            canvas = Image.new("RGB", (320, 320), (12, 18, 17))
            canvas.paste(image, ((320 - image.width) // 2, (320 - image.height) // 2))
            canvas.save(cache_path, "JPEG", quality=82, optimize=True)
        response = send_file(cache_path, mimetype="image/jpeg", conditional=True, max_age=31536000)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response
    except Exception:
        return source


@tv_bp.route("/api/tv/music/stream/<int:media_id>")
def tv_music_stream(media_id):
    """Stream one indexed audio file after validating the user's TV session."""
    if not get_user_from_request(request):
        return jsonify({"error": "Sesión requerida"}), 401
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT rel_path FROM media WHERE id = ? AND media_type = 'audio' AND COALESCE(is_hidden, 0) = 0",
            (media_id,),
        ).fetchone()
        if not row:
            return jsonify({"error": "Pista no disponible"}), 404
        root = os.path.realpath(config.DOWNLOAD_FOLDER)
        path = os.path.realpath(os.path.join(root, row["rel_path"]))
        if os.path.commonpath((root, path)) != root or not os.path.isfile(path):
            return jsonify({"error": "Archivo no disponible"}), 404
        response = send_file(path, conditional=True, etag=True, max_age=0)
        response.headers["Cache-Control"] = "private, no-store"
        return response
    finally:
        conn.close()


@tv_bp.route("/api/tv/music/lyrics/<int:media_id>")
@tv_bp.route("/api/tv/music/lyrics")
def tv_music_lyrics(media_id=None):
    """Return synchronized LRC and plain lyrics for Android TV / Karaoke."""
    if not get_user_from_request(request):
        return jsonify({"error": "Sesión requerida"}), 401
    conn = get_db()
    try:
        row = None
        rel_path = request.args.get("path", "").strip().replace("\\", "/").strip("/")
        query_title = request.args.get("title", "").strip()
        query_artist = request.args.get("artist", "").strip()

        if media_id is not None and media_id > 0:
            row = conn.execute(
                "SELECT rel_path, title, artist, album, duration_sec FROM media WHERE id = ? AND media_type = 'audio' AND COALESCE(is_hidden, 0) = 0",
                (media_id,),
            ).fetchone()
        elif rel_path:
            row = conn.execute(
                "SELECT rel_path, title, artist, album, duration_sec FROM media WHERE rel_path = ? AND media_type = 'audio' AND COALESCE(is_hidden, 0) = 0",
                (rel_path,),
            ).fetchone()

        artist = (row["artist"] if row else query_artist) or ""
        title = (row["title"] if row else query_title) or ""
        album = (row["album"] if row else "") or ""
        duration_sec = (row["duration_sec"] if row else 0) or 0
        actual_rel_path = (row["rel_path"] if row else rel_path) or ""

        root = os.path.realpath(config.DOWNLOAD_FOLDER)
        path = os.path.realpath(os.path.join(root, actual_rel_path)) if actual_rel_path else ""

        synced_text = ""
        plain_text = ""

        # 1. Local .lrc sidecar file
        if path:
            lrc_path = os.path.splitext(path)[0] + ".lrc"
            if os.path.isfile(lrc_path):
                try:
                    with open(lrc_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read().strip()
                        if "[" in content and "]" in content:
                            synced_text = content
                        else:
                            plain_text = content
                except Exception:
                    pass

        # 2. Local audio metadata tags
        if not synced_text and not plain_text and path and os.path.isfile(path):
            try:
                if path.lower().endswith(".mp3"):
                    from mutagen.id3 import ID3
                    audio = ID3(path)
                    for key in audio.keys():
                        if key.startswith("USLT") or key.startswith("SYLT"):
                            text = str(audio[key].text).strip()
                            if "[" in text and "]" in text:
                                synced_text = text
                            else:
                                plain_text = text
                            break
                elif path.lower().endswith((".m4a", ".mp4")):
                    from mutagen.mp4 import MP4
                    audio = MP4(path)
                    if "\xa9lyr" in audio:
                        text = str(audio["\xa9lyr"][0]).strip()
                        if "[" in text and "]" in text:
                            synced_text = text
                        else:
                            plain_text = text
            except Exception:
                pass

        # 3. Internet via lrclib.net
        if not synced_text and not plain_text:
            if artist and title and artist.casefold() not in {"artista desconocido", "unknown"}:
                clean_artist = artist.split("•")[0].split(":")[0].strip()
                clean_title = re.sub(r"\(.*feat.*\)|\[.*\]|\(.*\)", "", title, flags=re.IGNORECASE).strip()
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) KrakenMediaServer/2.0"}
                url = "https://lrclib.net/api/get"
                try:
                    params = {"artist_name": artist, "track_name": title}
                    if album:
                        params["album_name"] = album
                    if duration_sec:
                        params["duration"] = duration_sec
                    r = requests.get(url, params=params, headers=headers, timeout=6)
                    if r.status_code != 200 and (clean_artist != artist or clean_title != title):
                        params["artist_name"] = clean_artist
                        params["track_name"] = clean_title
                        r = requests.get(url, params=params, headers=headers, timeout=6)
                    if r.status_code == 200:
                        data = r.json()
                        synced_text = data.get("syncedLyrics") or ""
                        plain_text = data.get("plainLyrics") or ""
                except Exception as e:
                    print(f"Error fetching TV lyrics: {e}")

        has_sync = bool(synced_text and "[" in synced_text and "]" in synced_text)
        found = bool(has_sync or plain_text)
        return jsonify({
            "found": found,
            "has_sync": has_sync,
            "synced_text": synced_text,
            "plain_text": plain_text or (synced_text if not has_sync else ""),
            "title": title,
            "artist": artist
        })
    finally:
        conn.close()

