/**
 * ============================================================================
 * KRAKEN MEDIA SERVER — playlists-batch.js
 * Gestión CRUD de playlists, importación/compartición, selección masiva por lotes, menú contextual, reparación de listas y vista de carpetas.
 * ============================================================================
 */

/**
 * `crearCarpeta()`
 * Solicita el nombre y crea una nueva carpeta física dentro de la biblioteca.
 */
async function crearCarpeta() { const name = prompt("Nombre de la carpeta:"); if (name) { await fetch('/crear_carpeta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); cargarLib(); } }
/**
 * `crearPlaylist()`
 * Solicita el nombre y crea una nueva lista de reproducción vacía.
 */
async function crearPlaylist() { const name = prompt("Nombre de la Playlist:"); if (name) { await fetch('/playlist/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, owner: window.MY_EMAIL }) }); cargarLib(); } }
/**
 * `renamePlaylist(oldName)`
 * Cambia el nombre de una lista de reproducción existente.
 */
async function renamePlaylist(oldName) { const newName = prompt("Nuevo nombre para " + oldName + ":", oldName); if (newName && newName !== oldName) { await fetch('/playlist/rename', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ old_name: oldName, new_name: newName, owner: window.MY_EMAIL }) }); cargarLib(); } }
/**
 * `deletePlaylist(name)`
 * Elimina una lista de reproducción tras confirmar con el usuario.
 */
async function deletePlaylist(name) {
    if (confirm("¿Borrar lista " + name + "?")) {
        await fetch('/playlist/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, owner: window.MY_EMAIL }) });
        cargarLib();
    }
}

/**
 * `sharePlaylist(name)`
 * Genera y copia al portapapeles un código/enlace compartible de la playlist seleccionada.
 */
async function sharePlaylist(name) {
    try {
        const res = await fetch('/playlist/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, owner: window.MY_EMAIL })
        });
        const d = await res.json();
        if (!d.ok) { showToast(d.error || 'Error', 'error'); return; }

        const modal = document.createElement('div');
        modal.id = 'kraken-share-modal';
        modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-xs p-5 shadow-2xl text-center">
                <div class="mb-3">
                    <i class="fa-solid fa-link text-2xl text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]"></i>
                </div>
                <h3 class="text-lg font-bold text-white mb-1">Compartir Playlist</h3>
                <p class="text-xs text-zinc-400 mb-4">Comparte este código para que otros importen <b class="text-white">${name}</b></p>
                <div class="bg-black/50 border border-cyan-500/30 rounded-xl px-4 py-3 mb-4 font-mono text-2xl text-cyan-400 tracking-[0.3em] select-all">${d.code}</div>
                <div class="flex gap-2">
                    <button onclick="navigator.clipboard.writeText('${d.code}'); showToast('Código copiado', 'success')" 
                        class="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 rounded-xl transition text-sm">
                        <i class="fa-solid fa-copy mr-1"></i> Copiar
                    </button>
                    <button onclick="document.getElementById('kraken-share-modal').remove()" 
                        class="flex-1 bg-white/5 hover:bg-white/10 text-zinc-400 font-bold py-2.5 rounded-xl transition text-sm border border-white/10">
                        Cerrar
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (e) {
        showToast('Error compartiendo playlist', 'error');
    }
}

/**
 * `importPlaylistModal()`
 * Abre un cuadro de diálogo para importar una playlist compartida.
 */
function importPlaylistModal() {
    const modal = document.createElement('div');
    modal.id = 'kraken-import-modal';
    modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-xs p-5 shadow-2xl text-center">
            <div class="mb-3">
                <i class="fa-solid fa-download text-2xl text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]"></i>
            </div>
            <h3 class="text-lg font-bold text-white mb-1">Importar Playlist</h3>
            <p class="text-xs text-zinc-400 mb-4">Ingresa el código que te compartieron</p>
            <input type="text" id="import-code-input" placeholder="ABC123" maxlength="6"
                   class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-center font-mono text-xl tracking-[0.3em] uppercase focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition mb-4">
            <div class="flex gap-2">
                <button onclick="executeImport()" 
                    class="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 rounded-xl transition text-sm">
                    <i class="fa-solid fa-download mr-1"></i> Importar
                </button>
                <button onclick="document.getElementById('kraken-import-modal').remove()" 
                    class="flex-1 bg-white/5 hover:bg-white/10 text-zinc-400 font-bold py-2.5 rounded-xl transition text-sm border border-white/10">
                    Cancelar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => document.getElementById('import-code-input')?.focus(), 100);
}

/**
 * `executeImport()`
 * Procesa e importa las pistas de una playlist externa dentro de la biblioteca del usuario.
 */
async function executeImport() {
    const code = document.getElementById('import-code-input')?.value?.trim();
    if (!code || code.length < 4) { showToast('Ingresa un código válido', 'warning'); return; }
    try {
        const res = await fetch('/playlist/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, owner: window.MY_EMAIL })
        });
        const d = await res.json();
        if (d.ok) {
            document.getElementById('kraken-import-modal')?.remove();
            showToast(`Playlist "${d.name}" importada (${d.count} canciones)`, 'success');
            cargarLib();
        } else {
            showToast(d.error || 'Error importando', 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
}

/**
 * `toggleSelectionMode()`
 * Activa o desactiva el modo de selección múltiple (por lotes) en la biblioteca.
 */
function toggleSelectionMode() {
    selectionMode = !selectionMode;

    const btnDesktop = document.getElementById('btn-select-mode');
    const btnMobile = document.getElementById('btn-select-mode-mobile');

    const btnAllDesktop = document.getElementById('btn-select-all-vis');
    const btnAllMobile = document.getElementById('btn-select-all-vis-mobile');

    const bar = document.getElementById('batch-bar');

    [btnDesktop, btnMobile].forEach(btn => {
        if (!btn) return;
        if (selectionMode) {
            btn.classList.add('active', 'bg-emerald-600', 'text-white', 'border-emerald-500');
        } else {
            btn.classList.remove('active', 'bg-emerald-600', 'text-white', 'border-emerald-500');
        }
    });

    [btnAllDesktop, btnAllMobile].forEach(btn => {
        if (!btn) return;
        if (selectionMode) btn.classList.remove('hidden');
        else btn.classList.add('hidden');
    });

    if (!selectionMode) {
        selectedFiles.clear();
        if (bar) {
            bar.classList.add('hidden');
            bar.classList.remove('translate-y-0');
        }
    }

    renderLib();
} function selectRow(path) { if (!selectionMode) return; if (selectedFiles.has(path)) selectedFiles.delete(path); else selectedFiles.add(path); updateBatchUI(); renderLib(); }
/**
 * `selectAllVisible()`
 * Selecciona o deselecciona todos los archivos visibles en la vista filtrada actual.
 */
function selectAllVisible() {
    let tracks = [];

    // 📂 CASO 1: MODO CARPETAS
    if (currentView === 'folders') {
        // Seleccionamos todo lo que empiece por la ruta actual
        if (currentExplorerPath === '') {
            // Si estamos en raíz, todo
            tracks = libData.files;
        } else {
            // Si estamos en una carpeta
            tracks = libData.files.filter(f => f.path.startsWith(currentExplorerPath + '/'));
        }
    }
    // 📺 CASO 2: VISTA NETFLIX
    else if (currentLibrary === 'video' && currentPath === '' && window.netflixActiveCategory) {
        tracks = libData.files.filter(f => {
            if (f.type !== 'video') return false;
            const path = f.path.replace(/\\/g, '/');
            const parts = path.split('/');
            const cat = parts.length > 1 ? parts[1] : '';
            return cat === window.netflixActiveCategory;
        });
    }
    // 📺 CASO 3: VISTA TEMPORADA
    else if (currentLibrary === 'video' && currentPath && currentPath.includes('/')) {
        tracks = libData.files.filter(f => {
            if (f.type !== 'video') return false;
            const path = f.path.replace(/\\/g, '/');
            return path.startsWith(currentPath);
        });
    }
    // 🎵 CASO 4: MODO BIBLIOTECA NORMAL
    else {
        tracks = getFilteredTracks();
    }

    // Lógica de toggle (Si todos están seleccionados, deseleccionar. Si no, seleccionar).
    const allSelected = tracks.length > 0 && tracks.every(t => selectedFiles.has(t.path));

    tracks.forEach(t => {
        if (allSelected) selectedFiles.delete(t.path);
        else selectedFiles.add(t.path);
    });

    updateBatchUI();

    // Refrescar vista correcta
    if (currentView === 'folders') {
        renderFolderView(currentExplorerPath);
    } else {
        renderLib();
    }
} function enqueueSelected() {
    if (selectedFiles.size === 0) {
        showToast("No hay canciones seleccionadas", "warning");
        return;
    }

    let added = 0;

    selectedFiles.forEach(path => {
        const file = libData.files.find(f => f.path === path);
        if (!file) return;

        // Evitar duplicados en la cola
        const exists = playerQueue.some(t => t.path === path);
        if (!exists) {
            playerQueue.push(file);
            added++;
        }
    });

    if (added > 0) {
        showToast(`🎶 ${added} canciones añadidas a la cola`, "success");
        updateQueueUI();

        // Si no hay nada sonando, arrancar con la primera
        if (audioElement.paused && playerQueue.length === added) {
            currentTrackIndex = 0;
            playTrack(playerQueue[0]);
        }
    } else {
        showToast("Todas ya estaban en la cola", "info");
    }

    // Limpiar selección y cerrar modo selección
    selectedFiles.clear();
    toggleSelectionMode();
}
/**
 * `updateBatchUI()`
 * Actualiza el contador y la visibilidad de la barra flotante de acciones por lotes (`#batch-bar`).
 */
function updateBatchUI() {
    const bar = document.getElementById('batch-bar');
    document.getElementById('batch-count').innerText = selectedFiles.size;
    const removeBtn = document.getElementById('batch-remove-playlist');
    const inPlaylist = typeof currentLibrary !== 'undefined' && currentLibrary.startsWith('playlist:');
    if (removeBtn) {
        if (inPlaylist && selectedFiles.size > 0) removeBtn.classList.remove('hidden');
        else removeBtn.classList.add('hidden');
    }
    if (selectedFiles.size > 0) { bar.classList.remove('hidden'); setTimeout(() => bar.classList.remove('translate-y-20'), 10); setTimeout(() => bar.classList.add('translate-y-0'), 10); } else { bar.classList.remove('translate-y-0'); bar.classList.add('translate-y-20'); }
}
/**
 * `cancelSelection()`
 * Limpia la selección múltiple activa y oculta la barra de acciones por lotes.
 */
function cancelSelection() { toggleSelectionMode(); }
/**
 * `addBatchToPlaylist()`
 * Abre el selector de playlist para agregar todos los archivos seleccionados en lote.
 */
async function addBatchToPlaylist() { if (selectedFiles.size === 0) return; fileToPlaylist = null; openPlaylistModal(null, 'add'); }
/**
 * `removeBatchFromPlaylist()`
 * Elimina de la playlist actual todos los archivos seleccionados en lote.
 */
async function removeBatchFromPlaylist() { if (selectedFiles.size === 0) return; fileToPlaylist = null; openPlaylistModal(null, 'remove'); }
/**
 * `addToPlaylistBatch(name)`
 * Ejecuta la adición masiva de archivos seleccionados a una playlist destino.
 */
async function addToPlaylistBatch(name) { const paths = Array.from(selectedFiles); const res = await fetch('/playlist/add_batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, paths, owner: window.MY_EMAIL }) }); const d = await res.json(); closePlaylistModal(); cancelSelection(); if (d.ignored > 0) showToast(`Se añadieron ${d.added} canciones.\n(${d.ignored} repetidas se ignoraron).`); else showToast(`Añadidas ${d.added} canciones a ${name}`); cargarLib(); }
/**
 * `openPlaylistModal(path, mode = 'add')`
 * Abre el modal para añadir o quitar una pista individual de las playlists del usuario.
 */
function openPlaylistModal(path, mode = 'add') {
    fileToPlaylist = path;
    const isBatch = !path && selectedFiles.size > 0;
    const container = document.getElementById('playlist-options');
    container.innerHTML = '';
    const lists = Object.keys(libData.playlists).sort();

    if (lists.length === 0) {
        container.innerHTML = '<p class="text-emerald-500 text-center text-xs">Crea una playlist primero</p>';
    } else {
        lists.forEach(pl => {
            let isInList = false;
            if (!isBatch && path) {
                const fileData = libData.files.find(f => f.path === path);
                if (fileData && fileData.playlists.includes(pl)) isInList = true;
            }

            const isRemoveMode = isBatch && mode === 'remove';
            const btnClass = isRemoveMode
                ? "bg-red-900/30 text-red-300 border border-red-900/50 hover:bg-red-900/50"
                : (isInList ? "bg-emerald-600/20 text-emerald-400 border border-emerald-600/50" : "bg-emerald-800 hover:bg-emerald-700 text-emerald-300");
            const icon = isRemoveMode
                ? '<i class="fa-solid fa-minus"></i>'
                : (isInList ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-plus"></i>');
            const text = isRemoveMode ? `Quitar de ${pl}` : (isInList ? `${pl} (Ya en lista)` : pl);

            // Escapar comillas para evitar romper el HTML
            const plEscaped = pl.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const action = isBatch
                ? (mode === 'remove' ? `removeFromPlaylistBatch('${plEscaped}')` : `addToPlaylistBatch('${plEscaped}')`)
                : (isInList ? `removeFromPlaylistModal('${plEscaped}')` : `addToPlaylist('${plEscaped}')`);

            container.innerHTML += `<button onclick="${action}" class="w-full text-left px-4 py-3 rounded-lg text-xs mb-1 transition flex items-center gap-2 ${btnClass}">${icon} ${text}</button>`;
        });
    }
    document.getElementById('playlist-modal').classList.remove('hidden');
}
/**
 * `addToPlaylist(name)`
 * Agrega un archivo individual a la playlist indicada.
 */
async function addToPlaylist(name) {
    const res = await fetch('/playlist/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, path: fileToPlaylist, owner: window.MY_EMAIL })
    });
    const d = await res.json();
    closePlaylistModal();

    if (d.duplicate) {
        showToast(`⚠️ Ya está en "${name}"`, "warning");
    } else if (d.ok) {
        showToast(`✅ Agregado a "${name}"`, "success");
    }

    cargarLib();
}
/**
 * `removeFromPlaylistModal(name)`
 * Quita un archivo de una playlist desde el modal de gestión.
 */
async function removeFromPlaylistModal(name) {
    if (confirm(`¿Quitar de "${name}"?`)) {
        const res = await fetch('/playlist/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, path: fileToPlaylist, owner: window.MY_EMAIL })
        });
        const d = await res.json();
        closePlaylistModal();

        if (d.ok) {
            showToast(`🗑️ Quitado de "${name}"`, "info");
        }

        cargarLib();
    }
}
/**
 * `removeFromPlaylistBatch(name)`
 * Ejecuta la eliminación en lote de pistas dentro de una playlist.
 */
async function removeFromPlaylistBatch(name) {
    const paths = Array.from(selectedFiles);
    if (paths.length === 0) return;
    if (!confirm(`¿Quitar ${paths.length} canciones de "${name}"?`)) return;

    const results = await Promise.all(paths.map(async (path) => {
        const res = await fetch('/playlist/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, path, owner: window.MY_EMAIL })
        });
        const d = await res.json();
        return d.ok ? 1 : 0;
    }));

    const removed = results.reduce((a, b) => a + b, 0);
    closePlaylistModal();
    cancelSelection();
    showToast(`🗑️ Quitadas ${removed} canciones de "${name}"`, "info");
    cargarLib();
}
/**
 * `closePlaylistModal()`
 * Cierra el modal de selección de listas de reproducción.
 */
function closePlaylistModal() { document.getElementById('playlist-modal').classList.add('hidden'); }

/**
 * `openContextMenu(event, path)`
 * Despliega el menú contextual flotante con acciones para una pista o video.
 */
function openContextMenu(event, path) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            currentContextPath = path;

            // 1. Limpieza preventiva
            const old = document.getElementById('kraken-menu-overlay');
            if (old) old.remove();

            // 2. Datos del archivo
            // Si no encuentra el archivo en la DB, usa el nombre del path
            let file = { title: path.split('/').pop(), artist: 'Desconocido' };
            if (typeof libData !== 'undefined' && libData.files) {
                const found = libData.files.find(f => f.path === path);
                if (found) file = found;
            }

            // 3. Crear el Modal (Z-Index GOD MODE)
            const overlay = document.createElement('div');
            overlay.id = 'kraken-menu-overlay';
            // Usamos cssText para asegurar que nada lo sobreescriba
            overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 2147483647;
    background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
    display: flex; align-items: flex-end; justify-content: center;
    opacity: 0; transition: opacity 0.2s ease-out;
`;

            overlay.onclick = (e) => { if (e.target === overlay) closeContextMenu(); };

            // 4. El HTML del Menú
            const remotePlayBtn = (window.KRAKEN_CONTROL_TARGET && file && file.path && file.type !== 'folder') ? `
            <button onclick="ctxAction('send_remote')" style="background: transparent; border: none; width: 100%; padding: 12px; color: #34d399; text-align: left; font-size: 14px; display: flex; align-items: center; gap: 15px; cursor: pointer; border-radius: 8px;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                <i class="fa-solid fa-paper-plane" style="width: 20px; text-align: center;"></i> Reproducir en ${getDeviceDisplayName(window.KRAKEN_CONTROL_TARGET)}
            </button>` : '';
            overlay.innerHTML = `
    <div id="kraken-menu-panel" style="
        width: 100%; max-width: 400px; background: #121212;
        border-top: 1px solid rgba(255,255,255,0.1);
        border-radius: 20px 20px 0 0; padding: 20px 20px 40px 20px;
        transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
        box-shadow: 0 -10px 40px rgba(0,0,0,0.8);
    ">
        <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px;">
            <img src="/caratula/${encodeURIComponent(path)}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px; background: #333;" onerror="this.src='/static/default_cover.jpg'">
            <div style="overflow: hidden;">
                <h3 style="color: white; font-weight: bold; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0;">${file.title}</h3>
                <p style="color: #10b981; font-size: 11px; margin: 2px 0 0 0;">${file.artist}</p>
            </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
        ${remotePlayBtn}
        <button onclick="ctxAction('share')" style="background: transparent; border: none; width: 100%; padding: 12px; color: #a78bfa; text-align: left; font-size: 14px; display: flex; align-items: center; gap: 15px; cursor: pointer; border-radius: 8px;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                <i class="fa-solid fa-share-nodes" style="width: 20px; text-align: center;"></i> Compartir enlace seguro
        </button>
        <button onclick="ctxAction('edit')" style="background: transparent; border: none; width: 100%; padding: 12px; color: #fbbf24; text-align: left; font-size: 14px; display: flex; align-items: center; gap: 15px; cursor: pointer; border-radius: 8px;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                <i class="fa-solid fa-pen-to-square" style="width: 20px; text-align: center;"></i> Editar etiquetas
            </button>
            

            <button onclick="ctxAction('move')" style="background: transparent; border: none; width: 100%; padding: 12px; color: #60a5fa; text-align: left; font-size: 14px; display: flex; align-items: center; gap: 15px; cursor: pointer; border-radius: 8px;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                <i class="fa-solid fa-folder-tree" style="width: 20px; text-align: center;"></i> Mover archivo
            </button>

            <div style="height: 1px; background: rgba(255,255,255,0.1); margin: 5px 0;"></div>

            <button onclick="ctxAction('delete')" style="background: transparent; border: none; width: 100%; padding: 12px; color: #ef4444; text-align: left; font-size: 14px; display: flex; align-items: center; gap: 15px; cursor: pointer; border-radius: 8px;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                <i class="fa-solid fa-trash" style="width: 20px; text-align: center;"></i> Eliminar archivo
            </button>
        </div>

        <button onclick="closeContextMenu()" style="margin-top: 20px; width: 100%; background: #27272a; color: white; padding: 15px; border-radius: 12px; border: none; font-weight: bold;">Cancelar</button>
    </div>
`;

            document.body.appendChild(overlay);

            // Animación de entrada
            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                document.getElementById('kraken-menu-panel').style.transform = 'translateY(0)';
            });
        }

        /**
         * `closeContextMenu()`
         * Oculta el menú contextual flotante.
         */
        function closeContextMenu() {
            const overlay = document.getElementById('kraken-menu-overlay');
            const panel = document.getElementById('kraken-menu-panel');
            if (overlay && panel) {
                panel.style.transform = 'translateY(100%)';
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 300);
            }
        }

        /**
         * `ctxAction(action)`
         * Ejecuta la acción seleccionada en el menú contextual (reproducir, encolar, editar, mover, borrar).
         */
        function ctxAction(action) {
            if (!currentContextPath) return;
            closeContextMenu();

            // Ya no necesitamos safePath - usamos currentContextPath directamente
            if (action === 'send_remote') {
                const file = libData?.files?.find(f => f.path === currentContextPath);
                sendFileToControlledDevice(file || { path: currentContextPath, title: currentContextPath.split('/').pop(), artist: '', type: 'audio' });
            }
            if (action === 'share') {
                if (typeof openShareModal === 'function') {
                    openShareModal(currentContextPath);
                }
            }
            if (action === 'edit') abrirEditorMasivo(currentContextPath);
            if (action === 'move') abrirMover(currentContextPath);
            if (action === 'delete') borrar(currentContextPath);
        }


        /**
         * `repairPlaylists()`
         * Escanea y repara rutas rotas en las playlists buscando coincidencias por nombre de archivo.
         */
        function repairPlaylists() {
            if (!confirm("Esto buscará canciones movidas en tus playlists y actualizará sus rutas. ¿Continuar?")) return;

            console.log("🚑 Iniciando reparación de playlists...");
            let fixedCount = 0;
            let lostCount = 0;

            // Crear mapa rápido de nombres de archivo -> ruta actual
            // Ejemplo: "Queen.mp3" -> "Musica/Nuevos/Queen.mp3"
            const fileMap = new Map();
            libData.files.forEach(f => {
                const fileName = f.path.split('/').pop(); // Solo el nombre final
                fileMap.set(fileName, f.path);
            });

            // Recorrer todas las playlists
            for (const [playlistName, paths] of Object.entries(libData.playlists)) {
                const newPaths = [];
                let changed = false;

                paths.forEach(oldPath => {
                    // 1. ¿Existe la canción en su ruta original?
                    const stillExists = libData.files.some(f => f.path === oldPath);

                    if (stillExists) {
                        // Todo bien, la dejamos igual
                        newPaths.push(oldPath);
                    } else {
                        // 2. ¡NO EXISTE! Ha sido movida o borrada. Vamos a buscarla.
                        const fileName = oldPath.split('/').pop();
                        const newLocation = fileMap.get(fileName);

                        if (newLocation) {
                            // ¡LA ENCONTRAMOS EN OTRA CARPETA! 🕵️‍♂️
                            console.log(`✅ Reparado en [${playlistName}]: ${fileName} se movió a -> ${newLocation}`);
                            newPaths.push(newLocation);
                            fixedCount++;
                            changed = true;
                        } else {
                            // No está en ningún lado (borrada definitivamente)
                            console.warn(`❌ Perdida en [${playlistName}]: ${fileName}`);
                            lostCount++;
                            // Opcional: newPaths.push(oldPath); // Descomenta si quieres mantener el link roto
                        }
                    }
                });

                // Actualizamos la playlist en memoria
                if (changed) {
                    libData.playlists[playlistName] = newPaths;
                }
            }

            // Guardar cambios en el servidor
            if (fixedCount > 0) {
                // Asumiendo que tienes una función para guardar. Si no, simulamos la petición.
                fetch('/playlist/save_all', { // Asegúrate de tener esta ruta o usa tu lógica de guardado existente
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(libData.playlists)
                }).then(() => {
                    alert(`¡Éxito! Se repararon ${fixedCount} enlaces rotos. (Se perdieron ${lostCount} canciones borradas).`);
                    renderLib(); // Refrescar vista
                }).catch(err => alert("Error al guardar las reparaciones: " + err));
            } else {
                alert("Tus playlists están sanas. No se encontraron archivos movidos.");
            }
        }

/**
 * `renderFolderView(targetPath = '')`
 * Renderiza el explorador jerárquico de carpetas físicas de audio.
 */
function renderFolderView(targetPath = '') {
            currentView = 'folders';
            currentExplorerPath = targetPath;

            const container = document.getElementById('lib-container');
            const mixesContainer = document.getElementById('smart-mixes-container');
            if (mixesContainer) mixesContainer.classList.add('hidden');

            if (!container) return;

            // 1. OBTENER TÉRMINO DE BÚSQUEDA
            const mobileInput = document.getElementById('lib-search-mobile');
            const desktopInput = document.getElementById('lib-search-desktop');
            const term = ((mobileInput && mobileInput.value) || (desktopInput && desktopInput.value) || '').toLowerCase();

            // 2. FILTRAR: ¿Qué archivos viven dentro de esta ruta?
            let filesInPath = libData.files.filter(f => {
                if (targetPath === '') return true;
                return f.path.startsWith(targetPath + '/');
            });

            // 3. APLICAR BÚSQUEDA (SI ESCRIBISTE ALGO)
            // Esto oculta archivos que no coinciden y carpetas vacías de resultados
            if (term) {
                filesInPath = filesInPath.filter(f => {
                    const title = (f.title || '').toLowerCase();
                    const artist = (f.artist || '').toLowerCase();
                    const album = (f.album || '').toLowerCase();
                    // Truco: También busca en el nombre del archivo/ruta
                    const path = f.path.toLowerCase();

                    return title.includes(term) || artist.includes(term) || album.includes(term) || path.includes(term);
                });
            }

            // 4. AGRUPAR (Separar carpetas y archivos sueltos)
            const subFolders = new Map();
            const filesHere = [];

            filesInPath.forEach(f => {
                const relativePath = targetPath === '' ? f.path : f.path.substring(targetPath.length + 1);
                const parts = relativePath.split('/');

                if (parts.length > 1) {
                    // ES UNA SUB-CARPETA
                    const folderName = parts[0];
                    const fullFolderPath = targetPath === '' ? folderName : targetPath + '/' + folderName;

                    if (!subFolders.has(folderName)) {
                        subFolders.set(folderName, {
                            fullPath: fullFolderPath,
                            count: 0,
                            cover: f.path,
                            tmdb_rating: f.tmdb_rating
                        });
                    }
                    subFolders.get(folderName).count++;
                } else {
                    // ES UN ARCHIVO SUELTO en esta carpeta
                    filesHere.push(f);
                }
            });

            // Guardamos los archivos visibles para el botón "Play" y "Select All"
            window.currentVisibleFiles = filesHere;

            // 5. GENERAR HTML (Breadcrumbs + Carpetas + Archivos)
            const breadcrumbs = targetPath.split('/').reduce((acc, part, index, arr) => {
                if (!part) return acc;
                const pathUpToHere = arr.slice(0, index + 1).join('/');
                const safePath = pathUpToHere.replace(/'/g, "\\'");
                return acc + ` <i class="fa-solid fa-chevron-right text-[10px] mx-2 opacity-30"></i> <button onclick="renderFolderView('${safePath}')" class="hover:text-emerald-400 transition">${part}</button>`;
            }, `<button onclick="renderFolderView('')" class="hover:text-emerald-400 font-bold transition flex items-center gap-2"><i class="fa-solid fa-folder-tree"></i> Inicio</button>`);

            let upBtn = '';
            if (targetPath !== '') {
                upBtn = `
    <button onclick="goUpLevel()" class="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition border border-white/10 shadow-lg">
        <i class="fa-solid fa-arrow-up text-zinc-400"></i>
    </button>`;
            }

            let html = `
    <div class="pb-32">
        <div class="mb-6 flex items-center justify-between sticky top-0 bg-[#09090b]/95 backdrop-blur z-30 p-3 rounded-xl border border-white/5 shadow-xl">
            <div class="text-sm text-zinc-300 flex items-center flex-wrap gap-1">
                ${breadcrumbs}
            </div>
            ${upBtn}
        </div>
        
        ${subFolders.size > 0 ? `
        <div class="mb-2 flex items-center justify-between">
            <h3 class="text-emerald-500 text-[10px] font-bold uppercase tracking-wider">Carpetas (${subFolders.size})</h3>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-8">
            ${Array.from(subFolders.values()).map(folder => {
                const name = folder.fullPath.split('/').pop();
                const safePath = folder.fullPath.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                const coverUrl = `/caratula/${folder.cover.split('/').map(p => encodeURIComponent(p)).join('/')}`;

                return `
                <div class="group bg-[#121212] hover:bg-[#1e1e1e] border border-white/5 hover:border-yellow-500/30 rounded-xl p-3 transition-all cursor-pointer relative shadow-lg"
                    onclick="renderFolderView('${safePath}')">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="w-10 h-10 rounded-lg bg-zinc-900 overflow-hidden shrink-0 relative">
                            <img data-src="${coverUrl}" class="lazy-img w-full h-full object-cover opacity-60 group-hover:opacity-100 transition" onerror="this.style.display='none'">
                            <div class="absolute inset-0 flex items-center justify-center">
                                <i class="fa-solid fa-folder text-yellow-600/80 group-hover:text-yellow-500 transition"></i>
                            </div>
                            ${folder.tmdb_rating ? (() => {
                        let rColor = 'bg-emerald-600/80 border-emerald-500/50';
                        if (['R', 'NC-17', 'C', 'D', '18', '16', '16+', '18+', 'MA15+', 'R18+', 'R15+'].includes(folder.tmdb_rating)) rColor = 'bg-red-600/80 border-red-500/50';
                        else if (['PG-13', 'B-15', 'B', 'M', 'TV-MA', 'TV-14'].includes(folder.tmdb_rating)) rColor = 'bg-orange-500/80 border-orange-500/50';
                        else if (['PG', 'A'].includes(folder.tmdb_rating)) rColor = 'bg-blue-500/80 border-blue-500/50';
                        return '<div class="absolute top-0.5 left-0.5 px-1 py-0.5 rounded text-[7px] font-bold text-white border backdrop-blur-md shadow-sm pointer-events-none ' + rColor + '">' + folder.tmdb_rating + '</div>';
                    })() : ''}
                        </div>
                        <div class="min-w-0">
                            <div class="font-bold text-gray-200 text-xs truncate" title="${name}">
                                ${name.replace(new RegExp(term, 'gi'), match => `<span class="text-yellow-400 bg-yellow-400/20">${match}</span>`)}
                            </div>
                            <div class="text-[9px] text-zinc-500">${folder.count} items</div>
                        </div>
                    </div>
                     <div class="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onclick="event.stopPropagation(); addFolderToPlaylist('${safePath}')" 
                            class="w-6 h-6 rounded-full bg-zinc-800 hover:bg-emerald-500 text-zinc-400 hover:text-black flex items-center justify-center transition" title="Añadir todo">
                            <i class="fa-solid fa-plus text-[10px]"></i>
                        </button>
                    </div>
                </div>`;
            }).join('')}
        </div>` : ''}

        ${filesHere.length > 0 ? `
        <div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
            <h3 class="text-emerald-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2">
                <i class="fa-solid fa-file-audio"></i> Archivos (${filesHere.length})
            </h3>
             
        </div>
        
        <div class="${viewMode === 'list' ? 'space-y-1' : `krk-audio-grid grid ${zoomLevels[currentZoomIndex]} gap-4`}">
            ${filesHere.map(f => {
                return viewMode === 'list' ? createListRow(f) : createCard(f);
            }).join('')}
        </div>` :
                    (subFolders.size === 0 ? '<div class="text-center text-zinc-600 py-20 flex flex-col items-center gap-2"><i class="fa-solid fa-magnifying-glass text-4xl opacity-50"></i><span>Sin resultados</span></div>' : '')}
    </div>
`;

            container.innerHTML = html;
            observeLazyImages();
        }

        /**
         * `goUpLevel()`
         * Sube un nivel en la jerarquía de carpetas del explorador.
         */
        function goUpLevel() {
            if (!currentExplorerPath) return;
            const parts = currentExplorerPath.split('/');
            parts.pop(); // Quitamos la última carpeta
            const parentPath = parts.join('/');
            renderFolderView(parentPath);
        }

/**
 * `confirmarBorrarCarpeta(folderPath)`
 * Solicita confirmación y PIN Maestro para eliminar una carpeta completa del disco.
 */
function confirmarBorrarCarpeta(folderPath) {
    if (confirm(`⚠️ ¿ESTÁS SEGURO?\n\nVas a eliminar la carpeta "${folderPath}" y TODAS las canciones que contiene.\n\nEsta acción no se puede deshacer.`)) {

        const pin = prompt("Por seguridad, introduce el PIN Maestro:");
        if (!pin) return;

        // Llamada al Backend (Asegúrate de tener esta ruta en Python)
        fetch('/api/delete_folder_batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder: folderPath, pin: pin })
        })
            .then(r => r.json())
            .then(data => {
                if (data.status === 'ok') {
                    showNotification('Carpeta eliminada', 'success');
                    // Recargamos la librería para que desaparezca
                    location.reload();
                } else {
                    alert('Error: ' + data.error);
                }
            });
    }
}

/**
 * `addFolderToPlaylist(folderPath)`
 * Agrega todas las canciones de una carpeta a una lista de reproducción.
 */
function addFolderToPlaylist(folderPath) {
    console.log("Intentando añadir carpeta:", folderPath);

    // 1. Buscamos archivos que empiecen con esa ruta
    const filesInFolder = libData.files.filter(f => {
        return f.path.startsWith(folderPath + '/');
    });

    if (filesInFolder.length === 0) {
        showNotification("Carpeta vacía o sin audios", "error");
        return;
    }

    const pathsToAdd = filesInFolder.map(f => f.path);

    // 2. Preparamos para el modal
    window.tempPlaylistPaths = pathsToAdd

    // 3. Abrimos el modal (Lógica genérica)
    const modal = document.getElementById('playlist-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        // Si tienes una función para pintar las listas en el modal, llámala:
        if (typeof renderPlaylistsInModal === 'function') renderPlaylistsInModal();
    } else {
        alert("Error: No encuentro el modal 'playlist-modal' en el HTML");
    }
}
