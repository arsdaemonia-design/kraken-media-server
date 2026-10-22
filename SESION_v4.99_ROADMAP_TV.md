# Kraken Media Server — Cambios recientes y Roadmap TV (Android TV / Roku)

Documento de sesión y arquitectura técnica (octubre 2026). Complementa `RELEASE_NOTES_v4.99.md` y `README.md`.

---

## 1. Cambios realizados en las últimas iteraciones

### v4.99
| Área | Cambio | Archivos |
|---|---|---|
| Subtítulos | Búsqueda y descarga online (Podnapisi / SubDL, sin API key). Se guarda como `<video>.<lang>.srt` en UTF-8 desde el modal **Editar Video**. | `routes/api.py`, `templates/index.html` |
| Subtítulos | Extracción de subtítulos embebidos (texto) a `.srt` dentro de Auto-Tag Videos. | `services/video_tagger.py` |
| Subtítulos | Detección flexible de `.srt/.vtt` (sin punto antes del idioma, carpeta con un solo video) y conversión ANSI/Latin-1 → UTF-8 al servir. | `routes/hls.py`, `routes/media.py` |
| Concurrencia | Candado `_BG_TASK_LOCK`: Sync Library y Auto-Tag no corren a la vez (evita `database is locked`). | `routes/api.py` |
| HLS | Más tiempo de espera del primer segmento y gracia en el watchdog para MKV pesados / disco en reposo. | `routes/hls.py`, `templates/index.html` |
| +18 | Guardado correcto de `is_adult`, categoría `🔞 Adult` oculta hasta ingresar el PIN maestro y visible al instante después. | `routes/api.py`, `services/library.py`, `templates/index.html` |
| UI | Miniaturas de películas con 3 tamaños (S/M/L); grid de música inicia en el tamaño más pequeño. | `templates/index.html` |
| Rendimiento | `/biblioteca` omite campos nulos/innecesarios (~130 000 llaves menos). | `services/library.py` |
| PWA | Service Worker en Network-First cuando hay conexión. | `sw.js` |

### v4.99.1 (reproductor)
- Pantalla completa: la barra inferior, el título y el botón ← se ocultan solos a los 4s (táctil, ratón y D-Pad). Se corrigió el estado `isHover` "pegado" en tablet y se desactivó `fullscreenWeb`.
- Título del reproductor limpio (sin extensión de archivo ni identificadores TMDB).
- Gestos táctiles estilo YouTube: doble toque izquierda/derecha = -10 s / +10 s (acumulable con indicador HUD numérico), doble toque al centro = pausa/play, con animación ripple.
- Instaladores: `dist/Kraken_Media_Server_Installer_v4.99.exe` y `..._v4.99.1.exe`. Commits en `origin/master` (`3ca228b`, `ef32544`).

---

## 2. Kraken Android TV (`KrakenTV`)

### Estado de Integración y Backend
El cliente nativo se estructuró e implementó en `E:\Kraken Media Server\KrakenTV\`, fuera del árbol Git del backend:
- **Estructura Gradle:** `build.gradle.kts`, `settings.gradle.kts`, `gradle.properties`, `app/build.gradle.kts` (`AGP 9.4.0`, `compileSdk = 37`, `minSdk = 24`, `targetSdk = 28`, `abiFilters += "armeabi-v7a"`), ProGuard rules. Gradle Wrapper 9.8.2 presente (`gradlew`, `gradlew.bat` y `gradle-wrapper.jar`).
- **Manifiesto TV:** Categoría `android.intent.category.LEANBACK_LAUNCHER`, `android.hardware.touchscreen = false`, banner 16:9 (`banner_320x180.xml`).
- **Navegación Espacial:** `LoginActivity`, `MainActivity`, `BrowseFragment` (Leanback `ArrayObjectAdapter`), `PlayerActivity` (Media3/ExoPlayer con D-Pad, ±10s con flechas, auto-hide controles a los 4s).
- **Consumo de Memoria:** Optimizado para bajo consumo mediante posters escalados a `185x278` en `RGB_565`. Menos de 80 MB es un objetivo de diseño pendiente de medir en hardware.

### Endpoints de TV implementados en el backend
1. **`GET /api/tv/library?offset=0&limit=40`**:
   - Paginación liviana (por defecto 40, máximo 60).
   - Exige token JWT Bearer en `Authorization` (`401` si falta o no es válido; este helper no valida cookie).
   - Filtra contenido según `is_kid_mode`.
   - Contenido `+18` protegido: requiere cabecera `X-Master-Pin` para visibilidad de la bóveda de adultos.
2. **`GET /api/tv/poster/<path>`**:
   - Genera y cachea en disco (`THUMBNAILS_FOLDER/tv_cache/<hash>.jpg`) un JPEG derivado de `185x278` a 82% de calidad. El documento original reporta ~18 KB en una muestra; el tamaño depende de la imagen.
   - Corregido el manejo de `direct_passthrough = False` en Flask `send_file`.
   - Cabeceras de caché: `public, max-age=31536000, immutable`.
   - La conversión se ejecuta dentro de la petición actual, no en un hilo secundario. `tv_poster` no exige Bearer explícitamente; definir si el acceso público al póster es deliberado.
3. **`GET /api/tv/episodes?path=...`**:
   - Devuelve episodios de una serie agrupada por la ruta de su carpeta, con los mismos filtros de visibilidad, modo niños y PIN maestro. La ruta puede tener distinta profundidad y el nombre del episodio se toma del archivo para evitar repetir el título de la serie.
   - `/api/tv/library` identifica la serie usando la carpeta anterior al primer directorio `Season`/`Temporada`; no presupone una profundidad fija.
4. **`POST /api/stream/token` & `GET /api/hls/play`**:
   - Validación estricta del PIN maestro antes de emitir tokens reproducibles para videos marcados como `is_adult=1`.
   - Se inyecta la bandera `'adult_authorized'` en `state.STREAM_TOKENS[token]`.
   - `play_hls()` rechaza con `403` si el contenido es adulto y el token no fue autorizado con el PIN.

### Pendiente
1. El 20-Oct se recompiló el APK debug con Gradle 9.8.2 y se instaló en el AVD Android TV 1080p. Se comprobó login existente, catálogo con carruseles y navegación D-Pad desde una serie a temporadas y episodios. Los nombres `Season 1` y `Temporada 1` aparecen unificados como `Temporada 1`.
2. La interfaz usa navegación lateral Kraken y carruseles Leanback sobre fondo oscuro; varias series aún muestran imágenes genéricas o fotogramas cuando Kraken no tiene una carátula de serie disponible. Revisar el enriquecimiento de posters para esos títulos.
3. Las correcciones nuevas de agrupación y título de episodio están en el código local del backend. Reiniciar/publicar esa instancia para que Kraken TV reciba esos cambios; no se actualizaron servidores remotos durante esta sesión.
4. Quedan pruebas de audio/subtítulos y reanudación en dispositivo Android TV físico. Medir RAM con `adb shell dumpsys meminfo com.kraken.tv`; menos de 80 MB sigue siendo una meta no medida.

---

## 3. Kraken Roku (BrightScript + SceneGraph)

### Factibilidad
**Sí, es factible:**
- Roku reproduce **HLS nativamente** (nodo `Video`), con audio alterno y subtítulos. El backend de Kraken ya entrega HLS (H.264 + AAC), por lo que es totalmente compatible.
- Memoria en Roku: posters pequeños (`185x278` vía `/api/tv/poster/<path>`), nodo `RowList` para virtualización de filas, operaciones de red obligatoriamente en `Task` nodes.
- Red: HTTPS válido en la URL que configure cada operador (por ejemplo, `https://media.tudominio.com` a través de su Cloudflare Tunnel).

