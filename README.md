# 🐙 Kraken Media Server V4

Kraken Media Server es un servidor multimedia y reproductor web autohospedado, construido con **Flask (Python)** en el backend y una SPA en **Vanilla JavaScript + Tailwind CSS** en el frontend. Diseñado para funcionar como un Spotify/Plex privado para tu familia a través de **Cloudflare Tunnels**.

> **V4.84** — Auto-Update via GitHub, Auto-Tag Video (TMDB), Video Search Fix, Netflix-style UI, Crossfade continuo con Web Audio API, Multi-usuario, Playlists compartidas, Avatares personalizados, Smart Mixes, Letras Sincronizadas, Visualizer, Modo Offline PWA.

---

## 🚀 Características

### 🎵 Reproductor y Biblioteca
- **Biblioteca instantánea** — Escanea carpetas locales, extrae metadatos ID3 (mutagen) e indexa todo en SQLite (`kraken.db`)
- **Smart Mixes** — Genera automáticamente: Favoritos, Top 50, Novedades, Radio Kraken
- **Artist Radio** — Se integra con **Last.fm** para generar radios de artistas similares
- **Detección de idioma por carpeta** — Inspecciona nombres de directorios para agrupar mixes por idioma (ej. `Rock (Español)` vs `Rock (Inglés)`)
- **Filtros avanzados** — Filtra por género, artista, álbum, idioma desde el sidebar
- **Visualizer de audio** — Barras de frecuencia animadas en el reproductor
- **Letras sincronizadas (LRC)** — Scroll automático de letras en tiempo real via LRCLIB

### 🎬 Video
- **Reproductor de video web** — Reproduce `.mp4`, `.webm`, `.mkv` directamente en el navegador
- **Miniaturas automáticas** — FFmpeg genera thumbnails para la biblioteca de video
- **Controles inteligentes** — Auto-hide de controles, soporte fullscreen, selección de streams

### 👥 Sistema de Usuarios (Multi-usuario)
- **Autenticación vía Cloudflare Access** — Cada usuario con email verificado por Cloudflare
- **Perfiles personalizados** — Nombre, avatar y color de tema por usuario
- **Playlists privadas** — Cada usuario tiene sus propias playlists y favoritos
- **Radar en tiempo real** — Muestra quién está conectado y qué están escuchando
- **Avatares personalizados** — Sube tus propias imágenes a `assets/avatars/`
- **Superadmin** — Un usuario principal con corona 👑 y permisos especiales

### 🔗 Compartir Playlists
- **Códigos de 6 caracteres** — Click en 🔗 para generar un código único
- **Importar con un click** — Otro usuario pega el código y obtiene una copia de la playlist
- **Duplicados inteligentes** — Si ya existe el nombre, se agrega sufijo automáticamente

### ⬇️ Descargas
- **yt-dlp integrado** — Pega un enlace de YouTube para descargar audio o video
- **Inyección automática** — Los archivos descargados se agregan a la biblioteca automáticamente
- **Historial de descargas** — Registro completo de todo lo descargado

### 📱 Modo Offline (PWA)
- **Service Worker** — Cachea la app y las canciones marcadas para uso offline
- **Base de datos IndexedDB** — Almacena las pistas offline en el navegador
- **Límite configurable** — Control de cuántas canciones guardar offline (default: 500)
- **Detección de red** — Bloquea descargas en red celular/lenta automáticamente

### 🔒 Seguridad
- **PIN de administrador** — Protege acciones destructivas: mover archivos, editar tags, sincronizar
- **Cloudflare Access** — Autenticación de doble factor vía email
- **Protección de rutas** — Validación de traversal en todas las rutas de archivos

---

## 🔄 Auto-Update (GitHub Releases)

Kraken verifica automáticamente si hay una nueva versión disponible al iniciar:

1. Al abrir la app, consulta la API de GitHub Releases
2. Si hay una versión nueva, muestra un banner morado en la parte superior
3. Click en "Descargar" → abre la página de GitHub Releases
4. Descarga el installer y reinala

### Configuración

En `config.py`:
```python
GITHUB_REPO = "tuusuario/kraken-media-server"
```

### Cómo crear un Release

1. Haz build del proyecto (`pyinstaller KrakenOffline.spec`)
2. Genera el installer con Inno Setup
3. Ve a GitHub → Releases → **Draft a new release**
4. Sube los archivos: `.exe`, `.zip` (Windows), `.zip` (Mac)
5. Publica el release

---

## 🛠️ Instalación

