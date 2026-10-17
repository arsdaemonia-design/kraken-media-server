from flask import Blueprint, request, send_file, jsonify, Response
import os
import re
import shutil
import hashlib
import subprocess
import state
import config
from services.hls_transcoder import HLSTranscoder

hls_bp = Blueprint("hls", __name__)

hls_transcoder = HLSTranscoder(
    ffmpeg_path=config.FFMPEG_PATH,
    ffprobe_path=config.FFPROBE_PATH
)

def _wait_hls_ready(process, session_dir, video_duration=0, hls_mode='stream', log_prefix='[HLS]'):
    """Espera a que HLS quede utilizable segun modo."""
    import time as _time

    def is_segment(filename):
        return filename.endswith(('.ts', '.m4s'))

    playlist_path = os.path.join(session_dir, "playlist.m3u8")
    mode = (hls_mode or 'stream').strip().lower()

    if mode == 'vod':
        # En modo VOD esperamos final completo de FFmpeg (timeline/seek estables).
        base_timeout = int(video_duration * 1.5) + 120 if video_duration else 1800
        timeout_seconds = max(300, min(14400, base_timeout))
        start = _time.time()

        while (_time.time() - start) < timeout_seconds:
            if process.poll() is not None:
                code = process.returncode
                if code == 0:
                    break
                stdout, stderr = process.communicate()
                error_msg = stderr.decode(errors='ignore') if stderr else "Unknown error"
                print(f"{log_prefix} FFmpeg fallo en VOD (exit {code}):\n{error_msg}")
                return False, f"FFmpeg error: {error_msg}"
            _time.sleep(0.5)

        if process.poll() is None:
            try:
                process.terminate()
            except Exception:
                pass
            return False, "Timeout esperando generacion HLS VOD completa"

        if not os.path.exists(playlist_path):
            return False, "No se genero playlist.m3u8 en modo VOD"
        segment_files = [f for f in os.listdir(session_dir) if is_segment(f)]
        if len(segment_files) < 1:
            return False, "No se generaron segmentos HLS en modo VOD"
        return True, None

    # STREAM mode (Inicio Protegido): preparar 3 segmentos iniciales (~15-30s) antes de entregar playlist
    # Con -c:v copy toma ~0.8s; si es re-encode lento, permite arrancar con 2 segmentos tras 4.5s.
    log_file = os.path.join(session_dir, "ffmpeg.log")
    start_wait = _time.time()
    for _ in range(150):
        elapsed = _time.time() - start_wait
        if os.path.exists(playlist_path) and os.path.getsize(playlist_path) > 20:
            segment_files = [f for f in os.listdir(session_dir) if is_segment(f)]
            if len(segment_files) >= 3 or (len(segment_files) >= 2 and elapsed >= 4.5) or (len(segment_files) >= 1 and process.poll() == 0):
                return True, None
        if process.poll() is not None:
            error_msg = "Unknown error"
            if os.path.exists(log_file):
                try:
                    with open(log_file, "r", encoding="utf-8", errors="ignore") as lf:
                        error_msg = lf.read().strip() or error_msg
                except Exception:
                    pass
            print(f"{log_prefix} FFmpeg murio durante generacion inicial:\n{error_msg}")
            return False, f"FFmpeg error: {error_msg}"
        _time.sleep(0.2)

    return False, "Timeout esperando generacion HLS (playlist/segmentos)"

_SUB_LANG_MAPPING = {
    'es': 'spa', 'spa': 'spa', 'esla': 'spa', 'lat': 'spa', 'la': 'spa', 'spanish': 'spa', 'espanol': 'spa',
    'en': 'eng', 'eng': 'eng', 'english': 'eng',
    'jp': 'jpn', 'jpn': 'jpn', 'ja': 'jpn',
    'pt': 'por', 'por': 'por', 'pb': 'por', 'pob': 'por',
    'fr': 'fra', 'fra': 'fra', 'fre': 'fra',
    'de': 'deu', 'deu': 'deu', 'ger': 'deu',
    'it': 'ita', 'ita': 'ita',
    'ru': 'rus', 'rus': 'rus',
    'ko': 'kor', 'kor': 'kor',
    'zh': 'zho', 'chi': 'zho', 'zho': 'zho',
}

