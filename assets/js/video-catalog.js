/**
 * ============================================================================
 * KRAKEN MEDIA SERVER — video-catalog.js
 * Catálogo de video estilo Netflix: filtros por categoría/género, sub-temáticas,
 * sagas/colecciones, carruseles inteligentes, Hero banner, maratón y temporadas.
 * ============================================================================
 */

// Mapa de sub-temáticas contextuales para géneros amplios
const GENRE_SUBTHEMES_MAP = {
    'Terror': [
        { id: 'sobrenatural', label: '👻 Sobrenatural y Posesiones', terms: ['supernatural', 'demon', 'possession', 'exorcism', 'ghost', 'haunted', 'spirit', 'paranormal', 'curse', 'witch', 'bruja', 'exorcismo', 'demonio', 'fantasma', 'espíritu', 'maldición', 'conjuro'] },
        { id: 'slasher', label: '🔪 Slasher y Asesinos', terms: ['slasher', 'serial killer', 'murder', 'psychopath', 'masked killer', 'stalker', 'asesino', 'masacre', 'psicópata', 'cuchillo'] },
        { id: 'zombis', label: '🧟 Zombis e Infección', terms: ['zombie', 'undead', 'infection', 'virus', 'apocalypse', 'epidemic', 'cannibal', 'zombi', 'infectado', 'epidemia', 'caníbal'] },
        { id: 'psicologico', label: '🧠 Terror Psicológico', terms: ['psychological', 'paranoia', 'madness', 'hallucination', 'cult', 'nightmare', 'secta', 'locura', 'psicológico', 'pesadilla', 'suspenso'] },
        { id: 'monstruos', label: '👹 Monstruos y Criaturas', terms: ['monster', 'creature', 'vampire', 'werewolf', 'alien', 'beast', 'mutant', 'vampiro', 'hombre lobo', 'criatura', 'monstruo', 'bestia'] },
        { id: 'supervivencia', label: '🩸 Gore y Supervivencia', terms: ['gore', 'survival', 'torture', 'trap', 'cabin', 'woods', 'isolation', 'supervivencia', 'trampa', 'sangre', 'cabaña'] }
    ],
    'Ciencia ficción': [
        { id: 'espacio', label: '🚀 Espacio y Aliens', terms: ['space', 'alien', 'planet', 'galaxy', 'astronaut', 'spaceship', 'extraterrestrial', 'espacio', 'planeta', 'galaxia', 'nave', 'extraterrestre'] },
        { id: 'tiempo', label: '⏳ Viajes en el Tiempo', terms: ['time travel', 'time loop', 'future', 'paradox', 'multiverse', 'tiempo', 'futuro', 'multiverso', 'paradoja'] },
        { id: 'cyberpunk', label: '🤖 Cyberpunk, Robots e IA', terms: ['cyberpunk', 'artificial intelligence', 'robot', 'android', 'cyborg', 'virtual reality', 'hacker', 'inteligencia artificial', 'androide'] },
        { id: 'postapoc', label: '🌍 Distopía y Post-Apocalipsis', terms: ['dystopia', 'post-apocalyptic', 'apocalypse', 'survival', 'wasteland', 'distopía', 'apocalipsis', 'futuro sombrío'] }
    ],
    'Acción': [
        { id: 'artes_marciales', label: '🥋 Artes Marciales y Peleas', terms: ['martial arts', 'kung fu', 'ninja', 'samurai', 'fight', 'boxing', 'tournament', 'artes marciales', 'pelea', 'combate', 'samurái'] },
        { id: 'espionaje', label: '🕵️ Espionaje y Agentes', terms: ['spy', 'secret agent', 'cia', 'assassin', 'hitman', 'mercenary', 'espía', 'agente', 'sicario', 'mercenario'] },
        { id: 'superheroes', label: '🦸 Superhéroes y Cómics', terms: ['superhero', 'marvel', 'dc', 'comic', 'superpower', 'vigilante', 'superhéroe', 'poderes', 'villano'] },
        { id: 'crimen_autos', label: '🏎️ Persecuciones y Atracos', terms: ['heist', 'car chase', 'racing', 'bank robbery', 'cartel', 'mafia', 'venganza', 'revenge', 'atraco', 'robo', 'carreras'] }
    ],
    'Animación': [
        { id: 'anime_shonen', label: '⚔️ Anime / Acción y Fantasía', terms: ['anime', 'manga', 'shonen', 'demon', 'magic', 'ninja', 'mecha', 'japonés'] },
        { id: 'familiar', label: '🧸 Familiar y Aventura', terms: ['family', 'pixar', 'disney', 'dreamworks', 'talking animal', 'friendship', 'aventura', 'familia'] },
        { id: 'adult_anim', label: '🌙 Animación para Adultos', terms: ['adult animation', 'satire', 'dark comedy', 'cyberpunk', 'gore'] }
    ],
    'Comedia': [
        { id: 'romantica', label: '💘 Comedia Romántica', terms: ['romantic comedy', 'romance', 'love', 'wedding', 'dating', 'amor', 'boda', 'pareja'] },
        { id: 'humor_negro', label: '💀 Humor Negro y Sátira', terms: ['dark comedy', 'black comedy', 'satire', 'parody', 'spoof', 'parodia', 'sátira', 'absurdo'] },
        { id: 'familiar_com', label: '🍿 Familiar y Amigos', terms: ['buddy', 'school', 'teen', 'party', 'vacation', 'amigos', 'fiesta', 'vacaciones', 'escuela'] }
    ],
    'Suspense': [
        { id: 'misterio_crimen', label: '🕵️ Detectives y Crimen', terms: ['detective', 'investigation', 'murder', 'police', 'serial killer', 'crimen', 'investigación', 'policía', 'asesinato'] },
        { id: 'psico_thriller', label: '🧠 Thriller Psicológico', terms: ['psychological', 'paranoia', 'mind', 'twist', 'conspiracy', 'psicológico', 'conspiración', 'mente', 'engaño'] },
        { id: 'supervivencia_th', label: '⏳ Tensión y Supervivencia', terms: ['hostage', 'kidnapping', 'survival', 'escape', 'secuestro', 'rehén', 'escape', 'supervivencia'] }
    ],
    'Fantasía': [
        { id: 'epica_magia', label: '🧙 Magia y Mundos Épicos', terms: ['magic', 'wizard', 'dragon', 'sword', 'kingdom', 'mythology', 'magia', 'dragón', 'reino', 'hechicero', 'mitología'] },
        { id: 'oscura', label: '🌑 Fantasía Oscura', terms: ['dark fantasy', 'curse', 'demon', 'vampire', 'gothic', 'maldición', 'demonio', 'oscuro', 'gótico'] }
    ]
};

function getSubthemesForGenre(genreName) {
    if (!genreName) return null;
    if (GENRE_SUBTHEMES_MAP[genreName]) return GENRE_SUBTHEMES_MAP[genreName];
    const norm = normalizeText(genreName);
    if (norm === 'thriller' || norm === 'misterio' || norm === 'suspenso') return GENRE_SUBTHEMES_MAP['Suspense'];
    if (norm === 'horror') return GENRE_SUBTHEMES_MAP['Terror'];
    if (norm === 'sci-fi' || norm === 'ciencia ficcion') return GENRE_SUBTHEMES_MAP['Ciencia ficción'];
    const foundKey = Object.keys(GENRE_SUBTHEMES_MAP).find(k => normalizeText(k) === norm);
    return foundKey ? GENRE_SUBTHEMES_MAP[foundKey] : null;
}

// Estados globales de filtrado multicriterio
window.netflixActiveCategory = window.netflixActiveCategory || 'Todo';
window.netflixGenreFilter = window.netflixGenreFilter || null;
window.netflixActiveSubtheme = window.netflixActiveSubtheme || 'Todos';
window.netflixActiveDecade = window.netflixActiveDecade || 'Todas';
window.netflixActiveDuration = window.netflixActiveDuration || 'Todas';
window.netflixActiveTech = window.netflixActiveTech || 'Todos';
window.netflixSortBy = window.netflixSortBy || 'recent';
window.netflixGroupCollections = window.netflixGroupCollections !== undefined ? window.netflixGroupCollections : true;
window.netflixActivePersonFilter = window.netflixActivePersonFilter || null;
window._collectionsStore = window._collectionsStore || {};

/**
 * Motor de Títulos Similares en Biblioteca Local (v5.0.2)
 */
