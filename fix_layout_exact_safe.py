import codecs

with codecs.open('templates/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Desktop Dropdown
old_desktop_action = """                    <div id="desktop-actions-row" class="flex items-center gap-2 relative">
                        <button onclick="toggleSortMenuDesktop()" class="filter-chip shrink-0 flex items-center gap-1">
                            <i class="fa-solid fa-arrow-down-wide-short"></i> Ordenar
                        </button>"""
new_desktop_action = """                    <div id="desktop-actions-row" class="flex items-center gap-2 relative">
                        <div class="relative inline-block">
                            <button onclick="toggleSortMenuDesktop()" class="filter-chip shrink-0 flex items-center gap-1">
                                <i class="fa-solid fa-arrow-down-wide-short"></i> Ordenar
                            </button>"""
content = content.replace(old_desktop_action, new_desktop_action)

old_desktop_sort = """                        <div id="sort-menu-desktop"
                            class="hidden absolute top-full left-0 mt-2 w-56 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl z-50 p-2 text-xs">
                            <button onclick="setSortDesktop('new')"
                                class="w-full text-left px-3 py-2 rounded hover:bg-white/10">⭐ Novedades</button>
                            <button onclick="setSortDesktop('top')"
                                class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🔥 Top</button>
                            <button onclick="setSortDesktop('recent')"
                                class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🕒 Recientes</button>
                            <button onclick="setSortDesktop('az')"
                                class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🔤 A–Z</button>
                            <button onclick="setSortDesktop('artist')"
                                class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🎤 Artista</button>
                        </div>
                    </div>"""
new_desktop_sort = """                        <div id="sort-menu-desktop"
                            class="hidden absolute top-full left-0 mt-2 w-56 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl z-50 p-2 text-xs">
                            <button onclick="setSortDesktop('new')"
                                class="w-full text-left px-3 py-2 rounded hover:bg-white/10">⭐ Novedades</button>
                            <button onclick="setSortDesktop('top')"
                                class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🔥 Top</button>
                            <button onclick="setSortDesktop('recent')"
                                class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🕒 Recientes</button>
                            <button onclick="setSortDesktop('az')"
                                class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🔤 A–Z</button>
                            <button onclick="setSortDesktop('artist')"
                                class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🎤 Artista</button>
                        </div>
                        </div>
                    </div>"""
content = content.replace(old_desktop_sort, new_desktop_sort)

# 2. Mobile Dropdown
old_mobile_action = """                    <div id="mobile-controls-row" class="px-3 pb-2 flex gap-2 items-center relative">
                        <button onclick="toggleSortMenuMobile()"
                            class="filter-chip shrink-0 text-[9px] flex items-center gap-1">
                            <i class="fa-solid fa-arrow-down-wide-short"></i> Ordenar
                        </button>"""
new_mobile_action = """                    <div id="mobile-controls-row" class="px-3 pb-2 flex gap-2 items-center relative">
                        <div class="relative inline-block">
                            <button onclick="toggleSortMenuMobile()"
                                class="filter-chip shrink-0 text-[9px] flex items-center gap-1">
                                <i class="fa-solid fa-arrow-down-wide-short"></i> Ordenar
                            </button>"""
content = content.replace(old_mobile_action, new_mobile_action)

old_mobile_sort = """                        <div id="sort-menu-mobile"
                            class="hidden absolute top-full left-0 mt-2 w-56 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl z-50 p-2 text-xs">
                            <button onclick="setSortMobile('new')"
                                class="w-full text-left px-3 py-2 rounded hover:bg-white/10">⭐ Novedades</button>
                            <button onclick="setSortMobile('top')"
                                class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🔥 Top</button>
                            <button onclick="setSortMobile('recent')"
                                class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🕒 Recientes</button>
                            <button onclick="setSortMobile('az')"
                                class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🔤 A–Z</button>
                            <button onclick="setSortMobile('artist')"
                                class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🎤 Artista</button>
                        </div>
                    </div>"""
new_mobile_sort = """                        <div id="sort-menu-mobile"
                            class="hidden absolute top-full left-0 mt-2 w-56 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl z-50 p-2 text-xs">
                            <button onclick="setSortMobile('new')"
                                class="w-full text-left px-3 py-2 rounded hover:bg-white/10">⭐ Novedades</button>
                            <button onclick="setSortMobile('top')"
                                class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🔥 Top</button>
                            <button onclick="setSortMobile('recent')"
                                class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🕒 Recientes</button>
                            <button onclick="setSortMobile('az')"
                                class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🔤 A–Z</button>
                            <button onclick="setSortMobile('artist')"
                                class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🎤 Artista</button>
                        </div>
                        </div>
                    </div>"""
content = content.replace(old_mobile_sort, new_mobile_sort)

# 3. Sidebar Grid/List + WiFi
old_sidebar_top = """                    <div class="flex border-b border-white/5 shrink-0">
                        <div onclick="setLibraryMode('audio')" id="tab-audio" class="mode-btn active"><i
                                class="fa-solid fa-music text-lg block mb-1"></i>MÚSICA</div>
                        <div onclick="setLibraryMode('video')" id="tab-video" class="mode-btn"><i
                                class="fa-solid fa-film text-lg block mb-1"></i>VIDEO</div>
                    </div>"""
new_sidebar_top = """                    <!-- SIDEBAR CONFIG ROW -->
                    <div class="flex items-center justify-between p-3 border-b border-white/5 bg-black/40 shrink-0">
                        <!-- Wi-Fi Toggle -->
                        <div class="flex items-center gap-2" title="Modo No Gastar Datos (Offline)">
                            <i class="fa-solid fa-wifi text-[10px] text-emerald-500/70"></i>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="toggle-data-saver" class="sr-only peer" checked>
                                <div class="w-8 h-4 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                        </div>
                        <!-- Grid/List Toggle -->
                        <div class="bg-[#18181b] rounded flex items-center p-0.5 border border-white/5">
                            <button onclick="setView('grid')" class="w-6 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition"><i class="fa-solid fa-border-all text-[10px]"></i></button>
                            <div class="w-px h-3 bg-white/10 mx-0.5"></div>
                            <button onclick="setView('list')" class="w-6 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition"><i class="fa-solid fa-list text-[10px]"></i></button>
                        </div>
                    </div>
                    <div class="flex border-b border-white/5 shrink-0">
                        <div onclick="setLibraryMode('audio')" id="tab-audio" class="mode-btn active"><i
                                class="fa-solid fa-music text-lg block mb-1"></i>MÚSICA</div>
                        <div onclick="setLibraryMode('video')" id="tab-video" class="mode-btn"><i
                                class="fa-solid fa-film text-lg block mb-1"></i>VIDEO</div>
                    </div>"""
content = content.replace(old_sidebar_top, new_sidebar_top)

# 4. Remove Desktop Grid/List and Mobile Grid/List
old_desktop_views = """                            <!-- Controles de Vista Audio (Grid/List) -->
                            <div id="audio-view-controls" class="bg-[#18181b] rounded-lg p-1 border border-emerald-700 flex items-center shrink-0">
                                <button onclick="setView('grid')" id="view-grid" class="btn-view"><i class="fa-solid fa-border-all text-sm"></i></button>
                                <div class="w-px h-4 bg-emerald-600 mx-1"></div>
                                <button onclick="setView('list')" id="view-list" class="btn-view"><i class="fa-solid fa-list text-sm"></i></button>
                            </div>"""
content = content.replace(old_desktop_views, """                            <!-- Botones Select/Todos (Movidos aquí para que no estorben en video) -->
                            <div id="audio-actions-header" class="hidden gap-2 shrink-0"></div>""")
# Note: we need to replace it precisely. Let's just remove the exact string.
content = content.replace(old_desktop_views, "")

old_mobile_views = """                        <div class="flex-1"></div>

                        <button onclick="setView('grid')" id="view-grid-mobile" class="btn-view shrink-0" title="Grid">
                            <i class="fa-solid fa-border-all text-xs"></i>
                        </button>
                        <button onclick="setView('list')" id="view-list-mobile" class="btn-view shrink-0" title="List">
                            <i class="fa-solid fa-list text-xs"></i>
                        </button>"""
content = content.replace(old_mobile_views, """                        <div class="flex-1"></div>""")

# 5. Global Top Bar
old_main_content = """        <div id="main-content" class="flex-1 flex flex-col min-w-0 bg-[#050505] overflow-hidden relative">"""
new_main_content = """        <div id="main-content" class="flex-1 flex flex-col min-w-0 bg-[#050505] overflow-hidden relative">
            <!-- GLOBAL PERSISTENT TOP BAR -->
            <div class="w-full bg-[#020202] border-b border-emerald-900/30 flex items-center justify-between px-4 py-2 z-50 sticky top-0 shadow-lg shrink-0">
                <div class="flex items-center gap-3">
                    <button onclick="toggleSidebar()" class="md:hidden w-7 h-7 rounded bg-white/5 hover:bg-white/10 text-zinc-300 transition flex items-center justify-center shrink-0">
                        <i class="fa-solid fa-bars text-xs"></i>
                    </button>
                    <div class="flex items-center gap-2 select-none group">
                        <img src="/assets/kraken.svg" class="w-5 h-5 object-contain kraken-neon-filter group-hover:scale-110 transition-transform" alt="Kraken">
                        <h1 class="text-sm font-black tracking-[0.2em] text-metal leading-none font-sans mt-0.5">
                            KRAK<span class="kraken-xi text-base relative -top-0.5">Ξ</span>N
                        </h1>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <div class="text-[9px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1 bg-emerald-900/20 px-2 py-1 rounded border border-emerald-500/30">
                        <i class="fa-solid fa-server"></i> ONLINE
                    </div>
                </div>
            </div>"""
content = content.replace(old_main_content, new_main_content)

# 6. Delete Logo from Desktop Header
old_desktop_logo = """                            <div class="flex items-center gap-2 group cursor-pointer select-none">
                                <img src="/assets/kraken.svg" class="w-8 h-8 object-contain kraken-neon-filter group-hover:scale-110 transition-transform" alt="Kraken">
                                <h1 class="text-xl font-black tracking-[0.15em] text-metal leading-none hidden lg:flex items-center font-sans mt-1">
                                    KRAK<span class="kraken-xi text-2xl relative -top-0.5">Ξ</span>N
                                </h1>
                            </div>
                            <div class="hidden md:block w-px h-6 bg-emerald-900/50 mx-2"></div>"""
content = content.replace(old_desktop_logo, "")

# 7. Delete Logo from Mobile Header
old_mobile_logo = """                        <div class="flex items-center gap-2">
                            <img src="/assets/kraken.svg" class="w-6 h-6 object-contain kraken-neon-filter" alt="Kraken">
                            <h1 class="text-sm font-black tracking-[0.1em] text-metal leading-none font-sans mt-0.5">
                                KRAK<span class="kraken-xi text-base relative -top-0.5">Ξ</span>N
                            </h1>
                        </div>"""
content = content.replace(old_mobile_logo, "")

# 8. Console to Explorador
old_explorador = """            <button onclick="renderFolderView()" 
                class="group bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white hover:border-yellow-500/50 shadow-2xl rounded-full h-10 w-10 hover:w-48 transition-all duration-300 ease-out flex items-center overflow-hidden relative">
                <div class="absolute left-0 w-10 h-10 flex items-center justify-center shrink-0">
                    <i class="fa-solid fa-folder-tree text-yellow-600 group-hover:text-yellow-400 transition"></i>
                </div>
                <span class="pl-10 pr-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-medium text-sm">
                    Explorador de Archivos
                </span>
            </button>"""
new_explorador = """            <div class="flex items-center gap-2 pointer-events-auto">
                <button onclick="toggleConsole()" 
                    class="bg-black border border-emerald-500/50 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)] hover:bg-emerald-500 hover:text-black rounded-full h-10 w-10 transition-all duration-300 ease-out flex items-center justify-center relative group" title="Abrir Consola">
                    <i class="fa-solid fa-terminal text-xs"></i>
                </button>
                <button onclick="renderFolderView()" 
                    class="group bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white hover:border-yellow-500/50 shadow-2xl rounded-full h-10 w-10 hover:w-48 transition-all duration-300 ease-out flex items-center overflow-hidden relative">
                    <div class="absolute left-0 w-10 h-10 flex items-center justify-center shrink-0">
                        <i class="fa-solid fa-folder-tree text-yellow-600 group-hover:text-yellow-400 transition"></i>
                    </div>
                    <span class="pl-10 pr-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-medium text-sm">
                        Explorador de Archivos
                    </span>
                </button>
            </div>"""
content = content.replace(old_explorador, new_explorador)

with codecs.open('templates/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
