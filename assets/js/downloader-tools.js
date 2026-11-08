/**
 * ============================================================================
 * KRAKEN MEDIA SERVER — downloader-tools.js
 * Descargador multimedia (YouTube/Spotify), historial, estadísticas, escáner de duplicados, reescaneo de biblioteca, favoritos y notificaciones.
 * ============================================================================
 */

/**
 * `analizarClipboard()`
 * Pega automáticamente el enlace del portapapeles en el buscador de descargas y lo analiza.
 */
async function analizarClipboard() { try { const t = await navigator.clipboard.readText(); if (t) { document.getElementById('url-input').value = t; analizar(); } } catch (e) { } }
/**
 * `analizar()`
 * Envía una URL o búsqueda (YouTube/Spotify) a `/analizar` para listar las pistas descargables.
 */
async function analizar() {
    const url = document.getElementById('url-input').value;
    if (!url) return;

    document.getElementById('download-area').classList.remove('hidden');
    document.getElementById('download-list').innerHTML = '<div class="text-center p-8"><i class="fa-solid fa-spinner fa-spin text-3xl text-blue-500"></i></div>';

    const res = await fetch('/analizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
    });

    const data = await res.json();
    downloadList = data.entries;

    // 1. Llenamos la memoria: todos seleccionados al inicio
    selectedDownloadIndices = new Set();

    // 2. Reset de paginación y dibujado
    currentLoadedCount = 20;
    renderDownloadList();
}

/**
 * `renderDownloadList()`
 * Renderiza los resultados obtenidos del analizador de descargas con casillas de selección.
 */
function renderDownloadList() {
    const container = document.getElementById('download-list');
    container.innerHTML = "";
    const term = document.getElementById('dl-search').value.toLowerCase();
    const filteredIndices = downloadList.map((v, i) => ({ v, i })).filter(item => item.v.title.toLowerCase().includes(term));

    if (!filteredIndices.length) return container.innerHTML = '<p class="text-center text-emerald-500 py-4">No hay resultados.</p>';

    const itemsToShow = filteredIndices.slice(0, 20);

    itemsToShow.forEach(item => {
        const { v, i } = item;
        const img = v.thumbnail || '';

        // Preguntamos si el índice está en nuestro Set de memoria
        const isChecked = selectedDownloadIndices.has(i) ? 'checked' : '';

        let statusIcon = '<div class="w-4 h-4 rounded-full border-2 border-emerald-600"></div>';
        let existsHtml = '';
        if (v.is_downloaded) {
            statusIcon = '<i class="fa-solid fa-check text-emerald-500"></i>';
            existsHtml = '<span class="text-[9px] bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded font-bold ml-2">EN BIBLIOTECA</span>';
        }

        // Usamos ${isChecked} en lugar de la palabra "checked" fija
        const checkboxHtml = v.is_downloaded ? statusIcon : `
<input type="checkbox" class="chk-dl w-4 h-4 accent-emerald-500 cursor-pointer" 
       value="${i}" ${isChecked} onchange="toggleDownloadSelection(${i}, this.checked)">`;

        container.innerHTML += `
<div class="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg group transition border border-white/5" id="row-${i}">
    <div class="w-8 flex justify-center shrink-0">${checkboxHtml}</div>
    <div class="w-6 flex justify-center text-sm" id="status-${i}">
        ${v.is_downloaded ? '' : '<i class="fa-regular fa-circle text-emerald-600"></i>'}
    </div>
    <img src="${img}" class="w-12 h-8 object-cover rounded bg-emerald-900 shrink-0" onerror="this.src='data:image/svg+xml,...'">
    <div class="flex-1 min-w-0">
        <input type="text" id="title-${i}" value="${escapeHtml(v.title)}" class="w-full bg-emerald-900/50 border-b border-emerald-700 focus:border-emerald-500 outline-none text-xs text-white px-2 py-1 rounded">
    </div>
    ${existsHtml}
</div>`;
    });

    if (filteredIndices.length > 20) {
        container.innerHTML += `<button onclick="loadMoreResults(${filteredIndices.length})" class="w-full mt-4 py-3 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition">CARGAR MÁS (${filteredIndices.length - 20} restantes)</button>`;
    }
}

/**
 * `loadMoreResults(total)`
 * Muestra más elementos en la lista de resultados de análisis de descarga.
 */
function loadMoreResults(total) {
    const container = document.getElementById('download-list');
    // Quitamos el botón anterior para que no se duplique abajo
    const lastBtn = container.querySelector('button');
    if (lastBtn) lastBtn.remove();

    const term = document.getElementById('dl-search').value.toLowerCase();
    const filteredIndices = downloadList.map((v, i) => ({ v, i })).filter(item => item.v.title.toLowerCase().includes(term));

    const newItems = filteredIndices.slice(currentLoadedCount, currentLoadedCount + 20);

    newItems.forEach(item => {
        const { v, i } = item;
        const img = v.thumbnail || '';

        const isChecked = selectedDownloadIndices.has(i) ? 'checked' : '';

        let statusIcon = '<div class="w-4 h-4 rounded-full border-2 border-emerald-600"></div>';
        let existsHtml = '';
        if (v.is_downloaded) {
            statusIcon = '<i class="fa-solid fa-check text-emerald-500"></i>';
            existsHtml = '<span class="text-[9px] bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded font-bold ml-2">EN BIBLIOTECA</span>';
        }

        const checkboxHtml = v.is_downloaded ? statusIcon : `
<input type="checkbox" class="chk-dl w-4 h-4 accent-emerald-500 cursor-pointer" 
       value="${i}" ${isChecked} onchange="toggleDownloadSelection(${i}, this.checked)">`;

        container.innerHTML += `
<div class="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg group transition border border-white/5" id="row-${i}">
    <div class="w-8 flex justify-center shrink-0">${checkboxHtml}</div>
    <div class="w-6 flex justify-center text-sm" id="status-${i}">
        ${v.is_downloaded ? '' : '<i class="fa-regular fa-circle text-emerald-600"></i>'}
    </div>
    <img src="${img}" referrerpolicy="no-referrer" class="w-12 h-8 object-cover rounded bg-emerald-900 shrink-0" onerror="this.src='data:image/svg+xml,...'">
    <div class="flex-1 min-w-0">
       <input type="text" id="title-${i}" value="${escapeHtml(v.title)}" class="w-full bg-emerald-900/50 border-b border-emerald-700 focus:border-emerald-500 outline-none text-xs text-white px-2 py-1 rounded">

    </div>
    ${existsHtml}
</div>`;
    });

    currentLoadedCount += 20;

    if (currentLoadedCount < filteredIndices.length) {
        container.innerHTML += `<button onclick="loadMoreResults(${total})" class="w-full mt-4 py-3 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition">CARGAR MÁS (${filteredIndices.length - currentLoadedCount} restantes)</button>`;
    }
}

/**
 * `filterDownloadList()`
 * Filtra en tiempo real los elementos de una lista de descarga analizada.
 */
function filterDownloadList() {
    currentLoadedCount = 20;
    renderDownloadList();
}

/**
 * `iniciarDescarga()`
 * Envía las pistas o videos seleccionados a `/descargar` con el formato y calidad elegidos.
 */
async function iniciarDescarga() {
    let dlStopped = false;

    // 1. Validar usando el Set (la memoria), no el HTML
    if (selectedDownloadIndices.size === 0) {
        showToast("¿Y las canciones? Selecciona algo 😒😒", "warning");
        return;
    }

    // 2. Construir la lista de items desde la memoria
    const items = Array.from(selectedDownloadIndices).map(idx => {
        const inputEl = document.getElementById(`title-${idx}`);
        const customTitle = inputEl ? inputEl.value.trim() : downloadList[idx].title;

        return {
            url: downloadList[idx].url,
            title: customTitle || downloadList[idx].title,
            index: idx,
            id: downloadList[idx].id
        };
    });

    const type = document.getElementById('dl-quality').value;
    document.getElementById('dl-progress').classList.remove('hidden');

    // 3. Loop de progreso
    const loop = setInterval(async () => {
        if (dlStopped) return;

        const res = await fetch('/status');
        const d = await res.json();

        document.getElementById('dl-percent').innerText = d.percent;
        document.getElementById('dl-filename').innerText = d.filename;
        document.getElementById('dl-bar').style.width = d.percent;
        document.getElementById('dl-details').innerText = d.details || '';

        // Icono del elemento actual
        if (d.current_index !== -1 && items[d.current_index]) {
            const iconDiv = document.getElementById(`status-${items[d.current_index].index}`);
            if (iconDiv) iconDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-blue-500"></i>';
        }

        // Iconos completados
        if (Array.isArray(d.completed_indices)) {
            d.completed_indices.forEach(realIdx => {
                if (items[realIdx]) {
                    const rowId = items[realIdx].index;
                    const iconDiv = document.getElementById(`status-${rowId}`);
                    if (iconDiv) iconDiv.innerHTML = '<i class="fa-solid fa-check text-emerald-500"></i>';
                }
            });
        }

        // ❌ Error
        if (d.failed) {
            dlStopped = true;
            clearInterval(loop);

            document.getElementById('dl-progress').classList.add('hidden');
            showStickyToast(d.details || 'Este enlace no permite descarga directa.', 'error');

            selectedDownloadIndices.clear();
            setTimeout(() => {
                cargarLib();
                cargarHistorial();
            }, 300);

            return;
        }

        // ✅ Finalizado con éxito
        if (!d.active && d.percent === "100%") {
            dlStopped = true;
            clearInterval(loop);

            document.getElementById('dl-progress').classList.add('hidden');
            showStickyToast('¡Descarga finalizada con éxito!', 'success');

            selectedDownloadIndices.clear();
            setTimeout(() => {
                cargarLib();
                cargarHistorial();
            }, 300);
        }

    }, 500);

    // 4. Enviar la orden al servidor
    await fetch('/descargar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, type })
    });
}
/**
 * `detener()`
 * Solicita al servidor cancelar el proceso de descarga en curso.
 */
async function detener() { await fetch('/stop', { method: 'POST' }); }

/**
 * `cargarHistorial()`
 * Consulta y muestra el historial reciente de reproducción del usuario.
 */
async function cargarHistorial() { const res = await fetch('/historial?limit=200'); const data = await res.json(); const div = document.getElementById('history-container'); div.innerHTML = ""; const ids = Object.keys(data).reverse(); if (!ids.length) { div.innerHTML = "<p class='text-emerald-500 opacity-50 text-center py-10'>El historial está vacío.</p>"; return; } ids.forEach(id => { const item = data[id]; const date = new Date(item.date * 1000).toLocaleString(); div.innerHTML += `<div class="flex justify-between items-center p-3 border-b border-emerald-800 hover:bg-emerald-900 transition"><div class="min-w-0"><div class="text-xs text-white truncate font-bold">${item.title}</div><div class="text-[9px] text-emerald-500 font-mono flex gap-2"><span>${date}</span><span class="text-emerald-500">${item.filename.split('.').pop().toUpperCase()}</span></div></div><button onclick="borrarHistorial('${id}')" class="text-[9px] bg-red-900/20 text-red-400 px-3 py-1 rounded hover:bg-red-900/50">Olvidar</button></div>`; }); }
/**
 * `borrarHistorial(id)`
 * Elimina una entrada del historial de reproducción.
 */
