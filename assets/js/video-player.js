/**
 * ============================================================================
 * KRAKEN MEDIA SERVER — video-player.js
 * Motor de reproducción de video (ArtPlayer + HLS / DirectPlay), keepalive de sesiones FFmpeg, selector de pistas de audio/subtítulos y gestos táctiles.
 * ============================================================================
 */

/**
             * `playVideoMode(file)`
             * Inicializa el reproductor de video (ArtPlayer + HLS / DirectPlay), tokens de stream, subtítulos y Chromecast.
             */
            async function playVideoMode(file) {
                window.currentVideoFile = file;
                // Si hay un dispositivo remoto conectado (Spotify Connect para Cine):
                if (window.KRAKEN_PLAYBACK_TARGET && window.KRAKEN_PLAYBACK_TARGET.session_id && window.KRAKEN_PLAYBACK_TARGET.session_id !== MY_SESSION_ID) {
                    if (typeof window.sendFileToControlledDevice === 'function') {
                        window.sendFileToControlledDevice({
                            path: file.path,
                            title: file.title || (file.path ? file.path.split('/').pop() : 'Video'),
                            artist: file.artist || file.folder || '',
                            type: 'video',
                            cover: file.cover || ''
                        }, window.KRAKEN_PLAYBACK_TARGET);
                    }
                    if (typeof window.showCineRemoteModal === 'function') {
                        window.showCineRemoteModal(file, window.KRAKEN_PLAYBACK_TARGET);
                    }
                    return;
                }

                closeSidebar();
                
                const playerContainer = document.getElementById('view-player');
                if (playerContainer) {
                    playerContainer.classList.remove('hidden');
                    playerContainer.classList.remove('animate-slide-in');
                    void playerContainer.offsetWidth;
                    playerContainer.classList.add('animate-slide-in');
                }

                // Ocultar sidebar
                const sb = document.getElementById('main-sidebar');
                if (sb) sb.classList.add('hidden');

                // Ocultar otras vistas
                document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));

                const view = document.getElementById('view-player');
                if (view) view.classList.remove('hidden');

                // Forzar landscape en móvil al ver video
                if (window.innerWidth < 768 && window.screen && window.screen.orientation && window.screen.orientation.lock) {
                    window.screen.orientation.lock('landscape').catch(() => { });
                }

                // Ocultar modal de ajustes por defecto
                const modalAjustes = document.getElementById('audio-subtitle-modal');
                if (modalAjustes) {
                    modalAjustes.classList.add('hidden', 'opacity-0');
                    modalAjustes.style.pointerEvents = 'none';
                }

                const screenEl = document.getElementById('cine-screen');

                // Mostrar loader
                const loader = document.getElementById('video-loader');
                if (loader) {
                    loader.classList.remove('hidden', 'opacity-0');
                }

                // Título y meta
                const cTitle = document.getElementById('cine-title');
                const cMeta = document.getElementById('cine-meta');
                if (cTitle) cTitle.innerText = file.title;
                if (cMeta) cMeta.innerText = file.folder || 'Video';

                // Obtener session ID

                // Ocultar la UI nativa de Kraken para que no duplique controls
                document.querySelectorAll('.cine-controls, .cine-header, #dt-left, #dt-right, #dt-center').forEach(el => {
                    if (el) el.classList.add('hidden');
                });
                document.getElementById('krk-persistent-chat-pill')?.remove();

                const sid = localStorage.getItem('kraken_sid') || 'default';

                // Preparar container para ArtPlayer
                if (screenEl) {
                    screenEl.innerHTML = `
                        <button id="krk-video-back-btn" onclick="exitVideoMode()" class="absolute top-4 left-4 z-[9999] bg-black/50 hover:bg-black/80 text-white rounded-full w-10 h-10 flex items-center justify-center transition-all duration-300 backdrop-blur border border-white/10 shadow-lg group">
                            <i class="fa-solid fa-arrow-left transition-transform group-hover:-translate-x-1"></i>
                        </button>
                        <div id="krk-video-top-right-controls" class="absolute top-4 right-4 z-[9999] flex items-center gap-2.5 transition-all duration-300">
                            <button id="krk-watch-party-chat-btn" onclick="if(typeof toggleWatchPartyChat==='function') toggleWatchPartyChat();" class="bg-black/80 hover:bg-black/95 text-amber-300 hover:text-amber-200 rounded-full px-4 py-2.5 flex items-center gap-2.5 transition-all duration-300 backdrop-blur border border-amber-500/40 shadow-xl text-xs sm:text-sm font-bold" title="Chat de Watch Party">
                                <i class="fa-solid fa-comments text-amber-400 text-sm"></i>
                                <span>Chat</span>
                                <span id="krk-chat-unread-badge" class="hidden w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                            </button>
                            <button id="krk-video-watch-party-btn" onclick="if(typeof openWatchPartyInviteModal==='function') openWatchPartyInviteModal();" class="bg-black/80 hover:bg-black/95 text-amber-300 hover:text-amber-200 rounded-full px-4 py-2.5 flex items-center gap-2.5 transition-all duration-300 backdrop-blur border border-amber-500/40 shadow-xl text-xs sm:text-sm font-bold" title="Ver con amigo">
                                <i class="fa-solid fa-users text-amber-400 text-sm"></i>
                                <span class="hidden sm:inline">Ver con amigo</span>
                            </button>
                        </div>
                        <div id="krk-watch-party-quick-emojis" class="absolute bottom-20 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-1.5 sm:gap-2 bg-black/75 backdrop-blur-md px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-amber-500/30 shadow-2xl transition-all duration-300 opacity-0 pointer-events-none select-none">
                            <span class="text-[10px] font-bold text-amber-400 uppercase tracking-widest hidden sm:inline mr-1">Reaccionar:</span>
                            <button onclick="sendWatchPartyQuickReaction('🍿')" class="text-xl sm:text-2xl hover:scale-125 focus:scale-125 active:scale-95 transition-transform p-1 outline-none" title="Palomitas">🍿</button>
                            <button onclick="sendWatchPartyQuickReaction('🔥')" class="text-xl sm:text-2xl hover:scale-125 focus:scale-125 active:scale-95 transition-transform p-1 outline-none" title="Fuego">🔥</button>
                            <button onclick="sendWatchPartyQuickReaction('😂')" class="text-xl sm:text-2xl hover:scale-125 focus:scale-125 active:scale-95 transition-transform p-1 outline-none" title="Risa">😂</button>
                            <button onclick="sendWatchPartyQuickReaction('😱')" class="text-xl sm:text-2xl hover:scale-125 focus:scale-125 active:scale-95 transition-transform p-1 outline-none" title="Sorpresa">😱</button>
                            <button onclick="sendWatchPartyQuickReaction('👏')" class="text-xl sm:text-2xl hover:scale-125 focus:scale-125 active:scale-95 transition-transform p-1 outline-none" title="Aplausos">👏</button>
                            <button onclick="sendWatchPartyQuickReaction('❤️')" class="text-xl sm:text-2xl hover:scale-125 focus:scale-125 active:scale-95 transition-transform p-1 outline-none" title="Amor">❤️</button>
                        </div>
                        <div id="artplayer-container" class="w-full h-full bg-black relative z-0"></div>
                    `;
                }

                // Obtener Security Token para streaming por ID (Plex-style)
                const tokenRes = await fetch('/api/stream/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: file.id, path: file.path })
                });
                const tokenData = await tokenRes.json();

                if (!tokenData.token) {
                    showToast("Error de Token: " + (tokenData.error || "No autorizado"), "error");
                    if (loader) { loader.classList.add('opacity-0'); setTimeout(() => loader.classList.add('hidden'), 300); }
                    return;
                }
                const mediaId = tokenData.id;
                const streamToken = tokenData.token;

                // Llamar API HLS con ID + Token
                const videoPath = file.path.split('/').map(p => encodeURIComponent(p)).join('/');

                // Verificar si ArtPlayer está disponible
                console.log("ArtPlayer typeof:", typeof Artplayer);
                console.log("Hls typeof:", typeof Hls);

                if (typeof Artplayer === 'undefined') {
                    console.error("ArtPlayer NO CARGADO - usando fallback");
                    showToast("ArtPlayer no cargado, usando reproductor nativo", "error");
                    showFallbackPlayer(screen, `/descargas/${videoPath}`, file);
                    return;
                }

                fetch(`/api/hls/play?id=${mediaId}&token=${streamToken}&sid=${sid}`)
                    .then(r => r.json())
                    .then(data => {
                        console.log("HLS API response:", data);

                        if (data.error) {
                            showToast("Error HLS: " + data.error, "error");
                            if (loader) {
                                loader.classList.add('opacity-0');
                                setTimeout(() => loader.classList.add('hidden'), 300);
                            }
                            // Fallback al reproductor nativo
                            showFallbackPlayer(screen, videoPath, file);
                            return;
                        }

                        window.currentVideoData = data;
                        if (window.currentVideoFile) {
                            window.currentVideoFile.subtitle_tracks = data.subtitle_tracks || [];
                            window.currentVideoFile.audio_tracks = data.audio_tracks || [];
                            window.currentVideoFile.selected_audio_track = data.selected_audio_track;
                            window.currentVideoFile.subtitle_url = data.subtitle_url;
                        }

                        // Crear ArtPlayer
                        const container = document.getElementById('artplayer-container');
                        if (container && data.url) {
                            const cleanVideoTitle = (s) => String(s || '')
                                .replace(/\.(mkv|mp4|avi|mov|webm|m4v)$/i, '')
                                .replace(/[\s\-_]*[\(\[\{]?\s*tmdb[\-_=\s]*\d+\s*[\)\]\}]?/gi, '')
                                .trim();
                            const currentTitle = cleanVideoTitle(file.tmdb_title || file.title || 'Sin título');
                            const rawMeta = cleanVideoTitle(file.folder || '');
                            const currentMeta = (rawMeta && rawMeta.toLowerCase() !== currentTitle.toLowerCase() && rawMeta.toLowerCase() !== 'video') ? rawMeta : '';
                            let backendAudioTracks = Array.isArray(data.audio_tracks) ? data.audio_tracks : [];
                            let selectedBackendAudio = Number.isInteger(data.selected_audio_track) ? data.selected_audio_track : 0;
                            const audioLanguageMap = {
                                spa: 'Español',
                                es: 'Español',
                                eng: 'Inglés',
                                en: 'Inglés',
                                jpn: 'Japonés',
                                jp: 'Japonés',
                                por: 'Portugués',
                                pt: 'Portugués',
                                fra: 'Francés',
                                fr: 'Francés',
                                ita: 'Italiano',
                                it: 'Italiano',
                                deu: 'Alemán',
                                ger: 'Alemán',
                                de: 'Alemán',
                            };
                            const normalizeAudioIndex = (value) => {
                                const parsed = Number(value);
                                if (Number.isNaN(parsed) || parsed < 0) return 0;
                                return Math.floor(parsed);
                            };
                            const toHumanLanguage = (value) => {
                                const code = String(value || '').trim().toLowerCase();
                                if (!code) return '';
                                return audioLanguageMap[code] || value;
                            };
                            const buildAudioLabel = (track, index) => {
                                const language = toHumanLanguage(track.language_code || track.language);
                                const title = String(track.title || '').trim();
                                const codec = String(track.codec || '').trim();
                                const channels = Number(track.channels || 0);
                                const channelLabel = channels >= 6 ? '5.1' : (channels > 0 ? `${channels}.0` : '');
                                const base = title || language || `Audio ${index + 1}`;
                                const details = [codec.toUpperCase(), channelLabel].filter(Boolean).join(' ');
                                return details ? `${base} (${details})` : base;
                            };
                            const dedupeAudioLabels = (trackList) => {
                                const totals = {};
                                trackList.forEach((entry) => {
                                    totals[entry.html] = (totals[entry.html] || 0) + 1;
                                });
                                const seen = {};
                                return trackList.map((entry) => {
                                    if ((totals[entry.html] || 0) <= 1) return entry;
                                    seen[entry.html] = (seen[entry.html] || 0) + 1;
                                    return {
                                        ...entry,
                                        html: `${entry.html} · ${seen[entry.html]}`
                                    };
                                });
                            };

                            const audioSettingName = 'audio-track';
                            const audioSettingBase = {
                                name: audioSettingName,
                                html: 'Audio',
                                tooltip: 'Default',
                                selector: [{ html: 'Default', value: -1, default: true }],
                                onSelect: function (item) {
                                    const val = Number(item.value);
                                    if (this._krakenAudioMode === 'hls' && this.hls && !Number.isNaN(val) && val >= 0 && Array.isArray(this.hls.audioTracks)) {
                                        this.hls.audioTrack = val;
                                        return item.html;
                                    }

                                    if (this._krakenAudioMode === 'backend' && !Number.isNaN(val) && val >= 0 && typeof this.switchHlsAudioByRestart === 'function') {
                                        this.switchHlsAudioByRestart(val, item.html || 'Audio');
                                        return item.html;
                                    }

                                    const nativeAudioTracks = this.video && this.video.audioTracks ? this.video.audioTracks : null;
                                    if (nativeAudioTracks && nativeAudioTracks.length > 0) {
                                        const idx = Number.isNaN(val) ? 0 : val;
                                        for (let i = 0; i < nativeAudioTracks.length; i++) {
                                            nativeAudioTracks[i].enabled = i === idx;
                                        }
                                        return item.html;
                                    }

                                    return 'Default';
                                }
                            };

                            const subtitleTracks = Array.isArray(data.subtitle_tracks) ? data.subtitle_tracks : [];
                            const resolveSubtitleType = (subUrl) => {
                                const cleanPath = String(subUrl || '').split('?')[0].toLowerCase();
                                if (cleanPath.endsWith('.vtt')) return 'vtt';
                                if (cleanPath.endsWith('.ass') || cleanPath.endsWith('.ssa')) return 'ass';
                                return 'srt';
                            };
                            const subtitleSettingName = 'subtitle-track';
                            const subtitleSettingBase = {
                                name: subtitleSettingName,
                                html: 'Subtítulos',
                                tooltip: 'Apagados',
                                selector: [{ html: 'Apagados', value: 'off', default: true }],
                                onSelect: function (item) {
                                    const value = String(item.value || 'off');
                                    if (value === 'off') {
                                        if (this.subtitle) this.subtitle.show = false;
                                        return 'Apagados';
                                    }

                                    const selectedIndex = Number(value);
                                    const track = subtitleTracks[selectedIndex];
                                    if (!track || !track.url || !this.subtitle) return 'Apagados';

                                    const rawSubUrl = track.url.includes('%') ? track.url : encodeURI(track.url);
                                    const fullSubUrl = rawSubUrl.startsWith('/') ? (window.location.origin + rawSubUrl) : rawSubUrl;
                                    const subType = resolveSubtitleType(track.url);
                                    if (typeof this.subtitle.switch === 'function') {
                                        this.subtitle.switch(fullSubUrl, {
                                            name: item.html || 'Subtítulo',
                                            type: subType,
                                            encoding: 'utf-8'
                                        });
                                    } else {
                                        this.subtitle.url = fullSubUrl;
                                        this.subtitle.type = subType;
                                    }
                                    this.subtitle.show = true;
                                    return item.html || 'Subtítulo';
                                }
                            };

                            if (subtitleTracks.length > 0) {
                                let activeSubtitleIdx = subtitleTracks.findIndex((s) => s.url === data.subtitle_url);
                                if (activeSubtitleIdx < 0) activeSubtitleIdx = 0;
                                subtitleSettingBase.selector = [
                                    { html: 'Apagados', value: 'off', default: data.subtitle_url ? false : true },
                                    ...subtitleTracks.map((track, index) => {
                                        const label = track.title || track.language || `Subtítulo ${index + 1}`;
                                        return {
                                            html: label,
                                            value: String(index),
                                            default: data.subtitle_url ? index === activeSubtitleIdx : false,
                                        };
                                    })
                                ];
                                if (data.subtitle_url) {
                                    subtitleSettingBase.tooltip = subtitleSettingBase.selector.find((s) => s.default)?.html || 'Subtítulo';
                                }
                            }

                            const castSupported = !!(
                                window.__krakenCastReady &&
                                typeof artplayerPluginChromecast === 'function'
                            );

                            let art = null;
                            const artSettings = [audioSettingBase, subtitleSettingBase];
                            // Usar dominio público para Cast (el Chromecast no accede a localhost)
                            const playbackUrl = data.url.startsWith('/') ? (window.location.origin + data.url) : data.url;
                            const publicOrigin = window.__krakenPublicUrl || window.location.origin;
                            const castBaseUrl = data.url.startsWith('/') ? (publicOrigin + data.url) : data.url;
                            const castUrl = data.token ? castBaseUrl + (castBaseUrl.includes('?') ? '&' : '?') + `token=${data.token}` : castBaseUrl;
                            let artConfig = {
                                container: container,
                                url: playbackUrl,
                                title: file.title || '',
                                theme: '#10b981',
                                setting: true,
                                settings: artSettings,
                                playsInline: true,
                                fullscreen: true,
                                fullscreenWeb: false,
                                pip: true,
                                playbackRate: true,
                                fastForward: true,
                                gesture: true,
                                autoOrientation: true,
                                volume: Number(getVideoPrefs().defaultVolume != null ? getVideoPrefs().defaultVolume : 1),
                                screenshot: false,
                                airplay: true,
                                autoHide: true,
                                duration: data.duration || 0,
                                plugins: castSupported ? [
                                    artplayerPluginChromecast({
                                        url: castUrl,
                                        mimeType: data.direct_play ? 'video/mp4' : 'application/x-mpegURL',
                                        receiverApplicationId: 'CC1AD845'
                                    }),
                                ] : [],
                                mobile: {
                                    // Gestos táctiles nativos de ArtPlayer
                                    gestureType: 'lrud'
                                },
                                moreVideoAttr: {
                                    crossorigin: 'anonymous'
                                },
                                controls: [
                                    {
                                        position: 'left',
                                        index: 10,
                                        html: '<i class="fa-solid fa-backward-step"></i>',
                                        tooltip: 'Anterior',
                                        style: { padding: '0 10px' },
                                        click: function () {
                                            if (typeof playPrevious === 'function') playPrevious();
                                        }
                                    },
                                    {
                                        position: 'left',
                                        index: 20,
                                        html: '<i class="fa-solid fa-forward-step"></i>',
                                        tooltip: 'Siguiente',
                                        style: { padding: '0 10px' },
                                        click: function () {
                                            if (typeof playNext === 'function') playNext();
                                        }
                                    },
                                    {
                                        position: 'right',
                                        index: 5,
                                        html: '<i class="fa-solid fa-tower-broadcast text-emerald-400"></i>',
                                        tooltip: 'Transmitir a TV / Connect',
                                        style: { padding: '0 10px' },
                                        click: function () {
                                            if (typeof showConnectModal === 'function') showConnectModal();
                                        }
                                    },
                                    {
                                        position: 'right',
                                        index: 10,
                                        html: '<i class="fa-solid fa-xmark"></i>',
                                        tooltip: 'Salir',
                                        style: { padding: '0 10px' },
                                        click: function () {
                                            exitVideoMode();
                                        }
                                    },
                                    {
                                        position: 'right',
                                        index: 20,
                                        html: '<i class="fa-solid fa-list-ul"></i>',
                                        tooltip: 'Cola de Reproducción',
                                        style: { padding: '0 10px' },
                                        click: function () {
                                            if (typeof toggleQueue === 'function') toggleQueue();
                                        }
                                    }
                                ]
                            };
                            if (!castSupported) {
                                console.warn('[CAST] disabled in current environment (SDK/plugin not ready)');
                            }

                            // Si hay subtítulo detectado, cargarlo (y si solo hay embebidos, inicializar contenedor para switch al vuelo)
                            if (data.subtitle_url) {
                                const rawInitSubUrl = data.subtitle_url.includes('%') ? data.subtitle_url : encodeURI(data.subtitle_url);
                                artConfig.subtitle = {
                                    url: rawInitSubUrl.startsWith('/') ? (window.location.origin + rawInitSubUrl) : rawInitSubUrl,
                                    type: resolveSubtitleType(data.subtitle_url),
                                    style: buildSubtitleStyle(),
                                    encoding: 'utf-8'
                                };
                            } else if (subtitleTracks.length > 0) {
                                artConfig.subtitle = {
                                    style: buildSubtitleStyle(),
                                    encoding: 'utf-8'
                                };
                            }

                            artConfig.customType = {
                                m3u8: function (video, url, art) {
                                    if (Hls.isSupported()) {
                                        if (art.hls) art.hls.destroy();
                                        let hlsPlaybackStarted = false;
                                        let hlsPreplayStarted = false;
                                        const MIN_BUFFER_SECONDS = 4;
                                        const STARTUP_TIMEOUT_MS = 20000;
                                        const hlsLoadStartedAt = Date.now();
                                        let hlsRecoveryAttempts = 0;
                                        let hlsBufferedFragments = 0;

                                        const setLoaderProgress = (pct) => {
                                            pct = Math.max(0, Math.min(100, Math.round(pct)));
                                            const circle = document.getElementById('video-load-progress');
                                            if (circle) circle.style.strokeDashoffset = String(264 * (1 - pct / 100));
                                            const text = document.getElementById('video-load-percent');
                                            if (text) text.innerText = pct + '%';
                                        };
                                        setLoaderProgress(15);

                                        const hls = new Hls({
                                            autoStartLoad: true,
                                            startPosition: 0,
                                            liveDurationInfinity: false,
                                            lowLatencyMode: false,
                                            liveSyncDurationCount: 3,
                                            liveMaxLatencyDurationCount: Infinity,
                                            maxLiveSyncPlaybackRate: 1,
                                            maxBufferLength: 45,
                                            maxMaxBufferLength: 180,
                                            backBufferLength: 60,
                                            fragLoadingTimeOut: 20000,
                                            manifestLoadingTimeOut: 15000,
                                        });

                                        hls.loadSource(url);
                                        hls.attachMedia(video);
                                        art.hls = hls;

                                        const startPlayback = () => {
                                            if (hlsPreplayStarted || hlsPlaybackStarted || art.isDestroy) return;
                                            hlsPreplayStarted = true;
                                            clearInterval(bufferCheck);
                                            setLoaderProgress(100);

                                            if (!art._hlsJumpedToZero) {
                                                try {
                                                    if (video.buffered.length > 0 && video.currentTime > 1.5 && (!window.krakenPendingResumeSeconds || window.krakenPendingResumeSeconds <= 5)) {
                                                        const safeStart = video.buffered.start(0);
                                                        if (safeStart <= 2.5 && video.buffered.end(0) > safeStart + 2.0) {
                                                            video.currentTime = safeStart <= 0.5 ? 0 : safeStart;
                                                        }
                                                    }
                                                } catch (e) { }
                                                art._hlsJumpedToZero = true;
                                            }

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
                                        };

                                        console.log(`[HLS] Cargando stream con HLS.js ${Hls.version || '1.7.x'}; objetivo inicial: ${MIN_BUFFER_SECONDS}s`);

                                        const bufferCheck = setInterval(() => {
                                            if (hlsPlaybackStarted || hlsPreplayStarted || art.isDestroy) return;
                                            const elapsed = Date.now() - hlsLoadStartedAt;
                                            if (video.buffered.length > 0) {
                                                const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                                                const bufferedAhead = Math.max(0, bufferedEnd - (video.currentTime || 0));
                                                const pct = Math.min(95, Math.max(25, (bufferedAhead / MIN_BUFFER_SECONDS) * 95));
                                                setLoaderProgress(pct);
                                                if (bufferedAhead >= MIN_BUFFER_SECONDS || (bufferedAhead >= 1.5 && elapsed >= 3500)) {
                                                    startPlayback();
                                                }
                                            } else {
                                                setLoaderProgress(Math.min(75, 15 + (elapsed / 6000) * 60));
                                            }
                                        }, 250);

                                        setTimeout(() => {
                                            if (!hlsPlaybackStarted && !hlsPreplayStarted && !art.isDestroy) {
                                                console.warn('[HLS] No hubo buffer suficiente durante el arranque');
                                                art.notice.show = 'La red está tardando en preparar el video';
                                            }
                                        }, STARTUP_TIMEOUT_MS);

                                        if (typeof Hls.Events !== 'undefined') {
                                            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                                                setLoaderProgress(40);
                                                setTimeout(() => {
                                                    if (window.currentArtPlayer && window.currentArtPlayer.refreshAudioTracks) {
                                                        window.currentArtPlayer.refreshAudioTracks();
                                                    }
                                                }, 0);
                                            });
                                            hls.on(Hls.Events.FRAG_BUFFERED, () => {
                                                hlsBufferedFragments += 1;
                                                setLoaderProgress(Math.min(95, 45 + hlsBufferedFragments * 25));
                                                if (hlsBufferedFragments >= 1) {
                                                    let bufferedAhead = 0;
                                                    try {
                                                        if (video.buffered.length > 0) {
                                                            bufferedAhead = video.buffered.end(video.buffered.length - 1) - (video.currentTime || 0);
                                                        }
                                                    } catch (e) { }
                                                    if (bufferedAhead >= 3.0 || hlsBufferedFragments >= 2) {
                                                        startPlayback();
                                                    }
                                                }
                                            });
                                            hls.on(Hls.Events.ERROR, (_event, errorData) => {
                                                console.warn('[HLS] error', {
                                                    type: errorData?.type,
                                                    details: errorData?.details,
                                                    fatal: errorData?.fatal,
                                                    responseCode: errorData?.response?.code
                                                });
                                                if (!errorData?.fatal) return;
                                                if (hlsRecoveryAttempts >= 2) {
                                                    hls.stopLoad();
                                                    if (loader) {
                                                        loader.classList.add('opacity-0');
                                                        setTimeout(() => loader.classList.add('hidden'), 300);
                                                    }
                                                    art.notice.show = 'No se pudo decodificar este stream HLS';
                                                    return;
                                                }
                                                hlsRecoveryAttempts += 1;
                                                if (errorData.type === Hls.ErrorTypes.NETWORK_ERROR) {
                                                    hls.startLoad();
                                                } else if (errorData.type === Hls.ErrorTypes.MEDIA_ERROR) {
                                                    hls.recoverMediaError();
                                                }
                                            });
                                            hls.on(Hls.Events.LEVEL_LOADED, (_event, levelData) => {
                                                const details = levelData?.details;
                                                art._hlsEndedList = !details?.live;
                                                art._hlsTotalDuration = Number(details?.totalduration || 0);
                                                console.log('[HLS] Playlist actualizado', {
                                                    live: details?.live,
                                                    duration: details?.totalduration,
                                                    lastSegment: details?.endSN
                                                });
                                            });
                                            hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
                                                if (window.currentArtPlayer && window.currentArtPlayer.refreshAudioTracks) {
                                                    window.currentArtPlayer.refreshAudioTracks();
                                                }
                                            });
                                            hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, () => {
                                                if (window.currentArtPlayer && window.currentArtPlayer.refreshAudioTracks) {
                                                    window.currentArtPlayer.refreshAudioTracks();
                                                }
                                            });
                                        }
                                        art.on('destroy', () => {
                                            clearInterval(bufferCheck);
                                            hls.destroy();
                                        });
                                    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                                        video.src = url;
                                    } else {
                                        art.notice.show = 'No soporta reproducción HLS nativa en este navegador';
                                    }
                                }
                            };

                            if (data.direct_play) {
                                console.log("[DirectPlay] Reproduciendo formato nativo sin HLS");
                            }

                            art = new Artplayer(artConfig);

                            // Reanudar desde el progreso persistido cuando el stream ya tiene duración utilizable.
                            const pendingResumeSeconds = Number(window.krakenPendingResumeSeconds || 0);
                            window.krakenPendingResumeSeconds = 0;
                            if (pendingResumeSeconds > 5) {
                                let resumeTimer = null;
                                const applyPendingResume = () => {
                                    const media = art && art.video;
                                    const duration = Math.max(Number(data.duration || 0), Number(art?.duration || media?.duration || 0));
                                    const hlsReady = !art?.hls || art._hlsJumpedToZero;
                                    if (!media || !hlsReady || !Number.isFinite(duration) || duration <= pendingResumeSeconds + 1) return;
                                    // En HLS creciente, verificar que el buffer o la playlist ya alcance el punto de resume
                                    if (art.hls && Number(art?.duration || 0) < pendingResumeSeconds && !art._hlsEndedList) return;
                                    media.currentTime = Math.min(pendingResumeSeconds, Math.max(0, duration - 1));
                                    console.log('[VIDEO] Reanudado desde', Math.round(media.currentTime), 'segundos');
                                    if (resumeTimer) clearInterval(resumeTimer);
                                    resumeTimer = null;
                                };
                                resumeTimer = setInterval(applyPendingResume, 500);
                                setTimeout(() => {
                                    if (resumeTimer) clearInterval(resumeTimer);
                                    resumeTimer = null;
                                }, 60000);
                                art.on('destroy', () => {
                                    if (resumeTimer) clearInterval(resumeTimer);
                                });
                            }

                            // ═══════ CONTROL AUTO-HIDE UNIVERSAL (Móvil / Tablet / Desktop / Fullscreen) ═══════
                            if (art.template && art.template.$player) {
                                const playerEl = art.template.$player;
                                const backBtn = document.getElementById('krk-video-back-btn');
                                const topControls = document.getElementById('krk-video-top-right-controls');
                                const quickEmojis = document.getElementById('krk-watch-party-quick-emojis');
                                let _artControlsTimeout = null;
                                let _lastTouchTime = 0;
                                const ART_CONTROLS_DURATION = 3000;

                                const isChatDrawerOpen = () => {
                                    const drawer = document.getElementById('watch-party-chat-drawer');
                                    return drawer && !drawer.classList.contains('translate-x-full');
                                };

                                const hideAllPlayerControls = () => {
                                    if (!art || art.isDestroy) return;
                                    if (art.setting && art.setting.show) return;
                                    if (art.controls) {
                                        art.controls.isHover = false;
                                        if (art.controls.show) art.controls.show = false;
                                    }
                                    playerEl.classList.remove('art-control-show', 'art-hover');
                                    playerEl.classList.add('art-hide-cursor');
                                    if (backBtn) {
                                        backBtn.classList.add('opacity-0', 'pointer-events-none');
                                    }
                                    if (topControls && !isChatDrawerOpen()) {
                                        topControls.classList.add('opacity-0', 'pointer-events-none');
                                    }
                                    if (quickEmojis) {
                                        quickEmojis.classList.add('opacity-0', 'pointer-events-none');
                                    }
                                };

                                const scheduleAutoHide = (delay = ART_CONTROLS_DURATION) => {
                                    if (_artControlsTimeout) clearTimeout(_artControlsTimeout);
                                    _artControlsTimeout = setTimeout(() => {
                                        if (art && art.controls) art.controls.isHover = false;
                                        hideAllPlayerControls();
                                    }, delay);
                                };

                                const showAllPlayerControls = (delay = ART_CONTROLS_DURATION) => {
                                    if (!art || art.isDestroy) return;
                                    playerEl.classList.add('art-control-show', 'art-hover');
                                    playerEl.classList.remove('art-hide-cursor');
                                    if (backBtn) {
                                        backBtn.classList.remove('opacity-0', 'pointer-events-none');
                                    }
                                    if (topControls) {
                                        topControls.classList.remove('opacity-0', 'pointer-events-none');
                                    }
                                    if (quickEmojis && window.KRAKEN_SYNC_WATCH_PARTY) {
                                        quickEmojis.classList.remove('opacity-0', 'pointer-events-none');
                                    }
                                    scheduleAutoHide(delay);
                                };

                                // Sincronizar con el evento interno 'control' de ArtPlayer (evita pelear con su click/toggle nativo)
                                art.on('control', (state) => {
                                    if (state) {
                                        if (backBtn) backBtn.classList.remove('opacity-0', 'pointer-events-none');
                                        if (topControls) topControls.classList.remove('opacity-0', 'pointer-events-none');
                                        if (quickEmojis && window.KRAKEN_SYNC_WATCH_PARTY) quickEmojis.classList.remove('opacity-0', 'pointer-events-none');
                                        scheduleAutoHide(ART_CONTROLS_DURATION);
                                    } else {
                                        if (_artControlsTimeout) clearTimeout(_artControlsTimeout);
                                        playerEl.classList.remove('art-control-show', 'art-hover');
                                        playerEl.classList.add('art-hide-cursor');
                                        if (backBtn) backBtn.classList.add('opacity-0', 'pointer-events-none');
                                        if (topControls && !isChatDrawerOpen()) topControls.classList.add('opacity-0', 'pointer-events-none');
                                        if (quickEmojis) quickEmojis.classList.add('opacity-0', 'pointer-events-none');
                                    }
                                });

                                // Al entrar/salir de fullscreen, limpiar isHover pegado y ocultar rápido
                                art.on('fullscreen', () => {
                                    if (art.controls) art.controls.isHover = false;
                                    scheduleAutoHide(2000);
                                });
                                art.on('fullscreenWeb', () => {
                                    if (art.controls) art.controls.isHover = false;
                                    scheduleAutoHide(2000);
                                });

                                // En dispositivos táctiles (tablets/móviles), el navegador dispara un mousemove/mouseenter
                                // sintético unos ~50ms después de touchend que deja art.controls.isHover = true para siempre.
                                playerEl.addEventListener('touchend', () => {
                                    _lastTouchTime = Date.now();
                                    setTimeout(() => {
                                        if (!art || art.isDestroy) return;
                                        if (art.controls) art.controls.isHover = false;
                                        if (art.controls && art.controls.show) {
                                            scheduleAutoHide(ART_CONTROLS_DURATION);
                                        } else {
                                            hideAllPlayerControls();
                                        }
                                    }, 120);
                                }, { passive: true });

                                // Movimiento de mouse real en desktop/tablet con trackpad
                                playerEl.addEventListener('mousemove', () => {
                                    if (Date.now() - _lastTouchTime < 600) return;
                                    showAllPlayerControls(ART_CONTROLS_DURATION);
                                }, { passive: true });

                                // Iniciar temporizador al abrir el video
                                showAllPlayerControls(ART_CONTROLS_DURATION);

                                // ═══════ GESTOS TÁCTILES ESTILO YOUTUBE ═══════
                                // Doble toque izquierda = -10s, derecha = +10s (taps extra acumulan), centro = play/pausa
                                const SEEK_STEP = 10;
                                let _lastTapAt = 0, _lastTapZone = '', _seekAccum = 0, _seekAccumTimer = null;
                                const showTapFeedback = (zone, text) => {
                                    let fb = playerEl.querySelector('.krk-tap-feedback.' + zone);
                                    if (!fb) {
                                        fb = document.createElement('div');
                                        fb.className = 'krk-tap-feedback ' + zone;
                                        playerEl.appendChild(fb);
                                    }
                                    fb.innerHTML = text;
                                    fb.classList.remove('show');
                                    void fb.offsetWidth;
                                    fb.classList.add('show');
                                };
                                playerEl.addEventListener('touchend', (e) => {
                                    if (e.target.closest('.art-bottom, .art-settings, .art-contextmenus, .art-info, button, input, select')) return;
                                    const t = e.changedTouches && e.changedTouches[0];
                                    if (!t) return;
                                    const rect = playerEl.getBoundingClientRect();
                                    const x = (t.clientX - rect.left) / rect.width;
                                    const zone = x < 0.35 ? 'left' : (x > 0.65 ? 'right' : 'center');
                                    const now = Date.now();
                                    const isDouble = (now - _lastTapAt < 320) && (zone === _lastTapZone || _seekAccum > 0);
                                    _lastTapAt = now;
                                    _lastTapZone = zone;
                                    if (!isDouble) return;

                                    if (e.cancelable) e.preventDefault(); // evita el click sintético / toggle de controles
                                    if (zone === 'center') {
                                        if (art.playing) art.pause(); else art.play();
                                        showTapFeedback('center', art.playing ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-solid fa-pause"></i>');
                                        _lastTapAt = 0;
                                        return;
                                    }
                                    const dir = zone === 'left' ? -1 : 1;
                                    _seekAccum += SEEK_STEP;
                                    const dur = art.duration || Infinity;
                                    art.currentTime = Math.max(0, Math.min(dur - 0.5, (art.currentTime || 0) + dir * SEEK_STEP));
                                    showTapFeedback(zone, `<i class="fa-solid fa-${dir < 0 ? 'backward' : 'forward'}"></i><span>${dir < 0 ? '-' : '+'}${_seekAccum}s</span>`);
                                    if (_seekAccumTimer) clearTimeout(_seekAccumTimer);
                                    _seekAccumTimer = setTimeout(() => { _seekAccum = 0; _lastTapAt = 0; }, 700);
                                }, { passive: false });

                                art.on('destroy', () => {
                                    if (_artControlsTimeout) clearTimeout(_artControlsTimeout);
                                });
                            }

                            const controlsCenter = art.template && art.template.$player
                                ? art.template.$player.querySelector('.art-controls-center')
                                : null;
                            if (controlsCenter) {
                                controlsCenter.innerHTML = '';
                                const centerTitle = document.createElement('span');
                                centerTitle.className = 'krk-art-now-title';
                                centerTitle.textContent = currentMeta ? `${currentTitle} • ${currentMeta}` : currentTitle;
                                controlsCenter.appendChild(centerTitle);
                            }

                            const refreshAudioTracks = () => {
                                if (!art || !art.setting || typeof art.setting.update !== 'function') return;

                                let tracks = [];
                                let activeIndex = -1;
                                let mode = 'none';

                                if (art.hls && Array.isArray(art.hls.audioTracks) && art.hls.audioTracks.length > 0) {
                                    mode = 'hls';
                                    tracks = art.hls.audioTracks.map((track, index) => {
                                        const language = toHumanLanguage(track.lang || track.language || '');
                                        const label = String(track.name || track.label || '').trim();
                                        const codec = String(track.audioCodec || '').trim();
                                        const channels = Number(track.channels || 0);
                                        const channelLabel = channels >= 6 ? '5.1' : (channels > 0 ? `${channels}.0` : '');
                                        const resolved = label || language || `Audio ${index + 1}`;
                                        const details = [codec.toUpperCase(), channelLabel].filter(Boolean).join(' ');
                                        return {
                                            html: details ? `${resolved} (${details})` : resolved,
                                            value: index,
                                        };
                                    });
                                    activeIndex = typeof art.hls.audioTrack === 'number' ? art.hls.audioTrack : -1;
                                } else {
                                    const nativeTracks = art.video && art.video.audioTracks ? art.video.audioTracks : null;
                                    if (nativeTracks && nativeTracks.length > 1) {
                                        mode = 'native';
                                        tracks = Array.from(nativeTracks).map((track, index) => {
                                            const language = toHumanLanguage(track.language || '');
                                            const label = String(track.label || '').trim();
                                            const resolved = label || language || `Audio ${index + 1}`;
                                            if (track.enabled) activeIndex = index;
                                            return { html: resolved, value: index };
                                        });
                                    } else if (backendAudioTracks.length > 1) {
                                        mode = 'backend';
                                        tracks = backendAudioTracks.map((track, index) => ({
                                            html: buildAudioLabel(track, index),
                                            value: index,
                                        }));
                                        activeIndex = normalizeAudioIndex(selectedBackendAudio);
                                    }
                                }

                                if (tracks.length > 1) {
                                    tracks = dedupeAudioLabels(tracks);
                                }

                                if (tracks.length <= 1) {
                                    mode = 'none';
                                    tracks = [{ html: 'Default', value: -1, default: true }];
                                    activeIndex = -1;
                                }

                                const normalizedActive = tracks.some((item) => Number(item.value) === activeIndex)
                                    ? activeIndex
                                    : Number(tracks[0].value);
                                const activeLabel = (tracks.find((item) => Number(item.value) === normalizedActive) || tracks[0]).html;
                                const selector = tracks.map((item) => ({
                                    html: item.html,
                                    value: item.value,
                                    default: Number(item.value) === normalizedActive,
                                }));

                                art.setting.update({
                                    ...audioSettingBase,
                                    tooltip: activeLabel,
                                    selector,
                                });
                                art._krakenAudioMode = mode;
                            };

                            const hiddenLoader = () => {
                                if (loader) {
                                    loader.classList.add('opacity-0');
                                    setTimeout(() => loader.classList.add('hidden'), 300);
                                }
                            };

                            art.switchHlsAudioByRestart = async (targetIndex, targetLabel) => {
                                const normalized = normalizeAudioIndex(targetIndex);
                                if (normalized === normalizeAudioIndex(selectedBackendAudio)) return;
                                if (!file || (!file.id && !file.path)) return;

                                const previousTime = Number(art.currentTime || 0);
                                const wasPlaying = !art.paused;
                                const oldSid = data.session_id || sid;
                                const nextSid = Math.random().toString(36).substring(2, 12);
                                selectedBackendAudio = normalized;
                                if (loader) loader.classList.remove('hidden', 'opacity-0');

                                try {
                                    const idParam = mediaId ? `id=${encodeURIComponent(mediaId)}` : `file=${file.path.split('/').map(p => encodeURIComponent(p)).join('/')}`;
                                    const tokenParam = (data.token || streamToken) ? `&token=${encodeURIComponent(data.token || streamToken)}` : '';
                                    const resp = await fetch(`/api/hls/play?${idParam}${tokenParam}&sid=${nextSid}&audio_track=${normalized}`);
                                    const nextData = await resp.json().catch(() => ({}));
                                    if (!resp.ok) {
                                        throw new Error(nextData.error || `HTTP ${resp.status}`);
                                    }
                                    if (nextData.error || !nextData.url) {
                                        throw new Error(nextData.error || 'No se pudo cambiar el audio');
                                    }

                                    if (oldSid && oldSid !== nextData.session_id) {
                                        fetch(`/api/hls/stop?sid=${oldSid}`, { method: 'POST' }).catch(() => { });
                                    }
                                    data.session_id = nextData.session_id || nextSid;

                                    backendAudioTracks = Array.isArray(nextData.audio_tracks) ? nextData.audio_tracks : backendAudioTracks;
                                    selectedBackendAudio = Number.isInteger(nextData.selected_audio_track)
                                        ? nextData.selected_audio_track
                                        : normalized;

                                    if (previousTime > 2) {
                                        window.krakenPendingResumeSeconds = previousTime;
                                    }
                                    const nextFullUrl = nextData.url.startsWith('/') ? (window.location.origin + nextData.url) : nextData.url;
                                    if (typeof art.switchUrl === 'function') {
                                        art.switchUrl(nextFullUrl);
                                    } else {
                                        art.url = nextFullUrl;
                                    }

                                    const restorePlayback = () => {
                                        try {
                                            if (previousTime > 0 && (!art.hls || art.duration >= previousTime)) {
                                                art.currentTime = previousTime;
                                            }
                                        } catch (_) { }
                                        if (wasPlaying) art.play().catch(() => { });
                                        hiddenLoader();
                                        refreshAudioTracks();
                                        art.off('video:canplay', restorePlayback);
                                    };

                                    art.on('video:canplay', restorePlayback);
                                    setTimeout(() => {
                                        hiddenLoader();
                                        refreshAudioTracks();
                                    }, 2000);

                                    showToast(`🎵 Audio: ${targetLabel || 'cambiado'}`, 'success');
                                } catch (error) {
                                    console.error('Error cambiando audio HLS:', error);
                                    const message = error && error.message ? error.message : 'No se pudo cambiar el audio';
                                    showToast(`No se pudo cambiar el audio: ${message}`, 'error');
                                    hiddenLoader();
                                    refreshAudioTracks();
                                }
                            };

                            art.refreshAudioTracks = refreshAudioTracks;
                            refreshAudioTracks();

                            if (art.video && art.video.audioTracks && typeof art.video.audioTracks.addEventListener === 'function') {
                                art.video.audioTracks.addEventListener('change', refreshAudioTracks);
                            }

                            art.on('ready', () => {
                                refreshAudioTracks();
                                art.on('video:play', () => {
                                    if (typeof broadcastWatchPartySync === 'function') broadcastWatchPartySync('play', art.currentTime);
                                });
                                art.on('video:pause', () => {
                                    if (typeof broadcastWatchPartySync === 'function') broadcastWatchPartySync('pause', art.currentTime);
                                });
                                art.on('video:seeked', () => {
                                    if (typeof broadcastWatchPartySync === 'function') broadcastWatchPartySync('seek', art.currentTime);
                                });
                                // Aplicar preferencias de velocidad y volumen por defecto
                                const rate = Number(getVideoPrefs().defaultRate != null ? getVideoPrefs().defaultRate : 1);
                                if (rate && rate !== 1) { try { art.playbackRate = rate; } catch (e) { } }
                            });

                            // Volumen con rueda del ratón
                            container.addEventListener('wheel', (e) => {
                                e.preventDefault();
                                const delta = e.deltaY < 0 ? 0.05 : -0.05;
                                const newVol = Math.min(1, Math.max(0, art.volume + delta));
                                art.volume = newVol;
                                art.notice.show = `Volumen: ${Math.round(newVol * 100)}%`;
                            }, { passive: false });

                            // Pantalla de carga inteligente (solo para HLS, no direct play)
                            if (!data.direct_play) {
                                // Polling de segmentos HLS - solo ocultar loader, playback lo controla el m3u8 handler
                                const sid = data.session_id;
                                let bufferPoller = setInterval(() => {
                                    fetch(`/api/hls/status?sid=${sid}`)
                                        .then(r => r.json())
                                        .then(s => {
                                            // El loader ya lo oculta el flujo de reproduccion (hideLoaderOnPlay).
                                            // Aqui solo detenemos el poller cuando la sesion ya esta lista para
                                            // no pegarle al servidor de mas.
                                            if (s.ready) {
                                                clearInterval(bufferPoller);
                                            }
                                        })
                                        .catch(() => clearInterval(bufferPoller));
                                }, 1000);
                            } else {
                                // Direct play: ocultar loader al estar listo
                                art.on('ready', hiddenLoader);
                            }

                            // No avanzar si el video nunca llegó a reproducirse. HLS puede emitir
                            // estados finales durante un fallo de carga o una reconexión.
                            let _videoPlaybackStarted = false;
                            art.on('play', () => { _videoPlaybackStarted = true; });
art.on('ended', () => {
                                if (!_videoPlaybackStarted || _endedTriggered) return;
                                _endedTriggered = true;
                                stopProgressTracking();
                                if (getVideoPrefs().autonext !== false) playNext();
                            });

                            // ═══════ KEEPALIVE PING para sesión HLS (evita cleanup por inactividad) ═══════
                            let _hlsKeepaliveInterval = null;
                            const _currentHlsSessionId = data.session_id;
                            const _currentMediaId = file.id || null;
                            const _currentToken = data.token || null;

                            /**
                             * `startHlsKeepalive()`
                             * Inicia el envío periódico de latidos (`/api/hls/keepalive`) para mantener viva la sesión FFmpeg.
                             */
                            function startHlsKeepalive() {
                                if (_hlsKeepaliveInterval) return;
                                _hlsKeepaliveInterval = setInterval(async () => {
                                    if (!_currentHlsSessionId) return;
                                    try {
                                        const res = await fetch(`/api/hls/status?sid=${_currentHlsSessionId}`);
                                        const status = await res.json();
                                        if (!status.alive) {
                                            // Sesión murió — limpiar keepalive
                                            stopHlsKeepalive();
                                            console.warn('[HLS] Sesión expirada, keepalive detenido');
                                        }
                                    } catch (e) { /* silenciar errores de red durante pausa */ }
                                }, 60000); // Cada 60 segundos
                            }

                            /**
                             * `stopHlsKeepalive()`
                             * Detiene el temporizador de keepalive de la sesión HLS activa.
                             */
                            function stopHlsKeepalive() {
                                if (_hlsKeepaliveInterval) {
                                    clearInterval(_hlsKeepaliveInterval);
                                    _hlsKeepaliveInterval = null;
                                }
                            }

                            // Iniciar keepalive solo cuando está pausado
                            art.on('pause', () => { startHlsKeepalive(); });
                            art.on('play', () => { stopHlsKeepalive(); });
                            // También iniciar si empieza directamente en play
                            startHlsKeepalive(); // Si está pausado ya, el ping mantendrá viva la sesión

                            // ═══════ RECONEXIÓN HLS cuando el stream se cae ═══════
                            let _reconnecting = false;
                            art.on('error', async (error) => {
                                const errorMsg = (error && error.message) || String(error || '');
                                const isHlsError = errorMsg.toLowerCase().includes('network') ||
                                    errorMsg.toLowerCase().includes('manifest') ||
                                    errorMsg.toLowerCase().includes('timeout') ||
                                    errorMsg.toLowerCase().includes('403') ||
                                    errorMsg.toLowerCase().includes('404');

                                if (!isHlsError || _reconnecting) return;
                                _reconnecting = true;
                                console.warn('[HLS] Error detectado, intentando reconexión...', errorMsg);

                                // Mostrar overlay de reconexión
                                const existingOverlay = document.getElementById('hls-reconnect-overlay');
                                if (existingOverlay) existingOverlay.remove();

                                const overlay = document.createElement('div');
                                overlay.id = 'hls-reconnect-overlay';
                                overlay.style.cssText = `
                                    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                                    z-index: 99999; background: rgba(0,0,0,0.9); backdrop-filter: blur(16px);
                                    border: 1px solid rgba(16,185,129,0.5); border-radius: 16px;
                                    padding: 24px 32px; text-align: center; min-width: 280px;
                                    box-shadow: 0 12px 48px rgba(0,0,0,0.7);
                                `;
                                overlay.innerHTML = `
                                    <div style="color: white; margin-bottom: 16px;">
                                        <div style="font-size: 32px; margin-bottom: 8px;">📡</div>
                                        <div style="font-size: 16px; font-weight: 700; margin-bottom: 4px;">Conexión perdida</div>
                                        <div style="font-size: 12px; color: #a1a1aa;">La sesión HLS expiró por inactividad</div>
                                    </div>
                                    <button id="hls-reconnect-btn" style="
                                        background: linear-gradient(135deg, #10b981, #059669);
                                        color: white; border: none; border-radius: 8px;
                                        padding: 10px 24px; font-size: 14px; font-weight: 600;
                                        cursor: pointer; width: 100%;
                                    ">Reconectar</button>
                                `;
                                art.template.$container.appendChild(overlay);

                                document.getElementById('hls-reconnect-btn').addEventListener('click', async () => {
                                    const btn = document.getElementById('hls-reconnect-btn');
                                    btn.textContent = 'Reconectando...';
                                    btn.disabled = true;

                                    try {
                                        const res = await fetch('/api/hls/reconnect', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                old_session_id: _currentHlsSessionId,
                                                token: _currentToken,
                                                media_id: _currentMediaId,
                                                audio_track: data.selected_audio_track || null
                                            })
                                        });

                                        const newData = await res.json();
                                        if (!res.ok) throw new Error(newData.error || 'Reconexión fallida');

                                        console.log('[HLS] Reconexión exitosa, nueva sesión:', newData.session_id);

                                        // Actualizar URL del reproductor
                                        const newUrl = newData.url.startsWith('/')
                                            ? (window.location.origin + newData.url)
                                            : newData.url;
                                        art.switchUrl(newUrl);

                                        if (newData.token) {
                                            // Actualizar token si cambió
                                        }

                                        overlay.remove();
                                        _reconnecting = false;

                                        // Reiniciar keepalive con nueva sesión
                                        stopHlsKeepalive();
                                        // El nuevo session_id no se almacena aquí, pero el keepalive
                                        // ya no es crítico porque el usuario acaba de reconectar
                                    } catch (err) {
                                        console.error('[HLS] Reconexión fallida:', err);
                                        btn.textContent = 'Error — cerrar y reabrir';
                                        btn.style.background = '#ef4444';
                                    }
                                });
                            });

                            // Safety net: timeupdate backup para HLS streams que no disparan ended
                            let _endedTriggered = false;
                            let _watchStartedAt = Date.now(); // Timestamp de inicio de reproduccion

                            // ═══════ OVERLAY "SIGUIENTE EPISODIO" ESTILO NETFLIX ═══════
                            let _nextEpShown = false;
                            let _nextEpCountdown = null;
                            const NEXT_EP_SECONDS = 15; // Mostrar 15s antes del final

                            /**
                             * `showNextEpisodeOverlay()`
                             * Muestra el botón flotante de 'Siguiente episodio' al acercarse al final de un capítulo.
                             */
                            function showNextEpisodeOverlay() {
                                if (_nextEpShown) return;
                                const nextIdx = currentTrackIndex + 1;
                                if (nextIdx >= playerQueue.length) return; // No hay siguiente
                                const nextFile = playerQueue[nextIdx];
                                if (!nextFile) return;
                                const isVid = nextFile.type === 'video' || (nextFile.path && (nextFile.path.endsWith('.mp4') || nextFile.path.endsWith('.mkv') || nextFile.path.endsWith('.avi') || nextFile.path.endsWith('.webm')));
                                if (!isVid) return;

                                _nextEpShown = true;
                                const nextTitle = nextFile.title || nextFile.path.split('/').pop().replace(/\.[^.]+$/, '');

                                // Crear el overlay
                                const overlay = document.createElement('div');
                                overlay.id = 'next-ep-overlay';
                                overlay.style.cssText = `
                                    position: absolute; bottom: 80px; right: 20px; z-index: 9998;
                                    background: rgba(0,0,0,0.85); backdrop-filter: blur(12px);
                                    border: 1px solid rgba(16,185,129,0.4); border-radius: 12px;
                                    padding: 14px 20px; min-width: 220px; max-width: 320px;
                                    animation: slideInRight 0.4s ease-out;
                                    cursor: pointer; transition: all 0.2s;
                                    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
                                `;
                                overlay.innerHTML = `
                                    <div style="display:flex; align-items:center; gap:12px;">
                                        <div style="flex:1; min-width:0;">
                                            <div style="font-size:10px; color:#10b981; font-weight:800; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:4px;">
                                                Siguiente Episodio
                                            </div>
                                            <div style="font-size:13px; color:white; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                                ${nextTitle}
                                            </div>
                                            <div id="next-ep-countdown" style="font-size:10px; color:#a1a1aa; margin-top:4px;">
                                                Reproduciendo en <span id="next-ep-seconds" style="color:#10b981; font-weight:bold;">${NEXT_EP_SECONDS}</span>s
                                            </div>
                                        </div>
                                        <div style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; background:linear-gradient(135deg,#10b981,#059669); border-radius:50%; flex-shrink:0;">
                                            <i class="fa-solid fa-forward-step" style="color:white; font-size:14px;"></i>
                                        </div>
                                    </div>
                                    <div style="margin-top:8px; height:3px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;">
                                        <div id="next-ep-progress" style="height:100%; background:#10b981; width:100%; transition: width linear;"></div>
                                    </div>
                                `;

                                // Eventos del overlay
                                overlay.addEventListener('click', () => {
                                    clearInterval(_nextEpCountdown);
                                    removeNextEpOverlay();
                                    _endedTriggered = true;
                                    stopProgressTracking();
                                    playNext();
                                });
                                overlay.addEventListener('mouseenter', () => {
                                    overlay.style.borderColor = 'rgba(16,185,129,0.8)';
                                    overlay.style.transform = 'scale(1.02)';
                                });
                                overlay.addEventListener('mouseleave', () => {
                                    overlay.style.borderColor = 'rgba(16,185,129,0.4)';
                                    overlay.style.transform = 'scale(1)';
                                });

                                // Insertar en el container de ArtPlayer
                                const artContainer = document.getElementById('artplayer-container');
                                if (artContainer) artContainer.appendChild(overlay);

                                // Countdown
                                let secondsLeft = NEXT_EP_SECONDS;
                                _nextEpCountdown = setInterval(() => {
                                    secondsLeft--;
                                    const secEl = document.getElementById('next-ep-seconds');
                                    const progEl = document.getElementById('next-ep-progress');
                                    if (secEl) secEl.textContent = secondsLeft;
                                    if (progEl) progEl.style.width = `${(secondsLeft / NEXT_EP_SECONDS) * 100}%`;
                                    if (secondsLeft <= 0) {
                                        clearInterval(_nextEpCountdown);
                                        removeNextEpOverlay();
                                        _endedTriggered = true;
                                        stopProgressTracking();
                                        playNext();
                                    }
                                }, 1000);
                            }

                            /**
                             * `removeNextEpOverlay()`
                             * Elimina de pantalla la superposición de siguiente episodio.
                             */
                            function removeNextEpOverlay() {
                                const el = document.getElementById('next-ep-overlay');
                                if (el) el.remove();
                                if (_nextEpCountdown) clearInterval(_nextEpCountdown);
                            }

                            // Inyectar CSS de animación si no existe
                            if (!document.getElementById('next-ep-css')) {
                                const style = document.createElement('style');
                                style.id = 'next-ep-css';
                                style.textContent = `
                                    @keyframes slideInRight {
                                        from { transform: translateX(100px); opacity: 0; }
                                        to { transform: translateX(0); opacity: 1; }
                                    }
                                `;
                                document.head.appendChild(style);
                            }

                            const formatVideoClock = (secs) => {
                                const total = Math.max(0, Math.floor(Number(secs) || 0));
                                const hrs = Math.floor(total / 3600);
                                const mins = Math.floor((total % 3600) / 60);
                                const rem = total % 60;
                                const pad = (n) => (n < 10 ? '0' + n : String(n));
                                return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(rem)}` : `${pad(mins)}:${pad(rem)}`;
                            };

                            art.on('video:timeupdate', () => {
                                if (_endedTriggered) return;

                                const knownTotalDuration = Number(data.duration || file.duration || 0);
                                const streamDuration = Number(art.duration || 0);
                                const effectiveDuration = Math.max(knownTotalDuration, streamDuration);

                                // Si el stream es HLS creciente y conocemos la duración real de la película/episodio,
                                // mostrar la duración real en el reloj del reproductor en lugar de la duración parcial del buffer.
                                if (knownTotalDuration > 0 && streamDuration > 0 && knownTotalDuration > streamDuration + 5) {
                                    const timeEl = art.template && art.template.$time;
                                    if (timeEl) {
                                        timeEl.textContent = `${formatVideoClock(art.currentTime)} / ${formatVideoClock(knownTotalDuration)}`;
                                    }
                                }

                                // En modo HLS sin duración conocida en DB, esperar a que la playlist tenga #EXT-X-ENDLIST
                                const canCheckEnd = !art.hls || knownTotalDuration > 30 || art._hlsEndedList;

                                // Mostrar overlay de siguiente episodio usando la duración real total
                                if (canCheckEnd && effectiveDuration > 30 && art.currentTime >= effectiveDuration - NEXT_EP_SECONDS && !_nextEpShown) {
                                    showNextEpisodeOverlay();
                                }

                                // Safety net: auto-avance si el video llega al final real sin disparar ended
                                if (canCheckEnd && _videoPlaybackStarted && effectiveDuration > 30 && art.currentTime >= effectiveDuration - 0.5 && (Date.now() - _watchStartedAt) >= 30000) {
                                    _endedTriggered = true;
                                    removeNextEpOverlay();
                                    console.log('[ArtPlayer] timeupdate safety -> near end, triggering playNext');
                                    setTimeout(() => { stopProgressTracking(); playNext(); }, 1000);
                                }
                            });

                            // Guardar referencia para cleanup
                            window.currentArtPlayer = art;

                            // Start progress tracking heartbeat (every 10s)
                            if (typeof startProgressTracking === 'function' && file.id) {
                                startProgressTracking(file.id, art);
                            }

                            // Cleanup al cerrar
                            window.cleanupVideo = () => {
                                stopHlsKeepalive();
                                stopProgressTracking();
                                if (window.currentArtPlayer) {
                                    fetch(`/api/hls/stop?sid=${data.session_id}`, { method: 'POST' }).catch(() => { });
                                    window.currentArtPlayer.destroy();
                                    window.currentArtPlayer = null;
                                }
                            };
                        }
                    })
                    .catch(err => {
                        console.error("Error con HLS:", err);
                        showFallbackPlayer(screen, videoPath, file);
                    });

                updateQueueUI();
            }

            // Fallback directo sin HLS
            /**
             * `showFallbackPlayer(screen, videoPath, file)`
             * Activa el reproductor `<video>` nativo de respaldo si ArtPlayer no está disponible.
             */
            function showFallbackPlayer(screen, videoPath, file) {
                const screenEl = screen || document.getElementById('artplayer-container');
                if (screenEl) {
                    const rawPath = String(videoPath || '');
                    const resolvedSrc = rawPath.startsWith('/descargas/') || rawPath.startsWith('http')
                        ? rawPath
                        : `/descargas/${rawPath.replace(/^\/+/, '')}`;
                    screenEl.innerHTML = `
                        <video id="main-video"
                               src="${resolvedSrc}"
                               preload="auto"
                               playsinline
                               crossorigin="anonymous"
                               class="w-full h-full bg-black"
                               style="object-fit: contain; max-width: 100vw; max-height: 100vh;">
                        </video>`;
                }
                fallbackVideoSetup(file);
            }

            // Función de fallback para cuando HLS falla
            /**
             * `fallbackVideoSetup(file)`
             * Configura eventos y pistas en el reproductor de video nativo de respaldo.
             */
            function fallbackVideoSetup(file) {

                // Asegurar que la UI nativa se muestre si caemos en el fallback
                document.querySelectorAll('.cine-controls, .cine-header, #dt-left, #dt-right, #dt-center').forEach(el => {
                    if (el) el.classList.remove('hidden');
                });

                const videoEl = document.getElementById('main-video');
                if (videoEl) {
                    // Start progress tracking in fallback mode too (same heartbeat every 10s)
                    if (typeof startProgressTracking === 'function' && file && file.id) {
                        startProgressTracking(file.id, videoEl);
                    }

                    const loader = document.getElementById('video-loader');
                    const pbPlayed = document.getElementById('video-played-bar');
                    const pbBuffered = document.getElementById('video-buffered-bar');
                    if (pbPlayed) pbPlayed.style.width = '0%';
                    if (pbBuffered) pbBuffered.style.width = '0%';

                    videoEl.addEventListener('progress', updateLoadProgress);
                    videoEl.addEventListener('canplay', () => {
                        if (loader) {
                            loader.classList.add('opacity-0');
                            setTimeout(() => loader.classList.add('hidden'), 300);
                        }
                    });
                    videoEl.addEventListener('loadedmetadata', function () {
                        const aspectRatio = this.videoWidth / this.videoHeight;
                        const isMobile = window.innerWidth < 768;
                        if (isMobile) {
                            this.style.width = '100vw';
                            this.style.height = '100vh';
                            this.style.objectFit = aspectRatio < 1.2 ? 'cover' : 'contain';
                        } else {
                            this.style.objectFit = aspectRatio < 1.2 ? 'cover' : 'contain';
                        }
                        const progBar = document.getElementById('video-progress');
                        if (progBar) progBar.max = this.duration;
                        const timeTotal = document.getElementById('video-time-total');
                        if (timeTotal) timeTotal.innerText = formatTime(this.duration);
                        setTimeout(() => detectAudioAndSubtitles(), 500);
                    });
                    videoEl.addEventListener('contextmenu', (e) => {
                        if (!e.ctrlKey) {
                            e.preventDefault();
                            toggleVideoSettings(true);
                        }
                    });
                    videoEl.addEventListener('timeupdate', updateVideoProgress);
                    videoEl.onended = () => { stopProgressTracking(); playNext(); };
                    videoEl.volume = parseFloat(localStorage.getItem('vortex_vol') || '1');
                    if (window.innerWidth < 768) {
                        document.body.style.overflow = 'hidden';
                    }
                    videoEl.play().catch(() => {
                        if (loader) {
                            loader.classList.add('opacity-0');
                            setTimeout(() => loader.classList.add('hidden'), 300);
                        }
                    });
                    let hasPlaybackError = false;
                    videoEl.onerror = () => {
                        hasPlaybackError = true;
                        if (loader) {
                            loader.classList.add('opacity-0');
                            setTimeout(() => loader.classList.add('hidden'), 300);
                        }
                        console.error("Video error code:", videoEl.error?.code, "message:", videoEl.error?.message);
                        showToast("Este video no es compatible con este navegador. Prueba en Chrome.", "error");
                    };
                    videoEl.onloadedmetadata = () => {
                        setTimeout(() => {
                            if (!hasPlaybackError && (videoEl.videoWidth === 0 || videoEl.videoHeight === 0)) {
                                showToast("No se pudo cargar el video. Prueba en Chrome.", "error");
                            }
                        }, 1000);
                    };
                    setupMobileControlsToggle();
                }
            }

            // Actualizar progreso de carga del video
            /**
             * `updateLoadProgress()`
             * Actualiza el indicador porcentual de carga del buffer de video.
             */
            function updateLoadProgress() {
                const video = document.getElementById('main-video');
                if (!video || !video.buffered.length) return;

                const percent = (video.buffered.end(video.buffered.length - 1) / video.duration) * 100;

                // Actualizar círculo de progreso (loader)
                const circle = document.getElementById('video-load-progress');
                const percentText = document.getElementById('video-load-percent');

                if (circle) {
                    const circumference = 264; // 2 * PI * 42
                    const offset = circumference - (percent / 100) * circumference;
                    circle.style.strokeDashoffset = offset;
                }

                if (percentText) {
                    percentText.innerText = Math.round(percent) + '%';
                }

                // Actualizar barra buffereada en el reproductor (Netflix style)
                const bufferedBar = document.getElementById('video-buffered-bar');
                if (bufferedBar) {
                    bufferedBar.style.width = Math.min(percent, 100) + '%';
                }
            }

            // Detectar pistas de audio y subtítulos (MEJORADO CON API)
            /**
             * `detectAudioAndSubtitles()`
             * Consulta las pistas de audio y subtítulos disponibles para el video actual.
             */
            async function detectAudioAndSubtitles() {
                const video = document.getElementById('main-video');
                if (!video) return;

                const audioList = document.getElementById('audio-tracks-list');
                const subtitleList = document.getElementById('subtitle-tracks-list');

                // Limpiar listas
                if (audioList) audioList.innerHTML = '';
                if (subtitleList) subtitleList.innerHTML = `
                    <button onclick="selectSubtitle(-1)" class="w-full text-left px-4 py-3 rounded-xl hover:bg-white/10 transition active flex items-center justify-between group" id="subtitle-none">
                        <span>Apagados</span>
                        <i class="fa-solid fa-check opacity-0 group-[.active]:opacity-100 text-emerald-500"></i>
                    </button>`;

                // Obtener ruta del video actual desde playerQueue
                const currentFile = playerQueue[currentTrackIndex];
                if (!currentFile) return;

                try {
                    // Llamar al backend para obtener streams
                    const response = await fetch('/api/video/streams', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: currentFile.path })
                    });

                    const data = await response.json();

                    if (!data.ok) {
                        console.warn('No se pudieron detectar streams:', data.error);
                        return;
                    }

                    const { audio, subtitles } = data.streams;

                    // Renderizar pistas de audio
                    if (audio && audio.length > 0) {
                        audio.forEach((track, i) => {
                            const langLabel = {
                                'spa': 'Español (Latino/España)',
                                'eng': 'Idioma Original (Inglés)',
                                'jpn': 'Japonés',
                                'kor': 'Coreano',
                                'und': `Pista de Audio ${i + 1}`
                            }[track.language] || track.title || `Audio ${i + 1}`;

                            const btn = document.createElement('button');
                            btn.onclick = () => switchAudioTrack(track.index, i);
                            btn.className = `w-full text-left px-4 py-3 rounded-xl hover:bg-white/10 transition flex items-center justify-between group ${i === 0 ? 'active' : ''}`;
                            btn.id = `audio-btn-${i}`;
                            btn.innerHTML = `
                                <span>${langLabel}</span>
                                <i class="fa-solid fa-check opacity-0 group-[.active]:opacity-100 text-emerald-500"></i>
                            `;

                            if (audioList) audioList.appendChild(btn);
                        });
                    } else {
                        if (audioList) audioList.innerHTML = '<p class="text-white/40 text-sm px-4">Audio principal</p>';
                    }

                    // Renderizar subtítulos
                    if (subtitles && subtitles.length > 0) {
                        subtitles.forEach((track, i) => {
                            const langLabel = {
                                'spa': 'Español (CC)',
                                'eng': 'Inglés',
                                'jpn': 'Japonés',
                                'und': `Subtítulo ${i + 1}`
                            }[track.language] || track.title || `Subtítulo ${i + 1}`;

                            const finalLabel = track.external ? `Externo · ${langLabel}` : langLabel;

                            const btn = document.createElement('button');
                            btn.onclick = () => switchSubtitleTrack(track, i);
                            btn.id = `subtitle-btn-${i}`;
                            btn.className = `w-full text-left px-4 py-3 rounded-xl hover:bg-white/10 transition flex items-center justify-between group`;
                            btn.innerHTML = `
                                <span>${finalLabel}</span>
                                <i class="fa-solid fa-check opacity-0 group-[.active]:opacity-100 text-emerald-500"></i>
                            `;

                            if (subtitleList) subtitleList.appendChild(btn);
                        });
                    }
                } catch (e) {
                    console.error('Error detectando streams:', e);
                }

                // Fallback: Intentar con API nativa del navegador
                detectNativeTracks();
            }

            // Fallback para navegadores que soportan audioTracks
            /**
             * `detectNativeTracks()`
             * Inspecciona pistas de audio y texto nativas del elemento `<video>`.
             */
            function detectNativeTracks() {
                const video = document.getElementById('main-video');
                if (!video) return;

                const audioList = document.getElementById('audio-tracks-list');

                // Solo si ya no hay nada renderizado
                if (audioList && (audioList.children.length === 0 || audioList.innerHTML.includes('Audio principal'))) {
                    const audioTracks = video.audioTracks;
                    if (audioTracks && audioTracks.length > 1) {
                        audioList.innerHTML = '';
                        for (let i = 0; i < audioTracks.length; i++) {
                            const track = audioTracks[i];
                            const label = track.label || track.language || `Audio ${i + 1}`;
                            const isActive = track.enabled;

                            const btn = document.createElement('button');
                            btn.onclick = () => selectAudioTrack(i);
                            btn.className = `w-full text-left px-4 py-3 rounded-xl hover:bg-white/10 transition flex items-center justify-between group ${isActive ? 'active' : ''}`;
                            btn.id = `audio-native-${i}`;
                            btn.innerHTML = `
                                <span>${label}</span>
                                <i class="fa-solid fa-check opacity-0 group-[.active]:opacity-100 text-emerald-500"></i>
                            `;

                            audioList.appendChild(btn);
                        }
                    }
                }
            }

            // Cambiar pista de audio (requiere recargar el video con parámetro)
            /**
             * `switchAudioTrack(streamIndex, uiIndex)`
             * Cambia la pista de audio activa en la sesión de transcodificación HLS o reproductor.
             */
            async function switchAudioTrack(streamIndex, uiIndex) {
                const video = document.getElementById('main-video');
                if (!video) return;

                const currentFile = playerQueue[currentTrackIndex];
                if (!currentFile) return;

                const currentTime = video.currentTime;
                const wasPlaying = !video.paused;

                // Mostrar loader corto
                const loader = document.getElementById('video-loader');
                if (loader) loader.classList.remove('hidden', 'opacity-0');

                // Recargar video con stream específico
                const videoPath = currentFile.path.split('/').map(p => encodeURIComponent(p)).join('/');
                video.src = `/descargas/${videoPath}#t=${currentTime}&audio_track=${streamIndex}`;

                video.load();

                video.addEventListener('loadedmetadata', function seek() {
                    video.currentTime = currentTime;
                    if (wasPlaying) video.play();

                    if (loader) {
                        loader.classList.add('opacity-0');
                        setTimeout(() => loader.classList.add('hidden'), 300);
                    }
                    video.removeEventListener('loadedmetadata', seek);
                });

                // Actualizar UI
                document.querySelectorAll('[id^="audio-btn-"]').forEach(btn => btn.classList.remove('active'));
                const btn = document.getElementById(`audio-btn-${uiIndex}`);
                if (btn) btn.classList.add('active');

                // Cerrar modal automáticamente
                setTimeout(() => toggleVideoSettings(false), 300);
                showToast('🎵 Cambiando audio...', 'info');
            }

            // Cambiar subtítulos
            /**
             * `switchSubtitleTrack(track, uiIndex)`
             * Cambia la pista de subtítulos activa o los desactiva.
             */
            function switchSubtitleTrack(track, uiIndex) {
                const video = document.getElementById('main-video');
                if (!video || !track) return;

                document.querySelectorAll('[id^="subtitle-btn-"]').forEach(btn => btn.classList.remove('active'));
                const noneBtn = document.getElementById('subtitle-none');
                if (noneBtn) noneBtn.classList.remove('active');

                if (track.external && track.url) {
                    const existingExternal = document.getElementById('external-subtitle-track');
                    if (existingExternal) existingExternal.remove();

                    const externalTrack = document.createElement('track');
                    externalTrack.id = 'external-subtitle-track';
                    externalTrack.kind = 'subtitles';
                    externalTrack.label = track.title || 'Subtítulo externo';
                    externalTrack.srclang = (track.language || 'und').slice(0, 2);
                    externalTrack.src = track.url;
                    video.appendChild(externalTrack);

                    const applyExternal = () => {
                        for (let i = 0; i < video.textTracks.length; i++) {
                            video.textTracks[i].mode = 'hidden';
                        }
                        const externalIndex = Math.max(0, video.textTracks.length - 1);
                        video.textTracks[externalIndex].mode = 'showing';
                        const activeBtn = document.getElementById(`subtitle-btn-${uiIndex}`);
                        if (activeBtn) activeBtn.classList.add('active');
                        showToast('Subtítulo externo activado', 'success');
                    };

                    externalTrack.addEventListener('load', applyExternal, { once: true });
                    setTimeout(applyExternal, 250);
                } else {
                    showToast('Los subtítulos incrustados no siempre son compatibles con navegador.', 'warning');
                }

                setTimeout(() => toggleVideoSettings(false), 300);
            }

            // Seleccionar pista de audio nativa
            /**
             * `selectAudioTrack(index)`
             * Selecciona una pista de audio desde el modal de ajustes de video.
             */
            function selectAudioTrack(index) {
                const video = document.getElementById('main-video');
                if (!video || !video.audioTracks) return;

                // Desactivar todas
                for (let i = 0; i < video.audioTracks.length; i++) {
                    video.audioTracks[i].enabled = (i === index);
                    const btn = document.getElementById(`audio-native-${i}`);
                    if (btn) btn.classList.toggle('active', i === index);
                }

                setTimeout(() => toggleVideoSettings(false), 300);
                showToast(`Audio cambiado: ${video.audioTracks[index].label || 'Audio ' + (index + 1)}`, 'success');
            }

            // Seleccionar subtítulos nativos
            /**
             * `selectSubtitle(index)`
             * Selecciona un subtítulo desde el modal de ajustes de video.
             */
            function selectSubtitle(index) {
                const video = document.getElementById('main-video');
                if (!video || !video.textTracks) return;

                // Desactivar todos
                for (let i = 0; i < video.textTracks.length; i++) {
                    video.textTracks[i].mode = 'hidden';
                    const btn = document.getElementById(`subtitle-btn-${i}`);
                    if (btn) btn.classList.remove('active');
                }

                // Activar el seleccionado
                const noneBtn = document.getElementById('subtitle-none');
                if (index === -1) {
                    if (noneBtn) noneBtn.classList.add('active');
                    showToast('Subtítulos desactivados', 'info');
                } else {
                    video.textTracks[index].mode = 'showing';
                    const btn = document.getElementById(`subtitle-btn-${index}`);
                    if (btn) btn.classList.add('active');
                    if (noneBtn) noneBtn.classList.remove('active');
                    showToast(`Subtítulos activados`, 'success');
                }

                setTimeout(() => toggleVideoSettings(false), 300);
            }

            // Toggle menú de configuración Netflix Style
            /**
             * `toggleVideoSettings(show = true)`
             * Abre o cierra el modal de selección de audio y subtítulos durante la reproducción.
             */
            function toggleVideoSettings(show = true) {
                const modal = document.getElementById('audio-subtitle-modal');
                const panel = document.getElementById('audio-subtitle-panel');
                if (!modal || !panel) return;

                if (show) {
                    // Pausar auto-hide temporalmente
                    if (typeof window.showControls === 'function') {
                        window.showControls();
                    }
                    modal.classList.remove('hidden');
                    // Timeout para permitir que el display:block se aplique antes de animar opacidad
                    setTimeout(() => {
                        modal.classList.remove('opacity-0');
                        modal.style.pointerEvents = 'auto';
                        panel.classList.remove('translate-y-full', 'translate-y-24');
                    }, 10);
                } else {
                    modal.classList.add('opacity-0');
                    modal.style.pointerEvents = 'none';
                    if (window.innerWidth < 768) {
                        panel.classList.add('translate-y-full'); // Mobil pull-down
                    } else {
                        panel.classList.add('translate-y-24'); // Desktop fade-down
                    }

                    setTimeout(() => {
                        modal.classList.add('hidden');
                        if (typeof window.showControls === 'function') window.showControls();
                    }, 300);
                }
            }

            // ═══════ TOGGLE CONTROLES DEL CINE (touch + mouse) ═══════
            let _cineControlsTimeout = null;
            const CINE_CONTROLS_DURATION = 4000; // 4 segundos

            /**
             * `showCineControls()`
             * Muestra temporalmente los controles del reproductor de cine y reinicia el temporizador de auto-ocultado.
             */
            function showCineControls() {
                const container = document.getElementById('cine-container');
                if (!container) return;
                container.classList.add('controls-visible');
                if (_cineControlsTimeout) clearTimeout(_cineControlsTimeout);
                _cineControlsTimeout = setTimeout(() => {
                    container.classList.remove('controls-visible');
                }, CINE_CONTROLS_DURATION);
            }

            // Inicializar los listeners cuando el video se abre
            /**
             * `initCineControlsToggle()`
             * Registra los listeners de ratón, toque y teclado para mostrar/ocultar controles en modo cine.
             */
            function initCineControlsToggle() {
                const container = document.getElementById('cine-container');
                if (!container) return;
                // Evitar doble inicialización
                if (container.dataset.controlsInit === '1') return;
                container.dataset.controlsInit = '1';

                // Touch: tap muestra/oculta controles
                let _lastTap = 0;
                container.addEventListener('touchend', (e) => {
                    if (e.target.closest('button, [role="button"], .art-control, select, input')) return;
                    const now = Date.now();
                    if (now - _lastTap < 300) return;
                    _lastTap = now;
                    const isVisible = container.classList.contains('controls-visible');
                    if (isVisible) {
                        container.classList.remove('controls-visible');
                        if (_cineControlsTimeout) clearTimeout(_cineControlsTimeout);
                    } else {
                        showCineControls();
                    }
                }, { passive: true });

                // Mouse: move muestra controles
                let _lastMove = 0;
                container.addEventListener('mousemove', () => {
                    const now = Date.now();
                    if (now - _lastMove < 500) return;
                    _lastMove = now;
                    showCineControls();
                }, { passive: true });
            }
            // Llamar inmediatamente para registrar los listeners
            initCineControlsToggle();

            /**
             * `exitVideoMode()`
             * Cierra el reproductor de video, guarda el progreso de visualización y libera la sesión HLS en el servidor.
             */
            function exitVideoMode() {
                window.currentVideoFile = null;
                window.currentVideoData = null;
                // Cleanup HLS session si existe
                if (typeof window.cleanupVideo === 'function') {
                    window.cleanupVideo();
                }
                if (typeof stopProgressTracking === 'function') {
                    stopProgressTracking();
                }

                // Desbloquear orientación al salir de video
                if (window.screen && window.screen.orientation && window.screen.orientation.unlock) {
                    window.screen.orientation.unlock();
                }
                // Mostrar la UI nativa de Kraken de nuevo
                document.querySelectorAll('.cine-controls, .cine-header, #dt-left, #dt-right, #dt-center').forEach(el => {
                    if (el) el.classList.remove('hidden');
                });

                const v = document.getElementById('main-video');
                if (v) {
                    v.pause();
                    v.src = "";
                }

                const screenEl = document.getElementById('cine-screen');
                if (screenEl) screenEl.innerHTML = "";

                const view = document.getElementById('view-player');
                if (view) view.classList.add('hidden');

                const loader = document.getElementById('video-loader');
                if (loader) loader.classList.add('hidden');

                document.body.style.overflow = '';

                // Reiniciar states
                isSeeking = false;
                wasPlayingBeforeSeek = false;

                const sb = document.getElementById('main-sidebar');
                if (sb && window.innerWidth >= 768) {
                    sb.classList.remove('hidden');
                }

                ver('library');
            }

            // Play / Pause centralizado
            /**
             * `toggleVideoPlay()`
             * Alterna pausa/reproducción en el reproductor de video activo.
             */
            function toggleVideoPlay() {

                // Mostrar la UI nativa de Kraken de nuevo
                document.querySelectorAll('.cine-controls, .cine-header, #dt-left, #dt-right, #dt-center').forEach(el => {
                    if (el) el.classList.remove('hidden');
                });

                const v = document.getElementById('main-video');
                if (!v) return;

                if (v.paused) {
                    v.play();
                } else {
                    v.pause();
                }

                if (typeof window.showControls === 'function') window.showControls();
            }

            // Sincronizar icono de play/pause con eventos nativos
            /**
             * `syncPlayPauseIcon()`
             * Sincroniza el icono de play/pausa en los controles de video.
             */
            function syncPlayPauseIcon() {

                // Mostrar la UI nativa de Kraken de nuevo
                document.querySelectorAll('.cine-controls, .cine-header, #dt-left, #dt-right, #dt-center').forEach(el => {
                    if (el) el.classList.remove('hidden');
                });

                const v = document.getElementById('main-video');
                const icon = document.getElementById('video-play-icon');
                if (!v || !icon) return;
                if (v.paused) {
                    icon.className = 'fa-solid fa-play text-2xl md:text-3xl ml-1 mt-0.5';
                } else {
                    icon.className = 'fa-solid fa-pause text-2xl md:text-3xl';
                }
            }

