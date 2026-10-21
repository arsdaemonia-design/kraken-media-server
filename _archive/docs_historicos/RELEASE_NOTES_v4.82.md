# Kraken v4.82 - Release Notes

## Build Artifacts

- `dist/Kraken_Media_Server_Installer_v4.82.exe`
  - Windows installer (Inno Setup 6).

- `dist/Kraken_Windows_EXE_v4.82.zip`
  - Windows compiled package.

- `dist/Kraken_Mac_v4.82.zip`
  - Mac portable/source package.

- `dist/KrakenOffline/KrakenOffline.exe`
  - Offline desktop build.

## Highlights

### Video View Redesign
- **Category selector**: Dropdown -> Pills (horizontal scroll on mobile)
  - Active pill: emerald glow + border
  - Resets genre filter when switching category
- **Genres**: Carousels -> Flat grid + filter chips
  - Single flat grid shows all titles at once
  - Genre chips appear above the grid (only when >1 genre exists)
  - Tap a chip to filter; tap again to clear; **“Todos”** resets
- **Video directories**: Forced list layout
  - When `currentLibrary === 'video'`, the container is forced to `flex flex-col` (ignores grid/list toggle)
  - Season episodes and loose files render with `createEpisodeRow()` (numbered + thumbnail)

### Music
- **Music zoom**: Reverted (original `zoomLevels` restored; music grid untouched)

### Scanning (“Ultra Fast” Delta Scan)
- Smart skip using `mtime` + `size_bytes` to avoid reprocessing unchanged files (O(1) lookups with sets)
- Genre merge protection: preserves manually-edited genres if a new scan returns empty/unknown values

## Version
- `app_offline.py`: 4.82

---

**Last updated:** 2026-03-27
