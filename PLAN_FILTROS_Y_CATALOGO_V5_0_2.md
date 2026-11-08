# 🐙 Plan Maestro de Implementación: Catálogo Inteligente, Colecciones/Sagas, Filtros Multicriterio y Motor de Similitud (`v5.0.2`)

> **Instrucciones para el Modelo Ejecutor (Gemini):**
> Este documento contiene la especificación técnica exacta, rutas de archivos, números de línea y bloques de código listos para integrar en **Kraken Media Server (`Kraken Media Server - modulE`)** y **KrakenTV (`KrakenTV`)**.
> - **NO rompas ni elimines funcionalidades existentes** (Modo Niños, Adult Vault, Seguir Viendo HLS, Cine Remote, Búsqueda en vivo).
> - Ejecuta los cambios en orden (Fase 1 → Fase 6) y verifica la sintaxis de Python (`py_compile`), JavaScript y Kotlin (`assembleDebug`) al terminar.

---

## 📋 Resumen de Archivos a Modificar

1. **Base de Datos y Backend Python (`e:\Kraken Media Server\Kraken Media Server - modulE`)**:
   - [`services/database.py`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/services/database.py): Migración segura (`ALTER TABLE`) de nuevas columnas TMDb en `media` y `video_metadata`.
   - [`services/video_tagger.py`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/services/video_tagger.py): Extraer `belongs_to_collection`, `directors`, `cast`, `studio`, `keywords`, `vote_average` y `origin_country` en la misma llamada HTTP a TMDb.
   - [`services/library.py`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/services/library.py): Incluir las nuevas columnas y metadatos técnicos (`video_resolution`, `audio_tracks`, `subtitle_tracks`) en [`generar_biblioteca_viva()`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/services/library.py#L512-L685).
   - [`routes/api.py`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/routes/api.py):
     - Guardar las nuevas columnas en [`auto_tag_video_endpoint()`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/routes/api.py#L2815-L2920), [`auto_tag_library_videos()`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/routes/api.py#L2922-L3228) y [`update_video_ratings()`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/routes/api.py#L3230-L3315).
     - Enriquecer `/api/tmdb/details` ([`tmdb_extended_details()`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/routes/api.py#L4523-L4600)) con `collection`, `studios` y `keywords`.
     - Crear endpoint `/api/enrich_video_metadata` (POST) para rellenar en segundo plano los videos que **ya tienen `tmdb_id`**, agrupando por `tmdb_id` único (para no consultar 100 veces los 100 episodios de una misma serie).
2. **Frontend Web / Desktop (`e:\Kraken Media Server\Kraken Media Server - modulE\assets\js`)**:
   - [`assets/js/video-catalog.js`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/assets/js/video-catalog.js):
     - Barra de filtros multicriterio: **Categoría**, **Género**, **Sub-temática contextual (Keywords)**, **Década**, **Duración**, **Calidad/Audio**, **Ordenamiento** y **Toggle "📚 Agrupar Sagas / Colecciones"**.
     - Agrupador automático de Sagas/Colecciones (`tmdb_collection_name` + fallback heurístico por prefijo de título cuando hay $\ge 2$ películas).
     - Motor local de similitud (`computeVideoSimilarityScore(refItem, candidateItem)`) y nuevos carruseles inteligentes en portada.
     - Ampliar [`buildVideoRootSearchEntities()`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/assets/js/video-catalog.js#L502-L545) para buscar por **Director, Actor, Estudio, Saga y Keywords**.
   - [`assets/js/hero_series.js`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/assets/js/hero_series.js):
     - Hacer clickeables los nombres de **Directores/Creadores**, **Estudios** y tarjetas de **Actores (Reparto)** para filtrar el catálogo con un chip activo (`filterVideoCatalogByPerson(role, name)`).
     - Añadir sección **"Más títulos similares en tu biblioteca"** dentro del modal/vista de detalle (`openHeroInfoModal`).
     - Añadir soporte para abrir una **Colección / Saga** mostrando sus películas ordenadas cronológicamente por año y botón **"🎬 Maratón de Saga"**.
3. **Android TV (`e:\Kraken Media Server\KrakenTV` y `routes/tv_api.py`)**:
   - [`routes/tv_api.py`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/routes/tv_api.py): Exponer `collections`, `director`, `cast`, `studio`, `keywords`, `vote_average`, `resolution` en `/api/tv/library` y permitir búsqueda por director/actor/colección en `/api/tv/search`.
   - [`NativeTvHomeView.kt`](file:///e:/Kraken%20Media%20Server/KrakenTV/app/src/main/java/com/kraken/tv/NativeTvHomeView.kt) y [`KrakenApi.kt`](file:///e:/Kraken%20Media%20Server/KrakenTV/app/src/main/java/com/kraken/tv/KrakenApi.kt): Añadir filtro de **Colecciones / Sagas**, **Mejor Calificadas** y **Décadas** en el menú lateral y píldoras superiores.

---

## 🛠️ FASE 1: Migración de Base de Datos (`services/database.py`)

En [`services/database.py`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/services/database.py) (alrededor de la línea 250, justo después de `ALTER TABLE media ADD COLUMN is_hidden BOOLEAN DEFAULT 0`):

1. Agregar las siguientes columnas a la tabla `media` y `video_metadata` usando bloques `try / except sqlite3.OperationalError`:

```python
    # Columnas extendidas TMDB v5.0.2 (Colecciones, Director, Reparto, Estudio, Keywords, Score, País)
    extended_tmdb_cols = [
        ("tmdb_collection_id", "INTEGER DEFAULT NULL"),
        ("tmdb_collection_name", "TEXT DEFAULT NULL"),
        ("tmdb_collection_poster", "TEXT DEFAULT NULL"),
        ("tmdb_director", "TEXT DEFAULT NULL"),
        ("tmdb_cast", "TEXT DEFAULT NULL"),
        ("tmdb_studio", "TEXT DEFAULT NULL"),
        ("tmdb_keywords", "TEXT DEFAULT NULL"),
        ("tmdb_vote_average", "REAL DEFAULT 0.0"),
        ("tmdb_country", "TEXT DEFAULT NULL"),
        ("tmdb_backdrop", "TEXT DEFAULT NULL"),
    ]
    for col_name, col_type in extended_tmdb_cols:
        try:
            c.execute(f"ALTER TABLE media ADD COLUMN {col_name} {col_type}")
        except sqlite3.OperationalError:
            pass
        try:
            c.execute(f"ALTER TABLE video_metadata ADD COLUMN {col_name} {col_type}")
        except sqlite3.OperationalError:
            pass
```

---

## 🛠️ FASE 2: Extractor Extendido de TMDb (`services/video_tagger.py`)

En [`services/video_tagger.py`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/services/video_tagger.py):

### 2.1. Actualizar `get_movie_details` (líneas 60–84) y `get_tv_details` (líneas 86–112)
Cambiar `'append_to_response': 'credits,release_dates'` y `'append_to_response': 'credits,content_ratings'` para incluir `,keywords`:
- En `get_movie_details(movie_id)`:
  ```python
  params = {
      'api_key': TMDB_API_KEY,
      'language': 'es-MX',
      'append_to_response': 'credits,release_dates,keywords'
  }
  ```
- En `get_tv_details(tv_id)`:
  ```python
  params = {
      'api_key': TMDB_API_KEY,
      'language': 'es-MX',
      'append_to_response': 'credits,content_ratings,keywords'
  }
  ```

### 2.2. Crear helper `extract_extended_tmdb_fields(details, media_type='movie')` en `services/video_tagger.py`
Añadir esta función auxiliar para normalizar todos los campos nuevos tanto para películas como para series:

```python
def extract_extended_tmdb_fields(details: dict, media_type: str = 'movie') -> dict:
    """Extrae colección, directores, reparto principal, estudio, keywords, score y país de un payload TMDB."""
    if not details or not isinstance(details, dict):
        return {}

    # 1. Colección / Saga (solo películas)
    coll = details.get('belongs_to_collection') or {}
    collection_id = coll.get('id') if isinstance(coll, dict) else None
    collection_name = (coll.get('name') or '').strip() if isinstance(coll, dict) else None
    if collection_name:
        # Limpiar sufijos redundantes como " - Colección" para que se vea limpio en UI
        collection_name = re.sub(r'\s*[-–—]\s*Colecci[oó]n$', '', collection_name, flags=re.IGNORECASE).strip()
    collection_poster = coll.get('poster_path') if isinstance(coll, dict) else None

    # 2. Directores / Creadores
    credits = details.get('credits') or {}
    crew = credits.get('crew') or []
    directors = [c.get('name', '').strip() for c in crew if c.get('job') in ('Director', 'Series Director') and c.get('name')]
    if media_type == 'tv' or not directors:
        creators = [c.get('name', '').strip() for c in (details.get('created_by') or []) if c.get('name')]
        directors = list(dict.fromkeys(directors + creators))
    directors_str = ', '.join(directors[:3]) if directors else None

    # 3. Actores principales (Top 8)
    cast_raw = credits.get('cast') or []
    cast_names = [c.get('name', '').strip() for c in cast_raw[:8] if c.get('name')]
    cast_str = ', '.join(cast_names) if cast_names else None

    # 4. Estudio / Productora / Cadena (Top 2)
    studios = []
    if media_type == 'tv':
        studios = [n.get('name', '').strip() for n in (details.get('networks') or []) if n.get('name')]
    if not studios:
        studios = [p.get('name', '').strip() for p in (details.get('production_companies') or []) if p.get('name')]
    studio_str = ', '.join(studios[:2]) if studios else None

    # 5. Keywords / Sub-temáticas
    kw_Obj = details.get('keywords') or {}
    kw_list = kw_Obj.get('keywords') or kw_Obj.get('results') or []
    keywords = [k.get('name', '').strip() for k in kw_list[:15] if isinstance(k, dict) and k.get('name')]
    keywords_str = ', '.join(keywords) if keywords else None

    # 6. Calificación y País/Idioma
    vote_avg = round(float(details.get('vote_average') or 0.0), 1)
    countries = details.get('origin_country') or [
        c.get('iso_3166_1') for c in (details.get('production_countries') or []) if c.get('iso_3166_1')
    ]
    country_str = ','.join([str(c) for c in countries[:2] if c]) or (details.get('original_language') or '').upper()
    backdrop_path = details.get('backdrop_path')

    return {
        'tmdb_collection_id': collection_id,
        'tmdb_collection_name': collection_name or None,
        'tmdb_collection_poster': collection_poster,
        'tmdb_director': directors_str,
        'tmdb_cast': cast_str,
        'tmdb_studio': studio_str,
        'tmdb_keywords': keywords_str,
        'tmdb_vote_average': vote_avg,
        'tmdb_country': country_str or None,
        'tmdb_backdrop': backdrop_path,
    }
```

---

## 🛠️ FASE 3: Exposición en Biblioteca y Endpoints (`services/library.py` y `routes/api.py`)

### 3.1. Actualizar `generar_biblioteca_viva()` en [`services/library.py`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/services/library.py#L518-L635)
1. En el `SELECT` de la línea 519, añadir las columnas técnicas y extendidas:
   ```sql
   SELECT id, rel_path, filename, folder, full_folder, media_type,
          title, artist, album, genre, duration_sec, size_bytes, date_added,
          rating, play_count, last_played, language, folder_type, tmdb_id,
          tmdb_title, tmdb_year, tmdb_overview, tmdb_genres, tmdb_poster, tmdb_rating, is_adult, is_hidden,
          bpm, energy,
          video_resolution, video_codec, audio_codec, audio_channels, audio_tracks, subtitle_tracks,
          tmdb_collection_id, tmdb_collection_name, tmdb_collection_poster,
          tmdb_director, tmdb_cast, tmdb_studio, tmdb_keywords, tmdb_vote_average, tmdb_country, tmdb_backdrop
   FROM media
   ORDER BY folder, title
   ```
2. Además, antes de cerrar `conn`, consultar el progreso del usuario (`user_progress`) para enriquecer cada video con su estado (`is_watched`, `in_progress`) y permitir filtrar por **"Sin ver" / "En progreso" / "Vistas"**:
   ```python
   progress_map = {}
   try:
       c.execute("SELECT media_id, progress_seconds, duration_seconds, is_finished FROM user_progress")
       for pr in c.fetchall():
           progress_map[pr['media_id']] = pr
   except Exception:
       pass
   ```
3. En el bloque `if is_video:` (línea 622), adjuntar los nuevos campos al diccionario `f`:
   ```python
   if is_video:
       f['folder_type'] = row['folder_type']
       for col in (
           'tmdb_id', 'tmdb_title', 'tmdb_year', 'tmdb_overview', 'tmdb_genres',
           'tmdb_poster', 'tmdb_rating', 'is_adult', 'video_resolution', 'video_codec',
           'audio_codec', 'audio_channels', 'audio_tracks', 'subtitle_tracks',
           'tmdb_collection_id', 'tmdb_collection_name', 'tmdb_collection_poster',
           'tmdb_director', 'tmdb_cast', 'tmdb_studio', 'tmdb_keywords',
           'tmdb_vote_average', 'tmdb_country', 'tmdb_backdrop'
       ):
           if row[col] is not None and row[col] != '':
               f[col] = row[col]
       prog = progress_map.get(row['id'])
       if prog:
           f['progress_seconds'] = prog['progress_seconds'] or 0
           f['is_finished'] = bool(prog['is_finished'])
   ```

### 3.2. Guardar los campos extendidos en [`routes/api.py`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/routes/api.py)
1. En [`auto_tag_video_endpoint()`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/routes/api.py#L2882-L2905) y [`auto_tag_library_videos()`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/routes/api.py#L3108-L3130):
   - Llamar a `ext = extract_extended_tmdb_fields(result, result.get('media_type', video_folder_type))`
   - Si la película pertenece a una colección y tiene `ext['tmdb_collection_poster']`, descargar también el póster de la colección a `config.THUMBNAILS_FOLDER` con nombre `collection_{collection_id}.jpg` (si no existe aún) y guardar ese nombre en `tmdb_collection_poster`.
   - Actualizar el `UPDATE media SET ...` para guardar todas las columnas de `ext`.
2. Crear el endpoint **`POST /api/enrich_video_metadata`** en [`routes/api.py`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/routes/api.py) (junto a `update_video_ratings` en la línea 3315):
   - Recibe `pin` (o usa `require_admin`).
   - Busca todos los ` DISTINCT tmdb_id, folder_type` en `media` donde `media_type = 'video' AND tmdb_id > 0 AND (tmdb_director IS NULL OR tmdb_vote_average IS NULL OR tmdb_vote_average = 0)`.
   - Como agrupa por `tmdb_id` único, si una serie tiene 120 episodios con el mismo `tmdb_id`, **solo hace 1 petición a TMDb** y ejecuta `UPDATE media SET ... WHERE tmdb_id = ?`.
   - Limpia `BIB_CACHE_BY_OWNER.clear()` al finalizar y devuelve cuántos títulos y archivos fueron enriquecidos.
   - **Auto-enriquecimiento silencioso al arranque**: Si al iniciar el servidor se detectan videos con `tmdb_id > 0` pero `tmdb_director IS NULL`, lanzar un hilo daemon ligero (con `time.sleep(0.15)` entre llamadas por `tmdb_id` único) para que toda la biblioteca existente del usuario quede enriquecida automáticamente sin que tenga que re-escanear desde cero.

---

## 🛠️ FASE 4: Rediseño de Filtros, Sub-Temáticas, Sagas y Similitud en [`assets/js/video-catalog.js`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/assets/js/video-catalog.js)

### 4.1. Nuevas Variables Globales de Estado de Filtro (en `window`)
Al inicio de [`setupNetflixRootFilters()`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/assets/js/video-catalog.js#L131), declarar y mantener el estado de filtrado:
```javascript
window.netflixActiveCategory = window.netflixActiveCategory || 'Todo';
window.netflixActiveGenre = window.netflixActiveGenre || 'Todos';
window.netflixActiveSubtheme = window.netflixActiveSubtheme || 'Todos';
window.netflixActiveDecade = window.netflixActiveDecade || 'Todas';
window.netflixActiveDuration = window.netflixActiveDuration || 'Todas';
window.netflixActiveTech = window.netflixActiveTech || 'Todos'; // '4K', 'Español', 'SinVer', 'TopRated'
window.netflixSortBy = window.netflixSortBy || 'recent'; // 'recent', 'rating_desc', 'year_desc', 'year_asc', 'title_asc', 'duration_asc'
window.netflixGroupCollections = window.netflixGroupCollections !== undefined ? window.netflixGroupCollections : true;
window.netflixActivePersonFilter = window.netflixActivePersonFilter || null; // { role: 'director'|'actor'|'studio'|'collection', name: '...' }
```

### 4.2. Diccionario de Sub-Temáticas Inteligentes (Solución para Géneros Grandes como Terror / Sci-Fi / Acción)
Crear un mapa en `video-catalog.js` que agrupe tanto `tmdb_keywords` como palabras clave de `tmdb_overview`/`title` + sub-géneros:

```javascript
const GENRE_SUBTHEMES_MAP = {
    'Terror': [
        { id: 'sobrenatural', label: '👻 Sobrenatural y Posesiones', terms: ['supernatural', 'demon', 'possession', 'exorcism', 'ghost', 'haunted', 'spirit', 'paranormal', 'curse', 'witch', 'bruja', 'exorcismo', 'demonio', 'fantasma', 'espíritu', 'maldición', 'conjuro'] },
        { id: 'slasher', label: '🔪 Slasher y Asesinos', terms: ['slasher', 'serial killer', 'murder', 'psychopath', 'masked killer', 'stalker', 'asesino', 'masacre', 'psicópata', 'cuchillo'] },
        { id: 'zombis', label: '🧟 Zombis e Infección', terms: ['zombie', 'undead', 'infection', 'virus', 'apocalypse', 'epidemic', 'cannibal', 'zombi', 'infectado', 'epidemia', 'caníbal'] },
        { id: 'psicologico', label: '🧠 Terror Psicológico', terms: ['psychological', 'paranoia', 'madness', 'hallucination', 'cult', 'nightmare', 'secta', 'locura', 'psicológico', 'pesadilla', 'suspenso'] },
        { id: 'monstruos', label: '👹 Monstruos y Criaturas', terms: ['monster', 'creature', 'vampire', 'werewolf', 'alien', 'beast', 'mutant', 'vampiro', 'hombre lobo', 'criatura', 'monstruo', 'bestia'] },
        { id: 'supervivencia', label: '🩸 Gore y Supervivencia', terms: ['gore', 'survival', 'torture', 'trap', 'cabin', 'woods', 'isolation', 'supervivencia', 'trampa', 'sangre', 'cabaña'] }
    ],
    'Ciencia ficción': [
        { id: 'espacio', label: '🚀 Espacio y Aliens', terms: ['space', 'alien', 'planet', 'galaxy', 'astronaut', 'spaceship', 'extraterrestrial', 'espacio', 'planeta', 'galaxia', 'nave', 'extraterrestre'] },
        { id: 'tiempo', label: '⏳ Viajes en el Tiempo', terms: ['time travel', 'time loop', 'future', 'paradox', 'multiverse', 'tiempo', 'futuro', 'multiverso', 'paradoja'] },
        { id: 'cyberpunk', label: '🤖 Cyberpunk, Robots e IA', terms: ['cyberpunk', 'artificial intelligence', 'robot', 'android', 'cyborg', 'virtual reality', 'hacker', 'inteligencia artificial', 'androide'] },
        { id: 'postapoc', label: '🌍 Distopía y Post-Apocalipsis', terms: ['dystopia', 'post-apocalyptic', 'apocalypse', 'survival', 'wasteland', 'distopía', 'apocalipsis', 'futuro sombrío'] }
    ],
    'Acción': [
        { id: 'artes_marciales', label: '🥋 Artes Marciales y Peleas', terms: ['martial arts', 'kung fu', 'ninja', 'samurai', 'fight', 'boxing', 'tournament', 'artes marciales', 'pelea', 'combate', 'samurái'] },
        { id: 'espionaje', label: '🕵️ Espionaje y Agentes', terms: ['spy', 'secret agent', 'cia', 'assassin', 'hitman', 'mercenary', 'espía', 'agente', 'sicario', 'mercenario'] },
        { id: 'superheroes', label: '🦸 Superhéroes y Cómics', terms: ['superhero', 'marvel', 'dc', 'comic', 'superpower', 'vigilante', 'superhéroe', 'poderes', 'villano'] },
        { id: 'crimen_autos', label: '🏎️ Persecuciones y Atracos', terms: ['heist', 'car chase', 'racing', 'bank robbery', 'cartel', 'mafia', 'venganza', 'revenge', 'atraco', 'robo', 'carreras'] }
    ],
    'Animación': [
        { id: 'anime_shonen', label: '⚔️ Anime / Acción y Fantasía', terms: ['anime', 'manga', 'shonen', 'demon', 'magic', 'ninja', 'mecha', 'japonés'] },
        { id: 'familiar', label: '🧸 Familiar y Aventura', terms: ['family', 'pixar', 'disney', 'dreamworks', 'talking animal', 'friendship', 'aventura', 'familia'] },
        { id: 'adult_anim', label: '🌙 Animación para Adultos', terms: ['adult animation', 'satire', 'dark comedy', 'cyberpunk', 'gore'] }
    ],
    'Comedia': [
        { id: 'romantica', label: '💘 Comedia Romántica', terms: ['romantic comedy', 'romance', 'love', 'wedding', 'dating', 'amor', 'boda', 'pareja'] },
        { id: 'humor_negro', label: '💀 Humor Negro y Sátira', terms: ['dark comedy', 'black comedy', 'satire', 'parody', 'spoof', 'parodia', 'sátira', 'absurdo'] },
        { id: 'familiar_com', label: '🍿 Familiar y Amigos', terms: ['buddy', 'school', 'teen', 'party', 'vacation', 'amigos', 'fiesta', 'vacaciones', 'escuela'] }
    ]
};
```
- Cuando `window.netflixActiveGenre` tenga sub-temas definidos en `GENRE_SUBTHEMES_MAP` (y existan videos en la biblioteca que coincidan con cada sub-tema), renderizar debajo de los selectores una fila horizontal de píldoras rápidas (`Todos`, `👻 Sobrenatural (14)`, `🔪 Slasher (8)`, etc.).

### 4.3. Agrupación Automática de Sagas / Colecciones (`groupMoviesIntoCollections`)
En [`buildNetflixRootCatalog()`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/assets/js/video-catalog.js#L547-L680):
1. Después de obtener `rootLooseVideos` (películas individuales), si `window.netflixGroupCollections === true` (o si el usuario selecciona la categoría/filtro `📚 Colecciones`):
   - Agrupar las películas que tengan el mismo `tmdb_collection_id` o `tmdb_collection_name`.
   - **Fallback heurístico inteligente** para películas sin `tmdb_collection_name`: extraer el título base antes de `:`, `-`, `Parte`, `Part`, `Vol`, o números finales (`1, 2, 3, II, III, IV`). Si **2 o más películas** comparten exactamente ese prefijo normalizado (y tienen más de 4 caracteres), agruparlas en una colección virtual.
   - Si un grupo tiene **$\ge 2$ películas**:
     - Ordenar sus películas internamente por `tmdb_year` ascendente (orden cronológico de estreno).
     - Crear un objeto de catálogo tipo Colección:
       ```javascript
       {
           type: 'collection',
           isCollection: true,
           name: collectionName,
           collectionId: collectionId,
           items: sortedMovies, // Array de películas de la saga
           count: sortedMovies.length,
           sample: sortedMovies[0],
           poster: collectionPoster || sortedMovies[0].tmdb_poster || sortedMovies[0].path,
           genres: mergedGenres,
           yearRange: `${firstYear} - ${lastYear}`,
           vote_average: avgScore
       }
       ```
     - Renderizar la tarjeta en el grid con un badge distintivo arriba a la izquierda:
       `<span class="px-2 py-0.5 rounded-md bg-amber-500/90 text-black font-black text-[9px] uppercase tracking-wider shadow">📚 Saga · ${item.count} Películas</span>`
     - Al hacer clic en la tarjeta de Colección, llamar a `openCollectionModal(collectionKey)` (en `hero_series.js`).

### 4.4. Barra de Filtros Multicriterio en `setupNetflixRootFilters()`
Actualizar [`setupNetflixRootFilters()`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/assets/js/video-catalog.js#L131-L214) para incluir:
1. **Categoría**: `Todo`, `📚 Colecciones / Sagas`, `Películas`, `Series`, etc.
2. **Género**: `Todos los géneros`, `Terror`, `Ciencia ficción`, `Acción`, etc.
3. **Década / Año**: `Todas las épocas`, `2020s`, `2010s`, `2000s`, `1990s`, `1980s y Clásicos`.
4. **Duración**: `Cualquier duración`, `⚡ Cortas (< 95 min)`, `🍿 Estándar (95 - 130 min)`, `🎭 Épicas (> 130 min)`.
5. **Filtro Rápido / Calidad**: `Todos`, `✨ 4K UHD`, `🇲🇽 Audio Español / Dual`, `🆕 Sin ver`, `⭐ Mejor Calificadas (7.5+)`.
6. **Ordenar por**: `Recién agregadas`, `⭐ Mejor calificación`, `📅 Año (más recientes)`, `📅 Año (clásicas primero)`, `🔤 Título (A-Z)`, `⏱️ Duración (más cortas)`.
7. **Botón Toggle `📚 Agrupar Sagas`**: Activo/Inactivo con resaltado esmeralda/ámbar.
8. **Chip de Persona/Estudio Activo**: Si `window.netflixActivePersonFilter` está activo (ej. `{ role: 'Director', name: 'Guillermo del Toro' }`), mostrar un chip destacado con botón `[✕ Quitar filtro]`.

### 4.5. Motor Local de Similitud (`window.getSimilarLibraryItems(refItem, limit = 12)`)
Añadir en [`assets/js/video-catalog.js`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/assets/js/video-catalog.js) una función pública que calcule los títulos más parecidos dentro de `libData.files`:
- **Pesos del algoritmo**:
  - Misma colección (`tmdb_collection_id` o `tmdb_collection_name`): `+85 pts`
  - Mismo director/creador (`tmdb_director` intersección): `+45 pts`
  - Keywords / Sub-temáticas en común (`tmdb_keywords` intersección): `+20 pts` por cada keyword común (máx `+60 pts`)
  - Actores en común (`tmdb_cast` intersección): `+18 pts` por cada actor en común (máx `+54 pts`)
  - Géneros en común (`tmdb_genres` intersección): `+15 pts` por género común (más `+15 pts` extra si coinciden los 2 géneros principales)
  - Mismo estudio/productora (`tmdb_studio`): `+18 pts`
  - Misma década (`Math.abs(year1 - year2) <= 8`): `+10 pts`
  - Mismo formato (`movie` vs `series`): `+8 pts`
- Devuelve los `limit` ítems con mayor puntaje (`score >= 18`).

---

## 🛠️ FASE 5: Vista de Colecciones, Reparto Clickeable y "Similares" en [`assets/js/hero_series.js`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/assets/js/hero_series.js)

### 5.1. Directores, Estudios y Actores Clickeables
1. En [`renderSeriesHero()`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/assets/js/hero_series.js#L67-L70) y [`openHeroInfoModal()`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/assets/js/hero_series.js#L318-L371):
   - Convertir cada nombre de director en un botón/píldora clickeable:
     ```html
     <button onclick="event.stopPropagation(); filterCatalogByPerson('Director', '${escapeStr(d)}')" class="text-emerald-400 hover:underline font-semibold">${escapeHtml(d)}</button>
     ```
   - Convertir cada tarjeta de actor en `buildCastCarousel()` y `buildFullCastGrid()` en clickeable:
     ```html
     onclick="event.stopPropagation(); filterCatalogByPerson('Actor', '${escapeStr(c.name)}')"
     ```
2. Definir `window.filterCatalogByPerson = function(role, name)`:
   - Cierra cualquier modal abierto (`closeHeroInfoModal()`, `closeInlineVideoInfo()`).
   - Asigna `window.netflixActivePersonFilter = { role, name }`.
   - Llama a `renderLib()` y hace scroll suave al inicio del catálogo mostrando todas las películas y series donde participa esa persona.

### 5.2. Fila de "Más títulos similares" en `openHeroInfoModal()`
Al final de `contentHtml` en [`openHeroInfoModal()`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/assets/js/hero_series.js#L366-L370):
- Llamar a `const similars = window.getSimilarLibraryItems ? window.getSimilarLibraryItems(heroItem, 10) : [];`
- Renderizar un carrusel/grid de tarjetas compactas con póster, año, calificación y razón de similitud (ej. *"Mismo director"*, *"Saga"*, *"Terror · Sobrenatural"*), que al hacer clic abran o reproduzcan ese título.

### 5.3. Modal / Vista de Colección (`window.openCollectionModal(collectionKey)`)
Añadir en [`assets/js/hero_series.js`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/assets/js/hero_series.js):
- Muestra el banner Hero de la saga (usando el backdrop de la primera película), el título de la colección, rango de años, calificación promedio y un botón **"🎬 Reproducir Maratón en Orden"** (que mete todas las películas de la saga en `playerQueue` ordenadas por año y lanza `playVideoMode(playerQueue[0])`).
- Debajo muestra las tarjetas numeradas (`#1`, `#2`, `#3`...) de cada película de la colección con su año, duración, sinopsis corta, progreso de visualización y botón de reproducir individual.

---

## 🛠️ FASE 6: Búsqueda Omnicanal y Sincronización con Android TV (`KrakenTV`)

### 6.1. Buscador Web (`assets/js/video-catalog.js` línea 502)
En [`buildVideoRootSearchEntities()`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/assets/js/video-catalog.js#L502-L545):
- Añadir al string `searchText` de cada película y serie los campos:
  `item.tmdb_director`, `item.tmdb_cast`, `item.tmdb_studio`, `item.tmdb_collection_name`, `item.tmdb_keywords`, `item.tmdb_year`, `item.video_resolution`.
- Así, buscar `"Nolan"`, `"DiCaprio"`, `"A24"`, `"Conjuro"`, `"Slasher"` o `"4K"` en el buscador superior devolverá coincidencias instantáneas ignorando acentos.

### 6.2. Backend y App Nativa de Android TV (`routes/tv_api.py` y `KrakenTV`)
1. En [`routes/tv_api.py`](file:///e:/Kraken%20Media%20Server/Kraken%20Media%20Server%20-%20modulE/routes/tv_api.py):
   - En `tv_library_page()` (línea 134), añadir al `SELECT`:
     `tmdb_collection_id, tmdb_collection_name, tmdb_collection_poster, tmdb_director, tmdb_cast, tmdb_studio, tmdb_keywords, tmdb_vote_average, video_resolution`
   - Si el parámetro `group_collections=1` (o `category=Colecciones`) viene en el request, agrupar las películas con `tmdb_collection_name` (con $\ge 2$ películas) en un ítem `kind: "collection"` o exponer `collection_name` en cada ítem.
   - En `/api/tv/search`, buscar también dentro de `tmdb_director`, `tmdb_cast`, `tmdb_collection_name` y `tmdb_keywords` usando `_norm_search_text()`.
   - En `/api/tv/series` (o nuevo endpoint `/api/tv/similar/<int:media_id>`), devolver hasta 10 ítems similares de la biblioteca para mostrarlos en `SeriesDetailActivity.kt`.
2. En [`KrakenApi.kt`](file:///e:/Kraken%20Media%20Server/KrakenTV/app/src/main/java/com/kraken/tv/KrakenApi.kt) y [`NativeTvHomeView.kt`](file:///e:/Kraken%20Media%20Server/KrakenTV/app/src/main/java/com/kraken/tv/NativeTvHomeView.kt):
   - Agregar las píldoras/categorías **"📚 Colecciones"** y **"⭐ Mejor Calificadas"** en el menú lateral y barra superior de la TV.

---

## ✅ Checklist de Verificación para Auditoría Posterior

Cuando el modelo ejecutor termine, se auditarán estos 6 puntos:
1. [ ] `python -m py_compile services/database.py services/video_tagger.py services/library.py routes/api.py routes/tv_api.py` pasa sin errores.
2. [ ] La tabla `media` crea automáticamente las columnas `tmdb_collection_name`, `tmdb_director`, `tmdb_cast`, `tmdb_studio`, `tmdb_keywords`, `tmdb_vote_average` sin borrar datos existentes.
3. [ ] El hilo de enriquecimiento automático agrupa por `tmdb_id` único y rellena directores, reparto, colecciones y keywords de la biblioteca actual.
4. [ ] En Web, al elegir un género como **Terror**, aparecen las píldoras de sub-temáticas (*Sobrenatural, Slasher, Zombis, Psicológico, Monstruos*) y funcionan combinadas con Década, Duración, Calidad y Ordenamiento.
5. [ ] El switch **"📚 Agrupar Sagas"** agrupa franquicias en tarjetas de colección y permite abrirlas y reproducirlas en maratón, y hacer clic en un Director o Actor filtra el catálogo.
6. [ ] El modal de información muestra el carrusel de **"Más títulos similares en tu biblioteca"** y `KrakenTV` compila (`gradlew assembleDebug`) sin errores.
