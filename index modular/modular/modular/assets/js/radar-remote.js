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
            const icon = device.device_type === 'tv' ? '📺 ' : (device.device_type === 'mobile' ? '📱 ' : '');
            const raw = device.device_name || device.name || `Dispositivo ${String(device.session_id || '').slice(0, 6)}`;
            return icon ? `${icon}${raw}` : raw;
        }

        /**
         * `syncRemoteTargetsWithOnlineUsers()`
         * Verifica que el dispositivo controlado remotamente siga conectado y activo.
         */
        function syncRemoteTargetsWithOnlineUsers() {
            const onlineBySid = new Map((LAST_USERS_DATA || []).map(u => [u.session_id, u]));
            const previousPlaybackSid = window.KRAKEN_PLAYBACK_TARGET?.session_id || null;

            if (!window.KRAKEN_PLAYBACK_TARGET?.session_id) {
                const savedSid = localStorage.getItem(KRAKEN_PLAYBACK_TARGET_KEY);
                const savedTarget = savedSid ? onlineBySid.get(savedSid) : null;
                if (savedTarget && savedTarget.session_id !== MY_SESSION_ID) {
                    window.KRAKEN_PLAYBACK_TARGET = savedTarget;
                } else if (savedSid) {
                    localStorage.removeItem(KRAKEN_PLAYBACK_TARGET_KEY);
                }
            }

            if (window.KRAKEN_CONTROL_TARGET?.session_id) {
                const freshControl = onlineBySid.get(window.KRAKEN_CONTROL_TARGET.session_id);
                if (freshControl) {
                    window.KRAKEN_CONTROL_TARGET = freshControl;
                } else {
                    window.KRAKEN_CONTROL_TARGET = null;
                }
            }

            if (window.KRAKEN_PLAYBACK_TARGET?.session_id) {
                const freshPlayback = onlineBySid.get(window.KRAKEN_PLAYBACK_TARGET.session_id);
                if (freshPlayback) {
                    window.KRAKEN_PLAYBACK_TARGET = freshPlayback;
                } else {
                    window.KRAKEN_PLAYBACK_TARGET = null;
                }
            }

            const currentPlaybackSid = window.KRAKEN_PLAYBACK_TARGET?.session_id || null;
            if (previousPlaybackSid !== currentPlaybackSid) renderPlaybackTargetWidget();
        }

        /**
         * `getActiveRemotePlaybackTarget()`
         * Obtiene los datos del dispositivo remoto actualmente vinculado.
         */
        function getActiveRemotePlaybackTarget() {
            return window.KRAKEN_PLAYBACK_TARGET || window.KRAKEN_CONTROL_TARGET || null;
        }

        /**
         * `renderPlaybackTargetWidget()`
         * Renderiza el indicador de dispositivo de salida activo.
         */
        function renderPlaybackTargetWidget() {
            let panel = document.getElementById('playback-target-widget');
            const target = window.KRAKEN_PLAYBACK_TARGET;

            if (!target) {
                if (panel) panel.remove();
                return;
            }

            if (!panel) {
                panel = document.createElement('div');
                panel.id = 'playback-target-widget';
                panel.className = 'fixed left-4 bottom-[29rem] z-[451] w-[min(92vw,320px)]';
                document.body.appendChild(panel);
            }

            panel.innerHTML = `
                <div class="bg-[#101010]/95 border border-cyan-500/25 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden">
                    <div class="px-4 py-2 flex items-center justify-between gap-3">
                        <div class="min-w-0">
                            <div class="text-[10px] uppercase tracking-[0.24em] text-cyan-400">Salida Remota</div>
                            <div class="text-sm font-bold text-white truncate">${getDeviceDisplayName(target)}</div>
                            <div class="text-[11px] text-zinc-500 mt-0.5">Tocar una canción la reproducirá allá</div>
                        </div>
                        <button onclick="showControlMenu('${String(target.name || '').replace(/'/g, "\\'")}')" class="shrink-0 w-8 h-8 rounded-full bg-white/5 hover:bg-cyan-500/15 text-zinc-400 hover:text-cyan-300 transition" title="Cambiar salida">
                            <i class="fa-solid fa-arrows-rotate text-xs"></i>
                        </button>
                        <button onclick="clearPlaybackTarget()" class="shrink-0 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition" title="Quitar salida remota">
                            <i class="fa-solid fa-xmark text-xs"></i>
                        </button>
                    </div>
                </div>`;
        }

        /**
         * `renderControlledTargetWidget()`
         * Renderiza el banner de control remoto ('El Titiritero') cuando se controla otro equipo.
         */
        function renderControlledTargetWidget() {
            let panel = document.getElementById('remote-control-widget');
            const target = window.KRAKEN_CONTROL_TARGET;

            if (!target) {
                if (panel) panel.remove();
                return;
            }

            if (!panel) {
                panel = document.createElement('div');
                panel.id = 'remote-control-widget';
                panel.className = 'fixed left-4 bottom-40 z-[450] w-[min(92vw,320px)]';
                document.body.appendChild(panel);
            }

            const deviceLabel = getDeviceDisplayName(target);
            const durationValue = Math.max(0, Number(target.duration || 0));
            const currentTimeValue = Math.max(0, Math.min(durationValue || 0, Number(target.time || 0)));
            const mediaLabel = target.song
                ? `<div class="text-sm font-semibold text-white truncate">${target.song}</div>
                   <div class="text-xs text-zinc-400 truncate">${target.artist || 'Sin artista'}</div>`
                : `<div class="text-sm font-semibold text-white">Sin reproducción activa</div>
                   <div class="text-xs text-zinc-500">${target.library_mode === 'video' ? 'Video' : 'Audio'} listo para controlar</div>`;
            const playLabel = target.is_playing ? 'pause' : 'play';
            const playIcon = target.is_playing ? 'fa-pause' : 'fa-play';

            panel.innerHTML = `
                <div class="bg-[#141414]/95 border border-emerald-500/25 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden">
                    <div class="px-4 py-2 border-b border-white/5 flex items-center justify-between gap-3">
                        <div class="min-w-0">
                            <div class="text-[10px] uppercase tracking-[0.24em] text-emerald-400">Controlando</div>
                            <div class="text-sm font-bold text-white truncate">${deviceLabel}</div>
                        </div>
                        <button onclick="unlinkControlledDevice()" class="shrink-0 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition" title="Dejar de controlar">
                            <i class="fa-solid fa-link-slash text-xs"></i>
                        </button>
                    </div>
                    <div class="px-4 py-3">
                        ${mediaLabel}
                        <div class="text-[11px] text-zinc-500 mt-2">${target.time ? `${formatTimeShort(target.time)} / ${formatTimeShort(target.duration)}` : 'Sincronizando estado...'}</div>
                        ${durationValue > 0 ? `
                        <div class="mt-3">
                            <input
                                type="range"
                                min="0"
                                max="${durationValue}"
                                step="1"
                                value="${currentTimeValue}"
                                class="w-full accent-emerald-500"
                                onchange="sendRemoteSeek(this.value)"
                                oninput="document.getElementById('remote-seek-label').innerText = formatTimeShort(this.value) + ' / ${formatTimeShort(target.duration)}'">
                            <div id="remote-seek-label" class="mt-1 text-[10px] text-zinc-500 text-center">${formatTimeShort(target.time)} / ${formatTimeShort(target.duration)}</div>
                        </div>` : ''}
                        <div class="flex items-center justify-center gap-3 mt-4">
                            <button onclick="sendCommand(null,'prev')" class="w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center transition">
                                <i class="fa-solid fa-backward-step text-xs"></i>
                            </button>
                            <button onclick="sendCommand(null,'${playLabel}')" class="w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center shadow-lg transition">
                                <i class="fa-solid ${playIcon} text-sm"></i>
                            </button>
                            <button onclick="sendCommand(null,'next')" class="w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center transition">
                                <i class="fa-solid fa-forward-step text-xs"></i>
                            </button>
                        </div>
                        <div class="flex items-center justify-center gap-2 mt-3">
                            <button onclick="sendCommand(null,'vol_down')" class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-300 transition">Vol -</button>
                            <button onclick="sendCommand(null,'vol_up')" class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-300 transition">Vol +</button>
                        </div>
                        <button onclick="sendCurrentTrackToControlledDevice()" class="mt-3 w-full px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition">
                            <i class="fa-solid fa-paper-plane mr-1"></i> Enviar lo que suena aquí
                        </button>
                    </div>
                </div>`;
        }

        /**
         * `applyControlledTargetState(target)`
         * Sincroniza la barra del reproductor con el estado del dispositivo remoto controlado.
         */
        function applyControlledTargetState(target) {
            window.KRAKEN_CONTROL_TARGET = target || null;
            renderControlledTargetWidget();
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
         * Envía un comando de salto de tiempo (`seek`) al dispositivo controlado.
         */
        function sendRemoteSeek(value) {
            const seconds = Math.max(0, Math.floor(Number(value) || 0));
            sendCommand(null, `seek_to_${seconds}`);
        }

        /**
         * `sendFileToControlledDevice(file, target = null)`
         * Ordena a un dispositivo remoto reproducir o encolar un archivo específico.
         */
        function sendFileToControlledDevice(file, target = null) {
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
                path: file.path,
                title: file.title || '',
                artist: file.artist || '',
                type: file.type || 'audio'
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

            console.log("🎮 ORDEN REMOTA:", action);

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

            const activeVideo = document.getElementById('main-video');

            if (action === 'pause') {
                if (activeVideo && !activeVideo.paused) {
                    activeVideo.pause();
                    syncPlayPauseIcon?.();
                } else {
                    togglePlay();
                }
                return;
            }
            if (action === 'play') {
                if (activeVideo && activeVideo.paused) {
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
                if (activeVideo) activeVideo.volume = newVol;
                syncPlayerUI?.();
                return;
            }
            if (action === 'vol_down') {
                const newVol = Math.max(0, (audioElement?.volume || 0) - 0.1);
                setVolume(newVol);
                if (activeVideo) activeVideo.volume = newVol;
                syncPlayerUI?.();
                return;
            }
            if (action.startsWith('set_volume_')) {
                const raw = Number(action.slice('set_volume_'.length));
                if (!Number.isNaN(raw)) {
                    const safeVolume = Math.max(0, Math.min(1, raw));
                    setVolume(safeVolume);
                    if (activeVideo) activeVideo.volume = safeVolume;
                    syncPlayerUI?.();
                }
                return;
            }
            if (action.startsWith('seek_to_')) {
                const raw = Number(action.slice('seek_to_'.length));
                if (!Number.isNaN(raw)) {
                    if (activeVideo) activeVideo.currentTime = Math.max(0, raw);
                    else if (audioElement) audioElement.currentTime = Math.max(0, raw);
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

            // 2. AGRUPAR USUARIOS
            const groups = users.reduce((acc, u) => {
                const name = u.name || "Anónimo";
                if (!acc[name]) acc[name] = [];
                acc[name].push(u);
                return acc;
            }, {});

            // 3. GENERAR BURBUJAS
            const bubblesHtml = Object.keys(groups).map(name => {
                const devices = groups[name];
                const isMe = (name === MY_NAME);
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
            
            <div onclick="showControlMenu('${name}')" class="w-14 h-14 rounded-full overflow-hidden ${baseColor} ${ringColor} flex items-center justify-center text-lg font-bold text-white shadow-lg cursor-pointer relative z-30 hover:scale-110 transition-transform bg-zinc-800">
                ${centerIcon}
                ${count > 1 ? `<div class="absolute -bottom-1 -right-1 w-4 h-4 bg-black text-white text-[9px] rounded-full flex items-center justify-center border border-white/20">${count}</div>` : ''}
            </div>

            <div class="absolute bottom-full mb-2 right-0 bg-black/90 backdrop-blur-md text-white px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10 shadow-xl text-right z-50">
                <div class="font-bold text-xs mb-0.5 ${isSuperAdmin ? 'text-yellow-400' : 'text-emerald-400'}">${name} ${isMe ? '(Tú)' : ''}</div>
                ${listeningTo}
                <div class="text-[9px] text-gray-500 mt-1 italic">Clic para controlar 🎮</div>
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
         * `showControlMenu(userName)`
         * Abre el modal de interacción social y control remoto al hacer clic en un usuario del radar.
         */
        function showControlMenu(userName) {
            const devices = LAST_USERS_DATA.filter(u => u.name === userName);
            if (devices.length === 0) return;

            const dev = devices[0]; // Primary device
            const isMe = dev.is_me === true;
            const isSuperAdmin = dev.is_superadmin;
            const avatar = dev.avatar;
            const hasSong = dev.song && dev.song !== 'Reproductor';

            const modalId = 'control-modal';
            const existing = document.getElementById(modalId);
            if (existing) existing.remove();

            // --- Avatar or initial ---
            const avatarHtml = avatar
                ? `<img src="${avatar}" class="w-full h-full object-cover">`
                : `<span class="text-3xl font-black">${userName.charAt(0).toUpperCase()}</span>`;

            // --- Ring style ---
            const ringClass = isSuperAdmin
                ? 'ring-4 ring-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.6)]'
                : isMe
                    ? 'ring-4 ring-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                    : 'ring-4 ring-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.4)]';

            // --- Now playing block ---
            const nowPlayingHtml = hasSong ? `
                <div class="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5 border border-white/10 mb-4">
                    <div class="flex-1 min-w-0">
                        <div class="text-[9px] text-zinc-500 uppercase tracking-widest mb-0.5">Escuchando</div>
                        <div class="text-sm text-white font-semibold truncate">🎵 ${dev.song}</div>
                        ${dev.artist ? `<div class="text-xs text-zinc-400 truncate">${dev.artist}</div>` : ''}
                    </div>
                    ${!isMe ? `
                    <button onclick="listenSame('${dev.session_id}', '${(dev.path || '').replace(/'/g, "\\'")}', '${(dev.song || '').replace(/'/g, "\\'")}', '${(dev.artist || '').replace(/'/g, "\\'")}'); document.getElementById('${modalId}').remove();"
                        class="shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/40 flex items-center justify-center transition" title="Escuchar lo mismo">
                        <i class="fa-solid fa-headphones text-emerald-400 text-xs"></i>
                    </button>` : ''}
                </div>` : `
                <div class="text-center text-xs text-zinc-600 italic mb-4">Sin reproducción activa</div>`;

            // --- Emoji reactions ---
            const emojis = ['👋', '❤️', '🔥', '👻', '🤬', '😂', '🎉', '🤘'];
            const emojiHtml = emojis.map(e =>
                `<button onclick="sendCommand('${dev.session_id}','emoji_${e}')" class="text-xl hover:scale-125 transition-transform" title="${e}">${e}</button>`
            ).join('');

            // --- Social buttons (only for others) ---
            const socialHtml = !isMe ? `
                <div class="grid grid-cols-2 gap-2 mb-4">
                    <button onclick="sendQuickMessage('${dev.session_id}','${userName}')"
                        class="flex items-center justify-center gap-2 bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/40 rounded-xl py-2.5 text-xs text-zinc-300 hover:text-blue-300 transition font-medium">
                        <i class="fa-solid fa-message text-blue-400"></i> Mensaje
                    </button>
                    <button onclick="recommendSong('${dev.session_id}','${userName}'); document.getElementById('${modalId}').remove();"
                        class="flex items-center justify-center gap-2 bg-white/5 hover:bg-yellow-500/20 border border-white/10 hover:border-yellow-500/40 rounded-xl py-2.5 text-xs text-zinc-300 hover:text-yellow-300 transition font-medium">
                        <i class="fa-solid fa-star text-yellow-400"></i> Recomendar
                    </button>
                </div>` : '';

            // --- Playback controls ---
            const controlsHtml = devices.map(d => {
                const deviceLabel = getDeviceDisplayName(d);
                const isCurrentSession = d.session_id === MY_SESSION_ID;
                const isControlled = window.KRAKEN_CONTROL_TARGET && window.KRAKEN_CONTROL_TARGET.session_id === d.session_id;
                return `
                <div class="mb-3 last:mb-0">
                    ${devices.length > 1 ? `<div class="flex items-center justify-between gap-2 mb-2"><div class="text-[9px] text-zinc-600 uppercase tracking-widest">${deviceLabel}</div>${isCurrentSession ? '<span class="text-[9px] text-emerald-400 uppercase tracking-widest">Este equipo</span>' : ''}</div>` : ''}
                    <div class="flex justify-center gap-3">
                        <button onclick="sendCommand('${d.session_id}','prev')" class="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center transition">
                            <i class="fa-solid fa-backward-step text-xs"></i></button>
                        <button onclick="sendCommand('${d.session_id}','pause')" class="w-11 h-11 rounded-full bg-emerald-500/80 hover:bg-emerald-400 flex items-center justify-center shadow-lg hover:scale-105 transition">
                            <i class="fa-solid fa-power-off text-sm"></i></button>
                        <button onclick="sendCommand('${d.session_id}','next')" class="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center transition">
                            <i class="fa-solid fa-forward-step text-xs"></i></button>
                    </div>
                    <div class="flex items-center justify-center gap-3 mt-2">
                        <i class="fa-solid fa-volume-low text-[9px] text-zinc-600"></i>
                        <button onclick="sendCommand('${d.session_id}','vol_down')" class="w-8 h-6 rounded bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center">
                            <i class="fa-solid fa-minus text-[8px]"></i></button>
                        <button onclick="sendCommand('${d.session_id}','vol_up')" class="w-8 h-6 rounded bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center">
                            <i class="fa-solid fa-plus text-[8px]"></i></button>
                        <i class="fa-solid fa-volume-high text-[9px] text-zinc-600"></i>
                    </div>
                    ${isCurrentSession ? `
                    <button onclick="setPlaybackTarget('local'); document.getElementById('${modalId}').remove();"
                        class="mt-3 w-full flex items-center justify-center gap-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-xl py-2 text-[11px] text-emerald-300 transition">
                        <i class="fa-solid fa-house text-[10px]"></i> Usar este equipo como salida
                    </button>` : `
                    <div class="mt-3 flex gap-2">
                        <button onclick="${isControlled ? "unlinkControlledDevice()" : `linkControlledDevice('${d.session_id}')`}" class="flex-1 flex items-center justify-center gap-2 ${isControlled ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-white/5 border-white/10 text-zinc-300 hover:border-emerald-500/30 hover:text-emerald-300'} border rounded-xl py-2 text-[11px] font-medium transition">
                            <i class="fa-solid ${isControlled ? 'fa-link-slash' : 'fa-gamepad'} text-[10px]"></i>
                            ${isControlled ? 'Soltar control' : 'Controlar'}
                        </button>
                        <button onclick="setPlaybackTarget('${d.session_id}'); document.getElementById('${modalId}').remove();" class="flex-1 flex items-center justify-center gap-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-xl py-2 text-[11px] font-medium transition" title="Enviar música/video a este dispositivo">
                            <i class="fa-solid fa-satellite-dish text-[10px]"></i>
                            Salida Activa
                        </button>
                    </div>`}
                </div>`;
            }).join('');

            // --- Self-only actions ---
            const selfActionsHtml = isMe ? `
                <div class="flex gap-2 mt-4 pt-4 border-t border-white/10">
                    <button onclick="document.getElementById('${modalId}').remove(); showEditProfileModal();"
                        class="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/40 rounded-xl py-2.5 text-xs text-zinc-300 hover:text-emerald-300 transition font-medium">
                        <i class="fa-solid fa-pen text-emerald-400"></i> Editar Perfil
                    </button>
                    <button onclick="copyCurrentPlaylistLink('${modalId}')"
                        class="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/40 rounded-xl py-2.5 text-xs text-zinc-300 hover:text-cyan-300 transition font-medium">
                        <i class="fa-solid fa-link text-cyan-400"></i> Compartir Lista
                    </button>
                </div>` : '';

            // Superadmin sees the email
            const emailHtml = (window.MY_EMAIL && LAST_USERS_DATA.find(u => u.is_me)?.is_superadmin && dev.email)
                ? `<div class="text-[9px] text-zinc-600 font-mono mt-0.5">${dev.email}</div>` : '';

            const modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm';
            modal.onclick = e => { if (e.target === modal) modal.remove(); };

            modal.innerHTML = `
            <div class="bg-[#141414] border border-white/10 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm shadow-2xl overflow-hidden animate-slide-up">

                <!-- Header strip -->
                <div class="h-1 w-full ${isSuperAdmin ? 'bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400' : isMe ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}"></div>

                <div class="p-5">
                    <!-- Identity zone -->
                    <div class="flex items-center gap-4 mb-5">
                        <div class="relative shrink-0">
                            <div class="w-16 h-16 rounded-full overflow-hidden ${ringClass} bg-zinc-800">
                                ${avatarHtml}
                            </div>
                            ${isSuperAdmin ? '<div class="absolute -top-2 left-1/2 -translate-x-1/2 text-base leading-none">👑</div>' : ''}
                            ${isMe ? '<div class="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-[#141414] flex items-center justify-center"><i class="fa-solid fa-check text-[8px] text-white"></i></div>' : ''}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <h3 class="font-black text-white text-lg leading-tight truncate">${userName}</h3>
                                ${isMe ? '<span class="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold">TÚ</span>' : ''}
                            </div>
                            ${emailHtml}
                            <div class="text-[10px] text-zinc-500 mt-0.5">${devices.length > 1 ? `${devices.length} dispositivos` : 'En línea'}</div>
                        </div>
                        <button onclick="document.getElementById('${modalId}').remove()" class="shrink-0 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition">
                            <i class="fa-solid fa-xmark text-sm"></i>
                        </button>
                    </div>

                    <!-- Now playing -->
                    ${nowPlayingHtml}

                    <!-- Social buttons -->
                    ${socialHtml}

                    <!-- Emoji reactions -->
                    <div class="bg-black/30 rounded-xl px-3 py-2.5 border border-white/5 mb-4">
                        <div class="text-[9px] text-zinc-600 uppercase tracking-widest mb-2">Reacciones</div>
                        <div class="flex justify-between">${emojiHtml}</div>
                    </div>

                    <!-- Playback controls -->
                    <div class="bg-black/30 rounded-xl p-3 border border-white/5">
                        <div class="text-[9px] text-zinc-600 uppercase tracking-widest mb-3">Controles de Reproducción</div>
                        ${controlsHtml}
                    </div>

                    <!-- Self actions -->
                    ${selfActionsHtml}
                </div>
            </div>`;

            document.body.appendChild(modal);
        }

        // --- NEW SOCIAL FUNCTIONS ---

        /**
         * `listenSame(targetSid, path, song, artist)`
         * Sincroniza la reproducción local con la canción que está escuchando otro usuario.
         */
        function listenSame(targetSid, path, song, artist) {
            if (!path) { showToast('Este usuario no está reproduciendo nada', 'warning'); return; }
            const match = window.libData?.files?.find(t => t.path === path || t.title === song);
            if (match) {
                playTrack(match, window.libData.files);
                showToast(`🎵 Escuchando: ${song}`, 'success');
            } else {
                const fakeTrack = { path, title: song, artist, album: '', genre: '' };
                playTrack(fakeTrack, [fakeTrack]);
                showToast(`🎵 Sintonizando: ${song}`, 'success');
            }
        }

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
            const resolvedTarget = targetSid || window.KRAKEN_CONTROL_TARGET?.session_id;
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
                        from_email: window.MY_EMAIL || ''
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
