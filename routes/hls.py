from flask import Blueprint, request, send_file, jsonify, Response
import os
import re
import shutil
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
                error_msg = stderr.decode() if stderr else "Unknown error"
                print(f"{log_prefix} FFmpeg fallo en VOD (exit {code}):\n{error_msg}")
                return False, f"FFmpeg error: {error_msg}"
            _time.sleep(1)

        if process.poll() is None:
            try:
                process.terminate()
            except Exception:
                pass
            return False, "Timeout esperando generacion HLS VOD completa"

        if not os.path.exists(playlist_path):
            return False, "No se genero playlist.m3u8 en modo VOD"
        ts_files = [f for f in os.listdir(session_dir) if f.endswith('.ts')]
        if len(ts_files) < 1:
            return False, "No se generaron segmentos .ts en modo VOD"
        return True, None

    # STREAM mode (actual): arranque rapido con playlist + 1 segmento.
    for _ in range(50):
        if os.path.exists(playlist_path):
            ts_files = [f for f in os.listdir(session_dir) if f.endswith('.ts')]
            if len(ts_files) >= 1:
                return True, None
        if process.poll() is not None:
            stdout, stderr = process.communicate()
            error_msg = stderr.decode() if stderr else "Unknown error"
            print(f"{log_prefix} FFmpeg murio durante generacion inicial:\n{error_msg}")
            return False, f"FFmpeg error: {error_msg}"
        _time.sleep(0.5)

    return False, "Timeout esperando generacion HLS (playlist/segmentos)"

def _infer_subtitle_language(video_base, subtitle_name):
    name_no_ext = os.path.splitext(subtitle_name)[0]
    suffix = name_no_ext[len(video_base):].strip(" ._-").lower() if name_no_ext.lower().startswith(video_base.lower()) else ''
    token = suffix.split('.')[-1] if suffix else ''
    mapping = {
        'es': 'spa', 'spa': 'spa', 'esla': 'spa', 'lat': 'spa', 'la': 'spa',
        'en': 'eng', 'eng': 'eng',
        'jp': 'jpn', 'jpn': 'jpn',
        'pt': 'por', 'por': 'por',
        'fr': 'fra', 'fra': 'fra',
        'de': 'deu', 'deu': 'deu',
        'it': 'ita', 'ita': 'ita',
    }
    return mapping.get(token, 'und')

def _subtitle_matches_video_base(video_base, subtitle_name):
    subtitle_base = os.path.splitext(subtitle_name)[0].lower()
    video_base_l = video_base.lower()
    if subtitle_base == video_base_l:
        return True

    # Accept common suffix styles: ".es", "-subtitulos", "_subs", etc.
    escaped = re.escape(video_base_l)
    return re.match(rf"^{escaped}([._\- ].+)$", subtitle_base) is not None

def _find_external_subtitles(full_video_path):
    video_dir = os.path.dirname(full_video_path)
    video_filename = os.path.basename(full_video_path)
    video_base = os.path.splitext(video_filename)[0]
    sub_dirs = [video_dir, os.path.join(video_dir, 'subs'), os.path.join(video_dir, 'subtitles')]
    supported_exts = {'.srt', '.vtt'}
    found = []
    seen = set()

    for sub_dir in sub_dirs:
        if not os.path.isdir(sub_dir):
            continue

        for entry in os.listdir(sub_dir):
            ext = os.path.splitext(entry)[1].lower()
            if ext not in supported_exts:
                continue

            if not _subtitle_matches_video_base(video_base, entry):
                continue

            full_sub_path = os.path.join(sub_dir, entry)
            rel_sub_path = os.path.relpath(full_sub_path, config.DOWNLOAD_FOLDER).replace('\\', '/')
            if rel_sub_path in seen:
                continue
            seen.add(rel_sub_path)

            language = _infer_subtitle_language(video_base, entry)
            found.append({
                "language": language,
                "title": entry,
                "url": f'/descargas/{rel_sub_path}',
                "external": True
            })

    return found

