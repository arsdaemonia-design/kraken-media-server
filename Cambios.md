# Kraken Media Server - DocumentaciÃ³n

## Â¿QuÃ© es Kraken?

Kraken es un servidor multimedia local con modo online/offline. Permite:
- Reproducir mÃºsica y videos desde tu biblioteca local
- Descargar contenido de YouTube, Spotify y otras fuentes
- Streaming de video via HLS con transcodificaciÃ³n
- Modo offline con PWA
- Acceso via LAN o Cloudflare tunnel

## VersiÃ³n Actual
- **v4.92** (2026-04-17)

---

# Hotfix Tecnico (2026-04-18) - Chromecast + HLS Estabilidad

## 1) Chromecast: causa real del error `loadMedia` (session null)

### Sintoma
- En consola:
  `artplayer-plugin-chromecast.js ... TypeError: Cannot read properties of null (reading 'loadMedia')`

### Causa raiz
- El plugin intentaba ejecutar `session.loadMedia(...)` cuando la sesion de Cast aun no estaba disponible o regresaba `null` tras `requestSession()`.
- Ademas, el player local estaba usando URL de Cast (dominio publico) en lugar de URL local para reproduccion normal.

### Fix aplicado
- **Plugin de Cast endurecido** (`assets/artplayer-plugin-chromecast.js`):
  - Validacion defensiva antes de `loadMedia`.
  - Si `requestSession()` no entrega sesion valida, intenta `getCurrentSession()`.
  - Si sigue nulo, lanza error controlado (`"Cast session is null"`).
- **Separacion de URLs en frontend** (`templates/index.html`):
  - `playbackUrl` para reproduccion local (ArtPlayer en navegador).
  - `castUrl` para Chromecast (dominio publico + token).
  - El plugin Cast recibe explicitamente `url: castUrl`.

## 2) HLS: fixes de robustez aplicados

- `routes/hls.py`:
  - Correccion de caso donde `token_data` podia quedar indefinido en reconexion.
  - Reescritura de playlist `.m3u8` con `Response(...)` dedicado.
  - Espera de arranque mas robusta: no solo playlist, tambien al menos 1 segmento `.ts`.
  - Mensaje de timeout mas descriptivo: `playlist/segmentos`.

## 3) Estado VOD (importante)

- Se confirma que VOD sigue sensible cuando se fuerza comportamiento "full timeline" desde inicio.
- Tu enfoque actual (chunks, inicio de stream/autoplay y salto de siguiente episodio a 15s) es valido para seguir iterando sin romper playback.
- Pendiente tecnico principal: consolidar una ruta VOD que no choque con flujo live-like de HLS en sesiones largas.

## 4) Archivos impactados en este hotfix

- `assets/artplayer-plugin-chromecast.js`
- `templates/index.html`
- `routes/hls.py`

---

# Cambios Recientes (v4.92 - 2026-04-17)

## ðŸŽ¬ Fix HLS - Auto-play con Buffer y Blindaje Next Episode

### Problema
- Con HLS, el video cargaba segmentos incrementalmente
- El safety net `currentTime >= duration - 0.5` disparaba "Siguiente episodio" al inicio
- Porque con live streaming, `duration` representa el "live edge" (~3-30s desde el inicio)
- El overlay de "Siguiente episodio" aparecÃ­a muy temprano (30s antes del "fin ficticio")

### SoluciÃ³n Implementada

**1. Buffer Wait antes de Play (templates/index.html)**
- **Cambio:** Handler `m3u8` en `artConfig.customType`
- **Comportamiento nuevo:**
  - `autoStart: false` - HLS no empieza hasta tener buffer suficiente
  - Espera 30 segundos de buffer local antes de iniciar reproduccion
  - Timeout de 90s si no alcanza el buffer (forza inicio)
- **Beneficio:** `art.duration` se estabiliza antes de reproducir, evitando falsos positivos

**2. RemociÃ³n de liveSyncDurationCount**
- **Archivo:** `templates/index.html` lÃ­nea ~6176
- **Antes:** `liveSyncDurationCount: 3, liveMaxLatencyDurationCount: 5` (configuraciÃ³n para live streams)
- **DespuÃ©s:** Eliminados (no aplican para VOD-like HLS)

**3. Safety Net con Guard de Tiempo**
- **Archivo:** `templates/index.html` lÃ­nea ~6717
- **Cambio:** Agregado `(Date.now() - _watchStartedAt) >= 30000` como condiciÃ³n extra
- **Efecto:** El safety net no dispara si pasaron menos de 30s de reproduccion

**4. Buffer Poller sin art.play()**
- **Archivo:** `templates/index.html` lÃ­nea ~6456
- **Cambio:** El poller solo oculta el loader, no llama `art.play()` (lo controla el m3u8 handler)

### Archivos Modificados
- `templates/index.html` - m3u8 customType handler, safety net, buffer poller

---

# Cambios Recientes (v4.91 - 2026-04-11)

## ðŸ”� Auth Security Hardening

### Password Validation (MÃ­nimo 8 caracteres)
- **Archivo:** `services/auth.py`
- **FunciÃ³n:** `validate_password_strength(password)`
- **Validaciones:**
  - MÃ­nimo 8 caracteres (antes 4)
  - Bloqueo de contraseÃ±as comunes (password123, qwerty12, krakenadmin, etc.)
  - DetecciÃ³n de secuencias simples (0123456789, qwerty, asdfghjkl)
- **Aplicado en endpoints:**
  - `/api/auth/login` - Login
  - `/api/auth/register` - Registro
  - `/api/auth/set_password` - Cambio de contraseÃ±a
  - `/api/admin/users` (POST) - Crear usuario
  - `/api/admin/users/<email>/password` (PUT) - Reset password
  - `/api/setup/firsttime` - Setup inicial

### Rate Limiting (Anti-Fuerza Bruta)
- **Archivo:** `routes/api.py`
- **Constantes:**
  - `MAX_LOGIN_ATTEMPTS = 5` - Intentos mÃ¡ximos antes de bloqueo
  - `LOCKOUT_DURATION = 300` - 5 minutos de bloqueo
- **Funciones:**
  - `_record_failed_attempt(ip)` - Registra intento fallido
  - `_clear_failed_attempts(ip)` - Limpia en login exitoso
  - `_check_rate_limit(ip)` - Verifica si IP estÃ¡ bloqueada
- **Comportamiento:**
  - 5 intentos fallidos â†’ bloqueo de 5 minutos
  - Respuesta 429 con `retry_after` en segundos
  - Logs de seguridad con IP y email

### Token Blacklist (Logout Seguro)
- **Archivos:** `state.py`, `services/auth.py`, `routes/api.py`
- **ImplementaciÃ³n:**
  - Cada token JWT ahora tiene `jti` (unique ID via uuid4)
  - Logout agrega JTI a `TOKEN_BLACKLIST` en memoria
  - `verify_token()` checkea blacklist antes de aceptar token
  - Thread-safe con `BLACKLIST_LOCK`
- **Limpieza:** LÃ­mite de 10,000 JTIs en memoria (purge preventivo)
- **Flujo completo:**
  ```
  Login â†’ create_token(jti=uuid4) â†’ verify_token(jti) â†’ Logout â†’ blacklist(jti) â†’ verify_token(jti) = None
  ```

### Security Audit Logs
- **Archivo:** `routes/api.py`
- **UbicaciÃ³n:** `%APPDATA%\Kraken Media Server\logs\security.log`
- **Formato:** `2026-04-11 18:30:00 | INFO | LOGIN EXITOSO: email=X IP=Y username=Z`
- **Eventos registrados:**
  - `LOGIN EXITOSO` - Login con email, IP, username
  - `LOGIN FALLIDO` - Login fallido con email, IP, intentos
  - `LOGOUT` - Logout con email, IP, JTI (primeros 8 chars)
  - `USER CREATED` - CreaciÃ³n de usuario con email, username
  - `USER DELETED` - EliminaciÃ³n de usuario con email
  - `PASSWORD RESET` - Reset de contraseÃ±a con email
  - `PIN ADMIN BYPASS` - Uso de master PIN en admin con email, IP, endpoint
- **Logger dual:** Archivo + consola (prefijo `[SECURITY]`)

### Fix AppData Path
- **Bug:** `NameError: name '_app_data_dir' is not defined`
- **Causa:** Variable usada en lÃ­nea 38 antes de definirse en lÃ­nea 53
- **SoluciÃ³n:** Movido bloque `RUNTIME CONFIG HELPERS` antes del `Security Audit Logger`
- **Commit:** `2d1d1b7`

---

## ðŸŽ¬ HLS Streaming Improvements

### Reconnection Endpoint
- **Archivo:** `routes/hls.py`
- **Endpoint:** `POST /api/hls/reconnect`
- **Funcionalidad:**
  - Recupera sesiÃ³n HLS expirada usando `old_session_id` o `token + media_id`
  - Busca `full_video_path` de sesiÃ³n anterior o DB
  - Crea nueva sesiÃ³n HLS manteniendo posiciÃ³n
  - Limpia sesiÃ³n antigua automÃ¡ticamente
  - Soporta selecciÃ³n de audio track
- **Request:**
  ```json
  {
    "old_session_id": "session-abc",
    "token": "stream-token-xyz",
    "media_id": 123,
    "audio_track": 1,
    "new_session_id": "session-def"
  }
  ```
- **Response:** Mismo formato que `/api/hls/play` con `"reconnected": true`

### Token Authentication para Chromecast
- **Archivos:** `routes/hls.py`, `state.py`
- **Cambios:**
  - Tokens ahora trackean `sessions: []` (lista de session IDs asociadas)
  - `/api/hls/<session_id>/<filename>` acepta `?token=XXX` para Chromecast
  - Playlist rewrite: segmentos `.ts` incluyen token automÃ¡ticamente
  - ValidaciÃ³n de token + session matching antes de servir archivos
- **Flujo Chromecast:**
  ```
  Frontend â†’ /api/stream/token â†’ token â†’ Cast â†’ /hls/session/seg.ts?token=xxx â†’ Validado â†’ Play
  ```

### HLS Timeout Increase
- **Archivo:** `state.py`, `routes/hls.py`
- **Cambio:** `max_inactive_seconds` de 600s (10 min) â†’ 1200s (20 min)
- **Motivo:** Dar mÃ¡s tiempo para pausas largas sin destruir sesiÃ³n FFmpeg

