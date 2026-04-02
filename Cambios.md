# Kraken Media Server - Documentación

## ¿Qué es Kraken?

Kraken es un servidor multimedia local con modo online/offline. Permite:
- Reproducir música y videos desde tu biblioteca local
- Descargar contenido de YouTube, Spotify y otras fuentes
- Streaming de video via HLS con transcodificación
- Modo offline con PWA
- Acceso via LAN o Cloudflare tunnel

## Versión Actual
- **v4.86** (2026-04-01)

---

# Cambios Recientes (v4.86 - 2026-04-01)

## Sistema TMDB Folder-Based (Video Auto-Tagging)

### Implementación Completa
Sistema folder-based para videos inspirado en Plex/Radarr/Sonarr, con extracción automática de TMDB IDs desde cualquier parte de la ruta.

### Nuevas Funciones Backend (`services/video_tagger.py`)
- **`extract_tmdb_id_from_path(file_path)`**: Extrae TMDB ID de carpeta, subcarpetas o nombre de archivo. Soporta formatos: `(tmdb-123)`, `{tmdb-123}`, `[tmdb=123]`, `tmdb-123`
- **`detect_folder_type(file_path)`**: Detecta `movie` vs `series` automáticamente basado en presencia de `Temporada` o `Season` en la ruta
- **`is_series_episode(filename)`**: Detecta patrones de episodios (`S01E01`, `1x01`, `Episodio 1`, `Capítulo 1`)
- **`extract_series_name(file_path)`**: Extrae nombre de serie desde estructura de carpetas
- **Cache en memoria**: Evita consultas repetidas a API de TMDB para la misma serie

### Cambios Backend (`services/library.py`)
- Scanner extrae `tmdb_id` de la ruta completa
- Scanner detecta `folder_type` (`movie` o `series`)
- Limpieza de títulos: quita automáticamente `(tmdb-XXXXX)` del nombre
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
- **Nueva función `getCoverUrl(f)`**: Prioriza `tmdb_poster` sobre búsqueda por path
- **Movie vs Series**: Usa `folder_type === 'movie'` para 1-click play
- **Hero Banner**: Usa `tmdb_poster` si existe para el cover
- **Player Modal**: Usa `tmdb_poster` si existe
- **Títulos**: Usa `tmdb_title` si existe, fallback a `title`

### Flujo Completo
1. **Scanner**: Extrae ID → Detecta tipo → Limpia título → Guarda
2. **Auto-Tag**: Usa ID → Consulta TMDB → Descarga poster → Guarda metadata
3. **Frontend**: Usa `tmdb_poster` → Muestra cover → 1-click si es movie

### Problemas Encontrados y Solucionados

#### Problema 1: Títulos con ID Residual
- **Síntoma**: Películas mostraban `(tmdb-28968)` como título
- **Causa**: Scanner no limpiaba el ID del nombre de archivo
- **Solución**: Agregar regex para limpiar `\s*[\(\[\{]?tmdb[-_]?\d+[\)\]\}]?` del título antes de guardar

#### Problema 2: Frontend NO Usaba `folder_type`
- **Síntoma**: Películas requerían 2 clics
- **Causa**: Condición `f.type === 'folder' && f.folder_type === 'movie'` nunca se cumplía
- **Solución**: Cambiar a solo checar `f.folder_type === 'movie'` sin importar `f.type`

#### Problema 3: Posters NO Visibles
- **Síntoma**: Posters descargados no aparecían en UI
- **Causa**: Frontend buscaba `thumbnails/filename.jpg` pero tagger guardó como `thumbnails/tmdb_title.jpg`
- **Solución**: Crear `getCoverUrl(f)` que prioriza `tmdb_poster` sobre búsqueda por path

### Rendimiento
- **936 videos** en biblioteca
- **934 con TMDB ID** (99.8%)
- **934 con poster** (99.8%)
- **Tiempo para 100 videos con ID**: ~10-30 segundos
- **Tiempo para 100 videos sin ID**: ~3-5 minutos
- **Rate limit hits**: 0 (gracias a cache)

### Documentación
- Archivo: `ANALISIS_TMDB_TAGGING.md` (500+ líneas)
- Incluye: problemas, soluciones, flujos, métricas

---

# Cambios Recientes (v4.87 - 2026-04-01)

## Sistema de Autenticación Completo (JWT-based) + Seguridad

