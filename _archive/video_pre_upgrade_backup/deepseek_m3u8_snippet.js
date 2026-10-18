// Respaldo exacto del bloque customType.m3u8 de DeepSeek en templates/index.html (antes de la actualización de hoy)
artConfig.customType = {
    m3u8: function (video, url, art) {
        if (Hls.isSupported()) {
            if (art.hls) art.hls.destroy();
            let hlsPlaybackStarted = false;
            let hlsPreplayStarted = false;
            const MIN_BUFFER_SECONDS = 8;
            const STARTUP_TIMEOUT_MS = 20000;
            const hlsLoadStartedAt = Date.now();
            let hlsRecoveryAttempts = 0;
            let hlsBufferedFragments = 0;

            const hls = new Hls({
                autoStartLoad: true,
                liveDurationInfinity: false,
                lowLatencyMode: false,
                liveSyncDurationCount: 2,
                liveMaxLatencyDurationCount: 4,
                maxBufferLength: 30,
                maxMaxBufferLength: 120,
                backBufferLength: 30,
            });

            hls.loadSource(url);
            hls.attachMedia(video);
            art.hls = hls;

            const startPlayback = () => {
                if (hlsPreplayStarted || hlsPlaybackStarted || art.isDestroy) return;
                hlsPreplayStarted = true;
                clearInterval(bufferCheck);
                art._hlsJumpedToZero = false;
                if (loader) { loader.classList.remove('hidden', 'opacity-0'); }

                const ZERO_JUMP_TARGET_SECONDS = 24;   // buffer adelante antes de saltar (maxBufferLength=30)
                const ZERO_JUMP_TIMEOUT_MS = 30000;    // max espera (FFmpeg lento = fallback)
                const jumpedAt = Date.now();
                const setLoaderProgress = (pct) => {
                    pct = Math.max(0, Math.min(100, Math.round(pct)));
                    const circle = document.getElementById('video-load-progress');
                    if (circle) circle.style.strokeDashoffset = String(264 * (1 - pct / 100));
                    const text = document.getElementById('video-load-percent');
                    if (text) text.innerText = pct + '%';
                };
                const jumpCheck = setInterval(() => {
                    if (art.isDestroy) { clearInterval(jumpCheck); return; }
                    let bufferedEnd = 0;
                    try { bufferedEnd = video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0; } catch (e) { }
                    const ahead = Math.max(0, bufferedEnd - (video.currentTime || 0));
                    const timedOut = Date.now() - jumpedAt >= ZERO_JUMP_TIMEOUT_MS;
                    const bufferPct = ahead / ZERO_JUMP_TARGET_SECONDS * 100;
                    const timePct = (Date.now() - jumpedAt) / ZERO_JUMP_TIMEOUT_MS * 100;
                    setLoaderProgress(Math.max(bufferPct, timePct));
                    if (ahead >= ZERO_JUMP_TARGET_SECONDS || timedOut) {
                        clearInterval(jumpCheck);
                        setLoaderProgress(100);
                        try { video.currentTime = 0; } catch (e) { }
                        art._hlsJumpedToZero = true;
                        console.log('[HLS] Salto a 0 con buffer listo, reproduciendo');
                        const hideLoaderOnPlay = () => {
                            hlsPlaybackStarted = true;
                            if (loader) {
                                loader.classList.add('opacity-0');
                                setTimeout(() => loader.classList.add('hidden'), 300);
                            }
                            video.removeEventListener('playing', hideLoaderOnPlay);
                            art.off('video:playing', hideLoaderOnPlay);
                        };
                        video.addEventListener('playing', hideLoaderOnPlay);
                        art.on('video:playing', hideLoaderOnPlay);
                        art.play().catch(e => {
                            hlsPreplayStarted = false;
                            console.warn('[HLS] play() rechazo:', e.name || 'Error', e.message || e);
                            video.removeEventListener('playing', hideLoaderOnPlay);
                            art.off('video:playing', hideLoaderOnPlay);
                            if (loader) {
                                loader.classList.add('opacity-0');
                                setTimeout(() => loader.classList.add('hidden'), 300);
                            }
                            art.notice.show = 'Pulsa reproducir para iniciar el video';
                        });
                    }
                }, 500);
            };
        }
    }
};
