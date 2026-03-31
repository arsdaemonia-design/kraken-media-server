# Kraken Media Server - Documentación

## ¿Qué es Kraken?

Kraken es un servidor multimedia local con modo online/offline. Permite:
- Reproducir música y videos desde tu biblioteca local
- Descargar contenido de YouTube, Spotify y otras fuentes
- Streaming de video via HLS con transcodificación
- Modo offline con PWA
- Acceso via LAN o Cloudflare tunnel

## Versión Actual
- **v4.84** (2026-03-31)

---

# Cambios Recientes (v4.84 - 2026-03-31)

## Fixes Visuales y Funcionales (UI / UX)
- **Netflix View (Breadcrumbs Fix)**: Se restauró la navegación de migas de pan superior. Al hacer clic en "Video" (`currentPath === 'Video'`), la vista Netflix no se reinicia a carpetas vainilla, manteniendo fluido el entorno gráfico premium.
- **Barra de Búsqueda Netflix**: Se eliminó el `input` inline de la cabecera Netflix en favor del buscador global, resolviendo definitivamente el problema de pérdida de foco al re-renderizar la UI (Analizado en `ANALISIS_VIDEO_SEARCH.md`).
- **Títulos Limpios (Regex)**: Se añadió un mecanismo dinámico en el renderizado de `createCard()` para purgar automáticamente cualquier residuo de etiquetas `(tmdb-xxxxx)` extraídas de los filenames o id3 tags (Afecta tanto a Títulos principales como a subtítulos de Artista).
- **Integración de TMDB Géneros**: Los géneros inyectados por la API externa (`tmdb_genres`) ahora son asimilados nativamente durante el armado de `media_type === 'video'`, sincronizando automáticamente las etiquetas de la tarjeta y el filtro principal de pills.

## Core Lógica de Agrupamiento
- **Independencia de Películas**: Las películas ya no son falsamente envueltas en estructuras virtuales `type: 'folder'` cuando residen en carpetas profundas, permitiendo que todas sus acciones nativas (Play instantáneo, Favoritos, Listas) apunten físicamente a sus `.mp4` correspondientes sin que el API colapse.

---

# Cambios Recientes (v4.83 - 2026-03-29)

## Video View Redesign (Biblioteca de Video)
- **Categorías: Dropdown → Pills** (scroll horizontal en móvil)
  - Pill activo: glow/borde emerald
  - Al cambiar categoría, se resetea el filtro de género
- **Géneros: Carousels → Grid plano + chips**
  - Se muestran TODOS los shows en un solo grid
  - Chips de género arriba (solo si hay >1 género)
  - “Todos” resetea el filtro
- **Directorios de Video: layout forzado a lista**
  - Si `currentLibrary === 'video'`, el contenedor usa `flex flex-col` (ignora grid/list toggle)
  - Temporadas/episodios y archivos sueltos renderizan con `createEpisodeRow()`

## Música
- **Zoom de música: REVERTIDO** ✅ (`zoomLevels` restaurados; grid intacto)

## Escaneo “Ultra Rápido” (Optimización Delta)
- Skip inteligente comparando `mtime` + `size_bytes` (búsquedas O(1) con `set`/`Set`)
- Merge de géneros: protege géneros editados manualmente si el re-escaneo regresa vacíos

## Builds / Distribución
- Windows Installer (Inno Setup 6): `dist\\Kraken_Media_Server_Installer_v4.83.exe`
- Windows EXE: `dist\\Kraken_Windows_EXE_v4.83.zip`
- Mac: `dist\\Kraken_Mac_v4.83.zip` (y carpeta `dist\\Kraken_Mac\\`)

## Notas
- Release notes: `RELEASE_NOTES_v4.83.md` (legacy: `RELEASE_NOTES_v4.8.md`).

---

# Cambios Recientes (2026-03-25)

## 1. Runtime Config - Fix persistencia en EXE

### Problema
El EXE compilado con PyInstaller leía config.py desde el bundle (_MEIPASS), lo cual revertía cualquier cambio al reiniciar la app.

