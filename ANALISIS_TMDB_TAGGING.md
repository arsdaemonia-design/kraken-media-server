# Análisis: Sistema de Auto-Tagging de Videos con TMDB

## Estado: ✅ IMPLEMENTADO (v4.85+) - CON PROBLEMAS IDENTIFICADOS Y SOLUCIONADOS

---

## 📊 RESUMEN EJECUTIVO

**Implementación completada:** Sistema folder-based para videos con TMDB API, incluyendo detección automática de movie vs series, extracción de IDs desde rutas, y manejo de posters.

**Problemas encontrados:** Títulos con IDs residuales, frontend no usa correctamente `folder_type`, posters no visibles.

**Estado actual:** ✅ Funcional pero requiere ajustes en frontend para usar datos TMDB correctamente.

---

## 1. Implementación Realizada (Backend)

### 1.1 Nuevas Funciones en `services/video_tagger.py`

#### `extract_tmdb_id_from_path(file_path)`
Extrae TMDB ID de CUALQUIER parte de la ruta (carpeta, subcarpetas o archivo).

```python
# Ejemplos soportados:
"Video/Peliculas/(tmdb-12345) Avatar/Avatar.mkv" → ID: 12345
"Video/Series/Breaking Bad (tmdb-1399)/S01E01.mkv" → ID: 1399
"Dragon Ball {tmdb-12609}/Season 1/S01E01.mkv" → ID: 12609
```

**Soporta formatos:** `(tmdb-123)`, `{tmdb-123}`, `[tmdb=123]`, `tmdb-123`

#### `detect_video_type(file_path)` / `detect_folder_type(file_path)`
Detecta si es película o serie basado en la estructura de carpetas.

```python
# Regla simple:
if 'Temporada' in path or 'Season' in path:
    return 'series'
else:
    return 'movie'
```

#### `is_series_episode(filename)`
Detecta patrones de episodios: `S01E01`, `1x01`, `Episodio 1`, `Capítulo 1`

#### `extract_series_name(file_path)`
Extrae nombre de serie desde la estructura de carpetas, ignorando:
- Categorías base: `Video`, `Series`, `Anime`, `Peliculas`
- Carpetas de temporada: `Temporada`, `Season`

### 1.2 Cambios en `services/library.py`

#### Función `escanear_archivos_fisicos()` modificada
- ✅ Extrae `tmdb_id` de la ruta completa
- ✅ Detecta `folder_type` (`movie` vs `series`)
- ✅ Limpia título quitando `(tmdb-XXXXX)` del nombre
- ✅ Guarda en DB: `tmdb_id`, `folder_type`, `tmdb_title`, `tmdb_poster`, etc.

#### Función `generar_biblioteca_viva()` modificada
- ✅ Incluye `folder_type` en datos enviados al frontend
- ✅ Incluye `tmdb_poster`, `tmdb_title`, `tmdb_genres`, `tmdb_year`

### 1.3 Cambios en `services/database.py`

#### Nuevas columnas en tabla `media`:
```sql
ALTER TABLE media ADD COLUMN folder_type TEXT DEFAULT NULL;
ALTER TABLE media ADD COLUMN tmdb_id INTEGER DEFAULT 0;
ALTER TABLE media ADD COLUMN tmdb_title TEXT DEFAULT NULL;
ALTER TABLE media ADD COLUMN tmdb_year TEXT DEFAULT NULL;
ALTER TABLE media ADD COLUMN tmdb_overview TEXT DEFAULT NULL;
ALTER TABLE media ADD COLUMN tmdb_genres TEXT DEFAULT NULL;
ALTER TABLE media ADD COLUMN tmdb_poster TEXT DEFAULT NULL;
```

### 1.4 Cambios en `routes/api.py`

#### Endpoint `/api/auto_tag_library_videos` mejorado
- ✅ Usa `folder_type` de la DB para determinar `/movie/` o `/tv/`
- ✅ Cache en memoria para evitar consultas repetidas
- ✅ Busca videos sin `tmdb_title` (no sin `tmdb_id`)
- ✅ NO sobreescribe el campo `title` (solo llena campos `tmdb_*`)

