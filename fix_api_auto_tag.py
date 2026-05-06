import re

with open("routes/api.py", "r", encoding="utf-8") as f:
    content = f.read()

# Primer reemplazo: FASE 2 de auto-tagging
target1 = """                    if res and res.get('content_rating'):
                        c.execute('UPDATE media SET tmdb_rating = ? WHERE rel_path = ?', (res.get('content_rating'), video[0]))
                        conn.commit()
                        updated_ratings += 1"""

replacement1 = """                    if res and res.get('content_rating'):
                        rating = res.get('content_rating')
                        import config
                        adult_ratings = getattr(config, 'ADULT_RATINGS', [])
                        is_adult = 1 if rating in adult_ratings else 0
                        c.execute('UPDATE media SET tmdb_rating = ?, is_adult = ? WHERE rel_path = ?', (rating, is_adult, video[0]))
                        conn.commit()
                        updated_ratings += 1"""

content = content.replace(target1, replacement1)

# Segundo reemplazo: Actualizar video ratings masivo
target2 = """                if rating:
                    # Actualizar solo el rating
                    c.execute('''
                        UPDATE media SET tmdb_rating = ? WHERE rel_path = ?
                    ''', (rating, video_path))
                    conn.commit()
                    updated += 1
                    print(f"✅ Rating actualizado: {video.get('tmdb_title', 'Unknown')} -> {rating}")"""

replacement2 = """                if rating:
                    # Actualizar rating y flag adulto
                    import config
                    adult_ratings = getattr(config, 'ADULT_RATINGS', [])
                    is_adult = 1 if rating in adult_ratings else 0
                    c.execute('''
                        UPDATE media SET tmdb_rating = ?, is_adult = ? WHERE rel_path = ?
                    ''', (rating, is_adult, video_path))
                    conn.commit()
                    updated += 1
                    print(f"✅ Rating actualizado: {video.get('tmdb_title', 'Unknown')} -> {rating} (Adult: {bool(is_adult)})")"""

content = content.replace(target2, replacement2)

with open("routes/api.py", "w", encoding="utf-8") as f:
    f.write(content)
print("api.py updated via python script.")
