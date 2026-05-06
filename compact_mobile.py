import codecs
import re

with codecs.open('templates/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

mobile_header_pattern = re.compile(r'<!-- ========== MÓVIL: HEADER SUPERIOR ========== -->\s*<div id="mobile-header".*?</div>\s*</div>\s*</div>', re.DOTALL)

new_mobile_header = """<!-- ========== MÓVIL: HEADER SUPERIOR ========== -->
            <div id="mobile-header" class="md:hidden sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-xl z-40 border-b border-emerald-900/30 shadow-2xl p-2 flex flex-col gap-2">
                
                <!-- FILA 1: Top Bar (Menú, Logo, Título, Vista) -->
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2 shrink-0">
                        <button onclick="toggleSidebar()" class="w-8 h-8 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 transition flex items-center justify-center shrink-0">
                            <i class="fa-solid fa-bars text-sm"></i>
                        </button>
                        <div class="flex items-center gap-1.5 select-none group">
                            <img src="/assets/kraken.svg" class="w-5 h-5 object-contain kraken-neon-filter" alt="Kraken">
                            <h1 class="text-sm font-black tracking-[0.1em] text-metal leading-none font-sans mt-0.5 hidden sm:block">
                                KRAK<span class="kraken-xi text-base relative -top-0.5">Ξ</span>N
                            </h1>
                        </div>
                    </div>
                    
                    <div class="flex flex-col items-center flex-1 mx-2 overflow-hidden">
                        <div class="text-[8px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1" id="lib-mode-label-mobile">
                            <i class="fa-solid fa-music"></i> MÚSICA
                        </div>
                        <h2 class="text-xs font-bold text-white leading-tight truncate w-full text-center" id="lib-title-mobile">Mi Colección</h2>
                    </div>

                    <div id="audio-view-controls-mobile" class="bg-[#18181b] rounded p-0.5 border border-emerald-900/50 flex items-center shrink-0">
                        <button onclick="setView('grid')" id="view-grid-mobile" class="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-white transition"><i class="fa-solid fa-border-all text-[10px]"></i></button>
                        <div class="w-px h-3 bg-emerald-900/50 mx-0.5"></div>
                        <button onclick="setView('list')" id="view-list-mobile" class="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-white transition"><i class="fa-solid fa-list text-[10px]"></i></button>
                    </div>
                </div>

                <!-- FILA 2: Buscador -->
                <div class="relative w-full">
                    <i class="fa-solid fa-search absolute left-3 top-2 text-emerald-500 text-[10px]"></i>
                    <input type="text" id="lib-search-mobile" onkeyup="renderLib()" placeholder="Buscar..."
                        class="w-full bg-[#18181b] border border-emerald-900/50 rounded py-1.5 pl-8 pr-3 text-xs outline-none focus:border-emerald-500 text-white transition-all">
                </div>

                <!-- FILA 3: Tabs Scope -->
                <div class="flex gap-4 px-1 text-[10px] font-bold text-zinc-400 border-b border-emerald-900/50 pb-0 overflow-x-auto no-scrollbar snap-x">
                    <button id="tab-search-mob-all" onclick="setSearchScope('all')" class="snap-start pb-1.5 border-b-2 border-transparent hover:text-emerald-400 flex items-center gap-1 transition whitespace-nowrap"><i class="fa-solid fa-globe"></i> Todo</button>
                    <button id="tab-search-mob-tracks" onclick="setSearchScope('tracks')" class="snap-start pb-1.5 border-b-2 border-emerald-500 text-emerald-400 flex items-center gap-1 transition whitespace-nowrap"><i class="fa-solid fa-music"></i> Tracks</button>
                    <button id="tab-search-mob-albums" onclick="setSearchScope('albums')" class="snap-start pb-1.5 border-b-2 border-transparent hover:text-emerald-400 flex items-center gap-1 transition whitespace-nowrap"><i class="fa-solid fa-compact-disc"></i> Albums</button>
                    <button id="tab-search-mob-artists" onclick="setSearchScope('artists')" class="snap-start pb-1.5 border-b-2 border-transparent hover:text-emerald-400 flex items-center gap-1 transition whitespace-nowrap"><i class="fa-solid fa-user"></i> Artists</button>
                    <button id="tab-search-mob-playlists" onclick="setSearchScope('playlists')" class="snap-start pb-1.5 border-b-2 border-transparent hover:text-emerald-400 flex items-center gap-1 transition whitespace-nowrap"><i class="fa-solid fa-list"></i> Playlists</button>
                </div>

                <!-- FILA 4: Controles (Ordenar, Play, Select) -->
                <div id="mobile-controls-row" class="flex items-center justify-between gap-2 relative">
                    <button onclick="toggleSortMenuMobile()" class="px-2 py-1.5 text-[10px] font-bold rounded bg-[#18181b] border border-emerald-900/50 text-zinc-300 flex items-center gap-1 shrink-0">
                        <i class="fa-solid fa-arrow-down-wide-short text-emerald-500"></i> Ordenar
                    </button>
                    
                    <div id="sort-menu-mobile" class="hidden absolute top-full left-0 mt-1 w-40 bg-[#0a0a0a] border border-emerald-900/50 rounded shadow-xl z-50 p-1 text-[10px]">
                        <button onclick="setSortMobile('new')" class="w-full text-left px-2 py-1.5 rounded hover:bg-white/10">⭐ Novedades</button>
                        <button onclick="setSortMobile('top')" class="w-full text-left px-2 py-1.5 rounded hover:bg-white/10">🔥 Top</button>
                        <button onclick="setSortMobile('recent')" class="w-full text-left px-2 py-1.5 rounded hover:bg-white/10">🕒 Recientes</button>
                        <button onclick="setSortMobile('az')" class="w-full text-left px-2 py-1.5 rounded hover:bg-white/10">🔤 A–Z</button>
                        <button onclick="setSortMobile('artist')" class="w-full text-left px-2 py-1.5 rounded hover:bg-white/10">🎤 Artista</button>
                    </div>

                    <div class="flex-1"></div>

                    <button onclick="playContext()" class="px-3 py-1.5 text-[10px] font-bold rounded bg-emerald-600 text-white flex items-center gap-1 shrink-0">
                        <i class="fa-solid fa-play"></i> Play
                    </button>
                    
                    <button onclick="toggleSelectionMode()" id="btn-select-mode-mobile" class="px-2 py-1.5 text-[10px] font-bold rounded bg-[#18181b] border border-emerald-900/50 text-emerald-400 flex items-center gap-1 shrink-0">
                        <i class="fa-regular fa-square-check"></i> Sel
                    </button>
                    
                    <button onclick="selectAllVisible()" id="btn-select-all-vis-mobile" class="hidden px-2 py-1.5 text-[10px] font-bold rounded bg-emerald-900/20 border border-emerald-500/50 text-emerald-400 flex items-center gap-1 shrink-0">
                        <i class="fa-solid fa-check-double"></i> Todos
                    </button>
                </div>
                
                <!-- FILA VIDEO MOBILE: Pills de filtros -->
                <div id="video-pills-row-mobile" class="hidden flex-wrap items-center gap-1.5 pt-1"></div>
            </div>"""

content = mobile_header_pattern.sub(new_mobile_header, content, count=1)

with codecs.open('templates/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
