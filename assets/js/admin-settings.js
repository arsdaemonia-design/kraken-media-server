/**
 * ============================================================================
 * KRAKEN MEDIA SERVER — admin-settings.js
 * Asistente de configuración inicial (Setup Wizard), panel de administración, gestión de usuarios/invitaciones, bóveda +18, Librosa y perfiles.
 * ============================================================================
 */

// ========================================
// SETUP WIZARD (Primera vez)
// ========================================
/**
 * `checkSetupStatus()`
 * Consulta `/api/setup/status` para verificar si el servidor requiere el asistente de configuración inicial.
 */
async function checkSetupStatus() {
    try {
        const res = await fetch('/api/setup/status');
        const d = await res.json();
        if (d.needs_setup) {
            showSetupWizard();
        }
    } catch (_) { }
}
/**
 * `showSetupWizard()`
 * Despliega el modal interactivo de configuración inicial (ruta de biblioteca y PIN Maestro).
 */
function showSetupWizard() {
    if (document.getElementById('kraken-setup-modal')) return;

    const html = `
    <div id="kraken-setup-modal" class="fixed inset-0 bg-black/95 backdrop-blur-md z-[99999] flex items-center justify-center p-4">
        <div class="bg-[#121212] border border-emerald-500/30 rounded-2xl w-full max-w-md p-8 shadow-2xl relative overflow-hidden">
            
            <div class="text-center mb-8">
                <div class="text-6xl mb-4">🐙</div>
                <h2 class="text-3xl font-black text-white">Kraken Media Server</h2>
                <p class="text-sm text-zinc-400 mt-2">Configuración inicial</p>
            </div>
            
            <div class="space-y-6">
                <div>
                    <label class="block text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 ml-1">
                        <i class="fa-solid fa-envelope mr-1"></i> Email de Administrador
                    </label>
                    <input type="email" id="setup-email" placeholder="tuemail@gmail.com" 
                           class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition">
                    <p class="text-xs text-zinc-500 mt-1 ml-1">Solo emails de Gmail</p>
                </div>
                
                <div>
                    <label class="block text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 ml-1">
                        <i class="fa-solid fa-lock mr-1"></i> PIN de Seguridad
                    </label>
                    <input type="password" id="setup-pin" placeholder="Minimo 4 digitos" 
                           class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                           minlength="4" maxlength="20">
                    <p class="text-xs text-zinc-500 mt-1 ml-1">Para proteger acciones importantes</p>
                </div>
                
                <!-- 🔥 NUEVO INPUT AÑADIDO (WIZARD) 🔥 -->
                <div>
                    <label class="block text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 ml-1">
                        <i class="fa-solid fa-folder mr-1"></i> Ruta de Biblioteca
                    </label>
                    <input type="text" id="setup-media-path" placeholder="Ej: D:\\Mis Discos\\Kraken" 
                           class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition">
                    <p class="text-xs text-zinc-500 mt-1 ml-1">Opcional. Deja vacío para usar MiPC/Kraken Media</p>
                </div>
                
                <button onclick="submitSetupWizard()" id="setup-submit-btn"
                        class="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-900/50 hover:shadow-emerald-900/80 transition-all hover:scale-[1.02] flex items-center justify-center gap-2">
                    <i class="fa-solid fa-rocket"></i> Configurar y Continuar
                </button>
            </div>
            
            <div class="mt-6 text-center">
                <p class="text-xs text-zinc-500">
                    Este email y PIN se usarán para administrar el servidor.<br>
                    Guárdalos en un lugar seguro.
                </p>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}
/**
 * `submitSetupWizard()`
 * Envía y guarda la configuración inicial del servidor al backend.
 */
async function submitSetupWizard() {
    const email = document.getElementById('setup-email').value.trim();
    const pin = document.getElementById('setup-pin').value;
    const mediaPath = document.getElementById('setup-media-path')?.value.trim(); // 🔥 NUEVO LECTOR 🔥
    const btn = document.getElementById('setup-submit-btn');

    if (!email) {
        showToast('Email es requerido', 'error');
        return;
    }
    if (!email.endsWith('@gmail.com')) {
        showToast('Solo se permiten emails de Gmail', 'error');
        return;
    }
    if (pin.length < 4) {
        showToast('PIN debe tener al menos 4 digitos', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Configurando...';

    try {
        const res = await fetch('/api/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, pin, media_path: mediaPath }) // 🔥 JSON MODIFICADO 🔥
        });
        const d = await res.json();

        if (d.ok) {
            document.getElementById('kraken-setup-modal').remove();
            showToast('Configuración guardada', 'success');
            location.reload();
        } else {
            showToast(d.error || 'Error al guardar', 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-rocket"></i> Configurar y Continuar';
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-rocket"></i> Configurar y Continuar';
    }
}
// ========================================
// SETTINGS PANEL (ADMIN)
// ========================================
/**
 * `showSettingsPanel()`
 * Punto de entrada principal para abrir el panel de ajustes o administración según el rol del usuario.
 */
function showSettingsPanel() {
    if (document.getElementById('kraken-settings-modal')) {
        document.getElementById('kraken-settings-modal').remove();
    }

    fetch('/api/setup/status')
        .then(r => r.json())
        .then(d => {
            if (d.needs_setup) {
                showFirstTimeSetup(d);
            } else {
                const pin = getMasterPin('PIN requerido para acceder a Configuración:');
                if (!pin) return;
                showAdminPanel(pin);
            }
        })
        .catch(() => showToast('Error cargando configuración', 'error'));
}

/**
 * `showFirstTimeSetup(d)`
 * Muestra el formulario de creación de la cuenta administradora principal en instalaciones nuevas.
 */
function showFirstTimeSetup(d) {
    const html = `
    <div id="kraken-settings-modal" class="fixed inset-0 bg-black/95 backdrop-blur-md z-[99999] flex items-center justify-center p-4">
        <div class="bg-[#121212] border border-emerald-500/30 rounded-2xl w-full max-w-md p-8 shadow-2xl">
            <div class="text-center mb-8">
                <div class="text-6xl mb-4">🐙</div>
                <h2 class="text-3xl font-black text-white">Kraken Media Server</h2>
                <p class="text-sm text-zinc-400 mt-2">Configuración inicial</p>
            </div>
            
            <div class="space-y-6">
                <div>
                    <label class="block text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 ml-1">
                        <i class="fa-solid fa-user mr-1"></i> Nombre de Usuario
                    </label>
                    <input type="text" id="setup-username" placeholder="Tu nombre" 
                           class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition">
                </div>
                
                <div>
                    <label class="block text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 ml-1">
                        <i class="fa-solid fa-lock mr-1"></i> Contraseña
                    </label>
                    <input type="password" id="setup-password" placeholder="Mínimo 8 caracteres" minlength="8"
                           class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition">
                </div>
                
                <div>
                    <label class="block text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 ml-1">
                        <i class="fa-solid fa-key mr-1"></i> PIN Maquin
                    </label>
                    <input type="password" id="setup-master-pin" placeholder="Mínimo 4 dígitos" minlength="4"
                           class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition">
                    <p class="text-xs text-zinc-500 mt-1 ml-1">Para proteger acciones importantes</p>
                </div>
                
                <div>
                    <label class="block text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 ml-1">
                        <i class="fa-solid fa-folder mr-1"></i> Ruta de Biblioteca
                    </label>
                    <input type="text" id="setup-media-path" value="${d.current_media_path || ''}" placeholder="Ej: D:\\Mis Discos\\Kraken" 
                           class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition">
                </div>
                
                <button onclick="submitFirstTimeSetup()" id="setup-submit-btn"
                        class="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-900/50 hover:shadow-emerald-900/80 transition-all hover:scale-[1.02] flex items-center justify-center gap-2">
                    <i class="fa-solid fa-rocket"></i> Configurar y Continuar
                </button>
            </div>
            
            <div class="mt-6 text-center">
                <p class="text-xs text-zinc-500">
                    Este usuario será el administrador.<br>
                    Guarda tu contraseña y PIN en un lugar seguro.
                </p>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

/**
 * `submitFirstTimeSetup()`
 * Registra el primer usuario administrador y almacena su sesión JWT.
 */
async function submitFirstTimeSetup() {
    const username = document.getElementById('setup-username').value.trim();
    const password = document.getElementById('setup-password').value;
    const masterPin = document.getElementById('setup-master-pin').value;
    const mediaPath = document.getElementById('setup-media-path')?.value.trim();
    const btn = document.getElementById('setup-submit-btn');

    if (!username) {
        showToast('Nombre de usuario requerido', 'error');
        return;
    }
    if (!password || password.length < 4) {
        showToast('Contraseña mínimo 4 caracteres', 'error');
        return;
    }
    if (!masterPin || masterPin.length < 4) {
        showToast('PIN mínimo 4 dígitos', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Configurando...';

    try {
        const res = await fetch('/api/setup/firsttime', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, pin: masterPin, media_path: mediaPath })
        });
        const d = await res.json();

        if (d.ok) {
            document.getElementById('kraken-settings-modal').remove();
            showToast('Configuración guardada', 'success');
            location.reload();
        } else {
            showToast(d.error || 'Error al guardar', 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-rocket"></i> Configurar y Continuar';
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-rocket"></i> Configurar y Continuar';
    }
}

/**
 * `showAdminPanel(pin)`
 * Construye y abre el panel de administración (pestañas de Ajustes, Usuarios, Contenido +18 y Subtítulos).
 */
function showAdminPanel(pin) {
    fetch('/api/setup/status')
        .then(r => r.json())
        .then(d => {
            const html = `
            <div id="kraken-settings-modal" class="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-6">
                <div class="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                    <div class="flex justify-between items-center p-6 border-b border-white/10">
                        <h2 class="text-xl font-bold text-white"><i class="fa-solid fa-gear text-emerald-500 mr-2"></i>Configuración</h2>
                        <button onclick="document.getElementById('kraken-settings-modal').remove()" class="text-zinc-500 hover:text-white">
                            <i class="fa-solid fa-xmark text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="flex-1 overflow-y-auto p-6">
                        <div class="flex gap-2 mb-6 flex-wrap">
                            <button onclick="showSettingsTab('general')" id="tab-general" class="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium">General</button>
                            <button onclick="showSettingsTab('playback')" id="tab-playback" class="px-4 py-2 rounded-lg bg-zinc-700 text-zinc-300 hover:bg-zinc-600">Reproducción</button>
                            <button onclick="showSettingsTab('users')" id="tab-users" class="px-4 py-2 rounded-lg bg-zinc-700 text-zinc-300 hover:bg-zinc-600">Usuarios</button>
                            <button onclick="showSettingsTab('invites')" id="tab-invites" class="px-4 py-2 rounded-lg bg-zinc-700 text-zinc-300 hover:bg-zinc-600">Invitaciones</button>
                            <button onclick="showSettingsTab('adult')" id="tab-adult" class="hidden px-4 py-2 rounded-lg bg-zinc-700 text-zinc-300 hover:bg-zinc-600">🔞 Adult</button>
                        </div>
                        
                        <div id="content-general">
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Ruta de Archivos</label>
                                    <input type="text" id="settings-media-path" value="${d.current_media_path || ''}" placeholder="Ej: D:\\Mis Discos" 
                                           class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition">
                                </div>
                                
                                <div>
                                    <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Nuevo PIN Maquin</label>
                                    <input type="password" id="settings-new-pin" placeholder="Mínimo 4 dígitos" minlength="4"
                                           class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition">
                                </div>
                                
                                <div>
                                    <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Código Especial</label>
                                    <input type="password" id="settings-secret-word" placeholder="*****"
                                           class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition">
                                </div>

                                <div>
                                    <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">API key de SubDL</label>
                                    <input type="password" id="settings-subdl-api-key" autocomplete="new-password"
                                           placeholder="${d.has_subdl_api_key ? 'Ya configurada; escribe otra solo para reemplazarla' : 'Pega aquí tu API key gratuita de SubDL'}"
                                           class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition">
                                    <p class="text-[10px] text-zinc-500 mt-1">Se guarda en este servidor y no se envía al navegador durante las búsquedas.</p>
                                </div>
                                
                                <button onclick="saveSettings('${pin}')" id="settings-save-btn"
                                        class="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold py-3 rounded-xl transition-all hover:scale-[1.02] flex items-center justify-center gap-2">
                                    <i class="fa-solid fa-save"></i> Guardar Cambios
                                </button>
                            </div>
                        </div>

                        <div id="content-playback" class="hidden">
                            <div class="space-y-5">
                                <p class="text-xs text-zinc-500 -mb-1">Estas preferencias se aplican al instante y se guardan en este dispositivo.</p>

                                <div>
                                    <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
                                        <i class="fa-solid fa-closed-captioning text-emerald-500 mr-1"></i> Tamaño de subtítulos
                                    </label>
                                    <select id="pref-subtitle-size" onchange="setVideoPref('subtitleSize', this.value)"
                                            class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition">
                                        <option value="small">Pequeño (18px)</option>
                                        <option value="medium" selected>Mediano (22px)</option>
                                        <option value="large">Grande (28px)</option>
                                        <option value="xlarge">Extra grande (36px)</option>
                                    </select>
                                </div>

                                <div>
                                    <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
                                        <i class="fa-solid fa-text-height text-emerald-500 mr-1"></i> Estilo de subtítulos
                                    </label>
                                    <select id="pref-subtitle-style" onchange="setVideoPref('subtitleStyle', this.value)"
                                            class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition">
                                        <option value="outline" selected>Contorno (texto nítido)</option>
                                        <option value="background">Fondo oscuro</option>
                                        <option value="both">Contorno + fondo</option>
                                    </select>
                                </div>

                                <div>
                                    <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
                                        <i class="fa-solid fa-volume-high text-emerald-500 mr-1"></i> Volumen inicial
                                    </label>
                                    <select id="pref-default-volume" onchange="setVideoPref('defaultVolume', this.value)"
                                            class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition">
                                        <option value="1">100%</option>
                                        <option value="0.75">75%</option>
                                        <option value="0.5">50%</option>
                                    </select>
                                </div>

                                <div>
                                    <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
                                        <i class="fa-solid fa-gauge-high text-emerald-500 mr-1"></i> Velocidad por defecto
                                    </label>
                                    <select id="pref-default-rate" onchange="setVideoPref('defaultRate', this.value)"
                                            class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition">
                                        <option value="0.5">0.5x</option>
                                        <option value="0.75">0.75x</option>
                                        <option value="1" selected>1x (normal)</option>
                                        <option value="1.25">1.25x</option>
                                        <option value="1.5">1.5x</option>
                                        <option value="2">2x</option>
                                    </select>
                                </div>

                                <div>
                                    <label class="flex items-center justify-between cursor-pointer bg-black/50 border border-white/10 rounded-xl px-4 py-3">
                                        <span class="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                                            <i class="fa-solid fa-forward text-emerald-500 mr-1"></i> Auto-reproducir siguiente
                                        </span>
                                        <input type="checkbox" id="pref-autonext" onchange="setVideoPref('autonext', this.checked)"
                                               class="w-5 h-5 accent-emerald-500">
                                    </label>
                                </div>
                            </div>
                        </div>
                        
                        <div id="content-users" class="hidden">
                            <div class="mb-4 flex gap-3">
                                <input type="text" id="new-user-name" placeholder="Nombre de usuario" 
                                       class="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition">
                                <input type="password" id="new-user-password" placeholder="Mín. 8 caracteres" minlength="8"
                                       class="w-40 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition">
                                <button onclick="adminCreateUser()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold">
                                    <i class="fa-solid fa-plus"></i> Crear
                                </button>
                            </div>
                            <div id="users-list" class="space-y-2 max-h-64 overflow-y-auto"></div>
                        </div>
                        
                    <div id="content-adult" class="hidden">
                        <h3 class="text-white font-bold mb-2">Configuración de Contenido Adulto</h3>
                        <p class="text-xs text-zinc-400 mb-4">Los videos con estas clasificaciones se ocultarán automáticamente de la biblioteca y solo serán visibles para ti en la categoría "🔞 Adult" cuando uses el PIN.</p>
                        
                        <div class="grid grid-cols-4 gap-2 mb-4" id="adult-ratings-grid">
                            <!-- Checkboxes will be rendered here -->
                        </div>
                        <button onclick="applyAdultRatings()" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-xl transition">Guardar y Aplicar Filtros Automáticos</button>
                        
                        <h3 class="text-white font-bold mt-8 mb-2">Contenido Oculto Manualmente</h3>
                        <div id="adult-items-list" class="space-y-2 max-h-48 overflow-y-auto"></div>
                    </div>
                    
                    <div id="content-invites" class="hidden">
                        <div class="mb-4">
                            <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Tipo de Invitación</label>
                            <div class="grid grid-cols-2 gap-3 mb-4">
                                <button type="button" id="btn-inv-type-std" onclick="selectInviteType('standard')" class="p-3 rounded-xl border border-emerald-500 bg-emerald-500/20 text-white font-bold text-xs text-center transition">
                                    <i class="fa-solid fa-user-check mb-1 block text-base text-emerald-400"></i>
                                    Permanente
                                </button>
                                <button type="button" id="btn-inv-type-beta" onclick="selectInviteType('beta')" class="p-3 rounded-xl border border-white/10 bg-white/5 text-zinc-400 font-bold text-xs text-center hover:border-purple-500/50 transition">
                                    <i class="fa-solid fa-flask mb-1 block text-base text-purple-400"></i>
                                    Beta Temporal
                                </button>
                            </div>

                            <div id="beta-trial-config-box" class="hidden mb-4 p-4 rounded-xl bg-purple-950/20 border border-purple-500/30">
                                <label class="block text-xs font-bold text-purple-300 uppercase tracking-widest mb-2">Duración de la Prueba Beta</label>
                                <select id="beta-trial-hours" class="w-full bg-black/60 border border-purple-500/30 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-400 transition">
                                    <option value="24">24 horas (1 día)</option>
                                    <option value="48">48 horas (2 días)</option>
                                    <option value="72" selected>72 horas (3 días - Recomendado)</option>
                                    <option value="168">7 días (1 semana)</option>
                                    <option value="336">14 días (2 semanas)</option>
                                    <option value="720">30 días (1 mes)</option>
                                </select>
                                <p class="text-[11px] text-zinc-400 mt-2">La cuenta del usuario caducará al cumplirse este período tras su registro.</p>
                            </div>

                            <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Validez del Código de Invitación</label>
                            <select id="invite-duration" class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition mb-4">
                                <option value="60">1 hora</option>
                                <option value="1440" selected>24 horas</option>
                                <option value="10080">1 semana</option>
                                <option value="0">Nunca expira</option>
                            </select>
                            <button onclick="adminGenerateInvite()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold mr-3 transition shadow-lg shadow-emerald-950">
                                <i class="fa-solid fa-ticket mr-2"></i> Generar Código
                            </button>
                            <div id="invite-code-display" class="mt-4 p-4 bg-zinc-800 rounded-xl hidden border border-white/10">
                                <div class="text-sm text-zinc-400 mb-1">Código de invitación:</div>
                                <div class="text-3xl font-bold text-yellow-400 tracking-widest font-mono" id="invite-code-text"></div>
                                <div class="text-sm text-emerald-400 mt-2" id="invite-code-expiry"></div>
                                <div class="text-xs text-purple-300 mt-1 font-semibold hidden" id="invite-code-beta-info"></div>
                            </div>
                        </div>
                        <button onclick="adminClearInvites()" class="bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg text-sm transition">
                                <i class="fa-solid fa-trash mr-1"></i> Invalidar Todos
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
            loadAdminUsers();
            
            // Adult Door event listener
            const pathInput = document.getElementById('settings-secret-word');
            if (pathInput) {
                pathInput.addEventListener('input', async function() {
                    if (this.value.trim().toLowerCase() === 'adult') {
                        this.value = '';
                        document.getElementById('tab-adult').classList.remove('hidden');
                        showSettingsTab('adult');
                        
                        const commonRatings = ['G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA', '18', '18+', 'MA15+', 'M', '16'];
                        // Cargar configuración guardada
                        const adultRatings = d.adult_ratings || [];
                        
                        document.getElementById('adult-ratings-grid').innerHTML = commonRatings.map(r => {
                            const isChecked = adultRatings.includes(r);
                            return `
                                <label class="flex items-center space-x-2 text-sm text-zinc-300 cursor-pointer hover:text-white">
                                    <input type="checkbox" value="${r}" ${isChecked ? 'checked' : ''} class="adult-rating-cb rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500">
                                    <span>${r}</span>
                                </label>
                            `;
                        }).join('');
                        
                        loadAdultList();
                    }
                });
            }
        });
}

/**
 * `applyAdultRatings()`
 * Guarda los cambios de clasificación +18 seleccionados en el panel de administración.
 */
async function applyAdultRatings() {
    const checkboxes = document.querySelectorAll('.adult-rating-cb:checked');
    const ratings = Array.from(checkboxes).map(cb => cb.value);
    try {
        const r = await fetch('/api/admin/adult/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ratings })
        });
        const d = await r.json();
        if (d.ok) {
            showToast('Filtros aplicados. ' + d.updated + ' actualizados.', 'success');
            loadAdultList();
            if (typeof cargarLib === 'function') await cargarLib();
        }
        else showToast(d.error || 'Error', 'error');
    } catch (e) { showToast('Error', 'error'); }
}

/**
 * `loadAdultList()`
 * Carga desde el servidor la lista de carpetas y archivos para gestionar su visibilidad +18.
 */
async function loadAdultList() {
    try {
        const r = await fetch('/api/admin/adult/list');
        const d = await r.json();
        if (d.items) {
            const list = document.getElementById('adult-items-list');
            if(list) {
                list.innerHTML = d.items.map(i => `
                    <div class="flex justify-between items-center bg-white/5 p-2 rounded">
                        <div class="truncate text-sm text-zinc-300 w-3/4">${i.title} <span class="text-xs text-zinc-500">(${i.tmdb_rating||'Sin rating'})</span></div>
                        <button onclick="toggleAdultItem('${i.rel_path}', false)" class="text-xs bg-emerald-600 px-2 py-1 rounded">Restaurar</button>
                    </div>
                `).join('');
            }
        }
    } catch (e) {}
}

/**
 * `toggleAdultItem(path, is_adult)`
 * Marca o desmarca un elemento específico como contenido restringido (+18).
 */
async function toggleAdultItem(path, is_adult) {
    try {
        const r = await fetch('/api/admin/adult/item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, is_adult })
        });
        const d = await r.json();
        if (d.ok) {
            showToast(is_adult ? 'Ocultado en Adult Vault' : 'Restaurado a Biblioteca', 'success');
            if (document.getElementById('content-adult')) loadAdultList();
            if (typeof cargarLib === 'function') await cargarLib();
        }
    } catch (e) {}
}

/**
 * `showSettingsTab(tab)`
 * Cambia la pestaña activa dentro del modal de administración.
 */
function showSettingsTab(tab) {
    ['general', 'playback', 'users', 'invites', 'adult'].forEach(t => {
        const c = document.getElementById('content-' + t);
        if (c) c.classList.add('hidden');
        const b = document.getElementById('tab-' + t);
        if (b) { b.classList.remove('bg-emerald-600', 'text-white'); b.classList.add('bg-zinc-700', 'text-zinc-300'); }
    });
    const content = document.getElementById('content-' + tab);
    if (content) content.classList.remove('hidden');
    const tabBtn = document.getElementById('tab-' + tab);
    if (tabBtn) { tabBtn.classList.remove('bg-zinc-700', 'text-zinc-300'); tabBtn.classList.add('bg-emerald-600', 'text-white'); }

    if (tab === 'users') {
        loadAdminUsers();
    }
    if (tab === 'playback') {
        loadVideoPrefs();
    }
}

/**
 * `loadAdminUsers()`
 * Obtiene y renderiza la lista de usuarios registrados y sus permisos (rol, modo niños).
 */
function loadAdminUsers() {
    const list = document.getElementById('users-list');
    if (!list) {
        console.log('[ADMIN] users-list element not found');
        return;
    }

    list.innerHTML = '<div class="text-center py-4"><i class="fa-solid fa-spinner fa-spin text-emerald-500"></i> Cargando...</div>';

    const token = window.krakenAuth?.getToken() || localStorage.getItem('kraken_auth_token') || '';
    console.log('[ADMIN] Token:', token ? 'present' : 'missing');

    fetch('/api/admin/users', {
        headers: {
            'Authorization': 'Bearer ' + token,
            'X-Master-Pin': sessionStorage.getItem('kraken_master_pin') || ''
        }
    })
        .then(r => {
            console.log('[ADMIN] /api/admin/users status:', r.status);
            return r.json();
        })
        .then(d => {
            console.log('[ADMIN] Users data:', d);
            if (d.users && d.users.length > 0) {
                list.innerHTML = d.users.map(u => `
                <div class="flex items-center justify-between bg-zinc-800/50 rounded-xl px-4 py-3">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold overflow-hidden">
                            ${u.avatar_url ? '<img src="' + u.avatar_url + '" class="w-full h-full object-cover">' : (u.username ? u.username.charAt(0).toUpperCase() : '🐙')}
                        </div>
                        <div>
                            <div class="text-white font-medium flex items-center gap-2">
                                <span>${u.username}</span>
                                ${u.is_superadmin ? '<span class="px-2 py-0.5 rounded text-[9px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/40">ADMIN</span>' : (u.role === 'beta' ? (u.is_expired ? '<span class="px-2 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/40">BETA EXPIRADO</span>' : '<span class="px-2 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">BETA</span>') : '<span class="px-2 py-0.5 rounded text-[9px] font-medium bg-zinc-700/40 text-zinc-400">USUARIO</span>')}
                            </div>
                            <div class="text-zinc-500 text-xs flex items-center gap-2">
                                <span>${u.email}</span>
                                ${u.trial_expires_at && !u.is_superadmin ? `<span class="text-[10px] text-purple-300">${u.is_expired ? 'Caducó' : 'Expira'}: ${new Date(u.trial_expires_at * 1000).toLocaleDateString()}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    ${!u.is_superadmin ? `
                        <div class="flex items-center gap-3">
                            <!-- Switch Modo Niños -->
                            <div class="flex items-center gap-2">
                                <span class="text-xs text-zinc-400">Niños</span>
                                <button onclick="adminToggleKidMode('${u.email}', ${u.is_kid_mode ? 'false' : 'true'})" 
                                    class="w-12 h-6 rounded-full transition-colors duration-200 ${u.is_kid_mode ? 'bg-emerald-500' : 'bg-zinc-600'}">
                                    <div class="w-4 h-4 bg-white rounded-full transition-transform duration-200 ${u.is_kid_mode ? 'translate-x-7' : 'translate-x-1'}"></div>
                                </button>
                            </div>
                            <div class="flex gap-2 ml-2">
                                <button onclick="adminOpenRoleModal('${u.email}', '${u.role || 'user'}', ${u.trial_expires_at || 'null'})" class="text-purple-400 hover:text-purple-300 text-sm" title="Gestionar rol / prueba beta">
                                    <i class="fa-solid fa-user-shield"></i>
                                </button>
                                <button onclick="adminOpenEditUserModal('${u.email}', '${encodeURIComponent(u.username || '')}', '${encodeURIComponent(u.avatar_url || '')}')" class="text-cyan-400 hover:text-cyan-300 text-sm" title="Editar usuario">
                                    <i class="fa-solid fa-user-pen"></i>
                                </button>
                                <button onclick="adminResetPassword('${u.email}')" class="text-zinc-400 hover:text-white text-sm">
                                    <i class="fa-solid fa-key"></i>
                                </button>
                                <button onclick="adminDeleteUser('${u.email}')" class="text-red-400 hover:text-red-300 text-sm">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `).join('');
            } else {
                list.innerHTML = '<div class="text-center py-4 text-zinc-500">No hay usuarios</div>';
            }
        })
        .catch(e => {
            console.error('[ADMIN] Error loading users:', e);
            list.innerHTML = '<div class="text-center py-4 text-red-400">Error cargando usuarios</div>';
        });
}

/**
 * `adminCreateUser()`
 * Crea un nuevo usuario directamente desde el panel de administración.
 */
function adminCreateUser() {
    const name = document.getElementById('new-user-name').value.trim();
    const password = document.getElementById('new-user-password').value;

    if (!name || !password) {
        showToast('Completa todos los campos', 'error');
        return;
    }

    if (password.length < 8) {
        showToast('La contraseña debe tener al menos 8 caracteres', 'error');
        return;
    }

    fetch('/api/admin/users', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (window.krakenAuth?.getToken() || '')
        },
        body: JSON.stringify({ username: name, password })
    })
        .then(r => r.json())
        .then(d => {
            if (d.ok) {
                showToast('Usuario creado', 'success');
                document.getElementById('new-user-name').value = '';
                document.getElementById('new-user-password').value = '';
                loadAdminUsers();
            } else {
                showToast(d.error, 'error');
            }
        });
}

/**
 * `adminDeleteUser(email)`
 * Elimina la cuenta de un usuario previa confirmación del administrador.
 */
function adminDeleteUser(email) {
    if (!confirm('¿Eliminar a ' + email + '?')) return;

    fetch('/api/admin/users/' + encodeURIComponent(email), {
        method: 'DELETE',
        headers: {
            'Authorization': 'Bearer ' + (window.krakenAuth?.getToken() || '')
        }
    })
        .then(r => r.json())
        .then(d => {
            if (d.ok) {
                showToast('Usuario eliminado', 'success');
                loadAdminUsers();
            } else {
                showToast(d.error, 'error');
            }
        });
}

/**
 * `adminToggleKidMode(email, enable)`
 * Activa o desactiva el filtro de Modo Niños para una cuenta de usuario.
 */
function adminToggleKidMode(email, enable) {
    const action = enable ? 'activar' : 'desactivar';
    if (!confirm(`¿${action.charAt(0).toUpperCase() + action.slice(1)} modo niños para ${email}?`)) return;

    fetch('/api/admin/users/' + encodeURIComponent(email) + '/kidmode', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (window.krakenAuth?.getToken() || '')
        },
        body: JSON.stringify({ is_kid_mode: enable })
    })
        .then(r => r.json())
        .then(d => {
            if (d.ok) {
                showToast(`Modo niños ${enable ? 'activado' : 'desactivado'}`, 'success');
                loadAdminUsers();
            } else {
                showToast(d.error || 'Error al cambiar modo niños', 'error');
            }
        })
        .catch(e => {
            console.error('Error:', e);
            showToast('Error de conexión', 'error');
        });
}

/**
 * `adminResetPassword(email)`
 * Restablece la contraseña de un usuario seleccionado en el panel de administración.
 */
function adminResetPassword(email) {
    const newPass = prompt('Nueva contraseña para ' + email + ':');
    if (!newPass || newPass.length < 4) {
        showToast('Contraseña mínimo 4 caracteres', 'error');
        return;
    }

    fetch('/api/admin/users/' + encodeURIComponent(email) + '/password', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (window.krakenAuth?.getToken() || '')
        },
        body: JSON.stringify({ password: newPass })
    })
        .then(r => r.json())
        .then(d => {
            if (d.ok) {
                showToast('Contraseña actualizada', 'success');
            } else {
                showToast(d.error, 'error');
            }
        });
}

/**
 * `adminOpenEditUserModal(email, encodedName, encodedAvatar)`
 * Abre el submodal para editar nombre, rol, avatar y modo niños de un usuario.
 */
async function adminOpenEditUserModal(email, encodedName, encodedAvatar) {
    if (document.getElementById('kraken-admin-edit-user-modal')) return;

    const currentName = decodeURIComponent(encodedName || '');
    const currentAvatar = decodeURIComponent(encodedAvatar || '');
    const safeName = String(currentName || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const safeEmail = String(email || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const encodedEmail = encodeURIComponent(email || '');

    let avatars = [];
    try {
        const res = await fetch('/api/avatars');
        const d = await res.json();
        avatars = d.avatars || [];
    } catch (_) { }

    const grid = avatars.map((url) => {
        const checked = currentAvatar && currentAvatar === url ? 'checked' : '';
        return `
            <label class="cursor-pointer">
                <input type="radio" name="admin_avatar_edit" value="${url}" class="peer hidden" ${checked}>
                <img src="${url}" class="w-14 h-14 rounded-full border-3 border-transparent peer-checked:border-emerald-500 peer-checked:scale-110 transition-transform bg-zinc-800 object-cover">
            </label>
        `;
    }).join('');

    const modal = document.createElement('div');
    modal.id = 'kraken-admin-edit-user-modal';
    modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-md p-5 shadow-2xl">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-bold text-white">
                    <i class="fa-solid fa-user-gear text-emerald-500 mr-2"></i>Editar Usuario
                </h3>
                <button onclick="document.getElementById('kraken-admin-edit-user-modal').remove()" class="text-zinc-500 hover:text-white transition">
                    <i class="fa-solid fa-xmark text-lg"></i>
                </button>
            </div>
            <div class="text-xs text-zinc-400 mb-4 font-mono">${safeEmail}</div>
            <div class="mb-4">
                <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">Nombre</label>
                <input type="text" id="admin-edit-user-name" value="${safeName}" placeholder="Nombre del usuario"
                    class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition">
            </div>
            <div class="mb-4">
                <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">Nueva Contraseña (Opcional)</label>
                <input type="password" id="admin-edit-user-password" placeholder="Mínimo 8 caracteres"
                    class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition">
            </div>
            <div class="mb-5">
                <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">Avatar</label>
                <div class="grid grid-cols-5 gap-3 justify-items-center bg-black/30 p-4 rounded-xl border border-white/5 max-h-64 overflow-y-auto custom-scroll">
                    ${grid || '<div class="col-span-5 text-xs text-zinc-500 text-center py-4">Sin avatares disponibles</div>'}
                </div>
            </div>
            <button onclick="adminSaveUserEdit(decodeURIComponent('${encodedEmail}'))" class="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold py-3 rounded-xl shadow-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-2">
                <i class="fa-solid fa-check"></i> Guardar Cambios
            </button>
        </div>
    `;
    document.body.appendChild(modal);

    if (!currentAvatar && avatars.length > 0) {
        const first = document.querySelector('input[name="admin_avatar_edit"]');
        if (first) first.checked = true;
    }
}

/**
 * `adminSaveUserEdit(email)`
 * Envía al servidor los cambios de perfil y permisos de un usuario editado por el administrador.
 */
async function adminSaveUserEdit(email) {
    const nameInput = document.getElementById('admin-edit-user-name');
    const passInput = document.getElementById('admin-edit-user-password');
    const avatarInput = document.querySelector('input[name="admin_avatar_edit"]:checked');

    const username = (nameInput?.value || '').trim();
    const password = (passInput?.value || '').trim();
    const avatar = avatarInput ? avatarInput.value : '';

    if (!username) {
        showToast('El nombre no puede estar vacío', 'error');
        return;
    }
    if (password && password.length < 8) {
        showToast('Contraseña mínimo 8 caracteres', 'error');
        return;
    }

    try {
        const token = window.krakenAuth?.getToken() || '';
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        };

        const profileRes = await fetch('/api/admin/users/' + encodeURIComponent(email) + '/profile', {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                username: username,
                avatar_url: avatar
            })
        });
        const profileData = await profileRes.json();
        if (!profileData.ok) {
            showToast(profileData.error || 'Error actualizando perfil', 'error');
            return;
        }

        if (password) {
            const passRes = await fetch('/api/admin/users/' + encodeURIComponent(email) + '/password', {
                method: 'PUT',
                headers,
                body: JSON.stringify({ password })
            });
            const passData = await passRes.json();
            if (!passData.ok) {
                showToast(passData.error || 'Perfil guardado, pero falló la contraseña', 'warning');
            }
        }

        const modal = document.getElementById('kraken-admin-edit-user-modal');
        if (modal) modal.remove();
        showToast('Usuario actualizado', 'success');
        loadAdminUsers();
    } catch (e) {
        console.error(e);
        showToast('Error de conexión', 'error');
    }
}

/**
 * `adminGenerateInvite()`
 * Genera un código de invitación temporal para registro de nuevos usuarios.
 */
window._selectedInviteType = 'standard';

function selectInviteType(type) {
    window._selectedInviteType = type;
    const btnStd = document.getElementById('btn-inv-type-std');
    const btnBeta = document.getElementById('btn-inv-type-beta');
    const betaBox = document.getElementById('beta-trial-config-box');

    if (type === 'beta') {
        btnBeta.className = 'p-3 rounded-xl border border-purple-500 bg-purple-500/20 text-white font-bold text-xs text-center transition';
        btnStd.className = 'p-3 rounded-xl border border-white/10 bg-white/5 text-zinc-400 font-bold text-xs text-center hover:border-emerald-500/50 transition';
        if (betaBox) betaBox.classList.remove('hidden');
    } else {
        btnStd.className = 'p-3 rounded-xl border border-emerald-500 bg-emerald-500/20 text-white font-bold text-xs text-center transition';
        btnBeta.className = 'p-3 rounded-xl border border-white/10 bg-white/5 text-zinc-400 font-bold text-xs text-center hover:border-purple-500/50 transition';
        if (betaBox) betaBox.classList.add('hidden');
    }
}

function adminGenerateInvite() {
    const duration = parseInt(document.getElementById('invite-duration')?.value || '1440');
    const isBeta = (window._selectedInviteType === 'beta');
    const trialHours = isBeta ? parseFloat(document.getElementById('beta-trial-hours')?.value || '72') : 0;

    fetch('/api/admin/invite', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (window.krakenAuth?.getToken() || '')
        },
        body: JSON.stringify({
            duration_minutes: duration,
            is_beta: isBeta,
            trial_hours: trialHours
        })
    })
        .then(r => r.json())
        .then(d => {
            if (d.code) {
                const display = document.getElementById('invite-code-display');
                document.getElementById('invite-code-text').textContent = d.code;

                let expiryText = 'Código permanente';
                if (d.duration_text) {
                    expiryText = 'Código válido por: ' + d.duration_text;
                } else if (d.expires_at) {
                    const date = new Date(d.expires_at * 1000);
                    expiryText = 'Código expira: ' + date.toLocaleString();
                }
                document.getElementById('invite-code-expiry').textContent = expiryText;

                const betaInfo = document.getElementById('invite-code-beta-info');
                if (betaInfo) {
                    if (d.is_beta) {
                        betaInfo.textContent = `Cuenta Beta: ${d.trial_text || (d.trial_hours + 'h')} de acceso de prueba`;
                        betaInfo.classList.remove('hidden');
                    } else {
                        betaInfo.classList.add('hidden');
                    }
                }

                display.classList.remove('hidden');
            }
        });
}

