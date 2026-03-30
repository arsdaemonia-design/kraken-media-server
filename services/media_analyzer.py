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

def progress_hook(d):
    if state.stop_download: raise Exception("Stop")
    if d['status'] == 'downloading':
        total = d.get('total_bytes') or d.get('total_bytes_estimate')
        downloaded = d.get('downloaded_bytes', 0)
        p = (downloaded / total) * 100 if total else 0
        state.progress_status["percent"] = f"{p:.1f}%"
        state.progress_status["filename"] = os.path.basename(d.get('filename', ''))
        s = d.get('speed', 0); state.progress_status["details"] = f"🚀 {s/1048576:.1f} MB/s" if s else "Descargando..."
