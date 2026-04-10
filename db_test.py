import sqlite3
from services.database import get_db

conn = get_db()
c = conn.cursor()

# Update specific animes visually for the user
c.execute("UPDATE media SET tmdb_rating = 'R18+' WHERE rel_path LIKE '%Mezzo Forte%' OR rel_path LIKE '%Landlock%'")

conn.commit()
conn.close()
print("Custom ratings updated!")
