/**
 * ============================================================================
 * KRAKEN MEDIA SERVER — auth.js
 * Sistema de autenticación JWT (`window.krakenAuth`), interceptor global de `fetch` (Bearer + X-Master-Pin) y pantalla de login/registro.
 * ============================================================================
 */

// ═══ KRAKEN AUTH SYSTEM ═══
    (function () {
        const AUTH_KEY = 'kraken_auth_token';
        const USER_KEY = 'kraken_user';

        // Auto-inicializar identidad en memoria si hay sesión guardada
        try {
            const rawStored = localStorage.getItem(USER_KEY);
            if (rawStored) {
                const parsedStored = rawStored.startsWith('{') ? JSON.parse(rawStored) : { username: rawStored };
                if (parsedStored.email) window.MY_EMAIL = parsedStored.email;
                if (parsedStored.username) {
                    window.MY_NAME = parsedStored.username;
                    if (typeof MY_NAME !== 'undefined') MY_NAME = parsedStored.username;
                }
            }
        } catch (_) {}

        window.krakenAuth = {
            getToken: () => localStorage.getItem(AUTH_KEY),
            getUser: () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || '{}'); } catch (e) { return {}; } },
            setAuth: (token, user) => {
                localStorage.setItem(AUTH_KEY, token);
                localStorage.setItem(USER_KEY, JSON.stringify(user));
                window.MY_EMAIL = user.email;
                window.MY_NAME = user.username;
                if (typeof MY_NAME !== 'undefined') MY_NAME = user.username;
            },
            logout: () => {
                localStorage.removeItem(AUTH_KEY);
                localStorage.removeItem(USER_KEY);
                window.MY_EMAIL = '';
                window.MY_NAME = '';
                window.kraken_auth_token = null;
                window.kraken_user = null;
                showAuthScreen();
            },
            headers: () => {
                const token = localStorage.getItem(AUTH_KEY);
                return token ? {
                    'Authorization': 'Bearer ' + token,
                    'X-Master-Pin': sessionStorage.getItem('kraken_master_pin') || ''
                } : {};
            }
        };

        const originalFetch = window.fetch;
        window.fetch = function (url, options = {}) {
            const token = localStorage.getItem(AUTH_KEY);
            const masterPin = sessionStorage.getItem('kraken_master_pin');
            
            if ((token || masterPin) && typeof url === 'string' && (url.startsWith('/') || url.startsWith(window.location.origin))) {
                options.headers = options.headers || {};
                if (options.headers instanceof Headers) {
                    if (token && !options.headers.has('Authorization')) options.headers.set('Authorization', 'Bearer ' + token);
                    if (masterPin && !options.headers.has('X-Master-Pin')) options.headers.set('X-Master-Pin', masterPin);
                } else {
                    if (token && !options.headers['Authorization']) options.headers['Authorization'] = 'Bearer ' + token;
                    if (masterPin && !options.headers['X-Master-Pin']) options.headers['X-Master-Pin'] = masterPin;
                }
            }
            return originalFetch.call(this, url, options);
        };

        window.addEventListener('DOMContentLoaded', async () => {
            console.log('[AUTH] DOMContentLoaded fired');

            // Cargar config pública (dominio para Cast, etc.)
            try {
                const pubCfg = await originalFetch('/api/config/public');
                if (pubCfg.ok) {
                    const cfg = await pubCfg.json();
                    if (cfg.cast_public_url) {
                        window.__krakenPublicUrl = cfg.cast_public_url.replace(/\/+$/, '');
                    }
                }
            } catch (e) { console.warn('[CONFIG] No se pudo cargar config pública:', e); }

            const screen = document.getElementById('kraken-auth-screen');
            console.log('[AUTH] Auth screen element:', screen);
            const token = localStorage.getItem(AUTH_KEY);
            console.log('[AUTH] Token found:', token ? 'yes' : 'no');
            if (token) {
                try {
                    const res = await originalFetch('/api/auth/verify', {
                        headers: {
                            'Authorization': 'Bearer ' + token,
                            'X-Master-Pin': sessionStorage.getItem('kraken_master_pin') || ''
                        }
                    });
                    const data = await res.json();
                    console.log('[AUTH] Verify response:', data);
                    if (data.valid) {
                        window.MY_EMAIL = data.email;
                        screen.style.display = 'none';
                        console.log('[AUTH] Token valid, hiding auth screen');
                        return;
                    }
                } catch (e) { console.log('[AUTH] Verify error:', e); }
            }
            console.log('[AUTH] Showing auth screen...');
            showAuthScreen();
        });
    })();

