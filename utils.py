import os
import json
import re
from pathlib import Path
import config

BASE_PATH = Path(config.DOWNLOAD_FOLDER).resolve()

def validar_path(user_path, base=BASE_PATH):
    """
    Previene directory traversal y accesos fuera del directorio permitido.
    """
    try:
        requested = (base / user_path).resolve()
        requested.relative_to(base)
        return requested
    except Exception:
        raise ValueError(f"Ruta inválida: {user_path}")

def load_json(filepath):
    if not os.path.exists(filepath): return {}
    try:
        with open(filepath, 'r', encoding='utf-8') as f: return json.load(f)
    except Exception as e:
        print("Error cargando JSON:", filepath, e)
        return {}

def save_json(filepath, data):
    try:
        with open(filepath, 'w', encoding='utf-8') as f: json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Error guardando JSON:", filepath, e)

def sanitize_name(name):
    if not name:
        return "sin_titulo"

    # Elimina caracteres peligrosos para el sistema de archivos
    name = re.sub(r'[\\/*?:"<>|\'`]', "", name)

    # Normaliza espacios
    name = re.sub(r'\s+', ' ', name).strip()

    # Evita nombres vacíos
    return name if name else "sin_titulo"

def format_duration(seconds):
    if not seconds: return "0:00"
    try: m, s = divmod(int(seconds), 60); return f"{m}:{s:02d}"
    except Exception as e:
        print("Error formateando duración:", seconds, e)
        return "0:00"

import subprocess
import sys

def _bundle_root():
    meipass = getattr(sys, '_MEIPASS', None)
    if getattr(sys, 'frozen', False) and meipass:
        return Path(meipass)
    return Path(__file__).resolve().parent


def _wire_bundled_ffmpeg_to_path():
    root = _bundle_root()
    candidates = [root, root / '_internal', Path.cwd()]
    ffmpeg_bin = None
    ffprobe_bin = None

    for folder in candidates:
        f1 = folder / 'ffmpeg.exe'
        f2 = folder / 'ffprobe.exe'
        if ffmpeg_bin is None and f1.exists():
            ffmpeg_bin = f1
        if ffprobe_bin is None and f2.exists():
            ffprobe_bin = f2

    if ffmpeg_bin:
        os.environ['FFMPEG_BINARY'] = str(ffmpeg_bin)
        ffmpeg_dir = str(ffmpeg_bin.parent)
        os.environ['PATH'] = ffmpeg_dir + os.pathsep + os.environ.get('PATH', '')

    if ffprobe_bin:
        os.environ['FFPROBE_BINARY'] = str(ffprobe_bin)


def check_ffmpeg():
    _wire_bundled_ffmpeg_to_path()
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Error: FFmpeg no está instalado.")
        sys.exit(1)
