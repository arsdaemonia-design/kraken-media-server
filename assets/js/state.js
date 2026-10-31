/**
 * ============================================================================
 * KRAKEN MEDIA SERVER — state.js
 * Estado global centralizado de la aplicación, bindings de navegación, gestión de PIN Maestro y utilidades de sanitización.
 * ============================================================================
 */

// ==================== CONFIGURACIÓN DE IDENTIDAD ====================
let MY_SESSION_ID = localStorage.getItem('kraken_sid');
if (!MY_SESSION_ID) {
    MY_SESSION_ID = 'sess_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('kraken_sid', MY_SESSION_ID);
}

// Identidad del usuario (manejada por el sistema JWT en kraken-auth-screen)
let savedUser = {};
try {
    const rawUser = localStorage.getItem('kraken_user');
    if (rawUser) {
        savedUser = rawUser.startsWith('{') ? JSON.parse(rawUser) : { username: rawUser };
    }
} catch (_) {}

let MY_NAME = savedUser.username || localStorage.getItem('kraken_username') || '';
if (savedUser.email) {
    window.MY_EMAIL = savedUser.email;
}
if (savedUser.username) {
    window.MY_NAME = savedUser.username;
}

let IS_SPEAKER = localStorage.getItem('kraken_is_speaker') !== 'false';
// ====================================================================

let searchScope = 'tracks'; // Default to Tracks view mode
let discografiaPath = ""; // Nueva variable para tracking de navegación
let libData = { files: [], folders: [], artist_tree: {}, playlists: {}, genres: [], smart_mixes: [] };
let downloadList = [];
let filters = { folder: 'all', artist: 'all', album: 'all', rating: 'all', playlist: 'all', genre: 'all', sort: 'default' };
const defaults = { folder: 'all', artist: 'all', album: 'all', rating: 'all', playlist: 'all', genre: 'all', sort: 'default' };
let selectedDownloadIndices = new Set(); // Guardará los índices de lo que SI queremos bajar
let currentLibrary = 'audio';
let currentAudioSection = 'general';
let currentView = 'library'; // 'library', 'folders', 'history', etc.
let currentArtistTracks = [];
let customMixes = {};
let sectionSmartMixes = [];
let currentFolderView = null;
let fileToMove = null; let fileToPlaylist = null;
let currentPath = "";
let renderLimit = 100;
let renderStep = 100;
let renderTimeout = null;
let lastFilters = null;
let playerQueue = []; let currentTrackIndex = -1; let isShuffleOn = false; let loopMode = 'off';
const isMobileViewport = window.matchMedia?.('(max-width: 767px)').matches ?? false;
const viewPreferenceKey = isMobileViewport ? 'kraken_view_mobile' : 'kraken_view_desktop';
let audioElement = null; let viewMode = localStorage.getItem(viewPreferenceKey) || (isMobileViewport ? 'grid' : (localStorage.getItem('vortex_view') || 'list'));
let selectionMode = false; let selectedFiles = new Set();
const zoomLevels = [
    'grid-cols-6 md:grid-cols-8',  // 0 = Más pequeño (default en canciones)
    'grid-cols-4 md:grid-cols-6',  // 1 = Mediano
    'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'   // 2 = Más grande (2 en móvil)
];
const videoZoomLevels = [
    'grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9 2xl:grid-cols-10', // 0 = Pequeño / Compacto
    'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8',  // 1 = Mediano (default)
    'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7'   // 2 = Grande (original)
];
let currentZoomIndex = Math.min(2, Math.max(0, parseInt(localStorage.getItem('kraken_audio_zoom') ?? '0', 10) || 0));
let currentVideoZoomIndex = Math.min(2, Math.max(0, parseInt(localStorage.getItem('kraken_video_zoom') ?? '1', 10)));
if (isNaN(currentVideoZoomIndex)) currentVideoZoomIndex = 1;
let audioCtx, analyser, canvas, canvasCtx;
let audioElement1, audioElement2, gainNode1, gainNode2, source1, source2;
let activeAudioIndex = 1;
let isVisualizerInit = false;
let discografiaMode = false;
const videoUIState = {
    mode: 'netflix-root',
    activeCategory: '',
    genreFilter: null,
    gridRenderLimit: 84,
    recommendationsOpen: true,
    search: '',
    pathDepth: 0,
    detailView: false
};