_SUB_LANG_LABELS = {
    'spa': 'Español',
    'eng': 'Inglés',
    'jpn': 'Japonés',
    'por': 'Portugués',
    'fra': 'Francés',
    'deu': 'Alemán',
    'ita': 'Italiano',
    'rus': 'Ruso',
    'kor': 'Coreano',
    'zho': 'Chino',
}

def _parse_subtitle_suffix(video_base, subtitle_name):
    """Extrae (language_code, stream_index) de nombres como 'Video.spa.3.srt', 'Video)spa.srt' o 'subs.spa.srt'."""
    name_no_ext = os.path.splitext(subtitle_name)[0]
    if name_no_ext.lower().startswith(video_base.lower()):
        suffix = name_no_ext[len(video_base):].strip(" ._-()[]{}").lower()
    else:
        suffix = name_no_ext.strip(" ._-()[]{}").lower()
    if not suffix:
        return 'und', None

    tokens = [t for t in re.split(r'[._\-\s()\[\]]+', suffix) if t]
    stream_index = None
    if tokens and tokens[-1].isdigit():
        stream_index = int(tokens[-1])
        tokens = tokens[:-1]

    for token in reversed(tokens):
        if token in _SUB_LANG_MAPPING:
            return _SUB_LANG_MAPPING[token], stream_index

    return 'und', stream_index

def _infer_subtitle_language(video_base, subtitle_name):
    lang, _ = _parse_subtitle_suffix(video_base, subtitle_name)
    return lang

def _subtitle_matches_video_base(video_base, subtitle_name, single_video_in_dir=False):
    if single_video_in_dir:
        return True

    subtitle_base = os.path.splitext(subtitle_name)[0].lower()
    video_base_l = video_base.lower()
    if subtitle_base == video_base_l:
        return True

    if subtitle_base.startswith(video_base_l):
        rem = subtitle_base[len(video_base_l):]
        # Aceptar separador estándar (".es", "-spa", "_eng") o sufijo pegado tras paréntesis/corchete como "(tmdb-36800)spa"
        if rem[:1] in ('.', '_', '-', ' ') or video_base_l.endswith((')', ']', '}')):
            return True
        if rem.strip(' ._-') in _SUB_LANG_MAPPING:
            return True

    return False

def _find_external_subtitles(full_video_path):
    video_dir = os.path.dirname(full_video_path)
    video_filename = os.path.basename(full_video_path)
    video_base = os.path.splitext(video_filename)[0]
    sub_dirs = [video_dir, os.path.join(video_dir, 'subs'), os.path.join(video_dir, 'subtitles')]
    supported_exts = {'.srt', '.vtt'}
    video_exts = {'.mp4', '.mkv', '.avi', '.webm', '.mov', '.flv', '.wmv', '.m4v'}
    found = []
    seen = set()

    single_video_in_dir = False
    if os.path.isdir(video_dir):
        try:
            videos_in_dir = [
                f for f in os.listdir(video_dir)
                if os.path.splitext(f)[1].lower() in video_exts
            ]
            single_video_in_dir = (len(videos_in_dir) == 1)
        except OSError:
            pass

    for sub_dir in sub_dirs:
        if not os.path.isdir(sub_dir):
            continue

        for entry in sorted(os.listdir(sub_dir)):
            ext = os.path.splitext(entry)[1].lower()
            if ext not in supported_exts:
                continue

            if not _subtitle_matches_video_base(video_base, entry, single_video_in_dir=single_video_in_dir):
                continue

            full_sub_path = os.path.join(sub_dir, entry)
            rel_sub_path = os.path.relpath(full_sub_path, config.DOWNLOAD_FOLDER).replace('\\', '/')
            if rel_sub_path in seen:
                continue
            seen.add(rel_sub_path)

            language, stream_index = _parse_subtitle_suffix(video_base, entry)
            lang_label = _SUB_LANG_LABELS.get(language, 'Subtítulo' if language == 'und' else language.upper())
            if stream_index is not None:
                title = f"{lang_label} · SRT #{stream_index}"
            else:
                title = f"{lang_label} · SRT"

            found.append({
                "language": language,
                "stream_index": stream_index,
                "title": title,
                "url": f'/descargas/{rel_sub_path}',
                "external": True
            })

    return found

