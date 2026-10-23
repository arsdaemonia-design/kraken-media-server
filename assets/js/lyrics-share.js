/**
 * ============================================================================
 * KRAKEN MEDIA SERVER — lyrics-share.js
 * Motor de letras sincronizadas (.lrc), editor de letras integrado y generador de tarjetas visuales para compartir con html2canvas.
 * ============================================================================
 */

/**
 * `renderShareCardBase(title, artist, coverUrl)`
 * Prepara el título, artista y carátula en la plantilla oculta para generar tarjetas compartibles.
 */
function renderShareCardBase(title, artist, coverUrl) {
    const finalTitle = title || 'Sin titulo';
    const finalArtist = artist || 'Artista desconocido';
    const finalCover = coverUrl || '/static/default_cover.jpg';

    const titleEl = document.getElementById('card-title');
    const artistEl = document.getElementById('card-artist');
    const coverEl = document.getElementById('card-cover-bg');
    const bgEl = document.getElementById('card-bg');

    if (titleEl) titleEl.innerText = finalTitle;
    if (artistEl) artistEl.innerText = finalArtist;
    if (coverEl) coverEl.style.backgroundImage = `url('${finalCover}')`;
    if (bgEl) bgEl.style.backgroundImage = `url('${finalCover}')`;
}

/**
 * `toggleShareCardLyrics(show, payload = {})`
 * Muestra u oculta el bloque de letras dentro de la tarjeta compartible.
 */
function toggleShareCardLyrics(show, payload = {}) {
    const wrap = document.getElementById('card-lyrics-wrap');
    if (!wrap) return;
    if (!show) {
        wrap.classList.add('hidden');
        return;
    }

    if (!payload || (!payload.currentLines && !payload.current)) {
        return;
    }

    const prevEl = document.getElementById('card-lyric-prev');
    const curEl = document.getElementById('card-lyric-current');
    const nextEl = document.getElementById('card-lyric-next');
    const timeEl = document.getElementById('card-lyric-time');

    if (prevEl) prevEl.innerText = payload.prev || ' ';
    if (curEl) {
        let renderedLines = Array.isArray(payload.currentLines)
            ? payload.currentLines.filter(Boolean)
            : String(payload.current || '').split(String.fromCharCode(10)).map(v => v.trim()).filter(Boolean);

        if (!renderedLines.length) {
            curEl.innerText = '*';
        } else {
            const midIndex = Math.floor(renderedLines.length / 2);
            curEl.innerHTML = renderedLines.map((line, idx) => {
                const truncated = line.length > 45 ? line.substring(0, 42) + '...' : line;
                const lineClass = idx === midIndex
                    ? 'text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.28)]'
                    : 'text-zinc-400/90';
                return `<span class="block leading-normal pb-1 ${lineClass}">${escapeHtml(truncated)}</span>`;
            }).join('');
        }
    }
    if (nextEl) nextEl.innerText = payload.next || ' ';
    if (timeEl) timeEl.innerText = payload.timeLabel || 'LIVE LYRIC';

    wrap.classList.remove('hidden');
}

/**
 * `hideShareCardContainer()`
 * Oculta fuera de pantalla el contenedor de renderizado de tarjetas.
 */
function hideShareCardContainer() {
    const container = document.getElementById('share-card-container');
    if (!container) return;
    container.style.opacity = '0';
    container.style.zIndex = '-50';
    container.style.width = '0';
    container.style.height = '0';
}

/**
 * `showShareCardContainer()`
 * Posiciona temporalmente el contenedor de tarjetas para su captura con `html2canvas`.
 */
function showShareCardContainer() {
    const container = document.getElementById('share-card-container');
    if (!container) return;
    container.style.opacity = '1';
    container.style.zIndex = '9999';
    container.style.width = '340px';
    container.style.height = '600px';
}

/**
 * `downloadShareCanvas(canvas, title)`
 * Convierte el canvas renderizado en un archivo PNG y dispara su descarga.
 */
