import sqlite3
conn = sqlite3.connect(r'D:\Skazo\Music\Kraken Media\kraken.db')
c = conn.cursor()
c.execute("UPDATE media SET tmdb_poster = NULL WHERE folder_type = 'series' AND media_type = 'video'")
conn.commit()
print(f'Actualizados {c.rowcount} episodios')
conn.close()