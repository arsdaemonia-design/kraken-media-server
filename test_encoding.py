import os
import glob

THUMBNAILS_FOLDER = r'D:\Skazo\Music\Kraken Media\thumbnails'

# Buscar archivos con "Dragon Ball"
for f in glob.glob(os.path.join(THUMBNAILS_FOLDER, 'Dragon*')):
    basename = os.path.basename(f)
    print(f"File: {basename}")
    print(f"  Bytes: {basename.encode('utf-8')}")
    print(f"  Bytes (cp1252): {basename.encode('cp1252', errors='replace')}")
    print()