### Resumen
Implementación de sistema de login similar a Plex/Netflix: usuarios con contraseña, tokens JWT, gestión de invitaciones, panel de administración completo, y protección contra ataques de fuerza bruta.

### 🔐 Seguridad Implementada

#### Rate Limiting (Anti-Fuerza Bruta)
- **Ubicación:** `routes/api.py`, líneas ~2640-2700
- **Funcionamiento:**
  - 5 intentos máximos por IP
  - Lockout de 5 minutos después de intentos fallidos
  - Limpia intentos después de 1 hora de inactividad
  - Detecta IP desde `X-Forwarded-For` (Cloudflare) o `request.remote_addr`
- **Respuestas:**
  - `429 Too Many Requests` cuando está bloqueado
  - `remaining_attempts` en respuesta para frontend
- **Logging:** Consola muestra bloqueos y intentos

#### Sistema JWT (Tokens)
- Tokens firmados con HMAC-SHA256 (30 días de duración)
- Sin dependencias externas
- Secreto guardado en `.kraken_secret` (generado automáticamente)

#### Hash de Contraseñas
- PBKDF2 con 100,000 iteraciones
- Salt aleatorio por cada contraseña
- Almacenado en columna `pin_hash` de tabla `users`

### Nuevos Archivos Backend

#### `services/auth.py`
- **Funciones principales:**
  - `create_token(user_email, username, is_superadmin)` - Crea token firmado
  - `verify_token(token)` - Verifica firma y expiración
  - `hash_password(password)` - Hash con PBKDF2
  - `verify_password(password, stored_hash)` - Verifica hash
  - `generate_invite_code()` - Códigos tipo `KRK-XXXX`
  - `get_user_from_request(request)` - Extrae email desde Bearer token

### Cambios Backend (`routes/api.py`)

#### Decoradores de Seguridad
```python
@require_master_pin  # Requiere PIN maestro (para config global)
@require_admin       # Requiere usuario admin logueado (JWT)
```

