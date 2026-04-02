import os

file_path = r"e:\Kraken Media Server\templates\index.html"
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

changes = []

# FIX 1: Revert renderLib back to non-async (the await is the problem)
old_async = "            async function renderLib() {"
new_sync = "            function renderLib() {"
if old_async in content:
    content = content.replace(old_async, new_sync, 1)
    changes.append("FIX 1: renderLib reverted to sync")

# FIX 2: Replace the await renderSeriesHero with .then() pattern (no await needed)
old_hero_await = """                        // Use the modular hero component (async: fetches TMDB + progress data)
                        if (typeof renderSeriesHero === 'function') {
                            try {
                                const heroHtml = await renderSeriesHero(heroItem, window.netflixActiveCategory);
                                container.innerHTML += heroHtml;
                            } catch(e) {
                                console.warn('[HERO] Async hero render failed, using fallback:', e);
                                // Minimal fallback hero
                                const heroSource = heroItem.sample ? heroItem.sample : heroItem;
                                const heroCover = heroSource.tmdb_poster 
                                    ? `/caratula/${encodeURIComponent(heroSource.tmdb_poster)}` 
                                    : `/caratula/${(heroSource._normalizedPath || heroSource.path || '').split('/').map(p => encodeURIComponent(p)).join('/')}`;
                                container.innerHTML += `<div class="relative w-full h-[16vh] min-h-[140px] md:h-[22vh] md:min-h-[180px] rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl group border border-white/5 flex-shrink-0 mb-4 cursor-pointer" onclick="currentPath='${escapeStr(heroItem.path)}'; renderLib();">
                                    <img src="${heroCover}" class="absolute inset-0 w-full h-full object-cover opacity-60" onerror="this.style.display='none'">
                                    <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent"></div>
                                    <div class="absolute bottom-0 left-0 p-6 md:p-12 z-10"><h2 class="text-3xl md:text-5xl font-black text-white">${heroItem.name || heroItem.title}</h2></div>
                                </div>`;
                            }
                        }"""

new_hero_then = """                        // Use the modular hero component (non-blocking .then pattern)
                        if (typeof renderSeriesHero === 'function') {
                            // Show instant fallback hero first, then upgrade async
                            const heroSource = heroItem.sample ? heroItem.sample : heroItem;
                            const heroCover = heroSource.tmdb_poster 
                                ? `/caratula/${encodeURIComponent(heroSource.tmdb_poster)}` 
                                : `/caratula/${(heroSource._normalizedPath || heroSource.path || '').split('/').map(p => encodeURIComponent(p)).join('/')}`;
                            const isHeroMovie = heroItem.folder_type === 'movie';
                            const heroClickAction = isHeroMovie 
                                ? `playNow('${escapeStr(heroItem.path)}')` 
                                : (heroItem.type === 'folder' ? `currentPath='${escapeStr(heroItem.path)}'; renderLib();` : `playNow('${escapeStr(heroItem.path)}')`);
                            
                            const heroPlaceholderId = 'hero-placeholder-' + Date.now();
                            container.innerHTML += `<div id="${heroPlaceholderId}" class="relative w-full h-[16vh] min-h-[140px] md:h-[22vh] md:min-h-[180px] rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl group border border-white/5 flex-shrink-0 mb-4 cursor-pointer transition-all duration-500" onclick="${heroClickAction}">
                                <img src="${heroCover}" class="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-75 group-hover:scale-105 transition duration-1000" onerror="this.style.display='none'">
                                <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent"></div>
                                <div class="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/90 via-[#0a0a0a]/40 to-transparent"></div>
                                <div class="absolute bottom-0 left-0 p-6 md:p-12 z-10">
                                    <div class="flex items-center gap-2 mb-2"><div class="w-1 h-3 bg-emerald-500 rounded"></div><div class="text-[10px] md:text-xs font-black text-white tracking-[0.2em] uppercase">${window.netflixActiveCategory} ${isHeroMovie ? 'PEL\\u00cdCULA' : 'DESTACADO'}</div></div>
                                    <h2 class="text-3xl md:text-5xl lg:text-6xl font-black text-white leading-[1.1] drop-shadow-xl mb-3 line-clamp-2">${heroItem.name || heroItem.title}</h2>
                                </div>
                            </div>`;
                            
                            // Async upgrade: replace placeholder with rich hero (cast, synopsis, etc.)
                            renderSeriesHero(heroItem, window.netflixActiveCategory).then(richHtml => {
                                const placeholder = document.getElementById(heroPlaceholderId);
                                if (placeholder && richHtml) {
                                    const wrapper = document.createElement('div');
                                    wrapper.innerHTML = richHtml;
                                    const richEl = wrapper.firstElementChild;
                                    if (richEl) {
                                        richEl.style.opacity = '0';
                                        placeholder.replaceWith(richEl);
                                        requestAnimationFrame(() => { richEl.style.transition = 'opacity 0.5s'; richEl.style.opacity = '1'; });
                                    }
                                }
                            }).catch(e => console.warn('[HERO] Async upgrade failed:', e));
                        }"""

if old_hero_await in content:
    content = content.replace(old_hero_await, new_hero_then)
    changes.append("FIX 2: Hero replaced with .then() pattern (no await)")
else:
    changes.append("FIX 2 SKIPPED: await block not found")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

for c in changes:
    print(c)