async function borrarHistorial(id) { if (!confirm("¿Olvidar?")) return; await fetch('/borrar_historial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); cargarHistorial(); }
/**
 * `cargarEstadisticas()`
 * Obtiene de `/api/stats` y renderiza el resumen de escuchas, top artistas y top canciones.
 */
window._currentStatsTab = 'audio';
window._statsCacheData = null;

async function cargarEstadisticas(forceTab) {
    if (forceTab) window._currentStatsTab = forceTab;
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Error al cargar estadísticas');
        window._statsCacheData = data;
        renderStatsContent();
    } catch (e) {
        console.error("Error cargando estadísticas:", e);
        const area = document.getElementById('stats-content-area');
        if (area) area.innerHTML = `<div class="p-8 text-center text-zinc-400">No se pudieron cargar las estadísticas.</div>`;
    }
}

window.cambiarPestanaStats = function (tab) {
    window._currentStatsTab = tab;
    ['audio', 'video', 'global'].forEach(t => {
        const btn = document.getElementById(`stats-tab-${t}`);
        if (!btn) return;
        if (t === tab) {
            btn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition bg-emerald-500 text-black shadow';
        } else {
            btn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition text-zinc-400 hover:text-white';
        }
    });
    renderStatsContent();
};

function renderStatsContent() {
    const data = window._statsCacheData;
    const area = document.getElementById('stats-content-area');
    if (!data || !area) return;

    const tab = window._currentStatsTab || 'audio';

    if (tab === 'audio') {
        const a = data.audio || {};
        const totalSecs = a.total_time_sec || 0;
        const hours = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

        const topArtistsHtml = (a.top_artists || []).length ? a.top_artists.map((art, idx) => {
            const maxPlays = Math.max(...a.top_artists.map(x => x.plays));
            const pct = maxPlays > 0 ? Math.round((art.plays / maxPlays) * 100) : 0;
            return `
                <div class="flex items-center gap-3">
                    <span class="text-xs font-bold text-amber-400/80 w-5">#${idx + 1}</span>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between text-xs mb-1">
                            <span class="text-white font-semibold truncate">${escapeHtml(art.artist || 'Desconocido')}</span>
                            <span class="text-zinc-400 text-[10px] font-mono">${art.plays} plays</span>
                        </div>
                        <div class="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div class="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full" style="width: ${pct}%"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('') : '<div class="text-xs text-zinc-500 text-center py-6">Sin historial suficiente</div>';

        const topTracksHtml = (a.top_tracks || []).length ? a.top_tracks.map((trk, idx) => {
            const maxPlays = Math.max(...a.top_tracks.map(x => x.plays));
            const pct = maxPlays > 0 ? Math.round((trk.plays / maxPlays) * 100) : 0;
            return `
                <div class="flex items-center gap-3">
                    <span class="text-xs font-bold text-pink-400/80 w-5">#${idx + 1}</span>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between text-xs mb-1">
                            <span class="text-white font-semibold truncate">${escapeHtml(trk.title || 'Desconocido')}</span>
                            <span class="text-zinc-400 text-[10px] font-mono">${trk.plays} plays</span>
                        </div>
                        <div class="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div class="h-full bg-gradient-to-r from-pink-500 to-purple-400 rounded-full" style="width: ${pct}%"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('') : '<div class="text-xs text-zinc-500 text-center py-6">Sin historial suficiente</div>';

        const genresHtml = (a.top_genres || []).map(g => `
            <span class="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/5 text-xs text-zinc-200 font-medium flex items-center justify-between gap-2">
                <span>${escapeHtml(g.genre)}</span>
                <span class="text-emerald-400 font-mono text-[10px]">${g.count}</span>
            </span>
        `).join('');

        area.innerHTML = `
            <!-- TARJETAS METRICAS AUDIO -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="glass p-4 rounded-2xl text-center border border-white/5 shadow-lg">
                    <div class="text-3xl font-black text-emerald-400">${a.total_plays || 0}</div>
                    <div class="text-[10px] text-zinc-400 uppercase tracking-wider mt-1 font-bold">Reproducciones</div>
                </div>
                <div class="glass p-4 rounded-2xl text-center border border-white/5 shadow-lg">
                    <div class="text-3xl font-black text-purple-400">${timeStr}</div>
                    <div class="text-[10px] text-zinc-400 uppercase tracking-wider mt-1 font-bold">Tiempo de Escucha</div>
                </div>
                <div class="glass p-4 rounded-2xl text-center border border-white/5 shadow-lg">
                    <div class="text-3xl font-black text-amber-400 truncate">${escapeHtml(a.top_artists?.[0]?.artist || '-')}</div>
                    <div class="text-[10px] text-zinc-400 uppercase tracking-wider mt-1 font-bold">Artista Más Escuchado</div>
                </div>
                <div class="glass p-4 rounded-2xl text-center border border-white/5 shadow-lg">
                    <div class="text-3xl font-black text-pink-400 truncate">${escapeHtml(a.top_tracks?.[0]?.title || '-')}</div>
                    <div class="text-[10px] text-zinc-400 uppercase tracking-wider mt-1 font-bold">Canción Favorita</div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div class="glass p-5 rounded-2xl border border-white/5">
                    <h3 class="text-sm font-black text-amber-400 mb-4 flex items-center gap-2 uppercase tracking-wider">
                        <i class="fa-solid fa-microphone"></i> Top Artistas
                    </h3>
                    <div class="space-y-3 max-h-80 overflow-y-auto no-scrollbar">${topArtistsHtml}</div>
                </div>
                <div class="glass p-5 rounded-2xl border border-white/5">
                    <h3 class="text-sm font-black text-pink-400 mb-4 flex items-center gap-2 uppercase tracking-wider">
                        <i class="fa-solid fa-music"></i> Top Canciones
                    </h3>
                    <div class="space-y-3 max-h-80 overflow-y-auto no-scrollbar">${topTracksHtml}</div>
                </div>
            </div>

            ${genresHtml ? `
                <div class="glass p-5 rounded-2xl border border-white/5">
                    <h3 class="text-xs uppercase tracking-wider text-zinc-400 font-bold mb-3">Géneros Musicales Más Frecuentes</h3>
                    <div class="flex flex-wrap gap-2">${genresHtml}</div>
                </div>
            ` : ''}
        `;
    } else if (tab === 'video') {
        const v = data.video || {};
        const hours = Math.round((v.total_watch_hours || 0) * 10) / 10;

        const topDirsHtml = (v.top_directors || []).map(d => `
            <span class="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/5 text-xs text-zinc-200 font-medium flex items-center justify-between gap-2">
                <span>${escapeHtml(d.director)}</span>
                <span class="text-emerald-400 font-mono text-[10px]">${d.count} títulos</span>
            </span>
        `).join('');

        const topGenresHtml = (v.top_genres || []).map(g => `
            <span class="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/5 text-xs text-zinc-200 font-medium flex items-center justify-between gap-2">
                <span>${escapeHtml(g.genre)}</span>
                <span class="text-cyan-400 font-mono text-[10px]">${g.count}</span>
            </span>
        `).join('');

        area.innerHTML = `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="glass p-4 rounded-2xl text-center border border-white/5 shadow-lg">
                    <div class="text-3xl font-black text-cyan-400">${v.watched_videos || 0}</div>
                    <div class="text-[10px] text-zinc-400 uppercase tracking-wider mt-1 font-bold">Videos en Progreso</div>
                </div>
                <div class="glass p-4 rounded-2xl text-center border border-white/5 shadow-lg">
                    <div class="text-3xl font-black text-emerald-400">${hours}h</div>
                    <div class="text-[10px] text-zinc-400 uppercase tracking-wider mt-1 font-bold">Horas Vistas</div>
                </div>
                <div class="glass p-4 rounded-2xl text-center border border-white/5 shadow-lg">
                    <div class="text-3xl font-black text-indigo-400">${v.completed_videos || 0}</div>
                    <div class="text-[10px] text-zinc-400 uppercase tracking-wider mt-1 font-bold">Completados al 100%</div>
                </div>
                <div class="glass p-4 rounded-2xl text-center border border-white/5 shadow-lg">
                    <div class="text-3xl font-black text-amber-400">${v.total_movies || 0}</div>
                    <div class="text-[10px] text-zinc-400 uppercase tracking-wider mt-1 font-bold">Películas Disponibles</div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="glass p-5 rounded-2xl border border-white/5">
                    <h3 class="text-xs uppercase tracking-wider text-cyan-400 font-black mb-3 flex items-center gap-2">
                        <i class="fa-solid fa-clapperboard"></i> Géneros de Video Más Vistos
                    </h3>
                    <div class="flex flex-wrap gap-2">${topGenresHtml || '<span class="text-xs text-zinc-500">Sin datos</span>'}</div>
                </div>
                <div class="glass p-5 rounded-2xl border border-white/5">
                    <h3 class="text-xs uppercase tracking-wider text-emerald-400 font-black mb-3 flex items-center gap-2">
                        <i class="fa-solid fa-bullhorn"></i> Directores Más Frecuentes
                    </h3>
                    <div class="flex flex-wrap gap-2">${topDirsHtml || '<span class="text-xs text-zinc-500">Sin datos</span>'}</div>
                </div>
            </div>
        `;
    } else if (tab === 'global') {
        const g = data.global || {};
        area.innerHTML = `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="glass p-4 rounded-2xl text-center border border-white/5 shadow-lg">
                    <div class="text-3xl font-black text-emerald-400">${g.audio_count || 0}</div>
                    <div class="text-[10px] text-zinc-400 uppercase tracking-wider mt-1 font-bold">Pistas de Música</div>
                </div>
                <div class="glass p-4 rounded-2xl text-center border border-white/5 shadow-lg">
                    <div class="text-3xl font-black text-cyan-400">${g.video_count || 0}</div>
                    <div class="text-[10px] text-zinc-400 uppercase tracking-wider mt-1 font-bold">Archivos de Video</div>
                </div>
                <div class="glass p-4 rounded-2xl text-center border border-white/5 shadow-lg">
                    <div class="text-3xl font-black text-purple-400">${g.distinct_artists || 0}</div>
                    <div class="text-[10px] text-zinc-400 uppercase tracking-wider mt-1 font-bold">Artistas Únicos</div>
                </div>
                <div class="glass p-4 rounded-2xl text-center border border-white/5 shadow-lg">
                    <div class="text-3xl font-black text-amber-400">${g.distinct_albums || 0}</div>
                    <div class="text-[10px] text-zinc-400 uppercase tracking-wider mt-1 font-bold">Álbumes Únicos</div>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="glass p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                    <div>
                        <div class="text-xs text-zinc-400 uppercase tracking-wider font-bold">Almacenamiento Total Música</div>
                        <div class="text-2xl font-black text-white mt-1">${g.audio_bytes_gb || 0} GB</div>
                    </div>
                    <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xl">
                        <i class="fa-solid fa-hard-drive"></i>
                    </div>
                </div>
                <div class="glass p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                    <div>
                        <div class="text-xs text-zinc-400 uppercase tracking-wider font-bold">Almacenamiento Total Video</div>
                        <div class="text-2xl font-black text-white mt-1">${g.video_bytes_gb || 0} GB</div>
                    </div>
                    <div class="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-xl">
                        <i class="fa-solid fa-server"></i>
                    </div>
                </div>
                <div class="glass p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                    <div>
                        <div class="text-xs text-zinc-400 uppercase tracking-wider font-bold">Favoritos Musicales</div>
                        <div class="text-2xl font-black text-pink-400 mt-1">❤️ ${g.audio_favs || 0}</div>
                    </div>
                    <div class="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-400 flex items-center justify-center text-xl">
                        <i class="fa-solid fa-heart"></i>
                    </div>
                </div>
                <div class="glass p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                    <div>
                        <div class="text-xs text-zinc-400 uppercase tracking-wider font-bold">Favoritos en Video</div>
                        <div class="text-2xl font-black text-amber-400 mt-1">⭐ ${g.video_favs || 0}</div>
                    </div>
                    <div class="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-xl">
                        <i class="fa-solid fa-star"></i>
                    </div>
                </div>
            </div>
        `;
    }
}

// ============================================================================
// 🍾 MODO FIESTA (PARTY MODE - HOST VIEW & BACKGROUND SYNC)
// ============================================================================
window._krkPartyActive = false;
window._krkPartyPollTimer = null;
window._krkPartyCursor = 0;

window.openPartyModal = async function () {
    let modal = document.getElementById('krk-party-host-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'krk-party-host-modal';
        modal.className = 'fixed inset-0 z-[1400] p-4 md:p-8 flex items-center justify-center';
        document.body.appendChild(modal);
    }

    try {
        const res = await fetch('/api/party/status');
        const st = await res.json();
        window._krkPartyActive = Boolean(st.active);
        if (window._krkPartyActive) {
            iniciarPartySyncLoop();
            syncPartyQueueToPlayer(st.queue || []);
        }
        renderPartyModalContent(st);
    } catch (e) {
        console.error('Error abriendo modo fiesta:', e);
        showToast('No se pudo conectar con el Modo Fiesta', 'error');
    }
};

function updatePartyTopBarButtons(isActive) {
    const badgeDsk = document.getElementById('party-badge-desktop');
    const badgeMob = document.getElementById('party-badge-mobile');
    const btnDsk = document.getElementById('btn-party-desktop');
    const btnMob = document.getElementById('btn-party-mobile');
    if (badgeDsk) badgeDsk.classList.toggle('hidden', !isActive);
    if (badgeMob) badgeMob.classList.toggle('hidden', !isActive);
    if (btnDsk) {
        btnDsk.classList.toggle('bg-amber-500/20', isActive);
        btnDsk.classList.toggle('border-emerald-400/60', isActive);
    }
    if (btnMob) {
        btnMob.classList.toggle('bg-amber-500/30', isActive);
        btnMob.classList.toggle('border-emerald-400/70', isActive);
    }
}

function renderPartyModalContent(st) {
    const modal = document.getElementById('krk-party-host-modal');
    if (!modal) return;

    const guestUrl = st.guest_url || `${window.location.origin}/fiesta`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(guestUrl)}`;
    const isActive = Boolean(st.active);
    updatePartyTopBarButtons(isActive);

    const queueItems = (st.queue || []).map((it, idx) => `
        <div class="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-white/5 gap-2">
            <div class="flex items-center gap-3 min-w-0">
                <span class="text-xs font-bold text-amber-400 w-4 shrink-0">${idx + 1}</span>
                <div class="min-w-0">
                    <div class="text-xs font-bold text-white truncate">${escapeHtml(it.title)}</div>
                    <div class="text-[10px] text-zinc-400 truncate">${escapeHtml(it.artist)} · <span class="text-amber-300">👤 ${escapeHtml(it.guest_name)}</span></div>
                </div>
            </div>
            <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">🔥 ${it.votes || 0}</span>
                <button onclick="playPartySongNow('${it.id}')" class="w-7 h-7 rounded-full bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-black flex items-center justify-center transition" title="Reproducir ahora">
                    <i class="fa-solid fa-play text-[10px] ml-0.5"></i>
                </button>
                <button onclick="skipPartySong('${it.id}')" class="w-7 h-7 rounded-full bg-white/10 hover:bg-red-500/20 hover:text-red-400 text-zinc-400 flex items-center justify-center transition" title="Quitar de cola">
                    <i class="fa-solid fa-xmark text-xs"></i>
                </button>
            </div>
        </div>
    `).join('');

    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/85 backdrop-blur-md" onclick="closePartyModal()"></div>
        <div class="relative z-10 w-full max-w-2xl bg-[#121317] border border-white/10 rounded-3xl shadow-2xl p-4 sm:p-6 md:p-8 flex flex-col gap-4 sm:gap-5 text-white max-h-[90vh] overflow-y-auto no-scrollbar">
            <!-- HEADER -->
            <div class="flex items-center justify-between border-b border-white/10 pb-3.5 sm:pb-4 gap-2">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-black shadow-lg shadow-amber-500/30 shrink-0">
                        <i class="fa-solid fa-champagne-glasses text-lg sm:text-xl"></i>
                    </div>
                    <div class="min-w-0">
                        <h2 class="text-base sm:text-xl md:text-2xl font-black text-white flex flex-wrap items-center gap-2 leading-tight">
                            <span>Modo Fiesta Colaborativo</span>
                            ${isActive ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500 text-black text-[10px] font-black uppercase">EN VIVO</span>' : '<span class="px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300 text-[10px] font-black uppercase">INACTIVO</span>'}
                        </h2>
                        <p class="text-[11px] sm:text-xs text-zinc-400 mt-0.5">Tus invitados agregan canciones a tu fila en tiempo real</p>
                    </div>
                </div>
                <button onclick="closePartyModal()" class="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition shrink-0">
                    <i class="fa-solid fa-xmark text-sm"></i>
                </button>
            </div>

            <!-- TOGGLE ACTIVO / INACTIVO -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                <div>
                    <div class="text-sm font-bold text-white">Estado del Modo Fiesta</div>
                    <div class="text-xs text-zinc-400">${isActive ? 'La sala está abierta y recibiendo canciones' : 'Actívalo para permitir que los invitados se conecten'}</div>
                </div>
                <button onclick="togglePartyModeHost()" class="w-full sm:w-auto px-6 py-2.5 rounded-full font-black text-xs transition shadow-lg shrink-0 ${isActive ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-emerald-500 hover:bg-emerald-400 text-black'}">
                    ${isActive ? 'Desactivar Modo Fiesta' : 'Activar Modo Fiesta'}
                </button>
            </div>

            ${isActive ? `
                <!-- LINK Y QR -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-white/[0.02] p-4 sm:p-5 rounded-2xl border border-white/5">
                    <div class="flex flex-col items-center justify-center bg-white p-3 rounded-2xl shadow-xl mx-auto sm:mx-0">
                        <img src="${qrUrl}" alt="QR Modo Fiesta" class="w-36 h-36 sm:w-44 sm:h-44 object-contain">
                        <div class="text-black text-[11px] font-black mt-1">Escanea para pedir canciones</div>
                    </div>
                    <div class="flex flex-col gap-3">
                        <div class="text-xs font-bold text-zinc-300">Enlace directo para invitados:</div>
                        <div class="p-3 bg-black/60 rounded-xl border border-white/10 font-mono text-xs text-amber-300 break-all select-all">
                            ${guestUrl}
                        </div>
                        <div class="flex gap-2">
                            <button onclick="copiarLinkFiesta('${escapeStr(guestUrl)}')" class="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/10 transition">
                                <i class="fa-solid fa-copy"></i> Copiar Enlace
                            </button>
                            <a href="${guestUrl}" target="_blank" class="px-3.5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-amber-500/30 transition" title="Abrir vista de invitado">
                                <i class="fa-solid fa-up-right-from-square"></i>
                            </a>
                        </div>
                        <div class="text-[11px] text-zinc-400 flex items-center gap-2">
                            <i class="fa-solid fa-users text-amber-400"></i>
                            <span>${st.guest_count || 0} invitados conectados</span>
                        </div>
                    </div>
                </div>

                <!-- COLA DE CANCIONES -->
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <div class="text-xs uppercase tracking-wider text-zinc-400 font-bold">Cola de Canciones de la Fiesta (${(st.queue || []).length})</div>
                        ${(st.queue || []).length > 0 ? `<button onclick="limpiarColaFiesta()" class="text-[11px] text-red-400 hover:text-red-300 font-bold">Limpiar cola</button>` : ''}
                    </div>
                    <div class="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
                        ${queueItems || '<div class="text-xs text-zinc-500 text-center py-6">Aún no hay canciones en la cola de fiesta</div>'}
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
}

window.closePartyModal = function () {
    const modal = document.getElementById('krk-party-host-modal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
};

window.copiarLinkFiesta = function (url) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(url).then(() => {
            showToast('📋 ¡Enlace del Modo Fiesta copiado!', 'success');
        }).catch(() => {
            _fallbackCopyText(url);
        });
    } else {
        _fallbackCopyText(url);
    }
};

function _fallbackCopyText(text) {
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('📋 ¡Enlace del Modo Fiesta copiado!', 'success');
    } catch (e) {
        showToast('Enlace: ' + text, 'info');
    }
}

