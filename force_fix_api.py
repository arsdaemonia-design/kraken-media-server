import re
import os

with open("routes/api.py", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Localizar la funcion setup_status y forzar el retorno de adult_ratings
def_setup = r"def setup_status\(\):.*?\n\s+return jsonify\(\{.*?\}\)"
match = re.search(def_setup, content, re.DOTALL)

if match:
    old_func = match.group(0)
    # Limpiamos imports duplicados si los hay y forzamos el retorno
    new_func = """def setup_status():
    import config
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) as count FROM users WHERE is_superadmin = 1")
    row = c.fetchone()
    conn.close()
    
    needs_setup = row['count'] == 0 if row else True
    runtime = _load_runtime_config()
    
    return jsonify({
        'is_configured': not needs_setup,
        'current_media_path': runtime.get('media_path', config.DOWNLOAD_FOLDER),
        'adult_ratings': getattr(config, 'ADULT_RATINGS', [])
    })"""
    content = content.replace(old_func, new_func)

with open("routes/api.py", "w", encoding="utf-8") as f:
    f.write(content)
print("api.py fixed manually.")
