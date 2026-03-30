
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Kraken 🐙 Deep Server</title>
    <link rel="icon" type="image/svg+xml" href="/assets/kraken.svg">
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#10b981">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    animation: {
                        'fade-in': 'fadeIn 0.3s ease-in-out',
                        // 'spin-slow' ya no lo ocupamos si no usamos el hurricane
                        'float': 'float 3s ease-in-out infinite', /* <--- NUEVA ANIMACIÓN */
                    },
                    keyframes: {
                        // ... tus otros keyframes ...
                        float: {
                            '0%, 100%': { transform: 'translateY(0px)' },
                            '50%': { transform: 'translateY(-6px)' }, /* Se mueve 6px hacia arriba */
                        }
                    }
                }
            }
        }
    </script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
body { 
    font-family: 'Segoe UI', system-ui, sans-serif; 
    -webkit-font-smoothing: antialiased; 
}

.no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
.no-scrollbar::-webkit-scrollbar {
    display: none;
}

/* ========== RESPONSIVE BREAKPOINTS ========== */
@media (max-width: 768px) {
    #player-bar { 
        flex-direction: column !important; 
        height: auto !important; 
        padding: 12px 16px 88px 16px !important;
        gap: 8px;
    }
    #player-bar > div { width: 100% !important; }
    
    aside { 
        position: fixed; 
        left: -100%; 
        top: 0; 
        height: 100vh; 
        width: 280px; 
        z-index: 200; 
        transition: left 0.3s;
        box-shadow: 4px 0 20px rgba(0,0,0,0.5);
    }
    aside.mobile-open { left: 0; }
    
    .mode-btn { font-size: 10px; padding: 8px; }
}

@media (max-width: 480px) {
    #player-bar { padding-bottom: 80px !important; }
    .filter-chip { font-size: 9px; padding: 3px 8px; }
    .list-row { padding: 6px 8px; }
}
/* ========== SCROLLBAR ========== */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #020617; }
::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }

/* ========== GLASS EFFECT ========== */
.glass { 
    background: rgba(24, 24, 27, 0.95); /* Zinc-950 (Gris Puro) */
    backdrop-filter: blur(20px); 
    border-top: 1px solid rgba(255,255,255,0.05); 
    box-shadow: 0 -4px 20px rgba(0,0,0,0.4);
}

/* Agrega esto para las tarjetas */
.card-carbon {
    background: rgba(39, 39, 42, 0.4); /* Zinc-800 semi-transparente */
    border: 1px solid rgba(255,255,255,0.05);
}

/* ========== SIDEBAR ========== */
.sidebar-link { 
    display: flex; 
    align-items: center; 
    gap: 12px; 
    padding: 10px 16px; 
    font-size: 0.85rem; 
    font-weight: 500; 
    color: #94a3b8; 
    border-radius: 8px; 
    transition: all 0.2s; 
    cursor: pointer; 
    border-left: 3px solid transparent; 
}
.sidebar-link:hover { color: #f8fafc; background: rgba(255,255,255,0.03); }
.sidebar-link.active { 
    background: rgba(16, 185, 129, 0.1); 
    color: #34d399; 
    border-left-color: #10b981; 
}

/* ========== LOGO VORTEX FIJO ========== */
.vortex-logo-fixed {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 256px;
    background: #080808;
    border-top: 1px solid rgba(16, 185, 129, 0.2);
    z-index: 250;
    padding: 16px;
    overflow: hidden;
}

@media (max-width: 768px) {
    .vortex-logo-fixed {
        width: 100%;
        border-right: none;
    }
}

/* ========== BOTÓN HAMBURGUESA MÓVIL ========== */
.mobile-menu-btn {
    position: fixed;
    top: 16px;
    left: 16px;
    z-index: 199;
    display: none;
    width: 40px;
    height: 40px;
    background: rgba(16, 185, 129, 0.9);
    border-radius: 8px;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 18px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

@media (max-width: 768px) {
    .mobile-menu-btn { display: flex; }
}

/* ========== MODE BUTTONS ========== */
.mode-btn { 
    flex: 1; 
    text-align: center; 
    padding: 12px; 
    font-weight: 800; 
    font-size: 11px; 
    text-transform: uppercase; 
    cursor: pointer; 
    border-bottom: 2px solid transparent; 
    color: #64748b; 
    transition: 0.2s; 
    letter-spacing: 0.05em; 
}
.mode-btn:hover { color: white; background: rgba(255,255,255,0.02); }
.mode-btn.active { 
    color: #10b981; 
    border-bottom-color: #10b981; 
    background: linear-gradient(to top, rgba(16,185,129,0.1), transparent); 
}

/* ========== ACCORDION ========== */
.accordion-header { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    font-size: 0.7rem; 
    font-weight: 700; 
    text-transform: uppercase; 
    letter-spacing: 0.1em; 
    color: #64748b; 
    padding: 12px 16px 4px 16px; 
    margin-top: 0px; 
    cursor: pointer; 
    transition: color 0.2s; 
    user-select: none; 
}
.artist-group { 
    margin-left: 8px; 
    border-left: 1px solid rgba(255,255,255,0.1); 
}
.album-link { 
    font-size: 0.8rem; 
    padding: 6px 12px; 
    color: #94a3b8; 
    cursor: pointer; 
    display: block; 
}
.album-link:hover { color: #34d399; }

/* ========== FILTERS ========== */
.filter-chip { 
    padding: 4px 12px; 
    border-radius: 999px; 
    font-size: 10px; 
    font-weight: bold; 
    cursor: pointer; 
    transition: all 0.2s; 
    border: 1px solid rgba(255,255,255,0.1); 
    background: rgba(255,255,255,0.05); 
    color: #94a3b8; 
}
.filter-chip:hover { background: rgba(255,255,255,0.1); color: white; }
.filter-chip.active { 
    background: #10b981; 
    color: #020617; 
    border-color: #10b981; 
    box-shadow: 0 0 10px rgba(16,185,129,0.3); 
}




/* ========== GRADIENTS ========== */
.rand-grad-0 { background: linear-gradient(135deg, #27272a 0%, #09090b 100%); }

/* ========== LIST & CARDS ========== */
.list-row { 
    display: flex; 
    align-items: center; 
    gap: 12px; 
    padding: 8px 12px; 
    border-bottom: 1px solid rgba(255,255,255,0.05); 
    cursor: pointer; 
    transition: background 0.2s; 
    border-radius: 6px; 
}
.list-row:hover { background: rgba(255,255,255,0.05); }
.list-row.selected { 
    background: rgba(16, 185, 129, 0.2); 
    border-left: 3px solid #10b981; 
}

/* ========== QUEUE ========== */
.queue-item { 
    display: flex; 
    align-items: center; 
    gap: 12px; 
    padding: 10px; 
    border-bottom: 1px solid rgba(255,255,255,0.05); 
    cursor: pointer; 
    transition: background 0.2s; 
    position: relative; 
}
.queue-item.playing { 
    background: rgba(16, 185, 129, 0.1); 
    border-left: 3px solid #10b981; 
}
.queue-img-container { 
    width: 48px; 
    height: 48px; 
    min-width: 48px; 
    flex-shrink: 0; 
    position: relative; 
    border-radius: 6px; 
    overflow: hidden; 
    background: #1e293b; 
}
.queue-img { width: 100%; height: 100%; object-fit: cover; }
.queue-info { flex: 1; min-width: 0; }

/* ========== VIEW BUTTONS ========== */
.btn-view { 
    width: 36px; 
    height: 32px; 
    display: flex !important; 
    align-items: center; 
    justify-content: center; 
    border-radius: 6px; 
    cursor: pointer; 
    transition: all 0.2s; 
}
.btn-view.active { background: #475569; color: white; }

/* ========== RANGE INPUTS ========== */
input[type=range] { 
    -webkit-appearance: none; 
    background: transparent; 
    cursor: pointer; 
}
input[type=range]::-webkit-slider-runnable-track { 
    width: 100%; 
    height: 4px; 
    background: #334155; 
    border-radius: 2px; 
}
input[type=range]::-webkit-slider-thumb { 
    -webkit-appearance: none; 
    height: 12px; 
    width: 12px; 
    border-radius: 50%; 
    background: #10b981; 
    margin-top: -4px; 
    transition: transform 0.1s; 
}

/* ========== VISUALIZER ========== */
#visualizer {
    width: 100%;
    height: 100%; /* Ocupa todo el alto del player bar */
    position: absolute;
    bottom: 0;
    left: 0;
    z-index: 0; /* Detrás de los textos */
    pointer-events: none;
    opacity: 0.55; /* Sutil */
    
    /* MÁSCARA DE DEGRADADO (El truco mágico) */
    /* Hace que se desvanezca arriba y a los lados */
    -webkit-mask-image: linear-gradient(to top, black 0%, transparent 100%);
    mask-image: linear-gradient(to top, black 0%, transparent 100%);
    
    mix-blend-mode: screen; /* Se mezcla con el fondo */
}

/* ========== TOOLTIPS ========== */
.tooltip { position: relative; }
.tooltip:hover::after { 
    content: attr(data-tooltip); 
    position: absolute; 
    bottom: 100%; 
    left: 50%; 
    transform: translateX(-50%); 
    background: #0f172a; 
    color: #fff; 
    padding: 4px 8px; 
    border-radius: 4px; 
    font-size: 10px; 
    white-space: nowrap; 
    z-index: 50; 
    border: 1px solid #334155; 
    box-shadow: 0 4px 6px rgba(0,0,0,0.3); 
    pointer-events: none; 
}



/* ========== ANIMATIONS ========== */
@keyframes pulse-neon {
    0%, 100% { 
        transform: scale(1); 
        filter: brightness(1) drop-shadow(0 0 15px rgba(16,185,129,0.9)); 
        opacity: 0.9; 
    }
    50% { 
        transform: scale(1.08); 
        filter: brightness(1.3) drop-shadow(0 0 25px rgba(16,185,129,1)); 
        opacity: 1; 
    }
}

/* ========== PLAYER BAR RESPONSIVE ========== */
#player-bar { 
    height: auto; 
    min-height: 96px;
    padding-bottom: 0;
    
}
#loader {
  position: fixed;
  inset: 0;
  background: radial-gradient(circle at center, #0b0f1a, #000);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  transition: opacity 0.4s ease;
}

/* Tornado animation */
.tornado {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 6px solid rgba(255,255,255,0.15);
  border-top-color: #6cf;
  animation: spin 1s linear infinite;
}

.ghost {
  width: 80px;
  height: 90px;
    background: #052e1c;
  border-radius: 40px 40px 20px 20px;
  position: relative;
  animation: float 2s ease-in-out infinite;
  box-shadow: 0 0 12px #00ff99;
}

/* Eyes */
.eyes {
  position: absolute;
  top: 28px;
  left: 18px;
  display: flex;
  gap: 12px;
}

.eyes span {
  width: 12px;
  height: 12px;
  background: #00ff99;
  border-radius: 50%;
  box-shadow: 0 0 6px #00ff99;
}

/* Skirt bottom */
.skirt {
  position: absolute;
  bottom: -8px;
  left: 0;
  width: 100%;
  height: 18px;
  background: inherit;
  border-radius: 0 0 20px 20px;
  clip-path: polygon(
    0% 0%,
    12% 100%,
    25% 40%,
    37% 100%,
    50% 40%,
    62% 100%,
    75% 40%,
    87% 100%,
    100% 0%
  );
}

/* Animation */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loader-text {
  margin-top: 22px;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 1.8px;
  color: rgba(180, 255, 240, 0.85);
  text-transform: uppercase;
  text-shadow:
    0 0 8px rgba(100,255,255,0.25),
    0 0 16px rgba(0,255,200,0.15);
  opacity: 0.9;
}

/* Hide animation */
#loader.hidden {
  opacity: 0;
  pointer-events: none;
}
.dots {
  display: flex;
  gap: 10px;
  margin-top: 12px;
  overflow: hidden;
}

.dots span {
  width: 8px;
  height: 8px;
  background: #9fd;
  border-radius: 50%;
  opacity: 0;
  animation: dotMove 1.4s infinite;
}

.dots span:nth-child(1) { animation-delay: 0s; }
.dots span:nth-child(2) { animation-delay: 0.2s; }
.dots span:nth-child(3) { animation-delay: 0.4s; }
.dots span:nth-child(4) { animation-delay: 0.6s; }
.dots span:nth-child(5) { animation-delay: 0.8s; }

@keyframes dotMove {
  0%   { opacity: 0; transform: translateX(0); }
  30%  { opacity: 1; }
  60%  { opacity: 1; }
  100% { opacity: 0; transform: translateX(-20px); }
}

/* ========== LOADER DE VIDEO ========== */
.kraken-loading-filter {
    filter: invert(66%) sepia(58%) saturate(486%) hue-rotate(107deg) brightness(93%) contrast(89%) 
            drop-shadow(0 0 20px rgba(16, 185, 129, 0.8));
    animation: kraken-breathe 2s infinite ease-in-out;
}

@keyframes kraken-breathe {
    0%, 100% { 
        transform: scale(1); 
        filter: invert(66%) sepia(58%) saturate(486%) hue-rotate(107deg) brightness(93%) contrast(89%) 
                drop-shadow(0 0 20px rgba(16, 185, 129, 0.8));
    }
    50% { 
        transform: scale(1.1); 
        filter: invert(66%) sepia(58%) saturate(486%) hue-rotate(107deg) brightness(120%) contrast(89%) 
                drop-shadow(0 0 35px rgba(16, 185, 129, 1));
    }
}

#video-loader.hidden {
    opacity: 0;
    pointer-events: none;
}

/* ========== SELECTORES DE AUDIO/SUBTÍTULOS ========== */
.video-settings-btn {
    position: relative;
}

.video-settings-menu {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 0.5rem;
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 0.5rem;
    padding: 0.5rem;
    min-width: 200px;
    opacity: 0;
    transform: translateY(10px);
    transition: all 0.2s ease;
    pointer-events: none;
    z-index: 200;
}

.video-settings-menu.show {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
}

.video-settings-menu button {
    width: 100%;
    text-align: left;
    padding: 0.5rem 0.75rem;
    color: rgba(255, 255, 255, 0.8);
    border-radius: 0.375rem;
    transition: all 0.2s;
    font-size: 0.75rem;
}

.video-settings-menu button:hover {
    background: rgba(16, 185, 129, 0.2);
    color: white;
}

.video-settings-menu button.active {
    background: rgba(16, 185, 129, 0.3);
    color: #10b981;
    font-weight: bold;
}

.video-settings-menu .menu-section {
    padding: 0.25rem 0;
}

.video-settings-menu .menu-label {
    font-size: 0.625rem;
    color: rgba(16, 185, 129, 0.6);
    text-transform: uppercase;
    font-weight: bold;
    letter-spacing: 0.05em;
    padding: 0.25rem 0.75rem;
    margin-top: 0.5rem;
}

.video-settings-menu .menu-label:first-child {
    margin-top: 0;
}

/* ========== REPRODUCTOR DE VIDEO MEJORADO ========== */
#view-player {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    z-index: 9999;
    background: #000;
}

#cine-container {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}

#cine-screen {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
}

#main-video {
    max-width: 100vw;
    max-height: 100vh;
    width: auto;
    height: auto;
    box-shadow: 0 0 100px rgba(16, 185, 129, 0.1);
    outline: none;
}

/* Video responsivo en móvil */
@media (max-width: 768px) {
    #main-video {
        width: 100vw !important;
        height: 100vh !important;
        object-fit: contain;
    }
}

/* HEADER siempre arriba */
.cine-header {
    position: fixed !important;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100 !important;
}

/* CONTROLES siempre abajo */
.cine-controls {
    position: fixed !important;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100 !important;
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
}

/* Mostrar controles al hacer hover O al tener clase visible */
#cine-container:hover .cine-controls,
#cine-container:hover .cine-header,
#cine-container.controls-visible .cine-controls,
#cine-container.controls-visible .cine-header {
    opacity: 1;
}

/* Ocultar controles por defecto */
.cine-controls, .cine-header {
    opacity: 0;
    transition: opacity 0.4s ease;
    pointer-events: auto; /* Permitir clics incluso cuando están ocultos */
}

/* En móvil, hacer área clicable más grande */
@media (max-width: 768px) {
    .cine-controls {
        padding: 1.5rem 1rem;
        min-height: 140px; /* Área táctil más grande */
    }
    
    .cine-header {
        padding: 1rem;
        min-height: 64px;
    }
}

/* Barra de progreso personalizada */
#video-progress::-webkit-slider-runnable-track {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
}

#video-progress::-webkit-slider-thumb {
    -webkit-appearance: none;
    height: 14px;
    width: 14px;
    border-radius: 50%;
    background: #10b981;
    margin-top: -5px;
    transition: transform 0.1s;
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
}

#video-progress:hover::-webkit-slider-thumb {
    transform: scale(1.3);
}

/* Sugerencia de rotación en móvil vertical */
@media (max-width: 768px) and (orientation: portrait) {
    #view-player::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 60px;
        height: 60px;
        background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M16.48 2.52c3.27 1.55 5.61 4.72 5.97 8.48h1.5C23.44 4.84 18.29 0 12 0l-.66.03 3.81 3.81 1.33-1.32zm-6.25-.77c-.59-.59-1.54-.59-2.12 0L1.75 8.11c-.59.59-.59 1.54 0 2.12l12.02 12.02c.59.59 1.54.59 2.12 0l6.36-6.36c.59-.59.59-1.54 0-2.12L10.23 1.75zm4.6 19.44L2.81 9.17l6.36-6.36 12.02 12.02-6.36 6.36zm-7.31.29C4.25 19.94 1.91 16.76 1.55 13H.05C.56 19.16 5.71 24 12 24l.66-.03-3.81-3.81-1.33 1.32z"/></svg>') center / contain no-repeat;
        opacity: 0.3;
        pointer-events: none;
        z-index: 10000;
        animation: rotate-hint 2s ease-in-out infinite;
    }

    @keyframes rotate-hint {
        0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
        50% { transform: translate(-50%, -50%) rotate(90deg); }
    }
}
  
  @keyframes rotate-hint {
    0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
    50% { transform: translate(-50%, -50%) rotate(90deg); }
  }
}

@keyframes slide-in {
  from { transform: translateY(-10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.animate-slide-in {
  animation: slide-in 0.2s ease-out;
}

#main-scroll {
    padding-bottom: 200px; /* ← Espacio para el player */
}

@media (max-width: 768px) {
    #main-scroll {
        padding-bottom: 250px; /* ← Más espacio en móvil */
    }
}

.bg-noise {
    position: relative;
    background-color: #050505; /* Base negra */
}
.bg-noise::before {
    content: "";
    position: absolute;
    inset: 0;
    opacity: 0.03; /* Muy sutil */
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
}
.relative-z { position: relative; z-index: 1; }

.bg-grid-pattern {
    background-color: #050505;
    background-image: 
        linear-gradient(rgba(16, 185, 129, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(16, 185, 129, 0.03) 1px, transparent 1px);
    background-size: 20px 20px; /* Tamaño de los cuadritos */
}

.player-bg {
    background-color: #0c0c0c; /* Gris casi negro, más suave */
    /* Patrón de puntos o rejilla muy sutil */
    background-image: radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 20px 20px;
    
    /* Borde superior brillante sutil */
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    
    /* Sombra hacia arriba para separarlo del contenido */
    box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5);
}

/* ========== KRAKEN NEON STYLE ========== */

/* Convierte el SVG negro en Verde Neón Brillante */
.kraken-neon-filter {
    /* Esta combinación mágica vuelve lo negro -> Verde Esmeralda Brillante */
    filter: invert(66%) sepia(58%) saturate(486%) hue-rotate(107deg) brightness(93%) contrast(89%) 
            drop-shadow(0 0 8px rgba(16, 185, 129, 0.6));
    
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    animation: neon-breathe 4s infinite ease-in-out;
}

/* Al pasar el mouse: Brillo Nuclear */
.group:hover .kraken-neon-filter {
    filter: invert(66%) sepia(58%) saturate(486%) hue-rotate(107deg) brightness(120%) contrast(89%) 
            drop-shadow(0 0 25px rgba(16, 185, 129, 1));
    transform: scale(1.05) translateY(-2px);
}

@keyframes neon-breathe {
    0%, 100% { opacity: 0.9; }
    50% { opacity: 1; drop-shadow(0 0 15px rgba(16, 185, 129, 0.8)); }
}

/* Texto Metálico (Plata) */
.text-metal {
    background: linear-gradient(180deg, #ffffff 0%, #94a3b8 45%, #475569 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 2px 2px rgba(0,0,0,0.8));
}

/* La "E" estilizada */
.kraken-xi {
    background: none;
    -webkit-text-fill-color: #10b981;
    text-shadow: 0 0 15px rgba(16, 185, 129, 0.8);
}

.clip-kraken-full {
    clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
}

/* Convertir SVG negro en “neón verde” */
.kraken-neon {
    filter:
        brightness(0)
        invert(1)
        sepia(1)
        saturate(600%)
        hue-rotate(90deg)
        drop-shadow(0 0 6px rgba(16,185,129,0.9))
        drop-shadow(0 0 14px rgba(16,185,129,0.6));
}



/* ==================== FIX MÓVIL - PEGAR EN TU <style> ====================
   SOLUCIONA:
   1. Forzar orientación vertical (bloquear rotación)
   2. Botones flotantes NO se enciman con reproductor
   3. Reducir espacio vacío inferior
*/

/* 1. FORZAR ORIENTACIÓN VERTICAL EN MÓVILES */
@media screen and (max-width: 768px) {
	/* Bloquear rotación horizontal en móviles */
	html {
		transform-origin: left top;
	}
	
	/* Si el usuario rota el dispositivo, mostrar mensaje */
	@media (orientation: landscape) {
		body::before {
			content: "Por favor, gira tu dispositivo verticalmente 📱";
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0, 0, 0, 0.95);
			color: white;
			display: flex;
			align-items: center;
			justify-content: center;
			z-index: 99999;
			font-size: 1.2rem;
			text-align: center;
			padding: 2rem;
		}
	}
}

/* 2. AJUSTAR BOTONES FLOTANTES PARA QUE NO SE ENCIMEN CON REPRODUCTOR */
@media screen and (max-width: 768px) {
	/* Botones flotantes (usuario, carpeta, etc.) */
	.fixed.bottom-6.right-6 {
		/* Moverlos más arriba cuando el reproductor está visible */
		bottom: 10rem !important; /* Espacio para el reproductor */
		transition: bottom 0.3s ease;
	}
	
	/* Si el reproductor NO está visible, bajarlos */
	body:not(.player-active) .fixed.bottom-6.right-6 {
		bottom: 1.5rem !important;
	}
	
	/* Ajustar z-index para que estén DEBAJO del reproductor */
	.fixed.bottom-6.right-6 {
		z-index: 40 !important; /* Reproductor es z-200 */
	}
}

/* 3. REDUCIR ESPACIO VACÍO EN LA PARTE INFERIOR */
@media screen and (max-width: 768px) {
	/* Reducir padding inferior del contenido principal */
	#view-library {
		padding-bottom: 8rem !important; /* Antes era pb-32 = 8rem */
	}
	
	/* Cuando el reproductor está activo, agregar más espacio */
	body.player-active #view-library {
		padding-bottom: 12rem !important;
	}
	
	/* Reducir padding de las tarjetas de contenido */
	.animate-fade-in {
		padding-bottom: 6rem !important;
	}
}

/* 4. AJUSTAR REPRODUCTOR EN MÓVIL (HACERLO MÁS COMPACTO) */
@media screen and (max-width: 768px) {
	#player-bar {
		/* Hacerlo más delgado */
		padding: 0.75rem 1rem !important;
		
		/* Asegurar que esté arriba de todo */
		z-index: 200 !important;
	}
	
	/* Reducir tamaño de controles */
	#player-bar button {
		width: 2.5rem !important;
		height: 2.5rem !important;
	}
	
	/* Botón de play/pause más grande */
	#player-bar .play-pause-btn {
		width: 3rem !important;
		height: 3rem !important;
	}
	
	/* Reducir tamaño de la portada */
	#player-bar img {
		max-width: 3rem !important;
		max-height: 3rem !important;
	}
	
	/* Ajustar barra de progreso */
	#player-bar input[type="range"] {
		height: 0.25rem !important;
	}
}

/* 5. CLASE HELPER PARA DETECTAR SI EL REPRODUCTOR ESTÁ ACTIVO */
/* Agregar esta clase al <body> cuando el reproductor se muestre */
/* En tu JavaScript, cuando muestres el reproductor: */
/* document.body.classList.add('player-active'); */
/* Cuando lo ocultes: */
/* document.body.classList.remove('player-active'); */

/* 6. AJUSTE ADICIONAL: Sidebar en móvil no debe tapar reproductor */
@media screen and (max-width: 768px) {
	#sidebar {
		/* Cuando el reproductor está activo, el sidebar debe ser más corto */
		bottom: 0 !important;
		padding-bottom: 0 !important;
	}
	
	body.player-active #sidebar {
		bottom: 6rem !important; /* Altura del reproductor */
	}
}

/* 7. PROTECCIÓN: Safe area para iPhones con notch */
@supports (padding: max(0px)) {
	@media screen and (max-width: 768px) {
		#player-bar {
			padding-bottom: max(0.75rem, env(safe-area-inset-bottom)) !important;
		}
		
		.fixed.bottom-6.right-6 {
			bottom: max(10rem, calc(10rem + env(safe-area-inset-bottom))) !important;
		}
	}
}



</style>
</head>
<body class="bg-[#09090b] text-emerald-300 font-sans h-screen overflow-hidden flex selection:bg-emerald-500 selection:text-white">

<div id="session-status-bar" 
     class="fixed top-0 left-0 w-full text-center text-[10px] font-bold tracking-widest z-[9999] cursor-pointer hidden transition-all duration-300 shadow-md">
     </div>

<div id="top-spacer" class="h-0 transition-all duration-300"></div>

<div id="loader">
  <div class="ghost">
    <div class="eyes">
      <span></span>
      <span></span>
    </div>
    <div class="skirt"></div>
  </div>

  <!-- 👇 NUEVO: puntos estilo Pac-Man -->
  <div class="dots">
    <span></span><span></span><span></span><span></span><span></span>
  </div>

  <div class="loader-text" id="loader-text">
    Cargando tu librería <3
  </div>
</div>

    <audio id="main-audio" preload="none" crossorigin="anonymous"></audio>
    
    <!-- BOTÓN HAMBURGUESA MÓVIL -->
    
    <aside id="main-sidebar" class="w-64 bg-noise flex flex-col border-r border-white/5 shrink-0 h-full z-[300] fixed md:relative transition-transform duration-300 -translate-x-full md:translate-x-0 top-0 left-0"><div class="relative-z h-full flex flex-col">
  <div class="relative-z h-full flex flex-col">
    
    <div class="relative bg-[#020202] p-4 border-b border-white/5 flex flex-col items-center justify-center gap-1 overflow-hidden group select-none shadow-lg shrink-0">
         <div class="absolute inset-0 opacity-20 bg-[url('/assets/noise.svg')] mix-blend-overlay"></div>
         <div class="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-emerald-900/20 to-transparent opacity-60"></div>

         <div class="relative z-10 w-24 h-24 mb-0 transition-transform duration-500 group-hover:scale-105">
             <img src="/assets/kraken.svg" class="w-full h-full object-contain kraken-neon-filter" alt="Kraken">
         </div>

         <div class="relative z-10 text-center flex flex-col items-center">
             <h1 class="text-2xl font-black tracking-[0.25em] text-metal leading-none flex items-center gap-1 font-sans ml-1">
                 KRAK<span class="kraken-xi text-3xl relative -top-0.5">Ξ</span>N 
             </h1>
             <div class="flex items-center gap-2 mt-1 opacity-80">
                 <span class="text-[9px] font-bold text-emerald-600 tracking-[0.3em]">Servidor Multimedia</span>
             </div>
             
         </div>
    </div>
    
    <div class="flex border-b border-white/5 shrink-0">
        <div onclick="setLibraryMode('audio')" id="tab-audio" class="mode-btn active"><i class="fa-solid fa-music text-lg block mb-1"></i>MÚSICA</div>
        <div onclick="setLibraryMode('video')" id="tab-video" class="mode-btn"><i class="fa-solid fa-film text-lg block mb-1"></i>VIDEO</div>
    </div>
    
    <nav class="px-4 space-y-1 mt-4 shrink-0">
        <div onclick="goHome()" id="nav-library" class="sidebar-link active"><i class="fa-solid fa-layer-group w-4 text-center"></i> Biblioteca</div>
        <div onclick="ver('downloader')" id="nav-downloader" class="sidebar-link"><i class="fa-solid fa-cloud-arrow-down w-4 text-center"></i> Descargar</div>
        <div onclick="ver('history')" id="nav-history" class="sidebar-link hover:text-yellow-400"><i class="fa-solid fa-clock-rotate-left w-4 text-center"></i> Historial</div>
    </nav>
    
    <div id="sidebar-filters" class="flex-1 flex flex-col min-h-0 px-4 mt-0 pb-2">
        
        <div class="accordion-header group shrink-0" onclick="toggleAcc('acc-playlists')">
            <span class="group-hover:text-emerald-400 transition">MIS PLAYLISTS</span> 
            <i class="fa-solid fa-chevron-down text-[12px] transition-transform duration-300" id="icon-acc-playlists"></i>
        </div>
        
        <div id="acc-playlists" class="show pl-1 mt-2 flex-1 flex flex-col min-h-0">
            <div onclick="crearPlaylist()" class="sidebar-link text-[11px] text-emerald-500 py-2 border border-dashed border-emerald-500/50 hover:bg-emerald-500/10 justify-center mb-2 shrink-0">
                <i class="fa-solid fa-plus-circle"></i> Nueva Lista
            </div>
            
            <div id="list-playlists-container" class="flex-1 overflow-y-auto custom-scroll pr-2 space-y-1">
                </div>
        </div>
    </div>

    <div class="mt-auto bg-[#080808] border-t border-white/5 shrink-0">
        <div class="px-4 pt-3 pb-4">
            <button onclick="rescanLibrary()" id="btn-rescan" class="w-full bg-emerald-900/10 hover:bg-emerald-600 border border-emerald-500/20 hover:border-emerald-500 text-emerald-500 hover:text-white transition-all duration-300 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 group shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                <i class="fa-solid fa-rotate group-hover:rotate-180 transition-transform duration-500"></i>
                <span>Sincronizar</span>
            </button> 
        </div>
    </div>
</div>
    <div class="p-4 border-t border-emerald-900/20 bg-[#080808] relative overflow-hidden group">
                </div>
    </div>
    </div>
</aside>

    <main class="flex-1 flex flex-col h-full relative bg-gradient-to-br from-[#18181b] via-[#09090b] to-black overflow-hidden">
        
        <div class="flex-1 overflow-y-auto p-6 scroll-smooth" id="main-scroll">
            
            <div id="view-downloader" class="hidden animate-fade-in max-w-4xl mx-auto pt-10">
            <button id="btn-ytdlp" onclick="updateYTDLP()" class="w-full bg-emerald-900/10 hover:bg-emerald-600 border border-emerald-500/20 hover:border-emerald-500 text-emerald-500 hover:text-white transition-all duration-300 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 group shadow-[0_0_10px_rgba(0,0,0,0.5)]"><i class="fa-solid fa-rotate group-hover:rotate-180 transition-transform duration-500"></i><span>ACTUALIZAR yt-dlp</span></button>
                <BR><BR><BR><div class="flex gap-2 mb-6">
                    <button onclick="analizarClipboard()" class="bg-emerald-800 hover:bg-emerald-700 text-emerald-300 px-5 rounded-xl transition shadow-lg"><i class="fa-regular fa-clipboard"></i></button>
                    <input type="text" id="url-input" placeholder="Enlace de YouTube..." class="flex-1 bg-emerald-900/50 border border-emerald-700 rounded-xl px-5 py-3 outline-none focus:border-emerald-500 font-mono text-xs text-white">
                    <button onclick="analizar()" class="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 rounded-xl shadow-lg text-xs tracking-wide">ANALIZAR</button>
                </div>
                <div id="dl-progress" class="hidden mb-6 glass p-5 rounded-xl border border-blue-500/30"><div class="flex justify-between text-xs mb-2 text-blue-300"><span id="dl-filename">Iniciando...</span><button onclick="detener()" class="text-red-400">CANCELAR</button></div><div class="h-1 bg-emerald-800 rounded-full overflow-hidden"><div id="dl-bar" class="h-full bg-blue-500 w-0 transition-all"></div></div><div class="flex justify-between text-[10px] text-emerald-400 mt-1"><span id="dl-details">--</span><span id="dl-percent" class="text-white font-bold">0%</span></div></div>
                <div id="download-area" class="hidden glass p-5 rounded-xl border border-white/5">
                    <div class="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-white/5 pb-4">
                        <div class="relative w-full md:w-64"><i class="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-emerald-500 text-xs"></i><input type="text" id="dl-search" onkeyup="filterDownloadList()" placeholder="Filtrar..." class="w-full bg-emerald-900/50 border border-emerald-700 rounded-lg py-1.5 pl-9 pr-3 text-xs outline-none focus:border-blue-500 text-white"></div>
                        <div class="flex gap-2">
                            <select id="dl-quality" class="bg-emerald-900 text-white text-xs font-bold pl-3 pr-8 py-2 rounded-lg border border-emerald-700 outline-none cursor-pointer"><option value="best">💎 Mejor Video</option><option value="1080">🖥️ 1080p</option><option value="720">📺 720p</option><option value="480">📱 480p</option><option value="mp3">🎵 Mejor Audio (MP3)</option></select>
                            <select id="dl-speed" class="bg-emerald-900 text-white text-xs font-bold pl-3 pr-6 py-2 rounded-lg border border-emerald-700 outline-none cursor-pointer" title="Velocidad de descarga"><option value="1">⚡ Normal</option><option value="2">⚡⚡ 2x</option><option value="4">⚡⚡⚡ 4x</option></select>
                            <button onclick="iniciarDescarga()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold text-xs shadow-lg flex items-center gap-2"><i class="fa-solid fa-download"></i> BAJAR</button>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 mb-2 px-2 t<div class="flex items-center gap-2 mb-2 px-2 text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
    <input type="checkbox" id="check-all" onchange="toggleSelectAll(this); return false;" class="w-3 h-3 accent-emerald-500 cursor-pointer">
    <span>Seleccionar Todo</span>
</div>
                    <div id="download-list" class="space-y-1 max-h-[400px] overflow-y-auto custom-scroll pr-1"></div>
                    
                </div>
            </div>

<div id="view-player" class="hidden fixed inset-0 z-[9999] bg-black">
  <div id="cine-container" class="relative w-full h-full flex items-center justify-center">
    <div id="video-loader" class="absolute inset-0 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center z-50 transition-opacity duration-500">
  <div class="relative">
    <!-- SVG del Kraken con animación de llenado -->
    <div class="w-32 h-32 md:w-40 md:h-40 relative">
      <img src="/assets/kraken.svg" 
           class="w-full h-full object-contain kraken-loading-filter animate-pulse" 
           alt="Cargando">
      
      <!-- Barra de progreso circular -->
      <svg class="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" 
                fill="none" 
                stroke="rgba(16, 185, 129, 0.2)" 
                stroke-width="3"/>
        <circle id="video-load-progress" 
                cx="50" cy="50" r="45" 
                fill="none" 
                stroke="#10b981" 
                stroke-width="3"
                stroke-dasharray="283"
                stroke-dashoffset="283"
                stroke-linecap="round"
                class="transition-all duration-300"/>
      </svg>
    </div>
  </div>
  
  <!-- Texto de carga -->
  <div class="mt-6 text-center">
    <p class="text-emerald-400 text-sm font-bold animate-pulse">Cargando video...</p>
    <p id="video-load-percent" class="text-emerald-500/60 text-xs font-mono mt-1">0%</p>
  </div>
