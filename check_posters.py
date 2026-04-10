import sqlite3
import os

THUMBNAILS_FOLDER = r'D:\Skazo\Music\Kraken Media\thumbnails'
conn = sqlite3.connect(r'D:\Skazo\Music\Kraken Media\kraken.db')
c = conn.cursor()
c.execute("""
SELECT DISTINCT folder 
FROM media 
WHERE folder_type = 'series' AND media_type = 'video' 
LIMIT 5
""")
for row in c.fetchall():
    folder = row[0]
    poster_name = f"{folder}.jpg"
    poster_path = os.path.join(THUMBNAILS_FOLDER, poster_name)
    print(f"Folder: '{folder}'")
    print(f"Poster path: '{poster_path}'")
    print(f"Exists: {os.path.exists(poster_path)}")
    print()
conn.close()