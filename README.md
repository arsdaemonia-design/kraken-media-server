# Kraken Media Server — Guía de usuario

Kraken es un servidor multimedia autohospedado para organizar y reproducir música y video desde una biblioteca propia. Incluye una aplicación web, una modalidad de escritorio para Windows, acceso remoto opcional mediante Cloudflare Tunnel y un cliente experimental para Android TV.

> **Estado documentado:** backend/web v5.0.1 y cliente Android TV KrakenTV v5.0.1 (octubre de 2026). Incluye Watch Party interactivo, Danmaku visual en pantalla, control remoto cinemático con soporte de chat/reacciones, backend modular por Blueprints y sincronización en tiempo real.

## Índice

- [Qué ofrece](#qué-ofrece)
- [Requisitos](#requisitos)
- [Instalar y arrancar](#instalar-y-arrancar)
- [Primera configuración](#primera-configuración)
- [Usar la biblioteca](#usar-la-biblioteca)
- [Descargas](#descargas)
- [Música](#música)
- [Video](#video)
- [Subtítulos](#subtítulos)
- [Usuarios, modo niños y bóveda +18](#usuarios-modo-niños-y-bóveda-18)
- [Acceso remoto con Cloudflare Tunnel y dominio](#acceso-remoto-con-cloudflare-tunnel-y-dominio)
- [Google Cast / Chromecast](#google-cast--chromecast)
- [Android TV](#android-tv)
- [Modo escritorio y PWA](#modo-escritorio-y-pwa)
- [Solución de problemas](#solución-de-problemas)
- [Privacidad, respaldo y mantenimiento](#privacidad-respaldo-y-mantenimiento)
- [Documentación relacionada](#documentación-relacionada)

## Qué ofrece

- **Biblioteca de video:** catálogo por películas, series, géneros y categorías; carátulas y metadatos de TMDB; fila Seguir viendo con progreso y reanudación por usuario; tamaños de póster ajustables.
- **Reproducción de video:** DirectPlay/remux cuando es compatible y streaming HLS coordinado por FFmpeg cuando se necesita adaptar el archivo al cliente. Incluye selección de audio, subtítulos, búsqueda temporal, pantalla completa y controles para teclado/táctil. En pantalla completa, el doble toque salta diez segundos hacia atrás/adelante o pausa/reanuda.
- **Subtítulos:** lectura de .srt y .vtt externos, extracción de pistas de texto embebidas, normalización UTF-8 y búsqueda/descarga online con SubDL y Podnapisi según la configuración disponible.
- **Biblioteca de música:** lectura de etiquetas y carátulas, búsqueda, favoritos, playlists, historial, letras .lrc, análisis de BPM/energía y mixes/recomendaciones. La búsqueda de metadatos y géneros puede consultar MusicBrainz, Last.fm y Deezer.
- **Revisión de duplicados:** distingue coincidencias exactas mediante hash de posibles variantes. Las acciones son explícitas; el análisis no elimina archivos por sí solo.
- **Cuentas y controles:** autenticación JWT, cuentas con roles, modo niños y bóveda de contenido adulto protegida con PIN maestro.
- **Control entre dispositivos:** permite seleccionar un dispositivo activo y enviar controles remotos sin mezclar las colas o sesiones independientes de cada equipo.
- **Acceso local o remoto:** red local, dominio propio mediante Cloudflare Tunnel y una URL temporal Quick Tunnel para pruebas.
- **Clientes:** interfaz web adaptable/PWA, ventana de escritorio con pywebview y cliente Android TV experimental. Roku es una idea de roadmap, no una aplicación implementada.

## Requisitos

### Para ejecutar el servidor desde el código

- Windows 10/11 recomendado; Python 3.10 o posterior.
- Dependencias de requirements.txt instaladas en un entorno virtual.
- FFmpeg y FFprobe accesibles por el servidor para generar miniaturas, analizar medios y procesar HLS.
- Espacio de almacenamiento para la biblioteca, cachés, base SQLite y temporales de HLS.

### Para instalar el servidor empaquetado

El repositorio contiene artefactos Windows bajo dist/, incluido el instalador documentado para v4.99.1. La compatibilidad del instalador debe juzgarse por el artefacto concreto que se distribuya; no sustituye el respaldo de la biblioteca ni de los datos de usuario.

## Instalar y arrancar

### Desarrollo en Windows

Desde la carpeta del repositorio:

~~~powershell
python -m venv venv
.envScriptsActivate.ps1
python -m pip install -r requirements.txt
python app.py
~~~

El servidor de desarrollo se configura normalmente en el puerto 5000. En el mismo equipo, abre http://127.0.0.1:5000. Para detenerlo, vuelve a la consola y pulsa Ctrl+C.

### Aplicación de escritorio

app_offline.py integra la interfaz web en una ventana pywebview. En el entorno del proyecto:

~~~powershell
.envScriptsActivate.ps1
python app_offline.py
~~~

La forma de inicio empaquetada depende de los archivos de dist/ y del instalador disponible.

## Primera configuración

1. En una instalación nueva completa el Setup Wizard: crea el usuario administrador inicial, contraseña, PIN maestro y ruta de medios. Si el asistente no aparece, revisa `/api/setup/status` en los logs y que la base SQLite de esa instancia sea nueva/configurada.
2. Inicia sesión con la cuenta de esa instancia. No hay una cuenta comunitaria compartida. Cuando ya existe un administrador, las cuentas adicionales se crean desde administración o mediante invitaciones.
3. Revisa la ruta de biblioteca y apunta Kraken a las carpetas de música y video que quieres indexar.
4. Ejecuta Sync Library / sincronización. Las nuevas filas se guardan en la base SQLite del servidor.
5. Revisa títulos, metadatos y clasificaciones. El etiquetado automático puede completar datos, pero conviene confirmar resultados ambiguos.
6. Configura un PIN maestro propio y crea usuarios con los roles y límites apropiados antes de compartir acceso remoto.
7. Prueba primero desde el navegador del mismo equipo. Después prueba un segundo dispositivo en LAN y finalmente el acceso remoto, si lo habilitas.

Las rutas de almacenamiento se definen desde la configuración del servidor (config.py y/o variables de entorno, según el despliegue). Conserva juntas la base de datos y sus archivos de soporte: al mover la biblioteca no basta con copiar el frontend.

## Usar la biblioteca

- **Buscar y filtrar:** utiliza las vistas de música y video, las categorías y los filtros disponibles. Algunas funciones de catálogo dependen de metadatos importados.
- **Sincronizar:** vuelve a explorar cuando agregues o retires medios. El escaneo y Auto-Tag están coordinados para no competir simultáneamente por SQLite y el disco.
- **Editar metadatos:** utiliza los editores de audio/video para corregir títulos, géneros, ratings, ocultación y otros campos disponibles.
- **Seguir viendo:** el progreso de video se guarda por usuario y se puede reanudar desde la fila correspondiente.
- **Control remoto:** en el radar de dispositivos elige una sesión concreta; “Controlar dispositivo” envía órdenes al equipo elegido, mientras “Reproducir aquí” mantiene la reproducción local.

## Descargas

La vista Descargar acepta enlaces compatibles con yt-dlp y deja analizar el contenido antes de elegir elementos. La interfaz ofrece descarga de video en la mejor calidad disponible o calidades 1080p/720p/480p, y extracción de mejor audio a MP3. El código también integra SpotDL para resolver algunos enlaces de Spotify a una fuente alternativa. La descarga se procesa en segundo plano, muestra avance y permite cancelar; los resultados se guardan en la carpeta configurada y después se vuelven a indexar.

Las plataformas pueden cambiar sus formatos y protecciones; algunos videos no se pueden descargar. Para YouTube y fuentes modernas, yt-dlp puede requerir un runtime JavaScript como Deno y sus dependencias actualizadas. Descarga solo contenido que tengas derecho a guardar.

## Música

Kraken indexa metadatos de audio con Mutagen y puede generar análisis de BPM y energía. La biblioteca ofrece playlists, favoritos, historial, radios/mixes y lectura de archivos de letras .lrc cuando están disponibles. El motor de recomendación usa los tags locales y, si se ejecuta Auto-Tag, puede consultar MusicBrainz, Last.fm o Deezer. Los datos externos pueden faltar o cambiar; los resultados se pueden corregir manualmente.

El detector de duplicados separa archivos idénticos de candidatos parecidos (por ejemplo, versiones en vivo, acústicas o remasterizadas). Revisa cada grupo antes de ocultar o borrar nada. No hay borrado automático del análisis.

## Video

El inicio de Video presenta recomendaciones/carruseles según la biblioteca y una vista de catálogo. TMDB puede aportar póster, backdrop, resumen, año, género y rating. La conexión a TMDB y la calidad de coincidencia dependen de la configuración y los metadatos disponibles.

Al reproducir, Kraken obtiene un token y crea una sesión HLS si el cliente no puede reproducir el medio directamente. FFmpeg puede remuxear o transcodificar según el contenedor, video, audio y pistas. Los archivos grandes en HDD pueden tardar más en comenzar porque deben prepararse los primeros segmentos. HLS requiere que el proceso servidor y FFmpeg permanezcan activos mientras se reproduce.

En escritorio/navegador se documentan atajos de teclado: espacio/K para pausa, flechas izquierda/derecha para buscar ±10 s, arriba/abajo para volumen, M para silencio y F para pantalla completa, respetando campos de texto y diálogos. En móvil, el reproductor incluye doble toque de ±10 s y pausa/reproducción al centro.

## Subtítulos

1. Kraken detecta .srt/.vtt vecinos del video con nombres e idiomas comunes. En carpetas con un solo video hay un fallback de asociación.
2. Auto-Tag puede extraer subtítulos **de texto** embebidos a .srt; subtítulos de imagen como PGS/DVD no se convierten por esta ruta.
3. El buscador online consulta SubDL y conserva Podnapisi como respaldo, según la configuración de proveedores. Descarga y normaliza SRT a UTF-8.
4. En el reproductor selecciona la pista externa o embebida disponible. Audio y subtítulos pueden variar según el códec del archivo y la compatibilidad del cliente.

## Usuarios, modo niños y bóveda +18

- Las cuentas normales se autentican con JWT. Los roles controlan las opciones administrativas disponibles.
- El modo niños excluye videos marcados is_adult y una lista de ratings restringidos tanto del catálogo TV como del token de reproducción.
- La bóveda adulta permanece oculta por defecto en las rutas que aplican este filtro. Para abrirla se requiere el PIN maestro; el servidor también comprueba el PIN antes de emitir token para un video marcado adulto y vuelve a validar el permiso al iniciar HLS.
- is_adult es un campo preexistente de la base de datos: la integración TV no añadió la columna ni clasificó de nuevo toda la biblioteca. El rating puede alimentar esa bandera en flujos de metadatos, pero se deben revisar casos incorrectos.
- Cambia el PIN de instalación por uno único, evita reutilizar contraseñas y no incluyas claves, tokens de Cloudflare ni datos privados en documentos públicos.

## Acceso remoto con Cloudflare Tunnel y dominio

Cloudflare Tunnel permite exponer un servicio web sin abrir un puerto entrante en el router. cloudflared hace una conexión saliente a Cloudflare y enlaza un **hostname público** con un **origen local**, por ejemplo https://media.tudominio.com → http://127.0.0.1:5000. El hostname y la cuenta/dominio pertenecen a quien administra cada servidor. kraken.ederzu.com es solo el dominio de la instalación original; los usuarios de la comunidad deben configurar el suyo.

### Prueba rápida con Quick Tunnel

En el equipo que ejecuta el servidor, inicia Kraken y ejecuta:

~~~powershell
cloudflared tunnel --url http://127.0.0.1:5000
~~~

Cloudflare imprime una URL aleatoria bajo trycloudflare.com. Comparte esa URL únicamente con quienes deben probar el servicio: cualquiera que tenga el enlace puede acceder, y deja de servir cuando se detiene cloudflared. El proyecto también incluye start_offline_tunnel.bat, que intenta iniciar app_offline.py y el túnel rápido; úsalo como herramienta temporal y confirma qué proceso está ejecutando antes de utilizarlo.

Quick Tunnels son para desarrollo/pruebas, no para una instalación permanente. Su hostname es temporal y no hay garantía de disponibilidad. [Documentación oficial de Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

### Dominio persistente con túnel administrado

1. Agrega tu dominio a Cloudflare y configura sus nameservers según las instrucciones de Cloudflare.
2. En Cloudflare Zero Trust / Networking > Tunnels, crea un túnel y agrega una ruta de aplicación publicada.
3. Asigna un subdominio propio (por ejemplo media.tudominio.com) y el origen donde corre Kraken, normalmente http://localhost:5000 si cloudflared y Kraken están en el mismo servidor.
4. Instala/ejecuta cloudflared en el servidor. Para un túnel remotamente administrado, Cloudflare proporciona un comando del estilo:

   ~~~powershell
   cloudflared.exe service install <TUNNEL_TOKEN>
   ~~~

   Ejecútalo en una consola elevada si Windows lo requiere. Mantén el token en un gestor de secretos o configuración privada; no lo subas a Git ni lo pegues en una guía compartida.
5. Comprueba el servicio y la ruta desde fuera de tu red. Asegúrate de que Kraken escuche en el puerto/origen configurado y de que el equipo servidor no esté suspendido.
6. En la pantalla de conexión de Android TV y en los navegadores remotos, cada persona configura la URL HTTPS de **su propia** instancia.
7. Si utilizas Google Cast, configura CAST_PUBLIC_URL con ese mismo hostname público HTTPS y reinicia Kraken. De ese modo las URLs que recibe el dispositivo Cast apuntan al dominio correcto.

Cloudflare termina HTTPS en el borde; el servicio local puede recibir HTTP por loopback dentro del origen del túnel. No publiques el puerto del servidor en el router salvo que tengas una razón concreta y hayas protegido el servicio. Un requisito Cloudflare Access con login web interactivo puede interferir con clientes nativos; prueba autenticación y streaming desde el cliente real.

Guías oficiales: [publicar una aplicación en Tunnel](https://developers.cloudflare.com/tunnel/get-started/) · [servicio de Windows](https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/as-a-service/windows/) · [Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

### Configuración del dominio del servidor

config.py incluye CAST_PUBLIC_URL con un valor histórico de https://kraken.ederzu.com. Para una distribución comunitaria, el administrador debe definir su propia URL por entorno, por ejemplo:

~~~powershell
$env:CAST_PUBLIC_URL = 'https://media.tudominio.com'
python app.py
~~~

No uses el hostname del desarrollador como configuración predeterminada de una app pública. La app Kraken TV almacena una URL introducida por el usuario, y no debe venir preconfigurada para conectarse a un servidor ajeno.

## Google Cast / Chromecast

El dispositivo que recibe Cast debe poder alcanzar la URL del servidor y sus manifiestos/segmentos. Configura CAST_PUBLIC_URL con el dominio HTTPS público de tu instancia, mantén la sesión de Kraken activa y prueba primero con un video pequeño. El soporte depende de los códecs del archivo, de FFmpeg y de las restricciones del receptor Cast.

## Android TV

El cliente Kotlin conocido como KrakenTV incluye login configurable, navegación D-Pad con Leanback, catálogo paginado, pósteres pequeños y reproducción HLS mediante Media3/ExoPlayer. Las series se presentan como una tarjeta por serie y al abrirla se consultan sus episodios. Usa `/api/tv/library`, `/api/tv/episodes`, `/api/tv/poster`, `/api/stream/token` y `/api/hls/play`; necesita un backend Kraken que incluya estas rutas. La sección de música todavía no está integrada en la app TV.

**Estado real al 20-Oct-2026:** el código Android está en el directorio hermano `../KrakenTV`, fuera de este repositorio Git. El backend local incorpora el soporte TV en `routes/api.py` y `routes/hls.py`; el proyecto Android continúa separado de este checkout. El APK debug se compiló con Gradle Wrapper 9.8.2 y se instaló en el AVD Android TV. Se corrigió el cierre de `PlayerActivity` causado por usar el tema Leanback con una actividad AppCompat. El backend local ahora agrupa series y expone sus episodios en `/api/tv/episodes`; el servidor que use la app debe actualizarse para que esas tarjetas agrupadas aparezcan. El cliente requiere HTTPS y cada persona configura la URL de su propio servidor. La música no forma parte todavía del cliente TV.

La configuración Android actual apunta a AGP 9.4.0 y compileSdk 37, minSdk 24, targetSdk 28, bytecode Java 17 y ABI armeabi-v7a. El targetSdk y la compatibilidad real deben revisarse antes de un release. El consumo inferior a 80 MB es una meta de diseño documentada, no una medición verificada.

## Modo escritorio y PWA

La aplicación web es accesible desde el navegador y adapta vistas para móvil. El Service Worker usa una estrategia Network-First para el shell de la app cuando hay conexión y conserva recursos offline. La versión de escritorio usa pywebview. En navegadores Chromium compatibles, el reproductor de música puede guardar canciones, carátulas y playlists en almacenamiento local para reproducirlas sin conexión; el límite configurado en el código es de hasta 500 canciones y puede depender de cuota/espacio del navegador. La función offline no hace que HLS remoto, descargas nuevas ni servicios externos funcionen sin red.

## Solución de problemas

| Síntoma | Qué revisar |
|---|---|
| No abre 127.0.0.1:5000 | Verifica que app.py siga ejecutándose, el puerto configurado y los logs de Flask. |
| No aparecen medios nuevos | Confirma la ruta de biblioteca y ejecuta Sync Library. Revisa permisos de lectura y logs. |
| Video queda cargando | Comprueba FFmpeg/FFprobe, acceso al archivo, espacio temporal y el primer segmento HLS. Los MKV grandes o discos dormidos pueden tardar. |
| Audio AC-3 u otro formato falla | Revisa la ruta de transcodificación y los logs de FFmpeg; algunos clientes necesitan recodificar audio/video. |
| Subtítulos con caracteres rotos | Usa la normalización de SRT/UTF-8 o vuelve a descargar/extractar el archivo. |
| Cast no encuentra el servidor | Verifica CAST_PUBLIC_URL, DNS/Tunnel, HTTPS, sesión y acceso del receptor a las URLs de HLS. |
| Android TV no conecta | Escribe la URL HTTPS del servidor, confirma que se publicó el backend compatible y que el túnel/servidor está encendido. HTTP simple no está aceptado por el cliente actual. |
| Cambié un póster y sigue igual | El endpoint de póster marca caché de un año como immutable. La caché del servidor está en THUMBNAILS_FOLDER/tv_cache; elimina el derivado correspondiente con Kraken detenido o implementa invalidación/versionado antes de automatizar limpieza. |

Para diagnosticar HLS, empieza con un solo archivo representativo y revisa registros del servidor y FFmpeg. Los informes antiguos de _archive/docs_historicos/ describen fallos históricos y no necesariamente el comportamiento actual.

## Privacidad, respaldo y mantenimiento

- Mantén Python, dependencias y cloudflared actualizados.
- Guarda copias de la base de datos de Kraken, configuración de usuario, playlists, historial y metadatos. Conserva los archivos multimedia originales; la base no los reemplaza.
- Mantén runtime_config.json, tokens Tunnel, secretos TMDB/servicios externos y logs fuera del repositorio público.
- No asumas que un Quick Tunnel es privado: cualquier persona con su URL puede intentar acceder.
- El backend guarda tokens de streaming en estado de proceso y las sesiones HLS dependen de que el servidor continúe funcionando.
- Si ejecutas el túnel y servidor en Windows, revisa que el servicio solo arranque una instancia del backend y que el almacenamiento sobreviva a reinicios.

## Documentación relacionada

- [Resumen histórico, decisiones y problemas resueltos](HISTORIAL_TECNICO.md)
- [Notas de versión v4.99](RELEASE_NOTES_v4.99.md)
- [Roadmap e integración TV](SESION_v4.99_ROADMAP_TV.md)
- [Registro cronológico completo](Cambios.md)
- [Diagnósticos históricos](_archive/docs_historicos/)
- [README de Kraken TV](../KrakenTV/README.md) — solo está disponible en el workspace local mientras el proyecto Android permanezca fuera de este repo.