</div>
    <!-- VIDEO PRINCIPAL -->
    <div id="cine-screen" class="absolute inset-0 flex items-center justify-center"></div>
    
    <!-- HEADER (Título + Salir) -->
    <div class="cine-header absolute top-0 left-0 right-0
                h-14 md:h-16 px-4 md:px-6 flex items-center justify-between
                bg-gradient-to-b from-black/95 via-black/60 to-transparent
                pt-[env(safe-area-inset-top)] backdrop-blur-sm z-30">
      <button onclick="exitVideoMode()" 
              class="text-white/70 hover:text-white flex items-center gap-2 
                     bg-black/50 px-4 py-2 rounded-full backdrop-blur-md 
                     transition hover:bg-red-900/50">
        <i class="fa-solid fa-arrow-left"></i>
        <span class="text-xs font-bold uppercase tracking-wider">Salir</span>
      </button>
      <div class="text-right">
        <h2 id="cine-title" class="text-sm font-bold text-white drop-shadow-md">Título</h2>
        <p id="cine-meta" class="text-[10px] text-emerald-400 font-mono uppercase"></p>
      </div>
    </div>

    <!-- CONTROLES INFERIORES -->
    <div class="cine-controls">
      
      <!-- BARRA DE PROGRESO -->
      <div class="w-full max-w-5xl mx-auto flex items-center gap-2 md:gap-3 text-white/80 text-[10px] md:text-xs font-mono mb-3 md:mb-4 px-4">
        <span id="video-time-current">0:00</span>
        <input type="range" id="video-progress" value="0" min="0" step="0.1"
               class="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-emerald-500"
               oninput="seekVideo()">
        <span id="video-time-total">0:00</span>
      </div>

     <!-- BOTONES DE CONTROL -->
<div class="flex items-center justify-center gap-4 md:gap-8 pb-2">
  <button onclick="playPrevious()" 
          class="text-white/80 hover:text-white hover:scale-110 transition text-2xl md:text-3xl"
          aria-label="Anterior">
    <i class="fa-solid fa-backward-step"></i>
  </button>

  <button onclick="toggleVideoPlay()" id="btn-video-play"
          class="bg-white/90 hover:bg-white text-black 
                 w-14 h-14 md:w-16 md:h-16 rounded-full 
                 flex items-center justify-center shadow-xl 
                 hover:scale-105 transition"
          aria-label="Reproducir/Pausar">
    <i id="video-play-icon" class="fa-solid fa-pause text-xl md:text-2xl"></i>
  </button>

  <button onclick="playNext()" 
          class="text-white/80 hover:text-white hover:scale-110 transition text-2xl md:text-3xl"
          aria-label="Siguiente">
    <i class="fa-solid fa-forward-step"></i>
  </button>

  <button onclick="toggleQueue()" 
          class="text-white/80 hover:text-white transition text-xl md:text-2xl"
          aria-label="Cola de reproducción">
    <i class="fa-solid fa-list-ul"></i>
  </button>

  <!-- BOTÓN DE CONFIGURACIÓN (Audio/Subtítulos) -->
  <div class="video-settings-btn relative">
    <button onclick="toggleVideoSettings()" 
            class="text-white/80 hover:text-white transition text-xl md:text-2xl"
            aria-label="Configuración">
      <i class="fa-solid fa-gear"></i>
    </button>
    
    <!-- MENÚ DESPLEGABLE -->
    <div id="video-settings-menu" class="video-settings-menu">
      <!-- PISTAS DE AUDIO -->
      <div class="menu-section" id="audio-tracks-section">
        <div class="menu-label">🎵 Audio</div>
        <div id="audio-tracks-list"></div>
      </div>
      
      <!-- SUBTÍTULOS -->
      <div class="menu-section" id="subtitle-tracks-section">
        <div class="menu-label">💬 Subtítulos</div>
        <button onclick="selectSubtitle(-1)" class="active" id="subtitle-none">
          Sin subtítulos
        </button>
        <div id="subtitle-tracks-list"></div>
      </div>
    </div>
  </div>

  <button onclick="toggleVideoFullscreen()" 
          class="text-white/80 hover:text-white text-xl md:text-2xl"
          aria-label="Pantalla completa">
    <i class="fa-solid fa-expand"></i>
  </button>
</div>
    </div>
  </div>
</div>
<div class="fixed bottom-6 right-6 z-50 flex items-center justify-end group">
    
</div>
            <div id="view-library" class="animate-fade-in pb-32">
    <div id="lib-stats" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"></div>
    <!-- ========== MÓVIL: HEADER SUPERIOR ========== -->
<div class="md:hidden sticky top-0 bg-[#171717]/95 backdrop-blur-md z-40 border-b border-white/5 shadow-xl">

    <!-- FILA 1: Título -->
    <div class="text-center pb-3 px-3 border-t border-white/5 pt-3">
        <div class="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center justify-center gap-1" id="lib-mode-label-mobile">
            <i class="fa-solid fa-music"></i> MÚSICA
        </div>
        <h2 class="text-sm font-bold text-white leading-tight mt-1" id="lib-title-mobile">Mi Colección</h2>
    </div>

    <!-- FILA 2: Menú / Play / Select -->
    <div class="flex gap-2 p-3">
        <button onclick="toggleSidebar()"
                class="flex-1 bg-[#18181b] hover:bg-emerald-700 border border-emerald-700 text-white rounded-lg py-3 font-bold text-xs transition flex items-center justify-center gap-2">
            <i class="fa-solid fa-bars"></i>
            <span class="hidden sm:inline">Menú</span>
        </button>

        <button onclick="playContext()"
                class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg py-3 font-bold text-xs transition shadow-lg flex items-center justify-center gap-2">
            <i class="fa-solid fa-play ml-0.5"></i>
            <span class="hidden sm:inline">Play</span>
        </button>

        <button onclick="toggleSelectionMode()"
        id="btn-select-mode-mobile"
        class="flex-1 bg-[#18181b] hover:bg-emerald-700 border border-emerald-700 text-emerald-300 rounded-lg py-3 font-bold text-xs transition flex items-center justify-center gap-2">
    <i class="fa-regular fa-square-check"></i>
    <span class="hidden sm:inline">Sel</span>
</button>
<button onclick="selectAllVisible()"
        id="btn-select-all-vis-mobile"
        class="hidden flex-1 bg-[#18181b] hover:bg-emerald-700 border border-dashed
               border-emerald-700 text-emerald-300 rounded-lg py-3 font-bold text-xs
               transition flex items-center justify-center gap-2">
    <i class="fa-solid fa-check-double"></i>
    <span class="hidden sm:inline">Todos</span>
</button>
    </div>

    <!-- FILA 3: Búsqueda -->
    <div class="px-3 pb-3">
        <div class="relative">
            <i class="fa-solid fa-search absolute left-3 top-2.5 text-emerald-500 text-xs"></i>
            <input type="text" id="lib-search-mobile" onkeyup="renderLib()" placeholder="Buscar..."
                   class="w-full bg-[#18181b] border border-emerald-700 rounded-lg py-2 pl-9 pr-3 text-xs outline-none focus:border-emerald-500 text-white">
        </div>
    </div>

    <!-- FILA 4: Ordenar + Vista -->
    <div class="px-3 pb-3 flex gap-2 items-center relative">
        <button onclick="toggleSortMenuMobile()"
                class="filter-chip shrink-0 text-[9px] flex items-center gap-1">
            <i class="fa-solid fa-arrow-down-wide-short"></i> Ordenar
        </button>

         

        <div class="flex-1"></div>

        <button onclick="setView('grid')" id="view-grid-mobile" class="btn-view shrink-0" title="Grid">
            <i class="fa-solid fa-border-all text-xs"></i>
        </button>
        <button onclick="setView('list')" id="view-list-mobile" class="btn-view shrink-0" title="List">
            <i class="fa-solid fa-list text-xs"></i>
        </button>

        <!-- Menú flotante móvil -->
        <div id="sort-menu-mobile"
             class="hidden absolute left-3 right-3 top-full mt-2 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl z-50 p-2 text-xs">
            <button onclick="setSortMobile('new')" class="w-full text-left px-3 py-2 rounded hover:bg-white/10">⭐ Novedades</button>
            <button onclick="setSortMobile('top')" class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🔥 Top</button>
            <button onclick="setSortMobile('recent')" class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🕒 Recientes</button>
            <button onclick="setSortMobile('az')" class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🔤 A–Z</button>
            <button onclick="setSortMobile('artist')" class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🎤 Artista</button>
        </div>
    </div>
</div>

<!-- ========== DESKTOP: HEADER ========== -->
<div class="hidden md:block sticky top-0 bg-[#171717]/95 backdrop-blur-md p-3 z-40 rounded-xl border border-white/5 shadow-xl mb-4 flex flex-col gap-3">

    <div class="flex items-center justify-between">
        <div class="min-w-0">
            <div class="text-[9px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1" id="lib-mode-label-desktop">
                <i class="fa-solid fa-music"></i> MÚSICA
            </div>
            <h2 class="text-lg md:text-xl font-bold text-white leading-none truncate" id="lib-title-desktop">Mi Colección</h2>
        </div>

        <div class="flex items-center gap-2 bg-[#18181b] px-3 py-1.5 rounded-lg border border-emerald-700">
            <i class="fa-solid fa-magnifying-glass text-[10px] text-emerald-400"></i>
            <input type="range" min="0" max="2" value="0" class="w-12 accent-emerald-500" oninput="changeZoom(this.value)">

        </div>
    </div>

    <div class="flex gap-2">
        <div class="relative flex-1">
            <i class="fa-solid fa-search absolute left-3 top-2.5 text-emerald-500 text-xs"></i>
            <input type="text" id="lib-search-desktop" onkeyup="renderLib()" placeholder="Buscar..."
                   class="w-full bg-[#18181b] border border-emerald-700 rounded-lg py-2 pl-9 pr-4 text-xs outline-none focus:border-emerald-500 text-white">
        </div>

        <div class="bg-[#18181b] rounded-lg p-1 border border-emerald-700 flex items-center shrink-0">
            <button onclick="setView('grid')" id="view-grid" class="btn-view"><i class="fa-solid fa-border-all text-sm"></i></button>
            <div class="w-px h-4 bg-emerald-600 mx-1"></div>
            <button onclick="setView('list')" id="view-list" class="btn-view"><i class="fa-solid fa-list text-sm"></i></button>
        </div>
    </div>

    <div class="flex items-center gap-2 relative">
        <button onclick="toggleSortMenuDesktop()" class="filter-chip shrink-0 flex items-center gap-1">
            <i class="fa-solid fa-arrow-down-wide-short"></i> Ordenar
        </button>

         

        <button onclick="playContext()" class="filter-chip shrink-0">
            <i class="fa-solid fa-play mr-1"></i> Play All
        </button>

        <button onclick="toggleSelectionMode()"
        id="btn-select-mode"
        class="filter-chip shrink-0">
    <i class="fa-regular fa-square-check mr-1"></i> Select
</button>
<button onclick="selectAllVisible()"
        id="btn-select-all-vis"
        class="filter-chip hidden border-dashed shrink-0">
    <i class="fa-solid fa-check-double mr-1"></i> Todos
</button>

        <button onclick="autoCompletarVideos()" id="btn-autotag-video"
        class="filter-chip shrink-0 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 hidden">
    <i class="fa-solid fa-magic mr-1"></i> Auto-Tag
</button>


        <div id="sort-menu-desktop"
             class="hidden absolute top-full left-0 mt-2 w-56 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl z-50 p-2 text-xs">
            <button onclick="setSortDesktop('new')" class="w-full text-left px-3 py-2 rounded hover:bg-white/10">⭐ Novedades</button>
            <button onclick="setSortDesktop('top')" class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🔥 Top</button>
            <button onclick="setSortDesktop('recent')" class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🕒 Recientes</button>
            <button onclick="setSortDesktop('az')" class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🔤 A–Z</button>
            <button onclick="setSortDesktop('artist')" class="w-full text-left px-3 py-2 rounded hover:bg-white/10">🎤 Artista</button>
        </div>
    </div>
</div>

                
<!-- CAMBIOS EN LOS SMART MIXES (MÁS COMPACTOS EN MÓVIL) -->
<div id="smart-mixes-container" class="hidden mb-4 md:mb-6">
    <h3 class="text-[10px] md:text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2 md:mb-3 px-1">Mixes para ti</h3>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4" id="smart-mixes-grid"></div>

    <div id="genre-mixes-section" class="hidden mt-4">
        <h3 class="text-[10px] md:text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2 px-1">Mixes por Género</h3>
        <div class="relative group">
            <button onclick="scrollMixRow('genre-mixes-row', -1)" class="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/70 text-white border border-white/10 opacity-0 group-hover:opacity-100 transition"><i class="fa-solid fa-chevron-left text-xs"></i></button>
            <button onclick="scrollMixRow('genre-mixes-row', 1)" class="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/70 text-white border border-white/10 opacity-0 group-hover:opacity-100 transition"><i class="fa-solid fa-chevron-right text-xs"></i></button>
            <div id="genre-mixes-row" class="flex gap-3 overflow-x-auto pb-2 no-scrollbar"></div>
        </div>
    </div>

    <div id="artist-mixes-section" class="hidden mt-4">
        <h3 class="text-[10px] md:text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2 px-1">Mixes por Artista</h3>
        <div class="relative group">
            <button onclick="scrollMixRow('artist-mixes-row', -1)" class="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/70 text-white border border-white/10 opacity-0 group-hover:opacity-100 transition"><i class="fa-solid fa-chevron-left text-xs"></i></button>
            <button onclick="scrollMixRow('artist-mixes-row', 1)" class="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/70 text-white border border-white/10 opacity-0 group-hover:opacity-100 transition"><i class="fa-solid fa-chevron-right text-xs"></i></button>
            <div id="artist-mixes-row" class="flex gap-3 overflow-x-auto pb-2 no-scrollbar"></div>
        </div>
    </div>
</div>

    <div id="active-filters-bar" class="flex flex-wrap gap-2 mb-4 hidden px-2"></div>

    <div id="artist-hero" class="hidden mb-6 glass p-6 rounded-2xl border border-white/10 flex items-center gap-6 bg-gradient-to-r from-emerald-900/50 to-transparent animate-fade-in">
        <div class="w-24 h-24 rounded-full bg-emerald-800 flex items-center justify-center text-4xl shadow-xl shrink-0"><i class="fa-solid fa-microphone-lines text-emerald-500"></i></div>
        <div class="flex-1 min-w-0">
            <h2 class="text-3xl font-black text-white truncate" id="hero-name">Artista</h2>
            <p class="text-emerald-400 text-sm mt-1" id="hero-stats">0 Canciones</p>
            <button onclick="playContext()" class="mt-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2 px-6 rounded-full shadow-lg transition flex items-center gap-2 w-fit"><i class="fa-solid fa-play"></i> Reproducir</button>
        </div>
    </div>

    <div id="lib-container"></div>
</div>

             <div id="view-history" class="hidden animate-fade-in pb-32 pt-10">
                <div class="flex justify-between items-center mb-4 ml-2">
                    <h2 class="text-2xl font-bold text-white">Historial de Descargas</h2>
                    <button onclick="cleanGhosts()" class="bg-red-900/30 text-red-400 border border-red-900/50 hover:bg-red-900/50 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition"><i class="fa-solid fa-recycle"></i> Limpiar Inexistentes</button>
                    <button id="btn-autotag" onclick="autoCompletarGeneros()"class="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg text-xs font-medium shadow-lg transition-all"><i class="fa-brands fa-lastfm"></i>Auto-Detectar Géneros</button>
                </div>
                <div class="glass p-4 rounded-xl" id="history-container"></div>
            </div>
        </div>

        <div id="batch-bar" class="fixed bottom-24 left-1/2 -translate-x-1/2 glass px-6 py-3 rounded-full border border-white/20 shadow-2xl flex items-center gap-4 z-[60] hidden transform translate-y-20 transition-transform duration-300">
            <span class="text-xs font-bold text-emerald-400"><span id="batch-count">0</span> seleccionados</span>
            <div class="h-4 w-px bg-emerald-600"></div>
            <button onclick="enqueueSelected()"
        class="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition text-xs font-bold">
    <i class="fa-solid fa-list"></i>
    Encolar
</button>

            <button onclick="abrirEditorMasivo()" class="text-xs hover:text-white transition" title="Editar Género/Carátula"><i class="fa-solid fa-tags"></i> Editar</button>
            <button onclick="addBatchToPlaylist()" class="text-xs hover:text-white transition"><i class="fa-solid fa-list-ul"></i> Playlist</button>
            <button id="batch-remove-playlist" onclick="removeBatchFromPlaylist()" class="text-xs hover:text-white transition hidden"><i class="fa-solid fa-list-check"></i> Quitar</button>
            <button onclick="confirmarBorradoMasivo()" class="text-xs font-bold text-red-400 hover:text-red-300 transition"><i class="fa-solid fa-trash-can"></i> BORRAR</button>
            <button onclick="cancelSelection()" class="w-6 h-6 rounded-full bg-emerald-700 hover:bg-emerald-600 flex items-center justify-center ml-2"><i class="fa-solid fa-xmark text-[10px]"></i></button>
        </div>
<!-- REEMPLAZAR esta sección del player-bar -->

<div id="player-bar" class="fixed bottom-0 left-0 right-0 z-[200] hidden bg-[#020202] border-t border-emerald-500/30 shadow-[0_-5px_30px_rgba(16,185,129,0.1)] transition-transform duration-300 md:ml-64 group">
    
    <canvas id="visualizer" class="absolute inset-0 w-full h-full opacity-20 mix-blend-screen pointer-events-none z-0"></canvas>
    <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500/0 via-emerald-500/50 to-emerald-500/0 opacity-50"></div>

    <div class="md:hidden w-full p-3 space-y-3 relative z-10">
        <div class="flex items-center gap-3">
            <div onclick="openFullScreenPlayer()" class="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-emerald-500/30 cursor-pointer">
                <img id="player-cover" src="" class="w-full h-full object-cover" onerror="this.style.display='none';">
                <div id="player-fallback" class="absolute inset-0 hidden items-center justify-center bg-zinc-900"><i class="fa-solid fa-music text-emerald-500/50"></i></div>
            </div>
            <div class="min-w-0 flex-1">
                <h4 id="player-title" class="text-xs font-bold text-white truncate">Sin título</h4>
                <p id="player-artist" class="text-[10px] text-emerald-500 truncate">KRAKEN SYSTEM</p>
            </div>
            <button onclick="toggleFavorite()" id="btn-like-player" class="text-zinc-600 px-2 transition"><i class="fa-regular fa-heart"></i></button>
            <button onclick="toggleLyrics()" class="text-zinc-600 px-2 transition"><i class="fa-solid fa-microphone-lines"></i></button>
            <button onclick="toggleQueue()" class="text-zinc-500 hover:text-emerald-400 transition relative">
    <i class="fa-solid fa-list-ul"></i>
    <span id="queue-count" class="absolute -top-1 -right-1 bg-emerald-500 text-black text-[9px] font-bold px-1.5 rounded-full hidden">0</span>
</button>
            <button onclick="cerrarPlayer()" class="text-zinc-600 px-2"><i class="fa-solid fa-chevron-down"></i></button>
        </div>
        <div class="flex items-center justify-center gap-6">
            <button onclick="toggleShuffle()" id="btn-shuffle" class="text-zinc-500 hover:text-emerald-400 transition"><i class="fa-solid fa-shuffle"></i></button>
            <button onclick="playPrevious()" class="text-zinc-300 hover:text-white"><i class="fa-solid fa-backward-step"></i></button>
            <button onclick="togglePlay()" id="btn-play" class="w-10 h-10 bg-emerald-500 text-black rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.6)]"><i class="fa-solid fa-play ml-0.5 text-sm"></i></button>
            <button onclick="playNext()" class="text-zinc-300 hover:text-white"><i class="fa-solid fa-forward-step"></i></button>
            <button onclick="toggleLoop()" id="btn-loop" class="text-zinc-500 hover:text-emerald-400 transition"><i class="fa-solid fa-repeat"></i></button>
        </div>
        <div class="flex items-center gap-2 px-1">
            <span id="time-current" class="text-[9px] text-emerald-500/80 font-mono w-8 text-right">0:00</span>
            <input type="range" id="prog-bar" value="0" min="0" step="0.1" class="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500" oninput="seekAudio()">
            <span id="time-total" class="text-[9px] text-emerald-500/80 font-mono w-8">0:00</span>
        </div>
    </div>

    <div class="hidden md:flex md:justify-between md:items-center md:h-24 md:px-6 w-full relative z-10">
        <div class="flex items-center gap-4 w-[30%] min-w-0">
            <div onclick="openFullScreenPlayer()" class="relative w-14 h-14 rounded overflow-hidden shrink-0 border border-emerald-500/20 bg-black cursor-pointer group/cover shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                <img id="player-cover-desktop" src="" class="w-full h-full object-cover transition-transform duration-700 group-hover/cover:scale-110" onerror="this.style.display='none';">
                <div id="player-fallback-desktop" class="absolute inset-0 hidden items-center justify-center"><i class="fa-solid fa-radiation text-emerald-900 text-2xl animate-pulse"></i></div>
                <div class="absolute inset-0 bg-emerald-900/80 hidden group-hover/cover:flex items-center justify-center backdrop-blur-sm"><i class="fa-solid fa-expand text-emerald-400"></i></div>
            </div>
            <div class="min-w-0 overflow-hidden">
                <h4 id="player-title-desktop" class="text-sm font-bold text-white truncate">KRAKEN SYSTEM</h4>
                <p id="player-artist-desktop" class="text-[10px] text-emerald-500 font-mono tracking-widest truncate opacity-80">READY</p>
            </div>
            <button onclick="toggleFavorite()" id="btn-like-player-desktop" class="ml-2 text-zinc-600 hover:text-emerald-400 transition rounded-full p-2">
                <i class="fa-regular fa-heart"></i>
            </button>
            <button onclick="toggleLyrics()" id="btn-lyrics-bar" class="text-zinc-400 hover:text-emerald-400 transition p-2" title="Ver Letra">
                <i class="fa-solid fa-microphone-lines"></i>
            </button>
        </div>

        <div class="flex flex-col items-center justify-center w-[40%] gap-2">
            <div class="flex items-center gap-8">
                <button onclick="toggleShuffle()" id="btn-shuffle-desktop" class="text-zinc-600 hover:text-emerald-400 transition"><i class="fa-solid fa-shuffle text-xs"></i></button>
                
                <button onclick="playPrevious()" class="text-zinc-300 hover:text-white hover:scale-110 transition"><i class="fa-solid fa-backward-step text-xl"></i></button>
                <button onclick="togglePlay()" id="btn-play-desktop" class="w-12 h-12 bg-emerald-500 text-black rounded-full flex items-center justify-center hover:scale-105 transition shadow-[0_0_25px_rgba(16,185,129,0.5)]"><i class="fa-solid fa-play ml-1 text-lg"></i></button>
                <button onclick="playNext()" class="text-zinc-300 hover:text-white hover:scale-110 transition"><i class="fa-solid fa-forward-step text-xl"></i></button>
                
                <button onclick="toggleLoop()" id="btn-loop-desktop" class="text-zinc-600 hover:text-white transition"><i class="fa-solid fa-repeat text-xs"></i></button>
            </div>
            <div class="w-full flex items-center gap-3">
                <span id="time-current-desktop" class="text-[10px] text-emerald-500/70 font-mono w-10 text-right">0:00</span>
                <input type="range" id="prog-bar-desktop" value="0" min="0" step="0.1" class="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500" oninput="seekAudio()">
                <span id="time-total-desktop" class="text-[10px] text-zinc-600 font-mono w-10">0:00</span>
            </div>
        </div>

        <div class="flex justify-end items-center gap-4 w-[30%]">
            <div class="flex items-center gap-2 group/vol">
                <button onclick="toggleMute()" id="btn-vol-desktop" class="text-zinc-400 hover:text-emerald-400 w-6 text-right"><i class="fa-solid fa-volume-high text-xs"></i></button>
                <input type="range" id="vol-slider-desktop" min="0" max="1" step="0.05" value="1" class="w-24 h-1 bg-zinc-800 rounded-lg cursor-pointer accent-emerald-500 opacity-60 group-hover/vol:opacity-100 transition" oninput="setVolume(this.value)">
            </div>
            <div class="h-8 w-px bg-white/5 mx-2"></div>
            <button onclick="toggleQueue()" class="text-zinc-400 hover:text-emerald-400 transition relative p-2">
                <i class="fa-solid fa-list-ul"></i>
                <span id="queue-count" class="absolute -top-1 -right-1 bg-emerald-500 text-black text-[9px] font-bold px-1.5 rounded-full hidden">0</span>
            </button>
            <button onclick="cerrarPlayer()" class="text-zinc-600 hover:text-red-500 transition p-2"><i class="fa-solid fa-chevron-down"></i></button>
        </div>
    </div>
</div>
 
<div id="queue-panel" class="fixed right-0 top-0 h-full w-80 bg-[#0a0a0a]/98 backdrop-blur-2xl border-l border-white/10 shadow-2xl transform translate-x-full transition-transform duration-300 z-[9999] flex flex-col">
        <div class="p-5 border-b border-white/5 flex justify-between items-center bg-white/5"><div><h3 class="font-bold text-white text-sm">Cola</h3></div><button onclick="toggleQueue()" class="text-emerald-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button></div>
        <div class="flex-1 overflow-y-auto custom-scroll" id="queue-list"></div>
        <div class="p-4 border-t border-white/5 text-center"><button onclick="clearQueue()" class="text-[10px] font-bold text-red-400 hover:text-red-300 uppercase tracking-wider">Limpiar Todo</button></div>
    </div>

    <!-- 👇 AGREGAR AQUÍ EL FULLSCREEN PLAYER -->
    <div id="fullscreen-player" class="hidden fixed inset-0 z-[9999] bg-black flex items-center justify-center">
    
    <!-- Fondo blur con la carátula -->
    <div id="fp-bg" class="absolute inset-0 bg-cover bg-center blur-3xl opacity-20"></div>
    
    <!-- Contenido principal -->
    <div class="relative z-10 w-full max-w-md px-6 flex flex-col items-center">
        
        <!-- Botón cerrar (arriba) -->
        <button onclick="closeFullScreenPlayer()"
        class="md:hidden fixed top-4 left-4 z-[10000]
               w-10 h-10 rounded-full
               bg-black/70 backdrop-blur
               border border-emerald-500/40
               flex items-center justify-center
               text-emerald-400
               shadow-[0_0_20px_rgba(16,185,129,0.4)]
               active:scale-95 transition">
    <i class="fa-solid fa-chevron-left"></i>
</button>
        <button onclick="closeFullScreenPlayer()" 
                class="absolute top-6 right-6 w-10 h-10 bg-black/50 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-black/70 transition">
            <i class="fa-solid fa-chevron-down"></i>
        </button>
        
        <div class="relative w-80">

    <!-- PESTAÑA KRAKEN -->
    
    <div id="fp-header"
         class="absolute -top-8 left-4 right-4 z-20 flex items-center gap-2 px-6 py-2
                bg-black/85 backdrop-blur-md
                text-[10px] font-bold tracking-widest uppercase
                shadow-[0_0_30px_rgba(16,185,129,0.45)]
                border-t border-l border-r border-emerald-500/60
                clip-kraken-full">
        <i class="fa-solid fa-play text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.9)]"></i>
        <span class="text-white">KRAKEN</span>
        <span class="opacity-40 text-white">•</span>
        <span class="text-emerald-400 align-right">Reproduciendo</span>

        
    </div>

    <!-- CARÁTULA -->
   <div class="relative w-80 h-80 rounded-2xl overflow-hidden shadow-2xl mb-8 group">
        <img id="fp-cover"
             src=""
             class="w-full h-full object-cover">
        
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60"></div>

        <button onclick="event.stopPropagation(); generarTarjeta()" 
                class="absolute top-3 right-3 z-30 
                       w-10 h-10 rounded-full 
                       bg-black/40 hover:bg-purple-600 backdrop-blur-md 
                       border border-white/20 hover:border-purple-400
                       text-white flex items-center justify-center 
                       shadow-lg hover:shadow-purple-500/50 hover:scale-110 
                       transition-all duration-300 cursor-pointer"
                title="Compartir en Instagram">
            <i class="fa-brands fa-instagram text-lg"></i>
        </button>
    </div></div>
        
        <!-- Info de la canción -->
        <div class="text-center mb-8 w-full">
            <h2 id="fp-title" class="text-2xl md:text-3xl font-bold text-white mb-2 truncate">
                KRAKEN SYSTEM
            </h2>
            <p id="fp-artist" class="text-lg text-emerald-400 truncate">
                Ready to play
            </p>
        </div>
        
        <!-- Barra de progreso -->
        <div class="w-full flex items-center gap-3 mb-6 text-white text-xs font-mono">
            <span id="fp-time-current">0:00</span>
            <input type="range" 
                   id="fp-prog" 
                   value="0" 
                   min="0" 
                   step="0.1"
                   class="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                   oninput="seekAudio(event)">
            <span id="fp-time-total">0:00</span>
        </div>
        
        <!-- Controles de reproducción -->
        <div class="flex items-center justify-center gap-8 mb-6">
            <button onclick="toggleShuffle()" id="fp-shuffle" class="text-zinc-500 hover:text-emerald-400 transition">
                <i class="fa-solid fa-shuffle text-xl"></i>
            </button>
            
            <button onclick="playPrevious()" class="text-white/80 hover:text-white hover:scale-110 transition">
                <i class="fa-solid fa-backward-step text-3xl"></i>
            </button>
            
            <button onclick="togglePlay()" id="fp-play" 
                    class="w-16 h-16 bg-emerald-500 text-black rounded-full flex items-center justify-center hover:scale-105 transition shadow-xl">
                <i class="fa-solid fa-play ml-1 text-2xl"></i>
            </button>
            
            <button onclick="playNext()" class="text-white/80 hover:text-white hover:scale-110 transition">
                <i class="fa-solid fa-forward-step text-3xl"></i>
            </button>
            
            <button onclick="toggleLoop()" id="fp-loop" class="text-zinc-500 hover:text-white transition">
                <i class="fa-solid fa-repeat text-xl"></i>
            </button>
        </div>
        
        <!-- Controles secundarios -->
        <div class="flex items-center gap-6">
            <button onclick="toggleFavorite()" id="fp-like" class="text-zinc-600 hover:text-emerald-400 transition">
                <i class="fa-regular fa-heart text-2xl"></i>
            </button>
            
            <button onclick="toggleQueue()" class="text-zinc-500 hover:text-emerald-400 transition">
                <i class="fa-solid fa-list-ul text-xl"></i>
            </button>
            
            <div class="flex items-center gap-2">
                <button onclick="toggleMute()" id="fp-vol" class="text-zinc-500 hover:text-emerald-400">
                    <i class="fa-solid fa-volume-high"></i>
                </button> 
                <input type="range" 
                       id="fp-vol-slider" 
                       min="0" 
                       max="1" 
                       step="0.05" 
                       value="1"
                       class="w-20 h-1 bg-white/20 rounded-lg cursor-pointer accent-emerald-500"
                       oninput="setVolume(this.value)">
            </div>
        </div>
        
    </div>
</div>

    
    <div id="playlist-modal" class="fixed inset-0 z-[120] bg-black/80 hidden flex items-center justify-center p-4 backdrop-blur-sm"><div class="bg-[#0f172a] p-6 rounded-2xl w-full max-w-sm border border-emerald-700 shadow-2xl"><h3 class="font-bold text-lg mb-4 text-emerald-400">Añadir a Playlist</h3><div id="playlist-options" class="space-y-1 max-h-60 overflow-y-auto mb-4 custom-scroll"></div><button onclick="closePlaylistModal()" class="w-full bg-emerald-800 py-3 rounded-xl text-xs font-bold hover:bg-emerald-700 transition">Cancelar</button></div></div>
    <div id="edit-modal" class="fixed inset-0 z-[125] bg-black/90 hidden flex items-center justify-center p-4 backdrop-blur-md"><div class="bg-[#0f172a] p-6 rounded-2xl w-full max-w-md border border-emerald-700 shadow-2xl"><h3 class="font-bold text-lg mb-4 text-emerald-400 flex items-center gap-2"><i class="fa-solid fa-pen-to-square"></i> <span id="edit-modal-title">Editar</span></h3><div class="space-y-3 mb-6" id="edit-fields"></div><div class="flex gap-2"><button onclick="document.getElementById('edit-modal').classList.add('hidden')" class="flex-1 bg-emerald-800 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 transition">Cancelar</button><button onclick="guardarCambiosEdicion()" class="flex-1 bg-emerald-600 py-2 rounded-xl text-xs font-bold text-white hover:bg-emerald-500 transition shadow-lg">Guardar Cambios</button></div></div></div>
    <div id="move-modal" class="fixed inset-0 z-[120] bg-black/80 hidden flex items-center justify-center p-4 backdrop-blur-sm"><div class="bg-[#0f172a] p-6 rounded-2xl w-full max-w-sm border border-emerald-700 shadow-2xl"><h3 class="font-bold text-lg mb-4 text-emerald-400 flex items-center gap-2"><i class="fa-solid fa-folder-tree"></i> Mover archivo</h3><div id="folder-list-modal" class="space-y-1 max-h-60 overflow-y-auto mb-4 custom-scroll"></div><button onclick="document.getElementById('move-modal').classList.add('hidden')" class="w-full bg-emerald-800 py-3 rounded-xl text-xs font-bold hover:bg-emerald-700 transition">Cancelar</button></div></div>
    <div id="info-modal" class="fixed inset-0 z-[130] bg-black/80 hidden flex items-center justify-center p-4 backdrop-blur-sm"><div class="bg-[#0f172a] p-6 rounded-2xl w-full max-w-sm border border-emerald-700 shadow-2xl relative"><h3 class="font-bold text-lg mb-2 text-emerald-400" id="info-title">Info</h3><div id="info-content" class="text-xs text-emerald-300 max-h-60 overflow-y-auto custom-scroll mb-4 space-y-1"></div><button onclick="document.getElementById('info-modal').classList.add('hidden')" class="w-full bg-emerald-800 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 transition">Entendido</button></div></div>
<div id="share-card-container" class="fixed top-0 left-0 w-0 h-0 overflow-hidden -z-50 pointer-events-none opacity-0">
    <div id="share-card" class="w-[380px] h-[600px] bg-gray-900 relative overflow-hidden flex flex-col items-center justify-center text-center p-8 border border-white/10 font-sans">
        
        <div id="card-bg" class="absolute inset-0 bg-cover bg-center opacity-40 blur-xl scale-125 z-0" style="background-image: url('/static/default_cover.jpg');"></div>
        <div class="absolute inset-0 bg-gradient-to-b from-black/20 via-black/60 to-black/90 z-10"></div>

        <div class="relative z-20 flex flex-col items-center w-full">
            
            <div class="mb-8 flex items-center gap-2 opacity-90">
                <i class="fa-solid fa-music text-emerald-400 text-lg"></i>
                <span class="text-white font-bold tracking-[0.3em] text-xs">🐙 KRAKEN OS</span>
            </div>

            <div class="w-72 h-72 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] mb-8 relative group border border-white/10 overflow-hidden">
                
                <div id="card-cover-bg" 
                     class="w-full h-full bg-cover bg-center bg-no-repeat transition-all duration-500"
                     style="background-image: url('/static/default_cover.jpg');">
                </div>

                <div class="absolute inset-0 bg-white/5 rounded-xl"></div>
            </div>
            <div class="w-full px-4 text-center z-30 mt-4">
                
                <h1 id="card-title" 
                    class="text-2xl font-black text-white mb-1 leading-normal drop-shadow-lg overflow-hidden max-h-24 pb-1"
                    style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                    Canción
                </h1>
                
                <p id="card-artist" 
                   class="text-lg text-emerald-400 font-medium drop-shadow-md overflow-hidden max-h-16 pb-1"
                   style="display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;">
                   Artista
                </p>

                <div id="card-lyrics-wrap" class="hidden mt-5 p-4 rounded-xl border border-emerald-500/20 bg-black/35 backdrop-blur-sm text-left">
                    <p id="card-lyric-prev" class="text-xs text-white/45 leading-relaxed">&nbsp;</p>
                    <p id="card-lyric-current" class="text-base text-emerald-300 font-bold leading-relaxed drop-shadow-[0_0_10px_rgba(16,185,129,0.45)]">&nbsp;</p>
                    <p id="card-lyric-next" class="text-xs text-white/60 leading-relaxed">&nbsp;</p>
                    <p id="card-lyric-time" class="mt-2 text-[10px] text-emerald-400/80 font-mono tracking-widest uppercase">LIVE LYRIC</p>
                </div>
            </div>
            <div class="w-full mt-8">
                <div class="w-full h-1 bg-white/20 rounded-full overflow-hidden mb-1">
                    <div class="w-2/3 h-full bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]"></div>
                </div>
                <div class="flex justify-between w-full text-[10px] text-gray-400 font-mono uppercase tracking-widest">
                    <span>Playing</span>
                    <span class="text-emerald-500">krak.en</span>
                </div>
            </div>

        </div>
    </div>
