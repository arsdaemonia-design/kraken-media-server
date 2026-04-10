import pathlib
p = pathlib.Path('templates/index.html')
text = p.read_text(encoding='utf-8')

old_batch_block = '''                // --- MODO BATCH ---
                else {
                    title.innerText = `Editar ${paths.length} archivos`;

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
                }'''

new_batch_block = '''                // --- MODO BATCH ---
                else {
                    title.innerText = `Editar ${paths.length} archivos`;
                    
                    let fBatch = libData.files.find(x => x.path === paths[0]);
                    let isVideoBatch = (fBatch && (fBatch.path.endsWith('.mkv') || fBatch.path.endsWith('.mp4') || fBatch.path.endsWith('.avi')));

                    if(isVideoBatch) {
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
                }'''

if old_batch_block in text:
    text = text.replace(old_batch_block, new_batch_block)
    print("Replaced chunk 1")

old_save_video = '''                if (isVideo && mode === 'single') {
                    // Update Video TMDB Meta
                    const videoTags = {
                        path: paths[0],
                        is_virtual: isVirtualFolder,
                        tmdb_title: document.getElementById('edit-tmdb-title')?.value || "",
                        tmdb_rating: document.getElementById('edit-tmdb-rating')?.value || "",
                        tmdb_year: document.getElementById('edit-tmdb-year')?.value || "",
                        tmdb_genres: document.getElementById('edit-tmdb-genres')?.value || "",
                        tmdb_overview: document.getElementById('edit-tmdb-overview')?.value || "",
                        pin: pin
                    };'''

new_save_video = '''                if (mode === 'batch-video' || (isVideo && mode === 'single')) {
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
                    };'''

if old_save_video in text:
    text = text.replace(old_save_video, new_save_video)
    print("Replaced chunk 2")
    
p.write_text(text, encoding='utf-8')


p_api = pathlib.Path('routes/api.py')
text_api = p_api.read_text(encoding='utf-8')

# Handle paths_array in python
old_api_chunk = '''    if is_virtual:
            # Actualiza todos los hijos
            c.execute("""
                UPDATE media SET 
                tmdb_title = ?, 
                tmdb_rating = ?, 
                tmdb_year = ?, 
                tmdb_genres = ?, 
                tmdb_overview = ?
                WHERE rel_path LIKE ?
            """, (tmdb_title, tmdb_rating, tmdb_year, tmdb_genres, tmdb_overview, f"{path}/%"))
        else:
            # Archivo unico
            c.execute("""
                UPDATE media SET 
                tmdb_title = ?, 
                tmdb_rating = ?, 
                tmdb_year = ?, 
                tmdb_genres = ?, 
                tmdb_overview = ?
                WHERE rel_path = ?
            """, (tmdb_title, tmdb_rating, tmdb_year, tmdb_genres, tmdb_overview, path))'''

new_api_chunk = '''    paths_array = data.get('paths_array', [])
    
    if tmdb_rating == 'VACIO':
        tmdb_rating = None

    if paths_array and len(paths_array) > 0:
        # Modo BATCH Video
        for p in paths_array:
            fields_to_set = []
            values = []
            if tmdb_title:
                fields_to_set.append("tmdb_title = ?")
                values.append(tmdb_title)
            if tmdb_rating is not None or data.get('tmdb_rating') == 'VACIO':
                fields_to_set.append("tmdb_rating = ?")
                values.append(tmdb_rating)
            if tmdb_year:
                fields_to_set.append("tmdb_year = ?")
                values.append(tmdb_year)
            if tmdb_genres:
                fields_to_set.append("tmdb_genres = ?")
                values.append(tmdb_genres)
            if tmdb_overview:
                fields_to_set.append("tmdb_overview = ?")
                values.append(tmdb_overview)
                
            if fields_to_set:
                values.append(p)
                query = f"UPDATE media SET {', '.join(fields_to_set)} WHERE rel_path = ?"
                c.execute(query, tuple(values))
    elif is_virtual:
        # Actualiza todos los hijos (Single Click on Series)
        c.execute("""
            UPDATE media SET 
            tmdb_title = ?, 
            tmdb_rating = ?, 
            tmdb_year = ?, 
            tmdb_genres = ?, 
            tmdb_overview = ?
            WHERE rel_path LIKE ?
        """, (tmdb_title, tmdb_rating, tmdb_year, tmdb_genres, tmdb_overview, f"{path}/%"))
    elif path:
        # Archivo unico
        c.execute("""
            UPDATE media SET 
            tmdb_title = ?, 
            tmdb_rating = ?, 
            tmdb_year = ?, 
            tmdb_genres = ?, 
            tmdb_overview = ?
            WHERE rel_path = ?
        """, (tmdb_title, tmdb_rating, tmdb_year, tmdb_genres, tmdb_overview, path))'''

if old_api_chunk in text_api:
    text_api = text_api.replace(old_api_chunk, new_api_chunk)
    p_api.write_text(text_api, encoding='utf-8')
    print("Replaced API chunk")
