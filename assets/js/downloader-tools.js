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
async function cargarEstadisticas() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();

        if (!data.ok) throw new Error(data.error);

        document.getElementById('stats-total-plays').textContent = data.total_plays || 0;

        const totalSecs = data.total_time_sec || 0;
        const hours = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        document.getElementById('stats-total-time').textContent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

        const topArtist = data.top_artists?.[0]?.artist || '-';
        const topArtistPlays = data.top_artists?.[0]?.plays || 0;
        document.getElementById('stats-top-artist').textContent = topArtist.length > 12 ? topArtist.substring(0, 12) + '...' : topArtist;
        document.getElementById('stats-top-artist').title = topArtist + ` (${topArtistPlays} plays)`;

        const topTrack = data.top_tracks?.[0]?.title || '-';
        const topTrackPlays = data.top_tracks?.[0]?.plays || 0;
        document.getElementById('stats-top-track').textContent = topTrack.length > 12 ? topTrack.substring(0, 12) + '...' : topTrack;
        document.getElementById('stats-top-track').title = topTrack + ` (${topTrackPlays} plays)`;

        // Artistas
        const artistsList = document.getElementById('stats-artists-list');
        if (data.top_artists?.length) {
            const maxPlays = Math.max(...data.top_artists.map(a => a.plays));
            artistsList.innerHTML = data.top_artists.map((a, i) => {
                const pct = Math.round((a.plays / maxPlays) * 100);
                const timeStr = a.total_time ? formatDuration(a.total_time) : '0m';
                return `<div class="flex items-center gap-3">
                    <span class="text-xs text-emerald-500/50 w-4">${i + 1}</span>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between text-xs mb-1">
                            <span class="text-white truncate">${a.artist || 'Unknown'}</span>
                            <span class="text-yellow-400 ml-2 shrink-0">${a.plays} plays · ${timeStr}</span>
                        </div>
                        <div class="h-1 bg-black/50 rounded-full overflow-hidden">
                            <div class="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full" style="width: ${pct}%"></div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        } else {
            artistsList.innerHTML = '<p class="text-emerald-500/50 text-center py-4">Sin datos aún</p>';
        }

        // Tracks
        const tracksList = document.getElementById('stats-tracks-list');
        if (data.top_tracks?.length) {
            tracksList.innerHTML = data.top_tracks.map((t, i) => {
                return `<div class="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg transition">
                    <span class="text-xs text-emerald-500/50 w-4">${i + 1}</span>
                    <div class="flex-1 min-w-0">
                        <div class="text-xs text-white truncate font-medium">${t.title || 'Unknown'}</div>
                        <div class="text-[10px] text-pink-400/70 truncate">${t.artist || 'Unknown Artist'}</div>
                    </div>
                    <span class="text-xs text-pink-400 shrink-0">${t.plays}×</span>
                </div>`;
            }).join('');
        } else {
            tracksList.innerHTML = '<p class="text-emerald-500/50 text-center py-4">Sin datos aún</p>';
        }
    } catch (e) {
        console.error('Error loading stats:', e);
        document.getElementById('stats-artists-list').innerHTML = '<p class="text-red-400 text-center py-4">Error cargando estadísticas</p>';
        document.getElementById('stats-tracks-list').innerHTML = '<p class="text-red-400 text-center py-4">Error cargando estadísticas</p>';
    }
}
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
    if (saved) return saved;

    const ua = navigator.userAgent || '';
    const type = detectKrakenDeviceType();
    const platform = navigator.platform || '';
    let inferred = type === 'desktop' ? 'PC Kraken' : (type === 'tablet' ? 'Tablet Kraken' : 'Movil Kraken');

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
