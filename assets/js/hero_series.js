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

        const heroTitle = (typeof window.getPreferredVideoTitle === 'function')
            ? window.getPreferredVideoTitle(heroItem, heroItem.name || heroItem.title || source.tmdb_title || 'Sin titulo')
            : (heroItem.name || heroItem.title || source.tmdb_title || 'Sin titulo');
        const heroTagline = (source.tmdb_tagline || '').trim();

        let tmdbData = null;
        let resumeData = null;

        if (tmdbId) {
            const [tmdbRes, progressRes] = await Promise.allSettled([
                fetchTmdbDetails(tmdbId, mediaType),
                fetchSeriesResume(tmdbId)
            ]);
            tmdbData = tmdbRes.status === 'fulfilled' ? tmdbRes.value : null;
            resumeData = progressRes.status === 'fulfilled' ? progressRes.value : null;
            if (tmdbData) syncTmdbDetailsToMemory(tmdbId, tmdbData, source);
        }

        const heroHorizontalBackdrop = source.tmdb_backdrop
            ? (source.tmdb_backdrop.startsWith('http') ? source.tmdb_backdrop : `https://image.tmdb.org/t/p/w1280${source.tmdb_backdrop}`)
            : '';

        const backdrop = tmdbData?.backdrop
            ? `<img src="${tmdbData.backdrop}" class="absolute inset-0 w-full h-full object-cover object-[center_18%] opacity-50 group-hover:opacity-65 group-hover:scale-105 transition duration-1000" onerror="this.style.display='none'">`
            : (heroHorizontalBackdrop
                ? `<img src="${heroHorizontalBackdrop}" class="absolute inset-0 w-full h-full object-cover object-[center_18%] opacity-50 group-hover:opacity-65 group-hover:scale-105 transition duration-1000" onerror="this.style.display='none'">`
                : `<img src="${heroCover}" class="absolute inset-0 w-full h-full object-cover object-[center_18%] opacity-50 group-hover:opacity-65 group-hover:scale-105 transition duration-1000" onerror="this.style.display='none'">`);

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
            ? `<div class="text-[10px] text-zinc-400 mt-1">${isMovie ? 'Director' : 'Creador'}: ${tmdbData.directors.map(d => `<button onclick="event.stopPropagation(); filterCatalogByPerson('Director', this.dataset.personName)" data-person-name="${escapeHtml(d)}" class="text-emerald-400 hover:text-emerald-300 font-bold hover:underline transition">${escapeHtml(d)}</button>`).join(', ')}</div>`
            : '';
        const castHtml = opts.showCastInHero ? buildCastCarousel(tmdbData?.cast || []) : '';

        const actionBtn = buildActionButton(heroItem, isMovie, resumeData);
        const trailerBtn = tmdbData?.trailer_key ? `
            <button onclick="event.stopPropagation(); openTrailerModal('${escapeStr(tmdbData.trailer_key)}', '${escapeStr(heroTitle)}')"
                    class="bg-red-600/90 hover:bg-red-500 text-white font-extrabold text-xs md:text-sm py-2.5 md:py-3 px-5 md:px-7 rounded-full shadow-lg hover:scale-105 transition flex items-center justify-center gap-2 border border-red-400/30">
                <i class="fa-brands fa-youtube text-base"></i> Ver Tráiler
            </button>
        ` : '';
        const showInfoButton = opts.showInfoButton !== false;
        const showFullInfo = !!opts.fullInfo;
        const infoButton = showInfoButton && !showFullInfo ? buildInfoButton(heroItem, tmdbData, resumeData, isMovie) : '';
        const infoBanner = showFullInfo ? '' : buildInfoBanner(heroTagline ? `“${heroTagline}” — ${overviewText}` : overviewText);
        const fullInfoBlock = showFullInfo
            ? `<div class="mt-3 text-zinc-200 text-sm md:text-base leading-relaxed">${escapeHtml(tmdbData?.overview || 'Sin descripcion disponible.')}</div>`
            : '';
        const castGridHtml = showFullInfo ? buildFullCastGrid(tmdbData?.cast || []) : '';
        const similarsGridHtml = showFullInfo ? buildSimilarsHtml(heroItem) : '';

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
                            ${trailerBtn}
                            ${infoButton}
                            ${!isMovie ? `
                                <button onclick="event.stopPropagation(); playShuffleSeries(this.dataset.seriesPath);" data-series-path="${escapeHtml(heroItem.path)}" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs md:text-sm py-2.5 md:py-3 px-6 md:px-8 rounded-full shadow-lg hover:scale-105 transition flex items-center justify-center gap-2 border border-emerald-400/30">
                                    <i class="fa-solid fa-shuffle"></i> Aleatorio
                                </button>
                                <button onclick="event.stopPropagation(); openFolderPath(this.dataset.seriesPath);" data-series-path="${escapeHtml(heroItem.path)}" class="bg-white/10 hover:bg-white/20 backdrop-blur text-white font-bold text-xs md:text-sm py-2.5 md:py-3 px-6 md:px-8 rounded-full shadow-lg hover:scale-105 transition flex items-center justify-center gap-2 border border-white/10">
                                    <i class="fa-solid fa-list"></i> Episodios
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
                ${castGridHtml}
                ${similarsGridHtml}
                ${infoBanner}
            </div>`;
    };

    function buildInfoButton(heroItem, tmdbData, resumeData, isMovie) {
        if (!tmdbData) return '';
        const infoKey = `hero_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        _heroInfoStore[infoKey] = { heroItem, tmdbData, resumeData, isMovie };
        return `<button onclick="event.stopPropagation(); openHeroInfoModal(this.dataset.infoKey)" data-info-key="${escapeHtml(infoKey)}" class="bg-gradient-to-r from-emerald-500/25 via-cyan-500/15 to-emerald-500/25 hover:from-emerald-400/40 hover:to-cyan-400/30 text-emerald-100 hover:text-white font-extrabold text-sm md:text-base py-2.5 md:py-3 px-7 md:px-10 rounded-full shadow-[0_0_0_rgba(16,185,129,0)] hover:shadow-[0_0_24px_rgba(16,185,129,0.28)] hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 border border-emerald-300/35">
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
            <div class="flex flex-col items-center gap-1 shrink-0 group/actor cursor-pointer"
                 data-actor-name="${escapeHtml(c.name)}"
                 onclick="event.stopPropagation(); filterCatalogByPerson('Actor', this.dataset.actorName);"
                 title="Ver películas de ${escapeHtml(c.name)}">
                <div class="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-white/10 group-hover/actor:border-emerald-400 transition shadow-lg">
                    <img src="${c.photo}" class="w-full h-full object-cover" loading="lazy" onerror="this.parentElement.style.display='none'">
                </div>
                <span class="text-[9px] md:text-[10px] text-zinc-400 group-hover/actor:text-emerald-400 text-center leading-tight max-w-[60px] truncate transition">${escapeHtml(c.name)}</span>
            </div>
        `).join('');

        return `<div class="flex gap-3 mt-2 mb-1 overflow-x-auto no-scrollbar pb-1">${items}</div>`;
    }

function buildFullCastGrid(cast) {
  if (!cast || cast.length === 0) return '';
  const cards = cast.slice(0, 12).map(c => `
    <div class="flex items-center gap-2 p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/5 hover:border-emerald-500/40 cursor-pointer transition"
         data-actor-name="${escapeHtml(c.name)}"
         onclick="event.stopPropagation(); filterCatalogByPerson('Actor', this.dataset.actorName);"
         title="Ver títulos de ${escapeHtml(c.name)}">
      ${c.photo ? `<img src="${c.photo}" class="w-8 h-8 rounded-full object-cover" onerror="this.style.display='none'">` : '<div class="w-8 h-8 rounded-full bg-white/10"></div>'}
      <div class="min-w-0">
        <div class="text-xs text-white group-hover:text-emerald-300 truncate">${escapeHtml(c.name || '')}</div>
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
                return `<button onclick="event.stopPropagation(); playNow(this.dataset.path)" data-path="${escapeHtml(heroItem.path)}" class="bg-white hover:bg-emerald-50 text-black font-extrabold text-sm md:text-base py-2.5 md:py-3 px-7 md:px-10 rounded-full shadow-xl hover:scale-105 transition flex items-center justify-center gap-2">
                    <i class="fa-solid fa-play"></i> Reproducir
                </button>`;
            }

            return `<button onclick="event.stopPropagation(); playNow(this.dataset.path)" data-path="${escapeHtml(epPath)}" class="bg-white hover:bg-emerald-50 text-black font-extrabold text-sm md:text-base py-2.5 md:py-3 px-7 md:px-10 rounded-full shadow-xl hover:scale-105 transition flex items-center justify-center gap-2 relative overflow-hidden">
                <div class="absolute bottom-0 left-0 h-[3px] bg-emerald-500 transition-all" style="width:${progressPct}%"></div>
                <i class="fa-solid fa-play"></i> ${isMovie ? 'Continuar' : 'Continuar ' + escapeHtml(label)}
                ${(!isMovie && resumeData.watched_count > 0) ? `<span class="text-[10px] opacity-60 ml-1">(${resumeData.watched_count}/${resumeData.total_episodes})</span>` : ''}
            </button>`;
        }

        if (isMovie) {
            return `<button onclick="event.stopPropagation(); playNow(this.dataset.path)" data-path="${escapeHtml(heroItem.path)}" class="bg-white hover:bg-emerald-50 text-black font-extrabold text-sm md:text-base py-2.5 md:py-3 px-7 md:px-10 rounded-full shadow-xl hover:scale-105 transition flex items-center justify-center gap-2">
                <i class="fa-solid fa-play"></i> Reproducir
            </button>`;
        }

        return `<button onclick="event.stopPropagation(); openFolderPath(this.dataset.seriesPath);" data-series-path="${escapeHtml(heroItem.path)}" class="bg-white hover:bg-emerald-50 text-black font-extrabold text-sm md:text-base py-2.5 md:py-3 px-7 md:px-10 rounded-full shadow-xl hover:scale-105 transition flex items-center justify-center gap-2">
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
                const hlsOffset = Number(artPlayerInstance._hlsTimeOffset || 0);
                const rawCurrent = Number(artPlayerInstance.currentTime || 0);
                const current = hlsOffset + rawCurrent;
                const knownDuration = Math.max(
                    Number(window.currentVideoData?.duration || 0),
                    Number(window.currentVideoFile?.duration || 0),
                    hlsOffset + Number(artPlayerInstance.duration || 0)
                );
                if (rawCurrent > 0 && current > 0 && knownDuration > 0) {
                    if (window.currentVideoFile && window.currentVideoFile.id === mediaId) {
                        window.currentVideoFile.progress_seconds = current;
                        window.currentVideoFile.duration_seconds = knownDuration;
                    }
                    fetch('/api/progress', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            media_id: mediaId,
                            progress_seconds: current,
                            duration_seconds: knownDuration
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
        const key = (typeof infoKey === 'string') ? infoKey : (infoKey?.dataset?.infoKey || '');
        const info = _heroInfoStore[key];
        if (!info) return;

        const { heroItem, tmdbData, resumeData, isMovie } = info;
        const title = heroItem?.name || heroItem?.title || tmdbData?.title || 'Sin titulo';
        const source = heroItem?.sample || heroItem || {};
        const modalHeroHorizontal = source.tmdb_backdrop
            ? (source.tmdb_backdrop.startsWith('http') ? source.tmdb_backdrop : `https://image.tmdb.org/t/p/w1280${source.tmdb_backdrop}`)
            : '';
        const backdrop = (tmdbData?.backdrop || modalHeroHorizontal)
            ? `<img src="${tmdbData?.backdrop || modalHeroHorizontal}" class="absolute inset-0 w-full h-full object-cover object-[center_18%] opacity-35" onerror="this.style.display='none'">`
            : '';
        const genres = (tmdbData?.genres || []).map(g =>
            `<span class="px-2 py-0.5 rounded-full text-[10px] bg-white/10 border border-white/10">${escapeHtml(g)}</span>`
        ).join('');
        const cast = (tmdbData?.cast || []).slice(0, 12).map(c => `
            <div class="flex items-center gap-2 p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/5 hover:border-emerald-500/40 cursor-pointer transition"
                 data-actor-name="${escapeHtml(c.name)}"
                 onclick="event.stopPropagation(); filterCatalogByPerson('Actor', this.dataset.actorName);"
                 title="Ver películas de ${escapeHtml(c.name)}">
                ${c.photo ? `<img src="${c.photo}" class="w-8 h-8 rounded-full object-cover" onerror="this.style.display='none'">` : '<div class="w-8 h-8 rounded-full bg-white/10"></div>'}
                <div class="min-w-0">
                    <div class="text-xs text-white truncate">${escapeHtml(c.name || '')}</div>
                    <div class="text-[10px] text-zinc-400 truncate">${escapeHtml(c.character || '')}</div>
                </div>
            </div>
        `).join('');

        const actionBtn = buildActionButton(heroItem, isMovie, resumeData);
        const modalTrailerBtn = tmdbData?.trailer_key ? `
            <button onclick="event.stopPropagation(); openTrailerModal('${escapeStr(tmdbData.trailer_key)}', '${escapeStr(title)}')"
                    class="px-5 py-2.5 rounded-full bg-red-600/90 hover:bg-red-500 text-white font-extrabold text-xs md:text-sm flex items-center gap-2 shadow-xl hover:scale-105 transition border border-red-400/30">
                <i class="fa-brands fa-youtube text-base"></i> Ver Tráiler
            </button>
        ` : '';
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
                    ${(source.tmdb_title_original && source.tmdb_title_original.toLowerCase() !== String(title || '').toLowerCase()) ? `<div class="text-xs text-zinc-400 mt-1">Título original: <span class="text-zinc-200 font-semibold">${escapeHtml(source.tmdb_title_original)}</span></div>` : ''}
                    ${source.tmdb_tagline ? `<div class="text-xs md:text-sm italic text-emerald-300/90 mt-2">“${escapeHtml(source.tmdb_tagline)}”</div>` : ''}
                    <div class="flex flex-wrap items-center gap-2 text-xs text-zinc-300 mt-3">
                        ${tmdbData?.year ? `<span>${escapeHtml(tmdbData.year)}</span>` : ''}
                        ${tmdbData?.vote_average ? `<span class="text-yellow-400"><i class="fa-solid fa-star mr-1"></i>${tmdbData.vote_average}</span>` : ''}
                        ${tmdbData?.seasons ? `<span>${tmdbData.seasons} Temp.</span>` : ''}
                        ${tmdbData?.episodes ? `<span>${tmdbData.episodes} Episodios</span>` : ''}
                    </div>
                    <div class="flex flex-wrap gap-1.5 mt-3">${genres}</div>
                    <p class="text-sm md:text-base text-zinc-200 mt-4 leading-relaxed">${escapeHtml(tmdbData?.overview || 'Sin descripcion disponible.')}</p>
                    ${(tmdbData?.directors || []).length ? `<div class="mt-3 text-xs text-zinc-400">${isMovie ? 'Director' : 'Creador'}: ${tmdbData.directors.map(d => `<button onclick="event.stopPropagation(); filterCatalogByPerson('Director', this.dataset.personName)" data-person-name="${escapeHtml(d)}" class="text-emerald-400 hover:text-emerald-300 font-bold hover:underline transition">${escapeHtml(d)}</button>`).join(', ')}</div>` : ''}
