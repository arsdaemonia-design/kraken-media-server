/**
 * ============================================================================
 * KRAKEN MEDIA SERVER — head-config.js
 * Inicialización del SDK de Google Cast (Chromecast) y configuración extendida de Tailwind CSS.
 * ============================================================================
 */

// --- Inicialización de Google Cast (Chromecast) ---
// Conectar con la inicialización del plugin
/**
 * `initKrakenCastContext()`
 * Inicializa el contexto de Google Cast (Chromecast) con el receptor multimedia por defecto.
 */
function initKrakenCastContext() {
    try {
        if (!(window.cast && window.cast.framework && window.chrome && window.chrome.cast)) {
            return false;
        }
        const castContext = window.cast.framework.CastContext.getInstance();
        castContext.setOptions({
            receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
            autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.TAB_AND_ORIGIN_SCOPED
        });
        window.__krakenCastReady = true;
        return true;
    } catch (e) {
        console.warn('[CAST] init failed:', e);
        return false;
    }
}

/**
 * `__onGCastApiAvailable(isAvailable)`
 * Callback global invocado por el SDK de Google Cast cuando la API está disponible.
 */
window.__onGCastApiAvailable = function (isAvailable) {
    if (!isAvailable) {
        console.warn('[CAST] Google Cast API not available');
        return;
    }
    initKrakenCastContext();
};

// --- Configuración de animaciones de Tailwind CSS ---
tailwind.config = {
    theme: {
        extend: {
            animation: {
                'fade-in': 'fadeIn 0.3s ease-in-out',
                'float': 'float 3s ease-in-out infinite',
                'slide-up': 'slideUp 0.3s ease-out',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-6px)' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(40px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                }
            }
        }
    }
}