### Estructura Propuesta
```text
KrakenRoku/
├── manifest
├── source/main.brs            # arranque, loop de eventos
├── components/
│   ├── MainScene.xml/.brs     # navegación y manejo de Back
│   ├── LoginScene.xml/.brs    # autenticación o código de vinculación
│   ├── BrowseScreen.xml/.brs  # RowList de categorías y posters
│   ├── DetailsScreen.xml/.brs # Sinopsis, año, botón reproducir
│   ├── PlayerScreen.xml/.brs  # nodo Video, HUD controles, pistas
│   └── tasks/ApiTask.xml/.brs # Llamadas HTTP fuera del hilo principal
└── images/ (iconos HD/FHD, splash)
```

---

## 4. Optimización de Disco y Consumo en Servidor

El escaneo y enriquecimiento se ejecutan principalmente al incorporar nuevos títulos. Para minimizar el impacto en discos duros mecánicos (HDD):
1. **Candado `_BG_TASK_LOCK`:** Impide que el escaneo y el auto-etiquetado compitan por E/S simultánea.
2. **Prioridad de Proceso:** `ffmpeg` y `ffprobe` pueden ejecutarse con `BELOW_NORMAL_PRIORITY_CLASS` en Windows.
3. **Pausas entre Títulos:** Procesamiento secuencial con breves pausas de 100 ms para permitir que el buffer del disco se vacíe.
4. **Exclusiones de Antivirus:** Excluir la carpeta de descargas/medios del análisis en tiempo real de Windows Defender y de Windows Search Indexer.

---

## 5. Prompts de Avance

### Prompt A — Compilación y Pruebas de Kraken Android TV
```text
Eres un desarrollador senior de Android TV. En el proyecto Kraken Android TV ubicado en
E:\Kraken Media Server\KrakenTV:
1. Abre el proyecto en un entorno con JDK compatible y Android SDK 37 (Build Tools 36.0.0).
2. Usa el Gradle Wrapper 9.8.2 incluido y ejecuta `:app:assembleDebug`; corrige incompatibilidades de build/dependencias si aparecen.
3. Despliega el APK en un dispositivo o emulador Android TV con arquitectura armeabi-v7a.
4. Valida:
   - Conexión a la URL HTTPS configurable de una instancia de prueba propia con autenticación JWT.
   - Paginación fluida en BrowseFragment con posters de 185x278.
   - Reproducción HLS con Media3/ExoPlayer, auto-ocultado de controles a los 4s, adelantar/atrasar con flechas D-Pad.
   - Validación de PIN maestro para la Bóveda de Adultos (+18).
5. Mide la RAM con 'adb shell dumpsys meminfo com.kraken.tv'; compara el resultado con la meta < 80 MB sin asumirla como resultado garantizado.
```

### Prompt B — Construcción del Cliente Roku (BrightScript + SceneGraph)
```text
Eres un desarrollador senior de Roku (BrightScript + SceneGraph).
Crea el canal 'KrakenRoku' en E:\Kraken Media Server\KrakenRoku para conectarse a un backend Kraken configurable mediante `<KRAKEN_BASE_URL>`.
Requisitos:
1. Implementa la arquitectura SceneGraph con manifest, source/main.brs, MainScene y tareas ApiTask.
2. Conéctate a los endpoints existentes:
   - GET /api/tv/library?offset=... para alimentar el componente RowList.
   - GET /api/tv/poster/<path> para los pósteres optimizados de 185x278.
   - POST /api/stream/token y GET /api/hls/play para reproducir en el nodo Video.
3. Gestiona foco con el control remoto D-Pad y tecla Back.
4. Empaqueta el canal en un .zip para instalación en Modo Desarrollador de Roku.
```

---

## 6. Documentación Histórica
Los documentos antiguos de diagnóstico, notas de versiones anteriores a v4.99 y transcripciones de sesiones pasadas han sido archivados en:
`_archive/docs_historicos/`
Esto mantiene la raíz del repositorio limpia, clara y enfocada en las versiones actuales.

---

## 7. Sesión 21-22 Octubre 2026: Android TV Music Player, Karaoke LRC, Control Remoto Radar y Migración Modular v5.0.0

### 7.1 Kraken Android TV (`KrakenTV` / `KrakenMS.apk`)
- **Reproductor de Música dedicado (`MusicPlayerActivity`):**
  - Implementado con AndroidX Media3 / ExoPlayer para reproducción directa de audio en streaming.
  - Carátula en alta definición, metadata de pista, controles D-Pad confiables de Play/Pausa y adelantar/atrasar con salto de ±10 segundos.
  - Interfaz oscura con visualización de tiempo transcurrido, duración y barra de progreso.
- **Sincronización de Letras LRC en Tiempo Real (Modo Karaoke):**
  - Consumo del endpoint `/api/tv/music/lyrics` (soporta ID o parámetros `?title=...&artist=...&path=...`).
  - Parser de marcas de tiempo LRC `[mm:ss.xx]` con sincronización continua contra `player.currentPosition`.
  - Resaltado dinámico con color de acento sobre la línea activa y scroll automático suave conforme avanza la pista.
  - Modo fallback elegante para canciones con letra en texto plano sin timestamps.