</div>
    <script>
    
    
// ==================== CONFIGURACIÓN DE IDENTIDAD ====================
   // ==================== CONFIGURACIÓN DE IDENTIDAD ====================
    let MY_SESSION_ID = localStorage.getItem('kraken_sid');
    if (!MY_SESSION_ID) {
        MY_SESSION_ID = 'sess_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('kraken_sid', MY_SESSION_ID);
    }

    let MY_NAME = localStorage.getItem('kraken_user');

    // ⛔ BUCLE DE SEGURIDAD: Mientras no escriba nada, se lo vuelve a pedir
    while (!MY_NAME || MY_NAME.trim() === "" || MY_NAME === "null") {
        MY_NAME = prompt(`👾 KRAKEN OS\n\n⚠️ ACCESO DENEGADO ⚠️\n\nNecesitas un nombre para entrar.\n¿Quién eres?`);
        
        // Si le da "Cancelar", prompt devuelve null, así que el bucle se repite.
    }
    
    // Si llegó aquí, es porque ya puso un nombre válido
    localStorage.setItem('kraken_user', MY_NAME);

    let IS_SPEAKER = localStorage.getItem('kraken_is_speaker') !== 'false'; 
    // ====================================================================

    async function activarModoRadio() {
    console.log("🎧 Iniciando Radio Inteligente...");
    
    // 1. Verificamos biblioteca
    if (!window.libData || !window.libData.files || window.libData.files.length === 0) {
        showToast("❌ No hay biblioteca cargada.", "error");
        return;
    }

    // 2. Filtramos solo audio
    const audios = window.libData.files.filter(f => f.type === 'audio');
    
    if (audios.length === 0) {
        showToast("No hay música.", "error");
        return;
    }

    // 🎯 MODO INTELIGENTE: Si hay una canción sonando, buscar similares
    let playlistRadio = [];
    const LIMITE_RADIO = 50;
    
    // Si hay una canción actual, buscar similares desde el servidor
    if (playerQueue.length > 0 && currentTrackIndex >= 0) {
        const cancionActual = playerQueue[currentTrackIndex];
        
        if (cancionActual && cancionActual.path) {
            try {
                console.log(`🔍 Buscando similares a: ${cancionActual.title}`);
                showToast("🎵 Analizando gustos musicales...", "info");
                
                const encodedPath = encodeURIComponent(cancionActual.path);
                const response = await fetch(`/similar/${encodedPath}`);
                const data = await response.json();
                
                if (data.similares && data.similares.length > 0) {
                    console.log(`✨ Encontradas ${data.similares.length} canciones similares`);
                    
                    // Convertir paths a objetos completos
                    playlistRadio = data.similares
                        .map(path => audios.find(a => a.path === path))
                        .filter(a => a !== undefined)
                        .slice(0, LIMITE_RADIO);
                    
                    showToast(`✨ Radio Inteligente: ${playlistRadio.length} canciones similares`, "success");
                } else {
                    // Fallback a aleatorio
                    console.log("⚠️ No hay similares suficientes, modo aleatorio");
                    playlistRadio = generarRadioAleatorio(audios, LIMITE_RADIO);
                    showToast(`🎲 Radio Aleatoria: ${playlistRadio.length} canciones`, "info");
                }
                
            } catch (error) {
                console.error("Error obteniendo similares:", error);
                // Fallback a aleatorio
                playlistRadio = generarRadioAleatorio(audios, LIMITE_RADIO);
                showToast(`🎲 Radio Aleatoria: ${playlistRadio.length} canciones`, "info");
            }
        } else {
            // No hay canción actual válida, modo aleatorio
            playlistRadio = generarRadioAleatorio(audios, LIMITE_RADIO);
            showToast(`🎲 Radio Aleatoria: ${playlistRadio.length} canciones`, "info");
        }
    } else {
        // No hay cola, modo aleatorio
        playlistRadio = generarRadioAleatorio(audios, LIMITE_RADIO);
        showToast(`🎲 Radio Aleatoria: ${playlistRadio.length} canciones`, "info");
    }

    // 3. Asignamos la cola
    if (playlistRadio.length > 0) {
        playerQueue = playlistRadio; 
        currentTrackIndex = 0; 
        updateQueueUI();
        playTrack(playerQueue[0]);
        console.log(`✅ Cola lista con ${playlistRadio.length} canciones`);
    } else {
        showToast("❌ No se pudo generar la radio", "error");
    }
}

// Función auxiliar para generar radio aleatorio (fallback)
function generarRadioAleatorio(audios, limite) {
    let playlistRadio = [];
    let indicesUsados = new Set();
    
    const cantidadTotal = audios.length;
    const cantidadAUsar = Math.min(limite, cantidadTotal);

    while (playlistRadio.length < cantidadAUsar) {
        let r = Math.floor(Math.random() * cantidadTotal);
        if (!indicesUsados.has(r)) {
            indicesUsados.add(r);
            playlistRadio.push(audios[r]);
        }
    }
    
    return playlistRadio;
}

        let discografiaPath = ""; // Nueva variable para tracking de navegación
        let libData = {files:[], folders:[], artist_tree:{}, playlists:{}, genres:[], smart_mixes:[]};
        let downloadList = []; 
        let filters = {folder:'all', artist:'all', album:'all', rating:'all', playlist:'all', genre:'all', sort:'default'}; 
        const defaults = {folder:'all', artist:'all', album:'all', rating:'all', playlist:'all', genre:'all', sort:'default'};
        let selectedDownloadIndices = new Set(); // Guardará los índices de lo que SI queremos bajar
        let currentLibrary = 'audio';
        let currentView = 'library'; // 'library', 'folders', 'history', etc.
        let currentArtistTracks = [];
        let customMixes = {};
        let currentFolderView = null;
        let fileToMove = null; let fileToPlaylist = null;
        let currentPath = "";
let renderLimit = 100;
let renderStep = 100;
let renderTimeout = null; // ← AGREGAR ESTO
let lastFilters = null;   // ← AGREGAR ESTO (para optimización futura)
        let playerQueue = []; let currentTrackIndex = -1; let isShuffleOn = false; let loopMode = 'off';
        let audioElement = null; let viewMode = localStorage.getItem('vortex_view') || 'list'; 
        let selectionMode = false; let selectedFiles = new Set();
        const zoomLevels = [
    'grid-cols-6 md:grid-cols-8',  // 0 = Más pequeño
    'grid-cols-4 md:grid-cols-6',  // 1 = Mediano
    'grid-cols-3 md:grid-cols-4'   // 2 = Más grande
];
        let currentZoomIndex = 0;
        let audioCtx, analyser, source, canvas, canvasCtx;
        let isVisualizerInit = false;
        let discografiaMode = false;


        let imageObserver = null;



        
function initLazyLoader() {
    if ('IntersectionObserver' in window && !imageObserver) {
        imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src && !img.src) {
                        img.src = img.dataset.src;
                        img.classList.add('loaded'); // Clase opcional para CSS
                        imageObserver.unobserve(img); // ✅ Dejar de observar cuando carga
                    }
                }
            });
        }, {
            rootMargin: '50px' // ✅ Cargar 50px antes de que entre en pantalla
        });
    }
}

function observeLazyImages() {
    if (!imageObserver) return;
    
    document.querySelectorAll('.lazy-img').forEach(img => {
        // ✅ Solo observar si NO tiene src y NO está ya siendo observada
        if (img.dataset.src && !img.src && !img.classList.contains('loaded')) {
            imageObserver.observe(img);
        }
    });
}

  function initApp() {
    // A) CONFIGURAR AUDIO
    audioElement = document.getElementById('main-audio');
    
    audioElement.addEventListener('ended', onTrackEnded);
    audioElement.addEventListener('timeupdate', updateProgress);

    // Sincronizar iconos
    audioElement.addEventListener('play', () => { 
        const icons = ['#btn-play i', '#btn-play-desktop i', '#fp-play i'];
        icons.forEach(selector => {
            const el = document.querySelector(selector);
            if(el) el.className = 'fa-solid fa-pause';
        });
        initVisualizer(); 
    });

    audioElement.addEventListener('pause', () => { 
        const icons = ['#btn-play i', '#btn-play-desktop i', '#fp-play i'];
        icons.forEach(selector => {
            const el = document.querySelector(selector);
            if(el) el.className = 'fa-solid fa-play ml-0.5';
        });
    });

    audioElement.addEventListener('loadedmetadata', () => { 
        const bars = ['prog-bar', 'prog-bar-desktop', 'fp-prog'];
        bars.forEach(id => {
            const el = document.getElementById(id);
            if(el) el.max = audioElement.duration;
        });
    });

    // B) RECUPERAR VOLUMEN
    const savedVol = localStorage.getItem('vortex_vol'); 
    if(savedVol) { 
        setVolume(parseFloat(savedVol)); 
        const sliders = ['vol-slider', 'vol-slider-desktop'];
        sliders.forEach(id => {
            const el = document.getElementById(id);
            if(el) el.value = savedVol;
        });
    }

    // C) ATAJOS DE TECLADO
    document.addEventListener('keydown', (e) => { 
        if(e.target.tagName === 'INPUT') return; 
        if(e.code === 'Space') { e.preventDefault(); togglePlay(); } 
        if(e.code === 'ArrowRight') { e.preventDefault(); playNext(); } 
        if(e.code === 'ArrowLeft') { e.preventDefault(); playPrevious(); } 
    });

    // D) BUCLE PRINCIPAL (RADAR + ALEXA + DESCARGAS + SYNC)
    const loop = setInterval(async () => { 
        try {
            // --- 1. RADAR DE USUARIOS ---
            const titleEl = document.getElementById('player-title');
            const artistEl = document.getElementById('player-artist');
            
            // 1. CAMBIO: Forzamos 'true' para que siempre se vea como reproductor
            const params = new URLSearchParams({
                sid: MY_SESSION_ID,
                user: MY_NAME,
                is_speaker: 'true', // <--- AQUÍ ESTÁ LA DIFERENCIA (Mejor ponle 'true')
                song: titleEl ? titleEl.innerText : '',
                artist: artistEl ? artistEl.innerText : '',
                time: audioElement ? audioElement.currentTime : 0,
                duration: audioElement ? audioElement.duration : 0
            });

            const res = await fetch(`/status?${params.toString()}`); 
            const d = await res.json(); 

            if (d.online_users) {
                drawUserRadar(d.online_users);
            }
            // --- 2. ALEXA ---
            const cmd = d.last_command; 
            if (typeof window.lastProcessedTime === 'undefined') window.lastProcessedTime = 0;

            if (cmd && cmd.time > window.lastProcessedTime) {
                const now = Date.now() / 1000;
                if (now - cmd.time < 60) {
                    console.log("🔥 COMANDO:", cmd);
                    window.lastProcessedTime = cmd.time; 
                    if (cmd.action === 'play_mix') {
                        activarModoRadio();
                        showToast("🤖 Alexa: Modo Radio", "success");
                    }
                }
            }

            // --- 2.5 REMOTE CONTROL (EL TITIRITERO) ---
            if (d.remote_command) {
                console.log("🎮 ORDEN REMOTA:", d.remote_command);
                showToast(`🎮 Comando: ${d.remote_command}`, "info");
                // Emojis
                if (d.remote_command.startsWith('emoji_')) {
                    // Extraemos el emoji (quitamos "emoji_")
                    const emojiIcon = d.remote_command.split('_')[1];
                    showEmojiModal(emojiIcon); // ¡Lanzamos el modal!
                    showToast("¡Mensaje Recibido!", "success");
                }

                // Controles de Reproducción
                if (d.remote_command === 'pause') togglePlay();
                if (d.remote_command === 'play') { 
                    audioElement.play().catch(e => console.log(e)); 
                    updatePlayIcons(true);
                }
                if (d.remote_command === 'next') playNext();
                if (d.remote_command === 'prev') playPrevious();

                // 👇👇👇 ESTO ES LO QUE TE FALTA AGREGAR (VOLUMEN) 👇👇👇
                if (d.remote_command === 'vol_up') {
                    // Subimos 10%
                    const newVol = Math.min(1, audioElement.volume + 0.1);
                    setVolume(newVol); 
                }
                if (d.remote_command === 'vol_down') {
                    // Bajamos 10%
                    const newVol = Math.max(0, audioElement.volume - 0.1);
                    setVolume(newVol); 
                }
                // 👆👆👆 FIN DE LO NUEVO 👆👆👆
            }

            // --- 3. DESCARGAS ---
            if (d.failed) {
                clearInterval(loop);
                const bar = document.getElementById('dl-progress');
                if(bar) bar.classList.add('hidden');
                showToast(d.details || "Error descarga", "error");
                return;
            }

            const dlBar = document.getElementById('dl-progress');
            if(d.active) { 
                if(dlBar) dlBar.classList.remove('hidden'); 
                const pEl = document.getElementById('dl-percent');
                const fEl = document.getElementById('dl-filename');
                const bEl = document.getElementById('dl-bar');

                if(pEl) pEl.innerText = d.percent; 
                if(fEl) fEl.innerText = d.filename; 
                if(bEl) bEl.style.width = d.percent; 
            } else if(d.percent === "100%") { 
                if(dlBar) dlBar.classList.add('hidden'); 
                const pEl = document.getElementById('dl-percent');
                if(pEl && pEl.innerText !== '100%') { 
                    cargarLib(); 
                    cargarHistorial(); 
                } 
            } 
        } catch (error) {
            console.error("Error en bucle:", error);
        }
    }, 2000);

    // E) INICIALIZACIÓN FINAL
    ver('library'); 
    setView(viewMode);
    
    if (typeof initLazyLoader === 'function') {
        initLazyLoader(); 
    }   
    
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('main-sidebar');
        const menuBtn = document.querySelector('.mobile-menu-btn');
        if (sidebar && menuBtn && !sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
            sidebar.classList.remove('mobile-open');
        }
    });
}      
        
        function toggleMobileMenu() {
            document.getElementById('sidebar').classList.toggle('mobile-open');
        }


function initVisualizer() { 
    if(isVisualizerInit) return; 
    
    try { 
        audioCtx = new (window.AudioContext || window.webkitAudioContext)(); 
        analyser = audioCtx.createAnalyser(); 
        source = audioCtx.createMediaElementSource(audioElement); 
        source.connect(analyser); 
        analyser.connect(audioCtx.destination); 
        analyser.fftSize = 256; // ← Más barras = más detalle
        
        canvas = document.getElementById("visualizer"); 
        canvasCtx = canvas.getContext("2d");
        
        // ✅ CONFIGURACIÓN HD: Ajustar al tamaño real del contenedor
        function resizeCanvas() {
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            
            canvasCtx.scale(dpr, dpr);
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
        }
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        isVisualizerInit = true; 
        drawVisualizer(); 
    } catch(e) { 
        console.log("Audio Context Error: " + e); 
    } 
}

function drawVisualizer() { 
    // Validaciones de seguridad
    if (!analyser) return;
    if (!isVisualizerInit || !canvas) return;
    
    // Bucle de animación
    requestAnimationFrame(drawVisualizer); 
    
    // Obtener datos de frecuencia
    const bufferLength = analyser.frequencyBinCount; 
    const dataArray = new Uint8Array(bufferLength); 
    analyser.getByteFrequencyData(dataArray); 
    
    // Dimensiones
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);
    
    // Limpiar el canvas antes de dibujar el nuevo frame
    canvasCtx.clearRect(0, 0, width, height); 
    
    // Configuración de las barras
    const barWidth = (width / bufferLength) * 2.5; 
    let x = 0; 
    
    // 🔥 EFECTO GLOW (NEÓN) ACTIVADO
    // Esto crea el halo brillante alrededor de las barras
    canvasCtx.shadowBlur = 30;       // Intensidad del brillo
    canvasCtx.shadowColor = '#10b981'; // Color del brillo (Esmeralda)
    
    for(let i = 0; i < bufferLength; i++) { 
        // Calcular altura de la barra (usando toda la altura disponible)
        const barHeight = (dataArray[i] / 255) * height; 
        
        // 🎨 GRADIENTE VORTEX (Luz Menta a Base Oscura)
        const gradient = canvasCtx.createLinearGradient(0, height - barHeight, 0, height);
        gradient.addColorStop(0, '#6ee7b7');   // Punta: Verde Menta (Muy brillante)
        gradient.addColorStop(0.5, '#10b981'); // Medio: Esmeralda Vívido
        gradient.addColorStop(1, '#064e3b');   // Base: Verde muy oscuro (casi negro)
        
        canvasCtx.fillStyle = gradient; 
        
        // Dibujamos la barra con esquinas superiores redondeadas
        canvasCtx.beginPath();
        if (canvasCtx.roundRect) {
            canvasCtx.roundRect(x, height - barHeight, barWidth - 2, barHeight, [4, 4, 0, 0]);
        } else {
            // Fallback por si el navegador es muy viejo
            canvasCtx.rect(x, height - barHeight, barWidth - 2, barHeight);
        }
        canvasCtx.fill();
        
        x += barWidth; 
    } 
    
    // Limpiamos el shadowBlur al final por seguridad
    canvasCtx.shadowBlur = 0;
}
        function openFullScreenPlayer() { document.getElementById('full-player').classList.remove('hidden'); document.getElementById('full-player').classList.add('flex'); const fpTitle = document.getElementById('fp-title'); const fpArtist = document.getElementById('fp-artist'); const fpCover = document.getElementById('fp-cover'); fpTitle.innerText = document.getElementById('player-title').innerText; fpArtist.innerText = document.getElementById('player-artist').innerText; fpCover.src = document.getElementById('player-cover').src; }
        function closeFullScreenPlayer() { document.getElementById('full-player').classList.add('hidden'); document.getElementById('full-player').classList.remove('flex'); }

function goHome() { 
    window.currentAlbumPath = null; // 👈 AGREGAR
    currentView = 'library'; 
    currentExplorerPath = ''; // Limpiamos la ruta del explorador también
    // 👆👆
    
    filters = {...defaults}; 
    currentFolderView = null; 
    currentPath = "";
    
    filters = {...defaults}; 
    currentFolderView = null; 
    currentPath = "";
    filters = {...defaults}; 
    currentFolderView = null; 
    currentPath = "";
    
    // Ocultar elementos si existen
    const btnBack = document.getElementById('btn-back-folder');
    if (btnBack) btnBack.classList.add('hidden');
    
    const hero = document.getElementById('artist-hero');
    if (hero) hero.classList.add('hidden');
    
    // Actualizar títulos DESKTOP Y MÓVIL
    const titleDesktop = document.getElementById('lib-title-desktop');
    const titleMobile = document.getElementById('lib-title-mobile');
    const newTitle = currentLibrary === 'audio' ? "Mi Música" : "Mis Series y Videos";
    
    if (titleDesktop) titleDesktop.innerText = newTitle;
    if (titleMobile) titleMobile.innerText = newTitle;
    
    // Limpiar chips DESKTOP
    ['chip-recent', 'chip-top', 'chip-new'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active', 'bg-emerald-600', 'text-white');
    });
    
    // Limpiar chips MÓVIL
    ['chip-recent-mobile', 'chip-top-mobile', 'chip-new-mobile'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active', 'bg-emerald-600', 'text-white');
    });
    
    // Limpiar inputs de búsqueda
    const mobileInput = document.getElementById('lib-search-mobile');
    const desktopInput = document.getElementById('lib-search-desktop');
    if (mobileInput) mobileInput.value = '';
    if (desktopInput) desktopInput.value = '';
    
    ver('library'); 
}    

function setLibraryMode(mode) {
    discografiaMode = false;
    currentLibrary = mode;
    currentFolderView = null;
    
    // Actualizar pestañas superiores
    const tabAudio = document.getElementById('tab-audio');
    const tabVideo = document.getElementById('tab-video');
    if(tabAudio) tabAudio.classList.toggle('active', mode === 'audio');
    if(tabVideo) tabVideo.classList.toggle('active', mode === 'video');
    
    // Actualizar etiquetas DESKTOP
    const labelDesktop = document.getElementById('lib-mode-label-desktop');
    if(labelDesktop) {
        labelDesktop.innerHTML = (mode === 'audio') 
            ? '<i class="fa-solid fa-music"></i> MÚSICA' 
            : '<i class="fa-solid fa-film"></i> VIDEO';
    }
    
    // Actualizar etiquetas MÓVIL
    const labelMobile = document.getElementById('lib-mode-label-mobile');
    if(labelMobile) {
        labelMobile.innerHTML = (mode === 'audio') 
            ? '<i class="fa-solid fa-music"></i> MÚSICA' 
            : '<i class="fa-solid fa-film"></i> VIDEO';
    }
    
    // Volver al inicio
    goHome();
}
       function escapeStr(str) {
    if (!str) return '';
    return String(str)
        .split('\\\\').join('\\\\\\\\')
        .split("'").join("\\\\'")
        .split('"').join('\\\\\"')
        .split('\\n').join('\\\\n')
        .split('\\r').join('\\\\r');
}
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

        function getRandomGradient() { return `rand-grad-0`; }
        async function crearCarpeta() { const name = prompt("Nombre de la carpeta:"); if(name){ await fetch('/crear_carpeta', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name})}); cargarLib(); } }
        async function crearPlaylist() { const name = prompt("Nombre de la Playlist:"); if (name) { await fetch('/playlist/create', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name})}); cargarLib(); } }
        async function renamePlaylist(oldName) { const newName = prompt("Nuevo nombre para " + oldName + ":", oldName); if(newName && newName !== oldName) { await fetch('/playlist/rename', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({old_name: oldName, new_name: newName})}); cargarLib(); } }
        async function deletePlaylist(name) { if(confirm("¿Borrar lista " + name + "?")) { await fetch('/playlist/delete', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name})}); cargarLib(); } }

function toggleSelectionMode() {
    selectionMode = !selectionMode;

    const btnDesktop = document.getElementById('btn-select-mode');
    const btnMobile  = document.getElementById('btn-select-mode-mobile');

    const btnAllDesktop = document.getElementById('btn-select-all-vis');
    const btnAllMobile  = document.getElementById('btn-select-all-vis-mobile');

    const bar = document.getElementById('batch-bar');

    [btnDesktop, btnMobile].forEach(btn => {
        if (!btn) return;
        if (selectionMode) {
            btn.classList.add('active', 'bg-emerald-600', 'text-white', 'border-emerald-500');
        } else {
            btn.classList.remove('active', 'bg-emerald-600', 'text-white', 'border-emerald-500');
        }
    });

    [btnAllDesktop, btnAllMobile].forEach(btn => {
        if (!btn) return;
        if (selectionMode) btn.classList.remove('hidden');
        else btn.classList.add('hidden');
    });

    if (!selectionMode) {
        selectedFiles.clear();
        if (bar) {
            bar.classList.add('hidden');
            bar.classList.remove('translate-y-0');
        }
    }

    renderLib();
}        function selectRow(path) { if(!selectionMode) return; if(selectedFiles.has(path)) selectedFiles.delete(path); else selectedFiles.add(path); updateBatchUI(); renderLib(); }
function selectAllVisible() {
    let tracks = [];

    // 📂 CASO 1: MODO CARPETAS
    if (currentView === 'folders') {
        // Seleccionamos todo lo que empiece por la ruta actual
        if (currentExplorerPath === '') {
            // Si estamos en raíz, todo
            tracks = libData.files; 
        } else {
            // Si estamos en una carpeta
            tracks = libData.files.filter(f => f.path.startsWith(currentExplorerPath + '/'));
        }
    } 
    // 📺 CASO 2: VISTA NETFLIX (raíz de video con categoría activa)
    else if (currentLibrary === 'video' && currentPath === '' && window.netflixActiveCategory) {
        // Filtrar por la categoría activa de Netflix
        tracks = libData.files.filter(f => {
            if (f.type !== 'video') return false;
            const path = f.path.replace(/\\/g, '/');
            const parts = path.split('/');
            const cat = parts.length > 1 ? parts[1] : '';
            return cat === window.netflixActiveCategory;
        });
    }
    // 📺 CASO 3: VISTA TEMPORADA (cuando hay una temporada seleccionada)
    else if (currentLibrary === 'video' && currentPath && currentPath.includes('/')) {
        // Filtrar por la ruta actual (temporada)
        tracks = libData.files.filter(f => {
            if (f.type !== 'video') return false;
            const path = f.path.replace(/\\/g, '/');
            return path.startsWith(currentPath);
        });
    }
    // 🎵 CASO 4: MODO BIBLIOTECA NORMAL
    else {
        tracks = getFilteredTracks();
    }

    // Lógica de toggle (Si todos están seleccionados, deseleccionar. Si no, seleccionar).
    const allSelected = tracks.length > 0 && tracks.every(t => selectedFiles.has(t.path));

    tracks.forEach(t => {
        if (allSelected) selectedFiles.delete(t.path);
        else selectedFiles.add(t.path);
    });

    updateBatchUI();
    
    // Refrescar vista correcta
    if (currentView === 'folders') {
        renderFolderView(currentExplorerPath);
    } else {
        renderLib();
    }
}        function enqueueSelected() {
    if (selectedFiles.size === 0) {
        showToast("No hay canciones seleccionadas", "warning");
        return;
    }

    let added = 0;

    selectedFiles.forEach(path => {
        const file = libData.files.find(f => f.path === path);
        if (!file) return;

        // Evitar duplicados en la cola
        const exists = playerQueue.some(t => t.path === path);
        if (!exists) {
            playerQueue.push(file);
            added++;
        }
    });

    if (added > 0) {
        showToast(`🎶 ${added} canciones añadidas a la cola`, "success");
        updateQueueUI();

        // Si no hay nada sonando, arrancar con la primera
        if (audioElement.paused && playerQueue.length === added) {
            currentTrackIndex = 0;
            playTrack(playerQueue[0]);
        }
    } else {
        showToast("Todas ya estaban en la cola", "info");
    }

    // Limpiar selección y cerrar modo selección
    selectedFiles.clear();
    toggleSelectionMode();
}
        function updateBatchUI() {
            const bar = document.getElementById('batch-bar');
            document.getElementById('batch-count').innerText = selectedFiles.size;
            const removeBtn = document.getElementById('batch-remove-playlist');
            const inPlaylist = typeof currentLibrary !== 'undefined' && currentLibrary.startsWith('playlist:');
            if (removeBtn) {
                if (inPlaylist && selectedFiles.size > 0) removeBtn.classList.remove('hidden');
                else removeBtn.classList.add('hidden');
            }
            if(selectedFiles.size > 0) { bar.classList.remove('hidden'); setTimeout(() => bar.classList.remove('translate-y-20'), 10); setTimeout(() => bar.classList.add('translate-y-0'), 10); } else { bar.classList.remove('translate-y-0'); bar.classList.add('translate-y-20'); }
        }
        function cancelSelection() { toggleSelectionMode(); }
        async function addBatchToPlaylist() { if(selectedFiles.size === 0) return; fileToPlaylist = null; openPlaylistModal(null, 'add'); }
        async function removeBatchFromPlaylist() { if(selectedFiles.size === 0) return; fileToPlaylist = null; openPlaylistModal(null, 'remove'); }
        async function addToPlaylistBatch(name) { const paths = Array.from(selectedFiles); const res = await fetch('/playlist/add_batch', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name, paths})}); const d = await res.json(); closePlaylistModal(); cancelSelection(); if(d.ignored > 0) showToast(`Se añadieron ${d.added} canciones.\n(${d.ignored} repetidas se ignoraron).`); else showToast(`Añadidas ${d.added} canciones a ${name}`); cargarLib(); }
        function openPlaylistModal(path, mode = 'add') { 
            fileToPlaylist = path; 
            const isBatch = !path && selectedFiles.size > 0; 
            const container = document.getElementById('playlist-options'); 
            container.innerHTML = ''; 
            const lists = Object.keys(libData.playlists); 
            
            if(lists.length === 0) { 
                container.innerHTML = '<p class="text-emerald-500 text-center text-xs">Crea una playlist primero</p>'; 
            } else { 
                lists.forEach(pl => { 
                    let isInList = false; 
                    if (!isBatch && path) { 
                        const fileData = libData.files.find(f => f.path === path); 
                        if (fileData && fileData.playlists.includes(pl)) isInList = true; 
                    } 
                    
                    const isRemoveMode = isBatch && mode === 'remove';
                    const btnClass = isRemoveMode
                        ? "bg-red-900/30 text-red-300 border border-red-900/50 hover:bg-red-900/50"
                        : (isInList ? "bg-emerald-600/20 text-emerald-400 border border-emerald-600/50" : "bg-emerald-800 hover:bg-emerald-700 text-emerald-300"); 
                    const icon = isRemoveMode
                        ? '<i class="fa-solid fa-minus"></i>'
                        : (isInList ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-plus"></i>'); 
                    const text = isRemoveMode ? `Quitar de ${pl}` : (isInList ? `${pl} (Ya en lista)` : pl); 
                    
                    // Escapar comillas para evitar romper el HTML
                    const plEscaped = pl.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    const action = isBatch 
                        ? (mode === 'remove' ? `removeFromPlaylistBatch('${plEscaped}')` : `addToPlaylistBatch('${plEscaped}')`) 
                        : (isInList ? `removeFromPlaylistModal('${plEscaped}')` : `addToPlaylist('${plEscaped}')`); 
                    
                    container.innerHTML += `<button onclick="${action}" class="w-full text-left px-4 py-3 rounded-lg text-xs mb-1 transition flex items-center gap-2 ${btnClass}">${icon} ${text}</button>`; 
                }); 
            } 
            document.getElementById('playlist-modal').classList.remove('hidden'); 
        }
        async function addToPlaylist(name) { 
            const res = await fetch('/playlist/add', {
                method:'POST', 
                headers:{'Content-Type':'application/json'}, 
                body:JSON.stringify({name, path:fileToPlaylist})
            }); 
            const d = await res.json(); 
            closePlaylistModal(); 
            
            if(d.duplicate) {
                showToast(`⚠️ Ya está en "${name}"`, "warning");
            } else if(d.ok) {
                showToast(`✅ Agregado a "${name}"`, "success");
            }
            
            cargarLib(); 
        }
        async function removeFromPlaylistModal(name) { 
            if(confirm(`¿Quitar de "${name}"?`)) { 
                const res = await fetch('/playlist/remove', {
                    method:'POST', 
                    headers:{'Content-Type':'application/json'}, 
                    body:JSON.stringify({name, path:fileToPlaylist})
                }); 
                const d = await res.json();
                closePlaylistModal(); 
                
                if(d.ok) {
                    showToast(`🗑️ Quitado de "${name}"`, "info");
                }
                
                cargarLib(); 
            } 
        }
        async function removeFromPlaylistBatch(name) {
            const paths = Array.from(selectedFiles);
            if (paths.length === 0) return;
            if (!confirm(`¿Quitar ${paths.length} canciones de "${name}"?`)) return;

            const results = await Promise.all(paths.map(async (path) => {
                const res = await fetch('/playlist/remove', {
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({name, path})
                });
                const d = await res.json();
                return d.ok ? 1 : 0;
            }));

            const removed = results.reduce((a, b) => a + b, 0);
            closePlaylistModal();
            cancelSelection();
            showToast(`🗑️ Quitadas ${removed} canciones de "${name}"`, "info");
            cargarLib();
        }
        function closePlaylistModal() { document.getElementById('playlist-modal').classList.add('hidden'); }
function abrirEditorMasivo(pathOverride) {
    const fields = document.getElementById('edit-fields');
    const title = document.getElementById('edit-modal-title');
    fields.innerHTML = "";

    let paths = pathOverride ? [pathOverride] : Array.from(selectedFiles);

    // --- MODO SINGLE ---
    if (paths.length === 1) {
        const f = libData.files.find(x => x.path === paths[0]);
        if (!f) return;

        // Detectar si es video
        const isVideo = f.path.endsWith('.mkv') || f.path.endsWith('.mp4') || f.path.endsWith('.avi') || f.path.endsWith('.mov') || f.path.endsWith('.webm');
        
        title.innerText = isVideo ? "Editar Video" : "Editar Canción";

        let fieldsHtml = `
            <input type="hidden" id="edit-mode" value="single">
            <input type="hidden" id="edit-path" value="${f.path}">`;

        if (!isVideo) {
            fieldsHtml += `
            <div>
                <label class="text-[10px] text-emerald-500 font-bold uppercase">Título</label>
                <input type="text" id="edit-title" value="${f.title}"
                       class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
            </div>

            <div>
                <label class="text-[10px] text-emerald-500 font-bold uppercase">Artista</label>
                <input type="text" id="edit-artist" value="${f.artist}"
                       class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
            </div>

            <div>
                <label class="text-[10px] text-emerald-500 font-bold uppercase">Álbum</label>
                <input type="text" id="edit-album" value="${f.album || ''}"
                       class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
            </div>

            <div>
                <label class="text-[10px] text-emerald-500 font-bold uppercase">Género</label>
                <input type="text" id="edit-genre" value="${f.genre || ''}"
                       class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
            </div>

            <hr class="border-white/10">`;
        }

        fieldsHtml += `
            <div>
                <label class="text-[10px] text-emerald-500 font-bold uppercase">Carátula (URL)</label>
                <input type="text" id="edit-cover" placeholder="http://..."
                       class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
            </div>`;
        
        fields.innerHTML = fieldsHtml;
    }

    // --- MODO BATCH ---
    else {
        title.innerText = `Editar ${paths.length} archivos`;

        fields.innerHTML = `
            <input type="hidden" id="edit-mode" value="batch">
            <input type="hidden" id="batch-target" value="genre">

            <div class="flex gap-2 mb-3">
                <button onclick="setBatchTarget('genre')" id="bt-genre"
                        class="flex-1 bg-emerald-700/40 border border-emerald-600 text-[10px] py-1 rounded">
                    Género
                </button>
                <button onclick="setBatchTarget('artist')" id="bt-artist"
                        class="flex-1 bg-zinc-800 border border-zinc-700 text-[10px] py-1 rounded">
                    Artista
                </button>
                <button onclick="setBatchTarget('cover')" id="bt-cover"
                        class="flex-1 bg-zinc-800 border border-zinc-700 text-[10px] py-1 rounded">
                    Carátula
                </button>
            </div>

            <div id="batch-field"></div>

            <p class="text-[9px] text-emerald-500 mt-2 italic">
                * Se aplicará a todos los seleccionados.
            </p>
        `;

        renderBatchField('genre');
    }

    document.getElementById('edit-modal').classList.remove('hidden');
}

// helpers del batch
function setBatchTarget(t) {
    document.getElementById('batch-target').value = t;

    ['genre','artist','cover'].forEach(k => {
        const b = document.getElementById('bt-' + k);
        if (!b) return;
        b.className = k === t
            ? 'flex-1 bg-emerald-700/40 border border-emerald-600 text-[10px] py-1 rounded'
            : 'flex-1 bg-zinc-800 border border-zinc-700 text-[10px] py-1 rounded';
    });

    renderBatchField(t);
}

function renderBatchField(t) {
    const box = document.getElementById('batch-field');
    if (!box) return;

    if (t === 'genre') {
        box.innerHTML = `
            <label class="text-[10px] text-emerald-500 font-bold uppercase">Género</label>
            <input type="text" id="edit-genre" placeholder="Ej: Rock, Anime…"
                   class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
        `;
    }

    if (t === 'artist') {
        box.innerHTML = `
            <label class="text-[10px] text-emerald-500 font-bold uppercase">Artista</label>
            <input type="text" id="edit-artist" placeholder="Nuevo artista…"
                   class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
        `;
    }

    if (t === 'cover') {
        box.innerHTML = `
            <label class="text-[10px] text-emerald-500 font-bold uppercase">Carátula (URL)</label>
            <input type="text" id="edit-cover" placeholder="http://..."
                   class="w-full bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
        `;
    }
}
async function guardarCambiosEdicion() {
    const mode = document.getElementById('edit-mode')?.value;
    if (!mode) return;

    const coverEl  = document.getElementById('edit-cover');
    const genreEl  = document.getElementById('edit-genre');
    const artistEl = document.getElementById('edit-artist');

    const coverUrl = coverEl?.value || "";
    const genre    = genreEl?.value || "";
    const artist   = artistEl?.value || "";

    let paths = (mode === 'single')
        ? [document.getElementById('edit-path')?.value]
        : Array.from(selectedFiles);

    let dataTags = {};

    if (mode === 'single') {
        dataTags = {
            path: paths[0],
            title: document.getElementById('edit-title')?.value || "",
            artist: artist || document.getElementById('edit-artist')?.value || "",
            album: document.getElementById('edit-album')?.value || "",
            genre: genre || document.getElementById('edit-genre')?.value || ""
        };
    } else {
        dataTags = { paths };
        if (genre)  dataTags.genre  = genre;
        if (artist) dataTags.artist = artist;
    }

    // Determinar si son videos o audio
    const isVideo = paths[0] && (paths[0].endsWith('.mkv') || paths[0].endsWith('.mp4') || paths[0].endsWith('.avi') || paths[0].endsWith('.mov') || paths[0].endsWith('.webm'));
    
    // Para videos, NUNCA llamar a update_tags (lo corrompe). Solo update_cover
    if (!isVideo && Object.keys(dataTags).length > 1) {
        await fetch('/update_tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataTags)
        });
    }

    if (coverUrl) {
        await fetch('/update_cover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paths, url: coverUrl })
        });
    }

    document.getElementById('edit-modal')?.classList.add('hidden');
    if (mode === 'batch') toggleSelectionMode();
    await cargarLib();
}
        async function confirmarBorradoMasivo() { if(!confirm(`⚠️ PELIGRO ⚠️\n\n¿Estás seguro de que quieres BORRAR FÍSICAMENTE ${selectedFiles.size} archivos?\n\nEsta acción NO se puede deshacer.`)) return; const res = await fetch('/borrar_masivo', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({paths: Array.from(selectedFiles)})}); const d = await res.json(); showToast(`Se eliminaron ${d.count} archivos correctamente.`); toggleSelectionMode(); cargarLib(); }
        function abrirMover(path) { 
            fileToMove = decodeURIComponent(path); 
            const list = document.getElementById('folder-list-modal'); 
            list.innerHTML = `<button 
                onclick="moverA('Raíz')" 
                class="w-full text-left px-4 py-3 bg-emerald-800 hover:bg-emerald-700 rounded-lg text-xs mb-1 font-bold text-white transition flex items-center gap-2">
                <i class="fa-solid fa-file"></i> Raíz
            </button>`; 
            
            libData.folders.forEach(f => {
                const folderEscaped = f.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                list.innerHTML += `<button 
                    onclick="moverA('${folderEscaped}')" 
                    class="w-full text-left px-4 py-3 bg-emerald-800 hover:bg-emerald-700 rounded-lg text-xs mb-1 text-emerald-300 transition flex items-center gap-2">
                    <i class="fa-solid fa-folder"></i> ${escapeHtml(f)}
                </button>`;
            }); 
            
            document.getElementById('move-modal').classList.remove('hidden'); 
        }
        async function moverA(d) { await fetch('/mover_archivo', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({file:fileToMove, target:d})}); document.getElementById('move-modal').classList.add('hidden'); cargarLib(); }
        async function borrar(path) { if(confirm("¿Eliminar?")) { await fetch('/borrar', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({file:decodeURIComponent(path)})}); cargarLib(); }}

