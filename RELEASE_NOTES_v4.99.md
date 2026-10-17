# Kraken Media Server — Notas de Versión v4.99 (Octubre 2026)

Documento resumen de las mejoras, correcciones y optimizaciones implementadas en esta sesión.

---

## 1. Subtítulos: Extracción Automática, Detección Inteligente y Buscador Online

### 🔍 Buscador y Descarga de Subtítulos Online Integrado
- **Nuevos endpoints en [`routes/api.py`](routes/api.py):**
  - `GET /api/subtitles/search`: Consulta subtítulos en Español e Inglés directamente desde Podnapisi.net (JSON API gratuita sin necesidad de API Key), ordenando resultados por idioma (Español primero) y popularidad. Si la búsqueda con año exacto no arroja resultados, reintenta automáticamente por título.
  - `POST /api/subtitles/download`: Descarga el paquete `.zip` o `.srt` en memoria, extrae el archivo `.srt`, normaliza su codificación a **UTF-8 limpio** (corrigiendo acentos y `ñ` de archivos `Windows-1252 / Latin-1`) y lo guarda directamente junto al archivo de video (`<video_stem>.<lang>.srt`).
- **Interfaz en el Editor de Video ([`templates/index.html`](templates/index.html)):**
  - Sección **💬 Subtítulos Online (.SRT UTF-8)** dentro del modal **Editar Video** con botón **🔍 Buscar Subtítulos** y descarga en un clic.

### 🛠️ Extracción Automática de Subtítulos Embebidos (Fase 3 de Auto-Tag)
- **[`services/video_tagger.py`](services/video_tagger.py) (`extract_embedded_subtitles_for_video`):**
  - Integrada la lógica de `subti.py` dentro del flujo de **Auto-Tag Videos**: detecta pistas de subtítulos de texto embebidas (`subrip`, `srt`, `ass`, `ssa`, `mov_text`, `webvtt`) ignorando subtítulos de mapa de bits (`hdmv_pgs_subtitle`, `dvd_subtitle`) y las extrae con `ffmpeg` a archivos `.srt` externos sin sobrescribir los ya existentes.
- **Candado de Concurrencia (`_BG_TASK_LOCK` en [`routes/api.py`](routes/api.py)):**
  - Evita que **Sync Library** y **Auto-Tag Videos** corran simultáneamente y bloqueen SQLite (`database is locked`).

### 📂 Detección Flexible y Codificación UTF-8 al vuelo
- **[`routes/hls.py`](routes/hls.py):**
  - Reconocimiento de subtítulos externos aunque no tengan punto antes del sufijo de idioma (ej. `Pelicula (1998)spa.srt` o `Pelicula_es.srt`).
  - **Fallback para carpetas de película única:** Si una carpeta tiene un único archivo de video y un archivo `.srt`/`.vtt` con cualquier nombre (ej. `subs.srt`), se vincula automáticamente al video.
- **[`routes/media.py`](routes/media.py):**
  - Conversión automática al vuelo de `.srt` / `.vtt` desde `Windows-1252 (ANSI)` / `Latin-1` a `UTF-8` para que nunca se rompan los caracteres en español (`ñ`, `á`, `¿`, `¡`).

---

## 2. Reproducción HLS de Películas Pesadas (MKV / Remux)
- **[`routes/hls.py`](routes/hls.py) y [`templates/index.html`](templates/index.html):**
  - Incrementado el tiempo de espera inicial del primer segmento `.ts` en el servidor (hasta `25s`) para discos duros mecánicos en reposo o archivos MKV de alto bitrate.
  - Protección `_hlsInitializing` y gracia de `25s` en el watchdog del reproductor para evitar falsos reinicios o cierres prematuros de `ffmpeg` mientras se genera el `index.m3u8`.

---

## 3. Categoría `+18` (`🔞 Adult`) y Seguridad por PIN Maestro
- **Guardado de Clasificación `+18` ([`routes/api.py`](routes/api.py) y [`services/library.py`](services/library.py)):**
  - Al asignar clasificaciones `18`, `R18+` o `NC-17` desde el editor de video, se actualiza automáticamente `is_adult = 1` en la base de datos y se preserva `tmdb_overview` durante re-escaneos.
  - Corregida una mutación en caché dentro de `/biblioteca` (`copy.deepcopy`) que ocultaba permanentemente elementos adultos tras una consulta sin PIN.
- **Visibilidad Estricta bajo PIN Maestro ([`templates/index.html`](templates/index.html)):**
  - La categoría **`🔞 Adult`** permanece completamente oculta en el menú desplegable de Categorías mientras no se haya ingresado el PIN Maestro.
  - En cuanto el usuario desbloquea el modo oculto con su PIN Maestro (`getMasterPin`), la biblioteca se recarga automáticamente y **`🔞 Adult`** aparece al instante en el selector de Categorías.

---

## 4. Interfaz: Tamaños de Miniaturas y Optimización de Carga (`/biblioteca`)
- **Selector de Tamaño de Miniaturas ([`templates/index.html`](templates/index.html)):**
  - **Películas y Series:** Añadidos 3 niveles de tamaño de póster (`S` compacto de 6 columnas, `M` mediano de 5 columnas y `L` grande de 4 columnas) con botón dedicado en la barra de herramientas.
  - **Música (Grid):** La vista de cuadrícula de canciones inicia por defecto en el tamaño más compacto (`S` — 8 columnas en escritorio).
- **Optimización de Payload JSON en `/biblioteca` ([`services/library.py`](services/library.py)):**
  - Las canciones de audio omiten campos exclusivos de video (`tmdb_*`, `is_hidden`) y los videos omiten campos exclusivos de audio (`bpm`, `energy`), eliminando más de **130,000 llaves nulas/redundantes** en cada carga de biblioteca sin alterar ninguna función de la app.
- **Service Worker ([`sw.js`](sw.js)):**
  - Estrategia **Network-First** para el `APP_SHELL` cuando la app está conectada, garantizando que las actualizaciones de interfaz se reflejen de inmediato sin requerir borrar caché manualmente.
