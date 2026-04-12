# Kraken Media Server V4

Kraken Media Server es un servidor multimedia autohospedado hecho con Flask (Python) + SPA en JavaScript.
La meta del proyecto es ofrecer una experiencia tipo Spotify/Plex/Netflix para biblioteca personal (musica y video),
con modo online/offline, multiusuario y flujo de instalador para Windows.

## Version Actual

- `v4.90` (2026-04-10)

## Caracteristicas Principales

### Musica
- Escaneo de biblioteca local con indexacion SQLite.
- Metadatos ID3, filtros, playlists, favoritos y mixes inteligentes.
- Reproductor con cola, historial y flujo de seleccion por lotes.
- Letras sincronizadas y visualizador.

### Video
- Vista estilo Netflix con hero dinamico.
- Soporte para peliculas y series por estructura de carpetas.
- Auto-tag via TMDB (poster, titulo enriquecido, overview, generos, rating).
- HLS + DirectPlay inteligente segun compatibilidad del archivo.
- Selector de audio/subtitulos y continuidad de reproduccion (resume playback).

### Usuarios y Seguridad
- Multiusuario con autenticacion JWT.
- Integracion con Cloudflare Access (modo online).
- Superadmin + PIN maestro para acciones sensibles.
- Modo ninos (kid mode) con filtrado por rating.

### Offline / PWA
- `app_offline.py` con service worker.
- Cache local de assets y contenido offline configurable.

## Novedades Relevantes Recientes (v4.88-v4.90)

- Estabilizacion fuerte de UI en `templates/index.html`:
  - Header mobile/desktop unificado y compactado.
  - Correccion de duplicados de botones de seleccion.
  - Correccion de dropdowns de categoria/genero en vista video.
  - Ajustes de pills y layout en vista detalle de serie.
- Mejoras de robustez para Cast:
  - Inicializacion de contexto mas tolerante en frontend.
  - Ajustes de llamada de API de Cast para evitar fallos silenciosos.
- Scanner y estado:
  - Mejoras en ruta de escaneo y reportes de estado/progreso.
  - Refuerzos de cache y endpoints de estado en API.
- Build/Release:
  - Build validado con `KrakenOffline.spec`.
  - Instalador de Inno Setup actualizado (`kraken_installer.iss`).

## Estructura del Proyecto

```text
Kraken Media Server/
|-- app.py
|-- app_offline.py
|-- app_logic.py
|-- config.py
|-- state.py
|-- utils.py
|-- routes/
|   |-- api.py
|   `-- media.py
|-- services/
|   |-- database.py
|   |-- library.py
|   |-- metadata.py
|   |-- hls_transcoder.py
|   `-- video_tagger.py
|-- templates/
|   `-- index.html
|-- assets/
|   |-- js/hero_series.js
|   `-- ...
|-- KrakenOffline.spec
|-- kraken_installer.iss
`-- requirements.txt
```

## Requisitos

- Python `3.10+`
- FFmpeg disponible en sistema (o binarios incluidos para build empaquetado)
- Windows para flujo de instalador Inno Setup

## Ejecutar en Desarrollo

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Modo offline:

```bash
python app_offline.py
```

## Build de Ejecutable (Windows)

Usar el Python del venv:

```bash
venv\Scripts\python -m PyInstaller -y KrakenOffline.spec
```

Salida esperada:

- `dist\KrakenOffline\KrakenOffline.exe`
- `dist\KrakenOffline\_internal\...` (assets, templates, servicios, dlls)

## Generar Instalador (Inno Setup)

Script recomendado:

- `kraken_installer.iss`

Compilar:

```bash
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" kraken_installer.iss
```

Resultado:

- `dist\Kraken_Media_Server_Installer_v4.90.exe`

## Sobre Chromecast / Cast

El soporte Cast en Kraken depende de que el receptor pueda acceder a media URL valida y publica.
Si el servidor esta en entorno local/tunel con restricciones de origen, certificados o rutas privadas,
Cast puede fallar aunque la UI muestre boton disponible.

Recomendacion tecnica:

- Mantener dominio `https` estable.
- Verificar accesibilidad real de URLs de video desde dispositivo Cast.
- Revisar CORS, certificados y rutas no locales para media source.

## Base de Datos

Kraken usa SQLite y migra columnas automaticamente en arranque.
Tablas clave:

- `media`
- `users`
- `playlists`
- `playlist_items`
- `similar_artists`
- `downloads_history`

## Estado del Proyecto

Estado actual: funcional y muy avanzado, en fase de estabilizacion/pulido.

Prioridad sugerida:

1. Correccion de regresiones UI/UX.
2. Observabilidad (logs de Cast/HLS/API).
3. Optimizacion de escaneo y carga percibida.
4. Refactor gradual de `index.html` a modulos.

## Licencia y Uso

Proyecto personal/autohospedado.
Revisar dependencias de terceros (PyInstaller, FFmpeg, TMDB, Last.fm, Cloudflare) para condiciones de uso.