- **Control Remoto Bidireccional (Radar Remote):**
  - Registro automático del dispositivo Android TV en el radar con identificador `📺` y escucha de eventos Socket.io / endpoints de control.
  - Recepción de comando `remote_play` desde navegadores o móviles para reproducir audio y video inmediatamente en la TV.
  - Control de reproducción en vivo desde otros dispositivos conectados: play, pausa, seek y parada.
- **Navegación y Cuenta:**
  - Menú lateral interactivo con acceso a Videos, Música y Playlists.
  - Diálogo de Cuenta con opciones nativas para cambio de usuario, información de conexión y cierre de sesión.
- **Compilación del APK:**
  - Compilado con Gradle 9.8.2 (`:app:assembleDebug`) con ABI `armeabi-v7a`.
  - Archivo binario final: `KrakenMS.apk` (9.4 MB), verificado en emulador Android TV 1080p y replicado en la raíz y directorios `dist/`.

---

### 7.2 Kraken Modular (`Kraken Media Server - modulE` v5.0.0)
- **Modularización del Frontend:**
  - Separación de la SPA monolítica en 17 módulos JavaScript independientes en `assets/js/`:
    `admin-settings.js`, `app-init.js`, `audio-player.js`, `auth.js`, `console.js`, `downloader-tools.js`, `head-config.js`, `hero_series.js`, `library-render.js`, `lyrics-share.js`, `playlists-batch.js`, `radar-remote.js`, `state.js`, `tag-editor.js`, `tv-lite.js`, `video-catalog.js`, `video-player.js`.
  - Todos validados sintácticamente con `node --check`.
- **Sincronización Total de Backend Python:**
  - Paridad 1:1 verificada entre la versión monolítica y la modular:
    - `routes/tv_api.py`: soporte extendido para búsqueda de letras por query parameters.
    - `routes/media.py`: alias `/stream/<path:filename>` y ruta de Service Worker `/sw.js`.
    - `state.py`: ventana de tolerancia para desconexión inactiva del radar aumentada a 45 segundos.
    - `services/auth.py`: soporte para autorización JWT por query param `?token=`.
- **Correcciones Críticas de Frontend:**
  - `auth.js`: Se aseguró el ocultamiento inmediato del overlay inicial (`#loader`) al disparar la pantalla de autenticación para evitar bloqueos visuales.
  - `index.html`: Elevación del `z-index` de `#kraken-auth-screen` a `z-[100005]` para quedar por encima de cualquier capa de precarga.
  - `radar-remote.js`: Inclusión de metadata completa (carátula, artista y título) en la carga enviada a dispositivos `📺`.
- **Activación en Producción:**
  - La versión modular fue configurada con puerto predeterminado `5000` (`app.py` y `app_offline.py`).
  - Se detuvo la versión monolítica y se levantó la versión modular como servicio activo en segundo plano en el puerto 5000.
  - Conexión verificada con el túnel Cloudflare (`https://kraken.ederzu.com`), respondiendo HTTP 200 OK tanto localmente como a través del túnel público.

---

### 7.3 Generación de Binarios e Instaladores Finales

| Componente | Rama | Versión | Tipo | Ruta / Archivo | Tamaño |
|---|---|---|---|---|---|
| **Servidor Modular** | Modular | `v5.0.0` | Instalador Inno Setup | `Kraken Media Server - modulE\dist\Kraken_Media_Server_Installer_v5.0.0.exe` | 278.8 MB |
| **Servidor Modular** | Modular | `v5.0.0` | Ejecutable Standalone | `Kraken Media Server - modulE\dist\KrakenOffline\KrakenOffline.exe` | — |
| **Servidor Monolítico** | Monolítico | `v4.99.1` | Instalador Inno Setup | `Kraken Media Server\dist\Kraken_Media_Server_Installer_v4.99.1.exe` | 278.8 MB |
| **Servidor Monolítico** | Monolítico | `v4.99.1` | Ejecutable Standalone | `Kraken Media Server\dist\KrakenOffline\KrakenOffline.exe` | — |
| **Cliente Android TV** | KrakenTV | `v1.0` | APK Debug | `E:\Kraken Media Server\KrakenMS.apk` (y en carpetas `dist/`) | 9.4 MB |

---

### 7.4 Control de Versiones (Git)
- Se preservaron todos los cambios en local sin realizar `git push`.

---

### 7.5 Resolución de Auditoría Estática Pre-Release (22-Oct-2026)
- **Lanzador de Staging (`iniciar_staging.bat`):** Se agregaron explícitamente `set PORT=5050` y `set KRAKEN_PORT=5050` para garantizar que el banco de pruebas siempre inicie en el puerto 5050 y no colisione con el puerto 5000 de producción.
- **Seguridad en Flask Debug (`app.py`):** Se eliminó el parámetro `debug=True` estático; ahora se controla mediante variable de entorno (`FLASK_DEBUG`/`KRAKEN_DEBUG`), operando en `debug=False` por defecto para prevenir la exposición de la consola de Werkzeug a través de túneles Cloudflare.
- **Restricción de JWT por URL (`services/auth.py`):** Se limitó la aceptación de `?token=` exclusivamente a rutas multimedia (`MEDIA_QUERY_AUTH_PREFIXES`: `/api/tv/music/stream`, `/api/tv/music/lyrics`, `/api/tv/poster`, `/stream`, etc.) donde los clientes nativos (Media3/ExoPlayer/tags HTML) no inyectan cabeceras `Authorization: Bearer`. Rutas administrativas y de API general rechazan tokens en URL.
- **Identidad de Instalador Windows (`kraken_installer.iss`):** Se documentó que el uso compartido del `AppId` original es el estándar de Inno Setup para una actualización in-place (upgrade v4.99 -> v5.0.0) manteniendo configuraciones y registros limpios.
- **Reproductor de Música Android TV:** Verificado que la build actual en `KrakenMS.apk` incluye la fila completa de controles D-Pad (`btn_prev`, `btn_rewind`, `btn_play_pause`, `btn_forward`, `btn_next`, `btn_lyrics`), barra de progreso scrubber, visualizador de ondas y panel derecho de sincronización LRC en vivo (evidenciado en artefactos `tv_heroes_karaoke.png` y `tv_heroes_active_line.png`).
- **Versionado Android TV (`build.gradle.kts`):** Se actualizaron los metadatos a `versionCode = 2` y `versionName = "1.0.0"`, recompilando y distribuyendo el nuevo binario `KrakenMS.apk`.