${(tmdbData?.studios || []).length ? `<div class="mt-1 text-xs text-zinc-400">Estudio / Cadena: ${tmdbData.studios.map(s => `<button onclick="event.stopPropagation(); filterCatalogByPerson('Estudio', this.dataset.personName)" data-person-name="${escapeHtml(s)}" class="text-cyan-400 hover:text-cyan-300 font-bold hover:underline transition">${escapeHtml(s)}</button>`).join(', ')}</div>` : ''}
                    <div class="flex flex-wrap gap-2 mt-5">${actionBtn}${modalTrailerBtn}</div>
                </div>
            </div>
            ${cast ? `<div class="mt-4">
                <div class="text-xs uppercase tracking-[0.16em] text-zinc-400 font-bold mb-2">Reparto</div>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">${cast}</div>
            </div>` : ''}
            ${buildSimilarsHtml(heroItem)}
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
        syncTmdbDetailsToMemory(tmdbId, tmdbData, source);

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

    /**
     * playShuffleSeries - Gathers all video files under a path, shuffles them,
     * and starts playback of a random selection.
     */
    window.playShuffleSeries = function (path) {
        const rawPath = (typeof path === 'string') ? path : (path?.dataset?.seriesPath || path?.dataset?.path || '');
        if (!rawPath) return;
        if (typeof libData === 'undefined' || !libData.files) {
            console.error('[HERO] libData not available');
            return;
        }

        const normalizedPath = rawPath.replace(/\\/g, '/').replace(/\/$/, '');
        
        // Find all videos in this folder or subfolders (entire show)
        const episodes = libData.files.filter(f => {
            if (f.type !== 'video') return false;
            const fPath = (f.path || '').replace(/\\/g, '/');
            return fPath.startsWith(normalizedPath + '/') || fPath === normalizedPath;
        });

        if (episodes.length === 0) {
            if (typeof showToast === 'function') showToast("No hay episodios para barajar", "warning");
            return;
        }

        // Fisher-Yates Shuffle
        const shuffled = [...episodes];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // Limit to 20 for a reasonable session
        const queueLimit = 20;
        const playQueueReady = shuffled.slice(0, queueLimit);

        if (typeof playVideoMode === 'function') {
            playerQueue = playQueueReady;
            currentTrackIndex = 0;
            playVideoMode(playQueueReady[0]);
            if (typeof showToast === 'function') {
                showToast(`🔀 Modo Aleatorio: Reproduciendo ${playQueueReady.length} episodios de la serie`, "success");
            }
        } else {
            console.error('[HERO] playVideoMode not found');
        }
    };


    // ============================================================
    // PERSON FILTER & SIMILAR TITLES & SAGA COLLECTIONS (v5.0.2)
    // ============================================================

    function syncTmdbDetailsToMemory(tmdbId, tmdbData, refSource) {
        if (!tmdbData) return;
        const dirStr = Array.isArray(tmdbData.directors) ? tmdbData.directors.join(', ') : '';
        const castStr = Array.isArray(tmdbData.cast) ? tmdbData.cast.map(c => c.name).filter(Boolean).join(', ') : '';
        const studioStr = Array.isArray(tmdbData.studios) ? tmdbData.studios.join(', ') : '';
        const kwStr = Array.isArray(tmdbData.keywords) ? tmdbData.keywords.join(', ') : '';
        const genreStr = Array.isArray(tmdbData.genres) ? tmdbData.genres.join(', ') : '';
        const yearStr = tmdbData.year ? String(tmdbData.year) : '';
        const backdropStr = tmdbData.backdrop || '';
        const collName = tmdbData.collection?.name || '';
        const collId = tmdbData.collection?.id || null;
        const voteAvg = Number(tmdbData.vote_average || 0);

        if (Array.isArray(tmdbData.cast)) {
            window._personPhotoCache = window._personPhotoCache || {};
            tmdbData.cast.forEach(c => {
                if (c && c.name && c.photo) window._personPhotoCache[c.name] = c.photo;
            });
        }

        const applyToObj = (obj) => {
            if (!obj) return;
            if (dirStr && !obj.tmdb_director) obj.tmdb_director = dirStr;
            if (castStr && !obj.tmdb_cast) obj.tmdb_cast = castStr;
            if (studioStr && !obj.tmdb_studio) obj.tmdb_studio = studioStr;
            if (kwStr && !obj.tmdb_keywords) obj.tmdb_keywords = kwStr;
            if (genreStr && !obj.genre) obj.genre = genreStr;
            if (genreStr && !obj.tmdb_genres) obj.tmdb_genres = genreStr;
            if (yearStr && !obj.tmdb_year) obj.tmdb_year = yearStr;
            if (backdropStr && !obj.tmdb_backdrop) obj.tmdb_backdrop = backdropStr;
            if (collName && !obj.tmdb_collection_name) obj.tmdb_collection_name = collName;
            if (collId && !obj.tmdb_collection_id) obj.tmdb_collection_id = collId;
            if (voteAvg > 0 && !obj.tmdb_vote_average) obj.tmdb_vote_average = voteAvg;
            if (typeof normalizeText === 'function' && obj.searchKey) {
                const extra = normalizeText(`${dirStr} ${castStr} ${studioStr} ${collName} ${kwStr}`);
                if (extra && !obj.searchKey.includes(extra)) {
                    obj.searchKey = `${obj.searchKey} ${extra}`.trim();
                }
            }
        };

        applyToObj(refSource);
        if (typeof libData !== 'undefined' && Array.isArray(libData.files)) {
            libData.files.forEach(f => {
                if (f.type === 'video' && Number(f.tmdb_id) === Number(tmdbId)) {
                    applyToObj(f);
                }
            });
        }
    }

    window.filterCatalogByPerson = function (role, name) {
        if (!name) return;
        const cleanName = String(name).trim();
        window.closeHeroInfoModal?.();
        window.closeInlineVideoInfo?.();
        window.closeCollectionModal?.();

        // Salir de cualquier vista de detalle (carpeta de película o serie) para volver al catálogo raíz
        if (typeof currentPath !== 'undefined') currentPath = '';
        if (typeof window.currentPath !== 'undefined') window.currentPath = '';
        if (typeof currentFolderView !== 'undefined') currentFolderView = null;
        if (typeof window.currentFolderView !== 'undefined') window.currentFolderView = null;
        if (typeof currentView !== 'undefined' && currentView === 'folders') currentView = 'library';
        if (window.netflixActiveCategory === '📚 Colecciones') {
            window.netflixActiveCategory = 'Todo';
        }

        // Limpiar búsqueda de texto para que no interfiera con el filtro de persona
        const mobileInput = document.getElementById('lib-search-mobile');
        const desktopInput = document.getElementById('lib-search-desktop');
        if (mobileInput) mobileInput.value = '';
        if (desktopInput) desktopInput.value = '';

        window.netflixActivePersonFilter = { role: role || 'Persona', name: cleanName };
        window.netflixGridRenderLimit = 84;
        if (typeof showToast === 'function') {
            showToast(`🎬 Filtrando por ${role || 'Persona'}: ${cleanName}`, 'info');
        }
        if (typeof renderLib === 'function') {
            renderLib();
            setTimeout(() => {
                const mainScroll = document.getElementById('main-scroll');
                if (mainScroll) mainScroll.scrollTo({ top: 0, behavior: 'smooth' });
                const grid = document.getElementById('netflix-catalog-grid') || document.getElementById('lib-container');
                if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 280);
        }
    };

    window.clearPersonFilter = function () {
        window.netflixActivePersonFilter = null;
        if (typeof renderLib === 'function') renderLib();
    };

    function buildSimilarsHtml(heroItem) {
        if (!heroItem || typeof window.getSimilarLibraryItems !== 'function') return '';
        const similars = window.getSimilarLibraryItems(heroItem, 10);
        if (!similars || similars.length === 0) return '';

        const cards = similars.map(sim => {
            const simCover = sim.tmdb_poster
                ? (sim.tmdb_poster.startsWith('http') || sim.tmdb_poster.startsWith('/caratula/') ? sim.tmdb_poster : `/caratula/${encodeURIComponent(sim.tmdb_poster)}`)
                : `/caratula/${(sim.path || '').split('/').map(p => encodeURIComponent(p)).join('/')}`;
            const simTitle = sim._displayTitle || sim.tmdb_title || sim.clean_title || sim.title || 'Video';
            const simYear = sim.tmdb_year ? `<span>${escapeHtml(sim.tmdb_year)}</span>` : '';
            const simVote = sim.tmdb_vote_average ? `<span class="text-amber-400 font-bold"><i class="fa-solid fa-star text-[9px] mr-0.5"></i>${sim.tmdb_vote_average}</span>` : '';
            const simReason = sim._simReason ? `<div class="text-[9px] text-emerald-400 truncate mt-0.5">${escapeHtml(sim._simReason)}</div>` : '';
            const normSimPath = (sim.path || '').replace(/\\/g, '/');
            const simParts = normSimPath.split('/').filter(Boolean);
            const hasMovieFolder = (!sim._isSeries && sim.folder_type === 'movie' && simParts.length > 3);
            const detailFolderPath = sim._isSeries
                ? (sim._seriesPath || sim.path)
                : (hasMovieFolder ? (simParts.slice(0, 3).join('/') + '/') : '');
            const clickAction = detailFolderPath
                ? `openFolderPath(this.dataset.detailPath)`
                : `playNow(this.dataset.path)`;

            return `
            <div class="flex-none w-[130px] md:w-[155px] bg-white/[0.03] border border-white/5 rounded-xl p-2 hover:bg-white/[0.08] hover:border-emerald-500/40 transition cursor-pointer group/sim"
                 data-path="${escapeHtml(sim.path)}"
                 data-detail-path="${escapeHtml(detailFolderPath)}"
                 onclick="event.stopPropagation(); closeHeroInfoModal(); closeInlineVideoInfo(); ${clickAction};">
                <div class="relative w-full aspect-[2/3] rounded-lg overflow-hidden mb-1.5 bg-black/50">
                    <img src="${simCover}" loading="lazy" class="w-full h-full object-cover group-hover/sim:scale-105 transition duration-300" onerror="this.style.display='none'">
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover/sim:opacity-100 transition flex items-center justify-center">
                        <button onclick="event.stopPropagation(); closeHeroInfoModal(); closeInlineVideoInfo(); playNow('${escapeStr(sim.path)}');"
                            title="Reproducir ahora"
                            class="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center shadow-lg hover:scale-110 transition">
                            <i class="fa-solid fa-play text-xs"></i>
                        </button>
                    </div>
                </div>
                <div class="text-xs font-bold text-white truncate">${escapeHtml(simTitle)}</div>
                <div class="flex items-center justify-between text-[10px] text-zinc-400 mt-0.5">
                    ${simYear}
                    ${simVote}
                </div>
                ${simReason}
            </div>`;
        }).join('');

        return `
        <div class="mt-6 pt-4 border-t border-white/10">
            <div class="flex items-center gap-2 mb-3">
                <i class="fa-solid fa-wand-magic-sparkles text-emerald-400 text-sm"></i>
                <h4 class="text-xs md:text-sm uppercase tracking-[0.16em] text-white font-bold">Más títulos similares en tu biblioteca</h4>
            </div>
            <div class="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                ${cards}
            </div>
        </div>`;
    }

    // Modal para Ver y Maratonear Colecciones / Sagas
    window.openCollectionModal = function (collectionKey) {
        const store = window._collectionsStore || {};
        const coll = store[collectionKey];
        if (!coll) {
            console.warn('[COLLECTION] No encontrada:', collectionKey);
            return;
        }

        const movies = coll.items || [];
        const collTitle = coll.name || 'Colección';
        const sample = coll.sample || movies[0] || {};
        const backdrop = sample.tmdb_backdrop
            ? (sample.tmdb_backdrop.startsWith('http') ? sample.tmdb_backdrop : `https://image.tmdb.org/t/p/w1280${sample.tmdb_backdrop}`)
            : (coll.poster ? (coll.poster.startsWith('http') ? coll.poster : `/caratula/${encodeURIComponent(coll.poster)}`) : '');

        const movieCards = movies.map((m, idx) => {
            const mCover = m.tmdb_poster ? (m.tmdb_poster.startsWith('http') || m.tmdb_poster.startsWith('/caratula/') ? m.tmdb_poster : `/caratula/${encodeURIComponent(m.tmdb_poster)}`) : `/caratula/${(m.path || '').split('/').map(p => encodeURIComponent(p)).join('/')}`;
            const mTitle = (window.getPreferredVideoTitle ? window.getPreferredVideoTitle(m, m.clean_title || m.title) : (m.tmdb_title || m.clean_title || m.title)) || `Película ${idx + 1}`;
            const mYear = m.tmdb_year ? `<span>${escapeHtml(m.tmdb_year)}</span>` : '';
            const mDur = m.duration || (m.duration_sec ? `${Math.round(m.duration_sec / 60)} min` : '');
            const mScore = m.tmdb_vote_average ? `<span class="text-amber-400 font-bold"><i class="fa-solid fa-star text-[9px] mr-0.5"></i>${m.tmdb_vote_average}</span>` : '';
            const mOverview = m.tmdb_overview ? `<p class="text-xs text-zinc-400 line-clamp-2 mt-1">${escapeHtml(m.tmdb_overview)}</p>` : '';
            const prog = Number(m.progress_seconds || 0);
            const dur = Number(m.duration_seconds || m.duration_sec || 0);
            const pct = dur > 0 ? Math.min(100, Math.round((prog / dur) * 100)) : 0;

            return `
            <div class="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-emerald-500/30 transition cursor-pointer group"
                 data-path="${escapeHtml(m.path)}"
                 onclick="event.stopPropagation(); closeCollectionModal(); playNow(this.dataset.path);">
                <div class="text-lg md:text-xl font-black text-zinc-600 group-hover:text-amber-400 w-6 text-center shrink-0 transition">#${idx + 1}</div>
                <div class="relative w-16 md:w-20 aspect-[2/3] rounded-lg overflow-hidden shrink-0 bg-black/60 shadow-md">
                    <img src="${mCover}" class="w-full h-full object-cover group-hover:scale-105 transition" onerror="this.style.display='none'">
                    ${pct > 0 ? `<div class="absolute bottom-0 inset-x-0 h-1 bg-zinc-800"><div class="h-full bg-emerald-500" style="width:${pct}%"></div></div>` : ''}
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="text-sm md:text-base font-bold text-white group-hover:text-emerald-300 transition truncate">${escapeHtml(mTitle)}</h4>
                    <div class="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                        ${mYear}
                        ${mDur ? `<span>·</span><span>${mDur}</span>` : ''}
                        ${mScore ? `<span>·</span>${mScore}` : ''}
                    </div>
                    ${mOverview}
                </div>
                <button class="w-10 h-10 rounded-full bg-white/10 group-hover:bg-emerald-500 group-hover:text-black text-white flex items-center justify-center shrink-0 transition shadow-lg">
                    <i class="fa-solid fa-play ml-0.5 text-sm"></i>
                </button>
            </div>`;
        }).join('');

        const modalHtml = `
        <div id="collection-modal" class="fixed inset-0 z-[1300] p-3 md:p-8 flex items-center justify-center">
            <div class="absolute inset-0 bg-black/85 backdrop-blur-md" onclick="closeCollectionModal()"></div>
            <div class="relative z-10 w-full max-w-4xl max-h-[92vh] overflow-y-auto no-scrollbar bg-[#111215] border border-white/10 rounded-3xl shadow-2xl flex flex-col">
                <div class="relative w-full h-[220px] md:h-[300px] shrink-0 overflow-hidden rounded-t-3xl">
                    ${backdrop ? `<img src="${backdrop}" class="absolute inset-0 w-full h-full object-cover opacity-40">` : ''}
                    <div class="absolute inset-0 bg-gradient-to-t from-[#111215] via-[#111215]/60 to-transparent"></div>
                    <div class="absolute top-4 right-4 z-20">
                        <button onclick="closeCollectionModal()" class="w-10 h-10 rounded-full bg-black/50 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center transition">
                            <i class="fa-solid fa-xmark text-lg"></i>
                        </button>
                    </div>
                    <div class="absolute bottom-6 left-6 md:left-8 right-6 z-10">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="px-2.5 py-0.5 rounded-full bg-amber-500/90 text-black font-black text-[10px] uppercase tracking-wider">📚 Franquicia Oficial</span>
                            <span class="text-xs text-zinc-300 font-bold">${movies.length} Películas ${coll.yearRange ? `(${coll.yearRange})` : ''}</span>
                        </div>
                        <h2 class="text-2xl md:text-4xl font-black text-white drop-shadow-lg mb-4">${escapeHtml(collTitle)}</h2>
                        <div class="flex flex-wrap gap-3">
                            <button onclick="event.stopPropagation(); playCollectionMarathon('${escapeStr(collectionKey)}')"
                                    class="px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs md:text-sm flex items-center gap-2 shadow-xl hover:scale-105 transition">
                                <i class="fa-solid fa-play"></i> Reproducir Maratón en Orden
                            </button>
                        </div>
                    </div>
                </div>
                <div class="p-6 md:p-8 flex flex-col gap-3">
                    <h3 class="text-xs uppercase tracking-[0.18em] text-zinc-400 font-bold mb-1">Películas de la Saga en Orden Cronológico</h3>
                    ${movieCards}
                </div>
            </div>
        </div>`;

        let existing = document.getElementById('collection-modal');
        if (existing) existing.remove();
        const wrapper = document.createElement('div');
        wrapper.innerHTML = modalHtml;
        document.body.appendChild(wrapper.firstElementChild);
        document.body.classList.add('overflow-hidden');
    };

    window.closeCollectionModal = function () {
        const modal = document.getElementById('collection-modal');
        if (modal) modal.remove();
        document.body.classList.remove('overflow-hidden');
    };

    window.playCollectionMarathon = function (collectionKey) {
        const store = window._collectionsStore || {};
        const coll = store[collectionKey];
        if (!coll || !coll.items || coll.items.length === 0) return;
        closeCollectionModal();
        playerQueue = [...coll.items];
        currentTrackIndex = 0;
        if (typeof showToast === 'function') {
            showToast(`🎬 Iniciando Maratón: ${coll.name} (${playerQueue.length} películas)`, 'success');
        }
        if (typeof playVideoMode === 'function') {
            playVideoMode(playerQueue[0]);
        }
    };


    // =========================================================================
    // MODAL DE TRÁILER OFICIAL YOUTUBE (TMDb)
    // =========================================================================
    window.openTrailerModal = function (trailerKey, title) {
        if (!trailerKey) return;
        let modal = document.getElementById('krk-trailer-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'krk-trailer-modal';
            modal.className = 'fixed inset-0 z-[1500] p-4 md:p-8 flex items-center justify-center';
            document.body.appendChild(modal);
        }
        modal.innerHTML = `
            <div class="absolute inset-0 bg-black/90 backdrop-blur-md" onclick="closeTrailerModal()"></div>
            <div class="relative z-10 w-full max-w-4xl bg-[#111215] border border-white/10 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col">
                <div class="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#16181d]">
                    <div class="flex items-center gap-2.5 text-white font-bold text-sm md:text-base truncate">
                        <i class="fa-brands fa-youtube text-red-500 text-xl"></i>
                        <span class="truncate">Tráiler Oficial: ${escapeHtml(title || 'Video')}</span>
                    </div>
                    <button onclick="closeTrailerModal()" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition">
                        <i class="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>
                <div class="relative w-full aspect-video bg-black">
                    <iframe id="krk-trailer-iframe"
                            class="w-full h-full"
                            src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailerKey)}?autoplay=1&rel=0&modestbranding=1"
                            title="YouTube video player"
                            frameborder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowfullscreen></iframe>
                </div>
            </div>
        `;
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    };

    window.closeTrailerModal = function () {
        const modal = document.getElementById('krk-trailer-modal');
        if (!modal) return;
        const iframe = document.getElementById('krk-trailer-iframe');
        if (iframe) iframe.src = '';
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    };

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            const trModal = document.getElementById('krk-trailer-modal');
            if (trModal && !trModal.classList.contains('hidden')) {
                closeTrailerModal();
            }
        }
    });
})();