### Solución implementada
- Se crea `runtime_config.json` en `%APPDATA%\Kraken Media Server\`
- `config.py` ahora lee valores desde el JSON
- Los cambios se sincronizan en ambos archivos (JSON + config.py local)
- Solo el JSON se usa en modo EXE (evita error de permisos en Program Files)

### Archivos modificados
- `config.py` - Lógica de load/save runtime config
- `routes/api.py` - Endpoints /api/setup y /api/settings escriben en JSON

### Ubicación del JSON
- Windows: `C:\Users\USER\AppData\Roaming\Kraken Media Server\runtime_config.json`
- Mac: `~/Library/Application Support/Kraken Media Server/runtime_config.json`

---

## 2. Consola Integrada (Debug)

### Descripción
Barra verde al final de la página que al hacer click abre una konsola mostrando logs del servidor.

### Características
- Barra visible abajo centro (estilo matrix verde)
- Muestra hasta 500 líneas de logs
- Botón para maximizar, cerrar y limpiar
- Escape de caracteres HTML (< >)

### Archivos modificados
- `routes/api.py` - Buffer de consola + endpoint /api/logs
- `templates/index.html` - Barra y panel de consola

### Endpoints
- `GET /api/logs` - Devuelve array de logs
- `POST /api/logs/clear` - Limpia el buffer

---

## 3. Downloader Mejorado

### Batch URLs
- Ahora acepta múltiples URLs separadas por coma o salto de línea
- El backend procesa cada URL y combina los resultados

### Velocidad de descarga (Concurrent Fragments)
- Selector nuevo: Normal / 2x / 4x
- Usa la opción `concurrentfragments` de yt-dlp
- Descarga fragmentos en paralelo para mayor velocidad

### Límite de carga aumentado
- Ahora carga hasta 100 elementos inicial (antes 20)
- Incrementa de 100 en 100 al "Cargar más"

### Fix bug selections
- Seleccionar todo ya no reinicia la lista
- Las selecciones se mantienen al cargar más resultados

### Archivos modificados
- `routes/api.py` - Lógica batch + concurrentfragments
- `app_tail.py` - UI selector velocidad + fixes

---

## 4. Launcher Silencioso (VBS)

### Descripción
Archivo `iniciar_kraken.vbs` para ejecutar el BAT sin mostrar ventana de CMD.

### Uso
Ejecutar `iniciar_kraken.vbs` en vez de `launcher.bat`

### Código
```vbscript
' Kraken Media Server - Launcher Silencioso
CreateObject("Wscript.Shell").Run """%~dp0launcher.bat""", 0, False
```

### Archivos creados
- `iniciar_kraken.vbs` (fuente + dist)

---

## 5. Build y Distribución

### Paquetes generados
- `dist/Kraken_Windows_v4.8.zip` - Portable Windows (.bat)
- `dist/Kraken_Mac_v4.8.zip` - Portable Mac
- `dist/Kraken_Windows_EXE_v4.8.zip` - EXE compilado (PyInstaller)
- `dist/Kraken_Media_Server_Installer_v4.8.exe` - Instalador Inno Setup

### Spec file (PyInstaller)
```spec
a = Analysis(
    ['app_offline.py'],
    ...
    hiddenimports=['flask', 'yt_dlp', 'mutagen', 'PIL', 'requests', ...]
)
pyz = PYZ(a.pure)
exe = EXE(pyz, ..., console=False, name='KrakenOffline')
```

### Comando build
```bat
pyinstaller --onedir --name KrakenOffline app_offline.py --add-data ...
```

---

## Notas técnicas

### Rutas de archivos
- Videos: `D:\Skazo\Music\...` (configurable)
- Thumbnails: `{media_path}\thumbnails\`
- Temp HLS: `%LOCALAPPDATA%\Kraken Media Server\temp_streams\`
- Runtime config: `%APPDATA%\Kraken Media Server\runtime_config.json`

### Dependencias principales
- Flask + Flask-Compress
- yt-dlp
- mutagen
- Pillow (PIL)
- pywebview
- ffmpeg + ffprobe

### Modos de operación
- **Online**: Requiere internet, acceso via Cloudflare tunnel
- **Offline**: Sin internet, todo cacheado (PWA)
- **LAN**: Red local, sin internet, acceso por IP

---

## Pendiente / Por probar
- [ ] Probar batch URLs con múltiples enlaces
- [ ] Probar selector de velocidad 2x/4x
- [ ] Test de instalación limpia
- [ ] Validar que el runtime config funciona en EXE instalado

---

# 📋 RESUMEN RELEASE v4.8

## Paquetes disponibles
| Paquete | Descripción |
|---------|-------------|
| `Kraken_Windows_v4.8.zip` | Portable Windows (.bat) |
| `Kraken_Windows_EXE_v4.8.zip` | EXE compilado (PyInstaller) |
| `Kraken_Mac_v4.8.zip` | Portable Mac |

## Features principales

### 🎬 Video Streaming (HLS)
- Transcoding on-the-fly para compatibilidad con MKV
- Direct Play para MP4/Webm nativos
- ArtPlayer avanzado con PiP, velocidad, screenshots, gestos táctiles

### 💻 App de escritorio (pywebview)
- Flask en hilo secundario
- WebView2 (Edge Chromium)
- Fallback a navegador externo

### 📱 Offline Support
- Librerías locales: hls.min.js, artplayer.js, tailwind.min.js, fontawesome.min.css, html2canvas.min.js

### ⚙️ Mejoras del downloader
- Múltiples URLs separadas por coma o salto de línea
- Selector de velocidad: Normal / 2x / 4x
- 100 items por página (antes 20)

### 🐛 Fixes
- Runtime config persistente en EXE (%APPDATA%)
- Consola de debug integrada (estilo matrix verde)
- Launcher silencioso VBS (sin ventana CMD)

### 🎨 Admin
- Setup Wizard (primer uso)
- Settings Panel (cambiar email/PIN)
Audio Selector Robusto (ArtPlayer + HLS)

Se añadió cambio de pista de audio estable incluso cuando el navegador no expone audioTracks.
Nuevo parámetro audio_track en /api/hls/play.
Reinicio controlado de sesión HLS al cambiar pista, manteniendo tiempo de reproducción.
Se devolvió selected_audio_track desde backend para sincronizar UI.
Fix crítico para pistas AC3/5.1

Se corrigió error Unsupported channel layout "6 channels".
En transcodificación HLS el audio ahora se fuerza a AAC estéreo (-ac 2) para máxima compatibilidad.
Resultado: cambio de audio funcionando en archivos que antes daban 500.
Etiquetas de audio mejoradas (tipo VLC)

Se mejoró parseo de metadatos de pistas (title, language_code, channels, codec).
Labels más humanos (ej. Español, Japonés) con detalle técnico opcional (AAC 2.0, AC3 5.1).
Dedupe automático cuando hay pistas con nombres repetidos.
Subtítulos externos (estado previo consolidado)

Detección de subtítulos externos en carpeta del video, subs/ y subtitles/.
Soporte de selector en settings de ArtPlayer para tracks externos.
Optimización de re-scan de biblioteca (alta ganancia)

services/library.py ahora usa escaneo delta:
si size_bytes + mtime no cambia, no reprocesa metadata.
scanned_paths pasó de lista a set (elimina cuello O(N²) en limpieza).
Optimización de playlists en generar_biblioteca_viva: de N+1 queries a query única.
Backup de seguridad creado: services/library.py.bak_pre_delta.
Mejoras adicionales recomendadas (siguientes pasos)

Invalidar BIB_CACHE_BY_OWNER automáticamente en endpoints de editar metadata / playlists / borrar.
Añadir modo “Simple/Completo” para labels de audio en UI.
Agregar menú rápido de subtítulos (tamaño/color/fondo/posición) persistido en localStorage.
Medir tiempos antes/después de /actualizar_cache para dejar benchmark real.
