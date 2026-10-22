/**
 * ============================================================================
 * KRAKEN MEDIA SERVER — tag-editor.js
 * Editor individual y masivo de metadatos (audio/video), búsqueda y descarga de subtítulos online (SubDL/Podnapisi), autocompletado TMDB/Last.fm y gestión de archivos en disco.
 * ============================================================================
 */

/**
 * `abrirEditorMasivo(pathOverride)`
 * Abre el modal de edición de metadatos (ID3/MP4/TMDB) en modo individual o masivo.
 */
function abrirEditorMasivo(pathOverride) {
        const fields = document.getElementById('edit-fields');
        const title = document.getElementById('edit-modal-title');
        fields.innerHTML = "";

        let paths = pathOverride ? [pathOverride] : Array.from(selectedFiles);

        // --- MODO SINGLE ---
        if (paths.length === 1) {
            const reqPath = paths[0];
            const cleanPath = reqPath.endsWith('/') ? reqPath.slice(0, -1) : reqPath;
            let f = libData.files.find(x => x.path === reqPath || x.path === cleanPath);
            const isVirtualFolder = !f && libData.files.some(x => x.path.startsWith(cleanPath + '/'));
            if (!f && isVirtualFolder) f = libData.files.find(x => x.path.startsWith(cleanPath + '/'));

            if (!f) return;

            // Detectar si es video (o carpeta virtual de video)
            const isVideo = isVirtualFolder || f.path.endsWith('.mkv') || f.path.endsWith('.mp4') || f.path.endsWith('.avi') || f.path.endsWith('.mov') || f.path.endsWith('.webm');

            title.innerText = isVideo ? (isVirtualFolder ? "Editar Serie/Carpeta" : "Editar Video") : "Editar Canción";

            let fieldsHtml = `
    <input type="hidden" id="edit-mode" value="single">
    <input type="hidden" id="edit-path" value="${cleanPath}">
    <input type="hidden" id="edit-is-virtual" value="${isVirtualFolder ? 'true' : 'false'}">`;

            if (!isVideo) {
                fieldsHtml += `
    <div>
        <label class="text-[10px] text-emerald-500 font-bold uppercase">Título</label>
        <input type="text" id="edit-title" value="${f.title}"
               class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
    </div>

    <div>
        <label class="text-[10px] text-emerald-500 font-bold uppercase">Artista</label>
        <input type="text" id="edit-artist" value="${f.artist}"
               class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
    </div>

    <div>
        <label class="text-[10px] text-emerald-500 font-bold uppercase">Álbum</label>
        <input type="text" id="edit-album" value="${f.album || ''}"
               class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
    </div>

    <div>
        <label class="text-[10px] text-emerald-500 font-bold uppercase">Género</label>
        <input type="text" id="edit-genre" value="${f.genre || ''}"
               class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
    </div>

    <hr class="border-white/10">`;
            } else {
                // VIDEO FIELDS
                fieldsHtml += `
    <div>
        <label class="text-[10px] text-emerald-500 font-bold uppercase">Título / Serie</label>
        <input type="text" id="edit-tmdb-title" value="${f.tmdb_title || f.title || ''}"
               class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none mb-2">
    </div>
    
    <div class="flex gap-2 mb-2">
        <div class="flex-1">
            <label class="text-[10px] text-emerald-500 font-bold uppercase">Clasificación (Rating)</label>
            <select id="edit-tmdb-rating" class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
                <option value="">- Vacío (Apto para todos) -</option>
                <option value="G" ${f.tmdb_rating == 'G' ? 'selected' : ''}>G</option>
                <option value="PG" ${f.tmdb_rating == 'PG' ? 'selected' : ''}>PG</option>
                <option value="PG-13" ${f.tmdb_rating == 'PG-13' ? 'selected' : ''}>PG-13</option>
                <option value="B-15" ${f.tmdb_rating == 'B-15' ? 'selected' : ''}>B-15</option>
                <option value="R" ${f.tmdb_rating == 'R' ? 'selected' : ''}>R</option>
                <option value="M" ${f.tmdb_rating == 'M' ? 'selected' : ''}>M</option>
                <option value="16" ${f.tmdb_rating == '16' ? 'selected' : ''}>16</option>
                <option value="18" ${f.tmdb_rating == '18' ? 'selected' : ''}>18</option>
                <option value="R18+" ${f.tmdb_rating == 'R18+' ? 'selected' : ''}>R18+</option>
                <option value="NC-17" ${f.tmdb_rating == 'NC-17' ? 'selected' : ''}>NC-17</option>
            </select>
        </div>
        <div class="flex-1">
            <label class="text-[10px] text-emerald-500 font-bold uppercase">Año</label>
            <input type="text" id="edit-tmdb-year" value="${f.tmdb_year || ''}"
                   class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
        </div>
    </div>
    
    <div>
        <label class="text-[10px] text-emerald-500 font-bold uppercase">Géneros</label>
        <input type="text" id="edit-tmdb-genres" value="${f.tmdb_genres || ''}" placeholder="Ej: Animación, Horror..."
               class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none mb-2">
    </div>
    
    <div>
        <label class="text-[10px] text-emerald-500 font-bold uppercase">Sinopsis (Overview)</label>
        <textarea id="edit-tmdb-overview" rows="3" class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none resize-none">${f.tmdb_overview || ''}</textarea>
    </div>
    <div class="mt-2 p-2.5 rounded-lg bg-black/30 border border-emerald-800/60">
        <div class="flex items-center justify-between gap-2 mb-1.5">
            <label class="text-[10px] text-emerald-400 font-bold uppercase flex items-center gap-1">💬 Subtítulos Online (.SRT UTF-8)</label>
            <button type="button" onclick="buscarSubtitulosOnline()" id="btn-search-subs-online"
                    class="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-[10px] transition flex items-center gap-1">
                🔍 Buscar Subtítulos
            </button>
        </div>
        <div id="online-subs-results" class="text-[11px] text-zinc-400 max-h-40 overflow-y-auto space-y-1 hidden"></div>
    </div>
    <hr class="border-white/10 my-2">`;
            }

            fieldsHtml += `
    <div>
        <label class="text-[10px] text-emerald-500 font-bold uppercase">Póster / Carátula (URL opcional)</label>
        <input type="text" id="edit-cover" placeholder="http://... (Reemplaza imagen actual)"
               class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
    </div>`;

            fields.innerHTML = fieldsHtml;
        }

        // --- MODO BATCH ---
        else {
            title.innerText = `Editar ${paths.length} archivos`;

            let fBatch = libData.files.find(x => x.path === paths[0]);
            let isVideoBatch = (fBatch && (fBatch.path.endsWith('.mkv') || fBatch.path.endsWith('.mp4') || fBatch.path.endsWith('.avi')));

            if (isVideoBatch) {
                fields.innerHTML = `
    <input type="hidden" id="edit-mode" value="batch-video">
    <p class="text-[10px] text-emerald-400 mb-3 block">Deja un campo en blanco si NO quieres alterarlo.</p>
    <div class="flex gap-2 mb-2">
        <div class="flex-1">
            <label class="text-[10px] text-emerald-500 font-bold uppercase">Rating</label>
            <select id="edit-tmdb-rating" class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
                <option value="">- No cambiar -</option>
                <option value="VACIO">- Borrar Rating (Vacío) -</option>
                <option value="G">G</option>
                <option value="PG">PG</option>
                <option value="PG-13">PG-13</option>
                <option value="B-15">B-15</option>
                <option value="R">R</option>
                <option value="M">M</option>
                <option value="16">16</option>
                <option value="18">18</option>
                <option value="R18+">R18+</option>
                <option value="NC-17">NC-17</option>
            </select>
        </div>
        <div class="flex-1">
            <label class="text-[10px] text-emerald-500 font-bold uppercase">Año</label>
            <input type="text" id="edit-tmdb-year" placeholder="Ej: 2024" class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
        </div>
    </div>
    <div>
        <label class="text-[10px] text-emerald-500 font-bold uppercase">Título Padre</label>
        <input type="text" id="edit-tmdb-title" placeholder="Ej: The Office..." class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none mb-2">
    </div>
    <p class="text-[9px] text-red-400 mt-2 italic">* Se sobreescribirá en TODOS los videos seleccionados.</p>
`;
            } else {
                fields.innerHTML = `
    <input type="hidden" id="edit-mode" value="batch">
    <input type="hidden" id="batch-target" value="genre">

    <div class="flex gap-2 mb-3">
        <button onclick="setBatchTarget('genre')" id="bt-genre"
                class="flex-1 bg-emerald-700/40 border border-emerald-600 text-[10px] py-1 rounded">
            Género
        </button>
        <button onclick="setBatchTarget('artist')" id="bt-artist"
                class="flex-1 bg-zinc-800 border border-zinc-700 text-[10px] py-1 rounded">
            Artista
        </button>
        <button onclick="setBatchTarget('cover')" id="bt-cover"
                class="flex-1 bg-zinc-800 border border-zinc-700 text-[10px] py-1 rounded">
            Carátula
        </button>
    </div>

    <div id="batch-field"></div>

    <p class="text-[9px] text-emerald-500 mt-2 italic">
        * Se aplicará a todos los seleccionados.
    </p>
`;
                renderBatchField('genre');
            }
        }

        document.getElementById('edit-modal').classList.remove('hidden');
    }

    /**
     * `buscarSubtitulosOnline()`
     * Consulta proveedores externos (SubDL / Podnapisi) desde el modal de edición de video.
     */
    async function buscarSubtitulosOnline() {
        const titleInput = document.getElementById('edit-tmdb-title');
        const yearInput = document.getElementById('edit-tmdb-year');
        const resultsBox = document.getElementById('online-subs-results');
        const btn = document.getElementById('btn-search-subs-online');
        if (!resultsBox || !titleInput) return;

        const q = (titleInput.value || '').trim();
        const y = (yearInput ? yearInput.value : '').trim();
        if (!q) {
            showToast('Escribe primero el título de la película/serie', 'warning');
            return;
        }

        resultsBox.classList.remove('hidden');
        resultsBox.innerHTML = '<div class="text-emerald-400 py-2 text-center animate-pulse">⏳ Buscando subtítulos en Español e Inglés...</div>';
        if (btn) btn.disabled = true;

        try {
            const res = await fetch(`/api/subtitles/search?query=${encodeURIComponent(q)}&year=${encodeURIComponent(y)}`);
            const data = await res.json();
            if (!data.ok || !data.results || data.results.length === 0) {
                const errors = (data.provider_errors || []).map(e => `${e.provider}: ${e.message}`).join(' · ');
                const safeErrors = errors.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                resultsBox.innerHTML = `<div class="text-zinc-300 py-2 text-center">No se encontraron subtítulos para este título. Prueba simplificando el título arriba.${safeErrors ? `<div class="text-amber-300 text-[10px] mt-2">Estado: ${safeErrors}</div>` : ''}</div>`;
                return;
            }
            window._lastOnlineSubResults = data.results;
            const providerNotice = (data.provider_errors || []).map(e => `${e.provider}: ${e.message}`).join(' · ');
            const safeNotice = providerNotice.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            resultsBox.innerHTML = (safeNotice ? `<div class="text-amber-300 text-[10px] px-1 pb-1">Aviso: ${safeNotice}</div>` : '') + data.results.map((item, idx) => {
                const isEs = (item.lang || '').startsWith('es');
                const badgeColor = isEs ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-blue-500/20 text-blue-300 border-blue-500/40';
                const flag = isEs ? '🇪🇸 ES' : '🇺🇸 EN';
                const safeRel = (item.release || item.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                return `
                    <div class="flex items-center justify-between gap-2 p-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/5">
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-1.5">
                                <span class="px-1.5 py-0.5 rounded text-[9px] font-bold border ${badgeColor}">${flag}</span>
                                <span class="text-white font-medium truncate text-[11px]" title="${safeRel}">${safeRel}</span>
                            </div>
                            <div class="text-[9px] text-zinc-400 mt-0.5">${item.provider || 'Proveedor'} • ${item.year ? item.year + ' • ' : ''}⬇️ ${item.downloads || 0} descargas</div>
                        </div>
                        <button type="button" onclick="descargarSubtituloOnline(${idx}, this)"
                                class="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500 hover:text-black text-emerald-300 font-bold text-[10px] shrink-0 transition">
                            Descargar
                        </button>
                    </div>
                `;
            }).join('');
        } catch (e) {
            resultsBox.innerHTML = '<div class="text-red-400 py-2 text-center">❌ Error de red al buscar subtítulos.</div>';
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    /**
     * `descargarSubtituloOnline(idx, btnEl)`
     * Descarga y guarda en UTF-8 el subtítulo `.srt` seleccionado junto al archivo de video.
     */
    async function descargarSubtituloOnline(idx, btnEl) {
        const item = (window._lastOnlineSubResults || [])[idx];
        const pathInput = document.getElementById('edit-path');
        if (!item || !pathInput) return;

        const origText = btnEl ? btnEl.innerText : 'Descargar';
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerText = '⏳...';
        }

        try {
            const res = await fetch('/api/subtitles/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    video_path: pathInput.value,
                    download_url: item.download_url,
                    lang: item.lang
                })
            });
            const data = await res.json();
            if (data.ok) {
                if (btnEl) {
                    btnEl.innerText = '✅ Listo';
                    btnEl.className = 'px-2 py-1 rounded bg-emerald-600 text-black font-bold text-[10px] shrink-0';
                }
                showToast(`✅ Subtítulo guardado: ${data.filename}`, 'success');
            } else {
                if (btnEl) {
                    btnEl.disabled = false;
                    btnEl.innerText = origText;
                }
                showToast(`❌ ${data.error || 'No se pudo descargar'}`, 'error');
            }
        } catch (e) {
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerText = origText;
            }
            showToast('❌ Error descargando subtítulo', 'error');
        }
    }

    // helpers del batch
    /**
     * `setBatchTarget(t)`
     * Define qué campo de metadatos se aplicará en la edición por lotes.
     */
    function setBatchTarget(t) {
        document.getElementById('batch-target').value = t;

        ['genre', 'artist', 'cover'].forEach(k => {
            const b = document.getElementById('bt-' + k);
            if (!b) return;
            b.className = k === t
                ? 'flex-1 bg-emerald-700/40 border border-emerald-600 text-[10px] py-1 rounded'
                : 'flex-1 bg-zinc-800 border border-zinc-700 text-[10px] py-1 rounded';
        });

        renderBatchField(t);
    }

    /**
     * `renderBatchField(t)`
     * Renderiza dinámicamente el input del campo seleccionado para edición masiva.
     */
    function renderBatchField(t) {
        const box = document.getElementById('batch-field');
        if (!box) return;

        if (t === 'genre') {
            box.innerHTML = `
    <label class="text-[10px] text-emerald-500 font-bold uppercase">Género</label>
    <input type="text" id="edit-genre" placeholder="Ej: Rock, Anime…"
           class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
`;
        }

        if (t === 'artist') {
            box.innerHTML = `
    <label class="text-[10px] text-emerald-500 font-bold uppercase">Artista</label>
    <input type="text" id="edit-artist" placeholder="Nuevo artista…"
           class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
`;
        }

        if (t === 'cover') {
            box.innerHTML = `
    <label class="text-[10px] text-emerald-500 font-bold uppercase">Carátula (URL)</label>
    <input type="text" id="edit-cover" placeholder="http://..."
           class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
`;
        }
    }
    /**
     * `guardarCambiosEdicion()`
     * Envía al servidor los cambios de etiquetas, carátulas, TMDB ID o bandera +18.
     */
    async function guardarCambiosEdicion() {
        const mode = document.getElementById('edit-mode')?.value;
        if (!mode) return;

        const pin = getMasterPin("PIN Maestro requerido para modificar metadatos físicos:");
        if (!pin) return;

        const coverEl = document.getElementById('edit-cover');
        const genreEl = document.getElementById('edit-genre');
        const artistEl = document.getElementById('edit-artist');

        const coverUrl = coverEl?.value || "";
        const genre = genreEl?.value || "";
        const artist = artistEl?.value || "";

        let paths = (mode === 'single')
            ? [document.getElementById('edit-path')?.value]
            : Array.from(selectedFiles);

        let dataTags = {};

        if (mode === 'single') {
            dataTags = {
                path: paths[0],
                title: document.getElementById('edit-title')?.value || "",
                artist: artist || document.getElementById('edit-artist')?.value || "",
                album: document.getElementById('edit-album')?.value || "",
                genre: genre || document.getElementById('edit-genre')?.value || ""
            };
        } else {
            dataTags = { paths };
            if (genre) dataTags.genre = genre;
            if (artist) dataTags.artist = artist;
        }

        const isVirtualFolder = document.getElementById('edit-is-virtual')?.value === 'true';
        const isVideo = isVirtualFolder || (paths[0] && (paths[0].endsWith('.mkv') || paths[0].endsWith('.mp4') || paths[0].endsWith('.avi') || paths[0].endsWith('.mov') || paths[0].endsWith('.webm')));

        if (mode === 'batch-video' || (isVideo && mode === 'single')) {
            const rValue = document.getElementById('edit-tmdb-rating')?.value;
            const rToSend = (rValue === 'VACIO') ? 'VACIO' : (rValue || "");

            const videoTags = {
                path: (mode === 'batch-video') ? null : paths[0],
                paths_array: (mode === 'batch-video') ? paths : [],
                is_virtual: (mode === 'batch-video') ? false : isVirtualFolder,
                tmdb_title: document.getElementById('edit-tmdb-title')?.value || "",
                tmdb_rating: rToSend,
                tmdb_year: document.getElementById('edit-tmdb-year')?.value || "",
                tmdb_genres: document.getElementById('edit-tmdb-genres')?.value || "",
                tmdb_overview: document.getElementById('edit-tmdb-overview')?.value || "",
                pin: pin
            };
            const r = await fetch('/library/update_video_meta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(videoTags)
            });
            const d = await r.json();
            if (d.error) {
                clearPinIfInvalid(d.error);
                alert(d.error);
                return;
            }
        } else if (!isVideo && Object.keys(dataTags).length > 1) {
            dataTags.pin = pin; // 🔐 inyectar el PIN
            const r = await fetch('/update_tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataTags)
            });
            const d = await r.json();
            if (d.error) {
                clearPinIfInvalid(d.error);
                alert(d.error);
                return;
            }
        }

        if (coverUrl) {
            const r2 = await fetch('/update_cover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paths, url: coverUrl, pin })
            });
            const d2 = await r2.json();
            if (d2.error) clearPinIfInvalid(d2.error);
        }

        document.getElementById('edit-modal')?.classList.add('hidden');
        if (mode === 'batch' || mode === 'batch-video') toggleSelectionMode();
        showToast("✅ Cambios guardados correctamente", "success");
        await cargarLib();
    }
    /**
     * `confirmarBorradoMasivo()`
     * Solicita el PIN Maestro y elimina del disco todos los archivos seleccionados en lote.
     */
    async function confirmarBorradoMasivo() {
        if (!confirm(`⚠️ PELIGRO ⚠️\n\n¿Estás seguro de que quieres BORRAR FÍSICAMENTE ${selectedFiles.size} archivos?\n\nEsta acción NO se puede deshacer.`)) return;
        const pin = getMasterPin("PIN Maestro requerido para borrar contenido masivo del disco:");
        if (!pin) return;
        const res = await fetch('/borrar_masivo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paths: Array.from(selectedFiles), pin: pin }) });
        const d = await res.json();
        if (d.error) {
            clearPinIfInvalid(d.error);
            alert(d.error);
        }
        else { showToast(`Se eliminaron ${d.count} archivos correctamente.`); toggleSelectionMode(); cargarLib(); }
    }
    /**
     * `abrirMover(path)`
     * Abre el modal con la lista de carpetas destino para mover un archivo.
     */
    function abrirMover(path) {
        fileToMove = decodeURIComponent(path);
        const list = document.getElementById('folder-list-modal');
        list.innerHTML = `<button 
        onclick="moverA('Raíz')" 
        class="w-full text-left px-4 py-3 bg-emerald-800 hover:bg-emerald-700 rounded-lg text-xs mb-1 font-bold text-white transition flex items-center gap-2">
        <i class="fa-solid fa-file"></i> Raíz
    </button>`;

        libData.folders.forEach(f => {
            const folderEscaped = f.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            list.innerHTML += `<button 
            onclick="moverA('${folderEscaped}')" 
            class="w-full text-left px-4 py-3 bg-emerald-800 hover:bg-emerald-700 rounded-lg text-xs mb-1 text-emerald-300 transition flex items-center gap-2">
            <i class="fa-solid fa-folder"></i> ${escapeHtml(f)}
        </button>`;
        });

        document.getElementById('move-modal').classList.remove('hidden');
    }
    /**
     * `moverA(d)`
     * Mueve el archivo seleccionado a la carpeta destino utilizando el PIN Maestro.
     */
    async function moverA(d) {
        const pin = getMasterPin("PIN Maestro requerido para mover archivos del disco:");
        if (!pin) return;
        await fetch('/mover_archivo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: fileToMove, target: d, pin: pin }) }).then(async r => {
            const data = await r.json();
            if (data.error) {
                clearPinIfInvalid(data.error);
                alert(data.error);
            }
        });
        document.getElementById('move-modal').classList.add('hidden');
        cargarLib();
    }
    /**
     * `borrar(path)`
     * Elimina un archivo individual del disco tras validar el PIN Maestro.
     */
    async function borrar(path) {
        const pin = getMasterPin("Por seguridad, introduce el PIN Maestro para eliminar: " + decodeURIComponent(path));
        if (pin) {
            await fetch('/borrar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file: decodeURIComponent(path), pin: pin })
            }).then(async r => {
                const data = await r.json();
                if (data.error) {
                    clearPinIfInvalid(data.error);
                    alert(data.error);
                } else {
                    cargarLib();
                }
            });
        }
    }

