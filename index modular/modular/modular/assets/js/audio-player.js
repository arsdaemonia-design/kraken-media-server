/**
 * ============================================================================
 * KRAKEN MEDIA SERVER — audio-player.js
 * Motor de reproducción de audio, cola de reproducción, crossfade, Radio inteligente, visualizador WebAudio, reproductor fullscreen y control de vistas/zoom.
 * ============================================================================
 */

/**
 * `activarModoRadio()`
 * Genera una cola de radio inteligente basada en similitud musical con la pista actual o selección aleatoria.
 */
async function activarModoRadio() {
    console.log("🎧 Iniciando Radio Inteligente...");

    // 1. Verificamos biblioteca
    if (!window.libData || !window.libData.files || window.libData.files.length === 0) {
        showToast("❌ No hay biblioteca cargada.", "error");
        return;
    }

    // 2. Filtramos audio según sección actual
    let audios = window.libData.files.filter(f => f.type === 'audio');
    if (typeof currentLibrary !== 'undefined' && currentLibrary === 'audio') {
        const nerdMode = (typeof currentAudioSection !== 'undefined' && currentAudioSection === 'nerd');
        audios = audios.filter(f => nerdMode ? isNerdTrack(f) : !isNerdTrack(f));
    }

    if (audios.length === 0) {
        showToast("No hay música.", "error");
        return;
    }

    // 🎯 MODO INTELIGENTE: Si hay una canción sonando, buscar similares
    let playlistRadio = [];
    const LIMITE_RADIO = 50;

    // Si hay una canción actual, buscar similares desde el servidor
    if (playerQueue.length > 0 && currentTrackIndex >= 0) {
        const cancionActual = playerQueue[currentTrackIndex];

        if (cancionActual && cancionActual.path) {
            try {
                console.log(`🔍 Buscando similares a: ${cancionActual.title} | path: ${cancionActual.path}`);
                showToast("🎵 Analizando gustos musicales...", "info");

                // Codificar cada segmento por separado para preservar las barras en la URL
                const encodedPath = cancionActual.path.split('/').map(s => encodeURIComponent(s)).join('/');
                const response = await fetch(`/similar/${encodedPath}`);
                const data = await response.json();

                if (data.similares && data.similares.length > 0) {
                    console.log(`✨ Encontradas ${data.similares.length} canciones similares`);

                    // Convertir paths a objetos completos
                    playlistRadio = data.similares
                        .map(path => audios.find(a => a.path === path))
                        .filter(a => a !== undefined)
                        .slice(0, LIMITE_RADIO);

                    showToast(`✨ Radio Inteligente: ${playlistRadio.length} canciones similares`, "success");
                } else {
                    // Fallback a aleatorio
                    console.log("⚠️ No hay similares suficientes, modo aleatorio");
                    playlistRadio = generarRadioAleatorio(audios, LIMITE_RADIO);
                    showToast(`🎲 Radio Aleatoria: ${playlistRadio.length} canciones`, "info");
                }

            } catch (error) {
                console.error("Error obteniendo similares:", error);
                // Fallback a aleatorio
                playlistRadio = generarRadioAleatorio(audios, LIMITE_RADIO);
                showToast(`🎲 Radio Aleatoria: ${playlistRadio.length} canciones`, "info");
            }
        } else {
            // No hay canción actual válida, modo aleatorio
            playlistRadio = generarRadioAleatorio(audios, LIMITE_RADIO);
            showToast(`🎲 Radio Aleatoria: ${playlistRadio.length} canciones`, "info");
        }
    } else {
        // No hay cola, modo aleatorio
        playlistRadio = generarRadioAleatorio(audios, LIMITE_RADIO);
        showToast(`🎲 Radio Aleatoria: ${playlistRadio.length} canciones`, "info");
    }

    // 3. Asignamos la cola
    if (playlistRadio.length > 0) {
        playerQueue = playlistRadio;
        currentTrackIndex = 0;
        updateQueueUI();
        playTrack(playerQueue[0]);
        console.log(`✅ Cola lista con ${playlistRadio.length} canciones`);
    } else {
        showToast("❌ No se pudo generar la radio", "error");
    }
}

// Función auxiliar para generar radio aleatorio (fallback)
/**
 * `generarRadioAleatorio(audios, limite)`
 * Construye una lista aleatoria de pistas de audio como respaldo para el modo Radio.
 */
function generarRadioAleatorio(audios, limite) {
    let playlistRadio = [];
    let indicesUsados = new Set();

    const cantidadTotal = audios.length;
    const cantidadAUsar = Math.min(limite, cantidadTotal);

    while (playlistRadio.length < cantidadAUsar) {
        let r = Math.floor(Math.random() * cantidadTotal);
        if (!indicesUsados.has(r)) {
            indicesUsados.add(r);
            playlistRadio.push(audios[r]);
        }
    }

    return playlistRadio;
}

/**
 * `initVisualizer()`
 * Inicializa el contexto WebAudio (`AudioContext`, `AnalyserNode`) y los nodos de ganancia para el visualizador y crossfade.
 */
function initVisualizer() {
    if (isVisualizerInit) return;

    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();

        gainNode1 = audioCtx.createGain();
        gainNode2 = audioCtx.createGain();

        source1 = audioCtx.createMediaElementSource(audioElement1);
        source2 = audioCtx.createMediaElementSource(audioElement2);

        source1.connect(gainNode1);
        source2.connect(gainNode2);

        gainNode1.connect(analyser);
        gainNode2.connect(analyser);

        analyser.connect(audioCtx.destination);
        analyser.fftSize = 256; // ← Más barras = más detalle

        canvas = document.getElementById("visualizer");
        canvasCtx = canvas.getContext("2d");

        // ✅ CONFIGURACIÓN HD: Ajustar al tamaño real del contenedor
        /**
         * `resizeCanvas()`
         * Ajusta las dimensiones del lienzo (`<canvas>`) del visualizador de frecuencias.
         */
        function resizeCanvas() {
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;

            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;

            canvasCtx.scale(dpr, dpr);
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
        }

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        isVisualizerInit = true;
        drawVisualizer();
    } catch (e) {
        console.log("Audio Context Error: " + e);
    }
}

/**
 * `drawVisualizer()`
 * Bucle `requestAnimationFrame` que dibuja las barras de espectro de audio en tiempo real.
 */
