import sqlite3
conn = sqlite3.connect(r'D:\Skazo\Music\Kraken Media\kraken.db')
c = conn.cursor()
# Get sample of series with their first episode paths
c.execute("""
SELECT folder, rel_path, tmdb_poster 
FROM media 
WHERE folder_type = 'series' AND media_type = 'video' 
ORDER BY folder 
LIMIT 5
""")
for row in c.fetchall():
    print(f"Folder: {row[0]}")
    print(f"  Episode: {row[1]}")
    print(f"  tmdb_poster: {row[2]}")
    print()
conn.close()