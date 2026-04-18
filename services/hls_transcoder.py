import subprocess
import os
import platform
import json
import time


class HLSTranscoder:
    def __init__(self, ffmpeg_path="ffmpeg", ffprobe_path="ffprobe"):
        self.ffmpeg = ffmpeg_path
        self.ffprobe = ffprobe_path
        self.system = platform.system()
        self._video_encoder = None  # Cache para el encoder detectado

    def _detect_video_encoder(self):
        """Detecta el mejor encoder de video disponible (NVIDIA, Apple Silicon o CPU)."""
        if self._video_encoder:
            return self._video_encoder
        
        system = self.system
        
        # Test rápido de encoder
        def test_encoder(enc):
            cmd = [
                self.ffmpeg, "-hide_banner", "-loglevel", "error",
                "-f", "lavfi", "-i", "color=c=black:s=320x240:d=1",
                "-c:v", enc, "-preset", "fast", "-b:v", "1M",
                "-frames:v", "1", "-f", "null", "-"
            ]
            try:
                kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
                result = subprocess.run(cmd, capture_output=True, timeout=10, **kwargs)
                return result.returncode == 0
            except:
                return False
        
        # 1. Probar NVIDIA en Windows
        if system == 'Windows':
            nvenc_encoders = ['h264_nvenc', 'hevc_nvenc']
            for enc in nvenc_encoders:
                print(f"[HLS] Probando {enc}...")
                if test_encoder(enc):
                    print(f"[HLS] ✓ NVIDIA encoder disponible: {enc}")
                    self._video_encoder = enc
                    return enc
        
        # 2. Probar Apple VideoToolbox en Mac
        elif system == 'Darwin':
            mac_encoders = ['h264_videotoolbox', 'hevc_videotoolbox']
            for enc in mac_encoders:
                print(f"[HLS] Probando {enc}...")
                if test_encoder(enc):
                    print(f"[HLS] ✓ Apple VideoToolbox disponible: {enc}")
                    self._video_encoder = enc
                    return enc
        
        # 3. Fallback a CPU
        print(f"[HLS] Usando CPU de respaldo: libx264")
        self._video_encoder = 'libx264'
        return 'libx264'

    def _get_encoder_settings(self, encoder):
        """Retorna los settings apropiados para cada encoder."""
        if encoder == 'libx264':
            return ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-pix_fmt", "yuv420p"]
        elif '_nvenc' in encoder:  # NVIDIA
            return [
                "-c:v", encoder,
                "-preset", "p4",
                "-pix_fmt", "yuv420p",
                "-profile:v", "main",
                "-b:v", "8M",
                "-maxrate", "10M",
                "-bufsize", "16M"
            ]
        elif '_videotoolbox' in encoder:  # Apple Silicon (Mac)
            # VideoToolbox no usa presets como NVIDIA, se ajusta diferente
            return [
                "-c:v", encoder,
                "-pix_fmt", "yuv420p",
                "-profile:v", "main",
                "-b:v", "8M",
                "-maxrate", "10M",
                "-bufsize", "16M"
            ]
        else:
            return ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-pix_fmt", "yuv420p"]

    def analyze_media(self, input_file):
        """Analiza el archivo para decidir si requiere transcodificación."""
        cmd = [
            self.ffprobe, "-v", "quiet", "-print_format", "json",
            "-show_streams", input_file
        ]
        try:
            kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
            result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=10, **kwargs)
            data = json.loads(result.stdout)
            
            video_stream = next((s for s in data['streams'] if s['codec_type'] == 'video'), None)
            audio_streams = [s for s in data['streams'] if s['codec_type'] == 'audio']
            
            video_codec = video_stream['codec_name'] if video_stream else None
            
            friendly_audio = ['aac', 'mp3', 'opus', 'vorbis']
            audio_needs_transcode = not all(s['codec_name'] in friendly_audio for s in audio_streams)
            
            friendly_video = ['h264', 'vp8', 'vp9', 'av1']
            video_needs_transcode = video_codec not in friendly_video
            
            can_remux = not video_needs_transcode and not audio_needs_transcode
            
            friendly_container = ['.mp4', '.webm']
            is_friendly_container = any(input_file.lower().endswith(ext) for ext in friendly_container)
            direct_play = is_friendly_container and not video_needs_transcode and not audio_needs_transcode
            
            lang_map = {
                'spa': 'Español',
                'es': 'Español',
                'esl': 'Español',
                'eng': 'Inglés',
                'en': 'Inglés',
                'jpn': 'Japonés',
                'jp': 'Japonés',
                'por': 'Portugués',
                'pt': 'Portugués',
                'fra': 'Francés',
                'fr': 'Francés',
                'ita': 'Italiano',
                'it': 'Italiano',
                'deu': 'Alemán',
                'ger': 'Alemán',
                'de': 'Alemán',
            }

            tracks = []
            for i, s in enumerate(audio_streams):
                tags = s.get('tags', {}) or {}
                lang_code = (tags.get('language') or '').strip().lower()
                lang = lang_map.get(lang_code, lang_code if lang_code else f"Pista {i+1}")
                title = (tags.get('title') or tags.get('handler_name') or '').strip()
                codec = s['codec_name']
                channels = s.get('channels')
                tracks.append({
                    "language": lang,
                    "language_code": lang_code or "und",
                    "title": title,
                    "codec": codec,
                    "channels": channels
                })
            
            return {
                "video_codec": video_codec,
                "can_remux": can_remux,
                "needs_audio_transcode": audio_needs_transcode,
                "video_needs_transcode": video_needs_transcode,
                "direct_play": direct_play,
                "audio_tracks": tracks
            }
        except Exception as e:
            print(f"Error analizando {input_file}: {e}")
            return None

    def start_hls_session(self, input_file, output_dir, selected_audio_index=None, hls_mode="stream"):
        """Prepara e inicia el proceso FFmpeg para HLS."""
        print(f"[HLS] Input file: {input_file}")
        print(f"[HLS] Output dir: {output_dir}")
        print(f"[HLS] FFmpeg path: {self.ffmpeg}")
        
        # Verificar que el archivo existe
        if not os.path.exists(input_file):
            print(f"[HLS] ERROR: Archivo no encontrado: {input_file}")
            return None, [], 0, "Archivo no encontrado"
        
        analysis = self.analyze_media(input_file)
        if not analysis:
            print(f"[HLS] ERROR: No se pudo analizar el archivo")
            return None, [], 0, "No se pudo analizar el archivo"
        
        print(f"[HLS] Analysis: {analysis}")
        
        os.makedirs(output_dir, exist_ok=True)
        playlist_path = os.path.join(output_dir, "playlist.m3u8")
        
        audio_tracks = analysis.get('audio_tracks', [])
        normalized_audio_index = 0
        if audio_tracks:
            try:
                normalized_audio_index = int(selected_audio_index) if selected_audio_index is not None else 0
            except (TypeError, ValueError):
                normalized_audio_index = 0
            normalized_audio_index = max(0, min(normalized_audio_index, len(audio_tracks) - 1))

        force_hls_for_audio = normalized_audio_index > 0

        if analysis.get('direct_play') and not force_hls_for_audio:
            print("[HLS] MP4/WebM nativo detectado, bypass HLS (Direct Play)")
            return "DIRECT", audio_tracks, normalized_audio_index, None
        
        # Detectar el mejor encoder (GPU o CPU)
        video_encoder = self._detect_video_encoder()
        encoder_settings = self._get_encoder_settings(video_encoder)
        
        cmd = [self.ffmpeg, "-hide_banner", "-loglevel", "error"]
        
        # Activar aceleración de hardware para decodificación si hay GPU
        if '_nvenc' in video_encoder:
            cmd += ["-hwaccel", "auto"]  # NVIDIA
        elif '_videotoolbox' in video_encoder:
            cmd += ["-hwaccel", "videotoolbox"]  # Apple Silicon
        
        cmd += ["-i", input_file]
        cmd += ["-map", "0:v:0"]
        if audio_tracks:
            cmd += ["-map", f"0:a:{normalized_audio_index}?"]
        else:
            cmd += ["-map", "0:a?"]

        if force_hls_for_audio:
            # When forcing HLS just to switch audio track, re-encode video for maximum mux compatibility
            cmd += encoder_settings
        elif analysis.get('video_needs_transcode', True):
            cmd += encoder_settings
        else:
            cmd += ["-c:v", "copy"]

        # SIEMPRE convertir audio a AAC estéreo para máxima compatibilidad (evita fallos con AC3/5.1)
        cmd += ["-c:a", "aac", "-ac", "2", "-b:a", "192k"]

        hls_mode = (hls_mode or "stream").strip().lower()
        hls_args = [
            "-f", "hls",
            "-hls_time", "6",
            "-hls_list_size", "0",
        ]
        if hls_mode == "vod":
            hls_args += [
                "-hls_playlist_type", "vod",
                "-hls_flags", "independent_segments",
            ]
        else:
            hls_args += [
                "-hls_flags", "append_list",
            ]
        hls_args += [
            "-hls_segment_filename", os.path.join(output_dir, "seg_%03d.ts"),
            playlist_path
        ]
        cmd += hls_args

        print(f"[HLS] Command: {' '.join(cmd)}")
        
        try:
            kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs)
            time.sleep(2)
            if process.poll() is not None:
                stdout, stderr = process.communicate()
                print(f"[HLS] FFmpeg murió inmediatamente:")
                print(f"STDOUT: {stdout.decode() if stdout else 'empty'}")
                print(f"STDERR: {stderr.decode() if stderr else 'empty'}")
                err = stderr.decode(errors='ignore').strip() if stderr else "FFmpeg terminó inmediatamente"
                return None, audio_tracks, normalized_audio_index, err
            
            print(f"[HLS] FFmpeg iniciado correctamente, PID: {process.pid}")
            return process, audio_tracks, normalized_audio_index, None
        except Exception as e:
            print(f"[HLS] Fallo al iniciar FFmpeg: {e}")
            return None, audio_tracks, normalized_audio_index, str(e)