window.togglePartyModeHost = async function () {
    try {
        const nextState = !Boolean(window._krkPartyActive);
        const res = await fetch('/api/party/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: nextState })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        window._krkPartyActive = Boolean(data.active);
        updatePartyTopBarButtons(window._krkPartyActive);
        showToast(data.message || (data.active ? '🎉 ¡Modo Fiesta activado!' : 'Modo Fiesta desactivado'), data.active ? 'success' : 'info');
        if (data.active) {
            iniciarPartySyncLoop();
        } else {
            detenerPartySyncLoop();
        }
        renderPartyModalContent(data);
    } catch (e) {
        console.error('Error al cambiar Modo Fiesta:', e);
        showToast('Error al cambiar Modo Fiesta', 'error');
    }
};

window._krkSeenPartyIds = window._krkSeenPartyIds || new Set();

function _buildPartyTrackObj(song) {
    const normSongPath = String(song.path || '').replace(/\\/g, '/');
    const matchFile = (typeof libData !== 'undefined' && libData && Array.isArray(libData.files))
        ? libData.files.find(f => String(f.path || '').replace(/\\/g, '/') === normSongPath)
        : null;
    const base = matchFile ? { ...matchFile } : {
        path: normSongPath,
        title: song.title || 'Canción',
        artist: song.artist || 'Desconocido',
        album: song.album || '',
        duration_sec: song.duration_sec || 0,
        type: 'audio',
        cover: song.cover
    };
    base._isPartyTrack = true;
    base._partyItemId = song.id;
    base._partyGuestName = song.guest_name || 'Invitado';
    base._partyVotes = song.votes || 1;
    return base;
}

function syncPartyQueueToPlayer(partyQueue) {
    if (typeof playerQueue === 'undefined' || !Array.isArray(playerQueue)) return;
    const queueArr = Array.isArray(partyQueue) ? partyQueue : [];

    // Notificar canciones recién pedidas
    queueArr.forEach(song => {
        if (song && song.id && !window._krkSeenPartyIds.has(song.id)) {
            window._krkSeenPartyIds.add(song.id);
            if (typeof showToast === 'function') {
                showToast(`🎉 ${song.guest_name || 'Invitado'} pidió: ${song.title}`, 'success');
            }
        }
    });

    const partyTracks = queueArr.map(_buildPartyTrackObj);
    const partyPaths = new Set(partyTracks.map(t => t.path));

    const isIdle = playerQueue.length === 0 || typeof currentTrackIndex === 'undefined' || currentTrackIndex < 0;

    if (isIdle) {
        if (partyTracks.length === 0) return;
        playerQueue = [...partyTracks];
        currentTrackIndex = 0;
        if (typeof updateQueueUI === 'function') updateQueueUI();
        if (typeof playTrack === 'function') {
            playTrack(playerQueue[0]);
        }
        return;
    }

    // Si ya hay reproducción activa, colocamos las canciones de la fiesta inmediatamente después de la pista actual (en orden de votos 🔥)
    const head = playerQueue.slice(0, currentTrackIndex + 1);
    const currentPlayingPath = head[head.length - 1]?.path;
    const filteredPartyTracks = partyTracks.filter(t => t.path !== currentPlayingPath);

    const tail = playerQueue.slice(currentTrackIndex + 1).filter(t => {
        if (!t) return false;
        if (t._isPartyTrack) return false; // Reemplazamos las de fiesta pendientes por el nuevo orden votado
        if (partyPaths.has(t.path)) return false; // Evitamos duplicados con la cola normal
        return true;
    });

    playerQueue = [...head, ...filteredPartyTracks, ...tail];
    if (typeof updateQueueUI === 'function') updateQueueUI();
}

window.playPartySongNow = async function (itemId) {
    try {
        const res = await fetch('/api/party/status');
        const st = await res.json();
        const target = (st.queue || []).find(q => q.id === itemId);
        if (!target) return;
        const trackObj = _buildPartyTrackObj(target);

        if (typeof playerQueue !== 'undefined' && Array.isArray(playerQueue)) {
            if (playerQueue.length === 0 || currentTrackIndex < 0) {
                playerQueue = [trackObj];
                currentTrackIndex = 0;
            } else {
                // Insertar justo después de la actual y saltar a ella
                playerQueue.splice(currentTrackIndex + 1, 0, trackObj);
                currentTrackIndex = currentTrackIndex + 1;
            }
            if (typeof updateQueueUI === 'function') updateQueueUI();
            if (typeof playTrack === 'function') playTrack(trackObj);
        }
    } catch (e) {}
};

// Sincronizar estado inicial del Modo Fiesta al cargar la app
setTimeout(async () => {
    try {
        const r = await fetch('/api/party/status');
        if (r.ok) {
            const st = await r.json();
            window._krkPartyActive = Boolean(st.active);
            updatePartyTopBarButtons(window._krkPartyActive);
            if (window._krkPartyActive) {
                (st.queue || []).forEach(q => { if (q && q.id) window._krkSeenPartyIds.add(q.id); });
                syncPartyQueueToPlayer(st.queue || []);
                iniciarPartySyncLoop();
            }
        }
    } catch (e) {}
}, 1500);

window.skipPartySong = async function (itemId) {
    try {
        await fetch('/api/party/mark-consumed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_id: itemId })
        });
        const res = await fetch('/api/party/status');
        const st = await res.json();
        syncPartyQueueToPlayer(st.queue || []);
        renderPartyModalContent(st);
        showToast('Canción retirada de la fiesta', 'info');
    } catch (e) {}
};

window.limpiarColaFiesta = async function () {
    try {
        await fetch('/api/party/clear', { method: 'POST' });
        const res = await fetch('/api/party/status');
        const st = await res.json();
        syncPartyQueueToPlayer(st.queue || []);
        renderPartyModalContent(st);
        showToast('Cola de fiesta vaciada', 'info');
    } catch (e) {}
};

function iniciarPartySyncLoop() {
    if (window._krkPartyPollTimer) clearInterval(window._krkPartyPollTimer);
    window._krkPartyPollTimer = setInterval(async () => {
        if (!window._krkPartyActive) return;
        try {
            const res = await fetch(`/api/party/host-sync?cursor=${window._krkPartyCursor}`);
            if (!res.ok) return;
            const data = await res.json();
            if (!data.active) {
                window._krkPartyActive = false;
                updatePartyTopBarButtons(false);
                detenerPartySyncLoop();
                return;
            }
            const prevCursor = window._krkPartyCursor;
            window._krkPartyCursor = data.sync_cursor ?? window._krkPartyCursor;

            if (data.has_changes || window._krkPartyCursor !== prevCursor) {
                syncPartyQueueToPlayer(data.queue || []);
                const modal = document.getElementById('krk-party-host-modal');
                if (modal && !modal.classList.contains('hidden')) {
                    fetch('/api/party/status').then(r => r.json()).then(renderPartyModalContent).catch(() => {});
                }
            }
        } catch (e) {}
    }, 3000);
}