---

## 2. Cambios en Frontend (`templates/index.html`)

### 2.1 Nueva función `getCoverUrl(f)`

```javascript
function getCoverUrl(f) {
  // Para videos: priorizar tmdb_poster si existe
  if (f.type === 'video' && f.tmdb_poster) {
    return `/caratula/${encodeURIComponent(f.tmdb_poster)}`;
  }
  // Fallback: usar path del archivo
  const sourcePath = f.sample ? f.sample.path : f.path;
  return `/caratula/${sourcePath.split('/').map(p => encodeURIComponent(p)).join('/')}`;
}
```

### 2.2 Lógica de Movie vs Series

```javascript
// En createCard() y otros lugares:
const isMovieFolder = f.type === 'folder' && f.folder_type === 'movie';
const clickAction = isMovieFolder 
    ? `playNow('${escapeStr(f.path)}')`  // 1 click = play
    : `currentPath='${escapeStr(f.path)}'; renderLib();`; // navegar
```

### 2.3 Hero Banner actualizado
- Usa `tmdb_poster` si existe para el cover
- Detecta `folder_type === 'movie'` para mostrar "PELÍCULA" en vez de "DESTACADO"

---

## 3. Problemas Encontrados Durante Testing

### 🔴 Problema 1: Títulos con ID Residual

**Síntoma:** Películas muestran título como `"(tmdb-28968)"` en vez del nombre real.

**Causa:** El scanner extrajo el título del nombre del archivo, pero la función `clean_title_for_search()` del tagger lo estaba limpiando incorrectamente.

**Ejemplo real:**
```
Filename: "Veneno para las hadas (1986) - (tmdb-28968).mkv"
Title guardado: "(tmdb-28968)" ← ❌ Mal
TMDB Title: "Veneno para las hadas" ← ✅ Correcto
```

**Solución aplicada:**
- ✅ Scanner ahora limpia el título con regex antes de guardar:
  ```python
  clean_title = re.sub(r'\s*[\(\[\{]?tmdb[-_]?\d+[\)\]\}]?', '', raw_title, flags=re.IGNORECASE)
  clean_title = re.sub(r'[\s\-_]+$', '', clean_title).strip()
  ```

**Estado:** ✅ Corregido en v4.86

---

### 🔴 Problema 2: Frontend NO Usa `folder_type` Correctamente

**Síntoma:** Las películas siguen requiriendo 2 clics para reproducir.

**Causa root:** En Netflix View, las películas tienen `type: 'video'` (no `'folder'`), por lo que la condición `f.type === 'folder' && f.folder_type === 'movie'` nunca se cumple.

**Análisis del código:**
```javascript
// En Netflix View, las "carpetas" se generan así:
if (isSeries) {
    uniqueShowsMap.set(showKey, {
        type: 'folder',        // ← Series SÍ tienen type='folder'
        folder_type: 'series', // ← Esto existe
        ...
    });
} else {
    // Para películas, usa el objeto f directamente
    uniqueShowsMap.set(showKey, f); // ← f.type = 'video', NO 'folder'
}
```

**Solución aplicada:**
- ✅ Frontend ahora checa solo `f.folder_type === 'movie'` sin importar `f.type`:
  ```javascript
  const isMovieFolder = f.folder_type === 'movie';  // Sin checar f.type
  ```

**Estado:** ✅ Corregido en v4.86

---

### 🔴 Problema 3: Posters de TMDB NO Visibles

**Síntoma:** Los posters descargados por el tagger no aparecen en la UI.

**Causa:** El endpoint `/caratula/` busca thumbnails por el **nombre del archivo** (ej: `Avatar.mkv.jpg`), pero el tagger los guardó como **`tmdb_title.jpg`** (ej: `Avatar.jpg`).

