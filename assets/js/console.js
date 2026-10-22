/**
 * ============================================================================
 * KRAKEN MEDIA SERVER — console.js
 * Consola de diagnóstico en vivo (`#console-panel`) para consultar y limpiar `/api/logs`.
 * ============================================================================
 */

let consoleInterval = null;

/**
 * `toggleConsole()`
 * Abre o cierra el panel inferior de consola de logs del servidor (`#console-panel`).
 */
function toggleConsole() {
    const panel = document.getElementById('console-panel');
    const bar = document.getElementById('console-bar');

    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        bar.style.display = 'none';
        fetchConsoleLogs();
        consoleInterval = setInterval(fetchConsoleLogs, 2000);
    } else {
        panel.style.display = 'none';
        bar.style.display = 'flex';
        clearInterval(consoleInterval);
    }
}

/**
 * `toggleConsoleMax()`
 * Alterna el tamaño del panel de consola entre vista compacta y pantalla expandida.
 */
function toggleConsoleMax() {
    const panel = document.getElementById('console-panel');
    panel.style.width = panel.style.width === '90%' ? '600px' : '90%';
    panel.style.height = panel.style.height === '80vh' ? '250px' : '80vh';
}

/**
 * `fetchConsoleLogs()`
 * Obtiene periódicamente los registros del servidor desde `/api/logs`.
 */
async function fetchConsoleLogs() {
    try {
        const res = await fetch('/api/logs');
        const data = await res.json();
        const content = document.getElementById('console-content');

        const safeLogs = data.logs.map(log =>
            log.replace(/</g, "&lt;").replace(/>/g, "&gt;")
        );

        content.innerHTML = safeLogs.join('<br>');
        content.scrollTop = content.scrollHeight;
    } catch (e) { }
}

/**
 * `clearConsoleLogs()`
 * Limpia los registros del servidor llamando a `/api/logs/clear`.
 */
async function clearConsoleLogs() {
    try {
        await fetch('/api/logs/clear', { method: 'POST' });
        document.getElementById('console-content').innerHTML = '';
    } catch (e) { }
}
