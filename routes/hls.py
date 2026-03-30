from flask import Blueprint, request, send_file, jsonify
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
    video_path = request.args.get('file')
    session_id = request.args.get('sid')
    audio_track_raw = request.args.get('audio_track')
    
    if not video_path or not session_id:
        return jsonify({"error": "Missing file or session_id"}), 400
    
    video_path = video_path.lstrip('/\\')
    
    # Construir la ruta completa al video
    full_video_path = os.path.join(config.DOWNLOAD_FOLDER, video_path)
    
    if not os.path.exists(full_video_path):
        return jsonify({"error": f"File not found: {full_video_path}"}), 404
    
    if session_id in state.HLS_SESSIONS:
        stop_hls_session(session_id)
    
    session_dir = os.path.join(config.HLS_TEMP_DIR, session_id)
    
    if os.path.exists(session_dir):
        shutil.rmtree(session_dir)
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
        selected_audio_index=selected_audio_track
    )
    external_subs = _find_external_subtitles(full_video_path)
    subtitle_url = external_subs[0]["url"] if external_subs else None
    
    if process == "DIRECT":
        # Evadimos FFmpeg por completo y enviamos a reproducir de forma nativa
        return jsonify({
            "url": f"/descargas/{video_path}",
            "direct_play": True,
            "audio_tracks": audio_tracks,
            "selected_audio_track": selected_audio_track,
            "session_id": session_id,
            "subtitle_url": subtitle_url,
            "subtitle_tracks": external_subs
        })
        
    if process is None:
        return jsonify({"error": hls_error or "Failed to start transcoding"}), 500
        
    # Esperar hasta que FFmpeg genere el archivo m3u8 (máximo 15 segundos)
    playlist_path = os.path.join(session_dir, "playlist.m3u8")
    import time
    for _ in range(30):
        if os.path.exists(playlist_path):
            break
        # Verificar si el proceso murió inesperadamente
        if process.poll() is not None:
            stdout, stderr = process.communicate()
            error_msg = stderr.decode() if stderr else "Unknown error"
            print(f"[HLS] FFmpeg murió durante generación inicial:\n{error_msg}")
            return jsonify({"error": f"FFmpeg error: {error_msg}"}), 500
        time.sleep(0.5)
        
    if not os.path.exists(playlist_path):
        process.terminate()
        return jsonify({"error": "Timeout esperando generación HLS"}), 500
    
    state.HLS_SESSIONS[session_id] = {
        "path": session_dir,
        "process": process,
        "last_activity": state.time_module.time(),
        "audio_tracks": audio_tracks,
        "current_video": full_video_path
    }
    
    if subtitle_url:
        print(f"[HLS] Subtítulo detectado: {subtitle_url}")
    
    return jsonify({
        "url": f"/hls/{session_id}/playlist.m3u8",
        "audio_tracks": audio_tracks,
        "selected_audio_track": selected_audio_track,
        "session_id": session_id,
        "subtitle_url": subtitle_url,
        "subtitle_tracks": external_subs
    })

@hls_bp.route('/api/hls/status')
def hls_status():
    session_id = request.args.get('sid')
    if not session_id or session_id not in state.HLS_SESSIONS:
        return jsonify({"ready": False, "segments": 0})
    
    session = state.HLS_SESSIONS[session_id]
    session_dir = session.get('path', '')
    
    if not os.path.exists(session_dir):
        return jsonify({"ready": False, "segments": 0})
    
    ts_files = [f for f in os.listdir(session_dir) if f.endswith('.ts')]
    segment_count = len(ts_files)
    ready = segment_count >= 2  # ~12 segundos (2 segmentos x 6s)
    
    return jsonify({"ready": ready, "segments": segment_count})


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
    if session_id not in state.HLS_SESSIONS:
        return "Session not found", 404
    
    session = state.HLS_SESSIONS[session_id]
    session['last_activity'] = state.time_module.time()
    
    if filename == 'playlist.m3u8':
        file_path = os.path.join(session['path'], "playlist.m3u8")
    else:
        file_path = os.path.join(session['path'], filename)
    
    if not os.path.exists(file_path):
        return "File not found", 404
    
    if filename.endswith('.m3u8'):
        mimetype = 'application/vnd.apple.mpegurl'
    elif filename.endswith('.ts'):
        mimetype = 'video/MP2T'
    else:
        mimetype = 'application/octet-stream'
    
    response = send_file(file_path, mimetype=mimetype)
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response


def cleanup_old_hls_sessions(max_inactive_seconds=600):
    while True:
        try:
            now = state.time_module.time()
            to_remove = []
            
            for sid, data in list(state.HLS_SESSIONS.items()):
                if now - data.get('last_activity', 0) > max_inactive_seconds:
                    to_remove.append(sid)
            
            for sid in to_remove:
                print(f"Limpiando sesión HLS inactiva: {sid}")
                stop_hls_session(sid)
                
        except Exception as e:
            print(f"Error en cleanup de HLS: {e}")
        
        state.time_module.sleep(60)