function detenerPartySyncLoop() {
    if (window._krkPartyPollTimer) {
        clearInterval(window._krkPartyPollTimer);
        window._krkPartyPollTimer = null;
    }
}
/**
 * ============================================================================
 * KRAKEN MEDIA SERVER — downloader-tools.js
 * Descargador multimedia (YouTube/Spotify), historial, estadísticas, escáner de duplicados, reescaneo de biblioteca, favoritos y notificaciones.
 * ============================================================================
 */

/**
 * `analizarClipboard()`
 * Pega automáticamente el enlace del portapapeles en el buscador de descargas y lo analiza.
 */
async function analizarClipboard() { try { const t = await navigator.clipboard.readText(); if (t) { document.getElementById('url-input').value = t; analizar(); } } catch (e) { } }
/**
 * `analizar()`
 * Envía una URL o búsqueda (YouTube/Spotify) a `/analizar` para listar las pistas descargables.
 */
async function analizar() {
    const url = document.getElementById('url-input').value;
    if (!url) return;

    document.getElementById('download-area').classList.remove('hidden');
    document.getElementById('download-list').innerHTML = '<div class="text-center p-8"><i class="fa-solid fa-spinner fa-spin text-3xl text-blue-500"></i></div>';

    const res = await fetch('/analizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
    });

    const data = await res.json();
    downloadList = data.entries;

    // 1. Llenamos la memoria: todos seleccionados al inicio
    selectedDownloadIndices = new Set();

    // 2. Reset de paginación y dibujado
    currentLoadedCount = 20;
    renderDownloadList();
}

/**
 * `renderDownloadList()`
 * Renderiza los resultados obtenidos del analizador de descargas con casillas de selección.
 */
function renderDownloadList() {
    const container = document.getElementById('download-list');
    container.innerHTML = "";
    const term = document.getElementById('dl-search').value.toLowerCase();
    const filteredIndices = downloadList.map((v, i) => ({ v, i })).filter(item => item.v.title.toLowerCase().includes(term));

    if (!filteredIndices.length) return container.innerHTML = '<p class="text-center text-emerald-500 py-4">No hay resultados.</p>';

    const itemsToShow = filteredIndices.slice(0, 20);

    itemsToShow.forEach(item => {
        const { v, i } = item;
        const img = v.thumbnail || '';

        // Preguntamos si el índice está en nuestro Set de memoria
        const isChecked = selectedDownloadIndices.has(i) ? 'checked' : '';

        let statusIcon = '<div class="w-4 h-4 rounded-full border-2 border-emerald-600"></div>';
        let existsHtml = '';
        if (v.is_downloaded) {
            statusIcon = '<i class="fa-solid fa-check text-emerald-500"></i>';
            existsHtml = '<span class="text-[9px] bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded font-bold ml-2">EN BIBLIOTECA</span>';
        }

        // Usamos ${isChecked} en lugar de la palabra "checked" fija
        const checkboxHtml = v.is_downloaded ? statusIcon : `
<input type="checkbox" class="chk-dl w-4 h-4 accent-emerald-500 cursor-pointer" 
       value="${i}" ${isChecked} onchange="toggleDownloadSelection(${i}, this.checked)">`;

        container.innerHTML += `
<div class="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg group transition border border-white/5" id="row-${i}">
    <div class="w-8 flex justify-center shrink-0">${checkboxHtml}</div>
    <div class="w-6 flex justify-center text-sm" id="status-${i}">
        ${v.is_downloaded ? '' : '<i class="fa-regular fa-circle text-emerald-600"></i>'}
    </div>
    <img src="${img}" class="w-12 h-8 object-cover rounded bg-emerald-900 shrink-0" onerror="this.src='data:image/svg+xml,...'">
    <div class="flex-1 min-w-0">
        <input type="text" id="title-${i}" value="${escapeHtml(v.title)}" class="w-full bg-emerald-900/50 border-b border-emerald-700 focus:border-emerald-500 outline-none text-xs text-white px-2 py-1 rounded">
    </div>
    ${existsHtml}
</div>`;
    });

    if (filteredIndices.length > 20) {
        container.innerHTML += `<button onclick="loadMoreResults(${filteredIndices.length})" class="w-full mt-4 py-3 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition">CARGAR MÁS (${filteredIndices.length - 20} restantes)</button>`;
    }
}

/**
 * `loadMoreResults(total)`
 * Muestra más elementos en la lista de resultados de análisis de descarga.
 */
function loadMoreResults(total) {
    const container = document.getElementById('download-list');
    // Quitamos el botón anterior para que no se duplique abajo
    const lastBtn = container.querySelector('button');
    if (lastBtn) lastBtn.remove();

    const term = document.getElementById('dl-search').value.toLowerCase();
    const filteredIndices = downloadList.map((v, i) => ({ v, i })).filter(item => item.v.title.toLowerCase().includes(term));

    const newItems = filteredIndices.slice(currentLoadedCount, currentLoadedCount + 20);

    newItems.forEach(item => {
        const { v, i } = item;
        const img = v.thumbnail || '';

        const isChecked = selectedDownloadIndices.has(i) ? 'checked' : '';

        let statusIcon = '<div class="w-4 h-4 rounded-full border-2 border-emerald-600"></div>';
        let existsHtml = '';
        if (v.is_downloaded) {
            statusIcon = '<i class="fa-solid fa-check text-emerald-500"></i>';
            existsHtml = '<span class="text-[9px] bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded font-bold ml-2">EN BIBLIOTECA</span>';
        }

        const checkboxHtml = v.is_downloaded ? statusIcon : `
<input type="checkbox" class="chk-dl w-4 h-4 accent-emerald-500 cursor-pointer" 
       value="${i}" ${isChecked} onchange="toggleDownloadSelection(${i}, this.checked)">`;

        container.innerHTML += `
<div class="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg group transition border border-white/5" id="row-${i}">
    <div class="w-8 flex justify-center shrink-0">${checkboxHtml}</div>
    <div class="w-6 flex justify-center text-sm" id="status-${i}">
        ${v.is_downloaded ? '' : '<i class="fa-regular fa-circle text-emerald-600"></i>'}
    </div>
    <img src="${img}" referrerpolicy="no-referrer" class="w-12 h-8 object-cover rounded bg-emerald-900 shrink-0" onerror="this.src='data:image/svg+xml,...'">
    <div class="flex-1 min-w-0">
       <input type="text" id="title-${i}" value="${escapeHtml(v.title)}" class="w-full bg-emerald-900/50 border-b border-emerald-700 focus:border-emerald-500 outline-none text-xs text-white px-2 py-1 rounded">

    </div>
    ${existsHtml}
</div>`;
    });

    currentLoadedCount += 20;

    if (currentLoadedCount < filteredIndices.length) {
        container.innerHTML += `<button onclick="loadMoreResults(${total})" class="w-full mt-4 py-3 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition">CARGAR MÁS (${filteredIndices.length - currentLoadedCount} restantes)</button>`;
    }
}

/**
 * `filterDownloadList()`
 * Filtra en tiempo real los elementos de una lista de descarga analizada.
 */
function filterDownloadList() {
    currentLoadedCount = 20;
    renderDownloadList();
}

/**
 * `iniciarDescarga()`
 * Envía las pistas o videos seleccionados a `/descargar` con el formato y calidad elegidos.
 */
async function iniciarDescarga() {
    let dlStopped = false;

    // 1. Validar usando el Set (la memoria), no el HTML
    if (selectedDownloadIndices.size === 0) {
        showToast("¿Y las canciones? Selecciona algo 😒😒", "warning");
        return;
    }

    // 2. Construir la lista de items desde la memoria
    const items = Array.from(selectedDownloadIndices).map(idx => {
        const inputEl = document.getElementById(`title-${idx}`);
        const customTitle = inputEl ? inputEl.value.trim() : downloadList[idx].title;

        return {
            url: downloadList[idx].url,
            title: customTitle || downloadList[idx].title,
            index: idx,
            id: downloadList[idx].id
        };
    });

    const type = document.getElementById('dl-quality').value;
    document.getElementById('dl-progress').classList.remove('hidden');

    // 3. Loop de progreso
    const loop = setInterval(async () => {
        if (dlStopped) return;

        const res = await fetch('/status');
        const d = await res.json();

        document.getElementById('dl-percent').innerText = d.percent;
        document.getElementById('dl-filename').innerText = d.filename;
        document.getElementById('dl-bar').style.width = d.percent;
        document.getElementById('dl-details').innerText = d.details || '';

        // Icono del elemento actual
        if (d.current_index !== -1 && items[d.current_index]) {
            const iconDiv = document.getElementById(`status-${items[d.current_index].index}`);
            if (iconDiv) iconDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-blue-500"></i>';
        }

        // Iconos completados
        if (Array.isArray(d.completed_indices)) {
            d.completed_indices.forEach(realIdx => {
                if (items[realIdx]) {
                    const rowId = items[realIdx].index;
                    const iconDiv = document.getElementById(`status-${rowId}`);
                    if (iconDiv) iconDiv.innerHTML = '<i class="fa-solid fa-check text-emerald-500"></i>';
                }
            });
        }

        // ❌ Error
        if (d.failed) {
            dlStopped = true;
            clearInterval(loop);

            document.getElementById('dl-progress').classList.add('hidden');
            showStickyToast(d.details || 'Este enlace no permite descarga directa.', 'error');

            selectedDownloadIndices.clear();
            setTimeout(() => {
                cargarLib();
                cargarHistorial();
            }, 300);

            return;
        }

        // ✅ Finalizado con éxito
        if (!d.active && d.percent === "100%") {
            dlStopped = true;
            clearInterval(loop);

            document.getElementById('dl-progress').classList.add('hidden');
            showStickyToast('¡Descarga finalizada con éxito!', 'success');

            selectedDownloadIndices.clear();
            setTimeout(() => {
                cargarLib();
                cargarHistorial();
            }, 300);
        }

    }, 500);

    // 4. Enviar la orden al servidor
    await fetch('/descargar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, type })
    });
}
/**
 * `detener()`
 * Solicita al servidor cancelar el proceso de descarga en curso.
 */
async function detener() { await fetch('/stop', { method: 'POST' }); }

/**
 * `cargarHistorial()`
 * Consulta y muestra el historial reciente de reproducción del usuario.
 */
async function cargarHistorial() { const res = await fetch('/historial?limit=200'); const data = await res.json(); const div = document.getElementById('history-container'); div.innerHTML = ""; const ids = Object.keys(data).reverse(); if (!ids.length) { div.innerHTML = "<p class='text-emerald-500 opacity-50 text-center py-10'>El historial está vacío.</p>"; return; } ids.forEach(id => { const item = data[id]; const date = new Date(item.date * 1000).toLocaleString(); div.innerHTML += `<div class="flex justify-between items-center p-3 border-b border-emerald-800 hover:bg-emerald-900 transition"><div class="min-w-0"><div class="text-xs text-white truncate font-bold">${item.title}</div><div class="text-[9px] text-emerald-500 font-mono flex gap-2"><span>${date}</span><span class="text-emerald-500">${item.filename.split('.').pop().toUpperCase()}</span></div></div><button onclick="borrarHistorial('${id}')" class="text-[9px] bg-red-900/20 text-red-400 px-3 py-1 rounded hover:bg-red-900/50">Olvidar</button></div>`; }); }
/**
 * `borrarHistorial(id)`
 * Elimina una entrada del historial de reproducción.
 */