### Status Endpoint Enhancement
- **Endpoint:** `GET /api/hls/status?sid=XXX`
- **Nuevo campo:** `"alive": true/false` (indica si sesiÃ³n existe y estÃ¡ activa)
- **Response completo:** `{"ready": bool, "segments": int, "alive": bool}`

---

## ðŸŒ� Cast / Public URL

### CAST_PUBLIC_URL Config
- **Archivo:** `config.py`
- **Variable:** `CAST_PUBLIC_URL = os.getenv('CAST_PUBLIC_URL', 'https://kraken.ederzu.com')`
- **Uso:** Chromecast necesita URL pÃºblica accesible (no localhost)
- **Endpoint:** `GET /api/config/public` expone esta URL al frontend

### Chromecast Plugin Fix
- **Archivo:** `assets/artplayer-plugin-chromecast.js`
- **Cambio:** Check `window.__krakenCastReady` antes de inicializar Cast API
- **Motivo:** Prevenir errores de doble inicializaciÃ³n

---

## ðŸ“Š Files Modified

| Archivo | Cambios | LÃ­neas |
|---------|---------|--------|
| `routes/api.py` | Security logger, rate limiting, password validation, audit logging, PIN bypass, public config endpoint | +200 |
| `services/auth.py` | JTI tokens, password strength validation, uuid/re imports | +70 |
| `state.py` | Token blacklist functions, thread-safe locks | +30 |
| `routes/hls.py` | Reconnection endpoint, token auth en segmentos, session tracking | +180 |
| `config.py` | CAST_PUBLIC_URL variable | +4 |
| `assets/artplayer-plugin-chromecast.js` | Cast init fix | +2 |
| `templates/index.html` | Auth UI improvements (sesiÃ³n anterior) | +300 |

---

## ðŸ§ª Testing Notes

- **Password validation:** Rechaza contraseÃ±as <8 chars, comunes, secuencias
- **Rate limiting:** 5 intentos â†’ 5 min lockout por IP
- **Token blacklist:** Logout invalida token permanentemente
- **Security logs:** `%APPDATA%\Kraken Media Server\logs\security.log`
- **HLS reconnect:** Recupera sesiÃ³n tras expiraciÃ³n sin perder posiciÃ³n
- **Chromecast:** Funciona con token en segmentos HLS

---

# Cambios Recientes (v4.90 - 2026-04-10)

## Estabilizacion General y Recuperacion de Estado
- Consolidacion de cambios de la semana en `master` con respaldo en GitHub.
- Build validado con `KrakenOffline.spec` y compilacion exitosa del instalador Inno Setup.
- Limpieza tecnica de artefactos locales (`__pycache__`, `*.pyc`, carpeta `build`) manteniendo `dist` final.

## Reparaciones UI/UX en Header y Video
- Correccion de duplicado de boton `Select` en vista audio desktop.
- Reubicacion de `Select/Todos` junto a pills en vista video principal.
- Fix de dropdowns `Categorias/Generos` en video: se elimino conflicto por IDs duplicados desktop/mobile y se paso a manejo por `data-*` + contexto del evento.
- Ajuste de espaciado (margin/padding/gap) en mobile y desktop para recuperar densidad visual.
- En vista detalle de serie:
  - Se ocultaron pills de filtros globales que no aplicaban en ese contexto.
  - Se mantuvo `Subir un nivel` funcional en formato barra compacta para evitar bloque visual gigante.

## Reproductor y Cast (Hardening)
- Fix de colision de nombre `screen` que rompia `exitVideoMode()` por sombreado de variable.
- Ajuste de llamadas de orientacion con `window.screen.orientation` para evitar errores de scope.
- Inicializacion de Cast reforzada con flujo de contexto mas robusto y tolerante a disponibilidad parcial.
- Estado actual: boton/flujo Cast mejorado, pero sigue sujeto a restricciones de red/origen/HTTPS del entorno de despliegue.

## Verificacion Tecnica Realizada
- `py_compile` exitoso en modulos clave.
- Pruebas de humo:
  - `test_imports.py` OK
  - `test_server.py` OK
- Build final:
  - `PyInstaller -y KrakenOffline.spec` OK
  - Instalador generado: `dist/Kraken_Media_Server_Installer_v4.90.exe`

---

# Cambios Recientes (v4.88 - 2026-04-09)

## ðŸŽ¨ OptimizaciÃ³n de Interfaz y UX (Header Unificado)
- **Cabecera Persistente:** Se refactorizÃ³ el `desktop-header` para que la barra de bÃºsqueda y los filtros de gÃ©nero sean omnipresentes. Ya no desaparecen al entrar en modo Video.
- **Fix de MenÃºs Desplegables:** Corregido el error de "clipping" donde los menÃºs de ordenamiento se cortaban en mÃ³vil. Se eliminÃ³ el scroll horizontal forzado y se permitiÃ³ el wrap de elementos.
- **Limpieza de UI:** Eliminada la fila de gÃ©neros redundante dentro del contenedor de video, centralizando todo el control en el header superior.

## ðŸ“Š RediseÃ±o de EstadÃ­sticas (Premium Dashboard)
- **Sistema de 4 Cajas Independientes:** Nuevo layout con estÃ©tica "Netflix-Glass" usando gradientes y efectos de hover.
  - **Caja 1 (Mis EstadÃ­sticas / Artistas):** Dividida internamente con un botÃ³n de acceso al panel maestro y conteo de artistas.
  - **Caja 2 (MÃºsica):** Conteo total de canciones con acento en color esmeralda.
  - **Caja 3 (PelÃ­culas):** Conteo de tÃ­tulos/carpetas Ãºnicos de cine.
  - **Caja 4 (Series):** Conteo de tÃ­tulos Ãºnicos de series.
- **Visibilidad de Archivos:** Se mantuvo el conteo total de archivos de video (ej. "2,121 archivos") para control de volumen de la biblioteca.

## ðŸ”€ ReproducciÃ³n Aleatoria Mejorada
- **Series Shuffle (Modo MaratÃ³n):**
  - Nuevo botÃ³n **"Aleatorio"** en el banner Hero de las series.
  - ImplementaciÃ³n de `playShuffleSeries` en `assets/js/hero_series.js`.
  - Escaneo recursivo de episodios + Algoritmo Fisher-Yates.
  - CreaciÃ³n automÃ¡tica de cola de 20 episodios.
- **MaratÃ³n de Video Global:** OptimizaciÃ³n de la lÃ³gica para que respete los filtros activos y se limite a 10 elementos, evitando sobrecarga del reproductor.
- **Fix de Referencia CrÃ­tico:** Corregido error donde la cola de reproducciÃ³n no se actualizaba al usar `window.playerQueue` (cambiado a referencia global directa).

## ðŸ› ï¸� Mejoras TÃ©cnicas Adicionales
- **ConsolidaciÃ³n de `playerQueue`:** SincronizaciÃ³n de las variables de estado del reproductor entre los mÃ³dulos externos (`hero_series.js`) y el nÃºcleo de la aplicaciÃ³n (`index.html`).
- **OptimizaciÃ³n de `renderLibraryStats`:** RefactorizaciÃ³n de la lÃ³gica de detecciÃ³n de pelÃ­culas/series basada en la estructura de carpetas y metadatos de TMDB.

## ðŸŽ¬ Motor de Video y HLS (Core Streaming v2.0)
- **AceleraciÃ³n por Hardware (GPU):**
  - ImplementaciÃ³n de detecciÃ³n automÃ¡tica de hardware para transcodificaciÃ³n en tiempo real.
  - Soporte nativo para **NVIDIA NVENC** (Windows) y **Apple VideoToolbox** (Mac/Silicon).
  - ReducciÃ³n drÃ¡stica del uso de CPU y latencia durante el streaming de archivos de alta resoluciÃ³n.
- **GestiÃ³n Avanzada de Audio:**
  - Mapeo inteligente de metadatos: los cÃ³digos de idioma se transforman en nombres legibles (EspaÃ±ol, JaponÃ©s, InglÃ©s, etc.).
  - Cambio de pista de audio "en caliente" sincronizado con la posiciÃ³n actual del reproductor.
  - NormalizaciÃ³n forzada a **AAC EstÃ©reo (192k)** para mÃ¡xima compatibilidad, eliminando fallos en navegadores al reproducir audios 5.1 o DTS.
- **SubtÃ­tulos Externos AutomÃ¡ticos:**
  - Escaneo de archivos `.srt` y `.vtt` en la raÃ­z del video y en subcarpetas de soporte (`/subs`, `/subtitles`).
  - IntegraciÃ³n directa en el selector de pistas del ArtPlayer.
- **Inteligencia DirectPlay:** Algoritmo de bypass automÃ¡tico que detecta cuÃ¡ndo un archivo (MP4/WebM) es 100% compatible para saltarse la transcodificaciÃ³n y reproducirse al instante.

## ðŸ› ï¸� Herramientas de Mantenimiento
- **Kraken Media Doctor (`doctor_videos.py`):** Nueva utilidad independiente para optimizar archivos MP4 mediante el flag `faststart`.
  - Permite que los videos en formato MP4 comiencen la reproducciÃ³n instantÃ¡neamente (DirectPlay) sin necesidad de descargar el archivo completo primero.
  - Proceso seguro: usa una copia temporal y reemplaza el original solo si la optimizaciÃ³n es exitosa.

## ðŸ”’ Sistema de Control Parental (Kid Mode)
- **Modo NiÃ±os por Usuario:** Cada usuario puede activar/desactivar el modo niÃ±os desde el panel de administraciÃ³n.
  - Columna `is_kid_mode` en tabla `users` para persistencia por usuario.
  - Toggle visual en el panel de administraciÃ³n de usuarios.
- **Filtrado de Contenido por Rating:**
  - Ratings bloqueados automÃ¡ticamente: `PG-13`, `R`, `NC-17`, `TV-14`, `TV-MA`, `18`, `16`, `16+`, `18+`, `MA15+`, `M`, `C`, `D`, `MA`, `R18+`, `R15+`.
  - Contenido permitido: `G`, `PG`, y contenido sin clasificar (asume seguro).
  - FunciÃ³n `filtrar_contenido_kid_mode()` en `routes/api.py` que filtra la biblioteca en tiempo real.
- **ExtracciÃ³n AutomÃ¡tica de Ratings:** El sistema extrae automÃ¡ticamente el rating de certificaciÃ³n desde TMDB API:
  - Para pelÃ­culas: endpoint `release_dates` con prioridad MX > US > otros.
  - Para series: endpoint `content_ratings` con prioridad MX > US > otros.
  - Guardado en columna `tmdb_rating` de la tabla `media`.
