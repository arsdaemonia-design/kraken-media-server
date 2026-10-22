/**
 * ============================================================================
 * KRAKEN MEDIA SERVER — video-catalog.js
 * Catálogo de video estilo Netflix: filtros por categoría/género, carruseles de recomendaciones, Hero banner, maratón y temporadas.
 * ============================================================================
 */

/**
 * `setupNetflixRootFilters(categoriesArray, genresArray)`
 * Configura los menús desplegables de categorías y géneros en la vista principal de video estilo Netflix.
 */
function setupNetflixRootFilters(categoriesArray, genresArray) {
    // Inicializar filtro si no existe
    if (!window.netflixGenreFilter) window.netflixGenreFilter = null;

    /**
     * `filterByGenre(genre)`
     * Aplica o limpia el filtro de género en la portada de video estilo Netflix.
     */
    window.filterByGenre = function (genre) {
        window.netflixGenreFilter = (window.netflixGenreFilter === genre) ? null : genre;
        window.netflixGridRenderLimit = 84;
        if (window.netflixGenreFilter) videoUIState.recommendationsOpen = false;
        renderLib();
    };

    /**
     * `hideDropdownByType(type, exceptRoot = null)`
     * Oculta los menús desplegables de categoría o género en la barra de video.
     */
    window.hideDropdownByType = function (type, exceptRoot = null) {
        const selector = type === 'category' ? '[data-category-root]' : '[data-genre-root]';
        const menuSel = type === 'category' ? '[data-category-menu]' : '[data-genre-menu]';
        const chevronSel = type === 'category' ? '[data-category-chevron]' : '[data-genre-chevron]';
        document.querySelectorAll(selector).forEach(root => {
            if (exceptRoot && root === exceptRoot) return;
            const menu = root.querySelector(menuSel);
            const chev = root.querySelector(chevronSel);
            if (menu) menu.classList.add('hidden');
            if (chev) chev.style.transform = 'rotate(0deg)';
        });
    };

    /**
     * `changeNetflixCategory(newCat)`
     * Cambia la categoría activa en la vista de video y actualiza el Hero banner y la cuadrícula.
     */
    window.changeNetflixCategory = async function (newCat) {
        window.hideDropdownByType('category');
        if (newCat === '🔞 Adult') {
            const isUnlocked = Boolean(libData?.adult_unlocked || (libData?.files || []).some(f => f.is_adult));
            if (!isUnlocked) {
                const pin = getMasterPin('PIN Maestro requerido para desbloquear 🔞 Adult:');
                if (!pin) return;
                window.netflixActiveCategory = newCat;
                window.netflixGenreFilter = null;
                window.netflixGridRenderLimit = 84;
                videoUIState.recommendationsOpen = false;
                const mobileInput = document.getElementById('lib-search-mobile');
                const desktopInput = document.getElementById('lib-search-desktop');
                if (mobileInput) mobileInput.value = '';
                if (desktopInput) desktopInput.value = '';
                await cargarLib();
                if (!libData?.adult_unlocked && !(libData?.files || []).some(f => f.is_adult)) {
                    sessionStorage.removeItem('kraken_master_pin');
                    window.netflixActiveCategory = 'Peliculas';
                    showToast('PIN Maestro incorrecto', 'error');
                    renderLib();
                }
                return;
            }
        }
        window.netflixActiveCategory = newCat;
        window.netflixGenreFilter = null;
        window.netflixGridRenderLimit = 84;
        videoUIState.recommendationsOpen = true;
        const mobileInput = document.getElementById('lib-search-mobile');
        const desktopInput = document.getElementById('lib-search-desktop');
        if (mobileInput) mobileInput.value = '';
        if (desktopInput) desktopInput.value = '';
        renderLib();
    };

    /**
     * `toggleCategoryDropdown(event)`
     * Abre o cierra el menú desplegable de categorías de video.
     */
    window.toggleCategoryDropdown = function (event) {
        const btn = event?.currentTarget;
        const root = btn ? btn.closest('[data-category-root]') : null;
        const menu = root ? root.querySelector('[data-category-menu]') : null;
        const chev = root ? root.querySelector('[data-category-chevron]') : null;
        if (!root || !menu) return;
        const isHidden = menu.classList.contains('hidden');
        window.hideDropdownByType('category', root);
        if (isHidden) {
            menu.classList.remove('hidden');
            if (chev) chev.style.transform = 'rotate(180deg)';
        } else {
            menu.classList.add('hidden');
            if (chev) chev.style.transform = 'rotate(0deg)';
        }
    };

    /**
     * `toggleGenreDropdown(event)`
     * Abre o cierra el menú desplegable de géneros de video.
     */
    window.toggleGenreDropdown = function (event) {
        const btn = event?.currentTarget;
        const root = btn ? btn.closest('[data-genre-root]') : null;
        const menu = root ? root.querySelector('[data-genre-menu]') : null;
        const chev = root ? root.querySelector('[data-genre-chevron]') : null;
        if (!root || !menu) return;
        const isHidden = menu.classList.contains('hidden');
        window.hideDropdownByType('genre', root);
        if (isHidden) {
            menu.classList.remove('hidden');
            if (chev) chev.style.transform = 'rotate(180deg)';
        } else {
            menu.classList.add('hidden');
            if (chev) chev.style.transform = 'rotate(0deg)';
        }
    };

    if (!window.__krakenDropdownOutsideBound) {
        window.__krakenDropdownOutsideBound = true;
        document.addEventListener('click', function (e) {
            if (!e.target.closest('[data-category-root]')) window.hideDropdownByType?.('category');
            if (!e.target.closest('[data-genre-root]')) window.hideDropdownByType?.('genre');
        });
    }

    /**
     * `toggleRecommendations()`
     * Expande o contrae la fila de recomendaciones en la portada de video.
     */
    window.toggleRecommendations = function () {
        const section = document.getElementById('recommendations-section');
        const btn = document.getElementById('recommendations-btn');
        if (section) {
            const isHidden = section.classList.contains('hidden');
            if (isHidden) {
                section.classList.remove('hidden');
                videoUIState.recommendationsOpen = true;
                if (btn) btn.classList.add('ring-2', 'ring-emerald-400/50');
                setTimeout(() => {
                    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            } else {
                section.classList.add('hidden');
                videoUIState.recommendationsOpen = false;
                if (btn) btn.classList.remove('ring-2', 'ring-emerald-400/50');
            }
        }
    };

    const categoryMenuHtml = categoriesArray.map(cat => {
        const isActive = cat === window.netflixActiveCategory;
        return `<button onclick="changeNetflixCategory('${cat}')"
            class="w-full text-left px-4 py-2.5 text-sm font-bold transition-colors
            ${isActive
                ? 'bg-emerald-500 text-white'
                : 'text-zinc-300 hover:bg-white/10 hover:text-white'
            }">${cat}</button>`;
    }).join('');

    const genreMenuHtml = genresArray.map(g => {
        const isActive = window.netflixGenreFilter === g;
        return `<button onclick="filterByGenre('${g.replace(/'/g, "\\'")}')"
            class="w-full text-left px-4 py-2.5 text-sm font-bold transition-colors
            ${isActive
                ? 'bg-emerald-500 text-white'
                : 'text-zinc-300 hover:bg-white/10 hover:text-white'
            }">${g}</button>`;
    }).join('');

    return { categoryMenuHtml, genreMenuHtml };
}

/**
 * `appendNetflixRecommendationsSection(container, uniqueShows)`
 * Inserta el carrusel horizontal de recomendaciones aleatorias en la portada de video.
 */
function appendNetflixRecommendationsSection(container, uniqueShows) {
    /**
     * `createRecommendationsRow(title, items, rowId)`
     * Construye el HTML de la fila de recomendaciones destacadas de video.
     */
    function createRecommendationsRow(title, items, rowId) {
        if (items.length < 2) return '';
        const encodedGenre = encodeURIComponent(title.replace(/^Explora\s+/i, '')).replace(/'/g, '%27');
        const cardsHtml = items.slice(0, 20).map(item => `
            <div class="flex-none w-[140px] md:w-[170px] lg:w-[190px] xl:w-[200px]">
                ${createCard(item)}
            </div>
        `).join('');

        const scrollLeft = `scrollRowLeft('${rowId}')`;
        const scrollRight = `scrollRowRight('${rowId}')`;

        return `
            <div class="mb-8 relative group/row">
                <h3 class="text-sm font-bold text-white mb-3 px-2 md:px-0 flex items-center gap-2">
                    <i class="fa-solid fa-film text-emerald-500"></i>
                    ${escapeHtml(title)}
                    <span class="text-[10px] text-zinc-500 font-normal">(${items.length})</span>
                    <button onclick="openVideoGenreFromRail('${encodedGenre}')" class="ml-auto text-[10px] font-semibold text-emerald-400 hover:text-white transition">Ver todo <i class="fa-solid fa-chevron-right ml-1"></i></button>
                </h3>
                <div class="relative">
                    <button onclick="${scrollLeft}"
                        class="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-20 items-center justify-center
                        bg-black/60 hover:bg-black/80 text-white rounded-r-xl opacity-0 group-hover/row:opacity-100 transition-opacity">
                        <i class="fa-solid fa-chevron-left text-2xl"></i>
                    </button>

                    <div id="${rowId}" class="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-2 md:px-0 scroll-smooth"
                        style="-webkit-overflow-scrolling: touch; scrollbar-width: none; -ms-overflow-style: none;">
                        ${cardsHtml}
                    </div>

                    <button onclick="${scrollRight}"
                        class="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-20 items-center justify-center
                        bg-black/60 hover:bg-black/80 text-white rounded-l-xl opacity-0 group-hover/row:opacity-100 transition-opacity">
                        <i class="fa-solid fa-chevron-right text-2xl"></i>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * `scrollRowLeft(rowId)`
     * Desplaza un carrusel de video hacia la izquierda.
     */
    window.scrollRowLeft = function (rowId) {
        const row = document.getElementById(rowId);
        if (row) row.scrollBy({ left: -400, behavior: 'smooth' });
    };

    /**
     * `scrollRowRight(rowId)`
     * Desplaza un carrusel de video hacia la derecha.
     */
    window.scrollRowRight = function (rowId) {
        const row = document.getElementById(rowId);
        if (row) row.scrollBy({ left: 400, behavior: 'smooth' });
    };

    /**
     * `openVideoGenreFromRail(encodedGenre)`
     * Filtra el catálogo de video al hacer clic en un género desde un carrusel.
     */
    window.openVideoGenreFromRail = function (encodedGenre) {
        window.netflixGenreFilter = decodeURIComponent(encodedGenre || '');
        window.netflixGridRenderLimit = 84;
        videoUIState.recommendationsOpen = false;
        renderLib();
        setTimeout(() => document.getElementById('netflix-catalog-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    };

    const genreGroups = {};
    uniqueShows.forEach(show => {
        const src = show.sample ? show.sample : show;
        const genres = (src.genre || '').split(',').map(s => s.trim()).filter(Boolean);
        genres.forEach(g => {
            if (!genreGroups[g]) genreGroups[g] = [];
            genreGroups[g].push(show);
        });
    });

    const eligibleGenres = Object.keys(genreGroups)
        .filter(g => genreGroups[g].length >= 3)
        .sort((a, b) => genreGroups[b].length - genreGroups[a].length || a.localeCompare(b));

    // Keep today's recommendations stable across re-renders, then rotate them tomorrow.
    const today = new Date();
    const dayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    const seedText = `${dayKey}|${window.netflixActiveCategory || 'Todo'}`;
    let seed = Array.from(seedText).reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 2166136261);
    const seededShuffle = (items) => {
        const shuffled = [...items];
        for (let i = shuffled.length - 1; i > 0; i--) {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            const j = seed % (i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    };
    const selectedGenres = seededShuffle(eligibleGenres.slice(0, 10)).slice(0, 4);

    let recommendationsHtml = '';
    let rowIndex = 0;
    selectedGenres.forEach(genre => {
        const items = genreGroups[genre];
        recommendationsHtml += createRecommendationsRow(`Explora ${genre}`, seededShuffle(items), 'rec-row-' + rowIndex);
        rowIndex++;
    });

    if (recommendationsHtml) {
        container.innerHTML += `
            <div id="recommendations-section" class="${videoUIState.recommendationsOpen ? '' : 'hidden'} mt-2 pt-5 border-t border-white/10">
                <div class="px-2 md:px-0 mb-6">
                    <h2 class="text-lg font-bold text-white flex items-center gap-2">
                        <i class="fa-solid fa-wand-magic-sparkles text-emerald-500"></i>
                        Descubre hoy
                    </h2>
                    <p class="text-xs text-zinc-500 mt-1">Una selección diaria de tu biblioteca. El catálogo completo está abajo.</p>
                </div>
                ${recommendationsHtml}
            </div>
        `;
    }
}

/**
 * `appendNetflixHero(container, heroItem)`
 * Renderiza el banner Hero principal (película o serie destacada) delegando en `renderSeriesHero`.
 */
function appendNetflixHero(container, heroItem) {
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
            <div class="flex items-center gap-2 mb-2"><div class="w-1 h-3 bg-emerald-500 rounded"></div><div class="text-[10px] md:text-xs font-black text-white tracking-[0.2em] uppercase">${window.netflixActiveCategory} ${isHeroMovie ? 'PEL\u00cdCULA' : 'DESTACADO'}</div></div>
            <h2 class="text-3xl md:text-5xl lg:text-6xl font-black text-white leading-[1.1] drop-shadow-xl mb-3 line-clamp-2">${heroItem.name || heroItem.title}</h2>
        </div>
    </div>`;

    if (typeof renderSeriesHero === 'function') {
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
    }
}

/**
 * `appendNetflixGrid(container, showsToDisplay)`
 * Renderiza la cuadrícula paginada de títulos de video con soporte para carga incremental ('Cargar más').
 */
function appendNetflixGrid(container, showsToDisplay) {
    const NETFLIX_GRID_BATCH = 84;
    const currentGridLimit = Math.max(
        NETFLIX_GRID_BATCH,
        Number(window.netflixGridRenderLimit || NETFLIX_GRID_BATCH)
    );
    const visibleShows = showsToDisplay.slice(0, currentGridLimit);

    /**
     * `loadMoreNetflixGrid(step = NETFLIX_GRID_BATCH)`
     * Incrementa el límite de elementos visibles en la cuadrícula principal de video.
     */
    window.loadMoreNetflixGrid = function (step = NETFLIX_GRID_BATCH) {
        const safeStep = Number(step) > 0 ? Number(step) : NETFLIX_GRID_BATCH;
        const prev = Math.max(NETFLIX_GRID_BATCH, Number(window.netflixGridRenderLimit || NETFLIX_GRID_BATCH));
        window.netflixGridRenderLimit = prev + safeStep;
        renderLib();
    };

    const allCardsHtml = visibleShows
        .map(item => `<div class="w-full h-full">${createCard(item)}</div>`)
        .join('');

    const gridSizeClass = videoZoomLevels[currentVideoZoomIndex] || videoZoomLevels[1];
    container.innerHTML += `
        <div id="netflix-catalog-grid" class="grid ${gridSizeClass} gap-3 md:gap-4 px-1 md:px-0 pb-4">
            ${allCardsHtml}
        </div>
    `;
    if (showsToDisplay.length > currentGridLimit) {
        const pending = showsToDisplay.length - currentGridLimit;
        container.innerHTML += `
            <div class="w-full flex justify-center mt-2 mb-6">
                <button onclick="loadMoreNetflixGrid(${NETFLIX_GRID_BATCH})"
                    class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition">
                    ➕ Cargar más (${Math.min(NETFLIX_GRID_BATCH, pending)} más)
                </button>
            </div>
        `;
    }
}

/**
 * `setupNetflixMarathon(uniqueShows)`
 * Inicializa la lógica de maratón aleatorio de episodios o películas.
 */
function setupNetflixMarathon(uniqueShows) {
    /**
     * `shuffleVideoMarathon()`
     * Inicia una reproducción continua aleatoria (Modo Maratón) con los videos filtrados.
     */
    window.shuffleVideoMarathon = function () {
        let filteredShows = uniqueShows;
        if (window.netflixGenreFilter) {
            filteredShows = uniqueShows.filter(show => {
                const src = show.sample ? show.sample : show;
                const genres = (src.genre || '').split(',').map(s => s.trim().toLowerCase());
                return genres.includes(window.netflixGenreFilter.toLowerCase());
            });
        }

        let videoFiles = [];
        filteredShows.forEach(show => {
            if (show.type === 'folder') {
                const folderPath = (show.path || '').replace(/\\/g, '/').replace(/\/$/, '');
                const eps = (libData.files || []).filter(f => {
                    if (f.type !== 'video') return false;
                    const p = (f.path || '').replace(/\\/g, '/');
                    return p.startsWith(folderPath + '/') || p.startsWith(folderPath);
                });
                videoFiles.push({ _isSeries: true, episodes: eps, show });
            } else {
                videoFiles.push({ _isSeries: false, file: show });
            }
        });

        if (videoFiles.length === 0) {
            showToast('No hay videos para el Maratón', 'error');
            return;
        }

        for (let i = videoFiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [videoFiles[i], videoFiles[j]] = [videoFiles[j], videoFiles[i]];
        }

        const marathonShows = videoFiles.slice(0, 10);
        const queue = [];
        marathonShows.forEach(item => {
            if (item._isSeries) {
                const sorted = [...item.episodes].sort((a, b) => (a.path || '').localeCompare(b.path || ''));
                if (sorted[0]) queue.push(sorted[0]);
            } else {
                const f = item.file.sample ? item.file.sample : item.file;
                if (f && f.path) queue.push(f);
            }
        });

        if (queue.length === 0) {
            showToast('No se encontraron archivos de video', 'error');
            return;
        }

        const catLabel = window.netflixGenreFilter
            ? window.netflixGenreFilter
            : (window.netflixActiveCategory || 'Video');

        playerQueue = queue;
        currentTrackIndex = 0;
        showToast(`🎲 Maratón de ${catLabel}: ${queue.length} títulos`, 'success');
        playVideoMode(playerQueue[0]);
    };
}

/**
 * `buildNetflixPillsHtml(categoryDropdownHtml, genreDropdownHtml, recommendationsBtnHtml, marathonBtnHtml)`
 * Genera la barra de píldoras de filtrado rápido (categorías, géneros y botón de maratón).
 */
function buildNetflixPillsHtml(categoryDropdownHtml, genreDropdownHtml, recommendationsBtnHtml, marathonBtnHtml) {
    const sizeSelectorHtml = `
        <div class="flex items-center gap-0.5 bg-[#18181b] border border-white/10 rounded-full p-1 shrink-0" title="Tamaño de miniaturas">
            <i class="fa-solid fa-grip text-[11px] text-emerald-400 pl-2 pr-1"></i>
            <button onclick="changeVideoZoom(0)" class="px-2 py-0.5 rounded-full text-[11px] font-bold transition ${currentVideoZoomIndex === 0 ? 'bg-emerald-500 text-black shadow' : 'text-zinc-400 hover:text-white'}" title="Miniaturas pequeñas">S</button>
            <button onclick="changeVideoZoom(1)" class="px-2 py-0.5 rounded-full text-[11px] font-bold transition ${currentVideoZoomIndex === 1 ? 'bg-emerald-500 text-black shadow' : 'text-zinc-400 hover:text-white'}" title="Miniaturas medianas">M</button>
            <button onclick="changeVideoZoom(2)" class="px-2 py-0.5 rounded-full text-[11px] font-bold transition ${currentVideoZoomIndex === 2 ? 'bg-emerald-500 text-black shadow' : 'text-zinc-400 hover:text-white'}" title="Miniaturas grandes">L</button>
        </div>
    `;
    return {
        desktop: `
            ${categoryDropdownHtml}
            ${genreDropdownHtml}
            ${recommendationsBtnHtml}
            ${marathonBtnHtml}
            ${sizeSelectorHtml}
            <div id="video-selection-anchor" class="flex items-center gap-2 ml-auto"></div>
        `,
        mobile: `
            ${categoryDropdownHtml}
            ${genreDropdownHtml}
            ${marathonBtnHtml}
            ${sizeSelectorHtml}
        `
    };
}

/**
 * `getVideoRenderState(searchValue)`
 * Obtiene una instantánea inmutable del estado actual de filtros y búsqueda de video.
 */
function getVideoRenderState(searchValue) {
    const normalizedSearch = (searchValue || '').trim();
    const path = currentPath || '';
    const pathDepth = path.split('/').filter(Boolean).length;
    return {
        isRoot: path === "" || path === "Video",
        isSearching: normalizedSearch.length > 0 || (filters.sort !== 'default' && filters.sort != undefined),
        shouldForceVideoList: pathDepth >= 3,
        isEpisodeQuery: /\b(s\d{1,2}e\d{1,3}|e\d{1,3}|cap(?:itulo)?\s*\d{1,3}|episodio\s*\d{1,3})\b/i.test(normalizedSearch)
    };
}

/**
 * `buildVideoRootSearchEntities(filtered, searchValue, activeCategory)`
 * Agrupa resultados de búsqueda en raíz de video priorizando carpetas de series y películas sobre episodios sueltos.
 */
function buildVideoRootSearchEntities(filtered, searchValue, activeCategory) {
    if (!window.videoSearchEntityCache) window.videoSearchEntityCache = new Map();
    const categoryScope = (activeCategory === 'Todo') ? '' : activeCategory;
    const cacheKey = `${normalizeText(searchValue)}|${categoryScope}|root-entity`;
    let entities = window.videoSearchEntityCache.get(cacheKey);

    if (entities) return entities;

    const map = new Map();
    filtered.forEach(f => {
        if (f.type !== 'video' || !f.path) return;
        const normalizedPath = f.path.replace(/\\/g, '/');
        const parts = normalizedPath.split('/').filter(Boolean);
        let category = parts[1] || '';
        if (f.is_adult) category = '🔞 Adult';
        if (activeCategory === '🔞 Adult') {
            if (!f.is_adult) return;
        } else {
            if (f.is_adult) return;
            if (categoryScope && category && category !== categoryScope) return;
        }

        // Video/<Categoria>/<Serie>/... => entidad serie (solo si no es película)
        if (parts.length >= 4 && f.folder_type !== 'movie') {
            const showKey = parts.slice(0, 3).join('/');
            const showTitle = parts[2] || f.title || 'Serie';
            const existing = map.get(showKey);
            if (!existing) {
                map.set(showKey, {
                    type: 'folder',
                    name: f.tmdb_title || showTitle.replace(/\s*[\(\[\{]?tmdb[-_]?\d+[\)\]]?/gi, '').trim(),
                    title: f.tmdb_title || showTitle.replace(/\s*[\(\[\{]?tmdb[-_]?\d+[\)\]]?/gi, '').trim(),
                    path: showKey + '/',
                    sample: f,
                    folder_type: f.folder_type,
                    tmdb_id: f.tmdb_id,
                    tmdb_poster: f.tmdb_poster,
                    tmdb_rating: f.tmdb_rating,
                    date: f.date,
                    rating: f.rating,
                    _entityScore: (f._searchScore || 0)
                });
            } else {
                existing._entityScore = Math.max(existing._entityScore || 0, (f._searchScore || 0));
                if ((f.date || 0) > (existing.date || 0)) existing.date = f.date;
                if ((f.rating || 0) > (existing.rating || 0)) existing.rating = f.rating;
            }
            return;
        }

        // Archivos directos (películas/documentales sueltos o en su propia carpeta)
        const movieKey = normalizedPath;
        if (!map.has(movieKey)) {
            let safeTitle = f.tmdb_title || f.title || parts[parts.length - 1];
            if (f.folder_type === 'movie' && parts.length >= 4) {
                const folderIndex = Math.max(0, parts.length - 2);
                safeTitle = f.tmdb_title || parts[folderIndex].replace(/\s*[\(\[\{]?tmdb[-_]?\d+[\)\]]?/gi, '').trim() || f.title;
            }
            map.set(movieKey, { ...f, clean_title: safeTitle, name: safeTitle, _entityScore: (f._searchScore || 0) });
        }
    });

    entities = Array.from(map.values()).sort((a, b) => {
        const scoreDiff = (b._entityScore || 0) - (a._entityScore || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return ((a.name || a.title || '')).localeCompare((b.name || b.title || ''), undefined, { sensitivity: 'base' });
    }).slice(0, 80);

    window.videoSearchEntityCache.set(cacheKey, entities);
    return entities;
}

/**
 * `renderVideoRootSearchResults(container, filtered, searchValue)`
 * Pinta en el DOM los resultados agrupados de búsqueda en el catálogo de video.
 */
function renderVideoRootSearchResults(container, filtered, searchValue) {
    const gridSizeClass = videoZoomLevels[currentVideoZoomIndex] || videoZoomLevels[1];
    container.className = `grid ${gridSizeClass} gap-3 md:gap-4`;
    const activeCategory = window.netflixActiveCategory || '';
    const entities = buildVideoRootSearchEntities(filtered, searchValue, activeCategory);

    if (!entities || entities.length === 0) {
        container.innerHTML = '<div class="col-span-full text-zinc-500 text-center py-10 w-full"><i class="fa-solid fa-magnifying-glass text-3xl mb-3 block"></i>Sin resultados para tu búsqueda</div>';
        observeLazyImages();
        return true;
    }

    container.innerHTML = entities.map(item => createCard(item)).join('');
    observeLazyImages();
    return true;
}

/**
 * `buildNetflixRootCatalog(filtered)`
 * Clasifica los archivos de video en grupos de series y películas para poblar el catálogo raíz.
 */
function buildNetflixRootCatalog(filtered) {
    const allLibFiles = (libData && Array.isArray(libData.files)) ? libData.files : filtered;
    allLibFiles.forEach(f => {
        if (f.path && !f._normalizedPath) {
            f._normalizedPath = f.path.replace(/\\/g, '/');
        }
    });
    filtered.forEach(f => {
        if (f.path && !f._normalizedPath) {
            f._normalizedPath = f.path.replace(/\\/g, '/');
        }
    });

    const availableCategories = new Set();
    let hasAdultContent = false;
    allLibFiles.forEach(f => {
        if (f.type !== 'video' || !f._normalizedPath) return;
        if (f.is_adult) {
            hasAdultContent = true;
            return; // Omitir las categorías base para adultos
        }
        const parts = f._normalizedPath.split('/');
        if (parts.length > 2) availableCategories.add(parts[1]);
        else if (parts.length > 1) availableCategories.add(parts[1]);
    });

    const allCategoryLabel = 'Todo';
    const categoriesArray = [allCategoryLabel, ...Array.from(availableCategories).sort()];
    if (hasAdultContent) categoriesArray.push('🔞 Adult');
    if (!window.netflixActiveCategory || !categoriesArray.includes(window.netflixActiveCategory)) {
        if (categoriesArray.includes('Peliculas')) window.netflixActiveCategory = 'Peliculas';
        else if (categoriesArray.includes('Animé')) window.netflixActiveCategory = 'Animé';
        else if (categoriesArray.includes('Anime')) window.netflixActiveCategory = 'Anime';
        else if (categoriesArray.includes('Series')) window.netflixActiveCategory = 'Series';
        else window.netflixActiveCategory = categoriesArray[0] || allCategoryLabel;
    }

    const uniqueShowsMap = new Map();
    filtered.forEach(f => {
        if (f.type !== 'video' || !f._normalizedPath) return;
        const parts = f._normalizedPath.split('/');
        let currentCat = parts.length > 2 ? parts[1] : (parts.length > 1 ? parts[1] : 'Otros');
        if (f.is_adult) currentCat = '🔞 Adult';
        
        if (window.netflixActiveCategory === '🔞 Adult') {
            if (!f.is_adult) return;
        } else {
            if (f.is_adult) return;
            if (window.netflixActiveCategory !== allCategoryLabel && currentCat !== window.netflixActiveCategory) return;
        }

        let showKey, showTitle, showPathToOpen;
        let isSeries = false;

        if (parts.length > 3 && f.folder_type !== 'movie') {
            showKey = parts.slice(0, 3).join('/');
            showTitle = parts[2];
            showPathToOpen = showKey + '/';
            isSeries = true;
        } else {
            showKey = f._normalizedPath;
            let safeTitle = f.tmdb_title || f.title || parts[parts.length - 1];
            if (f.folder_type === 'movie' && parts.length > 3) {
                const folderIndex = Math.max(0, parts.length - 2);
                safeTitle = f.tmdb_title || parts[folderIndex].replace(/\s*[\(\[\{]?tmdb[-_]?\d+[\)\]]?/gi, '').trim() || f.title;
            }
            showTitle = safeTitle;
            f.clean_title = showTitle;
            f.name = showTitle;
            showPathToOpen = f._normalizedPath;
        }

        if (!uniqueShowsMap.has(showKey)) {
            if (isSeries) {
                const cleanName = f.tmdb_title || showTitle.replace(/\s*[\(\[\{]?tmdb[-_]?\d+[\)\]]?/gi, '').trim();
                const folderPoster = f.tmdb_poster ? f.tmdb_poster : (showTitle + '.jpg');
                uniqueShowsMap.set(showKey, {
                    type: 'folder',
                    name: cleanName,
                    title: cleanName,
                    path: showPathToOpen,
                    sample: f,
                    date: f.date,
                    rating: f.rating,
                    folder_type: f.folder_type,
                    tmdb_id: f.tmdb_id,
                    tmdb_poster: folderPoster,
                    tmdb_rating: libData.files.find(v => v.path.startsWith(showPathToOpen) && v.tmdb_rating)?.tmdb_rating
                });
            } else {
                uniqueShowsMap.set(showKey, f);
            }
        }
    });

    const uniqueShows = Array.from(uniqueShowsMap.values());
    const allGenres = new Set();
    uniqueShows.forEach(show => {
        const src = show.sample ? show.sample : show;
        const g = (src.genre || '').split(',').map(s => s.trim()).filter(Boolean);
        g.forEach(genre => allGenres.add(genre));
    });
    const genresArray = Array.from(allGenres).sort();

    return { categoriesArray, uniqueShows, genresArray };
}

/**
 * `renderVideoPathHeader(container, shouldForceVideoList)`
 * Renderiza la barra de navegación (breadcrumbs) al explorar dentro de carpetas de series o temporadas.
 */
function renderVideoPathHeader(container, shouldForceVideoList) {
    if (currentPath !== "") {
        const parts = currentPath.split('/').filter(p => p);
        const isShowDetailPath = parts.length >= 3;
        const simpleTitle = parts[parts.length - 1] || "Mis Series y Videos";

        const titleDesktop = document.getElementById('lib-title-desktop');
        const titleMobile = document.getElementById('lib-title-mobile');
        if (titleDesktop) titleDesktop.innerText = simpleTitle;
        if (titleMobile) titleMobile.innerText = simpleTitle;

        if (shouldForceVideoList || isShowDetailPath) {
            container.innerHTML += `
        <div onclick="navigateUp()" class="w-full bg-[#121212] p-3 rounded-xl hover:bg-[#1e1e1e] transition cursor-pointer group flex items-center justify-center border-2 border-dashed border-white/10 hover:border-emerald-500/50 mb-2">
            <i class="fa-solid fa-reply text-emerald-500 group-hover:text-emerald-400 mr-2 transition"></i>
            <span class="text-xs font-bold text-emerald-400 group-hover:text-white">Subir un nivel</span>
        </div>`;
        } else {
            container.innerHTML += `
        <div onclick="navigateUp()" class="bg-[#121212] p-3 rounded-xl hover:bg-[#1e1e1e] transition cursor-pointer group flex flex-col items-center justify-center border-2 border-dashed border-white/10 hover:border-emerald-500/50 aspect-square">
            <i class="fa-solid fa-reply text-3xl text-emerald-500 group-hover:text-emerald-400 mb-2 transition"></i>
            <span class="text-xs font-bold text-emerald-400 group-hover:text-white">Subir</span>
        </div>`;
        }
    } else {
        const titleDesktop = document.getElementById('lib-title-desktop');
        const titleMobile = document.getElementById('lib-title-mobile');
        if (titleDesktop) titleDesktop.innerText = "Mis Series y Videos";
        if (titleMobile) titleMobile.innerText = "Mis Series y Videos";
    }
}

/**
 * `renderVideoDetailHeroAndSeasonControls(container, filtered)`
 * Muestra la cabecera detallada de una serie/película y el selector de temporadas.
 */
function renderVideoDetailHeroAndSeasonControls(container, filtered) {
    const navParts = currentPath.split('/').filter(Boolean);
    const isShowDetail = navParts.length >= 3;
    if (!isShowDetail) return;

    const baseShowPath = navParts.slice(0, 3).join('/') + '/';
    const showFiles = filtered.filter(f => f.path.startsWith(baseShowPath));
    if (showFiles.length === 0) return;

    const showTitle = navParts[2];
    const categoryName = navParts[1] || window.netflixActiveCategory || 'Video';
    const heroSource = showFiles.find(f => f.rating === 1) || showFiles[0];
    const heroCover = heroSource.tmdb_poster
        ? `/caratula/${encodeURIComponent(heroSource.tmdb_poster)}`
        : `/caratula/${heroSource.path.split('/').map(p => encodeURIComponent(p)).join('/')}`;
    const detailHeroItem = {
        type: 'folder',
        name: heroSource.tmdb_title || showTitle,
        title: heroSource.tmdb_title || showTitle,
        path: baseShowPath,
        sample: heroSource,
        folder_type: heroSource.folder_type,
        tmdb_id: heroSource.tmdb_id,
        tmdb_poster: heroSource.tmdb_poster
    };

    const seasonSet = new Set();
    showFiles.forEach(f => {
        const rel = f.path.substring(baseShowPath.length);
        const season = rel.split('/')[0];
        if (season && rel.includes('/')) seasonSet.add(season);
    });
    const allSeasons = Array.from(seasonSet).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
    const activeSeason = navParts[3] || currentFolderView || allSeasons[0] || '';

    /**
     * `goToSeasonSelect(seasonName)`
     * Filtra y muestra los episodios correspondientes a la temporada seleccionada.
     */
    window.goToSeasonSelect = function (seasonName) {
        if (!seasonName) return;
        currentFolderView = seasonName;
        currentPath = `${baseShowPath}${seasonName}/`;
        renderLib();
    };

    const seasonSelect = allSeasons.length > 0 ? `
        <div class="flex items-center gap-2 bg-black/35 border border-white/15 rounded-full px-3 py-2 backdrop-blur">
            <i class="fa-solid fa-layer-group text-emerald-400 text-xs"></i>
            <select onchange="goToSeasonSelect(this.value)" class="bg-transparent text-white text-xs md:text-sm font-bold outline-none">
                ${allSeasons.map(s => `<option value="${escapeHtml(s)}" ${s === activeSeason ? 'selected' : ''} class="bg-[#111] text-white">${escapeHtml(s)}</option>`).join('')}
            </select>
        </div>
    ` : '';

    if (typeof renderSeriesHero === 'function') {
        const detailHeroPlaceholderId = 'detail-hero-' + Date.now();
        container.innerHTML += `<div id="${detailHeroPlaceholderId}" class="col-span-full relative w-full h-[14vh] min-h-[100px] md:h-[18vh] md:min-h-[140px] rounded-2xl overflow-hidden border border-white/10 mb-3">
            <img src="${heroCover}" class="absolute inset-0 w-full h-full object-cover opacity-65" onerror="this.style.display='none'">
            <div class="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/95 via-[#0a0a0a]/65 to-transparent"></div>
            <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/95 to-transparent"></div>
            <div class="relative z-10 h-full p-4 md:p-6 flex flex-col justify-end">
                <div class="flex items-center gap-2 mb-2">
                    <div class="w-1 h-3 bg-emerald-500 rounded"></div>
                    <span class="text-[10px] md:text-xs font-black tracking-[0.2em] text-white/90 uppercase">${escapeHtml(categoryName)} · TEMPORADAS</span>
                </div>
                <h2 class="text-2xl md:text-4xl font-black text-white leading-tight line-clamp-2 mb-3">${escapeHtml(showTitle)}</h2>
            </div>
        </div>`;

        renderSeriesHero(detailHeroItem, categoryName, { showCastInHero: false, fullInfo: true, showInfoButton: false }).then(richHtml => {
            const ph = document.getElementById(detailHeroPlaceholderId);
            if (!ph || !richHtml) return;
            const wrap = document.createElement('div');
            wrap.innerHTML = richHtml;
            const richEl = wrap.firstElementChild;
            if (!richEl) return;
            richEl.classList.add('col-span-full');
            ph.replaceWith(richEl);
        }).catch(e => console.warn('[DETAIL HERO] render failed:', e));
    }

    container.innerHTML += `
        <div class="w-full flex items-center justify-between gap-2 px-2 md:px-0 mt-1 mb-4 overflow-x-auto no-scrollbar">
            <div class="flex items-center gap-3">
                <button onclick="currentPath='${escapeStr(baseShowPath)}'; currentFolderView=null; renderLib();" class="bg-white hover:bg-emerald-50 text-black font-extrabold text-xs md:text-sm py-2.5 px-5 rounded-full transition flex items-center gap-2">
                    <i class="fa-solid fa-folder-open"></i> Explorar Temporadas
                </button>
                ${seasonSelect}
            </div>
            <div class="flex gap-2 shrink-0">
                <button onclick="toggleSelectionMode()" class="px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 text-white/70 hover:bg-white/20 border border-white/10 transition">
                    <i class="fa-regular fa-square-check"></i>
                </button>
                <button onclick="selectAllVisible()" class="px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 text-white/70 hover:bg-white/20 border border-white/10 transition">
                    <i class="fa-solid fa-check-double"></i>
                </button>
            </div>
        </div>
    `;
}

/**
 * `buildVideoDirectoryGroups(filtered, isSearching)`
 * Agrupa subcarpetas y archivos de video dentro del directorio actual de navegación.
 */
function buildVideoDirectoryGroups(filtered, isSearching) {
    const relevantFiles = filtered.filter(f => f.path.startsWith(currentPath));
    const groups = {};
    const directFiles = [];

    if (isSearching) {
        directFiles.push(...relevantFiles);
    } else {
        relevantFiles.forEach(f => {
            const rel = f.path.substring(currentPath.length);
            const parts = rel.split('/');
            if (parts.length === 1) {
                directFiles.push(f);
            } else {
                const subFolder = parts[0];
                if (!groups[subFolder]) groups[subFolder] = { isSeason: true, files: [] };
                if (parts.length > 2) groups[subFolder].isSeason = false;
                groups[subFolder].files.push(f);
            }
        });
    }
    return { groups, directFiles };
}

/**
 * `renderVideoFolderGroups(container, groups, shouldForceVideoList)`
 * Renderiza las tarjetas de carpetas (temporadas/colecciones) dentro de una vista de directorio de video.
 */
function renderVideoFolderGroups(container, groups, shouldForceVideoList) {
    Object.keys(groups).sort().forEach(name => {
        if (!groups[name].isSeason) {
            const sample = groups[name].files[0];
            const count = groups[name].files.length;
            if (shouldForceVideoList) {
                container.innerHTML += `
            <div data-folder="${name}" onclick="navigateTo(this.dataset.folder)" class="list-row group bg-[#121212] border-l-4 border-transparent hover:border-emerald-500 hover:bg-[#1e1e1e] cursor-pointer flex items-center p-2 gap-4">
                <i class="fa-solid fa-folder text-2xl text-emerald-500 group-hover:text-emerald-400 ml-2"></i>
                <span class="font-bold text-white flex-1">${name}</span>
                <span class="text-[10px] bg-emerald-800 text-emerald-400 px-2 py-0.5 rounded">${count} items</span>
                <i class="fa-solid fa-chevron-right text-emerald-600 mr-2"></i>
            </div>`;
            } else if (currentLibrary === 'video') {
                const seriesPosterName = encodeURIComponent(name) + '.jpg';
                const folderPoster = `/caratula/${seriesPosterName}`;
                container.innerHTML += `
            <div data-folder="${name}" onclick="navigateTo(this.dataset.folder)" class="bg-[#121212] p-2 rounded-xl hover:bg-[#1e1e1e] transition cursor-pointer group relative shadow-lg border border-white/5 overflow-hidden">
                <div class="relative w-full aspect-[2/3] bg-[#0a0a0a] rounded-lg overflow-hidden">
                    <img src="${folderPoster}" loading="lazy" decoding="async" class="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition group-hover:scale-105" onerror="this.onerror=null; this.src='/caratula/${sample.path.split('/').map(p => encodeURIComponent(p)).join('/')}'; this.classList.add('opacity-50');">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"></div>
                    <div class="absolute inset-0 flex items-center justify-center">
                        <i class="fa-solid fa-folder-open text-5xl text-white/85 drop-shadow-xl group-hover:text-emerald-300 transition"></i>
                    </div>
                    <span class="absolute top-2 right-2 bg-emerald-600/90 text-[10px] text-white px-2 py-0.5 rounded font-bold shadow">${count}</span>
                    <div class="absolute bottom-0 left-0 right-0 p-2.5">
                        <h3 class="font-bold text-white truncate text-sm group-hover:text-emerald-300 transition">${name}</h3>
                    </div>
                </div>
            </div>`;
            } else {
                container.innerHTML += `
            <div data-folder="${name}" onclick="navigateTo(this.dataset.folder)" class="bg-[#121212] p-3 rounded-xl hover:bg-[#1e1e1e] transition cursor-pointer group relative shadow-lg border border-white/5">
                <div class="relative w-full aspect-square bg-[#0a0a0a] rounded-lg overflow-hidden mb-3">
                    <img src="/caratula/${sample.path.split('/').map(p => encodeURIComponent(p)).join('/')}" loading="lazy" decoding="async" class="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition group-hover:scale-110" onerror="this.style.display='none'">
                    <div class="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-transparent transition">
                        <i class="fa-solid fa-folder text-5xl text-white/80 drop-shadow-lg group-hover:text-emerald-400 transition"></i>
                    </div>
                    <span class="absolute bottom-1 right-1 bg-emerald-600 text-[10px] text-white px-2 py-0.5 rounded font-bold shadow">${count}</span>
                </div>
                <h3 class="font-bold text-white truncate text-sm text-center group-hover:text-emerald-400 transition">${name}</h3>
            </div>`;
            }
        }
    });
}