@hls_bp.route('/api/hls/play')
def play_hls():
    import sqlite3
    import time as _time

    media_id = request.args.get('id')
    token = request.args.get('token')
    video_path = request.args.get('file')  # Fallback legacy
    session_id = request.args.get('sid')
    audio_track_raw = request.args.get('audio_track')
    hls_mode = (config.HLS_MODE or 'stream').strip().lower()

    if not session_id:
        return jsonify({"error": "Missing session_id"}), 400

    # --- Nueva ruta: por ID + Token (Plex-style) ---
    if media_id and token:
        token_data = state.STREAM_TOKENS.get(token)
        if not token_data:
            return jsonify({"error": "Token invÃ¡lido o expirado"}), 403
        if str(token_data.get('id')) != str(media_id):
            return jsonify({"error": "Token no corresponde al media solicitado"}), 403
        if _time.time() > token_data.get('expires', 0):
            del state.STREAM_TOKENS[token]
            return jsonify({"error": "Token expirado"}), 403
        if 'sessions' not in token_data:
            token_data['sessions'] = []
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

    # --- Fallback legacy: por file path ---
    elif video_path:
        video_duration = 0  # Legacy no consulta DB, duraciÃ³n desconocida
    else:
        return jsonify({"error": "Missing id+token or file parameter"}), 400

    video_path = video_path.lstrip('/\\')

    # Construir la ruta completa al video
    full_video_path = os.path.join(config.DOWNLOAD_FOLDER, video_path)

    if not os.path.exists(full_video_path):
        return jsonify({"error": f"File not found: {full_video_path}"}), 404

    # Cambiar audio: detener sesiÃ³n anterior si existe
    if session_id in state.HLS_SESSIONS:
        existing = state.HLS_SESSIONS[session_id]
        if existing.get('process'):
            try:
                existing['process'].terminate()
                existing['process'].wait(timeout=5)
            except Exception as e:
                print(f"[HLS] Terminando proceso anterior: {e}")
        # NO borrar session_dir inmediatamente - FFmpeg nuevo sobrescribirÃ¡

    session_dir = os.path.join(config.HLS_TEMP_DIR, session_id)

    # Limpiar solo si existe, para fresh start
    if os.path.exists(session_dir):
        try:
            shutil.rmtree(session_dir)
        except Exception:
            pass
    os.makedirs(session_dir, exist_ok=True)
    
    print(f"[HLS] Iniciando transcodificaciÃ³n: {full_video_path}")
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
        hls_mode=hls_mode
    )
    external_subs = _find_external_subtitles(full_video_path)
    subtitle_url = external_subs[0]["url"] if external_subs else None
    
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
            "subtitle_tracks": external_subs
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
        "current_video": full_video_path
    }
    
    if subtitle_url:
        print(f"[HLS] SubtÃ­tulo detectado: {subtitle_url}")
    
    response_data = {
        "url": f"/hls/{session_id}/playlist.m3u8",
        "duration": video_duration,
        "audio_tracks": audio_tracks,
        "selected_audio_track": selected_audio_track,
        "session_id": session_id,
        "subtitle_url": subtitle_url,
        "subtitle_tracks": external_subs
    }
    if token:
        response_data["token"] = token
    return jsonify(response_data)

