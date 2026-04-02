/**
 * hero_series.js - Modular Hero Component for Kraken Media Server
 *
 * Renders a premium Netflix/Plex-style hero banner for series,
 * with live-fetched TMDB cast, synopsis, and "Continue Watching" logic.
 *
 * Dependencies (globals from index.html):
 *   - escapeStr(), escapeHtml()
 *   - playNow(), renderLib(), currentPath
 */

(function () {
    'use strict';

    // Cache to avoid re-fetching the same IDs in a session
    const _tmdbCache = {};
    const _progressCache = {};
    const _heroInfoStore = {};
    let _modalEscHandlerBound = false;
    let _inlineInfoHostId = 'video-info-inline-host';

    // PUBLIC: Called from index.html
    window.renderSeriesHero = async function (heroItem, netflixActiveCategory, opts) {
        if (!heroItem) return '';
        opts = opts || {};

        const source = heroItem.sample || heroItem;
        const tmdbId = source.tmdb_id || heroItem.tmdb_id;
        const folderType = source.folder_type || heroItem.folder_type;
        const isMovie = folderType === 'movie';
        const mediaType = isMovie ? 'movie' : 'tv';

        const heroCover = source.tmdb_poster
            ? `/caratula/${encodeURIComponent(source.tmdb_poster)}`
            : `/caratula/${(source.path || source._normalizedPath || '').split('/').map(p => encodeURIComponent(p)).join('/')}`;

        const heroTitle = heroItem.name || heroItem.title || source.tmdb_title || 'Sin titulo';

        let tmdbData = null;
        let resumeData = null;

        if (tmdbId) {
            const [tmdbRes, progressRes] = await Promise.allSettled([
                fetchTmdbDetails(tmdbId, mediaType),
                fetchSeriesResume(tmdbId)
            ]);
            tmdbData = tmdbRes.status === 'fulfilled' ? tmdbRes.value : null;
            resumeData = progressRes.status === 'fulfilled' ? progressRes.value : null;
        }

        const backdrop = tmdbData?.backdrop
            ? `<img src="${tmdbData.backdrop}" class="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-65 group-hover:scale-105 transition duration-1000" onerror="this.style.display='none'">`
            : `<img src="${heroCover}" class="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-65 group-hover:scale-105 transition duration-1000" onerror="this.style.display='none'">`;

        const overviewText = tmdbData?.overview || '';
        const genresHtml = (tmdbData?.genres || []).slice(0, 4).map(g =>
            `<span class="bg-white/10 backdrop-blur-sm text-white/80 text-[10px] md:text-xs px-2.5 py-0.5 rounded-full border border-white/10">${escapeHtml(g)}</span>`
        ).join('');

        const year = tmdbData?.year || '';
        const vote = tmdbData?.vote_average ? `<span class="flex items-center gap-1"><i class="fa-solid fa-star text-yellow-400 text-[10px]"></i> ${tmdbData.vote_average}</span>` : '';
        const seasonInfo = tmdbData?.seasons ? `<span>${tmdbData.seasons} Temp.</span>` : '';
        const metaHtml = [year, vote, seasonInfo].filter(Boolean).map(m =>
            `<span class="text-zinc-400 text-xs md:text-sm">${m}</span>`
        ).join('<span class="text-zinc-600">·</span>');

        const directorsHtml = tmdbData?.directors?.length
            ? `<div class="text-[10px] text-zinc-500 mt-1">${isMovie ? 'Director' : 'Creador'}: ${tmdbData.directors.map(d => escapeHtml(d)).join(', ')}</div>`
            : '';
        const castHtml = opts.showCastInHero ? buildCastCarousel(tmdbData?.cast || []) : '';

        const actionBtn = buildActionButton(heroItem, isMovie, resumeData);
        const showInfoButton = opts.showInfoButton !== false;
        const showFullInfo = !!opts.fullInfo;
        const infoButton = showInfoButton && !showFullInfo ? buildInfoButton(heroItem, tmdbData, resumeData, isMovie) : '';
        const infoBanner = showFullInfo ? '' : buildInfoBanner(overviewText);
        const fullInfoBlock = showFullInfo
            ? `<div class="mt-3 text-zinc-200 text-sm md:text-base leading-relaxed">${escapeHtml(tmdbData?.overview || 'Sin descripcion disponible.')}</div>`
            : '';
        const castGridHtml = showFullInfo ? buildFullCastGrid(tmdbData?.cast || []) : '';

        const hasRichContent = overviewText || (tmdbData?.cast && tmdbData.cast.length > 0);
        const heroHeightClass = hasRichContent
            ? 'min-h-[280px] md:min-h-[360px]'
            : 'h-[16vh] min-h-[140px] md:h-[22vh] md:min-h-[180px]';

        return `
            <div class="w-full flex flex-col gap-3 mb-4">
                <div class="relative w-full ${heroHeightClass} rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl group border border-white/5 flex-shrink-0 transition-all duration-300">
                    ${backdrop}
                    <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent"></div>
                    <div class="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/90 via-[#0a0a0a]/40 to-transparent"></div>

                    <div class="absolute bottom-0 left-0 p-5 md:p-10 z-10 w-full md:w-full lg:w-3/4 flex flex-col justify-end">
                        <div class="flex items-center gap-2 mb-2">
                            <div class="w-1 h-3 bg-emerald-500 rounded"></div>
                            <div class="text-[10px] md:text-xs font-black text-white tracking-[0.2em] drop-shadow-md shadow-black uppercase">${escapeHtml(netflixActiveCategory)} ${isMovie ? 'PELICULA' : 'SERIE'}</div>
                        </div>
                        <h2 class="text-2xl md:text-4xl lg:text-5xl font-black text-white leading-[1.1] drop-shadow-xl shadow-black mb-2 line-clamp-2">${escapeHtml(heroTitle)}</h2>

                        <div class="flex flex-wrap items-center gap-2 mb-2">
                            ${metaHtml}
                        </div>
                        <div class="flex flex-wrap gap-1.5 mb-2">${genresHtml}</div>
                        ${directorsHtml}
                        ${castHtml}
                        ${fullInfoBlock}

                        <div class="flex flex-wrap gap-3 mt-3">
                            ${actionBtn}
                            ${infoButton}
                            ${!isMovie ? `<button onclick="event.stopPropagation(); currentPath='${escapeStr(heroItem.path)}'; renderLib();" class="bg-white/10 hover:bg-white/20 backdrop-blur text-white font-bold text-xs md:text-sm py-2.5 md:py-3 px-6 md:px-8 rounded-full shadow-lg hover:scale-105 transition flex items-center justify-center gap-2 border border-white/10">
                                <i class="fa-solid fa-list"></i> Episodios
                            </button>` : ''}
                        </div>
                    </div>
                </div>
                ${castGridHtml}
                ${infoBanner}
            </div>`;
    };

    function buildInfoButton(heroItem, tmdbData, resumeData, isMovie) {
        if (!tmdbData) return '';
        const infoKey = `hero_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        _heroInfoStore[infoKey] = { heroItem, tmdbData, resumeData, isMovie };
        return `<button onclick="event.stopPropagation(); openHeroInfoModal('${escapeStr(infoKey)}')" class="bg-gradient-to-r from-emerald-500/25 via-cyan-500/15 to-emerald-500/25 hover:from-emerald-400/40 hover:to-cyan-400/30 text-emerald-100 hover:text-white font-extrabold text-sm md:text-base py-2.5 md:py-3 px-7 md:px-10 rounded-full shadow-[0_0_0_rgba(16,185,129,0)] hover:shadow-[0_0_24px_rgba(16,185,129,0.28)] hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 border border-emerald-300/35">
            <i class="fa-solid fa-circle-info"></i> Más información
        </button>`;
    }

    function buildInfoBanner(overviewText) {
        if (!overviewText) return '';
        const shortOverview = overviewText
            ? `<p class="text-zinc-300 text-xs md:text-sm leading-relaxed line-clamp-2">${escapeHtml(overviewText)}</p>`
            : `<p class="text-zinc-500 text-xs md:text-sm">Sin descripcion ampliada para este titulo.</p>`;

        return `
            <div class="w-full rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.06] to-white/[0.02] backdrop-blur px-4 py-3 md:px-5 md:py-4 flex flex-col md:flex-row md:items-center gap-3">
                <div class="min-w-0 flex-1">
                    <div class="text-[10px] uppercase tracking-[0.18em] text-zinc-400 mb-1 font-bold">Resumen</div>
                    ${shortOverview}
                </div>
            </div>`;
    }

    function buildCastCarousel(cast) {
        if (!cast || cast.length === 0) return '';

        const items = cast.filter(c => c.photo).slice(0, 8).map(c => `
            <div class="flex flex-col items-center gap-1 shrink-0 group/actor">
                <div class="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-white/10 group-hover/actor:border-emerald-500/50 transition shadow-lg">
                    <img src="${c.photo}" class="w-full h-full object-cover" loading="lazy" onerror="this.parentElement.style.display='none'">
                </div>
                <span class="text-[9px] md:text-[10px] text-zinc-400 text-center leading-tight max-w-[60px] truncate">${escapeHtml(c.name)}</span>
            </div>
        `).join('');

        return `<div class="flex gap-3 mt-2 mb-1 overflow-x-auto no-scrollbar pb-1">${items}</div>`;
    }

    function buildFullCastGrid(cast) {
        if (!cast || cast.length === 0) return '';
        const cards = cast.slice(0, 12).map(c => `
            <div class="flex items-center gap-2 p-2 rounded-lg bg-white/[0.04] border border-white/5">
                ${c.photo ? `<img src="${c.photo}" class="w-8 h-8 rounded-full object-cover" onerror="this.style.display='none'">` : '<div class="w-8 h-8 rounded-full bg-white/10"></div>'}
                <div class="min-w-0">
                    <div class="text-xs text-white truncate">${escapeHtml(c.name || '')}</div>
                    <div class="text-[10px] text-zinc-400 truncate">${escapeHtml(c.character || '')}</div>
                </div>
            </div>
        `).join('');

        return `<div class="mt-4">
            <div class="text-xs uppercase tracking-[0.16em] text-zinc-400 font-bold mb-2">Reparto</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">${cards}</div>
        </div>`;
    }

    function buildActionButton(heroItem, isMovie, resumeData) {
        if (resumeData && resumeData.has_progress && resumeData.resume_episode) {
            const ep = resumeData.resume_episode;
            const epPath = ep.path || heroItem.path;
            const label = isMovie
                ? 'viendo'
                : (extractEpisodeLabel(epPath) || 'Continuar');
            const progressPct = ep.duration_seconds > 0
                ? Math.round((ep.progress_seconds / ep.duration_seconds) * 100)
                : 0;
            const hasRealMovieProgress = isMovie && ep.progress_seconds > 0 && !ep.is_finished;

            if (isMovie && !hasRealMovieProgress) {
                return `<button onclick="event.stopPropagation(); playNow('${escapeStr(heroItem.path)}')" class="bg-white hover:bg-emerald-50 text-black font-extrabold text-sm md:text-base py-2.5 md:py-3 px-7 md:px-10 rounded-full shadow-xl hover:scale-105 transition flex items-center justify-center gap-2">
                    <i class="fa-solid fa-play"></i> Reproducir
                </button>`;
            }

            return `<button onclick="event.stopPropagation(); playNow('${escapeStr(epPath)}')" class="bg-white hover:bg-emerald-50 text-black font-extrabold text-sm md:text-base py-2.5 md:py-3 px-7 md:px-10 rounded-full shadow-xl hover:scale-105 transition flex items-center justify-center gap-2 relative overflow-hidden">
                <div class="absolute bottom-0 left-0 h-[3px] bg-emerald-500 transition-all" style="width:${progressPct}%"></div>
                <i class="fa-solid fa-play"></i> ${isMovie ? 'Continuar' : 'Continuar ' + escapeHtml(label)}
                ${(!isMovie && resumeData.watched_count > 0) ? `<span class="text-[10px] opacity-60 ml-1">(${resumeData.watched_count}/${resumeData.total_episodes})</span>` : ''}
            </button>`;
        }

        if (isMovie) {
            return `<button onclick="event.stopPropagation(); playNow('${escapeStr(heroItem.path)}')" class="bg-white hover:bg-emerald-50 text-black font-extrabold text-sm md:text-base py-2.5 md:py-3 px-7 md:px-10 rounded-full shadow-xl hover:scale-105 transition flex items-center justify-center gap-2">
                <i class="fa-solid fa-play"></i> Reproducir
            </button>`;
        }

        return `<button onclick="event.stopPropagation(); currentPath='${escapeStr(heroItem.path)}'; renderLib();" class="bg-white hover:bg-emerald-50 text-black font-extrabold text-sm md:text-base py-2.5 md:py-3 px-7 md:px-10 rounded-full shadow-xl hover:scale-105 transition flex items-center justify-center gap-2">
            <i class="fa-solid fa-play"></i> Reproducir
        </button>`;
    }

    function extractEpisodeLabel(path) {
        if (!path) return '';
        const m1 = path.match(/[Ss](\d{1,2})\s*[Ee](\d{1,2})/);
        if (m1) return `T${parseInt(m1[1])}:E${parseInt(m1[2])}`;

        const m2 = path.match(/[Tt]emporada\s*(\d+)/i);
        const m3 = path.match(/[Ee]pisodio\s*(\d+)|[Ee]p\.?\s*(\d+)|[Cc]ap[ií]tulo\s*(\d+)/i);
        if (m2 && m3) {
            const epNum = m3[1] || m3[2] || m3[3];
            return `T${parseInt(m2[1])}:E${parseInt(epNum)}`;
        }

        const m4 = path.match(/(\d{1,2})x(\d{1,2})/);
        if (m4) return `T${parseInt(m4[1])}:E${parseInt(m4[2])}`;
        return '';
    }

    async function fetchTmdbDetails(tmdbId, mediaType) {
        const cacheKey = `${mediaType}_${tmdbId}`;
        if (_tmdbCache[cacheKey]) return _tmdbCache[cacheKey];

        try {
            const res = await fetch(`/api/tmdb/details?id=${tmdbId}&type=${mediaType}`);
            if (!res.ok) return null;
            const data = await res.json();
            if (data.ok) {
                _tmdbCache[cacheKey] = data;
                return data;
            }
        } catch (e) {
            console.warn('[HERO] TMDB fetch failed:', e);
        }
        return null;
    }

    async function fetchSeriesResume(tmdbId) {
        const cacheKey = `resume_${tmdbId}`;
        if (_progressCache[cacheKey]) return _progressCache[cacheKey];

        try {
            const res = await fetch(`/api/progress/series?tmdb_id=${tmdbId}`);
            if (!res.ok) return null;
            const data = await res.json();
            _progressCache[cacheKey] = data;
            return data;
        } catch (e) {
            console.warn('[HERO] Progress fetch failed:', e);
        }
        return null;
    }

    // PUBLIC: progress heartbeat while playing
    window._progressInterval = null;

    window.startProgressTracking = function (mediaId, artPlayerInstance) {
        stopProgressTracking();
        if (!mediaId || !artPlayerInstance) return;

        window._progressInterval = setInterval(() => {
            try {
                const current = artPlayerInstance.currentTime || 0;
                const duration = artPlayerInstance.duration || 0;
                if (current > 0 && duration > 0) {
                    fetch('/api/progress', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            media_id: mediaId,
                            progress_seconds: current,
                            duration_seconds: duration
                        })
                    }).catch(() => { });
                }
            } catch (_e) {
                // silent
            }
        }, 10000);
    };

    window.stopProgressTracking = function () {
        if (window._progressInterval) {
            clearInterval(window._progressInterval);
            window._progressInterval = null;
        }
    };

    // PUBLIC: open details panel (inline when video host exists, modal fallback otherwise)
    window.openHeroInfoModal = function (infoKey) {
        const info = _heroInfoStore[infoKey];
        if (!info) return;

        const { heroItem, tmdbData, resumeData, isMovie } = info;
        const title = heroItem?.name || heroItem?.title || tmdbData?.title || 'Sin titulo';
        const backdrop = tmdbData?.backdrop
            ? `<img src="${tmdbData.backdrop}" class="absolute inset-0 w-full h-full object-cover opacity-35" onerror="this.style.display='none'">`
            : '';
        const genres = (tmdbData?.genres || []).map(g =>
            `<span class="px-2 py-0.5 rounded-full text-[10px] bg-white/10 border border-white/10">${escapeHtml(g)}</span>`
        ).join('');
        const cast = (tmdbData?.cast || []).slice(0, 12).map(c => `
            <div class="flex items-center gap-2 p-2 rounded-lg bg-white/[0.04] border border-white/5">
                ${c.photo ? `<img src="${c.photo}" class="w-8 h-8 rounded-full object-cover" onerror="this.style.display='none'">` : '<div class="w-8 h-8 rounded-full bg-white/10"></div>'}
                <div class="min-w-0">
                    <div class="text-xs text-white truncate">${escapeHtml(c.name || '')}</div>
                    <div class="text-[10px] text-zinc-400 truncate">${escapeHtml(c.character || '')}</div>
                </div>
            </div>
        `).join('');

        const actionBtn = buildActionButton(heroItem, isMovie, resumeData);
        const contentHtml = `
            <div class="mb-3 flex items-center justify-between">
                <button onclick="closeInlineVideoInfo()" class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs md:text-sm font-bold border border-white/10 transition">
                    <i class="fa-solid fa-arrow-left"></i> Regresar
                </button>
            </div>
            <div class="relative overflow-hidden rounded-2xl border border-white/10 bg-[#101113]">
                ${backdrop}
                <div class="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b]/85 to-[#0b0b0b]/40"></div>
                <div class="relative z-10 p-5 md:p-7">
                    <div class="text-[10px] uppercase tracking-[0.2em] text-zinc-400 font-bold mb-2">${isMovie ? 'PELICULA' : 'SERIE'}</div>
                    <h3 class="text-2xl md:text-3xl font-black text-white">${escapeHtml(title)}</h3>
                    <div class="flex flex-wrap items-center gap-2 text-xs text-zinc-300 mt-3">
                        ${tmdbData?.year ? `<span>${escapeHtml(tmdbData.year)}</span>` : ''}
                        ${tmdbData?.vote_average ? `<span class="text-yellow-400"><i class="fa-solid fa-star mr-1"></i>${tmdbData.vote_average}</span>` : ''}
                        ${tmdbData?.seasons ? `<span>${tmdbData.seasons} Temp.</span>` : ''}
                        ${tmdbData?.episodes ? `<span>${tmdbData.episodes} Episodios</span>` : ''}
                    </div>
                    <div class="flex flex-wrap gap-1.5 mt-3">${genres}</div>
                    <p class="text-sm md:text-base text-zinc-200 mt-4 leading-relaxed">${escapeHtml(tmdbData?.overview || 'Sin descripcion disponible.')}</p>
                    ${(tmdbData?.directors || []).length ? `<div class="mt-3 text-xs text-zinc-400">${isMovie ? 'Director' : 'Creador'}: ${tmdbData.directors.map(d => escapeHtml(d)).join(', ')}</div>` : ''}
                    <div class="flex flex-wrap gap-2 mt-5">${actionBtn}</div>
                </div>
            </div>
            ${cast ? `<div class="mt-4">
                <div class="text-xs uppercase tracking-[0.16em] text-zinc-400 font-bold mb-2">Reparto</div>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">${cast}</div>
            </div>` : ''}
        `;

        const inlineHost = document.getElementById(_inlineInfoHostId);
        if (inlineHost) {
            inlineHost.innerHTML = contentHtml;
            inlineHost.classList.remove('hidden');
            inlineHost.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        const modalRoot = ensureHeroInfoModal();
        const body = document.getElementById('hero-info-modal-body');
        if (!body) return;
        body.innerHTML = contentHtml;
        modalRoot.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    };

    window.closeHeroInfoModal = function () {
        const modalRoot = document.getElementById('hero-info-modal');
        if (!modalRoot) return;
        modalRoot.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    };

    // PUBLIC: close inline info panel and restore base video view
    window.closeInlineVideoInfo = function () {
        const inlineHost = document.getElementById(_inlineInfoHostId);
        if (!inlineHost) return;
        inlineHost.classList.add('hidden');
        inlineHost.innerHTML = '';
    };

    // PUBLIC: open modal directly from a hero item (for series-detail view auto-open)
    window.openHeroInfoForItem = async function (heroItem) {
        if (!heroItem) return false;
        const source = heroItem.sample || heroItem;
        const tmdbId = source.tmdb_id || heroItem.tmdb_id;
        const folderType = source.folder_type || heroItem.folder_type;
        const isMovie = folderType === 'movie';
        const mediaType = isMovie ? 'movie' : 'tv';

        if (!tmdbId) return false;

        const [tmdbData, resumeData] = await Promise.all([
            fetchTmdbDetails(tmdbId, mediaType),
            !isMovie ? fetchSeriesResume(tmdbId) : Promise.resolve(null)
        ]);

        if (!tmdbData) return false;

        const infoKey = `hero_auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        _heroInfoStore[infoKey] = { heroItem, tmdbData, resumeData, isMovie };
        openHeroInfoModal(infoKey);
        return true;
    };

    // PUBLIC: assign where inline info should render
    window.setVideoInfoHost = function (hostId) {
        _inlineInfoHostId = hostId || 'video-info-inline-host';
    };

    function ensureHeroInfoModal() {
        let modalRoot = document.getElementById('hero-info-modal');
        if (modalRoot) return modalRoot;

        modalRoot = document.createElement('div');
        modalRoot.id = 'hero-info-modal';
        modalRoot.className = 'hidden fixed inset-0 z-[1200] p-3 md:p-8';
        modalRoot.innerHTML = `
            <div class="absolute inset-0 bg-black/75 backdrop-blur-sm" onclick="closeHeroInfoModal()"></div>
            <div class="relative z-10 w-full max-w-5xl mx-auto max-h-[92vh] overflow-y-auto no-scrollbar">
                <div class="flex justify-end mb-2">
                    <button onclick="closeHeroInfoModal()" class="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div id="hero-info-modal-body"></div>
            </div>
        `;
        document.body.appendChild(modalRoot);

        if (!_modalEscHandlerBound) {
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') closeHeroInfoModal();
            });
            _modalEscHandlerBound = true;
        }
        return modalRoot;
    }

    // PUBLIC: clear session caches
    window.clearHeroCache = function () {
        Object.keys(_progressCache).forEach(k => delete _progressCache[k]);
    };

})();