- **VisualizaciÃ³n de Ratings:**
  - Badges de rating visibles en las tarjetas de contenido.
  - Colores diferenciados: rojo para contenido restringido, verde para todo pÃºblico.
  - Soporte para mÃºltiples sistemas de clasificaciÃ³n (MPAA, BBFC, CERO, etc.).

## ðŸŽ¨ Mejoras en la Vista de Video (Netflix-Style)
- **RediseÃ±o Completo de la Vista de Video:**
  - Nueva interfaz tipo Netflix con hero banner dinÃ¡mico.
  - Botones de acciÃ³n reorganizados: "Reproducir", "Aleatorio", "Episodios", "MÃ¡s informaciÃ³n".
  - EliminaciÃ³n de elementos duplicados en cabecera para reducir ruido visual.
- **Hero Banner Premium:**
  - Backdrop de TMDB con gradientes superpuestos.
  - InformaciÃ³n enriquecida: aÃ±o, rating de estrellas, nÃºmero de temporadas.
  - GÃ©neros como chips visuales.
  - Carrusel del reparto principal con fotos de actores.
  - Sinopsis con lÃ­mite de lÃ­neas y botÃ³n "MÃ¡s informaciÃ³n".
- **BotonerÃ­a Contextual Inteligente:**
  - Series: BotÃ³n "Reproducir" (abre lista de episodios), "Aleatorio" (modo maratÃ³n), "Episodios".
  - PelÃ­culas: BotÃ³n "Reproducir" (play directo), "MÃ¡s informaciÃ³n".
  - DetecciÃ³n automÃ¡tica de tipo de contenido vÃ­a `folder_type`.

## ðŸ“º Reproductor de Video Mejorado
- **Continuar ReproducciÃ³n (Resume Playback):**
  - Tracking de progreso guardado cada 10 segundos vÃ­a API `/api/progress`.
  - Soporte para modo fallback (reproductor nativo) y ArtPlayer/HLS.
  - BotÃ³n "Continuar" en hero con barra de progreso visual y etiqueta del episodio.
  - Funciona para series (muestra temporada y episodio) y pelÃ­culas.
- **Metadatas Enriquecidas en Reproductor:**
  - TÃ­tulo dinÃ¡mico en controles del player.
  - InformaciÃ³n de temporada/episodio para series.
  - Soporte para cambio de pista de audio "en caliente" manteniendo posiciÃ³n actual.
- **IntegraciÃ³n de Thumbnails:**
  - Sistema de carÃ¡tulas `tmdb_poster` priorizado sobre thumbnails generados.
  - Fallback a thumbnails FFmpeg para videos sin metadata TMDB.
  - Posters de series guardados por carpeta (no por episodio individual).

---

# Cambios Recientes (v4.86 - 2026-04-01)

## Sistema TMDB Folder-Based (Video Auto-Tagging)

### ImplementaciÃ³n Completa
Sistema folder-based para videos inspirado en Plex/Radarr/Sonarr, con extracciÃ³n automÃ¡tica de TMDB IDs desde cualquier parte de la ruta.

### Nuevas Funciones Backend (`services/video_tagger.py`)
- **`extract_tmdb_id_from_path(file_path)`**: Extrae TMDB ID de carpeta, subcarpetas o nombre de archivo. Soporta formatos: `(tmdb-123)`, `{tmdb-123}`, `[tmdb=123]`, `tmdb-123`
- **`detect_folder_type(file_path)`**: Detecta `movie` vs `series` automÃ¡ticamente basado en presencia de `Temporada` o `Season` en la ruta
- **`is_series_episode(filename)`**: Detecta patrones de episodios (`S01E01`, `1x01`, `Episodio 1`, `CapÃ­tulo 1`)
- **`extract_series_name(file_path)`**: Extrae nombre de serie desde estructura de carpetas
- **Cache en memoria**: Evita consultas repetidas a API de TMDB para la misma serie

### Cambios Backend (`services/library.py`)
- Scanner extrae `tmdb_id` de la ruta completa
- Scanner detecta `folder_type` (`movie` o `series`)
- Limpieza de tÃ­tulos: quita automÃ¡ticamente `(tmdb-XXXXX)` del nombre
- Guarda en DB: `tmdb_id`, `folder_type`, `tmdb_title`, `tmdb_poster`, `tmdb_genres`, etc.

### Cambios Backend (`routes/api.py`)
- Endpoint `/api/auto_tag_library_videos` usa `folder_type` de DB para determinar `/movie/` o `/tv/`
- NO sobreescribe el campo `title` (respeta naming del usuario)
- Solo llena campos `tmdb_*`: `tmdb_title`, `tmdb_poster`, `tmdb_genres`, `tmdb_overview`

### Nuevas Columnas en DB (`services/database.py`)
```sql
ALTER TABLE media ADD COLUMN folder_type TEXT DEFAULT NULL;
ALTER TABLE media ADD COLUMN tmdb_id INTEGER DEFAULT 0;
ALTER TABLE media ADD COLUMN tmdb_title TEXT DEFAULT NULL;
ALTER TABLE media ADD COLUMN tmdb_year TEXT DEFAULT NULL;
ALTER TABLE media ADD COLUMN tmdb_overview TEXT DEFAULT NULL;
ALTER TABLE media ADD COLUMN tmdb_genres TEXT DEFAULT NULL;
ALTER TABLE media ADD COLUMN tmdb_poster TEXT DEFAULT NULL;
```

### Cambios Frontend (`templates/index.html`)
- **Nueva funciÃ³n `getCoverUrl(f)`**: Prioriza `tmdb_poster` sobre bÃºsqueda por path
- **Movie vs Series**: Usa `folder_type === 'movie'` para 1-click play
- **Hero Banner**: Usa `tmdb_poster` si existe para el cover
- **Player Modal**: Usa `tmdb_poster` si existe
- **TÃ­tulos**: Usa `tmdb_title` si existe, fallback a `title`

### Flujo Completo
1. **Scanner**: Extrae ID â†’ Detecta tipo â†’ Limpia tÃ­tulo â†’ Guarda
2. **Auto-Tag**: Usa ID â†’ Consulta TMDB â†’ Descarga poster â†’ Guarda metadata
3. **Frontend**: Usa `tmdb_poster` â†’ Muestra cover â†’ 1-click si es movie

### Problemas Encontrados y Solucionados

#### Problema 1: TÃ­tulos con ID Residual
- **SÃ­ntoma**: PelÃ­culas mostraban `(tmdb-28968)` como tÃ­tulo
- **Causa**: Scanner no limpiaba el ID del nombre de archivo
- **SoluciÃ³n**: Agregar regex para limpiar `\s*[\(\[\{]?tmdb[-_]?\d+[\)\]\}]?` del tÃ­tulo antes de guardar

#### Problema 2: Frontend NO Usaba `folder_type`
- **SÃ­ntoma**: PelÃ­culas requerÃ­an 2 clics
- **Causa**: CondiciÃ³n `f.type === 'folder' && f.folder_type === 'movie'` nunca se cumplÃ­a
- **SoluciÃ³n**: Cambiar a solo checar `f.folder_type === 'movie'` sin importar `f.type`

#### Problema 3: Posters NO Visibles
- **SÃ­ntoma**: Posters descargados no aparecÃ­an en UI
- **Causa**: Frontend buscaba `thumbnails/filename.jpg` pero tagger guardÃ³ como `thumbnails/tmdb_title.jpg`
- **SoluciÃ³n**: Crear `getCoverUrl(f)` que prioriza `tmdb_poster` sobre bÃºsqueda por path

### Rendimiento
- **936 videos** en biblioteca
- **934 con TMDB ID** (99.8%)
- **934 con poster** (99.8%)
- **Tiempo para 100 videos con ID**: ~10-30 segundos
- **Tiempo para 100 videos sin ID**: ~3-5 minutos
- **Rate limit hits**: 0 (gracias a cache)

### DocumentaciÃ³n
- Archivo: `ANALISIS_TMDB_TAGGING.md` (500+ lÃ­neas)
- Incluye: problemas, soluciones, flujos, mÃ©tricas

---

# Cambios Recientes (v4.87 - 2026-04-01)

## Sistema de AutenticaciÃ³n Completo (JWT-based) + Seguridad

### Resumen
ImplementaciÃ³n de sistema de login similar a Plex/Netflix: usuarios con contraseÃ±a, tokens JWT, gestiÃ³n de invitaciones, panel de administraciÃ³n completo, y protecciÃ³n contra ataques de fuerza bruta.

### ðŸ”� Seguridad Implementada

#### Rate Limiting (Anti-Fuerza Bruta)
- **UbicaciÃ³n:** `routes/api.py`, lÃ­neas ~2640-2700
- **Funcionamiento:**
  - 5 intentos mÃ¡ximos por IP
  - Lockout de 5 minutos despuÃ©s de intentos fallidos
  - Limpia intentos despuÃ©s de 1 hora de inactividad
  - Detecta IP desde `X-Forwarded-For` (Cloudflare) o `request.remote_addr`
- **Respuestas:**
  - `429 Too Many Requests` cuando estÃ¡ bloqueado
  - `remaining_attempts` en respuesta para frontend
- **Logging:** Consola muestra bloqueos y intentos

#### Sistema JWT (Tokens)
- Tokens firmados con HMAC-SHA256 (30 dÃ­as de duraciÃ³n)
- Sin dependencias externas
- Secreto guardado en `.kraken_secret` (generado automÃ¡ticamente)

#### Hash de ContraseÃ±as
- PBKDF2 con 100,000 iteraciones
- Salt aleatorio por cada contraseÃ±a
- Almacenado en columna `pin_hash` de tabla `users`

### Nuevos Archivos Backend

#### `services/auth.py`
- **Funciones principales:**
  - `create_token(user_email, username, is_superadmin)` - Crea token firmado
  - `verify_token(token)` - Verifica firma y expiraciÃ³n
  - `hash_password(password)` - Hash con PBKDF2
  - `verify_password(password, stored_hash)` - Verifica hash
  - `generate_invite_code()` - CÃ³digos tipo `KRK-XXXX`
  - `get_user_from_request(request)` - Extrae email desde Bearer token

### Cambios Backend (`routes/api.py`)

#### Decoradores de Seguridad
```python
@require_master_pin  # Requiere PIN maestro (para config global)
@require_admin       # Requiere usuario admin logueado (JWT)
```