/**
 * `showAuthScreen()`
 * Muestra la pantalla de inicio de sesión o registro verificando si existen usuarios en el servidor.
 */
async function showAuthScreen() {
    console.log('[AUTH] showAuthScreen called');
    const loader = document.getElementById('loader');
    if (loader) {
        loader.classList.add('hidden');
        loader.style.display = 'none';
    }
    const screen = document.getElementById('kraken-auth-screen');
    console.log('[AUTH] Screen element:', screen);
    screen.style.display = 'flex';
    toggleQrLoginPanel(false);

    try {
        console.log('[AUTH] Fetching /api/auth/users...');
        const res = await fetch('/api/auth/users');
        console.log('[AUTH] Response status:', res.status);
        const data = await res.json();
        console.log('[AUTH] Response data:', data);
        window._cachedUsers = data.users || [];

        if (!data.has_admin) {
            console.log('[AUTH] No admin, showing register');
            showRegister(false);
        } else if (data.users.length > 0) {
            console.log('[AUTH] Showing user select with', data.users.length, 'users');
            showUserSelect();
            renderUsers(data.users);
        } else {
            console.log('[AUTH] No users, showing register');
            showRegister(false);
        }
    } catch (e) {
        console.error('[AUTH] Auth error:', e);
        showRegister(false);
    }
}

/**
 * `renderUsers(users)`
 * Renderiza la cuadrícula de perfiles de usuario ('¿Quién está viendo?') en la pantalla de login.
 */
function renderUsers(users) {
    console.log('[AUTH] Rendering users:', users.map(u => ({ email: u.email, username: u.username, has_avatar: !!u.avatar_url })));
    const grid = document.getElementById('auth-users-grid');
    grid.innerHTML = users.map(u => `
        <div onclick="selectUser('${u.email}')" 
             class="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/50 cursor-pointer transition-all duration-200 group">
            <div class="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-2xl text-white overflow-hidden shadow-lg group-hover:scale-110 transition-transform relative">
                ${u.avatar_url ?
            `<img src="${u.avatar_url}" class="w-full h-full object-cover absolute inset-0" 
                          onerror="this.remove(); this.parentElement.appendChild(document.createTextNode('${(u.username || '🐙').charAt(0).toUpperCase()}'))">` :
            (u.username ? u.username.charAt(0).toUpperCase() : '🐙')}
            </div>
            <span class="text-white text-sm font-medium">${u.username || 'Usuario'}</span>
            ${u.is_superadmin ? '<span class="text-[10px] text-emerald-400 font-bold">ADMIN</span>' : (u.role === 'beta' ? '<span class="text-[10px] text-purple-400 font-bold">BETA</span>' : '')}
        </div>
    `).join('');
}

window._selectedUserEmail = '';

/**
 * `selectUser(email)`
 * Selecciona un perfil de usuario e inicia el paso de ingreso de contraseña.
 */
function selectUser(email) {
    window._selectedUserEmail = email;
    showPasswordEntry(email);
}

/**
 * `showUserSelect()`
 * Vuelve a la vista de selección de perfiles en la pantalla de autenticación.
 */
function showUserSelect() {
    document.getElementById('auth-user-select').style.display = 'block';
    document.getElementById('auth-password-entry').style.display = 'none';
    document.getElementById('auth-register').style.display = 'none';
    document.getElementById('auth-invite').style.display = 'none';
}

/**
 * `showPasswordEntry(email)`
 * Muestra el formulario de contraseña para el usuario seleccionado.
 */
function showPasswordEntry(email) {
    document.getElementById('auth-user-select').style.display = 'none';
    document.getElementById('auth-password-entry').style.display = 'block';
    document.getElementById('auth-register').style.display = 'none';
    document.getElementById('auth-invite').style.display = 'none';
    document.getElementById('auth-password-input').value = '';
    document.getElementById('auth-password-error').style.display = 'none';
    document.getElementById('auth-password-input').focus();

    // Mostrar nombre del usuario
    const users = window._cachedUsers || [];
    const user = users.find(u => u.email === email);
    document.getElementById('auth-password-name').textContent = user ? user.username : email;

    // Mostrar avatar del usuario
    const avatarDiv = document.getElementById('auth-password-avatar');
    const displayName = user ? (user.username || email) : email;

    if (user && user.avatar_url) {
        avatarDiv.innerHTML = `<img src="${user.avatar_url}" class="w-full h-full object-cover" onerror="this.remove(); this.parentElement.appendChild(document.createTextNode('${displayName.charAt(0).toUpperCase()}'))">`;
    } else {
        avatarDiv.innerHTML = displayName.charAt(0).toUpperCase();
    }
}