---

### 7.6 Arquitectura Completa de Kraken Android TV (`KrakenTV` v1.0.0) y Correcciones Avanzadas

#### 1. Arquitectura Técnica y Stack
- **Ubicación:** `E:\Kraken Media Server\KrakenTV` (Proyecto Kotlin independiente con Gradle 9.8.2).
- **Parámetros de Build:** `compileSdk = 37`, `minSdk = 24` (Android 7.0 Nougat), `targetSdk = 28` (Android 9 Pie para compatibilidad amplia con TVs y TV Boxes chinos), `ndk { abiFilters += "armeabi-v7a" }`.
- **Librerías Clave:**
  - `androidx.leanback:leanback:1.0.0`: Carruseles, navegación de catálogo y controles remotos espaciales.
  - `androidx.media3:media3-exoplayer:1.5.1` y `media3-ui`: Motor de reproducción nativo para HLS y MP4/AAC/FLAC.
  - `com.github.bumptech.glide:glide:4.16.0`: Carga eficiente de miniaturas y pósteres en memoria baja (`RGB_565`).
  - `com.squareup.okhttp3:okhttp:4.12.0`: Comunicación HTTP/HTTPS, interceptores de autenticación y WebSocket.

#### 2. Interfaz Principal y Navegación D-Pad (`MainActivity.kt`, `BrowseFragment.kt`)
- **Menú Lateral Dinámico:**
  - Acceso directo a categorías: *Películas*, *Series*, *Música* y *Playlists*.
  - **Diálogo de Cuenta Nativo:** Permite ver el usuario autenticado, servidor conectado, cambiar de cuenta o cerrar sesión limpiamente borrando tokens en `SessionStore`.
- **Catálogo Espacial:** Carruseles Leanback por géneros y agregados recientes, alimentados desde `/api/tv/library` de forma paginada (40 elementos por lote) con caché local de pósteres (`185x278`).

#### 3. Reproductor de Música Premium OLED Emerald (`PlayerActivity.kt`, `activity_player.xml`)
- **Visualizador Espectro:** Componente nativo `WaveformVisualizerView` con animación de ondas estilo Kraken Web.
- **Barra de Reproducción Interactiva (`SeekBar` con Navegación D-Pad):**
  - Se sustituyó la barra estática por un `SeekBar` interactivo con thumb esmeralda dinámico (`@drawable/seek_thumb`).
  - **Foco Visual en TV:** Al recibir foco con el control remoto, el selector se expande a 20dp con borde blanco `#FFFFFF` y relleno esmeralda `#34D399` para visibilidad inmediata en pantallas OLED.
  - **Navegación Intuitiva con Control Remoto:**
    - Desde cualquier botón de la fila de controles, presionar `DPAD_UP` enfoca directamente la barra de reproducción.
    - Con la barra enfocada, presionar `DPAD_LEFT` (-10s) o `DPAD_RIGHT` (+10s) ejecuta un seek en tiempo real con indicador HUD.
    - Presionar `DPAD_DOWN` devuelve el foco a la fila de botones de reproducción (`btnPlayPause`).
    - Al tocar o arrastrar en pantallas táctiles o mediante ratón/air-mouse, salta instantáneamente al punto seleccionado.
- **Fila de Controles Focusables:** `btnPrev` (⏮ Ant), `btnRewind` (⏪ -10s), `btnPlayPause` (▶/⏸), `btnForward` (⏩ +10s), `btnNext` (⏭ Sig), `btnLyrics` (🎤 Letras).

#### 4. Modo Karaoke y Sincronización de Letras LRC en Tiempo Real
- **Parser de Letras LRC:** Extracción de timestamps `[mm:ss.xx]` de letras locales sincronizadas y consumo desde `/api/tv/music/lyrics`.
- **Visor Sincronizado:** Auto-scroll continuo y suave al ritmo de la pista con resaltado en verde esmeralda brillante (`#10B981` y negrita) sobre la línea exacta que se está cantando.
- **Modo Fallback:** Presentación en texto plano cuando la pista no cuenta con marcas de tiempo.

#### 5. Radar Remoto Bidireccional (`TvRadarManager.kt`)
- Registro automático en Kraken Server con icono `📺` y envío de estado (`TvPlaybackState`: canción, artista, reproducción/pausa).
- Soporte para comandos `remote_play` y órdenes remotas (`play`, `pause`, `seek`, `stop`) disparados desde la versión web o móvil.

#### 6. Solución al Error "Pista no compatible o dañada" (Películas 4K AVC / Fantasía 1940)
- **Causa Raíz Diagnosticada:**
  - La película *Fantasía (1940)* está codificada en **4K AVC (2872 x 2160, H.264 High@L5.1)** en contenedor `.mp4`.
  - El servidor enviaba `direct_play: True` basándose solo en el contenedor MP4 y códec H.264.
  - Los decodificadores de hardware de Smart TVs y Android TV (`c2.android.avc.decoder` / Amlogic / MediaTek / emuladores) únicamente soportan decodificación H.264 por hardware hasta **1080p (Level 4.2)**. Al superar 1080p, el decodificador falla con `ERROR_CODE_DECODING_FAILED` ("Pista no compatible o dañada").
- **Solución en Servidor (`services/hls_transcoder.py`):**
  - Se añadió detección de resolución en `analyze_media()`: si `is_over_1080p = width > 1920 or height > 1080`, se desactiva `direct_play` y `hls_can_copy_video`.
  - En el comando de transcodificación FFmpeg, se aplica automáticamente el filtro de escala `-vf "scale='min(1920,iw)':-2"`.
  - Ahora cualquier video en 4K H.264 es transcodificado y escalado a 1080p vía HLS para reproducción 100% fluida en cualquier televisor.
- **Solución en Cliente Android TV (`PlayerActivity.kt`):**
  - Se implementó un fallback inteligente en `onPlayerError`: si un video en modo directo falla por decodificación en el hardware de la TV, solicita inmediatamente la versión HLS transcodificada al servidor y reanuda la reproducción sin interrumpir al usuario.




---

