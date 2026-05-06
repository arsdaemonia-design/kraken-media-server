import re

with open("templates/index.html", "r", encoding="utf-8") as f:
    content = f.read()

# Add the new input
target_html = """                                            <div>
                                                <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Nuevo PIN Maquin</label>
                                                <input type="password" id="settings-new-pin" placeholder="Mínimo 4 dígitos" minlength="4"
                                                       class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition">
                                            </div>"""
replacement_html = """                                            <div>
                                                <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Nuevo PIN Maquin</label>
                                                <input type="password" id="settings-new-pin" placeholder="Mínimo 4 dígitos" minlength="4"
                                                       class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition">
                                            </div>
                                            
                                            <div>
                                                <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Código Especial</label>
                                                <input type="password" id="settings-secret-word" placeholder="*****"
                                                       class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition">
                                            </div>"""
content = content.replace(target_html, replacement_html)

# Change the event listener target
target_js = """                    // Adult Door
                    const pathInput = document.getElementById('settings-media-path');
                    if (pathInput) {
                        pathInput.addEventListener('input', async function() {"""
replacement_js = """                    // Adult Door
                    const pathInput = document.getElementById('settings-secret-word');
                    if (pathInput) {
                        pathInput.addEventListener('input', async function() {"""
content = content.replace(target_js, replacement_js)

with open("templates/index.html", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated index.html to use settings-secret-word instead of settings-media-path")
