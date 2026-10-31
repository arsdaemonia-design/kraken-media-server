/**
 * ============================================================================
 * KRAKEN MEDIA SERVER — app-init.js
 * Inicialización general de la aplicación (`initApp`), intervalos de sincronización (Radar, Alexa, Control Remoto, Descargas) y verificador de actualizaciones.
 * ============================================================================
 */

/**
 * `initApp()`
 * Inicializa el reproductor de audio, carga la biblioteca, activa los ciclos de radar/control remoto y verifica el estado del servidor.
 */
function initApp() {
    // A) CONFIGURAR AUDIO
    audioElement1 = document.getElementById('main-audio');
    audioElement2 = document.getElementById('crossfade-audio');
    audioElement = audioElement1;

    setupAudioElement(audioElement1);
    setupAudioElement(audioElement2);

    // B) RECUPERAR VOLUMEN
    const savedVol = localStorage.getItem('vortex_vol');
    if (savedVol) {
        setVolume(parseFloat(savedVol));
        const sliders = ['vol-slider', 'vol-slider-desktop'];
        sliders.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = savedVol;
        });
    }

    // C) ATAJOS DE TECLADO
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
        if (e.code === 'ArrowRight') { e.preventDefault(); playNext(); }
        if (e.code === 'ArrowLeft') { e.preventDefault(); playPrevious(); }
    });

    // D) BUCLE PRINCIPAL (RADAR + ALEXA + DESCARGAS + SYNC)
    const loop = setInterval(async () => {
        try {
            // --- 1. RADAR DE USUARIOS ---
            const titleEl = document.getElementById('player-title');
            const artistEl = document.getElementById('player-artist');

            // 1. CAMBIO: Resolver metadatos reales según si reproduce Video o Audio
            const currentTrack = playerQueue[currentTrackIndex];
            const playbackSnapshot = getKrakenPlaybackSnapshot();
            const activeVideoElement = document.querySelector('#cine-screen video, #artplayer-container video, #main-video');
            const hlsTimeOffset = Number(window.currentArtPlayer?._hlsTimeOffset || 0);
            const currentProgressTime = playbackSnapshot.media_type === 'video'
                ? (activeVideoElement ? (hlsTimeOffset + (activeVideoElement.currentTime || 0)) : 0)
                : (audioElement ? audioElement.currentTime : 0);
            const currentProgressDuration = playbackSnapshot.media_type === 'video'
                ? Math.max(
                    Number(window.currentVideoData?.duration || 0),
                    Number(window.currentVideoFile?.duration || 0),
                    activeVideoElement ? (hlsTimeOffset + (activeVideoElement.duration || 0)) : 0
                )
                : (audioElement ? audioElement.duration : 0);

            const currentVideo = window.currentVideoFile;
            let currentSongTitle = '';
            let currentArtistName = '';
            let currentMediaPath = '';

            if (playbackSnapshot.media_type === 'video') {
                currentSongTitle = currentVideo?.title || document.getElementById('cine-title')?.innerText || 'Película';
                currentArtistName = currentVideo?.folder || document.getElementById('cine-meta')?.innerText || 'Cine';
                currentMediaPath = currentVideo?.path || '';
            } else {
                currentSongTitle = (titleEl && titleEl.innerText !== 'Sin título') ? titleEl.innerText : (currentTrack ? (currentTrack.title || '') : '');
                currentArtistName = (artistEl && artistEl.innerText !== 'KRAKEN SYSTEM') ? artistEl.innerText : (currentTrack ? (currentTrack.artist || '') : '');
                currentMediaPath = currentTrack ? (currentTrack.path || '') : '';
            }

            const isDedicatedSpeakerOrTv = playbackSnapshot.device_type === 'tv' ||
                /tv|sala|comedor|soundbar|parlante|proyector/i.test(playbackSnapshot.device_name || '');

            const params = new URLSearchParams({
                sid: MY_SESSION_ID,
                user: MY_NAME,
                is_speaker: isDedicatedSpeakerOrTv ? 'true' : 'false',
                song: currentSongTitle,
                artist: currentArtistName,
                path: currentMediaPath,
                time: currentProgressTime,
                duration: currentProgressDuration,
                is_playing: playbackSnapshot.is_playing ? 'true' : 'false',
                volume: playbackSnapshot.volume,
                queue_length: playbackSnapshot.queue_length,
                current_index: playbackSnapshot.current_index,
                library_mode: playbackSnapshot.library_mode,
                device_name: playbackSnapshot.device_name,
                device_type: playbackSnapshot.device_type,
                media_type: playbackSnapshot.media_type
            });

            const authHeaders = (window.krakenAuth && typeof window.krakenAuth.headers === 'function')
                ? window.krakenAuth.headers()
                : {};
            const res = await fetch(`/status?${params.toString()}`, { headers: authHeaders });
            if (!res.ok) {
                return;
            }
            let d;
            try {
                d = await res.json();
            } catch (jsonErr) {
                return;
            }
            if (!d || typeof d !== 'object') {
                return;
            }

            // --- ASIGNAR IDENTIDAD DEL USUARIO (desde JWT local o CF legacy) ---
            if (d.my_email) {
                const firstTime = !window.MY_EMAIL;
                window.MY_EMAIL = d.my_email;
                if (firstTime) {
                    cargarLib();
                }
            }

            if (d.online_users) {
                drawUserRadar(d.online_users);
            }
            if (d.controlled_target) {
                applyControlledTargetState(d.controlled_target);
            } else if (!window.KRAKEN_PLAYBACK_TARGET && !window._activeCineRemoteData?.targetSid) {
                applyControlledTargetState(null);
            }
            // --- 2. ALEXA ---
            const cmd = d.last_command;
            if (typeof window.lastProcessedTime === 'undefined') window.lastProcessedTime = 0;

            if (cmd && cmd.time > window.lastProcessedTime) {
                const now = Date.now() / 1000;
                if (now - cmd.time < 60) {
                    console.log("🔥 COMANDO:", cmd);
                    window.lastProcessedTime = cmd.time;
                    if (cmd.action === 'play_mix') {
                        activarModoRadio();
                        showToast("🤖 Alexa: Modo Radio", "success");
                    }
                }
            }

            // --- 2.5 REMOTE CONTROL (EL TITIRITERO) ---
            if (Array.isArray(d.remote_commands) && d.remote_commands.length) {
                d.remote_commands.forEach(cmd => applyRemoteCommand(cmd));
            } else if (d.remote_command) {
                applyRemoteCommand({
                    action: d.remote_command,
                    from_name: d.from_name || 'Alguien',
                    from_sid: d.from_sid || ''
                });
            }

            // --- 3. DESCARGAS ---
            if (d.failed) {
                clearInterval(loop);
                const bar = document.getElementById('dl-progress');
                if (bar) bar.classList.add('hidden');
                showToast(d.details || "Error descarga", "error");
                return;
            }

            const dlBar = document.getElementById('dl-progress');
            if (d.active) {
                if (dlBar) dlBar.classList.remove('hidden');
                const pEl = document.getElementById('dl-percent');
                const fEl = document.getElementById('dl-filename');
                const bEl = document.getElementById('dl-bar');

                if (pEl) pEl.innerText = d.percent;
                if (fEl) fEl.innerText = d.filename;
                if (bEl) bEl.style.width = d.percent;
            } else if (d.percent === "100%") {
                if (dlBar) dlBar.classList.add('hidden');
                const pEl = document.getElementById('dl-percent');
                if (pEl && pEl.innerText !== '100%') {
                    cargarLib();
                    cargarHistorial();
                }
            }
        } catch (error) {
            console.error("Error en bucle:", error);
        }
    }, 2000);

    // E) INICIALIZACIÓN FINAL
    ver('library');
    setView(viewMode);

    if (typeof initLazyLoader === 'function') {
        initLazyLoader();
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSidebar();
    });
}

