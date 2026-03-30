import os
import re
from mutagen.easyid3 import EasyID3
from mutagen.id3 import ID3, TCON
from mutagen.mp3 import MP3
from mutagen.mp4 import MP4
from mutagen import File as MutagenFile
from langdetect import detect, DetectorFactory
from langdetect.lang_detect_exception import LangDetectException

# Force consistent results for language detection
DetectorFactory.seed = 0

def detect_language(title, artist, album):
    """
    Inteligencia heurística para adivinar el idioma de una pista.
    Prioriza el TÍTULO sobre artista/álbum porque los nombres de artistas
    suelen tener palabras en inglés sin importar el idioma de la canción.
    """
    # Idiomas romance que se confunden fácilmente entre sí
    ROMANCE_LANGS = {'es', 'pt', 'it', 'ca', 'gl', 'ro'}
    
    def _detect_best(text):
        """Detecta idioma con sesgo hacia español para romances."""
        if not text or len(text.strip()) < 3:
            return None
        try:
            from langdetect import detect_langs
            results = detect_langs(text)
            if not results:
                return None
            top = results[0]
            # Si es romance con baja confianza, preferir español
            if top.lang in ROMANCE_LANGS and top.prob < 0.85:
                return 'es'
            return top.lang
        except LangDetectException:
            return None
    
    # PASO 1: Intentar solo con el título (más confiable)
    if title and len(title.strip()) >= 8:
        result = _detect_best(title)
        if result:
            return result
    
    # PASO 2: Si el título es muy corto, usar título + álbum (sin artista)
    # Los nombres de artistas causan muchos falsos positivos
    fallback_text = f"{title} {album}".strip()
    if fallback_text and len(fallback_text) >= 8:
        result = _detect_best(fallback_text)
        if result:
            return result
    
    # PASO 3: Último recurso, usar todo
    full_text = f"{title} {artist} {album}".strip()
    result = _detect_best(full_text)
    return result or 'unknown'

def clean_artist_name(artist_raw):
    """
    Limpia nombres de artistas múltiples y devuelve el PRIMERO
    """
    if not artist_raw:
        return ""
    separators = [';', ';', ' feat. ', ' feat ', ' ft. ', ' ft ', ' featuring ', ' & ']
    artist = artist_raw
    for sep in separators:
        if sep in artist:
            artist = artist.split(sep)[0].strip()
            break
    return artist.strip()

def write_genre_to_file(file_path, genre):
    """
    Escribe el género en el archivo físico (.mp3, .m4a, .flac, etc.)
    Retorna: (success: bool, error_msg: str)
    """
    try:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.mp3':
            try:
                audio = EasyID3(file_path)
                audio['genre'] = genre
                audio.save()
                return (True, "")
            except Exception as e1:
                try:
                    audio = ID3(file_path)
                    audio.add(TCON(encoding=3, text=genre))
                    audio.save()
                    return (True, "")
                except Exception as e2:
                    return (False, f"EasyID3: {e1} | ID3: {e2}")
        elif ext in ['.m4a', '.mp4']:
            try:
                audio = MP4(file_path)
                audio['\xa9gen'] = [genre]
                audio.save()
                return (True, "")
            except Exception as e:
                return (False, f"MP4 error: {e}")
        else:
            try:
                audio = MutagenFile(file_path, easy=True)
                if audio is None:
                    return (False, "Mutagen no puede leer este formato")
                audio['genre'] = genre
                audio.save()
                return (True, "")
            except Exception as e:
                return (False, f"Mutagen error: {e}")
    except Exception as e:
        return (False, f"Error general: {e}")

def obtener_metadata_completa(path, filename):
    nombre_base = os.path.splitext(filename)[0]
    meta = {'artist': 'Desconocido', 'title': nombre_base, 'album': '', 'genre': 'Otros', 'duration': 0}
    try:
        audio_file = MutagenFile(path)
        if audio_file and hasattr(audio_file.info, 'length'): meta['duration'] = int(audio_file.info.length)
        if filename.lower().endswith('.mp3'):
            audio = MP3(path, ID3=EasyID3)
            if 'artist' in audio: meta['artist'] = audio['artist'][0]
            if 'title' in audio: meta['title'] = audio['title'][0]
            if 'album' in audio: meta['album'] = audio['album'][0]
            if 'genre' in audio: meta['genre'] = audio['genre'][0]
        elif filename.lower().endswith(('.m4a', '.mp4')):
            audio = MP4(path)
            if '\xa9ART' in audio: meta['artist'] = audio['\xa9ART'][0]
            if '\xa9nam' in audio: meta['title'] = audio['\xa9nam'][0]
            if '\xa9alb' in audio: meta['album'] = audio['\xa9alb'][0]
            if '\xa9gen' in audio: meta['genre'] = audio['\xa9gen'][0]
    except Exception as e:
        print("Error leyendo metadata:", path, e)
        
    # Limpiar cadenas corruptas de Mutagen (si el archivo tiene ID3 tags mal codificados con \ufffd)
    for key in ['artist', 'title', 'album']:
        if meta[key] and '\ufffd' in meta[key]:
            if key == 'artist': meta['artist'] = 'Desconocido'
            elif key == 'title': meta['title'] = nombre_base
            elif key == 'album': meta['album'] = ''

    if meta['artist'] == 'Desconocido' and " - " in nombre_base:
        partes = nombre_base.split(" - ")
        meta['artist'] = partes[0].strip()
        if meta['title'] == nombre_base: meta['title'] = " - ".join(partes[1:]).strip()
    
    basura = [r"\(.*Official.*\)", r"\(.*Video.*\)", r"Official Video", r"Video Oficial", r"HD", r"HQ", r"4K", r"ft\.", r"feat\.", r"\(.*Letra.*\)"]
    for b in basura: meta['title'] = re.sub(b, "", meta['title'], flags=re.IGNORECASE).strip()
    return meta
