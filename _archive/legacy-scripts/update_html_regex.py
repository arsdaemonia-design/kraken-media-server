import codecs
import re

with codecs.open('templates/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Console Bar
console_pattern = re.compile(r'<!-- Console Toggle Bar -->.*?</div>', re.DOTALL)
new_console = """<!-- Console Toggle Bar -->
        <div id="console-bar" onclick="toggleConsole()" 
             class="fixed bottom-4 right-4 z-[9998] bg-black/80 backdrop-blur-md border border-emerald-500/50 text-emerald-500 rounded-full w-10 h-10 flex items-center justify-center cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:scale-110 hover:bg-emerald-900/20 transition-all group"
             title="Abrir Kraken Console">
             <i class="fa-solid fa-terminal text-[15px] group-hover:text-emerald-400"></i>
        </div>"""
content = console_pattern.sub(new_console, content, count=1)

# Sidebar Logo
sidebar_logo_pattern = re.compile(r'<div\s+class="relative bg-\[#020202\] p-4 border-b border-white/5 flex flex-col items-center justify-center gap-1 overflow-hidden group select-none shadow-lg shrink-0">.*?</div>\s+</div>', re.DOTALL)
content = sidebar_logo_pattern.sub("<!-- Logo removed from sidebar -->", content, count=1)

# Mobile Header
mobile_header_pattern = re.compile(r'<!-- ========== MÓVIL: HEADER SUPERIOR ========== -->\s*<div id="mobile-header"[^>]*>.*?<div class="text-center py-2 px-3 border-t border-white/5">.*?</div>', re.DOTALL)
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
content = mobile_header_pattern.sub(new_mobile_header, content, count=1)

# Desktop Header
desktop_header_pattern = re.compile(r'<!-- ========== DESKTOP: HEADER ========== -->\s*<div id="desktop-header"[^>]*>\s*<div class="flex items-center justify-between">\s*<div class="min-w-\[150px\] shrink-0 flex items-center gap-2">.*?</div>\s*</div>', re.DOTALL)
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
content = desktop_header_pattern.sub(new_desktop_header, content, count=1)

with codecs.open('templates/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
