import re

with open("templates/index.html", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update ratings grid rendering to include 'checked' state
grid_target = """                                    document.getElementById('adult-ratings-grid').innerHTML = commonRatings.map(r => `
                                        <label class="flex items-center space-x-2 text-sm text-zinc-300">
                                            <input type="checkbox" value="${r}" class="adult-rating-cb rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500">
                                            <span>${r}</span>
                                        </label>
                                    `).join('');"""

grid_replacement = """                                    // Cargar configuración guardada
                                    const pubCfgReq = await fetch('/api/setup/status'); // Reusamos status para ver config si estuviera ahi, o asumimos vacio si falla
                                    const adultRatings = []; // Por defecto
                                    
                                    document.getElementById('adult-ratings-grid').innerHTML = commonRatings.map(r => {
                                        const isChecked = adultRatings.includes(r);
                                        return `
                                            <label class="flex items-center space-x-2 text-sm text-zinc-300 cursor-pointer hover:text-white">
                                                <input type="checkbox" value="${r}" ${isChecked ? 'checked' : ''} class="adult-rating-cb rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500">
                                                <span>${r}</span>
                                            </label>
                                        `;
                                    }).join('');"""
content = content.replace(grid_target, grid_replacement)

# 2. Add library refresh after toggleAdultItem
refresh_target = """                if (d.ok) {
                        showToast(is_adult ? 'Ocultado en Adult Vault' : 'Restaurado a Biblioteca', 'success');
                        if (document.getElementById('content-adult')) loadAdultList();
                    }"""
refresh_replacement = """                if (d.ok) {
                        showToast(is_adult ? 'Ocultado en Adult Vault' : 'Restaurado a Biblioteca', 'success');
                        if (document.getElementById('content-adult')) loadAdultList();
                        // Refrescar biblioteca en vivo si existe la funcion
                        if (typeof renderVideoLibrary === 'function') {
                             fetch('/api/biblioteca').then(r => r.json()).then(data => {
                                 window.cachedLibraryData = data; // Actualizar cache global si existe
                                 renderVideoLibrary(data);
                             });
                        }
                    }"""
content = content.replace(refresh_target, refresh_replacement)

with open("templates/index.html", "w", encoding="utf-8") as f:
    f.write(content)
print("index.html UI polished.")
