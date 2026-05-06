import codecs
import re

with codecs.open('templates/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Player Bar Class (stick to bottom)
content = re.sub(
    r'<div id="player-bar"\s+class="fixed bottom-\[24px\] left-2 right-2 md:left-6 md:right-6 z-\[200\] hidden bg-\[#0a0a0a\]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl transition-transform duration-300 group">',
    r'<div id="player-bar"\n            class="fixed bottom-0 left-0 right-0 z-[200] hidden bg-[#0a0a0a]/90 backdrop-blur-xl border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] transition-transform duration-300 group">',
    content
)

# 2. Add Console Button to Player Bar right after chevron-down
console_btn = """<button onclick="cerrarPlayer()" class="text-zinc-600 hover:text-red-500 transition p-2"><i
                            class="fa-solid fa-chevron-down"></i></button>
                    <!-- Console Button in Player -->
                    <button onclick="toggleConsole()" title="Abrir Kraken Console" class="ml-2 w-8 h-8 flex items-center justify-center bg-emerald-900/20 border border-emerald-500/30 text-emerald-500 rounded-full hover:bg-emerald-500 hover:text-black transition-all">
                        <i class="fa-solid fa-terminal text-xs"></i>
                    </button>"""
content = re.sub(
    r'<button onclick="cerrarPlayer\(\)" class="text-zinc-600 hover:text-red-500 transition p-2"><i\s+class="fa-solid fa-chevron-down"></i></button>',
    console_btn,
    content
)

# 3. Remove old floating Console Bar
old_floating_console = r'<!-- Console Toggle Bar -->\s*<div id="console-bar".*?</div>'
content = re.sub(old_floating_console, '', content, flags=re.DOTALL)

# 4. Streamline Desktop Header
desktop_header_regex = r'<!-- ========== DESKTOP: HEADER ========== -->\s*<div id="desktop-header".*?<!-- FILA VIDEO: Pills de filtros \(Solo visible en modo video\) -->'
new_desktop_header = """<!-- ========== DESKTOP: HEADER ========== -->
            <div id="desktop-header" class="hidden md:flex sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-xl p-3 z-40 border-b border-white/5 shadow-2xl mb-4 items-center justify-between gap-4">
                
                <!-- IZQUIERDA: Menú y Logo -->
                <div class="flex items-center gap-4 shrink-0">
                    <button onclick="toggleSidebar()" class="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition flex items-center justify-center shrink-0">
                        <i class="fa-solid fa-bars text-lg"></i>
                    </button>
                    <div class="flex items-center gap-2 group cursor-pointer select-none">
                        <img src="/assets/kraken.svg" class="w-8 h-8 object-contain kraken-neon-filter group-hover:scale-110 transition-transform" alt="Kraken">
                        <h1 class="text-xl font-black tracking-[0.15em] text-metal leading-none hidden lg:flex items-center font-sans mt-1">
                            KRAK<span class="kraken-xi text-2xl relative -top-0.5">Ξ</span>N
                        </h1>
                    </div>
                </div>

                <!-- CENTRO: Título de Sección y Buscador -->
                <div class="flex-1 flex items-center gap-4 px-4 max-w-4xl mx-auto">
                    <!-- Sección Actual (Video/Audio) -->
                    <div class="flex flex-col shrink-0 min-w-[120px]">
                        <div class="text-[9px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1" id="lib-mode-label-desktop">
                            <i class="fa-solid fa-music"></i> MÚSICA
                        </div>
                        <h2 class="text-sm font-bold text-white leading-none truncate" id="lib-title-desktop">Mi Colección</h2>
                    </div>
                    
                    <div class="w-px h-8 bg-white/10 mx-2"></div>

                    <!-- Buscador -->
                    <div class="relative flex-1 group">
                        <i class="fa-solid fa-search absolute left-3 top-3 text-emerald-500/70 group-focus-within:text-emerald-400 transition-colors text-sm"></i>
                        <input type="text" id="lib-search-desktop" onkeyup="renderLib()" placeholder="Buscar en Kraken..."
                            class="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/5 rounded-full py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-500/50 text-white transition-all">
                    </div>
                </div>

                <!-- DERECHA: Controles Globales -->
                <div class="flex items-center gap-3 shrink-0">
                    <!-- Tabs Audio / Filtros Video se inyectarán dinámicamente o se manejarán en la misma fila -->
                    <div id="desktop-search-tabs" class="flex gap-2">
                        <!-- Botones de search scope (tracks, albums, etc) -->
                    </div>
                    
                    <div id="audio-view-controls" class="bg-white/5 rounded-full p-1 border border-white/10 flex items-center shrink-0 hidden lg:flex">
                        <button onclick="setView('grid')" id="view-grid" class="w-8 h-8 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition flex items-center justify-center"><i class="fa-solid fa-border-all text-xs"></i></button>
                        <button onclick="setView('list')" id="view-list" class="w-8 h-8 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition flex items-center justify-center"><i class="fa-solid fa-list text-xs"></i></button>
                    </div>

                    <div id="lib-zoom-controls" class="hidden lg:flex items-center gap-2 bg-white/5 px-3 py-2 rounded-full border border-white/10 shrink-0">
                        <i class="fa-solid fa-magnifying-glass text-[10px] text-emerald-500/70"></i>
                        <input type="range" min="0" max="2" value="0" class="w-16 accent-emerald-500" oninput="changeZoom(this.value)">
                    </div>
                </div>
            </div>

            <!-- CONTENEDORES SECUNDARIOS (Para inyecciones de JS) -->
            <div id="audio-actions-header" class="hidden"></div>
            <!-- FILA VIDEO: Pills de filtros (Solo visible en modo video) -->"""

# Warning: this regex replaces everything from DESKTOP: HEADER until <!-- FILA VIDEO.
# Wait, I must ensure I don't delete important wrappers.
# Let's inspect the original desktop header structure closely.
"""