async function borrarHistorial(id) { if (!confirm("¿Olvidar?")) return; await fetch('/borrar_historial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); cargarHistorial(); }
// (cargarEstadisticas antigua eliminada - se usa la version con pestanas definida arriba)

/**
 * `formatDuration(secs)`
 * Convierte segundos totales en una cadena legible de horas y minutos.
 */
function formatDuration(secs) {
    if (!secs) return '0m';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
/**
 * `resetFilters()`
 * Limpia todos los filtros de búsqueda y recarga la vista principal de biblioteca.
 */
function resetFilters() {
    filters = { folder: 'all', artist: 'all', album: 'all', rating: 'all', playlist: 'all', genre: 'all', sort: 'default' };

    const titleDesktop = document.getElementById('lib-title-desktop');
    const titleMobile = document.getElementById('lib-title-mobile');
    const newTitle = getCurrentLibraryTitle();

    if (titleDesktop) titleDesktop.innerText = newTitle;
    if (titleMobile) titleMobile.innerText = newTitle;

    renderLib();
    renderSidebarLists();
}
/**
 * `toggleSelectAll(source)`
 * Marca o desmarca todos los ítems en la lista del descargador.
 */
function toggleSelectAll(source) {
    const isChecked = source.checked;
    const term = document.getElementById('dl-search').value.toLowerCase();

    const visibleNotDownloaded = downloadList
        .map((v, i) => ({ v, i }))
        .filter(item =>
            item.v.title.toLowerCase().includes(term) &&
            !item.v.is_downloaded &&
            document.getElementById(`row-${item.i}`)
        )
        .map(item => item.i);

    if (isChecked) {
        visibleNotDownloaded.forEach(i => selectedDownloadIndices.add(i));
    } else {
        visibleNotDownloaded.forEach(i => selectedDownloadIndices.delete(i));
    }

    renderDownloadList();
}

/**
 * `openSidebar()`
 * Abre el cajón de navegación lateral (drawer) y activa el fondo oscuro.
 */
function openSidebar() {
    const sb = document.getElementById('main-sidebar');
    const bd = document.getElementById('sidebar-backdrop');
    if (!sb || !bd) return;
    sb.classList.remove('hidden');
    sb.classList.add('sidebar-open');
    bd.classList.add('show');
    document.body.classList.add('sidebar-open');
}

/**
 * `closeSidebar()`
 * Cierra el cajón de navegación lateral.
 */
function closeSidebar() {
    const sb = document.getElementById('main-sidebar');
    const bd = document.getElementById('sidebar-backdrop');
    if (!sb || !bd) return;
    sb.classList.remove('sidebar-open');
    bd.classList.remove('show');
    document.body.classList.remove('sidebar-open');
}

/**
 * `toggleSidebar()`
 * Alterna la visibilidad de la barra lateral de navegación.
 */
function toggleSidebar() {
    const sb = document.getElementById('main-sidebar');
    if (!sb) return;
    if (sb.classList.contains('sidebar-open')) closeSidebar();
    else openSidebar();
}

/**
 * `borrarArchivo(path)`
 * Elimina un archivo multimedia desde su tarjeta o fila tras validar el PIN Maestro.
 */
async function borrarArchivo(path) {
    if (!confirm("¿Estás seguro de eliminar este archivo permanentemente?")) return;

    const res = await fetch('/borrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: path })
    });

    const data = await res.json();
    if (data.ok) {
        // ESTO ES CLAVE: Recargar la librería para ver que ya no está
        await cargarLib();
        showToast("Archivo eliminado", "success");
    } else {
        showToast("Error al eliminar", "error");
    }
}
/**
 * `cleanGhosts()`
 * Ejecuta la limpieza de entradas huérfanas en la base de datos cuyos archivos ya no existen en disco.
 */
async function cleanGhosts() {
    // Usamos comillas dobles normales para evitar errores
    if (!confirm("Esto revisará todo tu historial y borrará las entradas de archivos que ya no existen en el disco. ¿Continuar?")) return;

    const btn = document.activeElement;
    const originalText = btn ? btn.innerText : '';
    if (btn) btn.innerText = "Limpiando...";

    try {
        const res = await fetch('/clean_ghosts', { method: 'POST' });
        const data = await res.json();

        if (data.ok) {
            if (data.count > 0) {
                // CORRECCIÓN AQUÍ: Usamos \\n (doble diagonal)
                var msg = "✨ ¡Listo!\\nSe eliminaron " + data.count + " fantasmas del historial.";

                if (data.names.length > 0) {
                    msg += "\\n\\nAlgunos eliminados:\\n- " + data.names.slice(0, 5).join('\\n- ');
                }

                if (data.names.length > 5) {
                    msg += "\\n... y más.";
                }

                showToast(msg);

                if (typeof cargarLib === 'function') await cargarLib();

            } else {
                showToast("Tu historial está limpio. No se encontraron fantasmas.", "info");
            }
        } else {
            showToast("Hubo un error al intentar limpiar.", "error");
        }
    } catch (e) {
        showToast("Error de conexión: " + e);
    }

    if (btn) btn.innerText = originalText;
}
/**
 * `removeFromPlaylist(plName, filePath, e)`
 * Elimina una pista de la playlist activa.
 */
async function removeFromPlaylist(plName, filePath, e) {
    // Detener la propagación para que no reproduzca la canción al borrar
    if (e) e.stopPropagation();

    // Confirmación simple
    if (!confirm("¿Quitar esta canción de la lista?")) return;

    const res = await fetch('/playlist/remove_item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist: plName, file: filePath, owner: window.MY_EMAIL })
    });

    const data = await res.json();

    if (data.ok) {
        await cargarLib(); // Recargar visualmente
    } else {
        showToast("Error al quitar la canción.", "error");
    }
}

// Función EXCLUSIVA para el botón naranja de la fila (Nombre único)
/**
 * `quitarDeListaRow(plName, filePath, e)`
 * Elimina inmediatamente una canción de la playlist actual desde el botón de su fila.
 */
async function quitarDeListaRow(plName, filePath, e) {
    // Evita que se reproduzca la canción al dar clic
    if (e) e.stopPropagation();

    if (!confirm("¿Sacar esta canción de la lista?")) return;

    const res = await fetch('/playlist/remove_item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist: plName, file: filePath, owner: window.MY_EMAIL })
    });

    const data = await res.json();
    if (data.ok) {
        await cargarLib(); // Recargar para ver que desaparece
    } else {
        showToast("Error al quitar la canción.", "error");
    }
}

/**
 * `closeDuplicatesPanel()`
 * Cierra el modal del escáner de archivos duplicados.
 */
function closeDuplicatesPanel() {
    const panel = document.getElementById('duplicates-panel-overlay');
    if (panel) panel.remove();
}

/**
 * `duplicateSize(bytes)`
 * Formatea el tamaño en bytes a MB o GB para el panel de duplicados.
 */
function duplicateSize(bytes) {
    const value = Number(bytes || 0);
    if (!value) return 'Tamaño desconocido';
    if (value >= 1073741824) return (value / 1073741824).toFixed(2) + ' GB';
    return (value / 1048576).toFixed(1) + ' MB';
}

/**
 * `showDuplicatesPanel()`
 * Construye y muestra la interfaz de detección y gestión de archivos duplicados.
 */