def _build_combined_subtitles(full_video_path, media_id=None, token=None, video_rel_path=None):
    """Combina subtítulos externos (.srt/.vtt) y subtítulos de texto incrustados en el MKV/MP4 sin duplicar pistas ya extraídas."""
    subs = _find_external_subtitles(full_video_path)
    analysis = getattr(hls_transcoder, '_last_analysis', None)
    if not analysis:
        analysis = hls_transcoder.analyze_media(full_video_path) or {}
    embedded = analysis.get('embedded_subtitles', [])

    # Mapa por stream_index para enriquecer etiquetas de .srt extraídos por subti.py y evitar duplicados
    ext_by_stream_idx = {
        s['stream_index']: s for s in subs if s.get('stream_index') is not None
    }

    for emb in embedded:
        emb_stream_idx = emb.get('stream_index')
        if emb_stream_idx is not None and emb_stream_idx in ext_by_stream_idx:
            # Ya existe el archivo .srt extraído en disco para este stream_index:
            # conservar el .srt externo (instantáneo) y enriquecer su título si el MKV tenía etiqueta (ej. Forzados/Completos)
            emb_title = (emb.get('title') or '').strip()
            if emb_title:
                ext_by_stream_idx[emb_stream_idx]['title'] = f"{emb_title} (SRT)"
            if ext_by_stream_idx[emb_stream_idx].get('language') == 'und' and emb.get('language'):
                ext_by_stream_idx[emb_stream_idx]['language'] = emb.get('language')
            continue

        sub_idx = emb.get('sub_index', 0)
        if media_id and token:
            sub_url = f"/api/hls/subtitle/{sub_idx}.vtt?id={media_id}&token={token}"
        elif video_rel_path:
            from urllib.parse import quote
            sub_url = f"/api/hls/subtitle/{sub_idx}.vtt?file={quote(video_rel_path)}"
        else:
            continue
        subs.append({
            "language": emb.get("language", "und"),
            "stream_index": emb_stream_idx,
            "title": emb.get("title", f"Subtítulo {sub_idx + 1}"),
            "url": sub_url,
            "external": False
        })
    return subs


@hls_bp.route('/api/hls/subtitle/<int:sub_index>.vtt')
def serve_embedded_subtitle(sub_index):
    """Extrae al vuelo un subtítulo incrustado (SRT/ASS/VTT) del MKV/MP4 a WebVTT y lo cachea."""
    import sqlite3
    import time as _time
    from urllib.parse import unquote

    media_id = request.args.get('id')
    token = request.args.get('token')
    video_path = request.args.get('file')

    if media_id and token:
        token_data = state.STREAM_TOKENS.get(token)
        if not token_data or _time.time() > token_data.get('expires', 0):
            return "Token inválido o expirado", 403
        try:
            conn = sqlite3.connect(os.path.join(config.DOWNLOAD_FOLDER, 'kraken.db'))
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT rel_path FROM media WHERE id = ?", (media_id,)).fetchone()
            conn.close()
            if not row:
                return "Media not found", 404
            video_path = row['rel_path']
        except Exception as e:
            return f"DB error: {e}", 500
    elif video_path:
        video_path = unquote(video_path)
    else:
        return "Missing parameters", 400

    video_path = video_path.lstrip('/\\')
    full_video_path = os.path.join(config.DOWNLOAD_FOLDER, video_path)
    if not os.path.isfile(full_video_path):
        return "File not found", 404

    subs_cache_dir = os.path.join(config.HLS_TEMP_DIR, "subs_cache")
    os.makedirs(subs_cache_dir, exist_ok=True)
    cache_key = hashlib.md5(f"{full_video_path}:{sub_index}".encode('utf-8', errors='ignore')).hexdigest()
    cached_vtt = os.path.join(subs_cache_dir, f"{cache_key}.vtt")

    if not os.path.isfile(cached_vtt) or os.path.getsize(cached_vtt) == 0:
        cmd = [
            config.FFMPEG_PATH, "-y", "-hide_banner", "-loglevel", "error",
            "-i", full_video_path,
            "-map", f"0:s:{sub_index}",
            "-f", "webvtt",
            cached_vtt
        ]
        try:
            kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=45, **kwargs)
        except Exception as e:
            print(f"[HLS Sub] Error extrayendo subtítulo {sub_index}: {e}")
            return "Error extracting subtitle", 500

    if not os.path.isfile(cached_vtt) or os.path.getsize(cached_vtt) == 0:
        return "Subtitle empty or unsupported", 404

    resp = send_file(cached_vtt, mimetype='text/vtt; charset=utf-8', conditional=True)
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp


