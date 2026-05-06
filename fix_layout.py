import codecs
import re

with codecs.open('templates/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix Desktop Dropdown HTML
# Search for: <button onclick="toggleSortMenuDesktop()" ...> ... <div id="sort-menu-desktop" ...> ... </button>
desktop_sort_pattern = re.compile(r'(<button onclick="toggleSortMenuDesktop\(\)"[^>]*>.*?)(<div id="sort-menu-desktop".*?</div>)\s*(</button>)', re.DOTALL)
def fix_desktop_sort(match):
    button_open = match.group(1).replace(' relative', '')
    dropdown = match.group(2)
    return f'<div class="relative inline-block">{button_open}</button>{dropdown}</div>'
content = desktop_sort_pattern.sub(fix_desktop_sort, content, count=1)

# 2. Fix Mobile Dropdown HTML
mobile_sort_pattern = re.compile(r'(<button onclick="toggleSortMenuMobile\(\)"[^>]*>.*?)(<div id="sort-menu-mobile".*?</div>)\s*(</button>)', re.DOTALL)
def fix_mobile_sort(match):
    button_open = match.group(1).replace(' relative', '')
    dropdown = match.group(2)
    return f'<div class="relative inline-block">{button_open}</button>{dropdown}</div>'
content = mobile_sort_pattern.sub(fix_mobile_sort, content, count=1)

# 3. Remove Console Button from Player Bar
console_in_player = r'<!-- Console Button in Player -->\s*<button onclick="toggleConsole\(\)".*?</button>'
content = re.sub(console_in_player, '', content, flags=re.DOTALL)

# 4. Add Console Button next to Explorador de Archivos
explorador_pattern = r'(<button onclick="renderFolderView\(\)".*?</button>)'
console_explorador_html = """<div class="flex gap-2 items-center pointer-events-auto">
                <button onclick="toggleConsole()" 
                    class="bg-black border border-emerald-500/50 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)] hover:bg-emerald-500 hover:text-black rounded-full h-10 w-10 transition-all duration-300 ease-out flex items-center justify-center relative group" title="Abrir Consola">
                    <i class="fa-solid fa-terminal text-xs"></i>
                </button>
                \\1
            </div>"""
content = re.sub(explorador_pattern, console_explorador_html, content, count=1)

# 5. Add Grid/List/WiFi to Top of Sidebar
sidebar_top_pattern = r'(<aside id="main-sidebar"[^>]*>\s*<div class="relative-z h-full flex flex-col">\s*<div class="relative-z h-full flex flex-col">\s*)'
sidebar_config_html = r"""\1
                    <!-- CONFIGURACIÓN RÁPIDA (Arriba de todo) -->
                    <div class="flex items-center justify-between p-3 border-b border-white/5 bg-black/40">
                        <!-- Red / Wi-Fi -->
                        <div class="flex items-center gap-1.5" title="Modo No Gastar Datos">
                            <i class="fa-solid fa-wifi text-[9px] text-emerald-500/70"></i>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="toggle-data-saver" class="sr-only peer" checked>
                                <div class="w-7 h-4 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                        </div>
                        <!-- Vista Grid/List -->
                        <div class="bg-[#18181b] rounded flex items-center p-0.5 border border-white/5">
                            <button onclick="setView('grid')" class="w-6 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition"><i class="fa-solid fa-border-all text-[10px]"></i></button>
                            <div class="w-px h-3 bg-white/10 mx-0.5"></div>
                            <button onclick="setView('list')" class="w-6 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition"><i class="fa-solid fa-list text-[10px]"></i></button>
                        </div>
                    </div>
"""
content = re.sub(sidebar_top_pattern, sidebar_config_html, content, count=1)

# 6. Remove old Grid/List from Desktop Header
desktop_view_controls = r'<div id="audio-view-controls" class="bg-\[#18181b\].*?</div>\s*</div>\s*<button onclick="setView\(\'grid\'\)".*?</button>\s*<div class="w-px h-3 bg-emerald-900/50 mx-0\.5"></div>\s*<button onclick="setView\(\'list\'\)".*?</button>\s*</div>'
content = re.sub(desktop_view_controls, '', content, flags=re.DOTALL)
# A simpler regex for desktop view controls:
content = re.sub(r'<div id="audio-view-controls" class="bg-\[#18181b\].*?</div>', '', content, flags=re.DOTALL)

# 7. Remove old Grid/List from Mobile Header
mobile_view_controls = r'<div id="audio-view-controls-mobile" class="bg-\[#18181b\].*?</div>'
content = re.sub(mobile_view_controls, '', content, flags=re.DOTALL)

# 8. Add Persistent Global Logo Bar at the very top (above desktop header and mobile header)
# To do this, we need to inject it before #desktop-header and #mobile-header. They are both inside #main-content.
# Let's find #main-content or #view-library.
# Actually, if we add it at the top of #view-library, it will scroll. We want it sticky or fixed.
# Let's add it right after <div id="main-content" ...>
main_content_pattern = r'(<div id="main-content"\s+class="flex-1 flex flex-col min-w-0 bg-\[#050505\] overflow-hidden relative">)'
global_logo_bar = r"""\1
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
            </div>
"""
content = re.sub(main_content_pattern, global_logo_bar, content, count=1)

# Now remove the redundant Logo from Desktop Header and Mobile Header
# Desktop:
content = re.sub(r'<div class="flex items-center gap-2 select-none group">\s*<img src="/assets/kraken.svg".*?</h1>\s*</div>', '', content, flags=re.DOTALL)
# Mobile:
content = re.sub(r'<div class="flex items-center gap-1\.5 select-none group">\s*<img src="/assets/kraken.svg".*?</h1>\s*</div>', '', content, flags=re.DOTALL)


with codecs.open('templates/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