function showDuplicatesPanel() {
                closeDuplicatesPanel();
                const overlay = document.createElement('div');
                overlay.id = 'duplicates-panel-overlay';
                overlay.className = 'fixed inset-0 z-[2147483000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4';
                overlay.innerHTML = `
                    <div class="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-[#101113] border border-amber-500/20 shadow-2xl flex flex-col">
                        <div class="flex items-center justify-between gap-4 p-5 border-b border-white/10">
                            <div>
                                <h2 class="text-white text-lg font-bold flex items-center gap-2"><i class="fa-solid fa-copy text-amber-400"></i> Posibles duplicados</h2>
                                <p class="text-zinc-400 text-xs mt-1">Solo son sugerencias. No se elimina nada sin que tú lo decidas.</p>
                            </div>
                            <div class="flex items-center gap-2">
                                <button onclick="startDuplicateScan()" class="px-3 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/30 text-xs font-bold transition"><i class="fa-solid fa-magnifying-glass mr-1"></i> Analizar biblioteca</button>
                                <button onclick="closeDuplicatesPanel()" class="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300"><i class="fa-solid fa-xmark"></i></button>
                            </div>
                        </div>
                        <div id="duplicates-panel-status" class="hidden px-5 py-3 text-xs text-amber-300 bg-amber-500/5 border-b border-amber-500/10"></div>
                        <div id="duplicates-panel-content" style="min-height:0;flex:1;overflow:hidden;padding:1.25rem;display:flex;flex-direction:column;gap:1rem;"><div style="text-align:center;padding:3rem 0;color:#71717a;"><i class="fa-solid fa-spinner fa-spin" style="margin-right:0.5rem;"></i>Cargando...</div></div>
                    </div>`;
                overlay.addEventListener('click', e => { if (e.target === overlay) closeDuplicatesPanel(); });
                document.body.appendChild(overlay);
                loadDuplicateCandidates();
            }

            /**
             * `loadDuplicateCandidates(offset = 0)`
             * Consulta `/api/duplicates/status` y renderiza los grupos de duplicados exactos y posibles variantes.
             */
            async function loadDuplicateCandidates(offset = 0) {
                const content = document.getElementById('duplicates-panel-content');
                if (!content) return;
                try {
                    const res = await fetch(`/api/duplicates?limit=60&offset=${offset}`);
                    const data = await res.json();
                    if (!data.ok) throw new Error(data.error || 'No se pudo leer el informe');
                    const status = document.getElementById('duplicates-panel-status');
                    if (status) {
                        status.classList.remove('hidden');
                        status.textContent = data.group_count
                            ? `${data.group_count} grupos y ${data.item_count} archivos para revisar.`
                            : 'No hay candidatos todavía. Pulsa Analizar biblioteca para buscar.';
                    }
                    if (!data.groups?.length && offset === 0) {
                        content.innerHTML = '<div style="text-align:center;padding:4rem 0;color:#71717a;"><i class="fa-solid fa-circle-check" style="color:#34d399;font-size:2rem;margin-bottom:0.75rem;"></i><div>No se encontraron duplicados pendientes.</div><div style="font-size:0.75rem;margin-top:0.5rem;">Las versiones marcadas como Live, Acoustic, Remix o similares se mantienen separadas.</div></div>';
                        return;
                    }
                    if (offset === 0) {
                        duplicateSelectedIds.clear();
                        duplicateSelectedItems.clear();
                    }
                    const renderedGroups = data.groups.map(group => {
                        const origin = group.items[0];
                        const duplicates = group.items.slice(1);
                        const normalizeDuplicateText = value => String(value || '').trim().toLowerCase();
                        const albumNames = new Set(group.items.map(item => normalizeDuplicateText(item.album)).filter(Boolean));
                        const hasDifferentAlbum = albumNames.size > 1;
                        const sameAlbum = origin && origin.album && duplicates.length > 0 && duplicates.every(item => normalizeDuplicateText(item.album) === normalizeDuplicateText(origin.album));
                        const sameTechnicalFingerprint = origin && duplicates.length > 0 && duplicates.every(item => Number(item.size_bytes || 0) === Number(origin.size_bytes || 0) && Math.abs(Number(item.duration_sec || 0) - Number(origin.duration_sec || 0)) <= 2);
                        const strongMatch = (group.kind === 'exact' && !hasDifferentAlbum) || (sameAlbum && sameTechnicalFingerprint);
                        const category = strongMatch ? 'exact' : 'review';
                        const matchLabel = group.kind === 'exact' ? 'Byte a byte' : (strongMatch ? 'Mismo tamaño + álbum + duración' : 'Duración ±2 s');
                        const compactInfo = item => `
                            <div style="display:flex;align-items:flex-start;gap:0.6rem;min-width:0;">
                                <img src="/caratula/${encodeURIComponent(item.path)}" onerror="this.onerror=null; this.src='/static/default_cover.jpg'" style="width:2.5rem;height:2.5rem;border-radius:0.4rem;object-fit:cover;background:#000;flex-shrink:0;">
                                <div style="min-width:0;flex:1;">
                                    <div style="font-size:0.75rem;color:#fff;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.title || item.filename || 'Sin título')}</div>
                                    <div style="font-size:0.6875rem;color:#34d399;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.artist || 'Artista desconocido')}</div>
                                    <div style="font-size:0.6rem;color:#71717a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.album || 'Sin álbum')} · ${formatDuration(item.duration_sec || 0)} · ${duplicateSize(item.size_bytes)}</div>
                                    <div style="font-size:0.58rem;color:#52525b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(item.path || '')}">${escapeHtml(item.path || '')}</div>
                                </div>
                            </div>`;
                        duplicates.forEach(item => duplicateSelectedItems.set(String(item.id), item));
                        if (origin) duplicateSelectedItems.set(String(origin.id), origin);
                        return { category, html: `
                            <section class="duplicate-group" data-duplicate-category="${category}" style="flex:0 0 auto;min-height:8rem;border:1px solid rgba(255,255,255,0.1);border-radius:0.75rem;background:rgba(255,255,255,0.025);overflow:hidden;">
                                <div style="padding:0.65rem 0.8rem;background:rgba(245,158,11,0.08);border-bottom:1px solid rgba(255,255,255,0.08);">
                                    <span style="color:${strongMatch ? '#fca5a5' : '#fcd34d'};font-size:0.7rem;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;"><i class="fa-solid ${strongMatch ? 'fa-clone' : 'fa-copy'}" style="margin-right:0.4rem;"></i>${group.kind === 'exact' ? 'Mismo contenido' : (strongMatch ? 'Coincidencia fuerte' : 'Posible duplicado')}</span>
                                    <span style="color:#71717a;font-size:0.65rem;margin-left:0.6rem;">${escapeHtml(group.reason || '')}</span>
                                </div>
                                <div style="display:grid;grid-template-columns:minmax(220px,0.75fr) minmax(420px,1.8fr);gap:0.75rem;padding:0.75rem;align-items:start;">
                                    <div style="border:1px solid rgba(52,211,153,0.25);border-radius:0.65rem;padding:0.75rem;background:rgba(16,185,129,0.06);min-width:0;">
                                        <div style="font-size:0.6rem;color:#34d399;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.55rem;"><i class="fa-solid fa-star" style="margin-right:0.3rem;"></i>Original conservado</div>
                                        ${origin ? compactInfo(origin) : '<span style="color:#71717a;font-size:0.7rem;">Sin original identificado</span>'}
                                    </div>
                                    <div style="min-width:0;">
                                        <div style="font-size:0.6rem;color:#a1a1aa;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;margin:0.15rem 0 0.45rem;">${duplicates.length} duplicado${duplicates.length === 1 ? '' : 's'} para revisar</div>
                                        <div style="display:flex;flex-direction:column;gap:0.4rem;">
                                            ${duplicates.map(item => `
                                                <div class="duplicate-item-row" style="display:grid;grid-template-columns:2rem minmax(0,1fr) auto;gap:0.5rem;align-items:center;padding:0.5rem;border:1px solid rgba(255,255,255,0.08);border-radius:0.55rem;background:rgba(0,0,0,0.16);${item.is_hidden ? 'opacity:0.55;' : ''}">
                                                    <input type="checkbox" class="dup-check" data-id="${item.id}" data-path="${escapeHtml(item.path || '')}" onchange="duplicateUpdateCounter()" style="accent-color:#fbbf24;width:1rem;height:1rem;justify-self:center;">
                                                    <div style="min-width:0;">${compactInfo(item)}</div>
                                                    <div style="display:flex;align-items:center;gap:0.25rem;white-space:nowrap;">
                                                        <span style="color:#a1a1aa;font-size:0.58rem;margin-right:0.25rem;">${matchLabel}</span>
                                                        <button onclick="duplicateAction('${item.is_hidden ? 'restore' : 'hide'}', ${item.id}, this)" data-path="${escapeHtml(item.path || '')}" title="${item.is_hidden ? 'Restaurar' : 'Ocultar'}" style="padding:0.3rem 0.45rem;border-radius:0.4rem;font-size:0.6rem;font-weight:700;background:rgba(255,255,255,0.06);color:#d4d4d8;border:1px solid rgba(255,255,255,0.1);cursor:pointer;"><i class="fa-solid ${item.is_hidden ? 'fa-eye' : 'fa-eye-slash'}"></i></button>
                                                        <button onclick="duplicateAction('delete', ${item.id}, this)" data-path="${escapeHtml(item.path || '')}" title="Eliminar" style="padding:0.3rem 0.45rem;border-radius:0.4rem;font-size:0.6rem;font-weight:700;background:rgba(239,68,68,0.1);color:#fca5a5;border:1px solid rgba(239,68,68,0.25);cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                                                    </div>
                                                </div>`).join('')}
                                        </div>
                                    </div>
                                </div>
                            </section>` };
                    });
                    const exactGroupsHtml = renderedGroups.filter(group => group.category === 'exact').map(group => group.html).join('');
                    const reviewGroupsHtml = renderedGroups.filter(group => group.category === 'review').map(group => group.html).join('');
                    const groupsHtml = `
                        <div class="duplicate-section-stack" style="flex:0 0 auto;display:flex;flex-direction:column;gap:0.75rem;">
                            ${exactGroupsHtml}
                        </div>
                        ${reviewGroupsHtml ? `<details style="flex:0 0 auto;border:1px solid rgba(251,191,36,0.18);border-radius:0.75rem;background:rgba(251,191,36,0.03);overflow:hidden;"><summary style="cursor:pointer;padding:0.75rem 0.9rem;color:#fcd34d;font-size:0.7rem;font-weight:800;list-style:none;"><i class="fa-solid fa-chevron-right" style="margin-right:0.45rem;"></i>Revisar álbum distinto o posible duplicado (${renderedGroups.filter(group => group.category === 'review').length} grupos)</summary><div class="duplicate-section-stack" style="flex:0 0 auto;display:flex;flex-direction:column;gap:0.75rem;padding:0.75rem;border-top:1px solid rgba(251,191,36,0.12);">${reviewGroupsHtml}</div></details>` : ''}`;
                    const oldMore = document.getElementById('duplicates-load-more');
                    if (oldMore) oldMore.remove();
                    if (offset === 0) {
                        content.innerHTML = `<div id="duplicates-scroll-area" style="flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:0.75rem;">${groupsHtml}</div><div id="duplicate-global-actions" style="flex:0 0 auto;display:flex;justify-content:flex-end;align-items:center;gap:0.75rem;padding:0.75rem 0;border-top:1px solid rgba(255,255,255,0.08);color:#a1a1aa;font-size:0.7rem;"><span id="duplicate-selected-count">0 seleccionados</span><button onclick="duplicateToggleVisible(true)" style="padding:0.5rem 0.75rem;border-radius:0.5rem;font-size:0.6875rem;font-weight:700;background:rgba(251,191,36,0.1);color:#fcd34d;border:1px solid rgba(251,191,36,0.25);cursor:pointer;"><i class="fa-solid fa-check-double" style="margin-right:0.35rem;"></i>Seleccionar coincidencias fuertes</button><button onclick="duplicateToggleVisible(false)" style="padding:0.5rem 0.75rem;border-radius:0.5rem;font-size:0.6875rem;font-weight:700;background:rgba(255,255,255,0.05);color:#d4d4d8;border:1px solid rgba(255,255,255,0.1);cursor:pointer;">Limpiar selección</button><button onclick="duplicateBulkDelete()" style="padding:0.5rem 0.875rem;border-radius:0.5rem;font-size:0.6875rem;font-weight:700;background:rgba(239,68,68,0.12);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);cursor:pointer;"><i class="fa-solid fa-trash-can" style="margin-right:0.35rem;"></i>Borrar seleccionados</button></div>`;
                    } else {
                        document.getElementById('duplicates-scroll-area')?.insertAdjacentHTML('beforeend', groupsHtml);
                    }
                    if (data.has_more) {
                        document.getElementById('duplicates-scroll-area')?.insertAdjacentHTML('beforeend', `<div id="duplicates-load-more" style="display:flex;justify-content:center;padding:0.75rem 0;"><button onclick="loadDuplicateCandidates(${offset + data.groups.length})" style="padding:0.5rem 1rem;border-radius:0.5rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#d4d4d8;font-size:0.75rem;font-weight:700;cursor:pointer;"><i class="fa-solid fa-chevron-down" style="margin-right:0.5rem;"></i>Cargar más grupos</button></div>`);
                    }
                } catch (error) {
                    content.innerHTML = `<div style="text-align:center;padding:3rem 0;color:#f87171;">${escapeHtml(error.message || 'Error al cargar duplicados')}</div>`;
                }
            }

            /**
             * `startDuplicateScan()`
             * Inicia en el servidor el escaneo de hashes y nombres para detectar duplicados.
             */
            async function startDuplicateScan() {
                const pin = getMasterPin('PIN Maestro requerido para analizar duplicados:');
                if (!pin) return;
                const status = document.getElementById('duplicates-panel-status');
                if (status) { status.classList.remove('hidden'); status.textContent = 'Analizando archivos candidatos. Esto puede tardar un poco...'; }
                try {
                    const response = await fetch('/api/duplicates/scan', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin })
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'PIN incorrecto');
                    const poll = async () => {
                        const result = await fetch('/api/duplicates/status').then(r => r.json());
                        const scan = result.status || {};
                        if (status) status.textContent = scan.active ? `Analizando biblioteca... ${scan.percent || 0}%` : (scan.error ? `Error: ${scan.error}` : 'Análisis terminado.');
                        if (scan.active) setTimeout(poll, 1200);
                        else { await loadDuplicateCandidates(); if (!scan.error) cargarLib(); }
                    };
                    poll();
                } catch (error) {
                    if (status) status.textContent = error.message || 'No se pudo iniciar el análisis.';
                }
            }

            /**
             * `duplicateAction(action, mediaId, button)`
             * Ejecuta una acción (eliminar o conservar) sobre un archivo duplicado individual.
             */
            async function duplicateAction(action, mediaId, button) {
                const path = button?.dataset?.path || '';
                if (action === 'delete') {
                    if (!confirm('¿Eliminar definitivamente este archivo? Esta acción no se puede deshacer.')) return;
                    await borrar(path);
                    setTimeout(loadDuplicateCandidates, 350);
                    return;
                }
                if (action === 'keep') {
                    await fetch('/api/duplicates/decision', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ media_id: mediaId, decision: 'keep' })
                    });
                } else {
                    const pin = getMasterPin(action === 'hide' ? 'PIN Maestro requerido para ocultar:' : 'PIN Maestro requerido para restaurar:');
                    if (!pin) return;
                    await fetch('/api/duplicates/hide', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ media_id: mediaId, hidden: action === 'hide', pin })
                    });
                }