/**
 * `toggleVideoFullscreen()`
 * Alterna el modo de pantalla completa nativo del contenedor de video.
 */
function toggleVideoFullscreen() {

                // Mostrar la UI nativa de Kraken de nuevo
                document.querySelectorAll('.cine-controls, .cine-header, #dt-left, #dt-right, #dt-center').forEach(el => {
                    if (el) el.classList.remove('hidden');
                });

                const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);

                // Elementos candidatos a fullscreen (nativo o CSS de respaldo)
                const cine = document.getElementById('cine-container');
                const artContainer = document.getElementById('artplayer-container');

                const exitFs = () => {
                    const exitFn = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || (() => { });
                    try { exitFn.call(document); } catch (e) { }
                    [cine, artContainer, document.body].forEach(el => { if (el) el.classList.remove('krk-fullscreen'); });
                    document.body.classList.remove('krk-fs-lock');
                    const art = window.currentArtPlayer;
                    if (art && art.fullscreen) { try { art.fullscreen = false; } catch (e) { } }
                    if (art && art.fullscreenWeb) { try { art.fullscreenWeb = false; } catch (e) { } }
                };

                const enterNative = (el) => {
                    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
                    if (req) {
                        try { return Promise.resolve(req.call(el)); } catch (e) { return Promise.reject(e); }
                    }
                    return Promise.reject(new Error('no-fullscreen-api'));
                };

                const cssFallbackOn = () => {
                    const target = artContainer || cine;
                    if (target) target.classList.add('krk-fullscreen');
                    document.body.classList.add('krk-fs-lock');
                };

                // Reintentar nativo; si en el WebView no toma efecto, usar CSS de respaldo
                const enterWithFallback = (el) => {
                    enterNative(el).then(() => {
                        setTimeout(() => {
                            if (!document.fullscreenElement && !document.webkitFullscreenElement) cssFallbackOn();
                        }, 120);
                    }).catch(() => cssFallbackOn());
                };

                if (isFs) { exitFs(); return; }

                // HLS usa ArtPlayer
                const art = window.currentArtPlayer;
                if (art && art.video) {
                    enterWithFallback(artContainer || cine);
                    return;
                }

                // Fallback nativo (#main-video)
                const v = document.getElementById('main-video');
                if (!v) return;
                const container = document.getElementById('view-player');
                if (!container) return;

                const scaleVideo = () => {
                    const containerWidth = container.clientWidth;
                    const containerHeight = container.clientHeight;
                    const videoWidth = v.videoWidth || v.clientWidth;
                    const videoHeight = v.videoHeight || v.clientHeight;
                    if (videoWidth === 0 || videoHeight === 0) return;
                    const scaleX = containerWidth / videoWidth;
                    const scaleY = containerHeight / videoHeight;
                    const scale = Math.min(scaleX, scaleY);
                    v.style.width = (videoWidth * scale) + 'px';
                    v.style.height = (videoHeight * scale) + 'px';
                    v.style.position = 'absolute';
                    v.style.left = '50%';
                    v.style.top = '50%';
                    v.style.transform = 'translate(-50%, -50%)';
                    v.style.transformOrigin = 'center center';
                };
                v.style.transition = 'transform 0.2s ease';
                v.addEventListener('loadedmetadata', scaleVideo, { once: true });
                if (v.readyState >= 1) scaleVideo();

                enterWithFallback(container);
            }

            // Si el usuario sale con Escape o con el gesto del sistema, limpiar
            // los estilos que solo pertenecen al fullscreen del fallback nativo.
