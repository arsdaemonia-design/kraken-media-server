import codecs
import re

with codecs.open('templates/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Console Button to Explorador de Archivos
# We find: `<button onclick="renderFolderView()"...`
content = content.replace(
    '<button onclick="renderFolderView()"',
    '<div class="flex items-center gap-2 pointer-events-auto">\n                <button onclick="toggleConsole()" class="bg-black border border-emerald-500/50 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)] hover:bg-emerald-500 hover:text-black rounded-full h-10 w-10 transition-all duration-300 ease-out flex items-center justify-center relative group" title="Abrir Consola"><i class="fa-solid fa-terminal text-xs"></i></button>\n                <button onclick="renderFolderView()"'
)
# We also need to close the div after the Explorador button ends.
# The Explorador button ends with:
#                     Explorador de Archivos
#                 </span>
#             </button>
content = content.replace(
    'Explorador de Archivos\n                </span>\n            </button>',
    'Explorador de Archivos\n                </span>\n            </button>\n            </div>'
)

# 2. Add Sidebar Config Row (Grid/List + WiFi)
# We find:
#                     <div class="flex border-b border-white/5 shrink-0">
#                         <div onclick="setLibraryMode('audio')" id="tab-audio" class="mode-btn active"><i
content = content.replace(
    '<div class="flex border-b border-white/5 shrink-0">\n                        <div onclick="setLibraryMode(\'audio\')" id="tab-audio"',
    """<!-- SIDEBAR CONFIG ROW -->
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
                            <button onclick="setView('grid')" id="view-grid-sidebar" class="w-6 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition"><i class="fa-solid fa-border-all text-[10px]"></i></button>
                            <div class="w-px h-3 bg-white/10 mx-0.5"></div>
                            <button onclick="setView('list')" id="view-list-sidebar" class="w-6 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition"><i class="fa-solid fa-list text-[10px]"></i></button>
                        </div>
                    </div>
                    <div class="flex border-b border-white/5 shrink-0">
                        <div onclick="setLibraryMode('audio')" id="tab-audio\""""
)

# 3. Add Global Top Bar
# Insert it after `<div id="main-content" ...>`
# The exact line in index.html is: <div id="main-content" class="flex-1 flex flex-col min-w-0 bg-[#050505] overflow-hidden relative">
content = content.replace(
    '<div id="main-content" class="flex-1 flex flex-col min-w-0 bg-[#050505] overflow-hidden relative">',
    """<div id="main-content" class="flex-1 flex flex-col min-w-0 bg-[#050505] overflow-hidden relative">
            <!-- GLOBAL PERSISTENT TOP BAR -->
            <div class="w-full bg-[#020202] border-b border-emerald-900/30 flex items-center justify-between px-4 py-2 z-50 sticky top-0 shadow-lg">
                <div class="flex items-center gap-3">
                    <button onclick="toggleSidebar()" class="md:hidden w-7 h-7 rounded bg-white/5 hover:bg-white/10 text-zinc-300 transition flex items-center justify-center shrink-0">
                        <i class="fa-solid fa-bars text-xs"></i>
                    </button>
                    <div class="flex items-center gap-2 select-none">
                        <img src="/assets/kraken.svg" class="w-5 h-5 object-contain kraken-neon-filter" alt="Kraken">
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
)

with codecs.open('templates/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