### 7.7 Rediseño Unificado de Control de Dispositivos (Spotify Connect) y Escucha Activa (Spotify Jam)

#### 1. Diagnóstico y Problemas Resueltos
- **Control Fragmentado y Repetitivo:**
  - Anteriormente, el modal mostraba consolas de control duplicadas (`|<<`, `( )`, `>>|`, `vol-`, `vol+`) para cada dispositivo detectado, más dos botones en competencia con nombres confusos: *Controlar* (titiritero) y *Salida Activa* (redirección de tracks).
  - Dos paneles flotantes (`#playback-target-widget` a `bottom-[29rem]` y `#remote-control-widget` a `bottom-40`) saturaban la pantalla y tapaban la biblioteca.
- **Escucha Activa sin Retroalimentación ni Controles:**
  - Al pulsar los audífonos junto a la canción de un amigo, el sistema solo reproducía la pista desde el segundo 0, sin retroalimentación visual de estar en sesión compartida, sin controles de resincronización temporal y sin seguimiento si el anfitrión cambiaba de canción.

#### 2. Arquitectura de Dispositivos Unificada (Spotify Connect)
- **Selección de Dispositivo en Un Solo Toque (`selectConnectDevice`):**
  - Tocar cualquier fila de dispositivo en la lista asigna atómicamente tanto el destino de reproducción (`KRAKEN_PLAYBACK_TARGET`) como el objetivo de control remoto (`KRAKEN_CONTROL_TARGET`).
  - Si se selecciona *"Este equipo (Salida local)"*, se desvincula el control remoto y el audio regresa al altavoz local instantáneamente.
- **La Barra Principal es el Control Remoto Universal (`assets/js/audio-player.js`):**
  - Se eliminaron las mini-consolas duplicadas del modal.
  - Al estar conectado a una TV u otro equipo, **la barra de reproducción inferior que el usuario ya conoce opera como el control remoto real**:
    - `togglePlay()`: Envía comando remoto de pausa/reanudación al dispositivo conectado.
    - `playNext()` y `playPrevious()`: Envía órdenes de siguiente o anterior al dispositivo.
    - `seekAudio()`: Envía salto de tiempo en segundos (`seek_to_X`) al dispositivo.
    - `setVolume()`: Ajusta el volumen del dispositivo conectado de forma remota.
    - Seleccionar cualquier pista en el catálogo la envía de inmediato a reproducirse en la TV (`sendFileToControlledDevice`).
- **Botón de Connect en la Barra de Reproducción (`templates/index.html`):**
  - Integrado en la barra móvil (`#btn-connect-mobile`) y de escritorio (`#btn-connect-desktop`) con icono `fa-tower-broadcast`.
  - Cuando un dispositivo remoto está activo, se enciende un indicador verde esmeralda brillante con animación de conexión activa.

#### 3. Escucha Activa Compartida (Spotify Jam)
- **Modal de Amigo y Jam (`showFriendModal`):**
  - Tarjeta destacada de Escucha Activa con degradado violeta/índigo y visualización de la pista actual y duración en vivo.
  - Botón principal de alto impacto: `[ 🎧 Sintonizar y escuchar juntos ]` (`startJamSession`).
  - Si ya se está en sesión, la tarjeta muestra el estado `🟢 En sintonía con [Amigo]` y controles inmediatos:
    - `[ 🔄 Resincronizar tiempo ]`: Salta al segundo exacto en el que va el anfitrión (`resyncJamSession`).
    - `[ ⏹ Dejar de escuchar ]`: Sale de la sesión y restaura el modo independiente (`stopJamSession`).
- **Controlador Flotante Persistente (`#jam-session-banner`):**
  - Mientras la sesión Jam esté activa, flota una píldora estética justo sobre la barra de música:
    `🟣 Jam con [Nombre] · [Canción]  [ 🔄 Sincronizar ]  [ ✕ Salir ]`
  - Tocar la píldora abre nuevamente el modal con las opciones de la sesión.
- **Seguimiento Automático de Pistas:**
  - El radar detecta en cada sondeo si el anfitrión cambió de canción. Si ocurre, el cliente automáticamente carga y sintoniza la nueva pista, manteniendo la experiencia de escuchar juntos sin interrupciones.

#### 4. Archivos Modificados
- `assets/js/state.js`: Añadido estado global `window.KRAKEN_SYNC_JAM`.
- `assets/js/radar-remote.js`: Reemplazo del modal antiguo por `showConnectModal()`, `showFriendModal()`, `selectConnectDevice()`, `startJamSession()`, `resyncJamSession()`, `stopJamSession()`, `renderJamBanner()` y `renderPlayerConnectIndicator()`.
- `assets/js/audio-player.js`: Enrutamiento inteligente de `togglePlay()`, `playNext()`, `playPrevious()`, `seekAudio()`, `setVolume()` y `updatePlayIcons()` hacia el dispositivo controlado.
- `templates/index.html`: Botones Connect en barra móvil y escritorio con indicadores luminosos de conexión activa.

#### 5. Modo Espejo Integral (Ghost Playback / Mirror Player UI - Estilo Spotify Connect)
- **Visualización Completa en el Dispositivo Controlador:**
  - Cuando un dispositivo (ej. celular o laptop) selecciona a otro (ej. Smart TV o PC con bocinas) como salida activa, el dispositivo controlador ya no se queda con la barra vacía o apagada.
  - Se activa automáticamente la barra de reproducción local completa mostrando:
    - Carátula del álbum en alta resolución (`/caratula/...`).
    - Título y artista de la canción que suena en la TV.
    - Contador de tiempo actual y duración total.
    - Barra scrubber interactiva que avanza suavemente segundo a segundo mediante un ticker interpolado local.
    - Icono dinámico de Play/Pausa sincronizado con el estado real del equipo remoto.
- **Audio Local Muteado Inteligente:**
  - El elemento de audio local permanece en pausa para que el sonido provenga única y exclusivamente de los altavoces del equipo destino.
- **Control Total de Navegación y Cola:**
  - Tocar cualquier canción en la biblioteca o cola la despacha de inmediato a la TV y actualiza el reproductor espejo.
  - Los botones de Play/Pausa, Siguiente, Anterior y el arrastre de la barra scrubber envían los comandos remotos (`play`, `pause`, `next`, `prev`, `seek_to_X`) al instante.