#### Endpoints de Admin (Protegidos con `@require_admin`)
| Endpoint | MÃ©todo | DescripciÃ³n |
|----------|--------|-------------|
| `/api/admin/users` | GET | Lista todos los usuarios |
| `/api/admin/users` | POST | Crea usuario directamente |
| `/api/admin/users/<email>` | DELETE | Elimina usuario |
| `/api/admin/users/<email>/password` | PUT | Resetea contraseÃ±a |
| `/api/admin/invite` | POST | Genera cÃ³digo de invitaciÃ³n |
| `/api/admin/invite` | DELETE | Invalida todos los cÃ³digos |
| `/api/admin/invite/validate` | POST | Valida cÃ³digo sin consumirlo |
| `/api/admin/config` | PUT | Actualiza PIN/media_path |

#### Endpoints de AutenticaciÃ³n (PÃºblicos con Rate Limiting)
- `/api/auth/login` - Login con rate limiting (5 intentos â†’ 5 min lockout)
- `/api/auth/register` - Registro (pÃºblico con cÃ³digo de invitaciÃ³n)
- `/api/auth/verify` - Verifica token JWT
- `/api/auth/set_password` - Cambia contraseÃ±a de usuario
- `/api/auth/logout` - Logout

#### Endpoints de Setup
- `/api/setup/status` - Detecta si necesita configuraciÃ³n inicial
- `/api/setup/firsttime` - Primera configuraciÃ³n (crea admin)

### Cambios Frontend (`templates/index.html`)

#### Pantalla de Login (Netflix-style)
- "Â¿QuiÃ©n estÃ¡ viendo?" con grid de usuarios
- Input de contraseÃ±a por usuario
- ValidaciÃ³n de cÃ³digos de invitaciÃ³n antes de mostrar formulario

#### Panel de AdministraciÃ³n
- **3 Tabs:**
  1. **General:** Cambiar media_path y PIN maestro
  2. **Usuarios:** CRUD completo (crear, eliminar, resetear password)
  3. **Invitaciones:** Generar cÃ³digos con duraciÃ³n configurable
- **DuraciÃ³n de cÃ³digos:** Nunca expira, 5 min, 1 hora, 24 horas, 1 semana
- **Carga automÃ¡tica:** Lista usuarios al entrar al tab

#### Mejoras Visuales
- Avatar por defecto: ðŸ�™ cuando no hay imagen
- Manejo de errores en imÃ¡genes: fallback a iniciales
- Gradiente de colores en avatares

### Base de Datos

Tabla `users` (estructura existente):
```sql
- email (TEXT PRIMARY KEY)
- username (TEXT)
- pin_hash (TEXT) -- Ahora guarda hash de contraseÃ±a PBKDF2
- is_superadmin (INTEGER)
- avatar_url (TEXT)
- created_at (REAL)
```

**Nota:** La tabla NO tiene columna `id` - el cÃ³digo la detecta dinÃ¡micamente.

### Flujos de Uso

#### Primera ConfiguraciÃ³n
1. Abrir Kraken â†’ detecta sin admin
2. Formulario: username, password, PIN maestro, media_path
3. POST `/api/setup/firsttime` â†’ admin creado

#### Login Normal
1. Pantalla "Â¿QuiÃ©n estÃ¡ viendo?"
2. Click usuario â†’ input contraseÃ±a
3. POST `/api/auth/login` (con rate limiting)
4. Token guardado en localStorage
5. Auto-inyecciÃ³n de Bearer token en todos los fetch

#### Crear Usuario (Admin)
1. Click engrane â†’ PIN maestro
2. Tab "Usuarios" â†’ formulario username + password
3. POST `/api/admin/users` â†’ usuario creado

#### Usar CÃ³digo de InvitaciÃ³n
1. Login â†’ "Tengo cÃ³digo de invitaciÃ³n"
2. POST `/api/admin/invite/validate` â†’ valida sin consumir
3. Si vÃ¡lido â†’ formulario registro
4. POST `/api/auth/register` â†’ cÃ³digo consumido

### Problemas Solucionados

#### 1. Error 500 al listar usuarios
- **Causa:** Tabla `users` no tenÃ­a columna `id`
- **SoluciÃ³n:** DetecciÃ³n dinÃ¡mica de columnas

#### 2. Error 401 en generar cÃ³digos
- **Causa:** Endpoints usaban `@require_master_pin` pero frontend no enviaba PIN
- **SoluciÃ³n:** Cambiar a `@require_admin` (usa JWT)

#### 3. CÃ³digo de invitaciÃ³n no validado
- **Causa:** Se aceptaba cualquier cÃ³digo sin validar
- **SoluciÃ³n:** Endpoint `/api/admin/invite/validate` antes de mostrar formulario

#### 4. Rate limiting en login
- **Riesgo:** Bots podÃ­an intentar fuerza bruta
- **SoluciÃ³n:** 5 intentos â†’ 5 minutos lockout

### Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `services/auth.py` | NUEVO - Sistema JWT completo |
| `routes/api.py` | +25 endpoints, decoradores, rate limiting |
| `templates/index.html` | +600 lÃ­neas - Login, panel admin, seguridad |
| `Cambios.md` | Este documento |

### Para ProducciÃ³n (ExposiciÃ³n Internet)

Aunque Kraken estÃ¡ tras Cloudflare, se agregÃ³:
- âœ… Rate limiting nativo (5 intentos â†’ lockout)
- âœ… ContraseÃ±as hasheadas con PBKDF2
- âœ… Tokens JWT firmados
- âœ… Logs de seguridad en consola

**RecomendaciÃ³n Cloudflare adicional:**
- Activa "Rate Limiting" en dashboard
- Agrega WAF rule para `/api/admin/*`
- Considera agregar "JS Challenge" en rutas de login

---



### Resumen
ImplementaciÃ³n de sistema de login similar a Plex/Netflix: usuarios con contraseÃ±a, tokens JWT, gestiÃ³n de invitaciones, y panel de administraciÃ³n completo.

### Nuevos Archivos Backend

#### `services/auth.py`
- **AutenticaciÃ³n con JWT-like** (HMAC-SHA256, sin dependencias externas)
- **Funciones principales:**
  - `create_token(user_email, username, is_superadmin)` - Crea token firmado (expira en 30 dÃ­as)
  - `verify_token(token)` - Verifica firma y expiraciÃ³n
  - `hash_password(password)` - Hash con PBKDF2 (100k iteraciones, salted)
  - `verify_password(password, stored_hash)` - Verifica contra hash almacenado
  - `generate_invite_code()` - Genera cÃ³digos tipo `KRK-XXXX` (ej. `KRK-A3F9`)
  - `get_user_from_request(request)` - Extrae email desde header Authorization Bearer
- **Secreto persistente:** Guardado en `.kraken_secret` (generado automÃ¡ticamente)

### Cambios Backend (`routes/api.py`)

#### Nuevos Decoradores (lÃ­neas ~2390-2423)
- `@require_master_pin` - Requiere PIN maestro (para operaciones crÃ­ticas)
- `@require_admin` - Requiere usuario admin autenticado (usa token JWT)

#### Nuevos Endpoints de Admin

| Endpoint | MÃ©todo | DescripciÃ³n |
|----------|--------|-------------|
| `/api/admin/users` | GET | Lista todos los usuarios (panel admin) |
| `/api/admin/users` | POST | Crea usuario nuevo (con cÃ³digo de invitaciÃ³n) |
| `/api/admin/users/<email>` | DELETE | Elimina usuario |
| `/api/admin/users/<email>/password` | PUT | Resetea contraseÃ±a |
| `/api/admin/invite` | POST | Genera cÃ³digo de invitaciÃ³n (con duraciÃ³n opcional) |
| `/api/admin/invite` | DELETE | Invalida todos los cÃ³digos |
| `/api/admin/config` | GET | Obtiene configuraciÃ³n actual |
| `/api/admin/config` | PUT | Actualiza PIN maestro y media_path |

#### Endpoints de AutenticaciÃ³n
- `/api/auth/users` (GET) - Lista usuarios para pantalla de login
- `/api/auth/login` (POST) - Login con email + contraseÃ±a
- `/api/auth/register` (POST) - Registro (primer admin o con invitaciÃ³n)
- `/api/auth/verify` (GET) - Verifica si token JWT es vÃ¡lido
- `/api/auth/logout` (POST) - Logout (invalida token en backend)
- `/api/auth/set_password` (POST) - Cambia contraseÃ±a del usuario actual

#### Endpoints de Setup Actualizados
- `/api/setup/status` (GET) - Devuelve si necesita configuraciÃ³n inicial
- `/api/setup/firsttime` (POST) - Crea primer admin con username + password + PIN maestro

#### Sistema de PIN Maestro
- `get_master_pin()` - Lee PIN desde `runtime_config.json` (no de config.py)
- `_load_runtime_config()` - Carga configuraciÃ³n persistente
- `_save_runtime_config(key, value)` - Guarda en JSON + sincroniza con config.py

### Cambios Frontend (`templates/index.html`)

#### Sistema de Login (Nueva Pantalla)
```javascript
// Archivo: index.html, lÃ­neas ~1453-1694

// Pantalla "Â¿QuiÃ©n estÃ¡ viendo?" (Netflix-style)
- Grid de usuarios con avatares
- Click en usuario â†’ input de contraseÃ±a
- Soporta contraseÃ±a vacÃ­a (solo para usuarios sin contraseÃ±a configurada)

// Funciones principales:
- showAuthScreen() - Muestra pantalla de selecciÃ³n de usuario
- renderUsers(users) - Renderiza grid de usuarios
- selectUser(email) - Selecciona usuario y muestra input de contraseÃ±a
- loginUser(email, password) - POST a /api/auth/login
- submitRegister() - Registro de nuevo usuario
```

#### Panel de ConfiguraciÃ³n (Admin)

**3 Tabs:**
1. **General:** Cambiar media_path y PIN maestro
2. **Usuarios:** Ver, crear, eliminar, resetear contraseÃ±as
3. **Invitaciones:** Generar cÃ³digos (con selector de duraciÃ³n)