function drawVisualizer() {
    // Validaciones de seguridad
    if (!analyser) return;
    if (!isVisualizerInit || !canvas) return;

    // Bucle de animación
    requestAnimationFrame(drawVisualizer);

    // Obtener datos de frecuencia
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    // Dimensiones
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    // Limpiar el canvas antes de dibujar el nuevo frame
    canvasCtx.clearRect(0, 0, width, height);

    // Configuración de las barras
    const barWidth = (width / bufferLength) * 2.5;
    let x = 0;

    // 🔥 EFECTO GLOW (NEÓN) ACTIVADO
    // Esto crea el halo brillante alrededor de las barras
    canvasCtx.shadowBlur = 30;       // Intensidad del brillo
    canvasCtx.shadowColor = '#10b981'; // Color del brillo (Esmeralda)

    for (let i = 0; i < bufferLength; i++) {
        // Calcular altura de la barra (usando toda la altura disponible)
        const barHeight = (dataArray[i] / 255) * height;

        // 🎨 GRADIENTE VORTEX (Luz Menta a Base Oscura)
        const gradient = canvasCtx.createLinearGradient(0, height - barHeight, 0, height);
        gradient.addColorStop(0, '#6ee7b7');   // Punta: Verde Menta (Muy brillante)
        gradient.addColorStop(0.5, '#10b981'); // Medio: Esmeralda Vívido
        gradient.addColorStop(1, '#064e3b');   // Base: Verde muy oscuro (casi negro)

        canvasCtx.fillStyle = gradient;

        // Dibujamos la barra con esquinas superiores redondeadas
        canvasCtx.beginPath();
        if (canvasCtx.roundRect) {
            canvasCtx.roundRect(x, height - barHeight, barWidth - 2, barHeight, [4, 4, 0, 0]);
        } else {
            // Fallback por si el navegador es muy viejo
            canvasCtx.rect(x, height - barHeight, barWidth - 2, barHeight);
        }
        canvasCtx.fill();

        x += barWidth;
    }

    // Limpiamos el shadowBlur al final por seguridad
    canvasCtx.shadowBlur = 0;
}

/**
 * `playContext()`
 * Inicia la reproducción de la vista, carpeta o filtro activo.
 */
