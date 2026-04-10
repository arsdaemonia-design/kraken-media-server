import sqlite3
conn = sqlite3.connect(r'D:\Skazo\Music\Kraken Media\kraken.db')
c = conn.cursor()
c.execute("SELECT folder, COUNT(*) FROM media WHERE folder_type = 'series' GROUP BY folder LIMIT 10")
for row in c.fetchall():
    print(row)
conn.close()