# 🚀 Mejoras Propuestas - Kraken Media Server v4.92+

**Fecha:** 11 Abril 2026  
**Estado:** Implementación parcial (DB + metadata + faststart ✅)  
**Pendiente:** Config panel robustecimiento

---

## ✅ IMPLEMENTADAS EN v4.92

### 1. DB Index Optimization

**Problema:** Búsquedas y filtros lentos en bibliotecas grandes (900+ archivos)

**Índices existentes antes:**
- `idx_media_type` → media_type
- `idx_media_folder` → folder
- `idx_media_genre` → genre
- `idx_media_tmdb_id` → tmdb_id
- `idx_media_folder_type` → folder_type
- `idx_playlist_items_*` → playlist lookups
- `idx_history_*` → play history lookups

**Nuevos índices agregados:**
| Índice | Columna(s) | Beneficio |
|--------|-----------|-----------|
| `idx_media_title` | `title` | **Búsqueda por título instantánea** (search bar) |
| `idx_media_artist` | `artist` | Filtro por artista sin full scan |
| `idx_media_rel_path` | `rel_path` | Lookups directos más rápidos |
| `idx_media_play_count` | `play_count` | Stats "más reproducidas" sin scan completo |
| `idx_media_media_type_title` | `(media_type, title)` | **Búsqueda filtrada por tipo** (solo música o solo video) |
| `idx_media_genre_type` | `(genre, media_type)` | **Filtro combinado**: "Rock en video" vs "Rock en música" |

**Impacto esperado:**
- Búsqueda por título: de ~50-200ms → **<5ms** (10-40x más rápido)
- Filtro por artista: de ~30-100ms → **<3ms**
- "Más reproducidas": de ~20-80ms → **<2ms**
- Búsqueda con filtro activo: **5-15x más rápido** gracias a índices compuestos

**Archivos modificados:**
- `services/database.py` → `_create_performance_indexes()`

---

### 2. Video Metadata Columns

**Problema:** Cada vez que reproduces un video, Kraken ejecuta `ffprobe` para detectar:
- Código de video/audio
- Pistas de audio disponibles
- Subtítulos
- Resolución
- Si necesita transcodificación

Esto tarda **2-5 segundos por archivo** y consume CPU innecesariamente.

**Solución:** Extraer toda esta info **durante el escaneo** y guardarla en DB.

**Nuevas columnas en tabla `media`:**

| Columna | Tipo | Ejemplo | Para qué sirve |
|---------|------|---------|---------------|
| `video_resolution` | TEXT | `1080p`, `4K`, `720p` | **Badges en tarjetas**, filtro por calidad |
| `video_codec` | TEXT | `h264`, `hevc`, `av1` | Decidir DirectPlay vs transcodificar **sin ffprobe** |
| `audio_codec` | TEXT | `aac`, `ac3`, `dts`, `flac` | Predecir compatibilidad de audio |
| `audio_channels` | INT | `2`, `6` (5.1), `8` (7.1) | Decidir downmix automático |
| `audio_tracks` | JSON | `[{"language":"es","title":"Español","codec":"aac","channels":2}]` | **Selector de audio instantáneo** sin ffprobe |
| `subtitle_tracks` | JSON | `[{"language":"en","title":"English","codec":"srt"}]` | **Selector de subtítulos instantáneo** |
| `bit_rate` | INT | `8500` (kbps) | Estimar calidad del archivo |
| `aspect_ratio` | TEXT | `16:9`, `2.35:1`, `4:3` | Ajustar player para pillarboxing correcto |
| `frame_rate` | REAL | `24`, `29.97`, `60` | Decidir conversión para web |
| `file_format` | TEXT | `mp4`, `mkv`, `webm` | Decisión DirectPlay vs HLS |
| `faststart` | BOOL | `1` o `0` | Saber si MP4 tiene streaming optimizado |

**Beneficios concretos:**

#### A. Play Instantáneo (2-5 segundos menos)
**Antes:** Click en video → ffprobe (2-5s) → decisión → play  
**Ahora:** Click en video → DB ya tiene info → decisión inmediata → play

#### B. Decisiones HLS Inteligentes
```python
# ANTES: Intentar DirectPlay primero, si falla → HLS
if is_direct_play_compatible(file_path):  # ← ffprobe aquí, tarda
    direct_play()
else:
    hls_stream()

# AHORA: Consultar DB, decisión sin ffprobe
video_info = get_from_db(media_id)
if video_info['video_codec'] in BROWSER_CODECS and video_info['faststart']:
    direct_play()
else:
    hls_stream()
```

#### C. Badges Visuales en Tarjetas
```
┌─────────────────────┐
│  [4K] [HEVC] [5.1]  │  ← Badges desde DB, sin análisis en vivo
│                     │
│   Título Video      │
│                     │
└─────────────────────┘
```

