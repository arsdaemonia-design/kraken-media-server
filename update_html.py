import codecs

with codecs.open('templates/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Console Bar
old_console = """        <!-- Console Toggle Bar -->
        <div id="console-bar" onclick="toggleConsole()" 
             style="position:fixed;bottom:0px;left:50%;transform:translateX(-50%);width:180px;height:20px;background:#0d0d0d;border-top:2px solid #10b981;cursor:pointer;z-index:9998;border-radius:5px 5px 0 0;display:flex;align-items:center;justify-content:center;"
             title="Click para abrir consola - Kraken Console">
             <span style="color:#10b981;font-size:10px;font-family:monospace;">📟 CONSOLE</span>
        </div>"""

new_console = """        <!-- Console Toggle Bar -->
        <div id="console-bar" onclick="toggleConsole()" 
             class="fixed bottom-4 right-4 z-[9998] bg-black/80 backdrop-blur-md border border-emerald-500/50 text-emerald-500 rounded-full w-10 h-10 flex items-center justify-center cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:scale-110 hover:bg-emerald-900/20 transition-all group"
             title="Abrir Kraken Console">
             <i class="fa-solid fa-terminal text-[15px] group-hover:text-emerald-400"></i>
        </div>"""

content = content.replace(old_console, new_console)
content = content.replace(old_console.replace('\n', '\r\n'), new_console)

# 2. Update Sidebar Logo
old_sidebar_logo = """                    <div
                        class="relative bg-[#020202] p-4 border-b border-white/5 flex flex-col items-center justify-center gap-1 overflow-hidden group select-none shadow-lg shrink-0">
                        <div
                            class="absolute inset-0 opacity-20 bg-[url('/assets/noise.svg')] mix-blend-overlay">
                        </div>
                        <div
                            class="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-emerald-900/20 to-transparent opacity-60">
                        </div>

                        <div
                            class="relative z-10 w-24 h-24 mb-0 transition-transform duration-500 group-hover:scale-105">
                            <img src="/assets/kraken.svg" class="w-full h-full object-contain kraken-neon-filter"
                                alt="Kraken">
                        </div>

                        <div class="relative z-10 text-center flex flex-col items-center">
                            <h1
                                class="text-2xl font-black tracking-[0.25em] text-metal leading-none flex items-center gap-1 font-sans ml-1">
                                KRAK<span class="kraken-xi text-3xl relative -top-0.5">Ξ</span>N
                            </h1>
                            <div class="flex items-center gap-2 mt-1 opacity-80">
                                <span class="text-[9px] font-bold text-emerald-600 tracking-[0.3em]">Servidor
                                    Multimedia</span>
                            </div>

                        </div>
                    </div>"""

new_sidebar_logo = ""

content = content.replace(old_sidebar_logo, new_sidebar_logo)
content = content.replace(old_sidebar_logo.replace('\n', '\r\n'), new_sidebar_logo)

# 3. Update Mobile Header
old_mobile_header = """<!-- ========== MÓVIL: HEADER SUPERIOR ========== -->
            <div id="mobile-header"
                class="md:hidden sticky top-0 bg-[#171717]/95 backdrop-blur-md z-40 border-b border-white/5 shadow-xl">

                    <!-- FILA 1: Título -->
                    <div class="text-center py-2 px-3 border-t border-white/5">
                        <div class="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center justify-center gap-1"
                            id="lib-mode-label-mobile">
                            <i class="fa-solid fa-music"></i> MÚSICA
                        </div>
                        <h2 class="text-sm font-bold text-white leading-tight mt-1" id="lib-title-mobile">Mi Colección
                        </h2>
                    </div>"""

new_mobile_header = """<!-- ========== MÓVIL: HEADER SUPERIOR ========== -->
            <div id="mobile-header"
                class="md:hidden sticky top-0 bg-[#171717]/95 backdrop-blur-md z-40 border-b border-white/5 shadow-xl">

                    <!-- FILA 1: Título y Logo -->
                    <div class="flex items-center justify-between py-2 px-3 border-t border-white/5">
                        <div class="flex items-center gap-2">
                            <img src="/assets/kraken.svg" class="w-6 h-6 object-contain kraken-neon-filter" alt="Kraken">
                            <h1 class="text-sm font-black tracking-[0.1em] text-metal leading-none font-sans mt-0.5">
                                KRAK<span class="kraken-xi text-base relative -top-0.5">Ξ</span>N
                            </h1>
                        </div>
                        <div class="text-right">
                            <div class="text-[9px] font-bold text-emerald-500 uppercase tracking-widest flex items-center justify-end gap-1"
                                id="lib-mode-label-mobile">
                                <i class="fa-solid fa-music"></i> MÚSICA
                            </div>
                            <h2 class="text-xs font-bold text-white leading-tight mt-1" id="lib-title-mobile">Mi Colección</h2>
                        </div>
                    </div>"""

content = content.replace(old_mobile_header, new_mobile_header)
content = content.replace(old_mobile_header.replace('\n', '\r\n'), new_mobile_header)

# 4. Update Desktop Header
old_desktop_header = """<!-- ========== DESKTOP: HEADER ========== -->
            <div id="desktop-header"
                class="hidden md:flex sticky top-0 bg-[#171717]/95 backdrop-blur-md p-2.5 z-40 rounded-xl border border-white/5 shadow-xl mb-3 flex-col gap-2">
                <div class="flex items-center justify-between">
                        <div class="min-w-[150px] shrink-0 flex items-center gap-2">
                            <button onclick="toggleSidebar()" class="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition">
                                <i class="fa-solid fa-bars"></i>
                            </button>
                            <div>
                            <div class="text-[9px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1"
                                id="lib-mode-label-desktop">
                                <i class="fa-solid fa-music"></i> MÚSICA
                            </div>
                            <h2 class="text-lg md:text-xl font-bold text-white leading-none truncate"
                                id="lib-title-desktop">Mi Colección</h2>
                            </div>
                        </div>"""

new_desktop_header = """<!-- ========== DESKTOP: HEADER ========== -->
            <div id="desktop-header"
                class="hidden md:flex sticky top-0 bg-[#171717]/95 backdrop-blur-md p-2.5 z-40 rounded-xl border border-white/5 shadow-xl mb-3 flex-col gap-2">
                <div class="flex items-center justify-between">
                        <div class="min-w-[150px] shrink-0 flex items-center gap-3">
                            <button onclick="toggleSidebar()" class="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition flex items-center justify-center shrink-0">
                                <i class="fa-solid fa-bars"></i>
                            </button>
                            <div class="flex items-center gap-2 group cursor-pointer select-none">
                                <img src="/assets/kraken.svg" class="w-8 h-8 object-contain kraken-neon-filter group-hover:scale-110 transition-transform" alt="Kraken">
                                <h1 class="text-xl font-black tracking-[0.15em] text-metal leading-none hidden lg:flex items-center font-sans mt-1">
                                    KRAK<span class="kraken-xi text-2xl relative -top-0.5">Ξ</span>N
                                </h1>
                            </div>
                            <div class="hidden md:block w-px h-6 bg-emerald-900/50 mx-2"></div>
                            <div>
                                <div class="text-[9px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1"
                                    id="lib-mode-label-desktop">
                                    <i class="fa-solid fa-music"></i> MÚSICA
                                </div>
                                <h2 class="text-lg md:text-xl font-bold text-white leading-none truncate"
                                    id="lib-title-desktop">Mi Colección</h2>
                            </div>
                        </div>"""

content = content.replace(old_desktop_header, new_desktop_header)
content = content.replace(old_desktop_header.replace('\n', '\r\n'), new_desktop_header)


with codecs.open('templates/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
