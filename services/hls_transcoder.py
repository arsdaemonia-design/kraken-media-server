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
            except Exception:
                return False

        # 1. Probar NVIDIA en Windows
        if system == 'Windows':
            nvenc_encoders = ['h264_nvenc', 'hevc_nvenc']
            for enc in nvenc_encoders:
                print(f"[HLS] Probando {enc}...")
                if test_encoder(enc):
                    print(f"[HLS] NVIDIA encoder disponible: {enc}")
                    self._video_encoder = enc
                    return enc

        # 2. Probar Apple VideoToolbox en Mac
        elif system == 'Darwin':
            mac_encoders = ['h264_videotoolbox', 'hevc_videotoolbox']
            for enc in mac_encoders:
                print(f"[HLS] Probando {enc}...")
                if test_encoder(enc):
                    print(f"[HLS] Apple VideoToolbox disponible: {enc}")
                    self._video_encoder = enc
                    return enc
        
        # 3. Fallback a CPU
        print("[HLS] Usando CPU de respaldo: libx264")
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
        """Analiza el archivo para decidir si requiere transcodificación y extrae pistas de audio y subtítulos."""
        cmd = [
            self.ffprobe, "-v", "quiet", "-print_format", "json",
            "-show_streams", input_file
        ]
        try:
            kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
            result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=10, **kwargs)
            data = json.loads(result.stdout)
            
            video_stream = next((s for s in data.get('streams', []) if s.get('codec_type') == 'video'), None)
            audio_streams = [s for s in data.get('streams', []) if s.get('codec_type') == 'audio']
            subtitle_streams = [s for s in data.get('streams', []) if s.get('codec_type') == 'subtitle']
            
            video_codec = video_stream.get('codec_name') if video_stream else None
            pix_fmt = video_stream.get('pix_fmt') if video_stream else None
            
            friendly_audio = ['aac', 'mp3', 'opus', 'vorbis']
            audio_needs_transcode = not all(s.get('codec_name') in friendly_audio for s in audio_streams) if audio_streams else False
            
            # Para Direct Play en navegador (MP4/WebM):
            browser_friendly_video = ['h264', 'vp8', 'vp9', 'av1']
            # Para HLS MPEG-TS sin recodificar (-c:v copy), el stream debe ser H.264 8-bit estándar:
            hls_can_copy_video = (
                video_codec == 'h264'
                and (pix_fmt in ('yuv420p', 'yuvj420p', None))
            )
            video_needs_transcode = not hls_can_copy_video
            
            can_remux = hls_can_copy_video and not audio_needs_transcode
            
            friendly_container = ['.mp4', '.webm', '.m4v']
            is_friendly_container = any(input_file.lower().endswith(ext) for ext in friendly_container)
            first_audio_friendly = (not audio_streams) or (audio_streams[0].get('codec_name') in friendly_audio)
            direct_play = (
                is_friendly_container
                and (video_codec in browser_friendly_video)
                and (pix_fmt in ('yuv420p', 'yuvj420p', None))
                and first_audio_friendly
            )
            
            lang_map = {
                'spa': 'Español',
                'es': 'Español',
                'esl': 'Español',
                'lat': 'Español Latino',
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
                codec = s.get('codec_name', 'unknown')
                channels = s.get('channels')
                tracks.append({
                    "language": lang,
                    "language_code": lang_code or "und",
                    "title": title,
                    "codec": codec,
                    "channels": channels
                })

            # Subtítulos basados en texto que FFmpeg puede convertir a WebVTT al vuelo
            text_sub_codecs = {'subrip', 'srt', 'ass', 'ssa', 'webvtt', 'mov_text', 'text'}
            embedded_subtitles = []
            for sub_idx, s in enumerate(subtitle_streams):
                sub_codec = (s.get('codec_name') or '').lower()
                if sub_codec not in text_sub_codecs:
                    continue
                tags = s.get('tags', {}) or {}
                lang_code = (tags.get('language') or '').strip().lower()
                lang = lang_map.get(lang_code, lang_code.upper() if lang_code else f"Subtítulo {sub_idx + 1}")
                title = (tags.get('title') or '').strip()
                label = f"{lang} · {title}" if (title and title.lower() != lang.lower()) else lang
                embedded_subtitles.append({
                    "sub_index": sub_idx,
                    "stream_index": s.get('index'),
                    "language": lang_code or "und",
                    "title": label,
                    "codec": sub_codec,
                    "external": False
                })
            
            return {
                "video_codec": video_codec,
                "pix_fmt": pix_fmt,
                "hls_can_copy_video": hls_can_copy_video,
                "can_remux": can_remux,
                "needs_audio_transcode": audio_needs_transcode,
                "video_needs_transcode": video_needs_transcode,
                "direct_play": direct_play,
                "audio_tracks": tracks,
                "embedded_subtitles": embedded_subtitles
            }
        except Exception as e:
            print(f"Error analizando {input_file}: {e}")
            return None

    def _build_ffmpeg_hls_cmd(
        self,
        input_file,
        output_dir,
        playlist_path,
        analysis,
        normalized_audio_index,
        hls_mode="stream",
        hls_segment_type="mpegts",
        force_video_reencode=False,
        start_time=0.0
    ):
        audio_tracks = analysis.get('audio_tracks', [])
        needs_video_reencode = (
            force_video_reencode
            or analysis.get('video_needs_transcode', True)
        )

        video_encoder = self._detect_video_encoder() if needs_video_reencode else None
        encoder_settings = self._get_encoder_settings(video_encoder) if needs_video_reencode else []

        cmd = [self.ffmpeg, "-hide_banner", "-loglevel", "error", "-fflags", "+genpts"]

        if needs_video_reencode and video_encoder:
            if '_nvenc' in video_encoder:
                cmd += ["-hwaccel", "auto"]
            elif '_videotoolbox' in video_encoder:
                cmd += ["-hwaccel", "videotoolbox"]

        if start_time and start_time > 0:
            cmd += ["-ss", f"{float(start_time):.2f}"]

        cmd += ["-i", input_file]
        cmd += ["-map", "0:v:0"]
        if audio_tracks:
            cmd += ["-map", f"0:a:{normalized_audio_index}?"]
        else:
            cmd += ["-map", "0:a?"]

        if needs_video_reencode:
            cmd += encoder_settings
            cmd += ["-g", "48", "-force_key_frames", "expr:gte(t,n_forced*2)"]
            if video_encoder == "libx264":
                cmd += ["-sc_threshold", "0"]
        else:
            # Copy H.264 stream directamente (10x-30x más rápido que re-encodear)
            cmd += ["-c:v", "copy", "-avoid_negative_ts", "make_zero"]

        selected_channels = 2
        if audio_tracks and 0 <= normalized_audio_index < len(audio_tracks):
            try:
                selected_channels = int(audio_tracks[normalized_audio_index].get("channels") or 2)
            except (TypeError, ValueError):
                selected_channels = 2

        audio_filter = "aresample=async=1:first_pts=0"
        audio_bitrate = "192k"
        if selected_channels > 2:
            audio_filter += ",pan=stereo|c0=FL+0.707*FC+0.707*SL+0.5*LFE|c1=FR+0.707*FC+0.707*SR+0.5*LFE"
            audio_bitrate = "256k"

        cmd += [
            "-c:a", "aac",
            "-profile:a", "aac_low",
            "-ac", "2",
            "-ar", "48000",
            "-b:a", audio_bitrate,
            "-af", audio_filter,
            "-max_interleave_delta", "60000000",
        ]

        hls_mode = (hls_mode or "stream").strip().lower()
        hls_segment_type = (hls_segment_type or "mpegts").strip().lower()
        if hls_segment_type not in {"mpegts", "fmp4"}:
            hls_segment_type = "mpegts"

        hls_args = [
            "-f", "hls",
            "-hls_time", "4",
            "-hls_list_size", "0",
        ]
        if hls_segment_type == "fmp4":
            hls_args += [
                "-hls_segment_type", "fmp4",
                "-hls_fmp4_init_filename", "init.mp4",
            ]
        if hls_mode == "vod":
            hls_args += [
                "-hls_playlist_type", "vod",
                "-hls_flags", "independent_segments",
            ]
        else:
            hls_args += [
                "-hls_playlist_type", "event",
                "-hls_flags", "independent_segments+temp_file",
            ]
        segment_extension = "m4s" if hls_segment_type == "fmp4" else "ts"
        hls_args += [
            "-hls_segment_filename", os.path.join(output_dir, f"seg_%03d.{segment_extension}"),
            playlist_path
        ]
        cmd += hls_args
        return cmd, needs_video_reencode

    def start_hls_session(
        self,
        input_file,
        output_dir,
        selected_audio_index=None,
        hls_mode="stream",
        hls_segment_type="mpegts",
        start_time=0.0,
    ):
        """Prepara e inicia el proceso FFmpeg para HLS."""
        print(f"[HLS] Input file: {input_file}")
        print(f"[HLS] Output dir: {output_dir}")
        print(f"[HLS] FFmpeg path: {self.ffmpeg}")
        if not os.path.exists(input_file):
            print(f"[HLS] ERROR: Archivo no encontrado: {input_file}")
            return None, [], 0, "Archivo no encontrado"
        analysis = self.analyze_media(input_file)
        if not analysis:
            print("[HLS] ERROR: No se pudo analizar el archivo")
            return None, [], 0, "No se pudo analizar el archivo"
        self._last_analysis = analysis
        print(f"[HLS] Analysis: video={analysis.get('video_codec')} copy_ok={analysis.get('hls_can_copy_video')} direct={analysis.get('direct_play')} subs={len(analysis.get('embedded_subtitles', []))}")
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

        if analysis.get('direct_play') and not force_hls_for_audio and (not start_time or start_time <= 0):
            print("[HLS] MP4/WebM nativo detectado, bypass HLS (Direct Play)")
            return "DIRECT", audio_tracks, normalized_audio_index, None

        kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}

        # Intentar primero con -c:v copy si el video ya es H.264 compatible (arranque en <0.8s)
        cmd, used_reencode = self._build_ffmpeg_hls_cmd(
            input_file=input_file,
            output_dir=output_dir,
            playlist_path=playlist_path,
            analysis=analysis,
            normalized_audio_index=normalized_audio_index,
            hls_mode=hls_mode,
            hls_segment_type=hls_segment_type,
            force_video_reencode=False,
            start_time=start_time,
        )

        print(f"[HLS] Command: {' '.join(cmd)}")
        log_file_path = os.path.join(output_dir, "ffmpeg.log")

        def _read_ffmpeg_log():
            try:
                if os.path.exists(log_file_path):
                    with open(log_file_path, "r", encoding="utf-8", errors="ignore") as lf:
                        return lf.read().strip()
            except Exception:
                pass
            return ""

        try:
            log_fh = open(log_file_path, "w", encoding="utf-8", errors="ignore")
            process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=log_fh, **kwargs)
            log_fh.close()
            time.sleep(0.35)
            if process.poll() is not None and not used_reencode:
                # Si -c:v copy falló por bitstream H.264 no estándar, reintentar automáticamente con re-encode
                err_txt = _read_ffmpeg_log()
                print(f"[HLS] -c:v copy falló ({err_txt[:120]}), reintentando con re-encode...")
                cmd, used_reencode = self._build_ffmpeg_hls_cmd(
                    input_file=input_file,
                    output_dir=output_dir,
                    playlist_path=playlist_path,
                    analysis=analysis,
                    normalized_audio_index=normalized_audio_index,
                    hls_mode=hls_mode,
                    hls_segment_type=hls_segment_type,
                    force_video_reencode=True,
                    start_time=start_time,
                )
                log_fh = open(log_file_path, "w", encoding="utf-8", errors="ignore")
                process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=log_fh, **kwargs)
                log_fh.close()
                time.sleep(0.35)

            if process.poll() is not None:
                err = _read_ffmpeg_log() or "FFmpeg terminó inmediatamente"
                print(f"[HLS] FFmpeg murió inmediatamente: {err}")
                return None, audio_tracks, normalized_audio_index, err
            
            print(f"[HLS] FFmpeg iniciado correctamente, PID: {process.pid} (reencode={used_reencode})")
            return process, audio_tracks, normalized_audio_index, None
        except Exception as e:
            print(f"[HLS] Fallo al iniciar FFmpeg: {e}")
            return None, audio_tracks, normalized_audio_index, str(e)