#### D. Filtros por Resolución
- Usuario filtra: "Solo 1080p+" → query directa a DB: `WHERE video_resolution IN ('1080p', '4K')`
- "Solo stereo" → `WHERE audio_channels = 2`
- "Con subtítulos en español" → `WHERE subtitle_tracks LIKE '%"es"%'`

#### E. Selector de Audio/Subtítulo Instantáneo
**Antes:** Click selector → ffprobe (2-5s) → mostrar opciones  
**Ahora:** Click selector → parsear JSON desde DB → opciones inmediatas

**Archivos modificados:**
- `services/database.py` → 11 nuevas columnas + migración
- `services/media_analyzer.py` → `extract_video_metadata()`, `_check_faststart()`, `fix_faststart()`
- `services/library.py` → Scanner extrae metadata durante escaneo
- `config.py` → `AUTO_FASTSTART` config option

---

### 3. Auto-FastStart para MP4

**Problema:** Los archivos MP4 descargados o creados sin `faststart` no pueden hacer DirectPlay instantáneo. Requieren descargar el archivo completo antes de empezar a reproducir.

**Qué es FastStart:**
- MP4 tiene dos "atoms" principales: `moov` (metadatos/índice) y `mdat` (datos de video)
- Si `mdat` viene primero → el player debe descargar TODO el archivo antes de poder reproducir
- Si `moov` viene primero → el player puede empezar a reproducir inmediatamente (streaming real)
- `ffmpeg -c copy -movflags +faststart` reordena los atoms **sin recodificar**

**Implementación en Kraken:**

```
Durante escaneo:
  Si archivo es .mp4 Y no tiene faststart:
    1. ffmpeg -i input.mp4 -c copy -movflags +faststart .kraken_tmp_output.mp4
    2. Verificar con ffprobe que el temp es válido
    3. Verificar que ahora tiene faststart
    4. os.replace(temp, original)  ← atómico en Windows
    5. Si algo falla → borrar temp, original INTACTO
```

**Seguridad:**
| Aspecto | Protección |
|---------|-----------|
| **`-c copy`** | NO recodifica, solo copia streams. Calidad **idéntica** bit-a-bit |
| **Archivo temporal** | Nunca toca el original hasta confirmar éxito |
| **Verificación ffprobe** | Confirma que el temp es válido antes de reemplazar |
| **Verificación faststart** | Confirma que faststart se aplicó correctamente |
| **`os.replace()`** | Operación atómica: o reemplaza completo o nada |
| **Cleanup en error** | Si algo falla, borra temp y deja original intacto |
| **Configurable** | `AUTO_FASTSTART = False` en `config.py` para desactivar |

**Para desactivar:**
```python
# config.py
AUTO_FASTSTART = False  # No aplicar faststart automáticamente
```

**Beneficio:**
- **90%+ de MP4** funcionarán con DirectPlay instantáneo
- No necesitas ejecutar `doctor_videos.py` manualmente
- Se aplica automáticamente en cada escaneo

**Archivos modificados:**
- `services/media_analyzer.py` → `_check_faststart()`, `fix_faststart()`
- `services/library.py` → Integración en scanner
- `config.py` → `AUTO_FASTSTART` config

---

## 📋 PENDIENTES (Para futuras sesiones)

### 4. Config Panel Robustecimiento

**Estado actual:** 3 tabs (General, Users, Invitations)

**Propuesta de nuevas tabs:**

#### Tab: 🎬 Streaming
| Setting | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| HLS Video Bitrate | Select | `8M` | `2M`, `4M`, `8M`, `12M` |
| HLS Audio Bitrate | Select | `192k` | `128k`, `192k`, `256k`, `320k` |
| HLS Segment Duration | Number | `6` | Duración de segmentos en segundos |
| Encoder Selection | Select | `auto` | `auto`, `NVENC`, `VideoToolbox`, `libx264` |
| Max Session Timeout | Number | `20` | Minutos antes de destruir sesión HLS |

#### Tab: 🎵 Audio
| Setting | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| Crossfade Duration | Slider (0-10s) | `3.0` | Duración de transición entre pistas |
| Volume Normalization | Toggle | `Off` | ReplayGain/EBU R128 scan |
| Default EQ Preset | Select | `Flat` | `Flat`, `Bass Boost`, `Vocal`, `Treble` |

#### Tab: 🎬 Video
| Setting | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| Default Subtitle Language | Select | `es` | Idioma preferido para subtítulos |
| Default Audio Language | Select | `es` | Idioma preferido para audio |
| Auto-Play Next Episode | Toggle | `Off` | Siguiente episodio automático en series |
| Subtitle Font Size | Slider | `100%` | Tamaño de fuente de subtítulos |
| Show Resolution Badges | Toggle | `On` | Mostrar badges 4K/1080p en tarjetas |