**Flujo problemático:**
```
Tagger guarda: thumbnails/Avatar.jpg
UI busca:    thumbnails/Avatar.mkv.jpg (basado en path del archivo)
Resultado:   NO ENCUENTRA → fallback a FFmpeg
```

**Datos en DB (correctos):**
```
tmdb_poster: "Avatar.jpg" ← Guardado correctamente
```

**Solución aplicada:**
- ✅ Frontend ahora usa `getCoverUrl(f)` que prioriza `tmdb_poster`:
  ```javascript
  function getCoverUrl(f) {
    if (f.type === 'video' && f.tmdb_poster) {
      return `/caratula/${encodeURIComponent(f.tmdb_poster)}`;
    }
    // fallback al sistema anterior
    return `/caratula/${f.path.split('/').map(p => encodeURIComponent(p)).join('/')}`;
  }
  ```

**Estado:** ✅ Corregido en v4.86

---

## 4. Estado Actual de la Base de Datos

### Verificación de datos:
```
Total videos: 936
Con TMDB ID: 934 (99.8%)
Con TMDB Poster: 934 (99.8%)
Con folder_type: 936 (100%)
```

### Ejemplo de registro actual:
```
Path: Video/Peliculas/Veneno para las hadas (1986) - (tmdb-28968)/Veneno.mkv
Title (limpio): "Veneno para las hadas (1986)"
TMDB Title: "Veneno para las hadas"
TMDB Poster: "Veneno para las hadas.jpg"
TMDB ID: 28968
Folder Type: movie
```

---

## 5. Cómo Funciona Ahora (Flujo Completo)

### 5.1 Al Escannear (Scanner)
```
1. Detecta archivo de video
2. Extrae tmdb_id de la ruta completa
3. Detecta folder_type (Temporada/Season = series, else = movie)
4. Limpia título quitando (tmdb-XXXXX)
5. Guarda en DB: tmdb_id, folder_type, title (limpio), etc.
```

### 5.2 Al Usar Auto-Tag (TMDB API)
```
1. Busca videos sin tmdb_title en DB
2. Usa folder_type para saber si /movie/ o /tv/
3. Si hay tmdb_id → consulta directa (100% accuracy)
4. Descarga poster a thumbnails/{tmdb_title}.jpg
5. Guarda: tmdb_title, tmdb_poster, tmdb_genres, tmdb_overview
6. NO modifica el campo 'title' (queda limpio del scanner)
```

### 5.3 En el Frontend (UI)
```
1. Usa getCoverUrl(f) para obtener poster:
   - Si tmdb_poster existe → usa ese
   - Si no → busca por path del archivo (fallback)

2. Para clicks:
   - Si folder_type === 'movie' → 1 click = play
   - Si folder_type === 'series' → 1 click = navegar temporadas

3. Para mostrar título:
   - Usa tmdb_title si existe
   - Si no → usa title (del scanner)
```

---

## 6. Comparativa: Antes vs Después

| Aspecto | Antes (File-Based) | Después (Folder-Based) |
|---------|-------------------|----------------------|
| **Extracción de ID** | Solo del nombre del archivo | De cualquier parte de la ruta ✓ |
| **Búsquedas API** | 1 por archivo (100 para 100 videos) | 1 por serie (1 para 100 episodios) ✓ |
| **Detección movie/series** | Por keywords en ruta | Por folder_type en DB ✓ |
| **Títulos** | Podían incluir (tmdb-XXXXX) | Limpios, sin IDs ✓ |
| **Posters** | Generados con FFmpeg | Descargados de TMDB ✓ |
| **1-click para películas** | No implementado | Funciona con folder_type ✓ |
| **Cache de API** | No | Sí, en memoria ✓ |
| **Consistencia** | Variable | 100% con ID directo ✓ |

---

## 7. Recomendaciones de Naming (Formato Final)

