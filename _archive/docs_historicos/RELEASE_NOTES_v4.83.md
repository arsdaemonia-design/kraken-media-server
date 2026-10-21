# Kraken v4.83 - Release Notes

## Build Artifacts

- `dist/Kraken_Media_Server_Installer_v4.83.exe`
  - Windows installer (Inno Setup 6).

- `dist/Kraken_Windows_EXE_v4.83.zip`
  - Windows compiled package.

- `dist/Kraken_Mac_v4.83.zip`
  - Mac portable/source package.

- `dist/KrakenOffline/KrakenOffline.exe`
  - Offline desktop build.

## Highlights

### Video Search UX/Performance
- Search now uses persistent global inputs (no inline search input recreation in Netflix/season views).
- Root Netflix view now uses `isRoot && !isSearching` to avoid view thrashing while typing.
- Added global `Todo` category pill for cross-category video browsing/search.
- Video search enriches `searchKey` with path/category/show/season tokens.
- Root video search prioritizes entities (series/movies) over rendering all episodes.
- Added in-memory entity search cache and increased debounce for smoother typing.

### Video Navigation/Consistency
- Removed duplicated inline season search toolbar input.
- Kept category and season navigation aligned with current global search model.

## Version
- `app_offline.py`: 4.83

---

**Last updated:** 2026-03-29
