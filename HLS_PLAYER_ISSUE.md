# 🎬 Kraken Media Server - HLS Player Duration Issue

## Context
Kraken is a self-hosted media server built with Flask (Python) backend + Vanilla JS frontend. Video playback uses **ArtPlayer** (HTML5 player) with **HLS.js** for adaptive streaming via FFmpeg transcoding.

## Architecture

### Backend (Python/Flask)
```
routes/hls.py
├── /api/hls/play          → Starts HLS transcoding session, returns playlist URL + metadata
├── /hls/<sid>/<filename>  → Serves .m3u8 playlist and .ts segments
└── /api/hls/reconnect     → Reconnects expired HLS sessions

services/hls_transcoder.py
└── start_hls_session()    → FFmpeg command for HLS transcoding
    └── Uses: -hls_time 6 -hls_list_size 0 -hls_flags append_list
              -c:a aac -ac 2 -b:a 192k
              Video: NVENC/VideoToolbox/libx264 depending on GPU
```

### HLS Generation
```bash
ffmpeg -i input.mkv \
  -c:v copy -c:a aac -ac 2 -b:a 192k \
  -f hls -hls_time 6 -hls_list_size 0 -hls_flags append_list \
  -hls_segment_filename seg_%03d.ts playlist.m3u8
```

**Key detail:** `-hls_flags append_list` makes the playlist **grow indefinitely** as new segments are generated. The playlist starts with ~2-3 segments and grows to hundreds.

### Frontend (JavaScript)
```javascript
// 1. Fetch HLS metadata from API
fetch('/api/hls/play?id=X&token=Y&sid=Z')
  .then(r => r.json())
  .then(data => {
    // data = {
    //   url: "/hls/sess_xxx/playlist.m3u8",
    //   duration: 9267,           ← Server knows total duration from DB (ffprobe)
    //   audio_tracks: [...],
    //   session_id: "sess_xxx"
    // }
    
    // 2. Create ArtPlayer with HLS.js
    const hls = new Hls({
      startPosition: 0,
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 5
    });
    hls.loadSource(data.url);
    hls.attachMedia(videoElement);
  });
```

### Duration Flow
```
Video File → ffprobe extracts duration_sec → Stored in SQLite DB (kraken.db)
                                                    ↓
                     /api/hls/play queries DB → Returns data.duration (e.g. 9267 seconds)
                                                    ↓
                    Frontend receives duration → BUT ArtPlayer reads videoEl.duration (NaN for HLS initially)
```

---

## 🐛 The Problem

### Symptom 1: Duration Display
- **Expected:** `0:00 / 1:45:46` (current / total from the start)
- **Actual:** `0:00 / 0:00` → `0:12 / 0:36` → `1:00 / 10:00` → gradually grows as buffer fills
- The UI shows **buffered duration** instead of **total duration**

### Symptom 2: Seeking
- User tries to seek to 50:00 in a 90:00 video
- HLS.js requests `seg_083.ts` but gets 404 (segment not generated yet)
- Or: seek appears to work but snaps back to current buffer position

### Symptom 3: Audio/Subtitle Switching
- When switching audio track, endpoint returns 500 error
- Old session is destroyed before new one is ready → cascading 404s

---

## 🔍 What We've Tried

### Attempt 1: `_videoKnownDuration` global variable
```javascript
let _videoKnownDuration = 0;  // Set from API response

// In updateVideoProgress():
const duration = _videoKnownDuration || videoEl.duration;
```
**Result:** Value IS set correctly (`_videoKnownDuration = 9267`), but ArtPlayer's internal UI overrides it because `videoEl.duration` returns NaN or partial buffer duration for HLS.

### Attempt 2: Setting `duration` in ArtPlayer config
```javascript
let artConfig = {
    container: container,
    url: castUrl,
    duration: data.duration || 0,  // ← ArtPlayer option
    ...
};
```
**Result:** ArtPlayer ignores `duration` option when the video element doesn't have native duration metadata (common with HLS streams).

### Attempt 3: Overriding in `ready` callback
```javascript
art.on('ready', () => {
    if (data.duration && data.duration > 0) {
        _videoKnownDuration = data.duration;
        const timeTotal = document.getElementById('video-time-total');
        if (timeTotal) timeTotal.innerText = formatTime(data.duration);
        const progBar = document.getElementById('video-progress');
        if (progBar) progBar.max = data.duration;
    }
});
```
**Result:** Shows correct duration momentarily, but ArtPlayer's internal `timeupdate` handler overwrites it with `videoEl.duration` (which is NaN or buffer duration for HLS).