### Películas (con ID en carpeta):
```
Video/Peliculas/(tmdb-28968) Veneno para las hadas (1986)/
└── Veneno para las hadas (1986).mkv

Video/Peliculas/(tmdb-1396) Avatar (2009)/
└── Avatar (2009).mkv
```

### Series (con ID en carpeta de serie):
```
Video/Series/(tmdb-1399) Breaking Bad/
├── Season 1/
│   ├── Breaking Bad - S01E01.mkv
│   └── Breaking Bad - S01E02.mkv
└── Season 2/
    └── Breaking Bad - S02E01.mkv
```

### Episodios (sin ID en archivo):
```
Video/Series/Dragon Ball/Temporada 1/
├── S01E01 - El comienzo.mkv
├── S01E02 - El torneo.mkv
└── S01E03 - El enemigo.mkv
```

**Nota:** El ID solo necesita estar en la carpeta principal. Los episodios dentro heredan el ID automáticamente.

---

## 8. Problemas Resueltos vs Pendientes

### ✅ Resueltos:
1. Extracción de TMDB ID desde cualquier parte de la ruta
2. Detección automática movie vs series
3. Limpieza de títulos (quitar IDs)
4. Uso de folder_type para clicks (1-click play para movies)
5. Visualización de posters de TMDB
6. Cache de API para evitar rate limits
7. NO sobreescribir título del usuario

### ⏳ Pendientes (Fase 2 - Opcional):
1. **Hero View para temporadas:** Banner con info de serie + lista de episodios
2. **Colecciones de películas:** Similar a playlists pero para videos
3. **Video Mixes:** Smart playlists por género/vibe/año
4. **Preview antes de aplicar tagger:** Mostrar qué se descargará antes de ejecutar

---

## 9. Métricas de Rendimiento

| Métrica | Valor Actual |
|---------|--------------|
| **Tiempo para 100 videos con ID** | ~10-30 segundos |
| **Tiempo para 100 videos sin ID** | ~3-5 minutos |
| **Posters descargados** | 934 de 936 videos (99.8%) |
| **Videos con metadata TMDB** | 934 de 936 (99.8%) |
| **Rate limit hits** | 0 (con cache) |

---

## 10. Notas Técnicas Importantes

### 10.1 Location de Posters:
```
D:/Skazo/Music/Kraken Media/thumbnails/
├── A Kite.jpg
├── Dragon Ball.jpg
├── Veneno para las hadas.jpg
└── ... (934 archivos)
```

### 10.2 Campo `folder_type` en DB:
- `movie`: Carpeta con 1 video → 1 click = reproducir
- `series`: Carpeta con temporadas → 1 click = navegar

### 10.3 Estructura de Datos Completa:
```sql
-- Campos relevantes en tabla media:
- rel_path: Ruta relativa del archivo
- folder: Nombre de la carpeta padre
- title: Título limpio (sin ID)
- folder_type: 'movie' o 'series'
- tmdb_id: ID numérico de TMDB
- tmdb_title: Título de TMDB
- tmdb_poster: Nombre del archivo de poster (ej: "Avatar.jpg")
- tmdb_year: Año de estreno
- tmdb_genres: Géneros separados por coma
- tmdb_overview: Sinopsis
```

---

## 11. Próximos Pasos (Si se Desean)

### Opción 1: Hero View para Temporadas
Implementar una vista tipo Netflix al entrar a una temporada:
- Banner grande con poster de la serie
- Título, año, géneros, sinopsis
- Botón "Play Temporada"
- Lista de episodios debajo

### Opción 2: Optimización de Búsquedas
Para videos sin ID:
- Agregar búsqueda fuzzy (tolerar errores tipográficos)
- Sugerir matches múltiples para elegir manualmente

### Opción 3: Metadata Adicional
- Guardar rating de TMDB
- Guardar duración real del video
- Guardar reparto (cast)

---

*Documento actualizado: 2026-03-31*
*Versión del sistema: v4.86*
*Estado: Implementado y funcional*
*Autor: Arsdaemonia Design*
