# 🎬 Kraken HLS Configuration Guide

## Current Setup (Working)
```bash
ffmpeg -i input.mkv \
  -hwaccel auto \
  -map 0:v:0 -map 0:a:0? \
  -c:v copy \
  -c:a aac -ac 2 -b:a 192k \
  -f hls \
  -hls_time 6 \
  -hls_list_size 0 \
  -hls_flags append_list \
  -hls_segment_filename seg_%03d.ts \
  playlist.m3u8
```

## Why `append_list`?
- **Streaming progressive:** Playlist grows as segments are generated
- **Immediate start:** Playback begins after first few segments
- **No wait for full transcode:** User doesn't wait for entire video to process

## ⚡ Recommended Optimizations

### 1. GOP Alignment (CRITICAL for segment consistency)
**Problem:** `hls_time 6` may produce irregular segments if GOP doesn't align.

**Fix:** Force keyframes every 3 seconds (half of hls_time):
```bash
ffmpeg -i input.mkv \
  -c:v copy \
  -c:a aac -ac 2 -b:a 192k \
  -force_key_frames "expr:gte(t,n_forced*3)" \
  -f hls \
  -hls_time 6 \
  -hls_list_size 0 \
  -hls_flags append_list+delete_segments \
  -hls_segment_filename seg_%03d.ts \
  playlist.m3u8
```

**Why it helps:**
- Keyframes every 3s → segments cut cleanly at 6s boundaries
- Prevents segments that are 2s or 9s (irregular)
- More consistent buffering

### 2. Segment Size Optimization
| Setting | Start | Max | Notes |
|---------|-------|-----|-------|
| `hls_time 4` | 🔥 Recommended | `6` | Faster seek, more files |
| `hls_time 6` | Current | `6` | Balanced |
| `hls_time 8` | Slower seek | `10` | Fewer files |

**Sweet spot for append_list:** `hls_time 4` with GOP=2s
- Seek is ~33% faster
- Buffer fills quicker
- Acceptable file count increase (~50% more .ts files)

### 3. HLS Flags Comparison
| Flag | Effect | Use Case |
|------|--------|----------|
| `append_list` | Playlist grows dynamically | ✅ Current (progressive streaming) |
| `delete_segments` | Cleans old segments after timeout | Disk space management |
| `append_list+delete_segments` | Both combined | Best for long sessions |

### 4. FFmpeg Performance Tweaks
```bash
# GPU Acceleration (NVIDIA)
ffmpeg -hwaccel cuda -i input.mkv \
  -c:v h264_nvenc -preset p4 -tune hq \
  -c:a aac -ac 2 -b:a 192k \
  -f hls -hls_time 6 -hls_list_size 0 -hls_flags append_list \
  playlist.m3u8

# CPU (if no GPU)
ffmpeg -i input.mkv \
  -c:v libx264 -preset ultrafast -crf 23 \
  -c:a aac -ac 2 -b:a 192k \
  -f hls -hls_time 6 -hls_list_size 0 -hls_flags append_list \
  playlist.m3u8
```

### 5. HLS.js Frontend Config (for append_list)
```javascript
const hls = new Hls({
    // Progressive streaming settings
    startPosition: 0,
    liveSyncDurationCount: 3,       // Wait for 3 segments before playing
    liveMaxLatencyDurationCount: 5, // Max 5 segments behind live edge
    maxBufferLength: 30,            // Buffer 30s ahead
    maxMaxBufferLength: 60,         // Max 60s buffer
    backBufferLength: 30,           // Keep 30s behind for seeking back
    lowLatencyMode: false,          // Not live, so false
});
```

## 🎯 Final Recommended Config
```python
# services/hls_transcoder.py
cmd += [
    "-f", "hls",
    "-hls_time", "6",
    "-hls_list_size", "0",
    "-hls_flags", "append_list",
    "-hls_segment_filename", os.path.join(output_dir, "seg_%03d.ts"),
    playlist_path
]
```

**Why stay with current config:**
- ✅ Works reliably for your library
- ✅ GPU acceleration already detected
- ✅ append_list gives progressive streaming
- ✅ 6s segments balance seek speed vs file count

**When to change:**
- If seek is too slow → try `hls_time 4`
- If disk space is tight → add `delete_segments` flag
- If segments are irregular → add `-force_key_frames "expr:gte(t,n_forced*3)"`

## 📊 Expected Performance

| Video Type | Transcode Speed | Segments Generated | Buffer Time |
|------------|----------------|-------------------|-------------|
| MP4 h264+aac | DirectPlay (instant) | N/A | N/A |
| MKV h264+ac3 | ~1-2x realtime | 1 segment/6s | ~12-18s |
| MKV hevc+dts | ~0.5-1x realtime | 1 segment/6s | ~18-24s |

## 🔍 Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Segments too short (<4s) | GOP misalignment | `-force_key_frames` |
| Playback stalls | Buffer too small | Increase `maxBufferLength` |
| Seek jumps back | Segment not ready yet | Increase `liveSyncDurationCount` |
| Disk fills up | Old segments accumulate | Add `delete_segments` flag |
