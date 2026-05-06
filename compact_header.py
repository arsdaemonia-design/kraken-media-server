import codecs
import re

with codecs.open('templates/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Player Bar Class (stick to bottom)
content = re.sub(
    r'<div id="player-bar"\s+class="fixed bottom-\[24px\] left-2 right-2 md:left-6 md:right-6 z-\[200\] hidden bg-\[#0a0a0a\]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl transition-transform duration-300 group">',
    r'<div id="player-bar"\n            class="fixed bottom-0 left-0 right-0 z-[200] hidden bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-emerald-900/50 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] transition-transform duration-300 group">',
    content
)

# 2. Add Console Button to Player Bar right after chevron-down
console_btn = """<button onclick="cerrarPlayer()" class="text-zinc-600 hover:text-red-500 transition p-2"><i
                            class="fa-solid fa-chevron-down"></i></button>
                    <button onclick="toggleConsole()" title="Abrir Kraken Console" class="ml-2 w-8 h-8 flex items-center justify-center bg-black border border-emerald-500/50 text-emerald-500 rounded-full hover:bg-emerald-500 hover:text-black transition-all shadow-[0_0_10px_rgba(16,185,129,0.2)]">
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
desktop_header_pattern = re.compile(r'<!-- ========== DESKTOP: HEADER ========== -->\s*<div id="desktop-header".*?</div>\s*</div>\s*</div>', re.DOTALL)
new_desktop_header = """<!-- ========== DESKTOP: HEADER ========== -->
            <div id="desktop-header" class="hidden md:flex sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-xl p-2 z-40 border-b border-emerald-900/30 shadow-2xl mb-3 flex-col gap-2">
                
                <!-- TOP ROW -->
                <div class="flex items-center justify-between">
                    <!-- LEFTSIDE: Menu, Logo, Title -->
                    <div class="flex items-center gap-3 shrink-0 min-w-[200px]">
                        <button onclick="toggleSidebar()" class="w-8 h-8 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition flex items-center justify-center shrink-0">
                            <i class="fa-solid fa-bars text-sm"></i>
                        </button>
                        <div class="flex items-center gap-2 select-none group">
                            <img src="/assets/kraken.svg" class="w-6 h-6 object-contain kraken-neon-filter group-hover:scale-110 transition-transform" alt="Kraken">
                            <h1 class="text-lg font-black tracking-[0.1em] text-metal leading-none hidden lg:flex items-center font-sans mt-1">
                                KRAK<span class="kraken-xi text-xl relative -top-0.5">Ξ</span>N
                            </h1>
                        </div>
                        <div class="w-px h-5 bg-white/10 mx-1"></div>
                        <div class="flex flex-col">
                            <div class="text-[8px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1" id="lib-mode-label-desktop">
                                <i class="fa-solid fa-music"></i> MÚSICA
                            </div>
                            <h2 class="text-sm font-bold text-white leading-none truncate" id="lib-title-desktop">Mi Colección</h2>
                        </div>
                    </div>

                    <!-- CENTER: TABS -->
                    <div class="flex-1 flex justify-center px-4">
                        <div class="flex gap-4 px-1 text-[10px] font-bold text-zinc-400 border-b border-emerald-900/50 pb-0 shrink-0">
                            <button id="tab-search-dsktp-all" onclick="setSearchScope('all')" class="pb-1 border-b-2 border-transparent hover:text-emerald-400 flex items-center gap-1 transition whitespace-nowrap"><i class="fa-solid fa-globe"></i> Todo</button>
                            <button id="tab-search-dsktp-tracks" onclick="setSearchScope('tracks')" class="pb-1 border-b-2 border-emerald-500 text-emerald-400 flex items-center gap-1 transition whitespace-nowrap"><i class="fa-solid fa-music"></i> Tracks</button>
                            <button id="tab-search-dsktp-albums" onclick="setSearchScope('albums')" class="pb-1 border-b-2 border-transparent hover:text-emerald-400 flex items-center gap-1 transition whitespace-nowrap"><i class="fa-solid fa-compact-disc"></i> Albums</button>
                            <button id="tab-search-dsktp-artists" onclick="setSearchScope('artists')" class="pb-1 border-b-2 border-transparent hover:text-emerald-400 flex items-center gap-1 transition whitespace-nowrap"><i class="fa-solid fa-user"></i> Artists</button>
                            <button id="tab-search-dsktp-playlists" onclick="setSearchScope('playlists')" class="pb-1 border-b-2 border-transparent hover:text-emerald-400 flex items-center gap-1 transition whitespace-nowrap"><i class="fa-solid fa-list"></i> Playlists</button>
                        </div>
                    </div>

                    <!-- RIGHT: ZOOM -->
                    <div class="flex items-center gap-2 shrink-0">
                        <div id="lib-zoom-controls" class="flex items-center gap-2 bg-[#18181b] px-2 py-1 rounded border border-emerald-900/50 shrink-0">
                            <i class="fa-solid fa-magnifying-glass text-[9px] text-emerald-500"></i>
                            <input type="range" min="0" max="2" value="0" class="w-12 h-1 accent-emerald-500" oninput="changeZoom(this.value)">
                        </div>
                    </div>
                </div>

                <!-- MIDDLE ROW: SEARCH + VIEW TOGGLE -->
                <div class="flex items-center gap-2 mt-1">
                    <div class="relative flex-1">
                        <i class="fa-solid fa-search absolute left-3 top-2 text-emerald-500 text-[10px]"></i>
                        <input type="text" id="lib-search-desktop" onkeyup="renderLib()" placeholder="Buscar..."
                            class="w-full bg-[#18181b] border border-emerald-900/50 rounded py-1.5 pl-8 pr-3 text-xs outline-none focus:border-emerald-500 text-white transition-all">
                    </div>
                    <div id="audio-view-controls" class="bg-[#18181b] rounded p-0.5 border border-emerald-900/50 flex items-center shrink-0">
                        <button onclick="setView('grid')" id="view-grid" class="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition"><i class="fa-solid fa-border-all text-xs"></i></button>
                        <div class="w-px h-3 bg-emerald-900/50 mx-0.5"></div>
                        <button onclick="setView('list')" id="view-list" class="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition"><i class="fa-solid fa-list text-xs"></i></button>
                    </div>
                </div>

                <!-- BOTTOM ROW: ACTIONS -->
                <div class="flex items-center justify-between mt-1">
                    <div class="flex items-center gap-2">
                        <button onclick="toggleSortMenuDesktop()" class="px-2 py-1 text-[10px] font-bold rounded bg-[#18181b] border border-emerald-900/50 text-zinc-300 hover:text-white hover:border-emerald-500 transition flex items-center gap-1 relative">
                            <i class="fa-solid fa-arrow-down-wide-short text-emerald-500"></i> Ordenar
                            <div id="sort-menu-desktop" class="hidden absolute top-full left-0 mt-1 w-40 bg-[#0a0a0a] border border-emerald-900/50 rounded shadow-xl z-50 p-1 text-[10px]">
                                <button onclick="setSortDesktop('new')" class="w-full text-left px-2 py-1.5 rounded hover:bg-white/10">⭐ Novedades</button>
                                <button onclick="setSortDesktop('top')" class="w-full text-left px-2 py-1.5 rounded hover:bg-white/10">🔥 Top</button>
                                <button onclick="setSortDesktop('recent')" class="w-full text-left px-2 py-1.5 rounded hover:bg-white/10">🕒 Recientes</button>
                                <button onclick="setSortDesktop('az')" class="w-full text-left px-2 py-1.5 rounded hover:bg-white/10">🔤 A–Z</button>
                                <button onclick="setSortDesktop('artist')" class="w-full text-left px-2 py-1.5 rounded hover:bg-white/10">🎤 Artista</button>
                            </div>
                        </button>

                        <button onclick="playContext()" class="px-2 py-1 text-[10px] font-bold rounded bg-[#18181b] border border-emerald-900/50 text-zinc-300 hover:text-white hover:border-emerald-500 transition flex items-center gap-1">
                            <i class="fa-solid fa-play text-emerald-500"></i> Play All
                        </button>
                        
                        <div id="desktop-selection-controls" class="flex items-center gap-1">
                            <button onclick="toggleSelectionMode()" id="btn-select-mode" class="px-2 py-1 text-[10px] font-bold rounded bg-[#18181b] border border-emerald-900/50 text-zinc-300 hover:text-white hover:border-emerald-500 transition flex items-center gap-1">
                                <i class="fa-regular fa-square-check text-emerald-500"></i> Select
                            </button>
                            <button onclick="selectAllVisible()" id="btn-select-all-vis" class="hidden px-2 py-1 text-[10px] font-bold rounded bg-emerald-900/20 border border-emerald-500/50 text-emerald-400 hover:text-white transition flex items-center gap-1">
                                <i class="fa-solid fa-check-double"></i> Todos
                            </button>
                        </div>
                        
                        <div id="audio-actions-header" class="hidden gap-2 shrink-0"></div>
                        <!-- FILA VIDEO: Pills de filtros (Solo visible en modo video) -->
                        <div id="video-pills-row" class="hidden flex flex-wrap items-center gap-2 pb-1"></div>
                    </div>
                </div>
            </div>"""

content = desktop_header_pattern.sub(new_desktop_header, content, count=1)


with codecs.open('templates/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