### Attempt 4: `Object.defineProperty` override
```javascript
Object.defineProperty(videoEl, 'duration', {
    get: function() { return data.duration; },
    configurable: true
});
```
**Result:** Breaks HLS.js — causes playback stuttering because HLS.js relies on native duration for buffer management.

---

## 📊 Current State

| Component | Status | Notes |
|-----------|--------|-------|
| Server knows duration | ✅ Working | `data.duration` from DB is correct (e.g., 9267) |
| `_videoKnownDuration` variable | ✅ Working | Set correctly before ArtPlayer creation |
| ArtPlayer `duration` config | ❌ Ignored | ArtPlayer reads `videoEl.duration` which is NaN for HLS |
| `video-time-total` display | ❌ Growing | Shows buffered duration, not total |
| Progress bar percentage | ❌ Wrong | Calculated against buffer duration, not total |
| Seeking | ⚠️ Partial | HLS.js requests segments but they may not exist yet |
| Audio switching | ✅ Fixed | Was broken due to `video_duration` undefined, now fixed |

---

## 💡 Proposed Solutions to Investigate

### A. HLS Manifest Modification (Backend)
The `.m3u8` playlist doesn't include `#EXT-X-PLAYLIST-TYPE:VOD` which tells HLS.js this is a finite video, not a live stream.

**Fix:** Add `#EXT-X-PLAYLIST-TYPE:VOD` to the playlist header in `serve_hls_segment()` when serving `playlist.m3u8`.

### B. FFmpeg HLS Flags
Currently using `-hls_flags append_list`. Try using `-hls_list_size 0` without `append_list` and regenerate the full playlist from start:
```bash
-hls_time 6 -hls_list_size 0 -hls_playlist_type vod
```

### C. HLS.js Configuration
```javascript
const hls = new Hls({
    startLevel: -1,           // Auto quality
    maxBufferLength: 30,      // Buffer 30s ahead
    maxMaxBufferLength: 120,  // Max 120s buffer
    liveDurationInfinity: false,  // Don't treat as live
});
```

### D. Manual Duration Injection via ArtPlayer Events
Instead of overriding in `ready`, use `video:loadedmetadata` event which fires after HLS.js has parsed the manifest:
```javascript
art.on('video:loadedmetadata', () => {
    if (_videoKnownDuration > 0) {
        const timeTotal = document.getElementById('video-time-total');
        if (timeTotal) timeTotal.innerText = formatTime(_videoKnownDuration);
    }
});
```

### E. Patch HLS.js Duration Calculation
Hook into HLS.js `FRAG_BUFFERED` event to set duration when first segment loads:
```javascript
hls.on(Hls.Events.FRAG_BUFFERED, (event, data) => {
    if (_videoKnownDuration > 0 && videoEl.duration !== _videoKnownDuration) {
        // Force duration on the video element
        videoEl._krakenDuration = _videoKnownDuration;
    }
});
```

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `routes/hls.py` | Backend: HLS session management, segment serving |
| `services/hls_transcoder.py` | Backend: FFmpeg HLS transcoding command |
| `templates/index.html` | Frontend: ArtPlayer setup, HLS.js config, UI |
| `services/database.py` | Backend: DB schema with `duration_sec` column |
| `services/library.py` | Backend: Scanner that extracts duration via ffprobe |

## 📝 Relevant Code Sections

### FFmpeg Command (hls_transcoder.py, line ~216)
```python
cmd += [
    "-f", "hls",
    "-hls_time", "6",
    "-hls_list_size", "0",
    "-hls_flags", "append_list",
    "-hls_segment_filename", os.path.join(output_dir, "seg_%03d.ts"),
    playlist_path
]
```

### ArtPlayer Creation (index.html, ~line 6095)
```javascript
let artConfig = {
    container: container,
    url: castUrl,
    duration: data.duration || 0,  // ← Should set total duration
    ...
};
art = new Artplayer(artConfig);
```

### Progress Update (index.html, ~line 7515)
```javascript
function updateVideoProgress() {
    const videoEl = document.getElementById('main-video');
    const duration = _videoKnownDuration || videoEl.duration;
    // duration should be from API, but videoEl.duration overrides it
}
```

---

## 🎯 Goal
Make the player display the **total duration from the start** (e.g., `0:00 / 1:45:46`) and enable **seeking to any position** in the video, even before that segment is buffered.