function playContext() { 
    let tracksToPlay = [];

    // 📂 CASO A: MODO CARPETAS
    if (currentView === 'folders') {
        const path = currentExplorerPath || '';
        if (path === '') {
            tracksToPlay = libData.files;
        } else {
            // Buscar archivos en la carpeta actual, ordenados por nombre
            tracksToPlay = libData.files
                .filter(f => f.path.startsWith(path + '/'))
                .sort((a, b) => a.title.localeCompare(b.title, undefined, {numeric: true, sensitivity: 'base'}));
        }
    }
    // 🎤 CASO B: MODO ARTISTA
    else if (currentView === 'artist') {
        tracksToPlay = currentArtistTracks;
    }
    // 🎵 CASO C: MODO BIBLIOTECA
    else {
        tracksToPlay = getFilteredTracks(); 
    }

    // Ejecutar
    if (tracksToPlay.length > 0) {
        
        // 1. SI SON POCAS (MENOS DE 50): Carga normal rápida
        if (tracksToPlay.length <= 50) {
            playerQueue = tracksToPlay.slice();
            currentTrackIndex = 0;
            playTrack(playerQueue[0]);
            showToast(`Reproduciendo ${tracksToPlay.length} elementos`, "success");
            
        } else {
            // 2. MODO "EMBUDO" 🌪️ (Para listas grandes)
            // Cargamos solo las primeras 50 para que arranque AL INSTANTE
            const LOTE_INICIAL = 50;
            playerQueue = tracksToPlay.slice(0, LOTE_INICIAL);
            
            currentTrackIndex = 0;
            playTrack(playerQueue[0]); // ¡La música suena YA!
            
            showToast(`Iniciando con ${LOTE_INICIAL} canciones...`, "success");
            
            // 3. CARGA SILENCIOSA: El resto se añade 1 segundo después
            console.log("🌪️ Modo Embudo activado. Cargando resto en segundo plano...");
            
            setTimeout(() => {
                // Tomamos del 50 en adelante
                const resto = tracksToPlay.slice(LOTE_INICIAL);
                // Las pegamos al final de la cola
                playerQueue = playerQueue.concat(resto);
                
                console.log(`✅ Carga completa: ${playerQueue.length} canciones en cola.`);
                showToast(`Cola completa: ${playerQueue.length} canciones cargadas`);
                
                // Si tienes una función para actualizar la vista de la cola, llámala aquí
                // if(typeof renderQueue === 'function') renderQueue();
                updateQueueUI();
            }, 1000); // 1000ms = 1 segundo de respiro
        }

    } else {
        showToast("No hay nada para reproducir aquí", "warning");
    }
    }
function playMix(id) {
    // --- NUEVO: Si tocan el botón de Radio, usamos el algoritmo nuevo ---
    if (id === 'smart_shuffle') {
        activarModoRadio(); 
        return; 
    }
    // -------------------------------------------------------------------

    let mixFiles = [];
    // ... (el resto del código sigue igual)

    // --- CASO 1: ES FAVORITOS (NUEVO) ---
    // Este mix no viene del servidor, lo calculamos aquí
    if (id === 'smart_favorites') {
        mixFiles = libData.files.filter(f => f.rating === 1);
        
        if (mixFiles.length === 0) {
            // Opcional: una alerta si está vacío
            console.log("No hay favoritos aún");
            return; 
        }
    } 
    
    // --- CASO 2: SON LOS MIXES DE SIEMPRE (TU CÓDIGO) ---
    else {
        // Buscamos el mix en la lista que mandó el servidor
        const mix = libData.smart_mixes.find(m => m.id === id);
        
        if (mix) {
            // Tu lógica original para convertir rutas en objetos de canción
            mixFiles = mix.files
                .map(path => libData.files.find(f => f.path === path))
                .filter(f => f); // Filtramos los nulos por si acaso
        }
    }

    // --- REPRODUCIR ---
    if (mixFiles.length > 0) {
        playerQueue = mixFiles;
        currentTrackIndex = 0;
        if(document.getElementById('queue-count')) {
            document.getElementById('queue-count').innerText = playerQueue.length;
        }
        playTrack(playerQueue[0]);
        
    }
}

function playCustomMix(id) {
    const mix = customMixes[id];
    if (!mix) return;
    const mixFiles = mix.files
        .map(path => libData.files.find(f => f.path === path))
        .filter(f => f);

    if (mixFiles.length > 0) {
        playerQueue = mixFiles;
        currentTrackIndex = 0;
        if(document.getElementById('queue-count')) {
            document.getElementById('queue-count').innerText = playerQueue.length;
        }
        playTrack(playerQueue[0]);
    }
}

function renderHorizontalMixRow(rowEl, mixes) {
    if (!rowEl) return;
    rowEl.innerHTML = '';
    mixes.forEach(mix => {
        const coverPath = mix.cover || mix.files[0] || '';
        const coverUrl = coverPath
            ? `/caratula/${coverPath.split('/').map(p => encodeURIComponent(p)).join('/')}`
            : '';
        const safeName = escapeHtml(mix.name);
        rowEl.innerHTML += `
        <div onclick="playCustomMix('${mix.id}')" class="min-w-[180px] max-w-[200px] cursor-pointer transition hover:scale-[1.02]">
            <div class="relative aspect-square rounded-xl overflow-hidden bg-[#121212] border border-white/10 hover:border-emerald-500/40 shadow-lg">
                <img src="${coverUrl}" class="absolute inset-0 w-full h-full object-cover" onerror="this.style.display='none';">
                <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"></div>
                <div class="absolute bottom-0 left-0 right-0 p-3">
                    <h4 class="text-sm font-bold text-white leading-tight drop-shadow-sm line-clamp-2">${safeName}</h4>
                    <p class="text-[10px] text-emerald-400 font-bold mt-1">${mix.count} canciones</p>
                </div>
            </div>
        </div>`;
    });
}

function scrollMixRow(rowId, direction) {
    const row = document.getElementById(rowId);
    if (!row) return;
    const amount = Math.max(220, Math.floor(row.clientWidth * 0.7));
    row.scrollBy({ left: amount * direction, behavior: 'smooth' });
}
        // --- LOGICA DE VIDEO ---
        function playNow(path) { 
            if(selectionMode) { selectRow(path); return; } 
            const file = libData.files.find(f => f.path === path); if (!file) return; 
            
            // Si es video, creamos la cola de la carpeta completa
            if (file.type === 'video') {
                audioElement.pause(); 
                // Encontrar todos los videos en la misma carpeta que este archivo
                // (Usamos full_folder para asegurarnos que son del mismo nivel)
                const folderTracks = libData.files.filter(f => f.full_folder === file.full_folder && f.type === 'video');
                
                // Ordenar por nombre (para que cap 1 siga de cap 2)
                folderTracks.sort((a, b) => a.title.localeCompare(b.title, undefined, {numeric: true, sensitivity: 'base'}));

                const startIndex = folderTracks.findIndex(f => f.path === path);
                
                if (startIndex !== -1) {
                    playerQueue = folderTracks;
                    currentTrackIndex = startIndex;
                    playVideoMode(playerQueue[currentTrackIndex]);
                } else {
                    // Fallback
                    playerQueue = [file];
                    currentTrackIndex = 0;
                    playVideoMode(file);
                }
            } else { 
                playerQueue = [file]; 
                currentTrackIndex = 0; 
                playTrack(file); 
            }
        }
        
function enqueue(path) { 
    const file = libData.files.find(f => f.path === path); 
    if (!file) return;

    // 🔒 Evitar duplicados
    const exists = playerQueue.some(track => track.path === path);
    if (exists) {
        showToast("⚠️ Ya está en la cola", "warning");
        return;
    }

    playerQueue.push(file); 
    updateQueueUI(); 

    // ✅ AGREGAR ESTA LÍNEA (era el error de sintaxis):
    showToast(`✅ "${file.title}" añadida a la cola`, "success");

    if (audioElement.paused && playerQueue.length === 1) { 
        currentTrackIndex = 0; 
        playTrack(file); 
    } 
}
    
       
function playTrack(file) { 
    const playerBar = document.getElementById('player-bar');
    if (playerBar) {
        playerBar.style.opacity = '0.6';
        playerBar.style.pointerEvents = 'none';
    }

    fetch('/log_play', {
        method: 'POST', 
        headers: {'Content-Type':'application/json'}, 
        body: JSON.stringify({ path: file.path })
    });

    const bar = document.getElementById('player-bar'); 
    const videoView = document.getElementById('view-player');

    if (file.type === 'video') {
        if (audioElement) {
            audioElement.pause();
            audioElement.src = ""; 
        }
        if (bar) {
            bar.classList.add('hidden');
            bar.classList.remove('flex');
        }

        playVideoMode(file);

        // 🔧 restaurar estado visual
        if (playerBar) {
            playerBar.style.opacity = '1';
            playerBar.style.pointerEvents = 'auto';
        }

        return; // 👈 salir aquí
    }

    // --- AUDIO ---
    if (videoView && !videoView.classList.contains('hidden')) {
        exitVideoMode(); 
    }
    if (bar) {
        bar.classList.remove('hidden'); 
        bar.classList.add('flex'); 
    }

    actualizarInterfazPlayer(file);

    const parts = file.path.split('/'); 
    const safePath = parts.map(p => encodeURIComponent(p)).join('/'); 
    audioElement.src = '/descargas/' + safePath;

    audioElement.play().then(() => {
        updateQueueUI();
        syncPlayerUI();

        if (playerBar) {
            playerBar.style.opacity = '1';
            playerBar.style.pointerEvents = 'auto';
        }

        const modal = document.getElementById('fullscreen-player');
    if (modal && !modal.classList.contains('hidden')) {
        syncFullscreenPlayerCover(); // 👈 Nueva función que agregamos arriba
    }

        if (playerBar) {
            playerBar.style.opacity = '1';
            playerBar.style.pointerEvents = 'auto';
        }

    }).catch(e => {
        console.error("Error al reproducir audio:", e);

        if (playerBar) {
            playerBar.style.opacity = '1';
            playerBar.style.pointerEvents = 'auto';
        }
    });
}
function actualizarInterfazPlayer(file) {
    const covers = ['player-cover', 'player-cover-desktop'];
    const titles = ['player-title', 'player-title-desktop'];
    const artists = ['player-artist', 'player-artist-desktop'];

    covers.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = 'block';
        const safeCover = file.path.split('/').map(p => encodeURIComponent(p)).join('/');
        
        // Cargar inmediatamente (no lazy, es el player activo)
        el.src = `/caratula/${safeCover}`;
        
        // Fallback si falla
        el.onerror = () => {
            el.style.display = 'none';
            const fallback = document.getElementById('player-fallback') || 
                            document.getElementById('player-fallback-desktop');
            if (fallback) fallback.classList.remove('hidden');
        };
    }
});

    titles.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = file.title;
    });

    artists.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = file.album ? `${file.artist} • ${file.album}` : file.artist;
    });

    updateHeartButton(file.rating === 1);

    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: file.title || 'Sin título',
            artist: file.artist || '',
            album: file.album || '',
            artwork: file.cover ? [
                { src: file.cover, sizes: '512x512', type: 'image/jpeg' }
            ] : []
        });

        navigator.mediaSession.setActionHandler('play', togglePlay);
        navigator.mediaSession.setActionHandler('pause', togglePlay);
        navigator.mediaSession.setActionHandler('previoustrack', playPrevious);
        navigator.mediaSession.setActionHandler('nexttrack', playNext);
    }

}



function playVideoMode(file) {
    // Ocultar sidebar
    const sb = document.getElementById('main-sidebar');
    if (sb) sb.classList.add('hidden');

    // Ocultar otras vistas
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    
    const view = document.getElementById('view-player');
    if (view) view.classList.remove('hidden');

    const videoPath = file.path.split('/').map(p => encodeURIComponent(p)).join('/');
    const screen = document.getElementById('cine-screen');

    // Mostrar loader
    const loader = document.getElementById('video-loader');
    if (loader) loader.classList.remove('hidden');

    if (screen) {
        screen.innerHTML = `
            <video id="main-video"
                   src="/descargas/${videoPath}"
                   preload="auto"
                   playsinline
                   crossorigin="anonymous"
                   controls="false"
                   class="w-full h-full bg-black"
                   style="object-fit: contain; max-width: 100vw; max-height: 100vh;">
            </video>`;
    }

    const cTitle = document.getElementById('cine-title');
    const cMeta = document.getElementById('cine-meta');
    if (cTitle) cTitle.innerText = file.title;
    if (cMeta) cMeta.innerText = file.folder || 'Video';

    const videoEl = document.getElementById('main-video');
    if (videoEl) {
        // Progreso de carga
        videoEl.addEventListener('progress', updateLoadProgress);
        
        // Cuando tiene suficientes datos para reproducir
        videoEl.addEventListener('canplay', () => {
            if (loader) {
                loader.classList.add('hidden');
            }
        });

        // Detectar pistas de audio y subtítulos
        videoEl.addEventListener('loadedmetadata', function() {
            const aspectRatio = this.videoWidth / this.videoHeight;
            const isMobile = window.innerWidth < 768;
            
            if (isMobile) {
                this.style.width = '100vw';
                this.style.height = '100vh';
                this.style.objectFit = aspectRatio < 1.2 ? 'cover' : 'contain';
            } else {
                this.style.objectFit = aspectRatio < 1.2 ? 'cover' : 'contain';
            }

            const progBar = document.getElementById('video-progress');
            if (progBar) progBar.max = this.duration;

            const timeTotal = document.getElementById('video-time-total');
            if (timeTotal) timeTotal.innerText = formatTime(this.duration);

            // Detectar pistas (mejorado)
            setTimeout(() => detectAudioAndSubtitles(), 500);
        });

        // Habilitar clic derecho para menú nativo del navegador
        videoEl.addEventListener('contextmenu', (e) => {
            // Permitir menú nativo solo con Ctrl presionado
            if (!e.ctrlKey) {
                e.preventDefault();
                showToast('💡 Mantén Ctrl + Clic Derecho para menú de audio/subtítulos', 'info');
            }
        });

        // Actualizar progreso en tiempo real
        videoEl.addEventListener('timeupdate', updateVideoProgress);

        // Auto-avanzar al terminar
        videoEl.onended = () => { playNext(); };

        // Volumen persistente
        videoEl.volume = parseFloat(localStorage.getItem('vortex_vol') || '1');
        
        // Prevenir scroll en movil
        if (window.innerWidth < 768) {
            document.body.style.overflow = 'hidden';
        }

        // Auto-reproducir
        videoEl.play().catch(() => {
            // Si falla el autoplay, mostrar botón de play
            if (loader) loader.classList.add('hidden');
        });

        // Sistema de auto-ocultar controles
        setupMobileControlsToggle();
    }

    updateQueueUI();
}

// Actualizar progreso de carga del video
function updateLoadProgress() {
    const video = document.getElementById('main-video');
    if (!video || !video.buffered.length) return;

    const percent = (video.buffered.end(0) / video.duration) * 100;
    
    // Actualizar círculo de progreso
    const circle = document.getElementById('video-load-progress');
    const percentText = document.getElementById('video-load-percent');
    
    if (circle) {
        const circumference = 283; // 2 * PI * 45
        const offset = circumference - (percent / 100) * circumference;
        circle.style.strokeDashoffset = offset;
    }
    
    if (percentText) {
        percentText.innerText = Math.round(percent) + '%';
    }
}

// Detectar pistas de audio y subtítulos (MEJORADO CON API)
async function detectAudioAndSubtitles() {
    const video = document.getElementById('main-video');
    if (!video) return;

    const audioList = document.getElementById('audio-tracks-list');
    const subtitleList = document.getElementById('subtitle-tracks-list');
    const audioSection = document.getElementById('audio-tracks-section');
    const subtitleSection = document.getElementById('subtitle-tracks-section');

    // Limpiar listas
    if (audioList) audioList.innerHTML = '';
    if (subtitleList) subtitleList.innerHTML = '';

    // Obtener ruta del video actual desde playerQueue
    const currentFile = playerQueue[currentTrackIndex];
    if (!currentFile) return;

    try {
        // Llamar al backend para obtener streams
        const response = await fetch('/api/video/streams', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ path: currentFile.path })
        });

        const data = await response.json();
        
        if (!data.ok) {
            console.warn('No se pudieron detectar streams:', data.error);
            return;
        }

        const { audio, subtitles } = data.streams;

        // Renderizar pistas de audio
        if (audio && audio.length > 1) {
            audio.forEach((track, i) => {
                const langLabel = {
                    'spa': '🇪🇸 Español',
                    'eng': '🇺🇸 English',
                    'jpn': '🇯🇵 日本語',
                    'kor': '🇰🇷 한국어',
                    'und': '🌐 Audio'
                }[track.language] || track.title;

                const btn = document.createElement('button');
                btn.onclick = () => switchAudioTrack(track.index);
                btn.className = i === 0 ? 'active' : '';
                btn.id = `audio-${i}`;
                btn.innerHTML = `<i class="fa-solid fa-volume-high mr-2"></i>${langLabel}`;
                
                if (audioList) audioList.appendChild(btn);
            });
            if (audioSection) audioSection.style.display = 'block';
        } else {
            if (audioSection) audioSection.style.display = 'none';
        }

        // Renderizar subtítulos
        if (subtitles && subtitles.length > 0) {
            subtitles.forEach((track, i) => {
                const langLabel = {
                    'spa': '🇪🇸 Español',
                    'eng': '🇺🇸 English',
                    'jpn': '🇯🇵 日本語',
                    'und': '💬 Subtítulos'
                }[track.language] || track.title;

                const btn = document.createElement('button');
                btn.onclick = () => switchSubtitleTrack(track.index);
                btn.id = `subtitle-${i}`;
                btn.innerHTML = `<i class="fa-solid fa-closed-captioning mr-2"></i>${langLabel}`;
                
                if (subtitleList) subtitleList.appendChild(btn);
            });
            if (subtitleSection) subtitleSection.style.display = 'block';
        } else {
            if (subtitleSection) subtitleSection.style.display = 'none';
        }

    } catch (e) {
        console.error('Error detectando streams:', e);
    }

    // Fallback: Intentar con API nativa del navegador
    detectNativeTracks();
}

// Fallback para navegadores que soportan audioTracks
function detectNativeTracks() {
    const video = document.getElementById('main-video');
    if (!video) return;

    const audioList = document.getElementById('audio-tracks-list');
    const audioSection = document.getElementById('audio-tracks-section');

    // Solo si ya no hay nada renderizado
    if (audioList && audioList.children.length === 0) {
        const audioTracks = video.audioTracks;
        if (audioTracks && audioTracks.length > 1) {
            for (let i = 0; i < audioTracks.length; i++) {
                const track = audioTracks[i];
                const label = track.label || track.language || `Audio ${i + 1}`;
                const isActive = track.enabled;
                
                const btn = document.createElement('button');
                btn.onclick = () => selectAudioTrack(i);
                btn.className = isActive ? 'active' : '';
                btn.id = `audio-native-${i}`;
                btn.innerHTML = `<i class="fa-solid fa-volume-high mr-2"></i>${label}`;
                
                audioList.appendChild(btn);
            }
            if (audioSection) audioSection.style.display = 'block';
        }
    }
}

// Cambiar pista de audio (requiere recargar el video con parámetro)
async function switchAudioTrack(streamIndex) {
    const video = document.getElementById('main-video');
    if (!video) return;

    const currentFile = playerQueue[currentTrackIndex];
    if (!currentFile) return;

    const currentTime = video.currentTime;
    const wasPlaying = !video.paused;

    // Recargar video con stream específico
    const videoPath = currentFile.path.split('/').map(p => encodeURIComponent(p)).join('/');
    video.src = `/descargas/${videoPath}#t=${currentTime}`;
    
    video.load();
    
    video.addEventListener('loadedmetadata', function seek() {
        video.currentTime = currentTime;
        if (wasPlaying) video.play();
        video.removeEventListener('loadedmetadata', seek);
    });

    // Actualizar UI
    document.querySelectorAll('[id^="audio-"]').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById(`audio-${streamIndex}`);
    if (btn) btn.classList.add('active');

    showToast('🎵 Cambiando audio...', 'info');
}

// Cambiar subtítulos
function switchSubtitleTrack(streamIndex) {
    // Nota: Para subtítulos embebidos necesitarías extraerlos con ffmpeg
    // Por ahora solo mostramos la opción
    showToast('ℹ️ Para cambiar subtítulos, usa Ctrl+Clic Derecho en el video', 'info');
}

// Seleccionar pista de audio
function selectAudioTrack(index) {
    const video = document.getElementById('main-video');
    if (!video || !video.audioTracks) return;

    // Desactivar todas
    for (let i = 0; i < video.audioTracks.length; i++) {
        video.audioTracks[i].enabled = (i === index);
        const btn = document.getElementById(`audio-${i}`);
        if (btn) btn.classList.toggle('active', i === index);
    }

    showToast(`Audio cambiado: ${video.audioTracks[index].label || 'Audio ' + (index + 1)}`, 'success');
}

// Seleccionar subtítulos
function selectSubtitle(index) {
    const video = document.getElementById('main-video');
    if (!video || !video.textTracks) return;

    // Desactivar todos
    for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = 'hidden';
        const btn = document.getElementById(`subtitle-${i}`);
        if (btn) btn.classList.remove('active');
    }

    // Activar el seleccionado
    const noneBtn = document.getElementById('subtitle-none');
    if (index === -1) {
        if (noneBtn) noneBtn.classList.add('active');
        showToast('Subtítulos desactivados', 'info');
    } else {
        video.textTracks[index].mode = 'showing';
        const btn = document.getElementById(`subtitle-${index}`);
        if (btn) btn.classList.add('active');
        if (noneBtn) noneBtn.classList.remove('active');
        showToast(`Subtítulos: ${video.textTracks[index].label || 'Activados'}`, 'success');
    }
}

// Toggle menú de configuración
function toggleVideoSettings() {
    const menu = document.getElementById('video-settings-menu');
    if (menu) {
        menu.classList.toggle('show');
    }
}

// Cerrar menú al hacer clic fuera
document.addEventListener('click', (e) => {
    const menu = document.getElementById('video-settings-menu');
    if (menu && !e.target.closest('.video-settings-btn')) {
        menu.classList.remove('show');
    }
});

function exitVideoMode() { 
    const v = document.getElementById('main-video');
    if (v) { 
        v.pause(); 
        v.src = ""; 
    }

    const screen = document.getElementById('cine-screen');
    if (screen) screen.innerHTML = "";

    const view = document.getElementById('view-player');
    if (view) view.classList.add('hidden');

    const loader = document.getElementById('video-loader');
    if (loader) loader.classList.add('hidden');

    document.body.style.overflow = '';

    const sb = document.getElementById('main-sidebar');
    if (sb) sb.classList.remove('hidden');

    ver('library'); 
}

function toggleVideoPlay() {
    const v = document.getElementById('main-video');
    const icon = document.getElementById('video-play-icon');
    if (!v) return;

    if (v.paused) {
        v.play();
        if (icon) icon.className = 'fa-solid fa-pause text-xl md:text-2xl';
    } else {
        v.pause();
        if (icon) icon.className = 'fa-solid fa-play text-xl md:text-2xl ml-0.5';
    }
}

function toggleVideoFullscreen() {
    const v = document.getElementById('main-video');
    if (!v) return;

    if (!document.fullscreenElement) {
        v.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen();
    }
}

function seekVideo() {
    const v = document.getElementById('main-video');
    const progBar = document.getElementById('video-progress');
    if (v && progBar) {
        v.currentTime = progBar.value;
    }
}

function updateVideoProgress() {
    const v = document.getElementById('main-video');
    if (!v || !v.duration) return;

    const progBar = document.getElementById('video-progress');
    const timeCurrent = document.getElementById('video-time-current');

    if (progBar) progBar.value = v.currentTime;
    if (timeCurrent) timeCurrent.innerText = formatTime(v.currentTime);
}

// Sistema de auto-ocultar controles mejorado
let controlsTimeout = null;

function setupMobileControlsToggle() {
    const container = document.getElementById('cine-container');
    const video = document.getElementById('main-video');
    if (!container || !video) return;

    container.classList.add('controls-visible');

    const hideControls = () => {
        clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(() => {
            container.classList.remove('controls-visible');
        }, 3000);
    };

    const toggleControls = (e) => {
        if (e.target.closest('button, input[type="range"]')) return;
        container.classList.toggle('controls-visible');
        if (container.classList.contains('controls-visible')) {
            hideControls();
        }
    };

    video.addEventListener('click', toggleControls);
    
    container.addEventListener('mousemove', () => {
        container.classList.add('controls-visible');
        hideControls();
    });

    video.addEventListener('play', hideControls);
    video.addEventListener('pause', () => {
        clearTimeout(controlsTimeout);
        container.classList.add('controls-visible');
    });

    hideControls();
}



    

        function setFilter(k, v) { 
         discografiaMode = false;
    filters[k] = (filters[k] === v) ? 'default' : v; 
    
    if (['sort'].includes(k)) { 
        // Limpiar botones en DESKTOP
        ['chip-recent', 'chip-top', 'chip-new'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.remove('active', 'bg-emerald-600', 'text-white');
        }); 
        // Limpiar botones en MÓVIL
        ['chip-recent-mobile', 'chip-top-mobile', 'chip-new-mobile'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.remove('active', 'bg-emerald-600', 'text-white');
        }); 
    }
    
    const hero = document.getElementById('artist-hero'); 
    if(k === 'artist' && v !== 'all' && v !== 'default') { 
        hero.classList.remove('hidden'); 
        document.getElementById('hero-name').innerText = v; 
        const count = libData.files.filter(f => f.artist === v).length; 
        document.getElementById('hero-stats').innerText = `${count} Canciones`; 
    } else {
        hero.classList.add('hidden');
    }
    
    renderLimit = renderStep; // ← AGREGAR ESTO
    renderLib(); 
}

        function renderActiveFilters() { 
            const bar = document.getElementById('active-filters-bar'); 
            bar.innerHTML = ""; 
            let hasFilters = false; 
            const mapping = { 'artist': 'Artista', 'album': 'Álbum', 'folder': 'Carpeta', 'playlist': 'Playlist', 'genre': 'Género', 'rating': 'Rating' }; 
            for (const [key, val] of Object.entries(filters)) { 
                if (val !== 'all' && val !== 'default' && mapping[key]) { 
                    hasFilters = true; 
                    bar.innerHTML += `<div class="bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-2"><span>${mapping[key]}: ${val}</span><button onclick="setFilter('${key}', 'default')" class="hover:text-white"><i class="fa-solid fa-xmark"></i></button></div>`; 
                } 
            } 
            if (hasFilters) { 
                bar.classList.remove('hidden'); 
                bar.innerHTML += `<button onclick="goHome()" class="text-[10px] text-emerald-500 hover:text-white underline ml-2">Limpiar todo</button>`; 
            } else { 
                bar.classList.add('hidden'); 
            } 
        }

     async function cargarLib() {
  try {
    setLoaderText("Invocando tu librería 🎵");

    // Si ya hay datos en memoria, mostrarlos de inmediato
    if (window.libData) {
      libData = window.libData;
      renderSidebarLists();
      renderLib();
    }

    // Traer TODA la biblioteca (sin paginación)
    const res = await fetch('/biblioteca');
    setLoaderText("Leyendo archivos...");
    const data = await res.json();

    // Guardar en memoria global
    window.libData = data;
    libData = data;

    if (libData && Array.isArray(libData.files)) {
        libData.files.forEach(f => {
            const title = f.title || '';
            const artist = f.artist || '';
            const album = f.album || '';
            const genre = f.genre || '';
            const folder = f.folder || '';
            const fullFolder = f.full_folder || '';
            f._searchTitle = normalizeText(title);
            f._searchArtist = normalizeText(artist);
            f._searchAlbum = normalizeText(album);
            f._searchGenre = normalizeText(genre);
            f.searchKey = normalizeText(`${title} ${artist} ${album} ${genre} ${folder} ${fullFolder}`);
        });
    }

    setLoaderText("Despertando carátulas 👻");
    renderSidebarLists();

    setLoaderText("Afinando playlists...");
    renderLib();

    setLoaderText("Ya casi ✨");

    // Refresh en segundo plano
    setTimeout(() => refreshLibrary(), 50);

  } catch (e) {
    console.error("Error cargando biblioteca:", e);
    setLoaderText("Algo salió mal 😵");
  } finally {
    const loader = document.getElementById('loader');
    if (loader) loader.classList.add('hidden');
  }
}



       function renderSidebarLists() { 
    const pList = document.getElementById('list-playlists-container'); 
    if(pList) {
        pList.innerHTML = ''; 
        const playlists = Object.keys(libData.playlists).sort(); 
        
        playlists.forEach(p => { 
            const count = libData.playlists[p].length; 
            const isActive = filters.playlist === p || currentLibrary === `playlist:${p}`;
            
            // Estilos Carbono
            const activeClasses = 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]';
            const inactiveClasses = 'bg-white/[0.02] border-white/5 text-emerald-400 hover:bg-white/[0.1] hover:text-white hover:border-white/10';
            
            pList.innerHTML += `
            <div class="group flex items-center justify-between px-3 py-2.5 mb-1 rounded-lg cursor-pointer transition-all duration-200 border ${isActive ? activeClasses : inactiveClasses}">
                
                <div onclick="abrirPlaylist('${escapeStr(p)}')" class="flex-1 flex items-center gap-3 min-w-0">
                    <div class="w-4 h-4 rounded-full flex items-center justify-center ${isActive ? 'bg-emerald-500 text-black' : 'bg-white/5 text-emerald-500 group-hover:bg-emerald-500/20 group-hover:text-emerald-400'} transition">
                        <i class="fa-solid fa-music text-[9px]"></i>
                    </div>
                    <span class="truncate text-[11px] font-medium tracking-wide">${p}</span>
                </div>
                
                <div class="flex items-center gap-2">
                    <span class="text-[9px] font-mono opacity-30 group-hover:hidden transition">${count}</span>
                    
                    <div class="hidden group-hover:flex items-center gap-1">
                        <button 
                            onclick="event.stopPropagation(); renamePlaylist(this.dataset.name)" 
                            data-name="${escapeHtml(p)}"
                            class="w-5 h-5 flex items-center justify-center rounded hover:bg-blue-500/20 text-emerald-500 hover:text-blue-400 transition" 
                            title="Renombrar">
                            <i class="fa-solid fa-pen text-[9px]"></i>
                        </button>
                        <button 
                            onclick="event.stopPropagation(); deletePlaylist(this.dataset.name)" 
                            data-name="${escapeHtml(p)}"
                            class="w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/20 text-emerald-500 hover:text-red-400 transition" 
                            title="Eliminar">
                            <i class="fa-solid fa-trash text-[9px]"></i>
                        </button>
                    </div>
                </div>
            </div>`;
        }); 
    }
}



        function toggleArtist(el, artistName) { 
            if(artistName) setFilter('artist', artistName); 
            const group = el.querySelector('.artist-group'); 
            const icon = el.querySelector('i'); 
            if(group.classList.contains('hidden')) { 
                group.classList.remove('hidden'); 
                icon.style.transform = 'rotate(180deg)'; 
            } else { 
                group.classList.add('hidden'); 
                icon.style.transform = 'rotate(0deg)'; 
            } 
        }

        // --- NUEVAS FUNCIONES DE NAVEGACIÓN ---
        function navigateTo(folderName) {
    currentPath += folderName + "/";
    renderLimit = renderStep; // ← AGREGAR ESTO
    renderLib();
}

function navigateUp() {
    if (!currentPath) return;
    const parts = currentPath.split('/').filter(p => p);
    parts.pop();
    currentPath = parts.length > 0 ? parts.join('/') + "/" : "";
    renderLimit = renderStep; // ← AGREGAR ESTO
    renderLib();
}

function navigateRoot() {
    currentPath = "";
    renderLimit = renderStep; // ← AGREGAR ESTO
    renderLib();
}
        // --------------------------------------