window.getSimilarLibraryItems = function (refItem, limit = 12) {
    if (!refItem || !libData || !Array.isArray(libData.files)) return [];
    const ref = refItem.sample || refItem;
    const refPath = (ref.path || '').replace(/\\/g, '/');
    const refParts = refPath.split('/').filter(Boolean);
    const refSeriesKey = (refParts.length > 3 && ref.folder_type !== 'movie') ? refParts.slice(0, 3).join('/') : '';
    const refTmdbId = Number(ref.tmdb_id || refItem.tmdb_id || 0);
    const refColl = ref.tmdb_collection_name || '';
    const refDirectors = (ref.tmdb_director || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const refActors = (ref.tmdb_cast || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const refKeywords = (ref.tmdb_keywords || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const refGenres = (ref.tmdb_genres || ref.genre || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const refStudio = (ref.tmdb_studio || '').split(',').map(s => s.trim().toLowerCase())[0] || '';
    const refYear = parseInt(ref.tmdb_year || 0, 10);
    const refType = ref.folder_type || 'movie';

    const candidates = [];
    const seenEntities = new Set([refPath]);
    if (refSeriesKey) seenEntities.add(`series:${refSeriesKey}`);
    if (refTmdbId > 0) seenEntities.add(`tmdb:${refType}:${refTmdbId}`);

    libData.files.forEach(f => {
        if (f.type !== 'video' || f.is_adult !== ref.is_adult) return;
        const p = (f.path || '').replace(/\\/g, '/');
        const parts = p.split('/').filter(Boolean);
        const isSeries = (parts.length > 3 && f.folder_type !== 'movie');
        const seriesKey = isSeries ? parts.slice(0, 3).join('/') : '';
        const fTmdbId = Number(f.tmdb_id || 0);
        const fType = f.folder_type || (isSeries ? 'series' : 'movie');

        if (seenEntities.has(p)) return;
        if (seriesKey && seenEntities.has(`series:${seriesKey}`)) return;
        if (fTmdbId > 0 && seenEntities.has(`tmdb:${fType}:${fTmdbId}`)) return;

        seenEntities.add(p);
        if (seriesKey) seenEntities.add(`series:${seriesKey}`);
        if (fTmdbId > 0) seenEntities.add(`tmdb:${fType}:${fTmdbId}`);

        let score = 0;
        let reasons = [];

        // 1. Misma saga (+85)
        if (refColl && f.tmdb_collection_name && refColl.toLowerCase() === f.tmdb_collection_name.toLowerCase()) {
            score += 85;
            reasons.push('📚 Misma saga');
        }

        // 2. Mismo director (+45)
        if (refDirectors.length > 0 && f.tmdb_director) {
            const fDirs = f.tmdb_director.split(',').map(s => s.trim().toLowerCase());
            const matchedDir = refDirectors.find(d => fDirs.includes(d));
            if (matchedDir) {
                score += 45;
                reasons.push(`🎬 Director: ${matchedDir}`);
            }
        }

        // 3. Keywords / Sub-temáticas (+20 c/u, máx 60)
        if (refKeywords.length > 0 && f.tmdb_keywords) {
            const fKw = f.tmdb_keywords.split(',').map(s => s.trim().toLowerCase());
            let kwMatches = 0;
            refKeywords.forEach(k => {
                if (fKw.includes(k)) kwMatches++;
            });
            if (kwMatches > 0) {
                score += Math.min(60, kwMatches * 20);
                reasons.push('Temática similar');
            }
        }

        // 4. Actores en común (+18 c/u, máx 54)
        if (refActors.length > 0 && f.tmdb_cast) {
            const fCast = f.tmdb_cast.split(',').map(s => s.trim().toLowerCase());
            let actMatches = 0;
            refActors.forEach(a => {
                if (fCast.includes(a)) actMatches++;
            });
            if (actMatches > 0) {
                score += Math.min(54, actMatches * 18);
                reasons.push('Reparto común');
            }
        }

        // 5. Géneros en común (+15 c/u)
        if (refGenres.length > 0) {
            const fGenres = (f.tmdb_genres || f.genre || '').split(',').map(s => s.trim().toLowerCase());
            let gMatches = 0;
            const matchedGenres = [];
            refGenres.forEach(g => {
                if (fGenres.includes(g)) {
                    gMatches++;
                    matchedGenres.push(g);
                }
            });
            if (gMatches > 0) {
                score += gMatches * 15;
                if (reasons.length === 0) {
                    const prettyGenre = matchedGenres.slice(0, 2).map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(', ');
                    reasons.push(`Género: ${prettyGenre}`);
                }
            }
        }

        // 6. Mismo estudio (+18)
        if (refStudio && f.tmdb_studio && f.tmdb_studio.toLowerCase().includes(refStudio)) {
            score += 18;
            reasons.push(refStudio);
        }

        // 7. Misma década (+10)
        const fYear = parseInt(f.tmdb_year || 0, 10);
        if (refYear > 0 && fYear > 0 && Math.abs(refYear - fYear) <= 6) {
            score += 10;
        }

        // 8. Mismo formato (+8)
        if (f.folder_type === refType) {
            score += 8;
        }

        if (score >= 20) {
            const displayTitle = isSeries
                ? (f.tmdb_title || (parts[2] || '').replace(/\s*[\(\[\{]?tmdb[-_]?\d+[\)\]]?/gi, '').trim() || f.title)
                : (f.tmdb_title || f.clean_title || f.title);
            candidates.push({
                ...f,
                _isSeries: isSeries,
                _seriesPath: isSeries ? (seriesKey + '/') : '',
                _displayTitle: displayTitle,
                _simScore: score,
                _simReason: reasons[0] || 'Similar'
            });
        }
    });

    candidates.sort((a, b) => b._simScore - a._simScore);
    return candidates.slice(0, limit);
};

/**
 * Agrupa películas individuales en Colecciones / Sagas Oficiales e Inteligentes
 */
function _extractSagaBaseTitle(rawTitle) {
    if (!rawTitle) return { base: '', isSequelOrSubtitled: false };
    let clean = String(rawTitle)
        .replace(/\s*[\(\[\{]?tmdb[-_]?\d+[\)\]\}]?/gi, '')
        .replace(/\s*\((?:19|20)\d{2}\)/g, '')
        .replace(/\.(mp4|mkv|webm|avi)$/i, '')
        .replace(/\s*[-–—:]\s*$/, '')
        .trim();

    let isSequelOrSubtitled = false;
    let base = clean;

    // 1. Si tiene ':' o ' - ' (subtítulo de entrega), tomar lo que está antes
    const colonMatch = base.match(/^([^:–—]{3,45}?)(?:\s*[:–—]|\s+-\s+)/);
    if (colonMatch && colonMatch[1]) {
        base = colonMatch[1].trim();
        isSequelOrSubtitled = true;
    }

    // 2. Quitar sufijos tipo "Parte 2", "Vol. 1", "Capítulo 3" o números al final ("American Pie 2", "Rápidos y Furiosos 7", "5in Control")
    const sequelSuffix = base.match(/^(.{3,40}?)\s+(?:part[e]?\s*\d+|vol(?:umen)?\.?\s*\d+|cap[ií]tulo\s*\d+|\d+(?:in\b.*)?|[I]{2,3}|IV|V|VI)$/i);
    if (sequelSuffix && sequelSuffix[1] && sequelSuffix[1].trim().length >= 3) {
        base = sequelSuffix[1].trim();
        isSequelOrSubtitled = true;
    }

    // Normalizar plural/singular común en Rápido(s) y Furioso(s)
    if (/^r[aá]pidos?\s+y\s+furiosos?$/i.test(base)) {
        base = 'Rápidos y Furiosos';
    }

    return { base: base.trim(), isSequelOrSubtitled, cleanFull: clean };
}

function groupMoviesIntoCollections(shows) {
    window._collectionsStore = {};
    const seriesItems = [];
    const movieItems = [];
    const otherItems = [];

    shows.forEach(s => {
        const src = s.sample || s;
        if (s.type === 'folder' && s.folder_type !== 'movie') {
            seriesItems.push(s);
        } else if (src.folder_type === 'movie' || s.type === 'video' || s.duration_sec) {
            movieItems.push(s);
        } else {
            otherItems.push(s);
        }
    });

    // Mapa unificado por clave normalizada de nombre de saga para fusionar TMDb + heurística
    const collectionsMap = new Map();
    const tmdbIdToKey = new Map();
    const pendingStandalone = [];

    // PASADA 1: Películas con colección oficial TMDb o con patrón explícito de secuela/subtítulo
    movieItems.forEach(m => {
        const src = m.sample || m;
        let tmdbCollName = (src.tmdb_collection_name || '').trim()
            .replace(/\s*[-–—]?\s*Colecci[oó]n$/i, '')
            .replace(/\s+Collection$/i, '')
            .replace(/\s*シリーズ$/i, '')
            .trim();
        let collId = src.tmdb_collection_id ? Number(src.tmdb_collection_id) : null;
        let collPoster = src.tmdb_collection_poster;

        const rawTitle = src.tmdb_title || src.clean_title || src.title || m.name || m.title || '';
        const parsed = _extractSagaBaseTitle(rawTitle);

        let chosenName = tmdbCollName || (parsed.isSequelOrSubtitled ? parsed.base : '');
        const normChosen = normalizeText(chosenName);
        const normBase = normalizeText(parsed.base);

        if (collId) {
            // Franquicia Oficial TMDb: agrupamiento estricto por ID de colección oficial TMDb
            const normKey = `tmdb_coll_${collId}`;
            if (!collectionsMap.has(normKey)) {
                collectionsMap.set(normKey, {
                    name: tmdbCollName || chosenName || 'Colección',
                    normName: normChosen,
                    id: collId,
                    poster: collPoster,
                    baseNorm: normChosen,
                    items: []
                });
            }
            const grp = collectionsMap.get(normKey);
            if (tmdbCollName && grp.name !== tmdbCollName) {
                grp.name = tmdbCollName;
                grp.normName = normalizeText(tmdbCollName);
            }
            if (!grp.poster && collPoster) grp.poster = collPoster;
            grp.items.push(m);
        } else if (chosenName && normChosen.length >= 3 && parsed.isSequelOrSubtitled) {
            // Franquicia Heurística por nombre base limpio (sin mezclar con colecciones TMDb con ID)
            const normKey = `saga_${normChosen}`;
            if (!collectionsMap.has(normKey)) {
                collectionsMap.set(normKey, {
                    name: chosenName,
                    normName: normChosen,
                    id: null,
                    poster: null,
                    baseNorm: normChosen,
                    items: []
                });
            }
            const grp = collectionsMap.get(normKey);
            grp.items.push(m);
        } else {
            pendingStandalone.push({ movie: m, parsed });
        }
    });

    // PASADA 2: Unir la "Película 1" (título base sin ':' ni número, ej. "Titanes Del Pacífico", "Inframundo")
    // si su título limpio coincide con una saga detectada en la Pasada 1
    const standaloneByBase = new Map();
    pendingStandalone.forEach(entry => {
        const normFull = normalizeText(entry.parsed.cleanFull || entry.parsed.base);
        if (!normFull || normFull.length < 3) {
            standaloneByBase.set(`_single_${Math.random()}`, [entry]);
            return;
        }
        let matchedGroup = null;
        for (const grp of collectionsMap.values()) {
            if (grp.baseNorm && grp.baseNorm.length >= 3 && grp.baseNorm === normFull) {
                matchedGroup = grp;
                break;
            }
        }
        if (matchedGroup) {
            matchedGroup.items.push(entry.movie);
        } else {
            if (!standaloneByBase.has(normFull)) standaloneByBase.set(normFull, []);
            standaloneByBase.get(normFull).push(entry);
        }
    });

    const looseMovies = [];
    standaloneByBase.forEach((entries, normFull) => {
        // Solo agrupar por nombre idéntico si son películas distintas (ej. remake de distinto año), no copias del mismo archivo
        const distinctIds = new Set(entries.map(e => {
            const s = e.movie.sample || e.movie;
            return s.tmdb_id ? `tmdb_${s.tmdb_id}` : `title_${normalizeText(s.title || '')}_${s.tmdb_year || ''}`;
        }));
        if (entries.length >= 2 && distinctIds.size >= 2 && normFull.length >= 4 && !normFull.startsWith('_single_')) {
            const firstEntry = entries[0];
            collectionsMap.set(`saga_${normFull}`, {
                name: firstEntry.parsed.cleanFull || firstEntry.parsed.base,
                normName: normFull,
                id: null,
                poster: null,
                baseNorm: normFull,
                items: entries.map(e => e.movie)
            });
        } else {
            entries.forEach(e => looseMovies.push(e.movie));
        }
    });

    const result = [...seriesItems, ...otherItems];

    collectionsMap.forEach((grp, key) => {
        // Verificar que haya al menos 2 películas distintas en la saga (evitar que un archivo duplicado forme una saga falsa)
        const distinctMovies = new Set(grp.items.map(it => {
            const s = it.sample || it;
            return s.tmdb_id ? `tmdb_${s.tmdb_id}` : `path_${normalizeText(s.clean_title || s.title || '')}_${s.tmdb_year || ''}`;
        }));
        if (grp.items.length >= 2 && distinctMovies.size >= 2) {
            grp.items.sort((a, b) => {
                const yA = parseInt((a.sample || a).tmdb_year || 0, 10) || 9999;
                const yB = parseInt((b.sample || b).tmdb_year || 0, 10) || 9999;
                return yA - yB;
            });
            const first = grp.items[0].sample || grp.items[0];
            const years = grp.items.map(it => parseInt((it.sample || it).tmdb_year || 0, 10)).filter(y => y > 0);
            const firstY = years.length ? Math.min(...years) : '';
            const lastY = years.length ? Math.max(...years) : '';
            const yearRange = (firstY && lastY && firstY !== lastY) ? `${firstY} - ${lastY}` : (firstY ? `${firstY}` : '');

            let totalVote = 0;
            let countVote = 0;
            grp.items.forEach(it => {
                const v = Number((it.sample || it).tmdb_vote_average || 0);
                if (v > 0) { totalVote += v; countVote++; }
            });
            const avgVote = countVote > 0 ? (totalVote / countVote).toFixed(1) : null;

            const mergedGenres = Array.from(new Set(
                grp.items.flatMap(it => ((it.sample || it).genre || '').split(',').map(s => s.trim()).filter(Boolean))
            )).join(', ');

            const collObj = {
                type: 'collection',
                isCollection: true,
                collectionKey: key,
                name: grp.name,
                title: grp.name,
                path: first.path || '',
                count: grp.items.length,
                items: grp.items.map(it => it.sample || it),
                sample: first,
                poster: grp.poster || first.tmdb_poster,
                yearRange: yearRange,
                vote_average: avgVote,
                genre: mergedGenres || first.genre,
                date: Math.max(...grp.items.map(it => Number((it.sample || it).date || 0)))
            };
            window._collectionsStore[key] = collObj;
            result.push(collObj);
        } else {
            looseMovies.push(...grp.items);
        }
    });

    result.push(...looseMovies);
    return result;
}


/**
 * `setupNetflixRootFilters(categoriesArray, genresArray)`
 * Configura los menús desplegables de categorías y géneros en la vista principal de video estilo Netflix.
 */
function setupNetflixRootFilters(categoriesArray, genresArray) {
    if (!window.netflixGenreFilter) window.netflixGenreFilter = null;

    window.filterByGenre = function (genre) {
        const targetGenre = (typeof genre === 'string') ? genre : (genre?.dataset?.genre ?? null);
        window.netflixGenreFilter = (window.netflixGenreFilter === targetGenre) ? null : targetGenre;
        window.netflixActiveSubtheme = 'Todos';
        window.netflixGridRenderLimit = 84;
        if (window.netflixGenreFilter) videoUIState.recommendationsOpen = false;
        renderLib();
    };

    window.hideDropdownByType = function (type, exceptRoot = null) {
        const selector = `[data-${type}-root]`;
        const menuSel = `[data-${type}-menu]`;
        const chevronSel = `[data-${type}-chevron]`;
        document.querySelectorAll(selector).forEach(root => {
            if (exceptRoot && root === exceptRoot) return;
            const menu = root.querySelector(menuSel);
            const chev = root.querySelector(chevronSel);
            if (menu) menu.classList.add('hidden');
            if (chev) chev.style.transform = 'rotate(0deg)';
        });
    };

    window.changeNetflixCategory = async function (newCat) {
        newCat = (typeof newCat === 'string') ? newCat : (newCat?.dataset?.category || '');
        window.hideDropdownByType('category');
        if (newCat === '🔞 Adult') {
            const isUnlocked = Boolean(libData?.adult_unlocked || (libData?.files || []).some(f => f.is_adult));
            if (!isUnlocked) {
                const pin = getMasterPin('PIN Maestro requerido para desbloquear 🔞 Adult:');
                if (!pin) return;
                window.netflixActiveCategory = newCat;
                window.netflixGenreFilter = null;
                window.netflixActiveSubtheme = 'Todos';
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
        window.netflixActiveSubtheme = 'Todos';
        window.netflixGridRenderLimit = 84;
        videoUIState.recommendationsOpen = true;
        const mobileInput = document.getElementById('lib-search-mobile');
        const desktopInput = document.getElementById('lib-search-desktop');
        if (mobileInput) mobileInput.value = '';
        if (desktopInput) desktopInput.value = '';
        renderLib();
    };

    window.changeNetflixDecade = function (dec) {
        window.netflixActiveDecade = dec;
        window.netflixGridRenderLimit = 84;
        window.hideDropdownByType('decade');
        window.hideDropdownByType('advfilters');
        renderLib();
    };

    window.changeNetflixDuration = function (dur) {
        window.netflixActiveDuration = dur;
        window.netflixGridRenderLimit = 84;
        window.hideDropdownByType('duration');
        window.hideDropdownByType('advfilters');
        renderLib();
    };

    window.changeNetflixTech = function (tech) {
        window.netflixActiveTech = tech;
        window.netflixGridRenderLimit = 84;
        window.hideDropdownByType('tech');
        window.hideDropdownByType('advfilters');
        renderLib();
    };

    window.resetNetflixAdvancedFilters = function () {
        window.netflixActiveDecade = 'Todas';
        window.netflixActiveDuration = 'Todas';
        window.netflixActiveTech = 'Todos';
        window.netflixActiveSubtheme = 'Todos';
        window.netflixActivePersonFilter = null;
        window.netflixGridRenderLimit = 84;
        window.hideDropdownByType('advfilters');
        renderLib();
    };

    window.changeNetflixSort = function (sort) {
        window.netflixSortBy = sort;
        window.hideDropdownByType('sort');
        renderLib();
    };

    window.changeNetflixSubtheme = function (subId) {
        window.netflixActiveSubtheme = subId;
        window.netflixGridRenderLimit = 84;
        renderLib();
    };

    window.toggleGroupCollections = function () {
        window.netflixGroupCollections = !window.netflixGroupCollections;
        window.netflixGridRenderLimit = 84;
        if (typeof showToast === 'function') {
            showToast(window.netflixGroupCollections ? '📚 Agrupación de Sagas activada' : '🎬 Modo Películas individuales', 'info');
        }
        renderLib();
    };

    window.toggleCustomFilterDropdown = function (event, type) {
        if (event) event.stopPropagation();
        const targetEl = (event && (event.currentTarget || event.target)) || null;
        const root = targetEl && typeof targetEl.closest === 'function'
            ? targetEl.closest(`[data-${type}-root]`)
            : document.querySelector(`[data-${type}-root]`);
        if (!root) return;
        const menu = root.querySelector(`[data-${type}-menu]`);
        const chev = root.querySelector(`[data-${type}-chevron]`);
        const isHidden = menu ? menu.classList.contains('hidden') : true;
        ['category', 'genre', 'advfilters', 'decade', 'duration', 'tech', 'sort'].forEach(t => window.hideDropdownByType(t));
        if (menu && isHidden) {
            menu.style.left = '';
            menu.style.right = '';
            menu.classList.remove('hidden');
            const rect = menu.getBoundingClientRect();
            const vw = window.innerWidth || 360;
            if (rect.right > vw - 10) {
                const shift = Math.min(rect.left - 8, rect.right - (vw - 10));
                if (shift > 0) menu.style.left = `-${Math.round(shift)}px`;
            }
            if (chev) chev.style.transform = 'rotate(180deg)';
        }
    };

    window.toggleCategoryDropdown = function (event) { window.toggleCustomFilterDropdown(event, 'category'); };
    window.toggleGenreDropdown = function (event) { window.toggleCustomFilterDropdown(event, 'genre'); };

    if (!window.__krakenDropdownOutsideBound) {
        window.__krakenDropdownOutsideBound = true;
        document.addEventListener('click', function (e) {
            ['category', 'genre', 'advfilters', 'decade', 'duration', 'tech', 'sort'].forEach(t => {
                if (!e.target.closest(`[data-${t}-root]`)) window.hideDropdownByType?.(t);
            });
        });
    }

    window.toggleRecommendations = function () {
        const section = document.getElementById('recommendations-section');
        const btn = document.getElementById('recommendations-btn');
        if (section) {
            const isHidden = section.classList.contains('hidden');
            if (isHidden) {
                section.classList.remove('hidden');
                videoUIState.recommendationsOpen = true;
                if (btn) btn.classList.add('ring-2', 'ring-emerald-400/50');
                setTimeout(() => { section.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
            } else {
                section.classList.add('hidden');
                videoUIState.recommendationsOpen = false;
                if (btn) btn.classList.remove('ring-2', 'ring-emerald-400/50');
            }
        }
    };

    const categoryMenuHtml = categoriesArray.map(cat => {
        const isActive = cat === window.netflixActiveCategory;
        return `<button onclick="changeNetflixCategory(this.dataset.category)" data-category="${escapeHtml(cat)}"
            class="w-full text-left px-4 py-2.5 text-sm font-bold transition-colors
            ${isActive ? 'bg-emerald-500 text-white' : 'text-zinc-300 hover:bg-white/10 hover:text-white'}">${escapeHtml(cat)}</button>`;
    }).join('');

    const genreMenuHtml = genresArray.map(g => {
        const isActive = window.netflixGenreFilter === g;
        return `<button onclick="filterByGenre(this.dataset.genre)" data-genre="${escapeHtml(g)}"
            class="w-full text-left px-4 py-2.5 text-sm font-bold transition-colors
            ${isActive ? 'bg-emerald-500 text-white' : 'text-zinc-300 hover:bg-white/10 hover:text-white'}">${escapeHtml(g)}</button>`;
    }).join('');

    return { categoryMenuHtml, genreMenuHtml };
}

/**
 * `appendNetflixRecommendationsSection(container, uniqueShows)`
 * Inserta el carrusel horizontal de recomendaciones aleatorias en la portada de video.
 */
/**
 * Aplica los filtros combinables avanzados: Persona, Sub-temática, Década, Duración, Formato y Ordenamiento
 */
function _matchShowOrCollection(show, predicate) {
    if (show && show.isCollection && Array.isArray(show.items)) {
        return show.items.some(it => predicate(it.sample ? it.sample : it, show));
    }
    return predicate(show.sample ? show.sample : show, show);
}

window.applyVideoAdvancedFilters = function (shows) {
    let result = [...shows];

    // 1. Filtro por Persona (Director / Actor / Estudio)
    if (window.netflixActivePersonFilter && window.netflixActivePersonFilter.name) {
        const pTerm = normalizeText(window.netflixActivePersonFilter.name);
        result = result.filter(show => _matchShowOrCollection(show, (src) => {
            const dir = normalizeText(src.tmdb_director || '');
            const cast = normalizeText(src.tmdb_cast || '');
            const studio = normalizeText(src.tmdb_studio || '');
            return dir.includes(pTerm) || cast.includes(pTerm) || studio.includes(pTerm);
        }));
    }

    // 2. Filtro por Sub-temática contextual
    if (window.netflixActiveSubtheme && window.netflixActiveSubtheme !== 'Todos' && window.netflixGenreFilter) {
        const subList = getSubthemesForGenre(window.netflixGenreFilter) || [];
        const currentSub = subList.find(s => s.id === window.netflixActiveSubtheme);
        if (currentSub && currentSub.terms) {
            result = result.filter(show => _matchShowOrCollection(show, (src, parent) => {
                const kw = normalizeText(src.tmdb_keywords || '');
                const text = normalizeText((src.tmdb_title || src.title || parent.name || '') + ' ' + (src.tmdb_overview || '') + ' ' + (src.genre || ''));
                return currentSub.terms.some(t => {
                    const nt = normalizeText(t);
                    return kw.includes(nt) || text.includes(nt);
                });
            }));
        }
    }

    // 3. Filtro por Década
    if (window.netflixActiveDecade && window.netflixActiveDecade !== 'Todas') {
        const dec = window.netflixActiveDecade;
        result = result.filter(show => _matchShowOrCollection(show, (src) => {
            const y = parseInt(src.tmdb_year || 0, 10);
            if (!y) return false;
            if (dec === '2020s') return y >= 2020;
            if (dec === '2010s') return y >= 2010 && y <= 2019;
            if (dec === '2000s') return y >= 2000 && y <= 2009;
            if (dec === '1990s') return y >= 1990 && y <= 1999;
            if (dec === 'Clásicos') return y < 1990;
            return true;
        }));
    }

    // 4. Filtro por Duración
    if (window.netflixActiveDuration && window.netflixActiveDuration !== 'Todas') {
        const dur = window.netflixActiveDuration;
        result = result.filter(show => _matchShowOrCollection(show, (src) => {
            const sec = Number(src.duration_sec || 0);
            if (!sec) return true;
            if (dur === 'cortas') return sec < 5700;
            if (dur === 'estandar') return sec >= 5700 && sec <= 7800;
            if (dur === 'epicas') return sec > 7800;
            return true;
        }));
    }

    // 5. Filtro Rápido / Calidad / Estado
    if (window.netflixActiveTech && window.netflixActiveTech !== 'Todos') {
        const tech = window.netflixActiveTech;
        result = result.filter(show => _matchShowOrCollection(show, (src) => {
            if (tech === 'favs') {
                return Number(src.rating || 0) === 1;
            }
            if (tech === '4k') {
                const res = (src.video_resolution || '').toLowerCase();
                return res.includes('4k') || res.includes('2160');
            }
            if (tech === 'es') {
                const tracks = (src.audio_tracks || '').toLowerCase();
                const lang = (src.language || '').toLowerCase();
                return tracks.includes('es') || tracks.includes('latino') || tracks.includes('spa') || lang === 'es';
            }
            if (tech === 'sin_ver') {
                const prog = Number(src.progress_seconds || 0);
                const fin = Boolean(src.is_finished);
                return prog === 0 && !fin;
            }
            if (tech === 'top_rated') {
                const vote = Number(src.tmdb_vote_average || 0);
                const fav = Number(src.rating || 0) === 1;
                return vote >= 7.5 || fav;
            }
            return true;
        }));
    }

    // 6. Ordenamiento
    const sortBy = window.netflixSortBy || 'recent';
    result.sort((a, b) => {
        const srcA = a.sample ? a.sample : a;
        const srcB = b.sample ? b.sample : b;
        if (sortBy === 'rating_desc') {
            const vA = Number(srcA.tmdb_vote_average || 0);
            const vB = Number(srcB.tmdb_vote_average || 0);
            if (vB !== vA) return vB - vA;
            return (b.date || 0) - (a.date || 0);
        }
        if (sortBy === 'year_desc') {
            const yA = parseInt(srcA.tmdb_year || 0, 10);
            const yB = parseInt(srcB.tmdb_year || 0, 10);
            return yB - yA;
        }
        if (sortBy === 'year_asc') {
            const yA = parseInt(srcA.tmdb_year || 0, 10) || 9999;
            const yB = parseInt(srcB.tmdb_year || 0, 10) || 9999;
            return yA - yB;
        }
        if (sortBy === 'title_asc') {
            const tA = (a.name || a.title || '').toLowerCase();
            const tB = (b.name || b.title || '').toLowerCase();
            return tA.localeCompare(tB);
        }
        if (sortBy === 'duration_asc') {
            const dA = Number(srcA.duration_sec || 0) || 999999;
            const dB = Number(srcB.duration_sec || 0) || 999999;
            return dA - dB;
        }
        return (b.date || 0) - (a.date || 0);
    });

    return result;
};

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
    const heroHorizontal = heroSource.tmdb_backdrop
        ? (heroSource.tmdb_backdrop.startsWith('http') ? heroSource.tmdb_backdrop : `https://image.tmdb.org/t/p/w1280${heroSource.tmdb_backdrop}`)
        : '';
    const heroCover = heroHorizontal || (heroSource.tmdb_poster
        ? `/caratula/${encodeURIComponent(heroSource.tmdb_poster)}`
        : `/caratula/${(heroSource._normalizedPath || heroSource.path || '').split('/').map(p => encodeURIComponent(p)).join('/')}`);
    const isHeroMovie = heroItem.folder_type === 'movie';
    const heroClickAction = isHeroMovie
        ? `playNow(this.dataset.path)`
        : (heroItem.type === 'folder' ? `openFolderPath(this.dataset.path)` : `playNow(this.dataset.path)`);

    const heroPlaceholderId = 'hero-placeholder-' + Date.now();
    container.innerHTML += `<div id="${heroPlaceholderId}" data-path="${escapeHtml(heroItem.path)}" class="relative w-full h-[16vh] min-h-[140px] md:h-[22vh] md:min-h-[180px] rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl group border border-white/5 flex-shrink-0 mb-4 cursor-pointer transition-all duration-500" onclick="${heroClickAction}">
        <img src="${heroCover}" class="absolute inset-0 w-full h-full object-cover object-[center_18%] opacity-60 group-hover:opacity-75 group-hover:scale-105 transition duration-1000" onerror="this.style.display='none'">
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
/**
 * `appendPersonHeroBanner(container, showsToDisplay, uniqueShows)`
 * Renderiza un Hero dedicado al Director, Actor o Estudio activo, con estadísticas de su filmografía y botón de Maratón.
 */
window.appendPersonHeroBanner = function (container, showsToDisplay, uniqueShows) {
    const person = window.netflixActivePersonFilter;
    if (!person || !person.name) return;

    const roleUpper = (person.role || 'Persona').toUpperCase();
    const roleBadge = roleUpper.includes('DIRECTOR')
        ? '🎬 DIRECTOR DESTACADO'
        : (roleUpper.includes('ESTUDIO') ? '🏢 ESTUDIO PRODUCTOR' : '🎭 ESTRELLA DE REPARTO');

    // Escoger la película/serie mejor valorada o más reciente para el fondo
    const sorted = [...showsToDisplay].sort((a, b) => {
        const sA = a.sample || a;
        const sB = b.sample || b;
        const vDiff = Number(sB.tmdb_vote_average || 0) - Number(sA.tmdb_vote_average || 0);
        if (vDiff !== 0) return vDiff;
        return Number(b.date || 0) - Number(a.date || 0);
    });

    const bestShow = sorted[0] || uniqueShows[0];
    const bestSrc = bestShow ? (bestShow.sample || bestShow) : {};
    const backdropUrl = bestSrc.tmdb_backdrop
        ? (bestSrc.tmdb_backdrop.startsWith('http') ? bestSrc.tmdb_backdrop : `https://image.tmdb.org/t/p/w1280${bestSrc.tmdb_backdrop}`)
        : (bestSrc.tmdb_poster
            ? (bestSrc.tmdb_poster.startsWith('http') || bestSrc.tmdb_poster.startsWith('/caratula/') ? bestSrc.tmdb_poster : `/caratula/${encodeURIComponent(bestSrc.tmdb_poster)}`)
            : '');

    // Estadísticas de su filmografía en la biblioteca
    const genresFreq = {};
    const years = [];
    let voteSum = 0;
    let voteCount = 0;

    showsToDisplay.forEach(item => {
        const src = item.sample || item;
        (src.tmdb_genres || src.genre || '').split(',').map(s => s.trim()).filter(Boolean).forEach(g => {
            genresFreq[g] = (genresFreq[g] || 0) + 1;
        });
        const y = parseInt(src.tmdb_year || 0, 10);
        if (y > 1900) years.push(y);
        const v = Number(src.tmdb_vote_average || 0);
        if (v > 0) {
            voteSum += v;
            voteCount++;
        }
    });

    const topGenres = Object.keys(genresFreq).sort((a, b) => genresFreq[b] - genresFreq[a]).slice(0, 4);
    const avgRating = voteCount > 0 ? (voteSum / voteCount).toFixed(1) : null;
    years.sort((a, b) => a - b);
    const yearSpan = years.length > 1
        ? (years[0] === years[years.length - 1] ? `${years[0]}` : `${years[0]} – ${years[years.length - 1]}`)
        : (years[0] ? `${years[0]}` : '');

    const personPhoto = (window._personPhotoCache && window._personPhotoCache[person.name]) || '';
    const avatarHtml = personPhoto
        ? `<img src="${personPhoto}" class="w-16 h-16 md:w-24 md:h-24 rounded-full object-cover border-2 border-emerald-400/60 shadow-2xl shrink-0" onerror="this.style.display='none'">`
        : `<div class="w-14 h-14 md:w-20 md:h-20 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 text-2xl md:text-3xl shrink-0 shadow-xl">
               <i class="fa-solid ${roleUpper.includes('DIRECTOR') ? 'fa-clapperboard' : 'fa-user-astronaut'}"></i>
           </div>`;

    // Mini-posters flotantes a la derecha en pantallas grandes
    const showcasePosters = sorted.slice(0, 3).map((it, idx) => {
        const s = it.sample || it;
        const pUrl = s.tmdb_poster
            ? (s.tmdb_poster.startsWith('http') || s.tmdb_poster.startsWith('/caratula/') ? s.tmdb_poster : `/caratula/${encodeURIComponent(s.tmdb_poster)}`)
            : `/caratula/${(s.path || '').split('/').map(p => encodeURIComponent(p)).join('/')}`;
        const rot = idx === 0 ? '-rotate-6 translate-y-2' : (idx === 1 ? 'rotate-0 -translate-y-1 z-10 scale-105' : 'rotate-6 translate-y-2');
        return `<div class="w-20 md:w-28 aspect-[2/3] rounded-xl overflow-hidden border border-white/20 shadow-2xl transform ${rot} transition duration-500 hover:scale-110">
            <img src="${pUrl}" class="w-full h-full object-cover" onerror="this.style.display='none'">
        </div>`;
    }).join('');

    window.playPersonMarathon = function () {
        const queue = [];
        showsToDisplay.forEach(item => {
            if (item.type === 'folder' && item.folder_type !== 'movie') {
                const folderPath = (item.path || '').replace(/\\/g, '/').replace(/\/$/, '');
                const eps = (libData.files || []).filter(f => f.type === 'video' && (f.path || '').replace(/\\/g, '/').startsWith(folderPath + '/'));
                if (eps.length > 0) queue.push(eps[0]);
            } else {
                const f = item.sample || item;
                if (f && f.path) queue.push(f);
            }
        });
        if (queue.length === 0) {
            if (typeof showToast === 'function') showToast('No hay títulos reproducibles', 'warning');
            return;
        }
        playerQueue = queue;
        currentTrackIndex = 0;
        if (typeof showToast === 'function') showToast(`🎬 Maratón de ${person.name}: ${queue.length} títulos`, 'success');
        playVideoMode(playerQueue[0]);
    };

    container.innerHTML += `
        <div class="relative w-full min-h-[220px] md:min-h-[280px] rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl border border-emerald-500/20 bg-[#101014] mb-2">
            ${backdropUrl ? `<img src="${backdropUrl}" class="absolute inset-0 w-full h-full object-cover opacity-35 blur-[2px] scale-105" onerror="this.style.display='none'">` : ''}
            <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/75 to-transparent"></div>
            <div class="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent"></div>

            <div class="relative z-10 p-6 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div class="flex flex-col gap-3 max-w-2xl">
                    <div class="flex items-center gap-2">
                        <span class="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] md:text-xs font-black tracking-widest uppercase">${roleBadge}</span>
                        ${yearSpan ? `<span class="text-xs text-zinc-400 font-semibold">${yearSpan}</span>` : ''}
                        ${avgRating ? `<span class="text-xs text-amber-400 font-bold flex items-center gap-1"><i class="fa-solid fa-star text-[10px]"></i> ${avgRating} promedio</span>` : ''}
                    </div>

                    <div class="flex items-center gap-4">
                        ${avatarHtml}
                        <div>
                            <h2 class="text-2xl md:text-4xl lg:text-5xl font-black text-white leading-tight drop-shadow-xl">${escapeHtml(person.name)}</h2>
                            <p class="text-xs md:text-sm text-zinc-300 mt-1">
                                <span class="text-emerald-400 font-extrabold">${showsToDisplay.length}</span> ${showsToDisplay.length === 1 ? 'título disponible' : 'títulos disponibles'} en tu biblioteca
                            </p>
                        </div>
                    </div>

                    ${topGenres.length > 0 ? `
                    <div class="flex flex-wrap gap-1.5 mt-1">
                        ${topGenres.map(g => `<span class="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/10 text-white/85 text-[11px] font-semibold">${escapeHtml(g)}</span>`).join('')}
                    </div>` : ''}

                    <div class="flex flex-wrap items-center gap-3 mt-2">
                        <button onclick="playPersonMarathon()" class="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs md:text-sm py-2.5 px-6 rounded-full shadow-lg hover:scale-105 transition flex items-center gap-2">
                            <i class="fa-solid fa-play"></i> Maratón (${showsToDisplay.length})
                        </button>
                        <button onclick="clearPersonFilter()" class="bg-white/10 hover:bg-white/20 text-white font-bold text-xs md:text-sm py-2.5 px-5 rounded-full border border-white/15 transition flex items-center gap-2">
                            <i class="fa-solid fa-arrow-left"></i> Volver al catálogo
                        </button>
                    </div>
                </div>

                ${showcasePosters ? `<div class="hidden lg:flex items-center gap-2 pr-4">${showcasePosters}</div>` : ''}
            </div>
        </div>
    `;
};

/**
 * `appendPersonRecommendationsSection(container, showsToDisplay)`
 * Muestra un carrusel de películas/series recomendadas similares al estilo del Director/Actor filtrado.
 */
window.appendPersonRecommendationsSection = function (container, showsToDisplay) {
    const person = window.netflixActivePersonFilter;
    if (!person || !person.name || typeof window.getSimilarLibraryItems !== 'function') return;
    if (!Array.isArray(showsToDisplay) || showsToDisplay.length === 0) return;

    const excludedPaths = new Set();
    const excludedTmdb = new Set();
    showsToDisplay.forEach(item => {
        const src = item.sample || item;
        if (item.path) excludedPaths.add((item.path || '').replace(/\\/g, '/').replace(/\/$/, ''));
        if (src.path) excludedPaths.add((src.path || '').replace(/\\/g, '/').replace(/\/$/, ''));
        if (src.tmdb_id) excludedTmdb.add(Number(src.tmdb_id));
    });

    const recMap = new Map();
    showsToDisplay.slice(0, 6).forEach(item => {
        const src = item.sample || item;
        const sims = window.getSimilarLibraryItems(src, 10) || [];
        sims.forEach(sim => {
            const simPath = (sim._seriesPath || sim.path || '').replace(/\\/g, '/').replace(/\/$/, '');
            const simTmdb = Number(sim.tmdb_id || 0);
            if (excludedPaths.has(simPath) || (simTmdb > 0 && excludedTmdb.has(simTmdb))) return;
            const key = simTmdb > 0 ? `tmdb_${simTmdb}` : simPath;
            if (!recMap.has(key) || (sim._simScore > recMap.get(key)._simScore)) {
                recMap.set(key, sim);
            }
        });
    });

    const recommendations = Array.from(recMap.values())
        .sort((a, b) => (b._simScore || 0) - (a._simScore || 0))
        .slice(0, 16);

    if (recommendations.length === 0) return;

    const rowId = 'person-similars-row';
    const cardsHtml = recommendations.map(sim => {
        const cardItem = sim._isSeries
            ? {
                type: 'folder',
                name: sim._displayTitle || sim.tmdb_title || sim.title,
                title: sim._displayTitle || sim.tmdb_title || sim.title,
                path: sim._seriesPath || sim.path,
                sample: sim,
                date: sim.date,
                rating: sim.rating,
                folder_type: 'series',
                tmdb_id: sim.tmdb_id,
                tmdb_poster: sim.tmdb_poster
            }
            : {
                ...sim,
                name: sim._displayTitle || sim.tmdb_title || sim.clean_title || sim.title
            };
        return `<div class="flex-none w-[145px] md:w-[175px] lg:w-[190px]">${createCard(cardItem)}</div>`;
    }).join('');

    container.innerHTML += `
        <div class="mt-6 pt-6 border-t border-white/10 relative group/prow">
            <div class="px-1 md:px-0 mb-4 flex items-center justify-between">
                <div>
                    <h3 class="text-base md:text-lg font-extrabold text-white flex items-center gap-2">
                        <i class="fa-solid fa-wand-magic-sparkles text-emerald-400"></i>
                        Recomendadas similares al estilo de ${escapeHtml(person.name)}
                    </h3>
                    <p class="text-xs text-zinc-400 mt-0.5">Títulos de tu biblioteca con temática, género o equipo creativo afín</p>
                </div>
            </div>
            <div class="relative">
                <button onclick="scrollRowLeft('${rowId}')"
                    class="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-20 items-center justify-center bg-black/70 hover:bg-black/90 text-white rounded-r-xl opacity-0 group-hover/prow:opacity-100 transition-opacity">
                    <i class="fa-solid fa-chevron-left text-xl"></i>
                </button>
                <div id="${rowId}" class="flex gap-3.5 overflow-x-auto no-scrollbar pb-3 px-1 md:px-0 scroll-smooth">
                    ${cardsHtml}
                </div>
                <button onclick="scrollRowRight('${rowId}')"
                    class="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-20 items-center justify-center bg-black/70 hover:bg-black/90 text-white rounded-l-xl opacity-0 group-hover/prow:opacity-100 transition-opacity">
                    <i class="fa-solid fa-chevron-right text-xl"></i>
                </button>
            </div>
        </div>
    `;
};

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
    const rouletteBtnHtml = `
        <button onclick="openVideoRouletteModal()" id="btn-video-roulette"
                class="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs md:text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg hover:scale-105 transition"
                title="Ruleta interactiva: ¿Qué vemos hoy?">
            <i class="fa-solid fa-dice text-amber-300"></i>
            <span>Ruleta</span>
        </button>
    `;
    const sizeSelectorHtml = `
        <div class="flex items-center gap-0.5 bg-[#18181b] border border-white/10 rounded-full p-1 shrink-0" title="Tamaño de miniaturas">
            <i class="fa-solid fa-grip text-[11px] text-emerald-400 pl-2 pr-1"></i>
            <button onclick="changeVideoZoom(0)" class="px-2 py-0.5 rounded-full text-[11px] font-bold transition ${currentVideoZoomIndex === 0 ? 'bg-emerald-500 text-black shadow' : 'text-zinc-400 hover:text-white'}" title="Miniaturas pequeñas">S</button>
            <button onclick="changeVideoZoom(1)" class="px-2 py-0.5 rounded-full text-[11px] font-bold transition ${currentVideoZoomIndex === 1 ? 'bg-emerald-500 text-black shadow' : 'text-zinc-400 hover:text-white'}" title="Miniaturas medianas">M</button>
            <button onclick="changeVideoZoom(2)" class="px-2 py-0.5 rounded-full text-[11px] font-bold transition ${currentVideoZoomIndex === 2 ? 'bg-emerald-500 text-black shadow' : 'text-zinc-400 hover:text-white'}" title="Miniaturas grandes">L</button>
        </div>
    `;

    const decades = [
        { id: 'Todas', label: 'Todas' },
        { id: '2020s', label: '2020s' },
        { id: '2010s', label: '2010s' },
        { id: '2000s', label: '2000s' },
        { id: '1990s', label: '1990s' },
        { id: 'Clásicos', label: '< 1990' }
    ];
    const durations = [
        { id: 'Todas', label: 'Todas' },
        { id: 'cortas', label: '⚡ < 95m' },
        { id: 'estandar', label: '🍿 95-130m' },
        { id: 'epicas', label: '🎭 > 130m' }
    ];
    const techs = [
        { id: 'Todos', label: 'Todos' },
        { id: 'favs', label: '❤️ Mis Favoritos' },
        { id: '4k', label: '✨ 4K UHD' },
        { id: 'es', label: '🇲🇽 Español' },
        { id: 'sin_ver', label: '🆕 Sin ver' },
        { id: 'top_rated', label: '⭐ Top 7.5+' }
    ];

    const hasDecade = Boolean(window.netflixActiveDecade && window.netflixActiveDecade !== 'Todas');
    const hasDur = Boolean(window.netflixActiveDuration && window.netflixActiveDuration !== 'Todas');
    const hasTech = Boolean(window.netflixActiveTech && window.netflixActiveTech !== 'Todos');
    const activeAdvCount = (hasDecade ? 1 : 0) + (hasDur ? 1 : 0) + (hasTech ? 1 : 0);

    // Popover unificado y limpio de "Filtros" (Década, Duración, Calidad y Sagas)
    const advFiltersDropdownHtml = `
        <div class="relative shrink-0" data-advfilters-root>
            <button onclick="toggleCustomFilterDropdown(event, 'advfilters')"
                class="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs md:text-sm font-bold transition
                ${activeAdvCount > 0
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/25'
                    : 'bg-white/10 hover:bg-white/15 text-zinc-200 border border-white/10'}">
                <i class="fa-solid fa-sliders text-xs"></i>
                <span>Filtros</span>
                ${activeAdvCount > 0 ? `<span class="px-1.5 py-0.2 rounded-full bg-black/25 text-[10px] font-black">${activeAdvCount}</span>` : ''}
                <i class="fa-solid fa-chevron-down text-[10px] transition-transform" data-advfilters-chevron></i>
            </button>
            <div data-advfilters-menu onclick="event.stopPropagation()"
                class="hidden absolute top-full left-0 mt-2 w-72 md:w-80 bg-[#141417]/95 backdrop-blur-xl rounded-2xl border border-white/15 shadow-2xl p-4 z-50 space-y-3.5">
                <div class="flex items-center justify-between pb-2 border-b border-white/10">
                    <span class="text-xs font-extrabold uppercase tracking-wider text-zinc-300">Opciones de catálogo</span>
                    ${activeAdvCount > 0 ? `<button onclick="resetNetflixAdvancedFilters()" class="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition">Limpiar (${activeAdvCount})</button>` : ''}
                </div>

                <div class="flex items-center justify-between bg-white/[0.04] rounded-xl px-3 py-2 border border-white/5">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-layer-group text-amber-400 text-xs"></i>
                        <div>
                            <div class="text-xs font-bold text-white">Agrupar Sagas</div>
                            <div class="text-[10px] text-zinc-400">Unir colecciones en 1 tarjeta</div>
                        </div>
                    </div>
                    <button onclick="toggleGroupCollections()"
                        class="px-3 py-1 rounded-full text-[11px] font-extrabold transition ${window.netflixGroupCollections ? 'bg-amber-500 text-black shadow' : 'bg-white/10 text-zinc-400 hover:text-white'}">
                        ${window.netflixGroupCollections ? 'ACTIVO' : 'OFF'}
                    </button>
                </div>

                <div>
                    <div class="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Calidad y Estado</div>
                    <div class="flex flex-wrap gap-1.5">
                        ${techs.map(t => `<button onclick="changeNetflixTech('${t.id}')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${(window.netflixActiveTech || 'Todos') === t.id ? 'bg-amber-500 text-black' : 'bg-white/5 text-zinc-300 hover:bg-white/10'}">${t.label}</button>`).join('')}
                    </div>
                </div>

                <div>
                    <div class="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Época / Década</div>
                    <div class="flex flex-wrap gap-1.5">
                        ${decades.map(d => `<button onclick="changeNetflixDecade('${d.id}')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${(window.netflixActiveDecade || 'Todas') === d.id ? 'bg-purple-600 text-white' : 'bg-white/5 text-zinc-300 hover:bg-white/10'}">${d.label}</button>`).join('')}
                    </div>
                </div>

                <div>
                    <div class="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Duración</div>
                    <div class="flex flex-wrap gap-1.5">
                        ${durations.map(d => `<button onclick="changeNetflixDuration('${d.id}')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${(window.netflixActiveDuration || 'Todas') === d.id ? 'bg-blue-600 text-white' : 'bg-white/5 text-zinc-300 hover:bg-white/10'}">${d.label}</button>`).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Dropdown de ORDENAMIENTO
    const sorts = [
        { id: 'recent', label: '🕒 Recién agregadas', short: 'Recién' },
        { id: 'rating_desc', label: '⭐ Mejor calificación', short: 'Mejor nota' },
        { id: 'year_desc', label: '📅 Año (más recientes)', short: 'Más nuevas' },
        { id: 'year_asc', label: '📅 Año (clásicas primero)', short: 'Clásicas' },
        { id: 'title_asc', label: '🔤 Título (A - Z)', short: 'A - Z' },
        { id: 'duration_asc', label: '⏱️ Duración (más cortas)', short: 'Más cortas' }
    ];
    const currentSortObj = sorts.find(s => s.id === (window.netflixSortBy || 'recent')) || sorts[0];
    const sortDropdownHtml = `
        <div class="relative shrink-0" data-sort-root>
            <button onclick="toggleCustomFilterDropdown(event, 'sort')"
                class="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs md:text-sm font-bold
                ${window.netflixSortBy && window.netflixSortBy !== 'recent' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25' : 'bg-white/10 hover:bg-white/15 text-zinc-200 border border-white/10'}
                transition">
                <i class="fa-solid fa-arrow-down-short-wide text-xs"></i>
                <span>${currentSortObj.short}</span>
                <i class="fa-solid fa-chevron-down text-[10px] ml-0.5 transition-transform" data-sort-chevron></i>
            </button>
            <div data-sort-menu class="hidden absolute top-full left-0 mt-2 w-52 bg-[#141417]/95 backdrop-blur-xl rounded-xl border border-white/15 shadow-2xl overflow-hidden z-50">
                ${sorts.map(s => `<button onclick="changeNetflixSort('${s.id}')" class="w-full text-left px-3.5 py-2.5 text-xs font-bold transition ${(window.netflixSortBy || 'recent') === s.id ? 'bg-emerald-600 text-white' : 'text-zinc-300 hover:bg-white/10'}">${s.label}</button>`).join('')}
            </div>
        </div>
    `;

    // Chips rápidos de filtros activos (si el usuario activó alguno en el popover)
    const activeFilterChips = [];
    if (hasTech) {
        const lbl = techs.find(t => t.id === window.netflixActiveTech)?.label || window.netflixActiveTech;
        activeFilterChips.push(`<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-bold">${lbl}<button onclick="changeNetflixTech('Todos')" class="hover:text-white">✕</button></span>`);
    }
    if (hasDecade) {
        activeFilterChips.push(`<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[11px] font-bold">📅 ${escapeHtml(window.netflixActiveDecade)}<button onclick="changeNetflixDecade('Todas')" class="hover:text-white">✕</button></span>`);
    }
    if (hasDur) {
        const lbl = durations.find(d => d.id === window.netflixActiveDuration)?.label || window.netflixActiveDuration;
        activeFilterChips.push(`<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 text-[11px] font-bold">${lbl}<button onclick="changeNetflixDuration('Todas')" class="hover:text-white">✕</button></span>`);
    }
    const activeChipsRowHtml = activeFilterChips.length > 0
        ? `<div class="flex flex-wrap items-center gap-1.5">${activeFilterChips.join('')}</div>`
        : '';

    // Píldoras de SUB-TEMÁTICA contextual (si el género activo tiene sub-temas)
    let subthemePillsHtml = '';
    const activeSubList = getSubthemesForGenre(window.netflixGenreFilter);
    if (window.netflixGenreFilter && activeSubList) {
        const pills = [
            { id: 'Todos', label: 'Todos' },
            ...activeSubList
        ].map(sub => {
            const isActive = window.netflixActiveSubtheme === sub.id;
            return `
            <button onclick="changeNetflixSubtheme('${sub.id}')"
                class="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition
                ${isActive
                    ? 'bg-emerald-500 text-black font-extrabold shadow-md'
                    : 'bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5'}">
                ${escapeHtml(sub.label)}
            </button>`;
        }).join('');

        subthemePillsHtml = `
            <div class="w-full flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                ${pills}
            </div>
        `;
    }

    return {
        desktop: `
            <div class="w-full flex flex-col gap-2 relative z-50">
                <div class="w-full flex flex-wrap items-center gap-2">
                    ${categoryDropdownHtml}
                    ${genreDropdownHtml}
                    ${advFiltersDropdownHtml}
                    ${sortDropdownHtml}
                    ${!window.netflixActivePersonFilter ? recommendationsBtnHtml : ''}
                    ${marathonBtnHtml}
                    ${rouletteBtnHtml}
                    ${activeChipsRowHtml}
                    <div class="flex items-center gap-2 ml-auto">
                        ${sizeSelectorHtml}
                        <div id="video-selection-anchor" class="flex items-center gap-2"></div>
                    </div>
                </div>
                ${subthemePillsHtml}
            </div>
        `,
        mobile: `
            <div class="w-full flex flex-col gap-2 relative z-50">
                <div class="w-full flex flex-wrap items-center gap-1.5">
                    ${categoryDropdownHtml}
                    ${genreDropdownHtml}
                    ${advFiltersDropdownHtml}
                    ${sortDropdownHtml}
                    ${!window.netflixActivePersonFilter ? recommendationsBtnHtml : ''}
                    ${marathonBtnHtml}
                    ${rouletteBtnHtml}
                    ${sizeSelectorHtml}
                </div>
                ${activeChipsRowHtml}
                ${subthemePillsHtml}
            </div>
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

        // Búsqueda omnicanal por Director, Reparto, Estudio, Saga o Keywords
        const searchNorm = normalizeText(searchValue || '');
        if (searchNorm) {
            const extraText = normalizeText(
                (f.tmdb_director || '') + ' ' +
                (f.tmdb_cast || '') + ' ' +
                (f.tmdb_studio || '') + ' ' +
                (f.tmdb_collection_name || '') + ' ' +
                (f.tmdb_keywords || '') + ' ' +
                (f.video_resolution || '')
            );
            if (extraText.includes(searchNorm)) {
                f._searchScore = Math.max(f._searchScore || 0, 80);
            }
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
    const categoriesArray = [allCategoryLabel, '❤️ Favoritos', '📚 Colecciones', ...Array.from(availableCategories).sort()];
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
        } else if (window.netflixActiveCategory === '❤️ Favoritos') {
            if (f.is_adult || Number(f.rating || 0) !== 1) return;
        } else if (window.netflixActiveCategory === '📚 Colecciones') {
            if (f.is_adult || (f.folder_type !== 'movie' && parts.length > 3)) return;
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
                    tmdb_rating: f.tmdb_rating || libData.files.find(v => v.path.startsWith(showPathToOpen) && v.tmdb_rating)?.tmdb_rating,
                    tmdb_vote_average: f.tmdb_vote_average || libData.files.find(v => v.path.startsWith(showPathToOpen) && v.tmdb_vote_average)?.tmdb_vote_average
                });
            } else {
                uniqueShowsMap.set(showKey, f);
            }
        }
    });

    let uniqueShows = Array.from(uniqueShowsMap.values());
    if ((window.netflixGroupCollections || window.netflixActiveCategory === '📚 Colecciones') && !window.netflixActivePersonFilter) {
        uniqueShows = groupMoviesIntoCollections(uniqueShows);
        if (window.netflixActiveCategory === '📚 Colecciones') {
            uniqueShows = uniqueShows.filter(s => s.isCollection);
        }
    }
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
    const navParts = (currentPath || '').replace(/\\/g, '/').split('/').filter(Boolean);
    const isShowDetail = navParts.length >= 3;
    if (!isShowDetail) return;

    const baseShowPath = navParts.slice(0, 3).join('/') + '/';
    const showFiles = filtered.filter(f => (f.path || '').replace(/\\/g, '/').startsWith(baseShowPath));
    if (showFiles.length === 0) return;

    const showTitle = navParts[2];
    const categoryName = navParts[1] || window.netflixActiveCategory || 'Video';
    const heroSource = showFiles.find(f => f.rating === 1) || showFiles[0];
    const heroHorizontal = heroSource.tmdb_backdrop
        ? (heroSource.tmdb_backdrop.startsWith('http') ? heroSource.tmdb_backdrop : `https://image.tmdb.org/t/p/w1280${heroSource.tmdb_backdrop}`)
        : '';
    const heroCover = heroHorizontal || (heroSource.tmdb_poster
        ? `/caratula/${encodeURIComponent(heroSource.tmdb_poster)}`
        : `/caratula/${heroSource.path.split('/').map(p => encodeURIComponent(p)).join('/')}`);
    const isMovieDetail = heroSource.folder_type === 'movie';
    const detailHeroItem = {
        type: isMovieDetail ? 'video' : 'folder',
        name: heroSource.tmdb_title || showTitle,
        title: heroSource.tmdb_title || showTitle,
        path: isMovieDetail ? heroSource.path : baseShowPath,
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
            <img src="${heroCover}" class="absolute inset-0 w-full h-full object-cover object-[center_18%] opacity-65" onerror="this.style.display='none'">
            <div class="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/95 via-[#0a0a0a]/65 to-transparent"></div>
            <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/95 to-transparent"></div>
            <div class="relative z-10 h-full p-4 md:p-6 flex flex-col justify-end">
                <div class="flex items-center gap-2 mb-2">
                    <div class="w-1 h-3 bg-emerald-500 rounded"></div>
                    <span class="text-[10px] md:text-xs font-black tracking-[0.2em] text-white/90 uppercase">${escapeHtml(categoryName)} · ${isMovieDetail ? 'PELÍCULA' : 'TEMPORADAS'}</span>
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
            if (window.KRAKEN_TV_MODE) {
                const firstBtn = richEl.querySelector('button');
                if (firstBtn) {
                    firstBtn.setAttribute('tabindex', '0');
                    setTimeout(() => { try { firstBtn.focus(); } catch (_) {} }, 50);
                }
            }
        }).catch(e => console.warn('[DETAIL HERO] render failed:', e));
    }

    const primaryDetailBtn = (isMovieDetail && allSeasons.length === 0)
        ? `<button onclick="playNow(this.dataset.path)" data-path="${escapeHtml(heroSource.path)}" class="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs md:text-sm py-2.5 px-6 rounded-full transition flex items-center gap-2 shadow-lg">
            <i class="fa-solid fa-play"></i> Reproducir Película
        </button>`
        : `<button onclick="openFolderPath(this.dataset.basePath)" data-base-path="${escapeHtml(baseShowPath)}" class="bg-white hover:bg-emerald-50 text-black font-extrabold text-xs md:text-sm py-2.5 px-5 rounded-full transition flex items-center gap-2">
            <i class="fa-solid fa-folder-open"></i> Explorar Temporadas
        </button>`;

    container.innerHTML += `
        <div class="w-full flex items-center justify-between gap-2 px-2 md:px-0 mt-1 mb-4 overflow-x-auto no-scrollbar">
            <div class="flex items-center gap-3">
                ${primaryDetailBtn}
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
    const basePath = (currentPath || '').replace(/\\/g, '/');
    const normalizedBasePath = basePath.endsWith('/') ? basePath : (basePath ? basePath + '/' : '');
    const relevantFiles = filtered.filter(f => {
        const p = (f.path || '').replace(/\\/g, '/');
        return p.startsWith(normalizedBasePath);
    });
    const groups = {};
    const directFiles = [];

    if (isSearching) {
        directFiles.push(...relevantFiles);
    } else {
        relevantFiles.forEach(f => {
            const p = (f.path || '').replace(/\\/g, '/');
            const rel = p.substring(normalizedBasePath.length);
            const parts = rel.split('/').filter(Boolean);
            if (parts.length === 1) {
                directFiles.push(f);
            } else if (parts.length > 1) {
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

// ============================================================================
// 🎲 RULETA INTERACTIVA DE PELÍCULAS Y SERIES ("¿Qué vemos hoy?")
// ============================================================================

window.openVideoRouletteModal = function () {
    let modal = document.getElementById('krk-video-roulette-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'krk-video-roulette-modal';
        modal.className = 'fixed inset-0 z-[1400] p-4 md:p-8 flex items-center justify-center';
        document.body.appendChild(modal);
    }

    const allGenres = Array.from(new Set(
        (libData && Array.isArray(libData.files) ? libData.files : [])
            .filter(f => f.type === 'video' && f.genre)
            .flatMap(f => f.genre.split(',').map(s => s.trim()).filter(Boolean))
    )).sort();

    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/85 backdrop-blur-md" onclick="closeVideoRouletteModal()"></div>
        <div class="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto no-scrollbar bg-[#121317] border border-white/10 rounded-3xl shadow-2xl p-4 sm:p-6 md:p-8 flex flex-col gap-4 sm:gap-6 text-white">
            <div class="flex items-center justify-between border-b border-white/10 pb-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
                        <i class="fa-solid fa-dice text-xl text-amber-300"></i>
                    </div>
                    <div>
                        <h2 class="text-xl md:text-2xl font-black text-white">¿Qué vemos hoy?</h2>
                        <p class="text-xs text-zinc-400">Gira la ruleta y deja que Kraken elija por ti</p>
                    </div>
                </div>
                <button onclick="closeVideoRouletteModal()" class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition">
                    <i class="fa-solid fa-xmark text-sm"></i>
                </button>
            </div>

            <!-- FILTROS DE RULETA -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                <div>
                    <label class="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block mb-1">Tipo</label>
                    <select id="roulette-filter-type" class="w-full bg-[#1c1d22] text-white text-xs font-bold rounded-xl px-3 py-2 border border-white/10 outline-none">
                        <option value="all">Todo (Películas y Series)</option>
                        <option value="movie">Solo Películas</option>
                        <option value="series">Solo Series</option>
                    </select>
                </div>
                <div>
                    <label class="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block mb-1">Género</label>
                    <select id="roulette-filter-genre" class="w-full bg-[#1c1d22] text-white text-xs font-bold rounded-xl px-3 py-2 border border-white/10 outline-none">
                        <option value="all">Cualquier Género</option>
                        ${allGenres.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block mb-1">Estado</label>
                    <select id="roulette-filter-state" class="w-full bg-[#1c1d22] text-white text-xs font-bold rounded-xl px-3 py-2 border border-white/10 outline-none">
                        <option value="all">Todas</option>
                        <option value="unwatched">🆕 Solo No Vistas</option>
                        <option value="top">⭐ Top Calificadas (7.5+)</option>
                    </select>
                </div>
            </div>

            <!-- DISPLAY RULETA -->
            <div id="roulette-display-area" class="relative w-full h-[240px] md:h-[280px] bg-black/60 rounded-2xl border border-white/10 overflow-hidden flex items-center justify-center shadow-inner">
                <div id="roulette-idle-state" class="flex flex-col items-center justify-center text-center p-6 gap-3">
                    <i class="fa-solid fa-clapperboard text-5xl text-purple-400/50 animate-bounce"></i>
                    <p class="text-sm font-semibold text-zinc-300">Ajusta los filtros arriba y presiona "Girar Ruleta"</p>
                </div>
                <div id="roulette-slot-card" class="hidden absolute inset-0 flex flex-col justify-end p-6 bg-cover bg-center transition-all duration-100">
                    <div class="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
                    <div class="relative z-10">
                        <span id="roulette-slot-tag" class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-400 text-black mb-1.5 inline-block"></span>
                        <h3 id="roulette-slot-title" class="text-xl md:text-2xl font-black text-white truncate drop-shadow"></h3>
                        <p id="roulette-slot-meta" class="text-xs text-zinc-300 mt-1"></p>
                    </div>
                </div>
            </div>

            <!-- BOTÓN ACCIÓN -->
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 pt-1">
                <div id="roulette-winner-actions" class="hidden flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                    <button id="roulette-play-btn" class="flex-1 sm:flex-initial justify-center px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm flex items-center gap-2 shadow-xl hover:scale-105 transition">
                        <i class="fa-solid fa-play"></i> Reproducir
                    </button>
                    <button id="roulette-trailer-btn" class="hidden px-5 py-3 rounded-full bg-red-600/90 hover:bg-red-500 text-white font-bold text-sm items-center justify-center gap-2 shadow-xl hover:scale-105 transition">
                        <i class="fa-brands fa-youtube text-base"></i> Tráiler
                    </button>
                </div>
                <button onclick="spinVideoRoulette()" id="roulette-spin-btn" class="w-full sm:w-auto sm:ml-auto justify-center px-8 py-3.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm md:text-base flex items-center gap-2.5 shadow-xl hover:scale-105 transition shadow-purple-600/30">
                    <i class="fa-solid fa-dice text-lg text-amber-300"></i>
                    <span>¡Girar Ruleta!</span>
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
};

window.closeVideoRouletteModal = function () {
    const modal = document.getElementById('krk-video-roulette-modal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    if (window._rouletteTimer) clearInterval(window._rouletteTimer);
};

window.spinVideoRoulette = function () {
    const typeSel = document.getElementById('roulette-filter-type')?.value || 'all';
    const genreSel = document.getElementById('roulette-filter-genre')?.value || 'all';
    const stateSel = document.getElementById('roulette-filter-state')?.value || 'all';

    const allFiles = (libData && Array.isArray(libData.files)) ? libData.files.filter(f => f.type === 'video' && !f.is_adult) : [];
    let candidates = allFiles.filter(f => {
        if (typeSel === 'movie' && f.folder_type !== 'movie') return false;
        if (typeSel === 'series' && f.folder_type === 'movie') return false;
        if (genreSel !== 'all') {
            const genres = (f.genre || '').split(',').map(s => s.trim().toLowerCase());
            if (!genres.includes(genreSel.toLowerCase())) return false;
        }
        if (stateSel === 'unwatched') {
            const prog = Number(f.progress_seconds || 0);
            if (prog > 0 || f.is_finished) return false;
        }
        if (stateSel === 'top') {
            const vote = Number(f.tmdb_vote_average || 0);
            if (vote < 7.5 && Number(f.rating || 0) !== 1) return false;
        }
        return true;
    });

    if (!candidates || candidates.length === 0) {
        showToast('No hay videos que coincidan con estos filtros en tu catálogo.', 'info');
        return;
    }

    const spinBtn = document.getElementById('roulette-spin-btn');
    if (spinBtn) {
        spinBtn.disabled = true;
        spinBtn.classList.add('opacity-50', 'pointer-events-none');
    }
    const idleState = document.getElementById('roulette-idle-state');
    const slotCard = document.getElementById('roulette-slot-card');
    const winnerActions = document.getElementById('roulette-winner-actions');
    if (idleState) idleState.classList.add('hidden');
    if (winnerActions) winnerActions.classList.add('hidden');
    if (slotCard) slotCard.classList.remove('hidden');

    const totalSteps = 28;
    let currentStep = 0;
    let delay = 50;

    function step() {
        currentStep++;
        const randomItem = candidates[Math.floor(Math.random() * candidates.length)];
        const cover = randomItem.tmdb_backdrop
            ? (randomItem.tmdb_backdrop.startsWith('http') ? randomItem.tmdb_backdrop : `https://image.tmdb.org/t/p/w1280${randomItem.tmdb_backdrop}`)
            : (randomItem.tmdb_poster ? (randomItem.tmdb_poster.startsWith('http') || randomItem.tmdb_poster.startsWith('/caratula/') ? randomItem.tmdb_poster : `/caratula/${encodeURIComponent(randomItem.tmdb_poster)}`) : getCoverUrl(randomItem));

        slotCard.style.backgroundImage = `url("${cover}")`;
        slotCard.style.backgroundPosition = 'center 18%';
        document.getElementById('roulette-slot-tag').innerText = (randomItem.folder_type === 'movie' ? '🎬 Película' : '📺 Serie');
        document.getElementById('roulette-slot-title').innerText = randomItem.tmdb_title || randomItem.clean_title || randomItem.title || 'Video';
        document.getElementById('roulette-slot-meta').innerText = `${randomItem.tmdb_year || ''} ${randomItem.genre ? '· ' + randomItem.genre.split(',').slice(0, 2).join(', ') : ''} ${randomItem.tmdb_vote_average ? '⭐ ' + randomItem.tmdb_vote_average : ''}`;

        if (currentStep < totalSteps) {
            delay += Math.floor(currentStep * 4.5);
            window._rouletteTimer = setTimeout(step, delay);
        } else {
            // WINNER DECIDIDO
            const winner = candidates[Math.floor(Math.random() * candidates.length)];
            const winCover = winner.tmdb_backdrop
                ? (winner.tmdb_backdrop.startsWith('http') ? winner.tmdb_backdrop : `https://image.tmdb.org/t/p/w1280${winner.tmdb_backdrop}`)
                : (winner.tmdb_poster ? (winner.tmdb_poster.startsWith('http') || winner.tmdb_poster.startsWith('/caratula/') ? winner.tmdb_poster : `/caratula/${encodeURIComponent(winner.tmdb_poster)}`) : getCoverUrl(winner));

            slotCard.style.backgroundImage = `url("${winCover}")`;
            slotCard.style.backgroundPosition = 'center 18%';
            document.getElementById('roulette-slot-tag').innerText = `✨ GANADOR · ${winner.folder_type === 'movie' ? 'Película' : 'Serie'}`;
            document.getElementById('roulette-slot-tag').className = 'text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded bg-emerald-400 text-black mb-1.5 inline-block shadow-lg';
            document.getElementById('roulette-slot-title').innerText = winner.tmdb_title || winner.clean_title || winner.title || 'Video';
            document.getElementById('roulette-slot-meta').innerText = `${winner.tmdb_year || ''} ${winner.genre ? '· ' + winner.genre : ''} ${winner.tmdb_vote_average ? '· ⭐ ' + winner.tmdb_vote_average : ''}`;

            const playBtn = document.getElementById('roulette-play-btn');
            if (playBtn) {
                playBtn.onclick = () => {
                    closeVideoRouletteModal();
                    if (winner.folder_type === 'movie' || winner.type === 'video') {
                        playNow(winner.path);
                    } else {
                        openFolderPath(winner.path);
                    }
                };
            }

            const trBtn = document.getElementById('roulette-trailer-btn');
            if (trBtn) {
                if (winner.tmdb_id) {
                    fetch(`/api/tmdb/details?id=${winner.tmdb_id}&type=${winner.folder_type === 'movie' ? 'movie' : 'tv'}`)
                        .then(r => r.ok ? r.json() : null)
                        .then(d => {
                            if (d && d.trailer_key) {
                                trBtn.classList.remove('hidden');
                                trBtn.classList.add('flex');
                                trBtn.onclick = () => openTrailerModal(d.trailer_key, winner.tmdb_title || winner.title);
                            }
                        }).catch(() => {});
                } else {
                    trBtn.classList.add('hidden');
                }
            }

            if (winnerActions) winnerActions.classList.remove('hidden');
            if (spinBtn) {
                spinBtn.disabled = false;
                spinBtn.classList.remove('opacity-50', 'pointer-events-none');
                spinBtn.querySelector('span').innerText = 'Girar otra vez';
            }
            showToast(`🎉 ¡La ruleta eligió: ${winner.tmdb_title || winner.title}!`, 'success');
        }
    }

    step();
};