/**
 * `ensureVideoStateBindings()`
 * Define propiedades reactivas en `window` (categoría, género, vista y límites) sincronizadas con `videoUIState`.
 */
function ensureVideoStateBindings() {
    if (window.__krakenVideoStateBound) return;
    window.__krakenVideoStateBound = true;

    Object.defineProperty(window, 'netflixActiveCategory', {
        configurable: true,
        get() { return videoUIState.activeCategory; },
        set(value) { videoUIState.activeCategory = value || ''; }
    });
    Object.defineProperty(window, 'netflixGenreFilter', {
        configurable: true,
        get() { return videoUIState.genreFilter; },
        set(value) { videoUIState.genreFilter = value || null; }
    });
    Object.defineProperty(window, 'netflixGridRenderLimit', {
        configurable: true,
        get() { return videoUIState.gridRenderLimit; },
        set(value) {
            const n = Number(value);
            videoUIState.gridRenderLimit = Number.isFinite(n) && n > 0 ? n : 84;
        }
    });
    Object.defineProperty(window, 'currentPath', {
        configurable: true,
        get() { return currentPath; },
        set(value) { currentPath = (typeof value === 'string') ? value : ''; }
    });
    Object.defineProperty(window, 'currentFolderView', {
        configurable: true,
        get() { return currentFolderView; },
        set(value) { currentFolderView = value ?? null; }
    });
}

/**
 * `syncVideoDerivedState()`
 * Sincroniza el estado derivado de navegación de video (profundidad de ruta y texto de búsqueda activo).
 */
function syncVideoDerivedState() {
    const normalizedPath = ((typeof currentPath === 'string' ? currentPath : '') || '').replace(/\\/g, '/');
    const depth = normalizedPath.split('/').filter(Boolean).length;
    videoUIState.pathDepth = depth;
    videoUIState.detailView = currentLibrary === 'video' && depth >= 3;
    videoUIState.mode = videoUIState.detailView ? 'detail' : 'netflix-root';
    const mobileInput = document.getElementById('lib-search-mobile');
    const desktopInput = document.getElementById('lib-search-desktop');
    videoUIState.search = ((mobileInput && mobileInput.value) || (desktopInput && desktopInput.value) || '').trim();
}

ensureVideoStateBindings();

// ==================== ESTADO COMPARTIDO ENTRE MÓDULOS ====================
let imageObserver = null;
const KRAKEN_VIDEO_PREFS_KEY = 'kraken-video-prefs';
let currentLoadedCount = 20;
let duplicateSelectedIds = new Set();
let duplicateSelectedItems = new Map();
const playerState = {
    mode: 'music',      // 'music' | 'video'
    view: 'normal',     // 'normal' | 'expanded' (móvil)
    index: 0,
    loop: false,
    shuffle: false,
    muted: false
};
window.KRAKEN_CONTROL_TARGET = null;
window.KRAKEN_PLAYBACK_TARGET = null;
window.KRAKEN_SYNC_JAM = null;
let rescanWatcher = null;
window.showAllFiles = false;
let lastRadarJson = "";
let LAST_USERS_DATA = [];
const KRAKEN_PLAYBACK_TARGET_KEY = 'kraken-playback-target-sid';
let currentContextPath = null;
let currentExplorerPath = '';
let lyricsSyncState = {
    lines: [],          // [{time: 12.5, text: "Hola mundo"}, ...]
    isSynced: false,    // true si es .lrc válido, false si es texto plano
    activeIndex: -1,    // Índice del verso que suena actualmente
    intervalId: null,   // Referencia para compatibilidad
    userScrolled: false,// Pausa el auto-scroll si el usuario mueve la letra manualmente
    scrollTimeout: null,
    audioHooked: false
};

