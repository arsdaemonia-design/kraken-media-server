import codecs
import re

with codecs.open('templates/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Global Logo Bar
old_main = '''            <div id="view-library" class="animate-fade-in pb-32">
                <div id="lib-stats" class="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3 mb-3 md:mb-4"></div>'''
new_main = '''            <div id="view-library" class="animate-fade-in pb-32">
            <!-- GLOBAL PERSISTENT TOP BAR -->
            <div class="w-full bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-emerald-900/30 flex items-center justify-between px-4 py-2 z-50 sticky top-0 shadow-lg shrink-0 mb-3">
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
            </div>
                <div id="lib-stats" class="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3 mb-3 md:mb-4"></div>'''
content = content.replace(old_main, new_main)

# 2. Fix Dropdowns in JS functions (I'll just add simple toggle CSS updates to fix z-index if needed)
# Wait, the dropdown issue was that `<div id="sort-menu-desktop"...` was a sibling. 
# It worked perfectly fine in the original master, I don't need to wrap it!
# But wait, in the screenshot they uploaded, there were duplicated elements. 
# Because my previous fix_layout_exact.py ran successfully and didn't crash, BUT it was applied ON TOP of git checkout.
# The `fix_layout_exact.py` applied:
# - wrapped sort-menus in relative inline block.
# - added sidebar config row.
# - removed audio-view-controls
# Wait, did `fix_layout_exact.py` actually run and replace things?
# Let's verify if `view-library` has the global bar now!