// 2. Función para Auto-Completar Géneros (Magia)
/**
 * `autoCompletarGeneros()`
 * Inicia el etiquetado automático de géneros musicales consultando Last.fm / MusicBrainz.
 */
async function autoCompletarGeneros() {
    if (!confirm("Esto escaneará tus artistas en Last.fm para asignar géneros automáticamente. Puede tardar un poco. ¿Deseas continuar?")) return;

    const pin = getMasterPin("PIN Maestro requerido para ejecutar el Auto-Tagger del Servidor:");
    if (!pin) return;

    showToast("🚀 Iniciando escaneo de géneros...", "info");

    const btn = document.getElementById('btn-autotag'); // Asume que creas este botón
    if (btn) btn.disabled = true;

    try {
        const res = await fetch('/api/autotag_library', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: pin })
        });
        const data = await res.json();

        if (data.error) {
            clearPinIfInvalid(data.error);
            showToast("Error: " + data.error, "error");
            return;
        }

        if (data.ok) {
            showToast(data.msg, "success");
            // Recargar biblioteca para ver los cambios
            setTimeout(() => location.reload(), 2000);
        }
    } catch (e) {
        showToast("Error en el autotagging", "error");
        console.error(e);
    } finally {
        if (btn) btn.disabled = false;
    }
}