**Funciones:**
- `showSettingsPanel()` - Detecta si es primera vez o panel admin
- `showFirstTimeSetup()` - Pantalla de configuraciÃ³n inicial (username + password + PIN)
- `showAdminPanel()` - Panel completo de administraciÃ³n
- `showSettingsTab(tab)` - Cambia entre tabs
- `loadAdminUsers()` - Carga lista de usuarios
- `adminCreateUser()` - Crea usuario nuevo
- `adminDeleteUser(email)` - Elimina usuario
- `adminResetPassword(email)` - Resetea contraseÃ±a
- `adminGenerateInvite()` - Genera cÃ³digo con duraciÃ³n configurable
- `adminClearInvites()` - Invalida todos los cÃ³digos

#### Selector de DuraciÃ³n de CÃ³digos
```html
<select id="invite-duration">
  <option value="0">Nunca expira</option>
  <option value="5">5 minutos</option>
  <option value="60">1 hora</option>
  <option value="1440">24 horas</option>
  <option value="10080">1 semana</option>
</select>
```

#### Sistema de Tokens (Auto-inyecciÃ³n)
```javascript
// Override de fetch para inyectar Bearer token automÃ¡ticamente
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
  const token = localStorage.getItem('kraken_auth_token');
  if (token && url.startsWith('/')) {
    options.headers = options.headers || {};
    options.headers['Authorization'] = 'Bearer ' + token;
  }
  return originalFetch.call(this, url, options);
};
```

#### Avatar por Defecto
- Si usuario tiene `avatar_url` â†’ muestra imagen
- Si no tiene avatar â†’ muestra inicial del nombre o ðŸ�™ (logo Kraken)
- Manejo de error: `onerror` fallback a iniciales

### Cambios en la Base de Datos

Tabla `users` (ya existÃ­a):
```sql
-- Columnas relevantes para auth:
- email (TEXT PRIMARY KEY)
- username (TEXT)
- pin_hash (TEXT) -- AHORA: guarda hash de contraseÃ±a (PBKDF2)
- is_superadmin (INTEGER)
- avatar_url (TEXT)
- created_at (REAL)
```

### Flujos de Uso

#### Primera ConfiguraciÃ³n (Setup Inicial)
1. Abrir Kraken â†’ detecta que no hay admin
2. Mostrar pantalla "ConfiguraciÃ³n inicial"
3. Pedir: username, password, PIN maestro, media_path
4. POST a `/api/setup/firsttime`
5. Crear admin + guardar PIN en JSON
6. Login automÃ¡tico

#### Login Normal
1. Pantalla "Â¿QuiÃ©n estÃ¡ viendo?" con usuarios
2. Click en usuario â†’ input de contraseÃ±a
3. POST a `/api/auth/login`
4. Guardar token en localStorage
5. Mostrar biblioteca

#### Crear Usuario Nuevo (desde Admin)
1. Click en engrane â†’ ingresar PIN maestro
2. Tab "Usuarios" â†’ click "Crear"
3. Ingresar: username, password
4. POST a `/api/admin/users`
5. O: generar cÃ³digo de invitaciÃ³n (Tab "Invitaciones")

#### Usar CÃ³digo de InvitaciÃ³n
1. Usuario externo recibe cÃ³digo (ej. `KRK-A3F9`)
2. En login, click "Tengo cÃ³digo de invitaciÃ³n"
3. Ingresar: cÃ³digo, username, password
4. POST a `/api/auth/register`
5. CÃ³digo se consume (un solo uso)

### Problemas Encontrados y Soluciones

#### Problema 1: Error 401 al generar cÃ³digos
- **Causa:** Endpoints usaban `@require_master_pin` en lugar de `@require_admin`
- **SoluciÃ³n:** Cambiar todos los endpoints de admin a usar `@require_admin` (usa token JWT)

#### Problema 2: Avatar no se veÃ­a
- **Causa:** ImÃ¡genes de avatar fallaban silenciosamente
- **SoluciÃ³n:** Agregar `onerror` handler que fallback a iniciales o ðŸ�™

#### Problema 3: PIN pedido dos veces
- **Causa:** Frontend pasaba PIN como parÃ¡metro a funciones, pero backend requerÃ­a header
- **SoluciÃ³n:** Auto-inyecciÃ³n de Bearer token en `window.fetch`, funciones sin parÃ¡metro `pin`

### Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `services/auth.py` | NUEVO - Sistema JWT |
| `routes/api.py` | +15 endpoints, decoradores `@require_admin` y `@require_master_pin` |
| `templates/index.html` | +500 lÃ­neas - Login, panel admin, gestiÃ³n de usuarios |
| `Cambios.md` | Este documento |

### Notas para Build

**TODO listo para v4.87:**
- âœ… Backend: Python OK
- âœ… Frontend: HTML/JS OK
- âœ… DB: Usa tabla `users` existente
- âœ… Config: PIN maestro en `runtime_config.json`

**Testing:**
1. Borrar DB de usuarios (o tabla completa)
2. Abrir Kraken â†’ debe mostrar setup inicial
3. Crear admin â†’ login automÃ¡tico
4. Click engrane â†’ panel admin
5. Generar cÃ³digo â†’ copiar
6. Abrir ventana incÃ³gnita â†’ usar cÃ³digo â†’ crear usuario

---



## Fixes Visuales y Funcionales (UI / UX)
- **Netflix View (Breadcrumbs Fix)**: Se restaurÃ³ la navegaciÃ³n de migas de pan superior. Al hacer clic en "Video" (`currentPath === 'Video'`), la vista Netflix no se reinicia a carpetas vainilla, manteniendo fluido el entorno grÃ¡fico premium.
- **Barra de BÃºsqueda Netflix**: Se eliminÃ³ el `input` inline de la cabecera Netflix en favor del buscador global, resolviendo definitivamente el problema de pÃ©rdida de foco al re-renderizar la UI (Analizado en `ANALISIS_VIDEO_SEARCH.md`).
- **TÃ­tulos Limpios (Regex)**: Se aÃ±adiÃ³ un mecanismo dinÃ¡mico en el renderizado de `createCard()` para purgar automÃ¡ticamente cualquier residuo de etiquetas `(tmdb-xxxxx)` extraÃ­das de los filenames o id3 tags (Afecta tanto a TÃ­tulos principales como a subtÃ­tulos de Artista).
- **IntegraciÃ³n de TMDB GÃ©neros**: Los gÃ©neros inyectados por la API externa (`tmdb_genres`) ahora son asimilados nativamente durante el armado de `media_type === 'video'`, sincronizando automÃ¡ticamente las etiquetas de la tarjeta y el filtro principal de pills.

## Core LÃ³gica de Agrupamiento
- **Independencia de PelÃ­culas**: Las pelÃ­culas ya no son falsamente envueltas en estructuras virtuales `type: 'folder'` cuando residen en carpetas profundas, permitiendo que todas sus acciones nativas (Play instantÃ¡neo, Favoritos, Listas) apunten fÃ­sicamente a sus `.mp4` correspondientes sin que el API colapse.

---

# Cambios Recientes (v4.83 - 2026-03-29)

## Video View Redesign (Biblioteca de Video)
- **CategorÃ­as: Dropdown â†’ Pills** (scroll horizontal en mÃ³vil)
  - Pill activo: glow/borde emerald
  - Al cambiar categorÃ­a, se resetea el filtro de gÃ©nero
- **GÃ©neros: Carousels â†’ Grid plano + chips**
  - Se muestran TODOS los shows en un solo grid
  - Chips de gÃ©nero arriba (solo si hay >1 gÃ©nero)
  - â€œTodosâ€� resetea el filtro
- **Directorios de Video: layout forzado a lista**
  - Si `currentLibrary === 'video'`, el contenedor usa `flex flex-col` (ignora grid/list toggle)
  - Temporadas/episodios y archivos sueltos renderizan con `createEpisodeRow()`

## MÃºsica
- **Zoom de mÃºsica: REVERTIDO** âœ… (`zoomLevels` restaurados; grid intacto)

## Escaneo â€œUltra RÃ¡pidoâ€� (OptimizaciÃ³n Delta)
- Skip inteligente comparando `mtime` + `size_bytes` (bÃºsquedas O(1) con `set`/`Set`)
- Merge de gÃ©neros: protege gÃ©neros editados manualmente si el re-escaneo regresa vacÃ­os

## Builds / DistribuciÃ³n
- Windows Installer (Inno Setup 6): `dist\\Kraken_Media_Server_Installer_v4.83.exe`
- Windows EXE: `dist\\Kraken_Windows_EXE_v4.83.zip`
- Mac: `dist\\Kraken_Mac_v4.83.zip` (y carpeta `dist\\Kraken_Mac\\`)

## Notas
- Release notes: `RELEASE_NOTES_v4.83.md` (legacy: `RELEASE_NOTES_v4.8.md`).

---

# Cambios Recientes (2026-03-25)

## 1. Runtime Config - Fix persistencia en EXE

### Problema
El EXE compilado con PyInstaller leÃ­a config.py desde el bundle (_MEIPASS), lo cual revertÃ­a cualquier cambio al reiniciar la app.

