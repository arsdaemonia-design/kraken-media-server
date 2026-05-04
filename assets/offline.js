let offlineDb = null;
let offlinePaths = new Set();
let offlineCount = 0;
let offlineBatchCancel = false;
let offlineIndicatorPending = false;
let offlineStateReady = false;
window.CF_ACCESS_EXPIRED = false;

// ⭐ CLOUDflare ACCESS - Ya no se usa (autenticación local JWT)
async function checkCloudflareAccess() {
    return true;
}

async function initOfflineBootstrap() {
    // ⭐ PRIMER PASO: Verificar acceso a Cloudflare
    const accessOk = await checkCloudflareAccess();

    // Siempre evaluamos y mostramos barra de sesión (incluso si Access expiró)
    checkSessionStatus();

    if (!accessOk) {
        return;
    }

    updateVersionLabel();
    warnUnsupportedBrowser();
    if (shouldShowOfflineLoader()) {
        showOfflineLoader('Liberando Kraken, nueva version');
        setTimeout(() => showOfflineLoader('Reajustando biblioteca'), 600);
    }
    initOfflineModeToggle();
    registerServiceWorker();
    applyOfflineModeToSw();
    await initOfflineDb().catch(() => {});
    await refreshOfflineList();
    await updateOfflineButtonForCurrent();
    hookOfflineRender();
    ensurePlaylistDownloadButtons();
    updatePlaylistDownloadButtons();
    attachOfflineAudioLoader();
    
    hideOfflineLoader();
}
function initOfflineModeToggle() {
    updateOfflineModeUi();
}

function isOfflineModeEnabled() {
    try {
        return localStorage.getItem('kraken-offline-mode') === '1';
    } catch (_) {
        return false;
    }
}

function toggleOfflineMode(e) {
    if (e) {
        e.stopPropagation();
    }
    
    const checkbox = document.getElementById('offline-pill-checkbox');
    if (checkbox) {
        setOfflineMode(checkbox.checked);
    }
}

function updateOfflineModeUi() {
    const checkbox = document.getElementById('offline-pill-checkbox');
    const statusLabel = document.getElementById('offline-pill-status');
    const enabled = isOfflineModeEnabled();
    
    if (checkbox) {
        checkbox.checked = enabled;
    }
    
    if (statusLabel) {
        statusLabel.textContent = enabled ? 'Offline' : 'Online';
    }
}
window.updateOfflineModeUi = updateOfflineModeUi;
window.toggleOfflineMode = toggleOfflineMode;
window.isOfflineModeEnabled = isOfflineModeEnabled;

function applyOfflineModeToSw() {
    const enabled = isOfflineModeEnabled();
    sendSwMessage({ type: 'SET_OFFLINE_MODE', enabled }).catch(() => {});
}

function shouldShowOfflineLoader() {
    try {
        const key = 'kraken-offline-version-seen';
        const current = typeof OFFLINE_VERSION !== 'undefined' ? String(OFFLINE_VERSION) : '0';
        const last = localStorage.getItem(key);
        if (last === current) return false;
        localStorage.setItem(key, current);
        return true;
    } catch (_) {
        return true;
    }
}

function showOfflineLoader(text) {
    const loader = document.getElementById('loader');
    if (!loader) return;
    loader.classList.remove('hidden');
    const label = document.getElementById('loader-text');
    if (label && text) label.textContent = text;
}

function hideOfflineLoader() {
    const loader = document.getElementById('loader');
    if (!loader) return;
    loader.classList.add('hidden');
}

function attachOfflineAudioLoader() {
    const el = document.getElementById('main-audio');
    if (!el) {
        setTimeout(attachOfflineAudioLoader, 300);
        return;
    }

    const show = () => {
        if (!navigator.onLine) {
            showOfflineLoader('Cargando audio offline...');
            setTimeout(hideOfflineLoader, 6000);
        }
    };
    const hide = () => hideOfflineLoader();

    el.addEventListener('loadstart', show);
    el.addEventListener('waiting', show);
    el.addEventListener('stalled', show);
    el.addEventListener('canplay', hide);
    el.addEventListener('playing', hide);
    el.addEventListener('error', hide);
}