// 3. Función para Auto-Tag de Videos (TMDB)
/**
 * `autoCompletarVideos()`
 * Inicia el etiquetado automático de películas y series con metadatos de TMDB y extracción de subtítulos.
 */
async function autoCompletarVideos() {
    if (!confirm("Esto buscará metadata de TMDB para tus videos y descargará carátulas automáticamente. ¿Deseas continuar?")) return;

    const pin = getMasterPin("PIN Maestro requerido para ejecutar el Auto-Tagger de Videos:");
    if (!pin) return;

    // Mostrar barra de progreso
    const progressContainer = document.getElementById('rescan-progress-container');
    const progressBar = document.getElementById('rescan-progress-bar');
    const percentText = document.getElementById('rescan-percent-text');
    const stageText = document.getElementById('rescan-stage-text');
    const messageText = document.getElementById('rescan-message');
    if (progressContainer) progressContainer.classList.remove('hidden');

    showToast("🔍 Buscando en TMDB...", "info");

    const btn = document.getElementById('btn-autotag-video');
    if (btn) btn.disabled = true;

    let pollInterval = null;

    // Polling de progreso
    /**
     * `pollProgress()`
     * Consulta `/estado` periódicamente para actualizar la barra de progreso de tareas en segundo plano.
     */
    async function pollProgress() {
        try {
            const res = await fetch('/estado');
            const data = await res.json();
            const status = data.rescan_status;

            if (status && status.active && (status.stage === 'auto_tag' || status.stage === 'subtitles')) {
                const percent = status.percent || 0;
                if (progressBar) progressBar.style.width = percent + '%';
                if (percentText) percentText.textContent = percent + '%';
                if (stageText) stageText.textContent = status.stage === 'subtitles' ? 'Extrayendo Subtítulos SRT...' : 'Auto-Tag TMDB...';
                if (messageText) messageText.textContent = status.message || '';
            }
        } catch (e) {
            console.error('Error polling progress:', e);
        }
    }

    try {
        // Iniciar polling cada 500ms
        pollInterval = setInterval(pollProgress, 500);

        const res = await fetch('/api/auto_tag_library_videos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: pin })
        });
        const data = await res.json();

        // Detener polling
        if (pollInterval) clearInterval(pollInterval);

        // Consultar progreso final
        await pollProgress();

        if (data.processed !== undefined) {
            showToast(`✅ TMDB: ${data.found || 0}/${data.processed}, Posters: ${data.series_posters || 0}, Subtítulos SRT: ${data.subtitles_extracted || 0}`, "success");
            // Recargar biblioteca para ver los cambios
            setTimeout(() => cargarLib(), 2000);
        } else if (data.error) {
            clearPinIfInvalid(data.error);
            showToast("Error: " + data.error, "error");
        }
    } catch (e) {
        showToast("Error en auto-tag de videos", "error");
        console.error(e);
    } finally {
        // Detener polling si sigue activo
        if (pollInterval) clearInterval(pollInterval);

        // Ocultar barra de progreso después de un momento
        setTimeout(() => {
            if (progressContainer) progressContainer.classList.add('hidden');
        }, 3000);

        if (btn) btn.disabled = false;
    }
}
