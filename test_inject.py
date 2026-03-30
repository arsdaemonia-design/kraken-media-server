import os, re
import config
template_path = os.path.join(config.BASE_DIR, 'templates', 'index.html')
with open(template_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Viewport
html = re.sub(r'(<meta name=\"viewport\"[^>]+>)', r'\1\n<script>const APP_VERSION=\"3.35\"; const OFFLINE_VERSION=\"3.35\"; const OFFLINE_LIMIT=500;</script>', html)

# 2. Zoom -> add toggle
offline_toggle = '''
<button id="offline-mode-btn" onclick="toggleOfflineMode()" class="flex items-center gap-2 px-2 py-1 rounded-full bg-[#18181b] border border-emerald-700">
    <span id="offline-mode-label" class="text-[9px] font-bold uppercase tracking-widest text-emerald-300">Online</span>
    <span id="offline-mode-track" class="relative inline-flex w-9 h-5 rounded-full bg-emerald-900/50 border border-emerald-700/60">
    <span id="offline-mode-knob" class="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-emerald-400 transition-transform"></span>
    </span>
</button>
'''
html = re.sub(r'(class=\"w-12 accent-emerald-500\"[^>]*oninput=\"changeZoom\(this\.value\)\">.*?</div>)', r'\1 ' + offline_toggle, html, flags=re.DOTALL)

# 3. Mobile search
mobile_btn = '''
<button id="offline-mode-btn-mobile" onclick="toggleOfflineMode()" class="shrink-0 flex items-center gap-1.5 px-2 py-2 rounded-lg bg-[#18181b] border border-emerald-700 transition-all">
    <i id="offline-icon-mobile" class="fa-solid fa-wifi text-emerald-400 text-xs"></i>
    <span id="offline-mode-track-mobile" class="relative inline-flex w-7 h-4 rounded-full bg-emerald-900/50 border border-emerald-700/60">
        <span id="offline-mode-knob-mobile" class="absolute left-0.5 top-0.5 w-3 h-3 rounded-full bg-emerald-400 transition-transform"></span>
    </span>
</button>
'''
html = re.sub(r'(<input type=\"text\" id=\"lib-search-mobile\"[^>]+>)', r'\1 ' + mobile_btn, html, flags=re.DOTALL)

# 4. Nav Offline
nav_offline = '''<div onclick="ver('offline')" id="nav-offline" class="sidebar-link"><i class="fa-solid fa-download w-4 text-center"></i> Offline Files</div>'''
html = re.sub(r'(<div onclick=\"ver\(\'history\'\)\"[^>]*>.*?</div>)', r'\1\n' + nav_offline, html, flags=re.DOTALL)

# 5. View Offline
view_offline = '''<div id="view-offline" class="hidden pb-32 pt-10"><h2>OFFLINE</h2></div>'''
html = re.sub(r'(<div id=\"view-history\")', view_offline + r'\n\1', html)

# 6. Lyrics btn mobile
html = re.sub(r'(<button onclick=\"toggleLyrics\(\)\"[^>]*>.*?</button>)', r'\1\n<button onclick=\"toggleOfflineSave()\" id=\"btn-offline-save\" class=\"text-zinc-600 px-2 transition\" title=\"Guardar offline\"><i class=\"fa-solid fa-arrow-down\"></i></button>', html, count=1, flags=re.DOTALL)

print('Zoom toggle check:', html.count('toggleOfflineMode()'))
print('Nav history check:', 'ver(\'offline\')' in html)
print('Lyrics btn check:', html.count('toggleOfflineSave()'))

