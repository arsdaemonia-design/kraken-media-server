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
El cliente nativo se estructuró e implementó en `E:\Kraken Media Server\KrakenTV\`:
- **Estructura completa Gradle:** `build.gradle.kts`, `settings.gradle.kts`, `gradle.properties`, `app/build.gradle.kts` (`compileSdk = 35`, `minSdk = 24`, `targetSdk = 28`, `abiFilters += "armeabi-v7a"`), ProGuard rules.
- **Manifiesto TV:** Categoría `android.intent.category.LEANBACK_LAUNCHER`, `android.hardware.touchscreen = false`, banner 16:9 (`banner_320x180.xml`).
- **Navegación Espacial:** `LoginActivity`, `MainActivity`, `BrowseFragment` (Leanback `ArrayObjectAdapter`), `PlayerActivity` (Media3/ExoPlayer con D-Pad, ±10s con flechas, auto-hide controles a los 4s).
- **Consumo de Memoria:** Diseñado para permanecer bajo **80 MB de RAM** en dispositivos con 1 GB de RAM (MediaTek quad-core de 32 bits `armeabi-v7a`) mediante posters escalados a `185x278` en `RGB_565`.

### Endpoints de TV Implementados y Verificados en Backend
1. **`GET /api/tv/library?offset=0&limit=40`**:
   - Paginación liviana (por defecto 40, máximo 60).
   - Exige autenticación (`401` si no hay sesión/Bearer).
   - Filtra contenido según `is_kid_mode`.
   - Contenido `+18` protegido: requiere cabecera `X-Master-Pin` para visibilidad de la bóveda de adultos.
2. **`GET /api/tv/poster/<path>`**:
   - Genera y cachea en disco (`THUMBNAILS_FOLDER/tv_cache/<hash>.jpg`) un JPEG derivado de `185x278` a 82% de calidad (~18 KB frente a 117+ KB del póster web).
   - Corregido el manejo de `direct_passthrough = False` en Flask `send_file`.
   - Cabeceras de caché: `public, max-age=31536000, immutable`.
3. **`POST /api/stream/token` & `GET /api/hls/play`**:
   - Validación estricta del PIN maestro antes de emitir tokens reproducibles para videos marcados como `is_adult=1`.
   - Se inyecta la bandera `'adult_authorized'` en `state.STREAM_TOKENS[token]`.
   - `play_hls()` rechaza con `403` si el contenido es adulto y el token no fue autorizado con el PIN.

### Pendiente
1. Compilar con JDK 17 / Android SDK 35 (usando Android Studio en un entorno con SDK configurado) y generar el APK.
2. Probar login, navegación D-Pad, selección de pistas de audio/subtítulos y reanudación de progreso en un televisor Android TV real.
3. Medir consumo de RAM en tiempo de ejecución con `adb shell dumpsys meminfo com.kraken.tv`.

---

## 3. Kraken Roku (BrightScript + SceneGraph)

### Factibilidad
**Sí, es factible:**
- Roku reproduce **HLS nativamente** (nodo `Video`), con audio alterno y subtítulos. El backend de Kraken ya entrega HLS (H.264 + AAC), por lo que es totalmente compatible.
- Memoria en Roku: posters pequeños (`185x278` vía `/api/tv/poster/<path>`), nodo `RowList` para virtualización de filas, operaciones de red obligatoriamente en `Task` nodes.
- Red: HTTPS válido (`https://kraken.ederzu.com` a través de Cloudflare Tunnel).

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
1. Abre el proyecto en un entorno con JDK 17 y Android SDK 35.
2. Ejecuta gradle :app:assembleDebug y corrige cualquier incompatibilidad en versiones de dependencias (Leanback, Media3).
3. Despliega el APK en un dispositivo o emulador Android TV con arquitectura armeabi-v7a.
4. Valida:
   - Conexión a https://kraken.ederzu.com con autenticación JWT.
   - Paginación fluida en BrowseFragment con posters de 185x278.
   - Reproducción HLS con Media3/ExoPlayer, auto-ocultado de controles a los 4s, adelantar/atrasar con flechas D-Pad.
   - Validación de PIN maestro para la Bóveda de Adultos (+18).
5. Mide la RAM con 'adb shell dumpsys meminfo com.kraken.tv' para asegurar consumo < 80 MB.
```

### Prompt B — Construcción del Cliente Roku (BrightScript + SceneGraph)
```text
Eres un desarrollador senior de Roku (BrightScript + SceneGraph).
Crea el canal 'KrakenRoku' en E:\Kraken Media Server\KrakenRoku para conectarse al backend de
Kraken Media Server (https://kraken.ederzu.com).
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