function updateVersionLabel() {
    const el = document.getElementById('offline-version');
    if (!el) return;
    const appV = typeof APP_VERSION !== 'undefined' ? APP_VERSION : '0.0';
    const offV = typeof OFFLINE_VERSION !== 'undefined' ? OFFLINE_VERSION : '0.0';
    el.textContent = `Kraken v${appV} · Offline v${offV}`;
}

function isSupportedOfflineBrowser() {
    const ua = navigator.userAgent || '';
    const isEdge = /Edg\//.test(ua);
    const isOpera = /OPR\//.test(ua);
    const isBrave = /Brave\//.test(ua) || (navigator.brave && typeof navigator.brave.isBrave === 'function');
    const isChrome = /Chrome\//.test(ua) && !isEdge && !isOpera;
    return isChrome || isBrave || isOpera;
}

function warnUnsupportedBrowser() {
    if (sessionStorage.getItem('kraken-offline-browser-warning')) return;
    if (!isSupportedOfflineBrowser()) {
        showToast('Offline solo soportado en Chrome/Brave/Opera', 'warning');
        sessionStorage.setItem('kraken-offline-browser-warning', '1');
    }
}

function getConnectionInfo() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return null;
    return {
        type: (conn.type || '').toLowerCase(),
        effectiveType: (conn.effectiveType || '').toLowerCase(),
        saveData: !!conn.saveData
    };
}

function getOfflineLimit() {
    if (typeof OFFLINE_LIMIT === 'number' && OFFLINE_LIMIT > 0) return OFFLINE_LIMIT;
    return 500;
}

function renderOfflineQuota() {
    const badge = document.getElementById('offline-quota-badge');
    const bar = document.getElementById('offline-quota-bar');
    const saver = document.getElementById('offline-saver-status');
    if (!badge || !bar) return;
    const limit = getOfflineLimit();
    const percent = limit ? Math.min(100, Math.round((offlineCount / limit) * 100)) : 0;
    let color = 'rgb(52, 211, 153)';
    let colorBg = 'rgba(16, 185, 129, 0.25)';
    if (percent >= 90) {
        color = 'rgb(248, 113, 113)';
        colorBg = 'rgba(239, 68, 68, 0.2)';
    } else if (percent >= 70) {
        color = 'rgb(250, 204, 21)';
        colorBg = 'rgba(234, 179, 8, 0.2)';
    }
    badge.className = 'text-xs font-bold px-2 py-1 rounded-full border';
    badge.textContent = `${offlineCount} / ${limit}`;
    badge.style.color = color;
    badge.style.borderColor = color;
    badge.style.backgroundColor = colorBg;
    bar.className = 'h-full transition-all';
    bar.style.backgroundColor = color;
    bar.style.width = `${percent}%`;
    if (saver) {
        const info = getConnectionInfo();
        if (!info) {
            saver.textContent = 'Modo ahorro: estado desconocido';
            saver.style.color = 'rgba(52, 211, 153, 0.7)';
        } else if (info.saveData || ['slow-2g', '2g', '3g'].includes(info.effectiveType)) {
            saver.textContent = 'Modo ahorro activo: descargas bloqueadas en red lenta';
            saver.className = 'text-[10px] mt-2';
            saver.style.color = 'rgba(250, 204, 21, 0.85)';
        } else {
            saver.textContent = 'Modo ahorro: normal';
            saver.className = 'text-[10px] mt-2';
            saver.style.color = 'rgba(52, 211, 153, 0.7)';
        }
    }
}

