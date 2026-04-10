import pathlib
import sys

# 1. Update index.html
p_html = pathlib.Path('templates/index.html')
text_html = p_html.read_text(encoding='utf-8')

# A: Fix `abrirEditorMasivo` to handle virtual folders and video metadata
fragment_abrir_old = '''// --- MODO SINGLE ---
                if (paths.length === 1) {
                    const f = libData.files.find(x => x.path === paths[0]);
                    if (!f) return;

                    // Detectar si es video
                    const isVideo = f.path.endsWith('.mkv') || f.path.endsWith('.mp4') || f.path.endsWith('.avi') || f.path.endsWith('.mov') || f.path.endsWith('.webm');
                    
                    title.innerText = isVideo ? "Editar Video" : "Editar Canción";

                    let fieldsHtml = `
            <input type="hidden" id="edit-mode" value="single">
            <input type="hidden" id="edit-path" value="${f.path}">`;'''

fragment_abrir_new = '''// --- MODO SINGLE ---
                if (paths.length === 1) {
                    const reqPath = paths[0];
                    // Also support virtual folders by checking startsWith
                    let f = libData.files.find(x => x.path === reqPath);
                    const isVirtualFolder = !f && libData.files.some(x => x.path.startsWith(reqPath + '/'));
                    if (!f && isVirtualFolder) f = libData.files.find(x => x.path.startsWith(reqPath + '/'));
                    
                    if (!f) return;

                    // Detectar si es video (o carpeta virtual de video)
                    const isVideo = isVirtualFolder || f.path.endsWith('.mkv') || f.path.endsWith('.mp4') || f.path.endsWith('.avi') || f.path.endsWith('.mov') || f.path.endsWith('.webm');
                    
                    title.innerText = isVideo ? (isVirtualFolder ? "Editar Serie/Carpeta" : "Editar Video") : "Editar Canción";

                    let fieldsHtml = `
            <input type="hidden" id="edit-mode" value="single">
            <input type="hidden" id="edit-path" value="${reqPath}">
            <input type="hidden" id="edit-is-virtual" value="${isVirtualFolder ? 'true' : 'false'}">`;'''

if fragment_abrir_old not in text_html:
    print("Error: fragment_abrir_old not found")
    sys.exit(1)
text_html = text_html.replace(fragment_abrir_old, fragment_abrir_new)

# B: Add Video fields inside the `if(!isVideo)` block logic
fragment_fields_old = '''            <hr class="border-white/10">`;
                    }

                    fieldsHtml += `
            <div>
                <label class="text-[10px] text-emerald-500 font-bold uppercase">Carátula (URL)</label>
                <input type="text" id="edit-cover" placeholder="http://..."
                       class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
            </div>`;'''

fragment_fields_new = '''            <hr class="border-white/10">`;
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
                        <option value="G" ${f.tmdb_rating=='G'?'selected':''}>G</option>
                        <option value="PG" ${f.tmdb_rating=='PG'?'selected':''}>PG</option>
                        <option value="PG-13" ${f.tmdb_rating=='PG-13'?'selected':''}>PG-13</option>
                        <option value="B-15" ${f.tmdb_rating=='B-15'?'selected':''}>B-15</option>
                        <option value="R" ${f.tmdb_rating=='R'?'selected':''}>R</option>
                        <option value="M" ${f.tmdb_rating=='M'?'selected':''}>M</option>
                        <option value="16" ${f.tmdb_rating=='16'?'selected':''}>16</option>
                        <option value="18" ${f.tmdb_rating=='18'?'selected':''}>18</option>
                        <option value="R18+" ${f.tmdb_rating=='R18+'?'selected':''}>R18+</option>
                        <option value="NC-17" ${f.tmdb_rating=='NC-17'?'selected':''}>NC-17</option>
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
            <hr class="border-white/10 my-2">`;
                    }

                    fieldsHtml += `
            <div>
                <label class="text-[10px] text-emerald-500 font-bold uppercase">Póster / Carátula (URL opcional)</label>
                <input type="text" id="edit-cover" placeholder="http://... (Reemplaza imagen actual)"
                       class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
            </div>`;'''

if fragment_fields_old not in text_html:
    print("Error: fragment_fields_old not found")
    sys.exit(1)
text_html = text_html.replace(fragment_fields_old, fragment_fields_new)


# C: Update guardarCambiosEdicion to send Video data
fragment_save_old = '''                // Para videos, NUNCA llamar a update_tags (lo corrompe). Solo update_cover
                const isVideo = paths[0] && (paths[0].endsWith('.mkv') || paths[0].endsWith('.mp4') || paths[0].endsWith('.avi') || paths[0].endsWith('.mov') || paths[0].endsWith('.webm'));
                if (!isVideo && Object.keys(dataTags).length > 1) {
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
                }'''

fragment_save_new = '''                const isVirtualFolder = document.getElementById('edit-is-virtual')?.value === 'true';
                const isVideo = isVirtualFolder || (paths[0] && (paths[0].endsWith('.mkv') || paths[0].endsWith('.mp4') || paths[0].endsWith('.avi') || paths[0].endsWith('.mov') || paths[0].endsWith('.webm')));
                
                if (isVideo && mode === 'single') {
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
                    };
                    const r = await fetch('/api/library/update_video_meta', {
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
                }'''

if fragment_save_old not in text_html:
    print("Error: fragment_save_old not found")
    sys.exit(1)
text_html = text_html.replace(fragment_save_old, fragment_save_new)

p_html.write_text(text_html, encoding='utf-8')


# 2. Add Endpoint `/api/library/update_video_meta` to routes/api.py
p_api = pathlib.Path('routes/api.py')
text_api = p_api.read_text(encoding='utf-8')

endpoint_str = '''@api_bp.route('/library/update_video_meta', methods=['POST'])
def update_video_meta():
    data = request.json
    pin = data.get('pin', '')
    path = data.get('path')
    is_virtual = data.get('is_virtual', False)
    
    if not get_master_pin() or pin != get_master_pin():
        return jsonify({'error': 'PIN incorrecto'}), 401
        
    if not path:
        return jsonify({'error': 'Falta path'}), 400
        
    from services.database import get_db
    conn = get_db()
    c = conn.cursor()
    
    tmdb_title = data.get('tmdb_title', '')
    tmdb_rating = data.get('tmdb_rating', '')
    tmdb_year = data.get('tmdb_year', '')
    tmdb_genres = data.get('tmdb_genres', '')
    tmdb_overview = data.get('tmdb_overview', '')
    
    try:
        if is_virtual:
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
            """, (tmdb_title, tmdb_rating, tmdb_year, tmdb_genres, tmdb_overview, path))
            
        conn.commit()
        
        # Limpiar cache
        global BIB_CACHE_BY_OWNER
        BIB_CACHE_BY_OWNER.clear()
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
'''

if 'def update_video_meta' not in text_api:
    # Insert it before the end / right before the last route or just near update_tags.
    # Actually, we can append it at the end of the `api_bp` endpoints block or right before `def api_info():`
    if 'def handle_library_post():' in text_api:
        text_api = text_api.replace('def handle_library_post():', endpoint_str + '\n\n' + 'def handle_library_post():')
    else:
        text_api += '\n\n' + endpoint_str
    p_api.write_text(text_api, encoding='utf-8')

print("All modifications applied successfully.")
