import sqlite3
conn = sqlite3.connect(r'D:\Skazo\Music\Kraken Media\kraken.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()
c.execute('SELECT rel_path, folder FROM media WHERE folder_type = "series" LIMIT 1')
row = c.fetchone()
print(f"rel_path: {row['rel_path']}")
print(f"folder: {row['folder']}")
conn.close()