- **Sintonización al Equipo Destino ("Usuario Final"):**
  - Si un usuario está conectado a su Smart TV y decide *"Sintonizar y escuchar juntos"* con un amigo del radar, la canción se despacha de inmediato a la Smart TV en el segundo exacto que va el amigo, y la pantalla del celular lo refleja en modo espejo.
- **Transmisión Directa a Amigos:**
  - En el modal de amigos se integró el botón `[ 📡 Transmitir lo que suena a {Nombre} ]`, permitiendo empujar la canción en curso hacia los altavoces de un amigo con un toque.


### 7.8 Corrección de Filtro de Dispositivos y Aislamiento de Cuentas en el Radar
- **Diagnóstico del Problema:**
  - Al iniciar sesión con otra cuenta en la misma red local (ej. el perfil del hijo en Edge), dicha sesión aparecía erróneamente en el modal de "Conectar a un dispositivo" del padre como si fuera un altavoz local ("💻 PC Windows"), permitiendo secuestrar o redirigir audio sin querer.
  - Además, las peticiones sin autenticación (como pestañas anónimas o recién abiertas) heredaban por defecto el `SUPERADMIN_EMAIL`, asociando dispositivos al superadmin antes del login.
  - La función `getDeviceDisplayName` anteponía la cadena genérica `device_name` ("PC Windows") antes del nombre de la persona, ocultando la identidad real del usuario en los modales sociales.
- **Solución Implementada:**
  - En `routes/api.py`, las peticiones a `/status` sin cabecera Bearer válida ya no asumen `SUPERADMIN_EMAIL`. Se manejan como sesiones locales/anónimas sin sobrescribir registros ni asignar identidades maestras en la BD.
  - En `assets/js/radar-remote.js`:
    - `getDeviceDisplayName`: Muestra de forma limpia la identidad del dispositivo: `📺 Smart TV / Kraken TV (Chromecast)`, `📱 Aldo · iPhone`, o `💻 Mateo · PC Windows`.
    - `showConnectModal`: Filtra rigurosamente los dispositivos conectables. Únicamente se listan:
      1. Dispositivos pertenecientes a la **misma cuenta** (`email === MY_EMAIL` o `name === MY_NAME`).
      2. Pantallas y altavoces compartidos dedicados del hogar (`device_type === 'tv'`, `is_speaker === true`, o palabras clave como sala/comedor/tv).
    - Los navegadores y celulares personales de otros usuarios quedan reservados para las burbujas sociales del Radar (Jam, Watch Party, Chat y Recomendaciones), sin contaminar la lista de salidas de audio.

### 7.9 Kraken Cine Remote & Watch Party ("Ver Juntos")
- **Kraken Cine Remote (Mando a Distancia Universal para Cine en TV):**
  - Al seleccionar una película o capítulo de serie en la biblioteca teniendo una Smart TV conectada en Connect (`KRAKEN_PLAYBACK_TARGET`):
    - Se despacha la orden a la TV (`play_media_` con tipo `video`) y el celular/computadora **no decodifica el video localmente** (ahorrando batería, GPU y ancho de banda).
    - Se despliega automáticamente el modal **Cine Remote**:
      - Fondo cinematográfico con carátula/póster en alta resolución y brillo ambiental.
      - Título de la película/serie y metadatos.
      - Línea de tiempo interactiva con barra scrubber sincronizada segundo a segundo con la TV (`currentTime` y `duration`).
      - Botones dedicados de transporte: Retroceder 10s (`⏪ 10s`), Play/Pausa central de gran tamaño, y Adelantar 10s (`10s ⏩`).
      - Control de volumen remoto para la TV.
      - Botón para conmutar TV o cambiar de pantalla.
      - Botón `[ 📱 Ver en este equipo ]`: pausa la TV y continúa la reproducción localmente en el segundo exacto donde se encontraba la película.
    - Se puede minimizar el mando para seguir explorando la biblioteca; una píldora flotante persistente `🍿 Cine en TV: [Película]` permite reabrir el mando en cualquier momento.
    - En el reproductor ArtPlayer local se añadió el botón de transmisión directa `[ 📡 Transmitir a TV ]` para pasar de pantalla local a TV al vuelo.
- **Watch Party ("Ver Juntos" en Tiempo Real):**
  - Cuando un usuario del radar está viendo una película o serie, su burbuja en el radar indica `🍿 Viendo: [Título]`.
  - Al abrir su perfil en el radar, se muestra la tarjeta destacada **Watch Party (Ver Juntos)**:
    - Muestra el póster y el minutero en vivo de la película.
    - Botón `[ 🍿 Sintonizar y ver juntos ]`: abre el mismo archivo en el cliente y busca automáticamente el segundo exacto donde se encuentra el anfitrión.
    - Píldora de estado `🍿 Watch Party: [Título] con [Amigo]` con botón de resincronización manual en caso de deriva y botón para desconectarse.
    - Sincronización automática si el anfitrión cambia de película o serie.
- **Soporte Nativo en KrakenTV (Android TV):**
  - `MainActivity.kt` y `PlayerActivity.kt`: implementaron la resolución y reproducción nativa de video cuando la orden remota `onRemotePlayMedia` contiene `type == "video"` o extensiones de video (`.mp4`, `.mkv`, `.avi`, `.webm`).
  - La TV reproduce el video mediante ExoPlayer con decodificación de hardware directa (H.264/H.265/HEVC) y reporta el estado `media_type: "video"`, tiempo y duración de regreso al servidor en cada ciclo del radar.


### 7.10 Separación Estricta de Cine Remote vs Reproductor de Música y Persistencia de Identidad en WebView
- **Diagnóstico del Choque Visual:**
  - Al transmitir una película como *El Demoledor* a la TV, la función `playNow()` interceptaba la orden remota pero trataba el archivo como audio: colocaba la película en `playerQueue` de música y desplegaba la barra `#player-bar` con una duración de 114:59 minutos y controles de música (shuffle, repeat, micro), colisionando con la interfaz y sin abrir el Cine Remote.
  - Al sondear el estado de la TV en `syncMirroredPlayerUI()`, si el equipo destino reportaba `target.song = "El Demoledor"`, mostraba automáticamente la barra de audio en lugar de conmutar al modo cine.
  - Además, `getKrakenPlaybackSnapshot()` marcaba `media_type = 'video'` si había un video previo en la cola, provocando que canciones de audio (como Britney Spears) mostraran erróneamente la tarjeta de *Watch Party (Ver Juntos)* en el perfil social.
  - En la ventana nativa de `pywebview`, `state.js` sobrescribía `localStorage.getItem('kraken_user')` con una cadena simple en lugar del JSON de usuario, causando que `krakenAuth.getUser()` fallara al reiniciar y el WebView no supiera que era el usuario `Skase`, tratando a su propia sesión de móvil como un amigo externo.
