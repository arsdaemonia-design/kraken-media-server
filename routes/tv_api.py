"""Android TV catalog endpoints. Playback remains on Kraken's shared HLS API."""

import hashlib
import io
import json
import mimetypes
import os
import re
import threading
import unicodedata
import requests

from flask import Blueprint, jsonify, request, send_file
from PIL import Image

import config
from routes.api import caratula, get_master_pin
from services.auth import get_user_from_request
from services.database import get_db

tv_bp = Blueprint("tv_api", __name__)

# Semáforo para limitar decodificación/extracción concurrente de carátulas y evitar sobrecarga de disco/RAM
_COVER_EXTRACT_SEM = threading.BoundedSemaphore(4)
_TV_NO_COVER_CACHE = set()


def _norm_search_text(value):
    """Strip diacritics/accents and lowercase text for flexible TV search."""
    if not value:
        return ""
    nfd = unicodedata.normalize("NFD", str(value))
    stripped = "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn")
    return stripped.casefold()

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


def _clean_tv_episode_title(raw_title, filename):
    """Normalize episode titles when the database holds raw language or codec tags."""
    text = str(raw_title or "").strip()
    if not text or re.match(r"^(?:ingles|latino|castellano|español|dual|subs?)[\]\)]*$", text, re.IGNORECASE):
        base = os.path.splitext(os.path.basename(filename))[0]
        cleaned = re.sub(r"\[.*?\]|\(.*?\)", "", base).strip()
        cleaned = re.sub(r"\b(?:720p|1080p|2160p|4k|x264|x265|hevc|web-dl|webrip|bluray|nf|amzn)\b", "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"(\w)_(\w)", r"\1'\2", cleaned)
        cleaned = re.sub(r"_(\d+)", r"'\1", cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned).strip(" -_")
        return cleaned or base
    return text


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
    """Return seasons and episodes for the selected series directory, with progress and metadata."""
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
            SELECT m.id, m.rel_path, m.filename, m.title, m.is_adult, m.tmdb_rating,
                   m.tmdb_poster, m.tmdb_id, m.tmdb_title, m.tmdb_overview, m.tmdb_year,
                   m.tmdb_genres, m.genre, m.duration_sec,
                   p.progress_seconds, p.duration_seconds, p.is_finished, p.last_watched
            FROM media m
            LEFT JOIN user_progress p ON p.media_id = m.id AND p.user_email = ?
            WHERE m.media_type = 'video'
              AND substr(replace(m.rel_path, '\\', '/'), 1, ?) = ? COLLATE NOCASE
              AND COALESCE(m.is_hidden, 0) = 0
        """
        args = [_email, len(series_path) + 1, series_path + "/"]
        query, args = _apply_tv_visibility(query, args, kid_mode, has_pin)
        rows = conn.execute(query + " ORDER BY m.rel_path LIMIT 500", args).fetchall()

        episodes = []
        series_info = {
            "title": os.path.basename(series_path),
            "overview": None,
            "year": None,
            "genres": [],
            "poster": None,
            "backdrop_url": None,
            "tmdb_id": None
        }

        for row in rows:
            if not series_info["overview"] and row["tmdb_overview"]:
                series_info["overview"] = row["tmdb_overview"]
            if not series_info["year"] and row["tmdb_year"]:
                series_info["year"] = row["tmdb_year"]
            if (series_info["title"] == os.path.basename(series_path) or not series_info["title"]) and row["tmdb_title"]:
                series_info["title"] = row["tmdb_title"]
            if not series_info["poster"] and row["tmdb_poster"]:
                series_info["poster"] = row["tmdb_poster"]
            if not series_info["tmdb_id"] and row["tmdb_id"]:
                series_info["tmdb_id"] = row["tmdb_id"]
            if not series_info["genres"] and (row["tmdb_genres"] or row["genre"]):
                series_info["genres"] = _tv_genres(row["tmdb_genres"], row["genre"])

        if not series_info["poster"]:
            series_poster = os.path.basename(series_path) + ".jpg"
            if os.path.isfile(os.path.join(config.THUMBNAILS_FOLDER, series_poster)):
                series_info["poster"] = series_poster

        if series_info["tmdb_id"]:
            try:
                from services.video_tagger import TMDB_API_KEY, TMDB_BASE_URL
                tmdb_resp = requests.get(
                    f"{TMDB_BASE_URL}/tv/{series_info['tmdb_id']}",
                    params={"api_key": TMDB_API_KEY, "language": "es-MX"},
                    timeout=3
                )
                if tmdb_resp.status_code == 200:
                    bd = tmdb_resp.json().get("backdrop_path")
                    if bd:
                        series_info["backdrop_url"] = f"https://image.tmdb.org/t/p/w1280{bd}"
                    if not series_info["overview"]:
                        series_info["overview"] = tmdb_resp.json().get("overview")
            except Exception:
                pass

        last_watched_ep = None
        first_unfinished_ep = None

        for row in rows:
            rel_path = (row["rel_path"] or "").replace("\\", "/").strip("/")
            relative = rel_path[len(series_path):].strip("/")
            path_parts = relative.split("/")
            raw_season = path_parts[0] if len(path_parts) > 1 else "Episodios"
            if path_parts and path_parts[0].lower() in {"temporadas", "seasons", "season"} and len(path_parts) > 2:
                raw_season = path_parts[1]

            s_match = re.search(r'(?:temporada|seasons?|temp|s)\s*0*(\d+)', raw_season, re.IGNORECASE)
            if s_match:
                season = f"Temporada {int(s_match.group(1))}"
                season_num = int(s_match.group(1))
            else:
                season = raw_season if raw_season.lower() not in {"series", "videos"} else "Episodios"
                season_num = None

            filename = os.path.splitext(os.path.basename(rel_path))[0]
            display_title = _clean_tv_episode_title(row["title"], rel_path)

            ep_match = re.search(r'[sS]\d+[eE](\d+)', filename)
            if ep_match:
                ep_num = int(ep_match.group(1))
            else:
                alt_match = re.search(r'\b(?:e|ep|cap|capitulo)\s*0*(\d+)\b', filename, re.IGNORECASE)
                ep_num = int(alt_match.group(1)) if alt_match else None

            progress_sec = row["progress_seconds"] or 0
            dur_sec = row["duration_seconds"] or row["duration_sec"] or 0
            is_finished = bool(row["is_finished"])
            last_watched = row["last_watched"] or 0

            ep_obj = {
                "id": row["id"],
                "title": display_title,
                "path": rel_path,
                "season": season,
                "season_number": season_num,
                "episode_number": ep_num,
                "thumbnail": f"/api/tv/thumbnail/{rel_path}",
                "poster": row["tmdb_poster"] or rel_path,
                "progress_seconds": progress_sec,
                "duration_seconds": dur_sec,
                "is_finished": is_finished,
                "last_watched": last_watched,
            }
            episodes.append(ep_obj)

            if last_watched > 0:
                if last_watched_ep is None or last_watched > last_watched_ep["last_watched"]:
                    last_watched_ep = ep_obj
            if not is_finished and first_unfinished_ep is None and progress_sec > 0:
                first_unfinished_ep = ep_obj

        resume_ep = None
        if last_watched_ep and not last_watched_ep["is_finished"]:
            resume_ep = last_watched_ep
        elif last_watched_ep and last_watched_ep["is_finished"]:
            idx = next((i for i, e in enumerate(episodes) if e["id"] == last_watched_ep["id"]), -1)
            if idx >= 0 and idx + 1 < len(episodes):
                resume_ep = episodes[idx + 1]
        if not resume_ep and episodes:
            resume_ep = first_unfinished_ep or episodes[0]

        return jsonify({
            "items": episodes,
            "series_path": series_path,
            "series_title": series_info["title"],
            "overview": series_info["overview"],
            "year": series_info["year"],
            "genres": series_info["genres"],
            "poster": series_info["poster"],
            "backdrop_url": series_info["backdrop_url"],
            "resume_episode": resume_ep,
        })
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


@tv_bp.route("/api/tv/thumbnail/<path:filename>")
def tv_thumbnail(filename):
    """Serve a 16:9 cached 320x180 JPEG thumbnail for TV episode cards."""
    decoded = filename.lstrip("/\\")
    cache_dir = os.path.join(config.THUMBNAILS_FOLDER, "tv_thumbs")
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
            target_w, target_h = 320, 180
            img_w, img_h = image.size
            scale = max(target_w / img_w, target_h / img_h)
            new_w, new_h = int(img_w * scale), int(img_h * scale)
            image = image.resize((new_w, new_h), Image.Resampling.LANCZOS)
            left = (new_w - target_w) // 2
            top = (new_h - target_h) // 2
            image = image.crop((left, top, left + target_w, top + target_h))
            image.save(cache_path, "JPEG", quality=82, optimize=True)
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
    conn.create_function("norm_text", 1, _norm_search_text)
    try:
        email = get_user_from_request(request)
        if not email:
            return jsonify({"error": "Sesión requerida"}), 401

        where = ["media_type = 'audio'", "COALESCE(is_hidden, 0) = 0"]
        args = []
        if query_text:
            tokens = [t for t in _norm_search_text(query_text).split() if t]
            for tok in tokens:
                where.append(
                    "(norm_text(title) LIKE ? OR norm_text(artist) LIKE ? OR norm_text(album) LIKE ? OR norm_text(rel_path) LIKE ?)"
                )
                pattern = f"%{tok}%"
                args.extend([pattern] * 4)
        if category:
            # Library names are top-level folders relative to Kraken's media root.
            cat_backslash = category.replace("/", "\\")
            where.append("(rel_path = ? OR rel_path LIKE ? OR rel_path = ? OR rel_path LIKE ?)")
            args.extend([category, f"{category}/%", cat_backslash, f"{cat_backslash}\\%"])
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

        categories = []
        genres = []
        playlists = []
        if offset == 0:
            category_rows = conn.execute(
                "SELECT DISTINCT substr(replace(rel_path, '\\', '/'), 1, instr(replace(rel_path, '\\', '/') || '/', '/') - 1) AS cat FROM media WHERE media_type = 'audio' AND COALESCE(is_hidden, 0) = 0"
            ).fetchall()
            categories = sorted({
                (row["cat"] or "").strip()
                for row in category_rows
                if (row["cat"] or "").strip()
            }, key=str.casefold)
            genre_rows = conn.execute(
                "SELECT DISTINCT genre FROM media WHERE media_type = 'audio' AND COALESCE(is_hidden, 0) = 0 AND genre IS NOT NULL AND TRIM(genre) != ''"
            ).fetchall()
            genres = sorted({part.strip() for row in genre_rows for part in re.split(r"[,;|]", row["genre"] or "") if part.strip()}, key=str.casefold)
            playlist_columns = {row["name"] for row in conn.execute("PRAGMA table_info(playlist_items)").fetchall()}
            playlist_path_col = "rel_path" if "rel_path" in playlist_columns else "media_path"
            playlist_rows = conn.execute(
                f"""SELECT p.id, p.name,
                           COUNT(pi.id) AS track_count,
                           (SELECT pi2.{playlist_path_col}
                            FROM playlist_items pi2
                            WHERE pi2.playlist_id = p.id
                            ORDER BY pi2.position, pi2.id
                            LIMIT 1) AS first_rel_path
                    FROM playlists p
                    LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
                    WHERE p.owner_email = ?
                    GROUP BY p.id, p.name
                    ORDER BY p.name COLLATE NOCASE""",
                (email,),
            ).fetchall()
            for playlist in playlist_rows:
                cover_rel = (playlist["first_rel_path"] or "").replace("\\", "/").strip("/")
                playlists.append({
                    "id": playlist["id"],
                    "name": playlist["name"],
                    "track_count": playlist["track_count"],
                    "cover": f"/api/tv/music/cover/{cover_rel}" if cover_rel else None,
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
    decoded = filename.replace("\\", "/").strip("/")
    norm_key = decoded.casefold()
    if norm_key in _TV_NO_COVER_CACHE:
        from flask import Response
        resp = Response(b"", status=404, mimetype="text/plain")
        resp.headers["Cache-Control"] = "public, max-age=3600"
        return resp

    cache_dir = os.path.join(config.THUMBNAILS_FOLDER, "tv_music_cache")
    cache_path = os.path.join(cache_dir, hashlib.sha256(decoded.encode("utf-8", errors="ignore")).hexdigest() + ".jpg")
    if os.path.isfile(cache_path):
        return send_file(cache_path, mimetype="image/jpeg", conditional=True, max_age=31536000)

    # Si ya existe en audio_cache (360x360 JPEG pregenerado por caratula), servirlo directo sin re-encodificar con PIL
    audio_cache_dir = os.path.join(config.THUMBNAILS_FOLDER, "audio_cache")
    audio_hash = hashlib.md5(norm_key.encode("utf-8", errors="ignore")).hexdigest()
    cached_audio_thumb = os.path.join(audio_cache_dir, f"{audio_hash}.jpg")
    if os.path.isfile(cached_audio_thumb):
        response = send_file(cached_audio_thumb, mimetype="image/jpeg", conditional=True, max_age=31536000)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response

    with _COVER_EXTRACT_SEM:
        if os.path.isfile(cache_path):
            return send_file(cache_path, mimetype="image/jpeg", conditional=True, max_age=31536000)
        if os.path.isfile(cached_audio_thumb):
            return send_file(cached_audio_thumb, mimetype="image/jpeg", conditional=True, max_age=31536000)

        source = caratula(decoded)
        if source.status_code != 200:
            if len(_TV_NO_COVER_CACHE) < 30000:
                _TV_NO_COVER_CACHE.add(norm_key)
            return source

        # Si caratula() acaba de guardar cached_audio_thumb (360x360), servirlo sin volver a procesar con PIL
        if os.path.isfile(cached_audio_thumb):
            try:
                source.close()
            except Exception:
                pass
            response = send_file(cached_audio_thumb, mimetype="image/jpeg", conditional=True, max_age=31536000)
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return response

        try:
            source.direct_passthrough = False
            raw_image = source.get_data()
            source.close()
            os.makedirs(cache_dir, exist_ok=True)
            with Image.open(io.BytesIO(raw_image)) as image:
                image = image.convert("RGB")
                image.thumbnail((240, 240), Image.Resampling.BILINEAR)
                canvas = Image.new("RGB", (240, 240), (12, 18, 17))
                canvas.paste(image, ((240 - image.width) // 2, (240 - image.height) // 2))
                canvas.save(cache_path, "JPEG", quality=80)
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


# ==============================================================================
# KRAKEN TV — VINCULACIÓN POR CÓDIGO QR (ESTILO NETFLIX / PLEX)
# ==============================================================================
import secrets
import time
from flask import render_template_string
from services.auth import create_token

TV_QR_SESSIONS = {}


def _clean_expired_qrs():
    now = time.time()
    expired = [k for k, v in list(TV_QR_SESSIONS.items()) if v.get("expires", 0) < now]
    for k in expired:
        TV_QR_SESSIONS.pop(k, None)


def _resolve_qr_base_url():
    """Obtiene la URL base ideal (pública o IP LAN) para que el celular pueda abrir el QR."""
    from routes.api import _load_runtime_config
    runtime = _load_runtime_config()
    pub_url = (runtime.get("public_url") or getattr(config, "PUBLIC_SERVER_URL", "") or "").strip().rstrip("/")
    if pub_url:
        return pub_url
    host_url = request.host_url.rstrip("/")
    if "127.0.0.1" in host_url or "localhost" in host_url:
        try:
            import socket
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            lan_ip = s.getsockname()[0]
            s.close()
            port = request.host.split(":")[1] if ":" in request.host else "5000"
            return f"http://{lan_ip}:{port}"
        except Exception:
            pass
    return host_url


@tv_bp.route("/api/tv/qr/init", methods=["POST"])
def tv_qr_init():
    _clean_expired_qrs()
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    code = "".join(secrets.choice(alphabet) for _ in range(6))

    TV_QR_SESSIONS[code] = {
        "status": "pending",
        "user_data": None,
        "expires": time.time() + 300
    }

    base_url = _resolve_qr_base_url()
    verify_url = f"{base_url}/tv-verify?code={code}"

    return jsonify({
        "code": code,
        "verify_url": verify_url,
        "expires_in": 300
    })


@tv_bp.route("/api/tv/qr/poll", methods=["GET"])
def tv_qr_poll():
    _clean_expired_qrs()
    code = (request.args.get("code") or "").strip().upper()
    data = TV_QR_SESSIONS.get(code)

    if not data or data["expires"] < time.time():
        TV_QR_SESSIONS.pop(code, None)
        return jsonify({"status": "expired"}), 404

    if data["status"] == "approved" and data.get("user_data"):
        user_data = data["user_data"]
        TV_QR_SESSIONS.pop(code, None)
        return jsonify({
            "status": "approved",
            "redirect": "/",
            "token": user_data.get("token"),
            "email": user_data.get("email"),
            "username": user_data.get("username"),
            "avatar_url": user_data.get("avatar_url"),
            "is_superadmin": user_data.get("is_superadmin", False),
            "role": user_data.get("role", "user")
        })

    return jsonify({"status": "pending"})


@tv_bp.route("/api/tv/qr/approve", methods=["POST"])
def tv_qr_approve():
    _clean_expired_qrs()
    payload = request.get_json(silent=True) or {}
    code = (payload.get("code") or request.args.get("code") or "").strip().upper()
    data = TV_QR_SESSIONS.get(code)

    if not data or data["expires"] < time.time():
        return jsonify({"ok": False, "error": "El código QR expiró. Genera uno nuevo en la TV."}), 404

    email = get_user_from_request(request)
    if not email:
        return jsonify({"ok": False, "error": "Primero inicia sesión en Kraken desde este dispositivo."}), 401

    conn = get_db()
    try:
        c = conn.cursor()
        c.execute("PRAGMA table_info(users)")
        cols = [r[1] for r in c.fetchall()]
        sel_cols = ["email", "username", "avatar_url", "is_superadmin"]
        if "role" in cols:
            sel_cols.append("role")
        if "trial_expires_at" in cols:
            sel_cols.append("trial_expires_at")
        row = c.execute(f"SELECT {', '.join(sel_cols)} FROM users WHERE email = ? COLLATE NOCASE", (email,)).fetchone()
        if not row:
            return jsonify({"ok": False, "error": "Usuario no encontrado"}), 404

        role = row["role"] if "role" in row.keys() and row["role"] else ("admin" if row["is_superadmin"] else "user")
        trial_exp = row["trial_expires_at"] if "trial_expires_at" in row.keys() else None
        tv_token = create_token(row["email"], row["username"] or "", bool(row["is_superadmin"]), expires_at=trial_exp, role=role)

        data["user_data"] = {
            "token": tv_token,
            "email": row["email"],
            "username": row["username"] or row["email"].split("@")[0],
            "avatar_url": row["avatar_url"],
            "is_superadmin": bool(row["is_superadmin"]),
            "role": role
        }
        data["status"] = "approved"
        return jsonify({"ok": True, "status": "approved", "username": data["user_data"]["username"]})
    finally:
        conn.close()


@tv_bp.route("/tv-verify", methods=["GET"])
def tv_verify_page():
    _clean_expired_qrs()
    code = (request.args.get("code") or "").strip().upper()
    return render_template_string("""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vincular Kraken TV</title>
    <style>
        * { box-sizing: border-box; }
        body {
            background: radial-gradient(circle at top, #062e22 0%, #050505 65%);
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
        }
        .card {
            text-align: center;
            padding: 32px 26px;
            border: 1px solid rgba(16, 185, 129, 0.35);
            border-radius: 22px;
            background: rgba(9, 13, 22, 0.92);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.75), 0 0 30px rgba(16, 185, 129, 0.12);
            max-width: 380px;
            width: 100%;
        }
        .logo { width: 72px; height: 72px; margin-bottom: 10px; filter: drop-shadow(0 0 12px rgba(16,185,129,0.5)); }
        h2 { color: #10B981; letter-spacing: 3px; margin: 0 0 6px 0; font-size: 20px; }
        .sub { color: #94A3B8; font-size: 14px; margin-bottom: 20px; line-height: 1.4; }
        .code-input {
            width: 100%;
            text-align: center;
            font-size: 28px;
            font-weight: 800;
            letter-spacing: 8px;
            background: #0f172a;
            border: 1px solid rgba(16, 185, 129, 0.4);
            padding: 14px;
            border-radius: 12px;
            margin: 12px 0 20px 0;
            color: #10B981;
            text-transform: uppercase;
            outline: none;
        }
        .user-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(16, 185, 129, 0.12);
            border: 1px solid rgba(16, 185, 129, 0.3);
            color: #A7F3D0;
            padding: 6px 14px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 14px;
        }
        .btn {
            width: 100%;
            padding: 15px;
            background: #10B981;
            color: #050505;
            font-weight: 800;
            font-size: 16px;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            transition: transform 0.15s, background 0.15s;
        }
        .btn:hover { background: #34D399; }
        .btn:active { transform: scale(0.98); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .msg { margin-top: 14px; font-size: 13px; min-height: 20px; }
        .err { color: #F87171; }
        .ok { color: #34D399; font-weight: bold; }
        .login-box { display: none; margin-top: 14px; text-align: left; }
        .field {
            width: 100%;
            padding: 12px 14px;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.15);
            background: rgba(255,255,255,0.06);
            color: #fff;
            margin-bottom: 10px;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="card" id="main-card">
        <img src="/assets/kraken.svg" class="logo" alt="Kraken">
        <h2>KRAKEN TV</h2>
        <p class="sub" id="desc-text">¿Autorizar inicio de sesión en tu pantalla con este código?</p>
        <div id="user-badge-wrap"></div>
        <input id="code-box" class="code-input" maxlength="6" value="{{ code }}" placeholder="------">

        <div id="quick-login-form" class="login-box">
            <p style="color:#CBD5E1;font-size:12px;margin:0 0 8px 0;text-align:center;">Inicia sesión para autorizar la pantalla:</p>
            <input id="login-user" class="field" type="text" placeholder="Tu usuario (ej. Skaso)">
            <input id="login-pass" class="field" type="password" placeholder="Tu contraseña">
        </div>

        <button id="authorize-btn" class="btn" onclick="autorizarTv()">Autorizar Pantalla</button>
        <div id="status-msg" class="msg"></div>
    </div>

    <script>
        const AUTH_KEY = 'kraken_auth_token';
        const USER_KEY = 'kraken_user';
        let token = localStorage.getItem(AUTH_KEY) || '';

        try {
            const u = JSON.parse(localStorage.getItem(USER_KEY) || '{}');
            if (token && (u.username || u.email)) {
                document.getElementById('user-badge-wrap').innerHTML =
                    '<div class="user-pill">👤 Conectado como <b>' + (u.username || u.email) + '</b></div>';
            } else {
                document.getElementById('quick-login-form').style.display = 'block';
            }
        } catch (_) {
            if (!token) document.getElementById('quick-login-form').style.display = 'block';
        }

        async function autorizarTv() {
            const btn = document.getElementById('authorize-btn');
            const msg = document.getElementById('status-msg');
            const code = (document.getElementById('code-box').value || '').trim().toUpperCase();
            if (!code || code.length < 4) {
                msg.className = 'msg err';
                msg.textContent = 'Ingresa el código de 6 letras que aparece en la TV.';
                return;
            }

            btn.disabled = true;
            msg.className = 'msg';
            msg.textContent = 'Vinculando pantalla...';

            try {
                if (!token) {
                    const rawUser = (document.getElementById('login-user').value || '').trim();
                    const password = document.getElementById('login-pass').value || '';
                    if (!rawUser || !password) {
                        msg.className = 'msg err';
                        msg.textContent = 'Ingresa tu usuario y contraseña.';
                        btn.disabled = false;
                        return;
                    }
                    let email = rawUser;
                    if (!email.includes('@')) {
                        try {
                            const uRes = await fetch('/api/auth/users');
                            const uData = await uRes.json();
                            const found = (uData.users || []).find(x => (x.username || '').toLowerCase() === rawUser.toLowerCase());
                            email = found ? found.email : (rawUser.toLowerCase().replace(/\\s+/g, '_') + '@kraken.local');
                        } catch (_) {
                            email = rawUser.toLowerCase().replace(/\\s+/g, '_') + '@kraken.local';
                        }
                    }
                    const lRes = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });
                    const lData = await lRes.json();
                    if (!lData.token) {
                        msg.className = 'msg err';
                        msg.textContent = lData.error || 'Credenciales incorrectas';
                        btn.disabled = false;
                        return;
                    }
                    token = lData.token;
                    localStorage.setItem(AUTH_KEY, token);
                    localStorage.setItem(USER_KEY, JSON.stringify(lData));
                }

                const res = await fetch('/api/tv/qr/approve', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ code })
                });
                const data = await res.json();
                if (res.status === 401) {
                    token = '';
                    localStorage.removeItem(AUTH_KEY);
                    document.getElementById('quick-login-form').style.display = 'block';
                    msg.className = 'msg err';
                    msg.textContent = 'Tu sesión expiró, ingresa tu usuario y contraseña.';
                    btn.disabled = false;
                    return;
                }
                if (!data.ok) {
                    msg.className = 'msg err';
                    msg.textContent = data.error || 'No se pudo autorizar el código.';
                    btn.disabled = false;
                    return;
                }

                document.getElementById('main-card').innerHTML = `
                    <div style="font-size:52px;margin-bottom:10px;">✅</div>
                    <h2 style="color:#10B981;">¡TV VINCULADA!</h2>
                    <p style="color:#CBD5E1;font-size:15px;line-height:1.5;margin-top:12px;">
                        Tu pantalla ya inició sesión automáticamente como <b>${data.username || 'tu cuenta'}</b>.<br><br>
                        Ya puedes cerrar esta ventana.
                    </p>
                `;
            } catch (e) {
                msg.className = 'msg err';
                msg.textContent = 'Error de conexión con el servidor.';
                btn.disabled = false;
            }
        }
    </script>
</body>
</html>""", code=code)