@hls_bp.route('/api/hls/play')
def play_hls():
    import sqlite3
    import time as _time
    from urllib.parse import unquote

    media_id = request.args.get('id')
    token = request.args.get('token')
    video_path = request.args.get('file')  # Fallback legacy
    session_id = request.args.get('sid')
    audio_track_raw = request.args.get('audio_track')
    start_raw = request.args.get('start')
    hls_mode = (config.HLS_MODE or 'stream').strip().lower()

    if not session_id:
        return jsonify({"error": "Missing session_id"}), 400

    start_time = 0.0
    if start_raw is not None:
        try:
            start_time = max(0.0, float(start_raw))
        except (TypeError, ValueError):
            start_time = 0.0

    # --- Nueva ruta: por ID + Token (Plex-style) ---
    if media_id and token:
        token_data = state.STREAM_TOKENS.get(token)
        if not token_data:
            return jsonify({"error": "Token inválido o expirado"}), 403
        if str(token_data.get('id')) != str(media_id):
            return jsonify({"error": "Token no corresponde al media solicitado"}), 403
        if _time.time() > token_data.get('expires', 0):
            del state.STREAM_TOKENS[token]
            return jsonify({"error": "Token expirado"}), 403
        if 'sessions' not in token_data:
            token_data['sessions'] = []
        if session_id not in token_data['sessions']:
            token_data['sessions'].append(session_id)

        # Buscar ruta real en la DB
        try:
            conn = sqlite3.connect(os.path.join(config.DOWNLOAD_FOLDER, 'kraken.db'))
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute("SELECT rel_path, duration_sec FROM media WHERE id = ?", (media_id,))
            row = c.fetchone()
            conn.close()
            if not row:
                return jsonify({"error": f"ID {media_id} no encontrado en DB"}), 404
            video_path = row['rel_path']
            video_duration = row['duration_sec'] or 0
        except Exception as e:
            return jsonify({"error": f"DB error: {str(e)}"}), 500

    # --- Fallback legacy: por file path (también consulta duración en DB si existe) ---
    elif video_path:
        video_path = unquote(video_path).lstrip('/\\')
        video_duration = 0
        try:
            conn = sqlite3.connect(os.path.join(config.DOWNLOAD_FOLDER, 'kraken.db'))
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT id, duration_sec FROM media WHERE rel_path = ?", (video_path.replace('\\', '/'),)).fetchone()
            conn.close()
            if row:
                video_duration = row['duration_sec'] or 0
                if not media_id:
                    media_id = row['id']
        except Exception:
            pass
    else:
        return jsonify({"error": "Missing id+token or file parameter"}), 400

    video_path = video_path.lstrip('/\\')

    # Construir la ruta completa al video
    full_video_path = os.path.join(config.DOWNLOAD_FOLDER, video_path)

    if not os.path.exists(full_video_path):
        return jsonify({"error": f"File not found: {full_video_path}"}), 404

    # Cambiar audio o reiniciar sesión: detener sesión anterior si existe
    if session_id in state.HLS_SESSIONS:
        existing = state.HLS_SESSIONS[session_id]
        if existing.get('process'):
            try:
                existing['process'].terminate()
                existing['process'].wait(timeout=5)
            except Exception as e:
                print(f"[HLS] Terminando proceso anterior: {e}")

    session_dir = os.path.join(config.HLS_TEMP_DIR, session_id)

    # Limpiar solo si existe, para fresh start
    if os.path.exists(session_dir):
        try:
            shutil.rmtree(session_dir)
        except Exception:
            pass
    os.makedirs(session_dir, exist_ok=True)
    
    print(f"[HLS] Iniciando transcodificación: {full_video_path}")
    print(f"[HLS] Directorio de salida: {session_dir}")
    print(f"[HLS] FFMPEG_PATH: {config.FFMPEG_PATH}")
    
    selected_audio_track = None
    if audio_track_raw is not None:
        try:
            selected_audio_track = int(audio_track_raw)
        except (TypeError, ValueError):
            selected_audio_track = None

    process, audio_tracks, selected_audio_track, hls_error = hls_transcoder.start_hls_session(
        full_video_path,
        session_dir,
        selected_audio_index=selected_audio_track,
        hls_mode=hls_mode,
        hls_segment_type=config.HLS_SEGMENT_TYPE,
        start_time=start_time,
    )
    all_subs = _build_combined_subtitles(full_video_path, media_id=media_id, token=token, video_rel_path=video_path)
    # Preferir subtítulo externo como activo por defecto; los incrustados quedan disponibles en el menú
    external_subs_only = [s for s in all_subs if s.get('external')]
    subtitle_url = external_subs_only[0]["url"] if external_subs_only else None
    
    if process == "DIRECT":
        # Evadimos FFmpeg por completo y enviamos a reproducir de forma nativa
        return jsonify({
            "url": f"/descargas/{video_path}",
            "direct_play": True,
            "duration": video_duration,
            "audio_tracks": audio_tracks,
            "selected_audio_track": selected_audio_track,
            "session_id": session_id,
            "subtitle_url": subtitle_url,
            "subtitle_tracks": all_subs
        })
        
    if process is None:
        return jsonify({"error": hls_error or "Failed to start transcoding"}), 500

    ready, ready_error = _wait_hls_ready(
        process=process,
        session_dir=session_dir,
        video_duration=video_duration,
        hls_mode=hls_mode,
        log_prefix='[HLS]'
    )
    if not ready:
        try:
            if process.poll() is None:
                process.terminate()
        except Exception:
            pass
        return jsonify({"error": ready_error or "Timeout esperando generacion HLS"}), 500
    
    state.HLS_SESSIONS[session_id] = {
        "path": session_dir,
        "process": process,
        "last_activity": state.time_module.time(),
        "audio_tracks": audio_tracks,
        "current_video": full_video_path,
        "duration": video_duration
    }
    
    if subtitle_url:
        print(f"[HLS] Subtítulo detectado: {subtitle_url}")
    
    response_data = {
        "url": f"/hls/{session_id}/playlist.m3u8",
        "duration": video_duration,
        "start_time": start_time,
        "audio_tracks": audio_tracks,
        "selected_audio_track": selected_audio_track,
        "session_id": session_id,
        "subtitle_url": subtitle_url,
        "subtitle_tracks": all_subs
    }
    if token:
        response_data["token"] = token
    return jsonify(response_data)

