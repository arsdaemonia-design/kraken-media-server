# Kraken Media Server V4

**Kraken Media Server** es un ecosistema multimedia autohospedado de alto rendimiento desarrollado con **Flask (Python)** en el backend y una interfaz SPA moderna en el frontend. Está diseñado para gestionar bibliotecas personales de música y video con una experiencia fluida estilo Spotify, Plex y Netflix, con soporte para modo online/offline (PWA), túnel seguro Cloudflare, multiusuario y clientes dedicados para televisores.

---

## 📌 Versión Actual

- **Backend / WebApp:** `v4.99.1` (Octubre 2026)
- **Instalador Windows:** `dist/Kraken_Media_Server_Installer_v4.99.1.exe`
- **Cliente Android TV:** `KrakenTV` (Proyecto nativo Kotlin en `../KrakenTV`)

---

## 🚀 Características Principales

### 🎬 Video y Cine
- **Interfaz estilo Netflix:** Hero dinámico con carruseles horizontales, pósteres en alta definición y navegación por categorías/géneros.
- **Auto-Tagging inteligente (TMDB):** Enriquecimiento automático de películas y series con póster, backdrop, sinopsis, año, géneros y calificación.
- **Motor HLS Adaptativo + DirectPlay:**
  - Detección automática de códecs compatibles para reproducción directa (remuxing sin pérdida de calidad).
  - Transcodificación HLS en tiempo real con FFmpeg cuando el contenedor o códec no es compatible con el navegador/cliente.
  - Continuidad de reproducción (*Resume playback*) sincronizada por usuario.
- **Motor de Subtítulos Integral:**
  - **Búsqueda y descarga online:** Integración con **SubDL** y **Podnapisi** sin necesidad de API keys; descarga automática de `.srt` normalizados en UTF-8.
  - **Extracción de subtítulos incrustados:** El motor de Auto-Tag extrae pistas de texto desde contenedores MKV/MP4 a archivos `.srt` independientes.
  - Detección tolerante de subtítulos externos (`.srt`, `.vtt`) y conversión en caliente de codificaciones ANSI/Latin-1 a UTF-8.
- **Reproductor Moderno (ArtPlayer + Gestos Táctiles):**
  - **Gestos estilo YouTube:** Doble toque en el tercio izquierdo (-10s acumulable), tercio derecho (+10s acumulable) y centro (pausa/play) con animaciones visuales (ripple).
  - Ocultación automática de controles (barra de progreso, cabecera y botón volver) a los 4 segundos de inactividad, optimizado para táctil, ratón y D-Pad.
  - Selector de pistas de audio multipista con preservación exacta de la posición de reproducción.

### 🎵 Música y Audio
- **Indexación ultrarrápida:** Escaneo local multihilo con SQLite optimizado y lectura de metadatos ID3/Vorbis con Mutagen.
- **Playlists, Favoritos y Mixes Inteligentes:** Detección de BPM y nivel de energía musical para crear radios dinámicas por similitud y mezclas coherentes.
- **Enriquecimiento de Metadatos:** Consulta escalonada en MusicBrainz, Last.fm y Deezer para completar carátulas, biografías y géneros sin sobrescribir etiquetas válidas.
- **Detector de Duplicados Seguro:** Panel dedicado para separar copias idénticas (hash SHA-256) de variantes de versiones (acústicos, en vivo, remasters) con protección por PIN maestro.
- **Letras Sincronizadas y Visualizador:** Soporte para archivos `.lrc` sincronizados y visualizadores en tiempo real.

### 🔐 Seguridad y Multiusuario
- **Autenticación JWT:** Tokens de sesión seguros con expiración y renovación transparente.
- **Control de Acceso Basado en Roles:** Usuarios estándar y Superadministrador con panel de control.
- **Modo Niños (Kid Mode):** Filtrado automático por calificación de edad (bloqueo estricto de PG-13, R, NC-17, TV-MA y clasificaciones para adultos).
- **Bóveda para Adultos (+18 / Adult Vault):** Contenido clasificado como adulto protegido por **PIN Maestro**. Oculto por defecto en la biblioteca y protegido tanto en la API de metadatos como en la generación de tokens de reproducción HLS (`adult_authorized`).

