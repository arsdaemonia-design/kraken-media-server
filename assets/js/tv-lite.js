/**
 * ============================================================================
 * KRAKEN MEDIA SERVER — tv-lite.js
 * Protocolo Kraken TV Spatial Navigation: detección de Smart TV / Android TV,
 * borde esmeralda de foco (#10B981), navegación 2D por coordenadas y apertura
 * automática del cajón lateral.
 * ============================================================================
 */

(function() {
    function detectTV() {
        const ua = navigator.userAgent || '';
        return Boolean(window.KrakenTV) || /Android TV|SmartTV|HbbTV|GoogleTV|CrKey|Xbox|PlayStation|Nintendo|Web0S|Tizen|Viera|NetCast|Roku|AFT[ABKMR]/i.test(ua);
    }

    function activateTvSpatialNavigation() {
        if (window.__krakenTvSpatialActive) return;
        window.__krakenTvSpatialActive = true;
        document.body.classList.add('tv-mode');
        console.log('📺 Kraken TV Spatial Navigation Activated');

        if (window.isVisualizerInit !== undefined) window.isVisualizerInit = false;
        if (!localStorage.getItem('kraken_audio_zoom')) {
            localStorage.setItem('kraken_audio_zoom', '0');
        }

        const style = document.createElement('style');
        style.innerHTML = `
            .tv-focusable:focus, [tabindex="0"]:focus, button:focus, a:focus, input:focus, select:focus {
                outline: 2.5px solid #10B981 !important;
                outline-offset: 3px !important;
                box-shadow: 0 0 18px rgba(16, 185, 129, 0.45) !important;
                transform: scale(1.035);
                transition: transform 0.14s ease, outline 0.14s ease !important;
                z-index: 99 !important;
            }
            ::-webkit-scrollbar { display: none !important; }
        `;
        document.head.appendChild(style);

        const SELECTORS = [
            'button:not([disabled])',
            'a[href]',
            'input:not([disabled])',
            'select:not([disabled])',
            '[onclick]',
            '[data-path]',
            '[data-folder-path]',
            '[data-series-path]',
            '[data-movie-path]',
            '[data-playlist]',
            '.krk-video-card',
            '.card-interactive',
            '.list-row',
            '.sidebar-link'
        ].join(',');

        function refreshFocusables() {
            document.querySelectorAll(SELECTORS).forEach(el => {
                if (el.offsetWidth > 0 && el.offsetHeight > 0) {
                    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
                    el.classList.add('tv-focusable');
                }
            });
        }

        refreshFocusables();
        new MutationObserver(refreshFocusables).observe(document.body, { childList: true, subtree: true });

        window.addEventListener('keydown', function(e) {
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) return;

            const active = document.activeElement;
            const isTextInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') &&
                !['button', 'checkbox', 'radio', 'submit'].includes(active.type);

            if (e.key === 'Enter' && active) {
                if (!isTextInput) {
                    e.preventDefault();
                    active.click();
                }
                return;
            }

            if (isTextInput && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                return;
            }

            refreshFocusables();
            const all = Array.from(document.querySelectorAll('.tv-focusable')).filter(el => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
            });

            if (!active || !all.includes(active)) {
                if (all.length) {
                    e.preventDefault();
                    all[0].focus();
                }
                return;
            }

            const r1 = active.getBoundingClientRect();
            const cx1 = r1.left + r1.width / 2;
            const cy1 = r1.top + r1.height / 2;

            let best = null;
            let bestScore = Infinity;

            all.forEach(el => {
                if (el === active) return;
                const r2 = el.getBoundingClientRect();
                const cx2 = r2.left + r2.width / 2;
                const cy2 = r2.top + r2.height / 2;
                const dx = cx2 - cx1;
                const dy = cy2 - cy1;

                let isCandidate = false;
                if (e.key === 'ArrowRight' && dx > 10 && Math.abs(dy) < Math.max(r1.height, r2.height) * 1.35) isCandidate = true;
                if (e.key === 'ArrowLeft'  && dx < -10 && Math.abs(dy) < Math.max(r1.height, r2.height) * 1.35) isCandidate = true;
                if (e.key === 'ArrowDown'  && dy > 10) isCandidate = true;
                if (e.key === 'ArrowUp'    && dy < -10) isCandidate = true;

                if (isCandidate) {
                    const score = (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
                        ? Math.abs(dx) + Math.abs(dy) * 3.5
                        : Math.abs(dy) + Math.abs(dx) * 2.2;
                    if (score < bestScore) {
                        bestScore = score;
                        best = el;
                    }
                }
            });

            if (best) {
                e.preventDefault();
                best.focus({ preventScroll: true });
                best.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            } else if (e.key === 'ArrowLeft' && r1.left < 140) {
                const menuBtn = document.querySelector('button[onclick*="toggleSidebar"], button[onclick*="sidebar"], #menuBtn');
                if (menuBtn) {
                    e.preventDefault();
                    menuBtn.click();
                    setTimeout(() => {
                        refreshFocusables();
                        const sidebarFirst = document.querySelector('#main-sidebar .tv-focusable');
                        if (sidebarFirst) sidebarFirst.focus();
                    }, 220);
                }
            }
        }, true);
    }

    if (detectTV()) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', activateTvSpatialNavigation);
        } else {
            activateTvSpatialNavigation();
        }
    }
    window.activateKrakenTvMode = activateTvSpatialNavigation;
})();
