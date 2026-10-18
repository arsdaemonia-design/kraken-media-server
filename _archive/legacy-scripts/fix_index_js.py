import re

with open("templates/index.html", "r", encoding="utf-8") as f:
    content = f.read()

target = """                        document.body.insertAdjacentHTML('beforeend', html);
                        loadAdminUsers();
                    });
            }"""

replacement = """                        document.body.insertAdjacentHTML('beforeend', html);
                        loadAdminUsers();
                        
                        // Adult Door event listener
                        const pathInput = document.getElementById('settings-secret-word');
                        if (pathInput) {
                            pathInput.addEventListener('input', async function() {
                                if (this.value.trim().toLowerCase() === 'adult') {
                                    this.value = '';
                                    document.getElementById('tab-adult').classList.remove('hidden');
                                    showSettingsTab('adult');
                                    
                                    const commonRatings = ['G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA', '18+', 'MA15+', 'M', '16'];
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
                    });
            }

            async function applyAdultRatings() {
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
            }"""

content = content.replace(target, replacement)

with open("templates/index.html", "w", encoding="utf-8") as f:
    f.write(content)
print("Adult JS injected.")
