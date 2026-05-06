import re

# 1. Update API to send adult_ratings
with open("routes/api.py", "r", encoding="utf-8") as f:
    api_content = f.read()

api_target = "'current_media_path': get_runtime_config().get('media_path', config.DOWNLOAD_FOLDER)"
api_replacement = "'current_media_path': get_runtime_config().get('media_path', config.DOWNLOAD_FOLDER), 'adult_ratings': getattr(config, 'ADULT_RATINGS', [])"
api_content = api_content.replace(api_target, api_replacement)

with open("routes/api.py", "w", encoding="utf-8") as f:
    f.write(api_content)

# 2. Update index.html to USE those ratings
with open("templates/index.html", "r", encoding="utf-8") as f:
    html_content = f.read()

# Buscamos donde se renderizan los checkboxes y pasamos el valor real de d.adult_ratings
html_target = """                                    // Cargar configuración guardada
                                    const pubCfgReq = await fetch('/api/setup/status'); // Reusamos status para ver config si estuviera ahi, o asumimos vacio si falla
                                    const adultRatings = []; // Por defecto
                                    
                                    document.getElementById('adult-ratings-grid').innerHTML = commonRatings.map(r => {"""

html_replacement = """                                    // Cargar configuración guardada
                                    const adultRatings = d.adult_ratings || [];
                                    
                                    document.getElementById('adult-ratings-grid').innerHTML = commonRatings.map(r => {"""

html_content = html_content.replace(html_target, html_replacement)

with open("templates/index.html", "w", encoding="utf-8") as f:
    f.write(html_content)

print("API and UI synchronized for adult ratings persistence.")