- **Solución Implementada:**
  - **En `audio-player.js` (`playNow`):** Se verifica si el elemento es video (`isVideoFile`). De ser así, se oculta de inmediato `#player-bar`, se silencia el audio local y se abre de inmediato el **Cine Remote** (`showCineRemoteModal`), sin tocar jamás la cola ni la barra de música.
  - **En `radar-remote.js` (`syncMirroredPlayerUI`):** Si `target.media_type === 'video'` o la duración corresponde a una película, la barra de música `#player-bar` se oculta por completo y se activa en tiempo real el Cine Remote (o la píldora flotante `🍿 Cine en TV`). Al reproducir música, la barra de audio vuelve con normalidad.
  - **En `downloader-tools.js` (`getKrakenPlaybackSnapshot`):** Si el elemento de audio está sonando (`isAudioPlaying`), el tipo reportado es inequívocamente `'audio'`.
  - **En `state.js` y `auth.js`:** Se protegió la serialización del objeto de usuario en `localStorage` y se garantiza que `window.MY_EMAIL` y `window.MY_NAME` se auto-inicialicen al abrir el WebView de Python, reconociendo inmediatamente sus propios dispositivos y sesiones en el radar sin conflictos de identidad.

### 7.11 Sincronización Bidireccional de Watch Party (Modo Sala), Chat Teleparty y Handover Limpio a TV
- **Resolución Automática de Token para Películas (`Media ID requerido`):**
  - **Causa:** Al invitar o sincronizar a un amigo con películas como *Gladiador* o *Hancock*, el objeto de video enviado carecía de `id` numérico si no coincidía exactamente el path en la caché local del receptor. El endpoint `/api/stream/token` rechazaba la petición con `400: Media ID requerido`.
  - **Solución:**
    - `routes/api.py`: `/api/stream/token` ahora acepta tanto `id` como `path`. Si `id` es omitido o nulo, busca el archivo en la base de datos SQLite con `SELECT id FROM media WHERE rel_path = ? OR rel_path LIKE ? OR title = ?`. Resuelve el `media_id` al vuelo para cualquier película o serie sin fallar.
    - `assets/js/video-player.js`: Envía tanto `id` como `path` en el cuerpo del fetch de token.
    - `assets/js/radar-remote.js`: `openWatchPartyInviteModal` y `sendWatchPartyInvite` envían `mediaId = currentVideo?.id` y comparan paths ignorando mayúsculas y diagonales.
- **Transmisión Fluida a TV ("Handover" desde el Reproductor de Video):**
  - Al presionar `[ 📡 Transmitir ]` dentro del reproductor de video en pantalla completa y elegir una pantalla/TV:
    1. Cierra limpiamente el reproductor local (`exitVideoMode()`) deteniendo HLS y liberando la memoria.
    2. Envía la orden a la pantalla remota (`play_media_` con tipo `video`).
    3. Envía el comando de salto en el tiempo (`seek_to_X`) para que la película empiece en la TV exactamente en el segundo donde iba en la tablet/PC.
    4. Abre automáticamente el modal **Cine Remote** en el dispositivo emisor, convirtiéndolo al instante en el mando a distancia.
- **Sincronización Bidireccional Watch Party ("Modo Sala"):**
  - En lugar de ejecutar dos transcodificaciones pesadas simultáneas, se utiliza la misma sesión ("Modo Sala"):
  - Eventos sincronizados: `play`, `pause` y `seek`. Si cualquiera de los dos amigos pausa, el video del otro se pausa de inmediato; si reanuda o adelanta, el otro salta en tiempo real al segundo exacto.
  - Bandera `_isHandlingWatchPartyRemoteSync` para evitar bucles o ecos de órdenes infinitas entre ambos participantes.
- **Chat en Vivo Estilo Teleparty:**
  - Botón de chat `💬` integrado en el encabezado del reproductor de video y en el modal de Cine Remote.
  - **Panel Drawer Lateral Desplegable:**
    - Historial de mensajes en tiempo real con avatares de usuario y marcas de tiempo.
    - Barra de reacciones de un solo toque: `🍿`, `🔥`, `😱`, `😂`, `👏`, `❤️`, `👀`, `⚡`.
    - Input para escribir mensajes personalizados con tecla Enter o botón de envío.
  - **Danmaku / Notificaciones Flotantes sobre el Video:**
    - Los mensajes y reacciones recibidos durante la reproducción aparecen suavemente flotando en la esquina superior del video (`.krk-danmaku-toast`) durante 4.5 segundos, permitiendo seguir la conversación sin tapar la película ni tener que abrir el panel lateral constantemente.

### 7.12 Barra de Emojis Reactiva en TV y Modo Segunda Pantalla Companion en Celular
- **Barra de Reacciones Rápidas en TV (`#krk-watch-party-quick-emojis`):**
  - **Condición de activación:** Solo se muestra durante una sesión activa de Watch Party (`KRAKEN_SYNC_WATCH_PARTY`).
  - **Comportamiento reactivo al movimiento:**
    - Durante la reproducción de la película la barra está completamente oculta (`opacity-0 pointer-events-none`).
    - Al detectar movimiento de ratón, pulsación de control remoto D-Pad o toque en pantalla, emerge suavemente flotando sobre la barra de tiempo: `🍿`, `🔥`, `😂`, `😱`, `👏`, `❤️`.
    - Cada botón tiene foco accesible para controles remotos de TV y al pulsarlo (`sendWatchPartyQuickReaction`) envía la reacción a todos los miembros de la sala y dispara la animación Danmaku.
    - A los 3 segundos de inactividad, desaparece automáticamente junto con los controles de ArtPlayer.