function adminOpenRoleModal(email, currentRole, currentExpiry) {
    const oldModal = document.getElementById('admin-role-modal');
    if (oldModal) oldModal.remove();

    const isBeta = (currentRole === 'beta');
    const expiryText = currentExpiry ? new Date(currentExpiry * 1000).toLocaleString() : 'Sin expiración';

    const modalHtml = `
    <div id="admin-role-modal" class="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
        <div class="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
            <h3 class="text-white font-bold text-lg mb-1 flex items-center gap-2">
                <i class="fa-solid fa-user-shield text-purple-400"></i> Membresía / Rol
            </h3>
            <p class="text-zinc-400 text-xs mb-4 truncate">${email}</p>

            <div class="space-y-4 mb-6">
                <div>
                    <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Rol de usuario</label>
                    <select id="admin-role-select" onchange="toggleRoleExpirySection(this.value)" class="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500">
                        <option value="user" ${!isBeta ? 'selected' : ''}>Usuario Estándar (Permanente)</option>
                        <option value="beta" ${isBeta ? 'selected' : ''}>Usuario Beta (Temporal con Expiración)</option>
                    </select>
                </div>

                <div id="admin-role-beta-opts" class="${isBeta ? '' : 'hidden'} space-y-3 bg-purple-950/20 border border-purple-500/20 p-3 rounded-xl">
                    <div class="text-[11px] text-zinc-300">Expiración actual: <strong class="text-purple-300">${expiryText}</strong></div>
                    <div>
                        <label class="block text-[10px] font-bold text-purple-300 uppercase tracking-widest mb-1">Añadir / Establecer Tiempo</label>
                        <select id="admin-role-extend" class="w-full bg-black/60 border border-purple-500/30 rounded-xl px-3 py-2 text-white text-xs">
                            <option value="24">+24 horas (1 día)</option>
                            <option value="72" selected>+3 días (72h)</option>
                            <option value="168">+7 días (1 semana)</option>
                            <option value="720">+30 días (1 mes)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="flex gap-2">
                <button onclick="document.getElementById('admin-role-modal').remove()" class="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2.5 rounded-xl text-xs transition">Cancelar</button>
                <button onclick="adminSaveUserRole('${email}')" class="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-lg shadow-purple-950">Guardar</button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function toggleRoleExpirySection(role) {
    const opts = document.getElementById('admin-role-beta-opts');
    if (opts) {
        if (role === 'beta') opts.classList.remove('hidden');
        else opts.classList.add('hidden');
    }
}

async function adminSaveUserRole(email) {
    const role = document.getElementById('admin-role-select')?.value || 'user';
    const extendHours = parseFloat(document.getElementById('admin-role-extend')?.value || '72');

    try {
        const token = window.krakenAuth?.getToken() || '';
        const res = await fetch('/api/admin/users/' + encodeURIComponent(email) + '/role', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ role: role, trial_hours: extendHours })
        });
        const d = await res.json();
        if (d.ok) {
            document.getElementById('admin-role-modal')?.remove();
            if (typeof showToast === 'function') showToast('Rol actualizado correctamente', 'success');
            loadAdminUsers();
        } else {
            alert('Error: ' + (d.error || 'No se pudo actualizar'));
        }
    } catch (e) {
        console.error('Error saving user role:', e);
        alert('Error de red al actualizar rol');
    }
}

/**
 * `adminClearInvites()`
 * Revoca y limpia todos los códigos de invitación activos.
 */
function adminClearInvites() {
    fetch('/api/admin/invite', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (window.krakenAuth?.getToken() || '')
        }
    })
        .then(r => r.json())
        .then(d => {
            document.getElementById('invite-code-display').classList.add('hidden');
            showToast('Códigos invalidados', 'success');
        });
}

/**
 * `getVideoPrefs()`
 * Lee desde `localStorage` las preferencias de subtítulos (tamaño, color, fondo) del reproductor.
 */
function getVideoPrefs() {
    try { return JSON.parse(localStorage.getItem(KRAKEN_VIDEO_PREFS_KEY) || '{}'); }
    catch (e) { return {}; }
}

/**
 * `setVideoPref(key, value)`
 * Actualiza una preferencia individual de subtítulos y refresca la vista previa.
 */
function setVideoPref(key, value) {
    try {
        const prefs = getVideoPrefs();
        prefs[key] = value;
        localStorage.setItem(KRAKEN_VIDEO_PREFS_KEY, JSON.stringify(prefs));
    } catch (e) { }
}

/**
 * `loadVideoPrefs()`
 * Sincroniza los controles del formulario de subtítulos con las preferencias guardadas.
 */
function loadVideoPrefs() {
    const prefs = getVideoPrefs();
    const map = {
        'pref-subtitle-size': prefs.subtitleSize || 'medium',
        'pref-subtitle-style': prefs.subtitleStyle || 'outline',
        'pref-default-volume': String(prefs.defaultVolume != null ? prefs.defaultVolume : 1),
        'pref-default-rate': String(prefs.defaultRate != null ? prefs.defaultRate : 1),
    };
    Object.keys(map).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = map[id];
    });
    const autoNextEl = document.getElementById('pref-autonext');
    if (autoNextEl) autoNextEl.checked = prefs.autonext !== false;
}

/**
 * `buildSubtitleStyle()`
 * Genera la cadena CSS inline correspondiente al estilo de subtítulos configurado.
 */
function buildSubtitleStyle() {
    const sizeMap = { small: '18px', medium: '22px', large: '28px', xlarge: '36px' };
    const prefs = getVideoPrefs();
    const out = { color: '#ffffff', fontSize: sizeMap[prefs.subtitleSize] || '22px' };
    const style = prefs.subtitleStyle || 'outline';
    if (style === 'outline' || style === 'both') {
        out.textShadow = '0px 1px 3px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.95)';
    }
    if (style === 'background' || style === 'both') {
        out.background = 'rgba(0,0,0,0.55)';
        out.padding = '2px 6px';
        out.borderRadius = '4px';
    }
    return out;
}

/**
 * `saveSettings(currentPin)`
 * Guarda la ruta de medios, PIN Maestro y opciones del servidor en `/api/settings`.
 */
async function saveSettings(currentPin) {
    const newPin = document.getElementById('settings-new-pin').value;
    const newMediaPath = document.getElementById('settings-media-path')?.value.trim();
    const subdlApiKey = document.getElementById('settings-subdl-api-key')?.value.trim();
    const btn = document.getElementById('settings-save-btn');

    if (newPin && newPin.length < 4) {
        showToast('PIN debe tener al menos 4 digitos', 'error');
        return;
    }
    if (!newPin && !newMediaPath && !subdlApiKey) {
        showToast('No hay cambios para guardar', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

    try {
        const payload = { pin: currentPin };
        if (newPin) payload.new_pin = newPin;
        if (newMediaPath) payload.media_path = newMediaPath;
        if (subdlApiKey) payload.subdl_api_key = subdlApiKey;

        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const d = await res.json();

        if (d.ok) {
            document.getElementById('kraken-settings-modal').remove();
            showToast('Configuración actualizada', 'success');
        } else {
            showToast(d.error || 'Error al guardar', 'error');
            clearPinIfInvalid(d.error);
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-save"></i> Guardar Cambios';
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-save"></i> Guardar Cambios';
    }
}

// ========================================
// ANALIZADOR DE AUDIO (LIBROSA)
// ========================================
/**
 * `startLibrosaScan()`
 * Inicia el análisis profundo de audio en segundo plano (BPM y energía musical con Librosa).
 */
async function startLibrosaScan() {
    const btn = document.getElementById('btn-librosa-scan');
    const pin = getMasterPin('PIN para iniciar el escaneo Profundo (Librosa) de Energía/BPM:');
    if (!pin) return;

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Arrancando motor AI...';
    }

    try {
        const res = await fetch('/api/analyze/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin })
        });
        const d = await res.json();
        if (d.ok && d.started) {
            showToast('Análisis Librosa Iniciado en Segundo Plano', 'success');
            pollLibrosaStatus();
        } else {
            showToast(d.error || 'Ya hay un escaneo corriendo', 'warning');
            pollLibrosaStatus();
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Escanear Energía y BPM';
        }
    }
}
/**
 * `pollLibrosaStatus()`
 * Monitorea periódicamente el progreso del análisis de Librosa y actualiza la barra de estado.
 */
function pollLibrosaStatus() {
    const loop = setInterval(async () => {
        try {
            const res = await fetch('/api/analyze/status');
            const status = await res.json();

            const btn = document.getElementById('btn-librosa-scan');
            if (!status.active) {
                clearInterval(loop);
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-bolt text-yellow-400"></i> Escanear Energía y BPM';
                }
                showToast('¡Análisis de Biblioteca Terminado!', 'success');
                return;
            }

            if (btn) {
                btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${status.percent}% - ${status.current_file}`;
            }
        } catch (e) {
            clearInterval(loop);
        }
    }, 2000);
}