function downloadShareCanvas(canvas, title) {
    const link = document.createElement('a');
    link.download = `Kraken_${(title || 'track').replace(/\s+/g, '_')}_${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
}

/**
 * `generateCurrentCardImage(titleForFile)`
 * Renderiza la tarjeta mediante `html2canvas` y descarga la imagen resultante.
 */
function generateCurrentCardImage(titleForFile) {
    const cardElement = document.getElementById('share-card');
    showShareCardContainer();

    return html2canvas(cardElement, {
        backgroundColor: '#09090b',
        useCORS: true,
        scale: 2,
        logging: false
    }).then(canvas => {
        downloadShareCanvas(canvas, titleForFile);
        showToast('✨ ¡Tarjeta lista para Stories!', 'success');
    }).catch(err => {
        console.error(err);
        showToast('Error generando imagen', 'error');
    }).finally(() => {
        hideShareCardContainer();
        toggleShareCardLyrics(false);
    });
}

/**
 * `generarTarjeta()`
 * Genera una tarjeta visual de recomendación para una canción o video.
 */
function generarTarjeta() {
    const title = document.getElementById('player-title')?.innerText || 'Sin titulo';
    const artist = document.getElementById('player-artist')?.innerText || 'Artista desconocido';
    const currentCover = document.getElementById('player-cover')?.src || '/static/default_cover.jpg';

    renderShareCardBase(title, artist, currentCover);
    toggleShareCardLyrics(false);
    showToast('📸 Generando imagen...', 'info');
    generateCurrentCardImage(title);
}

/**
 * `generarTarjetaLyric(payload)`
 * Genera una tarjeta visual destacando los versos actuales de la canción.
 */
function generarTarjetaLyric(payload) {
    const title = payload?.title || document.getElementById('player-title')?.innerText || 'Sin titulo';
    const artist = payload?.artist || document.getElementById('player-artist')?.innerText || 'Artista desconocido';
    const cover = payload?.cover || document.getElementById('player-cover')?.src || '/static/default_cover.jpg';

    renderShareCardBase(title, artist, cover);
    toggleShareCardLyrics(true, {
        prev: payload?.prev,
        current: payload?.current,
        currentLines: payload?.currentLines,
        activeLineIndex: payload?.activeLineIndex,
        next: payload?.next,
        timeLabel: payload?.timeLabel
    });

    showToast('🎤 Generando lyric card...', 'info');
    generateCurrentCardImage(`${title}_lyrics`);
}

/**
 * `parseSyncedLyrics(raw)`
 * Analiza letras en formato `.lrc` extrayendo marcas de tiempo `[mm:ss.xx]` y líneas de texto.
 */
function parseSyncedLyrics(raw) {
    if (!raw || typeof raw !== 'string') return [];

    const out = [];
    const rows = String(raw)
        .split(String.fromCharCode(10))
        .map(v => v.replace(String.fromCharCode(13), ''));
    const tagRegex = /\[([0-9]{1,2}):([0-9]{2})(?:[.:]([0-9]{1,3}))?\]/g;

    for (const row of rows) {
        if (!row || !row.includes('[')) continue;

        const text = row.replace(tagRegex, '').trim();
        if (!text) continue;

        tagRegex.lastIndex = 0;
        let match;
        while ((match = tagRegex.exec(row)) !== null) {
            const mm = Number.parseInt(match[1], 10) || 0;
            const ss = Number.parseInt(match[2], 10) || 0;
            const fracRaw = match[3] || '';

            let frac = 0;
            if (fracRaw.length === 1) frac = Number.parseInt(fracRaw, 10) / 10;
            else if (fracRaw.length === 2) frac = Number.parseInt(fracRaw, 10) / 100;
            else if (fracRaw.length >= 3) frac = Number.parseInt(fracRaw.slice(0, 3), 10) / 1000;

            out.push({
                time: mm * 60 + ss + frac,
                text
            });
        }
    }

    out.sort((a, b) => a.time - b.time);

    const dedup = [];
    const seen = new Set();
    for (const item of out) {
        const k = `${item.time.toFixed(3)}|${item.text}`;
        if (seen.has(k)) continue;
        seen.add(k);
        dedup.push(item);
    }

    return dedup;
}

/**
 * `stopLyricsSync()`
 * Detiene la sincronización automática de desplazamiento de letras.
 */
function stopLyricsSync() {
    if (audioElement) {
        audioElement.removeEventListener('timeupdate', updateSyncedLyricsView);
    }
    lyricsSyncState = {
        lines: [],
        elements: [],
        currentIndex: -1,
        listEl: null,
        containerEl: null,
        track: null
    };
}

/**
 * `updateSyncedLyricsView(forceScroll = false)`
 * Resalta y centra el verso activo según el tiempo actual de reproducción (`currentTime`).
 */
function updateSyncedLyricsView(forceScroll = false) {
    const lines = lyricsSyncState.lines;
    if (!lines || !lines.length || !audioElement) return;

    const now = audioElement.currentTime || 0;
    let idx = lyricsSyncState.currentIndex;

    if (idx < 0) idx = 0;
    while (idx + 1 < lines.length && lines[idx + 1].time <= now) idx += 1;
    while (idx > 0 && lines[idx].time > now) idx -= 1;

    if (idx === lyricsSyncState.currentIndex && !forceScroll) return;

    const oldIdx = lyricsSyncState.currentIndex;
    lyricsSyncState.currentIndex = idx;

    const els = lyricsSyncState.elements;
    if (oldIdx >= 0 && els[oldIdx]) {
        els[oldIdx].className = 'text-white/45 text-sm md:text-base leading-relaxed transition-all duration-200';
    }
    if (els[idx]) {
        els[idx].className = 'text-emerald-300 text-lg md:text-xl font-bold leading-relaxed drop-shadow-[0_0_10px_rgba(16,185,129,0.55)] transition-all duration-200';
    }

    const listEl = lyricsSyncState.listEl;
    const containerEl = lyricsSyncState.containerEl;
    const activeEl = els[idx];
    if (listEl && containerEl && activeEl) {
        const target = Math.max(0, activeEl.offsetTop - containerEl.clientHeight * 0.35);
        containerEl.scrollTo({ top: target, behavior: forceScroll ? 'auto' : 'smooth' });
    }
}

/**
 * `setupSyncedLyrics(track, syncedLines, container)`
 * Inicializa la vista de letras sincronizadas `.lrc` o texto plano en el panel de letras.
 */
function setupSyncedLyrics(track, syncedLines, container) {
    stopLyricsSync();

    const list = document.createElement('div');
    list.id = 'lyrics-sync-list';
    list.className = 'flex flex-col space-y-3 pb-32 px-1';

    const elements = syncedLines.map(item => {
        const row = document.createElement('p');
        row.className = 'text-white/45 text-sm md:text-base leading-relaxed transition-all duration-300 hover:text-white/70 cursor-pointer p-2 rounded-xl border border-transparent';
        row.textContent = item.text;
        row.onclick = () => {
            if (audioElement) {
                audioElement.currentTime = item.time;
                updateSyncedLyricsView(true);
            }
        };
        list.appendChild(row);
        return row;
    });

    container.innerHTML = '';
    container.classList.remove('text-center');
    container.classList.add('text-left');
    container.appendChild(list);

    lyricsSyncState = {
        lines: syncedLines,
        elements,
        currentIndex: -1,
        listEl: list,
        containerEl: container,
        track
    };

    if (audioElement) {
        audioElement.addEventListener('timeupdate', updateSyncedLyricsView);
    }
    updateSyncedLyricsView(true);
}

/**
 * `buildLyricWindowData(lines, centerIndex, maxLines = 5, linesBefore = 1)`
 * Extrae una ventana de versos (anterior, actual, siguiente) para compartir en tarjeta.
 */
function buildLyricWindowData(lines, centerIndex, maxLines = 5, linesBefore = 1) {
    if (!Array.isArray(lines) || !lines.length) {
        return { lines: [], activeIndex: 0 };
    }
    const normalized = lines
        .map(line => (typeof line === 'string' ? line : line?.text || '').trim())
        .filter(Boolean);
    if (!normalized.length) {
        return { lines: [], activeIndex: 0 };
    }
    const safeCenter = Math.max(0, Math.min(centerIndex, normalized.length - 1));
    let start = Math.max(0, safeCenter - Math.max(0, linesBefore));
    let end = Math.min(normalized.length, start + Math.max(1, maxLines));
    if (end - start < maxLines) {
        start = Math.max(0, end - maxLines);
    }
    return {
        lines: normalized.slice(start, end),
        activeIndex: Math.max(0, safeCenter - start)
    };
}

/**
 * `getCurrentLyricSnapshot()`
 * Obtiene los versos activos en el instante actual de la canción.
 */
function getCurrentLyricSnapshot() {
    const track = lyricsSyncState.track || (playerQueue && playerQueue[currentTrackIndex]);
    if (!track) return null;

    if (lyricsSyncState.lines.length && lyricsSyncState.currentIndex >= 0) {
        const idx = lyricsSyncState.currentIndex;
        const lines = lyricsSyncState.lines;
        const excerpt = buildLyricWindowData(lines, idx, 3, 1);
        return {
            title: track.title,
            artist: track.artist,
            cover: document.getElementById('player-cover')?.src || '/static/default_cover.jpg',
            prev: '',
            current: excerpt.lines.join('\n') || lines[idx]?.text || '',
            currentLines: excerpt.lines,
            activeLineIndex: excerpt.activeIndex,
            next: '',
            timeLabel: `LYRICS ${formatTimeShort(audioElement?.currentTime || 0)}`
        };
    }

    const plainContainer = document.getElementById('lyrics-text-container');
    const plainLines = (plainContainer?.innerText || '').split(String.fromCharCode(10)).map(v => v.trim()).filter(Boolean);
    if (!plainLines.length) return null;

    const plainCenter = plainLines.length > 1 ? 1 : 0;
    const plainExcerpt = buildLyricWindowData(plainLines, plainCenter, 3, 1);

    return {
        title: track.title,
        artist: track.artist,
        cover: document.getElementById('player-cover')?.src || '/static/default_cover.jpg',
        prev: '',
        current: plainExcerpt.lines.join('\n') || plainLines[1] || plainLines[0] || '',
        currentLines: plainExcerpt.lines,
        activeLineIndex: plainExcerpt.activeIndex,
        next: '',
        timeLabel: `LYRICS ${formatTimeShort(audioElement?.currentTime || 0)}`
    };
}

/**
 * `shareCurrentLyricCard()`
 * Crea y descarga una tarjeta compartible con el fragmento de letra actual.
 */
function shareCurrentLyricCard() {
    const snap = getCurrentLyricSnapshot();
    if (!snap || !snap.current) {
        showToast('No hay línea activa para compartir', 'warning');
        return;
    }
    generarTarjetaLyric(snap);
}

/**
 * `refreshLyricsPanel(track)`
 * Consulta `/letra` para cargar la letra de la canción actual y actualiza el panel.
 */
async function refreshLyricsPanel(track) {
    const overlay = document.getElementById('lyrics-overlay');
    if (!overlay || !track) return;

    const safePath = track.path.split('/').map(p => encodeURIComponent(p)).join('/');

    try {
        const res = await fetch(`/lyrics/${safePath}`);
        const data = await res.json();

        if (data.found) {
            // Update title
            const titleEl = overlay.querySelector('h3');
            if (titleEl) titleEl.textContent = track.title;

            const lyricsContainer = overlay.querySelector('#lyrics-text-container');
            if (!lyricsContainer) return;

            // Stop old sync
            stopLyricsSync();

            // Parse lyrics
            let syncedLines = parseSyncedLyrics(data.synced_text || '');
            if (!syncedLines.length) {
                syncedLines = parseSyncedLyrics(data.text || '');
            }

            if (syncedLines.length >= 2) {
                setupSyncedLyrics(track, syncedLines, lyricsContainer);
            } else {
                const plain = (data.plain_text || data.text || '').split(String.fromCharCode(10)).map(line => {
                    const p = document.createElement('p');
                    p.className = 'text-white/45 text-sm md:text-base leading-relaxed';
                    p.textContent = line;
                    return p;
                });
                lyricsContainer.innerHTML = '';
                lyricsContainer.classList.remove('text-center');
                lyricsContainer.classList.add('text-left');
                plain.forEach(p => lyricsContainer.appendChild(p));
            }
        }
    } catch (e) {
        console.error('Error refreshing lyrics:', e);
    }
}

/**
 * `toggleLyrics()`
 * Abre o cierra el panel/modal de letras de canciones.
 */
async function toggleLyrics() {
    if (!playerQueue || playerQueue.length === 0 || typeof currentTrackIndex === 'undefined') {
        showToast("No hay música sonando", "error");
        return;
    }

    const track = playerQueue[currentTrackIndex];
    const btnBar = document.getElementById('btn-lyrics-bar');

    // CERRAR SI YA EXISTE
    const existingOverlay = document.getElementById('lyrics-overlay');
    if (existingOverlay) {
        // Animación de salida
        stopLyricsSync();
        existingOverlay.classList.remove('translate-x-0');
        existingOverlay.classList.add('translate-x-full'); // Se va a la derecha
        setTimeout(() => existingOverlay.remove(), 300);

        if (btnBar) btnBar.classList.remove('text-emerald-400', 'animate-pulse');
        return;
    }

    // ABRIR
    if (btnBar) btnBar.classList.add('animate-pulse', 'text-emerald-400');
    showToast("🎤 Buscando letra...", "info");

    // Codificación segura para URL
    const safePath = track.path.split('/').map(p => encodeURIComponent(p)).join('/');

    try {
        const res = await fetch(`/lyrics/${safePath}`);
        const data = await res.json();

        if (btnBar) btnBar.classList.remove('animate-pulse');

        if (data.found) {
            const sourceIcon = data.source === 'local' ? 'fa-hard-drive' : 'fa-cloud';

            // CREAR PANEL LATERAL
            const overlay = document.createElement('div');
            overlay.id = 'lyrics-overlay';

            // 👇👇 ESTILOS DEL PANEL LATERAL 👇👇
            // Desktop: Panel derecho de 400px o 500px.
            // Mobile: Pantalla completa (inset-0).
            overlay.className = 'fixed top-0 right-0 h-full w-full md:w-[450px] z-[10000] bg-[#0a0a0a]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col transform translate-x-full transition-transform duration-300 ease-out';

            overlay.innerHTML = `
    <div class="flex items-center justify-between p-6 border-b border-white/5 bg-black/20 shrink-0">
        <div class="min-w-0">
            <h3 class="text-emerald-500 font-bold text-sm uppercase tracking-widest truncate">${track.title}</h3>
            <p class="text-zinc-500 text-[10px] flex items-center gap-2">
                <i class="fa-solid ${sourceIcon}"></i> ${data.source === 'local' ? 'Desde Archivo' : 'Desde Internet'}
            </p>
        </div>
        <div class="flex items-center gap-2">
            <button onclick="shareCurrentLyricCard()" class="w-8 h-8 rounded-full bg-emerald-900/30 hover:bg-emerald-700/40 flex items-center justify-center text-emerald-300 transition" title="Compartir lyric card">
                <i class="fa-solid fa-share-nodes text-xs"></i>
            </button>
            <button onclick="toggleLyrics()" class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    </div>

    <div class="flex-1 overflow-y-auto custom-scroll p-6 text-center mask-image-gradient" id="lyrics-text-container">
    </div>

    ${data.source === 'cloud' ? `
    <div class="p-4 border-t border-white/5 bg-black/40 shrink-0 text-center">
        <button id="btn-save-lyrics" 
                data-path="${escapeHtml(track.path)}"
                onclick="saveLyricsFromButton(this)" 
                class="w-full bg-emerald-900/30 hover:bg-emerald-600 border border-emerald-500/30 text-emerald-400 hover:text-white py-3 rounded-xl transition font-bold text-xs flex items-center justify-center gap-2 group">
            <i class="fa-solid fa-floppy-disk group-hover:scale-110 transition"></i> GUARDAR EN MP3
        </button>
    </div>
    ` : ''}
`;

            document.body.appendChild(overlay);

            const lyricsContainer = document.getElementById('lyrics-text-container');
            let syncedLines = parseSyncedLyrics(data.synced_text || '');
            if (!syncedLines.length) {
                syncedLines = parseSyncedLyrics(data.text || '');
            }
            if (syncedLines.length >= 2) {
                setupSyncedLyrics(track, syncedLines, lyricsContainer);
            } else {
                stopLyricsSync();
                const plain = (data.plain_text || data.text || '').split(String.fromCharCode(10)).map(line => {
                    if (typeof escapeHtml === 'function') return escapeHtml(line);
                    return line;
                }).join('<br>');
                lyricsContainer.classList.remove('text-left');
                lyricsContainer.classList.add('text-center');
                lyricsContainer.innerHTML = `<p class="text-white/90 text-lg md:text-xl leading-relaxed font-medium font-sans animate-slide-in pb-20 drop-shadow-md">${plain}</p>`;
            }

            // Forzar reflow para que la animación funcione
            setTimeout(() => {
                overlay.classList.remove('translate-x-full');
                overlay.classList.add('translate-x-0');
            }, 10);

            if (btnBar) btnBar.classList.add('text-emerald-400');

        } else {
            showToast("No se encontró letra 😔", "warning");
            if (btnBar) btnBar.classList.remove('text-emerald-400');
        }
    } catch (e) {
        console.error(e);
        showToast("Error de conexión", "error");
        if (btnBar) btnBar.classList.remove('animate-pulse', 'text-emerald-400');
    }
}

// 👇 FUNCIÓN GUARDAR CORREGIDA (Ya no cierra la ventana) 👇
/**
 * `saveLyricsFromButton(button)`
 * Dispara el guardado manual de letras editadas desde el botón de la interfaz.
 */
async function saveLyricsFromButton(button) {
    const path = button.dataset.path;
    await saveLyrics(path);
}

/**
 * `saveLyrics(pathOrEncoded)`
 * Envía al servidor (`/guardar_letra`) el texto o `.lrc` editado para incrustarlo/guardarlo.
 */
async function saveLyrics(pathOrEncoded) {
    const container = document.getElementById('lyrics-text-container');
    const btn = document.getElementById('btn-save-lyrics');

    if (!container) return;
    const text = container.innerText;

    // Feedback visual en el botón
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';
    btn.disabled = true;

    try {
        // Si viene encoded, decodificar; si no, usar tal cual
        let path = pathOrEncoded;
        try {
            const decoded = decodeURIComponent(pathOrEncoded);
            if (decoded !== pathOrEncoded) path = decoded;
        } catch (e) {
            // Ya estaba decodificado
        }

        const res = await fetch('/save_lyrics_to_file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: path,
                text: text
            })
        });
        const d = await res.json();

        if (d.ok) {
            showToast("✅ ¡Guardado! Ahora es parte del archivo.", "success");

            // Cambiar botón a estado "Éxito"
            btn.className = "w-full bg-emerald-500 text-black border border-emerald-500 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2";
            btn.innerHTML = '<i class="fa-solid fa-check"></i> GUARDADO';

            // NO CERRAMOS LA VENTANA, solo actualizamos el estado visual
        } else {
            showToast("❌ Error: " + (d.error || "Desconocido"), "error");
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    } catch (e) {
        showToast("Error de red", "error");
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

/**
 * `updateHeartButton(isFav)`
 * Sincroniza el estado del icono de favorito de la pista actual.
 */
function updateHeartButton(isFav) {
    if (currentTrackIndex !== -1 && playerQueue[currentTrackIndex]) {
        actualizarVisuales(playerQueue[currentTrackIndex].path, isFav);
    }
}


// ══════════════════════════════════════════════════════════════════════════════
// SECURE EPHEMERAL SHARE MODAL & CONTROLLER
// ══════════════════════════════════════════════════════════════════════════════

window._pendingShareTrack = null;

/**
 * Abre el modal de compartir enlace temporal para una pista (objeto, path o la actual).
 */
function openShareModal(trackOrPath) {
    let track = null;
    if (trackOrPath && typeof trackOrPath === 'object') {
        track = trackOrPath;
    } else if (typeof trackOrPath === 'string') {
        if (typeof libData !== 'undefined' && libData.files) {
            track = libData.files.find(f => f.path === trackOrPath);
        }
        if (!track) {
            track = { path: trackOrPath, title: trackOrPath.split('/').pop().replace(/\.[^/.]+$/, ''), artist: 'Kraken Audio' };
        }
    } else if (typeof currentTrackIndex !== 'undefined' && typeof playerQueue !== 'undefined' && playerQueue[currentTrackIndex]) {
        track = playerQueue[currentTrackIndex];
    } else if (typeof currentTrack !== 'undefined' && currentTrack) {
        track = currentTrack;
    }

    if (!track || (!track.path && !track.id)) {
        if (typeof showToast === 'function') {
            showToast('Selecciona o reproduce una canción para compartir', 'warning');
        } else {
            alert('Selecciona o reproduce una canción para compartir');
        }
        return;
    }

    window._pendingShareTrack = track;

    const modal = document.getElementById('share-modal');
    if (!modal) return;

    const titleEl = document.getElementById('share-modal-title');
    const artistEl = document.getElementById('share-modal-artist');
    const coverEl = document.getElementById('share-modal-cover');

    if (titleEl) titleEl.textContent = track.title || track.filename || 'Pista Multimedia';
    if (artistEl) artistEl.textContent = track.artist || 'Kraken';
    if (coverEl) {
        if (track.path) {
            coverEl.src = '/caratula/' + encodeURIComponent(track.path);
        } else if (track.id) {
            coverEl.src = '/api/cover/' + track.id;
        } else {
            coverEl.src = '/static/default_cover.jpg';
        }
    }

    // Resetear vistas
    const resultBox = document.getElementById('share-result-box');
    if (resultBox) resultBox.classList.add('hidden');
    const btnDo = document.getElementById('btn-do-share');
    if (btnDo) {
        btnDo.disabled = false;
        btnDo.innerHTML = '<i class="fa-solid fa-link"></i> Generar Enlace Temporal';
    }

    modal.classList.remove('hidden');
}

function closeShareModal() {
    const modal = document.getElementById('share-modal');
    if (modal) modal.classList.add('hidden');
    window._pendingShareTrack = null;
}

async function submitCreateShareLink() {
    const track = window._pendingShareTrack;
    if (!track) return;

    const durationSelect = document.getElementById('share-modal-duration');
    const hours = parseFloat(durationSelect ? durationSelect.value : '24') || 24;

    const btn = document.getElementById('btn-do-share');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando Enlace Cifrado...';
    }

    try {
        const payload = {
            expires_in_hours: hours,
            media_id: track.id || undefined,
            path: track.path || undefined
        };

        const token = window.krakenAuth?.getToken() || localStorage.getItem('kraken_auth_token') || '';
        const res = await fetch('/api/share/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.ok && data.share_url) {
            const urlInput = document.getElementById('share-result-url');
            if (urlInput) urlInput.value = data.share_url;

            const expDate = new Date(data.expires_at * 1000);
            const expLabel = document.getElementById('share-expiry-label');
            if (expLabel) {
                expLabel.textContent = `Válido hasta: ${expDate.toLocaleDateString()} ${expDate.toLocaleTimeString()}`;
            }

            const nativeBtnWrap = document.getElementById('share-native-share-btn-wrap');
            if (nativeBtnWrap) {
                if (navigator.share) {
                    nativeBtnWrap.classList.remove('hidden');
                } else {
                    nativeBtnWrap.classList.add('hidden');
                }
            }

            const resultBox = document.getElementById('share-result-box');
            if (resultBox) resultBox.classList.remove('hidden');

            if (btn) btn.innerHTML = '<i class="fa-solid fa-check"></i> Enlace Listo';
            
            // Copiar automáticamente al portapapeles
            copyShareResultUrl();
        } else {
            alert('Error generando enlace: ' + (data.error || 'Error desconocido'));
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-link"></i> Reintentar';
            }
        }
    } catch (e) {
        console.error('Error creating share link:', e);
        alert('Error al contactar con el servidor');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-link"></i> Reintentar';
        }
    }
}

function copyShareResultUrl() {
    const urlInput = document.getElementById('share-result-url');
    if (!urlInput || !urlInput.value) return;

    const copyText = document.getElementById('share-copy-text');
    const copyIcon = document.getElementById('share-copy-icon');

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(urlInput.value).then(() => {
            if (copyText) copyText.textContent = '¡Copiado!';
            if (copyIcon) copyIcon.className = 'fa-solid fa-check';
            if (typeof showToast === 'function') {
                showToast('¡Enlace seguro copiado al portapapeles!', 'success');
            }
            setTimeout(() => {
                if (copyText) copyText.textContent = 'Copiar';
                if (copyIcon) copyIcon.className = 'fa-regular fa-copy';
            }, 2500);
        }).catch(() => fallbackCopy(urlInput, copyText, copyIcon));
    } else {
        fallbackCopy(urlInput, copyText, copyIcon);
    }
}

function fallbackCopy(input, textEl, iconEl) {
    input.select();
    input.setSelectionRange(0, 99999);
    try {
        document.execCommand('copy');
        if (textEl) textEl.textContent = '¡Copiado!';
        if (iconEl) iconEl.className = 'fa-solid fa-check';
        if (typeof showToast === 'function') showToast('¡Enlace copiado!', 'success');
        setTimeout(() => {
            if (textEl) textEl.textContent = 'Copiar';
            if (iconEl) iconEl.className = 'fa-regular fa-copy';
        }, 2500);
    } catch (e) {}
}

function nativeShareUrl() {
    const urlInput = document.getElementById('share-result-url');
    const track = window._pendingShareTrack;
    if (!urlInput || !urlInput.value) return;

    if (navigator.share) {
        navigator.share({
            title: track?.title || 'Compartido desde Kraken',
            text: `Escucha "${track?.title || 'esta canción'}" en Kraken:`,
            url: urlInput.value
        }).catch(() => {});
    }
}