/**
 * `showRegister(withInvite)`
 * Muestra el formulario de registro de nueva cuenta (administrador inicial o con código de invitación).
 */
function showRegister(withInvite) {
    document.getElementById('auth-user-select').style.display = 'none';
    document.getElementById('auth-password-entry').style.display = 'none';
    document.getElementById('auth-register').style.display = 'block';
    document.getElementById('auth-invite').style.display = 'none';
        let regTitle = 'Crear Administrador';
    if (withInvite) {
        if (window._pendingInviteIsBeta) {
            const h = window._pendingInviteTrialHours || 24;
            const periodText = h >= 24 ? `${Math.round(h / 24)} días` : `${h} horas`;
            regTitle = `Crear Perfil Beta (${periodText} de prueba)`;
        } else {
            regTitle = 'Crear tu Perfil';
        }
    }
    document.getElementById('auth-register-title').textContent = regTitle;
    document.getElementById('auth-reg-back').style.display = withInvite ? 'inline' : 'none';
    document.getElementById('auth-reg-error').style.display = 'none';
    window._registerWithInvite = withInvite ? window._pendingInviteCode : '';
}

/**
 * `showAuthInvite()`
 * Muestra el campo para validar un código de invitación antes de crear una cuenta.
 */
function showAuthInvite() {
    document.getElementById('auth-user-select').style.display = 'none';
    document.getElementById('auth-invite').style.display = 'block';
    document.getElementById('auth-invite-error').style.display = 'none';
    document.getElementById('auth-invite-code').value = '';
    document.getElementById('auth-invite-code').focus();
}

/**
 * `loginUser(email, password)`
 * Envía las credenciales a `/api/auth/login`, almacena el token JWT y desbloquea la aplicación.
 */
async function loginUser(email, password) {
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (data.token) {
            detenerQrTv();
            window.krakenAuth.setAuth(data.token, data);
            if (window.KrakenTV && typeof window.KrakenTV.onAuthSuccess === 'function') {
                try { window.KrakenTV.onAuthSuccess(data.token, data.email || email, data.username || ''); } catch (_) {}
            }
            document.getElementById('kraken-auth-screen').style.display = 'none';
            if (typeof cargarLib === 'function') cargarLib();
        } else {
            const err = document.getElementById('auth-password-error');
            err.textContent = data.error || 'Error de login';
            err.style.display = 'block';
        }
    } catch (e) {
        console.error('Login error:', e);
    }
}

/**
 * `submitPassword()`
 * Valida y envía la contraseña ingresada en la pantalla de login.
 */
function submitPassword() {
    const password = document.getElementById('auth-password-input').value;
    loginUser(window._selectedUserEmail, password);
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const passwordInput = document.getElementById('auth-password-input');
        if (passwordInput && document.getElementById('auth-password-entry').style.display !== 'none') {
            submitPassword();
        }
        const inviteInput = document.getElementById('auth-invite-code');
        if (inviteInput && document.getElementById('auth-invite').style.display !== 'none') {
            submitInvite();
        }
    }
});

/**
 * `submitRegister()`
 * Crea una nueva cuenta de usuario en `/api/auth/register` e inicia sesión automáticamente.
 */
async function submitRegister() {
    const name = document.getElementById('auth-reg-name').value.trim();
    const password = document.getElementById('auth-reg-password').value;
    const inviteCode = window._registerWithInvite || '';

    if (!name) {
        const err = document.getElementById('auth-reg-error');
        err.textContent = 'Escribe tu nombre';
        err.style.display = 'block';
        return;
    }

    if (!password || password.length < 8) {
        const err = document.getElementById('auth-reg-error');
        err.textContent = 'La contraseña debe tener al menos 8 caracteres';
        err.style.display = 'block';
        return;
    }

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: name, password, invite_code: inviteCode })
        });
        const data = await res.json();

        if (data.token) {
            window.krakenAuth.setAuth(data.token, data);
            document.getElementById('kraken-auth-screen').style.display = 'none';
            if (typeof cargarLib === 'function') cargarLib();
            if (typeof showToast === 'function') showToast('\u00a1Bienvenido a Kraken, ' + name + '!');
        } else {
            const err = document.getElementById('auth-reg-error');
            err.textContent = data.error || 'Error al registrar';
            err.style.display = 'block';
        }
    } catch (e) {
        console.error('Register error:', e);
    }
}