@hls_bp.route('/api/hls/reconnect', methods=['POST'])
def reconnect_hls():
    """Reconectar una sesión HLS expirada o caída.
    El frontend envía el session_id antiguo y/o token + media_id para recuperar el video.
    """
    import sqlite3
    import time as _time
    import uuid as _uuid

    data = request.get_json(silent=True) or {}
    old_session_id = data.get('old_session_id')
    token = data.get('token')
    media_id = data.get('media_id')
    audio_track = data.get('audio_track')
    start_time = max(0.0, float(data.get('start_time') or 0.0))
    new_session_id = data.get('new_session_id') or str(_uuid.uuid4())
    hls_mode = (config.HLS_MODE or 'stream').strip().lower()

    # --- Recuperar video_path del token o de la sesión antigua ---
    video_path = None
    full_video_path = None
    video_duration = 0

    token_data = None
    if old_session_id and old_session_id in state.HLS_SESSIONS:
        old_session = state.HLS_SESSIONS[old_session_id]
        full_video_path = old_session.get('current_video')
        video_duration = old_session.get('duration', 0)
        if full_video_path:
            video_path = os.path.relpath(full_video_path, config.DOWNLOAD_FOLDER).replace('\\', '/')

    if not full_video_path and token:
        token_data = state.STREAM_TOKENS.get(token)
        if not token_data or _time.time() > token_data.get('expires', 0):
            return jsonify({"error": "Token inválido o expirado"}), 403
        if media_id and str(token_data.get('id')) != str(media_id):
            return jsonify({"error": "Token no corresponde al media solicitado"}), 403

        # Buscar ruta en DB
        try:
            conn = sqlite3.connect(os.path.join(config.DOWNLOAD_FOLDER, 'kraken.db'))
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute("SELECT rel_path, duration_sec FROM media WHERE id = ?", (media_id,))
            row = c.fetchone()
            conn.close()
            if row:
                video_path = row['rel_path'].lstrip('/\\')
                video_duration = row['duration_sec'] or 0
                full_video_path = os.path.join(config.DOWNLOAD_FOLDER, video_path)
        except Exception as e:
            return jsonify({"error": f"DB error: {str(e)}"}), 500

    if not full_video_path or not os.path.exists(full_video_path):
        return jsonify({"error": "Video no encontrado o eliminado"}), 404

    # --- Limpiar sesión anterior si aún existe ---
    if old_session_id and old_session_id in state.HLS_SESSIONS:
        print(f"[HLS Reconnect] Limpiando sesión antigua: {old_session_id}")
        stop_hls_session(old_session_id)

    # --- Crear nueva sesión HLS ---
    session_dir = os.path.join(config.HLS_TEMP_DIR, new_session_id)
    if os.path.exists(session_dir):
        shutil.rmtree(session_dir)
    os.makedirs(session_dir, exist_ok=True)

    print(f"[HLS Reconnect] Reconectando: {full_video_path}")

    selected_audio_track = None
    if audio_track is not None:
        try:
            selected_audio_track = int(audio_track)
        except (TypeError, ValueError):
            selected_audio_track = None

    process, audio_tracks, selected_audio_track, hls_error = hls_transcoder.start_hls_session(
        full_video_path,
        session_dir,
        selected_audio_index=selected_audio_track,
        hls_mode=hls_mode,
        hls_segment_type=config.HLS_SEGMENT_TYPE,
        start_time=start_time,
    )

    all_subs = _build_combined_subtitles(full_video_path, media_id=media_id, token=token, video_rel_path=video_path)
    external_subs_only = [s for s in all_subs if s.get('external')]
    subtitle_url = external_subs_only[0]["url"] if external_subs_only else None

    if process == "DIRECT":
        return jsonify({
            "url": f"/descargas/{video_path}",
            "direct_play": True,
            "duration": video_duration,
            "audio_tracks": audio_tracks,
            "selected_audio_track": selected_audio_track,
            "session_id": new_session_id,
            "subtitle_url": subtitle_url,
            "subtitle_tracks": all_subs,
            "reconnected": True
        })

    if process is None:
        return jsonify({"error": hls_error or "Failed to start transcoding"}), 500

    ready, ready_error = _wait_hls_ready(
        process=process,
        session_dir=session_dir,
        video_duration=video_duration,
        hls_mode=hls_mode,
        log_prefix='[HLS Reconnect]'
    )
    if not ready:
        try:
            if process.poll() is None:
                process.terminate()
        except Exception:
            pass
        return jsonify({"error": ready_error or "Timeout esperando generacion HLS"}), 500

    if token_data is not None:
        if 'sessions' not in token_data:
            token_data['sessions'] = []
        token_data['sessions'].append(new_session_id)

    state.HLS_SESSIONS[new_session_id] = {
        "path": session_dir,
        "process": process,
        "last_activity": state.time_module.time(),
        "audio_tracks": audio_tracks,
        "current_video": full_video_path,
        "duration": video_duration
    }

    print(f"[HLS Reconnect] Sesión nueva lista: {new_session_id}")

    return jsonify({
        "url": f"/hls/{new_session_id}/playlist.m3u8",
        "duration": video_duration,
        "start_time": start_time,
        "audio_tracks": audio_tracks,
        "selected_audio_track": selected_audio_track,
        "session_id": new_session_id,
        "subtitle_url": subtitle_url,
        "subtitle_tracks": all_subs,
        "reconnected": True,
        "token": token
    })


