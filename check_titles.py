import sqlite3

conn = sqlite3.connect(r'D:\Skazo\Music\Kraken Media\kraken.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute('''
    SELECT rel_path, title, tmdb_title, filename, folder_type, tmdb_id 
    FROM media 
    WHERE folder_type = 'movie' 
    LIMIT 15
''')

rows = cur.fetchall()
print("=== MOVIES IN DB ===")
for r in rows:
    print(f"Path: {r['rel_path']}")
    print(f"  Title: {r['title']}")
    print(f"  TMDB_Title: {r['tmdb_title']}")
    print(f"  Folder_Type: {r['folder_type']}")
    print(f"  TMDB_ID: {r['tmdb_id']}\n")

conn.close()