function canDownloadOffline() {
    if (isOfflineModeEnabled()) return { ok: false, needsConfirm: false, reason: 'manual-offline' };
    const info = getConnectionInfo();
    if (!info) return { ok: true, needsConfirm: true, reason: 'unknown' };

    if (info.saveData) return { ok: false, needsConfirm: false, reason: 'save-data' };

    if (info.type) {
        if (info.type === 'wifi' || info.type === 'ethernet') {
            return { ok: true, needsConfirm: false, reason: 'wifi' };
        }
        if (info.type === 'cellular') {
            return { ok: false, needsConfirm: false, reason: 'cellular' };
        }
    }

    if (info.effectiveType) {
        if (['slow-2g', '2g', '3g'].includes(info.effectiveType)) {
            return { ok: false, needsConfirm: false, reason: 'slow' };
        }
        if (info.effectiveType === '4g') {
            return { ok: true, needsConfirm: true, reason: '4g' };
        }
    }

    return { ok: true, needsConfirm: true, reason: 'unknown' };
}

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const version = (typeof OFFLINE_VERSION !== 'undefined' && OFFLINE_VERSION) ? OFFLINE_VERSION : 'v2';
    navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(version)}`).catch(() => {});
}

function initOfflineDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('kraken-offline', 2);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('tracks')) {
                db.createObjectStore('tracks', { keyPath: 'path' });
            }
            if (!db.objectStoreNames.contains('playlists')) {
                db.createObjectStore('playlists', { keyPath: 'name' });
            }
        };
        req.onsuccess = () => {
            offlineDb = req.result;
            resolve();
        };
        req.onerror = () => reject(req.error);
    });
}

function withStore(mode, callback) {
    return new Promise((resolve, reject) => {
        if (!offlineDb) return reject(new Error('DB not ready'));
        const tx = offlineDb.transaction('tracks', mode);
        const store = tx.objectStore('tracks');
        const request = callback(store);
        tx.oncomplete = () => resolve(request?.result);
        tx.onerror = () => reject(tx.error);
    });
}

function getOfflineTrack(path) {
    return withStore('readonly', store => store.get(path));
}

function getAllOfflineTracks() {
    return withStore('readonly', store => store.getAll());
}

function getAllOfflinePlaylists() {
    return new Promise((resolve, reject) => {
        if (!offlineDb) return reject(new Error('DB not ready'));
        const tx = offlineDb.transaction('playlists', 'readonly');
        const store = tx.objectStore('playlists');
        const req = store.getAll();
        tx.oncomplete = () => resolve(req.result || []);
        tx.onerror = () => reject(tx.error);
    });
}

function saveOfflineTrack(track) {
    return withStore('readwrite', store => store.put(track));
}

function saveOfflinePlaylist(playlist) {
    return new Promise((resolve, reject) => {
        if (!offlineDb) return reject(new Error('DB not ready'));
        const tx = offlineDb.transaction('playlists', 'readwrite');
        const store = tx.objectStore('playlists');
        const req = store.put(playlist);
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
    });
}

function removeOfflineTrack(path) {
    return withStore('readwrite', store => store.delete(path));
}

function getCurrentTrackSafe() {
    if (typeof playerQueue !== 'undefined' && playerQueue && playerQueue.length > 0 && typeof currentTrackIndex !== 'undefined') {
        return playerQueue[currentTrackIndex];
    }
    return null;
}

function buildFileUrls(file) {
    const safePath = file.path.split('/').map(p => encodeURIComponent(p)).join('/');
    return {
        audioUrl: new URL('/descargas/' + safePath, location.origin).toString(),
        coverUrl: new URL('/caratula/' + safePath, location.origin).toString()
    };
}

async function sendSwMessage(message) {
    if (!navigator.serviceWorker?.controller) {
        try {
            await navigator.serviceWorker.ready;
        } catch (_) {}
    }
    if (!navigator.serviceWorker?.controller) return null;
    return new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = event => resolve(event.data);
        channel.port1.onmessageerror = () => reject(new Error('SW message error'));
        navigator.serviceWorker.controller.postMessage(message, [channel.port2]);
    });
}

async function toggleOfflineSave() {
    const file = getCurrentTrackSafe();
    if (!file || !file.path) return;
    if (file.type && file.type !== 'audio') {
        showToast('Solo audio para offline', 'warning');
        return;
    }

    await syncOfflineState();
    const existing = await getOfflineTrack(file.path);
    if (existing) {
        await removeOfflineTrack(file.path);
        const urls = buildFileUrls(file);
        await sendSwMessage({ type: 'REMOVE_TRACK', urls: [urls.audioUrl, urls.coverUrl] });
        offlinePaths.delete(file.path);
        offlineCount = Math.max(0, offlineCount - 1);
        updateOfflineButton(false);
        refreshOfflineList();
        scheduleOfflineIndicators();
        showToast('Quitado de Offline', 'info');
        return;
    }

    if (!navigator.onLine) {
        showToast('Sin conexion para guardar', 'warning');
        return;
    }

    if (offlineCount >= getOfflineLimit()) {
        showToast('Limite offline alcanzado', 'warning');
        return;
    }

    const wifiCheck = canDownloadOffline();
    if (!wifiCheck.ok) {
        showToast('Solo Wi-Fi para guardar offline', 'warning');
        return;
    }
    if (wifiCheck.needsConfirm) {
        const ok = confirm('Asegurate de estar en Wi-Fi antes de descargar.');
        if (!ok) return;
    }

    try {
        if (navigator.storage?.persist) {
            await navigator.storage.persist();
        }
    } catch (_) {}

    const urls = buildFileUrls(file);
    const res = await sendSwMessage({ type: 'CACHE_TRACK', urls: [urls.audioUrl, urls.coverUrl] });
    if (!res || !res.ok) {
        showToast('No se pudo cachear', 'error');
        return;
    }

    await saveOfflineTrack({
        path: file.path,
        title: file.title || 'Sin titulo',
        artist: file.artist || '',
        album: file.album || '',
        duration: file.duration || '',
        type: file.type || 'audio'
    });
    offlinePaths.add(file.path);
    offlineCount += 1;
    updateOfflineButton(true);
    refreshOfflineList();
    scheduleOfflineIndicators();
    showToast('Guardado offline', 'success');
}

function updateOfflineButton(isSaved) {
    const ids = ['btn-offline-save', 'btn-offline-save-desktop'];
    ids.forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.remove('text-emerald-400', 'text-zinc-400', 'text-zinc-600');
        btn.classList.add(isSaved ? 'text-emerald-400' : 'text-zinc-400');
        btn.title = isSaved ? 'Quitar offline' : 'Guardar offline';
    });
}

async function updateOfflineButtonForCurrent() {
    const file = getCurrentTrackSafe();
    if (!file || !file.path) return;
    try {
        const existing = await getOfflineTrack(file.path);
        updateOfflineButton(!!existing);
    } catch (_) {}
}

async function refreshOfflineList() {
    const container = document.getElementById('offline-list');
    if (!container) return;
    const tracks = await syncOfflineState();
    if (!tracks || tracks.length === 0) {
        container.innerHTML = '<div class="text-xs text-emerald-500/70">No hay offline.</div>';
        refreshOfflinePlaylists();
        return;
    }
    container.innerHTML = '';
    tracks.forEach(track => {
        const row = document.createElement('div');
        row.className = 'list-row';
        row.onclick = () => playOfflineTrack(track);
        row.innerHTML = `
            <div class="min-w-0 flex-1">
                <div class="text-xs text-white font-bold truncate">${track.title}</div>
                <div class="text-[10px] text-emerald-500 truncate">${track.artist || ''}</div>
            </div>
            <button class="text-red-400 text-[10px] font-bold px-2" onclick="event.stopPropagation(); removeOfflineByPath('${track.path.replace(/'/g, "\\'")}')">Quitar</button>
        `;
        container.appendChild(row);
    });
    refreshOfflinePlaylists();
}

async function refreshOfflinePlaylists() {
    const container = document.getElementById('offline-playlists');
    const countEl = document.getElementById('offline-playlist-count');
    if (!container || !countEl) return;
    let lists = [];
    try {
        lists = await getAllOfflinePlaylists();
    } catch (_) {
        lists = [];
    }
    countEl.textContent = String(lists.length || 0);
    if (!lists || lists.length === 0) {
        container.innerHTML = '<div class="text-xs text-emerald-500/70">Sin playlists offline.</div>';
        return;
    }
    container.innerHTML = '';
    lists.forEach(pl => {
        const row = document.createElement('div');
        row.className = 'list-row';
        row.onclick = () => playOfflinePlaylist(pl);
        const total = (pl.tracks && pl.tracks.length) ? pl.tracks.length : 0;
        row.innerHTML = `
            <div class="min-w-0 flex-1">
                <div class="text-xs text-white font-bold truncate">${pl.name}</div>
                <div class="text-[10px] text-emerald-500 truncate">${total} canciones</div>
            </div>
            <button class="text-emerald-300 text-[10px] font-bold px-2" onclick="event.stopPropagation(); playOfflinePlaylistByName('${(pl.name || '').replace(/'/g, "\\'")}')">Reproducir</button>
            <button class="text-emerald-400 text-[10px] font-bold px-2" onclick="event.stopPropagation(); enqueueOfflinePlaylist('${(pl.name || '').replace(/'/g, "\\'")}')">Encolar</button>
        `;
        container.appendChild(row);
    });
}

async function updateServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        showToast('SW no disponible', 'warning');
        return;
    }
    try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.update()));
        showToast('SW actualizado', 'success');
    } catch (e) {
        showToast('Error actualizando SW', 'error');
    }
}

async function clearOfflineCache() {
    try {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => {
            if (key.startsWith('kraken-offline-') || key.startsWith('kraken-app-')) {
                return caches.delete(key);
            }
            return Promise.resolve();
        }));
    } catch (_) {}

    try {
        await new Promise(resolve => {
            const req = indexedDB.deleteDatabase('kraken-offline');
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
        });
    } catch (_) {}

    offlineDb = null;
    await initOfflineDb().catch(() => {});
    refreshOfflineList();
    updateOfflineButtonForCurrent();
    showToast('Offline limpiado', 'info');
}

async function removeOfflineByPath(path) {
    const track = await getOfflineTrack(path);
    if (!track) return;
    await removeOfflineTrack(path);
    const urls = buildFileUrls(track);
    await sendSwMessage({ type: 'REMOVE_TRACK', urls: [urls.audioUrl, urls.coverUrl] });
    offlinePaths.delete(path);
    offlineCount = Math.max(0, offlineCount - 1);
    refreshOfflineList();
    updateOfflineButtonForCurrent();
    scheduleOfflineIndicators();
}

function playOfflineTrack(track) {
    if (!track || !track.path) return;
    const file = {
        path: track.path,
        title: track.title,
        artist: track.artist,
        album: track.album,
        type: 'audio'
    };
    if (typeof playerQueue !== 'undefined') {
        playerQueue = [file];
        currentTrackIndex = 0;
        playTrack(file);
    }
}

function normalizeOfflineTrack(track) {
    return {
        path: track.path,
        title: track.title || 'Sin titulo',
        artist: track.artist || '',
        album: track.album || '',
        type: 'audio'
    };
}

async function playOfflinePlaylist(playlist) {
    if (!playlist || !playlist.tracks || playlist.tracks.length === 0) return;
    const queue = playlist.tracks.map(t => normalizeOfflineTrack(t));
    if (typeof playerQueue !== 'undefined') {
        playerQueue = queue;
        currentTrackIndex = 0;
        playTrack(queue[0]);
    }
}

async function playOfflinePlaylistByName(name) {
    let lists = [];
    try {
        lists = await getAllOfflinePlaylists();
    } catch (_) {
        lists = [];
    }
    const playlist = lists.find(pl => pl.name === name);
    if (!playlist) return;
    playOfflinePlaylist(playlist);
}

async function enqueueOfflinePlaylist(name) {
    let lists = [];
    try {
        lists = await getAllOfflinePlaylists();
    } catch (_) {
        lists = [];
    }
    const playlist = lists.find(pl => pl.name === name);
    if (!playlist || !playlist.tracks || playlist.tracks.length === 0) return;
    const queue = playlist.tracks.map(t => normalizeOfflineTrack(t));
    if (typeof playerQueue !== 'undefined') {
        if (!playerQueue) playerQueue = [];
        playerQueue = playerQueue.concat(queue);
    }
    showToast(`Encoladas ${queue.length} canciones`, 'success');
}

const _origActualizar = window.actualizarInterfazPlayer;
window.actualizarInterfazPlayer = function(file) {
    if (typeof _origActualizar === 'function') {
        _origActualizar(file);
    }
    updateOfflineButtonForCurrent();
    scheduleOfflineIndicators();
};

const _origVer = window.ver;
window.ver = function(view) {
    if (view === 'offline') {
        document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
        const target = document.getElementById('view-offline');
        if (target) target.classList.remove('hidden');
        document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
        const nav = document.getElementById('nav-offline');
        if (nav) nav.classList.add('active');
        const sidebar = document.getElementById('sidebar-filters');
        if (sidebar) sidebar.classList.add('hidden');
        refreshOfflineList();
        updatePlaylistDownloadButtons();
        return;
    }
    if (typeof _origVer === 'function') _origVer(view);
    updatePlaylistDownloadButtons();
};

function hookOfflineRender() {
    if (typeof window.renderLib === 'function' && !window.__offlineRenderHooked) {
        const orig = window.renderLib;
        window.renderLib = function() {
            const res = orig.apply(this, arguments);
            ensureOfflineState().then(() => scheduleOfflineIndicators());
            ensurePlaylistDownloadButtons();
            return res;
        };
        window.__offlineRenderHooked = true;
    }
}

async function syncOfflineState() {
    const tracks = await getAllOfflineTracks();
    offlinePaths = new Set((tracks || []).map(t => t.path));
    offlineCount = tracks ? tracks.length : 0;
    offlineStateReady = true;
    renderOfflineQuota();
    scheduleOfflineIndicators();
    return tracks || [];
}

async function ensureOfflineState() {
    if (offlineStateReady) return;
    await syncOfflineState().catch(() => {});
}

function scheduleOfflineIndicators() {
    if (offlineIndicatorPending) return;
    offlineIndicatorPending = true;
    requestAnimationFrame(() => {
        offlineIndicatorPending = false;
        updateOfflineIndicators();
    });
}

function updateOfflineIndicators() {
    const listRows = Array.from(document.querySelectorAll('div.list-row[data-path]'));
    if (!offlinePaths || offlinePaths.size === 0) {
        if (!offlineStateReady) return;
        document.querySelectorAll('[data-offline-indicator="1"]').forEach(el => el.remove());
        return;
    }
    listRows.forEach(row => {
        const path = normalizeDatasetPath(row.dataset.path);
        const existing = row.querySelector('[data-offline-indicator="1"]');
        if (offlinePaths.has(path)) {
            if (!existing) {
                const title = row.querySelector('.text-white') || row.querySelector('h3');
                if (title) {
                    const badge = document.createElement('span');
                    badge.setAttribute('data-offline-indicator', '1');
                    badge.className = 'inline-flex items-center justify-center mr-2 w-4 h-4 rounded-full bg-emerald-600 text-white text-[8px] shadow';
                    badge.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
                    title.insertBefore(badge, title.firstChild);
                }
            }
        } else if (existing) {
            existing.remove();
        }
    });

    const cards = Array.from(document.querySelectorAll('div.group[data-path]')).filter(el => !el.classList.contains('list-row'));
    cards.forEach(card => {
        const path = normalizeDatasetPath(card.dataset.path);
        const existing = card.querySelector('[data-offline-indicator="1"]');
        if (offlinePaths.has(path)) {
            if (!existing) {
                const title = card.querySelector('h3');
                if (title) {
                    const badge = document.createElement('span');
                    badge.setAttribute('data-offline-indicator', '1');
                    badge.className = 'inline-flex items-center justify-center mr-2 w-4 h-4 rounded-full bg-emerald-600 text-white text-[8px] shadow';
                    badge.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
                    title.insertBefore(badge, title.firstChild);
                }
            }
        } else if (existing) {
            existing.remove();
        }
    });
}

function normalizeDatasetPath(value) {
    if (!value) return '';
    if (value.indexOf('&') === -1) return value;
    const txt = document.createElement('textarea');
    txt.innerHTML = value;
    return txt.value;
}

function ensurePlaylistDownloadButtons() {
    const desktopAnchor = document.getElementById('btn-select-mode');
    if (desktopAnchor && !document.getElementById('btn-offline-playlist-desktop')) {
        const btn = document.createElement('button');
        btn.id = 'btn-offline-playlist-desktop';
        btn.className = 'filter-chip shrink-0 hidden';
        btn.onclick = downloadCurrentPlaylistOffline;
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-down mr-1"></i> Offline Playlist';
        desktopAnchor.parentElement.insertBefore(btn, desktopAnchor);
    }

    const mobileViewBtn = document.getElementById('view-grid-mobile');
    if (mobileViewBtn && !document.getElementById('btn-offline-playlist-mobile')) {
        const btn = document.createElement('button');
        btn.id = 'btn-offline-playlist-mobile';
        btn.className = 'filter-chip shrink-0 hidden';
        btn.onclick = downloadCurrentPlaylistOffline;
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> Offline';
        mobileViewBtn.parentElement.insertBefore(btn, mobileViewBtn);
    }
}

function updatePlaylistDownloadButtons() {
    const hasPlaylist = !!getCurrentPlaylistName();
    const desktopBtn = document.getElementById('btn-offline-playlist-desktop');
    const mobileBtn = document.getElementById('btn-offline-playlist-mobile');
    if (desktopBtn) desktopBtn.classList.toggle('hidden', !hasPlaylist);
    if (mobileBtn) mobileBtn.classList.toggle('hidden', !hasPlaylist);
}

function getCurrentPlaylistName() {
    if (typeof currentLibrary !== 'undefined' && currentLibrary && currentLibrary.startsWith('playlist:')) {
        return currentLibrary.split(':')[1];
    }
    if (typeof filters !== 'undefined' && filters.playlist && filters.playlist !== 'all') {
        return filters.playlist;
    }
    return null;
}

async function downloadCurrentPlaylistOffline() {
    const name = getCurrentPlaylistName();
    if (!name || typeof libData === 'undefined' || !libData.playlists) {
        showToast('Selecciona una playlist primero', 'warning');
        return;
    }
    const paths = libData.playlists[name] || [];
    if (paths.length === 0) {
        showToast('Playlist vacia', 'info');
        return;
    }
    if (!navigator.onLine) {
        showToast('Sin conexion para guardar', 'warning');
        return;
    }
    await syncOfflineState();
    if (offlineCount >= getOfflineLimit()) {
        showToast('Limite offline alcanzado', 'warning');
        return;
    }

    const wifiCheck = canDownloadOffline();
    if (!wifiCheck.ok) {
        showToast('Solo Wi-Fi para guardar offline', 'warning');
        return;
    }
    if (wifiCheck.needsConfirm) {
        const ok = confirm('Asegurate de estar en Wi-Fi antes de descargar.');
        if (!ok) return;
    }

    const fileMap = new Map((libData.files || []).map(f => [f.path, f]));
    const tracks = paths.map(p => fileMap.get(p)).filter(f => f && f.type !== 'video');
    if (tracks.length === 0) {
        showToast('No hay audio para descargar', 'info');
        return;
    }
    await batchDownloadTracks(tracks, name);
}

function openOfflineBatchModal(label, total) {
    const modal = document.getElementById('offline-batch-modal');
    const title = document.getElementById('offline-batch-title');
    const count = document.getElementById('offline-batch-count');
    const totalEl = document.getElementById('offline-batch-total');
    if (!modal || !title || !count || !totalEl) return;
    title.textContent = `Descargando ${label}`;
    count.textContent = '0';
    totalEl.textContent = String(total || 0);
    updateOfflineBatchQuota();
    updateOfflineBatchBar(0);
    modal.classList.remove('hidden');
}

function closeOfflineBatchModal() {
    const modal = document.getElementById('offline-batch-modal');
    if (modal) modal.classList.add('hidden');
}

function updateOfflineBatchBar(percent) {
    const bar = document.getElementById('offline-batch-bar');
    if (!bar) return;
    bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
}

function updateOfflineBatchCount(value) {
    const count = document.getElementById('offline-batch-count');
    if (count) count.textContent = String(value);
    updateOfflineBatchQuota();
}

function updateOfflineBatchQuota() {
    const quota = document.getElementById('offline-batch-quota');
    if (!quota) return;
    quota.textContent = `${offlineCount} / ${getOfflineLimit()}`;
}

function cancelOfflineBatch() {
    offlineBatchCancel = true;
}

async function batchDownloadTracks(tracks, label) {
    offlineBatchCancel = false;
    openOfflineBatchModal(label, tracks.length);
    let done = 0;
    const playlistTracks = [];
    const seen = new Set();
    for (const track of tracks) {
        if (offlineBatchCancel) break;
        if (seen.has(track.path)) {
            done += 1;
            updateOfflineBatchCount(done);
            updateOfflineBatchBar((done / tracks.length) * 100);
            continue;
        }
        seen.add(track.path);
        if (offlineCount >= getOfflineLimit()) {
            showToast('Limite offline alcanzado', 'warning');
            break;
        }
        if (offlinePaths.has(track.path)) {
            playlistTracks.push(track);
            done += 1;
            updateOfflineBatchCount(done);
            updateOfflineBatchBar((done / tracks.length) * 100);
            continue;
        }
        if (!navigator.onLine) {
            showToast('Sin conexion para guardar', 'warning');
            break;
        }
        const urls = buildFileUrls(track);
        const res = await sendSwMessage({ type: 'CACHE_TRACK', urls: [urls.audioUrl, urls.coverUrl] });
        if (res && res.ok) {
            await saveOfflineTrack({
                path: track.path,
                title: track.title || 'Sin titulo',
                artist: track.artist || '',
                album: track.album || '',
                duration: track.duration || '',
                type: track.type || 'audio'
            });
            offlinePaths.add(track.path);
            offlineCount += 1;
            playlistTracks.push(track);
        }
        done += 1;
        updateOfflineBatchCount(done);
        updateOfflineBatchBar((done / tracks.length) * 100);
    }
    if (playlistTracks.length > 0) {
        await saveOfflinePlaylist({
            name: label,
            tracks: playlistTracks.map(t => ({
                path: t.path,
                title: t.title || 'Sin titulo',
                artist: t.artist || '',
                album: t.album || '',
                duration: t.duration || '',
                type: t.type || 'audio'
            })),
            updatedAt: Date.now()
        });
    }
    refreshOfflineList();
    closeOfflineBatchModal();
    if (offlineBatchCancel) {
        showToast('Descarga cancelada', 'info');
    } else {
        showToast('Playlist offline completa', 'success');
    }
}

/* ==========================================
   GESTOR DE SESIÓN (LOCAL - JWT)
   ========================================== */
const CF_SESSION_DAYS = 30;
const CF_WARNING_DAYS = 5;

function checkSessionStatus() {
    // Ya no necesitamos verificar con el servidor
    // El token JWT maneja la sesión
    renderSessionBar();
}

// 2. Función que dibuja la barrita (simplificada - JWT maneja su propia sesión)
function renderSessionBar() {
    // No mostramos nada - JWT maneja la sesión internamente
    // El auth screen de Kraken se encarga de la autenticación
}

function showBar(visible) {
    const bar = document.getElementById('session-status-bar');
    const spacer = document.getElementById('top-spacer');
    if(visible) {
        bar.classList.remove('hidden');
        spacer.style.height = bar.offsetHeight + "px";
    } else {
        bar.classList.add('hidden');
        spacer.style.height = "0px";
    }
}