document.addEventListener('fullscreenchange', () => {
                if (document.fullscreenElement) return;
                if (window.currentArtPlayer) return;
                const video = document.getElementById('main-video');
                if (!video) return;
                video.style.width = '';
                video.style.height = '';
                video.style.position = '';
                video.style.left = '';
                video.style.top = '';
                video.style.transform = '';
                video.style.transformOrigin = '';
            });

            // Escape tambien debe salir del fullscreen CSS de respaldo (el WebView
            // no emite fullscreenchange para el modo position:fixed).
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && (document.querySelector('.krk-fullscreen'))) {
                    document.querySelectorAll('#cine-container, #cine-screen, #artplayer-container, #view-player, body')
                        .forEach(el => el.classList.remove('krk-fullscreen'));
                    document.body.classList.remove('krk-fs-lock');
                }
            });

            // Controles de Volumen
            /**
             * `changeVideoVolume()`
             * Ajusta el volumen del reproductor de video.
             */
            function changeVideoVolume() {

                // Mostrar la UI nativa de Kraken de nuevo
                document.querySelectorAll('.cine-controls, .cine-header, #dt-left, #dt-right, #dt-center').forEach(el => {
                    if (el) el.classList.remove('hidden');
                });

                const v = document.getElementById('main-video');
                const volSlider = document.getElementById('video-volume');
                const volIcon = document.getElementById('video-vol-icon');
                if (v && volSlider && volIcon) {
                    v.volume = volSlider.value;
                    v.muted = false;
                    localStorage.setItem('vortex_vol', v.volume);
                    updateVolumeIcon(v.volume, volIcon);

                    if (typeof window.showControls === 'function') window.showControls();
                }
            }

            /**
             * `toggleVideoMute()`
             * Silencia o activa el audio del reproductor de video.
             */
            function toggleVideoMute() {

                // Mostrar la UI nativa de Kraken de nuevo
                document.querySelectorAll('.cine-controls, .cine-header, #dt-left, #dt-right, #dt-center').forEach(el => {
                    if (el) el.classList.remove('hidden');
                });

                const v = document.getElementById('main-video');
                const volSlider = document.getElementById('video-volume');
                const volIcon = document.getElementById('video-vol-icon');
                if (v && volSlider && volIcon) {
                    v.muted = !v.muted;
                    if (v.muted) {
                        volSlider.value = 0;
                        updateVolumeIcon(0, volIcon);
                    } else {
                        volSlider.value = v.volume;
                        updateVolumeIcon(v.volume, volIcon);
                    }
                    if (typeof window.showControls === 'function') window.showControls();
                }
            }

            /**
             * `updateVolumeIcon(vol, icon)`
             * Actualiza el icono de volumen según el nivel o estado de silencio.
             */
            function updateVolumeIcon(vol, icon) {
                if (vol == 0) icon.className = 'fa-solid fa-volume-xmark text-xl md:text-2xl text-red-500';
                else if (vol < 0.5) icon.className = 'fa-solid fa-volume-low text-xl md:text-2xl';
                else icon.className = 'fa-solid fa-volume-high text-xl md:text-2xl';
            }

            // Control de Barra de Progreso y Seek
            let isSeeking = false;
            let wasPlayingBeforeSeek = false;

            /**
             * `seekVideoStart()`
             * Inicia el arrastre manual de la barra de progreso de video.
             */
            function seekVideoStart() {
                const videoEl = document.getElementById('main-video');
                if (videoEl && !isSeeking) {
                    isSeeking = true;
                    wasPlayingBeforeSeek = !videoEl.paused;
                    videoEl.pause();
                }
                if (typeof window.showControls === 'function') window.showControls();
            }

            /**
             * `seekVideoScroll()`
             * Actualiza la posición durante el arrastre de la barra de progreso de video.
             */
            function seekVideoScroll() {
                const videoEl = document.getElementById('main-video');
                const progBar = document.getElementById('video-progress');
                const timeCurrent = document.getElementById('video-time-current');
                const playedBar = document.getElementById('video-played-bar');

                if (videoEl && progBar && timeCurrent && playedBar) {
                    if (!isSeeking) seekVideoStart(); // Fallback
                    timeCurrent.innerText = formatTime(progBar.value);
                    if (videoEl.duration) {
                        const percent = (progBar.value / videoEl.duration) * 100;
                        playedBar.style.width = Math.min(percent, 100) + '%';
                    }
                }
            }

            /**
             * `seekVideoClick()`
             * Salta al punto de tiempo donde el usuario hizo clic en la barra de progreso.
             */
            function seekVideoClick() {
                const videoEl = document.getElementById('main-video');
                const progBar = document.getElementById('video-progress');
                if (videoEl && progBar) {
                    videoEl.currentTime = progBar.value;
                    if (isSeeking && wasPlayingBeforeSeek) {
                        videoEl.play();
                    }
                    isSeeking = false;
                }
                if (typeof window.showControls === 'function') window.showControls();
            }

            /**
             * `seekRelative(seconds)`
             * Adelanta o atrasa el video una cantidad relativa de segundos (ej. ±10s).
             */
            function seekRelative(seconds) {
                const videoEl = document.getElementById('main-video');
                if (!videoEl) return;
                let newTime = videoEl.currentTime + seconds;
                if (newTime < 0) newTime = 0;
                if (videoEl.duration && newTime > videoEl.duration) newTime = videoEl.duration;
                videoEl.currentTime = newTime;

                // Mostrar controles
                if (typeof window.showControls === 'function') window.showControls();
            }

            // Zonas Double Tap (Netflix Style)
            /**
             * `handleDoubleTap(direction, e)`
             * Procesa gestos de doble toque en móvil/tablet para saltar ±10s o pausar.
             */
            function handleDoubleTap(direction, e) {
                e.preventDefault();
                e.stopPropagation();

                const dtLeft = document.getElementById('dt-left');
                const dtRight = document.getElementById('dt-right');

                if (direction === 'left') {
                    seekRelative(-10);
                    animateDoubleTap(dtLeft.firstElementChild);
                } else if (direction === 'right') {
                    seekRelative(10);
                    animateDoubleTap(dtRight.firstElementChild);
                }
            }

            /**
             * `animateDoubleTap(element)`
             * Muestra la animación visual ripple/HUD al hacer doble toque en el reproductor.
             */
            function animateDoubleTap(element) {
                if (!element) return;
                element.classList.remove('hidden', 'scale-90');
                element.classList.add('scale-100');
                element.parentElement.classList.remove('opacity-0');
                element.parentElement.classList.add('opacity-100');

                setTimeout(() => {
                    element.classList.remove('scale-100');
                    element.classList.add('scale-90');
                    element.parentElement.classList.remove('opacity-100');
                    element.parentElement.classList.add('opacity-0');
                    setTimeout(() => element.classList.add('hidden'), 300);
                }, 500);
            }

            /**
             * `updateVideoProgress()`
             * Sincroniza la barra de tiempo jugado y buffer del reproductor de video.
             */
            function updateVideoProgress() {
                const videoEl = document.getElementById('main-video');
                const progBar = document.getElementById('video-progress');
                const timeCurrent = document.getElementById('video-time-current');
                const playedBar = document.getElementById('video-played-bar');

                if (videoEl && progBar && timeCurrent && !isSeeking) {
                    progBar.value = videoEl.currentTime;
                    timeCurrent.innerText = formatTime(videoEl.currentTime);

                    if (videoEl.duration) {
                        const percent = (videoEl.currentTime / videoEl.duration) * 100;
                        if (playedBar) playedBar.style.width = Math.min(percent, 100) + '%';
                    }
                }
            }

            // Sistema de auto-ocultar controles completo
            let hideTimeout;
            window.showControls = () => {
                const controls = document.querySelector('.cine-controls');
                const header = document.querySelector('.cine-header');
                const dtCenter = document.getElementById('dt-center');
                const container = document.getElementById('cine-container');
                if (!controls || !header) return;

                controls.classList.remove('opacity-0', 'pointer-events-none');
                header.classList.remove('opacity-0', 'pointer-events-none');
                if (dtCenter) dtCenter.style.display = 'block';
                if (container) container.style.cursor = 'default'; // Restaurar cursor

                clearTimeout(hideTimeout);

                hideTimeout = setTimeout(() => {
                    const video = document.getElementById('main-video');
                    const modal = document.getElementById('audio-subtitle-modal');
                    const isModalOpen = modal && !modal.classList.contains('hidden');

                    // Solo ocultar si está reproduciendo, y si el modal no está abierto
                    if (video && !video.paused && !isModalOpen && !isSeeking) {
                        controls.classList.add('opacity-0', 'pointer-events-none');
                        header.classList.add('opacity-0', 'pointer-events-none');
                        if (dtCenter) dtCenter.style.display = 'none'; // Evita atrapar clics si los controles están ocultos
                        if (container) container.style.cursor = 'none'; // Ocultar puntero del mouse
                    }
                }, 4000); // 4 segundos es ideal
            };

            /**
             * `setupMobileControlsToggle()`
             * Configura el auto-ocultado de controles a los 4 segundos en pantalla completa (táctil, ratón y D-Pad).
             */
            function setupMobileControlsToggle() {
                const container = document.getElementById('view-player');
                const video = document.getElementById('main-video');
                if (!container || !video) return;

                // Sync Play/Pause Icon and Initial Volume
                video.addEventListener('play', syncPlayPauseIcon);
                video.addEventListener('pause', syncPlayPauseIcon);
                syncPlayPauseIcon();

                const volSlider = document.getElementById('video-volume');
                const volIcon = document.getElementById('video-vol-icon');
                if (volSlider && volIcon && !isNaN(video.volume)) {
                    volSlider.value = video.volume;
                    updateVolumeIcon(video.volume, volIcon);
                }

                // Asignar eventos de mostrar en toda la zona (mousemove desktop, touch móbil)
                container.addEventListener('mousemove', window.showControls);
                container.addEventListener('touchstart', window.showControls, { passive: true });

                // Tambien en clic al main video propiamente, por si el dt-center fallara
                video.addEventListener('click', toggleVideoPlay);

                // Ocultar si la ventana pierde el blur / se quita el focus
                video.addEventListener('play', window.showControls);
                video.addEventListener('pause', () => {
                    clearTimeout(hideTimeout);
                    const controls = document.querySelector('.cine-controls');
                    const header = document.querySelector('.cine-header');
                    const ctn = document.getElementById('cine-container');
                    if (controls) controls.classList.remove('opacity-0', 'pointer-events-none');
                    if (header) header.classList.remove('opacity-0', 'pointer-events-none');
                    if (ctn) ctn.style.cursor = 'default';
                });

                window.showControls();
            }

            /**
             * Controles remotos para subtítulos y audio (usados por Cine Remote / Watch Party)
             */
            window.switchKrakenAudio = function(index) {
                const art = window.currentArtPlayer;
                const val = Number(index);
                if (art) {
                    if (art._krakenAudioMode === 'hls' && art.hls && !Number.isNaN(val) && val >= 0 && Array.isArray(art.hls.audioTracks)) {
                        art.hls.audioTrack = val;
                        showToast('🔊 Pista de audio cambiada', 'info');
                        return;
                    }
                    if (art._krakenAudioMode === 'backend' && !Number.isNaN(val) && val >= 0 && typeof art.switchHlsAudioByRestart === 'function') {
                        art.switchHlsAudioByRestart(val, 'Audio ' + (val + 1));
                        showToast('🔊 Audio cambiado', 'info');
                        return;
                    }
                }
                if (typeof switchAudioTrack === 'function') {
                    switchAudioTrack(val, val);
                }
            };

            window.switchKrakenSubtitle = function(subValue) {
                const art = window.currentArtPlayer;
                if (String(subValue) === 'off') {
                    if (art && art.subtitle) {
                        art.subtitle.show = false;
                    }
                    const video = document.getElementById('main-video');
                    if (video && video.textTracks) {
                        for (let i = 0; i < video.textTracks.length; i++) video.textTracks[i].mode = 'disabled';
                    }
                    showToast('💬 Subtítulos desactivados', 'info');
                    return;
                }

                const idx = Number(subValue);
                const subTracks = window.currentVideoData?.subtitle_tracks || window.currentVideoFile?.subtitle_tracks || [];
                const track = subTracks[idx];
                if (art && art.subtitle && track && track.url) {
                    const rawSubUrl = track.url.includes('%') ? track.url : encodeURI(track.url);
                    const fullSubUrl = rawSubUrl.startsWith('/') ? (window.location.origin + rawSubUrl) : rawSubUrl;
                    if (typeof art.subtitle.switch === 'function') {
                        art.subtitle.switch(fullSubUrl, { name: track.title || 'Subtítulo', encoding: 'utf-8' });
                    } else {
                        art.subtitle.url = fullSubUrl;
                    }
                    art.subtitle.show = true;
                    showToast('💬 Subtítulo: ' + (track.title || track.language || ('Pista ' + (idx + 1))), 'info');
                    return;
                }

                if (typeof switchSubtitleTrack === 'function' && track) {
                    switchSubtitleTrack(track, idx);
                }
            };


function sendWatchPartyQuickReaction(emoji) {
    if (typeof window.sendWatchPartyMessage === 'function') {
        window.sendWatchPartyMessage(emoji);
    }
}
window.sendWatchPartyQuickReaction = sendWatchPartyQuickReaction;
