import os
import urllib.parse

THUMBNAILS_FOLDER = r'D:\Skazo\Music\Kraken Media\thumbnails'

# Simular EXACTAMENTE lo que hace el servidor
def simulate_caratula_request(url_path):
    """Simula el route /caratula/<path:filename>"""
    from urllib.parse import unquote
    
    # Flask ya decode la URL, pero el servidor hace unquote extra
    filename = url_path.split('/caratula/', 1)[1]
    decoded = unquote(filename).lstrip('/\\')
    
    # Lo que hace el servidor
    direct_thumb_path = os.path.join(THUMBNAILS_FOLDER, os.path.basename(decoded))
    
    print(f"URL: {url_path}")
    print(f"  Filename: {filename}")
    print(f"  Decoded: {decoded}")
    print(f"  Basename: {os.path.basename(decoded)}")
    print(f"  Full path: {direct_thumb_path}")
    print(f"  Exists: {os.path.exists(direct_thumb_path)}")
    print()

# Test con el nombre exacto de la carpeta
simulate_caratula_request("/caratula/Dragon%20Ball%20%28tmdb-12609%29.jpg")
simulate_caratula_request("/caratula/Amazing%20Dinoworld%20%28tmdb-102197%29.jpg")
simulate_caratula_request("/caratula/Caminando%20entre%20dinosaurios%20%28tmdb-256924%29.jpg")