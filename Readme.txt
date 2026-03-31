Kraken Media Server

Kraken Media Server es un servidor multimedia local enfocado en audio, con soporte para descarga, catalogación y reproducción de música desde múltiples fuentes (YouTube, playlists, archivos locales), priorizando estabilidad, flujo humano y control explícito sobre automatismos opacos.

El proyecto evita la sobre-ingeniería y asume que las plataformas externas cambian constantemente.

🧠 Principios de diseño

No sobre-ingeniería

Fallar de forma honesta (mostrar estados reales, no “errores mágicos”)

Separar análisis, descarga y reproducción

Priorizar estabilidad antes que nuevas features

Mantener el flujo entendible para humanos

🧰 Stack técnico

Python: 3.10+ (usado vía venv)

Backend: Flask

Descargas: yt-dlp

Post-procesado: ffmpeg / ffprobe

JavaScript runtime (requerido): Deno

Frontend: HTML + JS (SPA ligera)

⚠️ Dependencias críticas
JavaScript runtime (obligatorio)

YouTube y otros sitios requieren ejecución de JavaScript real para extracción completa.

Este proyecto usa Deno, ya que:

es el runtime habilitado por defecto por yt-dlp

no requiere flags adicionales

reduce fricción en Windows

Instalación (Windows PowerShell):

irm https://deno.land/install.ps1 | iex


Verificación:

deno --version

yt-dlp

Se utiliza la versión más reciente estable.

pip install -U yt-dlp yt-dlp-ejs


yt-dlp sin runtime JS está deprecado.
Sin Deno, algunos formatos no estarán disponibles.

ffmpeg / ffprobe

Requeridos para:

merge de audio/video

thumbnails

metadata

Debe ser el binario, no el paquete Python.

📚 Estado actual del proyecto
Biblioteca / UI

Editor masivo funcional

Bug pendiente: “Seleccionar visibles vs toda biblioteca”

Edición de artista (además de género / cover)

Vista de página de artista (hero + canciones + play)

Descargas

Selección persistente

Paginación correcta

yt-dlp con soporte JS real (Deno)

Sistema

Nombre obligatorio al conectarse

Control de usuarios conectados

Modo offline persistente (recientes locales)

🛠️ Notas importantes

yt-dlp cambia frecuentemente: no asumir compatibilidad eterna

El proyecto no intenta ocultar fallos externos

No se garantiza extracción de contenido protegido / DRM