### Requisitos
1. **Python 3.10+** — [python.org](https://www.python.org/downloads/) (marcar "Add to PATH")
2. **FFmpeg** — [ffmpeg.org](https://ffmpeg.org/) (agregar a PATH)

### Inicio Rápido (Windows)

```bash
# Doble click en run.bat, o manualmente:
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py          # Modo online (con Cloudflare)
python app_offline.py  # Modo offline (PWA local)
```

El **`run.bat`** incluido automatiza todo: verifica Python y FFmpeg, crea el venv, instala dependencias, y te pregunta qué modo iniciar.

### Estructura de Carpetas

```
Kraken Media Server/
├── app.py                  # Servidor principal (Cloudflare)
├── app_offline.py          # Servidor con inyección PWA
├── config.py               # Configuraciones globales
├── state.py                # Estado en memoria (radar, descargas)
├── utils.py                # Utilidades compartidas
├── sw.js                   # Service Worker para offline
├── run.bat                 # Script de inicio automático
├── kraken.db               # Base de datos SQLite
│
├── routes/
│   ├── api.py              # Endpoints JSON (biblioteca, playlists, usuarios)
│   └── media.py            # Streaming de archivos, avatares
│
├── services/
│   ├── database.py         # Inicialización SQLite + migraciones
│   ├── library.py          # Escaneo de biblioteca + Smart Mixes
│   ├── metadata.py         # Lectura/escritura de tags ID3
│   ├── lastfm.py           # API de Last.fm
│   └── media_analyzer.py   # Análisis con FFprobe
│
├── templates/
│   └── index.html          # SPA completa (~9,000 líneas)
│
├── assets/
│   ├── offline.js          # Lógica PWA del frontend
│   ├── avatars/            # 📸 Imágenes de avatar personalizados
│   ├── kraken.svg          # Logo
│   └── krakenauth.svg      # Logo de autenticación
│
├── descargas/              # 📁 Tu biblioteca de música/video
├── Tagmanager/             # Herramienta de edición masiva de tags
└── alexa_handlers.py       # Integración con Amazon Alexa
```

---

## ☁️ Configuración de Cloudflare (Acceso Remoto + Usuarios)

Kraken usa **Cloudflare Tunnels** + **Cloudflare Access** para exponer el servidor de tu casa a internet de forma segura y autenticar usuarios.

### Paso 1: Crear un Tunnel

1. Ve a [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → **Networks** → **Tunnels**
2. Crea un nuevo tunnel, descarga `cloudflared` para Windows
3. Configura el tunnel apuntando a `http://localhost:5000`
4. Asigna un subdominio: ej. `kraken.tudominio.com`

```bash
# Iniciar el tunnel manualmente:
cloudflared-windows-amd64.exe tunnel run
```

### Paso 2: Configurar Cloudflare Access (Autenticación)

1. Ve a **Access** → **Applications** → **Add an Application**
2. Tipo: **Self-hosted**
3. Dominio: `kraken.tudominio.com`
4. Crea una **Policy** con las reglas de acceso:
   - **Allow** → Emails: agrega los correos de tu familia
   - Método de autenticación: **One-time PIN** (envía un código al email)

### Paso 3: Configurar el Superadmin

En `config.py`, define tu correo como superadmin:

```python
SUPERADMIN_EMAIL = 'tucorreo@gmail.com'
MASTER_PIN = '1234'  # PIN para acciones de admin
```

### Cómo funciona la autenticación

1. El usuario visita `kraken.tudominio.com`
2. Cloudflare Access intercepta y pide su email
3. Se envía un PIN de un solo uso al email
4. Una vez verificado, Cloudflare inyecta el header `Cf-Access-Authenticated-User-Email`
5. Kraken lee ese header y crea/recupera el perfil del usuario automáticamente
6. Si es la primera vez, muestra el modal de registro (nombre + avatar)

---

## 🎨 Avatares Personalizados

En vez de usar avatares genéricos, puedes crear tus propias imágenes:

1. Crea imágenes de avatar (recomendado: **PNG, 128×128px, fondo transparente**)
2. Colócalas en la carpeta `assets/avatars/`
3. Reinicia el servidor
4. Los avatares aparecerán automáticamente en los modales de registro y edición de perfil

**Formatos soportados:** `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`, `.gif`

---

## 🔗 Compartir Playlists

### Compartir
1. En el sidebar, pasa el mouse sobre una playlist
2. Click en el ícono 🔗 (Compartir)
3. Se genera un **código de 6 caracteres** — cópialo y compártelo

### Importar
1. En el sidebar, click en **"Importar"** (junto a "Nueva")
2. Ingresa el código de 6 caracteres
3. La playlist se copia a tu cuenta con todas las canciones

> Si ya tienes una playlist con el mismo nombre, se le agrega el sufijo `(importada)`.

---

## 🔒 PIN de Administrador

Las siguientes acciones requieren el PIN configurado en `config.py`:

| Acción | Endpoint |
|---|---|
| Mover archivos | `/mover_archivo` |
| Editar metadatos (tags) | `/edit_music_tags` |
| Guardar metadatos | `/guardar_metadatos` |
| Sincronizar biblioteca | `/sincronizar_todo` |
| Auto-tagger | `/api/metadata/auto_tag` |

El PIN se pide una sola vez por sesión y se almacena en `sessionStorage`.

---

## 🗄️ Base de Datos (SQLite)

Kraken usa `kraken.db` con las siguientes tablas:

| Tabla | Descripción |
|---|---|
| `media` | Archivos indexados (path, título, artista, género, idioma, etc.) |
| `playlists` | Listas de reproducción (nombre, dueño, share_token) |
| `playlist_items` | Canciones de cada playlist |
| `users` | Perfiles de usuario (email, nombre, avatar, superadmin) |
| `similar_artists` | Caché de artistas similares (Last.fm) |
| `downloads_history` | Historial de descargas de yt-dlp |

Las migraciones son automáticas — al iniciar, `database.py` detecta columnas faltantes y las agrega con `ALTER TABLE`.

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────┐
│                   CLOUDFLARE                      │
│  Tunnel + Access (autenticación por email)        │
└──────────────────────┬──────────────────────────┘
                       │ HTTP
┌──────────────────────▼──────────────────────────┐
│               FLASK SERVER                        │
│  app.py / app_offline.py                          │
│  ├── routes/api.py     → JSON APIs               │
│  ├── routes/media.py   → Streaming + Avatares     │
│  ├── services/         → Lógica de negocio        │
│  └── templates/        → SPA (index.html)         │
└──────────────────────┬──────────────────────────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
     ┌────▼───┐  ┌─────▼────┐  ┌───▼────┐
     │ SQLite │  │ Archivos │  │ Last.fm│
     │ kraken │  │ /descar  │  │  API   │
     │  .db   │  │  gas/    │  │        │
     └────────┘  └──────────┘  └────────┘
```

---

## ⚙️ Configuración (`config.py`)

| Variable | Descripción | Default |
|---|---|---|
| `DOWNLOAD_FOLDER` | Ruta a tu biblioteca de música | `./descargas` |
| `MASTER_PIN` | PIN de administrador | `3041` |
| `SUPERADMIN_EMAIL` | Email del superadmin | — |
| `LASTFM_API_KEY` | API key de Last.fm | Incluida |
| `RADIO_LIMIT` | Canciones por Smart Mix | `50` |
| `OFFLINE_LIMIT` | Máx. canciones offline | `500` |

---

## 📻 Smart Mixes y Detección de Idioma

Kraken detecta el idioma de tu música basándose en los **nombres de las carpetas** dentro de `descargas/`. Configura el mapeo en `services/library.py` (`LANG_FOLDER_MAP`):

```python
LANG_FOLDER_MAP = {
    'Banda': 'Español',
    'Indie': 'Inglés',
    'Ska punk Internacional': 'Inglés',
    'Pop Español': 'Español',
    # ... agregar tus carpetas
}
```

Los Smart Mixes se generan automáticamente agrupados por género + idioma:
- 🎸 `Rock (Español)`, `Rock (Inglés)`
- 🎹 `Electronic (Inglés)`
- 🎤 `Hip-Hop (Español)`

---

## 🎤 Integración con Alexa

Kraken incluye handlers para Amazon Alexa (`alexa_handlers.py`). Comandos soportados:
- *"Alexa, reproduce música en Kraken"*
- *"Alexa, siguiente canción"*
- *"Alexa, pausa"*

---

## 📝 Changelog V4

- ✅ **Crossfade Continuo** — Transiciones perfectas entre pistas usando Web Audio API y GainNodes
- ✅ Multi-usuario con Cloudflare Access
- ✅ Perfiles (nombre, avatar, tema)
- ✅ Avatares personalizados desde `assets/avatars/`
- ✅ Playlists privadas por usuario
- ✅ Compartir playlists con código de 6 caracteres
- ✅ Radar de usuarios en tiempo real (quién escucha qué)
- ✅ Visualizer de audio
- ✅ Letras sincronizadas (LRCLIB)
- ✅ PIN de administrador para acciones sensibles
- ✅ Caché per-usuario optimizado
- ✅ Explorador de archivos
- ✅ Netflix-style UI con carruseles horizontales
- ✅ Migración completa de JSON a SQLite

---

## 🔮 Roadmap

- [x] **Ejecutable (.exe)** — Empaquetar con PyInstaller para distribuir sin Python (v4.80+)
- [x] **Auto-Update via GitHub** — Notificaciones de nuevas versiones (v4.84)
- [ ] **APK (Android)** — Wrap de la PWA en TWA para Google Play
- [x] **Crossfade** — Transiciones de audio fluidas con Web Audio API
- [ ] **Auto-Tag Video** — Integración TMDB para metadata de videos (v4.84)
- [ ] **Refactorización Frontend** — Dividir `index.html` en módulos JS separados
- [ ] **Análisis de Audio (BPM/Energía)** — Mixes inteligentes por "vibe" con Librosa
- [ ] **WebSockets** — Sincronización en tiempo real entre dispositivos
- [ ] **Transcodificación** — Convertir FLAC a MP3 en vivo para ahorrar ancho de banda

---

> **Kraken Media Server** — Tu Spotify privado, sin anuncios, sin suscripciones. 🐙