/**
 * `toggleMobileMenu()`
 * Alterna la apertura y cierre del menú lateral (sidebar) en dispositivos móviles.
 */
function toggleMobileMenu() {
    toggleSidebar();
}

// --- SISTEMA MASTER PIN (Memoria de Sesión) ---
/**
 * `getMasterPin(mensaje)`
 * Solicita o recupera de `sessionStorage` el PIN Maestro para operaciones administrativas y contenido +18.
 */
function getMasterPin(mensaje) {
    let pin = sessionStorage.getItem('kraken_master_pin');
    if (!pin) {
        pin = prompt(mensaje);
        if (pin) {
            sessionStorage.setItem('kraken_master_pin', pin);
            if (window.KrakenTV && typeof window.KrakenTV.setMasterPin === 'function') {
                try { window.KrakenTV.setMasterPin(pin); } catch (_) {}
            }
            setTimeout(() => {
                if (typeof cargarLib === 'function' && !libData?.adult_unlocked) {
                    cargarLib();
                }
            }, 200);
        }
    } else if (window.KrakenTV && typeof window.KrakenTV.setMasterPin === 'function') {
        try { window.KrakenTV.setMasterPin(pin); } catch (_) {}
    }
    return pin;
}

/**
 * `clearPinIfInvalid(errorMsg)`
 * Invalida el PIN Maestro almacenado en sesión si el servidor devuelve un error de autorización.
 */
function clearPinIfInvalid(errorMsg) {
    if (errorMsg && errorMsg.toLowerCase().includes('pin')) {
        sessionStorage.removeItem('kraken_master_pin');
    }
}

/**
 * `goHome()`
 * Restablece los filtros, rutas de exploración y estado de vista para volver a la pantalla de inicio de la biblioteca.
 */
function goHome() {
    window.currentAlbumPath = null;
    currentView = 'library';
    currentExplorerPath = ''; // Limpiamos la ruta del explorador también

    filters = { ...defaults };
    currentFolderView = null;
    currentPath = "";
    if (currentLibrary === 'video') {
        videoUIState.genreFilter = null;
        videoUIState.recommendationsOpen = true;
        videoUIState.gridRenderLimit = 84;
    }

    filters = { ...defaults };
    currentFolderView = null;
    currentPath = "";
    filters = { ...defaults };
    currentFolderView = null;
    currentPath = "";

    // Ocultar elementos si existen
    const btnBack = document.getElementById('btn-back-folder');
    if (btnBack) btnBack.classList.add('hidden');

    const hero = document.getElementById('artist-hero');
    if (hero) hero.classList.add('hidden');

    // Actualizar títulos DESKTOP Y MÓVIL
    const titleDesktop = document.getElementById('lib-title-desktop');
    const titleMobile = document.getElementById('lib-title-mobile');
    const newTitle = getCurrentLibraryTitle();

    if (titleDesktop) titleDesktop.innerText = newTitle;
    if (titleMobile) titleMobile.innerText = newTitle;

    // Limpiar chips DESKTOP
    ['chip-recent', 'chip-top', 'chip-new'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active', 'bg-emerald-600', 'text-white');
    });

    // Limpiar chips MÓVIL
    ['chip-recent-mobile', 'chip-top-mobile', 'chip-new-mobile'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active', 'bg-emerald-600', 'text-white');
    });

    // Limpiar inputs de búsqueda
    const mobileInput = document.getElementById('lib-search-mobile');
    const desktopInput = document.getElementById('lib-search-desktop');
    if (mobileInput) mobileInput.value = '';
    if (desktopInput) desktopInput.value = '';

    ver('library');
    updateAudioSectionNav();
}

/**
 * `setLibraryMode(mode)`
 * Cambia entre la biblioteca de Audio ('audio') y la de Video ('video'), actualizando la interfaz y filtros.
 */
