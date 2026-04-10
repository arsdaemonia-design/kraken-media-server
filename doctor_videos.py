import os
import sys
import subprocess
from pathlib import Path

# Añadimos la ruta base para que pueda importar 'config'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import config

def optimizar_mp4_seguro(carpeta_raiz):
    print(f"🎬 Iniciando Kraken Media Doctor en: {carpeta_raiz}")
    # Buscar todos los .mp4 recursivamente (incluyendo subcarpetas)
    rutas = list(Path(carpeta_raiz).rglob("*.mp4"))
    total = len(rutas)
    
    if total == 0:
        print("🔍 No se encontraron archivos MP4 en la ruta especificada.")
        return

    print(f"🔍 Se encontraron {total} archivos MP4.")
    print("ℹ️ Nota: Los archivos MKV/AVI pasan por HLS, pero todo MP4 será sanado para DirectPlay Instantáneo.\n")
    
    exitos = 0
    errores = 0

    for i, archivo in enumerate(rutas, 1):
        ruta_original = str(archivo)
        # Crear un nombre temporal en la misma carpeta
        ruta_temp = str(archivo.with_name(f"temp_{archivo.name}"))
        
        print(f"[{i}/{total}] Sanando Índice (FastStart) de: {archivo.name}...")
        
        # El comando mágico de FFmpeg (-v error es para que no llene la pantalla de texto, solo avise si falla)
        cmd = [
            config.FFMPEG_PATH, "-y", "-v", "error",
            "-i", ruta_original,
            "-c", "copy", "-movflags", "+faststart",
            ruta_temp
        ]
        
        try:
            # Ejecutar FFmpeg (creationflags oculta la ventana negra en Windows)
            kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
            resultado = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs)
            
            # Si el código de retorno es 0, todo salió perfecto
            if resultado.returncode == 0 and os.path.exists(ruta_temp):
                # ¡Magia pura! Reemplazamos el viejo por el nuevo
                os.replace(ruta_temp, ruta_original)
                exitos += 1
            else:
                # Algo falló. Imprimimos el error y borramos la basura temporal.
                error_msg = resultado.stderr.decode('utf-8', errors='ignore').strip()
                print(f"   ❌ Error con {archivo.name}: {error_msg}")
                if os.path.exists(ruta_temp):
                    os.remove(ruta_temp)
                errores += 1
                
        except Exception as e:
            print(f"   ❌ Error fatal del sistema: {e}")
            if os.path.exists(ruta_temp):
                os.remove(ruta_temp)
            errores += 1

    print("\n" + "="*40)
    print("✅ ¡PROCESO TERMINADO!")
    print(f"🚀 MP4 Curados para Streaming Perfecto: {exitos}")
    if errores > 0:
        print(f"⚠️ Errores (Archivos originales intactos): {errores}")
    print("="*40)

if __name__ == '__main__':
    # Usa automáticamente tu carpeta de descargas maestra de Kraken
    carpeta_videos = os.path.join(config.DOWNLOAD_FOLDER, "Video")
    if not os.path.exists(carpeta_videos):
        print(f"No encuentro la carpeta de Videos en {carpeta_videos}. Procesando toda la carpeta de descargas...")
        carpeta_videos = config.DOWNLOAD_FOLDER
        
    optimizar_mp4_seguro(carpeta_videos)