@hls_bp.route('/api/hls/status')
def hls_status():
    session_id = request.args.get('sid')
    if not session_id or session_id not in state.HLS_SESSIONS:
        return jsonify({"ready": False, "segments": 0, "alive": False})

    session = state.HLS_SESSIONS[session_id]
    session_dir = session.get('path', '')

    if not os.path.exists(session_dir):
        return jsonify({"ready": False, "segments": 0, "alive": False})

    segment_files = [f for f in os.listdir(session_dir) if f.endswith(('.ts', '.m4s'))]
    segment_count = len(segment_files)
    ready = segment_count >= 2

    return jsonify({"ready": ready, "segments": segment_count, "alive": True})


@hls_bp.route('/api/hls/stop', methods=['POST'])
def stop_hls():
    session_id = request.args.get('sid')
    
    if not session_id:
        return jsonify({"error": "Missing session_id"}), 400
    
    stop_hls_session(session_id)
    return jsonify({"success": True})


def stop_hls_session(session_id):
    if session_id in state.HLS_SESSIONS:
        session = state.HLS_SESSIONS[session_id]
        
        if session.get('process'):
            try:
                session['process'].terminate()
                session['process'].wait(timeout=5)
            except Exception as e:
                print(f"Error terminating FFmpeg: {e}")
        
        if session.get('path') and os.path.exists(session['path']):
            try:
                shutil.rmtree(session['path'])
            except Exception:
                try:
                    state.time_module.sleep(0.2)
                    shutil.rmtree(session['path'], ignore_errors=True)
                except Exception as e:
                    print(f"Error deleting HLS temp folder: {e}")
        
        del state.HLS_SESSIONS[session_id]


