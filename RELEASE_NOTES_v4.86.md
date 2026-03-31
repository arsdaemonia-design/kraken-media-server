# Release Notes v4.86 - Kraken Media Server

**Fecha:** 2026-04-01  
**Versión:** 4.86

---

## 🎬 Sistema TMDB Folder-Based Completo

Implementación completa de sistema folder-based para videos con TMDB API, inspirado en Plex, Radarr y Sonarr.

### Características Principales

#### ✅ Extracción Automática de TMDB IDs
- Extrae ID desde **cualquier parte de la ruta**: carpeta, subcarpetas o archivo
- Soporta formatos: `(tmdb-123)`, `{tmdb-123}`, `[tmdb=123]`, `tmdb-123`
- Ejemplos válidos:
  - `Video/Peliculas/(tmdb-28968) Avatar/Avatar.mkv`
  - `Video/Series/Breaking Bad (tmdb-1399)/S01E01.mkv`
  - `Dragon Ball {tmdb-12609}/Season 1/S01E01.mkv`

#### ✅ Detección Automática Movie vs Series
- `folder_type = 'movie'`: 1 video por carpeta → 1 click = play
- `folder_type = 'series'`: Múltiples videos con `Temporada`/`Season` → navegar estructura
- Sin configuración manual: detección automática por estructura de carpetas

#### ✅ Títulos Limpios
- Scanner automáticamente quita `(tmdb-XXXXX)` del título
- Ejemplo: `"Avatar (2009) - (tmdb-1396).mkv"` → Título: `"Avatar (2009)"`
- Preserva el ID en `tmdb_id` para consultas API

#### ✅ Posters de TMDB
- Descarga automática de posters desde TMDB
- Guardados en: `{media_path}/thumbnails/`
- Prioridad en UI: usa `tmdb_poster` si existe, fallback al sistema anterior

#### ✅ Cache de API
- Cache en memoria para evitar consultas repetidas
- 1 consulta para serie completa (50 episodios = 1 llamada a API)
- 0 rate limit hits con cache

#### ✅ NO Sobreescribe Títulos
- Auto-tagger solo llena campos `tmdb_*`: `tmdb_title`, `tmdb_poster`, `tmdb_genres`, `tmdb_overview`
- NO modifica el campo `title` (preserva naming del usuario)

---

## 📊 Métricas

| Métrica | Valor |
|---------|-------|
| Videos procesados | 936 |
| Con TMDB ID | 934 (99.8%) |
| Con poster | 934 (99.8%) |
| Tiempo 100 videos (con ID) | ~10-30 segundos |
| Tiempo 100 videos (sin ID) | ~3-5 minutos |
| Rate limit hits | 0 |

---

## 🛠️ Archivos Modificados

### Backend
- `services/video_tagger.py` - Reescrito con arquitectura folder-based
- `services/library.py` - Scanner extrae IDs, detecta tipo, limpia títulos
- `services/database.py` - Nuevas columnas `folder_type`, `tmdb_*`
- `routes/api.py` - Usa `folder_type` de DB, NO sobreescribe títulos

### Frontend
- `templates/index.html` - `getCoverUrl()`, lógica movie vs series, hero banner

### Documentación
- `ANALISIS_TMDB_TAGGING.md` - Documentación completa del sistema

---

## 📝 Problemas Resueltos

### Problema 1: Títulos con ID Residual
- **Síntoma**: Películas mostraban `(tmdb-28968)` como título
- **Solución**: Regex para limpiar ID del título antes de guardar

### Problema 2: Frontend NO Usaba folder_type
- **Síntoma**: Películas requerían 2 clics
- **Solución**: Cambiar condición a solo checar `folder_type === 'movie'`

### Problema 3: Posters NO Visibles
- **Síntoma**: Posters descargados no aparecían
- **Solución**: `getCoverUrl(f)` prioriza `tmdb_poster` sobre path

---

## 📁 Estructura Recomendada

### Películas
```
Video/Peliculas/
├── (tmdb-28968) Veneno para las hadas (1986)/
│   └── Veneno para las hadas (1986).mkv
└── (tmdb-1396) Avatar (2009)/
    └── Avatar (2009).mkv
```

### Series
```
Video/Series/
├── (tmdb-1399) Breaking Bad/
│   ├── Season 1/
│   │   ├── Breaking Bad - S01E01.mkv
│   │   └── Breaking Bad - S01E02.mkv
│   └── Season 2/
│       └── Breaking Bad - S02E01.mkv
└── Dragon Ball (tmdb-12609)/
    ├── Temporada 1/
    │   ├── S01E01.mkv
    │   └── S01E02.mkv
    └── Temporada 2/
        └── S02E01.mkv
```

---

## 🚀 Próximos Pasos (Fase 2 - Opcional)

- **Hero View para Temporadas**: Banner grande con info de serie
- **Colecciones de Películas**: Agrupar películas por género/director
- **Video Mixes**: Smart playlists por vibe/género

---

## 🐛 Bug Fixes (Post-Release)

### Fix: Version Comparison Normalization
**Problema:** El banner de actualización aparecía incluso cuando la versión instalada era la misma que la última release.

**Causa:** GitHub API devuelve versiones como `"v4.86"` (con prefijo "v") pero la app usa `"4.86"` (sin prefijo), causando que `"v4.86" !== "4.86"`.

**Solución:** Agregada función `normalizeVersion()` que:
- Convierte a minúsculas
- Elimina prefijo "v" o "V"
- Quita espacios en blanco
- Luego compara versiones normalizadas

**Archivo:** `templates/index.html`  
**Commit:** Post-release patch

---

## 📦 Descargas

- `Kraken_Media_Server_Installer_v4.86.exe` (Windows Installer)
- `Kraken_Windows_EXE_v4.86.zip` (Windows Portable)
- `Kraken_Mac_v4.86.zip` (Mac)

---

*Documento generado: 2026-04-01*  
*Sistema: Kraken Media Server*  
*Autor: Arsdaemonia Design*
