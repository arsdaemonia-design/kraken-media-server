import sys

with open('templates/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace playVideoMode
old_pvm_start = text.find('            function playVideoMode(file) {')
old_pvm_end = text.find('            // Actualizar progreso de carga del video', old_pvm_start)

if old_pvm_start != -1 and old_pvm_end != -1:
    new_pvm = """            function playVideoMode(file) {
                // Ocultar sidebar
                const sb = document.getElementById('main-sidebar');
                if (sb) sb.classList.add('hidden');

                // Ocultar otras vistas
                document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));

                const view = document.getElementById('view-player');
                if (view) view.classList.remove('hidden');

                // Ocultar modal de ajustes por defecto
                const modalAjustes = document.getElementById('audio-subtitle-modal');
                if (modalAjustes) {
                    modalAjustes.classList.add('hidden', 'opacity-0');
                    modalAjustes.style.pointerEvents = 'none';
                }

                const screen = document.getElementById('cine-screen');

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
                const sid = localStorage.getItem('kraken_sid') || 'default';

                // Preparar container para ArtPlayer
                if (screen) {
                    screen.innerHTML = `<div id="artplayer-container" class="w-full h-full bg-black"></div>`;
                }

                // Llamar API HLS
                const videoPath = file.path.split('/').map(p => encodeURIComponent(p)).join('/');
                
                // Verificar si ArtPlayer está disponible
                console.log("ArtPlayer typeof:", typeof Artplayer);
                console.log("Hls typeof:", typeof Hls);
                
                if (typeof Artplayer === 'undefined') {
                    console.error("ArtPlayer NO CARGADO - usando fallback");
                    showToast("ArtPlayer no cargado, usando reproductor nativo", "error");
                    showFallbackPlayer(screen, videoPath);
                    return;
                }
                
                fetch(`/api/hls/play?file=${videoPath}&sid=${sid}`)
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
                            showFallbackPlayer(screen, videoPath);
                            return;
                        }

                        // Crear ArtPlayer
                        const container = document.getElementById('artplayer-container');
                        if (container && data.url) {
                            const art = new Artplayer({
                                container: container,
                                url: data.url,
                                autoOrientation: true,
                                autoSize: true,
                                autoVolume: true,
                                backdrop: true,
                                playsInline: true,
                                theme: '#10b981',
                                settings: true,
                                controls: true,
                                fullscreen: true,
                                layer: {
                                    show: true,
                                    html: '<i class="fa-solid fa-play"></i>',
                                    tooltip: 'Play'
                                },
                                quality: data.audio_tracks ? data.audio_tracks.map((t, i) => ({
                                    html: t.language || `Pista ${i + 1}`,
                                    url: data.url
                                })) : [],
                                moreVideoAttr: {
                                    crossorigin: 'anonymous'
                                }
                            });

                            // Cuando esté listo, ocultar loader
                            art.on('ready', () => {
                                if (loader) {
                                    loader.classList.add('opacity-0');
                                    setTimeout(() => loader.classList.add('hidden'), 300);
                                }
                            });

                            // Auto-avanzar al terminar
                            art.on('ended', () => {
                                playNext();
                            });

                            // Guardar referencia para cleanup
                            window.currentArtPlayer = art;

                            // Cleanup al cerrar
                            window.cleanupVideo = () => {
                                if (window.currentArtPlayer) {
                                    fetch(`/api/hls/stop?sid=${sid}`, { method: 'POST' }).catch(() => {});
                                    window.currentArtPlayer.destroy();
                                    window.currentArtPlayer = null;
                                }
                            };
                        }
                    })
                    .catch(err => {
                        console.error("Error con HLS:", err);
                        // Fallback al reproductor normal
                        showFallbackPlayer(screen, videoPath);
                    });

                updateQueueUI();
            }

            // Fallback directo sin HLS
            function showFallbackPlayer(screen, videoPath) {
                if (screen) {
                    screen.innerHTML = `
                        <video id="main-video"
                               src="/descargas/${videoPath}"
                               preload="auto"
                               playsinline
                               crossorigin="anonymous"
                               controls="false"
                               class="w-full h-full bg-black"
                               style="object-fit: contain; max-width: 100vw; max-height: 100vh;">
                        </video>`;
                }
                fallbackVideoSetup();
            }

            // Función de fallback para cuando HLS falla
            function fallbackVideoSetup() {
                const videoEl = document.getElementById('main-video');
                if (videoEl) {
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
                    videoEl.onended = () => { playNext(); };
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

"""
    new_pvm += '            // Actualizar progreso de carga del video'
    text = text[:old_pvm_start] + new_pvm + text[old_pvm_end + len('            // Actualizar progreso de carga del video'):]
else:
    print('Could not find old_pvm boundaries')
    sys.exit(1)


# Replace exitVideoMode
old_evm_start = text.find('            function exitVideoMode() {')
old_evm_end = text.find('            // Play / Pause centralizado', old_evm_start)

if old_evm_start != -1 and old_evm_end != -1:
    new_evm = """            function exitVideoMode() {
                // Cleanup HLS session si existe
                if (typeof window.cleanupVideo === 'function') {
                    window.cleanupVideo();
                }

                const v = document.getElementById('main-video');
                if (v) {
                    v.pause();
                    v.src = "";
                }

                const screen = document.getElementById('cine-screen');
                if (screen) screen.innerHTML = "";

                const view = document.getElementById('view-player');
                if (view) view.classList.add('hidden');

                const loader = document.getElementById('video-loader');
                if (loader) loader.classList.add('hidden');

                document.body.style.overflow = '';

                // Reiniciar states
                isSeeking = false;
                wasPlayingBeforeSeek = false;

                const sb = document.getElementById('main-sidebar');
                if (sb && window.innerWidth >= 768 && !document.body.classList.contains('mobile-open')) {
                    sb.classList.remove('hidden');
                }

                ver('library');
            }

"""
    new_evm += '            // Play / Pause centralizado'
    text = text[:old_evm_start] + new_evm + text[old_evm_end + len('            // Play / Pause centralizado'):]
else:
    print('Could not find old_evm boundaries')
    sys.exit(1)


# Append script tags at the end
if '</body>' in text:
    text = text.replace('</body>', '''
        <!-- ArtPlayer + HLS.js for video streaming -->
        <script src="/assets/hls.min.js"></script>
        <script src="/assets/artplayer.js"></script>
</body>''')

with open('templates/index.html', 'w', encoding='utf-8') as f:
    f.write(text)

print('Success')
