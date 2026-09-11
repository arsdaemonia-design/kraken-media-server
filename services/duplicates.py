"""Safe, advisory duplicate detection for the local media library."""

import hashlib
import re
import threading
import time
import unicodedata
from collections import defaultdict
from pathlib import Path

import config
from services.database import get_db


VARIANT_MARKERS = (
    "acoustic", "acustic", "live", "remix", "mix", "instrumental",
    "unplugged", "extended", "radio edit", "radio version", "demo",
    "remaster", "version", "edit", "dub", "alternate", "cover",
    "en vivo", "karaoke", "rework", "bootleg", "session"
)

SCAN_STATUS = {
    "active": False,
    "stage": "idle",
    "percent": 0,
    "groups": 0,
    "items": 0,
    "error": None,
    "finished_at": None,
}
_SCAN_LOCK = threading.Lock()


def _set_status(**values):
    with _SCAN_LOCK:
        SCAN_STATUS.update(values)


def get_scan_status():
    with _SCAN_LOCK:
        return dict(SCAN_STATUS)


def _normalize(value):
    value = unicodedata.normalize("NFKD", str(value or ""))
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.lower()
    value = re.sub(r"^\s*\d{1,3}[\s._-]+", "", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _has_variant_marker(row):
    haystack = " ".join([
        _normalize(row["title"]),
        _normalize(row["filename"]),
        _normalize(row["album"]),
    ])
    return any(re.search(r"(?:^| )" + re.escape(_normalize(marker)) + r"(?: |$)", haystack)
               for marker in VARIANT_MARKERS)


def _file_path(rel_path):
    return Path(config.DOWNLOAD_FOLDER) / str(rel_path or "").replace("/", "\\")


def _sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def _add_candidate(cursor, group_key, row, kind, confidence, reason, content_hash=None):
    cursor.execute(
        """INSERT OR REPLACE INTO duplicate_candidates
           (group_key, media_id, kind, confidence, reason, content_hash, decision, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?)""",
        (group_key, row["id"], kind, confidence, reason, content_hash, time.time()),
    )


def scan_duplicates():
    """Build exact and probable audio duplicate candidates without changing media files."""
    _set_status(active=True, stage="loading", percent=1, groups=0, items=0, error=None)
    conn = None
    try:
        conn = get_db()
        rows = conn.execute(
            """SELECT id, rel_path, filename, title, artist, album, duration_sec, size_bytes
               FROM media WHERE media_type = 'audio'"""
        ).fetchall()

        # Hash only files that already share cheap technical fingerprints.
        by_fingerprint = defaultdict(list)
        for row in rows:
            size = int(row["size_bytes"] or 0)
            duration = int(round(float(row["duration_sec"] or 0)))
            if size > 0:
                by_fingerprint[(size, duration)].append(row)

        _set_status(stage="hashing", percent=5)
        hashes = {}
        exact_groups = defaultdict(list)
        fingerprint_groups = [items for items in by_fingerprint.values() if len(items) > 1]
        total_hashes = sum(len(items) for items in fingerprint_groups) or 1
        hashed_count = 0
        for items in fingerprint_groups:
            for row in items:
                path = _file_path(row["rel_path"])
                if path.exists() and path.is_file():
                    try:
                        file_hash = _sha256(path)
                        hashes[row["id"]] = file_hash
                        exact_groups[file_hash].append(row)
                    except OSError:
                        pass
                hashed_count += 1
                _set_status(percent=min(55, 5 + int(hashed_count / total_hashes * 50)))

        conn.execute("DELETE FROM duplicate_candidates")
        group_count = 0
        item_count = 0
        cursor = conn.cursor()

        for file_hash, items in exact_groups.items():
            if len(items) < 2:
                continue
            group_key = "exact:" + file_hash
            for row in items:
                _add_candidate(cursor, group_key, row, "exact", 1.0,
                               "Mismo contenido byte a byte", file_hash)
                item_count += 1
            group_count += 1

        _set_status(stage="comparing", percent=65)
        probable_groups = defaultdict(list)
        for row in rows:
            title = _normalize(row["title"] or row["filename"])
            artist = _normalize(row["artist"])
            if title and artist and not _has_variant_marker(row):
                duration = float(row["duration_sec"] or 0)
                probable_groups[(artist, title)].append((row, duration))

        for key, entries in probable_groups.items():
            if len(entries) < 2:
                continue
            entries.sort(key=lambda item: item[1])
            clusters = []
            for row, duration in entries:
                if not clusters or duration - clusters[-1][-1][1] > 2:
                    clusters.append([])
                clusters[-1].append((row, duration))
            for cluster_index, cluster in enumerate(clusters):
                if len(cluster) < 2:
                    continue
                # Exact groups already provide the stronger classification.
                non_exact = []
                for row, _duration in cluster:
                    row_hash = hashes.get(row["id"])
                    if not any(row_hash and row_hash == hashes.get(other["id"])
                               for other, _ in cluster if other["id"] != row["id"]):
                        non_exact.append(row)
                if len(non_exact) < 2:
                    continue
                group_key = "probable:%s:%s:%s" % (key[0], key[1], cluster_index)
                for other in non_exact:
                    _add_candidate(cursor, group_key, other, "probable", 0.82,
                                   "Mismo artista, titulo y duracion aproximada")
                group_count += 1
                item_count += len(non_exact)

        conn.commit()
        _set_status(active=False, stage="done", percent=100, groups=group_count,
                    items=item_count, finished_at=time.time())
        return {"groups": group_count, "items": item_count}
    except Exception as exc:
        if conn:
            conn.rollback()
        _set_status(active=False, stage="error", error=str(exc), finished_at=time.time())
        raise
    finally:
        if conn:
            conn.close()


def start_scan():
    with _SCAN_LOCK:
        if SCAN_STATUS["active"]:
            return False
        SCAN_STATUS.update({"active": True, "stage": "starting", "percent": 0,
                            "groups": 0, "items": 0, "error": None})
    threading.Thread(target=scan_duplicates, name="duplicate-scan", daemon=True).start()
    return True
