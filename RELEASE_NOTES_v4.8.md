# Kraken v4.8 - Release Notes

## Build Artifacts

- `Kraken_Windows_v4.8.zip`
  - Portable/source package (run with `.bat` or `installer.bat`).
  - Includes venv, ffmpeg, all dependencies.

- `Kraken_Mac_v4.8.zip`
  - Clean Mac portable/source package.
  - Run `setup.command` to install, then `launcher.command` to start.

- `Kraken_Windows_EXE_v4.8.zip`
  - Compiled package from PyInstaller (`KrakenSwitch.exe`).
  - Includes switch mode: Online / Offline / LAN.

## Main Features in v4.8

### Video Streaming (HLS)
- **HLS Transcoding**: Videos are transcoded on-the-fly for browser compatibility
- **Direct Play**: MP4/WebM with H.264/AAC play directly without transcoding
- **ArtPlayer**: Advanced video player with:
  - Picture-in-Picture
  - Playback speed control (0.5x, 1x, 1.5x, 2x)
  - Screenshot capture
  - Touch gestures for mobile
  - Volume wheel control
  - Screen lock
  - Auto subtitles (.vtt/.srt)
- **Intelligent loading**: Shows buffer progress in real-time

### Native Desktop App (pywebview)
- Flask runs in background thread
- WebView2 (Edge Chromium) for rendering
- Falls back to external browser if WebView2 unavailable

### Offline Support
- All CDN libraries downloaded locally:
  - `assets/hls.min.js`
  - `assets/artplayer.js`
  - `assets/tailwind.min.js`
  - `assets/fontawesome.min.css`
  - `assets/html2canvas.min.js`
- No external dependencies required

### Video Fixes
1. **Error Detection**: No more false positives in Edge/Opera
2. **Fullscreen Scaling**: Small videos scale properly, centered

### Admin Features
1. **Setup Wizard**: First-run setup with email + PIN
2. **Settings Panel**: Change email/PIN from UI (gear icon)

### Downloader (v4.8 Update)
- **Batch URLs**: Multiple URLs separated by comma or newline
- **Speed Control**: Normal / 2x / 4x concurrent downloads (yt-dlp concurrentfragments)
- **100 items per page**: Increased from 20

### Console Integration
- Built-in debug console (green matrix style)
- Shows server logs in real-time
- Located at bottom center of the page
- Max 500 lines, clear/maximize buttons

### Runtime Config (FIX)
- Settings now persist correctly in EXE
- Uses `%APPDATA%\Kraken Media Server\runtime_config.json`
- Syncs with local config.py in portable versions

### Silent Launcher
- `iniciar_kraken.vbs` runs BAT without CMD window

### Build Features
- pywebview integration for desktop app
- Runtime config persistence
- Portable paths using `python -m pip`

## Version
- `app_offline.py`: 4.8

## Distribution Guidance

| Package | Use for |
|---------|---------|
| `Kraken_Windows_v4.8.zip` | Windows portable users |
| `Kraken_Windows_EXE_v4.8.zip` | Windows EXE users |
| `Kraken_Mac_v4.8.zip` | Mac users |

---

**Last updated:** 2026-03-25