function enterFolderView(folderName) { 
    currentFolderView = folderName;
    
    const btnBack = document.getElementById('btn-back-folder');
    if (btnBack) btnBack.classList.remove('hidden');
    
    const titleDesktop = document.getElementById('lib-title-desktop');
    const titleMobile = document.getElementById('lib-title-mobile');
    
    if (titleDesktop) titleDesktop.innerText = folderName;
    if (titleMobile) titleMobile.innerText = folderName;
    
    renderLib(); 
}
function exitFolderView() { 
    currentFolderView = null;
    
    const btnBack = document.getElementById('btn-back-folder');
    if (btnBack) btnBack.classList.add('hidden');
    
    const titleDesktop = document.getElementById('lib-title-desktop');
    const titleMobile = document.getElementById('lib-title-mobile');
    
    if (titleDesktop) titleDesktop.innerText = "Mis Series y Videos";
    if (titleMobile) titleMobile.innerText = "Mis Series y Videos";
    
    renderLib(); 
}
      function normalizeText(input) {
    return (input || '')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

      function getFilteredTracks() {
    // Inputs de búsqueda
    const mobileInput = document.getElementById('lib-search-mobile');
    const desktopInput = document.getElementById('lib-search-desktop');
    const rawTerm = (mobileInput && mobileInput.value) || (desktopInput && desktopInput.value) || '';
    const term = normalizeText(rawTerm);
    const tokens = term ? term.split(' ') : [];

    let source = libData.files;
    
    // 1. FILTRO DE TIPO (Audio/Video)
    if (filters.playlist === 'all' && !currentLibrary.startsWith('playlist:')) {
        source = source.filter(f => f.type === currentLibrary);
    }

    // 2. FILTRO DE MODO EXPLORADOR (Aquí recortamos la lista primero)
    // Usamos una variable para saber si el recorte ya se hizo
    let isExplorerFiltering = false;

    if (currentView === 'folders' && currentExplorerPath !== '') {
        // Aseguramos que busque la ruta exacta con '/' al final
        source = source.filter(f => f.path.startsWith(currentExplorerPath + '/'));
        isExplorerFiltering = true; // Marcamos que ya filtramos por carpeta
    }
    // 2b. FILTRO POR currentPath EN MODO VIDEO (Netflix/Season view)
    else if (typeof currentPath !== 'undefined' && currentPath !== '' && currentPath !== null) {
        source = source.filter(f => f.path.startsWith(currentPath));
        isExplorerFiltering = true;
    }

    // 3. FILTRO DE PLAYLIST
    else if (filters.playlist !== 'all') {
        const rawPaths = libData.playlists[filters.playlist] || [];
        
        // 1. Limpiamos la lista de invitados (quitamos %20 y barras invertidas)
        // 🛡️ Protegemos con try-catch para rutas malformadas
        const validPaths = new Set(rawPaths.map(p => {
            try {
                return decodeURIComponent(p).replace(/\\\\/g, '/');
            } catch(e) {
                // Si falla decodeURIComponent, la ruta ya está decodificada
                return p.replace(/\\\\/g, '/');
            }
        }));
        
        source = source.filter(f => {
            // 2. Limpiamos el nombre del que quiere entrar
            let myPath;
            try {
                myPath = decodeURIComponent(f.path).replace(/\\\\/g, '/');
            } catch(e) {
                myPath = f.path.replace(/\\\\/g, '/');
            }
            return validPaths.has(myPath);
        });
    }

    // 4. LOOP DE FILTROS BASE
    let filtered = source.filter(f => {
        const title = f._searchTitle || normalizeText(f.title || '');
        const artist = f._searchArtist || normalizeText(f.artist || '');
        const album = f._searchAlbum || normalizeText(f.album || '');
        const genre = f._searchGenre || normalizeText(f.genre || '');
        const searchKey = f.searchKey || normalizeText(`${f.title || ''} ${f.artist || ''} ${f.album || ''} ${f.genre || ''} ${f.folder || ''} ${f.full_folder || ''}`);

        // Búsqueda de texto
        const matchText = tokens.length === 0 || tokens.every(t => searchKey.includes(t));
        
        // 👇 AQUÍ ESTABA EL ERROR 👇
        // Si estamos en modo explorador (isExplorerFiltering), IGNORAMOS el filtro viejo.
        // Si NO estamos en modo explorador, usamos la lógica de siempre.
        let matchFolder = true;
        if (!isExplorerFiltering) {
             matchFolder = (filters.folder === 'all' || f.full_folder === filters.folder);
        }

        const matchArtist = (filters.artist === 'all' || f.artist === filters.artist);
        const matchAlbum  = (filters.album === 'all' || f.album === filters.album);
        const matchGenre  = (filters.genre === 'all' || f.genre === filters.genre);

        let matchRating = true;
        if (filters.rating !== 'all') {
            matchRating = (f.rating && f.rating >= parseInt(filters.rating));
        }

        if (matchText) {
            let score = 0;
            if (term && title.includes(term)) score += 3;
            if (term && artist.includes(term)) score += 2;
            if (term && album.includes(term)) score += 1;
            if (term && genre.includes(term)) score += 1;
            if (tokens.length > 0) {
                score += tokens.reduce((s, t) => s + (searchKey.includes(t) ? 0.5 : 0), 0);
            }
            f._searchScore = score;
        } else {
            f._searchScore = 0;
        }

        return matchText && matchFolder && matchArtist && matchAlbum && matchRating && matchGenre;
    });

    if (term && (filters.sort === 'default' || !filters.sort)) {
        filtered.sort((a, b) => (b._searchScore || 0) - (a._searchScore || 0));
    }

    // -------------------------
    // ORDENAMIENTO (Igual que antes)
    // -------------------------
    switch (filters.sort) {
        case 'az': filtered.sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })); break;
        case 'za': filtered.sort((a, b) => (b.title || '').localeCompare(a.title || '', undefined, { sensitivity: 'base' })); break;
        case 'artist': filtered.sort((a, b) => (a.artist || '').localeCompare(b.artist || '', undefined, { sensitivity: 'base' })); break;
        case 'recent': 
            filtered = filtered.filter(f => f.last_played > 0);
            filtered.sort((a, b) => b.last_played - a.last_played);
            break;
        case 'top':
            filtered = filtered.filter(f => f.play_count > 0);
            filtered.sort((a, b) => b.play_count - a.play_count);
            break;
        case 'new':
            const dayAgo = Date.now() / 1000 - 86400;
            filtered = filtered.filter(f => f.date > dayAgo).sort((a, b) => b.date - a.date);
            break;
    }

    return filtered;
}

 

function renderLib() {
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(() => {
        _renderLibActual();
    }, 150);
}
        function _renderLibActual() {
        console.count("renderLib ejecutado");
         if (discografiaMode) {
        renderDiscografiasView();
        return; 
    }

    // 🛑 2. SI ESTAMOS EN MODO EXPLORADOR DE CARPETAS, QUE SE QUEDE AHÍ
    // (Esta es la parte nueva que evita que te saque al seleccionar)
    if (currentView === 'folders' && typeof renderFolderView === 'function') {
        // Volvemos a renderizar la carpeta actual (manteniendo selección y vista)
        renderFolderView(currentExplorerPath || ''); 
        return;
    }
    renderActiveFilters(); 
    const container = document.getElementById('lib-container'); 
    container.innerHTML = ""; 
    const filtered = getFilteredTracks(); 
        const mixesContainer = document.getElementById('smart-mixes-container'); 
        const mixesGrid = document.getElementById('smart-mixes-grid'); 
        const genreSection = document.getElementById('genre-mixes-section');
        const genreRow = document.getElementById('genre-mixes-row');
        const artistSection = document.getElementById('artist-mixes-section');
        const artistRow = document.getElementById('artist-mixes-row');
    renderLibraryStats();

    

    // --- LÓGICA DE AUDIO (MIXES) ---
    // AQUÃ� ESTÃ� EL CAMBIO
    const mobileInput = document.getElementById('lib-search-mobile');
    const desktopInput = document.getElementById('lib-search-desktop');
    const searchValue = (mobileInput && mobileInput.value) || (desktopInput && desktopInput.value) || '';
    
    // Ocultar botón Auto-Tag en modo audio
    const btnAutoTagAudio = document.getElementById('btn-autotag-video');
    if (btnAutoTagAudio) btnAutoTagAudio.classList.add('hidden');
    
    // Solo mostramos mixes si no hay filtros activos (estamos en "Home")
    if(currentLibrary === 'audio' && filters.folder === 'all' && filters.playlist === 'all' && !searchValue && filters.artist === 'all' && filters.album === 'all') { 
        mixesContainer.classList.remove('hidden');
        mixesGrid.innerHTML = ''; 
        customMixes = {};
        
        // 1. CREAR MIX DE FAVORITOS (Si hay likes)
        const favFiles = libData.files.filter(f => f.rating === 1);
        
        // Preparamos la lista combinada
        // Copiamos los mixes que vienen del servidor (Top50, etc.)
        let mixesToShow = [...(libData.smart_mixes || [])];

        // Si hay favoritos, lo metemos al principio
        if (favFiles.length > 0) {
            const favMix = {
                id: 'smart_favorites',
                name: 'Mis Favoritos',
                icon: 'fa-heart',
                files: favFiles,
                desc: 'Tu selección personal'
            };
            mixesToShow.unshift(favMix); // ¡Primero en la lista!
        }

        // 🎨 PALETA DE COLORES INTELIGENTE
        const styles = {
            // VERDE TÓXICO PARA FAVORITOS 💚
            'smart_favorites': { 
                from: 'from-emerald-600/20', to: 'to-black', 
                border: 'border-emerald-500/50 hover:border-emerald-400', 
                icon: 'text-emerald-500',
                glow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]'
            },
            // Otros estilos
            'smart_top50':   { from: 'from-orange-500/10', to: 'to-red-500/5',    border: 'border-orange-500/20 hover:border-orange-500', icon: 'text-orange-500', glow: '' },
            'smart_new':     { from: 'from-teal-500/10',   to: 'to-cyan-500/5',   border: 'border-teal-500/20 hover:border-teal-500',     icon: 'text-teal-400', glow: '' },
            'smart_shuffle': { from: 'from-blue-500/10',   to: 'to-indigo-500/5', border: 'border-blue-500/20 hover:border-blue-400',     icon: 'text-blue-400', glow: '' },
            'smart_gems':    { from: 'from-purple-500/10',  to: 'to-pink-500/5',   border: 'border-purple-500/20 hover:border-purple-400',  icon: 'text-purple-400', glow: '' }
        };

        // Renderizamos la lista combinada
        mixesToShow.forEach(mix => { 
            // Si no hay estilo definido, usamos uno neutro
            const s = styles[mix.id] || { from: 'from-zinc-800', to: 'to-zinc-900', border: 'border-white/10 hover:border-white/30', icon: 'text-zinc-400', glow: '' };
            
            mixesGrid.innerHTML += `
            <div onclick="playMix('${mix.id}')" 
                 class="relative overflow-hidden h-32 flex flex-col justify-between p-4 rounded-xl cursor-pointer transition-all duration-300 group
                        bg-gradient-to-br ${s.from} ${s.to} bg-[#121212]
                        border ${s.border} hover:scale-[1.02] ${s.glow || 'hover:shadow-[0_0_20px_rgba(0,0,0,0.4)]'}">
                
                <div class="absolute -right-4 -top-4 opacity-[0.05] group-hover:opacity-10 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110 pointer-events-none">
                    <i class="fa-solid ${mix.icon} text-9xl text-white"></i>
                </div>
                
                <div class="text-2xl ${s.icon} drop-shadow-md group-hover:scale-110 transition-transform origin-left">
                    <i class="fa-solid ${mix.icon}"></i>
                </div>
                
                <div class="relative z-10">
                    <h3 class="font-bold text-white leading-tight text-sm md:text-base group-hover:text-white transition">${mix.name}</h3>
                    <p class="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1 group-hover:text-zinc-400 transition">
                        ${mix.files.length} canciones
                    </p>
                </div>
                
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center backdrop-blur-[1px]">
                    <div class="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center shadow-2xl scale-50 group-hover:scale-100 transition-transform duration-300">
                        <i class="fa-solid fa-play ml-1 text-sm"></i>
                    </div>
                </div>
            </div>`; 
        }); 

        const audioFiles = libData.files.filter(f => f.type === 'audio');
        const genreMap = {};
        const artistMap = {};
        const genreIgnore = new Set(['Otros', 'Unknown', 'Generos']);

        audioFiles.forEach(f => {
            const genre = (f.genre || '').trim();
            if (genre && !genreIgnore.has(genre)) {
                if (!genreMap[genre]) genreMap[genre] = [];
                genreMap[genre].push(f.path);
            }
            const artist = (f.artist || '').trim();
            if (artist && artist !== 'Desconocido') {
                if (!artistMap[artist]) artistMap[artist] = [];
                artistMap[artist].push(f.path);
            }
        });

        const genreMixes = Object.entries(genreMap)
            .map(([name, paths]) => {
                const shuffled = shuffleArray(paths).slice(0, 50);
                return {
                    id: `genre:${normalizeText(name).replace(/\s+/g, '-')}`,
                    name,
                    files: shuffled,
                    count: shuffled.length,
                    cover: shuffled[0]
                };
            })
            .filter(m => m.count >= 3)
            .sort((a, b) => b.count - a.count)
            .slice(0, 40);

        const artistMixes = Object.entries(artistMap)
            .map(([name, paths]) => {
                const shuffled = shuffleArray(paths).slice(0, 50);
                return {
                    id: `artist:${normalizeText(name).replace(/\s+/g, '-')}`,
                    name,
                    files: shuffled,
                    count: shuffled.length,
                    cover: shuffled[0]
                };
            })
            .filter(m => m.count >= 3)
            .sort((a, b) => b.count - a.count)
            .slice(0, 40);

        genreMixes.forEach(m => { customMixes[m.id] = m; });
        artistMixes.forEach(m => { customMixes[m.id] = m; });

        if (genreMixes.length > 0) {
            genreSection.classList.remove('hidden');
            renderHorizontalMixRow(genreRow, genreMixes);
        } else {
            genreSection.classList.add('hidden');
        }

        if (artistMixes.length > 0) {
            artistSection.classList.remove('hidden');
            renderHorizontalMixRow(artistRow, artistMixes);
        } else {
            artistSection.classList.add('hidden');
        }
    } else { 
        mixesContainer.classList.add('hidden');
        if (genreSection) genreSection.classList.add('hidden');
        if (artistSection) artistSection.classList.add('hidden');
    } 
            
            if(!filtered.length) return container.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center py-20 text-emerald-600 gap-4"><i class="fa-solid fa-ghost text-4xl"></i><p>Nada por aquí...</p></div>'; 

            // --- LÓGICA DE VIDEO MEJORADA (RESPETA LISTA/GRID) ---
            if (currentLibrary === 'video') {
                mixesContainer.classList.add('hidden');
                
                // Mostrar botón Auto-Tag en modo video
                const btnAutoTag = document.getElementById('btn-autotag-video');
                if (btnAutoTag) btnAutoTag.classList.remove('hidden');
                
                // 1. CONFIGURAR EL CONTENEDOR SEGÚN LA VISTA ACTIVA
                // Si es LISTA, usamos flex columna. Si es GRID, usamos la rejilla.
                if (viewMode === 'list') {
                    container.className = "flex flex-col gap-1";
                } else {
                    container.className = `grid ${zoomLevels[currentZoomIndex]} gap-4`;
                }

                // 2. BARRA DE NAVEGACIÓN Y BOTÓN "SUBIR"
                if (currentPath !== "") {
    const parts = currentPath.split('/').filter(p=>p);
    let breadcrumbHtml = `<span class="opacity-50 cursor-pointer hover:text-white" onclick="navigateRoot()">Inicio</span>`;
    let accumPath = "";
    parts.forEach(p => {
        accumPath += p + "/";
        breadcrumbHtml += ` <i class="fa-solid fa-chevron-right text-[10px] mx-1 opacity-30"></i> <span class="cursor-pointer hover:text-emerald-400" onclick="currentPath='${accumPath}'; renderLib();">${p}</span>`;
    });
    
    const titleDesktop = document.getElementById('lib-title-desktop');
    const titleMobile = document.getElementById('lib-title-mobile');
    if (titleDesktop) titleDesktop.innerHTML = breadcrumbHtml;
    if (titleMobile) titleMobile.innerHTML = breadcrumbHtml;
                    
                    // BOTÓN SUBIR ADAPTATIVO
                    if (viewMode === 'list') {
                        // Diseño tipo BARRA (para modo Lista)
                        container.innerHTML += `
                        <div onclick="navigateUp()" class="w-full bg-[#121212] p-3 rounded-xl hover:bg-[#1e1e1e] transition cursor-pointer group flex items-center justify-center border-2 border-dashed border-white/10 hover:border-emerald-500/50 mb-2">
                            <i class="fa-solid fa-reply text-emerald-500 group-hover:text-emerald-400 mr-2 transition"></i>
                            <span class="text-xs font-bold text-emerald-400 group-hover:text-white">Subir un nivel</span>
                        </div>`;
                    } else {
                        // Diseño tipo TARJETA CUADRADA (para modo Grid)
                        container.innerHTML += `
                        <div onclick="navigateUp()" class="bg-[#121212] p-3 rounded-xl hover:bg-[#1e1e1e] transition cursor-pointer group flex flex-col items-center justify-center border-2 border-dashed border-white/10 hover:border-emerald-500/50 aspect-square">
                            <i class="fa-solid fa-reply text-3xl text-emerald-500 group-hover:text-emerald-400 mb-2 transition"></i>
                            <span class="text-xs font-bold text-emerald-400 group-hover:text-white">Subir</span>
                        </div>`;
                    }
                } else {
    const titleDesktop = document.getElementById('lib-title-desktop');
    const titleMobile = document.getElementById('lib-title-mobile');
    if (titleDesktop) titleDesktop.innerText = "Mis Series y Videos";
    if (titleMobile) titleMobile.innerText = "Mis Series y Videos";
}



                // 3. FILTRAR Y AGRUPAR ARCHIVOS
                const relevantFiles = filtered.filter(f => f.path.startsWith(currentPath));
                const groups = {}; 
                const directFiles = [];

                relevantFiles.forEach(f => {
                    const rel = f.path.substring(currentPath.length);
                    const parts = rel.split('/');

                    if (parts.length === 1) {
                        directFiles.push(f);
                    } else {
                        const subFolder = parts[0];
                        if (!groups[subFolder]) groups[subFolder] = { isSeason: true, files: [] };
                        if (parts.length > 2) groups[subFolder].isSeason = false;
                        groups[subFolder].files.push(f);
                    }
                });
// ============================================================
                // AGREGAR ESTO AQUÍ (AUTO-SALTO)
                // ============================================================
                if (currentPath === "" && directFiles.length === 0 && Object.keys(groups).length === 1) {
                    const uniqueFolder = Object.keys(groups)[0];
                    // Solo saltamos si la carpeta se llama "Video" (o si quieres que salte cualquier carpeta única)
                    if (uniqueFolder === 'Video') { 
                        currentPath = uniqueFolder + "/";
                        renderLib(); // Recargamos inmediatamente con la nueva ruta
                        return;
                    }
                }

                // 4. RENDERIZAR CARPETAS (Niveles altos)
                Object.keys(groups).sort().forEach(name => {
                    if (!groups[name].isSeason) {
                        const sample = groups[name].files[0];
                        const count = groups[name].files.length;
                        
                        // Las carpetas siempre se ven mejor como tarjeta, incluso en modo lista, 
                        // pero si prefieres lista pura, podemos cambiarlo. Por ahora lo dejo híbrido:
                        if (viewMode === 'list') {
                             container.innerHTML += `
                            <div data-folder="${name}" onclick="navigateTo(this.dataset.folder)" class="list-row group bg-[#121212] border-l-4 border-transparent hover:border-emerald-500 hover:bg-[#1e1e1e] cursor-pointer flex items-center p-2 gap-4">
                                <i class="fa-solid fa-folder text-2xl text-emerald-500 group-hover:text-emerald-400 ml-2"></i>
                                <span class="font-bold text-white flex-1">${name}</span>
                                <span class="text-[10px] bg-emerald-800 text-emerald-400 px-2 py-0.5 rounded">${count} items</span>
                                <i class="fa-solid fa-chevron-right text-emerald-600 mr-2"></i>
                            </div>`;
                        } else {
                            container.innerHTML += `
                            <div data-folder="${name}" onclick="navigateTo(this.dataset.folder)" class="bg-[#121212] p-3 rounded-xl hover:bg-[#1e1e1e] transition cursor-pointer group relative shadow-lg border border-white/5">
                                <div class="relative w-full aspect-square bg-[#0a0a0a] rounded-lg overflow-hidden mb-3">
                                    <img src="/caratula/${sample.path}" class="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition group-hover:scale-110">
                                    <div class="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-transparent transition">
                                        <i class="fa-solid fa-folder text-5xl text-white/80 drop-shadow-lg group-hover:text-emerald-400 transition"></i>
                                    </div>
                                    <span class="absolute bottom-1 right-1 bg-emerald-600 text-[10px] text-white px-2 py-0.5 rounded font-bold shadow">${count}</span>
                                </div>
                                <h3 class="font-bold text-white truncate text-sm text-center group-hover:text-emerald-400 transition">${name}</h3>
                            </div>`;
                        }
                    }
                });

                // 5. RENDERIZAR TEMPORADAS (Lista expandida)
                const seasonNames = Object.keys(groups).sort();
                
                // GENERADOR DE PILLS DE TEMPORADAS
                if (seasonNames.filter(n => groups[n].isSeason).length > 1) {
                    const seasonPills = seasonNames
                        .filter(n => groups[n].isSeason)
                        .map(name => {
                            const isActive = currentFolderView === name;
                            return `<button onclick="goToSeason('${name}')" class="px-3 py-1.5 rounded-full text-xs font-bold transition ${isActive ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}">${name}</button>`;
                        }).join('');
                    
                    container.innerHTML += `
                    <div class="col-span-full mb-4 flex flex-wrap gap-2 items-center">
                        <span class="text-xs font-bold text-emerald-400 uppercase tracking-wider mr-2">Temporadas:</span>
                        ${seasonPills}
                    </div>`;
                }
                
                // Función para navegar a temporada
                window.goToSeason = function(seasonName) {
                    const safeName = seasonName.replace(/[^a-zA-Z0-9]/g, '-');
                    const el = document.getElementById('season-' + safeName);
                    if (el) {
                        el.scrollIntoView({behavior: 'smooth', block: 'start'});
                        currentFolderView = seasonName;
                    }
                };
                
                seasonNames.forEach(name => {
                    if (groups[name].isSeason) {
                        const safeName = name.replace(/[^a-zA-Z0-9]/g, '-');
                        container.innerHTML += `
                        <div id="season-${safeName}" class="col-span-full mt-6 mb-2 flex items-center gap-4 border-b border-white/10 pb-2">
                            <h3 class="text-xl font-bold text-emerald-400 tracking-wider uppercase"><i class="fa-solid fa-layer-group mr-2"></i>${name}</h3>
                            <span class="text-xs text-emerald-500 font-mono bg-emerald-900 px-2 py-1 rounded-full">${groups[name].files.length} caps</span>
                        </div>`;
                        
                        const sortedFiles = groups[name].files.sort((a, b) => a.title.localeCompare(b.title, undefined, {numeric: true, sensitivity: 'base'}));
                        sortedFiles.forEach(f => {
                            if (viewMode === 'list') container.innerHTML += createListRow(f);
                            else container.innerHTML += createCard(f);
                        });
                    }
                });

               // 6. RENDERIZAR ARCHIVOS SUELTOS
            if (directFiles.length > 0) {
                if (Object.keys(groups).length > 0) {
                    container.innerHTML += `<div class="col-span-full mt-6 mb-2 text-sm font-bold text-emerald-400 uppercase tracking-widest border-b border-white/10 pb-1">Otros Archivos</div>`;
                }
                directFiles.sort((a, b) => a.title.localeCompare(b.title)).forEach(f => {
                    if (viewMode === 'list') container.innerHTML += createListRow(f);
                    else container.innerHTML += createCard(f);
                });
            }
            
            // ✅ Lazy load y salir SOLO del bloque de video
            observeLazyImages();
            
            return;
        } // ⬅️ ESTA LLAVE FALTABA - cierra el if (currentLibrary === 'video')

        // --- LÓGICA POR DEFECTO (AUDIO LISTA/GRID) ---
       let filesToShow = filtered.slice(0, renderLimit);

if (viewMode === 'list') { 
    container.className = "space-y-1"; 
    container.innerHTML = filesToShow.map(f => createListRow(f)).join(''); 
} else { 
    container.className = `grid ${zoomLevels[currentZoomIndex]} gap-4`; 
    container.innerHTML = filesToShow.map(f => createCard(f)).join(''); 
}

// Botón “Cargar más”
if (filtered.length > renderLimit) {
    container.innerHTML += `
        <div class="col-span-full flex justify-center mt-6">
            <button onclick="cargarMas()" 
                class="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-xl transition font-bold">
                ➕ Cargar más (${Math.min(renderStep, filtered.length - renderLimit)} más)
            </button>
        </div>`;

 }               


// Lazy load de carátulas
observeLazyImages();


   

}
function cargarMas() {
    renderLimit += renderStep;
    renderLib();
}

function resetRenderLimit() {
    renderLimit = renderStep;
}