### 📦 Modo Offline y Aplicación de Escritorio
- **Ejecutable autónomo:** Versión para Windows empaquetada con PyInstaller (`app_offline.py` + `pywebview`).
- **PWA (Progressive Web App):** Service Worker optimizado con estrategia *Network-First* con conexión y fallback local para activos estáticos.

---

## 🌐 Configuración de Red, Dominio y Cloudflare Tunnel

Kraken Media Server está diseñado para operar de forma transparente en red local o públicamente a través de un túnel seguro cifrado sin necesidad de abrir puertos en el router ni configurar DDNS.

### Arquitectura de Conexión

```text
[ Dispositivo / Navegador / Android TV ]
                   │
                   ▼ (HTTPS)
       https://kraken.ederzu.com
                   │
                   ▼ (Cloudflare Edge - SSL/TLS automático)
          [ Cloudflare Tunnel ]
                   │
                   ▼ (Túnel cifrado saliente)
        cloudflared.exe (Servicio Windows)
                   │
                   ▼ (HTTP local)
             127.0.0.1:5000 (Flask / Kraken)
```

### 1. Túnel de Producción (Servicio de Windows)
En el servidor principal, el túnel opera como un servicio de sistema continuo (`Cloudflared`):
- **Binario:** `C:\Program Files (x86)\cloudflared\cloudflared.exe`
- **Comando de servicio:** `cloudflared.exe tunnel run --token <TUNNEL_TOKEN>`
- **Estado:** Se inicia automáticamente al arrancar el equipo (`StartType: Automatic`).
- **Mapeo:** El hostname público `kraken.ederzu.com` redirige directamente a `http://localhost:5000`.
- **Cabeceras seguras:** El backend lee `CF-Connecting-IP` para limitación de tasa (*rate limiting*) y audita inicios de sesión con Cloudflare Access si está habilitado.

### 2. Túnel Portátil / Rápido (`start_offline_tunnel.bat`)
Para pruebas o instancias portátiles sin instalar el servicio:
```cmd
start_offline_tunnel.bat
```
Este script inicia `app_offline.py` y levanta una conexión rápida mediante `cloudflared-windows-amd64.exe tunnel --url http://127.0.0.1:5000`, generando un enlace temporal `*.trycloudflare.com`.

### 3. Integración con Google Cast / Chromecast
El protocolo de Chromecast exige que el receptor acceda a una URL pública con certificado HTTPS válido.
- Variable configurada en `config.py`:
  ```python
  CAST_PUBLIC_URL = os.getenv('CAST_PUBLIC_URL', 'https://kraken.ederzu.com')
  ```
- Al enviar video a Chromecast, Kraken genera URLs firmadas con token apuntando a `CAST_PUBLIC_URL` para que el dispositivo pueda hacer streaming directo.

---

## 📺 Ecosistema de Clientes TV

### 1. Kraken TV para Android TV / Google TV (`KrakenTV`)
Ubicado en `E:\Kraken Media Server\KrakenTV`, es un cliente nativo optimizado para televisores de bajos recursos (ej. procesadores MediaTek quad-core de 32 bits y 1 GB de RAM en Android 11).

- **Arquitectura:** Kotlin + AndroidX Leanback + AndroidX Media3 (ExoPlayer).
- **Navegación 100% Espacial:** Sin eventos de ratón/touch; control total mediante D-Pad (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `DPAD_CENTER`, `Back`).
- **Consumo de Memoria < 80 MB:**
  - Filtrado estricto de ABI solo para `armeabi-v7a`.
  - Virtualización de listas con Leanback `ArrayObjectAdapter`.
  - Decodificación de pósteres a `185x278` píxeles en formato `RGB_565`.
