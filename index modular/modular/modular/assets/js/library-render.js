/**
 * ============================================================================
 * KRAKEN MEDIA SERVER — library-render.js
 * Carga, búsqueda, filtrado y renderizado principal de la biblioteca multimedia (tarjetas, filas, episodios, discografía de artistas y lazy loading).
 * ============================================================================
 */

/**
 * `isNerdTrack(f)`
 * Determina si una pista de audio pertenece a la colección de Anime OST o Video Game Music ('Nerd Library').
 */
function isNerdTrack(f) {
    if (!f || f.type !== 'audio') return false;
    const folder = (f.full_folder || f.path || '').replace(/\\/g, '/').toLowerCase();
    return folder.startsWith('osts/anime ost') || folder.startsWith('osts/video game music');
}

/**
 * `getCurrentLibraryTitle()`
 * Devuelve el título descriptivo de la sección de biblioteca activa.
 */
function getCurrentLibraryTitle() {
    if (currentLibrary === 'video') return 'Mis Series y Videos';
    if (currentLibrary === 'audio' && currentAudioSection === 'nerd') return 'OSTs • Videojuegos y Anime';
    return 'Mi Música';
}

/**
 * `updateAudioSectionNav()`
 * Actualiza el estado visual de los botones de navegación entre Biblioteca Principal y Nerd Library.
 */
function updateAudioSectionNav() {
    const navLibrary = document.getElementById('nav-library');
    const navNerd = document.getElementById('nav-nerd');
    if (!navLibrary || !navNerd) return;
    const isNerd = currentView === 'library' && currentLibrary === 'audio' && currentAudioSection === 'nerd';
    navLibrary.classList.toggle('active', !isNerd);
    navNerd.classList.toggle('active', isNerd);
}

/**
 * `enterMainLibrary()`
 * Cambia a la sección general de música y recarga la vista.
 */
function enterMainLibrary() {
    if (currentLibrary === 'audio') currentAudioSection = 'general';
    goHome();
}

/**
 * `enterNerdLibrary()`
 * Cambia a la sección de bandas sonoras (Anime / Videojuegos) y recarga la vista.
 */
function enterNerdLibrary() {
    currentLibrary = 'audio';
    currentAudioSection = 'nerd';
    goHome();
}

/**
 * `buildSectionSmartMixes(audioPool)`
 * Genera mixes automáticos específicos para la sección de audio activa.
 */
function buildSectionSmartMixes(audioPool) {
    const nowSec = Date.now() / 1000;
    const mixes = [];

    const topPlayed = audioPool.filter(f => (f.play_count || 0) > 0)
        .sort((a, b) => ((b.rating || 0) - (a.rating || 0)) || ((b.play_count || 0) - (a.play_count || 0)));

    // 1. Para Ti Hoy (Recomendaciones según artistas/géneros más escuchados)
    if (topPlayed.length > 0) {
        const favArtists = new Set(
            topPlayed.slice(0, 25)
                .map(f => (f.artist || '').trim().toLowerCase())
                .filter(a => a && a !== 'desconocido' && a !== 'unknown')
        );
        const favGenres = new Set(
            topPlayed.slice(0, 25)
                .map(f => (f.genre || '').trim().toLowerCase())
                .filter(g => g && g !== 'otros' && g !== 'unknown' && g !== 'desconocido')
        );
        const discoverCandidates = audioPool.filter(f =>
            (f.play_count || 0) <= 2 && (
                favArtists.has((f.artist || '').trim().toLowerCase()) ||
                favGenres.has((f.genre || '').trim().toLowerCase())
            )
        );
        if (discoverCandidates.length >= 8) {
            const discoverMix = shuffleArray([
                ...shuffleArray(discoverCandidates).slice(0, 35),
                ...shuffleArray(topPlayed.slice(0, 30)).slice(0, 15)
            ]).slice(0, 50);
            mixes.push({
                id: 'smart_discover',
                name: 'Para Ti Hoy',
                icon: 'fa-wand-magic-sparkles',
                files: discoverMix.map(x => x.path),
                cover: discoverMix[0].path
            });
        }
    }

    // 2. Top 50 Más Escuchadas
    const top = topPlayed.slice(0, 50);
    if (top.length > 0) {
        mixes.push({ id: 'smart_top50', name: 'Top 50 Más Escuchadas', icon: 'fa-fire', files: top.map(x => x.path), cover: top[0].path });
    }

    // 3. Alta Energía & Ritmo (Librosa BPM/Energy + respaldo por géneros)
    const highEnergyGenres = ['rock', 'metal', 'electronic', 'electrónica', 'dance', 'edm', 'hip-hop', 'rap', 'pop', 'punk', 'industrial', 'synthwave'];
    const upbeat = audioPool.filter(f => {
        const bpm = f.bpm || 0;
        const energy = f.energy || 0;
        const g = (f.genre || '').toLowerCase();
        return (bpm >= 118 && energy >= 40) || (energy >= 60) || (bpm === 0 && highEnergyGenres.some(k => g.includes(k)));
    });
    if (upbeat.length >= 8) {
        const analyzed = shuffleArray(upbeat.filter(f => (f.bpm || 0) > 0));
        const fallback = shuffleArray(upbeat.filter(f => (f.bpm || 0) === 0));
        const sel = [...analyzed, ...fallback].slice(0, 50);
        mixes.push({ id: 'smart_energy', name: 'Alta Energía & Ritmo', icon: 'fa-bolt', files: sel.map(x => x.path), cover: sel[0].path });
    }

    // 4. Chill & Noche (Librosa BPM suave + respaldo acústico/ambient/ost)
    const chillGenres = ['ambient', 'chill', 'acoustic', 'jazz', 'classical', 'clásica', 'lo-fi', 'lofi', 'soundtrack', 'ost', 'soul', 'r&b', 'indie', 'folk'];
    const chill = audioPool.filter(f => {
        const bpm = f.bpm || 0;
        const energy = f.energy || 0;
        const g = (f.genre || '').toLowerCase();
        return (bpm > 0 && bpm <= 108 && energy > 0 && energy <= 55) || (bpm === 0 && chillGenres.some(k => g.includes(k)));
    });
    if (chill.length >= 8) {
        const analyzed = shuffleArray(chill.filter(f => (f.bpm || 0) > 0));
        const fallback = shuffleArray(chill.filter(f => (f.bpm || 0) === 0));
        const sel = [...analyzed, ...fallback].slice(0, 50);
        mixes.push({ id: 'smart_chill', name: 'Chill & Noche', icon: 'fa-moon', files: sel.map(x => x.path), cover: sel[0].path });
    }

    // 5. Joyas Olvidadas (canciones con play_count >= 2 o favoritas rating >= 1 no escuchadas en 21 días)
    const threeWeeksAgo = nowSec - (21 * 86400);
    let gems = audioPool.filter(f => ((f.rating || 0) >= 1 || (f.play_count || 0) >= 2) && (f.last_played || 0) < threeWeeksAgo);
    if (gems.length === 0) {
        const twoWeeksAgo = nowSec - (14 * 86400);
        gems = audioPool.filter(f => (f.play_count || 0) >= 1 && (f.last_played || 0) < twoWeeksAgo);
    }
    if (gems.length > 0) {
        const shuffled = shuffleArray(gems).slice(0, 50);
        mixes.push({ id: 'smart_gems', name: 'Joyas Olvidadas', icon: 'fa-gem', files: shuffled.map(x => x.path), cover: shuffled[0].path });
    }

    // 6. Radar de Novedades (últimos 14 días o las 50 más recientes)
    const twoWeeksAgo = nowSec - (14 * 86400);
    let fresh = audioPool.filter(f => (f.date || 0) > twoWeeksAgo)
        .sort((a, b) => (b.date || 0) - (a.date || 0))
        .slice(0, 50);
    if (fresh.length === 0 && audioPool.length > 0) {
        fresh = [...audioPool].sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, 50);
    }
    if (fresh.length > 0) mixes.push({ id: 'smart_new', name: 'Radar de Novedades', icon: 'fa-rss', files: fresh.map(x => x.path), cover: fresh[0].path });

    // 7. Radio Kraken
    const rnd = shuffleArray(audioPool).slice(0, 50);
    if (rnd.length > 0) mixes.push({ id: 'smart_shuffle', name: 'Radio Kraken', icon: 'fa-broadcast-tower', files: rnd.map(x => x.path), cover: rnd[0].path });

    return mixes;
}

/**
 * `initLazyLoader()`
 * Configura el `IntersectionObserver` para carga diferida (lazy loading) de carátulas e imágenes.
 */
function initLazyLoader() {
    if ('IntersectionObserver' in window && !imageObserver) {
        imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src && !img.getAttribute('src')) {
                        img.src = img.dataset.src;
                        img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
                        img.addEventListener('error', () => img.classList.add('loaded'), { once: true });
                        imageObserver.unobserve(img); // ✅ Dejar de observar cuando carga
                    }
                }
            });
        }, {
            rootMargin: '50px' // ✅ Cargar 50px antes de que entre en pantalla
        });
    }
}

/**
 * `observeLazyImages(scope)`
 * Registra todas las imágenes `.lazy-img` recién renderizadas en el `IntersectionObserver`.
 */
function observeLazyImages(scope) {
    if (!imageObserver) return;

    const root = scope && typeof scope.querySelectorAll === 'function' ? scope : document;
    root.querySelectorAll('.lazy-img').forEach(img => {
        // ✅ Solo observar si NO tiene src y NO está ya siendo observada
        // `img.src` puede devolver la URL actual aunque el atributo no exista.
        // Comprobar el atributo evita bloquear la carga lazy de caratulas.
        if (img.dataset.src && !img.getAttribute('src') && !img.classList.contains('loaded')) {
            imageObserver.observe(img);
        }
    });
}

/**
 * `setupAudioElement(el)`
 * Vincula los eventos de tiempo, fin de pista y metadatos a los elementos `<audio>` del DOM.
 */
function setupAudioElement(el) {
    el.addEventListener('ended', (e) => { if (e.target === audioElement) onTrackEnded() });
    el.addEventListener('timeupdate', (e) => { if (e.target === audioElement) updateProgress() });
    el.addEventListener('play', (e) => {
        if (e.target !== audioElement) return;
        const icons = ['#btn-play i', '#btn-play-desktop i', '#fp-play i'];
        icons.forEach(selector => {
            const icon = document.querySelector(selector);
            if (icon) icon.className = 'fa-solid fa-pause';
        });
        initVisualizer();
    });
    el.addEventListener('pause', (e) => {
        if (e.target !== audioElement) return;
        const icons = ['#btn-play i', '#btn-play-desktop i', '#fp-play i'];
        icons.forEach(selector => {
            const icon = document.querySelector(selector);
            if (icon) icon.className = 'fa-solid fa-play ml-0.5';
        });
    });
    el.addEventListener('loadedmetadata', (e) => {
        if (e.target !== audioElement) return;
        const bars = ['prog-bar', 'prog-bar-desktop', 'fp-prog'];
        bars.forEach(id => {
            const b = document.getElementById(id);
            if (b) b.max = el.duration;
        });
    });
}

/**
 * `filterNetflixRows(category)`
 * Filtra la visibilidad de las filas de categorías en la vista de video.
 */