#### Tab: 📚 Library
| Setting | Tipo | Default | Descripción |
|---------|------|---------|-------------|
| Auto-Rescan Schedule | Select | `Off` | Cada 6h, 12h, 24h, semanal |
| Thumbnail Quality | Select | `Medium` | `Low`, `Medium`, `High` |
| Cache Size Limit | Number | `1000` | Máx. archivos en caché |

**Persistencia:** Todos los settings se guardan en `runtime_config.json` (ya existe el patrón)

---

### 5. Adaptive Bitrate HLS

**Estado actual:** Single bitrate (8M video, 192k audio)

**Propuesta:** Generar múltiples calidades (360p, 720p, 1080p) + master playlist

**Beneficio:** Chromecast y dispositivos con bandwidth limitado pueden cambiar calidad automáticamente

**Implementación:**
```
Master playlist (.m3u8):
  #EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
  360p/playlist.m3u8
  #EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720
  720p/playlist.m3u8
  #EXT-X-STREAM-INF:BANDWIDTH=8000000,RESOLUTION=1920x1080
  1080p/playlist.m3u8
```

**Complejidad:** 🔴 Alta (requiere múltiples transcodificaciones por video)

---

### 6. Audio Features

#### Equalizer (3-band)
- Web Audio API `BiquadFilterNode`
- Sliders: Bass (60Hz), Mid (1kHz), Treble (10kHz)
- Presets: Flat, Bass Boost, Vocal, Treble Boost

#### Volume Normalization
- Escanear biblioteca con ffmpeg `loudnorm` filter
- Guardar ganancia en DB por track
- Aplicar gain durante reproducción

#### Visualizer Modes
- Barras (actual)
- Circular
- Waveform
- Particles

---

## 📊 Resumen de Archivos Modificados (v4.92)

| Archivo | Cambios | Líneas nuevas |
|---------|---------|---------------|
| `services/database.py` | 11 columnas nuevas + 6 índices | +60 |
| `services/media_analyzer.py` | 3 funciones nuevas: extract_video_metadata, check_faststart, fix_faststart | +280 |
| `services/library.py` | Scanner extrae metadata + auto-faststart | +80 |
| `config.py` | AUTO_FASTSTART config | +6 |

---

## 🧪 Cómo Probar

### 1. Verificar que índices se crearon
```python
python -c "
import sqlite3
conn = sqlite3.connect('descargas/kraken.db')
c = conn.cursor()
c.execute(\"SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='media'\")
for row in c.fetchall():
    print(row[0])
"
```

### 2. Verificar que columnas nuevas existen
```python
python -c "
import sqlite3
conn = sqlite3.connect('descargas/kraken.db')
c = conn.cursor()
c.execute('PRAGMA table_info(media)')
for row in c.fetchall():
    if row[1] in ['video_resolution', 'video_codec', 'audio_codec', 'faststart']:
        print(f'✅ {row[1]}: {row[2]}')
"
```

### 3. Escanear biblioteca para poblar metadata
```bash
# Desde la UI: Click en engrane → Sincronizar biblioteca
# O desde consola:
python -c "from services.library import escanear_archivos_fisicos; escanear_archivos_fisicos()"
```

### 4. Ver metadata de un video específico
```python
python -c "
import sqlite3
conn = sqlite3.connect('descargas/kraken.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()
c.execute('SELECT video_resolution, video_codec, audio_codec, audio_channels, faststart FROM media WHERE media_type=\"video\" LIMIT 5')
for row in c.fetchall():
    print(dict(row))
"
```

### 5. Probar FastStart
```python
python -c "
from services.media_analyzer import _check_faststart, fix_faststart
import os

# Verificar un MP4
path = 'descargas/Video/algo.mp4'
print(f'FastStart: {_check_faststart(path)}')

# Aplicar si no tiene
if not _check_faststart(path):
    success, msg = fix_faststart(path)
    print(f'Resultado: {success} - {msg}')
"
```

---

## 🎯 Próximos Pasos Recomendados

1. ✅ **Ejecutar escaneo** para poblar metadata de videos existentes
2. ✅ **Verificar logs** para ver cuántos MP4 recibieron faststart
3. 🔄 **Frontend badges** → Mostrar resolución, codec en tarjetas de video
4. 🔄 **Frontend selector audio/sub** → Usar JSON desde DB en vez de ffprobe
5. 🔄 **Config panel** → Implementar tabs nuevos cuando se decida

---

**Última actualización:** 11 Abril 2026  
**Versión:** v4.92 (DB + metadata + faststart implementados)
