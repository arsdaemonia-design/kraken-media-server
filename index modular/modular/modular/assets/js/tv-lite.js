/**
 * ============================================================================
 * KRAKEN MEDIA SERVER — tv-lite.js
 * Protocolo Kraken TV Lite: detección automática de Smart TV / Android TV y navegación espacial con D-Pad.
 * ============================================================================
 */

/**
 * KRAKEN TV PROTOCOL LITE 🎮
 * Detección y navegación de alto rendimiento
 */
(function() {
    /**
     * `detectTV()`
     * Detecta mediante User-Agent si el cliente es un Smart TV, Android TV, consola o dispositivo de streaming.
     */
    function detectTV() {
        const ua = navigator.userAgent;
        return /Android TV|SmartTV|HbbTV|GoogleTV|CrKey|Xbox|PlayStation|Nintendo|Web0S|Tizen|Viera|NetCast|Roku|AFT[ABKMR]/.test(ua);
    }

    if (detectTV()) {
        document.addEventListener('DOMContentLoaded', () => {
            document.body.classList.add('tv-mode');
            console.log('📺 Kraken TV Lite Mode Activated');
            
            // Desactivar visualizador de audio para ahorrar CPU
            if (window.isVisualizerInit !== undefined) window.isVisualizerInit = false;
            
            // Zoom optimizado
            if (!localStorage.getItem('kraken_audio_zoom')) {
                localStorage.setItem('kraken_audio_zoom', '0');
            }
        });

        // Navegación D-Pad
        document.addEventListener('keydown', (e) => {
            const focusables = Array.from(document.querySelectorAll('button:not([disabled]), .card-interactive, .list-row, .sidebar-link, input, a, [tabindex="0"]'));
            let index = focusables.indexOf(document.activeElement);

            if (index === -1 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                focusables[0].focus();
                e.preventDefault();
                return;
            }

            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                index = (index + 1) % focusables.length;
                focusables[index].focus();
                e.preventDefault();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                index = (index - 1 + focusables.length) % focusables.length;
                focusables[index].focus();
                e.preventDefault();
            } else if (e.key === 'Enter') {
                document.activeElement.click();
            }
        });
    }
})();