// --- REGISTRO DE PERFIL (CLOUDFLARE) ---
/**
 * `showRegistrationModal(email)`
 * Muestra el modal de registro de perfil para usuarios autenticados vía Cloudflare Access.
 */
async function showRegistrationModal(email) {
    if (document.getElementById('kraken-register-modal')) return;

    const defaultAvatars = [];

    // Cargar avatares del servidor
    let avatars = [];
    try {
        const res = await fetch('/api/avatars');
        const d = await res.json();
        avatars = d.avatars || [];
    } catch (_) { }

    const avatarsHtml = avatars.map((url, i) => `
        <label class="cursor-pointer relative">
            <input type="radio" name="avatar_select" value="${url}" class="peer hidden" ${i === 0 ? 'checked' : ''}>
            <img src="${url}" class="w-14 h-14 rounded-full border-3 border-transparent peer-checked:border-emerald-500 peer-checked:scale-110 transition-transform bg-zinc-800 object-cover">
        </label>
    `).join('');

    const html = `
    <div id="kraken-register-modal" class="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
        <div class="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden">
            
            <!-- Header -->
            <div class="text-center mb-6 relative z-10">
                <i class="fa-solid fa-user-astronaut text-4xl text-emerald-500 mb-3 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]"></i>
                <h2 class="text-2xl font-black text-white">¡Bienvenido a Kraken!</h2>
                <p class="text-xs text-zinc-400 mt-2 bg-black/40 inline-block px-3 py-1 rounded-full border border-white/5">
                    Identidad verificada: <span class="text-cyan-400 font-mono">${email}</span>
                </p>
            </div>
            
            <!-- Form -->
            <div class="space-y-6 relative z-10">
                <div>
                    <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">Crea tu Apodo</label>
                    <input type="text" id="reg-username" placeholder="Ej: Pirata Cósmico" 
                           class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition">
                </div>
                
                <div>
                    <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 ml-1">Elige tu Avatar</label>
                    <div class="grid grid-cols-5 gap-3 justify-items-center bg-black/30 p-4 rounded-xl border border-white/5 max-h-64 overflow-y-auto custom-scroll">
                        ${avatarsHtml || '<div class="col-span-5 text-xs text-zinc-500 text-center py-4">Sin avatares disponibles</div>'}
                    </div>
                </div>
                
                <button onclick="submitProfileRegistration('${email}')" 
                        class="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-900/50 hover:shadow-emerald-900/80 transition-all hover:scale-[1.02] flex items-center justify-center gap-2">
                    <i class="fa-solid fa-ship"></i> Entrar al Servidor
                </button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

/**
 * `submitProfileRegistration(email)`
 * Guarda el perfil inicial del usuario (nombre y avatar) en el servidor.
 */
async function submitProfileRegistration(email) {
    const username = document.getElementById('reg-username').value.trim();
    const avatar = document.querySelector('input[name="avatar_select"]:checked').value;

    if (!username || username.length < 3) {
        alert("Por favor, escribe un apodo de al menos 3 letras.");
        return;
    }

    try {
        const res = await fetch('/api/user/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, username: username, avatar_url: avatar })
        });
        const d = await res.json();

        if (d.ok) {
            location.reload();
        } else {
            alert("Error registrando perfil: " + d.error);
        }
    } catch (e) {
        alert("Error de conexión: " + e);
    }
}

/**
 * `showEditProfileModal()`
 * Abre el modal para que el usuario actual edite su nombre visible, contraseña o avatar.
 */
async function showEditProfileModal() {
    if (document.getElementById('kraken-edit-profile-modal')) return;

    // Cargar avatares del servidor
    let avatars = [];
    try {
        const res = await fetch('/api/avatars');
        const d = await res.json();
        avatars = d.avatars || [];
    } catch (_) { }

    const grid = avatars.map((url, i) => `
        <label class="cursor-pointer">
            <input type="radio" name="avatar_edit" value="${url}" class="peer hidden" ${i === 0 ? 'checked' : ''}>
            <img src="${url}" class="w-14 h-14 rounded-full border-3 border-transparent peer-checked:border-emerald-500 peer-checked:scale-110 transition-transform bg-zinc-800 object-cover">
        </label>`).join('');

    const modal = document.createElement('div');
    modal.id = 'kraken-edit-profile-modal';
    modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-bold text-white"><i class="fa-solid fa-user-pen text-emerald-500 mr-2"></i>Editar Perfil</h3>
                <button onclick="document.getElementById('kraken-edit-profile-modal').remove()" class="text-zinc-500 hover:text-white transition"><i class="fa-solid fa-xmark text-lg"></i></button>
            </div>
            <div class="mb-4">
                <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">Nombre</label>
                <input type="text" id="edit-profile-name" value="${MY_NAME || ''}" placeholder="Tu apodo" 
                       class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition">
            </div>
            <div class="mb-4">
                <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">Nueva Contraseña</label>
                <input type="password" id="edit-profile-password" placeholder="Mínimo 4 caracteres" maxlength="30" 
                       class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition">
            </div>
            <div class="mb-4">
                <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">Avatar</label>
                <div class="grid grid-cols-5 gap-3 justify-items-center bg-black/30 p-4 rounded-xl border border-white/5 max-h-64 overflow-y-auto custom-scroll">
                    ${grid || '<div class="col-span-5 text-xs text-zinc-500 text-center py-4">Agrega imágenes a assets/avatars/</div>'}
                </div>
            </div>
            <button onclick="saveProfileEdit()" class="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold py-3 rounded-xl shadow-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-2 mb-3">
                <i class="fa-solid fa-check"></i> Guardar Cambios
            </button>
            <button onclick="window.krakenAuth.logout()" class="w-full bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 font-bold py-2 rounded-xl transition flex items-center justify-center gap-2">
                <i class="fa-solid fa-right-from-bracket"></i> Cerrar Sesión
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}

/**
 * `saveProfileEdit()`
 * Envía al backend los cambios del perfil personal del usuario.
 */
async function saveProfileEdit() {
    const nameInput = document.getElementById('edit-profile-name');
    const avatar = document.querySelector('input[name="avatar_edit"]:checked');
    const passwordInput = document.getElementById('edit-profile-password');
    if (!window.MY_EMAIL) return;

    const newName = nameInput ? nameInput.value.trim() : '';
    const newPassword = passwordInput ? passwordInput.value.trim() : '';
    const payload = { email: window.MY_EMAIL };

    if (newName && newName.length >= 2) {
        payload.username = newName;
        localStorage.setItem('kraken_user', newName);
        MY_NAME = newName;
    }
    if (avatar) payload.avatar_url = avatar.value;

    if (!payload.username && !payload.avatar_url && !newPassword) {
        showToast('No hay cambios que guardar', 'warning');
        return;
    }

    try {
        if (payload.username || payload.avatar_url) {
            const res = await fetch('/api/user/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const d = await res.json();
            if (!d.ok) {
                showToast('Error actualizando perfil', 'error');
                return;
            }
        }

        if (newPassword && newPassword.length >= 4) {
            const passRes = await fetch('/api/auth/set_password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPassword })
            });
            const passData = await passRes.json();
            if (passData.ok) {
                showToast('Contraseña actualizada', 'success');
            }
        }

        document.getElementById('kraken-edit-profile-modal').remove();
        showToast('Perfil actualizado', 'success');
        lastRadarJson = '';
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
}