function mostrarTodos() {
    window.showAllFiles = true;
    renderLib();
}
function createCard(f) { 
    const safePath = escapeStr(f.path); 
    const coverUrl = `/caratula/${f.path.split('/').map(p => encodeURIComponent(p)).join('/')}`;
    const isSel = selectedFiles.has(f.path) ? 'ring-2 ring-emerald-500 bg-emerald-900/20' : 'bg-[#121212]'; 
    
    // ⭐ INDICADOR DE FAVORITO (Corazón en la esquina)
    const isFavorite = f.rating === 1;
    const favBadge = isFavorite ? `
        <div class="absolute top-2 left-2 z-20 w-6 h-6 bg-black/60 backdrop-blur rounded-full flex items-center justify-center animate-pulse">
            <i class="fa-solid fa-heart text-emerald-400 text-xs drop-shadow-[0_0_6px_rgba(16,185,129,0.9)]"></i>
        </div>` : '';
    
    const genreTag = f.genre ? `<span class="text-[9px] text-emerald-500 bg-emerald-900/20 px-1.5 rounded">${f.genre}</span>` : ''; 
    const inPlaylistIcon = f.playlists.length > 0 ? `<i class="fa-solid fa-check-circle text-[9px] text-emerald-400 ml-1 opacity-80" title="En playlist"></i>` : ''; 

    let pName = null;
    if (typeof currentLibrary !== 'undefined' && currentLibrary.startsWith('playlist:')) {
        pName = currentLibrary.split(':')[1];
    } else if (typeof filters !== 'undefined' && filters.playlist && filters.playlist !== 'all') {
        pName = filters.playlist;
    }

    let removeBtn = '';
    if (pName) {
        // Usamos data-path para pasar la ruta SIN escapar al JS
        removeBtn = `<button 
            onclick="event.stopPropagation(); quitarDeListaRow('${escapeStr(pName)}', this.dataset.path, event)" 
            data-path="${escapeHtml(f.path)}"
            class="w-7 h-7 bg-black/60 backdrop-blur rounded-full flex items-center justify-center text-white hover:scale-110 hover:text-orange-500 transition" 
            title="Quitar de '${escapeHtml(pName)}'">
            <i class="fa-solid fa-minus text-[10px]"></i>
        </button>`;
    }

   // ============================================================
    // 🎨 BOTONES LIMPIOS (Fix Comillas + Sin Offline)
    // ============================================================

    // 1. VACUNA ANTI-COMILLAS (Indispensable)
    const clickPath = safePath.replace(/'/g, "\\'"); 

    // 2. Botones con data-path para evitar problemas de escapado
    const favBtn = `<button 
        onclick="event.stopPropagation(); toggleCardFavorite(this.dataset.path)" 
        data-path="${escapeHtml(f.path)}"
        class="w-7 h-7 bg-black/60 backdrop-blur rounded-full flex items-center justify-center text-white hover:scale-110 transition ${isFavorite ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'hover:text-emerald-400'}" 
        title="${isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}">
        <i class="fa-${isFavorite ? 'solid' : 'regular'} fa-heart text-[10px]"></i>
    </button>`;

    const queueBtn = `<button 
        onclick="event.stopPropagation(); enqueue(this.dataset.path)" 
        data-path="${escapeHtml(f.path)}"
        class="w-7 h-7 bg-black/60 backdrop-blur rounded-full flex items-center justify-center text-white hover:scale-110 hover:text-emerald-400 transition" 
        title="Encolar">
        <i class="fa-solid fa-layer-group text-[10px]"></i>
    </button>`;

    const editBtn = `<button 
        onclick="event.stopPropagation(); abrirEditorMasivo(this.dataset.path)" 
        data-path="${escapeHtml(f.path)}"
        class="w-7 h-7 bg-black/60 backdrop-blur rounded-full flex items-center justify-center text-white hover:scale-110 hover:text-yellow-400 transition" 
        title="Editar Info">
        <i class="fa-solid fa-pen-to-square text-[10px]"></i>
    </button>`;

    // EL BOTÓN DEL MENÚ (Usa data-path)
    const menuBtn = `<button 
        onclick="openContextMenu(event, this.dataset.path)" 
        data-path="${escapeHtml(f.path)}"
        class="w-7 h-7 bg-black/60 backdrop-blur rounded-full flex items-center justify-center text-white hover:scale-110 transition hover:text-white pointer-events-auto" 
        title="Más opciones">
        <i class="fa-solid fa-ellipsis-vertical text-[10px]"></i>
    </button>`;

    // 3. AGRUPAR (Z-Index alto)
    const actionBtns = selectionMode ? '' : `
    <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex flex-col gap-1 z-[200]">
        ${favBtn}
        ${queueBtn}
        ${editBtn}
        ${menuBtn}
    </div>`;
    
    return `
    <div class="${isSel} p-3 rounded-xl hover:bg-[#1e1e1e] transition duration-300 group cursor-pointer relative shadow-lg border border-white/5 hover:border-white/10" 
         data-path="${escapeHtml(f.path)}"
         onclick="playNow(this.dataset.path)">
        <div class="relative w-full aspect-square bg-[#0a0a0a] rounded-lg overflow-hidden mb-2 shadow-inner flex items-center justify-center">
            ${favBadge}
            <img data-src="${coverUrl}"
                 class="lazy-img w-full h-full object-cover transition duration-500 group-hover:scale-105 z-10 relative"
                 onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden'); this.nextElementSibling.classList.add('flex')">
            
            <div class="absolute inset-0 hidden items-center justify-center bg-emerald-800 z-0"><i class="fa-solid ${f.type==='video'?'fa-film':'fa-music'} text-4xl text-white/50"></i></div>
            
            <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center backdrop-blur-[2px] z-20 gap-2">
                ${selectionMode ? '<i class="fa-regular fa-square-check text-4xl text-white"></i>' : `<div class="w-10 h-10 bg-emerald-500 text-black rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition"><i class="fa-solid fa-play ml-1"></i></div>`}
            </div>
        </div>
        
        <h3 class="font-bold text-white truncate text-xs mb-0.5 leading-tight flex items-center gap-1">
            ${f.title} ${inPlaylistIcon}
        </h3>
        
        <div class="flex justify-between items-center">
    <button onclick="event.stopPropagation(); verArtista(this.dataset.artist)" 
            data-artist="${escapeHtml(f.artist)}"
            class="text-[10px] text-emerald-400 truncate flex-1 text-left hover:text-white hover:underline transition z-20 relative">
        ${f.artist}
    </button>
    ${genreTag}
</div>
        
        ${actionBtns}
    </div>`; 
}

        /* --- REEMPLAZAR LA FUNCIÓN createListRow --- */
function createListRow(f) { 
    // 🛡️ VACUNA TOTAL: Usamos encodeURIComponent. 
    // Esto convierte "Guns N' Roses" en "Guns%20N'%20Roses" para que no rompa el HTML.
    const pathEncoded = encodeURIComponent(f.path);
    
    // Para la imagen, también codificamos cada parte de la ruta
    const coverUrl = `/caratula/${f.path.split('/').map(p => encodeURIComponent(p)).join('/')}`;
    
    const isSel = selectedFiles.has(f.path) ? 'selected border-l-4 border-emerald-500 bg-emerald-900/20' : 'border-l-4 border-transparent'; 
    const isFavorite = f.rating === 1;

    // 1. GÉNERO (Tu diseño original)
    const genreTag = f.genre ? 
        `<div class="hidden lg:flex items-center mr-6">
            <span class="text-[9px] text-emerald-400 border border-emerald-700/50 bg-emerald-900/30 px-2 py-0.5 rounded-full hover:border-emerald-500 hover:text-emerald-400 transition cursor-default tracking-wide uppercase">
                ${f.genre}
            </span>
         </div>` : ''; 

    // 2. REPRODUCCIONES
    const plays = f.play_count || 0; 
    const playsHtml = `
        <div class="hidden md:flex items-center justify-end w-16 text-emerald-500 text-[10px] mr-6 font-mono group-hover:text-emerald-300 opacity-60 group-hover:opacity-100 transition" title="${plays} reproducciones">
            <span class="mr-2">${plays}</span>
            <i class="fa-solid fa-play text-[8px]"></i>
        </div>`;

    // 3. LOGICA PLAYLIST (Botón quitar)
    let pName = null;
    if (typeof currentLibrary !== 'undefined' && currentLibrary.startsWith('playlist:')) {
        pName = currentLibrary.split(':')[1];
    } else if (typeof filters !== 'undefined' && filters.playlist && filters.playlist !== 'all') {
        pName = filters.playlist;
    }

    let removeBtn = '';
    if (pName) {
        // Usamos data-path para pasar la ruta original sin encoding
        removeBtn = `<button 
            onclick="event.stopPropagation(); quitarDeListaRow(this.dataset.playlist, this.dataset.path, event)" 
            data-playlist="${escapeHtml(pName)}"
            data-path="${escapeHtml(f.path)}"
            class="w-8 h-8 flex items-center justify-center text-emerald-500 hover:text-orange-500 rounded-full hover:bg-white/10 transition" 
            title="Quitar de lista">
            <i class="fa-solid fa-minus text-xs"></i>
        </button>`;
    }
    
    // ⭐ BOTÓN FAVORITO
    const favBtn = `<button 
        onclick="event.stopPropagation(); toggleCardFavorite(this.dataset.path, true)" 
        data-path="${escapeHtml(f.path)}"
        class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition ${isFavorite ? 'text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.6)]' : 'text-zinc-500 hover:text-emerald-400'}" 
        title="${isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}">
        <i class="fa-${isFavorite ? 'solid' : 'regular'} fa-heart text-xs"></i>
    </button>`;

    // 📥 BOTÓN ENCOLAR
    const queueBtn = `<button 
        onclick="event.stopPropagation(); enqueue(this.dataset.path)" 
        data-path="${escapeHtml(f.path)}"
        class="w-8 h-8 flex items-center justify-center text-emerald-400 hover:text-emerald-300 rounded-full hover:bg-white/10 transition" title="Encolar">
        <i class="fa-solid fa-layer-group text-xs"></i>
    </button>`;

const editBtn = `<button 
        onclick="event.stopPropagation(); abrirEditorMasivo(this.dataset.path)" 
        data-path="${escapeHtml(f.path)}"
        class="w-7 h-7 bg-black/60 backdrop-blur rounded-full flex items-center justify-center text-white hover:scale-110 hover:text-yellow-400 transition" 
        title="Editar Info">
        <i class="fa-solid fa-pen-to-square text-[10px]"></i>
    </button>`;

const playlistBtn = `
    <button 
        class="text-zinc-500 hover:text-purple-400 transition px-2"
        title="Añadir a Playlist"
        data-path="${escapeHtml(f.path)}"
        onclick="event.stopPropagation(); openPlaylistModal(this.dataset.path)">
        <i class="fa-solid fa-list-ul"></i>
    </button>
    `;

    // 💣 BOTÓN MENÚ ESCRITORIO
    const menuBtn = `<button 
        onclick="openContextSafe(event, this.dataset.path)" 
        data-path="${escapeHtml(f.path)}"
        class="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition pointer-events-auto" 
        title="Más opciones">
        <i class="fa-solid fa-ellipsis-vertical text-sm"></i>
    </button>`;

    // 4. AGRUPAR BOTONES
    const actionBtns = selectionMode ? '' : `
    <div class="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition px-2 shrink-0 mr-auto z-20">
        ${favBtn}
        ${queueBtn}
        ${playlistBtn}
        ${removeBtn}
        ${menuBtn}
    </div>`; 

    // 📱 BOTÓN MÓVIL (El importante)
    // Aquí cambiamos md:hidden por lg:hidden para asegurar que se vea en tablets y horizontal
    // Y usamos data-path
    const mobileMenuBtn = `<button 
        onclick="openContextMenu(event, this.dataset.path)" 
        data-path="${escapeHtml(f.path)}"
        class="lg:hidden text-emerald-500 pl-4 py-4 pointer-events-auto z-20 active:scale-125 transition-transform w-12 flex justify-center items-center">
        <i class="fa-solid fa-ellipsis-vertical text-lg"></i>
    </button>`;

    return `
    <div class="list-row group ${isSel} flex items-center p-2 hover:bg-white/5 rounded-lg mb-1 transition border-b border-white/5 relative cursor-pointer" 
         data-path="${escapeHtml(f.path)}"
         onclick="playNow(this.dataset.path)">
        
        <div class="relative w-10 h-10 shrink-0 rounded overflow-hidden mr-4 shadow-sm group-hover:shadow-md transition bg-[#0a0a0a]">
            ${isFavorite ? '<div class="absolute top-0 left-0 z-20 w-4 h-4 bg-black/80 rounded-br flex items-center justify-center"><i class="fa-solid fa-heart text-emerald-400 text-[8px] drop-shadow-[0_0_3px_rgba(16,185,129,0.8)]"></i></div>' : ''}
            <img data-src="${coverUrl}"
                 class="lazy-img w-full h-full object-cover relative z-10"
                 onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden'); this.nextElementSibling.classList.add('flex')">
            <div class="absolute inset-0 hidden items-center justify-center bg-emerald-800 z-0">
                <i class="fa-solid ${f.type==='video'?'fa-film':'fa-music'} text-white/50 text-xs"></i>
            </div>
            <div class="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center z-20">
                <i class="fa-solid fa-play text-white text-xs"></i>
            </div>
            ${selectionMode ? '<div class="absolute inset-0 bg-emerald-500/80 flex items-center justify-center z-30"><i class="fa-solid fa-check text-white"></i></div>' : ''}
        </div>
        
        <div class="flex-1 min-w-0 flex flex-col justify-center mr-4">
            <div class="text-gray-200 group-hover:text-white font-medium text-sm leading-tight truncate flex items-center">
                ${f.title} ${f.playlists && f.playlists.length > 0 ? '<i class="fa-solid fa-check-circle text-[10px] text-emerald-500 ml-2 opacity-50" title="En playlist"></i>' : ''}
            </div>
            <div class="text-sm text-zinc-400 truncate cursor-pointer hover:text-purple-400 hover:underline"
     title="Ver información del artista"
     data-artist="${escapeHtml(f.artist)}"
     onclick="event.stopPropagation(); verArtista(this.dataset.artist)">
    ${escapeHtml(f.artist)}
</div>
        </div>

        ${actionBtns}
        ${playsHtml}
        ${genreTag}
        
        <div class="text-[11px] font-mono text-emerald-500 w-10 text-right mr-2 group-hover:text-emerald-300">
            ${f.duration || '--:--'}
        </div>
        
        ${mobileMenuBtn}
    </div>`; 
}

function openContextSafe(e, encodedPath) {
    if(e) {
        e.preventDefault();
        e.stopPropagation(); // 🛑 ¡ESTO DETIENE LA REPRODUCCIÓN!
    }
    const path = decodeURIComponent(encodedPath);
    openContextMenu(e, path);
}

// Reproduce desde el clic principal
function playNowEncoded(encodedPath) {
    // Si estamos en modo selección, no reproducir
    if (typeof selectionMode !== 'undefined' && selectionMode) {
        selectRow(decodeURIComponent(encodedPath));
        return;
    }
    playNow(decodeURIComponent(encodedPath));
}

// Encolar seguro
function enqueueEncoded(encodedPath) {
    enqueue(decodeURIComponent(encodedPath));
}

function toggleCardFavorite(encodedPath, isEncoded) {
    const path = isEncoded ? decodeURIComponent(encodedPath) : encodedPath;
    
    // Llamamos a la lógica original (la que ya tenías programada antes)
    // Asumiendo que tu lógica original es buscar el archivo y cambiar el rating:
    const file = libData.files.find(f => f.path === path);
    if (file) {
        const newRating = file.rating === 1 ? 0 : 1;
        rateTrack(path, newRating); // O como se llame tu función de rating
    }
}


function toggleShuffle() {
  isShuffleOn = !isShuffleOn;
  syncPlayerUI();
  }
function updateQueueUI() {
    const list = document.getElementById('queue-list');
    if (!list) return;

    // ✅ ACTUALIZAR TODOS LOS CONTADORES (móvil Y desktop)
    const countBadges = document.querySelectorAll('#queue-count'); // 👈 Busca TODOS
    countBadges.forEach(badge => {
        if (playerQueue.length > 0) {
            badge.innerText = playerQueue.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });

    if (playerQueue.length === 0) {
        list.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-emerald-600 opacity-50">
                <i class="fa-solid fa-layer-group text-3xl mb-2"></i>
                <p class="text-xs mt-2">Cola vacía</p>
            </div>`;
        return;
    }

    list.innerHTML = playerQueue.map((track, i) => {
        const isPlaying = i === currentTrackIndex;
        const playingClass = isPlaying ? 'playing' : '';

        let imgHtml = '';
        let subText = '';

        if (track.type === 'video') {
            imgHtml = `
                <div class="queue-img-container flex items-center justify-center bg-emerald-800">
                    <i class="fa-solid fa-film text-emerald-500 text-lg"></i>
                </div>`;
            subText = `<div class="text-[9px] text-emerald-500 truncate">${track.folder || 'Video'}</div>`;
        } else {
            const safePath = track.path.split('/').map(p => encodeURIComponent(p)).join('/');
            imgHtml = `
                <div class="queue-img-container relative">
                    <img src="/caratula/${safePath}" 
                         class="queue-img"
                         onerror="this.style.display='none'; this.parentElement.classList.add('bg-emerald-800');">
                    <div class="absolute inset-0 hidden items-center justify-center bg-emerald-800">
                        <i class="fa-solid fa-music text-white/50 text-xs"></i>
                    </div>
                </div>`;
            subText = `<div class="text-[9px] text-emerald-400 truncate">${track.artist}</div>`;
        }

        return `
            <div class="queue-item ${playingClass}" data-index="${i}">
                <div class="flex items-center gap-2 flex-1 min-w-0 cursor-pointer" onclick="jumpToTrack(${i})">
                    ${imgHtml}
                    <div class="queue-info min-w-0">
                        <div class="queue-title truncate text-xs font-bold text-white">${track.title}</div>
                        ${subText}
                    </div>
                </div>
                <button onclick="event.stopPropagation(); removeFromQueue(${i})"
                        class="text-emerald-400 hover:text-red-500 shrink-0 px-2">
                    <i class="fa-solid fa-xmark text-xs"></i>
                </button>
            </div>`;
    }).join('');

    // 🎯 DRAG & DROP (tu código original sigue igual)
    const queueItems = list.querySelectorAll('.queue-item');
    queueItems.forEach((item, index) => {
        item.draggable = true;
        item.style.cursor = 'grab';

        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index);
            item.style.opacity = '0.5';
            item.style.cursor = 'grabbing';
        });

        item.addEventListener('dragend', () => {
            item.style.opacity = '1';
            item.style.cursor = 'grab';
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const toIndex = index;

            if (fromIndex === toIndex) return;

            const [moved] = playerQueue.splice(fromIndex, 1);
            playerQueue.splice(toIndex, 0, moved);

            if (currentTrackIndex === fromIndex) {
                currentTrackIndex = toIndex;
            } else if (fromIndex < currentTrackIndex && toIndex >= currentTrackIndex) {
                currentTrackIndex--;
            } else if (fromIndex > currentTrackIndex && toIndex <= currentTrackIndex) {
                currentTrackIndex++;
            }

            updateQueueUI();
        });
    });
}     
function togglePlay() { if(!audioElement.src) return; if(audioElement.paused) audioElement.play(); else audioElement.pause(); }
function updateProgress() { 
    if (!audioElement.duration) return; 
    const curr = audioElement.currentTime; 
    
    // Lista de todos los IDs de barras y etiquetas que existen en tu HTML
    const bars = ['prog-bar', 'prog-bar-desktop', 'fp-prog'];
    const currentLabels = ['time-current', 'time-current-desktop'];
    const totalLabels = ['time-total', 'time-total-desktop'];

    // Actualizar todas las barras de progreso presentes
    bars.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = curr;
    });
    
    // Actualizar todos los contadores de tiempo actual
    currentLabels.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerText = formatTime(curr);
    });
    
    // Actualizar duraciones totales si aún no se han puesto
    totalLabels.forEach(id => {
        const el = document.getElementById(id);
        if(el && (el.innerText === "0:00" || el.innerText === "")) {
            el.innerText = formatTime(audioElement.duration);

            
        }
        const modal = document.getElementById('fullscreen-player');
if (modal && !modal.classList.contains('hidden')) {
    syncFullscreenPlayer();
}
    });
}

// 🔧 REEMPLAZA ESTA FUNCIÓN (línea ~1847)
function openFullScreenPlayer() {
    if (!playerQueue.length || currentTrackIndex === -1) {
        console.log("❌ No hay canción en reproducción");
        return;
    }
    
    const track = playerQueue[currentTrackIndex];
    
    // 🎬 Si es video, NO abrir este modal (el video ya tiene su propio fullscreen)
    if (track.type === 'video') {
        console.log("🎬 Es video, usar controles de video");
        toggleVideoFullscreen(); // Usar el fullscreen nativo del video
        return;
    }
    
    // 📻 Si es AUDIO, abrir el modal fullscreen
    const modal = document.getElementById('fullscreen-player');
    if (!modal) {
        console.error("❌ No se encontró #fullscreen-player en el HTML");
        return;
    }
    
    // Mostrar modal
    modal.classList.remove('hidden');
    
    // 🔥 Codificar la ruta correctamente (ESTO ERA LO QUE FALTABA)
    const safePath = track.path.split('/').map(p => encodeURIComponent(p)).join('/');
    const coverUrl = `/caratula/${safePath}`;
    
    console.log("🖼️ Cargando carátula:", coverUrl);
    
    // Actualizar carátula principal
    const cover = document.getElementById('fp-cover');
    const bg = document.getElementById('fp-bg');
    
    if (cover) {
        cover.src = coverUrl;
        cover.style.display = 'block';
        
        cover.onerror = () => {
            console.warn("❌ No se pudo cargar la carátula");
            cover.style.display = 'none';
            const fallback = cover.nextElementSibling;
            if (fallback) fallback.classList.remove('hidden');
        };
        
        cover.onload = () => {
            console.log("✅ Carátula cargada exitosamente");
        };
    }
    
    if (bg) {
        bg.style.backgroundImage = `url('${coverUrl}')`;
    }
    
    // Actualizar textos
    const title = document.getElementById('fp-title');
    const artist = document.getElementById('fp-artist');
    if (title) title.innerText = track.title;
    if (artist) artist.innerText = track.artist;
    
    // Sincronizar controles
    syncFullscreenPlayer();
}

// 🆕 Cierra el reproductor fullscreen de AUDIO
function closeFullScreenPlayer() {
    const modal = document.getElementById('fullscreen-player');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function syncFullscreenPlayerCover() {
    if (!playerQueue.length || currentTrackIndex === -1) return;

    const track = playerQueue[currentTrackIndex];
    const cover = document.getElementById('fp-cover');
    const bg = document.getElementById('fp-bg');
    const fallback = cover?.nextElementSibling;

    if (!cover) return;

    // Limpia handlers previos
    cover.onerror = null;
    cover.onload = null;

    const playerCover =
        document.getElementById('player-cover') ||
        document.getElementById('player-cover-desktop');

    let workingUrl = null;

    if (playerCover && playerCover.src && !playerCover.src.includes('data:')) {
        workingUrl = playerCover.src;
        console.log("🔄 Usando carátula del player bar:", workingUrl);
    } else {
        const safePath = track.path.split('/').map(p => encodeURIComponent(p)).join('/');
        workingUrl = `/caratula/${safePath}`;
        console.log("🔄 Construyendo URL manualmente:", workingUrl);
    }

    cover.style.display = 'block';
    if (fallback) {
        fallback.classList.add('hidden');
        fallback.classList.remove('flex');
    }

    cover.onerror = () => {
        console.warn("❌ Error cargando carátula:", workingUrl);
        cover.style.visibility = 'hidden';  // 👈 no colapsa el layout
    if (fallback) {
        fallback.classList.remove('hidden');
        fallback.classList.add('flex');
    }
    };

    cover.onload = () => {
    cover.style.visibility = 'visible';
    if (fallback) {
        fallback.classList.add('hidden');
        fallback.classList.remove('flex');
    }
    };

    cover.src = workingUrl;

    if (bg) {
        bg.style.backgroundImage = `url('${workingUrl}')`;
    }
}
function syncFullscreenPlayer() {
    if (!audioElement) return;
    
    // Sincronizar barra de progreso
    const prog = document.getElementById('fp-prog');
    if (prog && audioElement.duration) {
        prog.max = audioElement.duration;
        prog.value = audioElement.currentTime;
    }
    
    // Sincronizar tiempos
    const curr = document.getElementById('fp-time-current');
    const total = document.getElementById('fp-time-total');
    if (curr) curr.innerText = formatTime(audioElement.currentTime);
    if (total) total.innerText = formatTime(audioElement.duration || 0);
    
    // Sincronizar icono play/pause
    const playBtn = document.getElementById('fp-play');
    if (playBtn) {
        const icon = playBtn.querySelector('i');
        if (icon) {
            icon.className = audioElement.paused 
                ? 'fa-solid fa-play ml-1 text-2xl' 
                : 'fa-solid fa-pause text-2xl';
        }
    }
    
    // Sincronizar shuffle
    const shuffleBtn = document.getElementById('fp-shuffle');
    if (shuffleBtn) {
        shuffleBtn.className = isShuffleOn 
            ? 'text-emerald-400 transition' 
            : 'text-zinc-500 hover:text-emerald-400 transition';
    }
    
    // Sincronizar loop
    const loopBtn = document.getElementById('fp-loop');
    if (loopBtn) {
        if (loopMode === 'off') {
            loopBtn.className = 'text-zinc-500 hover:text-white transition';
            loopBtn.innerHTML = '<i class="fa-solid fa-repeat text-xl"></i>';
        } else if (loopMode === 'all') {
            loopBtn.className = 'text-emerald-400 transition';
            loopBtn.innerHTML = '<i class="fa-solid fa-repeat text-xl"></i>';
        } else {
            loopBtn.className = 'text-blue-400 transition relative';
            loopBtn.innerHTML = '<i class="fa-solid fa-repeat text-xl"></i><span class="absolute -top-1 -right-1 text-[8px] font-bold">1</span>';
        }
    }
    
    // Sincronizar volumen
    const volSlider = document.getElementById('fp-vol-slider');
    if (volSlider) volSlider.value = audioElement.volume;
}

function seekAudio(event) {
    // Si la función recibe el 'event', usamos el valor del elemento que tocaste
    if(event && event.target) {
        audioElement.currentTime = event.target.value;
    } else {
        // Fallback: Si se llama sin evento, intenta adivinar cuál está visible
        const fp = document.getElementById('fp-prog');
        const desk = document.getElementById('prog-bar-desktop');
        const mob = document.getElementById('prog-bar');
        
        if (fp && fp.offsetParent) audioElement.currentTime = fp.value;
        else if (desk && desk.offsetParent) audioElement.currentTime = desk.value;
        else if (mob) audioElement.currentTime = mob.value;
    }
}
        function setVolume(val) { audioElement.volume = val; localStorage.setItem('vortex_vol', val); }
function toggleMute() {
  audioElement.muted = !audioElement.muted;
  syncPlayerUI();
}
        function formatTime(s) { if(isNaN(s)) return "0:00"; const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec < 10 ? '0' + sec : sec}`; }
        function onTrackEnded() { if (loopMode === 'one') { audioElement.currentTime = 0; audioElement.play(); } else if (playerQueue.length > 0) { playNext(); } }
function playNext() {
    // 1. Manejo del Shuffle (Aleatorio local)
    if (isShuffleOn) {
        let newIndex = currentTrackIndex;
        // Intentamos no repetir la misma canción
        if (playerQueue.length > 1) {
            while (newIndex === currentTrackIndex) {
                newIndex = Math.floor(Math.random() * playerQueue.length);
            }
        }
        currentTrackIndex = newIndex;
        playTrack(playerQueue[currentTrackIndex]);
        return;
    }

    // 2. Reproducción normal (Secuencial)
    if (currentTrackIndex < playerQueue.length - 1) {
        // Si hay una canción siguiente, la ponemos
        currentTrackIndex++;
        playTrack(playerQueue[currentTrackIndex]);
    } else {
        // 3. SE ACABÓ LA LISTA (El momento mágico)
        
        if (loopMode === 'all') {
            // Solo si tienes activado "Repetir Todo", volvemos al inicio
            currentTrackIndex = 0;
            playTrack(playerQueue[0]);
        } else {
            // SI NO: Activamos la Radio para que la música no pare
            console.log("💿 Fin de la lista. Activando Radio...");
            showToast("💽 Autoplay: Cargando más música...", "info");
            activarModoRadio();
        }
    }
}
        function playPrevious() { if (playerQueue.length === 0) return; if (audioElement.currentTime > 3) { audioElement.currentTime = 0; return; } currentTrackIndex = currentTrackIndex - 1; if (currentTrackIndex < 0) currentTrackIndex = playerQueue.length - 1; playTrack(playerQueue[currentTrackIndex]); }
        function jumpToTrack(index) { currentTrackIndex = index; playTrack(playerQueue[index]); }
        function removeFromQueue(index) { playerQueue.splice(index, 1); if (currentTrackIndex >= index && currentTrackIndex > 0) currentTrackIndex--; updateQueueUI(); }
        function clearQueue() { if (!confirm('¿Limpiar cola?')) return; playerQueue = []; currentTrackIndex = -1; updateQueueUI(); cerrarPlayer(); }
        function cerrarPlayer() { document.getElementById('player-bar').classList.add('hidden'); document.getElementById('player-bar').classList.remove('flex'); audioElement.pause(); }
        
        function syncPlayerUI() {
  // ========== 1. SHUFFLE (Móvil + Desktop) ==========
  ['btn-shuffle', 'btn-shuffle-desktop'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      if (isShuffleOn) {
        btn.className = "text-emerald-400 hover:text-emerald-300 transition text-sm drop-shadow-md";
      } else {
        btn.className = "text-zinc-500 hover:text-emerald-400 transition text-sm";
      }
    }
  });

  // ========== 2. LOOP (Móvil + Desktop) ==========
  ['btn-loop', 'btn-loop-desktop'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;

    if (loopMode === 'off') {
      btn.className = "text-zinc-500 hover:text-white transition text-sm";
      btn.innerHTML = '<i class="fa-solid fa-repeat"></i>';
    } else if (loopMode === 'all') {
      btn.className = "text-emerald-400 transition text-sm drop-shadow-md";
      btn.innerHTML = '<i class="fa-solid fa-repeat"></i>';
    } else { // loopMode === 'one'
      btn.className = "text-blue-400 transition text-sm drop-shadow-md relative";
      btn.innerHTML = '<i class="fa-solid fa-repeat"></i><span class="absolute -top-1 -right-1 text-[8px] font-bold">1</span>';
    }
  });

  // ========== 3. MUTE / VOLUMEN (Móvil + Desktop) ==========
  const isMuted = audioElement.muted || audioElement.volume === 0;
  
  ['btn-vol', 'btn-vol-desktop'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = isMuted 
          ? 'fa-solid fa-volume-xmark' 
          : 'fa-solid fa-volume-high';
      }
      btn.classList.toggle('text-red-400', isMuted);
      btn.classList.toggle('text-zinc-400', !isMuted);
    }
  });

  ['vol-slider', 'vol-slider-desktop'].forEach(id => {
    const slider = document.getElementById(id);
    if (slider) slider.value = audioElement.volume;
  });
}

       function toggleLoop() {
  const modes = ['off', 'all', 'one'];
  loopMode = modes[(modes.indexOf(loopMode) + 1) % modes.length];
  syncPlayerUI();  // ← AGREGA ESTO
}     

function ver(view) {

  // Ocultar todas las vistas
  document.querySelectorAll('[id^="view-"]').forEach(el =>
    el.classList.add('hidden')
  );

  // Mostrar la vista seleccionada
  document.getElementById('view-' + view).classList.remove('hidden');

  // Sidebar active state
  document.querySelectorAll('.sidebar-link').forEach(el =>
    el.classList.remove('active')
  );

  document.getElementById('nav-' + view).classList.add('active');

  // ===============================
  // VISTAS PRINCIPALES
  // ===============================

  if (view === 'library') {
    document.getElementById('sidebar-filters').classList.remove('hidden');
    cargarLib();
  }

  else if (view === 'history') {
    document.getElementById('sidebar-filters').classList.add('hidden');
    cargarHistorial();
  }

  // ✅ OFFLINE VIEW (AQUÍ)
  else if (view === 'offline') {
    document.getElementById('sidebar-filters').classList.add('hidden');

    // ✅ SOLO aquí cargamos lista offline
    if (typeof refreshOfflineList === "function") {
      refreshOfflineList();
    }
  }

  // Otras vistas
  else {
    document.getElementById('sidebar-filters').classList.add('hidden');
  }
}
function toggleAcc(id) { const el = document.getElementById(id); const icon = document.getElementById('icon-'+id); if(el.classList.contains('hidden')) { el.classList.remove('hidden'); if(icon) icon.style.transform='rotate(180deg)'; } else { el.classList.add('hidden'); if(icon) icon.style.transform='rotate(0deg)'; } }
        function toggleQueue() { document.getElementById('queue-panel').classList.toggle('translate-x-full'); }
function setView(mode) { 
    viewMode = mode; 
    localStorage.setItem('vortex_view', mode); 
    
    // Actualizar botones DESKTOP
    const bG = document.getElementById('view-grid'); 
    const bL = document.getElementById('view-list'); 
    
    // Actualizar botones MÓVIL
    const bGMobile = document.getElementById('view-grid-mobile'); 
    const bLMobile = document.getElementById('view-list-mobile'); 
    
    // Aplicar clases a todos
    [bG, bGMobile].forEach(btn => {
        if (btn) btn.className = mode === 'grid' ? 'btn-view active' : 'btn-view';
    });
    
    [bL, bLMobile].forEach(btn => {
        if (btn) btn.className = mode === 'list' ? 'btn-view active' : 'btn-view';
    });
    renderLib(); 
}
    function renderSmartMixes() {
    const mixesGrid = document.getElementById('smart-mixes-grid');
    if (!mixesGrid) return;
    
    mixesGrid.innerHTML = '';
    
    // 1. Crear mix de favoritos DINÁMICAMENTE
    const favFiles = libData.files.filter(f => f.rating === 1);
    let mixesToShow = [...(libData.smart_mixes || [])];

    if (favFiles.length > 0) {
        const favMix = {
            id: 'smart_favorites',
            name: 'Mis Favoritos',
            icon: 'fa-heart',
            files: favFiles,
            desc: 'Tu selección personal'
        };
        mixesToShow.unshift(favMix); // ⭐ Primero en la lista
    }

    const styles = {
        'smart_favorites': { 
            from: 'from-emerald-600/20', to: 'to-black', 
            border: 'border-emerald-500/50 hover:border-emerald-400', 
            icon: 'text-emerald-500',
            glow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]'
        },
        'smart_top50':   { from: 'from-orange-500/10', to: 'to-red-500/5',    border: 'border-orange-500/20 hover:border-orange-500', icon: 'text-orange-500', glow: '' },
        'smart_new':     { from: 'from-teal-500/10',   to: 'to-cyan-500/5',   border: 'border-teal-500/20 hover:border-teal-500',     icon: 'text-teal-400', glow: '' },
        'smart_shuffle': { from: 'from-blue-500/10',   to: 'to-indigo-500/5', border: 'border-blue-500/20 hover:border-blue-400',     icon: 'text-blue-400', glow: '' },
        'smart_gems':    { from: 'from-purple-500/10',  to: 'to-pink-500/5',   border: 'border-purple-500/20 hover:border-purple-400',  icon: 'text-purple-400', glow: '' }
    };

    mixesToShow.forEach(mix => {
        const s = styles[mix.id] || { from: 'from-zinc-800', to: 'to-zinc-900', border: 'border-white/10 hover:border-white/30', icon: 'text-zinc-400', glow: '' };
        
        mixesGrid.innerHTML += `
        <div onclick="playMix('${mix.id}')" 
             class="relative overflow-hidden h-32 flex flex-col justify-between p-4 rounded-xl cursor-pointer transition-all duration-300 group
                    bg-gradient-to-br ${s.from} ${s.to} bg-[#121212]
                    border ${s.border} hover:scale-[1.02] ${s.glow || 'hover:shadow-[0_0_20px_rgba(0,0,0,0.4)]'}">
            
            <div class="absolute -right-4 -top-4 opacity-[0.05] group-hover:opacity-10 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110 pointer-events-none">
                <i class="fa-solid ${mix.icon} text-9xl text-white"></i>
            </div>
            
            <div class="text-2xl ${s.icon} drop-shadow-md group-hover:scale-110 transition-transform origin-left">
                <i class="fa-solid ${mix.icon}"></i>
            </div>
            
            <div class="relative z-10">
                <h3 class="font-bold text-white leading-tight text-sm md:text-base group-hover:text-white transition">${mix.name}</h3>
                <p class="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1 group-hover:text-zinc-400 transition">
                    ${mix.files.length} canciones
                </p>
            </div>
            
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center backdrop-blur-[1px]">
                <div class="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center shadow-2xl scale-50 group-hover:scale-100 transition-transform duration-300">
                    <i class="fa-solid fa-play ml-1 text-sm"></i>
                </div>
            </div>
        </div>`;
    });
}


        function changeZoom(val) { currentZoomIndex = parseInt(val); renderLib(); }
        async function analizarClipboard() { try { const t=await navigator.clipboard.readText(); if(t) { document.getElementById('url-input').value=t; analizar(); }} catch(e){} }
async function analizar() { 
    const url = document.getElementById('url-input').value; 
    if(!url) return; 
    
    document.getElementById('download-area').classList.remove('hidden'); 
    document.getElementById('download-list').innerHTML = '<div class="text-center p-8"><i class="fa-solid fa-spinner fa-spin text-3xl text-blue-500"></i></div>'; 
    
    const res = await fetch('/analizar', {
        method:'POST', 
        headers:{'Content-Type':'application/json'}, 
        body:JSON.stringify({url})
    }); 
    
    const data = await res.json(); 
    downloadList = data.entries; 
    
    // 1. Llenamos la memoria: todos seleccionados al inicio
   selectedDownloadIndices = new Set();
    
    // 2. Reset de paginación y dibujado
    currentLoadedCount = 100;
    renderDownloadList(); 
}
       let currentLoadedCount = 100;

function renderDownloadList() { 
    const container = document.getElementById('download-list'); 
    container.innerHTML = ""; 
    const term = document.getElementById('dl-search').value.toLowerCase(); 
    const filteredIndices = downloadList.map((v, i) => ({v, realIndex: i})).filter(item => item.v.title.toLowerCase().includes(term)); 
    
    if(!filteredIndices.length) return container.innerHTML = '<p class="text-center text-emerald-500 py-4">No hay resultados.</p>'; 
    
    const itemsToShow = filteredIndices.slice(0, currentLoadedCount);
    
    itemsToShow.forEach(item => { 
        const {v, realIndex} = item; 
        const img = v.thumbnail || ''; 
        
        // FIX: Usar realIndex para mantener selecciones
        const isChecked = selectedDownloadIndices.has(realIndex) ? 'checked' : ''; 
        
        let statusIcon = '<div class="w-4 h-4 rounded-full border-2 border-emerald-600"></div>'; 
        let existsHtml = ''; 
        if(v.is_downloaded) { 
            statusIcon = '<i class="fa-solid fa-check text-emerald-500"></i>'; 
            existsHtml = '<span class="text-[9px] bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded font-bold ml-2">EN BIBLIOTECA</span>'; 
        } 

        // FIX: Usar realIndex en checkbox y toggle
        const checkboxHtml = v.is_downloaded ? statusIcon : `
            <input type="checkbox" class="chk-dl w-4 h-4 accent-emerald-500 cursor-pointer" 
                   value="${realIndex}" ${isChecked} onchange="toggleDownloadSelection(${realIndex}, this.checked)">`;

        container.innerHTML += `
            <div class="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg group transition border border-white/5" id="row-${realIndex}">
                <div class="w-8 flex justify-center shrink-0">${checkboxHtml}</div>
                <div class="w-6 flex justify-center text-sm" id="status-${realIndex}">
                    ${v.is_downloaded ? '' : '<i class="fa-regular fa-circle text-emerald-600"></i>'}
                </div>
                <img src="${img}" class="w-12 h-8 object-cover rounded bg-emerald-900 shrink-0" onerror="this.src='data:image/svg+xml,...'">
                <div class="flex-1 min-w-0">
                    <input type="text" id="title-${realIndex}" value="${escapeHtml(v.title)}" class="w-full bg-emerald-900/50 border-b border-emerald-700 focus:border-emerald-500 outline-none text-xs text-white px-2 py-1 rounded">
                </div>
                ${existsHtml}
            </div>`; 
    }); 
    
    if (currentLoadedCount < filteredIndices.length) {
        container.innerHTML += `<button onclick="loadMoreResults()" class="w-full mt-4 py-3 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition">CARGAR MÁS (${filteredIndices.length - currentLoadedCount} restantes)</button>`;
    }
    
    // Actualizar estado del checkbox "Seleccionar Todo"
    const checkAll = document.getElementById('check-all');
    const visibleCount = itemsToShow.length;
    const selectedInView = itemsToShow.filter(item => selectedDownloadIndices.has(item.realIndex)).length;
    checkAll.checked = visibleCount > 0 && selectedInView === visibleCount;
    checkAll.indeterminate = selectedInView > 0 && selectedInView < visibleCount;
}

function loadMoreResults() {
    const container = document.getElementById('download-list');
    const lastBtn = container.querySelector('button');
    if(lastBtn) lastBtn.remove();

    currentLoadedCount += 100;
    renderDownloadList();
}

function filterDownloadList() { 
    currentLoadedCount = 100;
    renderDownloadList(); 
}

async function iniciarDescarga() { 
    let dlStopped = false;

    // 1. Validar usando el Set (la memoria), no el HTML
    if (selectedDownloadIndices.size === 0) {
        showToast("¿Y las canciones? Selecciona algo 😒😒", "warning");
        return;
    }

    // 2. Construir la lista de items desde la memoria
    const items = Array.from(selectedDownloadIndices).map(idx => { 
        const inputEl = document.getElementById(`title-${idx}`); 
        const customTitle = inputEl ? inputEl.value.trim() : downloadList[idx].title; 
        
        return { 
            url: downloadList[idx].url, 
            title: customTitle || downloadList[idx].title, 
            index: idx, 
            id: downloadList[idx].id 
        }; 
    }); 

    const type = document.getElementById('dl-quality').value; 
    const speed = parseInt(document.getElementById('dl-speed').value) || 1;
    document.getElementById('dl-progress').classList.remove('hidden'); 

    // 3. Loop de progreso
    const loop = setInterval(async () => { 
        if (dlStopped) return;

        const res = await fetch('/status'); 
        const d = await res.json(); 
        
        document.getElementById('dl-percent').innerText = d.percent; 
        document.getElementById('dl-filename').innerText = d.filename; 
        document.getElementById('dl-bar').style.width = d.percent; 
        document.getElementById('dl-details').innerText = d.details || ''; 

        // Icono del elemento actual
        if (d.current_index !== -1 && items[d.current_index]) { 
            const iconDiv = document.getElementById(`status-${items[d.current_index].index}`); 
            if (iconDiv) iconDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-blue-500"></i>'; 
        } 

        // Iconos completados
        if (Array.isArray(d.completed_indices)) {
            d.completed_indices.forEach(realIdx => { 
                if (items[realIdx]) {
                    const rowId = items[realIdx].index; 
                    const iconDiv = document.getElementById(`status-${rowId}`); 
                    if (iconDiv) iconDiv.innerHTML = '<i class="fa-solid fa-check text-emerald-500"></i>'; 
                }
            });
        }

        // ❌ Error
        if (d.failed) {
            dlStopped = true;
            clearInterval(loop);

            document.getElementById('dl-progress').classList.add('hidden');
            showStickyToast(d.details || 'Este enlace no permite descarga directa.', 'error');

            selectedDownloadIndices.clear();
            setTimeout(() => {
                cargarLib();
                cargarHistorial();
            }, 300);

            return;
        }

        // ✅ Finalizado con éxito
        if (!d.active && d.percent === "100%") { 
            dlStopped = true;
            clearInterval(loop);

            document.getElementById('dl-progress').classList.add('hidden');
            showStickyToast('¡Descarga finalizada con éxito!', 'success');

            selectedDownloadIndices.clear();
            setTimeout(() => {
                cargarLib();
                cargarHistorial();
            }, 300);
        }

    }, 500); 

    // 4. Enviar la orden al servidor
    await fetch('/descargar', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ items, type, speed }) 
    }); 
}
async function detener() { await fetch('/stop', {method:'POST'}); }
async function borrar(path) { if(confirm("¿Eliminar?")) { await fetch('/borrar', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({file:decodeURIComponent(path)})}); cargarLib(); }}
function abrirMover(path) { 
    fileToMove = decodeURIComponent(path); 
    const list = document.getElementById('folder-list-modal'); 
    list.innerHTML = `<button 
        onclick="moverA('Raíz')" 
        class="w-full text-left px-4 py-3 bg-emerald-800 hover:bg-emerald-700 rounded-lg text-xs mb-1 font-bold text-white transition flex items-center gap-2">
        <i class="fa-solid fa-file"></i> Raíz
    </button>`; 
    
    libData.folders.forEach(f => {
        const folderEscaped = f.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        list.innerHTML += `<button 
            onclick="moverA('${folderEscaped}')" 
            class="w-full text-left px-4 py-3 bg-emerald-800 hover:bg-emerald-700 rounded-lg text-xs mb-1 text-emerald-300 transition flex items-center gap-2">
            <i class="fa-solid fa-folder"></i> ${escapeHtml(f)}
        </button>`;
    }); 
    
    document.getElementById('move-modal').classList.remove('hidden'); 
}
async function moverA(d) { await fetch('/mover_archivo', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({file:fileToMove, target:d})}); document.getElementById('move-modal').classList.add('hidden'); cargarLib(); }

