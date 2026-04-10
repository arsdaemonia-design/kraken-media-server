import os
import urllib.parse

THUMBNAILS_FOLDER = r'D:\Skazo\Music\Kraken Media\thumbnails'
name = "Dragon Ball (tmdb-12609)"

encoded = urllib.parse.quote(name)
url_path = f"/caratula/{encoded}.jpg"
decoded_from_url = urllib.parse.unquote(encoded)

print(f"URL path: {url_path}")
print(f"Decoded: {decoded_from_url}")

# Check if file exists
file_path = os.path.join(THUMBNAILS_FOLDER, f"{decoded_from_url}.jpg")
print(f"Checking: {file_path}")
print(f"Exists: {os.path.exists(file_path)}")

# List all files containing "Dragon Ball"
for f in os.listdir(THUMBNAILS_FOLDER):
    if 'Dragon' in f and 'Ball' in f:
        print(f"Found file: '{f}'")