@hls_bp.route('/api/hls/reconnect', methods=['POST'])
def reconnect_hls():
    """Reconectar una sesiÃ³n HLS expirada o caÃ­da.
    El frontend envÃ­a el session_id antiguo y/o token + media_id para recuperar el video.
    """
    import sqlite3
    import time as _time
    import uuid as _uuid

    data = request.get_json(silent=True) or {}
    old_session_id = data.get('old_session_id')
    token = data.get('token')
    media_id = data.get('media_id')
    audio_track = data.get('audio_track')
    new_session_id = data.get('new_session_id') or str(_uuid.uuid4())
    hls_mode = (config.HLS_MODE or 'stream').strip().lower()

    # --- Recuperar video_path del token o de la sesiÃ³n antigua ---
    video_path = None
    full_video_path = None

    token_data = None
    if old_session_id and old_session_id in state.HLS_SESSIONS:
        old_session = state.HLS_SESSIONS[old_session_id]
        full_video_path = old_session.get('current_video')
        if full_video_path:
            video_path = os.path.relpath(full_video_path, config.DOWNLOAD_FOLDER).replace('\\', '/')

    if not full_video_path and token:
        token_data = state.STREAM_TOKENS.get(token)
        if not token_data or _time.time() > token_data.get('expires', 0):
            return jsonify({"error": "Token invÃ¡lido o expirado"}), 403
        if media_id and str(token_data.get('id')) != str(media_id):
            return jsonify({"error": "Token no corresponde al media solicitado"}), 403

        # Buscar ruta en DB
        try:
            conn = sqlite3.connect(os.path.join(config.DOWNLOAD_FOLDER, 'kraken.db'))
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute("SELECT rel_path FROM media WHERE id = ?", (media_id,))
            row = c.fetchone()
            conn.close()
            if row:
                video_path = row['rel_path'].lstrip('/\\')
                full_video_path = os.path.join(config.DOWNLOAD_FOLDER, video_path)
        except Exception as e:
            return jsonify({"error": f"DB error: {str(e)}"}), 500

    if not full_video_path or not os.path.exists(full_video_path):
        return jsonify({"error": "Video no encontrado o eliminado"}), 404

    # --- Limpiar sesiÃ³n anterior si aÃºn existe ---
    if old_session_id and old_session_id in state.HLS_SESSIONS:
        print(f"[HLS Reconnect] Limpiando sesiÃ³n antigua: {old_session_id}")
        stop_hls_session(old_session_id)

    # --- Crear nueva sesiÃ³n HLS ---
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
        hls_mode=hls_mode
    )

    if process == "DIRECT":
        external_subs = _find_external_subtitles(full_video_path)
        subtitle_url = external_subs[0]["url"] if external_subs else None
        return jsonify({
            "url": f"/descargas/{video_path}",
            "direct_play": True,
            "audio_tracks": audio_tracks,
            "selected_audio_track": selected_audio_track,
            "session_id": new_session_id,
            "subtitle_url": subtitle_url,
            "subtitle_tracks": external_subs,
            "reconnected": True
        })

    if process is None:
        return jsonify({"error": hls_error or "Failed to start transcoding"}), 500

    ready, ready_error = _wait_hls_ready(
        process=process,
        session_dir=session_dir,
        video_duration=0,
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

    external_subs = _find_external_subtitles(full_video_path)
    subtitle_url = external_subs[0]["url"] if external_subs else None

    state.HLS_SESSIONS[new_session_id] = {
        "path": session_dir,
        "process": process,
        "last_activity": state.time_module.time(),
        "audio_tracks": audio_tracks,
        "current_video": full_video_path
    }

    print(f"[HLS Reconnect] SesiÃ³n nueva lista: {new_session_id}")

    return jsonify({
        "url": f"/hls/{new_session_id}/playlist.m3u8",
        "audio_tracks": audio_tracks,
        "selected_audio_track": selected_audio_track,
        "session_id": new_session_id,
        "subtitle_url": subtitle_url,
        "subtitle_tracks": external_subs,
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

    ts_files = [f for f in os.listdir(session_dir) if f.endswith('.ts')]
    segment_count = len(ts_files)
    ready = segment_count >= 2  # ~12 segundos (2 segmentos x 6s)

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
            return "Token invÃ¡lido o expirado", 403
        if session_id not in token_data.get('sessions', []):
            return "Token no vÃ¡lido para esta sesiÃ³n", 403
    
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
            response = send_file(file_path, mimetype=mimetype)
    elif filename.endswith('.ts'):
        mimetype = 'video/MP2T'
        response = send_file(file_path, mimetype=mimetype)
    else:
        mimetype = 'application/octet-stream'
        response = send_file(file_path, mimetype=mimetype)
    
    response.headers['Access-Control-Allow-Origin'] = '*'
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
                print(f"Limpiando sesiÃ³n HLS inactiva: {sid} (>20 min sin actividad)")
                stop_hls_session(sid)

        except Exception as e:
            print(f"Error en cleanup de HLS: {e}")

        state.time_module.sleep(60)
