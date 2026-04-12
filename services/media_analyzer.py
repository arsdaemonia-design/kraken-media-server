import subprocess
import json
import os
import config
import state

def get_video_streams(video_path):
    """Detecta pistas de audio y subtítulos usando ffprobe"""
    try:
        result = subprocess.run([
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            video_path
        ], capture_output=True, text=True, timeout=config.FFPROBE_TIMEOUT)

        data = json.loads(result.stdout)
        streams = data.get('streams', [])

        audio_tracks = []
        subtitle_tracks = []

        for idx, stream in enumerate(streams):
            codec_type = stream.get('codec_type')

            if codec_type == 'audio':
                audio_tracks.append({
                    'index': idx,
                    'language': stream.get('tags', {}).get('language', 'und'),
                    'title': stream.get('tags', {}).get('title', f'Audio {len(audio_tracks) + 1}'),
                    'codec': stream.get('codec_name', 'unknown')
                })

            elif codec_type == 'subtitle':
                subtitle_tracks.append({
                    'index': idx,
                    'language': stream.get('tags', {}).get('language', 'und'),
                    'title': stream.get('tags', {}).get('title', f'Subtitle {len(subtitle_tracks) + 1}'),
                    'codec': stream.get('codec_name', 'unknown')
                })

        return {
            'audio': audio_tracks,
            'subtitles': subtitle_tracks
        }

    except Exception as e:
        print(f"Error detectando streams: {e}")
        return {'audio': [], 'subtitles': []}


def extract_video_metadata(file_path):
    """
    Extrae metadata técnico completo de un video usando ffprobe.
    Retorna dict con las columnas de la tabla media (v4.92).
    """
    result = {
        'video_resolution': None,
        'video_codec': None,
        'audio_codec': None,
        'audio_channels': 0,
        'audio_tracks': None,      # JSON string
        'subtitle_tracks': None,   # JSON string
        'bit_rate': 0,
        'aspect_ratio': None,
        'frame_rate': 0.0,
        'file_format': None,
        'duration_sec': 0,         # Duración del video en segundos
    }

    try:
        kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
        ffprobe_result = subprocess.run([
            config.FFPROBE_PATH if hasattr(config, 'FFPROBE_PATH') else 'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            '-show_format',
            file_path
        ], capture_output=True, text=True, timeout=config.FFPROBE_TIMEOUT, **kwargs)

        data = json.loads(ffprobe_result.stdout)
        streams = data.get('streams', [])
        fmt = data.get('format', {})

        # File format (container)
        result['file_format'] = os.path.splitext(file_path)[1].lower().lstrip('.')
        if fmt.get('format_name'):
            # format_name puede ser "matroska,webm" → tomar el primero
            result['file_format'] = fmt['format_name'].split(',')[0].strip()

        # Bitrate total del archivo
        if fmt.get('bit_rate'):
            try:
                result['bit_rate'] = int(int(fmt['bit_rate']) / 1000)  # bps → kbps
            except (ValueError, TypeError):
                pass

        # Duración del video (desde format, más confiable que streams individuales)
        if fmt.get('duration'):
            try:
                result['duration_sec'] = int(float(fmt['duration']))
            except (ValueError, TypeError):
                pass

        video_stream = None
        audio_stream = None  # Primera pista de audio (para audio_channels y audio_codec)
        audio_tracks_list = []
        subtitle_tracks_list = []

        for stream in streams:
            codec_type = stream.get('codec_type', '')
            codec_name = stream.get('codec_name', 'unknown')

            if codec_type == 'video' and video_stream is None:
                video_stream = stream
                result['video_codec'] = codec_name

                # Resolution (altura)
                height = stream.get('height', 0)
                width = stream.get('width', 0)
                if height > 0:
                    if height <= 480:
                        result['video_resolution'] = '480p'
                    elif height <= 720:
                        result['video_resolution'] = '720p'
                    elif height <= 1080:
                        result['video_resolution'] = '1080p'
                    elif height <= 1440:
                        result['video_resolution'] = '1440p'
                    elif height <= 2160:
                        result['video_resolution'] = '4K'
                    else:
                        result['video_resolution'] = f'{height}p'

                # Aspect ratio
                if width > 0 and height > 0:
                    # Calcular ratio simplificado
                    sar = stream.get('sample_aspect_ratio', '1:1')
                    dar = stream.get('display_aspect_ratio', '')
                    if dar and ':' in dar:
                        result['aspect_ratio'] = dar
                    else:
                        # Calcular desde dimensiones
                        from math import gcd
                        g = gcd(width, height)
                        if g > 0:
                            ar_w, ar_h = width // g, height // g
                            # Mapear a ratios comunes
                            ratio = ar_w / ar_h if ar_h > 0 else 0
                            if 1.7 <= ratio <= 1.8:
                                result['aspect_ratio'] = '16:9'
                            elif 2.2 <= ratio <= 2.4:
                                result['aspect_ratio'] = '2.35:1'
                            elif 1.3 <= ratio <= 1.4:
                                result['aspect_ratio'] = '4:3'
                            else:
                                result['aspect_ratio'] = f'{ar_w}:{ar_h}'

                # Frame rate
                frame_rate_str = stream.get('r_frame_rate', '')
                if '/' in frame_rate_str:
                    try:
                        num, den = map(int, frame_rate_str.split('/'))
                        if den > 0:
                            result['frame_rate'] = round(num / den, 3)
                    except (ValueError, ZeroDivisionError):
                        pass

            elif codec_type == 'audio':
                language = stream.get('tags', {}).get('language', 'und')
                title = stream.get('tags', {}).get('title', f'Audio {len(audio_tracks_list) + 1}')
                
                audio_tracks_list.append({
                    'language': language,
                    'title': title,
                    'codec': codec_name,
                    'channels': stream.get('channels', 2),
                    'sample_rate': stream.get('sample_rate', '48000'),
                })

                # Primera pista → info general
                if audio_stream is None:
                    audio_stream = stream
                    result['audio_codec'] = codec_name
                    result['audio_channels'] = stream.get('channels', 2)

            elif codec_type == 'subtitle':
                language = stream.get('tags', {}).get('language', 'und')
                title = stream.get('tags', {}).get('title', f'Subtitle {len(subtitle_tracks_list) + 1}')
                
                subtitle_tracks_list.append({
                    'language': language,
                    'title': title,
                    'codec': codec_name,
                })

        # Serializar listas a JSON
        if audio_tracks_list:
            result['audio_tracks'] = json.dumps(audio_tracks_list, ensure_ascii=False)
        if subtitle_tracks_list:
            result['subtitle_tracks'] = json.dumps(subtitle_tracks_list, ensure_ascii=False)

    except subprocess.TimeoutExpired:
        print(f"⚠️  Timeout ffprobe: {file_path}")
    except Exception as e:
        print(f"⚠️  Error extrayendo metadata de video: {file_path} → {e}")

    return result


def progress_hook(d):
    if state.stop_download: raise Exception("Stop")
    if d['status'] == 'downloading':
        total = d.get('total_bytes') or d.get('total_bytes_estimate')
        downloaded = d.get('downloaded_bytes', 0)
        p = (downloaded / total) * 100 if total else 0
        state.progress_status["percent"] = f"{p:.1f}%"
        state.progress_status["filename"] = os.path.basename(d.get('filename', ''))
        s = d.get('speed', 0); state.progress_status["details"] = f"🚀 {s/1048576:.1f} MB/s" if s else "Descargando..."
