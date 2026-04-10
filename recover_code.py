import os
import re

pb_path = r'C:\Users\aldoe\.gemini\antigravity\conversations\1cb0a4c3-c54f-4ff3-8a3a-ea8e94edb9be.pb'

if not os.path.exists(pb_path):
    print(f"Error: {pb_path} no existe.")
else:
    with open(pb_path, 'rb') as f:
        data = f.read()
    
    # Buscar todos los bloques que parecen HTML
    # Buscamos el inicio de <!DOCTYPE html>
    pattern = b'<!DOCTYPE html>.*?</html>'
    matches = re.findall(pattern, data, re.DOTALL)
    
    if not matches:
        print("No se encontraron bloques HTML completos.")
    else:
        # Filtrar por el que tenga 'uniqueShowsMap' para asegurar que es la v4.88
        valid_versions = [m for m in matches if b'uniqueShowsMap' in m]
        
        if not valid_versions:
            print("Se encontraron versiones viejas, pero ninguna con la logica v4.88 (uniqueShowsMap).")
            # Mostrar la mas larga por si acaso
            longest = max(matches, key=len)
            with open('recovered_index_fallback.html', 'wb') as f:
                f.write(longest)
            print(f"Se ha guardado la version mas larga encontrada ({len(longest)} bytes) en recovered_index_fallback.html")
        else:
            # Tomar la mas reciente/larga
            best_match = max(valid_versions, key=len)
            with open('recovered_index_v488.html', 'wb') as f:
                f.write(best_match)
            print(f"¡EXITO! Se ha recuperado la version v4.88 ({len(best_match)} bytes) en recovered_index_v488.html")