function playContext() {
        let tracksToPlay = [];

        // 📂 CASO A: MODO CARPETAS
        if (currentView === 'folders') {
            const path = currentExplorerPath || '';
            if (path === '') {
                tracksToPlay = libData.files;
            } else {
                // Buscar archivos en la carpeta actual, ordenados por nombre
                tracksToPlay = libData.files
                    .filter(f => f.path.startsWith(path + '/'))
                    .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
            }
        }
        // 🎤 CASO B: MODO ARTISTA
        else if (currentView === 'artist') {
            tracksToPlay = currentArtistTracks;
        }
        // 🎵 CASO C: MODO BIBLIOTECA
        else {
            tracksToPlay = getFilteredTracks();
        }

        // Ejecutar
        if (tracksToPlay.length > 0) {

            // 1. SI SON POCAS (MENOS DE 50): Carga normal rápida
            if (tracksToPlay.length <= 50) {
                playerQueue = tracksToPlay.slice();
                currentTrackIndex = 0;
                playTrack(playerQueue[0]);
                showToast(`Reproduciendo ${tracksToPlay.length} elementos`, "success");

            } else {
                // 2. MODO "EMBUDO" 🌪️ (Para listas grandes)
                // Cargamos solo las primeras 50 para que arranque AL INSTANTE
                const LOTE_INICIAL = 50;
                playerQueue = tracksToPlay.slice(0, LOTE_INICIAL);

                currentTrackIndex = 0;
                playTrack(playerQueue[0]); // ¡La música suena YA!

                showToast(`Iniciando con ${LOTE_INICIAL} canciones...`, "success");

                // 3. CARGA SILENCIOSA: El resto se añade 1 segundo después
                console.log("🌪️ Modo Embudo activado. Cargando resto en segundo plano...");

                setTimeout(() => {
                    // Tomamos del 50 en adelante
                    const resto = tracksToPlay.slice(LOTE_INICIAL);
                    // Las pegamos al final de la cola
                    playerQueue = playerQueue.concat(resto);

                    console.log(`✅ Carga completa: ${playerQueue.length} canciones en cola.`);
                    showToast(`Cola completa: ${playerQueue.length} canciones cargadas`);

                    // Si tienes una función para actualizar la vista de la cola, llámala aquí
                    // if(typeof renderQueue === 'function') renderQueue();
                    updateQueueUI();
                }, 1000); // 1000ms = 1 segundo de respiro
            }

        } else {
            showToast("No hay nada para reproducir aquí", "warning");
        }
    }
    /**
     * `playMix(id)`
     * Carga y reproduce un Smart Mix (Favoritos, Género, Artista o Década).
     */
    function playMix(id) {
        // --- NUEVO: Si tocan el botón de Radio, usamos el algoritmo nuevo ---
        if (id === 'smart_shuffle' && currentAudioSection !== 'nerd') {
            activarModoRadio();
            return;
        }
        // -------------------------------------------------------------------

        let mixFiles = [];
        // ... (el resto del código sigue igual)

        // --- CASO 1: ES FAVORITOS (NUEVO) ---
        // Este mix no viene del servidor, lo calculamos aquí
        if (id === 'smart_favorites') {
            mixFiles = libData.files.filter(f => f.rating === 1);

            if (mixFiles.length === 0) {
                // Opcional: una alerta si está vacío
                console.log("No hay favoritos aún");
                return;
            }
        }

        else {
            // Primero buscamos en mixes de sección; fallback a server mixes
            const mix = (sectionSmartMixes || []).find(m => m.id === id)
                || (libData.smart_mixes || []).find(m => m.id === id);

            if (mix) {
                // Tu lógica original para convertir rutas en objetos de canción
                mixFiles = mix.files
                    .map(path => libData.files.find(f => f.path === path))
                    .filter(f => f); // Filtramos los nulos por si acaso
            }
        }

        // --- REPRODUCIR ---
        if (mixFiles.length > 0) {
            playerQueue = mixFiles;
            currentTrackIndex = 0;
            if (document.getElementById('queue-count')) {
                document.getElementById('queue-count').innerText = playerQueue.length;
            }
            playTrack(playerQueue[0]);

        }
    }

    /**
     * `playCustomMix(id)`
     * Reproduce una lista personalizada de pistas con opción de orden aleatorio.
     */
    function playCustomMix(id) {
        const mix = customMixes[id];
        if (!mix) return;
        const mixFiles = mix.files
            .map(path => libData.files.find(f => f.path === path))
            .filter(f => f);

        if (mixFiles.length > 0) {
            playerQueue = mixFiles;
            currentTrackIndex = 0;
            if (document.getElementById('queue-count')) {
                document.getElementById('queue-count').innerText = playerQueue.length;
            }
            playTrack(playerQueue[0]);
        }
    }

    /**
     * `renderHorizontalMixRow(rowEl, mixes)`
     * Renderiza una fila horizontal desplazable de tarjetas de Smart Mixes.
     */
    function renderHorizontalMixRow(rowEl, mixes) {
        if (!rowEl) return;
        rowEl.innerHTML = '';
        mixes.forEach(mix => {
            const coverPath = mix.cover || mix.files[0] || '';
            const coverUrl = coverPath
                ? `/caratula/${coverPath.split('/').map(p => encodeURIComponent(p)).join('/')}`
                : '';
            const safeName = escapeHtml(mix.name);
            rowEl.innerHTML += `
<div onclick="playCustomMix('${mix.id}')" class="min-w-[180px] max-w-[200px] cursor-pointer transition hover:scale-[1.02]">
    <div class="relative aspect-square rounded-xl overflow-hidden bg-[#121212] border border-white/10 hover:border-emerald-500/40 shadow-lg">
        <img src="${coverUrl}" class="absolute inset-0 w-full h-full object-cover" onerror="this.style.display='none';">
        <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"></div>
        <div class="absolute bottom-0 left-0 right-0 p-3">
            <h4 class="text-sm font-bold text-white leading-tight drop-shadow-sm line-clamp-2">${safeName}</h4>
            <p class="text-[10px] text-emerald-400 font-bold mt-1">${mix.count} canciones</p>
        </div>
    </div>
</div>`;
        });
    }

    /**
     * `scrollMixRow(rowId, direction)`
     * Desplaza horizontalmente un carrusel de mixes.
     */
    function scrollMixRow(rowId, direction) {
        const row = document.getElementById(rowId);
        if (!row) return;
        const amount = Math.max(220, Math.floor(row.clientWidth * 0.7));
        row.scrollBy({ left: amount * direction, behavior: 'smooth' });
    }
    // --- LOGICA DE VIDEO ---
    /**
     * `playNow(path, resumeSeconds)`
     * Encola y reproduce inmediatamente un archivo de audio o abre el reproductor si es video.
     */
    function playNow(path, resumeSeconds) {
        if (selectionMode) { selectRow(path); return; }

        if (window.KRAKEN_PLAYBACK_TARGET && window.KRAKEN_PLAYBACK_TARGET.session_id) {
            let file = libData.files.find(f => f.path === path);
            if (!file && path && path.endsWith('/')) {
                file = libData.files.find(f => f.path && f.path.startsWith(path) && f.type === 'video');
            }
            if (!file) {
                const allFiles = libData.files;
                for (let i = 0; i < allFiles.length; i++) {
                    if (allFiles[i].sample && allFiles[i].sample.path === path) {
                        file = allFiles[i];
                        break;
                    }
                }
            }
            const payloadFile = file || { path: path, title: path.split('/').pop(), type: 'audio' };
            sendFileToControlledDevice(payloadFile, window.KRAKEN_PLAYBACK_TARGET);
            return;
        }

        // Buscar archivo en libData
        let file = libData.files.find(f => f.path === path);

        // Fallback: si no encuentra exacto, buscar por prefijo (para entidades de búsqueda)
        if (!file && path && path.endsWith('/')) {
            file = libData.files.find(f => f.path && f.path.startsWith(path) && f.type === 'video');
        }
        // Fallback: buscar por sample (entidades de búsqueda con sample)
        if (!file) {
            const allFiles = libData.files;
            for (let i = 0; i < allFiles.length; i++) {
                if (allFiles[i].sample && allFiles[i].sample.path === path) {
                    file = allFiles[i];
                    break;
                }
            }
        }

        if (!file) return;

        window.krakenPendingResumeSeconds = Number(resumeSeconds || 0);

        // Si es video, creamos la cola de la carpeta completa
        if (file.type === 'video') {
            audioElement.pause();
            // Encontrar todos los videos en la misma carpeta que este archivo
            // (Usamos full_folder para asegurarnos que son del mismo nivel)
            const folderTracks = libData.files.filter(f => f.full_folder === file.full_folder && f.type === 'video');

            // Ordenar por nombre (para que cap 1 siga de cap 2)
            folderTracks.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));

            const startIndex = folderTracks.findIndex(f => f.path === file.path);

            if (startIndex !== -1) {
                playerQueue = folderTracks;
                currentTrackIndex = startIndex;
                playVideoMode(playerQueue[currentTrackIndex]);
            } else {
                // Fallback
                playerQueue = [file];
                currentTrackIndex = 0;
                playVideoMode(file);
            }
        } else {
            playerQueue = [file];
            currentTrackIndex = 0;
            playTrack(file);
        }
    }

    /**
     * `enqueue(path)`
     * Añade una pista al final de la cola de reproducción actual (`playerQueue`).
     */
    function enqueue(path) {
        const file = libData.files.find(f => f.path === path);
        if (!file) return;

        // 🔒 Evitar duplicados
        const exists = playerQueue.some(track => track.path === path);
        if (exists) {
            showToast("⚠️ Ya está en la cola", "warning");
            return;
        }

        playerQueue.push(file);
        updateQueueUI();

        // ✅ AGREGAR ESTA LÍNEA (era el error de sintaxis):
        showToast(`✅ "${file.title}" añadida a la cola`, "success");

        if (audioElement.paused && playerQueue.length === 1) {
            currentTrackIndex = 0;
            playTrack(file);
        }
    }


    /**
     * `playTrack(file)`
     * Gestiona la carga de audio, crossfade entre pistas, MediaSession API y registro en historial.
     */
    function playTrack(file) {
        const playerBar = document.getElementById('player-bar');
        if (playerBar) {
            playerBar.style.opacity = '0.6';
            playerBar.style.pointerEvents = 'none';
        }

        fetch('/log_play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: file.path })
        });

        const bar = document.getElementById('player-bar');
        const videoView = document.getElementById('view-player');

        if (file.type === 'video') {
            if (audioElement) {
                audioElement.pause();
                audioElement.src = "";
            }
            if (bar) {
                bar.classList.add('hidden');
                bar.classList.remove('flex');
            }

            playVideoMode(file);

            // 🔧 restaurar estado visual
            if (playerBar) {
                playerBar.style.opacity = '1';
                playerBar.style.pointerEvents = 'auto';
            }

            return; // 👈 salir aquí
        }

        // --- AUDIO ---
        if (videoView && !videoView.classList.contains('hidden')) {
            exitVideoMode();
        }
        if (bar) {
            bar.classList.remove('hidden');
            bar.classList.add('flex');
        }

        actualizarInterfazPlayer(file);

        const parts = file.path.split('/');
        const safePath = parts.map(p => encodeURIComponent(p)).join('/');

        // --- CROSSFADE LOGIC ---
        let nextAudio = activeAudioIndex === 1 ? audioElement2 : audioElement1;
        let currAudio = activeAudioIndex === 1 ? audioElement1 : audioElement2;
        let nextGain = activeAudioIndex === 1 ? gainNode2 : gainNode1;
        let currGain = activeAudioIndex === 1 ? gainNode1 : gainNode2;

        let isPlaying = !currAudio.paused && !currAudio.ended && currAudio.currentTime > 0;

        // FIX: Update active pointers immediately so UI events are accurately caught
        audioElement = nextAudio;
        activeAudioIndex = activeAudioIndex === 1 ? 2 : 1;

        nextAudio.src = '/descargas/' + safePath;

        if (isVisualizerInit && isPlaying) {
            nextGain.gain.setValueAtTime(0, audioCtx.currentTime);
        } else if (isVisualizerInit) {
            nextGain.gain.setValueAtTime(1, audioCtx.currentTime);
        }

        nextAudio.play().then(() => {
            if (isVisualizerInit && isPlaying) {
                let fadeTime = 3.0; // segundos de crossfade
                let now = audioCtx.currentTime;

                currGain.gain.cancelScheduledValues(now);
                currGain.gain.setValueAtTime(currGain.gain.value, now);
                currGain.gain.linearRampToValueAtTime(0, now + fadeTime);

                nextGain.gain.cancelScheduledValues(now);
                nextGain.gain.setValueAtTime(0, now);
                nextGain.gain.linearRampToValueAtTime(1, now + fadeTime);

                setTimeout(() => { if (currAudio !== audioElement) { currAudio.pause(); currAudio.src = ""; } }, fadeTime * 1000);
            } else if (isPlaying) {
                currAudio.pause();
                currAudio.src = "";
            }

            updateQueueUI();
            syncPlayerUI();

            if (playerBar) {
                playerBar.style.opacity = '1';
                playerBar.style.pointerEvents = 'auto';
            }

            const modal = document.getElementById('fullscreen-player');
            if (modal && !modal.classList.contains('hidden')) {
                syncFullscreenPlayerCover();
            }

            if (playerBar) {
                playerBar.style.opacity = '1';
                playerBar.style.pointerEvents = 'auto';
            }

            // Auto-update lyrics panel if open
            const lyricsOverlay = document.getElementById('lyrics-overlay');
            if (lyricsOverlay) {
                refreshLyricsPanel(file);
            }

        }).catch(e => {
            console.error("Error al reproducir audio:", e);

            if (playerBar) {
                playerBar.style.opacity = '1';
                playerBar.style.pointerEvents = 'auto';
            }
        });
    }
    /**
     * `actualizarInterfazPlayer(file)`
     * Sincroniza carátula, título, artista y estado de favorito en las barras del reproductor.
     */
    function actualizarInterfazPlayer(file) {
        const covers = ['player-cover', 'player-cover-desktop'];
        const titles = ['player-title', 'player-title-desktop'];
        const artists = ['player-artist', 'player-artist-desktop'];

        covers.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = 'block';
                const safeCover = file.path.split('/').map(p => encodeURIComponent(p)).join('/');

                // Cargar inmediatamente (no lazy, es el player activo)
                el.src = `/caratula/${safeCover}`;

                // Fallback si falla
                el.onerror = () => {
                    el.style.display = 'none';
                    const fallback = document.getElementById('player-fallback') ||
                        document.getElementById('player-fallback-desktop');
                    if (fallback) fallback.classList.remove('hidden');
                };
            }
        });

        titles.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = file.title;
        });

        artists.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = file.album ? `${file.artist} • ${file.album}` : file.artist;
        });

        updateHeartButton(file.rating === 1);

        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: file.title || 'Sin título',
                artist: file.artist || '',
                album: file.album || '',
                artwork: file.cover ? [
                    { src: file.cover, sizes: '512x512', type: 'image/jpeg' }
                ] : []
            });

            navigator.mediaSession.setActionHandler('play', togglePlay);
            navigator.mediaSession.setActionHandler('pause', togglePlay);
            navigator.mediaSession.setActionHandler('previoustrack', playPrevious);
            navigator.mediaSession.setActionHandler('nexttrack', playNext);
        }

    }