/**
 * `submitInvite()`
 * Verifica la validez de un código de invitación en `/api/auth/verify-invite`.
 */
async function submitInvite() {
    const code = document.getElementById('auth-invite-code').value.trim().toUpperCase();
    if (!code) return;

    // Validar código antes de mostrar formulario
    try {
        const res = await fetch('/api/admin/invite/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const data = await res.json();

        if (!data.valid) {
            const err = document.getElementById('auth-invite-error');
            err.textContent = data.error || 'Código inválido';
            err.style.display = 'block';
            return;
        }

        // Código válido - mostrar formulario de registro
        window._pendingInviteCode = code;
        window._pendingInviteIsBeta = !!data.is_beta;
        window._pendingInviteTrialHours = data.trial_hours || 0;
        showRegister(true);
    } catch (e) {
        console.error('Error validando código:', e);
        const err = document.getElementById('auth-invite-error');
        err.textContent = 'Error validando código';
        err.style.display = 'block';
    }
}

// ═══ KRAKEN TV QR LOGIN POLLING ═══
let _qrPollTimer = null;

function toggleQrLoginPanel(forceShow = null) {
    const box = document.getElementById('qr-login-box');
    const lbl = document.getElementById('btn-toggle-qr-login-label');
    if (!box) return;
    const isVisible = box.style.display === 'flex';
    const shouldShow = (forceShow !== null) ? Boolean(forceShow) : !isVisible;
    if (shouldShow) {
        box.style.display = 'flex';
        if (lbl) lbl.textContent = 'Ocultar QR';
        iniciarQrTv();
    } else {
        box.style.display = 'none';
        if (lbl) lbl.textContent = 'QR Login';
        detenerQrTv();
    }
}
window.toggleQrLoginPanel = toggleQrLoginPanel;

function detenerQrTv() {
    if (_qrPollTimer) {
        clearInterval(_qrPollTimer);
        _qrPollTimer = null;
    }
}

async function iniciarQrTv() {
    const container = document.getElementById('qrcode-canvas');
    const codeText = document.getElementById('qr-code-text');
    if (!container || !codeText) return;

    detenerQrTv();
    try {
        const res = await fetch('/api/tv/qr/init', { method: 'POST' });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.code || !data.verify_url) return;

        codeText.textContent = data.code;
        container.innerHTML = '';

        if (typeof QRCode !== 'undefined') {
            new QRCode(container, {
                text: data.verify_url,
                width: 150,
                height: 150,
                colorDark: '#050505',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
        } else {
            container.innerHTML = `<div class="text-xs text-black font-mono p-2 break-all">${data.verify_url}</div>`;
        }

        _qrPollTimer = setInterval(async () => {
            const screen = document.getElementById('kraken-auth-screen');
            if (!screen || screen.style.display === 'none') {
                detenerQrTv();
                return;
            }
            try {
                const pollRes = await fetch(`/api/tv/qr/poll?code=${encodeURIComponent(data.code)}`);
                if (pollRes.status === 404) {
                    detenerQrTv();
                    iniciarQrTv();
                    return;
                }
                const pollData = await pollRes.json();
                if (pollData.status === 'approved' && pollData.token) {
                    detenerQrTv();
                    window.krakenAuth.setAuth(pollData.token, pollData);
                    if (window.KrakenTV && typeof window.KrakenTV.onAuthSuccess === 'function') {
                        try { window.KrakenTV.onAuthSuccess(pollData.token, pollData.email || '', pollData.username || ''); } catch (_) {}
                    }
                    screen.style.display = 'none';
                    if (typeof cargarLib === 'function') cargarLib();
                    if (typeof showToast === 'function') {
                        showToast(`📺 ¡Pantalla vinculada como ${pollData.username || pollData.email}!`, 'success');
                    }
                }
            } catch (_) {}
        }, 2000);
    } catch (e) {
        console.warn('[QR Auth] No se pudo iniciar QR:', e);
    }
}
