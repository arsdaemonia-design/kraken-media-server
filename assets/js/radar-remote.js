/**
 * ============================================================================
 * KRAKEN MEDIA SERVER — radar-remote.js
 * Radar de usuarios activos en tiempo real, control remoto entre dispositivos ('El Titiritero'), transferencia de reproducción y funciones sociales.
 * ============================================================================
 */

/**
         * `getDeviceDisplayName(device)`
         * Formatea el nombre visible de un dispositivo conectado en el radar.
         */
        function getDeviceDisplayName(device) {
            if (!device) return 'Dispositivo';
            const isTv = device.device_type === 'tv' || /tv/i.test(device.device_name || device.name || '');
            const isMobile = device.device_type === 'mobile' || /android|iphone|phone|ipad|tablet/i.test(device.device_name || '');
            const icon = isTv ? '📺 ' : (isMobile ? '📱 ' : '💻 ');

            const userName = (device.name && device.name !== 'Invitado' && device.name !== 'Anónimo') ? device.name : '';
            const devName = device.device_name || '';

            if (isTv) {
                const tvLabel = devName || userName || 'Smart TV';
                return `📺 ${tvLabel}`;
            }

            if (userName && devName && !devName.toLowerCase().includes(userName.toLowerCase())) {
                return `${icon}${userName} · ${devName}`;
            }

            const raw = userName || devName || `Dispositivo ${String(device.session_id || '').slice(0, 6)}`;
            return `${icon}${raw}`;
        }

        /**
         * `syncRemoteTargetsWithOnlineUsers()`
         * Verifica que el dispositivo controlado remotamente siga conectado y activo.
         */
        function syncRemoteTargetsWithOnlineUsers() {
            const onlineBySid = new Map((LAST_USERS_DATA || []).map(u => [u.session_id, u]));

            if (!window.KRAKEN_PLAYBACK_TARGET?.session_id) {
                const savedSid = localStorage.getItem(KRAKEN_PLAYBACK_TARGET_KEY);
                const savedTarget = savedSid ? onlineBySid.get(savedSid) : null;
                if (savedTarget && savedTarget.session_id !== MY_SESSION_ID) {
                    window.KRAKEN_PLAYBACK_TARGET = savedTarget;
                    window.KRAKEN_CONTROL_TARGET = savedTarget;
                } else if (savedSid) {
                    localStorage.removeItem(KRAKEN_PLAYBACK_TARGET_KEY);
                }
            }

            const isRecentManualSeek = Boolean(
                window._lastRemoteSeekAt && (Date.now() - window._lastRemoteSeekAt < 4500)
            );

            if (window.KRAKEN_CONTROL_TARGET?.session_id) {
                const freshControl = onlineBySid.get(window.KRAKEN_CONTROL_TARGET.session_id);
                if (freshControl && isRecentManualSeek && typeof window._lastRemoteSeekTargetTime === 'number') {
                    freshControl.time = window._lastRemoteSeekTargetTime;
                }
                window.KRAKEN_CONTROL_TARGET = freshControl || null;
            }

            if (window.KRAKEN_PLAYBACK_TARGET?.session_id) {
                const freshPlayback = onlineBySid.get(window.KRAKEN_PLAYBACK_TARGET.session_id);
                if (freshPlayback && isRecentManualSeek && typeof window._lastRemoteSeekTargetTime === 'number') {
                    freshPlayback.time = window._lastRemoteSeekTargetTime;
                }
                window.KRAKEN_PLAYBACK_TARGET = freshPlayback || null;
            }

            if (window._activeCineRemoteData?.targetSid) {
                const freshCineTarget = onlineBySid.get(window._activeCineRemoteData.targetSid);
                if (freshCineTarget) {
                    if (isRecentManualSeek && typeof window._lastRemoteSeekTargetTime === 'number') {
                        freshCineTarget.time = window._lastRemoteSeekTargetTime;
                    }
                    if (!window.KRAKEN_PLAYBACK_TARGET) window.KRAKEN_PLAYBACK_TARGET = freshCineTarget;
                    if (!window.KRAKEN_CONTROL_TARGET) window.KRAKEN_CONTROL_TARGET = freshCineTarget;
                    if (document.getElementById('cine-remote-modal') && typeof updateCineRemoteLive === 'function') {
                        updateCineRemoteLive(freshCineTarget);
                    }
                }
            }

            // Sync Active Watch Party (Ver juntos) si está activa
            if (window.KRAKEN_SYNC_WATCH_PARTY) {
                const party = window.KRAKEN_SYNC_WATCH_PARTY;
                const host = (LAST_USERS_DATA || []).find(u => u.session_id === party.targetSid || u.name === party.friendName);
                if (host) {
                    renderWatchPartyBanner();
                    if (host.song && host.song !== party.title && host.path && host.path !== party.path && host.media_type === 'video') {
                        party.title = host.song;
                        party.path = host.path;
                        try { localStorage.setItem('kraken_sync_watch_party', JSON.stringify(party)); } catch (_) {}
                        startWatchParty(host.session_id, host.name, host.path, host.song, Number(host.time) || 0);
                        showToast(`🍿 ${host.name} cambió a: ${host.song}`, 'info');
                    }
                }
            }

            // Sync Active Jam session if user is listening with a friend
            if (window.KRAKEN_SYNC_JAM) {
                const jam = window.KRAKEN_SYNC_JAM;
                const host = (LAST_USERS_DATA || []).find(u => u.session_id === jam.targetSid || u.name === jam.friendName);
                if (host && host.song && host.song !== jam.lastSong && host.song !== 'Reproductor') {
                    window.KRAKEN_SYNC_JAM.lastSong = host.song;
                    window.KRAKEN_SYNC_JAM.lastPath = host.path;
                    try {
                        localStorage.setItem('kraken_sync_jam', JSON.stringify(window.KRAKEN_SYNC_JAM));
                    } catch (_) {}
                    listenSame(host.session_id, host.path, host.song, host.artist);
                    renderJamBanner();
                    showToast(`🎧 ${host.name} cambió a: ${host.song}`, 'info');
                } else if (host) {
                    renderJamBanner();
                }
            }

            renderPlayerConnectIndicator();
        }

        /**
         * `parseDurationSeconds(val)`
         * Convierte duraciones numéricas o en formato 'H:MM:SS' / 'MM:SS' a segundos enteros.
         */
        function parseDurationSeconds(val) {
            if (typeof val === 'number' && Number.isFinite(val)) return Math.max(0, Math.floor(val));
            if (!val) return 0;
            const str = String(val).trim();
            if (/^\d+(\.\d+)?$/.test(str)) return Math.max(0, Math.floor(Number(str)));
            const parts = str.split(':').map(Number);
            if (parts.some(Number.isNaN)) return 0;
            if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
            if (parts.length === 2) return parts[0] * 60 + parts[1];
            return 0;
        }
        window.parseDurationSeconds = parseDurationSeconds;

        /**
         * `resolveMediaDurationSeconds(target, video)`
         * Resuelve la duración total real en segundos buscando en el dispositivo, objeto de video o catálogo local.
         */
        function resolveMediaDurationSeconds(target, video = null) {
            let dur = parseDurationSeconds(target?.duration)
                || parseDurationSeconds(video?.duration_seconds)
                || parseDurationSeconds(video?.duration)
                || parseDurationSeconds(window._lastCineRemoteVideo?.duration_seconds)
                || parseDurationSeconds(window._lastCineRemoteVideo?.duration);
            if (dur > 0) return dur;
            const searchPath = (video?.path || target?.path || window._activeCineRemoteData?.path || '').replace(/\\/g, '/').toLowerCase();
            const searchTitle = (video?.title || target?.song || window._activeCineRemoteData?.title || '').trim().toLowerCase();
            if (Array.isArray(window.libData?.files)) {
                const match = window.libData.files.find(f => {
                    if (!f) return false;
                    if (searchPath && (f.path || '').replace(/\\/g, '/').toLowerCase() === searchPath) return true;
                    if (searchTitle && (f.title || '').trim().toLowerCase() === searchTitle) return true;
                    return false;
                });
                if (match) {
                    dur = parseDurationSeconds(match.duration_seconds) || parseDurationSeconds(match.duration);
                }
            }
            return dur;
        }

        /**
         * `getActiveRemotePlaybackTarget()`
         * Obtiene los datos del dispositivo remoto actualmente vinculado.
         */
        function getActiveRemotePlaybackTarget() {
            if (window.KRAKEN_PLAYBACK_TARGET && window.KRAKEN_PLAYBACK_TARGET.session_id) {
                return window.KRAKEN_PLAYBACK_TARGET;
            }
            if (window.KRAKEN_CONTROL_TARGET && window.KRAKEN_CONTROL_TARGET.session_id) {
                return window.KRAKEN_CONTROL_TARGET;
            }
            if (window._activeCineRemoteData && window._activeCineRemoteData.targetSid) {
                const found = (LAST_USERS_DATA || []).find(u => u && u.session_id === window._activeCineRemoteData.targetSid);
                if (found) return found;
                return {
                    session_id: window._activeCineRemoteData.targetSid,
                    name: window._activeCineRemoteData.subtitle || 'Pantalla',
                    song: window._activeCineRemoteData.title || 'Película',
                    path: window._activeCineRemoteData.path || '',
                    media_type: 'video'
                };
            }
            return null;
        }

        /**
         * `renderPlaybackTargetWidget()`
         * Renderiza el indicador de dispositivo de salida activo.
         */
        function renderPlaybackTargetWidget() {
            document.getElementById('playback-target-widget')?.remove();
            renderPlayerConnectIndicator();
        }

        /**
         * `renderControlledTargetWidget()`
         * Sincroniza indicadores en la barra de reproducción (Spotify Connect).
         */
        function renderControlledTargetWidget() {
            document.getElementById('remote-control-widget')?.remove();
            renderPlayerConnectIndicator();
        }

        /**
         * `applyControlledTargetState(target)`
         * Sincroniza la barra del reproductor con el estado del dispositivo remoto controlado.
         */
        function applyControlledTargetState(target) {
            window.KRAKEN_CONTROL_TARGET = target || null;
            renderControlledTargetWidget();
            if (target && target.session_id && target.session_id !== MY_SESSION_ID) {
                syncMirroredPlayerUI(target);
            }
        }

        /**
         * `applyPlaybackTargetState(target)`
         * Actualiza los controles visuales según el objetivo de reproducción remota.
         */
        function applyPlaybackTargetState(target) {
            window.KRAKEN_PLAYBACK_TARGET = target || null;
            renderPlaybackTargetWidget();
        }

        /**
         * `setPlaybackTarget(targetSid)`
         * Establece un dispositivo remoto como destino de reproducción.
         */
        function setPlaybackTarget(targetSid) {
            if (!targetSid) return;
            if (targetSid === 'local') {
                clearPlaybackTarget();
                return;
            }
            if (targetSid === MY_SESSION_ID) {
                showToast('Este equipo ya es tu salida local', 'warning');
                return;
            }

            const target = LAST_USERS_DATA.find(u => u.session_id === targetSid);
            if (!target) {
                showToast('Ese dispositivo ya no está en línea', 'warning');
                return;
            }

            applyPlaybackTargetState(target);
            localStorage.setItem(KRAKEN_PLAYBACK_TARGET_KEY, target.session_id);
            showToast(`Salida remota activa: ${getDeviceDisplayName(target)}`, 'success');
            document.getElementById('control-modal')?.remove();
        }

        /**
         * `clearPlaybackTarget(silent = false)`
         * Desvincula el destino de reproducción remota y vuelve al modo local.
         */
        function clearPlaybackTarget(silent = false) {
            applyPlaybackTargetState(null);
            localStorage.removeItem(KRAKEN_PLAYBACK_TARGET_KEY);
            if (!silent) showToast('Salida remota desactivada', 'info');
        }

        /**
         * `sendRemoteSeek(value)`
         * Envía un comando de salto de tiempo (`seek`) al dispositivo controlado y actualiza la UI de inmediato.
         */
        function sendRemoteSeek(value) {
            const seconds = Math.max(0, Math.floor(Number(value) || 0));
            const target = getActiveRemotePlaybackTarget();
            const targetSid = target?.session_id || window._activeCineRemoteData?.targetSid || null;

            window._lastRemoteSeekAt = Date.now();
            window._lastRemoteSeekTargetTime = seconds;

            if (target) target.time = seconds;
            if (window.KRAKEN_PLAYBACK_TARGET && (!targetSid || window.KRAKEN_PLAYBACK_TARGET.session_id === targetSid)) {
                window.KRAKEN_PLAYBACK_TARGET.time = seconds;
            }
            if (window.KRAKEN_CONTROL_TARGET && (!targetSid || window.KRAKEN_CONTROL_TARGET.session_id === targetSid)) {
                window.KRAKEN_CONTROL_TARGET.time = seconds;
            }

            const seekEl = document.getElementById('cine-remote-seek');
            const timeCurEl = document.getElementById('cine-remote-time-cur');
            if (seekEl) seekEl.value = seconds;
            if (timeCurEl) timeCurEl.innerText = formatTimeShort(seconds);

            sendCommand(targetSid, `seek_to_${seconds}`);
        }

        /**
         * `sendFileToControlledDevice(file, target = null)`
         * Ordena a un dispositivo remoto reproducir o encolar un archivo específico.
         */
        function sendFileToControlledDevice(file, target = null) {
            window.sendFileToControlledDevice = sendFileToControlledDevice;
            const resolvedTarget = target || getActiveRemotePlaybackTarget();
            const targetSid = resolvedTarget?.session_id;
            if (!targetSid) {
                showToast('Primero elige un dispositivo remoto', 'warning');
                return;
            }
            if (!file || !file.path) {
                showToast('No se pudo identificar el archivo', 'error');
                return;
            }

            const payload = JSON.stringify({
                id: file.id || -1,
                path: file.path,
                title: file.title || '',
                artist: file.artist || '',
                type: file.type || 'audio',
                cover: file.cover || ''
            });

            sendCommand(targetSid, `play_media_${payload}`);
            showToast(`Enviando "${file.title || 'archivo'}" a ${getDeviceDisplayName(resolvedTarget)}`, 'success');
        }

        /**
         * `sendCurrentTrackToControlledDevice()`
         * Transfiere la pista que suena localmente hacia otro dispositivo del radar.
         */
        function sendCurrentTrackToControlledDevice() {
            const currentFile = playerQueue[currentTrackIndex];
            if (!currentFile) {
                showToast('No hay nada sonando para enviar', 'warning');
                return;
            }
            sendFileToControlledDevice(currentFile);
        }

        /**
         * `linkControlledDevice(targetSid)`
         * Activa el modo de control remoto sobre una sesión específica del radar.
         */
        async function linkControlledDevice(targetSid) {
            if (!targetSid) return;
            if (targetSid === MY_SESSION_ID) {
                showToast('Ese dispositivo ya eres tú', 'warning');
                return;
            }

            try {
                const res = await fetch('/device/control/link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        controller_sid: MY_SESSION_ID,
                        target_sid: targetSid
                    })
                });
                const data = await res.json();
                if (!data.ok) {
                    showToast(data.error || 'No se pudo enlazar el control', 'error');
                    return;
                }

                const target = LAST_USERS_DATA.find(u => u.session_id === targetSid);
                applyControlledTargetState(target || {
                    session_id: targetSid,
                    name: data.target?.name || 'Dispositivo',
                    device_name: data.target?.device_name || '',
                    device_type: data.target?.device_type || 'unknown'
                });
                showToast(`Ahora controlas ${getDeviceDisplayName(target || data.target)}`, 'success');
                document.getElementById('control-modal')?.remove();
            } catch (e) {
                console.error(e);
                showToast('Error enlazando dispositivo', 'error');
            }
        }

        /**
         * `unlinkControlledDevice(silent = false)`
         * Finaliza el control remoto sobre el dispositivo vinculado.
         */
        async function unlinkControlledDevice(silent = false) {
            try {
                await fetch('/device/control/unlink', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ controller_sid: MY_SESSION_ID })
                });
            } catch (e) {
                console.error(e);
            } finally {
                applyControlledTargetState(null);
                if (!silent) showToast('Control remoto liberado', 'info');
            }
        }

        /**
         * `applyRemoteCommand(command)`
         * Ejecuta localmente los comandos remotos recibidos desde otro dispositivo (play, pause, next, seek, volume, etc.).
         */
        function applyRemoteCommand(command) {
            if (!command || !command.action) return;

            const action = command.action;
            const sender = command.from_name || 'Alguien';
            const senderSid = command.from_sid || null;

            console.log("🎮 ORDEN REMOTA:", action, "de", sender, senderSid);

            if (action.startsWith('party_joined_')) {
                try {
                    const payload = JSON.parse(action.slice('party_joined_'.length));
                    const partnerSid = payload.sid || senderSid;
                    const partnerName = payload.name || sender;
                    if (!window.KRAKEN_SYNC_WATCH_PARTY) {
                        window.KRAKEN_SYNC_WATCH_PARTY = {
                            targetSid: partnerSid,
                            friendName: partnerName,
                            participants: [partnerSid],
                            title: payload.title || ''
                        };
                    } else {
                        window.KRAKEN_SYNC_WATCH_PARTY.targetSid = partnerSid;
                        window.KRAKEN_SYNC_WATCH_PARTY.friendName = partnerName;
                        if (!Array.isArray(window.KRAKEN_SYNC_WATCH_PARTY.participants)) {
                            window.KRAKEN_SYNC_WATCH_PARTY.participants = [];
                        }
                        if (partnerSid && !window.KRAKEN_SYNC_WATCH_PARTY.participants.includes(partnerSid)) {
                            window.KRAKEN_SYNC_WATCH_PARTY.participants.push(partnerSid);
                        }
                    }
                    try { localStorage.setItem('kraken_sync_watch_party', JSON.stringify(window.KRAKEN_SYNC_WATCH_PARTY)); } catch (_) {}
                    renderWatchPartyBanner();
                    showToast(`🍿 ${partnerName} se unió a tu Watch Party`, 'success');
                } catch (e) {
                    console.error('Error procesando party_joined_', e);
                }
                return;
            }

            if (action.startsWith('emoji_')) {
                const emojiIcon = action.split('_')[1];
                showEmojiModal(emojiIcon);
                showToast("¡Reacción Recibida!", "success");
                return;
            }

            if (action.startsWith('msg_')) {
                const txt = decodeURIComponent(action.slice(4));
                const mId = 'incoming-msg-' + Date.now();
                const mEl = document.createElement('div');
                mEl.id = mId;
                mEl.className = 'fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in';
                mEl.onclick = () => mEl.remove();
                mEl.innerHTML = `
                    <div class="bg-[#141414] border border-blue-500/30 rounded-2xl max-w-xs w-full mx-4 p-6 text-center shadow-2xl" onclick="event.stopPropagation()">
                        <div class="text-3xl mb-3">💬</div>
                        <div class="text-[10px] text-blue-400 uppercase tracking-widest mb-1">${sender} te dice:</div>
                        <div class="text-white text-lg font-bold leading-snug mb-5">${txt}</div>
                        <button onclick="document.getElementById('${mId}').remove()" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-sm transition">Ok 👍</button>
                    </div>`;
                document.body.appendChild(mEl);
                return;
            }

            if (action.startsWith('recommend_')) {
                try {
                    const payload = JSON.parse(action.slice(10));
                    const rId = 'incoming-rec-' + Date.now();
                    const rEl = document.createElement('div');
                    rEl.id = rId;
                    rEl.className = 'fixed bottom-24 right-4 z-[10001] animate-slide-up';
                    rEl.innerHTML = `
                        <div class="bg-[#141414] border border-yellow-500/30 rounded-2xl w-72 p-4 shadow-2xl">
                            <div class="flex items-center gap-3 mb-3">
                                <span class="text-2xl">⭐</span>
                                <div class="flex-1 min-w-0">
                                    <div class="text-[9px] text-yellow-400 uppercase tracking-widest">${sender} te recomienda:</div>
                                    <div class="text-white font-bold text-sm truncate">${payload.title}</div>
                                    <div class="text-zinc-400 text-xs truncate">${payload.artist || ''}</div>
                                </div>
                                <button onclick="document.getElementById('${rId}').remove()" class="text-zinc-600 hover:text-white text-lg leading-none">×</button>
                            </div>
                            <div class="flex gap-2">
                                <button id="btn-play-${rId}" class="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 rounded-xl text-xs transition">🎵 Escuchar</button>
                                <button onclick="document.getElementById('${rId}').remove()" class="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 py-2 rounded-xl text-xs transition">Luego</button>
                            </div>
                        </div>`;
                    rEl.dataset.path = payload.path;
                    rEl.dataset.title = payload.title;
                    rEl.dataset.artist = payload.artist || '';
                    document.body.appendChild(rEl);
                    document.getElementById(`btn-play-${rId}`).onclick = function () {
                        listenSame('', rEl.dataset.path, rEl.dataset.title, rEl.dataset.artist);
                        rEl.remove();
                    };
                    setTimeout(() => rEl.remove(), 30000);
                } catch (_) { }
                return;
            }

            if (action.startsWith('play_media_')) {
                try {
                    const payload = JSON.parse(action.slice(11));
                    const targetPath = (payload.path || '').replace(/\\/g, '/');
                    const match = window.libData?.files?.find(f => (f.path || '').replace(/\\/g, '/') === targetPath);
                    const isVid = payload.type === 'video' || (match && match.type === 'video') || /\.(mp4|mkv|avi|webm|m4v|mov)$/i.test(targetPath);
                    if (isVid) {
                        const videoObj = match || {
                            path: payload.path,
                            title: payload.title || payload.path.split('/').pop(),
                            artist: payload.artist || payload.folder || '',
                            type: 'video',
                            cover: payload.cover || ''
                        };
                        if (typeof playVideoMode === 'function') {
                            playVideoMode(videoObj);
                            showToast(`🎬 Reproduciendo: ${videoObj.title}`, 'success');
                        }
                        return;
                    }
                    if (match) {
                        playNow(match.path);
                        showToast(`📡 Reproduciendo enviado: ${match.title || payload.title || 'archivo'}`, 'success');
                    } else if (payload.type !== 'video' && payload.path) {
                        const fakeTrack = {
                            path: payload.path,
                            title: payload.title || payload.path.split('/').pop(),
                            artist: payload.artist || '',
                            album: '',
                            genre: '',
                            type: payload.type || 'audio'
                        };
                        playerQueue = [fakeTrack];
                        currentTrackIndex = 0;
                        playTrack(fakeTrack);
                        showToast(`📡 Reproduciendo enviado: ${fakeTrack.title}`, 'success');
                    } else {
                        showToast('No encontré ese archivo en este dispositivo', 'warning');
                    }
                } catch (e) {
                    console.warn('No se pudo procesar play_media_', e);
                }
                return;
            }

            if (action.startsWith('switch_audio_')) {
                const audioIdx = action.slice('switch_audio_'.length);
                if (typeof window.switchKrakenAudio === 'function') {
                    window.switchKrakenAudio(audioIdx);
                }
                return;
            }

            if (action.startsWith('switch_sub_')) {
                const subVal = action.slice('switch_sub_'.length);
                if (typeof window.switchKrakenSubtitle === 'function') {
                    window.switchKrakenSubtitle(subVal);
                }
                return;
            }

            if (action.startsWith('invite_watch_party_')) {
                try {
                    const payload = JSON.parse(action.slice('invite_watch_party_'.length));
                    if (typeof showWatchPartyInvitationDialog === 'function') {
                        showWatchPartyInvitationDialog(payload, sender);
                    }
                } catch (e) {
                    console.error('Error procesando invite_watch_party_', e);
                }
                return;
            }

            if (action.startsWith('watch_party_sync_')) {
                try {
                    const payload = JSON.parse(action.slice('watch_party_sync_'.length));
                    const partnerSid = payload.sender_sid || senderSid;
                    const partnerName = payload.sender_name || sender;
                    if (partnerSid) {
                        if (!window.KRAKEN_SYNC_WATCH_PARTY) {
                            window.KRAKEN_SYNC_WATCH_PARTY = {
                                targetSid: partnerSid,
                                friendName: partnerName,
                                participants: [partnerSid]
                            };
                            try { localStorage.setItem('kraken_sync_watch_party', JSON.stringify(window.KRAKEN_SYNC_WATCH_PARTY)); } catch (_) {}
                            renderWatchPartyBanner();
                        } else {
                            if (!window.KRAKEN_SYNC_WATCH_PARTY.targetSid) window.KRAKEN_SYNC_WATCH_PARTY.targetSid = partnerSid;
                            if (!Array.isArray(window.KRAKEN_SYNC_WATCH_PARTY.participants)) window.KRAKEN_SYNC_WATCH_PARTY.participants = [];
                            if (!window.KRAKEN_SYNC_WATCH_PARTY.participants.includes(partnerSid)) {
                                window.KRAKEN_SYNC_WATCH_PARTY.participants.push(partnerSid);
                            }
                        }
                    }
                    if (typeof applyWatchPartySync === 'function') {
                        applyWatchPartySync(payload);
                    }
                } catch (e) {
                    console.error('Error procesando watch_party_sync_', e);
                }
                return;
            }

            if (action.startsWith('party_chat_')) {
                try {
                    const payload = JSON.parse(action.slice('party_chat_'.length));
                    const partnerSid = payload.sender_sid || senderSid;
                    const partnerName = payload.sender || sender;
                    if (partnerSid) {
                        if (!window.KRAKEN_SYNC_WATCH_PARTY) {
                            window.KRAKEN_SYNC_WATCH_PARTY = {
                                targetSid: partnerSid,
                                friendName: partnerName,
                                participants: [partnerSid]
                            };
                            try { localStorage.setItem('kraken_sync_watch_party', JSON.stringify(window.KRAKEN_SYNC_WATCH_PARTY)); } catch (_) {}
                            renderWatchPartyBanner();
                        } else {
                            if (!window.KRAKEN_SYNC_WATCH_PARTY.targetSid) window.KRAKEN_SYNC_WATCH_PARTY.targetSid = partnerSid;
                            if (!Array.isArray(window.KRAKEN_SYNC_WATCH_PARTY.participants)) window.KRAKEN_SYNC_WATCH_PARTY.participants = [];
                            if (!window.KRAKEN_SYNC_WATCH_PARTY.participants.includes(partnerSid)) {
                                window.KRAKEN_SYNC_WATCH_PARTY.participants.push(partnerSid);
                            }
                        }
                    }
                    if (typeof receiveWatchPartyMessage === 'function') {
                        receiveWatchPartyMessage(payload);
                    }
                } catch (e) {
                    console.error('Error procesando party_chat_', e);
                }
                return;
            }

            const activeVideo = document.querySelector('#cine-screen video, #artplayer-container video, #main-video');
            const currentArt = window.currentArtPlayer;

            if (action === 'pause') {
                if (currentArt) {
                    currentArt.pause();
                } else if (activeVideo && !activeVideo.paused) {
                    activeVideo.pause();
                    syncPlayPauseIcon?.();
                } else {
                    togglePlay();
                }
                return;
            }
            if (action === 'play') {
                if (currentArt) {
                    currentArt.play();
                } else if (activeVideo && activeVideo.paused) {
                    activeVideo.play().catch(e => console.log(e));
                    syncPlayPauseIcon?.();
                } else if (audioElement && audioElement.src) {
                    audioElement.play().catch(e => console.log(e));
                    updatePlayIcons(true);
                }
                return;
            }
            if (action === 'next') { playNext(); return; }
            if (action === 'prev') { playPrevious(); return; }
            if (action === 'vol_up') {
                const newVol = Math.min(1, (audioElement?.volume || 0) + 0.1);
                setVolume(newVol);
                if (currentArt) currentArt.volume = newVol;
                if (activeVideo) activeVideo.volume = newVol;
                syncPlayerUI?.();
                return;
            }
            if (action === 'vol_down') {
                const newVol = Math.max(0, (audioElement?.volume || 0) - 0.1);
                setVolume(newVol);
                if (currentArt) currentArt.volume = newVol;
                if (activeVideo) activeVideo.volume = newVol;
                syncPlayerUI?.();
                return;
            }
            if (action.startsWith('set_volume_')) {
                const raw = Number(action.slice('set_volume_'.length));
                if (!Number.isNaN(raw)) {
                    const safeVolume = Math.max(0, Math.min(1, raw));
                    setVolume(safeVolume);
                    if (currentArt) currentArt.volume = safeVolume;
                    if (activeVideo) activeVideo.volume = safeVolume;
                    syncPlayerUI?.();
                }
                return;
            }
            if (action.startsWith('seek_to_')) {
                const raw = Number(action.slice('seek_to_'.length));
                if (!Number.isNaN(raw)) {
                    const targetSec = Math.max(0, raw);
                    if (currentArt && typeof currentArt.seekToMovieTime === 'function') {
                        currentArt.seekToMovieTime(targetSec);
                    } else if (currentArt) {
                        currentArt.currentTime = targetSec;
                    } else if (activeVideo) {
                        activeVideo.currentTime = targetSec;
                    } else if (audioElement) {
                        audioElement.currentTime = targetSec;
                    }
                }
            }
        }

        /**
         * `drawUserRadar(users)`
         * Renderiza los avatares y estados de reproducción de los usuarios conectados en la barra superior.
         */
        function drawUserRadar(users) {
            LAST_USERS_DATA = users;
            syncRemoteTargetsWithOnlineUsers();
            if (typeof checkActiveCompanionPrompt === 'function') {
                checkActiveCompanionPrompt(users);
            }

            // 1. CHEQUEO ANTI-BRINCO MEJORADO 🛑
            // Creamos una "firma" visual que IGNORA el tiempo y la duración.
            // Solo si cambia el nombre, la canción o el estado, redibujamos.
            const visualSignature = JSON.stringify(users.map(u => ({
                name: u.name,
                song: u.song,
                artist: u.artist,
                is_speaker: u.is_speaker,
                count: u.count
            })));

            if (visualSignature === lastRadarJson) return; // Si es igual, NO hacemos nada
            lastRadarJson = visualSignature;

            let container = document.getElementById('user-radar-panel');

            // Crear contenedor si no existe
            if (!container) {
                container = document.createElement('div');
                container.id = 'user-radar-panel';
                container.className = 'fixed bottom-40 right-4 z-[400] flex flex-col items-end gap-3 pointer-events-auto transition-all duration-500';
                document.body.appendChild(container);
            }

            // 2. AGRUPAR USUARIOS (Filtrar sesiones fantasma sin reproducción)
            const validUsers = (users || []).filter(u => {
                if (!u || !u.session_id) return false;
                if ((!u.name || u.name === 'Invitado') && (!u.song || u.song === 'Reproductor')) {
                    return false;
                }
                return true;
            });

            const groups = validUsers.reduce((acc, u) => {
                const name = u.name || "Anónimo";
                if (!acc[name]) acc[name] = [];
                acc[name].push(u);
                return acc;
            }, {});

            // 3. GENERAR BURBUJAS
            const bubblesHtml = Object.keys(groups).map(name => {
                const devices = groups[name];
                const isMe = (name.trim().toLowerCase() === (window.MY_NAME || MY_NAME || '').trim().toLowerCase());
                const count = devices.length;
                const initial = name.charAt(0).toUpperCase();

                const baseColor = isMe ? 'bg-emerald-600' : 'bg-indigo-600';
                const avatar = devices[0].avatar;
                const isSuperAdmin = devices[0].is_superadmin;

                // Si es SuperAdmin, le ponemos un anillo dorado
                const ringColor = isSuperAdmin ? 'ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'ring-2 ring-white/20';

                // Info de canción
                let listeningTo = "";
                const activeDevice = devices.find(d => d.song && d.song !== "Reproductor");

                if (activeDevice) {
                    listeningTo = `
            <div class="mt-2 pt-2 border-t border-white/10">
                <div class="text-[9px] text-gray-400 uppercase tracking-wider mb-0.5">Escuchando:</div>
                <div class="text-xs text-white font-medium truncate max-w-[150px]">🎵 ${activeDevice.song}</div>
            </div>
        `;
                }

                // Botón editar perfil (nombre + avatar)
                let editBtn = '';
                if (isMe) {
                    editBtn = `<div onclick="event.stopPropagation(); showEditProfileModal()" class="absolute -top-1 -left-1 w-4 h-4 bg-gray-800 rounded-full flex items-center justify-center text-[8px] cursor-pointer hover:bg-emerald-500 border border-white/20 z-40" title="Editar Perfil"><i class="fa-solid fa-pen"></i></div>`;
                }

                // Render del icono central (Avatar o Inicial)
                const centerIcon = avatar
                    ? `<img src="${avatar}" class="w-full h-full object-cover rounded-full">`
                    : `${initial}`;

                return `
        <div class="group relative flex flex-col items-center transition-all duration-300 hover:-translate-y-2">
            ${editBtn}
            ${isSuperAdmin ? '<div class="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] z-50 text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,1)]" title="Kraken Master">👑</div>' : ''}
            
            <div onclick="showControlMenu('${name}')" class="w-14 h-14 rounded-full overflow-hidden ${baseColor} ${ringColor} flex items-center justify-center text-lg font-bold text-white shadow-lg cursor-pointer relative z-30 hover:scale-110 transition-transform">
                ${centerIcon}
                ${count > 1 ? `<div class="absolute -bottom-1 -right-1 w-4 h-4 bg-black text-white text-[9px] rounded-full flex items-center justify-center border border-white/20">${count}</div>` : ''}
            </div>

            <div class="absolute bottom-full mb-2 right-0 bg-black/90 backdrop-blur-md text-white px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10 shadow-xl text-right z-50">
                <div class="font-bold text-xs mb-0.5 ${isSuperAdmin ? 'text-yellow-400' : 'text-emerald-400'}">${name} ${isMe ? '(Tú)' : ''}</div>
                ${listeningTo}
                <div class="text-[9px] text-gray-400 mt-1 italic">${isMe ? "Dispositivos y Connect 🎧" : "Escucha Activa y Chat 💬"}</div>
            </div>
        </div>`;
            }).join('');

            container.innerHTML = `
    <div class="flex flex-col items-end gap-2">
        <div class="flex flex-row-reverse gap-3 items-end p-2 rounded-2xl bg-black/20 backdrop-blur-sm border border-white/5">
            ${bubblesHtml}
        </div>
        <button onclick="renderFolderView()" 
            class="group bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white hover:border-yellow-500/50 shadow-2xl rounded-full h-10 w-10 hover:w-48 transition-all duration-300 ease-out flex items-center overflow-hidden relative">
            <div class="absolute left-0 w-10 h-10 flex items-center justify-center shrink-0">
                <i class="fa-solid fa-folder-tree text-yellow-600 group-hover:text-yellow-400 transition"></i>
            </div>
            <span class="pl-10 pr-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-medium text-sm">
                Explorador de Archivos
            </span>
        </button>
    </div>
`;
        }

        // 👇 AGREGA ESTA NUEVA FUNCIÓN AL FINAL (Junto a toggleSpeakerMode)
        /**
         * `renameUser()`
         * Permite cambiar rápidamente el nombre del usuario actual.
         */
        function renameUser() {
            showEditProfileModal();
        }



        /**
         * `renderPlayerConnectIndicator()`
         * Actualiza el indicador visual de salida remota (Spotify Connect) en la barra de reproduccion.
         */
        
        /**
         * `syncMirroredPlayerUI(target)`
         * Modo Espejo (Spotify Connect): Refleja en el reproductor de este dispositivo
         * la cancion, caratula, barra de tiempo y estado del equipo remoto que esta sonando.
         */
        function syncMirroredPlayerUI(target) {
            if (!target) return;
            if (target.session_id === MY_SESSION_ID) return;

            // Si el dispositivo remoto reproduce un VIDEO (Cine / Series en TV):
            const isVideo = target.media_type === 'video' || (target.path && /\.(mp4|mkv|avi|webm|m4v|mov)$/i.test(target.path)) || (Number(target.duration || 0) > 600 && !/\.(mp3|flac|m4a|wav|ogg)$/i.test(target.path || ''));
            if (isVideo) {
                // OCULTAR REPRODUCTOR DE MÚSICA (No deben chocar jamás)
                const bar = document.getElementById('player-bar');
                if (bar) {
                    bar.classList.add('hidden');
                    bar.classList.remove('flex');
                }
                // Si el modal de Cine Remote está abierto, actualizarlo en vivo
                const cineModal = document.getElementById('cine-remote-modal');
                if (cineModal) {
                    if (typeof updateCineRemoteLive === 'function') updateCineRemoteLive(target);
                } else {
                    if (typeof renderCineRemoteMiniPill === 'function') renderCineRemoteMiniPill();
                }
                return;
            } else {
                document.getElementById('cine-remote-mini-pill')?.remove();
            }

            // 1. Mostrar la barra de reproduccion si hay cancion activa
            const bar = document.getElementById('player-bar');
            if (bar && target.song && target.song !== 'Reproductor') {
                bar.classList.remove('hidden');
                bar.classList.add('flex');
            }

            // 2. Titulo y Artista
            const songTitle = target.song || 'Reproduciendo en remoto';
            const songArtist = target.artist || getDeviceDisplayName(target);

            const titleMob = document.getElementById('player-title');
            const artistMob = document.getElementById('player-artist');
            const titleDesk = document.getElementById('player-title-desktop');
            const artistDesk = document.getElementById('player-artist-desktop');
            const fpTitle = document.getElementById('fp-title');
            const fpArtist = document.getElementById('fp-artist');

            if (titleMob && titleMob.innerText !== songTitle) titleMob.innerText = songTitle;
            if (titleDesk && titleDesk.innerText !== songTitle) titleDesk.innerText = songTitle;
            if (fpTitle && fpTitle.innerText !== songTitle) fpTitle.innerText = songTitle;

            if (artistMob && artistMob.innerText !== songArtist) artistMob.innerText = songArtist;
            if (artistDesk && artistDesk.innerText !== songArtist) artistDesk.innerText = songArtist;
            if (fpArtist && fpArtist.innerText !== songArtist) fpArtist.innerText = songArtist;

            // 3. Caratula
            if (target.path) {
                const parts = target.path.split('/');
                const safePath = parts.map(p => encodeURIComponent(p)).join('/');
                const coverUrl = `/caratula/${safePath}`;
                ['player-cover', 'player-cover-desktop', 'fp-cover'].forEach(id => {
                    const img = document.getElementById(id);
                    if (img && !img.src.includes(safePath)) {
                        img.src = coverUrl;
                        img.style.display = 'block';
                    }
                });
                const fpBg = document.getElementById('fp-bg');
                if (fpBg) fpBg.style.backgroundImage = `url('${coverUrl}')`;
            }

            // 4. Tiempos y barra de progreso
            const totalSec = Math.max(0, Number(target.duration) || 0);
            const curSec = Math.max(0, Number(target.time) || 0);

            ['time-total', 'time-total-desktop', 'fp-time-total'].forEach(id => {
                const el = document.getElementById(id);
                if (el && totalSec > 0) el.innerText = formatTimeShort(totalSec);
            });

            ['prog-bar', 'prog-bar-desktop', 'fp-prog'].forEach(id => {
                const el = document.getElementById(id);
                if (el && totalSec > 0) {
                    el.max = totalSec;
                    if (!window.isUserDraggingSeek) {
                        el.value = curSec;
                    }
                }
            });

            ['time-current', 'time-current-desktop', 'fp-time-current'].forEach(id => {
                const el = document.getElementById(id);
                if (el && !window.isUserDraggingSeek) el.innerText = formatTimeShort(curSec);
            });

            // 5. Estado de Play / Pausa
            if (typeof updatePlayIcons === 'function') {
                updatePlayIcons(Boolean(target.is_playing));
            }

            // 6. Silenciar audio local si esta sonando
            if (audioElement && !audioElement.paused && audioElement.src) {
                audioElement.pause();
            }
        }
        window.syncMirroredPlayerUI = syncMirroredPlayerUI;

        // Ticker suave segundo a segundo para la barra espejo (como Spotify)
        if (!window._krakenMirrorTicker) {
            window._krakenMirrorTicker = setInterval(() => {
                const target = window.KRAKEN_CONTROL_TARGET || window.KRAKEN_PLAYBACK_TARGET;
                if (!target || !target.session_id || target.session_id === MY_SESSION_ID) return;
                if (!target.is_playing) return;
                if (window.isUserDraggingSeek) return;

                const cur = Number(target.time || 0) + 1;
                const dur = Number(target.duration || 0);
                if (dur > 0 && cur > dur) return;

                target.time = cur;

                ['prog-bar', 'prog-bar-desktop', 'fp-prog'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el && dur > 0) el.value = cur;
                });

                ['time-current', 'time-current-desktop', 'fp-time-current'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.innerText = formatTimeShort(cur);
                });

                // Actualizar Cine Remote si está visible
                const cineSeek = document.getElementById('cine-remote-seek');
                const cineCur = document.getElementById('cine-remote-time-cur');
                const cineTot = document.getElementById('cine-remote-time-tot');
                if (cineSeek && !window.isUserDraggingCineSeek && dur > 0) {
                    cineSeek.max = dur;
                    cineSeek.value = cur;
                }
                if (cineCur && !window.isUserDraggingCineSeek) cineCur.innerText = formatTimeShort(cur);
                if (cineTot && dur > 0) cineTot.innerText = formatTimeShort(dur);
            }, 1000);
        }

        function renderPlayerConnectIndicator() {
            const target = window.KRAKEN_PLAYBACK_TARGET || window.KRAKEN_CONTROL_TARGET || null;
            const isTarget = !!(target && target.session_id && target.session_id !== MY_SESSION_ID);

            // Boton movil
            const btnMob = document.getElementById('btn-connect-mobile');
            const indMob = document.getElementById('connect-indicator-mobile');
            if (btnMob) {
                if (isTarget) {
                    btnMob.className = 'text-emerald-400 px-2 transition relative';
                    if (indMob) indMob.classList.remove('hidden');
                } else {
                    btnMob.className = 'text-zinc-500 hover:text-emerald-400 px-2 transition relative';
                    if (indMob) indMob.classList.add('hidden');
                }
            }

            // Boton escritorio
            const btnDesk = document.getElementById('btn-connect-desktop');
            const indDesk = document.getElementById('connect-indicator-desktop');
            if (btnDesk) {
                if (isTarget) {
                    btnDesk.className = 'text-emerald-400 hover:text-emerald-300 transition relative p-2';
                    if (indDesk) indDesk.classList.remove('hidden');
                } else {
                    btnDesk.className = 'text-zinc-400 hover:text-emerald-400 transition relative p-2';
                    if (indDesk) indDesk.classList.add('hidden');
                }
            }
        }
        window.renderPlayerConnectIndicator = renderPlayerConnectIndicator;

        /**
         * `selectConnectDevice(targetSid)`
         * Selecciona un dispositivo destino para salida y control remoto unificado (estilo Spotify Connect).
         */
        function selectConnectDevice(targetSid) {
            if (!targetSid || targetSid === 'local' || targetSid === MY_SESSION_ID) {
                clearPlaybackTarget(true);
                unlinkControlledDevice(true);
                document.getElementById('connect-devices-modal')?.remove();
                showToast('🔈 Reproduciendo en este equipo (Salida local)', 'info');
                renderPlayerConnectIndicator();
                return;
            }

            const target = (LAST_USERS_DATA || []).find(u => u.session_id === targetSid);
            if (!target) {
                showToast('Ese dispositivo ya no está en línea', 'warning');
                return;
            }

            // CRÍTICO: Si el reproductor de video local está abierto, transferirlo a la TV,
            // cerrar el video local y abrir Cine Remote de inmediato:
            const activeVideo = document.querySelector('#cine-screen video, #artplayer-container video, #main-video');
            const currentVideo = window.currentVideoFile;
            const viewPlayer = document.getElementById('view-player');
            const isLocalVideoOpen = viewPlayer && !viewPlayer.classList.contains('hidden');

            if (isLocalVideoOpen && currentVideo) {
                const videoToTransfer = { ...currentVideo };
                const curSec = Math.floor(activeVideo ? (activeVideo.currentTime || 0) : 0);

                // 1. Vincular target
                linkControlledDevice(targetSid);
                applyPlaybackTargetState(target);
                applyControlledTargetState(target);
                localStorage.setItem(KRAKEN_PLAYBACK_TARGET_KEY, target.session_id);

                document.getElementById('connect-devices-modal')?.remove();
                renderPlayerConnectIndicator();

                // 2. Cerrar reproductor local
                if (typeof exitVideoMode === 'function') {
                    exitVideoMode();
                }

                // 3. Enviar a la TV remota y saltar al segundo exacto
                if (typeof sendFileToControlledDevice === 'function') {
                    sendFileToControlledDevice(videoToTransfer, target);
                }
                setTimeout(() => {
                    if (curSec > 0) sendCommand(targetSid, 'seek_to_' + curSec);
                }, 1200);

                // 4. Abrir Cine Remote
                if (typeof showCineRemoteModal === 'function') {
                    showCineRemoteModal(videoToTransfer, target);
                }
                showToast(`📡 Transmitiendo "${videoToTransfer.title}" a ${getDeviceDisplayName(target)}`, 'success');
                return;
            }

            // Establece objetivo de reproduccion y control unificados (Spotify Connect)
            linkControlledDevice(targetSid);
            applyPlaybackTargetState(target);
            applyControlledTargetState(target);
            localStorage.setItem(KRAKEN_PLAYBACK_TARGET_KEY, target.session_id);

            // Transferir música si está sonando localmente hacia la TV / pantalla:
            const curAudio = (typeof playerQueue !== 'undefined' && currentTrackIndex >= 0) ? playerQueue[currentTrackIndex] : null;
            if (curAudio && typeof audioElement !== 'undefined' && audioElement && !audioElement.paused) {
                if (typeof sendFileToControlledDevice === 'function') {
                    sendFileToControlledDevice(curAudio, target);
                }
                const curSec = Math.floor(audioElement.currentTime || 0);
                setTimeout(() => {
                    if (curSec > 0) sendCommand(targetSid, 'seek_to_' + curSec);
                }, 1000);
                audioElement.pause();
                audioElement.src = '';
            }

            document.getElementById('connect-devices-modal')?.remove();
            renderPlayerConnectIndicator();
            syncMirroredPlayerUI(target);
            showToast(`🟢 Conectado a ${getDeviceDisplayName(target)}. Tu reproductor ahora lo refleja y controla.`, 'success');
        }
        window.selectConnectDevice = selectConnectDevice;

        /**
         * `showConnectModal()`
         * Modal elegante estilo Spotify Connect para seleccionar dispositivo de salida y control remoto.
         */
        function showConnectModal() {
            const modalId = 'connect-devices-modal';
            document.getElementById(modalId)?.remove();
            document.getElementById('control-modal')?.remove();

            const currentTarget = window.KRAKEN_PLAYBACK_TARGET || window.KRAKEN_CONTROL_TARGET || null;
            const isLocalActive = !currentTarget || currentTarget.session_id === MY_SESSION_ID;

            const myEmail = (window.MY_EMAIL || '').toLowerCase().trim();
            const myName = (window.MY_NAME || '').toLowerCase().trim();

            const otherDevices = (LAST_USERS_DATA || []).filter(u => {
                if (!u || !u.session_id || u.session_id === MY_SESSION_ID) return false;

                const uEmail = (u.email || '').toLowerCase().trim();
                const uName = (u.name || '').toLowerCase().trim();
                const uDevName = (u.device_name || '').toLowerCase().trim();
                const uDevType = (u.device_type || '').toLowerCase().trim();

                // Dispositivos propios: cel, tablet, laptop, Smart TV de la MISMA cuenta
                const isSameUser = Boolean(
                    u.is_me ||
                    (myEmail && uEmail && uEmail === myEmail) ||
                    (myName && uName && uName === myName)
                );

                // En Spotify Connect solo se listan dispositivos propios de la cuenta.
                // Los invitados o amigos remotos NUNCA ven ni controlan altavoces o pantallas ajenas.
                return isSameUser;
            });

            let devicesListHtml = '';

            // 1. Opcion "Este equipo"
            devicesListHtml += `
            <div onclick="selectConnectDevice('local')" 
                 class="group flex items-center justify-between p-3.5 rounded-2xl mb-2 transition cursor-pointer border ${isLocalActive ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-white/5 hover:bg-white/10 border-white/5'}">
                <div class="flex items-center gap-3.5 min-w-0">
                    <div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isLocalActive ? 'bg-emerald-500 text-black' : 'bg-white/10 text-zinc-300 group-hover:text-white'}">
                        <i class="fa-solid fa-laptop text-lg"></i>
                    </div>
                    <div class="min-w-0">
                        <div class="text-sm font-bold text-white truncate flex items-center gap-2">
                            Este equipo
                            ${isLocalActive ? '<span class="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">Activo</span>' : ''}
                        </div>
                        <div class="text-[11px] ${isLocalActive ? 'text-emerald-400 font-medium' : 'text-zinc-500'}">
                            ${isLocalActive ? 'Reproduciendo en este altavoz' : 'Toca para escuchar aquí'}
                        </div>
                    </div>
                </div>
                ${isLocalActive ? `
                <div class="flex items-center gap-1.5 text-emerald-400 text-xs font-bold shrink-0">
                    <span class="krk-eq-bars flex items-end gap-0.5 h-3.5">
                        <span class="w-1 bg-emerald-400 rounded-full animate-bounce h-2"></span>
                        <span class="w-1 bg-emerald-400 rounded-full animate-bounce h-3.5" style="animation-delay: 0.15s"></span>
                        <span class="w-1 bg-emerald-400 rounded-full animate-bounce h-2.5" style="animation-delay: 0.3s"></span>
                    </span>
                </div>` : `
                <i class="fa-solid fa-chevron-right text-zinc-600 text-xs group-hover:text-zinc-400 transition shrink-0"></i>`}
            </div>`;

            // 2. Dispositivos remotos en la red
            if (otherDevices.length > 0) {
                otherDevices.forEach(d => {
                    const isTarget = currentTarget && currentTarget.session_id === d.session_id;
                    const isTv = d.device_type === 'tv' || (d.name && d.name.toLowerCase().includes('tv'));
                    const isMobile = d.device_type === 'mobile' || (d.device_name && /android|iphone|phone/i.test(d.device_name));

                    const iconClass = isTv ? 'fa-solid fa-tv' : (isMobile ? 'fa-solid fa-mobile-screen' : 'fa-solid fa-laptop');
                    const iconBg = isTarget ? 'bg-emerald-500 text-black' : (isTv ? 'bg-cyan-500/10 text-cyan-400' : 'bg-white/10 text-zinc-300');
                    const rowBorder = isTarget ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-white/5 hover:bg-white/10 border-white/5';

                    const displayName = getDeviceDisplayName(d);
                    const statusText = isTarget 
                        ? 'Conectado · Control remoto activo'
                        : (d.song && d.song !== 'Reproductor' ? `Sonando: ${d.song}` : 'En línea · Toca para transferir');

                    devicesListHtml += `
                    <div onclick="selectConnectDevice('${d.session_id}')" 
                         class="group flex items-center justify-between p-3.5 rounded-2xl mb-2 transition cursor-pointer border ${rowBorder}">
                        <div class="flex items-center gap-3.5 min-w-0">
                            <div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg}">
                                <i class="${iconClass} text-lg"></i>
                            </div>
                            <div class="min-w-0">
                                <div class="text-sm font-bold text-white truncate flex items-center gap-2">
                                    ${displayName}
                                    ${isTarget ? '<span class="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">Conectado</span>' : ''}
                                </div>
                                <div class="text-[11px] truncate ${isTarget ? 'text-emerald-400 font-medium' : 'text-zinc-500'}">
                                    ${statusText}
                                </div>
                            </div>
                        </div>
                        ${isTarget ? `
                        <div class="flex items-center gap-1.5 text-emerald-400 text-xs font-bold shrink-0">
                            <span class="krk-eq-bars flex items-end gap-0.5 h-3.5">
                                <span class="w-1 bg-emerald-400 rounded-full animate-bounce h-2"></span>
                                <span class="w-1 bg-emerald-400 rounded-full animate-bounce h-3.5" style="animation-delay: 0.15s"></span>
                                <span class="w-1 bg-emerald-400 rounded-full animate-bounce h-2.5" style="animation-delay: 0.3s"></span>
                            </span>
                        </div>` : `
                        <i class="fa-solid fa-chevron-right text-zinc-600 text-xs group-hover:text-zinc-400 transition shrink-0"></i>`}
                    </div>`;
                });
            } else {
                devicesListHtml += `
                <div class="text-center py-6 px-4 bg-white/[0.02] border border-white/5 rounded-2xl text-zinc-500 text-xs">
                    <i class="fa-solid fa-tower-cell text-2xl mb-2 text-zinc-600 block"></i>
                    No hay otros dispositivos en línea ahora mismo.<br>
                    <span class="text-[11px] text-zinc-600 mt-1 block">Abre KrakenTV o Kraken en tu TV o celular para transferir la música.</span>
                </div>`;
            }

            const modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md animate-fade-in';
            modal.onclick = e => { if (e.target === modal) modal.remove(); };

            modal.innerHTML = `
            <div class="bg-[#121212] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
                <div class="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500"></div>

                <div class="p-5 flex-1 overflow-y-auto custom-scroll">
                    <div class="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
                        <div class="flex items-center gap-2.5">
                            <div class="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                                <i class="fa-solid fa-tower-broadcast text-sm"></i>
                            </div>
                            <div>
                                <h3 class="text-base font-black text-white tracking-wide">Conectar a un dispositivo</h3>
                                <p class="text-[11px] text-zinc-400">Kraken Connect · Control remoto universal</p>
                            </div>
                        </div>
                        <button onclick="document.getElementById('${modalId}').remove()" class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition">
                            <i class="fa-solid fa-xmark text-sm"></i>
                        </button>
                    </div>

                    <div class="mb-4">
                        <div class="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-2">Estás escuchando en</div>
                        <div class="p-3.5 bg-gradient-to-br from-emerald-950/40 via-zinc-900/60 to-black border border-emerald-500/30 rounded-2xl flex items-center justify-between">
                            <div class="flex items-center gap-3 min-w-0">
                                <div class="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                                    <i class="${isLocalActive ? 'fa-solid fa-laptop' : 'fa-solid fa-tv'} text-base"></i>
                                </div>
                                <div class="min-w-0">
                                    <div class="text-xs font-bold text-white truncate">
                                        ${isLocalActive ? 'Este equipo (Salida local)' : getDeviceDisplayName(currentTarget)}
                                    </div>
                                    <div class="text-[10px] text-emerald-400 flex items-center gap-1.5 mt-0.5">
                                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                                        ${isLocalActive ? 'Altavoz de este dispositivo' : 'Control remoto activo'}
                                    </div>
                                </div>
                            </div>
                            ${!isLocalActive ? `
                            <button onclick="selectConnectDevice('local')" class="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-zinc-300 hover:text-white text-[11px] font-medium transition shrink-0">
                                Volver a local
                            </button>` : ''}
                        </div>
                    </div>

                    <div class="mb-5">
                        <div class="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-2">Selecciona un dispositivo</div>
                        ${devicesListHtml}
                    </div>

                    <div class="mb-4 p-3 bg-white/[0.03] border border-white/10 rounded-2xl">
                        <div class="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-emerald-400 mb-2">
                            <i class="fa-solid fa-qrcode"></i> Vincular Pantalla TV con Código
                        </div>
                        <div class="flex gap-2">
                            <input id="connect-tv-qr-code-input" type="text" maxlength="6" placeholder="Ej. A7X9P2"
                                class="flex-1 bg-black/50 border border-white/15 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white font-mono tracking-widest uppercase outline-none"
                                onkeydown="if(event.key==='Enter') window.approveTvCodeFromModal()" />
                            <button onclick="window.approveTvCodeFromModal()"
                                class="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition shrink-0">
                                Autorizar TV
                            </button>
                        </div>
                        <div id="connect-tv-qr-status" class="text-[11px] text-zinc-400 mt-1.5 hidden"></div>
                    </div>

                    <div class="pt-4 border-t border-white/5 flex gap-2">
                        <button onclick="document.getElementById('${modalId}').remove(); showEditProfileModal();"
                            class="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/40 rounded-xl py-2.5 text-xs text-zinc-300 hover:text-emerald-300 transition font-medium">
                            <i class="fa-solid fa-pen text-emerald-400"></i> Mi Perfil
                        </button>
                        <button onclick="copyCurrentPlaylistLink('${modalId}')"
                            class="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/40 rounded-xl py-2.5 text-xs text-zinc-300 hover:text-cyan-300 transition font-medium">
                            <i class="fa-solid fa-link text-cyan-400"></i> Compartir Lista
                        </button>
                    </div>
                </div>
            </div>`;

            document.body.appendChild(modal);
        }
        window.showConnectModal = showConnectModal;

        async function approveTvCodeFromModal() {
            const input = document.getElementById('connect-tv-qr-code-input');
            const statusEl = document.getElementById('connect-tv-qr-status');
            if (!input || !statusEl) return;
            const code = (input.value || '').trim().toUpperCase();
            statusEl.classList.remove('hidden');
            if (!code || code.length < 4) {
                statusEl.className = 'text-[11px] text-amber-400 mt-1.5';
                statusEl.textContent = 'Escribe el código de 6 caracteres que aparece en tu TV.';
                return;
            }
            statusEl.className = 'text-[11px] text-zinc-300 mt-1.5';
            statusEl.textContent = 'Autorizando pantalla...';
            try {
                const headers = Object.assign(
                    { 'Content-Type': 'application/json' },
                    (window.krakenAuth && typeof window.krakenAuth.headers === 'function') ? window.krakenAuth.headers() : {}
                );
                const res = await fetch('/api/tv/qr/approve', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ code })
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && (data.ok || data.status === 'approved')) {
                    statusEl.className = 'text-[11px] text-emerald-400 font-semibold mt-1.5';
                    statusEl.textContent = '✅ ¡Pantalla vinculada! Tu TV entrará sola en unos segundos.';
                    input.value = '';
                } else {
                    statusEl.className = 'text-[11px] text-red-400 mt-1.5';
                    statusEl.textContent = data.error || 'Código inválido o expirado. Genera uno nuevo en la TV.';
                }
            } catch (err) {
                statusEl.className = 'text-[11px] text-red-400 mt-1.5';
                statusEl.textContent = 'Error de conexión con el servidor.';
            }
        }
        window.approveTvCodeFromModal = approveTvCodeFromModal;

        /**
         * `showFriendModal(userName)`
         * Modal de perfil social y 'Escucha Activa' (Spotify Jam) para amigos en el radar.
         */
        function showFriendModal(userName) {
            const modalId = 'control-modal';
            document.getElementById(modalId)?.remove();
            document.getElementById('connect-devices-modal')?.remove();

            const devices = (LAST_USERS_DATA || []).filter(u => u.name === userName);
            if (devices.length === 0) return;

            const dev = devices[0];
            const isSuperAdmin = dev.is_superadmin;
            const avatar = dev.avatar;
            const hasSong = dev.song && dev.song !== 'Reproductor';
            const isJamming = !!(window.KRAKEN_SYNC_JAM && (window.KRAKEN_SYNC_JAM.targetSid === dev.session_id || window.KRAKEN_SYNC_JAM.friendName === userName));

            const avatarHtml = avatar
                ? `<img src="${avatar}" class="w-full h-full object-cover">`
                : `<span class="text-3xl font-black">${userName.charAt(0).toUpperCase()}</span>`;

            const ringClass = isSuperAdmin
                ? 'ring-4 ring-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.6)]'
                : 'ring-4 ring-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)]';

            const emojis = ['👋', '❤️', '🔥', '👻', '🤬', '😂', '🎉', '🤘'];
            const emojiHtml = emojis.map(e =>
                `<button onclick="sendCommand('${dev.session_id}','emoji_${e}')" class="text-xl hover:scale-125 transition-transform" title="${e}">${e}</button>`
            ).join('');

                        const isAudioFile = dev.path && /\.(mp3|flac|m4a|wav|ogg|aac|opus|wma)$/i.test(dev.path);
            const isVideoFile = dev.path && /\.(mp4|mkv|avi|webm|m4v|mov)$/i.test(dev.path);
            const isVideoMedia = !isAudioFile && (dev.media_type === 'video' || isVideoFile);
            const isWatchingTogether = !!(window.KRAKEN_SYNC_WATCH_PARTY && (window.KRAKEN_SYNC_WATCH_PARTY.targetSid === dev.session_id || window.KRAKEN_SYNC_WATCH_PARTY.friendName === userName));

            let jamCardHtml = '';
            if (hasSong && isVideoMedia) {
                jamCardHtml = `
                <div class="p-4 rounded-2xl bg-gradient-to-br from-amber-950/40 via-zinc-900/80 to-black border border-amber-500/30 mb-4 shadow-xl">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-[10px] uppercase font-bold tracking-widest text-amber-400 flex items-center gap-1.5">
                            <i class="fa-solid fa-clapperboard"></i> Watch Party (Ver Juntos)
                        </span>
                        <span class="text-[10px] font-mono text-zinc-400">
                            ${dev.time ? `${formatTimeShort(dev.time)} / ${formatTimeShort(dev.duration)}` : 'En vivo'}
                        </span>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0">
                            <i class="fa-solid fa-film text-sm"></i>
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="text-sm font-bold text-white truncate">🍿 ${dev.song}</div>
                            <div class="text-xs text-zinc-400 truncate">Película / Serie</div>
                        </div>
                    </div>

                    ${isWatchingTogether ? `
                    <div class="mt-3 pt-3 border-t border-amber-500/20">
                        <div class="flex items-center gap-2 text-xs font-semibold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-xl mb-3">
                            <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                            Estás viendo en sintonía con ${userName}
                        </div>
                        <div class="flex gap-2">
                            <button onclick="resyncWatchParty()" class="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-md">
                                <i class="fa-solid fa-arrows-rotate text-[11px]"></i> Resincronizar tiempo
                            </button>
                            <button onclick="stopWatchParty(); document.getElementById('${modalId}')?.remove();" class="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5">
                                <i class="fa-solid fa-xmark text-[11px]"></i> Dejar de ver
                            </button>
                        </div>
                    </div>` : `
                    <button onclick="startWatchParty('${dev.session_id}', '${userName.replace(/'/g, "\\'")}', '${(dev.path || '').replace(/'/g, "\\'")}', '${(dev.song || '').replace(/'/g, "\\'")}', ${Number(dev.time) || 0}); document.getElementById('${modalId}').remove();"
                        class="mt-3 w-full bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50">
                        <i class="fa-solid fa-clapperboard text-sm"></i> Sintonizar y ver juntos
                    </button>
                    <div class="text-[10px] text-zinc-500 text-center mt-1.5">Reproduce en el mismo segundo exacto de ${userName}</div>`}
                </div>`;
            } else if (hasSong) {
                jamCardHtml = `
                <div class="p-4 rounded-2xl bg-gradient-to-br from-purple-950/40 via-zinc-900/80 to-black border border-purple-500/30 mb-4 shadow-xl">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-[10px] uppercase font-bold tracking-widest text-purple-400 flex items-center gap-1.5">
                            <i class="fa-solid fa-headphones"></i> Escucha Activa (Jam)
                        </span>
                        <span class="text-[10px] font-mono text-zinc-400">
                            ${dev.time ? `${formatTimeShort(dev.time)} / ${formatTimeShort(dev.duration)}` : 'Sonando'}
                        </span>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0">
                            <i class="fa-solid fa-music text-sm"></i>
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="text-sm font-bold text-white truncate">🎵 ${dev.song}</div>
                            <div class="text-xs text-zinc-400 truncate">${dev.artist || 'Artista desconocido'}</div>
                        </div>
                    </div>

                    ${isJamming ? `
                    <div class="mt-3 pt-3 border-t border-purple-500/20">
                        <div class="flex items-center gap-2 text-xs font-semibold text-purple-300 bg-purple-500/20 border border-purple-500/30 px-3 py-1.5 rounded-xl mb-3">
                            <span class="w-2 h-2 rounded-full bg-purple-400 animate-ping"></span>
                            Estás escuchando en sintonía con ${userName}
                        </div>
                        <div class="flex gap-2">
                            <button onclick="resyncJamSession()" class="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-md">
                                <i class="fa-solid fa-arrows-rotate text-[11px]"></i> Resincronizar tiempo
                            </button>
                            <button onclick="stopJamSession(); document.getElementById('${modalId}')?.remove();" class="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5">
                                <i class="fa-solid fa-xmark text-[11px]"></i> Dejar de escuchar
                            </button>
                        </div>
                    </div>` : `
                    <button onclick="startJamSession('${dev.session_id}', '${userName.replace(/'/g, "\\'")}', '${(dev.path || '').replace(/'/g, "\\'")}', '${(dev.song || '').replace(/'/g, "\\'")}', '${(dev.artist || '').replace(/'/g, "\\")}'); document.getElementById('${modalId}').remove();"
                        class="mt-3 w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-purple-950/50">
                        <i class="fa-solid fa-headphones text-sm"></i> Sintonizar y escuchar juntos
                    </button>
                    <div class="text-[10px] text-zinc-500 text-center mt-1.5">Reproduce exactamente lo que escucha ${userName} en tiempo real</div>`}
                </div>`;
            } else {
                jamCardHtml = `
                <div class="p-4 rounded-2xl bg-black/30 border border-white/5 text-center mb-4">
                    <i class="fa-solid fa-headphones-simple text-zinc-600 text-2xl mb-1.5 block"></i>
                    <div class="text-xs text-zinc-400 font-medium">${userName} no está reproduciendo música</div>
                    <div class="text-[10px] text-zinc-600 mt-0.5">Cuando empiece una canción, podrás sintonizarte con un toque</div>
                </div>`;
            }

            const modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md animate-fade-in';
            modal.onclick = e => { if (e.target === modal) modal.remove(); };

            modal.innerHTML = `
            <div class="bg-[#121212] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm shadow-2xl overflow-hidden animate-slide-up">
                <div class="h-1.5 w-full ${isSuperAdmin ? 'bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400' : 'bg-gradient-to-r from-purple-600 via-indigo-500 to-blue-500'}"></div>

                <div class="p-5">
                    <div class="flex items-center gap-4 mb-5">
                        <div class="relative shrink-0">
                            <div class="w-16 h-16 rounded-full overflow-hidden ${ringClass} bg-zinc-800">
                                ${avatarHtml}
                            </div>
                            ${isSuperAdmin ? '<div class="absolute -top-2 left-1/2 -translate-x-1/2 text-base leading-none">👑</div>' : ''}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <h3 class="font-black text-white text-lg leading-tight truncate">${userName}</h3>
                            </div>
                            <div class="text-[10px] text-emerald-400 flex items-center gap-1.5 mt-0.5">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> En línea · ${getDeviceDisplayName(dev)}
                            </div>
                        </div>
                        <button onclick="document.getElementById('${modalId}').remove()" class="shrink-0 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition">
                            <i class="fa-solid fa-xmark text-sm"></i>
                        </button>
                    </div>

                    ${jamCardHtml}

                    <div class="grid grid-cols-2 gap-2 mb-4">
                        <button onclick="sendQuickMessage('${dev.session_id}','${userName}')"
                            class="flex items-center justify-center gap-2 bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/40 rounded-xl py-2.5 text-xs text-zinc-300 hover:text-blue-300 transition font-medium">
                            <i class="fa-solid fa-message text-blue-400"></i> Mensaje
                        </button>
                        <button onclick="recommendSong('${dev.session_id}','${userName}'); document.getElementById('${modalId}').remove();"
                            class="flex items-center justify-center gap-2 bg-white/5 hover:bg-yellow-500/20 border border-white/10 hover:border-yellow-500/40 rounded-xl py-2.5 text-xs text-zinc-300 hover:text-yellow-300 transition font-medium">
                            <i class="fa-solid fa-star text-yellow-400"></i> Recomendar
                        </button>
                    </div>
                    <button onclick="sendCurrentTrackToTarget('${dev.session_id}', '${userName.replace(/'/g, "\\\'")}'); document.getElementById('${modalId}').remove();"
                        class="w-full flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl py-2.5 text-xs text-emerald-300 hover:text-emerald-200 transition font-medium mb-4">
                        <i class="fa-solid fa-paper-plane text-emerald-400"></i> Transmitir lo que suena a ${userName}
                    </button>

                    <div class="bg-black/40 rounded-2xl px-3 py-2.5 border border-white/5">
                        <div class="text-[9px] text-zinc-600 uppercase tracking-widest mb-2 font-bold">Enviar Reacción Rápida</div>
                        <div class="flex justify-between">${emojiHtml}</div>
                    </div>
                </div>
            </div>`;

            document.body.appendChild(modal);
        }
        window.showFriendModal = showFriendModal;

        /**
         * `showControlMenu(userName)`
         * Redirige al modal de Connect (para si mismo/dispositivos propios) o al modal de amigo/Jam.
         */
        function showControlMenu(userName) {
            const myName = (window.MY_NAME || MY_NAME || '').trim().toLowerCase();
            const targetName = (userName || '').trim().toLowerCase();

            // Si es el propio usuario o no se especifica, abrir Spotify Connect
            if (!userName || myName === targetName) {
                showConnectModal();
            } else {
                showFriendModal(userName);
            }
        }
        window.showControlMenu = showControlMenu;

        /**
         * `startJamSession(targetSid, friendName, path, song, artist)`
         * Inicia una sesion de escucha activa en tiempo real con un amigo.
         */
        function startJamSession(targetSid, friendName, path, song, artist) {
            if (!path && !song) {
                showToast('No se puede sintonizar: falta información de la pista', 'warning');
                return;
            }

            window.KRAKEN_SYNC_JAM = {
                targetSid: targetSid,
                friendName: friendName,
                lastSong: song,
                lastPath: path
            };
            try {
                localStorage.setItem('kraken_sync_jam', JSON.stringify(window.KRAKEN_SYNC_JAM));
            } catch (_) {}

            listenSame(targetSid, path, song, artist);
            renderJamBanner();
            showToast(`🎧 Sintonizado con ${friendName}: ${song}`, 'success');
        }
        window.startJamSession = startJamSession;

        /**
         * `resyncJamSession()`
         * Alinea exactamente el tiempo de reproduccion local con el anfitrion.
         */
        function resyncJamSession() {
            if (!window.KRAKEN_SYNC_JAM) return;
            const friend = (LAST_USERS_DATA || []).find(u => 
                u.session_id === window.KRAKEN_SYNC_JAM.targetSid || u.name === window.KRAKEN_SYNC_JAM.friendName
            );
            if (!friend) {
                showToast('El anfitrión ya no está en línea', 'warning');
                return;
            }
            if (friend.time && audioElement && audioElement.duration) {
                const targetSeconds = Math.max(0, Math.min(audioElement.duration, Number(friend.time) || 0));
                audioElement.currentTime = targetSeconds;
                showToast(`🔄 Resincronizado con ${friend.name} (${formatTimeShort(targetSeconds)})`, 'success');
            } else {
                showToast('Sincronizando estado...', 'info');
            }
        }
        window.resyncJamSession = resyncJamSession;

        /**
         * `stopJamSession(silent)`
         * Detiene la sesion Jam y vuelve al modo independiente.
         */
        function stopJamSession(silent = false) {
            window.KRAKEN_SYNC_JAM = null;
            try {
                localStorage.removeItem('kraken_sync_jam');
            } catch (_) {}
            document.getElementById('jam-session-banner')?.remove();
            if (!silent) showToast('Saliste de la sesión Jam', 'info');
        }
        window.stopJamSession = stopJamSession;

        /**
         * `renderJamBanner()`
         * Renderiza el controlador flotante de la sesion Jam activa sobre la barra de reproduccion.
         */
        function renderJamBanner() {
            let banner = document.getElementById('jam-session-banner');
            if (!window.KRAKEN_SYNC_JAM) {
                if (banner) banner.remove();
                return;
            }

            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'jam-session-banner';
                banner.className = 'fixed bottom-[115px] md:bottom-[120px] left-1/2 -translate-x-1/2 z-[250] bg-[#121212]/95 border border-purple-500/40 shadow-2xl backdrop-blur-xl rounded-full px-4 py-2 flex items-center gap-3 animate-slide-up max-w-[92vw] pointer-events-auto';
                document.body.appendChild(banner);
            }

            const jam = window.KRAKEN_SYNC_JAM;
            banner.innerHTML = `
                <div class="flex items-center gap-2 min-w-0 cursor-pointer" onclick="showFriendModal('${jam.friendName.replace(/'/g, "\\'")}')">
                    <span class="w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping shrink-0"></span>
                    <div class="text-xs font-bold text-white truncate">
                        Jam con <span class="text-purple-300">${jam.friendName}</span>
                        <span class="text-[11px] text-zinc-400 font-normal hidden sm:inline truncate"> · ${jam.lastSong || 'Música'}</span>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button onclick="resyncJamSession()" class="px-2.5 py-1 rounded-full bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-[11px] font-semibold flex items-center gap-1 transition" title="Resincronizar tiempo con el anfitrión">
                        <i class="fa-solid fa-arrows-rotate text-[10px]"></i> Sincronizar
                    </button>
                    <button onclick="stopJamSession()" class="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center text-xs transition" title="Salir del Jam">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>`;
        }
        window.renderJamBanner = renderJamBanner;

        /**
         * `listenSame(targetSid, path, song, artist)`
         * Sincroniza la reproduccion local con la cancion que esta escuchando otro usuario.
         */
        function listenSame(targetSid, path, song, artist) {
            if (!path && !song) { showToast('Este usuario no está reproduciendo nada', 'warning'); return; }

            let match = null;
            if (window.libData?.files?.length) {
                match = window.libData.files.find(t => (path && t.path === path) || (song && t.title === song));
            }
            const payloadTrack = match || { path: path || '', title: song || 'Canción', artist: artist || '', album: '', genre: '', type: 'audio' };

            let targetTime = 0;
            if (targetSid && window.LAST_USERS_DATA) {
                const friend = window.LAST_USERS_DATA.find(u => u.session_id === targetSid);
                if (friend && friend.time) targetTime = Number(friend.time) || 0;
            }

            // SI HAY UN DESTINO REMOTO ACTIVO (TV / PC): Enviar la cancion al equipo destino ("usuario final")!
            if (window.KRAKEN_PLAYBACK_TARGET && window.KRAKEN_PLAYBACK_TARGET.session_id) {
                sendFileToControlledDevice(payloadTrack, window.KRAKEN_PLAYBACK_TARGET);
                if (targetTime > 0) {
                    setTimeout(() => sendCommand(window.KRAKEN_PLAYBACK_TARGET.session_id, `seek_to_${Math.floor(targetTime)}`), 600);
                }
                if (window.KRAKEN_CONTROL_TARGET) {
                    window.KRAKEN_CONTROL_TARGET.song = payloadTrack.title;
                    window.KRAKEN_CONTROL_TARGET.artist = payloadTrack.artist || '';
                    window.KRAKEN_CONTROL_TARGET.path = payloadTrack.path;
                    window.KRAKEN_CONTROL_TARGET.time = targetTime;
                    window.KRAKEN_CONTROL_TARGET.duration = payloadTrack.duration || 0;
                    window.KRAKEN_CONTROL_TARGET.is_playing = true;
                    syncMirroredPlayerUI(window.KRAKEN_CONTROL_TARGET);
                }
                showToast(`📡 Sintonizado en ${getDeviceDisplayName(window.KRAKEN_PLAYBACK_TARGET)}: ${payloadTrack.title}`, 'success');
                return;
            }

            // MODO LOCAL (reproducir en este equipo):
            if (match) {
                playTrack(match, window.libData.files);
            } else {
                playerQueue = [payloadTrack];
                currentTrackIndex = 0;
                playTrack(payloadTrack, [payloadTrack]);
            }

            if (targetTime > 0 && audioElement) {
                const onMeta = () => {
                    if (audioElement) audioElement.currentTime = targetTime;
                    audioElement.removeEventListener('loadedmetadata', onMeta);
                };
                audioElement.addEventListener('loadedmetadata', onMeta);
                setTimeout(() => {
                    if (audioElement && audioElement.currentTime < targetTime) {
                        audioElement.currentTime = targetTime;
                    }
                }, 800);
            }
        }
        window.listenSame = listenSame;

        /**
         * `sendQuickMessage(targetSid, targetName)`
         * Envía un mensaje emergente instantáneo a la pantalla de otro usuario.
         */
        function sendQuickMessage(targetSid, targetName) {
            const msgModalId = 'quick-msg-modal';
            document.getElementById(msgModalId)?.remove();
            const msgModal = document.createElement('div');
            msgModal.id = msgModalId;
            msgModal.className = 'fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm';
            msgModal.onclick = e => { if (e.target === msgModal) msgModal.remove(); };
            msgModal.innerHTML = `
                <div class="bg-[#141414] border border-white/10 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-xs shadow-2xl p-5">
                    <div class="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Mensaje a</div>
                    <h3 class="text-white font-bold text-lg mb-4">${targetName}</h3>
                    <input id="quick-msg-input" type="text" maxlength="80" placeholder="Escribe algo..." 
                           class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition mb-3">
                    <div class="flex gap-2">
                        <button onclick="
                            const txt = document.getElementById('quick-msg-input').value.trim();
                            if (!txt) return;
                            sendCommand('${targetSid}', 'msg_' + encodeURIComponent(txt));
                            document.getElementById('${msgModalId}').remove();
                            document.getElementById('control-modal')?.remove();
                            showToast('💬 Mensaje enviado', 'success');"
                            class="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-sm transition">
                            <i class="fa-solid fa-paper-plane mr-1"></i> Enviar
                        </button>
                        <button onclick="document.getElementById('${msgModalId}').remove()"
                            class="w-12 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 rounded-xl transition">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>`;
            document.body.appendChild(msgModal);
            setTimeout(() => document.getElementById('quick-msg-input')?.focus(), 100);
        }

        /**
         * `recommendSong(targetSid, targetName)`
         * Envía una recomendación de la pista actual a otro usuario conectado.
         */
        function recommendSong(targetSid, targetName) {
            const cur = playerQueue[currentTrackIndex];
            if (!cur) { showToast('No hay canción en reproducción para recomendar', 'warning'); return; }
            const payload = JSON.stringify({ title: cur.title, artist: cur.artist, path: cur.path });
            sendCommand(targetSid, `recommend_${payload}`);
            showToast(`⭐ Recomendando "${cur.title}" a ${targetName}`, 'success');
        }

        /**
         * `copyCurrentPlaylistLink(modalId)`
         * Copia al portapapeles el enlace de la canción o playlist actual.
         */
        async function copyCurrentPlaylistLink(modalId) {
            const playlist = window.currentPlaylist || window.activePlaylistName;
            if (!playlist) { showToast('No hay una playlist activa', 'warning'); return; }
            try {
                const res = await fetch('/playlist/share', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: playlist, owner: window.MY_EMAIL })
                });
                const d = await res.json();
                if (d.ok) {
                    navigator.clipboard.writeText(d.code).catch(() => { });
                    document.getElementById(modalId)?.remove();
                    showToast(`🔗 Código "${d.code}" copiado — Playlist: ${playlist}`, 'success');
                } else {
                    showToast(d.error || 'Error generando código', 'error');
                }
            } catch (e) {
                showToast('Error de conexión', 'error');
            }
        }



        /**
         * `showEmojiModal(emojiChar)`
         * Abre el selector de reacciones con emojis para enviar a otro usuario.
         */
        function showEmojiModal(emojiChar) {
            // 1. Sonidito de notificación (opcional, usa el del sistema o crea uno simple)
            // const audio = new Audio('/static/notification.mp3'); audio.play().catch(e=>{});

            // 2. Crear Modal
            const modalId = 'emoji-overlay';
            // Si ya hay uno, lo quitamos para poner el nuevo
            const existing = document.getElementById(modalId);
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in';

            // Al dar clic en cualquier lado, se cierra
            modal.onclick = () => { modal.remove(); };

            modal.innerHTML = `
    <div class="relative flex flex-col items-center animate-bounce-in">
        <div class="text-[150px] drop-shadow-2xl filter hover:scale-110 transition-transform cursor-pointer">
            ${emojiChar}
        </div>
        
        <div class="mt-8 text-white/50 text-sm font-light bg-white/10 px-4 py-1 rounded-full border border-white/5">
            Toca para cerrar
        </div>
    </div>
`;
            document.body.appendChild(modal);
        }

        // Función para enviar la orden al servidor
        /**
         * `sendCommand(targetSid, action)`
         * Envía un comando de control o reacción a `/api/command` dirigido a otra sesión.
         */
        async function sendCommand(targetSid, action) {
            const resolvedTarget = targetSid || window._activeCineRemoteData?.targetSid || window.KRAKEN_PLAYBACK_TARGET?.session_id || window.KRAKEN_CONTROL_TARGET?.session_id;
            if (!resolvedTarget) {
                showToast("Primero elige un dispositivo para controlar", "warning");
                return;
            }
            try {
                await fetch('/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        target: resolvedTarget,
                        action: action,
                        from_name: MY_NAME || 'Alguien',
                        from_email: window.MY_EMAIL || '',
                        from_sid: MY_SESSION_ID
                    })
                });
                showToast("📡 Orden enviada...", "success");
            } catch (e) {
                console.error(e);
                showToast("Error enviando orden", "error");
            }
        }

        /**
         * `toggleSpeakerMode()`
         * Activa o desactiva la disponibilidad de este dispositivo como receptor de audio remoto.
         */
        function toggleSpeakerMode() {
            IS_SPEAKER = !IS_SPEAKER;
            localStorage.setItem('kraken_is_speaker', IS_SPEAKER);

            // Lógica de Audio: Si soy control remoto, me callo
            if (audioElement) {
                if (!IS_SPEAKER) {
                    audioElement.muted = true;
                    showToast("🎮 Modo Control: Audio silenciado aquí", "info");
                } else {
                    audioElement.muted = false;
                    showToast("🔊 Modo Bocina: Audio activado", "success");
                }
            }
        }

        /**
         * `formatTimeShort(seconds)`
         * Convierte segundos al formato compacto `M:SS` para el panel del radar.
         */
        function formatTimeShort(seconds) {
            const total = Math.max(0, Math.floor(Number(seconds) || 0));
            const m = Math.floor(total / 60);
            const s = String(total % 60).padStart(2, '0');
            return `${m}:${s}`;
        }

        /**
         * `sendCurrentTrackToTarget(targetSid, targetName)`
         * Envia la pista que suena actualmente hacia el dispositivo del amigo.
         */
        function sendCurrentTrackToTarget(targetSid, targetName) {
            const cur = (playerQueue && playerQueue[currentTrackIndex]) || window.KRAKEN_CONTROL_TARGET || null;
            if (!cur || (!cur.path && !cur.song)) {
                showToast('No hay ninguna canción activa para transmitir', 'warning');
                return;
            }
            const payload = {
                path: cur.path || '',
                title: cur.title || cur.song || 'Canción',
                artist: cur.artist || '',
                type: cur.type || 'audio',
                cover: cur.cover || ''
            };
            sendFileToControlledDevice(payload, { session_id: targetSid, name: targetName });
            showToast(`📡 Transmitiendo "${payload.title}" a ${targetName}...`, 'success');
        }
        window.sendCurrentTrackToTarget = sendCurrentTrackToTarget;


        // ============================================================================
        // KRAKEN CINE REMOTE & WATCH PARTY (VER JUNTOS)
        // ============================================================================

        /**
         * `startWatchParty(targetSid, friendName, path, title, startTime)`
         * Sintoniza en tiempo real la película o serie que está viendo un amigo.
         */
        function startWatchParty(targetSid, friendName, path, title, startTime = 0, mediaId = null) {
            window.KRAKEN_SYNC_WATCH_PARTY = {
                targetSid: targetSid,
                friendName: friendName,
                path: path,
                title: title,
                startTime: startTime,
                mediaId: mediaId,
                participants: [targetSid]
            };
            try {
                localStorage.setItem('kraken_sync_watch_party', JSON.stringify(window.KRAKEN_SYNC_WATCH_PARTY));
            } catch (_) {}

            renderWatchPartyBanner();

            // Notificar al anfitrión que nos unimos a su Watch Party
            sendCommand(targetSid, 'party_joined_' + JSON.stringify({
                sid: MY_SESSION_ID,
                name: window.MY_NAME || 'Amigo',
                title: title,
                time: startTime
            }));

            const clean = (path || '').replace(/\\/g, '/');
            const matched = (window.libData?.files || []).find(f => (f.path || '').replace(/\\/g, '/').toLowerCase() === clean.toLowerCase());
            const videoFile = matched ? { ...matched } : {
                id: mediaId || null,
                path: path,
                title: title || (path ? path.split('/').pop() : 'Película'),
                type: 'video'
            };
            if (!videoFile.id && mediaId) videoFile.id = mediaId;

            if (typeof playVideoMode === 'function') {
                playVideoMode(videoFile).then(() => {
                    setTimeout(() => {
                        const vid = document.querySelector('#cine-screen video, #artplayer-container video, #main-video');
                        if (vid && startTime > 0) {
                            vid.currentTime = Math.max(0, startTime);
                        }
                    }, 1500);
                });
            }

            showToast(`🍿 Watch Party: Sintonizado con ${friendName}`, 'success');
        }
        window.startWatchParty = startWatchParty;

        /**
         * `resyncWatchParty()`
         * Resincroniza el tiempo de reproducción del video con el anfitrión.
         */
        function resyncWatchParty() {
            if (!window.KRAKEN_SYNC_WATCH_PARTY) return;
            const friend = (LAST_USERS_DATA || []).find(u => 
                u.session_id === window.KRAKEN_SYNC_WATCH_PARTY.targetSid || u.name === window.KRAKEN_SYNC_WATCH_PARTY.friendName
            );
            if (!friend) {
                showToast('El anfitrión ya no está en línea', 'warning');
                return;
            }
            const targetSeconds = Math.max(0, Number(friend.time) || 0);
            const activeVideo = document.querySelector('#cine-screen video, #artplayer-container video, #main-video');
            if (activeVideo) {
                activeVideo.currentTime = targetSeconds;
                showToast(`🔄 Resincronizado con ${friend.name} (${formatTimeShort(targetSeconds)})`, 'success');
            }
        }
        window.resyncWatchParty = resyncWatchParty;

        /**
         * `stopWatchParty()`
         * Finaliza la sesión de Watch Party.
         */
        function stopWatchParty() {
            window.KRAKEN_SYNC_WATCH_PARTY = null;
            try { localStorage.removeItem('kraken_sync_watch_party'); } catch (_) {}
            document.getElementById('watch-party-banner')?.remove();
            showToast('Watch Party finalizado', 'info');
        }
        window.stopWatchParty = stopWatchParty;

        /**
         * `renderWatchPartyBanner()`
         * Muestra una píldora flotante mientras la Watch Party está activa.
         */
        function renderWatchPartyBanner() {
            document.getElementById('watch-party-banner')?.remove();
            if (!window.KRAKEN_SYNC_WATCH_PARTY) return;

            const party = window.KRAKEN_SYNC_WATCH_PARTY;
            const banner = document.createElement('div');
            banner.id = 'watch-party-banner';
            banner.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[9990] bg-black/85 backdrop-blur-md border border-amber-500/40 text-white px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-down';
            banner.innerHTML = `
                <div class="flex items-center gap-2 text-xs">
                    <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                    <span class="font-bold text-amber-400">Watch Party:</span>
                    <span class="text-zinc-300 truncate max-w-[140px] sm:max-w-[200px]">${party.title || 'Película'}</span>
                    <span class="text-zinc-500 text-[11px]">con ${party.friendName}</span>
                </div>
                <div class="flex items-center gap-1.5 ml-2">
                    <button onclick="resyncWatchParty()" class="p-1.5 hover:bg-white/10 rounded-lg text-amber-400 hover:text-amber-300 transition" title="Resincronizar tiempo">
                        <i class="fa-solid fa-arrows-rotate text-xs"></i>
                    </button>
                    <button onclick="stopWatchParty()" class="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition" title="Salir de Watch Party">
                        <i class="fa-solid fa-xmark text-xs"></i>
                    </button>
                </div>
            `;
            document.body.appendChild(banner);
        }
        window.renderWatchPartyBanner = renderWatchPartyBanner;
        // Auto-show persistent chat pill when in Watch Party
        setTimeout(() => { if (typeof renderPersistentChatPill === 'function') renderPersistentChatPill(); }, 500);

        /**
         * `fetchActiveVideoStreams(customPath)`
         * Consulta los streams de audio y subtítulos disponibles para el video actual.
         */
        async function fetchActiveVideoStreams(customPath = null) {
            const rawPath = customPath ||
                            window._activeCineRemoteData?.path || 
                            window._lastCineRemoteVideo?.path || 
                            window.currentVideoFile?.path || 
                            window.KRAKEN_PLAYBACK_TARGET?.path;
            if (!rawPath) return null;
            try {
                const res = await fetch('/api/video/streams', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: rawPath })
                });
                const data = await res.json();
                if (data && data.ok && data.streams) {
                    window._cachedCineStreams = data.streams;
                    return data.streams;
                }
            } catch (e) {
                console.warn('Error obteniendo streams de video:', e);
            }
            return window._cachedCineStreams || null;
        }
        window.fetchActiveVideoStreams = fetchActiveVideoStreams;

        /**
         * `openCineRemoteAudioSelector()`
         * Modal para cambiar de pista de audio en la TV o dispositivo remoto.
         */
        async function openCineRemoteAudioSelector() {
            document.getElementById('cine-audio-selector-modal')?.remove();
            const target = window.KRAKEN_PLAYBACK_TARGET || window.KRAKEN_CONTROL_TARGET;
            const targetSid = target?.session_id || null;

            const modal = document.createElement('div');
            modal.id = 'cine-audio-selector-modal';
            modal.className = 'fixed inset-0 z-[10005] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4';
            modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

            modal.innerHTML = `
                <div class="bg-[#141416] border border-amber-500/30 rounded-3xl max-w-sm w-full p-5 shadow-2xl" onclick="event.stopPropagation()">
                    <div class="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-language text-amber-400 text-lg"></i>
                            <h3 class="text-sm font-bold text-white uppercase tracking-wider">Pistas de Audio</h3>
                        </div>
                        <button onclick="document.getElementById('cine-audio-selector-modal')?.remove()" class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition">
                            <i class="fa-solid fa-xmark text-sm"></i>
                        </button>
                    </div>
                    <div id="cine-audio-track-list" class="space-y-2 max-h-72 overflow-y-auto pr-1">
                        <div class="text-center py-6 text-zinc-400 text-xs flex items-center justify-center gap-2">
                            <i class="fa-solid fa-spinner animate-spin text-amber-400"></i> Cargando pistas de audio...
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const streams = await fetchActiveVideoStreams();
            const listEl = document.getElementById('cine-audio-track-list');
            if (!listEl) return;

            const audioTracks = (streams && Array.isArray(streams.audio) && streams.audio.length > 0)
                ? streams.audio
                : (window.currentVideoFile?.audio_tracks || []);

            if (!audioTracks || audioTracks.length === 0) {
                listEl.innerHTML = `
                    <div class="p-4 text-center text-xs text-zinc-400 bg-white/5 rounded-2xl">
                        <i class="fa-solid fa-volume-high text-zinc-500 text-xl mb-2 block"></i>
                        Pista de audio por defecto (estéreo/directo).
                    </div>
                `;
                return;
            }

            listEl.innerHTML = audioTracks.map((tr, idx) => {
                const trackIdx = tr.index !== undefined ? tr.index : idx;
                const lang = tr.language ? tr.language.toUpperCase() : 'UND';
                const label = tr.title || `Audio ${idx + 1} (${lang})`;
                const codec = tr.codec ? tr.codec.toUpperCase() : '';
                return `
                    <button onclick="selectCineRemoteAudio(${trackIdx}, '${label.replace(/'/g, "\\'")}', '${targetSid}')"
                        class="w-full text-left p-3.5 rounded-2xl bg-white/5 hover:bg-amber-500/15 border border-white/5 hover:border-amber-500/40 transition flex items-center justify-between group">
                        <div class="min-w-0 flex items-center gap-3">
                            <div class="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-xs shrink-0 group-hover:bg-amber-500 group-hover:text-black transition">
                                <i class="fa-solid fa-volume-high"></i>
                            </div>
                            <div class="min-w-0">
                                <div class="text-xs font-bold text-white group-hover:text-amber-300 truncate">${label}</div>
                                <div class="text-[10px] text-zinc-400 uppercase tracking-wider">${lang} ${codec ? '· ' + codec : ''}</div>
                            </div>
                        </div>
                        <i class="fa-solid fa-chevron-right text-xs text-zinc-600 group-hover:text-amber-400 transition"></i>
                    </button>
                `;
            }).join('');
        }
        window.openCineRemoteAudioSelector = openCineRemoteAudioSelector;

        function selectCineRemoteAudio(trackIndex, label, targetSid) {
            sendCommand(targetSid, 'switch_audio_' + trackIndex);
            const badgeTxt = document.getElementById('cine-remote-audio-txt');
            if (badgeTxt) badgeTxt.innerText = label;
            document.getElementById('cine-audio-selector-modal')?.remove();
            showToast(`🔊 Audio cambiado a: ${label}`, 'success');
        }
        window.selectCineRemoteAudio = selectCineRemoteAudio;

        /**
         * `openCineRemoteSubtitleSelector()`
         * Modal para cambiar o desactivar subtítulos remotamente en la TV.
         */
        async function openCineRemoteSubtitleSelector() {
            document.getElementById('cine-sub-selector-modal')?.remove();
            const target = window.KRAKEN_PLAYBACK_TARGET || window.KRAKEN_CONTROL_TARGET;
            const targetSid = target?.session_id || null;

            const modal = document.createElement('div');
            modal.id = 'cine-sub-selector-modal';
            modal.className = 'fixed inset-0 z-[10005] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4';
            modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

            modal.innerHTML = `
                <div class="bg-[#141416] border border-amber-500/30 rounded-3xl max-w-sm w-full p-5 shadow-2xl" onclick="event.stopPropagation()">
                    <div class="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-closed-captioning text-amber-400 text-lg"></i>
                            <h3 class="text-sm font-bold text-white uppercase tracking-wider">Subtítulos</h3>
                        </div>
                        <button onclick="document.getElementById('cine-sub-selector-modal')?.remove()" class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition">
                            <i class="fa-solid fa-xmark text-sm"></i>
                        </button>
                    </div>
                    <div id="cine-sub-track-list" class="space-y-2 max-h-72 overflow-y-auto pr-1">
                        <div class="text-center py-6 text-zinc-400 text-xs flex items-center justify-center gap-2">
                            <i class="fa-solid fa-spinner animate-spin text-amber-400"></i> Cargando subtítulos...
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const streams = await fetchActiveVideoStreams();
            const listEl = document.getElementById('cine-sub-track-list');
            if (!listEl) return;

            const subTracks = (streams && Array.isArray(streams.subtitles))
                ? streams.subtitles
                : (window.currentVideoFile?.subtitle_tracks || []);

            let itemsHtml = `
                <button onclick="selectCineRemoteSubtitle('off', 'Apagados', '${targetSid}')"
                    class="w-full text-left p-3.5 rounded-2xl bg-white/5 hover:bg-red-500/15 border border-white/5 hover:border-red-500/40 transition flex items-center justify-between group">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-xl bg-white/10 text-zinc-400 flex items-center justify-center text-xs shrink-0 group-hover:bg-red-500 group-hover:text-white transition">
                            <i class="fa-solid fa-ban"></i>
                        </div>
                        <div>
                            <div class="text-xs font-bold text-white group-hover:text-red-300">Apagados</div>
                            <div class="text-[10px] text-zinc-400">Sin subtítulos en pantalla</div>
                        </div>
                    </div>
                    <i class="fa-solid fa-chevron-right text-xs text-zinc-600 group-hover:text-red-400 transition"></i>
                </button>
            `;

            if (subTracks.length > 0) {
                itemsHtml += subTracks.map((tr, idx) => {
                    const trackIdx = tr.index !== undefined ? tr.index : idx;
                    const lang = tr.language ? tr.language.toUpperCase() : 'UND';
                    const label = tr.title || `Subtítulo ${idx + 1} (${lang})`;
                    const isExternal = tr.external ? '· Externo (.srt)' : '';
                    return `
                        <button onclick="selectCineRemoteSubtitle(${trackIdx}, '${label.replace(/'/g, "\\'")}', '${targetSid}')"
                            class="w-full text-left p-3.5 rounded-2xl bg-white/5 hover:bg-amber-500/15 border border-white/5 hover:border-amber-500/40 transition flex items-center justify-between group">
                            <div class="min-w-0 flex items-center gap-3">
                                <div class="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-xs shrink-0 group-hover:bg-amber-500 group-hover:text-black transition">
                                    <i class="fa-solid fa-closed-captioning"></i>
                                </div>
                                <div class="min-w-0">
                                    <div class="text-xs font-bold text-white group-hover:text-amber-300 truncate">${label}</div>
                                    <div class="text-[10px] text-zinc-400 uppercase tracking-wider">${lang} ${isExternal}</div>
                                </div>
                            </div>
                            <i class="fa-solid fa-chevron-right text-xs text-zinc-600 group-hover:text-amber-400 transition"></i>
                        </button>
                    `;
                }).join('');
            } else {
                itemsHtml += `
                    <div class="p-4 text-center text-xs text-zinc-400 bg-white/5 rounded-2xl">
                        No se detectaron pistas adicionales de subtítulos.
                    </div>
                `;
            }

            listEl.innerHTML = itemsHtml;
        }
        window.openCineRemoteSubtitleSelector = openCineRemoteSubtitleSelector;

        function selectCineRemoteSubtitle(trackIndex, label, targetSid) {
            sendCommand(targetSid, 'switch_sub_' + trackIndex);
            const badgeTxt = document.getElementById('cine-remote-sub-txt');
            if (badgeTxt) badgeTxt.innerText = label;
            document.getElementById('cine-sub-selector-modal')?.remove();
            showToast(`💬 Subtítulo cambiado a: ${label}`, 'success');
        }
        window.selectCineRemoteSubtitle = selectCineRemoteSubtitle;

        /**
         * `openWatchPartyInviteModal()`
         * Modal para invitar a cualquier amigo en línea a ver juntos en tiempo real (Watch Party).
         */
        function openWatchPartyInviteModal() {
            document.getElementById('watch-party-invite-modal')?.remove();

            const mySid = MY_SESSION_ID;
            const currentVideo = window.currentVideoFile || window._lastCineRemoteVideo;
            const target = window.KRAKEN_PLAYBACK_TARGET || window.KRAKEN_CONTROL_TARGET;
            const activeVid = document.querySelector('#cine-screen video, #artplayer-container video, #main-video');

            const moviePath = currentVideo?.path || target?.path || window._activeCineRemoteData?.path || '';
            const movieTitle = currentVideo?.title || target?.song || window._activeCineRemoteData?.title || 'Película';
            const movieId = currentVideo?.id || window._activeCineRemoteData?.id || null;
            const currentTime = Math.floor(activeVid ? activeVid.currentTime : Number(target?.time || 0));

            // Filtrar usuarios online (excluyendo a este propio dispositivo)
            const availableFriends = (LAST_USERS_DATA || []).filter(u => u && u.session_id && u.session_id !== mySid);

            const modal = document.createElement('div');
            modal.id = 'watch-party-invite-modal';
            modal.className = 'fixed inset-0 z-[10006] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4';
            modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

            let friendsListHtml = '';
            if (availableFriends.length === 0) {
                friendsListHtml = `
                    <div class="p-6 text-center text-zinc-400 bg-white/5 rounded-2xl">
                        <i class="fa-solid fa-user-slash text-zinc-500 text-3xl mb-3 block"></i>
                        <p class="text-xs font-bold text-zinc-300">No hay otros usuarios conectados ahora</p>
                        <p class="text-[11px] text-zinc-500 mt-1">Pídele a un amigo que abra Kraken en su celular, tablet o PC para ver juntos.</p>
                    </div>
                `;
            } else {
                friendsListHtml = availableFriends.map(friend => {
                    const friendName = friend.name || 'Usuario';
                    const devName = getDeviceDisplayName(friend);
                    const isVid = friend.media_type === 'video';

                    return `
                        <div class="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition flex items-center justify-between gap-3">
                            <div class="flex items-center gap-3 min-w-0">
                                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-300 flex items-center justify-center font-bold text-sm shrink-0">
                                    ${friendName.charAt(0).toUpperCase()}
                                </div>
                                <div class="min-w-0">
                                    <div class="text-xs font-bold text-white truncate flex items-center gap-1.5">
                                        ${friendName}
                                        ${isVid ? '<span class="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-md font-medium">Viendo video</span>' : ''}
                                    </div>
                                    <div class="text-[10px] text-zinc-400 truncate flex items-center gap-1">
                                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                        ${devName}
                                    </div>
                                </div>
                            </div>
                            <button onclick="sendWatchPartyInvite('${friend.session_id}', '${friendName.replace(/'/g, "\\'")}', '${moviePath.replace(/'/g, "\\'")}', '${movieTitle.replace(/'/g, "\\'")}', ${currentTime}, ${movieId ? `'${movieId}'` : 'null'})"
                                class="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-xs transition flex items-center gap-1.5 shrink-0 shadow-md">
                                <i class="fa-solid fa-paper-plane text-[10px]"></i>
                                <span>Invitar</span>
                            </button>
                        </div>
                    `;
                }).join('');
            }

            modal.innerHTML = `
                <div class="bg-[#141416] border border-amber-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl" onclick="event.stopPropagation()">
                    <div class="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                                <i class="fa-solid fa-users text-sm"></i>
                            </div>
                            <div>
                                <h3 class="text-sm font-black text-white uppercase tracking-wider">Ver con amigo (Watch Party)</h3>
                                <p class="text-[11px] text-zinc-400">Sincroniza la película con otra persona en tiempo real</p>
                            </div>
                        </div>
                        <button onclick="document.getElementById('watch-party-invite-modal')?.remove()" class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition">
                            <i class="fa-solid fa-xmark text-sm"></i>
                        </button>
                    </div>

                    <div class="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl mb-4 flex items-center gap-3">
                        <i class="fa-solid fa-film text-amber-400 text-xl shrink-0"></i>
                        <div class="min-w-0">
                            <div class="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Película a ver juntos:</div>
                            <div class="text-xs font-bold text-white truncate">${movieTitle}</div>
                            <div class="text-[10px] font-mono text-zinc-400">Segundo actual: ${formatTimeShort(currentTime)}</div>
                        </div>
                    </div>

                    <div class="text-xs font-bold text-zinc-300 mb-2.5 flex items-center justify-between">
                        <span>Usuarios y Amigos en línea:</span>
                        <span class="text-[11px] font-normal text-zinc-500">${availableFriends.length} conectados</span>
                    </div>

                    <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
                        ${friendsListHtml}
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        window.openWatchPartyInviteModal = openWatchPartyInviteModal;

        function sendWatchPartyInvite(targetSid, friendName, path, title, time, mediaId = null) {
            window.KRAKEN_SYNC_WATCH_PARTY = {
                targetSid: targetSid,
                friendName: friendName,
                path: path,
                title: title,
                startTime: time,
                mediaId: mediaId,
                participants: [targetSid]
            };
            try { localStorage.setItem('kraken_sync_watch_party', JSON.stringify(window.KRAKEN_SYNC_WATCH_PARTY)); } catch (_) {}
            renderWatchPartyBanner();

            const payload = {
                host_sid: MY_SESSION_ID,
                host_name: MY_NAME,
                path: path,
                title: title,
                time: time,
                id: mediaId
            };
            sendCommand(targetSid, 'invite_watch_party_' + JSON.stringify(payload));
            showToast(`🍿 Invitación a ver juntos enviada a ${friendName}`, 'success');
            document.getElementById('watch-party-invite-modal')?.remove();
        }
        window.sendWatchPartyInvite = sendWatchPartyInvite;

        function showWatchPartyInvitationDialog(payload, sender) {
            document.getElementById('incoming-watch-party-modal')?.remove();
            const modal = document.createElement('div');
            modal.id = 'incoming-watch-party-modal';
            modal.className = 'fixed inset-0 z-[10010] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4';
            modal.innerHTML = `
                <div class="bg-[#141416] border border-amber-500/40 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl animate-scale-up" onclick="event.stopPropagation()">
                    <div class="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center text-3xl mb-4 border border-amber-500/30 shadow-lg shadow-amber-500/20">
                        🍿
                    </div>
                    <div class="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Invitación a Watch Party</div>
                    <h3 class="text-white text-lg font-black leading-snug mb-1">${sender} te invita a ver juntos:</h3>
                    <p class="text-amber-200 font-bold text-sm mb-5 bg-white/5 border border-white/10 py-2.5 px-3 rounded-xl truncate">
                        "${payload.title || 'Película'}"
                    </p>
                    <div class="flex gap-3">
                        <button id="btn-accept-wp" class="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black py-3 rounded-2xl text-xs transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5">
                            <i class="fa-solid fa-play text-xs"></i>
                            <span>Sintonizar ahora</span>
                        </button>
                        <button onclick="document.getElementById('incoming-watch-party-modal')?.remove()" class="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white py-3 rounded-2xl text-xs transition">
                            Rechazar
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('btn-accept-wp').onclick = () => {
                modal.remove();
                startWatchParty(payload.host_sid, payload.host_name || sender, payload.path, payload.title, payload.time || 0, payload.id || null);
            };
        }
        window.showWatchPartyInvitationDialog = showWatchPartyInvitationDialog;

        /**
         * `showCineRemoteModal(video, target)`
         * Interfaz de control remoto dedicada para video transmitido a Smart TV / Tablet / PC.
         */
        function showCineRemoteModal(video, target = null) {
            const modalId = 'cine-remote-modal';
            document.getElementById(modalId)?.remove();

            const resolvedTarget = target || window.KRAKEN_PLAYBACK_TARGET || window.KRAKEN_CONTROL_TARGET;
            if (!resolvedTarget) {
                showToast('No hay pantalla remota conectada', 'warning');
                return;
            }

            const title = (video?.title && video.title !== 'Sin título') 
                ? video.title 
                : ((resolvedTarget.song && resolvedTarget.song !== 'Sin título' && resolvedTarget.song !== 'Reproductor') 
                    ? resolvedTarget.song 
                    : (window._activeCineRemoteData?.title || 'Película'));

            const subtitle = (video?.artist || video?.folder)
                ? (video.artist || video.folder)
                : ((resolvedTarget.artist && resolvedTarget.artist !== 'KRAKEN SYSTEM') 
                    ? resolvedTarget.artist 
                    : (window._activeCineRemoteData?.subtitle || 'Reproduciendo en pantalla'));

            const rawPath = video?.path || resolvedTarget.path || window._activeCineRemoteData?.path || '';

            const knownDur = resolveMediaDurationSeconds(resolvedTarget, video);
            const curSec = Math.max(0, Math.floor(Number(resolvedTarget.time || 0)));
            const totalSec = knownDur > 0 ? Math.max(knownDur, curSec) : 0;
            const sliderMax = totalSec > 0 ? totalSec : Math.max(curSec + 3600, 7200);
            const isPlaying = Boolean(resolvedTarget.is_playing);

            let coverUrl = '/assets/kraken-512.png';
            if (video?.tmdb_poster) {
                coverUrl = `/caratula/${encodeURIComponent(video.tmdb_poster)}`;
            } else if (video?.cover) {
                coverUrl = video.cover;
            } else if (rawPath) {
                coverUrl = `/caratula/${rawPath.split('/').map(encodeURIComponent).join('/')}`;
            }

            window._activeCineRemoteData = {
                title: title,
                subtitle: subtitle,
                path: rawPath,
                coverUrl: coverUrl,
                targetSid: resolvedTarget.session_id
            };
            window.KRAKEN_PLAYBACK_TARGET = resolvedTarget;
            window.KRAKEN_CONTROL_TARGET = resolvedTarget;

            if (!window.KRAKEN_SYNC_WATCH_PARTY) {
                window.KRAKEN_SYNC_WATCH_PARTY = {
                    targetSid: resolvedTarget.session_id,
                    friendName: getDeviceDisplayName(resolvedTarget),
                    title: title,
                    participants: [resolvedTarget.session_id]
                };
            } else {
                if (!window.KRAKEN_SYNC_WATCH_PARTY.participants) window.KRAKEN_SYNC_WATCH_PARTY.participants = [];
                if (!window.KRAKEN_SYNC_WATCH_PARTY.participants.includes(resolvedTarget.session_id)) {
                    window.KRAKEN_SYNC_WATCH_PARTY.participants.push(resolvedTarget.session_id);
                }
            }

            // Enlazar control remoto con el backend para sincronización transparente de chat
            if (resolvedTarget.session_id && resolvedTarget.session_id !== MY_SESSION_ID) {
                fetch('/device/control/link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        controller_sid: MY_SESSION_ID,
                        target_sid: resolvedTarget.session_id
                    })
                }).catch(() => {});
            }

            const modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'fixed inset-0 z-[10000] flex flex-col bg-[#07080c]/95 backdrop-blur-3xl text-white select-none animate-fade-in overflow-y-auto sm:overflow-hidden';

            modal.innerHTML = `
                <div class="w-full max-w-5xl mx-auto flex flex-col h-full p-4 sm:p-6 md:p-8 justify-between">
                    <!-- Header -->
                    <div class="flex items-center justify-between pb-4 border-b border-white/10 w-full">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/10">
                                <i class="fa-solid fa-clapperboard text-base"></i>
                            </div>
                            <div>
                                <div class="text-xs font-black tracking-widest uppercase text-amber-400">Kraken Cine Remote</div>
                                <div class="text-xs text-zinc-400 flex items-center gap-2">
                                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                                    <span class="font-medium">${getDeviceDisplayName(resolvedTarget)}</span>
                                    <span class="text-zinc-600">·</span>
                                    <span class="text-amber-400/80 font-mono text-[11px]" id="cine-remote-status-badge">En vivo</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <button onclick="toggleWatchPartyChat()" class="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-amber-300 text-xs font-bold transition flex items-center gap-2 shadow-sm" title="Chat de Watch Party">
                                <i class="fa-solid fa-comments text-amber-400"></i>
                                <span class="hidden sm:inline">Chat</span>
                                <span id="krk-cine-chat-unread-badge" class="hidden w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                            </button>
                            <button onclick="openWatchPartyInviteModal()" class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/30 text-amber-300 text-xs font-bold transition flex items-center gap-2 shadow-sm" title="Ver con amigo">
                                <i class="fa-solid fa-users text-amber-400"></i>
                                <span class="hidden sm:inline">Ver con amigo</span>
                            </button>
                            <button onclick="closeCineRemoteModal()" class="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition" title="Minimizar control">
                                <i class="fa-solid fa-xmark text-sm"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Main Content: Mobile vertical, Tablet/Desktop 2 Columns -->
                    <div class="flex-1 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10 py-4 my-auto w-full">
                        <!-- Left: Poster Card & Info -->
                        <div class="flex flex-col items-center md:items-start text-center md:text-left shrink-0 md:w-5/12 max-w-sm">
                            <div class="relative w-40 sm:w-48 md:w-64 aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/15 group bg-zinc-950">
                                <div id="cine-remote-cover-bg" class="absolute inset-0 bg-cover bg-center filter blur-md opacity-40 scale-110" style="background-image: url('${coverUrl}');"></div>
                                <img id="cine-remote-cover" src="${coverUrl}" onerror="this.onerror=null; this.src='/assets/kraken-512.png';" class="relative w-full h-full object-contain z-10 drop-shadow-2xl">
                                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10"></div>
                            </div>
                            <h2 id="cine-remote-title" class="text-lg sm:text-xl md:text-2xl font-black text-white mt-4 truncate max-w-full drop-shadow-md">
                                ${title}
                            </h2>
                            <p id="cine-remote-subtitle" class="text-xs sm:text-sm text-zinc-400 truncate max-w-full mt-1">
                                ${subtitle}
                            </p>
                            <!-- Audio / Subs Badges -->
                            <div class="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
                                <span id="cine-remote-active-audio-badge" class="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-zinc-300 flex items-center gap-1.5 font-medium">
                                    <i class="fa-solid fa-volume-high text-amber-400 text-[10px]"></i> <span id="cine-remote-audio-txt">Audio</span>
                                </span>
                                <span id="cine-remote-active-sub-badge" class="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-zinc-300 flex items-center gap-1.5 font-medium">
                                    <i class="fa-solid fa-closed-captioning text-amber-400 text-[10px]"></i> <span id="cine-remote-sub-txt">Subtítulos</span>
                                </span>
                            </div>
                        </div>

                        <!-- Right: Controls -->
                        <div class="w-full md:w-7/12 flex flex-col justify-center gap-5 max-w-lg">
                            <!-- Progress slider -->
                            <div class="w-full bg-white/[0.03] border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                                <input type="range" id="cine-remote-seek" min="0" max="${sliderMax}" value="${curSec}"
                                    onmousedown="window.isUserDraggingCineSeek=true"
                                    ontouchstart="window.isUserDraggingCineSeek=true"
                                    oninput="document.getElementById('cine-remote-time-cur').innerText=formatTimeShort(this.value)"
                                    onchange="sendRemoteSeek(this.value); window.isUserDraggingCineSeek=false;"
                                    class="w-full h-2.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400 transition">
                                <div class="flex justify-between w-full text-xs font-mono text-zinc-400 mt-2">
                                    <span id="cine-remote-time-cur" class="font-bold text-amber-400">${formatTimeShort(curSec)}</span>
                                    <span id="cine-remote-time-tot">${totalSec > 0 ? formatTimeShort(totalSec) : '--:--'}</span>
                                </div>
                            </div>

                            <!-- Transport buttons -->
                            <div class="flex items-center justify-center gap-4 sm:gap-6 py-1">
                                <button onclick="cineRemoteSeekRel(-30)" class="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white flex flex-col items-center justify-center gap-0.5 active:scale-95 transition" title="Retroceder 30s">
                                    <i class="fa-solid fa-angles-left text-xs text-amber-400"></i>
                                    <span class="text-[9px] font-bold text-zinc-400">30s</span>
                                </button>

                                <button onclick="cineRemoteSeekRel(-10)" class="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white flex flex-col items-center justify-center gap-0.5 active:scale-95 transition" title="Retroceder 10s">
                                    <i class="fa-solid fa-rotate-left text-sm text-amber-400"></i>
                                    <span class="text-[9px] font-bold text-zinc-400">10s</span>
                                </button>

                                <button id="cine-remote-play-btn" onclick="toggleCineRemotePlay()" class="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black shadow-[0_0_40px_rgba(245,158,11,0.5)] flex items-center justify-center text-3xl active:scale-95 transition">
                                    <i class="fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}"></i>
                                </button>

                                <button onclick="cineRemoteSeekRel(10)" class="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white flex flex-col items-center justify-center gap-0.5 active:scale-95 transition" title="Adelantar 10s">
                                    <i class="fa-solid fa-rotate-right text-sm text-amber-400"></i>
                                    <span class="text-[9px] font-bold text-zinc-400">10s</span>
                                </button>

                                <button onclick="cineRemoteSeekRel(30)" class="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white flex flex-col items-center justify-center gap-0.5 active:scale-95 transition" title="Adelantar 30s">
                                    <i class="fa-solid fa-angles-right text-xs text-amber-400"></i>
                                    <span class="text-[9px] font-bold text-zinc-400">30s</span>
                                </button>
                            </div>

                            <!-- TV Volume -->
                            <div class="flex items-center gap-3 bg-black/40 border border-white/10 px-4 py-2.5 rounded-2xl">
                                <button onclick="sendCommand(null, 'vol_down')" class="text-zinc-500 hover:text-white transition">
                                    <i class="fa-solid fa-volume-low text-xs"></i>
                                </button>
                                <input type="range" id="cine-remote-vol" min="0" max="1" step="0.05" value="${resolvedTarget.volume || 1}"
                                    oninput="sendCommand(null, 'set_volume_' + this.value)"
                                    class="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400 transition">
                                <button onclick="sendCommand(null, 'vol_up')" class="text-zinc-400 hover:text-white transition">
                                    <i class="fa-solid fa-volume-high text-xs"></i>
                                </button>
                            </div>

                            <!-- Track Selection & Quick Actions -->
                            <div class="grid grid-cols-2 gap-2.5">
                                <button onclick="openCineRemoteAudioSelector()" class="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2.5 px-3 text-xs text-zinc-200 hover:text-white transition font-medium">
                                    <i class="fa-solid fa-language text-amber-400"></i>
                                    <span>Idioma / Audio</span>
                                </button>
                                <button onclick="openCineRemoteSubtitleSelector()" class="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2.5 px-3 text-xs text-zinc-200 hover:text-white transition font-medium">
                                    <i class="fa-solid fa-closed-captioning text-amber-400"></i>
                                    <span>Subtítulos</span>
                                </button>
                                <button onclick="openWatchPartyInviteModal()" class="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600/20 to-orange-600/20 hover:from-amber-600/30 hover:to-orange-600/30 border border-amber-500/40 rounded-xl py-2.5 px-3 text-xs text-amber-300 hover:text-amber-200 transition font-medium">
                                    <i class="fa-solid fa-users text-amber-400"></i>
                                    <span>Ver con amigo</span>
                                </button>
                                <button onclick="document.getElementById('${modalId}')?.remove(); showConnectModal();" class="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2.5 px-3 text-xs text-zinc-300 hover:text-white transition font-medium">
                                    <i class="fa-solid fa-tv text-amber-400"></i>
                                    <span>Cambiar pantalla</span>
                                </button>
                            </div>

                            <!-- Transfer to Local Device button -->
                            <button onclick="switchToLocalVideo('${(video?.path || resolvedTarget.path || '').replace(/'/g, "\\'")}', '${(video?.title || resolvedTarget.song || '').replace(/'/g, "\\'")}')"
                                class="w-full flex items-center justify-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl py-2.5 text-xs text-amber-300 hover:text-amber-200 transition font-semibold">
                                <i class="fa-solid fa-mobile-screen text-amber-400"></i>
                                <span>Continuar viendo en este equipo (Tablet/PC)</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            window._lastCineRemoteVideo = video;
        }
        window.showCineRemoteModal = showCineRemoteModal;

        function closeCineRemoteModal() {
            document.getElementById('cine-remote-modal')?.remove();
            renderCineRemoteMiniPill();
        }
        window.closeCineRemoteModal = closeCineRemoteModal;

        function renderCineRemoteMiniPill() {
            document.getElementById('cine-remote-mini-pill')?.remove();
            const target = window.KRAKEN_PLAYBACK_TARGET || window.KRAKEN_CONTROL_TARGET;
            if (!target || !target.session_id || target.session_id === MY_SESSION_ID) return;
            if (target.media_type !== 'video' && !window._lastCineRemoteVideo) return;

            const pill = document.createElement('div');
            pill.id = 'cine-remote-mini-pill';
            pill.className = 'fixed bottom-20 left-4 z-[9900] bg-black/90 backdrop-blur-md border border-amber-500/40 text-white px-3.5 py-2 rounded-2xl shadow-2xl flex items-center gap-3 cursor-pointer hover:border-amber-400 transition animate-slide-up';
            pill.onclick = () => showCineRemoteModal(window._lastCineRemoteVideo, target);
            pill.innerHTML = `
                <div class="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs">
                    <i class="fa-solid fa-clapperboard"></i>
                </div>
                <div class="min-w-0 pr-2">
                    <div class="text-[10px] text-amber-400 uppercase tracking-widest font-bold">Cine en TV</div>
                    <div class="text-xs font-bold text-white truncate max-w-[150px]">${target.song || window._activeCineRemoteData?.title || 'Película'}</div>
                </div>
                <button onclick="event.stopPropagation(); pill.remove();" class="text-zinc-500 hover:text-white text-xs pl-1">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;
            document.body.appendChild(pill);
        }
        window.renderCineRemoteMiniPill = renderCineRemoteMiniPill;

        function toggleCineRemotePlay() {
            const target = getActiveRemotePlaybackTarget();
            if (!target) return;
            const newIsPlaying = !target.is_playing;
            target.is_playing = newIsPlaying;
            sendCommand(target.session_id, newIsPlaying ? 'play' : 'pause');

            const btn = document.getElementById('cine-remote-play-btn');
            if (btn) {
                btn.innerHTML = `<i class="fa-solid ${newIsPlaying ? 'fa-pause' : 'fa-play'}"></i>`;
            }
        }
        window.toggleCineRemotePlay = toggleCineRemotePlay;

        function cineRemoteSeekRel(seconds) {
            const target = getActiveRemotePlaybackTarget();
            if (!target) return;
            const seekEl = document.getElementById('cine-remote-seek');
            const isRecentSeek = Boolean(window._lastRemoteSeekAt && (Date.now() - window._lastRemoteSeekAt < 4000));
            const cur = (isRecentSeek && typeof window._lastRemoteSeekTargetTime === 'number')
                ? window._lastRemoteSeekTargetTime
                : Number(target.time || seekEl?.value || 0);
            const tot = resolveMediaDurationSeconds(target);
            let next = cur + seconds;
            if (next < 0) next = 0;
            if (tot > 0 && next > tot) next = tot;
            target.time = next;
            sendRemoteSeek(next);

            const timeCurEl = document.getElementById('cine-remote-time-cur');
            if (seekEl) {
                const currentMax = Number(seekEl.max || 0);
                if (next > currentMax) seekEl.max = Math.max(tot, next + 1800);
                seekEl.value = next;
            }
            if (timeCurEl) timeCurEl.innerText = formatTimeShort(next);
        }
        window.cineRemoteSeekRel = cineRemoteSeekRel;

        function switchToLocalVideo(path, title) {
            const target = getActiveRemotePlaybackTarget();
            const currentSeconds = target ? Number(target.time || 0) : 0;

            if (target && target.session_id) {
                sendCommand(target.session_id, 'pause');
            }
            clearPlaybackTarget(true);
            unlinkControlledDevice(true);
            document.getElementById('cine-remote-modal')?.remove();
            document.getElementById('cine-remote-mini-pill')?.remove();

            const clean = (path || '').replace(/\\/g, '/');
            const matched = (window.libData?.files || []).find(f => (f.path || '').replace(/\\/g, '/') === clean);
            const videoFile = matched ? { ...matched } : {
                path: path,
                title: title || (path ? path.split('/').pop() : 'Video'),
                type: 'video'
            };

            if (currentSeconds > 5) {
                window.krakenPendingResumeSeconds = Math.floor(currentSeconds);
            }

            showToast('📱 Continuando reproducción en este dispositivo', 'info');
            if (typeof playVideoMode === 'function') {
                playVideoMode(videoFile);
            }
        }
        window.switchToLocalVideo = switchToLocalVideo;

        /**
         * `updateCineRemoteLive(target)`
         * Actualiza en tiempo real los controles y tiempos del Cine Remote según el estado de la TV.
         */
        function updateCineRemoteLive(target) {
            if (!target) return;
            const titleEl = document.getElementById('cine-remote-title');
            const subEl = document.getElementById('cine-remote-subtitle');
            const curEl = document.getElementById('cine-remote-time-cur');
            const totEl = document.getElementById('cine-remote-time-tot');
            const seekEl = document.getElementById('cine-remote-seek');
            const playBtn = document.getElementById('cine-remote-play-btn');

            // CRÍTICO: Nunca sobrescribir un título válido con "Sin título" o "Reproductor"
            if (titleEl && target.song && target.song !== 'Sin título' && target.song !== 'Reproductor') {
                if (titleEl.innerText !== target.song) {
                    titleEl.innerText = target.song;
                    if (window._activeCineRemoteData) window._activeCineRemoteData.title = target.song;
                }
            }
            if (subEl && target.artist && target.artist !== 'KRAKEN SYSTEM') {
                if (subEl.innerText !== target.artist) {
                    subEl.innerText = target.artist;
                    if (window._activeCineRemoteData) window._activeCineRemoteData.subtitle = target.artist;
                }
            }

            const isRecentManualSeek = Boolean(window._lastRemoteSeekAt && (Date.now() - window._lastRemoteSeekAt < 4500));
            const cur = (isRecentManualSeek && typeof window._lastRemoteSeekTargetTime === 'number')
                ? window._lastRemoteSeekTargetTime
                : Math.max(0, Math.floor(Number(target.time || 0)));
            const dur = resolveMediaDurationSeconds(target);

            if (seekEl && !window.isUserDraggingCineSeek) {
                const effMax = dur > 0 ? Math.max(dur, cur) : Math.max(cur + 3600, 7200);
                seekEl.max = effMax;
                seekEl.value = cur;
            }
            if (curEl && !window.isUserDraggingCineSeek) curEl.innerText = formatTimeShort(cur);
            if (totEl && dur > 0) totEl.innerText = formatTimeShort(dur);

            if (playBtn) {
                playBtn.innerHTML = `<i class="fa-solid ${target.is_playing ? 'fa-pause' : 'fa-play'}"></i>`;
            }
        }
        window.updateCineRemoteLive = updateCineRemoteLive;

        /**
         * ============================================================================
         * WATCH PARTY CHAT & BIDIRECTIONAL SYNC (MODO SALA & TELEPARTY CHAT)
         * ============================================================================
         */

        function getWatchPartyTargets() {
            const party = window.KRAKEN_SYNC_WATCH_PARTY;
            const targets = new Set();
            if (party?.targetSid && party.targetSid !== MY_SESSION_ID) targets.add(party.targetSid);
            if (Array.isArray(party?.participants)) {
                party.participants.forEach(sid => { if (sid && sid !== MY_SESSION_ID) targets.add(sid); });
            }
            if (window.KRAKEN_PLAYBACK_TARGET?.session_id && window.KRAKEN_PLAYBACK_TARGET.session_id !== MY_SESSION_ID) {
                targets.add(window.KRAKEN_PLAYBACK_TARGET.session_id);
            }
            if (window.KRAKEN_CONTROL_TARGET?.session_id && window.KRAKEN_CONTROL_TARGET.session_id !== MY_SESSION_ID) {
                targets.add(window.KRAKEN_CONTROL_TARGET.session_id);
            }
            if (window._activeCineRemoteData?.targetSid && window._activeCineRemoteData.targetSid !== MY_SESSION_ID) {
                targets.add(window._activeCineRemoteData.targetSid);
            }
            return Array.from(targets);
        }
        window.getWatchPartyTargets = getWatchPartyTargets;

        function broadcastWatchPartySync(action, time) {
            if (window._isHandlingWatchPartyRemoteSync) return;
            const targets = getWatchPartyTargets();
            if (!targets.length) return;

            const payload = {
                action: action,
                time: Math.floor(time || 0),
                sender_name: window.MY_NAME || 'Amigo',
                sender_sid: MY_SESSION_ID
            };
            targets.forEach(tSid => {
                sendCommand(tSid, 'watch_party_sync_' + JSON.stringify(payload));
            });
        }
        window.broadcastWatchPartySync = broadcastWatchPartySync;

        function applyWatchPartySync(payload) {
            if (!payload || !payload.action) return;
            window._isHandlingWatchPartyRemoteSync = true;
            const activeVid = document.querySelector('#cine-screen video, #artplayer-container video, #main-video');
            const art = window.currentArtPlayer;
            const sender = payload.sender_name || 'Amigo';

            if (payload.action === 'pause') {
                if (art && !art.video?.paused) {
                    art.pause();
                } else if (activeVid && !activeVid.paused) {
                    activeVid.pause();
                }
                showToast(`⏸️ ${sender} pausó la película`, 'info');
            } else if (payload.action === 'play') {
                if (art && art.video?.paused) {
                    art.play().catch(() => {});
                } else if (activeVid && activeVid.paused) {
                    activeVid.play().catch(() => {});
                }
                showToast(`▶️ ${sender} reanudó la película`, 'info');
            } else if (payload.action === 'seek') {
                const targetSec = Number(payload.time || 0);
                if (art && typeof art.seekToMovieTime === 'function') {
                    art.seekToMovieTime(targetSec);
                } else if (art) {
                    art.currentTime = targetSec;
                } else if (activeVid) {
                    activeVid.currentTime = targetSec;
                }
                showToast(`⏩ ${sender} saltó a ${formatTimeShort(targetSec)}`, 'info');
            }

            setTimeout(() => {
                window._isHandlingWatchPartyRemoteSync = false;
            }, 800);
        }
        window.applyWatchPartySync = applyWatchPartySync;

        function getOrCreateWatchPartyChatDrawer() {
            let drawer = document.getElementById('watch-party-chat-drawer');
            if (!drawer) {
                drawer = document.createElement('div');
                drawer.id = 'watch-party-chat-drawer';
                drawer.className = 'fixed top-0 right-0 bottom-0 z-[10020] w-80 sm:w-96 bg-[#0a0b0e]/95 backdrop-blur-2xl border-l border-white/10 flex flex-col shadow-2xl transition-transform duration-300 translate-x-full select-none';
                drawer.innerHTML = `
                    <div class="p-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm border border-amber-500/30">
                                <i class="fa-solid fa-comments"></i>
                            </div>
                            <div>
                                <h3 class="text-xs font-black text-white uppercase tracking-wider">Chat de Watch Party</h3>
                                <p id="watch-party-chat-sub" class="text-[10px] text-zinc-400">En vivo con amigos</p>
                            </div>
                        </div>
                        <button onclick="toggleWatchPartyChat(false)" class="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition">
                            <i class="fa-solid fa-xmark text-xs"></i>
                        </button>
                    </div>

                    <div id="watch-party-chat-list" class="flex-1 overflow-y-auto p-4 space-y-3 custom-scroll">
                        <div id="watch-party-empty-hint" class="text-center py-6 text-zinc-500 text-[11px]">
                            <i class="fa-solid fa-sparkles text-amber-500/40 text-base mb-1.5 block"></i>
                            ¡Inicia la conversación! Los mensajes aparecen en pantalla en tiempo real.
                        </div>
                    </div>

                    <div class="px-3 pt-2 pb-1 border-t border-white/5 flex items-center justify-around bg-black/40">
                        <button onclick="sendWatchPartyMessage('❤️')" class="text-lg hover:scale-125 transition-transform" title="Amor">❤️</button>
                        <button onclick="sendWatchPartyMessage('😂')" class="text-lg hover:scale-125 transition-transform" title="Risa">😂</button>
                        <button onclick="sendWatchPartyMessage('🔥')" class="text-lg hover:scale-125 transition-transform" title="Fuego">🔥</button>
                        <button onclick="sendWatchPartyMessage('🍿')" class="text-lg hover:scale-125 transition-transform" title="Palomitas">🍿</button>
                        <button onclick="sendWatchPartyMessage('😱')" class="text-lg hover:scale-125 transition-transform" title="Sorpresa">😱</button>
                        <button onclick="sendWatchPartyMessage('👏')" class="text-lg hover:scale-125 transition-transform" title="Aplausos">👏</button>
                    </div>

                    <div class="p-3 border-t border-white/10 bg-black/60 flex items-center gap-2">
                        <input type="text" id="watch-party-chat-input" placeholder="Comenta la película..."
                            onkeydown="if(event.key==='Enter') sendWatchPartyMessage()"
                            class="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 transition">
                        <button onclick="sendWatchPartyMessage()" class="w-9 h-9 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black flex items-center justify-center transition shadow-md shadow-amber-500/20 shrink-0">
                            <i class="fa-solid fa-paper-plane text-xs"></i>
                        </button>
                    </div>
                `;
                document.body.appendChild(drawer);
            }
            return drawer;
        }

        function isEmojiOnly(str) {
            if (!str) return false;
            const clean = str.trim();
            const emojiRegex = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji_Modifier_Base}|\p{Emoji_Component}|\s)+$/u;
            return emojiRegex.test(clean) && Array.from(clean).length <= 6;
        }

        function ensureDanmakuStyles() {
            if (document.getElementById('krk-danmaku-styles')) return;
            const style = document.createElement('style');
            style.id = 'krk-danmaku-styles';
            style.textContent = `
                @keyframes danmakuPopIn {
                    0% {
                        opacity: 0;
                        transform: translate3d(70px, -20px, 0) scale(0.75);
                    }
                    60% {
                        opacity: 1;
                        transform: translate3d(-10px, 4px, 0) scale(1.06);
                    }
                    100% {
                        opacity: 1;
                        transform: translate3d(0, 0, 0) scale(1);
                    }
                }
                @keyframes danmakuFloatOut {
                    0% {
                        opacity: 1;
                        transform: translate3d(0, 0, 0) scale(1);
                    }
                    100% {
                        opacity: 0;
                        transform: translate3d(35px, -45px, 0) scale(0.8);
                    }
                }
                @keyframes emojiPopBounce {
                    0% { transform: scale(0.2) rotate(-20deg); opacity: 0; }
                    50% { transform: scale(1.45) rotate(12deg); opacity: 1; }
                    75% { transform: scale(0.9) rotate(-5deg); }
                    100% { transform: scale(1) rotate(0deg); opacity: 1; }
                }
                .krk-danmaku-enter {
                    animation: danmakuPopIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .krk-danmaku-exit {
                    animation: danmakuFloatOut 0.45s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                }
            `;
            document.head.appendChild(style);
        }

        function getOrCreateDanmakuContainer() {
            let container = document.getElementById('krk-danmaku-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'krk-danmaku-container';
                container.className = 'fixed top-12 right-6 sm:top-14 sm:right-8 z-[10035] flex flex-col items-end gap-3.5 pointer-events-none select-none max-w-[90vw] sm:max-w-[440px]';
                document.body.appendChild(container);
            }
            return container;
        }

        function dismissDanmaku(el) {
            if (!el || !el.parentNode) return;
            el.classList.remove('krk-danmaku-enter');
            el.classList.add('krk-danmaku-exit');
            setTimeout(() => {
                if (el && el.parentNode) el.remove();
            }, 450);
        }

        function renderWatchPartyDanmaku(sender, text) {
            // 🛑 Danmaku solo debe renderizarse en la pantalla donde se ESTÁ VIENDO la película (el reproductor de video)
            const isVideoActiveHere = !!(
                document.getElementById('view-player')?.classList.contains('active') ||
                (window.currentArtPlayer && !window.currentArtPlayer.isDestroy) ||
                document.querySelector('#cine-screen video, #artplayer-container video, #main-video')
            );

            if (!isVideoActiveHere) {
                // En Cine Remote / Segunda Pantalla / Celular, NO mostramos Danmaku flotante;
                // aquí el usuario ya tiene el chat drawer o el control.
                return;
            }

            ensureDanmakuStyles();
            const container = getOrCreateDanmakuContainer();
            const dId = 'danmaku-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
            const el = document.createElement('div');
            el.id = dId;
            el.className = 'krk-danmaku-enter pointer-events-auto cursor-pointer transition-all duration-300';
            
            const isEmoji = isEmojiOnly(text);

            if (isEmoji) {
                el.innerHTML = `
                    <div class="bg-black/90 backdrop-blur-2xl border-2 border-amber-500/60 rounded-3xl p-4 sm:p-5 shadow-[0_15px_45px_rgba(245,158,11,0.4)] flex items-center gap-4 sm:gap-5 hover:scale-105 active:scale-95 transition-transform" onclick="toggleWatchPartyChat(true)">
                        <div class="text-5xl sm:text-6xl select-none" style="animation: emojiPopBounce 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); filter: drop-shadow(0 8px 20px rgba(245,158,11,0.6));">
                            ${text}
                        </div>
                        <div class="flex flex-col pr-1">
                            <span class="text-xs sm:text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
                                ${sender}
                            </span>
                            <span class="text-[11px] sm:text-xs text-zinc-300 font-semibold mt-0.5">Reaccionó en vivo</span>
                        </div>
                    </div>
                `;
            } else {
                el.innerHTML = `
                    <div class="bg-black/95 backdrop-blur-2xl border-2 border-amber-500/40 rounded-3xl p-4 sm:p-5 shadow-[0_15px_45px_rgba(0,0,0,0.85)] flex items-start gap-4 min-w-[280px] sm:min-w-[340px] max-w-[400px] hover:scale-105 active:scale-95 transition-transform" onclick="toggleWatchPartyChat(true)">
                        <div class="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 border border-amber-500/40 text-amber-300 flex items-center justify-center font-black text-base shadow-inner shrink-0">
                            ${sender.charAt(0).toUpperCase()}
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center justify-between gap-2 mb-1">
                                <span class="text-xs sm:text-sm font-black text-amber-400 tracking-wide truncate">${sender}</span>
                                <span class="text-[9px] text-zinc-400 font-mono">Ahora</span>
                            </div>
                            <div class="text-xs sm:text-sm font-semibold text-white leading-relaxed break-words">${text}</div>
                        </div>
                    </div>
                `;
            }

            container.appendChild(el);

            const timer = setTimeout(() => {
                dismissDanmaku(el);
            }, 5000);

            el.addEventListener('click', () => {
                clearTimeout(timer);
                dismissDanmaku(el);
            });
        }
        window.renderWatchPartyDanmaku = renderWatchPartyDanmaku;

        function renderPersistentChatPill() {
            let pill = document.getElementById('krk-persistent-chat-pill');

            // 🛑 NUNCA mostrar la píldora en el dispositivo que está reproduciendo video activamente
            const isVideoActiveHere = !!(
                document.getElementById('view-player')?.classList.contains('active') ||
                (window.currentArtPlayer && !window.currentArtPlayer.isDestroy) ||
                document.querySelector('#cine-screen video, #artplayer-container video, #main-video')
            );

            if (isVideoActiveHere) {
                pill?.remove();
                return;
            }

            // En el dispositivo remoto/acompañante (celular o tablet donde NO se está viendo el video):
            // Se muestra si hay una sesión activa de TV o de Watch Party
            const myEmail = (window.MY_EMAIL || '').toLowerCase().trim();
            const myName = (window.MY_NAME || '').toLowerCase().trim();

            const activeTv = (LAST_USERS_DATA || []).find(u => {
                if (!u || !u.session_id || u.session_id === MY_SESSION_ID) return false;
                const uEmail = (u.email || '').toLowerCase().trim();
                const uName = (u.name || '').toLowerCase().trim();

                const isMyAccount = Boolean(
                    u.is_me ||
                    (myEmail && uEmail && uEmail === myEmail) ||
                    (myName && uName && uName === myName)
                );
                const isParty = Boolean(
                    window.KRAKEN_SYNC_WATCH_PARTY && (u.party_title || u.friendName)
                );

                if (!isMyAccount && !isParty) return false;

                const isTvOrSpeaker = u.is_speaker || u.device_type === 'tv' || /tv|sala|comedor|smart|chromecast/i.test(u.device_name || '');
                const isPlayingVideo = u.media_type === 'video' || (Number(u.time || 0) > 0 && Number(u.duration || 0) > 1200);
                return (isTvOrSpeaker || isParty) && isPlayingVideo;
            }) || window.KRAKEN_PLAYBACK_TARGET;

            const isParty = !!(window.KRAKEN_SYNC_WATCH_PARTY && window.KRAKEN_SYNC_WATCH_PARTY.targetSid);

            if (!activeTv && !isParty) {
                pill?.remove();
                return;
            }

            if (!pill) {
                pill = document.createElement('div');
                pill.id = 'krk-persistent-chat-pill';
                pill.className = 'fixed bottom-24 right-5 sm:bottom-28 sm:right-6 z-[10015] bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-black font-black px-4 py-2.5 rounded-full shadow-2xl shadow-amber-950/60 flex items-center gap-2.5 cursor-pointer hover:scale-105 active:scale-95 transition-all select-none border border-amber-300/40';
                document.body.appendChild(pill);
            }

            const friend = window.KRAKEN_SYNC_WATCH_PARTY?.friendName || activeTv?.name || 'Sala';

            pill.innerHTML = `
                <div class="relative flex items-center justify-center">
                    <i class="fa-solid fa-comments text-base"></i>
                    <span id="krk-pill-unread-dot" class="hidden absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-rose-600 border-2 border-black animate-pulse"></span>
                </div>
                <div class="flex flex-col text-left leading-none">
                    <span class="text-[9px] uppercase tracking-wider text-black/70 font-black">Segunda Pantalla</span>
                    <span class="text-xs tracking-wide font-black truncate max-w-[140px] sm:max-w-[180px]">Chat con ${friend}</span>
                </div>
            `;

            // Si cerraron el modal de companion o el chat, este botón permite reabrir el menú o el chat
            pill.onclick = () => {
                const companionModal = document.getElementById('krk-companion-prompt-modal');
                if (companionModal) {
                    companionModal.classList.remove('hidden');
                } else if (activeTv && typeof showCompanionPrompt === 'function') {
                    showCompanionPrompt(activeTv);
                } else {
                    toggleWatchPartyChat(true);
                }
            };

            const chatDrawer = document.getElementById('watch-party-chat-drawer');
            const isChatOpen = chatDrawer && !chatDrawer.classList.contains('translate-x-full');
            const isCompanionModalOpen = !!document.getElementById('krk-companion-prompt-modal');

            if (isChatOpen || isCompanionModalOpen) {
                pill.classList.add('opacity-0', 'pointer-events-none');
            } else {
                pill.classList.remove('opacity-0', 'pointer-events-none');
            }
        }
        window.renderPersistentChatPill = renderPersistentChatPill;

        function toggleWatchPartyChat(forceState = null) {
            const drawer = getOrCreateWatchPartyChatDrawer();
            const isClosed = drawer.classList.contains('translate-x-full');
            const shouldOpen = forceState !== null ? forceState : isClosed;
            const pill = document.getElementById('krk-persistent-chat-pill');

            if (shouldOpen) {
                drawer.classList.remove('translate-x-full');
                document.getElementById('krk-chat-unread-badge')?.classList.add('hidden');
                document.getElementById('krk-cine-chat-unread-badge')?.classList.add('hidden');
                document.getElementById('krk-pill-unread-dot')?.classList.add('hidden');
                if (pill) pill.classList.add('opacity-0', 'pointer-events-none');
                setTimeout(() => document.getElementById('watch-party-chat-input')?.focus(), 200);
            } else {
                drawer.classList.add('translate-x-full');
                if (pill) pill.classList.remove('opacity-0', 'pointer-events-none');
            }
        }
        window.toggleWatchPartyChat = toggleWatchPartyChat;

        function renderWatchPartyChatBubble(msg) {
            const list = document.getElementById('watch-party-chat-list');
            if (!list) return;
            document.getElementById('watch-party-empty-hint')?.remove();

            const bubble = document.createElement('div');
            bubble.className = msg.isSelf ? 'flex flex-col items-end' : 'flex flex-col items-start';
            const timeFormatted = new Date(msg.time || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            bubble.innerHTML = `
                <div class="flex items-baseline gap-1.5 mb-0.5 px-1">
                    <span class="text-[10px] font-bold ${msg.isSelf ? 'text-amber-400' : 'text-zinc-400'}">${msg.sender}</span>
                    <span class="text-[9px] text-zinc-600 font-mono">${timeFormatted}</span>
                </div>
                <div class="max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                    msg.isSelf 
                        ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-black font-semibold rounded-tr-sm shadow-md shadow-amber-950/30' 
                        : 'bg-zinc-800/90 text-white border border-white/10 rounded-tl-sm shadow-md'
                }">
                    ${msg.text}
                </div>
            `;
            list.appendChild(bubble);
            list.scrollTop = list.scrollHeight;
        }

        function sendWatchPartyMessage(customText = null) {
            const input = document.getElementById('watch-party-chat-input');
            const text = (customText !== null ? customText : (input ? input.value : '')).trim();
            if (!text) return;
            if (input && customText === null) input.value = '';

            const msgObj = {
                sender: window.MY_NAME || 'Yo',
                text: text,
                time: Date.now(),
                isSelf: true
            };
            getOrCreateWatchPartyChatDrawer();
            renderWatchPartyChatBubble(msgObj);

            if (isEmojiOnly(text)) {
                renderWatchPartyDanmaku(window.MY_NAME || 'Tú', text);
            }

            const targets = getWatchPartyTargets();
            targets.forEach(tSid => {
                sendCommand(tSid, 'party_chat_' + JSON.stringify({
                    sender: window.MY_NAME || 'Amigo',
                    sender_sid: MY_SESSION_ID,
                    text: text,
                    time: Date.now()
                }));
            });

            renderPersistentChatPill();
        }
        window.sendWatchPartyMessage = sendWatchPartyMessage;

        function receiveWatchPartyMessage(payload) {
            if (!payload || !payload.text) return;
            const msgObj = {
                sender: payload.sender || 'Amigo',
                text: payload.text,
                time: payload.time || Date.now(),
                isSelf: false
            };

            getOrCreateWatchPartyChatDrawer();
            const drawer = document.getElementById('watch-party-chat-drawer');
            const isOpen = drawer && !drawer.classList.contains('translate-x-full');

            renderWatchPartyChatBubble(msgObj);

            renderPersistentChatPill();

            if (!isOpen) {
                renderWatchPartyDanmaku(msgObj.sender, msgObj.text);
                document.getElementById('krk-chat-unread-badge')?.classList.remove('hidden');
                document.getElementById('krk-cine-chat-unread-badge')?.classList.remove('hidden');
                document.getElementById('krk-pill-unread-dot')?.classList.remove('hidden');
            }
        }
        window.receiveWatchPartyMessage = receiveWatchPartyMessage;


        /**
         * ============================================================================
         * COMPANION MODE (MODO SEGUNDA PANTALLA Y CHAT REMOTO EN CELULAR)
         * ============================================================================
         */

        function checkActiveCompanionPrompt(users) {
            if (!users || !Array.isArray(users)) return;

            // Si este dispositivo ya tiene un video activo reproduciéndose, no molestamos
            const localVid = document.querySelector('#cine-screen video, #artplayer-container video, #main-video');
            if (localVid && !localVid.paused && localVid.currentTime > 0) return;
            if (window.currentVideoFile && document.getElementById('view-player')?.classList.contains('active')) return;

            const myName = (window.MY_NAME || '').trim().toLowerCase();
            const myEmail = (window.MY_EMAIL || '').trim().toLowerCase();

            const tvPlayback = users.find(u => {
                if (!u || !u.session_id || u.session_id === MY_SESSION_ID) return false;

                const uEmail = (u.email || '').toLowerCase().trim();
                const uName = (u.name || '').toLowerCase().trim();

                // 1. Solo puede ser segunda pantalla si es un dispositivo de MI PROPIA CUENTA
                const isMyAccount = Boolean(
                    u.is_me ||
                    (myEmail && uEmail && uEmail === myEmail) ||
                    (myName && uName && uName === myName)
                );

                // 2. O si estamos explícitamente en una sesión de Watch Party activa compartida
                const isSharedWatchParty = Boolean(
                    window.KRAKEN_SYNC_WATCH_PARTY && (u.party_title || u.friendName)
                );

                if (!isMyAccount && !isSharedWatchParty) {
                    return false;
                }

                const isTvOrSpeaker = u.is_speaker || u.device_type === 'tv' || /tv|sala|comedor|smart|chromecast/i.test(u.device_name || '');
                const isPlayingVideo = u.media_type === 'video' || (Number(u.time || 0) > 0 && Number(u.duration || 0) > 1200);

                return (isTvOrSpeaker || isSharedWatchParty) && isPlayingVideo && !!u.song;
            });

            if (!tvPlayback) return;

            const promptKey = tvPlayback.session_id + '_' + tvPlayback.song;
            if (window._dismissedCompanionPromptKey === promptKey) return;
            if (document.getElementById('krk-companion-prompt-modal')) return;

            // Si ya está abierto Cine Remote o el Drawer de Chat, no mostramos el prompt
            if (document.getElementById('cine-remote-modal')) return;
            const chatDrawer = document.getElementById('watch-party-chat-drawer');
            if (chatDrawer && !chatDrawer.classList.contains('translate-x-full')) return;

            showCompanionPrompt(tvPlayback);
        }
        window.checkActiveCompanionPrompt = checkActiveCompanionPrompt;

        function showCompanionPrompt(tvPlayback) {
            document.getElementById('krk-companion-prompt-modal')?.remove();

            const movieTitle = tvPlayback.song || 'Película / Serie';
            const devName = getDeviceDisplayName(tvPlayback);
            const isShared = !!(window.KRAKEN_SYNC_WATCH_PARTY || tvPlayback.party_title || tvPlayback.friendName);
            const promptKey = tvPlayback.session_id + '_' + tvPlayback.song;

            const modal = document.createElement('div');
            modal.id = 'krk-companion-prompt-modal';
            modal.className = 'fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-[380px] z-[10030] bg-[#141416]/95 backdrop-blur-xl border border-amber-500/40 rounded-3xl p-5 shadow-2xl shadow-black/80 animate-slide-up select-none';

            modal.innerHTML = `
                <div class="flex items-start justify-between gap-3 mb-3">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-300 flex items-center justify-center text-xl shrink-0 shadow-inner">
                            🍿
                        </div>
                        <div class="min-w-0">
                            <div class="text-[10px] uppercase font-bold tracking-wider text-amber-400 flex items-center gap-1.5">
                                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span>Viendo en pantalla</span>
                            </div>
                            <div class="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-[230px]" title="${movieTitle}">
                                ${movieTitle}
                            </div>
                            <div class="text-[10px] text-zinc-400 truncate">
                                ${devName} ${isShared ? '· <span class="text-amber-400 font-medium">En Watch Party</span>' : ''}
                            </div>
                        </div>
                    </div>
                    <button onclick="dismissCompanionPrompt('${promptKey}')" class="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition shrink-0" title="Ignorar">
                        <i class="fa-solid fa-xmark text-xs"></i>
                    </button>
                </div>

                <p class="text-[11px] text-zinc-300 mb-3.5 leading-relaxed">
                    ¿Deseas usar este celular como segunda pantalla para chatear o controlar la reproducción?
                </p>

                <div class="grid grid-cols-2 gap-2">
                    <button onclick="launchMobileChatCompanion('${tvPlayback.session_id}', '${(tvPlayback.song || '').replace(/'/g, "\\'")}', '${devName.replace(/'/g, "\\'")}')"
                        class="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black py-2.5 px-3 rounded-2xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20">
                        <i class="fa-solid fa-comments text-xs"></i>
                        <span>Modo Chat</span>
                    </button>
                    <button onclick="launchMobileCineRemote('${tvPlayback.session_id}')"
                        class="bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold py-2.5 px-3 rounded-2xl text-xs transition flex items-center justify-center gap-2">
                        <i class="fa-solid fa-gamepad text-xs"></i>
                        <span>Control Cine</span>
                    </button>
                </div>
            `;

            document.body.appendChild(modal);
        }
        window.showCompanionPrompt = showCompanionPrompt;

        function launchMobileChatCompanion(targetSid, movieTitle, devName) {
            document.getElementById('krk-companion-prompt-modal')?.remove();

            const targetDev = (LAST_USERS_DATA || []).find(u => u && u.session_id === targetSid);
            if (targetDev) {
                window.KRAKEN_PLAYBACK_TARGET = targetDev;
                window.KRAKEN_CONTROL_TARGET = targetDev;
            }

            if (!window.KRAKEN_SYNC_WATCH_PARTY) {
                window.KRAKEN_SYNC_WATCH_PARTY = {
                    targetSid: targetSid,
                    friendName: devName || 'Pantalla',
                    title: movieTitle,
                    participants: [targetSid]
                };
            } else {
                if (!window.KRAKEN_SYNC_WATCH_PARTY.participants) window.KRAKEN_SYNC_WATCH_PARTY.participants = [];
                if (!window.KRAKEN_SYNC_WATCH_PARTY.participants.includes(targetSid)) {
                    window.KRAKEN_SYNC_WATCH_PARTY.participants.push(targetSid);
                }
            }
            try { localStorage.setItem('kraken_sync_watch_party', JSON.stringify(window.KRAKEN_SYNC_WATCH_PARTY)); } catch (_) {}

            if (typeof toggleWatchPartyChat === 'function') {
                toggleWatchPartyChat(true);
            }

            renderCompanionChatBanner(targetSid, movieTitle, devName);
            showToast(`📱 Modo Chat y Segunda Pantalla activado para ${movieTitle}`, 'success');
        }
        window.launchMobileChatCompanion = launchMobileChatCompanion;

        function renderCompanionChatBanner(targetSid, movieTitle, devName) {
            document.getElementById('companion-chat-banner')?.remove();

            const banner = document.createElement('div');
            banner.id = 'companion-chat-banner';
            banner.className = 'fixed top-3 left-1/2 -translate-x-1/2 z-[10015] bg-black/90 backdrop-blur-md border border-amber-500/40 rounded-full px-4 py-1.5 flex items-center gap-3 text-xs shadow-2xl animate-slide-down select-none';

            banner.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <span class="text-amber-400 font-bold">Segunda Pantalla:</span>
                    <span class="text-white font-medium truncate max-w-[140px] sm:max-w-[200px]">${movieTitle}</span>
                </div>
                <div class="flex items-center gap-1.5 border-l border-white/10 pl-2">
                    <button onclick="launchMobileCineRemote('${targetSid}')" class="p-1 hover:bg-white/10 rounded-lg text-amber-300 hover:text-white transition" title="Abrir Cine Remote">
                        <i class="fa-solid fa-gamepad text-xs"></i>
                    </button>
                    <button onclick="document.getElementById('companion-chat-banner')?.remove()" class="p-1 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition" title="Cerrar aviso">
                        <i class="fa-solid fa-xmark text-xs"></i>
                    </button>
                </div>
            `;
            document.body.appendChild(banner);
        }
        window.renderCompanionChatBanner = renderCompanionChatBanner;

        function launchMobileCineRemote(targetSid) {
            document.getElementById('krk-companion-prompt-modal')?.remove();
            const targetDev = (LAST_USERS_DATA || []).find(u => u && u.session_id === targetSid);
            if (!targetDev) {
                showToast('El dispositivo ya no está disponible', 'warning');
                return;
            }
            const movieData = {
                title: targetDev.song || 'Película',
                path: targetDev.path || '',
                cover: targetDev.cover || ''
            };
            if (typeof showCineRemoteModal === 'function') {
                showCineRemoteModal(movieData, targetDev);
            }
        }
        window.launchMobileCineRemote = launchMobileCineRemote;

        function dismissCompanionPrompt(promptKey) {
            window._dismissedCompanionPromptKey = promptKey;
            document.getElementById('krk-companion-prompt-modal')?.remove();
        }
        window.dismissCompanionPrompt = dismissCompanionPrompt;