// ========================================
    // AUTO-UPDATE CHECK (GitHub Releases)
    // ========================================
    /**
     * `checkForUpdates()`
     * Consulta la API de GitHub Releases para notificar si existe una nueva versión de Kraken Media Server.
     */
    async function checkForUpdates() {
        try {
            // Verificar si el usuario cerró el banner recientemente
            const dismissedData = localStorage.getItem('update_banner_dismissed');
            if (dismissedData) {
                const { version, date } = JSON.parse(dismissedData);
                const daysSinceDismissed = (Date.now() - date) / (1000 * 60 * 60 * 24);
                // Si cerró hace menos de 7 días y es la misma versión, no mostrar
                if (daysSinceDismissed < 7) {
                    console.log(`Update banner dismissed for ${version}, ${daysSinceDismissed.toFixed(1)} days ago`);
                    return;
                }
            }

            const currentVersionRaw = typeof APP_VERSION !== 'undefined' ? APP_VERSION : '0.0';
            const res = await fetch(`/api/check_update?current_version=${encodeURIComponent(currentVersionRaw)}`);
            const data = await res.json();

            if (data.has_update) {
                const newVersionRaw = data.version;

                // Normalizar y comparar versiones numericamente (4.10 > 4.9)
                const normalizeVersion = (v) => {
                    if (!v) return '0.0.0';
                    return v.toString().toLowerCase().replace(/^v\s*/, '').trim();
                };
                const toTuple = (v) => {
                    const parts = normalizeVersion(v).match(/\d+/g) || [];
                    const nums = parts.slice(0, 3).map(n => parseInt(n, 10));
                    while (nums.length < 3) nums.push(0);
                    return nums;
                };
                const compareVersion = (a, b) => {
                    const av = toTuple(a);
                    const bv = toTuple(b);
                    for (let i = 0; i < 3; i++) {
                        if (av[i] > bv[i]) return 1;
                        if (av[i] < bv[i]) return -1;
                    }
                    return 0;
                };

                const currentVersion = normalizeVersion(currentVersionRaw);
                const newVersion = normalizeVersion(newVersionRaw);

                console.log(`Version check: local=${currentVersionRaw}→${currentVersion}, remote=${newVersionRaw}→${newVersion}`);

                // Solo mostrar si la remota es estrictamente mayor
                if (compareVersion(newVersion, currentVersion) > 0) {
                    // Crear banner de actualización
                    const banner = document.createElement('div');
                    banner.id = 'update-banner';
                    banner.className = 'fixed top-0 left-0 right-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-2 px-4 z-[99999] flex items-center justify-center gap-4 shadow-lg';
                    banner.innerHTML = `
  <span class="text-sm font-bold">
    <i class="fa-solid fa-download mr-2"></i>Nueva versión ${newVersion} disponible
  </span>
  <button onclick="window.open('https://github.com/${window.GITHUB_REPO}/releases', '_blank')" 
    class="bg-white text-purple-700 px-4 py-1 rounded-full text-xs font-bold hover:bg-purple-100 transition">
    Descargar
  </button>
  <button onclick="dismissUpdateBanner('${newVersion}')" class="text-white/70 hover:text-white">
    <i class="fa-solid fa-xmark"></i>
  </button>
`;
                    document.body.appendChild(banner);
                }
            }
        } catch (e) {
            console.log('Check update failed:', e);
        }
    }

    // Función para cerrar el banner y recordar por 7 días
    /**
     * `dismissUpdateBanner(version)`
     * Oculta el aviso de actualización y recuerda la decisión en `localStorage`.
     */
    function dismissUpdateBanner(version) {
        const banner = document.getElementById('update-banner');
        if (banner) banner.remove();

        // Guardar en localStorage: versión y fecha de cierre
        localStorage.setItem('update_banner_dismissed', JSON.stringify({
            version: version,
            date: Date.now()
        }));
        console.log(`Update banner dismissed for version ${version}`);
    }

    // Check for updates (no bloquea el inicio)
    checkForUpdates();