#### Endpoints de Admin (Protegidos con `@require_admin`)
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/admin/users` | GET | Lista todos los usuarios |
| `/api/admin/users` | POST | Crea usuario directamente |
| `/api/admin/users/<email>` | DELETE | Elimina usuario |
| `/api/admin/users/<email>/password` | PUT | Resetea contraseña |
| `/api/admin/invite` | POST | Genera código de invitación |
| `/api/admin/invite` | DELETE | Invalida todos los códigos |
| `/api/admin/invite/validate` | POST | Valida código sin consumirlo |
| `/api/admin/config` | PUT | Actualiza PIN/media_path |

#### Endpoints de Autenticación (Públicos con Rate Limiting)
- `/api/auth/login` - Login con rate limiting (5 intentos → 5 min lockout)
- `/api/auth/register` - Registro (público con código de invitación)
- `/api/auth/verify` - Verifica token JWT
- `/api/auth/set_password` - Cambia contraseña de usuario
- `/api/auth/logout` - Logout

#### Endpoints de Setup
- `/api/setup/status` - Detecta si necesita configuración inicial
- `/api/setup/firsttime` - Primera configuración (crea admin)

### Cambios Frontend (`templates/index.html`)

#### Pantalla de Login (Netflix-style)
- "¿Quién está viendo?" con grid de usuarios
- Input de contraseña por usuario
- Validación de códigos de invitación antes de mostrar formulario

#### Panel de Administración
- **3 Tabs:**
  1. **General:** Cambiar media_path y PIN maestro
  2. **Usuarios:** CRUD completo (crear, eliminar, resetear password)
  3. **Invitaciones:** Generar códigos con duración configurable
- **Duración de códigos:** Nunca expira, 5 min, 1 hora, 24 horas, 1 semana
- **Carga automática:** Lista usuarios al entrar al tab

#### Mejoras Visuales
- Avatar por defecto: 🐙 cuando no hay imagen
- Manejo de errores en imágenes: fallback a iniciales
- Gradiente de colores en avatares

### Base de Datos

Tabla `users` (estructura existente):
```sql
- email (TEXT PRIMARY KEY)
- username (TEXT)
- pin_hash (TEXT) -- Ahora guarda hash de contraseña PBKDF2
- is_superadmin (INTEGER)
- avatar_url (TEXT)
- created_at (REAL)
```

**Nota:** La tabla NO tiene columna `id` - el código la detecta dinámicamente.

### Flujos de Uso

#### Primera Configuración
1. Abrir Kraken → detecta sin admin
2. Formulario: username, password, PIN maestro, media_path
3. POST `/api/setup/firsttime` → admin creado

#### Login Normal
1. Pantalla "¿Quién está viendo?"
2. Click usuario → input contraseña
3. POST `/api/auth/login` (con rate limiting)
4. Token guardado en localStorage
5. Auto-inyección de Bearer token en todos los fetch

#### Crear Usuario (Admin)
1. Click engrane → PIN maestro
2. Tab "Usuarios" → formulario username + password
3. POST `/api/admin/users` → usuario creado

#### Usar Código de Invitación
1. Login → "Tengo código de invitación"
2. POST `/api/admin/invite/validate` → valida sin consumir
3. Si válido → formulario registro
4. POST `/api/auth/register` → código consumido

### Problemas Solucionados

#### 1. Error 500 al listar usuarios
- **Causa:** Tabla `users` no tenía columna `id`
- **Solución:** Detección dinámica de columnas

#### 2. Error 401 en generar códigos
- **Causa:** Endpoints usaban `@require_master_pin` pero frontend no enviaba PIN
- **Solución:** Cambiar a `@require_admin` (usa JWT)

#### 3. Código de invitación no validado
- **Causa:** Se aceptaba cualquier código sin validar
- **Solución:** Endpoint `/api/admin/invite/validate` antes de mostrar formulario

#### 4. Rate limiting en login
- **Riesgo:** Bots podían intentar fuerza bruta
- **Solución:** 5 intentos → 5 minutos lockout

### Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `services/auth.py` | NUEVO - Sistema JWT completo |
| `routes/api.py` | +25 endpoints, decoradores, rate limiting |
| `templates/index.html` | +600 líneas - Login, panel admin, seguridad |
| `Cambios.md` | Este documento |

### Para Producción (Exposición Internet)

Aunque Kraken está tras Cloudflare, se agregó:
- ✅ Rate limiting nativo (5 intentos → lockout)
- ✅ Contraseñas hasheadas con PBKDF2
- ✅ Tokens JWT firmados
- ✅ Logs de seguridad en consola

**Recomendación Cloudflare adicional:**
- Activa "Rate Limiting" en dashboard
- Agrega WAF rule para `/api/admin/*`
- Considera agregar "JS Challenge" en rutas de login

---



### Resumen
Implementación de sistema de login similar a Plex/Netflix: usuarios con contraseña, tokens JWT, gestión de invitaciones, y panel de administración completo.

### Nuevos Archivos Backend

#### `services/auth.py`
- **Autenticación con JWT-like** (HMAC-SHA256, sin dependencias externas)
- **Funciones principales:**
  - `create_token(user_email, username, is_superadmin)` - Crea token firmado (expira en 30 días)
  - `verify_token(token)` - Verifica firma y expiración
  - `hash_password(password)` - Hash con PBKDF2 (100k iteraciones, salted)
  - `verify_password(password, stored_hash)` - Verifica contra hash almacenado
  - `generate_invite_code()` - Genera códigos tipo `KRK-XXXX` (ej. `KRK-A3F9`)
  - `get_user_from_request(request)` - Extrae email desde header Authorization Bearer
- **Secreto persistente:** Guardado en `.kraken_secret` (generado automáticamente)

### Cambios Backend (`routes/api.py`)

#### Nuevos Decoradores (líneas ~2390-2423)
- `@require_master_pin` - Requiere PIN maestro (para operaciones críticas)
- `@require_admin` - Requiere usuario admin autenticado (usa token JWT)

#### Nuevos Endpoints de Admin

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/admin/users` | GET | Lista todos los usuarios (panel admin) |
| `/api/admin/users` | POST | Crea usuario nuevo (con código de invitación) |
| `/api/admin/users/<email>` | DELETE | Elimina usuario |
| `/api/admin/users/<email>/password` | PUT | Resetea contraseña |
| `/api/admin/invite` | POST | Genera código de invitación (con duración opcional) |
| `/api/admin/invite` | DELETE | Invalida todos los códigos |
| `/api/admin/config` | GET | Obtiene configuración actual |
| `/api/admin/config` | PUT | Actualiza PIN maestro y media_path |

#### Endpoints de Autenticación
- `/api/auth/users` (GET) - Lista usuarios para pantalla de login
- `/api/auth/login` (POST) - Login con email + contraseña
- `/api/auth/register` (POST) - Registro (primer admin o con invitación)
- `/api/auth/verify` (GET) - Verifica si token JWT es válido
- `/api/auth/logout` (POST) - Logout (invalida token en backend)
- `/api/auth/set_password` (POST) - Cambia contraseña del usuario actual

#### Endpoints de Setup Actualizados
- `/api/setup/status` (GET) - Devuelve si necesita configuración inicial
- `/api/setup/firsttime` (POST) - Crea primer admin con username + password + PIN maestro

#### Sistema de PIN Maestro
- `get_master_pin()` - Lee PIN desde `runtime_config.json` (no de config.py)
- `_load_runtime_config()` - Carga configuración persistente
- `_save_runtime_config(key, value)` - Guarda en JSON + sincroniza con config.py

### Cambios Frontend (`templates/index.html`)

#### Sistema de Login (Nueva Pantalla)
```javascript
// Archivo: index.html, líneas ~1453-1694

// Pantalla "¿Quién está viendo?" (Netflix-style)
- Grid de usuarios con avatares
- Click en usuario → input de contraseña
- Soporta contraseña vacía (solo para usuarios sin contraseña configurada)

// Funciones principales:
- showAuthScreen() - Muestra pantalla de selección de usuario
- renderUsers(users) - Renderiza grid de usuarios
- selectUser(email) - Selecciona usuario y muestra input de contraseña
- loginUser(email, password) - POST a /api/auth/login
- submitRegister() - Registro de nuevo usuario
```

#### Panel de Configuración (Admin)

**3 Tabs:**
1. **General:** Cambiar media_path y PIN maestro
2. **Usuarios:** Ver, crear, eliminar, resetear contraseñas
3. **Invitaciones:** Generar códigos (con selector de duración)

**Funciones:**
- `showSettingsPanel()` - Detecta si es primera vez o panel admin
- `showFirstTimeSetup()` - Pantalla de configuración inicial (username + password + PIN)
- `showAdminPanel()` - Panel completo de administración
- `showSettingsTab(tab)` - Cambia entre tabs
- `loadAdminUsers()` - Carga lista de usuarios
- `adminCreateUser()` - Crea usuario nuevo
- `adminDeleteUser(email)` - Elimina usuario
- `adminResetPassword(email)` - Resetea contraseña
- `adminGenerateInvite()` - Genera código con duración configurable
- `adminClearInvites()` - Invalida todos los códigos

#### Selector de Duración de Códigos
```html
<select id="invite-duration">
  <option value="0">Nunca expira</option>
  <option value="5">5 minutos</option>
  <option value="60">1 hora</option>
  <option value="1440">24 horas</option>
  <option value="10080">1 semana</option>
</select>
```

#### Sistema de Tokens (Auto-inyección)
```javascript
// Override de fetch para inyectar Bearer token automáticamente
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
- Si usuario tiene `avatar_url` → muestra imagen
- Si no tiene avatar → muestra inicial del nombre o 🐙 (logo Kraken)
- Manejo de error: `onerror` fallback a iniciales

### Cambios en la Base de Datos

Tabla `users` (ya existía):
```sql
-- Columnas relevantes para auth:
- email (TEXT PRIMARY KEY)
- username (TEXT)
- pin_hash (TEXT) -- AHORA: guarda hash de contraseña (PBKDF2)
- is_superadmin (INTEGER)
- avatar_url (TEXT)
- created_at (REAL)
```

### Flujos de Uso

#### Primera Configuración (Setup Inicial)
1. Abrir Kraken → detecta que no hay admin
2. Mostrar pantalla "Configuración inicial"
3. Pedir: username, password, PIN maestro, media_path
4. POST a `/api/setup/firsttime`
5. Crear admin + guardar PIN en JSON
6. Login automático

#### Login Normal
1. Pantalla "¿Quién está viendo?" con usuarios
2. Click en usuario → input de contraseña
3. POST a `/api/auth/login`
4. Guardar token en localStorage
5. Mostrar biblioteca

#### Crear Usuario Nuevo (desde Admin)
1. Click en engrane → ingresar PIN maestro
2. Tab "Usuarios" → click "Crear"
3. Ingresar: username, password
4. POST a `/api/admin/users`
5. O: generar código de invitación (Tab "Invitaciones")

#### Usar Código de Invitación
1. Usuario externo recibe código (ej. `KRK-A3F9`)
2. En login, click "Tengo código de invitación"
3. Ingresar: código, username, password
4. POST a `/api/auth/register`
5. Código se consume (un solo uso)

### Problemas Encontrados y Soluciones

#### Problema 1: Error 401 al generar códigos
- **Causa:** Endpoints usaban `@require_master_pin` en lugar de `@require_admin`
- **Solución:** Cambiar todos los endpoints de admin a usar `@require_admin` (usa token JWT)

#### Problema 2: Avatar no se veía
- **Causa:** Imágenes de avatar fallaban silenciosamente
- **Solución:** Agregar `onerror` handler que fallback a iniciales o 🐙

#### Problema 3: PIN pedido dos veces
- **Causa:** Frontend pasaba PIN como parámetro a funciones, pero backend requería header
- **Solución:** Auto-inyección de Bearer token en `window.fetch`, funciones sin parámetro `pin`

### Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `services/auth.py` | NUEVO - Sistema JWT |
| `routes/api.py` | +15 endpoints, decoradores `@require_admin` y `@require_master_pin` |
| `templates/index.html` | +500 líneas - Login, panel admin, gestión de usuarios |
| `Cambios.md` | Este documento |

### Notas para Build

**TODO listo para v4.87:**
- ✅ Backend: Python OK
- ✅ Frontend: HTML/JS OK
- ✅ DB: Usa tabla `users` existente
- ✅ Config: PIN maestro en `runtime_config.json`

**Testing:**
1. Borrar DB de usuarios (o tabla completa)
2. Abrir Kraken → debe mostrar setup inicial
3. Crear admin → login automático
4. Click engrane → panel admin
5. Generar código → copiar
6. Abrir ventana incógnita → usar código → crear usuario

---



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

---

# Implementación: Streaming por ID + Token (Plex-Style) — v4.87

## Resumen
Se migró el motor de reproducción de video de **rutas físicas expuestas** a un sistema de **IDs de base de datos + Tokens temporales**, similar a la arquitectura de Plex, Netflix y Amazon Prime Video. Las URLs de streaming ya no revelan la estructura de carpetas del servidor.

## Archivos Modificados

### `state.py` (1 línea)
- Se agregó `STREAM_TOKENS = {}` como diccionario global en memoria para almacenar tokens activos con su ID de media asociado y timestamp de expiración.

### `services/library.py` (1 línea)
- Se agregó `'id': row['id']` al diccionario `f` que se envía al frontend, exponiendo el Primary Key de SQLite de cada archivo multimedia.

### `routes/api.py` (18 líneas)
- **Nuevo endpoint `POST /api/stream/token`**: Recibe `{id: <media_id>}` en JSON. Genera un UUID v4 como token, lo almacena en `state.STREAM_TOKENS` con expiración de 4 horas, y devuelve `{token, id}` al frontend.

### `routes/hls.py` (40 líneas)
- **Refactorización de `play_hls()`**: Ahora acepta dos modos:
  - **Modo nuevo (Plex-style)**: Recibe `id` + `token`. Valida token contra `state.STREAM_TOKENS`, verifica expiración, busca `rel_path` en SQLite por ID.
  - **Modo legacy (fallback)**: Si recibe `file=` sin `id`/`token`, funciona como antes.
- **Validaciones**: Token inválido → 403, Token expirado → 403 (auto-elimina), ID no en DB → 404.

### `templates/index.html` (32 líneas)
- **`playVideoMode(file)`** → `async function` para soportar `await`.
- **Nuevo flujo**: Pide token primero (`POST /api/stream/token`), luego llama HLS con `id+token`.
- **Fix títulos anidados**: `parts[2]` → `parts[Math.max(0, parts.length - 2)]` (dinámico).

## Flujo de Reproducción
```
Click → playVideoMode(file)
  → POST /api/stream/token {id: 455}
  → Backend genera UUID con TTL 4h
  → GET /api/hls/play?id=455&token=abc123&sid=default
  → Backend valida token → busca rel_path en DB → sirve video
```

## Seguridad
- Sin token válido: 403 Forbidden
- Token expirado: auto-elimina, 403
- Token de otro ID: 403
- Rutas físicas del disco nunca se exponen en URL

## Pruebas Esenciales Pendientes
- [ ] Reproducir película (1-click desde vista Netflix)
- [ ] Reproducir episodio de serie (navegando carpetas)
- [ ] Verificar que música sigue funcionando normal (no usa tokens)
- [ ] Verificar Chromecast/Cast (token viaja en URL del HLS)
- [ ] Verificar expiración de tokens después de 4 horas
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