- **Detección Inteligente de Segunda Pantalla (Companion Screen en Celular):**
  - Al abrir Kraken en el teléfono celular o tablet mientras el usuario tiene una película activa en la Smart TV o PC (o en Watch Party):
    - El radar detecta la sesión remota y levanta una tarjeta flotante no intrusiva:
      - Título de la película y nombre del dispositivo donde suena (`📺 Smart TV / Kraken TV`).
      - Indicador si la sesión está en Watch Party compartida con amigos.
      - Botón `[ 💬 Modo Chat ]`: Conecta el teléfono como segunda pantalla sin reproducir video localmente (ahorra 100% de batería y datos móviles), abre directamente el Drawer de chat con el teclado táctil listo y coloca una píldora flotante persistente `🍿 Segunda Pantalla: [Película]`.
      - Botón `[ 🎮 Control Cine ]`: Abre el Cine Remote completo para controlar el transporte, volumen y pistas de audio/subtítulos.
      - Botón `[ ✕ ]`: Descarta el aviso y recuerda la decisión para no ser insistente durante esa reproducción.

### 7.13 Soporte Nativo en Android TV APK (`KrakenTV`)
- **Desempaquetado de Comandos en `TvRadarManager.kt`:**
  - `party_chat_`: Decodifica el remitente y mensaje/emoji recibido y despacha `onRemoteMessage(sender, text)` al hilo principal.
  - `watch_party_sync_`: Decodifica la acción remota (`pause`, `play`, `seek`) y sincroniza ExoPlayer automáticamente llamando a `onRemotePause()`, `onRemotePlay()` o `onRemoteSeek(time)`.
- **Notificaciones Flotantes en Pantalla (`PlayerActivity.kt`):**
  - Muestra avisos discretos en pantalla sobre el reproductor de video (`ToastMessage.show`) sin interrumpir la película ni requerir teclado en pantalla.
- **Compilación Exitosa del Binario:**
  - Compilado y empaquetado con Gradle 9.8.2 / AGP 9.4.0 en:
    `E:\Kraken Media Server\KrakenTV\app\build\outputs\apk\debug\app-debug.apk` (9.44 MB).

### 7.14 Danmaku Dinámico a Gran Escala y Píldora Flotante Persistente de Chat
- **Rediseño Danmaku a Gran Escala con Animaciones de Entrada y Salida:**
  - **Super Emojis (Reacciones):**
    - Emojis a tamaño gigante (56px) con animación `emojiPopBounce` (escala elástica + giro) y resplandor dorado.
    - Cápsula con nombre del emisor en negrita con halo ámbar (`text-sm font-black text-amber-400`).
  - **Mensajes de Texto:**
    - Tarjeta de 340-400px en glassmorphism profundo con avatar grande de 48px, tipografía nítida y legible.
  - **Ciclo de Animación Completo:**
    - **Entrada (`danmakuPopIn`):** Deslizamiento con rebote elástico desde la derecha.
    - **Permanencia:** 5 segundos completos para lectura cómoda sin prisas.
    - **Salida (`danmakuFloatOut`):** Elevación suave con desvanecimiento (`fade-out`).
    - **Interacción:** Pulsar la notificación abre directamente el panel de Chat.
- **Píldora Flotante Persistente de Chat (`#krk-persistent-chat-pill`):**
  - Si el usuario cierra el panel lateral o descarta un aviso, una píldora dorada flotante `[ 💬 Chat con {Amigo} ]` permanece en la esquina inferior.
  - Al pulsarla, el chat se reabre al instante. Al abrirse el chat, la píldora se oculta suavemente.
  - Indicador de punto rojo pulsante cuando entran mensajes nuevos mientras el chat está cerrado.
- **Botón de Chat Ampliado en el Reproductor de Video:**
  - Área táctil expandida en la esquina superior derecha (`px-4 py-2.5 text-sm`) para facilitar el toque en tablets y pantallas táctiles.

### 7.15 Aislamiento de la Píldora de Segunda Pantalla al Dispositivo Acompañante
- **Filtro Estricto de Reproductor Activo (`isVideoActiveHere`):**
  - Si el dispositivo actual está reproduciendo un video localmente (en TV, tablet o PC), la píldora `#krk-persistent-chat-pill` **nunca se renderiza** y es removida inmediatamente al entrar en `playVideoMode()`, garantizando que la película permanezca 100% limpia sin ninguna cápsula flotante estorbando.
- **Función Exclusiva para el Celular / Dispositivo Controlador:**
  - La píldora dorada flotante aparece únicamente en el dispositivo móvil que NO está reproduciendo video localmente.
  - Al pulsarse, reabre el modal de opciones de Segunda Pantalla (`showCompanionPrompt`) o el panel de Chat directo si fue cerrado por accidente.
  - Se oculta automáticamente cuando el modal o el drawer de chat están abiertos, y reaparece si se cierran.

### 7.16 Enrutamiento de Chat desde Cine Remote y Supresión de Danmaku en Mandos
- **Diagnóstico del Desfase de Chat en Cine Remote:**
  - Al abrir el modal **Cine Remote**, el objeto `resolvedTarget` no se asignaba a `window.KRAKEN_PLAYBACK_TARGET`, y su ID de sesión no formaba parte de `getWatchPartyTargets()`. Por tanto, los mensajes y reacciones escritos desde el mando a distancia no se despachaban a la pantalla que reproducía la película (TV/PC).
  - Además, `renderWatchPartyDanmaku` carecía de discriminación de pantalla, dibujando la animación gigante de fuego o emoji sobre la propia interfaz del mando a distancia en lugar de la pantalla de cine.
- **Solución Implementada:**
  - `routes/api.py`: En `remote_control()`, cuando la orden es `party_chat_` o `watch_party_sync_`, el backend reenvía y sincroniza automáticamente el mensaje entre la pantalla destino y todos los mandos enlazados en `REMOTE_CONTROL_LINKS`.
  - `assets/js/radar-remote.js`:
    - `showCineRemoteModal`: Asigna `window.KRAKEN_PLAYBACK_TARGET = resolvedTarget`, vincula la sesión de control en `/device/control/link` e integra el target en la lista de participantes de Watch Party.
    - `getWatchPartyTargets`: Incluye explícitamente `_activeCineRemoteData.targetSid`, garantizando que todo lo emitido desde el mando viaje a la pantalla de la película.
    - `renderWatchPartyDanmaku`: Restringido estrictamente a `isVideoActiveHere`. En la pantalla del mando (Cine Remote / celular), el Danmaku flotante se suprime por completo (mostrándose únicamente en el drawer de chat), y se proyecta a pantalla completa exclusivamente sobre el reproductor de video de la TV.
