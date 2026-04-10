import sqlite3
conn = sqlite3.connect(r'D:\Skazo\Music\Kraken Media\kraken.db')
c = conn.cursor()
c.execute("""
SELECT rel_path 
FROM media 
WHERE folder_type = 'series' AND media_type = 'video' 
AND folder = 'Dragon Ball (tmdb-12609)'
LIMIT 3
""")
for row in c.fetchall():
    print(f"rel_path: {row[0]}")
    # Simular lo que hace el frontend
    parts = row[0].split('/')
    print(f"  parts: {parts}")
    # El frontend usa currentPath para extraer
    # Si currentPath = "" entonces rel = rel_path
    rel = row[0]
    parts2 = rel.split('/')
    if len(parts2) > 1:
        subFolder = parts2[0]
        print(f"  subFolder (name): {subFolder}")
    print()
conn.close()