async function cargarHistorial() { const res = await fetch('/historial?limit=200'); const data = await res.json(); const div = document.getElementById('history-container'); div.innerHTML = ""; const ids = Object.keys(data).reverse(); if(!ids.length) { div.innerHTML = "<p class='text-emerald-500 opacity-50 text-center py-10'>El historial está vacío.</p>"; return; } ids.forEach(id => { const item = data[id]; const date = new Date(item.date * 1000).toLocaleString(); div.innerHTML += `<div class="flex justify-between items-center p-3 border-b border-emerald-800 hover:bg-emerald-900 transition"><div class="min-w-0"><div class="text-xs text-white truncate font-bold">${item.title}</div><div class="text-[9px] text-emerald-500 font-mono flex gap-2"><span>${date}</span><span class="text-emerald-500">${item.filename.split('.').pop().toUpperCase()}</span></div></div><button onclick="borrarHistorial('${id}')" class="text-[9px] bg-red-900/20 text-red-400 px-3 py-1 rounded hover:bg-red-900/50">Olvidar</button></div>`; }); }
async function borrarHistorial(id) { if(!confirm("¿Olvidar?")) return; await fetch('/borrar_historial', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id})}); cargarHistorial(); }
function resetFilters() { 
    filters = {folder:'all',artist:'all',album:'all',rating:'all',playlist:'all',genre:'all',sort:'default'};
    
    const titleDesktop = document.getElementById('lib-title-desktop');
    const titleMobile = document.getElementById('lib-title-mobile');
    const newTitle = currentLibrary === 'audio' ? "Mi Música" : "Mis Series y Videos";
    
    if (titleDesktop) titleDesktop.innerText = newTitle;
    if (titleMobile) titleMobile.innerText = newTitle;
    
    renderLib(); 
    renderSidebarLists(); 
}
function toggleSelectAll(source) {
    const isChecked = source.checked;
    const term = document.getElementById('dl-search').value.toLowerCase();

    const visibleNotDownloaded = downloadList
        .map((v, i) => ({v, i}))
        .filter(item =>
            item.v.title.toLowerCase().includes(term) &&
            !item.v.is_downloaded &&
            document.getElementById(`row-${item.i}`)
        )
        .map(item => item.i);

    if (isChecked) {
        visibleNotDownloaded.forEach(i => selectedDownloadIndices.add(i));
    } else {
        visibleNotDownloaded.forEach(i => selectedDownloadIndices.delete(i));
    }

    // Actualizar checkboxes directamente SIN re-renderizar
    document.querySelectorAll('#download-list input[type="checkbox"]').forEach(cb => {
        cb.checked = isChecked;
    });
}

        // Función para abrir/cerrar el menú en celular
function toggleSidebar() {
    const sb = document.getElementById('main-sidebar');
    if (sb.classList.contains('-translate-x-full')) {
        sb.classList.remove('-translate-x-full'); // Mostrar
        // Cerrar si tocas afuera
        setTimeout(() => {
            document.addEventListener('click', function close(e) {
                if (!sb.contains(e.target) && !e.target.closest('button[onclick="toggleSidebar()"]')) {
                    sb.classList.add('-translate-x-full');
                    document.removeEventListener('click', close);
                }
            });
        }, 100);
    } else {
        sb.classList.add('-translate-x-full'); // Ocultar
    }
}

async function borrarArchivo(path) {
    if(!confirm("¿Estás seguro de eliminar este archivo permanentemente?")) return;
    
    const res = await fetch('/borrar', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ file: path })
    });
    
    const data = await res.json();
    if(data.ok) {
        // ESTO ES CLAVE: Recargar la librería para ver que ya no está
        await cargarLib();
        showToast("Archivo eliminado", "success");
    } else {
        showToast("Error al eliminar", "error");
    }
}
async function cleanGhosts() {
    // Usamos comillas dobles normales para evitar errores
    if(!confirm("Esto revisará todo tu historial y borrará las entradas de archivos que ya no existen en el disco. ¿Continuar?")) return;

    const btn = document.activeElement; 
    const originalText = btn ? btn.innerText : '';
    if(btn) btn.innerText = "Limpiando...";

    try {
        const res = await fetch('/clean_ghosts', { method: 'POST' });
        const data = await res.json();
        
        if (data.ok) {
            if (data.count > 0) {
                // CORRECCIÓN AQUÍ: Usamos \\n (doble diagonal)
                var msg = "✨ ¡Listo!\\nSe eliminaron " + data.count + " fantasmas del historial.";
                
                if (data.names.length > 0) {
                    msg += "\\n\\nAlgunos eliminados:\\n- " + data.names.slice(0, 5).join('\\n- ');
                }
                
                if (data.names.length > 5) {
                    msg += "\\n... y más.";
                }
                
                showToast(msg);
                
                if (typeof cargarLib === 'function') await cargarLib();

            } else {
                showToast("Tu historial está limpio. No se encontraron fantasmas.", "info");
            }
        } else {
            showToast("Hubo un error al intentar limpiar.", "error");
        }
    } catch (e) {
        showToast("Error de conexión: " + e);
    }

    if(btn) btn.innerText = originalText;
}
async function removeFromPlaylist(plName, filePath, e) {
        // Detener la propagación para que no reproduzca la canción al borrar
        if (e) e.stopPropagation(); 
        
        // Confirmación simple
        if(!confirm("¿Quitar esta canción de la lista?")) return;

        const res = await fetch('/playlist/remove_item', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ playlist: plName, file: filePath })
        });

        const data = await res.json();
        
        if (data.ok) {
            await cargarLib(); // Recargar visualmente
        } else {
            showToast("Error al quitar la canción.", "error");
        }
    }

    // --- FIN DEL BLOQUE SEGURO ---
// Función EXCLUSIVA para el botón naranja de la fila (Nombre único)
async function quitarDeListaRow(plName, filePath, e) {
    // Evita que se reproduzca la canción al dar clic
    if (e) e.stopPropagation(); 
    
    if(!confirm("¿Sacar esta canción de la lista?")) return;

    const res = await fetch('/playlist/remove_item', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ playlist: plName, file: filePath })
    });

    const data = await res.json();
    if (data.ok) {
        await cargarLib(); // Recargar para ver que desaparece
    } else {
        showToast("Error al quitar la canción.", "error");
    }
}
    
async function rescanLibrary() {
    const btn = document.getElementById('btn-rescan');
    
    // Animación del botón
    if(btn) {
        const icon = btn.querySelector('i');
        if(icon) icon.classList.add('fa-spin');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spin fa-rotate"></i> Escaneando...';
    }

    try {
        showToast("💿 Escaneando disco duro...", "info"); 
        
        // 1. ESCANEO FÍSICO (Servidor)
        const res = await fetch('/actualizar_cache');
        const data = await res.json();
        
        if (data.ok) {
            // 2. RECARGAR DATOS (Para tener las rutas nuevas en memoria)
            // Esto es CRUCIAL: Doctor Kraken necesita saber dónde están los archivos AHORA
            await cargarLib(); 
            
            // 3. DOCTOR KRAKEN AL RESCATE (Modo Silencioso)
            // Ejecutamos la reparación automática
            showToast("🚑 Verificando salud de playlists...", "info");
            repairPlaylists(true); // 'true' para que no pida confirmación
            
            showToast("✅ Biblioteca Sincronizada y Reparada", "success");
        }
    } catch (e) {
        console.error(e);
        showToast("❌ Error en la sincronización", "error");
    }
    
    // Restaurar botón
    if(btn) {
        btn.classList.remove('fa-spin');
        btn.disabled = false;
        // Restaurar texto original (Dependiendo de si estás en móvil o desktop puede variar, 
        // pero esto lo deja genérico y funcional)
        btn.innerHTML = '<i class="fa-solid fa-rotate"></i> <span>Sincronizar</span>';
    }
}

function abrirPlaylist(nombre) {
    if (!libData.playlists[nombre]) {
        showToast("Esta playlist no existe", "error");
        return;
    }
    
    window.currentPlaylistName = nombre;
    
    // 1. Resetear TODO antes de aplicar
    filters = {...defaults}; // ← Limpiar primero
    filters.playlist = nombre;
    
    // 2. Cambiar modo visual
    currentLibrary = 'playlist:' + nombre;
    currentPath = ""; 
    
    // 3. UI: Cambiar título DESKTOP Y MÓVIL
    const titleDesktop = document.getElementById('lib-title-desktop');
    const titleMobile = document.getElementById('lib-title-mobile');
    const playlistTitle = "📋 " + nombre;
    
    if (titleDesktop) titleDesktop.innerText = playlistTitle;
    if (titleMobile) titleMobile.innerText = playlistTitle;
    
    // 4. Resetear límite de renderizado
    renderLimit = renderStep; // ← AGREGAR ESTO
    
    // 5. Recargar vista
    renderLib();
    renderSidebarLists(); 
    updatePlaylistDownloadButtons();
}

function getCurrentPlaylistName() {
    return filters?.playlist || "";
}

function toggleDownloadSelection(idx, checked) {
    if (checked) selectedDownloadIndices.add(idx);
    else selectedDownloadIndices.delete(idx);
}

const playerState = {
    mode: 'music',      // 'music' | 'video'
    view: 'normal',     // 'normal' | 'expanded' (móvil)
    index: 0,

    loop: false,
    shuffle: false,
    muted: false
};

 setTimeout(() => {
      const loader = document.getElementById('loader');
      if (loader && !loader.classList.contains('hidden')) {
          loader.classList.add('hidden');
      }
  }, 8000);
  function setLoaderText(text) {
  const el = document.getElementById('loader-text');
  if (el) el.textContent = text;
}

let rescanWatcher = null;

function watchRescan() {
  if (rescanWatcher) return;

  rescanWatcher = setInterval(async () => {
    try {
      const r = await fetch('/estado');
      const j = await r.json();

      const loader = document.getElementById('loader');

      if (j.rescan) {
        loader.classList.remove('hidden');
        setLoaderText("Reorganizando tu biblioteca…");
      } else {
        loader.classList.add('hidden');
        clearInterval(rescanWatcher);
        rescanWatcher = null;
        cargarLib(); // refresca cuando ya terminó
      }
    } catch {}
  }, 1000);
}

function hashLib(data) {
  try {
    return JSON.stringify(data).length; // simple, barato
  } catch {
    return 0;
  }
}

async function refreshLibrary() {
  try {
    const res = await fetch('/biblioteca?fresh=1&limit=200');
    const newData = await res.json();

    if (!window.libData) {
      window.libData = newData;
      libData = newData;           // 🔗 sincroniza
      renderSidebarLists();
      renderLib();
      return;
    }

    const oldHash = hashLib(window.libData);
    const newHash = hashLib(newData);

    if (oldHash !== newHash) {
      window.libData = newData;
      libData = newData;           // 🔗 sincroniza
      renderSidebarLists();
      renderLib();
    }
  } catch (e) {
    console.warn('Error refrescando biblioteca:', e);
  }
}

window.showToast = function(message, type = 'info') {
    const colors = {
        success: 'bg-emerald-600',
        error: 'bg-red-600',
        warning: 'bg-yellow-600',
        info: 'bg-blue-600'
    };

    // 1. Buscamos (o creamos) el CONTENEDOR DE NOTIFICACIONES
    // Este div invisible se encarga de apilar los mensajes en el centro
    let container = document.getElementById('toast-notification-center');
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-notification-center';
        // Posición fija en el centro, apila en columna (flex-col), permite clicks a través (pointer-events-none)
        container.className = 'fixed top-24 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-3 pointer-events-none w-max max-w-[90vw]';
        document.body.appendChild(container);
    }

    // 2. Creamos la NOTIFICACIÓN individual
    const toast = document.createElement('div');
    
    // NOTA: Quitamos 'fixed top-24 left-1/2' porque el contenedor ya se encarga de eso.
    // Agregamos 'pointer-events-auto' para que puedas cerrarlo si quisieras.
    toast.className = `${colors[type]} text-white px-8 py-4 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-semibold animate-slide-in pointer-events-auto transition-all duration-300`;
    
    toast.innerHTML = `
        <i class="fa-solid fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'triangle-exclamation' : 'info-circle'} text-lg"></i>
        <span>${message}</span>
    `;

    // 3. Agregamos al contenedor (se pondrá debajo del anterior automáticamente)
    container.appendChild(toast);

    // 4. Temporizador de eliminación
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)'; // Se va hacia arriba al morir
        setTimeout(() => {
            if (toast.isConnected) toast.remove();
            
            // Limpieza: Si el contenedor se queda vacío, lo borramos (opcional, pero limpio)
            if (container.children.length === 0) container.remove();
        }, 300);
    }, 4000); // Bajé un poco el tiempo a 4s para que sea más dinámico
};

function showStickyToast(text, type = "info") {
    let box = document.getElementById('sticky-toast');

    if (!box) {
        box = document.createElement('div');
        box.id = 'sticky-toast';
        box.className = 'fixed bottom-6 right-6 z-50 max-w-sm w-[90%] md:w-auto bg-emerald-900 border rounded-xl shadow-2xl p-4 text-sm';
        document.body.appendChild(box);
    }

    const color = type === "success" ? "border-emerald-500 text-emerald-400"
                : type === "error"   ? "border-red-500 text-red-400"
                : "border-emerald-600 text-emerald-300";

    const icon = type === "success" ? "fa-circle-check"
               : type === "error"   ? "fa-circle-xmark"
               : "fa-circle-info";

    box.className = `fixed bottom-6 right-6 z-50 max-w-sm w-[90%] md:w-auto bg-emerald-900 border ${color} rounded-xl shadow-2xl p-4`;

    box.innerHTML = `
        <div class="flex items-start gap-3">
            <i class="fa-solid ${icon} text-xl mt-0.5"></i>
            <div class="flex-1 whitespace-pre-wrap">${text}</div>
            <button onclick="document.getElementById('sticky-toast').remove()" 
                    class="ml-2 text-emerald-500 hover:text-white">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `;
}

function renderLibraryStats() {
    const box = document.getElementById('lib-stats');
    if (!box || !libData) return;

    const totalSongs = libData.total_files || 0;
    const totalVideos = libData.total_videos || 0;
    const totalFolders = libData.total_folders || 0;

    // Estimación estética: 4 min por canción
    const totalMinutes = totalSongs * 4;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    box.innerHTML = `
        <div class="bg-[#0A0A0A] border border-white/5 rounded-xl p-3 text-center">
            <div class="text-emerald-400 text-md font-bold">${totalSongs}</div>
            <div class="text-[10px] text-emerald-400 uppercase tracking-wider">Canciones</div>
        </div>
        <div class="bg-[#0A0A0A] border border-white/5 rounded-xl p-3 text-center">
            <div class="text-indigo-400 text-md font-bold">${totalVideos}</div>
            <div class="text-[10px] text-emerald-400 uppercase tracking-wider">Videos</div>
        </div>
        <div class="bg-[#0A0A0A] border border-white/5 rounded-xl p-3 text-center">
            <div class="text-pink-400 text-md font-bold">${totalFolders}</div>
            <div class="text-[10px] text-emerald-400 uppercase tracking-wider">Carpetas</div>
        </div>
        <div class="bg-[#0A0A0A] border border-white/5 rounded-xl p-3 text-center">
            <div class="text-yellow-400 text-md font-bold">${hours}h ${minutes}m</div>
            <div class="text-[10px] text-emerald-400 uppercase tracking-wider">Duración aprox.</div>
        </div>
    `;
}


window.showAllFiles = false;

function toggleSortMenuMobile() {
    const m = document.getElementById('sort-menu-mobile');
    if (m) m.classList.toggle('hidden');
}

function toggleSortMenuDesktop() {
    const m = document.getElementById('sort-menu-desktop');
    if (m) m.classList.toggle('hidden');
}

function setSortMobile(type) {
    setFilter('sort', type);
    const m = document.getElementById('sort-menu-mobile');
    if (m) m.classList.add('hidden');
}

function setSortDesktop(type) {
    setFilter('sort', type);
    const m = document.getElementById('sort-menu-desktop');
    if (m) m.classList.add('hidden');
}


/* ==========================================
   ❤️ SISTEMA MAESTRO DE FAVORITOS (V5 - UNIFICADO)
   ========================================== */
   

// 1. Entrada desde las TARJETAS o LISTA (Recibe ruta codificada tipo "Musica/Rock/My%20Song.mp3")
async function toggleCardFavorite(encodedPath) {
    const path = decodeURIComponent(encodedPath);
    await procesarFavorito(path);
}

// 2. Entrada desde el REPRODUCTOR PRINCIPAL
async function toggleFavorite() {
    if(!playerQueue.length || currentTrackIndex === -1) return;
    const track = playerQueue[currentTrackIndex];
    await procesarFavorito(track.path);
}

// 3. CEREBRO CENTRAL (Aquí ocurre la magia)
async function procesarFavorito(filePath) {
    // Buscar archivo en memoria
    const file = libData.files.find(f => f.path === filePath);
    if (!file) return;

    const wasFavorite = file.rating === 1;
    const newRating = wasFavorite ? 0 : 1;

    // A) Actualización Optimista (Inmediata)
    file.rating = newRating;
    actualizarVisuales(filePath, newRating === 1);

    // B) Petición al Servidor
    try {
        const res = await fetch('/api/favorite/toggle', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ path: filePath })
        });
        
        const data = await res.json();
        
        if (!data.success) {
            // Si falla, revertimos
            file.rating = wasFavorite ? 1 : 0;
            actualizarVisuales(filePath, wasFavorite);
            showToast("Error al guardar favorito", "error");
        } else {
            // Si estamos en la playlist de "Mis Favoritos" y quitamos uno, recargar la vista
            if (wasFavorite && (filters.playlist === 'smart_favorites' || currentLibrary === 'playlist:smart_favorites')) {
                setTimeout(() => renderLib(), 500); 
            }
        }
    } catch (e) {
        console.error("Error red like:", e);
        // Revertir por error de red
        file.rating = wasFavorite ? 1 : 0;
        actualizarVisuales(filePath, wasFavorite);
    }
}

// 4. EL PINTOR (Actualiza TODOS los botones visibles de esa canción a la vez)
function actualizarVisuales(filePath, isFav) {
    // --- A. Actualizar Reproductor (Si es la canción actual) ---
    if (playerQueue[currentTrackIndex]?.path === filePath) {
        const playerIds = ['btn-like-player', 'btn-like-player-desktop', 'fp-like'];
        playerIds.forEach(id => {
            const btn = document.getElementById(id);
            if(btn) {
                if(isFav) {
                    btn.className = "ml-2 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)] transition transform scale-110 p-1";
                    btn.innerHTML = '<i class="fa-solid fa-heart"></i>';
                } else {
                    btn.className = "ml-2 text-zinc-600 hover:text-emerald-500 hover:shadow-[0_0_10px_rgba(16,185,129,0.5)] transition p-1";
                    btn.innerHTML = '<i class="fa-regular fa-heart"></i>';
                }
            }
        });
    }

    // --- B. Actualizar Botones en Listas y Tarjetas ---
    // Buscamos botones que usen data-path en lugar de onclick
    const safePath = encodeURIComponent(filePath);
    
    // Buscar por data-path es más confiable que por onclick
    const botonesEnPantalla = document.querySelectorAll(`button[data-path="${CSS.escape(filePath)}"]`);
    
    botonesEnPantalla.forEach(btn => {
        // Solo tocamos si parece un botón de corazón (tiene la clase fa-heart o similar)
        if(btn.innerHTML.includes('heart')) {
            if (isFav) {
                // Estilo "Activado" (Verde brillante)
                btn.classList.remove('text-zinc-500', 'hover:text-emerald-400');
                btn.classList.add('text-emerald-400', 'drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]');
                btn.innerHTML = '<i class="fa-solid fa-heart text-xs"></i>';
                btn.title = "Quitar de favoritos";
            } else {
                // Estilo "Desactivado" (Gris)
                btn.classList.remove('text-emerald-400', 'drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]');
                btn.classList.add('text-zinc-500', 'hover:text-emerald-400');
                btn.innerHTML = '<i class="fa-regular fa-heart text-xs"></i>';
                btn.title = "Añadir a favoritos";
            }
        }
    });
}

function updateYTDLP() {
    const btn = document.getElementById('btn-ytdlp');
    btn.disabled = true;
    btn.innerText = 'ACTUALIZANDO...';

    fetch('/update_ytdlp', {
        method: 'POST'
    })
    .then(r => r.json())
    .then(() => {
        // No sabemos cuándo termina exactamente,
        // pero pip suele tardar segundos, no minutos.
        setTimeout(() => {
            btn.disabled = false;
            btn.innerText = 'ACTUALIZAR yt-dlp';
        }, 4000);
    })
    .catch(() => {
        btn.disabled = false;
        btn.innerText = 'ERROR';
    });
}



let lastRadarJson = "";
let LAST_USERS_DATA = [];

function drawUserRadar(users) {
    LAST_USERS_DATA = users;

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
        const ringColor = 'ring-2 ring-white/20';
        
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

        // Botón editar nombre
        let editBtn = '';
        if (isMe) {
            editBtn = `<div onclick="event.stopPropagation(); renameUser()" class="absolute -top-1 -left-1 w-4 h-4 bg-gray-800 rounded-full flex items-center justify-center text-[8px] cursor-pointer hover:bg-red-500 border border-white/20 z-20" title="Cambiar nombre"><i class="fa-solid fa-pen"></i></div>`;
        }

        return `
            <div class="group relative flex flex-col items-center transition-all duration-300 hover:-translate-y-2">
                ${editBtn}
                
                <div onclick="showControlMenu('${name}')" class="w-10 h-10 rounded-full ${baseColor} ${ringColor} flex items-center justify-center text-sm font-bold text-white shadow-lg cursor-pointer relative z-30 hover:scale-110 transition-transform">
                    ${initial}
                    ${count > 1 ? `<div class="absolute -bottom-1 -right-1 w-4 h-4 bg-black text-white text-[9px] rounded-full flex items-center justify-center border border-white/20">${count}</div>` : ''}
                </div>

                <div class="absolute bottom-full mb-2 right-0 bg-black/90 backdrop-blur-md text-white px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10 shadow-xl text-right z-20">
                    <div class="font-bold text-xs mb-0.5 text-emerald-400">${name} ${isMe ? '(Tú)' : ''}</div>
                    ${listeningTo}
                    <div class="text-[9px] text-gray-500 mt-1 italic">Clic para controlar 🎮</div>
                </div>
                <button onclick="renderFolderView()" 
            class="bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white hover:border-yellow-500/50 shadow-2xl rounded-full h-12 w-12 group-hover:w-48 transition-all duration-300 ease-out flex items-center overflow-hidden relative">
        
        <div class="absolute left-0 w-12 h-12 flex items-center justify-center shrink-0">
            <i class="fa-solid fa-folder-tree text-yellow-600 group-hover:text-yellow-400 transition"></i>
        </div>
        
        <span class="pl-12 pr-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-medium text-sm margin-bottom-0.5">
            Explorador de Archivos
        </span>
        
    </button>
            </div>`;
    }).join('');

    container.innerHTML = `
        <div class="flex flex-col items-end">
            <div class="flex flex-row-reverse gap-3 items-end p-2 rounded-2xl bg-black/20 backdrop-blur-sm border border-white/5">
                ${bubblesHtml}
            </div>
        </div>
    `;
}

// 👇 AGREGA ESTA NUEVA FUNCIÓN AL FINAL (Junto a toggleSpeakerMode)
function renameUser() {
    if(confirm("¿Quieres cambiar tu nombre de usuario?")) {
        localStorage.removeItem('kraken_user'); // Borramos la memoria
        location.reload(); // Recargamos para que salte el Prompt de nuevo
    }
}



function showControlMenu(userName) {
    const devices = LAST_USERS_DATA.filter(u => u.name === userName);
    if (devices.length === 0) return;

    const menuHtml = devices.map(dev => {
        const isMe = (dev.is_me === true);
        const status = dev.song ? `<div class="text-[9px] text-emerald-400 truncate w-32 mb-2">🎵 ${dev.song}</div>` : '<div class="text-[9px] text-gray-500 mb-2">Sin reproducción</div>';
        
        // ID único para el acordeón de este dispositivo
        const accordionId = `acc-${dev.session_id}`;

        return `
            <div class="mb-4 border-b border-white/10 pb-4 last:border-0 last:pb-0">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold text-white">Dispositivo</span>
                    ${isMe ? '<span class="text-[8px] bg-gray-700 px-1 rounded text-white">Yo</span>' : ''}
                </div>
                ${status}
                
                <div class="bg-black/20 rounded-lg p-3 flex justify-between gap-1 mb-3 border border-white/5">
                    <button onclick="sendCommand('${dev.session_id}', 'emoji_👋')" class="hover:scale-125 transition-transform text-xl" title="Saludar">👋</button>
                    <button onclick="sendCommand('${dev.session_id}', 'emoji_❤️')" class="hover:scale-125 transition-transform text-xl" title="Amar">❤️</button>
                    <button onclick="sendCommand('${dev.session_id}', 'emoji_🔥')" class="hover:scale-125 transition-transform text-xl" title="Fuego">🔥</button>
                    <button onclick="sendCommand('${dev.session_id}', 'emoji_👻')" class="hover:scale-125 transition-transform text-xl" title="Susto">👻</button>
                    <button onclick="sendCommand('${dev.session_id}', 'emoji_🤬')" class="hover:scale-125 transition-transform text-xl" title="Enojo">🤬</button>
                </div>

                <button onclick="document.getElementById('${accordionId}').classList.toggle('hidden')" 
                        class="w-full py-1.5 bg-white/5 hover:bg-white/10 rounded-md text-[10px] text-gray-400 font-medium flex items-center justify-center gap-2 transition-colors border border-white/5 mb-2">
                    <i class="fa-solid fa-sliders"></i> Controles de Reproducción
                </button>

                <div id="${accordionId}" class="hidden p-2 bg-black/40 rounded-lg border border-white/5 animate-fade-in">
                    
                    <div class="flex justify-center gap-4 mb-3 mt-1">
                        <button onclick="sendCommand('${dev.session_id}', 'prev')" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center border border-white/5"><i class="fa-solid fa-backward-step text-[10px]"></i></button>
                        <button onclick="sendCommand('${dev.session_id}', 'pause')" class="w-10 h-10 rounded-full bg-emerald-500/80 hover:bg-emerald-500 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"><i class="fa-solid fa-power-off text-xs"></i></button>
                        <button onclick="sendCommand('${dev.session_id}', 'next')" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center border border-white/5"><i class="fa-solid fa-forward-step text-[10px]"></i></button>
                    </div>

                    <div class="flex items-center justify-center gap-3">
                        <i class="fa-solid fa-volume-low text-[9px] text-gray-500"></i>
                        <button onclick="sendCommand('${dev.session_id}', 'vol_down')" class="w-8 h-6 rounded bg-gray-700/50 hover:bg-gray-600 flex items-center justify-center border border-white/5"><i class="fa-solid fa-minus text-[8px]"></i></button>
                        <button onclick="sendCommand('${dev.session_id}', 'vol_up')" class="w-8 h-6 rounded bg-gray-700/50 hover:bg-gray-600 flex items-center justify-center border border-white/5"><i class="fa-solid fa-plus text-[8px]"></i></button>
                        <i class="fa-solid fa-volume-high text-[9px] text-gray-500"></i>
                    </div>
                </div>

            </div>
        `;
    }).join('');

    const modalId = 'control-modal';
    const existing = document.getElementById(modalId);
    if(existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in';
    modal.onclick = (e) => { if(e.target === modal) modal.remove(); };
    
    modal.innerHTML = `
        <div class="bg-gray-900 border border-white/10 p-5 rounded-2xl shadow-2xl w-72 animate-scale-up">
            <div class="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
                <h3 class="font-bold text-white text-sm"><i class="fa-solid fa-tower-broadcast mr-1 text-emerald-400"></i> ${userName}</h3>
                <button onclick="document.getElementById('${modalId}').remove()" class="text-gray-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
            </div>
            ${menuHtml}
        </div>
    `;
    document.body.appendChild(modal);
}

function showEmojiModal(emojiChar) {
    // 1. Sonidito de notificación (opcional, usa el del sistema o crea uno simple)
    // const audio = new Audio('/static/notification.mp3'); audio.play().catch(e=>{});

    // 2. Crear Modal
    const modalId = 'emoji-overlay';
    // Si ya hay uno, lo quitamos para poner el nuevo
    const existing = document.getElementById(modalId);
    if(existing) existing.remove();

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
async function sendCommand(targetSid, action) {
    try {
        await fetch(`/control?target=${targetSid}&action=${action}`);
        showToast("📡 Orden enviada...", "success");
    } catch (e) {
        console.error(e);
        showToast("Error enviando orden", "error");
    }
}

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

function formatTimeShort(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const m = Math.floor(total / 60);
    const s = String(total % 60).padStart(2, '0');
    return `${m}:${s}`;
}

function renderShareCardBase(title, artist, coverUrl) {
    const finalTitle = title || 'Sin titulo';
    const finalArtist = artist || 'Artista desconocido';
    const finalCover = coverUrl || '/static/default_cover.jpg';

    const titleEl = document.getElementById('card-title');
    const artistEl = document.getElementById('card-artist');
    const coverEl = document.getElementById('card-cover-bg');
    const bgEl = document.getElementById('card-bg');

    if (titleEl) titleEl.innerText = finalTitle;
    if (artistEl) artistEl.innerText = finalArtist;
    if (coverEl) coverEl.style.backgroundImage = `url('${finalCover}')`;
    if (bgEl) bgEl.style.backgroundImage = `url('${finalCover}')`;
}

function toggleShareCardLyrics(show, payload = {}) {
    const wrap = document.getElementById('card-lyrics-wrap');
    if (!wrap) return;
    if (!show) {
        wrap.classList.add('hidden');
        return;
    }

    const prevEl = document.getElementById('card-lyric-prev');
    const curEl = document.getElementById('card-lyric-current');
    const nextEl = document.getElementById('card-lyric-next');
    const timeEl = document.getElementById('card-lyric-time');

    if (prevEl) prevEl.innerText = payload.prev || ' ';
    if (curEl) curEl.innerText = payload.current || '♪';
    if (nextEl) nextEl.innerText = payload.next || ' ';
    if (timeEl) timeEl.innerText = payload.timeLabel || 'LIVE LYRIC';

    wrap.classList.remove('hidden');
}

function hideShareCardContainer() {
    const container = document.getElementById('share-card-container');
    if (!container) return;
    container.style.opacity = '0';
    container.style.zIndex = '-50';
    container.style.width = '0';
    container.style.height = '0';
}

function showShareCardContainer() {
    const container = document.getElementById('share-card-container');
    if (!container) return;
    container.style.opacity = '1';
    container.style.zIndex = '9999';
    container.style.width = '340px';
    container.style.height = '600px';
}

function downloadShareCanvas(canvas, title) {
    const link = document.createElement('a');
    link.download = `Kraken_${(title || 'track').replace(/\s+/g, '_')}_${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
}

function generateCurrentCardImage(titleForFile) {
    const cardElement = document.getElementById('share-card');
    showShareCardContainer();

    return html2canvas(cardElement, {
        backgroundColor: '#09090b',
        useCORS: true,
        scale: 2,
        logging: false
    }).then(canvas => {
        downloadShareCanvas(canvas, titleForFile);
        showToast('✨ ¡Tarjeta lista para Stories!', 'success');
    }).catch(err => {
        console.error(err);
        showToast('Error generando imagen', 'error');
    }).finally(() => {
        hideShareCardContainer();
        toggleShareCardLyrics(false);
    });
}

function generarTarjeta() {
    const title = document.getElementById('player-title')?.innerText || 'Sin titulo';
    const artist = document.getElementById('player-artist')?.innerText || 'Artista desconocido';
    const currentCover = document.getElementById('player-cover')?.src || '/static/default_cover.jpg';

    renderShareCardBase(title, artist, currentCover);
    toggleShareCardLyrics(false);
    showToast('📸 Generando imagen...', 'info');
    generateCurrentCardImage(title);
}

function generarTarjetaLyric(payload) {
    const title = payload?.title || document.getElementById('player-title')?.innerText || 'Sin titulo';
    const artist = payload?.artist || document.getElementById('player-artist')?.innerText || 'Artista desconocido';
    const cover = payload?.cover || document.getElementById('player-cover')?.src || '/static/default_cover.jpg';

    renderShareCardBase(title, artist, cover);
    toggleShareCardLyrics(true, {
        prev: payload?.prev,
        current: payload?.current,
        next: payload?.next,
        timeLabel: payload?.timeLabel
    });

    showToast('🎤 Generando lyric card...', 'info');
    generateCurrentCardImage(`${title}_lyrics`);
}

let currentContextPath = null;

function openContextMenu(event, path) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    currentContextPath = path;

    // 1. Limpieza preventiva
    const old = document.getElementById('kraken-menu-overlay');
    if (old) old.remove();

    // 2. Datos del archivo
    // Si no encuentra el archivo en la DB, usa el nombre del path
    let file = { title: path.split('/').pop(), artist: 'Desconocido' };
    if (typeof libData !== 'undefined' && libData.files) {
        const found = libData.files.find(f => f.path === path);
        if (found) file = found;
    }

    // 3. Crear el Modal (Z-Index GOD MODE)
    const overlay = document.createElement('div');
    overlay.id = 'kraken-menu-overlay';
    // Usamos cssText para asegurar que nada lo sobreescriba
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 2147483647;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
        display: flex; align-items: flex-end; justify-content: center;
        opacity: 0; transition: opacity 0.2s ease-out;
    `;
    
    overlay.onclick = (e) => { if(e.target === overlay) closeContextMenu(); };

    // 4. El HTML del Menú
    overlay.innerHTML = `
        <div id="kraken-menu-panel" style="
            width: 100%; max-width: 400px; background: #121212;
            border-top: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px 20px 0 0; padding: 20px 20px 40px 20px;
            transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
            box-shadow: 0 -10px 40px rgba(0,0,0,0.8);
        ">
            <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px;">
                <img src="/caratula/${encodeURIComponent(path)}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px; background: #333;" onerror="this.src='/static/default_cover.jpg'">
                <div style="overflow: hidden;">
                    <h3 style="color: white; font-weight: bold; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0;">${file.title}</h3>
                    <p style="color: #10b981; font-size: 11px; margin: 2px 0 0 0;">${file.artist}</p>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
            <button onclick="ctxAction('edit')" style="background: transparent; border: none; width: 100%; padding: 12px; color: #fbbf24; text-align: left; font-size: 14px; display: flex; align-items: center; gap: 15px; cursor: pointer; border-radius: 8px;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                    <i class="fa-solid fa-pen-to-square" style="width: 20px; text-align: center;"></i> Editar etiquetas
                </button>
                

                <button onclick="ctxAction('move')" style="background: transparent; border: none; width: 100%; padding: 12px; color: #60a5fa; text-align: left; font-size: 14px; display: flex; align-items: center; gap: 15px; cursor: pointer; border-radius: 8px;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                    <i class="fa-solid fa-folder-tree" style="width: 20px; text-align: center;"></i> Mover archivo
                </button>

                <div style="height: 1px; background: rgba(255,255,255,0.1); margin: 5px 0;"></div>

                <button onclick="ctxAction('delete')" style="background: transparent; border: none; width: 100%; padding: 12px; color: #ef4444; text-align: left; font-size: 14px; display: flex; align-items: center; gap: 15px; cursor: pointer; border-radius: 8px;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                    <i class="fa-solid fa-trash" style="width: 20px; text-align: center;"></i> Eliminar archivo
                </button>
            </div>

            <button onclick="closeContextMenu()" style="margin-top: 20px; width: 100%; background: #27272a; color: white; padding: 15px; border-radius: 12px; border: none; font-weight: bold;">Cancelar</button>
        </div>
    `;

    document.body.appendChild(overlay);

    // Animación de entrada
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        document.getElementById('kraken-menu-panel').style.transform = 'translateY(0)';
    });
}

function closeContextMenu() {
    const overlay = document.getElementById('kraken-menu-overlay');
    const panel = document.getElementById('kraken-menu-panel');
    if (overlay && panel) {
        panel.style.transform = 'translateY(100%)';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    }
}

function ctxAction(action) {
    if (!currentContextPath) return;
    closeContextMenu();
    
    // Ya no necesitamos safePath - usamos currentContextPath directamente
    if (action === 'edit') abrirEditorMasivo(currentContextPath);
    if (action === 'move') abrirMover(currentContextPath);
    if (action === 'delete') borrar(currentContextPath);
}