await loadDuplicateCandidates();
                if (action !== 'keep') cargarLib();
            }

            /**
             * `duplicateToggleVisible(checked)`
             * Selecciona o deselecciona todos los duplicados sugeridos en pantalla.
             */
            function duplicateToggleVisible(checked) {
                const selector = checked
                    ? '.duplicate-group[data-duplicate-category="exact"] .dup-check'
                    : '.duplicate-group .dup-check';
                document.querySelectorAll(selector).forEach(cb => {
                    cb.checked = checked;
                    const id = String(cb.dataset.id);
                    if (checked) duplicateSelectedIds.add(id);
                    else duplicateSelectedIds.delete(id);
                });
                duplicateUpdateCounter();
            }

            /**
             * `duplicateUpdateCounter()`
             * Actualiza el contador de archivos seleccionados para eliminación en el panel de duplicados.
             */
            function duplicateUpdateCounter() {
                document.querySelectorAll('.duplicate-group .dup-check').forEach(cb => {
                    const id = String(cb.dataset.id);
                    if (cb.checked) duplicateSelectedIds.add(id);
                    else duplicateSelectedIds.delete(id);
                });
                const counter = document.getElementById('duplicate-selected-count');
                if (counter) counter.textContent = `${duplicateSelectedIds.size} seleccionados`;
            }

            /**
             * `duplicateBulkDelete()`
             * Elimina en lote todos los archivos duplicados marcados por el usuario.
             */
            async function duplicateBulkDelete() {
                if (!duplicateSelectedIds.size) { showToast('Selecciona al menos un duplicado', 'error'); return; }
                if (!confirm(`¿Eliminar definitivamente ${duplicateSelectedIds.size} archivo(s)? Esta acción no se puede deshacer.`)) return;
                const pin = getMasterPin('PIN Maestro requerido para eliminar los duplicados:');
                if (!pin) return;
                let failed = false;
                for (const id of Array.from(duplicateSelectedIds)) {
                    const item = duplicateSelectedItems.get(String(id));
                    if (!item) continue;
                    const res = await fetch('/borrar', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ file: item.path, pin })
                    });
                    const d = await res.json().catch(() => ({}));
                    if (d.error) { clearPinIfInvalid(d.error); showToast(d.error, 'error'); failed = true; break; }
                }
                if (!failed) {
                    duplicateSelectedIds.clear();
                    duplicateSelectedItems.clear();
                    cargarLib();
                    await loadDuplicateCandidates();
                }
            }

            /**
             * `rescanLibrary()`
             * Inicia la sincronización/reescaneo de la biblioteca en disco mostrando el progreso en tiempo real.
             */
            async function rescanLibrary() {
                const pin = getMasterPin("PIN Maestro requerido para Re-escaneo profundo de disco:");
                if (!pin) return;

                const btn = document.getElementById('btn-rescan');
                const progressContainer = document.getElementById('rescan-progress-container');
                const progressBar = document.getElementById('rescan-progress-bar');
                const percentText = document.getElementById('rescan-percent-text');
                const stageText = document.getElementById('rescan-stage-text');
                const messageText = document.getElementById('rescan-message');

                // Mostrar barra de progreso
                if (progressContainer) progressContainer.classList.remove('hidden');

                // Animación del botón
                if (btn) {
                    const icon = btn.querySelector('i');
                    if (icon) icon.classList.add('fa-spin');
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fa-solid fa-spin fa-rotate"></i> Escaneando...';
                }

                let pollInterval = null;

                // Función para consultar progreso
                /**
                 * `pollProgress()`
                 * Consulta `/estado` periódicamente para actualizar la barra de progreso de tareas en segundo plano.
                 */
                async function pollProgress() {
                    try {
                        const res = await fetch('/estado');
                        const data = await res.json();
                        const status = data.rescan_status;

                        if (status && status.active) {
                            const percent = status.percent || 0;
                            if (progressBar) progressBar.style.width = percent + '%';
                            if (percentText) percentText.textContent = percent + '%';
                            if (stageText) {
                                const stages = {
                                    'counting': 'Contando archivos...',
                                    'scanning': 'Escaneando...',
                                    'cleaning': 'Limpiando archivos...',
                                    'done': 'Completado'
                                };
                                stageText.textContent = stages[status.stage] || status.stage;
                            }
                            if (messageText) messageText.textContent = status.message || '';
                        }
                    } catch (e) {
                        console.error('Error polling progress:', e);
                    }
                }

                try {
                    showToast("💿 Escaneando disco duro...", "info");

                    // Iniciar polling cada 500ms
                    pollInterval = setInterval(pollProgress, 500);

                    // 1. ESCANEO FÍSICO (Servidor)
                    const res = await fetch('/actualizar_cache?pin=' + encodeURIComponent(pin));
                    const data = await res.json();

                    // Detener polling
                    if (pollInterval) clearInterval(pollInterval);

                    if (data.error) {
                        clearPinIfInvalid(data.error);
                        alert(data.error);
                        return;
                    }

                    if (data.ok) {
                        // Consultar progreso final
                        await pollProgress();

                        // 2. RECARGAR DATOS
                        await cargarLib();

                        // 3. DOCTOR KRAKEN AL RESCATE
                        showToast("🚑 Verificando salud de playlists...", "info");
                        repairPlaylists(true);

                        showToast("✅ Biblioteca Sincronizada y Reparada", "success");
                    }
                } catch (e) {
                    console.error(e);
                    showToast("❌ Error en la sincronización", "error");
                } finally {
                    // Detener polling si sigue activo
                    if (pollInterval) clearInterval(pollInterval);

                    // Ocultar barra de progreso después de un momento
                    setTimeout(() => {
                        if (progressContainer) progressContainer.classList.add('hidden');
                    }, 2000);
                }

                // Restaurar botón
                if (btn) {
                    btn.classList.remove('fa-spin');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-rotate"></i> <span>Sincronizar</span>';
                }
            }

            /**
             * `abrirPlaylist(nombre)`
             * Activa el filtro de una playlist específica y cierra el menú móvil.
             */
            function abrirPlaylist(nombre) {
                if (!libData.playlists[nombre]) {
                    showToast("Esta playlist no existe", "error");
                    return;
                }

                window.currentPlaylistName = nombre;

                // 1. Resetear TODO antes de aplicar
                filters = { ...defaults }; // ← Limpiar primero
                filters.playlist = nombre;

                // 2. Cambiar modo visual
                currentLibrary = 'playlist:' + nombre;
                currentPath = "";

                // 3. UI: Cambiar título DESKTOP Y MÓVIL
                const titleDesktop = document.getElementById('lib-title-desktop');
                const titleMobile = document.getElementById('lib-title-mobile');
                const playlistTitle = "📋 " + nombre;

                if (titleDesktop) titleDesktop.innerText = playlistTitle;
                if (titleMobile) titleMobile.innerText = playlistTitle;

                // 4. Resetear límite de renderizado
                renderLimit = renderStep;

                // 5. Recargar vista
                renderLib();
                renderSidebarLists();
                if (typeof updatePlaylistDownloadButtons === 'function') {
                    updatePlaylistDownloadButtons();
                }
            }

            /**
             * `updatePlaylistDownloadButtons()`
             * Muestra u oculta los botones de descarga de playlist offline si existen en el DOM.
             */
            function updatePlaylistDownloadButtons() {
                const hasPlaylist = !!(typeof getCurrentPlaylistName === 'function' ? getCurrentPlaylistName() : (filters?.playlist || ''));
                const desktopBtn = document.getElementById('btn-offline-playlist-desktop');
                const mobileBtn = document.getElementById('btn-offline-playlist-mobile');
                if (desktopBtn) desktopBtn.classList.toggle('hidden', !hasPlaylist);
                if (mobileBtn) mobileBtn.classList.toggle('hidden', !hasPlaylist);
            }

            /**
             * `getCurrentPlaylistName()`
             * Retorna el nombre de la playlist actualmente seleccionada en los filtros.
             */
            function getCurrentPlaylistName() {
                return filters?.playlist || "";
            }

            /**
             * `toggleDownloadSelection(idx, checked)`
             * Agrega o quita un índice del conjunto de descargas seleccionadas.
             */
            function toggleDownloadSelection(idx, checked) {
                if (checked) selectedDownloadIndices.add(idx);
                else selectedDownloadIndices.delete(idx);
            }

/**
 * `detectKrakenDeviceType()`
 * Clasifica el dispositivo actual en 'desktop', 'tablet' o 'mobile'.
 */
function detectKrakenDeviceType() {
    const ua = navigator.userAgent || '';
    if (window.KrakenTV || document.body?.classList?.contains('tv-mode') || /Android TV|SmartTV|HbbTV|GoogleTV|CrKey|Xbox|PlayStation|Nintendo|Web0S|Tizen|Viera|NetCast|Roku|AFT[ABKMR]/i.test(ua)) return 'tv';
    if (/ipad|tablet/i.test(ua)) return 'tablet';
    if (/mobi|android|iphone/i.test(ua)) return 'mobile';
    return 'desktop';
}

/**
 * `getKrakenDeviceName()`
 * Obtiene o infiere el nombre descriptivo del dispositivo actual para el radar.
 */
function getKrakenDeviceName() {
    let saved = localStorage.getItem('kraken_device_name');
    if (detectKrakenDeviceType() === 'tv' && (!saved || saved === 'PC Linux' || saved === 'Movil Kraken' || saved === 'tv')) {
        localStorage.setItem('kraken_device_name', 'Smart TV Kraken');
        return 'Smart TV Kraken';
    }
    if (saved) return saved;

    const ua = navigator.userAgent || '';
    if (window.KrakenTV || document.body?.classList?.contains('tv-mode') || /Android TV|SmartTV|HbbTV|GoogleTV|CrKey|Xbox|PlayStation|Nintendo|Web0S|Tizen|Viera|NetCast|Roku|AFT[ABKMR]/i.test(ua)) return 'tv';
    const type = detectKrakenDeviceType();
    const platform = navigator.platform || '';
    let inferred = type === 'tv' ? 'Smart TV Kraken' : (type === 'desktop' ? 'PC Kraken' : (type === 'tablet' ? 'Tablet Kraken' : 'Movil Kraken'));
    if (type === 'tv') {
        localStorage.setItem('kraken_device_name', inferred);
        return inferred;
    }

    if (/Win/i.test(platform)) inferred = 'PC Windows';
    else if (/Mac/i.test(platform)) inferred = 'Mac Kraken';
    else if (/Linux/i.test(platform)) inferred = 'PC Linux';
    else if (/iPhone/i.test(ua)) inferred = 'iPhone';
    else if (/iPad/i.test(ua)) inferred = 'iPad';

    localStorage.setItem('kraken_device_name', inferred);
    return inferred;
}

/**
 * `getKrakenPlaybackSnapshot()`
 * Genera el estado actual de reproducción (pista, volumen, modo) para reportarlo al radar del servidor.
 */
function getKrakenPlaybackSnapshot() {
    const activeVideo = document.querySelector('#cine-screen video, #artplayer-container video, #main-video');
    const isVideoPlaying = !!(activeVideo && !activeVideo.paused && !activeVideo.ended && activeVideo.currentTime > 0);
    const isAudioPlaying = !!(audioElement && audioElement.src && !audioElement.paused && !audioElement.ended);
    const currentTrack = playerQueue[currentTrackIndex];
    const isVideoTrack = !!(currentTrack && (currentTrack.type === 'video' || (currentTrack.path && /\.(mp4|mkv|avi|webm|m4v)$/i.test(currentTrack.path))));

    let resolvedMediaType = 'audio';
    if (isVideoPlaying) {
        resolvedMediaType = 'video';
    } else if (isAudioPlaying) {
        resolvedMediaType = 'audio';
    } else if (isVideoTrack && !isAudioPlaying) {
        resolvedMediaType = 'video';
    }

    const currentMode = (currentLibrary === 'video' || resolvedMediaType === 'video') ? 'video' : 'audio';

    return {
        is_playing: isVideoPlaying || isAudioPlaying,
        volume: audioElement ? Number(audioElement.volume || 0) : 0,
        queue_length: playerQueue.length || 0,
        current_index: currentTrackIndex >= 0 ? currentTrackIndex : 0,
        library_mode: currentMode,
        device_name: getKrakenDeviceName(),
        device_type: detectKrakenDeviceType(),
        media_type: resolvedMediaType
    };
}

setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader && !loader.classList.contains('hidden')) {
        loader.classList.add('hidden');
    }
}, 8000);
/**
 * `setLoaderText(text)`
 * Actualiza el mensaje informativo en la pantalla de carga inicial.
 */
function setLoaderText(text) {
    const el = document.getElementById('loader-text');
    if (el) el.textContent = text;
}

/**
 * `watchRescan()`
 * Supervisa en segundo plano si hay un reescaneo activo en el servidor.
 */
