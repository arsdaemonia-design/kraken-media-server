# Kraken v4.84 - Release Notes

## Build Artifacts

- `dist/Kraken_Media_Server_Installer_v4.84.exe`
  - Windows installer (Inno Setup 6).

- `dist/Kraken_Windows_EXE_v4.84.zip`
  - Windows compiled package.

- `dist/Kraken_Mac_v4.84.zip`
  - Mac portable/source package.

- `dist/KrakenOffline/KrakenOffline.exe`
  - Offline desktop build.

---

## Highlights

### Auto-Update System (GitHub)
- New automatic update notification system.
- Kraken checks GitHub Releases on startup.
- Shows purple banner when new version is available.
- "Download" button opens GitHub Releases page.
- Configurable via `GITHUB_REPO` in `config.py`.

### Auto-Tag Video (TMDB)
- New video auto-tagger using TMDB API.
- **Plan A:** Extract TMDB ID directly from filename (e.g., `{tmdb-12345}`, `[tmdb=12345]`).
- **Plan B:** Clean title extraction with regex for pirated content tags.
- Downloads posters automatically to `thumbnails/`.
- Language set to `es-MX` for Latin America compatibility.
- Button located in "Historial" section alongside Last.fm auto-tagger.

### Video Search Fix
- Search inputs moved out of Netflix container (which gets recreated on every render).
- Netflix view now reads from global search inputs (`lib-search-mobile`/`lib-search-desktop`).
- No more losing focus or destroying inputs while typing.
- Search clears when changing categories or going home.

### UI Improvements
- Headers stay visible in video mode.
- Reduced hero banner sizes (from `h-[30vh]` to `h-[16vh]`).
- Toolbar unified in one line with icons only.
- Cleaner Netflix-style view.

---

## Version
- `app_offline.py`: 4.84

---

**Last updated:** 2026-03-29
