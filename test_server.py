import os
import urllib.parse

THUMBNAILS_FOLDER = r'D:\Skazo\Music\Kraken Media\thumbnails'

# Simular lo que hace el servidor
test_names = [
    "Dragon Ball (tmdb-12609)",
    "Dragon Ball",
    "Amazing Dinoworld (tmdb-102197)",
    "Caminando entre dinosaurios (tmdb-256924)",
]

for name in test_names:
    # Lo que el frontend envía
    encoded = urllib.parse.quote(name)
    # Lo que el servidor decodifica
    decoded = urllib.parse.unquote(encoded)
    # Lo que el servidor busca (basename)
    search_path = os.path.join(THUMBNAILS_FOLDER, os.path.basename(decoded) + '.jpg')
    exists = os.path.exists(search_path)
    print(f"Name: '{name}'")
    print(f"  Encoded: {encoded}")
    print(f"  Decoded: {decoded}")
    print(f"  Search: {search_path}")
    print(f"  Exists: {exists}")
    print()