function setLibraryMode(mode) {
    discografiaMode = false;
    currentLibrary = mode;
    if (mode !== 'audio') currentAudioSection = 'general';
    currentFolderView = null;
    if (mode === 'video') {
        videoUIState.gridRenderLimit = 84;
    }

    // Headers siempre visibles (audio y video)
    const mobileHeader = document.getElementById('mobile-header');
    const desktopHeader = document.getElementById('desktop-header');
    if (mobileHeader) {
        mobileHeader.style.display = '';
    }
    if (desktopHeader) {
        desktopHeader.style.display = '';
    }

    // Actualizar pestañas superiores
    const tabAudio = document.getElementById('tab-audio');
    const tabVideo = document.getElementById('tab-video');
    if (tabAudio) tabAudio.classList.toggle('active', mode === 'audio');
    if (tabVideo) tabVideo.classList.toggle('active', mode === 'video');

    // Actualizar etiquetas DESKTOP
    const labelDesktop = document.getElementById('lib-mode-label-desktop');
    if (labelDesktop) {
        labelDesktop.innerHTML = (mode === 'audio')
            ? '<i class="fa-solid fa-music"></i> MÚSICA'
            : '<i class="fa-solid fa-film"></i> VIDEO';
    }

    // Actualizar etiquetas MÓVIL
    const labelMobile = document.getElementById('lib-mode-label-mobile');
    if (labelMobile) {
        labelMobile.innerHTML = (mode === 'audio')
            ? '<i class="fa-solid fa-music"></i> MÚSICA'
            : '<i class="fa-solid fa-film"></i> VIDEO';
    }

    // [MEJORA NETFLIX]: Forzar siempre el modo Grid al entrar a Video para asegurar que se vea el carrusel
    if (mode === 'video') {
        if (typeof setView === 'function') {
            setView('grid');
        }
    }

    // Limpiar búsqueda al cambiar de modo
    const mobileInput = document.getElementById('lib-search-mobile');
    const desktopInput = document.getElementById('lib-search-desktop');
    if (mobileInput) mobileInput.value = '';
    if (desktopInput) desktopInput.value = '';

    // Volver al inicio
    goHome();
}
/**
 * `escapeStr(str)`
 * Escapa comillas simples, barras invertidas y saltos de línea para uso seguro en atributos JS inline.
 */
function escapeStr(str) {
    if (!str) return '';
    return String(str)
        .split('\\\\').join('\\\\\\\\')
        .split("'").join("\\\\'")
        .split('"').join('\\\\\"')
        .split('\\n').join('\\\\n')
        .split('\\r').join('\\\\r');
}
/**
 * `escapeHtml(str)`
 * Escapa caracteres especiales HTML (&, <, >, ", ') para prevenir inyección XSS al renderizar en el DOM.
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * `getRandomGradient()`
 * Retorna la clase CSS de gradiente predeterminada para tarjetas sin carátula.
 */
function getRandomGradient() { return `rand-grad-0`; }

/**
 * `openFolderPath(path)`
 * Navegación segura hacia una carpeta o serie sin colisión de comillas simples o dobles en atributos onclick.
 */
window.openFolderPath = function(target) {
    let targetPath = '';
    if (typeof target === 'string') {
        targetPath = target;
    } else if (target && target.dataset) {
        targetPath = target.dataset.folderPath || target.dataset.path || target.dataset.seriesPath || target.dataset.moviePath || target.dataset.basePath || '';
    }
    targetPath = (targetPath || '').replace(/\\/g, '/');
    if (targetPath && !targetPath.endsWith('/')) {
        targetPath += '/';
    }
    currentPath = targetPath || '';
    currentFolderView = null;
    if (typeof renderLib === 'function') {
        renderLib();
    }
};

window.goToSeason = function(seasonName) {
    const safeSeason = (typeof seasonName === 'string') ? seasonName : (seasonName?.dataset?.seasonName || '');
    if (!safeSeason) return;
    const safeName = safeSeason.replace(/[^a-zA-Z0-9]/g, '-');
    const el = document.getElementById('season-' + safeName);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    currentFolderView = safeSeason;
};