@hls_bp.route('/hls/<session_id>/<path:filename>')
def serve_hls_segment(session_id, filename):
    import time as _time
    
    cast_token = request.args.get('token')
    
    if session_id not in state.HLS_SESSIONS:
        if not cast_token:
            return "Session not found", 404
        token_data = state.STREAM_TOKENS.get(cast_token)
        if not token_data or _time.time() > token_data.get('expires', 0):
            return "Token inválido o expirado", 403
        if session_id not in token_data.get('sessions', []):
            return "Token no válido para esta sesión", 403
    
    session = state.HLS_SESSIONS.get(session_id)
    if session:
        session['last_activity'] = state.time_module.time()
    
    if filename == 'playlist.m3u8':
        file_path = os.path.join(session['path'], "playlist.m3u8") if session else None
        if not file_path or not os.path.exists(file_path):
            return "File not found", 404
    else:
        file_path = os.path.join(session['path'], filename) if session else None
        if not file_path or not os.path.exists(file_path):
            return "File not found", 404
    
    if filename.endswith('.m3u8'):
        mimetype = 'application/vnd.apple.mpegurl'
        if cast_token:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            lines = content.strip().split('\n')
            rewritten = []
            for line in lines:
                stripped = line.strip()
                if stripped and not stripped.startswith('#'):
                    separator = '&' if '?' in stripped else '?'
                    line = f"{stripped}{separator}token={cast_token}"
                rewritten.append(line)
            response = Response('\n'.join(rewritten), mimetype=mimetype)
        else:
            response = send_file(file_path, mimetype=mimetype, conditional=False, etag=False, max_age=0)
    elif filename.endswith('.ts'):
        mimetype = 'video/MP2T'
        response = send_file(file_path, mimetype=mimetype, conditional=False, etag=False, max_age=0)
    elif filename.endswith('.m4s'):
        mimetype = 'video/iso.segment'
        response = send_file(file_path, mimetype=mimetype, conditional=False, etag=False, max_age=0)
    elif filename.endswith('.mp4'):
        mimetype = 'video/mp4'
        response = send_file(file_path, mimetype=mimetype, conditional=False, etag=False, max_age=0)
    else:
        mimetype = 'application/octet-stream'
        response = send_file(file_path, mimetype=mimetype)
    
    response.headers['Access-Control-Allow-Origin'] = '*'
    if filename.endswith(('.m3u8', '.ts', '.m4s', '.mp4')):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response


def cleanup_old_hls_sessions(max_inactive_seconds=1200):
    while True:
        try:
            now = state.time_module.time()
            to_remove = []

            for sid, data in list(state.HLS_SESSIONS.items()):
                if now - data.get('last_activity', 0) > max_inactive_seconds:
                    to_remove.append(sid)

            for sid in to_remove:
                print(f"Limpiando sesión HLS inactiva: {sid} (>20 min sin actividad)")
                stop_hls_session(sid)

        except Exception as e:
            print(f"Error en cleanup de HLS: {e}")

        state.time_module.sleep(60)