- **Endpoints de TV en el Backend:**
  - `GET /api/tv/library?offset=0&limit=40`: Metadatos compactos paginados, filtrando contenido según permisos y PIN maestro.
  - `GET /api/tv/poster/<path>`: Genera y almacena en caché derivados JPEG ultralivianos de `185x278` px (~15-20 KB) con cabeceras `Cache-Control: public, max-age=31536000, immutable`.
  - `POST /api/stream/token` & `GET /api/hls/play`: Negociación segura de streaming HLS con validación de PIN para contenido de la bóveda de adultos.

### 2. Roadmap para Roku (BrightScript + SceneGraph)
- Compatible de forma nativa con el motor HLS del nodo `Video` de SceneGraph.
- Planificado con arquitectura `RowList` y tareas asíncronas en `Task` nodes. Detalles completos y especificación en [`SESION_v4.99_ROADMAP_TV.md`](file:///E:/Kraken%20Media%20Server/Kraken%20Media%20Server/SESION_v4.99_ROADMAP_TV.md).

---

## 🗂️ Estructura del Repositorio

```text
E:\Kraken Media Server\
├── Kraken Media Server/               # Repositorio Principal (Backend + Web SPA)
│   ├── app.py                         # Punto de entrada servidor web estándar
│   ├── app_offline.py                 # Punto de entrada aplicación de escritorio (pywebview)
│   ├── app_logic.py                   # Inicialización y lógica de ciclo de vida
│   ├── config.py                      # Configuración central (rutas, puertos, URLs)
│   ├── state.py                       # Estado en memoria (sesiones, tokens de streaming)
│   ├── utils.py                       # Utilidades generales y helpers
│   ├── routes/
│   │   ├── api.py                     # API REST (Biblioteca, TV, Auth, Subtítulos, TMDB)
│   │   ├── hls.py                     # Motor de streaming HLS, playlists y segmentos
│   │   └── media.py                   # Entrega de archivos estáticos y miniaturas
│   ├── services/
│   │   ├── database.py                # Conexión SQLite y migraciones automáticas
│   │   ├── library.py                 # Indexación y escaneo de medios
│   │   ├── metadata.py                # Extracción ID3 y metadatos de audio
│   │   ├── hls_transcoder.py          # Orquestador FFmpeg para streaming adaptativo
│   │   ├── video_tagger.py            # Auto-tagger TMDB y extracción de subtítulos
│   │   └── duplicates.py              # Detección segura de duplicados
│   ├── templates/
│   │   └── index.html                 # Single Page Application (SPA) principal
│   ├── assets/                        # CSS, fuentes, íconos y librerías JS
│   ├── dist/                          # Instaladores y binarios compilados
│   ├── _archive/                      # Resguardo histórico de código y documentación
│   │   └── docs_historicos/           # Diagnósticos y notas de versiones anteriores
│   ├── KrakenOffline.spec             # Especificación PyInstaller para Windows
│   ├── kraken_installer.iss           # Script de compilación Inno Setup
│   ├── README.md                      # Esta guía central
│   ├── RELEASE_NOTES_v4.99.md         # Notas detalladas de la versión actual
│   ├── SESION_v4.99_ROADMAP_TV.md     # Roadmap técnico Android TV y Roku
│   └── Cambios.md                     # Registro histórico cronológico de cambios
│
└── KrakenTV/                          # Cliente Nativo para Android TV (Gradle)
    ├── app/
    │   ├── src/main/java/com/kraken/tv/
    │   │   ├── KrakenApp.kt           # Inicialización de aplicación e inyección
    │   │   ├── KrakenApi.kt           # Cliente HTTP OkHttp / Retrofit
    │   │   ├── SessionStore.kt        # Almacenamiento seguro de sesión
    │   │   ├── LoginActivity.kt       # Pantalla de inicio de sesión optimizada para TV
    │   │   ├── MainActivity.kt        # Contenedor principal Leanback
    │   │   ├── BrowseFragment.kt      # Carruseles y filas de contenido con Leanback
    │   │   └── PlayerActivity.kt      # Reproductor Media3/ExoPlayer con D-Pad
    │   ├── src/main/res/              # Layouts, estilos y banners 320x180 (16:9)
    │   └── AndroidManifest.xml        # Declaración LEANBACK_LAUNCHER y touchscreen=false
    ├── build.gradle.kts
    └── README.md
```

---

## 🛠️ Instalación y Desarrollo

### Requisitos Previos
- **Python 3.10 o superior**
- **FFmpeg y FFprobe** instalados y accesibles en el `PATH` del sistema
- Sistema operativo: Windows 10/11 (recomendado para empaquetado) o Linux/macOS

### 1. Puesta en Marcha (Desarrollo)
```bash
# 1. Crear y activar entorno virtual
python -m venv venv
venv\Scripts\activate

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Iniciar servidor de desarrollo
python app.py
```
El servidor iniciará en `http://127.0.0.1:5000`.

### 2. Modo Aplicación de Escritorio
```bash
venv\Scripts\activate
python app_offline.py
```
Abre la aplicación encapsulada en una ventana nativa mediante `pywebview`.

---

## 🏗️ Compilación y Empaquetado

### 1. Generar Binario de Escritorio (PyInstaller)
Utilizar el intérprete del entorno virtual:
```cmd
venv\Scripts\python -m PyInstaller -y KrakenOffline.spec
```
Salida generada:
- Carpeta autónoma en `dist\KrakenOffline\` con el ejecutable `KrakenOffline.exe` y todas sus dependencias.

### 2. Compilar el Instalador de Windows (Inno Setup)
Teniendo instalado [Inno Setup 6](https://jrsoftware.org/isdl.php):
```cmd
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" kraken_installer.iss
```
Salida generada:
- `dist\Kraken_Media_Server_Installer_v4.99.1.exe`

### 3. Compilar el Cliente Android TV (`KrakenTV`)
Abrir el directorio `KrakenTV` en **Android Studio** (con JDK 17 y Android SDK 35 instalados) o ejecutar por línea de comandos:
```bash
cd ..\KrakenTV
gradlew :app:assembleDebug
```
El APK resultante estará optimizado para arquitecturas `armeabi-v7a` y configurado para instalarse en cualquier dispositivo Android TV o Google TV.

---

## 💾 Optimización de Almacenamiento y Rendimiento

Kraken Media Server cuenta con optimizaciones clave para evitar saturar el disco y el consumo de CPU/RAM:
1. **Candado de Tareas Concurrentes (`_BG_TASK_LOCK`):** El escaneo de biblioteca y el etiquetador automático de TMDB nunca se ejecutan en paralelo, previniendo bloqueos de base de datos (`database is locked`) y saturación del disco HDD.
2. **Caché en Memoria y Reducción de Payload:** La API de biblioteca (`/biblioteca`) descarta claves nulas y repetitivas, ahorrando más de 130 000 nodos JSON en el frontend.
3. **Imágenes Bajo Demanda:** Las miniaturas para TV (`/api/tv/poster/<path>`) se generan una única vez en un hilo secundario y se almacenan comprimidas a 82% de calidad en `THUMBNAILS_FOLDER/tv_cache`, evitando reprocesamiento futuro.
4. **Recomendación para Disco HDD:** En discos mecánicos con grandes volúmenes de video, se recomienda excluir la carpeta de medios de la indexación de Windows Search y del análisis en tiempo real de Windows Defender.

---

## 📄 Licencia y Documentación Relacionada

- [Notas de la Versión v4.99](RELEASE_NOTES_v4.99.md)
- [Roadmap Técnico Android TV y Roku](SESION_v4.99_ROADMAP_TV.md)
- [Historial Detallado de Cambios](Cambios.md)
- [Archivo de Diagnósticos Históricos](_archive/docs_historicos/)
