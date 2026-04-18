/*!
 * Kraken custom Chromecast plugin for ArtPlayer
 * Compatible with existing `artplayerPluginChromecast({...})` usage.
 */
(function (global) {
    function guessMimeType(url) {
        const clean = String(url || '').split('?')[0].split('#')[0].toLowerCase();
        const ext = clean.split('.').pop();
        const map = {
            mp4: 'video/mp4',
            webm: 'video/webm',
            ogg: 'video/ogg',
            ogv: 'video/ogg',
            mp3: 'audio/mp3',
            wav: 'audio/wav',
            flv: 'video/x-flv',
            mov: 'video/quicktime',
            avi: 'video/x-msvideo',
            wmv: 'video/x-ms-wmv',
            mpd: 'application/dash+xml',
            m3u8: 'application/x-mpegURL',
        };
        return map[ext] || 'application/octet-stream';
    }

    function updateCastIcon(state) {
        const icon = document.querySelector('.art-icon-cast');
        if (!icon) return;
        if (state === 'connected') icon.style.color = 'red';
        else if (state === 'connecting' || state === 'disconnecting') icon.style.color = 'orange';
        else icon.style.color = 'white';
    }

    function ensureCastApi(options) {
        return new Promise((resolve, reject) => {
            function wireCastContext() {
                try {
                    const castContext = window.cast.framework.CastContext.getInstance();
                    castContext.setOptions({
                        receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
                        autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.TAB_AND_ORIGIN_SCOPED,
                    });
                    resolve(castContext);
                } catch (err) {
                    reject(err);
                }
            }

            if (window.cast && window.cast.framework && window.chrome && window.chrome.cast) {
                wireCastContext();
                return;
            }

            window.__onGCastApiAvailable = function (isAvailable) {
                if (!isAvailable) {
                    reject(new Error('Cast API is not available'));
                    return;
                }
                wireCastContext();
            };

            if (!(window.chrome && window.chrome.cast)) {
                const script = document.createElement('script');
                script.src = options.sdk || 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
                script.onload = function () { };
                script.onerror = reject;
                document.body.appendChild(script);
            }
        });
    }

    function buildPlugin(userOptions) {
        const opts = userOptions || {};
        let initialized = false;
        let castSession = null;
        let castState = null;
        let syncingSeek = false;
        let binded = false;
        let localAudioSnapshot = null;

        function muteLocalPlayback(art) {
            const video = art && art.video;
            if (!video) return;
            if (!localAudioSnapshot) {
                localAudioSnapshot = {
                    muted: !!video.muted,
                    volume: Number(video.volume),
                };
            }
            video.muted = true;
            if (Number.isFinite(video.volume)) video.volume = 0;
        }

        function restoreLocalPlayback(art) {
            const video = art && art.video;
            if (!video || !localAudioSnapshot) return;
            video.muted = !!localAudioSnapshot.muted;
            if (Number.isFinite(localAudioSnapshot.volume)) {
                video.volume = localAudioSnapshot.volume;
            }
            localAudioSnapshot = null;
        }

        function getCurrentMediaSession(castContext) {
            const current = castSession || (castContext ? castContext.getCurrentSession() : null);
            if (!current || typeof current.getMediaSession !== 'function') return null;
            return current.getMediaSession();
        }

        function loadToCast(art, session) {
            const mediaUrl = opts.url || art.option.url;
            const mediaInfo = new window.chrome.cast.media.MediaInfo(mediaUrl, opts.mimeType || guessMimeType(mediaUrl));
            const request = new window.chrome.cast.media.LoadRequest(mediaInfo);

            if (!session || typeof session.loadMedia !== 'function') {
                throw new Error('Cast session is null');
            }

            return session.loadMedia(request).then(() => {
                // Evita doble audio (TV + dispositivo local) al iniciar Cast.
                muteLocalPlayback(art);
                art.notice.show = 'Casting started';
                if (opts.onCastStart) opts.onCastStart();
            });
        }

        function bindArtControlsToCast(art, castContext) {
            if (binded) return;
            binded = true;

            const video = art.video;
            if (!video) return;

            const safe = (fn) => {
                try {
                    fn();
                } catch (_) { }
            };

            video.addEventListener('pause', () => {
                if (document.visibilityState === 'hidden') return;
                const m = getCurrentMediaSession(castContext);
                if (!m || syncingSeek) return;
                safe(() => m.pause(null, () => { }, () => { }));
            });

            video.addEventListener('play', () => {
                if (document.visibilityState === 'hidden') return;
                const m = getCurrentMediaSession(castContext);
                if (!m || syncingSeek) return;
                safe(() => m.play(null, () => { }, () => { }));
            });

            video.addEventListener('seeking', () => {
                const m = getCurrentMediaSession(castContext);
                if (!m) return;
                const t = Number(video.currentTime || 0);
                if (!Number.isFinite(t) || t < 0) return;
                const req = new window.chrome.cast.media.SeekRequest();
                req.currentTime = t;
                syncingSeek = true;
                safe(() => m.seek(req, () => { syncingSeek = false; }, () => { syncingSeek = false; }));
            });
        }

        return async function artplayerPlugin(art) {
            art.controls.add({
                name: 'chromecast',
                position: 'right',
                tooltip: 'Chromecast',
                html:
                    `<i class="art-icon art-icon-cast">` +
                    (opts.icon ||
                        '<svg height="20" width="20" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path d="M512 96H64v99c-13-2-26.4-3-40-3H0V96C0 60.7 28.7 32 64 32H512c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H288V456c0-13.6-1-27-3-40H512V96zM24 224c128.1 0 232 103.9 232 232c0 13.3-10.7 24-24 24s-24-10.7-24-24c0-101.6-82.4-184-184-184c-13.3 0-24-10.7-24-24s10.7-24 24-24zm8 192a32 32 0 1 1 0 64 32 32 0 1 1 0-64zM0 344c0-13.3 10.7-24 24-24c75.1 0 136 60.9 136 136c0 13.3-10.7 24-24 24s-24-10.7-24-24c0-48.6-39.4-88-88-88c-13.3 0-24-10.7-24-24z"/></svg>') +
                    `</i>`,
                click: async () => {
                    try {
                        const castContext = await ensureCastApi(opts);

                        if (!initialized) {
                            castContext.addEventListener(window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED, (event) => {
                                castState = event.sessionState;
                                castSession = event.session || castContext.getCurrentSession();

                                const S = window.cast.framework.SessionState;
                                if (event.sessionState === S.NO_SESSION) {
                                    restoreLocalPlayback(art);
                                    updateCastIcon('disconnected');
                                    if (opts.onStateChange) opts.onStateChange('disconnected');
                                } else if (event.sessionState === S.SESSION_STARTING) {
                                    updateCastIcon('connecting');
                                    if (opts.onStateChange) opts.onStateChange('connecting');
                                } else if (event.sessionState === S.SESSION_STARTED || event.sessionState === S.SESSION_RESUMED) {
                                    muteLocalPlayback(art);
                                    updateCastIcon('connected');
                                    if (opts.onStateChange) opts.onStateChange('connected');
                                } else if (event.sessionState === S.SESSION_ENDING) {
                                    restoreLocalPlayback(art);
                                    updateCastIcon('disconnecting');
                                    if (opts.onStateChange) opts.onStateChange('disconnecting');
                                }
                            });

                            castContext.addEventListener(window.cast.framework.CastContextEventType.CAST_STATE_CHANGED, (event) => {
                                const C = window.cast.framework.CastState;
                                if (opts.onCastAvailable) {
                                    opts.onCastAvailable(event.castState !== C.NO_DEVICES_AVAILABLE);
                                }
                            });

                            initialized = true;
                        }

                        bindArtControlsToCast(art, castContext);

                        if (!castSession) {
                            await castContext.requestSession();
                            castSession = castContext.getCurrentSession();
                        }
                        if (!castSession) throw new Error('Cast session is null');

                        await loadToCast(art, castSession);
                    } catch (err) {
                        art.notice.show = 'Error connecting to cast session';
                        if (opts.onError) opts.onError(err);
                        throw err;
                    }
                },
            });

            return {
                name: 'artplayerPluginChromecast',
                getCastState: () => castState,
                isCasting: () => castSession !== null,
            };
        };
    }

    global.artplayerPluginChromecast = buildPlugin;
})(typeof globalThis !== 'undefined' ? globalThis : window);