function filterNetflixRows(category) {
                const rows = document.querySelectorAll('.netflix-category-row');
                rows.forEach(row => {
                    if (category === 'ALL' || row.dataset.category === category) {
                        row.classList.remove('hidden');
                    } else {
                        row.classList.add('hidden');
                    }
                });
            }

            /**
             * `setFilter(k, v)`
             * Aplica un filtro (carpeta, artista, álbum, género, playlist, favoritos) y vuelve a renderizar la biblioteca.
             */
            function setFilter(k, v) {
                discografiaMode = false;
                filters[k] = (filters[k] === v) ? 'default' : v;

                if (['sort'].includes(k)) {
                    // Limpiar botones en DESKTOP
                    ['chip-recent', 'chip-top', 'chip-new'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.classList.remove('active', 'bg-emerald-600', 'text-white');
                    });
                    // Limpiar botones en MÓVIL
                    ['chip-recent-mobile', 'chip-top-mobile', 'chip-new-mobile'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.classList.remove('active', 'bg-emerald-600', 'text-white');
                    });
                }

                const hero = document.getElementById('artist-hero');
                if (k === 'artist' && v !== 'all' && v !== 'default') {
                    hero.classList.remove('hidden');
                    document.getElementById('hero-name').innerText = v;
                    const count = libData.files.filter(f => f.artist === v).length;
                    document.getElementById('hero-stats').innerText = `${count} Canciones`;
                } else {
                    hero.classList.add('hidden');
                }

                renderLimit = renderStep;
                renderLib();
            }

            /**
             * `renderActiveFilters()`
             * Muestra las etiquetas (chips) de filtros activos con opción para quitarlos individualmente.
             */
            function renderActiveFilters() {
                const bar = document.getElementById('active-filters-bar');
                bar.innerHTML = "";
                let hasFilters = false;
                const mapping = { 'artist': 'Artista', 'album': 'Álbum', 'folder': 'Carpeta', 'playlist': 'Playlist', 'genre': 'Género', 'rating': 'Rating' };
                for (const [key, val] of Object.entries(filters)) {
                    if (val !== 'all' && val !== 'default' && mapping[key]) {
                        hasFilters = true;
                        bar.innerHTML += `<div class="bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-2"><span>${mapping[key]}: ${val}</span><button onclick="setFilter('${key}', 'default')" class="hover:text-white"><i class="fa-solid fa-xmark"></i></button></div>`;
                    }
                }
                if (hasFilters) {
                    bar.classList.remove('hidden');
                    bar.innerHTML += `<button onclick="goHome()" class="text-[10px] text-emerald-500 hover:text-white underline ml-2">Limpiar todo</button>`;
                } else {
                    bar.classList.add('hidden');
                }
            }

            /**
             * `cargarLib()`
             * Descarga el catálogo completo desde `/biblioteca`, inicializa mixes y refresca toda la interfaz.
             */
            async function cargarLib() {
                try {
                    setLoaderText("Invocando tu librería 🎵");

                    // Si ya hay datos en memoria, mostrarlos de inmediato
                    if (window.libData) {
                        libData = window.libData;
                        renderSidebarLists();
                        renderLib();
                    }

                    // Traer TODA la biblioteca (sin paginación), filtrada por dueño
                    const res = await fetch('/biblioteca?fresh=1&owner=' + encodeURIComponent(window.MY_EMAIL));
                    setLoaderText("Leyendo archivos...");
                    const data = await res.json();

                    // Guardar en memoria global
                    window.libData = data;
                    libData = data;
                    window.videoSearchEntityCache = new Map();

                    if (libData && Array.isArray(libData.files)) {
                        libData.files.forEach(f => {
                            const title = f.title || '';
                            const artist = f.artist || '';
                            const album = f.album || '';
                            const genre = f.genre || '';
                            const folder = f.folder || '';
                            const fullFolder = f.full_folder || '';
                            const normalizedPath = (f.path || '').replace(/\\/g, '/');
                            const pathParts = normalizedPath.split('/').filter(Boolean);
                            const videoCategory = f.type === 'video' ? (pathParts[1] || '') : '';
                            const videoShow = f.type === 'video' ? (pathParts[2] || '') : '';
                            const videoSeason = f.type === 'video' ? (pathParts[3] || '') : '';
                            const videoTokens = f.type === 'video' ? `${videoCategory} ${videoShow} ${videoSeason} ${normalizedPath}` : '';
                            f._searchTitle = normalizeText(title);
                            f._searchArtist = normalizeText(artist);
                            f._searchAlbum = normalizeText(album);
                            f._searchGenre = normalizeText(genre);
                            f.searchKey = normalizeText(`${title} ${artist} ${album} ${genre} ${folder} ${fullFolder} ${videoTokens}`);
                        });
                    }

                    setLoaderText("Despertando carátulas 👻");
                    renderSidebarLists();

                    setLoaderText("Afinando playlists...");
                    renderLib();

                    setLoaderText("Ya casi ✨");

                    // Refresh en segundo plano
                    setTimeout(() => refreshLibrary(), 50);

                } catch (e) {
                    console.error("Error cargando biblioteca:", e);
                    setLoaderText("Algo salió mal 😵");
                }
            }

            /**
             * `setSearchScope(scope)`
             * Cambia el ámbito de búsqueda en audio ('all', 'tracks', 'albums', 'artists', 'playlists').
             */
            function setSearchScope(scope) {
                searchScope = scope;

                // Update Desktop and Mobile Tabs
                const scopes = ['all', 'tracks', 'albums', 'artists', 'playlists'];
                scopes.forEach(s => {
                    const tabDsktp = document.getElementById('tab-search-dsktp-' + s);
                    if (tabDsktp) {
                        tabDsktp.classList.toggle('border-emerald-500', s === scope);
                        tabDsktp.classList.toggle('text-emerald-400', s === scope);

                        tabDsktp.classList.toggle('border-transparent', s !== scope);
                        tabDsktp.classList.toggle('text-zinc-400', s !== scope);
                    }

                    const tabMob = document.getElementById('tab-search-mob-' + s);
                    if (tabMob) {
                        tabMob.classList.toggle('border-emerald-500', s === scope);
                        tabMob.classList.toggle('text-emerald-400', s === scope);

                        tabMob.classList.toggle('border-transparent', s !== scope);
                        tabMob.classList.toggle('text-zinc-400', s !== scope);
                    }
                });

                renderLib();
            }



            /**
             * `renderSidebarLists()`
             * Puebla las listas laterales de carpetas, artistas, géneros y playlists.
             */
            function renderSidebarLists() {
                const pList = document.getElementById('list-playlists-container');
                if (pList) {
                    pList.innerHTML = '';
                    const playlists = Object.keys(libData.playlists).sort();

                    playlists.forEach(p => {
                        const count = libData.playlists[p].length;
                        const isActive = filters.playlist === p || currentLibrary === `playlist:${p}`;

                        // Estilos Carbono
                        const activeClasses = 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]';
                        const inactiveClasses = 'bg-white/[0.02] border-white/5 text-emerald-400 hover:bg-white/[0.1] hover:text-white hover:border-white/10';

                        pList.innerHTML += `
            <div class="group flex items-center justify-between px-3 py-2.5 mb-1 rounded-lg cursor-pointer transition-all duration-200 border ${isActive ? activeClasses : inactiveClasses}">
                
                <div onclick="abrirPlaylist('${escapeStr(p)}')" class="flex-1 flex items-center gap-3 min-w-0">
                    <div class="w-4 h-4 rounded-full flex items-center justify-center ${isActive ? 'bg-emerald-500 text-black' : 'bg-white/5 text-emerald-500 group-hover:bg-emerald-500/20 group-hover:text-emerald-400'} transition">
                        <i class="fa-solid fa-music text-[9px]"></i>
                    </div>
                    <span class="truncate text-[11px] font-medium tracking-wide">${p}</span>
                </div>
                
                <div class="flex items-center gap-2">
                    <span class="text-[9px] font-mono opacity-30 group-hover:hidden transition">${count}</span>
                    
                    <div class="hidden group-hover:flex items-center gap-1">
                        <button 
                            onclick="event.stopPropagation(); sharePlaylist(this.dataset.name)" 
                            data-name="${escapeHtml(p)}"
                            class="w-5 h-5 flex items-center justify-center rounded hover:bg-cyan-500/20 text-emerald-500 hover:text-cyan-400 transition" 
                            title="Compartir">
                            <i class="fa-solid fa-link text-[9px]"></i>
                        </button>
                        <button 
                            onclick="event.stopPropagation(); renamePlaylist(this.dataset.name)" 
                            data-name="${escapeHtml(p)}"
                            class="w-5 h-5 flex items-center justify-center rounded hover:bg-blue-500/20 text-emerald-500 hover:text-blue-400 transition" 
                            title="Renombrar">
                            <i class="fa-solid fa-pen text-[9px]"></i>
                        </button>
                        <button 
                            onclick="event.stopPropagation(); deletePlaylist(this.dataset.name)" 
                            data-name="${escapeHtml(p)}"
                            class="w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/20 text-emerald-500 hover:text-red-400 transition" 
                            title="Eliminar">
                            <i class="fa-solid fa-trash text-[9px]"></i>
                        </button>
                    </div>
                </div>
            </div>`;
                    });
                }
            }



            /**
             * `toggleArtist(el, artistName)`
             * Expande o contrae la lista de álbumes de un artista en el árbol lateral.
             */
            function toggleArtist(el, artistName) {
                if (artistName) setFilter('artist', artistName);
                const group = el.querySelector('.artist-group');
                const icon = el.querySelector('i');
                if (group.classList.contains('hidden')) {
                    group.classList.remove('hidden');
                    icon.style.transform = 'rotate(180deg)';
                } else {
                    group.classList.add('hidden');
                    icon.style.transform = 'rotate(0deg)';
                }
            }

            // --- NUEVAS FUNCIONES DE NAVEGACIÓN ---
            /**
             * `navigateTo(folderName)`
             * Navega hacia una subcarpeta específica dentro de la biblioteca.
             */
            function navigateTo(folderName) {
                currentPath += folderName + "/";
                renderLimit = renderStep;
                renderLib();
            }

            /**
             * `navigateUp()`
             * Sube al directorio padre en la navegación de biblioteca.
             */
            function navigateUp() {
                if (!currentPath) return;
                const parts = currentPath.split('/').filter(p => p);
                parts.pop();
                currentPath = parts.length > 0 ? parts.join('/') + "/" : "";

                // Video UX: al subir desde detalle (Video/Categoría/Show) volvemos al home Netflix
                // manteniendo la categoría activa, en lugar de caer en la vista intermedia con tarjeta "Subir".
                if (currentLibrary === 'video' && parts.length <= 2) {
                    if (parts.length === 2 && parts[0] === 'Video') {
                        videoUIState.activeCategory = parts[1];
                    }
                    currentPath = "";
                }
                renderLimit = renderStep;
                renderLib();
            }

            /**
             * `navigateRoot()`
             * Vuelve a la raíz del directorio de la biblioteca actual.
             */
            function navigateRoot() {
                currentPath = "";
                renderLimit = renderStep;
                renderLib();
            }
            // --------------------------------------

            /**
             * `enterFolderView(folderName)`
             * Activa la vista de exploración por carpetas.
             */
            function enterFolderView(folderName) {
                currentFolderView = folderName;

                const btnBack = document.getElementById('btn-back-folder');
                if (btnBack) btnBack.classList.remove('hidden');

                const titleDesktop = document.getElementById('lib-title-desktop');
                const titleMobile = document.getElementById('lib-title-mobile');

                if (titleDesktop) titleDesktop.innerText = folderName;
                if (titleMobile) titleMobile.innerText = folderName;

                renderLib();
            }
            /**
             * `exitFolderView()`
             * Sale de la vista de carpetas y regresa al listado general.
             */
            function exitFolderView() {
                currentFolderView = null;

                const btnBack = document.getElementById('btn-back-folder');
                if (btnBack) btnBack.classList.add('hidden');

                const titleDesktop = document.getElementById('lib-title-desktop');
                const titleMobile = document.getElementById('lib-title-mobile');

                if (titleDesktop) titleDesktop.innerText = "Mis Series y Videos";
                if (titleMobile) titleMobile.innerText = "Mis Series y Videos";

                renderLib();
            }
            /**
             * `normalizeText(input)`
             * Normaliza texto eliminando acentos/diacríticos y convirtiendo a minúsculas para búsquedas.
             */
            function normalizeText(input) {
                return (input || '')
                    .toString()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toLowerCase()
                    .replace(/[^a-z0-9\s]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
            }

            /**
             * `shuffleArray(arr)`
             * Mezcla aleatoriamente los elementos de un arreglo (algoritmo Fisher-Yates).
             */
            function shuffleArray(arr) {
                const copy = arr.slice();
                for (let i = copy.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [copy[i], copy[j]] = [copy[j], copy[i]];
                }
                return copy;
            }

            /**
             * `getFilteredTracks()`
             * Filtra y ordena los archivos de `libData` según la sección, filtros activos y texto de búsqueda.
             */
            function getFilteredTracks() {
                // Inputs de búsqueda
                const mobileInput = document.getElementById('lib-search-mobile');
                const desktopInput = document.getElementById('lib-search-desktop');
                const rawTerm = (mobileInput && mobileInput.value) || (desktopInput && desktopInput.value) || '';
                const term = normalizeText(rawTerm);
                const tokens = term ? term.split(' ') : [];

                let source = libData.files;

                // 1. FILTRO DE TIPO (Audio/Video)
                if (filters.playlist === 'all' && !currentLibrary.startsWith('playlist:')) {
                    source = source.filter(f => f.type === currentLibrary);
                }

                if (currentLibrary === 'audio' && filters.playlist === 'all') {
                    source = source.filter(f => currentAudioSection === 'nerd' ? isNerdTrack(f) : !isNerdTrack(f));
                }

                // 2. FILTRO DE MODO EXPLORADOR (Aquí recortamos la lista primero)
                // Usamos una variable para saber si el recorte ya se hizo
                let isExplorerFiltering = false;

                if (currentView === 'folders' && currentExplorerPath !== '') {
                    // Aseguramos que busque la ruta exacta con '/' al final
                    source = source.filter(f => f.path.startsWith(currentExplorerPath + '/'));
                    isExplorerFiltering = true; // Marcamos que ya filtramos por carpeta
                }
                // 2b. FILTRO POR currentPath EN MODO VIDEO (Netflix/Season view)
                // Cuando currentPath tiene una ruta (ej: Video/Series/Gantz/Temporada 1/)
                // pero no estamos en modo folders, igualmente filtramos
                else if (typeof currentPath !== 'undefined' && currentPath !== '' && currentPath !== null) {
                    source = source.filter(f => f.path.startsWith(currentPath));
                    isExplorerFiltering = true;
                }

                // 3. FILTRO DE PLAYLIST
                else if (filters.playlist !== 'all') {
                    const rawPaths = libData.playlists[filters.playlist] || [];

                    // 1. Limpiamos la lista de invitados (quitamos %20 y barras invertidas)
                    // 🛡️ Protegemos con try-catch para rutas malformadas
                    const validPaths = new Set(rawPaths.map(p => {
                        try {
                            return decodeURIComponent(p).replace(/\\\\/g, '/');
                        } catch (e) {
                            // Si falla decodeURIComponent, la ruta ya está decodificada
                            return p.replace(/\\\\/g, '/');
                        }
                    }));

                    source = source.filter(f => {
                        // 2. Limpiamos el nombre del que quiere entrar
                        let myPath;
                        try {
                            myPath = decodeURIComponent(f.path).replace(/\\\\/g, '/');
                        } catch (e) {
                            myPath = f.path.replace(/\\\\/g, '/');
                        }
                        return validPaths.has(myPath);
                    });
                }

                // 4. LOOP DE FILTROS BASE
                let filtered = source.filter(f => {
                    const title = f._searchTitle || normalizeText(f.title || '');
                    const artist = f._searchArtist || normalizeText(f.artist || '');
                    const album = f._searchAlbum || normalizeText(f.album || '');
                    const genre = f._searchGenre || normalizeText(f.genre || '');
                    const rawPath = (f.path || '').replace(/\\/g, '/');
                    const pathParts = rawPath.split('/').filter(Boolean);
                    const videoCategory = f.type === 'video' ? (pathParts[1] || '') : '';
                    const videoShow = f.type === 'video' ? (pathParts[2] || '') : '';
                    const videoSeason = f.type === 'video' ? (pathParts[3] || '') : '';
                    const searchKey = f.searchKey || normalizeText(`${f.title || ''} ${f.artist || ''} ${f.album || ''} ${f.genre || ''} ${f.folder || ''} ${f.full_folder || ''} ${rawPath} ${videoCategory} ${videoShow} ${videoSeason}`);

                    // Búsqueda de texto mediante el Scope
                    let matchText = true;
                    if (tokens.length > 0) {
                        if (searchScope === 'all') {
                            matchText = tokens.every(t => searchKey.includes(t));
                        } else if (searchScope === 'tracks') {
                            matchText = tokens.every(t => title.includes(t));
                        } else if (searchScope === 'albums') {
                            matchText = tokens.every(t => album.includes(t));
                        } else if (searchScope === 'artists') {
                            matchText = tokens.every(t => artist.includes(t));
                        } else if (searchScope === 'playlists') {
                            // Check if the track belongs to any playlist matching tokens
                            const trackPlaylists = normalizeText((f.playlists || []).join(' '));
                            matchText = tokens.every(t => trackPlaylists.includes(t));
                        }
                    }

                    // 👇 AQUÍ ESTABA EL ERROR 👇
                    // Si estamos en modo explorador (isExplorerFiltering), IGNORAMOS el filtro viejo.
                    // Si NO estamos en modo explorador, usamos la lógica de siempre.
                    let matchFolder = true;
                    if (!isExplorerFiltering) {
                        matchFolder = (filters.folder === 'all' || f.full_folder === filters.folder);
                    }

                    const matchArtist = (filters.artist === 'all' || f.artist === filters.artist);
                    const matchAlbum = (filters.album === 'all' || f.album === filters.album);
                    const matchGenre = (filters.genre === 'all' || f.genre === filters.genre);

                    let matchRating = true;
                    if (filters.rating !== 'all') {
                        matchRating = (f.rating && f.rating >= parseInt(filters.rating));
                    }

                    if (matchText) {
                        let score = 0;
                        if (term && title.includes(term)) score += 3;
                        if (term && artist.includes(term)) score += 2;
                        if (term && album.includes(term)) score += 1;
                        if (term && genre.includes(term)) score += 1;
                        if (tokens.length > 0) {
                            score += tokens.reduce((s, t) => s + (searchKey.includes(t) ? 0.5 : 0), 0);
                        }
                        f._searchScore = score;
                    } else {
                        f._searchScore = 0;
                    }

                    return matchText && matchFolder && matchArtist && matchAlbum && matchRating && matchGenre;
                });

                if (term && (filters.sort === 'default' || !filters.sort)) {
                    filtered.sort((a, b) => (b._searchScore || 0) - (a._searchScore || 0));
                }

                // -------------------------
                switch (filters.sort) {
                    case 'az': filtered.sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })); break;
                    case 'za': filtered.sort((a, b) => (b.title || '').localeCompare(a.title || '', undefined, { sensitivity: 'base' })); break;
                    case 'artist': filtered.sort((a, b) => (a.artist || '').localeCompare(b.artist || '', undefined, { sensitivity: 'base' })); break;
                    case 'recent':
                        filtered = filtered.filter(f => f.last_played > 0);
                        filtered.sort((a, b) => b.last_played - a.last_played);
                        break;
                    case 'top':
                        filtered = filtered.filter(f => f.play_count > 0);
                        filtered.sort((a, b) => b.play_count - a.play_count);
                        break;
                    case 'new':
                        const dayAgo = Date.now() / 1000 - 86400;
                        filtered = filtered.filter(f => f.date > dayAgo).sort((a, b) => b.date - a.date);
                        break;
                }

                return filtered;
            }

            /**
             * `crearRadioArtista(artist)`
             * Genera una cola de reproducción continua basada en un artista y pistas similares.
             */
            async function crearRadioArtista(artist) {
                if (!artist) return;

                showToast(`📻 Generando Radio de ${artist}...`, 'emerald');

                try {
                    const res = await fetch(`/api/radio/artist/${encodeURIComponent(artist)}`);
                    const paths = await res.json();

                    if (!paths || paths.length === 0) {
                        showToast(`No encontré canciones similares para ${artist}`, 'orange');
                        return;
                    }

                    // Convertir las rutas en objetos de archivo del libData
                    const fileObjects = paths
                        .map(p => libData.files.find(f => f.path === p))
                        .filter(f => f);

                    if (fileObjects.length === 0) {
                        showToast(`No encontré canciones en tu biblioteca para ${artist}`, 'orange');
                        return;
                    }

                    // Usar playerQueue y playTrack (las variables correctas del player)
                    playerQueue = fileObjects;
                    currentTrackIndex = 0;
                    playTrack(playerQueue[0]);

                    showToast(`✨ Radio de ${artist}: ${fileObjects.length} canciones`, 'emerald');
                    if (typeof updateQueueUI === 'function') updateQueueUI();
                } catch (e) {
                    console.error("Error Radio Artista:", e);
                    showToast("Error al generar la radio", "red");
                }
            }



            /**
             * `renderLib()`
             * Función puente con debounce que invoca el renderizado principal de la biblioteca (`_renderLibActual`).
             */
            function renderLib() {
                clearTimeout(renderTimeout);
                renderTimeout = setTimeout(() => {
                    syncVideoDerivedState();
                    
                    const container = document.getElementById('lib-content');
                    if (container) {
                        container.classList.remove('content-transition');
                        void container.offsetWidth; // Trigger reflow
                        container.classList.add('content-transition');
                    }

                    _renderLibActual();
                }, 260);
            }
            /**
             * `_renderLibActual()`
             * Motor principal de renderizado que construye la interfaz de catálogo para Video (Netflix/Directorios) y Audio (Lista/Grid).
             */
            function _renderLibActual() {
                console.count("renderLib ejecutado");
                if (discografiaMode) {
                    renderDiscografiasView();
                    return;
                }

                // 🛑 2. SI ESTAMOS EN MODO EXPLORADOR DE CARPETAS, QUE SE QUEDE AHÍ
                // (Esta es la parte nueva que evita que te saque al seleccionar)
                if (currentView === 'folders' && typeof renderFolderView === 'function') {
                    // Volvemos a renderizar la carpeta actual (manteniendo selección y vista)
                    renderFolderView(currentExplorerPath || '');
                    return;
                }

                const normalizedCurrentPath = ((typeof currentPath === 'string' ? currentPath : '') || '').replace(/\\/g, '/');
                const previousRenderedPath = (window.__krakenLastRenderedPath || '').replace(/\\/g, '/');
                const previousRenderedLibrary = window.__krakenLastRenderedLibrary || '';
                const currentDepth = normalizedCurrentPath.split('/').filter(Boolean).length;
                const enteringVideoDetailView =
                    currentLibrary === 'video' &&
                    currentDepth >= 3 &&
                    (previousRenderedLibrary !== 'video' || previousRenderedPath !== normalizedCurrentPath);

                if (enteringVideoDetailView) {
                    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
                }

                window.__krakenLastRenderedPath = normalizedCurrentPath;
                window.__krakenLastRenderedLibrary = currentLibrary || '';

                renderActiveFilters();
                const container = document.getElementById('lib-container');
                container.innerHTML = "";
                const filtered = getFilteredTracks();
                const mixesContainer = document.getElementById('smart-mixes-container');
                const mixesGrid = document.getElementById('smart-mixes-grid');
                const genreSection = document.getElementById('genre-mixes-section');
                const genreRow = document.getElementById('genre-mixes-row');
                const artistSection = document.getElementById('artist-mixes-section');
                const artistRow = document.getElementById('artist-mixes-row');
                renderLibraryStats();



                // --- LÓGICA DE AUDIO (MIXES) ---
                const mobileInput = document.getElementById('lib-search-mobile');
                const desktopInput = document.getElementById('lib-search-desktop');
                const searchValue = (mobileInput && mobileInput.value) || (desktopInput && desktopInput.value) || '';

                // Solo mostramos mixes si no hay filtros activos (estamos en "Home")
                if (currentLibrary === 'audio' && filters.folder === 'all' && filters.playlist === 'all' && !searchValue && filters.artist === 'all' && filters.album === 'all') {
                    mixesContainer.classList.remove('hidden');
                    mixesGrid.innerHTML = '';
                    customMixes = {};

                    // 1. CREAR MIX DE FAVORITOS (Si hay likes)
                    const sectionAudioFiles = libData.files.filter(f => f.type === 'audio' && (currentAudioSection === 'nerd' ? isNerdTrack(f) : !isNerdTrack(f)));
                    const favFiles = sectionAudioFiles.filter(f => f.rating === 1);

                    // Preparamos la lista combinada
                    // Copiamos los mixes que vienen del servidor (Top50, etc.)
                    let mixesToShow = buildSectionSmartMixes(sectionAudioFiles);
                    sectionSmartMixes = mixesToShow.slice();

                    // Si hay favoritos, lo metemos al principio
                    if (favFiles.length > 0) {
                        const favMix = {
                            id: 'smart_favorites',
                            name: 'Mis Favoritos',
                            icon: 'fa-heart',
                            files: favFiles,
                            desc: 'Tu selección personal'
                        };
                        mixesToShow.unshift(favMix); // ¡Primero en la lista!
                    }

                    // 🎨 PALETA DE COLORES INTELIGENTE
                    const styles = {
                        // VERDE TÓXICO PARA FAVORITOS 💚
                        'smart_favorites': {
                            from: 'from-emerald-600/20', to: 'to-black',
                            border: 'border-emerald-500/50 hover:border-emerald-400',
                            icon: 'text-emerald-500',
                            glow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                        },
                        // Otros estilos
                        'smart_discover': { from: 'from-pink-500/15', to: 'to-rose-500/5', border: 'border-pink-500/30 hover:border-pink-400', icon: 'text-pink-400', glow: 'hover:shadow-[0_0_20px_rgba(244,114,182,0.2)]' },
                        'smart_top50': { from: 'from-orange-500/10', to: 'to-red-500/5', border: 'border-orange-500/20 hover:border-orange-500', icon: 'text-orange-500', glow: '' },
                        'smart_energy': { from: 'from-amber-500/15', to: 'to-yellow-500/5', border: 'border-amber-500/30 hover:border-amber-400', icon: 'text-amber-400', glow: '' },
                        'smart_chill': { from: 'from-indigo-500/15', to: 'to-violet-500/5', border: 'border-indigo-500/30 hover:border-indigo-400', icon: 'text-indigo-400', glow: '' },
                        'smart_new': { from: 'from-teal-500/10', to: 'to-cyan-500/5', border: 'border-teal-500/20 hover:border-teal-500', icon: 'text-teal-400', glow: '' },
                        'smart_shuffle': { from: 'from-blue-500/10', to: 'to-indigo-500/5', border: 'border-blue-500/20 hover:border-blue-400', icon: 'text-blue-400', glow: '' },
                        'smart_gems': { from: 'from-purple-500/10', to: 'to-pink-500/5', border: 'border-purple-500/20 hover:border-purple-400', icon: 'text-purple-400', glow: '' }
                    };

                    // Renderizamos la lista combinada
                    mixesToShow.forEach(mix => {
                        // Si no hay estilo definido, usamos uno neutro
                        const s = styles[mix.id] || { from: 'from-zinc-800', to: 'to-zinc-900', border: 'border-white/10 hover:border-white/30', icon: 'text-zinc-400', glow: '' };

                        mixesGrid.innerHTML += `
            <div onclick="playMix('${mix.id}')" 
                 class="relative overflow-hidden h-32 flex flex-col justify-between p-4 rounded-xl cursor-pointer transition-all duration-300 group
                        bg-gradient-to-br ${s.from} ${s.to} bg-[#121212]
                        border ${s.border} hover:scale-[1.02] ${s.glow || 'hover:shadow-[0_0_20px_rgba(0,0,0,0.4)]'}">
                
                <div class="absolute -right-4 -top-4 opacity-[0.05] group-hover:opacity-10 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110 pointer-events-none">
                    <i class="fa-solid ${mix.icon} text-9xl text-white"></i>
                </div>
                
                <div class="text-2xl ${s.icon} drop-shadow-md group-hover:scale-110 transition-transform origin-left">
                    <i class="fa-solid ${mix.icon}"></i>
                </div>
                
                <div class="relative z-10">
                    <h3 class="font-bold text-white leading-tight text-sm md:text-base group-hover:text-white transition">${mix.name}</h3>
                    <p class="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1 group-hover:text-zinc-400 transition">
                        ${mix.files.length} canciones
                    </p>
                </div>
                
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center backdrop-blur-[1px]">
                    <div class="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center shadow-2xl scale-50 group-hover:scale-100 transition-transform duration-300">
                        <i class="fa-solid fa-play ml-1 text-sm"></i>
                    </div>
                </div>
            </div>`;
                    });

                    const audioFiles = sectionAudioFiles;
                    const genreMap = {};
                    const artistMap = {};
                    const genreIgnore = new Set(['Otros', 'Unknown', 'Generos']);

                    audioFiles.forEach(f => {
                        const genre = (f.genre_lang || f.genre || '').trim();
                        if (genre && !genreIgnore.has(genre)) {
                            if (!genreMap[genre]) genreMap[genre] = [];
                            genreMap[genre].push(f.path);
                        }
                        const artist = (f.artist || '').trim();
                        if (artist && artist !== 'Desconocido') {
                            if (!artistMap[artist]) artistMap[artist] = [];
                            artistMap[artist].push(f.path);
                        }
                    });

                    const genreMixes = Object.entries(genreMap)
                        .map(([name, paths]) => {
                            const shuffled = shuffleArray(paths).slice(0, 50);
                            return {
                                id: `genre:${normalizeText(name).replace(/\s+/g, '-')}`,
                                name,
                                files: shuffled,
                                count: shuffled.length,
                                cover: shuffled[0]
                            };
                        })
                        .filter(m => m.count >= 3)
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 40);

                    const artistMixes = Object.entries(artistMap)
                        .map(([name, paths]) => {
                            const shuffled = shuffleArray(paths).slice(0, 50);
                            return {
                                id: `artist:${normalizeText(name).replace(/\s+/g, '-')}`,
                                name,
                                files: shuffled,
                                count: shuffled.length,
                                cover: shuffled[0]
                            };
                        })
                        .filter(m => m.count >= 3)
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 40);

                    genreMixes.forEach(m => { customMixes[m.id] = m; });
                    artistMixes.forEach(m => { customMixes[m.id] = m; });

                    if (genreMixes.length > 0) {
                        genreSection.classList.remove('hidden');
                        renderHorizontalMixRow(genreRow, genreMixes);
                    } else {
                        genreSection.classList.add('hidden');
                    }

                    if (artistMixes.length > 0) {
                        artistSection.classList.remove('hidden');
                        renderHorizontalMixRow(artistRow, artistMixes);
                    } else {
                        artistSection.classList.add('hidden');
                    }
                } else {
                    mixesContainer.classList.add('hidden');
                    if (genreSection) genreSection.classList.add('hidden');
                    if (artistSection) artistSection.classList.add('hidden');
                }

                if (!filtered.length) return container.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center py-20 text-emerald-600 gap-4"><i class="fa-solid fa-ghost text-4xl"></i><p>Nada por aquí...</p></div>';

                // Header adaptativo por modo (video vs audio)
                const isVideoMode = currentLibrary === 'video';
                const modeLabelDesktop = document.getElementById('lib-mode-label-desktop');
                const modeLabelMobile = document.getElementById('lib-mode-label-mobile');
                const zoomControls = document.getElementById('lib-zoom-controls');
                const desktopActionsRow = document.getElementById('desktop-actions-row');
                const mobileControlsRow = document.getElementById('mobile-controls-row');
                const audioViewControls = document.getElementById('audio-view-controls');
                const audioActionsHeader = document.getElementById('audio-actions-header');
                const videoPillsRow = document.getElementById('video-pills-row');
                const videoPillsRowMobile = document.getElementById('video-pills-row-mobile');
                const desktopSelectionAnchor = document.getElementById('desktop-selection-anchor');
                const desktopSelectionControls = document.getElementById('desktop-selection-controls');
                const videoPathDepth = (currentPath || '').split('/').filter(Boolean).length;
                const isVideoDetailView = isVideoMode && videoPathDepth >= 3;

                if (desktopSelectionAnchor && desktopSelectionControls && desktopSelectionControls.parentElement !== desktopSelectionAnchor) {
                    desktopSelectionAnchor.appendChild(desktopSelectionControls);
                }

                if (modeLabelDesktop) modeLabelDesktop.classList.toggle('hidden', isVideoMode);
                if (modeLabelMobile) modeLabelMobile.classList.toggle('hidden', isVideoMode);
                if (zoomControls) zoomControls.classList.toggle('hidden', isVideoDetailView);
                const zoomSliderEl = document.getElementById('lib-zoom-slider');
                if (zoomSliderEl) zoomSliderEl.value = String(isVideoMode ? currentVideoZoomIndex : currentZoomIndex);
                if (desktopActionsRow) desktopActionsRow.classList.remove('hidden');
                if (mobileControlsRow) mobileControlsRow.classList.toggle('hidden', isVideoMode);

                // Controles específicos de Audio en el header
                if (audioViewControls) audioViewControls.classList.toggle('hidden', isVideoMode);
                if (audioActionsHeader) audioActionsHeader.classList.add('hidden');

                // Pills de Video en el header (Desktop)
                if (videoPillsRow) {
                    if (isVideoMode && !isVideoDetailView) {
                        videoPillsRow.classList.remove('hidden');
                        videoPillsRow.classList.add('flex');
                    } else {
                        videoPillsRow.classList.add('hidden');
                        videoPillsRow.classList.remove('flex');
                    }
                }
                // Pills de Video en el header (Mobile)
                if (videoPillsRowMobile) {
                    if (isVideoMode && !isVideoDetailView) {
                        videoPillsRowMobile.classList.remove('hidden');
                        videoPillsRowMobile.classList.add('flex');
                    } else {
                        videoPillsRowMobile.classList.add('hidden');
                        videoPillsRowMobile.classList.remove('flex');
                    }
                }
                ['all', 'tracks', 'albums', 'artists', 'playlists'].forEach(s => {
                    const d = document.getElementById('tab-search-dsktp-' + s);
                    const m = document.getElementById('tab-search-mob-' + s);
                    if (d) d.classList.toggle('hidden', isVideoMode);
                    if (m) m.classList.toggle('hidden', isVideoMode);
                });
                document.querySelectorAll('button[onclick="playContext()"], button[onclick="toggleSortMenuDesktop()"], button[onclick="toggleSortMenuMobile()"]').forEach(btn => {
                    btn.classList.toggle('hidden', isVideoMode);
                });

                // --- LÓGICA DE VIDEO MEJORADA (RESPETA LISTA/GRID) ---
                if (currentLibrary === 'video') {
                    // En video dejamos búsqueda global (all) para no mezclar semántica de música.
                    if (searchScope !== 'all') {
                        searchScope = 'all';
                        ['all', 'tracks', 'albums', 'artists', 'playlists'].forEach(s => {
                            const tabDsktp = document.getElementById('tab-search-dsktp-' + s);
                            const tabMob = document.getElementById('tab-search-mob-' + s);
                            [tabDsktp, tabMob].forEach(tab => {
                                if (!tab) return;
                                tab.classList.toggle('border-emerald-500', s === 'all');
                                tab.classList.toggle('text-emerald-400', s === 'all');
                                tab.classList.toggle('border-transparent', s !== 'all');
                                tab.classList.toggle('text-zinc-400', s !== 'all');
                            });
                        });
                    }

                    mixesContainer.classList.add('hidden');
                    const mobileInput = document.getElementById('lib-search-mobile');
                    const desktopInput = document.getElementById('lib-search-desktop');
                    const searchValue = (mobileInput && mobileInput.value) || (desktopInput && desktopInput.value) || '';

                    const videoState = getVideoRenderState(searchValue);
                    const isRoot = videoState.isRoot;
                    const isSearching = videoState.isSearching;
                    const shouldForceVideoList = videoState.shouldForceVideoList;
                    const isEpisodeQuery = videoState.isEpisodeQuery;

                    // === 🍿 VISTA NETFLIX: ROOT ===
                    if (isRoot) {
                        const { categoriesArray, uniqueShows, genresArray } = buildNetflixRootCatalog(filtered);

                        const { categoryMenuHtml, genreMenuHtml } = setupNetflixRootFilters(categoriesArray, genresArray);

                        // Botón dropdown de CATEGORÍAS
                        const categoryDropdownHtml = `
                        <div class="relative shrink-0" data-category-root>
                            <button onclick="toggleCategoryDropdown(event)" 
                                class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold 
                                bg-gradient-to-r from-emerald-500 to-emerald-600 
                                text-white shadow-lg shadow-emerald-500/30
                                hover:from-emerald-400 hover:to-emerald-500 
                                active:scale-95 transition-all duration-200">
                                <i class="fa-solid fa-layer-group"></i>
                                <span>${window.netflixActiveCategory || 'Categorías'}</span>
                                <i class="fa-solid fa-chevron-down text-xs ml-1 transition-transform" data-category-chevron></i>
                            </button>
                            <div data-category-menu class="hidden absolute top-full left-0 mt-2 w-56 
                                bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl 
                                overflow-hidden z-50 max-h-[60vh] overflow-y-auto">
                                ${categoryMenuHtml}
                            </div>
                        </div>
                    `;

                        // Botón dropdown de GÉNEROS (solo si hay géneros)
                        const genreDropdownHtml = genresArray.length > 0 ? `
                        <div class="relative shrink-0" data-genre-root>
                            <button onclick="toggleGenreDropdown(event)" 
                                class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold 
                                bg-gradient-to-r from-cyan-600 to-cyan-700 
                                text-white shadow-lg shadow-cyan-600/30
                                hover:from-cyan-500 hover:to-cyan-600 
                                active:scale-95 transition-all duration-200">
                                <i class="fa-solid fa-tags"></i>
                                <span>${window.netflixGenreFilter || 'Géneros'}</span>
                                <i class="fa-solid fa-chevron-down text-xs ml-1 transition-transform" data-genre-chevron></i>
                            </button>
                            <div data-genre-menu class="hidden absolute top-full left-0 mt-2 w-56 
                                bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl 
                                overflow-hidden z-50 max-h-[60vh] overflow-y-auto">
                                <button onclick="filterByGenre(null)"
                                    class="w-full text-left px-4 py-2.5 text-sm font-bold transition-colors
                                    ${!window.netflixGenreFilter
                                ? 'bg-emerald-500 text-white'
                                : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                            }">Todos</button>
                                ${genreMenuHtml}
                            </div>
                        </div>
                    ` : '';

                        // Botón RECOMENDACIONES
                        const recommendationsBtnHtml = `
                        <div class="relative shrink-0">
                            <button id="recommendations-btn" onclick="toggleRecommendations()" 
                                class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold 
                                bg-gradient-to-r from-violet-600 to-violet-700 
                                text-white shadow-lg shadow-violet-600/30
                                hover:from-violet-500 hover:to-violet-600 
                                active:scale-95 transition-all duration-200 border border-transparent ${videoUIState.recommendationsOpen ? 'ring-2 ring-emerald-400/50' : ''}">
                                <i class="fa-solid fa-wand-magic-sparkles"></i>
                                <span>Descubre hoy</span>
                            </button>
                        </div>
                    `;

                        // ─── FUNCIÓN MARATÓN ───────────────────────────────────────────
                        setupNetflixMarathon(uniqueShows);

                        // Botón Maratón (píldora ámbar integrada al grupo de filtros)
                        const marathonBtnHtml = `
                        <div class="relative shrink-0">
                            <button onclick="shuffleVideoMarathon()"
                                class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold
                                bg-gradient-to-r from-amber-500 to-orange-500
                                text-white shadow-lg shadow-amber-500/30
                                hover:from-amber-400 hover:to-orange-400
                                active:scale-95 transition-all duration-200">
                                <i class="fa-solid fa-shuffle"></i>
                                <span>Maratón</span>
                            </button>
                        </div>
                    `;

                        const pillsHtml = buildNetflixPillsHtml(
                            categoryDropdownHtml,
                            genreDropdownHtml,
                            recommendationsBtnHtml,
                            marathonBtnHtml
                        );

                        // ── Inyectar pills en el header sticky (video-pills-row) ──────────
                        const pillsContainer = document.getElementById('video-pills-row');
                        if (pillsContainer) {
                            pillsContainer.innerHTML = pillsHtml.desktop;
                            const videoSelectionAnchor = document.getElementById('video-selection-anchor');
                            if (isVideoMode && videoSelectionAnchor && desktopSelectionControls) {
                                videoSelectionAnchor.appendChild(desktopSelectionControls);
                            }
                        }
                        // ── Inyectar pills en el header MOBILE ──────────
                        const pillsContainerMobile = document.getElementById('video-pills-row-mobile');
                        if (pillsContainerMobile) {
                            pillsContainerMobile.innerHTML = pillsHtml.mobile;
                        }

                        if (!isSearching) {
                            container.className = "flex flex-col gap-6 md:gap-10 pb-10 overflow-x-hidden w-full";

                            // Guardia: si no hay contenido en esta categoría/género, mostrar mensaje
                            if (uniqueShows.length === 0) {
                                container.innerHTML += '<div class="text-zinc-500 text-center py-10 w-full"><i class="fa-solid fa-ghost text-4xl mb-4 block"></i>Vacío. No hay videos en esta categoría.</div>';
                                return;
                            }

                        // 5. HERO BANNER (Modular - hero_series.js)
                        const recentShows = [...uniqueShows].sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, 30);
                        const heroItem = recentShows[Math.floor(Math.random() * recentShows.length)];

                        appendNetflixHero(container, heroItem);
                        appendContinueWatchingSection(container);


                        // 7. FILTRAR POR BÚSQUEDA Y GÉNERO
                        let showsToDisplay = uniqueShows;

                        // Filtrar por término de búsqueda leyendo de las barras globales
                        const mobileInputSearch = document.getElementById('lib-search-mobile');
                        const desktopInputSearch = document.getElementById('lib-search-desktop');
                        const term = normalizeText((mobileInputSearch && mobileInputSearch.value) || (desktopInputSearch && desktopInputSearch.value) || '');
                        if (term) {
                            showsToDisplay = showsToDisplay.filter(show => {
                                const src = show.sample ? show.sample : show;
                                const title = normalizeText(show.name || show.title || '');
                                const genre = normalizeText(src.genre || '');
                                return title.includes(term) || genre.includes(term);
                            });
                        }

                        // Filtrar por género si hay filtro activo
                        if (window.netflixGenreFilter) {
                            showsToDisplay = showsToDisplay.filter(show => {
                                const src = show.sample ? show.sample : show;
                                const genres = (src.genre || '').split(',').map(s => s.trim());
                                return genres.includes(window.netflixGenreFilter);
                            });
                        }

                        // 8. GRID PLANO CON TODOS LOS SHOWS (render por lotes para evitar congelamientos)
                        showsToDisplay.sort((a, b) => ((a.name || a.title) || '').localeCompare((b.name || b.title) || '', undefined, { sensitivity: 'base' }));
                        appendNetflixRecommendationsSection(container, uniqueShows);
                        appendNetflixGrid(container, showsToDisplay);

                            observeLazyImages(container);
                            return; // Terminar aquí, ya no procesa el Grid viejo!
                        }
                    }

                    // === 🔎 BÚSQUEDA EN ROOT DE VIDEO: priorizar SERIES/PELÍCULAS (no episodios sueltos) ===
                    if (isSearching && isRoot && !isEpisodeQuery) {
                        renderVideoRootSearchResults(container, filtered, searchValue);
                        return;
                    }

                    // === 📁 VISTA DIRECTORIO NORMAL (Navegando dentro de una carpeta o Buscando) ===
                    // 1. CONFIGURAR EL CONTENEDOR SEGÚN LA VISTA ACTIVA
                    // Video siempre usa flex-col (episodios tipo lista). Música respeta grid/list.
                    if (shouldForceVideoList) {
                        container.className = "flex flex-col gap-2";
                    } else {
                        const gridSizeClass = videoZoomLevels[currentVideoZoomIndex] || videoZoomLevels[1];
                        container.className = `grid ${gridSizeClass} gap-3 md:gap-4`;
                    }

                    // 2. BARRA DE NAVEGACIÓN Y BOTÓN "SUBIR"
                    renderVideoPathHeader(container, shouldForceVideoList);



                    // 3. FILTRAR Y AGRUPAR ARCHIVOS
                    const { groups, directFiles } = buildVideoDirectoryGroups(filtered, isSearching);
                    // ============================================================
                    if (currentPath === "" && directFiles.length === 0 && Object.keys(groups).length === 1) {
                        const uniqueFolder = Object.keys(groups)[0];
                        // Solo saltamos si la carpeta se llama "Video" (o si quieres que salte cualquier carpeta única)
                        // [FIX]: Desactivado para la Vista Netflix, ya que queremos ver el carrusel principal incluso si solo hay 1 carpeta raíz
                        /*
                        if (uniqueFolder === 'Video') {
                            currentPath = uniqueFolder + "/";
                            renderLib(); // Recargamos inmediatamente con la nueva ruta
                            return;
                        }
                        */
                    }

                    // 3.5 HEADER DE DETALLE (misma estética Netflix) + selector de temporada
                    renderVideoDetailHeroAndSeasonControls(container, filtered);

                    // 4. RENDERIZAR CARPETAS (Niveles altos)
                    renderVideoFolderGroups(container, groups, shouldForceVideoList);

                    // 5. RENDERIZAR TEMPORADAS (Lista de episodios estilo Netflix)
                    const seasonNames = Object.keys(groups).sort();
                    const isDetailSeasonView = currentPath.split('/').filter(Boolean).length >= 3;
                    const SEASON_EPISODE_BATCH = 60;
                    if (!window.seasonEpisodeRenderLimits) window.seasonEpisodeRenderLimits = {};
                    /**
                     * `loadMoreSeasonEpisodes(showPathEncoded, seasonEncoded, step = SEASON_EPISODE_BATCH)`
                     * Carga más episodios dentro de la lista de una temporada extensa.
                     */
                    window.loadMoreSeasonEpisodes = function (showPathEncoded, seasonEncoded, step = SEASON_EPISODE_BATCH) {
                        const showPath = decodeURIComponent(showPathEncoded || '');
                        const seasonName = decodeURIComponent(seasonEncoded || '');
                        const safeStep = Number(step) > 0 ? Number(step) : SEASON_EPISODE_BATCH;
                        const key = `${showPath}::${seasonName}`;
                        const prev = Math.max(SEASON_EPISODE_BATCH, Number(window.seasonEpisodeRenderLimits[key] || SEASON_EPISODE_BATCH));
                        window.seasonEpisodeRenderLimits[key] = prev + safeStep;
                        renderLib();
                    };

                    // GENERADOR DE PILLS DE TEMPORADAS
                    if (!isDetailSeasonView && seasonNames.filter(n => groups[n].isSeason).length > 1) {
                        const seasonPills = seasonNames
                            .filter(n => groups[n].isSeason)
                            .map(name => {
                                const isActive = currentFolderView === name;
                                return `<button onclick="goToSeason('${name}')" class="px-3 py-1.5 rounded-full text-xs font-bold transition ${isActive ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}">${name}</button>`;
                            }).join('');

                        container.innerHTML += `
                        <div class="col-span-full mb-4 flex flex-wrap gap-2 items-center">
                            <span class="text-xs font-bold text-emerald-400 uppercase tracking-wider mr-2">Temporadas:</span>
                            ${seasonPills}
                        </div>`;
                    }

                    // Función para navegar a temporada
                    /**
                     * `goToSeason(seasonName)`
                     * Cambia la temporada activa en la vista detallada de una serie.
                     */
                    window.goToSeason = function (seasonName) {
                        const safeName = seasonName.replace(/[^a-zA-Z0-9]/g, '-');
                        const el = document.getElementById('season-' + safeName);
                        if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            currentFolderView = seasonName;
                        }
                    };

                    seasonNames.forEach(name => {
                        if (groups[name].isSeason) {
                            const safeName = name.replace(/[^a-zA-Z0-9]/g, '-');
                            container.innerHTML += `
                        <div id="season-${safeName}" class="col-span-full mt-6 mb-2 flex items-center gap-4 border-b border-white/10 pb-2">
                            <h3 class="text-xl font-bold text-emerald-400 tracking-wider uppercase"><i class="fa-solid fa-layer-group mr-2"></i>${name}</h3>
                            <span class="text-xs text-emerald-500 font-mono bg-emerald-900 px-2 py-1 rounded-full">${groups[name].files.length} caps</span>
                        </div>`;

                            const sortedFiles = groups[name].files.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));

                            const seasonKey = `${currentPath}::${name}`;
                            const seasonLimit = Math.max(
                                SEASON_EPISODE_BATCH,
                                Number(window.seasonEpisodeRenderLimits[seasonKey] || SEASON_EPISODE_BATCH)
                            );
                            const visibleEpisodes = sortedFiles.slice(0, seasonLimit);
                            const encodedPath = encodeURIComponent(currentPath);
                            const encodedSeason = encodeURIComponent(name);

                            // Usar vista de episodios para video, o el formato normal para otros
                            container.innerHTML += `
                                <div class="col-span-full flex flex-col gap-1">
                                    ${visibleEpisodes.map((f, idx) => createEpisodeRow(f, idx + 1)).join('')}
                                </div>
                            `;
                            if (sortedFiles.length > seasonLimit) {
                                const pendingEpisodes = sortedFiles.length - seasonLimit;
                                container.innerHTML += `
                                    <div class="col-span-full flex justify-center mt-2 mb-1">
                                        <button onclick="loadMoreSeasonEpisodes('${encodedPath}','${encodedSeason}',${SEASON_EPISODE_BATCH})"
                                            class="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-white/90 text-xs font-bold transition">
                                            ➕ Cargar más en ${escapeHtml(name)} (${Math.min(SEASON_EPISODE_BATCH, pendingEpisodes)} más)
                                        </button>
                                    </div>
                                `;
                            }
                        }
                    });

                    // 6. RENDERIZAR ARCHIVOS SUELTOS
                    if (directFiles.length > 0) {
                        if (Object.keys(groups).length > 0) {
                            container.innerHTML += `<div class="col-span-full mt-6 mb-2 text-sm font-bold text-emerald-400 uppercase tracking-widest border-b border-white/10 pb-1">Otros Archivos</div>`;
                        }
                        const filesToRender = isSearching ? directFiles : directFiles.sort((a, b) => a.title.localeCompare(b.title));
                        filesToRender.forEach((f, idx) => {
                            if (shouldForceVideoList) container.innerHTML += createEpisodeRow(f, idx + 1);
                            else container.innerHTML += createCard(f);
                        });
                    }

                    // ✅ Lazy load y salir SOLO del bloque de video
                    observeLazyImages(container);

                    return;
                } // ⬅️ ESTA LLAVE FALTABA - cierra el if (currentLibrary === 'video')

                // --- LÓGICA POR DEFECTO (AUDIO LISTA/GRID) ---
                let filesToShow = filtered.slice(0, renderLimit);

                if (viewMode === 'list') {
                    container.className = "space-y-1";
                    container.innerHTML = filesToShow.map(f => createListRow(f)).join('');
                } else {
                    container.className = `grid ${zoomLevels[currentZoomIndex]} gap-4`;
                    container.innerHTML = filesToShow.map(f => createCard(f)).join('');
                }

                // Botón “Cargar más”
                if (filtered.length > renderLimit) {
                    container.innerHTML += `
        <div class="col-span-full flex justify-center mt-6">
            <button onclick="cargarMas()" 
                class="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-xl transition font-bold">
                ➕ Cargar más (${Math.min(renderStep, filtered.length - renderLimit)} más)
            </button>
        </div>`;

                }


                // Lazy load de carátulas
                observeLazyImages();




            }
            /**
             * `cargarMas()`
             * Incrementa el límite de elementos renderizados (`renderLimit`) para paginación infinita.
             */
            function cargarMas() {
                renderLimit += renderStep;
                renderLib();
            }

            /**
             * `resetRenderLimit()`
             * Restablece el límite de renderizado inicial al cambiar de vista o filtro.
             */
            function resetRenderLimit() {
                renderLimit = renderStep;
            }

            /**
             * `mostrarTodos()`
             * Renderiza la totalidad de los elementos filtrados sin límite de paginación.
             */
            function mostrarTodos() {
                window.showAllFiles = true;
                renderLib();
            }
            /**
             * `getCoverUrl(f)`
             * Construye la URL de carátula o miniatura (TMDB o local) para un archivo multimedia.
             */
            function getCoverUrl(f) {
                // Para shows de series: usar tmdb_poster del show directamente
                if (f.tmdb_poster) {
                    return `/caratula/${encodeURIComponent(f.tmdb_poster)}`;
                }
                // Para episodios individuales: usar sample si existe
                const source = f.sample ? f.sample : f;
                if (source.tmdb_poster) {
                    return `/caratula/${encodeURIComponent(source.tmdb_poster)}`;
                }
                // Fallback: usar path del archivo (genera thumbnail del video)
                const sourcePath = source ? source.path : f.path;
                return `/caratula/${sourcePath.split('/').map(p => encodeURIComponent(p)).join('/')}`;
            }

            /**
             * `showVideoInfoFromCard(path)`
             * Abre el panel/modal de detalles TMDB (sinopsis, reparto, puntuación) desde una tarjeta de video.
             */
            function showVideoInfoFromCard(path) {
                try {
                    if (currentLibrary !== 'video' || typeof openHeroInfoForItem !== 'function') return;
                    let infoHost = document.getElementById('video-info-inline-host');
                    if (!infoHost) {
                        const container = document.getElementById('lib-container');
                        if (container) {
                            container.insertAdjacentHTML('afterbegin', '<div id="video-info-inline-host" class="hidden w-full mb-4"></div>');
                            infoHost = document.getElementById('video-info-inline-host');
                        }
                    }
                    if (typeof setVideoInfoHost === 'function') setVideoInfoHost('video-info-inline-host');

                    const normalized = (path || '').replace(/\\/g, '/');
                    const files = (libData && Array.isArray(libData.files)) ? libData.files : [];
                    let sample = files.find(f => (f.path || '').replace(/\\/g, '/') === normalized);

                    // Si es carpeta, buscamos un archivo dentro de esa ruta para extraer tmdb/metadata.
                    if (!sample) {
                        const folderPrefix = normalized.endsWith('/') ? normalized : (normalized + '/');
                        sample = files.find(f => (f.path || '').replace(/\\/g, '/').startsWith(folderPrefix));
                    }

                    if (!sample) return;

                    const heroItem = {
                        type: sample.type === 'video' ? 'video' : 'folder',
                        name: sample.tmdb_title || sample.clean_title || sample.title,
                        title: sample.tmdb_title || sample.clean_title || sample.title,
                        path: normalized,
                        sample: sample,
                        folder_type: sample.folder_type,
                        tmdb_id: sample.tmdb_id,
                        tmdb_poster: sample.tmdb_poster
                    };

                    openHeroInfoForItem(heroItem).catch(() => { });
                } catch (e) {
                    console.warn('[VIDEO] showVideoInfoFromCard failed:', e);
                }
            }

            window.krakenVideoProgress = window.krakenVideoProgress || {};
            window.krakenVideoPreviewCache = window.krakenVideoPreviewCache || {};

            /**
             * `loadVideoCardPreview(card)`
             * Carga de forma asíncrona metadatos cortos de TMDB (año, rating) en las tarjetas de video.
             */
            function loadVideoCardPreview(card) {
                if (!card || window.matchMedia('(hover: none)').matches) return;
                const tmdbId = card.dataset.previewId;
                if (!tmdbId) return;
                const preview = card.querySelector('.krk-video-hover-preview');
                if (!preview || preview.dataset.loaded === '1') return;
                const mediaType = card.dataset.previewType === 'tv' ? 'tv' : 'movie';
                const cached = window.krakenVideoPreviewCache[`${mediaType}_${tmdbId}`];
                if (cached) {
                    preview.style.backgroundImage = `url("${cached}")`;
                    preview.dataset.loaded = '1';
                    return;
                }
                fetch(`/api/tmdb/details?id=${encodeURIComponent(tmdbId)}&type=${mediaType}`)
                    .then(response => response.ok ? response.json() : null)
                    .then(data => {
                        const backdrop = data && data.backdrop;
                        if (!backdrop || !preview.isConnected) return;
                        window.krakenVideoPreviewCache[`${mediaType}_${tmdbId}`] = backdrop;
                        preview.style.backgroundImage = `url("${backdrop}")`;
                        preview.dataset.loaded = '1';
                    })
                    .catch(() => { });
            }

            /**
             * `installVideoKeyboardShortcuts()`
             * Registra atajos de teclado globales (Espacio, Flechas, F, M, Escape) para el reproductor de video.
             */
            function installVideoKeyboardShortcuts() {
                if (window.__krakenVideoShortcutsBound) return;
                window.__krakenVideoShortcutsBound = true;
                document.addEventListener('keydown', (event) => {
                    const target = event.target;
                    if (target && (target.matches('input, textarea, select, button, [contenteditable="true"]') || target.closest('[role="dialog"]'))) return;
                    const player = window.currentArtPlayer;
                    const view = document.getElementById('view-player');
                    if (!player || !view || view.classList.contains('hidden') || !player.video) return;
                    const video = player.video;
                    const key = event.key.toLowerCase();
                    if (key === ' ' || key === 'k') {
                        event.preventDefault();
                        video.paused ? player.play() : player.pause();
                    } else if (key === 'arrowleft') {
                        event.preventDefault();
                        video.currentTime = Math.max(0, video.currentTime - 10);
                    } else if (key === 'arrowright') {
                        event.preventDefault();
                        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
                    } else if (key === 'arrowup') {
                        event.preventDefault();
                        player.volume = Math.min(1, (player.volume || 0) + 0.1);
                    } else if (key === 'arrowdown') {
                        event.preventDefault();
                        player.volume = Math.max(0, (player.volume || 0) - 0.1);
                    } else if (key === 'm') {
                        event.preventDefault();
                        video.muted = !video.muted;
                    } else if (key === 'f') {
                        event.preventDefault();
                        toggleVideoFullscreen();
                    }
                });
            }
            installVideoKeyboardShortcuts();

            /**
             * `appendContinueWatchingSection(container)`
             * Obtiene y renderiza la fila 'Seguir viendo' con el progreso guardado del usuario.
             */
            async function appendContinueWatchingSection(container) {
                if (currentLibrary !== 'video' || currentPath !== '' || !container) return;
                try {
                    const response = await fetch('/api/progress/continue-watching', { cache: 'no-store' });
                    if (!response.ok) return;
                    const payload = await response.json();
                    const items = Array.isArray(payload.items) ? payload.items : [];
                    if (!items.length || !container.isConnected) return;

                    items.forEach(item => {
                        window.krakenVideoProgress[item.id] = item;
                    });

                    const section = document.createElement('section');
                    section.className = 'w-full mb-7';
                    section.innerHTML = `
                        <div class="flex items-center justify-between mb-3 px-1">
                            <h2 class="text-white text-lg md:text-xl font-black tracking-tight">Seguir viendo</h2>
                            <span class="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Guardado en tu cuenta</span>
                        </div>
                        <div class="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                            ${items.map(item => {
                                const title = item.tmdb_title || item.title || 'Video';
                                const pct = item.duration_seconds > 0
                                    ? Math.max(0, Math.min(100, Math.round((item.progress_seconds / item.duration_seconds) * 100)))
                                    : 0;
                                const poster = item.tmdb_poster
                                    ? `/caratula/${encodeURIComponent(item.tmdb_poster)}`
                                    : `/caratula/${String(item.rel_path || '').split('/').map(p => encodeURIComponent(p)).join('/')}`;
                                return `
                                        <article class="krk-video-card relative shrink-0 w-64 md:w-72 bg-[#121212] border border-white/10 rounded-xl overflow-visible shadow-lg hover:border-emerald-500/40 transition group"
                                        data-preview-id="${escapeHtml(item.tmdb_id || '')}"
                                        data-preview-type="${item.folder_type === 'series' ? 'tv' : 'movie'}">
                                        <div class="relative aspect-video overflow-hidden rounded-t-xl bg-[#0a0a0a]">
                                            <img src="${poster}" loading="lazy" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition duration-500" alt="">
                                            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                                            <button class="absolute left-3 bottom-3 w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition z-20" data-path="${escapeHtml(item.rel_path || '')}" data-resume="${item.progress_seconds || 0}" onclick="event.stopPropagation(); playNow(this.dataset.path, Number(this.dataset.resume))" aria-label="Continuar ${escapeHtml(title)}">
                                                <i class="fa-solid fa-play ml-0.5"></i>
                                            </button>
                                            <div class="absolute left-3 right-3 bottom-2 h-1 rounded-full bg-white/25 z-10"><span class="block h-full rounded-full bg-emerald-400" style="width:${pct}%"></span></div>
                                        </div>
                                        <div class="p-3">
                                            <h3 class="text-white font-bold text-sm truncate">${escapeHtml(title)}</h3>
                                            <p class="text-zinc-500 text-[11px] mt-1">${pct}% visto</p>
                                        </div>
                                    </article>`;
                            }).join('')}
                        </div>`;
                    const firstGrid = container.querySelector('.grid');
                    if (firstGrid) firstGrid.before(section);
                    else container.appendChild(section);
                } catch (error) {
                    console.warn('[VIDEO] Continue watching unavailable:', error);
                }
            }

            /**
             * `createCard(f)`
             * Genera el HTML de una tarjeta multimedia (póster de video o carátula cuadrada de audio).
             */
            function createCard(f) {
                const safePath = escapeStr(f.path);
                const coverUrl = getCoverUrl(f);
                const source = f.sample ? f.sample : f;
                const isVideoCard = currentLibrary === 'video';
                const progressSource = isVideoCard
                    ? (window.krakenVideoProgress[f.id] || window.krakenVideoProgress[source.id] || {})
                    : {};
                const previewTmdbId = f.tmdb_id || source.tmdb_id || '';
                const previewType = (f.folder_type || source.folder_type) === 'series' ? 'tv' : 'movie';
                const isMovieFolder = f.folder_type === 'movie';
                const isSel = selectedFiles.has(f.path) ? 'ring-2 ring-emerald-500 bg-emerald-900/20' : 'bg-[#121212]';
                const progressSeconds = Number(f.progress_seconds || progressSource.progress_seconds || 0);
                const durationSeconds = Number(f.duration_seconds || progressSource.duration_seconds || 0);
                const progressPct = isVideoCard && durationSeconds > 0
                    ? Math.max(0, Math.min(100, Math.round((progressSeconds / durationSeconds) * 100)))
                    : 0;

                // TMDB RATING
                const ratingVal = f.tmdb_rating;
                let ratingBadge = '';
                if (ratingVal) {
                    let rColor = 'bg-emerald-600/80 border-emerald-500/50';
                    if (['R', 'NC-17', 'C', 'D', '18', '16', '16+', '18+', 'MA15+', 'R18+', 'R15+'].includes(ratingVal)) rColor = 'bg-red-600/80 border-red-500/50';
                    else if (['PG-13', 'B-15', 'B', 'M', 'TV-MA', 'TV-14'].includes(ratingVal)) rColor = 'bg-orange-500/80 border-orange-500/50';
                    else if (['PG', 'A'].includes(ratingVal)) rColor = 'bg-blue-500/80 border-blue-500/50';
                    ratingBadge = `<div class="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded ${rColor} backdrop-blur text-white text-[10px] font-bold tracking-wider shadow-lg border uppercase">${escapeHtml(ratingVal)}</div>`;
                }

                const duplicateBadge = f.duplicate_kind ? `
                    <div class="absolute top-2 right-10 z-20 w-6 h-6 rounded-full bg-amber-500/90 text-black flex items-center justify-center shadow-lg"
                         title="${f.duplicate_kind === 'exact' ? 'Mismo archivo en otra ruta' : 'Posible duplicado'}">
                        <i class="fa-solid fa-copy text-[10px]"></i>
                    </div>` : '';

                // ⭐ INDICADOR DE FAVORITO (Corazón en la esquina)
                const isFavorite = f.rating === 1;
                const favBadge = isFavorite ? `
        <div class="absolute top-2 ${ratingVal ? 'left-12' : 'left-2'} z-20 w-6 h-6 bg-black/60 backdrop-blur rounded-full flex items-center justify-center animate-pulse">
            <i class="fa-solid fa-heart text-emerald-400 text-xs drop-shadow-[0_0_6px_rgba(16,185,129,0.9)]"></i>
        </div>` : '';

                const genreValue = (source.genre_lang || source.genre || f.genre_lang || f.genre || '').split(',')[0].trim();
                const genreTag = genreValue ? `<span class="text-[9px] text-emerald-500 bg-emerald-900/20 px-1.5 rounded">${escapeHtml(genreValue)}</span>` : '';
                const inPlaylistIcon = f.playlists && f.playlists.length > 0 ? `<i class="fa-solid fa-check-circle text-[9px] text-emerald-400 ml-1 opacity-80" title="En playlist"></i>` : '';

                let pName = null;
                if (typeof currentLibrary !== 'undefined' && currentLibrary.startsWith('playlist:')) {
                    pName = currentLibrary.split(':')[1];
                } else if (typeof filters !== 'undefined' && filters.playlist && filters.playlist !== 'all') {
                    pName = filters.playlist;
                }

                let removeBtn = '';
                if (pName) {
                    // Usamos data-path para pasar la ruta SIN escapar al JS
                    removeBtn = `<button 
            onclick="event.stopPropagation(); quitarDeListaRow('${escapeStr(pName)}', this.dataset.path, event)" 
            data-path="${escapeHtml(f.path)}"
            class="w-7 h-7 bg-black/60 backdrop-blur rounded-full flex items-center justify-center text-white hover:scale-110 hover:text-orange-500 transition" 
            title="Quitar de '${escapeHtml(pName)}'">
            <i class="fa-solid fa-minus text-[10px]"></i>
        </button>`;
                }

                // ============================================================
                // 🎨 BOTONES LIMPIOS (Fix Comillas + Sin Offline)
                // ============================================================

                // 1. VACUNA ANTI-COMILLAS (Indispensable)
                const clickPath = safePath.replace(/'/g, "\\'");

                // 2. Botones con data-path para evitar problemas de escapado
                const favBtn = `<button 
        onclick="event.stopPropagation(); toggleCardFavorite(this.dataset.path)" 
        data-path="${escapeHtml(f.path)}"
        class="w-7 h-7 bg-black/60 backdrop-blur rounded-full flex items-center justify-center text-white hover:scale-110 transition ${isFavorite ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'hover:text-emerald-400'}" 
        title="${isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}">
        <i class="fa-${isFavorite ? 'solid' : 'regular'} fa-heart text-[10px]"></i>
    </button>`;

                const queueBtn = `<button 
        onclick="event.stopPropagation(); enqueue(this.dataset.path)" 
        data-path="${escapeHtml(f.path)}"
        class="w-7 h-7 bg-black/60 backdrop-blur rounded-full flex items-center justify-center text-white hover:scale-110 hover:text-emerald-400 transition" 
        title="Encolar">
        <i class="fa-solid fa-layer-group text-[10px]"></i>
    </button>`;

                const radioBtn = `<button 
        onclick="event.stopPropagation(); crearRadioArtista(this.dataset.artist)" 
        data-artist="${escapeHtml(f.artist)}"
        class="w-7 h-7 bg-black/60 backdrop-blur rounded-full flex items-center justify-center text-white hover:scale-110 hover:text-cyan-400 transition" 
        title="Radio del Artista">
        <i class="fa-solid fa-tower-broadcast text-[10px]"></i>
    </button>`;

                const videoInfoCta = '';

                const editBtn = `<button 
        onclick="event.stopPropagation(); abrirEditorMasivo(this.dataset.path)" 
        data-path="${escapeHtml(f.path)}"
        class="w-7 h-7 bg-black/60 backdrop-blur rounded-full flex items-center justify-center text-white hover:scale-110 hover:text-yellow-400 transition" 
        title="Editar Info">
        <i class="fa-solid fa-pen-to-square text-[10px]"></i>
    </button>`;

                // EL BOTÓN DEL MENÚ (Usa data-path)
                const menuBtn = `<button 
        onclick="openContextMenu(event, this.dataset.path)" 
        data-path="${escapeHtml(f.path)}"
        class="w-7 h-7 bg-black/60 backdrop-blur rounded-full flex items-center justify-center text-white hover:scale-110 transition hover:text-white pointer-events-auto" 
        title="Más opciones">
        <i class="fa-solid fa-ellipsis-vertical text-[10px]"></i>
    </button>`;

                // 3. AGRUPAR (Z-Index alto)
                const actionBtns = selectionMode ? '' : `
    <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex flex-col gap-1 z-[200]">
        ${favBtn}
        ${queueBtn}
        ${currentLibrary === 'video' ? '' : radioBtn}
        ${editBtn}
        ${menuBtn}
    </div>`;

                // Lógica para movie vs series: movie_folder = 1 click, series_folder = navegar
                const clickAction = isMovieFolder
                    ? `playNow('${escapeStr(f.path)}')`
                    : (f.type === 'folder' ? `currentPath='${escapeStr(f.path)}'; renderLib();` : `playNow(this.dataset.path)`);
                const folderIcon = isMovieFolder ? 'fa-play ml-1' : 'fa-folder-open';
                const movieDetailPath = ((f.path || '').replace(/\\/g, '/').split('/').slice(0, 3).join('/') + '/');
                const movieInfoHoverBtn = (currentLibrary === 'video' && isMovieFolder) ? `
                <button onclick="event.stopPropagation(); currentPath='${escapeStr(movieDetailPath)}'; renderLib();"
                        class="px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white text-[11px] font-bold transition-all duration-200 mb-1">
                    <i class="fa-solid fa-circle-info mr-1"></i> Más información
                </button>` : '';
                const hoverPreview = isVideoCard && previewTmdbId ? `
            <div class="krk-video-hover-preview" data-preview-card aria-hidden="true">
                <div class="absolute inset-x-3 bottom-3 z-10 text-left">
                    <div class="text-white text-sm font-bold truncate">${escapeHtml(f.tmdb_title || f.clean_title || f.title || 'Video')}</div>
                    <div class="text-white/70 text-[10px] mt-1">Vista previa informativa</div>
                </div>
            </div>` : '';

                return `
    <div class="${isSel} ${isVideoCard ? 'krk-video-card' : ''} p-3 rounded-xl hover:bg-[#1e1e1e] transition duration-300 group cursor-pointer relative shadow-lg border border-white/5 hover:border-white/10"
         data-preview-id="${escapeHtml(previewTmdbId)}"
         data-preview-type="${previewType}"
         onmouseenter="loadVideoCardPreview(this)"
         data-path="${escapeHtml(f.path)}"
         onclick="${clickAction}">
        ${hoverPreview}
        <div class="relative w-full ${currentLibrary === 'video' ? 'aspect-[2/3]' : 'aspect-square'} bg-[#0a0a0a] rounded-lg overflow-hidden mb-2 shadow-inner flex items-center justify-center">
            ${ratingBadge}
                ${duplicateBadge}
                ${favBadge}
            <img data-src="${coverUrl}"
                 class="lazy-img w-full h-full object-cover transition duration-500 group-hover:scale-105 z-10 relative"
                 onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden'); this.nextElementSibling.classList.add('flex')">
            
            <div class="absolute inset-0 hidden items-center justify-center bg-emerald-800 z-0"><i class="fa-solid ${f.type === 'video' ? 'fa-film' : (f.type === 'folder' ? 'fa-folder' : 'fa-music')} text-4xl text-white/50"></i></div>
            
            <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center backdrop-blur-[2px] z-20 gap-2">
                ${selectionMode ? '<i class="fa-regular fa-square-check text-4xl text-white"></i>' : `${movieInfoHoverBtn}<div class="w-10 h-10 bg-emerald-500 text-black rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition"><i class="fa-solid ${folderIcon}"></i></div>`}
            </div>
            ${progressPct > 0 ? `<div class="krk-video-card-progress"><span style="width:${progressPct}%"></span></div>` : ''}
        </div>
        
        <h3 class="font-bold text-white truncate text-xs mb-0.5 leading-tight flex items-center gap-1">
            ${escapeHtml(f.clean_title || f.tmdb_title || (f.title || '').replace(/\s*[\(\[\{]?tmdb[-_]?\d+[\)\]]?/gi, '').trim())} ${inPlaylistIcon}
        </h3>
        ${videoInfoCta}
        
        <div class="flex justify-between items-center">
    <button onclick="event.stopPropagation(); verArtista(this.dataset.artist)" 
            data-artist="${escapeHtml(f.artist)}"
            class="text-[10px] text-emerald-400 truncate flex-1 text-left hover:text-white hover:underline transition z-20 relative">
        ${f.type === 'video' ? escapeHtml((f.artist || '').replace(/\s*[\(\[\{]?tmdb[-_]?\d+[\)\]]?/gi, '').trim() || 'Video') : escapeHtml(f.artist)}
    </button>
    ${genreTag}
</div>
        
        ${actionBtns}
    </div>`;
            }

            /* --- EPISODE ROW (Netflix-style para capítulos de series) --- */
            function createEpisodeRow(f, index) {
                const coverUrl = getCoverUrl(f);
                const duration = f.duration || '';
                const isFavorite = f.rating === 1;
                const favHeart = isFavorite ? `<i class="fa-solid fa-heart text-emerald-400 text-xs ml-2"></i>` : '';
                const isSelected = selectedFiles.has(f.path);

                return `
    <div class="group flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition cursor-pointer border border-transparent hover:border-white/10"
         data-path="${escapeHtml(f.path)}"
         onclick="${selectionMode ? 'event.stopPropagation(); selectRow(this.dataset.path)' : 'playNow(this.dataset.path)'}">
        
        ${selectionMode ? `
        <!-- Checkbox -->
        <div class="w-8 h-8 flex items-center justify-center cursor-pointer rounded hover:bg-white/10 ${isSelected ? 'text-emerald-400' : 'text-zinc-500'}">
            <i class="fa-${isSelected ? 'solid' : 'regular'} fa-check-square text-xl"></i>
        </div>
        ` : ''}
        
        <!-- Número -->
        <span class="text-zinc-600 font-bold text-lg w-8 text-center shrink-0 group-hover:text-emerald-400 transition">${index}</span>
        
        <!-- Miniatura -->
        <div class="relative w-28 sm:w-36 aspect-video bg-[#0a0a0a] rounded-lg overflow-hidden shrink-0 shadow-md">
            <img data-src="${coverUrl}"
                 class="lazy-img w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                 onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden')">
            <div class="absolute inset-0 hidden items-center justify-center bg-zinc-900">
                <i class="fa-solid fa-film text-2xl text-zinc-600"></i>
            </div>
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                <div class="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center shadow-lg">
                    <i class="fa-solid fa-play ml-0.5 text-xs"></i>
                </div>
            </div>
        </div>
        
        <!-- Info -->
        <div class="flex-1 min-w-0">
            <h4 class="text-white font-semibold text-sm truncate group-hover:text-emerald-400 transition">${f.title}${favHeart}</h4>
            <p class="text-zinc-500 text-xs mt-0.5">${duration}${f.size ? ' · ' + f.size : ''}</p>
        </div>
        
        <!-- Menú -->
        <button onclick="openContextMenu(event, this.dataset.path)"
                data-path="${escapeHtml(f.path)}"
                class="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-white rounded-full hover:bg-white/10 transition opacity-0 group-hover:opacity-100 shrink-0"
                title="Más opciones">
            <i class="fa-solid fa-ellipsis-vertical text-sm"></i>
        </button>
    </div>`;
            }

            /* --- REEMPLAZAR LA FUNCIÓN createListRow --- */
            function createListRow(f) {
                // 🛡️ VACUNA TOTAL: Usamos encodeURIComponent. 
                // Esto convierte "Guns N' Roses" en "Guns%20N'%20Roses" para que no rompa el HTML.
                const pathEncoded = encodeURIComponent(f.path);

                // Para la imagen, también codificamos cada parte de la ruta
                const coverUrl = getCoverUrl(f);

                const isSel = selectedFiles.has(f.path) ? 'selected border-l-4 border-emerald-500 bg-emerald-900/20' : 'border-l-4 border-transparent';
                const isFavorite = f.rating === 1;

                // 1. GÉNERO (Tu diseño original)
                const genreTag = f.genre ?
                    `<div class="hidden lg:flex items-center mr-6">
            <span class="text-[9px] text-emerald-400 border border-emerald-700/50 bg-emerald-900/30 px-2 py-0.5 rounded-full hover:border-emerald-500 hover:text-emerald-400 transition cursor-default tracking-wide uppercase">
                ${f.genre}
            </span>
         </div>` : '';

                // 2. REPRODUCCIONES
                const plays = f.play_count || 0;
                const playsHtml = `
        <div class="hidden md:flex items-center justify-end w-16 text-emerald-500 text-[10px] mr-6 font-mono group-hover:text-emerald-300 opacity-60 group-hover:opacity-100 transition" title="${plays} reproducciones">
            <span class="mr-2">${plays}</span>
            <i class="fa-solid fa-play text-[8px]"></i>
        </div>`;

                // 3. LOGICA PLAYLIST (Botón quitar)
                let pName = null;
                if (typeof currentLibrary !== 'undefined' && currentLibrary.startsWith('playlist:')) {
                    pName = currentLibrary.split(':')[1];
                } else if (typeof filters !== 'undefined' && filters.playlist && filters.playlist !== 'all') {
                    pName = filters.playlist;
                }

                let removeBtn = '';
                if (pName) {
                    // Usamos data-path para pasar la ruta original sin encoding
                    removeBtn = `<button 
            onclick="event.stopPropagation(); quitarDeListaRow(this.dataset.playlist, this.dataset.path, event)" 
            data-playlist="${escapeHtml(pName)}"
            data-path="${escapeHtml(f.path)}"
            class="w-8 h-8 flex items-center justify-center text-emerald-500 hover:text-orange-500 rounded-full hover:bg-white/10 transition" 
            title="Quitar de lista">
            <i class="fa-solid fa-minus text-xs"></i>
        </button>`;
                }

                // ⭐ BOTÓN FAVORITO
                const favBtn = `<button 
        onclick="event.stopPropagation(); toggleCardFavorite(this.dataset.path, true)" 
        data-path="${escapeHtml(f.path)}"
        class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition ${isFavorite ? 'text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.6)]' : 'text-zinc-500 hover:text-emerald-400'}" 
        title="${isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}">
        <i class="fa-${isFavorite ? 'solid' : 'regular'} fa-heart text-xs"></i>
    </button>`;

                // 📥 BOTÓN ENCOLAR
                const queueBtn = `<button 
        onclick="event.stopPropagation(); enqueue(this.dataset.path)" 
        data-path="${escapeHtml(f.path)}"
        class="w-8 h-8 flex items-center justify-center text-emerald-400 hover:text-emerald-300 rounded-full hover:bg-white/10 transition" title="Encolar">
        <i class="fa-solid fa-layer-group text-xs"></i>
    </button>`;

                const radioBtn = `
                <button 
                    onclick="event.stopPropagation(); crearRadioArtista(this.dataset.artist)" 
                    data-artist="${escapeHtml(f.artist)}"
                    class="w-8 h-8 flex items-center justify-center text-emerald-400 hover:text-cyan-300 rounded-full hover:bg-white/10 transition" title="Radio del Artista">
                    <i class="fa-solid fa-tower-broadcast text-xs"></i>
                </button>`;

                const editBtn = `<button 
        onclick="event.stopPropagation(); abrirEditorMasivo(this.dataset.path)" 
        data-path="${escapeHtml(f.path)}"
        class="w-7 h-7 bg-black/60 backdrop-blur rounded-full flex items-center justify-center text-white hover:scale-110 hover:text-yellow-400 transition" 
        title="Editar Info">
        <i class="fa-solid fa-pen-to-square text-[10px]"></i>
    </button>`;

                const playlistBtn = `
    <button 
        class="text-zinc-500 hover:text-purple-400 transition px-2"
        title="Añadir a Playlist"
        data-path="${escapeHtml(f.path)}"
        onclick="event.stopPropagation(); openPlaylistModal(this.dataset.path)">
        <i class="fa-solid fa-list-ul"></i>
    </button>
    `;

                // 💣 BOTÓN MENÚ ESCRITORIO
                const menuBtn = `<button 
        onclick="openContextSafe(event, this.dataset.path)" 
        data-path="${escapeHtml(f.path)}"
        class="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition pointer-events-auto" 
        title="Más opciones">
        <i class="fa-solid fa-ellipsis-vertical text-sm"></i>
    </button>`;

                // 4. AGRUPAR BOTONES
                const actionBtns = selectionMode ? '' : `
    <div class="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition px-2 shrink-0 mr-auto z-20">
        ${favBtn}
        ${queueBtn}
        ${radioBtn}
        ${playlistBtn}
        ${removeBtn}
        ${menuBtn}
    </div>`;

                // 📱 BOTÓN MÓVIL (El importante)
                // Aquí cambiamos md:hidden por lg:hidden para asegurar que se vea en tablets y horizontal
                // Y usamos data-path
                const mobileMenuBtn = `<button 
        onclick="openContextMenu(event, this.dataset.path)" 
        data-path="${escapeHtml(f.path)}"
        class="lg:hidden text-emerald-500 pl-4 py-4 pointer-events-auto z-20 active:scale-125 transition-transform w-12 flex justify-center items-center">
        <i class="fa-solid fa-ellipsis-vertical text-lg"></i>
    </button>`;

                return `
    <div class="list-row group ${isSel} flex items-center p-2 hover:bg-white/5 rounded-lg mb-1 transition border-b border-white/5 relative cursor-pointer" 
         data-path="${escapeHtml(f.path)}"
         onclick="playNow(this.dataset.path)">
        
        <div class="relative w-10 h-10 shrink-0 rounded overflow-hidden mr-4 shadow-sm group-hover:shadow-md transition bg-[#0a0a0a]">
            ${isFavorite ? '<div class="absolute top-0 left-0 z-20 w-4 h-4 bg-black/80 rounded-br flex items-center justify-center"><i class="fa-solid fa-heart text-emerald-400 text-[8px] drop-shadow-[0_0_3px_rgba(16,185,129,0.8)]"></i></div>' : ''}
            <img data-src="${coverUrl}"
                 class="lazy-img w-full h-full object-cover relative z-10"
                 onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden'); this.nextElementSibling.classList.add('flex')">
            <div class="absolute inset-0 hidden items-center justify-center bg-emerald-800 z-0">
                <i class="fa-solid ${f.type === 'video' ? 'fa-film' : 'fa-music'} text-white/50 text-xs"></i>
            </div>
            <div class="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center z-20">
                <i class="fa-solid fa-play text-white text-xs"></i>
            </div>
            ${selectionMode ? '<div class="absolute inset-0 bg-emerald-500/80 flex items-center justify-center z-30"><i class="fa-solid fa-check text-white"></i></div>' : ''}
        </div>
        
        <div class="flex-1 min-w-0 flex flex-col justify-center mr-4">
            <div class="text-gray-200 group-hover:text-white font-medium text-sm leading-tight truncate flex items-center">
                ${f.title} ${f.playlists && f.playlists.length > 0 ? '<i class="fa-solid fa-check-circle text-[10px] text-emerald-500 ml-2 opacity-50" title="En playlist"></i>' : ''}
            </div>
            <div class="text-sm text-zinc-400 truncate cursor-pointer hover:text-purple-400 hover:underline"
     title="Ver información del artista"
     data-artist="${escapeHtml(f.artist)}"
     onclick="event.stopPropagation(); verArtista(this.dataset.artist)">
    ${escapeHtml(f.artist)}
</div>
        </div>

        ${actionBtns}
        ${playsHtml}
        ${genreTag}
        
        <div class="text-[11px] font-mono text-emerald-500 w-10 text-right mr-2 group-hover:text-emerald-300">
            ${f.duration || '--:--'}
        </div>
        
        ${mobileMenuBtn}
    </div>`;
            }

            /**
             * `openContextSafe(e, encodedPath)`
             * Abre el menú contextual decodificando de forma segura la ruta del archivo.
             */
            function openContextSafe(e, encodedPath) {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation(); // 🛑 ¡ESTO DETIENE LA REPRODUCCIÓN!
                }
                const path = decodeURIComponent(encodedPath);
                openContextMenu(e, path);
            }

            // Reproduce desde el clic principal
            /**
             * `playNowEncoded(encodedPath)`
             * Inicia la reproducción inmediata decodificando una ruta URI-encoded.
             */
            function playNowEncoded(encodedPath) {
                // Si estamos en modo selección, no reproducir
                if (typeof selectionMode !== 'undefined' && selectionMode) {
                    selectRow(decodeURIComponent(encodedPath));
                    return;
                }
                playNow(decodeURIComponent(encodedPath));
            }

            // Encolar seguro
            /**
             * `enqueueEncoded(encodedPath)`
             * Encola una pista decodificando su ruta URI-encoded.
             */
            function enqueueEncoded(encodedPath) {
                enqueue(decodeURIComponent(encodedPath));
            }