function watchRescan() {
            if (rescanWatcher) return;

            rescanWatcher = setInterval(async () => {
                try {
                    const r = await fetch('/estado');
                    const j = await r.json();

                    const loader = document.getElementById('loader');

                    if (j.rescan) {
                        loader.classList.remove('hidden');
                        setLoaderText("Reorganizando tu biblioteca…");
                    } else {
                        loader.classList.add('hidden');
                        clearInterval(rescanWatcher);
                        rescanWatcher = null;
                        cargarLib(); // refresca cuando ya terminó
                    }
                } catch { }
            }, 1000);
        }

        /**
         * `hashLib(data)`
         * Calcula una huella ligera del catálogo para detectar cambios remotos.
         */
        function hashLib(data) {
            try {
                return JSON.stringify(data).length; // simple, barato
            } catch {
                return 0;
            }
        }

        /**
         * `refreshLibrary()`
         * Sincroniza silenciosamente el catálogo en memoria si el servidor reporta cambios.
         */
        async function refreshLibrary() {
            try {
                const ownerParam = window.MY_EMAIL ? 'owner=' + encodeURIComponent(window.MY_EMAIL) : '';
                const res = await fetch('/biblioteca?' + ownerParam);
                const newData = await res.json();

                if (!window.libData) {
                    window.libData = newData;
                    libData = newData;           // 🔗 sincroniza
                    renderSidebarLists();
                    renderLib();
                    return;
                }

                const oldHash = hashLib(window.libData);
                const newHash = hashLib(newData);

                if (oldHash !== newHash) {
                    window.libData = newData;
                    libData = newData;           // 🔗 sincroniza
                    renderSidebarLists();
                    renderLib();
                }
            } catch (e) {
                console.warn('Error refrescando biblioteca:', e);
            }
        }

        /**
         * `showToast(message, type = 'info')`
         * Muestra una notificación flotante temporal (`info`, `success`, `warning`, `error`).
         */
        window.showToast = function (message, type = 'info') {
            const colors = {
                success: 'bg-emerald-600',
                error: 'bg-red-600',
                warning: 'bg-yellow-600',
                info: 'bg-blue-600'
            };

            // 1. Buscamos (o creamos) el CONTENEDOR DE NOTIFICACIONES
            // Este div invisible se encarga de apilar los mensajes en el centro
            let container = document.getElementById('toast-notification-center');

            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-notification-center';
                // Posición fija en el centro, apila en columna (flex-col), permite clicks a través (pointer-events-none)
                container.className = 'fixed top-24 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-3 pointer-events-none w-max max-w-[90vw]';
                document.body.appendChild(container);
            }

            // 2. Creamos la NOTIFICACIÓN individual
            const toast = document.createElement('div');

            // NOTA: Quitamos 'fixed top-24 left-1/2' porque el contenedor ya se encarga de eso.
            // Agregamos 'pointer-events-auto' para que puedas cerrarlo si quisieras.
            toast.className = `${colors[type]} text-white px-8 py-4 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-semibold animate-slide-in pointer-events-auto transition-all duration-300`;

            toast.innerHTML = `
    <i class="fa-solid fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'triangle-exclamation' : 'info-circle'} text-lg"></i>
    <span>${message}</span>
`;

            // 3. Agregamos al contenedor (se pondrá debajo del anterior automáticamente)
            container.appendChild(toast);

            // 4. Temporizador de eliminación
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(-20px)'; // Se va hacia arriba al morir
                setTimeout(() => {
                    if (toast.isConnected) toast.remove();

                    // Limpieza: Si el contenedor se queda vacío, lo borramos (opcional, pero limpio)
                    if (container.children.length === 0) container.remove();
                }, 300);
            }, 4000); // Bajé un poco el tiempo a 4s para que sea más dinámico
        };

        /**
         * `showStickyToast(text, type = "info")`
         * Muestra una notificación persistente con botones de acción.
         */
        function showStickyToast(text, type = "info") {
            let box = document.getElementById('sticky-toast');

            if (!box) {
                box = document.createElement('div');
                box.id = 'sticky-toast';
                box.className = 'fixed bottom-6 right-6 z-50 max-w-sm w-[90%] md:w-auto bg-emerald-900 border rounded-xl shadow-2xl p-4 text-sm';
                document.body.appendChild(box);
            }

            const color = type === "success" ? "border-emerald-500 text-emerald-400"
                : type === "error" ? "border-red-500 text-red-400"
                    : "border-emerald-600 text-emerald-300";

            const icon = type === "success" ? "fa-circle-check"
                : type === "error" ? "fa-circle-xmark"
                    : "fa-circle-info";

            box.className = `fixed bottom-6 right-6 z-50 max-w-sm w-[90%] md:w-auto bg-emerald-900 border ${color} rounded-xl shadow-2xl p-4`;

            box.innerHTML = `
    <div class="flex items-start gap-3">
        <i class="fa-solid ${icon} text-xl mt-0.5"></i>
        <div class="flex-1 whitespace-pre-wrap">${text}</div>
        <button onclick="document.getElementById('sticky-toast').remove()" 
                class="ml-2 text-emerald-500 hover:text-white">
            <i class="fa-solid fa-xmark"></i>
        </button>
    </div>
`;
        }

        /**
         * `renderLibraryStats()`
         * Actualiza los contadores totales de pistas, artistas y videos en la interfaz.
         */
        function renderLibraryStats() {
            const box = document.getElementById('lib-stats');
            if (!box || !libData) return;

            const allFiles = libData.files || [];
            const totalSongs = allFiles.filter(f => f.type === 'audio').length;
            const artistCount = libData.artist_tree ? Object.keys(libData.artist_tree).length : 0;
            const videoFiles = allFiles.filter(f => f.type === 'video');
            const totalVideos = videoFiles.length;

            // Desglose películas vs series
            const movieSet = new Set();
            const seriesSet = new Set();
            videoFiles.forEach(f => {
                const parts = (f.path || '').replace(/\\/g, '/').split('/');
                if (f.folder_type === 'movie' || parts.length <= 3) {
                    movieSet.add(parts.slice(0, 3).join('/'));
                } else {
                    seriesSet.add(parts.slice(0, 3).join('/'));
                }
            });
            box.innerHTML = `
    <!-- CAJA 1: ESTADÍSTICAS Y CANCIONES -->
    <div class="col-span-1 group relative overflow-hidden bg-[#121212] border border-white/5 rounded-2xl flex divide-x divide-white/5 transition-all duration-300">
        <div onclick="ver('stats')" class="flex-1 p-3 text-center cursor-pointer hover:bg-amber-500/10 transition group/stats" title="Ver estadísticas detalladas">
            <i class="fa-solid fa-chart-simple text-amber-500 text-sm mb-1 opacity-60 group-hover/stats:opacity-100 transition"></i>
            <div class="text-[8px] font-black text-amber-400 uppercase tracking-widest leading-tight">Mis<br>Estadísticas</div>
        </div>
        <div class="flex-1 p-3 text-center bg-white/[0.01]">
            <div class="text-emerald-400 text-base md:text-lg font-black tracking-tight">${totalSongs.toLocaleString()}</div>
            <div class="text-[8px] font-black text-emerald-500/60 uppercase tracking-wider mt-0.5">Canciones</div>
        </div>
    </div>

    <!-- CAJA 2: ARTISTAS TOTAL -->
    <div class="group relative overflow-hidden bg-[#121212] border border-white/5 rounded-2xl p-4 transition-all duration-300 hover:border-orange-500/50 hover:bg-orange-500/[0.03]">
        <div class="absolute top-0 right-0 p-1.5 opacity-10 group-hover:opacity-30 transition-opacity">
            <i class="fa-solid fa-microphone-lines text-xl text-orange-500"></i>
        </div>
        <div class="relative z-10 text-center">
            <div class="text-orange-400 text-lg md:text-xl font-black tracking-tight">${artistCount.toLocaleString()}</div>
            <div class="text-[9px] font-black text-orange-500/60 uppercase tracking-widest mt-1">Artistas Total</div>
        </div>
    </div>

    <!-- CAJA 3: VIDEO TOTAL -->
    <div class="group relative overflow-hidden bg-[#121212] border border-white/5 rounded-2xl p-4 transition-all duration-300 hover:border-rose-500/50 hover:bg-rose-500/[0.03]">
        <div class="absolute top-0 right-0 p-1.5 opacity-10 group-hover:opacity-30 transition-opacity">
            <i class="fa-solid fa-clapperboard text-xl text-rose-500"></i>
        </div>
        <div class="relative z-10 text-center">
            <div class="text-rose-400 text-lg md:text-xl font-black tracking-tight">${totalVideos.toLocaleString()}</div>
            <div class="text-[9px] font-black text-rose-400/60 uppercase tracking-widest mt-1">Video Total</div>
        </div>
    </div>

    <!-- CAJA 4: PELÍCULAS Y SERIES -->
    <div class="col-span-1 group relative overflow-hidden bg-[#121212] border border-white/5 rounded-2xl flex divide-x divide-white/5 transition-all duration-300">
        <div class="flex-1 p-3 text-center">
            <div class="text-pink-400 text-base md:text-lg font-black tracking-tight">${movieSet.size.toLocaleString()}</div>
            <div class="text-[8px] font-black text-pink-400/60 uppercase tracking-widest mt-0.5">Películas</div>
        </div>
        <div class="flex-1 p-3 text-center bg-white/[0.01]">
            <div class="text-fuchsia-400 text-base md:text-lg font-black tracking-tight">${seriesSet.size.toLocaleString()}</div>
            <div class="text-[8px] font-black text-fuchsia-400/60 uppercase tracking-widest mt-0.5">Series</div>
        </div>
    </div>
`;
        }

/**
 * `toggleSortMenuMobile()`
 * Muestra u oculta el menú de ordenamiento en móvil.
 */
function toggleSortMenuMobile() {
    const m = document.getElementById('sort-menu-mobile');
    if (m) m.classList.toggle('hidden');
}

/**
 * `toggleSortMenuDesktop()`
 * Muestra u oculta el menú de ordenamiento en escritorio.
 */
function toggleSortMenuDesktop() {
    const m = document.getElementById('sort-menu-desktop');
    if (m) m.classList.toggle('hidden');
}

/**
 * `setSortMobile(type)`
 * Aplica un criterio de ordenamiento desde la interfaz móvil.
 */
function setSortMobile(type) {
    setFilter('sort', type);
    const m = document.getElementById('sort-menu-mobile');
    if (m) m.classList.add('hidden');
}

/**
 * `setSortDesktop(type)`
 * Aplica un criterio de ordenamiento desde la interfaz de escritorio.
 */
function setSortDesktop(type) {
    setFilter('sort', type);
    const m = document.getElementById('sort-menu-desktop');
    if (m) m.classList.add('hidden');
}


/* ==========================================
   ❤️ SISTEMA MAESTRO DE FAVORITOS (V5 - UNIFICADO)
   ========================================== */


// 1. Entrada desde las TARJETAS o LISTA (Recibe ruta codificada tipo "Musica/Rock/My%20Song.mp3")
/**
 * `toggleCardFavorite(encodedPath)`
 * Alterna el estado de favorito (corazón) desde una tarjeta o fila de la biblioteca.
 */
async function toggleCardFavorite(encodedPath) {
    const path = decodeURIComponent(encodedPath);
    await procesarFavorito(path);
}

// 2. Entrada desde el REPRODUCTOR PRINCIPAL
/**
 * `toggleFavorite()`
 * Alterna el estado de favorito de la pista que está sonando actualmente.
 */
async function toggleFavorite() {
    if (!playerQueue.length || currentTrackIndex === -1) return;
    const track = playerQueue[currentTrackIndex];
    await procesarFavorito(track.path);
}

// 3. CEREBRO CENTRAL (Aquí ocurre la magia)
/**
 * `procesarFavorito(filePath)`
 * Envía el cambio de calificación/favorito a `/rate` y sincroniza toda la interfaz.
 */
async function procesarFavorito(filePath) {
    // Buscar archivo en memoria
    const file = libData.files.find(f => f.path === filePath);
    if (!file) return;

    const wasFavorite = file.rating === 1;
    const newRating = wasFavorite ? 0 : 1;

    // A) Actualización Optimista (Inmediata)
    file.rating = newRating;
    actualizarVisuales(filePath, newRating === 1);

    // B) Petición al Servidor
    try {
        const res = await fetch('/api/favorite/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath })
        });

        const data = await res.json();

        if (!data.success) {
            // Si falla, revertimos
            file.rating = wasFavorite ? 1 : 0;
            actualizarVisuales(filePath, wasFavorite);
            showToast("Error al guardar favorito", "error");
        } else {
            // Si estamos en la playlist de "Mis Favoritos" y quitamos uno, recargar la vista
            if (wasFavorite && (filters.playlist === 'smart_favorites' || currentLibrary === 'playlist:smart_favorites')) {
                setTimeout(() => renderLib(), 500);
            }
        }
    } catch (e) {
        console.error("Error red like:", e);
        // Revertir por error de red
        file.rating = wasFavorite ? 1 : 0;
        actualizarVisuales(filePath, wasFavorite);
    }
}

// 4. EL PINTOR (Actualiza TODOS los botones visibles de esa canción a la vez)
/**
 * `actualizarVisuales(filePath, isFav)`
 * Actualiza los iconos de corazón en el reproductor y en las filas/tarjetas del DOM.
 */
function actualizarVisuales(filePath, isFav) {
    // --- A. Actualizar Reproductor (Si es la canción actual) ---
    if (playerQueue[currentTrackIndex]?.path === filePath) {
        const playerIds = ['btn-like-player', 'btn-like-player-desktop', 'fp-like'];
        playerIds.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                if (isFav) {
                    btn.className = "ml-2 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)] transition transform scale-110 p-1";
                    btn.innerHTML = '<i class="fa-solid fa-heart"></i>';
                } else {
                    btn.className = "ml-2 text-zinc-600 hover:text-emerald-500 hover:shadow-[0_0_10px_rgba(16,185,129,0.5)] transition p-1";
                    btn.innerHTML = '<i class="fa-regular fa-heart"></i>';
                }
            }
        });
    }

    // --- B. Actualizar Botones en Listas y Tarjetas ---
    // Buscamos botones que usen data-path en lugar de onclick
    const safePath = encodeURIComponent(filePath);

    // Buscar por data-path es más confiable que por onclick
    const botonesEnPantalla = document.querySelectorAll(`button[data-path="${CSS.escape(filePath)}"]`);

    botonesEnPantalla.forEach(btn => {
        // Solo tocamos si parece un botón de corazón (tiene la clase fa-heart o similar)
        if (btn.innerHTML.includes('heart')) {
            if (isFav) {
                // Estilo "Activado" (Verde brillante)
                btn.classList.remove('text-zinc-500', 'hover:text-emerald-400');
                btn.classList.add('text-emerald-400', 'drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]');
                btn.innerHTML = '<i class="fa-solid fa-heart text-xs"></i>';
                btn.title = "Quitar de favoritos";
            } else {
                // Estilo "Desactivado" (Gris)
                btn.classList.remove('text-emerald-400', 'drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]');
                btn.classList.add('text-zinc-500', 'hover:text-emerald-400');
                btn.innerHTML = '<i class="fa-regular fa-heart text-xs"></i>';
                btn.title = "Añadir a favoritos";
            }
        }
    });
}

/**
 * `updateYTDLP()`
 * Solicita al servidor actualizar el binario/paquete `yt-dlp` a la última versión.
 */
function updateYTDLP() {
    const btn = document.getElementById('btn-ytdlp');
    btn.disabled = true;
    btn.innerText = 'ACTUALIZANDO...';

    fetch('/update_ytdlp', {
        method: 'POST'
    })
        .then(r => r.json())
        .then(() => {
            // No sabemos cuándo termina exactamente,
            // pero pip suele tardar segundos, no minutos.
            setTimeout(() => {
                btn.disabled = false;
                btn.innerText = 'ACTUALIZAR yt-dlp';
            }, 4000);
        })
        .catch(() => {
            btn.disabled = false;
            btn.innerText = 'ERROR';
        });
}