### SoluciÃ³n implementada
- Se crea `runtime_config.json` en `%APPDATA%\Kraken Media Server\`
- `config.py` ahora lee valores desde el JSON
- Los cambios se sincronizan en ambos archivos (JSON + config.py local)
- Solo el JSON se usa en modo EXE (evita error de permisos en Program Files)

### Archivos modificados
- `config.py` - LÃ³gica de load/save runtime config
- `routes/api.py` - Endpoints /api/setup y /api/settings escriben en JSON

### UbicaciÃ³n del JSON
- Windows: `C:\Users\USER\AppData\Roaming\Kraken Media Server\runtime_config.json`
- Mac: `~/Library/Application Support/Kraken Media Server/runtime_config.json`

---

## 2. Consola Integrada (Debug)

### DescripciÃ³n
Barra verde al final de la pÃ¡gina que al hacer click abre una konsola mostrando logs del servidor.

### CaracterÃ­sticas
- Barra visible abajo centro (estilo matrix verde)
- Muestra hasta 500 lÃ­neas de logs
- BotÃ³n para maximizar, cerrar y limpiar
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
- Ahora acepta mÃºltiples URLs separadas por coma o salto de lÃ­nea
- El backend procesa cada URL y combina los resultados

### Velocidad de descarga (Concurrent Fragments)
- Selector nuevo: Normal / 2x / 4x
- Usa la opciÃ³n `concurrentfragments` de yt-dlp
- Descarga fragmentos en paralelo para mayor velocidad

### LÃ­mite de carga aumentado
- Ahora carga hasta 100 elementos inicial (antes 20)
- Incrementa de 100 en 100 al "Cargar mÃ¡s"

### Fix bug selections
- Seleccionar todo ya no reinicia la lista
- Las selecciones se mantienen al cargar mÃ¡s resultados

### Archivos modificados
- `routes/api.py` - LÃ³gica batch + concurrentfragments
- `app_tail.py` - UI selector velocidad + fixes

---

## 4. Launcher Silencioso (VBS)

### DescripciÃ³n
Archivo `iniciar_kraken.vbs` para ejecutar el BAT sin mostrar ventana de CMD.

### Uso
Ejecutar `iniciar_kraken.vbs` en vez de `launcher.bat`

### CÃ³digo
```vbscript
' Kraken Media Server - Launcher Silencioso
CreateObject("Wscript.Shell").Run """%~dp0launcher.bat""", 0, False
```

### Archivos creados
- `iniciar_kraken.vbs` (fuente + dist)

---

## 5. Build y DistribuciÃ³n

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

## Notas tÃ©cnicas

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

### Modos de operaciÃ³n
- **Online**: Requiere internet, acceso via Cloudflare tunnel
- **Offline**: Sin internet, todo cacheado (PWA)
- **LAN**: Red local, sin internet, acceso por IP

---

## Pendiente / Por probar
- [ ] Probar batch URLs con mÃºltiples enlaces
- [ ] Probar selector de velocidad 2x/4x
- [ ] Test de instalaciÃ³n limpia
- [ ] Validar que el runtime config funciona en EXE instalado

---

# ðŸ“‹ RESUMEN RELEASE v4.8

## Paquetes disponibles
| Paquete | DescripciÃ³n |
|---------|-------------|
| `Kraken_Windows_v4.8.zip` | Portable Windows (.bat) |
| `Kraken_Windows_EXE_v4.8.zip` | EXE compilado (PyInstaller) |
| `Kraken_Mac_v4.8.zip` | Portable Mac |

## Features principales

### ðŸŽ¬ Video Streaming (HLS)
- Transcoding on-the-fly para compatibilidad con MKV
- Direct Play para MP4/Webm nativos
- ArtPlayer avanzado con PiP, velocidad, screenshots, gestos tÃ¡ctiles

### ðŸ’» App de escritorio (pywebview)
- Flask en hilo secundario
- WebView2 (Edge Chromium)
- Fallback a navegador externo

### ðŸ“± Offline Support
- LibrerÃ­as locales: hls.min.js, artplayer.js, tailwind.min.js, fontawesome.min.css, html2canvas.min.js

### âš™ï¸� Mejoras del downloader
- MÃºltiples URLs separadas por coma o salto de lÃ­nea
- Selector de velocidad: Normal / 2x / 4x
- 100 items por pÃ¡gina (antes 20)

### ðŸ�› Fixes
- Runtime config persistente en EXE (%APPDATA%)
- Consola de debug integrada (estilo matrix verde)
- Launcher silencioso VBS (sin ventana CMD)

### ðŸŽ¨ Admin
- Setup Wizard (primer uso)
- Settings Panel (cambiar email/PIN)
Audio Selector Robusto (ArtPlayer + HLS)

Se aÃ±adiÃ³ cambio de pista de audio estable incluso cuando el navegador no expone audioTracks.
Nuevo parÃ¡metro audio_track en /api/hls/play.
Reinicio controlado de sesiÃ³n HLS al cambiar pista, manteniendo tiempo de reproducciÃ³n.
Se devolviÃ³ selected_audio_track desde backend para sincronizar UI.
Fix crÃ­tico para pistas AC3/5.1

Se corrigiÃ³ error Unsupported channel layout "6 channels".
En transcodificaciÃ³n HLS el audio ahora se fuerza a AAC estÃ©reo (-ac 2) para mÃ¡xima compatibilidad.
Resultado: cambio de audio funcionando en archivos que antes daban 500.
Etiquetas de audio mejoradas (tipo VLC)

Se mejorÃ³ parseo de metadatos de pistas (title, language_code, channels, codec).
Labels mÃ¡s humanos (ej. EspaÃ±ol, JaponÃ©s) con detalle tÃ©cnico opcional (AAC 2.0, AC3 5.1).
Dedupe automÃ¡tico cuando hay pistas con nombres repetidos.
SubtÃ­tulos externos (estado previo consolidado)

DetecciÃ³n de subtÃ­tulos externos en carpeta del video, subs/ y subtitles/.
Soporte de selector en settings de ArtPlayer para tracks externos.
OptimizaciÃ³n de re-scan de biblioteca (alta ganancia)

services/library.py ahora usa escaneo delta:
si size_bytes + mtime no cambia, no reprocesa metadata.
scanned_paths pasÃ³ de lista a set (elimina cuello O(NÂ²) en limpieza).
OptimizaciÃ³n de playlists en generar_biblioteca_viva: de N+1 queries a query Ãºnica.
Backup de seguridad creado: services/library.py.bak_pre_delta.
Mejoras adicionales recomendadas (siguientes pasos)

Invalidar BIB_CACHE_BY_OWNER automÃ¡ticamente en endpoints de editar metadata / playlists / borrar.
AÃ±adir modo â€œSimple/Completoâ€� para labels de audio en UI.
Agregar menÃº rÃ¡pido de subtÃ­tulos (tamaÃ±o/color/fondo/posiciÃ³n) persistido en localStorage.
Medir tiempos antes/despuÃ©s de /actualizar_cache para dejar benchmark real.

---

# ImplementaciÃ³n: Streaming por ID + Token (Plex-Style) â€” v4.87

## Resumen
Se migrÃ³ el motor de reproducciÃ³n de video de **rutas fÃ­sicas expuestas** a un sistema de **IDs de base de datos + Tokens temporales**, similar a la arquitectura de Plex, Netflix y Amazon Prime Video. Las URLs de streaming ya no revelan la estructura de carpetas del servidor.

## Archivos Modificados

### `state.py` (1 lÃ­nea)
- Se agregÃ³ `STREAM_TOKENS = {}` como diccionario global en memoria para almacenar tokens activos con su ID de media asociado y timestamp de expiraciÃ³n.

### `services/library.py` (1 lÃ­nea)
- Se agregÃ³ `'id': row['id']` al diccionario `f` que se envÃ­a al frontend, exponiendo el Primary Key de SQLite de cada archivo multimedia.

### `routes/api.py` (18 lÃ­neas)
- **Nuevo endpoint `POST /api/stream/token`**: Recibe `{id: <media_id>}` en JSON. Genera un UUID v4 como token, lo almacena en `state.STREAM_TOKENS` con expiraciÃ³n de 4 horas, y devuelve `{token, id}` al frontend.

### `routes/hls.py` (40 lÃ­neas)
- **RefactorizaciÃ³n de `play_hls()`**: Ahora acepta dos modos:
  - **Modo nuevo (Plex-style)**: Recibe `id` + `token`. Valida token contra `state.STREAM_TOKENS`, verifica expiraciÃ³n, busca `rel_path` en SQLite por ID.
  - **Modo legacy (fallback)**: Si recibe `file=` sin `id`/`token`, funciona como antes.
- **Validaciones**: Token invÃ¡lido â†’ 403, Token expirado â†’ 403 (auto-elimina), ID no en DB â†’ 404.

### `templates/index.html` (32 lÃ­neas)
- **`playVideoMode(file)`** â†’ `async function` para soportar `await`.
- **Nuevo flujo**: Pide token primero (`POST /api/stream/token`), luego llama HLS con `id+token`.
- **Fix tÃ­tulos anidados**: `parts[2]` â†’ `parts[Math.max(0, parts.length - 2)]` (dinÃ¡mico).

## Flujo de ReproducciÃ³n
```
Click â†’ playVideoMode(file)
  â†’ POST /api/stream/token {id: 455}
  â†’ Backend genera UUID con TTL 4h
  â†’ GET /api/hls/play?id=455&token=abc123&sid=default
  â†’ Backend valida token â†’ busca rel_path en DB â†’ sirve video
```

## Seguridad
- Sin token vÃ¡lido: 403 Forbidden
- Token expirado: auto-elimina, 403
- Token de otro ID: 403
- Rutas fÃ­sicas del disco nunca se exponen en URL

## Pruebas Esenciales Pendientes
- [ ] Reproducir pelÃ­cula (1-click desde vista Netflix)
- [ ] Reproducir episodio de serie (navegando carpetas)
- [ ] Verificar que mÃºsica sigue funcionando normal (no usa tokens)
- [ ] Verificar Chromecast/Cast (token viaja en URL del HLS)
- [ ] Verificar expiraciÃ³n de tokens despuÃ©s de 4 horas
- [ ] Probar con archivo con caracteres especiales en el nombre


---

# v4.87 - 2026-04-01 (Build Final)

## Novedades Principales

### 1. Sistema de Autenticacion Completo (JWT)
- Login con email + contrasena (estilo Netflix/Plex)
- Tokens JWT firmados con HMAC-SHA256 (30 dias)
- Contrasenas hasheadas con PBKDF2 (100k iteraciones)
- Sistema de usuarios con roles (admin/usuario)

### 2. Panel de Administracion
- Gestion completa de usuarios (CRUD)
- Generacion de codigos de invitacion
- Duracion configurable de codigos (5 min -> 1 semana)
- Cambio de PIN maestro y media_path
- Todo protegido con autenticacion JWT

### 3. Seguridad Anti-Fuerza Bruta
- Rate limiting: 5 intentos -> 5 minutos de bloqueo
- Deteccion de IP correcta (Cloudflare: CF-Connecting-IP)
- Logging de intentos fallidos en consola
- Limpieza automatica despues de 1 hora

---

## Cambios Completos

### Rate Limiting (NUEVO)

Configuracion:
- MAX_LOGIN_ATTEMPTS = 5 (intentos maximos)
- LOCKOUT_DURATION = 300 (5 minutos de bloqueo)

Flujo:
1. Usuario intenta login
2. Verifica si IP esta bloqueada -> 429 si bloqueado
3. Contrasena incorrecta -> registra intento
4. 5 intentos fallidos -> bloquea IP por 5 min
5. Login exitoso -> limpia intentos anteriores

Deteccion de IP (soporta Cloudflare):
`python
def _get_client_ip():
    return request.headers.get('CF-Connecting-IP') or \
           request.headers.get('X-Forwarded-For', '').split(',')[0].strip() or \
           request.remote_addr or 'unknown'
