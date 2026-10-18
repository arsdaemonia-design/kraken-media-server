import re

with open("routes/api.py", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update batch mode (paths_array)
batch_target = """                if fields_to_set:
                    values.append(p)
                    query = f"UPDATE media SET {', '.join(fields_to_set)} WHERE rel_path = ?"
                    c.execute(query, tuple(values))"""
batch_replacement = """                if fields_to_set:
                    import config
                    adult_ratings = getattr(config, 'ADULT_RATINGS', [])
                    is_adult = 1 if tmdb_rating in adult_ratings else 0
                    fields_to_set.append("is_adult = ?")
                    values.append(is_adult)
                    
                    values.append(p)
                    query = f"UPDATE media SET {', '.join(fields_to_set)} WHERE rel_path = ?"
                    c.execute(query, tuple(values))"""
content = content.replace(batch_target, batch_replacement)

# 2. Update Virtual/Series mode
virtual_target = """            c.execute(\"\"\"
                UPDATE media SET 
                tmdb_title = ?, 
                tmdb_rating = ?, 
                tmdb_year = ?, 
                tmdb_genres = ?, 
                tmdb_overview = ?
                WHERE rel_path LIKE ?
            \"\"\", (tmdb_title, tmdb_rating, tmdb_year, tmdb_genres, tmdb_overview, f"{path}/%"))"""
virtual_replacement = """            import config
            is_adult = 1 if tmdb_rating in getattr(config, 'ADULT_RATINGS', []) else 0
            c.execute(\"\"\"
                UPDATE media SET 
                tmdb_title = ?, 
                tmdb_rating = ?, 
                tmdb_year = ?, 
                tmdb_genres = ?, 
                tmdb_overview = ?,
                is_adult = ?
                WHERE rel_path LIKE ?
            \"\"\", (tmdb_title, tmdb_rating, tmdb_year, tmdb_genres, tmdb_overview, is_adult, f"{path}/%"))"""
content = content.replace(virtual_target, virtual_replacement)

# 3. Update Single file mode
single_target = """            c.execute(\"\"\"
                UPDATE media SET 
                tmdb_title = ?, 
                tmdb_rating = ?, 
                tmdb_year = ?, 
                tmdb_genres = ?, 
                tmdb_overview = ?
                WHERE rel_path = ?
            \"\"\", (tmdb_title, tmdb_rating, tmdb_year, tmdb_genres, tmdb_overview, path))"""
single_replacement = """            import config
            is_adult = 1 if tmdb_rating in getattr(config, 'ADULT_RATINGS', []) else 0
            c.execute(\"\"\"
                UPDATE media SET 
                tmdb_title = ?, 
                tmdb_rating = ?, 
                tmdb_year = ?, 
                tmdb_genres = ?, 
                tmdb_overview = ?,
                is_adult = ?
                WHERE rel_path = ?
            \"\"\", (tmdb_title, tmdb_rating, tmdb_year, tmdb_genres, tmdb_overview, is_adult, path))"""
content = content.replace(single_target, single_replacement)

with open("routes/api.py", "w", encoding="utf-8") as f:
    f.write(content)
print("api.py updated with is_adult logic in metadata updates.")