function repairPlaylists() {
    if (!confirm("Esto buscará canciones movidas en tus playlists y actualizará sus rutas. ¿Continuar?")) return;

    console.log("🚑 Iniciando reparación de playlists...");
    let fixedCount = 0;
    let lostCount = 0;
    
    // Crear mapa rápido de nombres de archivo -> ruta actual
    // Ejemplo: "Queen.mp3" -> "Musica/Nuevos/Queen.mp3"
    const fileMap = new Map();
    libData.files.forEach(f => {
        const fileName = f.path.split('/').pop(); // Solo el nombre final
        fileMap.set(fileName, f.path);
    });

    // Recorrer todas las playlists
    for (const [playlistName, paths] of Object.entries(libData.playlists)) {
        const newPaths = [];
        let changed = false;

        paths.forEach(oldPath => {
            // 1. ¿Existe la canción en su ruta original?
            const stillExists = libData.files.some(f => f.path === oldPath);

            if (stillExists) {
                // Todo bien, la dejamos igual
                newPaths.push(oldPath);
            } else {
                // 2. ¡NO EXISTE! Ha sido movida o borrada. Vamos a buscarla.
                const fileName = oldPath.split('/').pop();
                const newLocation = fileMap.get(fileName);

                if (newLocation) {
                    // ¡LA ENCONTRAMOS EN OTRA CARPETA! 🕵️‍♂️
                    console.log(`✅ Reparado en [${playlistName}]: ${fileName} se movió a -> ${newLocation}`);
                    newPaths.push(newLocation);
                    fixedCount++;
                    changed = true;
                } else {
                    // No está en ningún lado (borrada definitivamente)
                    console.warn(`❌ Perdida en [${playlistName}]: ${fileName}`);
                    lostCount++;
                    // Opcional: newPaths.push(oldPath); // Descomenta si quieres mantener el link roto
                }
            }
        });

        // Actualizamos la playlist en memoria
        if (changed) {
            libData.playlists[playlistName] = newPaths;
        }
    }

    // Guardar cambios en el servidor
    if (fixedCount > 0) {
        // Asumiendo que tienes una función para guardar. Si no, simulamos la petición.
        fetch('/playlist/save_all', { // Asegúrate de tener esta ruta o usa tu lógica de guardado existente
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(libData.playlists)
        }).then(() => {
            alert(`¡Éxito! Se repararon ${fixedCount} enlaces rotos. (Se perdieron ${lostCount} canciones borradas).`);
            renderLib(); // Refrescar vista
        }).catch(err => alert("Error al guardar las reparaciones: " + err));
    } else {
        alert("Tus playlists están sanas. No se encontraron archivos movidos.");
    }
}


let currentExplorerPath = '';

function renderFolderView(targetPath = '') {
    currentView = 'folders';
    currentExplorerPath = targetPath;
    
    const container = document.getElementById('lib-container');
    const mixesContainer = document.getElementById('smart-mixes-container');
    if (mixesContainer) mixesContainer.classList.add('hidden');
    
    if (!container) return;

    // 1. OBTENER TÉRMINO DE BÚSQUEDA
    const mobileInput = document.getElementById('lib-search-mobile');
    const desktopInput = document.getElementById('lib-search-desktop');
    const term = ((mobileInput && mobileInput.value) || (desktopInput && desktopInput.value) || '').toLowerCase();

    // 2. FILTRAR: ¿Qué archivos viven dentro de esta ruta?
    let filesInPath = libData.files.filter(f => {
        if (targetPath === '') return true;
        return f.path.startsWith(targetPath + '/');
    });

    // 3. APLICAR BÚSQUEDA (SI ESCRIBISTE ALGO)
    // Esto oculta archivos que no coinciden y carpetas vacías de resultados
    if (term) {
        filesInPath = filesInPath.filter(f => {
            const title = (f.title || '').toLowerCase();
            const artist = (f.artist || '').toLowerCase();
            const album = (f.album || '').toLowerCase();
            // Truco: También busca en el nombre del archivo/ruta
            const path = f.path.toLowerCase();
            
            return title.includes(term) || artist.includes(term) || album.includes(term) || path.includes(term);
        });
    }

    // 4. AGRUPAR (Separar carpetas y archivos sueltos)
    const subFolders = new Map();
    const filesHere = [];

    filesInPath.forEach(f => {
        const relativePath = targetPath === '' ? f.path : f.path.substring(targetPath.length + 1);
        const parts = relativePath.split('/');

        if (parts.length > 1) {
            // ES UNA SUB-CARPETA
            const folderName = parts[0];
            const fullFolderPath = targetPath === '' ? folderName : targetPath + '/' + folderName;
            
            if (!subFolders.has(folderName)) {
                subFolders.set(folderName, { 
                    fullPath: fullFolderPath,
                    count: 0,
                    cover: f.path 
                });
            }
            subFolders.get(folderName).count++;
        } else {
            // ES UN ARCHIVO SUELTO en esta carpeta
            filesHere.push(f);
        }
    });

    // Guardamos los archivos visibles para el botón "Play" y "Select All"
    window.currentVisibleFiles = filesHere; 

    // 5. GENERAR HTML (Breadcrumbs + Carpetas + Archivos)
    const breadcrumbs = targetPath.split('/').reduce((acc, part, index, arr) => {
        if (!part) return acc;
        const pathUpToHere = arr.slice(0, index + 1).join('/');
        const safePath = pathUpToHere.replace(/'/g, "\\'");
        return acc + ` <i class="fa-solid fa-chevron-right text-[10px] mx-2 opacity-30"></i> <button onclick="renderFolderView('${safePath}')" class="hover:text-emerald-400 transition">${part}</button>`;
    }, `<button onclick="renderFolderView('')" class="hover:text-emerald-400 font-bold transition flex items-center gap-2"><i class="fa-solid fa-folder-tree"></i> Inicio</button>`);

    let upBtn = '';
    if (targetPath !== '') {
        upBtn = `
        <button onclick="goUpLevel()" class="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition border border-white/10 shadow-lg">
            <i class="fa-solid fa-arrow-up text-zinc-400"></i>
        </button>`;
    }

    let html = `
        <div class="pb-32">
            <div class="mb-6 flex items-center justify-between sticky top-0 bg-[#09090b]/95 backdrop-blur z-30 p-3 rounded-xl border border-white/5 shadow-xl">
                <div class="text-sm text-zinc-300 flex items-center flex-wrap gap-1">
                    ${breadcrumbs}
                </div>
                ${upBtn}
            </div>
            
            ${subFolders.size > 0 ? `
            <div class="mb-2 flex items-center justify-between">
                <h3 class="text-emerald-500 text-[10px] font-bold uppercase tracking-wider">Carpetas (${subFolders.size})</h3>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-8">
                ${Array.from(subFolders.values()).map(folder => {
                    const name = folder.fullPath.split('/').pop();
                    const safePath = folder.fullPath.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    const coverUrl = `/caratula/${folder.cover.split('/').map(p => encodeURIComponent(p)).join('/')}`;
                    
                    return `
                    <div class="group bg-[#121212] hover:bg-[#1e1e1e] border border-white/5 hover:border-yellow-500/30 rounded-xl p-3 transition-all cursor-pointer relative shadow-lg"
                        onclick="renderFolderView('${safePath}')">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="w-10 h-10 rounded-lg bg-zinc-900 overflow-hidden shrink-0 relative">
                                <img data-src="${coverUrl}" class="lazy-img w-full h-full object-cover opacity-60 group-hover:opacity-100 transition" onerror="this.style.display='none'">
                                <div class="absolute inset-0 flex items-center justify-center">
                                    <i class="fa-solid fa-folder text-yellow-600/80 group-hover:text-yellow-500 transition"></i>
                                </div>
                            </div>
                            <div class="min-w-0">
                                <div class="font-bold text-gray-200 text-xs truncate" title="${name}">
                                    ${name.replace(new RegExp(term, 'gi'), match => `<span class="text-yellow-400 bg-yellow-400/20">${match}</span>`)}
                                </div>
                                <div class="text-[9px] text-zinc-500">${folder.count} items</div>
                            </div>
                        </div>
                         <div class="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onclick="event.stopPropagation(); addFolderToPlaylist('${safePath}')" 
                                class="w-6 h-6 rounded-full bg-zinc-800 hover:bg-emerald-500 text-zinc-400 hover:text-black flex items-center justify-center transition" title="Añadir todo">
                                <i class="fa-solid fa-plus text-[10px]"></i>
                            </button>
                        </div>
                    </div>`;
                }).join('')}
            </div>` : ''}

            ${filesHere.length > 0 ? `
            <div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                <h3 class="text-emerald-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2">
                    <i class="fa-solid fa-file-audio"></i> Archivos (${filesHere.length})
                </h3>
                 
            </div>
            
            <div class="${viewMode === 'list' ? 'space-y-1' : `grid ${zoomLevels[currentZoomIndex]} gap-4`}">
                ${filesHere.map(f => {
                    return viewMode === 'list' ? createListRow(f) : createCard(f);
                }).join('')}
            </div>` : 
            (subFolders.size === 0 ? '<div class="text-center text-zinc-600 py-20 flex flex-col items-center gap-2"><i class="fa-solid fa-magnifying-glass text-4xl opacity-50"></i><span>Sin resultados</span></div>' : '')}
        </div>
    `;

    container.innerHTML = html;
    observeLazyImages();
}

function goUpLevel() {
    if (!currentExplorerPath) return;
    const parts = currentExplorerPath.split('/');
    parts.pop(); // Quitamos la última carpeta
    const parentPath = parts.join('/');
    renderFolderView(parentPath);
}

// Función auxiliar para subir un nivel
function goUpLevel() {
    if (!currentExplorerPath) return;
    const parts = currentExplorerPath.split('/');
    parts.pop(); // Quitamos la última carpeta
    const parentPath = parts.join('/');
    renderFolderView(parentPath);
}

// 🔥 LÓGICA PARA BORRAR CARPETA (Pégala abajo de renderFolderView)
function confirmarBorrarCarpeta(folderPath) {
    if(confirm(`⚠️ ¿ESTÁS SEGURO?\n\nVas a eliminar la carpeta "${folderPath}" y TODAS las canciones que contiene.\n\nEsta acción no se puede deshacer.`)) {
        
        // Llamada al Backend (Asegúrate de tener esta ruta en Python)
        fetch('/api/delete_folder_batch', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ folder: folderPath })
        })
        .then(r => r.json())
        .then(data => {
            if(data.status === 'ok') {
                showNotification('Carpeta eliminada', 'success');
                // Recargamos la librería para que desaparezca
                location.reload(); 
            } else {
                alert('Error: ' + data.error);
            }
        });
    }
}

function addFolderToPlaylist(folderPath) {
    console.log("Intentando añadir carpeta:", folderPath);

    // 1. Buscamos archivos que empiecen con esa ruta
    const filesInFolder = libData.files.filter(f => {
        return f.path.startsWith(folderPath + '/');
    });

    if (filesInFolder.length === 0) {
        showNotification("Carpeta vacía o sin audios", "error");
        return;
    }

    const pathsToAdd = filesInFolder.map(f => f.path);

    // 2. Preparamos para el modal
    window.tempPlaylistPaths = pathsToAdd
    
    // 3. Abrimos el modal (Lógica genérica)
    const modal = document.getElementById('playlist-modal');
    if(modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        // Si tienes una función para pintar las listas en el modal, llámala:
        if(typeof renderPlaylistsInModal === 'function') renderPlaylistsInModal();
    } else {
        alert("Error: No encuentro el modal 'playlist-modal' en el HTML");
    }
}

/* ==========================================
   🎤 GESTOR DE LETRAS (LYRICS)
   (Pega esto al final de tu archivo, AFUERA de initApp)
   ========================================== */

let lyricsSyncState = {
    lines: [],
    elements: [],
    currentIndex: -1,
    listEl: null,
    containerEl: null,
    track: null
};

function parseSyncedLyrics(raw) {
    if (!raw || typeof raw !== 'string') return [];

    const out = [];
    const rows = String(raw)
        .split(String.fromCharCode(10))
        .map(v => v.replace(String.fromCharCode(13), ''));
    const tagRegex = /\[([0-9]{1,2}):([0-9]{2})(?:[.:]([0-9]{1,3}))?\]/g;

    for (const row of rows) {
        if (!row || !row.includes('[')) continue;

        const text = row.replace(tagRegex, '').trim();
        if (!text) continue;

        tagRegex.lastIndex = 0;
        let match;
        while ((match = tagRegex.exec(row)) !== null) {
            const mm = Number.parseInt(match[1], 10) || 0;
            const ss = Number.parseInt(match[2], 10) || 0;
            const fracRaw = match[3] || '';

            let frac = 0;
            if (fracRaw.length === 1) frac = Number.parseInt(fracRaw, 10) / 10;
            else if (fracRaw.length === 2) frac = Number.parseInt(fracRaw, 10) / 100;
            else if (fracRaw.length >= 3) frac = Number.parseInt(fracRaw.slice(0, 3), 10) / 1000;

            out.push({
                time: mm * 60 + ss + frac,
                text
            });
        }
    }

    out.sort((a, b) => a.time - b.time);

    const dedup = [];
    const seen = new Set();
    for (const item of out) {
        const k = `${item.time.toFixed(3)}|${item.text}`;
        if (seen.has(k)) continue;
        seen.add(k);
        dedup.push(item);
    }

    return dedup;
}

function stopLyricsSync() {
    if (audioElement) {
        audioElement.removeEventListener('timeupdate', updateSyncedLyricsView);
    }
    lyricsSyncState = {
        lines: [],
        elements: [],
        currentIndex: -1,
        listEl: null,
        containerEl: null,
        track: null
    };
}

function updateSyncedLyricsView(forceScroll = false) {
    const lines = lyricsSyncState.lines;
    if (!lines || !lines.length || !audioElement) return;

    const now = audioElement.currentTime || 0;
    let idx = lyricsSyncState.currentIndex;

    if (idx < 0) idx = 0;
    while (idx + 1 < lines.length && lines[idx + 1].time <= now) idx += 1;
    while (idx > 0 && lines[idx].time > now) idx -= 1;

    if (idx === lyricsSyncState.currentIndex && !forceScroll) return;

    const oldIdx = lyricsSyncState.currentIndex;
    lyricsSyncState.currentIndex = idx;

    const els = lyricsSyncState.elements;
    if (oldIdx >= 0 && els[oldIdx]) {
        els[oldIdx].className = 'text-white/45 text-sm md:text-base leading-relaxed transition-all duration-200';
    }
    if (els[idx]) {
        els[idx].className = 'text-emerald-300 text-lg md:text-xl font-bold leading-relaxed drop-shadow-[0_0_10px_rgba(16,185,129,0.55)] transition-all duration-200';
    }

    const listEl = lyricsSyncState.listEl;
    const containerEl = lyricsSyncState.containerEl;
    const activeEl = els[idx];
    if (listEl && containerEl && activeEl) {
        const target = Math.max(0, activeEl.offsetTop - containerEl.clientHeight * 0.35);
        containerEl.scrollTo({ top: target, behavior: forceScroll ? 'auto' : 'smooth' });
    }
}

function setupSyncedLyrics(track, syncedLines, container) {
    stopLyricsSync();

    const list = document.createElement('div');
    list.id = 'lyrics-sync-list';
    list.className = 'space-y-3 pb-24';

    const elements = syncedLines.map(item => {
        const row = document.createElement('p');
        row.className = 'text-white/45 text-sm md:text-base leading-relaxed transition-all duration-200';
        row.textContent = item.text;
        list.appendChild(row);
        return row;
    });

    container.innerHTML = '';
    container.classList.remove('text-center');
    container.classList.add('text-left');
    container.appendChild(list);

    lyricsSyncState = {
        lines: syncedLines,
        elements,
        currentIndex: -1,
        listEl: list,
        containerEl: container,
        track
    };

    if (audioElement) {
        audioElement.addEventListener('timeupdate', updateSyncedLyricsView);
    }
    updateSyncedLyricsView(true);
}

function getCurrentLyricSnapshot() {
    const track = lyricsSyncState.track || (playerQueue && playerQueue[currentTrackIndex]);
    if (!track) return null;

    if (lyricsSyncState.lines.length && lyricsSyncState.currentIndex >= 0) {
        const idx = lyricsSyncState.currentIndex;
        const lines = lyricsSyncState.lines;
        return {
            title: track.title,
            artist: track.artist,
            cover: document.getElementById('player-cover')?.src || '/static/default_cover.jpg',
            prev: idx > 0 ? lines[idx - 1].text : '',
            current: lines[idx]?.text || '',
            next: idx + 1 < lines.length ? lines[idx + 1].text : '',
            timeLabel: `LYRICS ${formatTimeShort(audioElement?.currentTime || 0)}`
        };
    }

    const plainContainer = document.getElementById('lyrics-text-container');
    const plainLines = (plainContainer?.innerText || '').split(String.fromCharCode(10)).map(v => v.trim()).filter(Boolean);
    if (!plainLines.length) return null;

    return {
        title: track.title,
        artist: track.artist,
        cover: document.getElementById('player-cover')?.src || '/static/default_cover.jpg',
        prev: plainLines[0] || '',
        current: plainLines[1] || plainLines[0] || '',
        next: plainLines[2] || '',
        timeLabel: `LYRICS ${formatTimeShort(audioElement?.currentTime || 0)}`
    };
}

function shareCurrentLyricCard() {
    const snap = getCurrentLyricSnapshot();
    if (!snap || !snap.current) {
        showToast('No hay línea activa para compartir', 'warning');
        return;
    }
    generarTarjetaLyric(snap);
}

async function toggleLyrics() {
    if (!playerQueue || playerQueue.length === 0 || typeof currentTrackIndex === 'undefined') {
        showToast("No hay música sonando", "error");
        return;
    }

    const track = playerQueue[currentTrackIndex];
    const btnBar = document.getElementById('btn-lyrics-bar');
    
    // CERRAR SI YA EXISTE
    const existingOverlay = document.getElementById('lyrics-overlay');
    if (existingOverlay) {
        // Animación de salida
        stopLyricsSync();
        existingOverlay.classList.remove('translate-x-0');
        existingOverlay.classList.add('translate-x-full'); // Se va a la derecha
        setTimeout(() => existingOverlay.remove(), 300);
        
        if(btnBar) btnBar.classList.remove('text-emerald-400', 'animate-pulse');
        return;
    }

    // ABRIR
    if(btnBar) btnBar.classList.add('animate-pulse', 'text-emerald-400');
    showToast("🎤 Buscando letra...", "info");

    // Codificación segura para URL
    const safePath = track.path.split('/').map(p => encodeURIComponent(p)).join('/');

    try {
        const res = await fetch(`/lyrics/${safePath}`);
        const data = await res.json();
        
        if(btnBar) btnBar.classList.remove('animate-pulse');

        if (data.found) {
            const sourceIcon = data.source === 'local' ? 'fa-hard-drive' : 'fa-cloud';

            // CREAR PANEL LATERAL
            const overlay = document.createElement('div');
            overlay.id = 'lyrics-overlay';
            
            // 👇👇 ESTILOS DEL PANEL LATERAL 👇👇
            // Desktop: Panel derecho de 400px o 500px.
            // Mobile: Pantalla completa (inset-0).
            overlay.className = 'fixed top-0 right-0 h-full w-full md:w-[450px] z-[10000] bg-[#0a0a0a]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col transform translate-x-full transition-transform duration-300 ease-out';
            
            overlay.innerHTML = `
                <div class="flex items-center justify-between p-6 border-b border-white/5 bg-black/20 shrink-0">
                    <div class="min-w-0">
                        <h3 class="text-emerald-500 font-bold text-sm uppercase tracking-widest truncate">${track.title}</h3>
                        <p class="text-zinc-500 text-[10px] flex items-center gap-2">
                            <i class="fa-solid ${sourceIcon}"></i> ${data.source === 'local' ? 'Desde Archivo' : 'Desde Internet'}
                        </p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="shareCurrentLyricCard()" class="w-8 h-8 rounded-full bg-emerald-900/30 hover:bg-emerald-700/40 flex items-center justify-center text-emerald-300 transition" title="Compartir lyric card">
                            <i class="fa-solid fa-share-nodes text-xs"></i>
                        </button>
                        <button onclick="toggleLyrics()" class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <div class="flex-1 overflow-y-auto custom-scroll p-6 text-center mask-image-gradient" id="lyrics-text-container">
                </div>

                ${data.source === 'cloud' ? `
                <div class="p-4 border-t border-white/5 bg-black/40 shrink-0 text-center">
                    <button id="btn-save-lyrics" 
                            data-path="${escapeHtml(track.path)}"
                            onclick="saveLyricsFromButton(this)" 
                            class="w-full bg-emerald-900/30 hover:bg-emerald-600 border border-emerald-500/30 text-emerald-400 hover:text-white py-3 rounded-xl transition font-bold text-xs flex items-center justify-center gap-2 group">
                        <i class="fa-solid fa-floppy-disk group-hover:scale-110 transition"></i> GUARDAR EN MP3
                    </button>
                </div>
                ` : ''}
            `;
            
            document.body.appendChild(overlay);

            const lyricsContainer = document.getElementById('lyrics-text-container');
            let syncedLines = parseSyncedLyrics(data.synced_text || '');
            if (!syncedLines.length) {
                syncedLines = parseSyncedLyrics(data.text || '');
            }
            if (syncedLines.length >= 2) {
                setupSyncedLyrics(track, syncedLines, lyricsContainer);
            } else {
                stopLyricsSync();
                const plain = (data.plain_text || data.text || '').split(String.fromCharCode(10)).map(line => {
                    if (typeof escapeHtml === 'function') return escapeHtml(line);
                    return line;
                }).join('<br>');
                lyricsContainer.classList.remove('text-left');
                lyricsContainer.classList.add('text-center');
                lyricsContainer.innerHTML = `<p class="text-white/90 text-lg md:text-xl leading-relaxed font-medium font-sans animate-slide-in pb-20 drop-shadow-md">${plain}</p>`;
            }
            
            // Forzar reflow para que la animación funcione
            setTimeout(() => {
                overlay.classList.remove('translate-x-full');
                overlay.classList.add('translate-x-0');
            }, 10);

            if(btnBar) btnBar.classList.add('text-emerald-400');

        } else {
            showToast("No se encontró letra 😔", "warning");
            if(btnBar) btnBar.classList.remove('text-emerald-400');
        }
    } catch (e) {
        console.error(e);
        showToast("Error de conexión", "error");
        if(btnBar) btnBar.classList.remove('animate-pulse', 'text-emerald-400');
    }
}

// 👇 FUNCIÓN GUARDAR CORREGIDA (Ya no cierra la ventana) 👇
async function saveLyricsFromButton(button) {
    const path = button.dataset.path;
    await saveLyrics(path);
}

async function saveLyrics(pathOrEncoded) {
    const container = document.getElementById('lyrics-text-container');
    const btn = document.getElementById('btn-save-lyrics');
    
    if(!container) return;
    const text = container.innerText; 
    
    // Feedback visual en el botón
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';
    btn.disabled = true;
    
    try {
        // Si viene encoded, decodificar; si no, usar tal cual
        let path = pathOrEncoded;
        try {
            const decoded = decodeURIComponent(pathOrEncoded);
            if (decoded !== pathOrEncoded) path = decoded;
        } catch(e) {
            // Ya estaba decodificado
        }
        
        const res = await fetch('/save_lyrics_to_file', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                path: path,
                text: text
            })
        });
        const d = await res.json();
        
        if(d.ok) {
            showToast("✅ ¡Guardado! Ahora es parte del archivo.", "success");
            
            // Cambiar botón a estado "Éxito"
            btn.className = "w-full bg-emerald-500 text-black border border-emerald-500 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2";
            btn.innerHTML = '<i class="fa-solid fa-check"></i> GUARDADO';
            
            // NO CERRAMOS LA VENTANA, solo actualizamos el estado visual
        } else {
            showToast("❌ Error: " + (d.error || "Desconocido"), "error");
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    } catch(e) {
        showToast("Error de red", "error");
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function updateHeartButton(isFav) {
    if(currentTrackIndex !== -1 && playerQueue[currentTrackIndex]) {
         actualizarVisuales(playerQueue[currentTrackIndex].path, isFav);
    }
}


async function verArtista(artistName) {
    if(!artistName || artistName === "Desconocido") return;

    // 1. Identificar el contenedor
    const container = document.getElementById('lib-container') || document.getElementById('library-container');
    if(!container) return console.error("Falta lib-container");

    // 2. Loader
    container.innerHTML = '<div class="flex items-center justify-center h-64"><i class="fa-solid fa-spinner fa-spin text-4xl text-purple-500"></i></div>';

    try {
        // 3. Cargar datos en paralelo
        const [resApi, localTracks] = await Promise.all([
            fetch('/api/artist/' + encodeURIComponent(artistName)).then(r => r.json()),
            Promise.resolve(libData.files.filter(f => f.artist === artistName))
        ]);

        if (resApi.error) throw new Error("Artista no encontrado");

        // 4. Renderizar
        currentView = 'artist';
        renderArtistPage(container, resApi, localTracks);

    } catch (e) {
        console.error(e);
        showToast("Error: " + e.message, "error");
        // Si tienes la función renderLib, úsala para volver, si no, recarga
        if(typeof renderLib === 'function') renderLib(); 
        else location.reload();
    }
}

function renderArtistPage(container, artist, songs) {
    container.className = "w-full animate-fade-in";
    // 1. Lógica de Imagen / Color
    let heroStyle = '';
    const hash = artist.name.split("").reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0);
    const hue = Math.abs(hash % 360);
    const titleStyle = `color: #f8fafc; text-shadow: 0 8px 24px rgba(0,0,0,0.6);`;
    
    // Si Last.fm manda imagen, la usamos
    const baseGradient = `radial-gradient(120% 140% at 15% 10%, hsla(${hue}, 85%, 55%, 0.55) 0%, transparent 55%),
            radial-gradient(120% 140% at 85% 0%, hsla(${(hue + 40) % 360}, 85%, 50%, 0.45) 0%, transparent 60%),
            linear-gradient(135deg, hsl(${hue}, 45%, 18%) 0%, #09090b 100%)`;

    if (artist.image && artist.image.length > 0) {
        heroStyle = `background-image: ${baseGradient}, url('${artist.image}'); background-blend-mode: screen, normal;`;
    } else {
        heroStyle = `background: ${baseGradient};`;
    }

    // 2. Limpieza de Biografía (Súper segura)
    let bioTexto = "Sin biografía disponible.";
    if (artist.bio && artist.bio.length > 5) {
        // Quitamos HTML
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = artist.bio;
        let textoLimpio = tempDiv.textContent || tempDiv.innerText || "";
        
        // Quitamos basura de Last.fm
        textoLimpio = textoLimpio.replace("Read more on Last.fm", "")
                                 .replace("User-contributed text is available under the Creative Commons By-SA License; additional terms may apply.", "")
                                 .replace("Etiquetas ID3 mal asignadas", ""); // Filtro específico que viste antes
        
        if(textoLimpio.trim()) bioTexto = textoLimpio;
    }

    // 3. HTML (Diseño Final)
    const albums = songs.reduce((acc, song) => {
        const albumName = song.album && song.album.trim() ? song.album : 'Sencillos';
        if (!acc[albumName]) acc[albumName] = [];
        acc[albumName].push(song);
        return acc;
    }, {});
    const albumNames = Object.keys(albums).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    currentArtistTracks = albumNames.flatMap(album => albums[album]);

    let html = `
    <div class="animate-fade-in pb-32">
        <div class="mb-4 flex items-center gap-3">
            <button onclick="renderLib()" class="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition group border border-white/5">
                <i class="fa-solid fa-arrow-left text-zinc-400 group-hover:text-white"></i>
            </button>
            <span class="text-xs font-bold text-zinc-500 uppercase tracking-widest">Volver a la biblioteca</span>
        </div>

        <div class="relative h-56 md:h-72 rounded-3xl overflow-hidden shadow-2xl mb-8 group border border-white/5">
            <div class="absolute inset-0 bg-cover bg-center transition duration-1000 group-hover:scale-105 opacity-80" 
                 style="${heroStyle}">
            </div>
            
            <div class="absolute inset-0 bg-gradient-to-t from-[#09090b] via-black/40 to-transparent"></div>
            <div class="absolute inset-0 bg-black/15"></div>
            
            <div class="absolute bottom-0 left-0 p-6 md:p-10 w-full">
                <h1 class="text-3xl md:text-5xl font-black mb-3 tracking-tight leading-none" style="${titleStyle}">${artist.name}</h1>
                
                <div class="flex flex-wrap gap-2 mb-4">
                    ${artist.tags.map(tag => `
                        <span class="px-3 py-1 bg-white/10 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-bold text-white uppercase tracking-wider shadow-sm hover:bg-white/20 cursor-default">
                            ${tag}
                        </span>
                    `).join('')}
                </div>

                <div class="flex items-center gap-4 text-xs font-bold text-zinc-300">
                    <span class="flex items-center gap-2"><i class="fa-solid fa-music text-purple-400"></i> ${songs.length} Canciones locales</span>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            <div class="lg:col-span-2 space-y-4">
                <h2 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    Canciones en tu PC
                </h2>
                <div class="flex flex-col gap-4">
                    ${songs.length > 0 ? 
                        albumNames.map((album) => {
                            const coverPath = albums[album][0]?.path || '';
                            const coverUrl = coverPath
                                ? `/caratula/${coverPath.split('/').map(p => encodeURIComponent(p)).join('/')}`
                                : '';
                            return `
                            <div class="bg-white/5 rounded-xl border border-white/10">
                                <div class="px-4 py-3 flex items-center justify-between border-b border-white/5">
                                    <div class="flex items-center gap-3 min-w-0">
                                        <div class="w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-zinc-900 shrink-0">
                                            <img src="${coverUrl}" class="w-full h-full object-cover" onerror="this.style.display='none';">
                                        </div>
                                        <h3 class="text-sm font-bold text-white truncate">${album}</h3>
                                    </div>
                                    <span class="text-[10px] text-emerald-400 font-bold">${albums[album].length} pistas</span>
                                </div>
                            <div class="flex flex-col gap-1 p-2">
                                ${albums[album].map((f, i) => createListRowSimple(f, i)).join('')}
                            </div>
                            </div>`;
                        }).join('') :
                        `<div class="p-8 text-center bg-white/5 rounded-xl border border-dashed border-white/10 flex flex-col items-center gap-3">
                            <i class="fa-solid fa-folder-open text-4xl text-zinc-600"></i>
                            <p class="text-zinc-500 text-sm">No tienes archivos locales de este artista.</p>
                         </div>`
                    }
                </div>
            </div>

            <div class="space-y-6">
                <div class="bg-[#121212] p-6 rounded-2xl border border-white/5 shadow-lg">
                    <h3 class="text-sm font-bold text-white mb-3 border-b border-white/5 pb-2">Biografía</h3>
                    <p class="text-zinc-400 text-xs leading-relaxed max-h-60 overflow-y-auto pr-2 scrollbar-thin text-justify whitespace-pre-line">
                        ${bioTexto}
                    </p>
                </div>

                <div>
                    <h3 class="text-sm font-bold text-white mb-3">Artistas Similares</h3>
                    <div class="flex flex-wrap gap-2">
                        ${artist.similar.map(sim => `
                            <button onclick="verArtista(this.dataset.artist)" 
                                    data-artist="${sim.replace(/"/g, '&quot;')}"
                                    class="px-3 py-1.5 bg-zinc-800 hover:bg-purple-900/50 hover:text-purple-300 hover:border-purple-500/30 border border-white/5 text-zinc-300 text-[10px] font-bold uppercase tracking-wide rounded-lg transition">
                                ${sim}
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    container.innerHTML = html;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function createListRowSimple(f, i) {
    // Función simple para listar canciones sin romper nada
    // Usamos escapeHtml si existe, si no, una versión simple inline
    const safeTitle = f.title.replace(/"/g, '&quot;');
    const safeAlbum = (f.album || 'Sencillo').replace(/"/g, '&quot;');
    const safePath = f.path.replace(/"/g, '&quot;');
    const duration = typeof formatTime === 'function' ? formatTime(f.duration) : f.duration;

    return `
    <div class="group flex items-center p-3 rounded-lg hover:bg-white/5 transition cursor-pointer border border-transparent hover:border-white/5"
         data-path="${safePath}"
         onclick="playNow(this.dataset.path)">
        
        <div class="w-8 text-center text-zinc-600 text-sm font-mono mr-4 group-hover:text-purple-400">${i + 1}</div>
        
        <div class="flex-1 min-w-0">
            <div class="text-white font-medium truncate group-hover:text-purple-300 transition">${safeTitle}</div>
            <div class="text-xs text-zinc-500 truncate">${safeAlbum}</div>
        </div>

        <div class="text-xs text-zinc-600 font-mono mr-4">${duration}</div>
    </div>`;
}

// 2. Función para Auto-Completar Géneros (Magia)
async function autoCompletarGeneros() {
    if(!confirm("Esto escaneará tus artistas en Last.fm para asignar géneros automáticamente. Puede tardar un poco. ¿Deseas continuar?")) return;

    showToast("🚀 Iniciando escaneo de géneros...", "info");
    
    const btn = document.getElementById('btn-autotag'); // Asume que creas este botón
    if(btn) btn.disabled = true;

    try {
        const res = await fetch('/api/autotag_library', { method: 'POST' });
        const data = await res.json();
        
        if(data.ok) {
            showToast(data.msg, "success");
            // Recargar biblioteca para ver los cambios
            setTimeout(() => location.reload(), 2000); 
        }
    } catch(e) {
        showToast("Error en el autotagging", "error");
        console.error(e);
    } finally {
        if(btn) btn.disabled = false;
    }
}

// 3. Función para Auto-Tag de Videos (TMDB)
async function autoCompletarVideos() {
    if(!confirm("Esto buscará metadata de TMDB para tus videos y descargará carátulas automáticamente. ¿Deseas continuar?")) return;

    showToast("🔍 Buscando en TMDB...", "info");
    
    const btn = document.getElementById('btn-autotag-video');
    if(btn) btn.disabled = true;

    try {
        const res = await fetch('/api/auto_tag_library_videos', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: window.MASTER_PIN || '' })
        });
        const data = await res.json();
        
        if(data.processed !== undefined) {
            showToast(`✅ Procesados: ${data.processed}, Encontrados: ${data.found}`, "success");
            // Recargar biblioteca para ver los cambios
            setTimeout(() => cargarLib(), 2000); 
        } else if (data.error) {
            showToast("Error: " + data.error, "error");
        }
    } catch(e) {
        showToast("Error en auto-tag de videos", "error");
        console.error(e);
    } finally {
        if(btn) btn.disabled = false;
    }
}

        initApp();
    </script>
</body>
</html>
'''
def precargar_biblioteca():
    global BIB_CACHE, BIB_CACHE_TIME
    try:
        print("📚 Precargando biblioteca...")
        BIB_CACHE = generar_biblioteca_viva()
        BIB_CACHE_TIME = time.time()
        print("✅ Biblioteca lista")
    except Exception as e:
        print("⚠️ Error precargando biblioteca:", e)

class LaunchRequestHandler(AbstractRequestHandler):
    def can_handle(self, handler_input):
        return is_request_type("LaunchRequest")(handler_input)

    def handle(self, handler_input):
        speech_text = "El Kraken ha despertado. ¿Qué deseas reproducir?"
        return handler_input.response_builder.speak(speech_text).set_should_end_session(False).response

# 2. Qué pasa cuando dices "Pon música" (MusicaIntent)
class MusicaIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input):
        return is_intent_name("MusicaIntent")(handler_input)

    def handle(self, handler_input):
        # Llamamos a la nueva variable
        global LAST_ALEXA_COMMAND
        
        print(">>> COMANDO ALEXA: ACTUALIZANDO ORDEN...")
        
        # En lugar de .append, SOBREESCRIBIMOS con la hora actual
        LAST_ALEXA_COMMAND = {
            'action': 'play_mix', 
            'target': 'smart_shuffle',
            'time': time.time() # <--- ESTO ES LA CLAVE (Marca de tiempo)
        }
        
        speech_text = "Entendido, lanzando música aleatoria en Kraken."
        return handler_input.response_builder.speak(speech_text).response

# 3. Configuración del Skill
sb = SkillBuilder()
sb.add_request_handler(LaunchRequestHandler())
sb.add_request_handler(MusicaIntentHandler())

skill_adapter = SkillAdapter(
    skill=sb.create(), 
    skill_id=None, 
    app=app, 
    verifiers=[]
)

if __name__ == '__main__':
    check_ffmpeg()
    init_db()
    precargar_biblioteca()
    print("🐙  KRAKEN V3 - SERVIDOR MULTIMEDIA")
    print("🧹 Iniciando Radar de Usuarios...")
    radar_thread = threading.Thread(target=cleanup_inactive_users, daemon=True)
    radar_thread.start()
    app.run(port=5000, debug=True, use_reloader=True)  # use_reloader=False para evitar doble threading