`

### Endpoints de Auth

| Endpoint | Metodo | Proteccion | Descripcion |
|----------|--------|-----------|-------------|
| /api/auth/users | GET | Publico | Lista usuarios para login |
| /api/auth/login | POST | Rate Limit | Login con contrasena |
| /api/auth/register | POST | Publico | Registro con codigo |
| /api/auth/verify | GET | JWT | Verifica token valido |
| /api/auth/set_password | POST | JWT | Cambiar contrasena |
| /api/auth/logout | POST | JWT | Logout |

### Endpoints Admin (requieren JWT de admin)

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| /api/admin/users | GET | Lista todos usuarios |
| /api/admin/users | POST | Crea usuario |
| /api/admin/users/<email> | DELETE | Elimina usuario |
| /api/admin/users/<email>/password | PUT | Resetea contrasena |
| /api/admin/invite | POST | Genera codigo |
| /api/admin/invite/validate | POST | Valida codigo |
| /api/admin/invite | DELETE | Invalida todos |
| /api/admin/config | PUT | Actualiza config |

---

## Problemas Resueltos

1. Error 500 al listar usuarios
   - Causa: Tabla users no tinha columna id
   - Solucion: Deteccion dinamica de columnas

2. Error 401 al generar codigos
   - Causa: Endpoints usaban @require_master_pin
   - Solucion: Cambiar a @require_admin

3. Codigo de invitacion no validado
   - Causa: No habia validacion previa
   - Solucion: Endpoint /api/admin/invite/validate

4. Rate limiting no detectaba IP real
   - Causa: No usaba CF-Connecting-IP
   - Solucion: _get_client_ip() con soporte Cloudflare

---

## Para Produccion

Capas de Seguridad:

| Capa | Proteccion |
|------|------------|
| Cloudflare | WAF, DDoS |
| Kraken Backend | Rate limit nativo |
| JWT Tokens | Firma HMAC-SHA256 |
| Contrasenas | PBKDF2 (100k iteraciones) |

---

## Archivos Modificados

| Archivo | Tipo | Descripcion |
|---------|------|-------------|
| services/auth.py | NUEVO | Sistema JWT completo |
| routes/api.py | MODIFICADO | Endpoints, decoradores, rate limiting |
| templates/index.html | MODIFICADO | Login, panel admin |

---

## PRUEBAS PENDIENTES v4.87

- [ ] Test login con usuario valido
- [ ] Test login con contrasena incorrecta (verificar rate limit)
- [ ] Test crear usuario desde panel admin
- [ ] Test eliminar usuario
- [ ] Test generar codigo de invitacion
- [ ] Test usar codigo de invitacion
- [ ] Test cerrar sesion
- [ ] Test login despues de lockout

---

## BUILD INFO

- Version: 4.87
- Fecha: 2026-04-01
- Estado: Listo para testing

---

# v4.87.1 - 2026-04-02 (Hotfix UX + Playback + Update + Cast)

## Novedades Principales

### 1. Vista de detalle unificada en Video (Series/Peliculas)
- Se consolido la experiencia de detalle para evitar duplicados al abrir "Mas informacion".
- La vista de series mantiene banner + info + selector de temporada + lista de episodios en el mismo flujo.
- Se corrigio el flujo de peliculas para entrar a detalle desde card sin romper el layout general.

### 2. UX del Hero en detalle
- Ajustes de botones en hero (Reproducir / Episodios / Mas informacion segun contexto).
- Eliminacion de elementos duplicados en cabecera cuando la informacion ya se muestra abajo.
- Limpieza del header de video (menos ruido visual en modo detalle).

### 3. Continue Watching (progreso real)
- Se completo el tracking de progreso para modo fallback (reproductor nativo), no solo ArtPlayer/HLS.
- Ahora el heartbeat de progreso se detiene correctamente al terminar o salir de reproduccion.
- Se habilito logica de "Continuar" tambien para peliculas en hero cuando existe progreso valido.

### 4. Banner de "Nueva version" corregido
- Fix backend en `/api/check_update`: ya no devuelve update siempre.
- Comparacion semantica de version (ej: 4.10 > 4.9) en backend y frontend.
- Se envia version local en query para validar correctamente si realmente existe update.

### 5. Cast (Chromecast) reforzado
- Inicializacion explicita de Google Cast con `__onGCastApiAvailable`.
- Setup de `CastContext` con `DEFAULT_MEDIA_RECEIVER_APP_ID`.
- Fallback seguro: si SDK/plugin no estan listos, no rompe el player y se desactiva plugin de forma controlada.

---

## Archivos Modificados (Hotfix)

| Archivo | Tipo | Descripcion |
|---------|------|-------------|
| templates/index.html | MODIFICADO | UX video detalle, cast init, update check semantico, progreso fallback |
| assets/js/hero_series.js | MODIFICADO | Logica de accion "Continuar" (series + peliculas) |
| routes/api.py | MODIFICADO | `/api/check_update` con comparacion de version real |
| app_offline.py | MODIFICADO | Version bump a 4.87 |

---

## Build y Distribucion

- PyInstaller ejecutado con `KrakenOffline.spec`.
- Installer generado con Inno Setup (`kraken_installer.iss`).
- Resultado:
  - `dist/KrakenOffline/KrakenOffline.exe`
  - `dist/Kraken_Media_Server_Installer_v4.87.exe`
- Se actualizaron archivos en `dist/Kraken_Mac` para mantener consistencia del paquete.

---

## Estado

- Version base de release: 4.87
- Hotfix aplicado: 4.87.1 (fecha 2026-04-02)
- Estado: Listo para validacion final de UX y Cast en dispositivos reales

---

# Cambios Recientes (v4.91 - 2026-04-11)

## SesiÃ³n de Trabajo: HLS Keepalive + Cast Fix + ReconexiÃ³n

### Resumen
ImplementaciÃ³n de mejoras crÃ­ticas al sistema de streaming HLS: timeout extendido a 20 minutos, soporte para Chromecast via dominio pÃºblico, reconexiÃ³n automÃ¡tica de sesiones expiradas, y keepalive ping durante pausas.

### ðŸŽ¯ Cambios en Backend

#### `state.py` â€” Timeout HLS Extendido
- **Cambio:** `max_inactive_seconds` de 600s â†’ 1200s (20 minutos)
- **FunciÃ³n:** `cleanup_old_hls_sessions()`
- **RazÃ³n:** Permite pausas largas sin destruir la sesiÃ³n FFmpeg (evita reconexiones molestas)
- **Log mejorado:** Mensaje ahora indica ">20 min sin actividad"

#### `config.py` â€” Dominio PÃºblico para Cast
- **Nueva variable:** `CAST_PUBLIC_URL = os.getenv('CAST_PUBLIC_URL', 'https://kraken.ederzu.com')`
- **UbicaciÃ³n:** LÃ­neas 98-100, junto a configuraciones de URL del servidor
- **RazÃ³n:** Chromecast no puede acceder a localhost; necesita URL pÃºblica accesible via HTTPS

#### `routes/hls.py` â€” Endpoint de ReconexiÃ³n + Cleanup Duplicado
- **Nuevo endpoint:** `POST /api/hls/reconnect`
  - Permite crear nueva sesiÃ³n HLS desde video ya conocido
  - Recupera `full_video_path` desde token o sesiÃ³n anterior
  - Limpia sesiÃ³n antigua antes de crear nueva
  - Soporta selecciÃ³n de pista de audio
  - Retorna nueva URL HLS + token + session_id
  - Endpoint resiliente: valida token, media_id, existencia de archivo
- **FunciÃ³n duplicada actualizada:** `cleanup_old_hls_sessions()` al final del archivo tambiÃ©n usa 1200s
- **Respuesta mejorada:** `hls_status` ahora incluye campo `alive: true/false`

#### `routes/api.py` â€” Endpoint de ConfiguraciÃ³n PÃºblica
- **Nuevo endpoint:** `GET /api/config/public`
- **Respuesta:**
  ```json
  {
    "cast_public_url": "https://kraken.ederzu.com"
  }
  ```
- **RazÃ³n:** Frontend necesita leer dominio pÃºblico para construir URLs de Cast accesibles desde cualquier dispositivo

### ðŸŽ¨ Cambios en Frontend

#### `templates/index.html` â€” Cast Fix + Keepalive + ReconexiÃ³n

##### 1. AutoJoinPolicy Mejorado
- **Cambio:** `ORIGIN_SCOPED` â†’ `TAB_AND_ORIGIN_SCOPED`
- **UbicaciÃ³n:** InicializaciÃ³n de Cast (`castContext.setOptions()`)
- **RazÃ³n:** Permite que mÃºltiples tabs del mismo origen se unan a la misma sesiÃ³n Cast

##### 2. Dominio PÃºblico para Cast
- **Carga automÃ¡tica:** `fetch('/api/config/public')` durante `DOMContentLoaded`
- **Variable global:** `window.__krakenPublicUrl` (sanitizada con `.replace(/\/+$/, '')`)
- **Uso:** ConstrucciÃ³n de URLs de Cast ahora usa `publicOrigin = window.__krakenPublicUrl || window.location.origin`
- **Resultado:** Chromecast accede a `https://kraken.ederzu.com` en vez de `http://localhost:xxxx`

##### 3. Keepalive Ping para Sesiones HLS
- **Funciones:** `startHlsKeepalive()` y `stopHlsKeepalive()`
- **Intervalo:** Cada 60 segundos durante video pausado
- **Endpoint:** `GET /api/hls/status?sid=XXX`
- **LÃ³gica:**
  - Inicia automÃ¡ticamente en evento `pause`
  - Se detiene en evento `play`
  - Si `status.alive === false`, limpia intervalo automÃ¡ticamente
- **Resultado:** Mantiene `last_activity` vivo, evita cleanup prematuro por inactividad

##### 4. ReconexiÃ³n Graceful
- **DetecciÃ³n de error:** Listener `art.on('error')` filtra errores HLS (network, manifest, timeout, 403, 404)
- **Overlay de reconexiÃ³n:** UI elegante con blur backdrop + botÃ³n "Reconectar"
- **Flujo de reconexiÃ³n:**
  1. Usuario hace clic en "Reconectar"
  2. `POST /api/hls/reconnect` con `old_session_id`, `token`, `media_id`, `audio_track`
  3. Backend crea nueva sesiÃ³n HLS
  4. Frontend actualiza URL con `art.switchUrl(newUrl)`
  5. Overlay se elimina, keepalive se reinicia