/**
 * `toggleShuffle()`
 * Activa o desactiva el modo aleatorio en la cola de reproducción.
 */
function toggleShuffle() {
        isShuffleOn = !isShuffleOn;
        syncPlayerUI();
    }
    /**
     * `updateQueueUI()`
     * Renderiza la lista de pistas de la cola de reproducción en `#queue-panel`.
     */
    function updateQueueUI() {
        const list = document.getElementById('queue-list');
        if (!list) return;

        // ✅ ACTUALIZAR TODOS LOS CONTADORES (móvil Y desktop)
        const countBadges = document.querySelectorAll('#queue-count'); // 👈 Busca TODOS
        countBadges.forEach(badge => {
            if (playerQueue.length > 0) {
                badge.innerText = playerQueue.length;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        });

        if (playerQueue.length === 0) {
            list.innerHTML = `
    <div class="h-full flex flex-col items-center justify-center text-emerald-600 opacity-50">
        <i class="fa-solid fa-layer-group text-3xl mb-2"></i>
        <p class="text-xs mt-2">Cola vacía</p>
    </div>`;
            return;
        }

        list.innerHTML = playerQueue.map((track, i) => {
            const isPlaying = i === currentTrackIndex;
            const playingClass = isPlaying ? 'playing' : '';

            let imgHtml = '';
            let subText = '';

            if (track.type === 'video') {
                imgHtml = `
        <div class="queue-img-container flex items-center justify-center bg-emerald-800">
            <i class="fa-solid fa-film text-emerald-500 text-lg"></i>
        </div>`;
                subText = `<div class="text-[9px] text-emerald-500 truncate">${track.folder || 'Video'}</div>`;
            } else {
                const safePath = track.path.split('/').map(p => encodeURIComponent(p)).join('/');
                imgHtml = `
        <div class="queue-img-container relative">
            <img src="/caratula/${safePath}" loading="lazy" decoding="async"
                 class="queue-img"
                 onerror="this.style.display='none'; this.parentElement.classList.add('bg-emerald-800');">
            <div class="absolute inset-0 hidden items-center justify-center bg-emerald-800">
                <i class="fa-solid fa-music text-white/50 text-xs"></i>
            </div>
        </div>`;
                subText = `<div class="text-[9px] text-emerald-400 truncate">${track.artist}</div>`;
            }

            return `
    <div class="queue-item ${playingClass}" data-index="${i}">
        <div class="flex items-center gap-2 flex-1 min-w-0 cursor-pointer" onclick="jumpToTrack(${i})">
            ${imgHtml}
            <div class="queue-info min-w-0">
                <div class="queue-title truncate text-xs font-bold text-white">${track.title}</div>
                ${subText}
            </div>
        </div>
        <button onclick="event.stopPropagation(); removeFromQueue(${i})"
                class="text-emerald-400 hover:text-red-500 shrink-0 px-2">
            <i class="fa-solid fa-xmark text-xs"></i>
        </button>
    </div>`;
        }).join('');

        // 🎯 DRAG & DROP (tu código original sigue igual)
        const queueItems = list.querySelectorAll('.queue-item');
        queueItems.forEach((item, index) => {
            item.draggable = true;
            item.style.cursor = 'grab';

            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', index);
                item.style.opacity = '0.5';
                item.style.cursor = 'grabbing';
            });

            item.addEventListener('dragend', () => {
                item.style.opacity = '1';
                item.style.cursor = 'grab';
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = index;

                if (fromIndex === toIndex) return;

                const [moved] = playerQueue.splice(fromIndex, 1);
                playerQueue.splice(toIndex, 0, moved);

                if (currentTrackIndex === fromIndex) {
                    currentTrackIndex = toIndex;
                } else if (fromIndex < currentTrackIndex && toIndex >= currentTrackIndex) {
                    currentTrackIndex--;
                } else if (fromIndex > currentTrackIndex && toIndex <= currentTrackIndex) {
                    currentTrackIndex++;
                }

                updateQueueUI();
            });
        });
    }
    /**
     * `togglePlay()`
     * Alterna entre reproducción y pausa del motor de audio activo.
     */
    function togglePlay() { if (!audioElement.src) return; if (audioElement.paused) audioElement.play(); else audioElement.pause(); }
    /**
     * `updateProgress()`
     * Actualiza la barra de progreso, tiempos y letras sincronizadas durante la reproducción de audio.
     */
    function updateProgress() {
        if (!audioElement.duration) return;
        const curr = audioElement.currentTime;

        // CROSSFADE TRIGGER: Faltando 3 segundos, iniciamos la siguiente!
        if (!window.isCrossfading && loopMode !== 'one' && audioElement.duration > 5 && audioElement.duration - curr <= 3.0) {
            window.isCrossfading = true;
            setTimeout(() => { window.isCrossfading = false; }, 3500);
            playNext();
        }

        // Lista de todos los IDs de barras y etiquetas que existen en tu HTML
        const bars = ['prog-bar', 'prog-bar-desktop', 'fp-prog'];
        const currentLabels = ['time-current', 'time-current-desktop'];
        const totalLabels = ['time-total', 'time-total-desktop'];

        // Actualizar todas las barras de progreso presentes
        bars.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = curr;
        });

        // Actualizar todos los contadores de tiempo actual
        currentLabels.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = formatTime(curr);
        });

        // Actualizar duraciones totales si aún no se han puesto
        totalLabels.forEach(id => {
            const el = document.getElementById(id);
            if (el && (el.innerText === "0:00" || el.innerText === "")) {
                el.innerText = formatTime(audioElement.duration);


            }
            const modal = document.getElementById('fullscreen-player');
            if (modal && !modal.classList.contains('hidden')) {
                syncFullscreenPlayer();
            }
        });
    }

    // 🔧 REEMPLAZA ESTA FUNCIÓN (línea ~1847)
    /**
     * `openFullScreenPlayer()`
     * Abre el reproductor de música a pantalla completa con fondo difuminado y controles extendidos.
     */
    function openFullScreenPlayer() {
        if (!playerQueue.length || currentTrackIndex === -1) {
            console.log("❌ No hay canción en reproducción");
            return;
        }

        const track = playerQueue[currentTrackIndex];

        // 🎬 Si es video, NO abrir este modal (el video ya tiene su propio fullscreen)
        if (track.type === 'video') {
            console.log("🎬 Es video, usar controles de video");
            toggleVideoFullscreen(); // Usar el fullscreen nativo del video
            return;
        }

        // 📻 Si es AUDIO, abrir el modal fullscreen
        const modal = document.getElementById('fullscreen-player');
        if (!modal) {
            console.error("❌ No se encontró #fullscreen-player en el HTML");
            return;
        }

        // Mostrar modal
        modal.classList.remove('hidden');

        // 🔥 Codificar la ruta correctamente (ESTO ERA LO QUE FALTABA)
        let coverUrl;
        if (track.type === 'video' && track.tmdb_poster) {
            coverUrl = `/caratula/${encodeURIComponent(track.tmdb_poster)}`;
        } else {
            const safePath = track.path.split('/').map(p => encodeURIComponent(p)).join('/');
            coverUrl = `/caratula/${safePath}`;
        }

        console.log("🖼️ Cargando carátula:", coverUrl);

        // Actualizar carátula principal
        const cover = document.getElementById('fp-cover');
        const bg = document.getElementById('fp-bg');

        if (cover) {
            cover.src = coverUrl;
            cover.style.display = 'block';

            cover.onerror = () => {
                console.warn("❌ No se pudo cargar la carátula");
                cover.style.display = 'none';
                const fallback = cover.nextElementSibling;
                if (fallback) fallback.classList.remove('hidden');
            };

            cover.onload = () => {
                console.log("✅ Carátula cargada exitosamente");
            };
        }

        if (bg) {
            bg.style.backgroundImage = `url('${coverUrl}')`;
        }

        // Actualizar textos
        const title = document.getElementById('fp-title');
        const artist = document.getElementById('fp-artist');
        if (title) title.innerText = track.title;
        if (artist) artist.innerText = track.artist;

        // Sincronizar controles
        syncFullscreenPlayer();
    }

    // 🆕 Cierra el reproductor fullscreen de AUDIO
    /**
     * `closeFullScreenPlayer()`
     * Cierra el reproductor de música a pantalla completa.
     */
    function closeFullScreenPlayer() {
        const modal = document.getElementById('fullscreen-player');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * `syncFullscreenPlayerCover()`
     * Actualiza la carátula y el fondo difuminado en el reproductor a pantalla completa.
     */
    function syncFullscreenPlayerCover() {
        if (!playerQueue.length || currentTrackIndex === -1) return;

        const track = playerQueue[currentTrackIndex];
        const cover = document.getElementById('fp-cover');
        const bg = document.getElementById('fp-bg');
        const fallback = cover?.nextElementSibling;

        if (!cover) return;

        // Limpia handlers previos
        cover.onerror = null;
        cover.onload = null;

        const playerCover =
            document.getElementById('player-cover') ||
            document.getElementById('player-cover-desktop');

        let workingUrl = null;

        if (playerCover && playerCover.src && !playerCover.src.includes('data:')) {
            workingUrl = playerCover.src;
            console.log("🔄 Usando carátula del player bar:", workingUrl);
        } else {
            const safePath = track.path.split('/').map(p => encodeURIComponent(p)).join('/');
            workingUrl = `/caratula/${safePath}`;
            console.log("🔄 Construyendo URL manualmente:", workingUrl);
        }

        cover.style.display = 'block';
        if (fallback) {
            fallback.classList.add('hidden');
            fallback.classList.remove('flex');
        }

        cover.onerror = () => {
            console.warn("❌ Error cargando carátula:", workingUrl);
            cover.style.visibility = 'hidden';  // 👈 no colapsa el layout
            if (fallback) {
                fallback.classList.remove('hidden');
                fallback.classList.add('flex');
            }
        };

        cover.onload = () => {
            cover.style.visibility = 'visible';
            if (fallback) {
                fallback.classList.add('hidden');
                fallback.classList.remove('flex');
            }
        };

        cover.src = workingUrl;

        if (bg) {
            bg.style.backgroundImage = `url('${workingUrl}')`;
        }
    }
    /**
     * `syncFullscreenPlayer()`
     * Sincroniza metadatos, estado de reproducción y botones en el reproductor a pantalla completa.
     */
    function syncFullscreenPlayer() {
        if (!audioElement) return;

        // Sincronizar barra de progreso
        const prog = document.getElementById('fp-prog');
        if (prog && audioElement.duration) {
            prog.max = audioElement.duration;
            prog.value = audioElement.currentTime;
        }

        // Sincronizar tiempos
        const curr = document.getElementById('fp-time-current');
        const total = document.getElementById('fp-time-total');
        if (curr) curr.innerText = formatTime(audioElement.currentTime);
        if (total) total.innerText = formatTime(audioElement.duration || 0);

        // Sincronizar icono play/pause
        const playBtn = document.getElementById('fp-play');
        if (playBtn) {
            const icon = playBtn.querySelector('i');
            if (icon) {
                icon.className = audioElement.paused
                    ? 'fa-solid fa-play ml-1 text-2xl'
                    : 'fa-solid fa-pause text-2xl';
            }
        }

        // Sincronizar shuffle
        const shuffleBtn = document.getElementById('fp-shuffle');
        if (shuffleBtn) {
            shuffleBtn.className = isShuffleOn
                ? 'text-emerald-400 transition'
                : 'text-zinc-500 hover:text-emerald-400 transition';
        }

        // Sincronizar loop
        const loopBtn = document.getElementById('fp-loop');
        if (loopBtn) {
            if (loopMode === 'off') {
                loopBtn.className = 'text-zinc-500 hover:text-white transition';
                loopBtn.innerHTML = '<i class="fa-solid fa-repeat text-xl"></i>';
            } else if (loopMode === 'all') {
                loopBtn.className = 'text-emerald-400 transition';
                loopBtn.innerHTML = '<i class="fa-solid fa-repeat text-xl"></i>';
            } else {
                loopBtn.className = 'text-blue-400 transition relative';
                loopBtn.innerHTML = '<i class="fa-solid fa-repeat text-xl"></i><span class="absolute -top-1 -right-1 text-[8px] font-bold">1</span>';
            }
        }

        // Sincronizar volumen
        const volSlider = document.getElementById('fp-vol-slider');
        if (volSlider) volSlider.value = audioElement.volume;
    }

    /**
     * `seekAudio(event)`
     * Salta a una posición específica de tiempo dentro de la pista de audio actual.
     */
    function seekAudio(event) {
        // Si la función recibe el 'event', usamos el valor del elemento que tocaste
        if (event && event.target) {
            audioElement.currentTime = event.target.value;
        } else {
            // Fallback: Si se llama sin evento, intenta adivinar cuál está visible
            const fp = document.getElementById('fp-prog');
            const desk = document.getElementById('prog-bar-desktop');
            const mob = document.getElementById('prog-bar');

            if (fp && fp.offsetParent) audioElement.currentTime = fp.value;
            else if (desk && desk.offsetParent) audioElement.currentTime = desk.value;
            else if (mob) audioElement.currentTime = mob.value;
        }
    }
    /**
     * `setVolume(val)`
     * Ajusta el volumen del reproductor de audio y persiste el valor.
     */
    function setVolume(val) {
        if (audioElement1) audioElement1.volume = val;
        if (audioElement2) audioElement2.volume = val;
        localStorage.setItem('vortex_vol', val);
    }
    /**
     * `toggleMute()`
     * Silencia o restaura el volumen del reproductor de audio.
     */
    function toggleMute() {
        audioElement.muted = !audioElement.muted;
        syncPlayerUI();
    }
    /**
     * `formatTime(s)`
     * Formatea segundos numéricos al formato `M:SS`.
     */
    function formatTime(s) { if (isNaN(s)) return "0:00"; const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec < 10 ? '0' + sec : sec}`; }
    /**
     * `onTrackEnded()`
     * Manejador de fin de pista que avanza a la siguiente canción según el modo de repetición.
     */
    function onTrackEnded() { if (loopMode === 'one') { audioElement.currentTime = 0; audioElement.play(); } else if (playerQueue.length > 0) { playNext(); } }
    /**
     * `playMediaItem(item)`
     * Despacha la reproducción de un elemento de la cola según sea audio o video.
     */
    function playMediaItem(item) {
        if (!item) return;
        const isVid = item.type === 'video' || (item.path && (item.path.endsWith('.mp4') || item.path.endsWith('.mkv') || item.path.endsWith('.avi') || item.path.endsWith('.webm')));
        if (isVid) playVideoMode(item);
        else playTrack(item);
    }

    /**
     * `playNext()`
     * Avanza a la siguiente pista de la cola (respetando modo aleatorio y bucle).
     */
    function playNext() {
        // 1. Manejo del Shuffle (Aleatorio local)
        if (isShuffleOn) {
            let newIndex = currentTrackIndex;
            // Intentamos no repetir la misma canción
            if (playerQueue.length > 1) {
                while (newIndex === currentTrackIndex) {
                    newIndex = Math.floor(Math.random() * playerQueue.length);
                }
            }
            currentTrackIndex = newIndex;
            playMediaItem(playerQueue[currentTrackIndex]);
            return;
        }

        // 2. Reproducción normal (Secuencial)
        if (currentTrackIndex < playerQueue.length - 1) {
            // Si hay una canción siguiente, la ponemos
            currentTrackIndex++;
            playMediaItem(playerQueue[currentTrackIndex]);
        } else {
            // 3. SE ACABÓ LA LISTA (El momento mágico)

            if (loopMode === 'all') {
                // Solo si tienes activado "Repetir Todo", volvemos al inicio
                currentTrackIndex = 0;
                playMediaItem(playerQueue[0]);
            } else {
                // Verifica si es video para no poner la "Radio mix"
                let wasVideo = playerQueue[currentTrackIndex] && (playerQueue[currentTrackIndex].type === 'video' || (playerQueue[currentTrackIndex].path && (playerQueue[currentTrackIndex].path.endsWith('.mp4') || playerQueue[currentTrackIndex].path.endsWith('.mkv') || playerQueue[currentTrackIndex].path.endsWith('.avi'))));
                if (wasVideo) {
                    console.log("🎬 Fin de la temporada/lista de videos.");
                    cerrarPlayer();
                } else {
                    // SI NO: Activamos la Radio para que la música no pare
                    console.log("💿 Fin de la lista. Activando Radio...");
                    showToast("💽 Autoplay: Cargando más música...", "info");
                    activarModoRadio();
                }
            }
        }
    }
    /**
     * `playPrevious()`
     * Retrocede a la pista anterior o reinicia la actual.
     */
    function playPrevious() { if (playerQueue.length === 0) return; if (audioElement && audioElement.currentTime > 3) { audioElement.currentTime = 0; return; } currentTrackIndex = currentTrackIndex - 1; if (currentTrackIndex < 0) currentTrackIndex = playerQueue.length - 1; playMediaItem(playerQueue[currentTrackIndex]); }
    /**
     * `jumpToTrack(index)`
     * Salta directamente a un índice específico dentro de `playerQueue`.
     */
    function jumpToTrack(index) { currentTrackIndex = index; playMediaItem(playerQueue[index]); }
    /**
     * `removeFromQueue(index)`
     * Elimina una pista de la cola de reproducción por su índice.
     */
    function removeFromQueue(index) { playerQueue.splice(index, 1); if (currentTrackIndex >= index && currentTrackIndex > 0) currentTrackIndex--; updateQueueUI(); }
    /**
     * `clearQueue()`
     * Vacía por completo la cola de reproducción.
     */
    function clearQueue() { if (!confirm('¿Limpiar cola?')) return; playerQueue = []; currentTrackIndex = -1; updateQueueUI(); cerrarPlayer(); }
    /**
     * `cerrarPlayer()`
     * Detiene la reproducción de audio y oculta la barra del reproductor.
     */
    function cerrarPlayer() { document.getElementById('player-bar').classList.add('hidden'); document.getElementById('player-bar').classList.remove('flex'); if (window.currentArtPlayer) { window.currentArtPlayer.pause(); } audioElement.pause(); }

    /**
     * `syncPlayerUI()`
     * Sincroniza el estado visual de los botones Shuffle, Loop y Volumen en móvil y escritorio.
     */
    function syncPlayerUI() {
        // ========== 1. SHUFFLE (Móvil + Desktop) ==========
        ['btn-shuffle', 'btn-shuffle-desktop'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                if (isShuffleOn) {
                    btn.className = "text-emerald-400 hover:text-emerald-300 transition text-sm drop-shadow-md";
                } else {
                    btn.className = "text-zinc-500 hover:text-emerald-400 transition text-sm";
                }
            }
        });

        // ========== 2. LOOP (Móvil + Desktop) ==========
        ['btn-loop', 'btn-loop-desktop'].forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;

            if (loopMode === 'off') {
                btn.className = "text-zinc-500 hover:text-white transition text-sm";
                btn.innerHTML = '<i class="fa-solid fa-repeat"></i>';
            } else if (loopMode === 'all') {
                btn.className = "text-emerald-400 transition text-sm drop-shadow-md";
                btn.innerHTML = '<i class="fa-solid fa-repeat"></i>';
            } else { // loopMode === 'one'
                btn.className = "text-blue-400 transition text-sm drop-shadow-md relative";
                btn.innerHTML = '<i class="fa-solid fa-repeat"></i><span class="absolute -top-1 -right-1 text-[8px] font-bold">1</span>';
            }
        });

        // ========== 3. MUTE / VOLUMEN (Móvil + Desktop) ==========
        const isMuted = audioElement.muted || audioElement.volume === 0;

        ['btn-vol', 'btn-vol-desktop'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                const icon = btn.querySelector('i');
                if (icon) {
                    icon.className = isMuted
                        ? 'fa-solid fa-volume-xmark'
                        : 'fa-solid fa-volume-high';
                }
                btn.classList.toggle('text-red-400', isMuted);
                btn.classList.toggle('text-zinc-400', !isMuted);
            }
        });

        ['vol-slider', 'vol-slider-desktop'].forEach(id => {
            const slider = document.getElementById(id);
            if (slider) slider.value = audioElement.volume;
        });
    }

    /**
     * `toggleLoop()`
     * Alterna entre los modos de repetición ('off', 'all', 'one').
     */
    function toggleLoop() {
        const modes = ['off', 'all', 'one'];
        loopMode = modes[(modes.indexOf(loopMode) + 1) % modes.length];
        syncPlayerUI();  // ← AGREGA ESTO
    }

    /**
     * `ver(view)`
     * Cambia entre las vistas principales de la aplicación ('library', 'downloader', 'history', 'stats', 'offline').
     */
    function ver(view) {

        // Ocultar todas las vistas
        document.querySelectorAll('[id^="view-"]').forEach(el =>
            el.classList.add('hidden')
        );

        // Mostrar la vista seleccionada
        document.getElementById('view-' + view).classList.remove('hidden');

        // Sidebar active state
        document.querySelectorAll('.sidebar-link').forEach(el =>
            el.classList.remove('active')
        );

        const targetNavId = (view === 'library' && currentLibrary === 'audio' && currentAudioSection === 'nerd')
            ? 'nav-nerd'
            : ('nav-' + view);
        const targetNav = document.getElementById(targetNavId);
        if (targetNav) targetNav.classList.add('active');

        // ===============================
        // VISTAS PRINCIPALES
        // ===============================

        if (view === 'library') {
            document.getElementById('sidebar-filters').classList.remove('hidden');
            updateAudioSectionNav();
            cargarLib();
        }

        else if (view === 'history') {
            document.getElementById('sidebar-filters').classList.add('hidden');
            cargarHistorial();
        }

        else if (view === 'stats') {
            document.getElementById('sidebar-filters').classList.add('hidden');
            cargarEstadisticas();
        }

        // ✅ OFFLINE VIEW (AQUÍ)
        else if (view === 'offline') {
            document.getElementById('sidebar-filters').classList.add('hidden');

            // ✅ SOLO aquí cargamos lista offline
            if (typeof refreshOfflineList === "function") {
                refreshOfflineList();
            }
        }

        // Otras vistas
        else {
            document.getElementById('sidebar-filters').classList.add('hidden');
        }
    }
    /**
     * `toggleAcc(id)`
     * Abre o cierra un acordeón de filtros en la barra lateral.
     */
    function toggleAcc(id) { const el = document.getElementById(id); const icon = document.getElementById('icon-' + id); if (el.classList.contains('hidden')) { el.classList.remove('hidden'); if (icon) icon.style.transform = 'rotate(180deg)'; } else { el.classList.add('hidden'); if (icon) icon.style.transform = 'rotate(0deg)'; } }
    /**
     * `toggleQueue()`
     * Muestra u oculta el panel lateral de la cola de reproducción.
     */
    function toggleQueue() { document.getElementById('queue-panel').classList.toggle('translate-x-full'); }
    /**
     * `setView(mode)`
     * Cambia el modo de visualización de la biblioteca entre lista ('list') y cuadrícula ('grid').
     */
    function setView(mode) {
        if (currentLibrary === 'video' && mode === 'list') {
            const depth = (currentPath || '').split('/').filter(Boolean).length;
            // En video, el modo lista solo tiene sentido dentro de detalle de episodios
            if (depth < 3) mode = 'grid';
        }

        viewMode = mode;
        localStorage.setItem('vortex_view', mode);

        // Actualizar botones DESKTOP
        const bG = document.getElementById('view-grid');
        const bL = document.getElementById('view-list');

        // Actualizar botones MÓVIL
        const bGMobile = document.getElementById('view-grid-mobile');
        const bLMobile = document.getElementById('view-list-mobile');

        // Aplicar clases a todos
        [bG, bGMobile].forEach(btn => {
            if (btn) btn.className = mode === 'grid' ? 'btn-view active' : 'btn-view';
        });

        [bL, bLMobile].forEach(btn => {
            if (btn) btn.className = mode === 'list' ? 'btn-view active' : 'btn-view';
        });
        renderLib();
    }
    /**
     * `renderSmartMixes()`
     * Construye las tarjetas de mixes inteligentes en la cabecera de la biblioteca de música.
     */
    function renderSmartMixes() {
        const mixesGrid = document.getElementById('smart-mixes-grid');
        if (!mixesGrid) return;

        mixesGrid.innerHTML = '';

        // 1. Crear mix de favoritos DINÁMICAMENTE
        const favFiles = libData.files.filter(f => f.rating === 1);
        let mixesToShow = [...(libData.smart_mixes || [])];

        if (favFiles.length > 0) {
            const favMix = {
                id: 'smart_favorites',
                name: 'Mis Favoritos',
                icon: 'fa-heart',
                files: favFiles,
                desc: 'Tu selección personal'
            };
            mixesToShow.unshift(favMix); // ⭐ Primero en la lista
        }

        const styles = {
            'smart_favorites': {
                from: 'from-emerald-600/20', to: 'to-black',
                border: 'border-emerald-500/50 hover:border-emerald-400',
                icon: 'text-emerald-500',
                glow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]'
            },
            'smart_discover': { from: 'from-pink-500/15', to: 'to-rose-500/5', border: 'border-pink-500/30 hover:border-pink-400', icon: 'text-pink-400', glow: 'hover:shadow-[0_0_20px_rgba(244,114,182,0.2)]' },
            'smart_top50': { from: 'from-orange-500/10', to: 'to-red-500/5', border: 'border-orange-500/20 hover:border-orange-500', icon: 'text-orange-500', glow: '' },
            'smart_energy': { from: 'from-amber-500/15', to: 'to-yellow-500/5', border: 'border-amber-500/30 hover:border-amber-400', icon: 'text-amber-400', glow: '' },
            'smart_chill': { from: 'from-indigo-500/15', to: 'to-violet-500/5', border: 'border-indigo-500/30 hover:border-indigo-400', icon: 'text-indigo-400', glow: '' },
            'smart_new': { from: 'from-teal-500/10', to: 'to-cyan-500/5', border: 'border-teal-500/20 hover:border-teal-500', icon: 'text-teal-400', glow: '' },
            'smart_shuffle': { from: 'from-blue-500/10', to: 'to-indigo-500/5', border: 'border-blue-500/20 hover:border-blue-400', icon: 'text-blue-400', glow: '' },
            'smart_gems': { from: 'from-purple-500/10', to: 'to-pink-500/5', border: 'border-purple-500/20 hover:border-purple-400', icon: 'text-purple-400', glow: '' }
        };

        mixesToShow.forEach(mix => {
            const s = styles[mix.id] || { from: 'from-zinc-800', to: 'to-zinc-900', border: 'border-white/10 hover:border-white/30', icon: 'text-zinc-400', glow: '' };

            mixesGrid.innerHTML += `
<div onclick="playMix('${mix.id}')" 
     class="relative overflow-hidden h-32 flex flex-col justify-between p-4 rounded-xl cursor-pointer transition-all duration-300 group
            bg-gradient-to-br ${s.from} ${s.to} bg-[#121212]
            border ${s.border} hover:scale-[1.02] ${s.glow || 'hover:shadow-[0_0_20px_rgba(0,0,0,0.4)]'}">
    
    <div class="absolute -right-4 -top-4 opacity-[0.05] group-hover:opacity-10 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110 pointer-events-none">
        <i class="fa-solid ${mix.icon} text-9xl text-white"></i>
    </div>
    
    <div class="text-2xl ${s.icon} drop-shadow-md group-hover:scale-110 transition-transform origin-left">
        <i class="fa-solid ${mix.icon}"></i>
    </div>
    
    <div class="relative z-10">
        <h3 class="font-bold text-white leading-tight text-sm md:text-base group-hover:text-white transition">${mix.name}</h3>
        <p class="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1 group-hover:text-zinc-400 transition">
            ${mix.files.length} canciones
        </p>
    </div>
    
    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center backdrop-blur-[1px]">
        <div class="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center shadow-2xl scale-50 group-hover:scale-100 transition-transform duration-300">
            <i class="fa-solid fa-play ml-1 text-sm"></i>
        </div>
    </div>
</div>`;
        });
    }


    /**
     * `changeZoom(val)`
     * Ajusta el nivel de zoom (tamaño de columnas) en la cuadrícula de audio.
     */
    function changeZoom(val) {
        const idx = Math.min(2, Math.max(0, parseInt(val, 10) || 0));
        if (currentLibrary === 'video') {
            currentVideoZoomIndex = idx;
            localStorage.setItem('kraken_video_zoom', String(idx));
        } else {
            currentZoomIndex = idx;
            localStorage.setItem('kraken_audio_zoom', String(idx));
        }
        renderLib();
    }
    /**
     * `changeVideoZoom(val)`
     * Ajusta el tamaño de pósteres (S/M/L) en la cuadrícula de video.
     */
    function changeVideoZoom(val) {
        const idx = Math.min(2, Math.max(0, parseInt(val, 10) || 0));
        currentVideoZoomIndex = idx;
        localStorage.setItem('kraken_video_zoom', String(idx));
        const zoomSliderEl = document.getElementById('lib-zoom-slider');
        if (zoomSliderEl) zoomSliderEl.value = String(idx);
        renderLib();
    }
