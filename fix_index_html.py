import re

with open("templates/index.html", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add tab button
btn_target = """<button onclick="showSettingsTab('invites')" id="tab-invites" class="px-4 py-2 rounded-lg bg-zinc-700 text-zinc-300 hover:bg-zinc-600">Invitaciones</button>"""
btn_replacement = """<button onclick="showSettingsTab('invites')" id="tab-invites" class="px-4 py-2 rounded-lg bg-zinc-700 text-zinc-300 hover:bg-zinc-600">Invitaciones</button>
                                        <button onclick="showSettingsTab('adult')" id="tab-adult" class="hidden px-4 py-2 rounded-lg bg-zinc-700 text-zinc-300 hover:bg-zinc-600">🔞 Adult</button>"""
content = content.replace(btn_target, btn_replacement)

# 2. Add tab content
content_target = """                                <div id="content-invites" class="hidden">
                                    <div class="mb-4">
                                        <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Duración del Código</label>"""
content_replacement = """                                <div id="content-adult" class="hidden">
                                    <h3 class="text-white font-bold mb-2">Configuración de Contenido Adulto</h3>
                                    <p class="text-xs text-zinc-400 mb-4">Los videos con estas clasificaciones se ocultarán automáticamente de la biblioteca y solo serán visibles para ti en la categoría "🔞 Adult" cuando uses el PIN.</p>
                                    
                                    <div class="grid grid-cols-4 gap-2 mb-4" id="adult-ratings-grid">
                                        <!-- Checkboxes will be rendered here -->
                                    </div>
                                    <button onclick="applyAdultRatings()" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-xl transition">Guardar y Aplicar Filtros Automáticos</button>
                                    
                                    <h3 class="text-white font-bold mt-8 mb-2">Contenido Oculto Manualmente</h3>
                                    <div id="adult-items-list" class="space-y-2 max-h-48 overflow-y-auto"></div>
                                </div>
                                
                                <div id="content-invites" class="hidden">
                                    <div class="mb-4">
                                        <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Duración del Código</label>"""
content = content.replace(content_target, content_replacement)

# 3. Update showSettingsTab
tab_target = """                document.getElementById('content-users').classList.add('hidden');
                document.getElementById('content-invites').classList.add('hidden');
                document.getElementById('tab-general').classList.remove('bg-emerald-600', 'text-white');"""
tab_replacement = """                document.getElementById('content-users').classList.add('hidden');
                document.getElementById('content-invites').classList.add('hidden');
                const contentAdult = document.getElementById('content-adult');
                if(contentAdult) contentAdult.classList.add('hidden');
                document.getElementById('tab-general').classList.remove('bg-emerald-600', 'text-white');"""
content = content.replace(tab_target, tab_replacement)

tab2_target = """                document.getElementById('tab-invites').classList.remove('bg-emerald-600', 'text-white');
                document.getElementById('tab-invites').classList.add('bg-zinc-700', 'text-zinc-300');
                document.getElementById('content-' + tab).classList.remove('hidden');"""
tab2_replacement = """                document.getElementById('tab-invites').classList.remove('bg-emerald-600', 'text-white');
                document.getElementById('tab-invites').classList.add('bg-zinc-700', 'text-zinc-300');
                const tabAdult = document.getElementById('tab-adult');
                if(tabAdult) {
                    tabAdult.classList.remove('bg-emerald-600', 'text-white');
                    tabAdult.classList.add('bg-zinc-700', 'text-zinc-300');
                }
                document.getElementById('content-' + tab).classList.remove('hidden');"""
content = content.replace(tab2_target, tab2_replacement)

# 4. Inject script logic for the adult tab
script_target = """        function showAdminPanel(pin) {
            fetch('/api/setup/status')"""
script_replacement = """        async function applyAdultRatings() {
            const checkboxes = document.querySelectorAll('.adult-rating-cb:checked');
            const ratings = Array.from(checkboxes).map(cb => cb.value);
            try {
                const r = await fetch('/api/admin/adult/apply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ratings })
                });
                const d = await r.json();
                if (d.ok) showToast('Filtros aplicados. ' + d.updated + ' actualizados.', 'success');
                else showToast(d.error || 'Error', 'error');
            } catch (e) { showToast('Error', 'error'); }
        }

        async function loadAdultList() {
            try {
                const r = await fetch('/api/admin/adult/list');
                const d = await r.json();
                if (d.items) {
                    const list = document.getElementById('adult-items-list');
                    if(list) {
                        list.innerHTML = d.items.map(i => `
                            <div class="flex justify-between items-center bg-white/5 p-2 rounded">
                                <div class="truncate text-sm text-zinc-300 w-3/4">${i.title} <span class="text-xs text-zinc-500">(${i.tmdb_rating||'Sin rating'})</span></div>
                                <button onclick="toggleAdultItem('${i.rel_path}', false)" class="text-xs bg-emerald-600 px-2 py-1 rounded">Restaurar</button>
                            </div>
                        `).join('');
                    }
                }
            } catch (e) {}
        }
        
        async function toggleAdultItem(path, is_adult) {
            try {
                const r = await fetch('/api/admin/adult/item', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path, is_adult })
                });
                const d = await r.json();
                if (d.ok) {
                    showToast(is_adult ? 'Ocultado en Adult Vault' : 'Restaurado a Biblioteca', 'success');
                    if (document.getElementById('content-adult')) loadAdultList();
                }
            } catch (e) {}
        }

        function showAdminPanel(pin) {
            fetch('/api/setup/status')"""
content = content.replace(script_target, script_replacement)

# 5. Inject the path input trigger inside the fetch promise of showAdminPanel
trigger_target = """                    document.body.insertAdjacentHTML('beforeend', html);
                    
                    loadUsersList();
                    
                    // Manejar escapes"""
trigger_replacement = """                    document.body.insertAdjacentHTML('beforeend', html);
                    
                    loadUsersList();
                    
                    // Adult Door
                    const pathInput = document.getElementById('settings-media-path');
                    if (pathInput) {
                        pathInput.addEventListener('input', async function() {
                            if (this.value.trim().toLowerCase() === 'adult') {
                                this.value = '';
                                document.getElementById('tab-adult').classList.remove('hidden');
                                showSettingsTab('adult');
                                
                                // Fetch and render ratings
                                const commonRatings = ['G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA', '18+', 'MA15+', 'M', '16'];
                                const confReq = await fetch('/api/config/public');
                                let savedRatings = [];
                                // For now we don't have ADULT_RATINGS in public config, we just assume empty or check server if possible.
                                // It's fine to just render common ones empty for now.
                                
                                document.getElementById('adult-ratings-grid').innerHTML = commonRatings.map(r => `
                                    <label class="flex items-center space-x-2 text-sm text-zinc-300">
                                        <input type="checkbox" value="${r}" class="adult-rating-cb rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500">
                                        <span>${r}</span>
                                    </label>
                                `).join('');
                                
                                loadAdultList();
                            }
                        });
                    }
                    
                    // Manejar escapes"""
content = content.replace(trigger_target, trigger_replacement)

with open("templates/index.html", "w", encoding="utf-8") as f:
    f.write(content)
print("index.html updated successfully!")