- **Manejo de errores:** Si falla, botÃ³n cambia a "Error â€” cerrar y reabrir" con fondo rojo
- **ProtecciÃ³n contra doble reconexiÃ³n:** Variable `_reconnecting` evita reconexiones simultÃ¡neas

### ðŸ“‹ Lista de Tareas Completadas

- [x] `state.py` â€” Cambiar timeout HLS de 600s a 1200s (20 min)
- [x] `config.py` â€” Agregar `CAST_PUBLIC_URL`
- [x] `routes/hls.py` â€” Endpoint `/api/hls/reconnect` + token en segmentos
- [x] `routes/api.py` â€” Endpoint `/api/config/public` para exponer `CAST_PUBLIC_URL`
- [x] `templates/index.html` â€” `autoJoinPolicy` + dominio pÃºblico para Cast + keepalive ping + reconexiÃ³n

### ðŸ”§ Archivos Modificados

| Archivo | LÃ­neas Afectadas | Tipo de Cambio |
|---------|------------------|----------------|
| `state.py` | LÃ­nea 40 | Timeout default |
| `config.py` | LÃ­neas 98-100 | Nueva variable |
| `routes/hls.py` | LÃ­neas 218-355, 460 | Nuevo endpoint + cleanup |
| `routes/api.py` | LÃ­neas 3086-3093 | Nuevo endpoint pÃºblico |
| `templates/index.html` | LÃ­neas 30, 1525-1534, 6014-6016, 6356-6478 | Cast fix + keepalive + reconexiÃ³n |

### ðŸŽ¯ Beneficios para el Usuario

1. **Pausas largas sin reconexiÃ³n:** 20 minutos de inactividad antes de destruir sesiÃ³n (vs 10 min anterior)
2. **Chromecast funcional:** URLs pÃºblicas accesibles desde cualquier dispositivo, no solo localhost
3. **ReconexiÃ³n automÃ¡tica:** Si sesiÃ³n expira, overlay elegante permite reconectar con 1 clic
4. **Sesiones estables:** Keepalive mantiene sesiÃ³n viva durante pausas largas (pausa para contestar telÃ©fono, etc.)

### âš ï¸� Notas TÃ©cnicas

- **Token en segmentos HLS:** Los segmentos ahora incluyen token en URL para validaciÃ³n
- **Cleanup duplicado:** FunciÃ³n `cleanup_old_hls_sessions()` existe en `state.py` y `routes/hls.py`; ambas usan 1200s
- **Compatibilidad Cast:** Requiere HTTPS en dominio pÃºblico para funcionar en producciÃ³n
- **Keepalive silencioso:** Errores de red durante pausa son silenciados para no spamear consola

---

## 2026-05-03 21:23 — Refactor UI Video (Fase A + inicio Fase B)

### Contexto
Se inició la unificación de la vista de video (estilo Netflix) para reducir acoplamiento en `renderLib()` sin romper funciones existentes de audio/video.

### Cambios aplicados

#### 1) Estado unificado de video (Fase A)
- **Archivo:** `templates/index.html`
- **Nuevo estado central:** `videoUIState`
  - `mode`, `activeCategory`, `genreFilter`, `gridRenderLimit`, `recommendationsOpen`, `search`, `pathDepth`, `detailView`.
- **Compatibilidad hacia atrás:** se crearon bindings con `Object.defineProperty` para mantener funcionando código legado que usa:
  - `window.netflixActiveCategory`
  - `window.netflixGenreFilter`
  - `window.netflixGridRenderLimit`
- **Sincronización derivada por render:** `syncVideoDerivedState()` se ejecuta antes de `_renderLibActual()`.

#### 2) Integración de estado en flujos clave
- `goHome()` resetea estado visual de video (`genreFilter`, `recommendationsOpen`, `gridRenderLimit`).
- `setLibraryMode('video')` normaliza límite de grid.
- `navigateUp()` actualiza categoría activa vía estado.
- `toggleRecommendations()` sincroniza `videoUIState.recommendationsOpen`.

#### 3) Extracción de lógica de filtros Netflix (Fase B parcial)
- **Nueva función:** `setupNetflixRootFilters(categoriesArray, genresArray)`
- Centraliza handlers y dropdowns de root video:
  - `filterByGenre`
  - `changeNetflixCategory`
  - `toggleCategoryDropdown`
  - `toggleGenreDropdown`
  - `toggleRecommendations`
  - `hideDropdownByType`
- Devuelve HTML de menús:
  - `categoryMenuHtml`
  - `genreMenuHtml`

#### 4) Extracción de recomendaciones
- **Nueva función:** `appendNetflixRecommendationsSection(container, uniqueShows)`
- Se movió fuera de `renderLib()`:
  - construcción de filas por género
  - flechas/scroll horizontal desktop
  - inyección de bloque `#recommendations-section`

### Resultado
- Se redujo complejidad del bloque root de video sin cambiar UX.
- Audio no se vio afectado en pruebas manuales.
- Base lista para siguiente fase: extraer `Hero + Grid + Load More` en función dedicada.

---
## 2026-05-03 21:51 — Refactor UI Video (avance adicional)

### Cambios aplicados en esta iteración

#### 1) Hero + Grid extraídos a helpers
- **Archivo:** `templates/index.html`
- **Nuevas funciones:**
  - `appendNetflixHero(container, heroItem)`
  - `appendNetflixGrid(container, showsToDisplay)`
- **Resultado:** el root de video dejó de tener bloques inline largos para hero y paginado de cards.

#### 2) Maratón modularizado
- **Nueva función:** `setupNetflixMarathon(uniqueShows)`
- Se reemplazó la definición inline de `window.shuffleVideoMarathon` dentro del root por una llamada directa al helper.
- **Resultado:** menos lógica embebida en `renderLib()` y misma UX de botón `Maratón`.

#### 3) Estado de render de video centralizado
- **Nueva función:** `getVideoRenderState(searchValue)`
- Centraliza flags usados en enrutado de video:
  - `isRoot`
  - `isSearching`
  - `shouldForceVideoList`
  - `isEpisodeQuery`

#### 4) Búsqueda root de video extraída
- **Nuevas funciones:**
  - `buildVideoRootSearchEntities(filtered, searchValue, activeCategory)`
  - `renderVideoRootSearchResults(container, filtered, searchValue)`
- Se reemplazó la rama inline `isSearching && isRoot && !isEpisodeQuery` por llamada a helper.
- **Resultado:** cache y ranking se mantienen, pero el flujo queda desacoplado.

#### 5) Catálogo root de Netflix extraído
- **Nueva función:** `buildNetflixRootCatalog(filtered)`
- Centraliza:
  - normalización de paths de video
  - categorías disponibles
  - categoría activa por defecto
  - `uniqueShows`
  - `genresArray`
- Se reemplazó bloque inline grande del root por:
  - `const { categoriesArray, uniqueShows, genresArray } = buildNetflixRootCatalog(filtered);`

### Resultado de arquitectura
- `renderLib()` quedó significativamente más corto en la rama de video.
- Se preservó comportamiento funcional (sin cambios de UX intencionales).
- Audio permanece sin cambios de lógica.

---

## 2026-05-03 22:50 - Refactor UI Video (Fase C Final) y Mejoras MÃ³viles

### Contexto
Tercera y Ãºltima etapa de la unificaciÃ³n del render de video. AdemÃ¡s, se aplicaron mejoras visuales al reproductor y la experiencia mÃ³vil estilo Netflix.

### Cambios de Arquitectura en Video
- **ExtracciÃ³n de Cabeceras:**
  - `renderVideoPathHeader(container, shouldForceVideoList)` (tÃ­tulo + botÃ³n subir adaptativo).
  - `renderVideoDetailHeroAndSeasonControls(container, filtered)` (hero detalle + selector de temporada + acciones).
- **ExtracciÃ³n de Directorios:**
  - `buildVideoDirectoryGroups(filtered, isSearching)`
  - `renderVideoFolderGroups(container, groups, shouldForceVideoList)`
- **Resultado:** `renderLib()` ahora es casi 100% orquestador en la rama de video, llamando a funciones modulares y limpias.

### Cambios Visuales y de UX (Netflix/Plex Style)
- **Sidebar Global (Drawer):**
  - El menÃº lateral dejÃ³ de ser persistente. Ahora es un "drawer" (overlay) que se abre y cierra (`sidebar-open`).
  - AÃ±adido botÃ³n hamburguesa en desktop.
  - Cierre con la tecla `Esc` y al dar clic fuera del menÃº (backdrop blur).
  - IntegraciÃ³n fluida: el drawer se oculta automÃ¡ticamente al iniciar reproducciÃ³n de video.
- **Reproductor de Video (`#player-bar`):**
  - Se eliminÃ³ el margen lateral izquierdo (`md:ml-64`) ya que el menÃº no ocupa espacio en el flujo normal.
  - Se ajustÃ³ el reproductor para no superponerse a la consola del desarrollador, elevÃ¡ndolo ligeramente (`bottom-[24px]`) y reestableciendo el botÃ³n y panel de consola a sus ubicaciones anteriores en la parte inferior (`bottom:0` y `bottom:24px`).
- **Vista MÃ³vil (EstadÃ­sticas):**
  - Se escondieron las estadÃ­sticas de reproducciÃ³n (`#lib-stats`) en un acordeÃ³n desplegable para mantener la interfaz inicial mÃ¡s limpia y Ã¡gil.

### Estabilizacin Global de Navegacin y UI (04-Mayo-2026)
- **Barra Superior Persistente:**
  - Implementacin de una barra superior fija de 40px con el logo de Kraken centrado y estética metálica.
  - Consolidacin del botn de men hamburguesa como elemento global en la barra superior para Desktop y Mvil.
- **Rediseo de Controles de Librera:**
  - Reubicacin de los botones de Vista (Grid/List) y el Switch de Offline en la parte superior de la sidebar.
  - Implementacin de un **Switch tipo Pastilla (Pill Toggle)** robusto basado en CSS nativo para garantizar animaciones fluidas y estados claros en dispositivos mviles.
  - Optimizacin de tamaos de botones (40px) para mejorar la usabilidad tctil en celulares.
- **Correcciones de Estructura y UX:**
  - Resolucin de solapamientos de capas (z-index) entre la barra superior y el men lateral.
  - Limpieza de headers redundantes en las vistas de msica y video para una interfaz ms despejada.
  - Sincronizacin mejorada del estado Offline mediante eventos globales y gestin de localStorage.
