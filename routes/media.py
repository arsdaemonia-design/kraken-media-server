from flask import Blueprint, request, send_file, Response, render_template_string
import os
import re
import mimetypes
from pathlib import Path
from urllib.parse import unquote
import config

media_bp = Blueprint("media", __name__)

CHUNK_SIZE = 1024 * 1024  # 1 MB por bloque para streaming constante en RAM

@media_bp.route('/')
def index():
    # Carga el template desde el archivo extraído
    template_path = os.path.join(config.BASE_DIR, 'templates', 'index.html')
    with open(template_path, 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

@media_bp.route('/descargas/<path:filename>')
def serve_file(filename):
    try:
        decoded = unquote(filename).lstrip('/\\')
        base_dir = Path(config.DOWNLOAD_FOLDER).resolve()
        requested = (base_dir / decoded).resolve()
        
        # Evita directory traversal
        requested.relative_to(base_dir)

        if not requested.exists():
            return "No encontrado", 404

        if requested.suffix.lower() in ('.srt', '.vtt'):
            raw = requested.read_bytes()
            if raw.startswith(b'\xef\xbb\xbf'):
                raw = raw[3:]
            try:
                text_utf8 = raw.decode('utf-8')
            except UnicodeDecodeError:
                try:
                    text_utf8 = raw.decode('cp1252')
                except UnicodeDecodeError:
                    text_utf8 = raw.decode('latin-1', errors='replace')
            sub_mime = 'text/vtt; charset=utf-8' if requested.suffix.lower() == '.vtt' else 'text/plain; charset=utf-8'
            resp = Response(text_utf8.encode('utf-8'), mimetype=sub_mime)
            resp.headers['Access-Control-Allow-Origin'] = '*'
            resp.headers['Cache-Control'] = 'public, max-age=3600'
            return resp

        range_header = request.headers.get('Range')
        if not range_header:
            response = send_file(str(requested), conditional=True)
            response.headers['Accept-Ranges'] = 'bytes'
            response.headers['Access-Control-Allow-Origin'] = '*'
            return response

        match = re.match(r'bytes=(\d+)-(\d*)', range_header)
        if not match:
            return "Invalid Range", 416

        size = requested.stat().st_size
        start = int(match.group(1))
        end = int(match.group(2)) if match.group(2) else size - 1
        end = min(end, size - 1)
        if start > end or start >= size:
            return "Invalid Range", 416

        length = end - start + 1
        mime_type = mimetypes.guess_type(str(requested))[0] or 'application/octet-stream'

        def generate_chunks(file_path, offset, total_bytes):
            remaining = total_bytes
            with open(file_path, 'rb') as f:
                f.seek(offset)
                while remaining > 0:
                    read_size = min(CHUNK_SIZE, remaining)
                    chunk = f.read(read_size)
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        response = Response(
            generate_chunks(requested, start, length),
            206,
            mimetype=mime_type,
            direct_passthrough=True
        )
        response.headers['Content-Range'] = f'bytes {start}-{end}/{size}'
        response.headers['Accept-Ranges'] = 'bytes'
        response.headers['Content-Length'] = str(length)
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response
        
    except Exception as e:
        print("Intento inválido en serve_file:", e)
        return "Acceso denegado", 403

@media_bp.route('/avatars/<path:filename>')
def serve_avatar(filename):
    try:
        avatars_dir = Path(config.BASE_DIR) / 'assets' / 'avatars'
        requested = (avatars_dir / filename).resolve()
        requested.relative_to(avatars_dir.resolve())
        if not requested.exists():
            return "No encontrado", 404
        return send_file(str(requested), conditional=True)
    except Exception as e:
        return "Acceso denegado", 403