/**
 * `verArtista(artistName)`
 * Carga y muestra la página dedicada de discografía de un artista.
 */
async function verArtista(artistName) {
            if (!artistName || artistName === "Desconocido") return;

            // 1. Identificar el contenedor
            const container = document.getElementById('lib-container') || document.getElementById('library-container');
            if (!container) return console.error("Falta lib-container");

            // 2. Loader
            container.innerHTML = '<div class="flex items-center justify-center h-64"><i class="fa-solid fa-spinner fa-spin text-4xl text-purple-500"></i></div>';

            try {
                // 3. Cargar datos en paralelo
                const [resApi, localTracks] = await Promise.all([
                    fetch('/api/artist/' + encodeURIComponent(artistName)).then(r => r.json()),
                    Promise.resolve(libData.files.filter(f => f.artist === artistName))
                ]);

                if (resApi.error) throw new Error("Artista no encontrado");

                // 4. Renderizar
                currentView = 'artist';
                renderArtistPage(container, resApi, localTracks);

            } catch (e) {
                console.error(e);
                showToast("Error: " + e.message, "error");
                // Si tienes la función renderLib, úsala para volver, si no, recarga
                if (typeof renderLib === 'function') renderLib();
                else location.reload();
            }
        }

        /**
         * `renderArtistPage(container, artist, songs)`
         * Renderiza la cabecera, canciones populares y álbumes agrupados de un artista.
         */
        function renderArtistPage(container, artist, songs) {
            container.className = "w-full animate-fade-in";
            // 1. Lógica de Imagen / Color
            let heroStyle = '';
            const hash = artist.name.split("").reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0);
            const hue = Math.abs(hash % 360);
            const titleStyle = `color: #f8fafc; text-shadow: 0 8px 24px rgba(0,0,0,0.6);`;

            // Si Last.fm manda imagen, la usamos
            const baseGradient = `radial-gradient(120% 140% at 15% 10%, hsla(${hue}, 85%, 55%, 0.55) 0%, transparent 55%),
        radial-gradient(120% 140% at 85% 0%, hsla(${(hue + 40) % 360}, 85%, 50%, 0.45) 0%, transparent 60%),
        linear-gradient(135deg, hsl(${hue}, 45%, 18%) 0%, #09090b 100%)`;

            if (artist.image && artist.image.length > 0) {
                heroStyle = `background-image: ${baseGradient}, url('${artist.image}'); background-blend-mode: screen, normal;`;
            } else {
                heroStyle = `background: ${baseGradient};`;
            }

            // 2. Limpieza de Biografía (Súper segura)
            let bioTexto = "Sin biografía disponible.";
            if (artist.bio && artist.bio.length > 5) {
                // Quitamos HTML
                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = artist.bio;
                let textoLimpio = tempDiv.textContent || tempDiv.innerText || "";

                // Quitamos basura de Last.fm
                textoLimpio = textoLimpio.replace("Read more on Last.fm", "")
                    .replace("User-contributed text is available under the Creative Commons By-SA License; additional terms may apply.", "")
                    .replace("Etiquetas ID3 mal asignadas", ""); // Filtro específico que viste antes

                if (textoLimpio.trim()) bioTexto = textoLimpio;
            }

            // 3. HTML (Diseño Final)
            const albums = songs.reduce((acc, song) => {
                const albumName = song.album && song.album.trim() ? song.album : 'Sencillos';
                if (!acc[albumName]) acc[albumName] = [];
                acc[albumName].push(song);
                return acc;
            }, {});
            const albumNames = Object.keys(albums).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
            currentArtistTracks = albumNames.flatMap(album => albums[album]);

            // Bio truncada para el hero (máximo ~200 chars)
            const bioShort = bioTexto.length > 200 ? bioTexto.substring(0, 200).trim() + '…' : bioTexto;

            // Imagen del artista
            const artistImg = (artist.image && artist.image.length > 0) ? artist.image : '';
            const avatarHtml = artistImg
                ? `<img src="${artistImg}" class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
       <div class="hidden absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900 to-zinc-900"><i class="fa-solid fa-user text-5xl text-white/30"></i></div>`
                : `<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900 to-zinc-900"><i class="fa-solid fa-user text-5xl text-white/30"></i></div>`;

            let html = `
<div class="animate-fade-in pb-32">
    <div class="mb-4 flex items-center gap-3">
        <button onclick="currentView='library'; renderLib()" class="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition group border border-white/5">
            <i class="fa-solid fa-arrow-left text-zinc-400 group-hover:text-white"></i>
        </button>
        <span class="text-xs font-bold text-zinc-500 uppercase tracking-widest">Volver a la biblioteca</span>
    </div>

    <!-- ====== HERO CARD: Avatar circular + Info ====== -->
    <div class="relative rounded-3xl overflow-hidden shadow-2xl mb-8 border border-white/5"
         style="background: ${baseGradient};">
        
        <div class="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8 p-6 md:p-10">
            
            <!-- AVATAR CIRCULAR -->
            <div class="relative w-36 h-36 md:w-44 md:h-44 rounded-full overflow-hidden shrink-0 shadow-[0_0_40px_rgba(0,0,0,0.5)] border-4 border-white/10 group">
                ${avatarHtml}
                <!-- Glow animado -->
                <div class="absolute inset-0 rounded-full ring-2 ring-purple-500/0 group-hover:ring-purple-500/40 transition-all duration-700"></div>
            </div>

            <!-- INFO -->
            <div class="flex-1 min-w-0 text-center md:text-left">
                <h1 class="text-3xl md:text-5xl font-black text-white mb-3 tracking-tight leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                    ${artist.name}
                </h1>

                <!-- Tags -->
                <div class="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
                    ${artist.tags.map(tag => `
                        <span class="px-3 py-1 bg-white/10 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-bold text-white uppercase tracking-wider hover:bg-white/20 cursor-default transition">
                            ${tag}
                        </span>
                    `).join('')}
                </div>

                <!-- Stats -->
                <div class="flex flex-wrap justify-center md:justify-start gap-4 text-xs font-bold text-zinc-300 mb-4">
                    <span class="flex items-center gap-2"><i class="fa-solid fa-music text-purple-400"></i> ${songs.length} canciones locales</span>
                    <span class="flex items-center gap-2"><i class="fa-solid fa-compact-disc text-emerald-400"></i> ${albumNames.length} álbumes</span>
                </div>
            </div>
        </div>

        <!-- Botón Play All -->
        <div class="absolute top-4 right-4 md:top-6 md:right-6 z-20">
            <button onclick="playerQueue = currentArtistTracks.slice(); currentTrackIndex = 0; playTrack(playerQueue[0]);" 
                    class="w-12 h-12 bg-emerald-500 hover:bg-emerald-400 hover:scale-110 text-black rounded-full flex items-center justify-center shadow-xl transition-all duration-300">
                <i class="fa-solid fa-play ml-0.5 text-lg"></i>
            </button>
        </div>
    </div>

    <!-- ====== CONTENIDO: 2 columnas (Canciones + Panel lateral) ====== -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <!-- COLUMNA IZQUIERDA: Discografía -->
        <div class="lg:col-span-2 space-y-4">
            <h2 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <i class="fa-solid fa-headphones text-purple-400"></i> Discografía local
            </h2>
            <div class="flex flex-col gap-4">
                ${songs.length > 0 ?
                    albumNames.map((album) => {
                        const coverPath = albums[album][0]?.path || '';
                        const coverUrl = coverPath
                            ? `/caratula/${coverPath.split('/').map(p => encodeURIComponent(p)).join('/')}`
                            : '';
                        return `
                        <div class="bg-white/5 rounded-xl border border-white/10">
                            <div class="px-4 py-3 flex items-center justify-between border-b border-white/5">
                                <div class="flex items-center gap-3 min-w-0">
                                    <div class="w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-zinc-900 shrink-0">
                                        <img src="${coverUrl}" class="w-full h-full object-cover" onerror="this.style.display='none';">
                                    </div>
                                    <h3 class="text-sm font-bold text-white truncate">${album}</h3>
                                </div>
                                <span class="text-[10px] text-emerald-400 font-bold">${albums[album].length} pistas</span>
                            </div>
                        <div class="flex flex-col gap-1 p-2">
                            ${albums[album].map((f, i) => createListRowSimple(f, i)).join('')}
                        </div>
                        </div>`;
                    }).join('') :
                    `<div class="p-8 text-center bg-white/5 rounded-xl border border-dashed border-white/10 flex flex-col items-center gap-3">
                        <i class="fa-solid fa-folder-open text-4xl text-zinc-600"></i>
                        <p class="text-zinc-500 text-sm">No tienes archivos locales de este artista.</p>
                     </div>`
                }
            </div>
        </div>

        <!-- COLUMNA DERECHA: Bio + Similares -->
        <div class="space-y-6">
            <div class="bg-[#121212] p-6 rounded-2xl border border-white/5 shadow-lg">
                <h3 class="text-sm font-bold text-white mb-3 border-b border-white/5 pb-2">Biografía</h3>
                <p class="text-zinc-400 text-xs leading-relaxed max-h-72 overflow-y-auto pr-2 scrollbar-thin text-justify whitespace-pre-line">
                    ${bioTexto}
                </p>
            </div>

            ${artist.similar.length > 0 ? `
            <div class="bg-[#121212] p-6 rounded-2xl border border-white/5 shadow-lg">
                <h3 class="text-sm font-bold text-white mb-3 border-b border-white/5 pb-2">Artistas Similares</h3>
                <div class="flex flex-wrap gap-2">
                    ${artist.similar.map(sim => `
                        <button onclick="verArtista(this.dataset.artist)" 
                                data-artist="${sim.replace(/"/g, '&quot;')}"
                                class="px-3 py-1.5 bg-zinc-800 hover:bg-purple-900/50 hover:text-purple-300 hover:border-purple-500/30 border border-white/5 text-zinc-300 text-[10px] font-bold uppercase tracking-wide rounded-lg transition">
                            ${sim}
                        </button>
                    `).join('')}
                </div>
            </div>` : ''}
        </div>
    </div>
</div>`;

            container.innerHTML = html;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        /**
         * `createListRowSimple(f, i)`
         * Genera una fila simplificada de canción para las vistas de álbumes dentro de la página de artista.
         */
        function createListRowSimple(f, i) {
            // Función simple para listar canciones sin romper nada
            // Usamos escapeHtml si existe, si no, una versión simple inline
            const safeTitle = f.title.replace(/"/g, '&quot;');
            const safeAlbum = (f.album || 'Sencillo').replace(/"/g, '&quot;');
            const safePath = f.path.replace(/"/g, '&quot;');
            const duration = typeof formatTime === 'function' ? formatTime(f.duration) : f.duration;

            return `
<div class="group flex items-center p-3 rounded-lg hover:bg-white/5 transition cursor-pointer border border-transparent hover:border-white/5"
     data-path="${safePath}"
     onclick="playNow(this.dataset.path)">
    
    <div class="w-8 text-center text-zinc-600 text-sm font-mono mr-4 group-hover:text-purple-400">${i + 1}</div>
    
    <div class="flex-1 min-w-0">
        <div class="text-white font-medium truncate group-hover:text-purple-300 transition">${safeTitle}</div>
        <div class="text-xs text-zinc-500 truncate">${safeAlbum}</div>
    </div>

    <div class="text-xs text-zinc-600 font-mono mr-4">${duration}</div>
</div>`;
        }
