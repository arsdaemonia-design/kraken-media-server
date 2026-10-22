# Resumen técnico e histórico de Kraken

Este documento reúne el estado y el camino de desarrollo que aparece en README.md, RELEASE_NOTES_v4.99.md, Cambios.md, SESION_v4.99_ROADMAP_TV.md y los diagnósticos históricos archivados. Resume decisiones, correcciones y pendientes; no sustituye una prueba de producción ni convierte una propuesta antigua en una función actual.

## 1. Estado del proyecto en octubre de 2026

- El repositorio principal registra el commit 880b320 en master, con soporte TV añadido al backend, edición documental y archivo histórico de 15 documentos. El estado mostrado localmente coincide con origin/master y el árbol de trabajo estaba limpio antes de estos cambios de documentación.
- Backend y web se identifican como v4.99.1. El instalador Windows v4.99.1 aparece en dist y el registro de cambios lo declara compilado.
- El backend es Flask/Python, la interfaz principal es una SPA HTML/JavaScript, la base de catálogo es SQLite, FFmpeg procesa medios y HLS, y pywebview ofrece una ventana de escritorio.
- KrakenTV existe en el workspace como proyecto Kotlin separado en E:Kraken Media ServerKrakenTV. No forma parte del árbol Git del repositorio principal en el commit 880b320; por tanto, clonar solamente el repo no entrega el cliente ni su APK.
- Configuración Android local actual: AGP 9.4.0, compileSdk 37, minSdk 24, targetSdk 28, bytecode Java 17 y ABI armeabi-v7a. No se ha confirmado un APK ni una medición de RAM.
- Roku aparece como posible cliente futuro. No se encontró código de canal Roku; el documento de sesión es especificación/roadmap.
- La URL kraken.ederzu.com y el valor de CAST_PUBLIC_URL en config.py pertenecen a la instalación histórica del autor. No son un servicio comunitario ni deben quedar como servidor predeterminado de un cliente público.

## 2. Arquitectura y flujo de reproducción

### Aplicación web y servidor

app.py inicia el servidor Flask. routes/api.py agrupa autenticación, biblioteca, metadatos, acciones de música y video, y endpoints de clientes. routes/hls.py maneja la negociación de video HLS, playlists, segmentos, pistas y sesiones. services/ contiene acceso SQLite, biblioteca, transcodificación, análisis y otras tareas. templates/index.html ofrece la SPA. app_offline.py y pywebview proporcionan la modalidad de escritorio documentada.

### Video

1. Kraken indexa ruta y atributos del medio en SQLite.
2. El cliente selecciona el video y pide un token de streaming.
3. El backend decide entre reproducir/remuxear de forma directa o arrancar HLS con FFmpeg.
4. Flask entrega playlists y segmentos conforme aparecen.
5. El cliente guarda progreso por usuario y puede reanudar; al cerrar solicita limpiar la sesión HLS.

HLS permite arrancar antes de codificar todo el archivo, pero su preparación inicial depende del tamaño del medio, el códec, el rendimiento de CPU/disco y la generación de los primeros segmentos. Los MKV pesados y los HDD que despiertan lentamente motivaron varias correcciones. HLS no garantiza DirectPlay: cuando el cliente no acepta el contenedor, códec o audio, se puede remuxear o transcodificar.

### Android TV

KrakenTV usa AndroidX Leanback para filas de catálogo y navegación con control remoto; OkHttp para hablar con el servidor; Glide para pósteres; Media3/ExoPlayer para HLS. La pantalla de conexión acepta la URL del servidor y credenciales del usuario; la app no debe llevar una URL personal preconfigurada. El backend TV aporta un catálogo paginado compacto y una variante pequeña de póster.

## 3. Evolución resumida

### Base del producto y releases antiguos

Los documentos de v4.8–v4.86 guardados en _archive/docs_historicos describen la consolidación de la biblioteca musical, reproductor, descarga y catálogo inicial. El downloader actual expone análisis de enlaces y descarga en calidades de video/audio; el backend usa yt-dlp, FFmpeg y una ruta SpotDL para algunos enlaces Spotify. La aplicación de escritorio también incluye un área Offline Files que guarda audio/carátulas y playlists en almacenamiento local del navegador compatible, con límite de 500 pistas configurado. Esa función offline es de audio; no vuelve offline al streaming HLS ni a proveedores externos.

Son contexto histórico; pueden mencionar código, dependencias o pendientes que ya cambiaron. No deben usarse como guía de instalación actual sin contrastarlos con código y README.

### v4.87–v4.91: autenticación, reproducción y acceso entre dispositivos

Cambios.md documenta autenticación JWT, administración de usuarios, protecciones de intentos de login, control remoto y Cast. La decisión del control remoto fue conservar la independencia entre dispositivos: cada equipo mantiene su propia cola/sesión; el radar permite seleccionar una sesión y enviar órdenes sin sobrescribir la reproducción local.

También se adoptó reproducción por ID + token para reducir dependencia de rutas enviadas por el cliente. Para HLS, los estados de reproducción, progreso, reconexión y limpieza se mantienen asociados a sesiones.

### v4.90 y siguientes: Adult Vault y clasificaciones

La bandera is_adult es parte del esquema de medios existente desde antes de los endpoints Android TV. Se alimenta desde ratings/reglas de metadatos y puede ajustarse desde flujos de edición. La interfaz oculta la categoría de adultos hasta desbloquearla con PIN maestro.

La integración TV agregó filtros y verificación de PIN en endpoints. Para un video marcado adulto, POST /api/stream/token comprueba el PIN y almacena adult_authorized en el token en memoria; GET /api/hls/play vuelve a consultar la fila del medio y responde 403 si el registro dice is_adult pero el token no lleva esa autorización. El modo niños también filtra ratings restringidos al consultar catálogo y pedir token. Esto no añadió una columna ni recategorizó por sí mismo toda la biblioteca.

### Septiembre de 2026: estabilización HLS y continuidad

Los diagnósticos históricos registran problemas que aparecieron con listas HLS dinámicas y medios pesados:
- Duración parcial o indeterminada mientras la playlist todavía crecía.
- Primer segmento lento en archivos MKV pesados o discos mecánicos dormidos.
- Segmentos todavía no generados que devolvían 404.
- Respuestas condicionales 304/cache que podían dejar al reproductor sin cuerpo actualizado.
- Pistas de audio que fallaban al cambiar de pista cuando faltaban valores de duración.
- Audio AC-3 no compatible con ciertos navegadores/receptores.
- Reiniciar periódicamente la carga de playlist podía mover el punto de lectura y provocar fallos de decodificación.

Cambios.md registra las respuestas adoptadas: más tiempo para inicializar, margen en el watchdog, entrega de playlist/segmentos sin caché condicional, espera y detección de fragmentos, lógica de transcodificación para audio incompatible, escritura temporal antes de publicar segmentos y reanudación después de tener duración válida. fMP4 se exploró como alternativa configurable y experimental; no debe describirse como una migración universal garantizada.

En esa etapa también se agregó Seguir viendo con progreso persistente por usuario, búsqueda al tiempo guardado, salida activa seleccionable y preferencias de subtítulos.

### Septiembre de 2026: biblioteca musical y duplicados

La documentación registra radio por similitud, análisis BPM/energía y uso de MusicBrainz, Last.fm y Deezer como fuentes de apoyo. Se preservan tags ya válidos para evitar que un proceso automático los sobrescriba. El análisis BPM/energía usa muestras acotadas y normalización.

El detector de duplicados separa coincidencias exactas (hash SHA-256) de candidatos parecidos. Distingue variantes de álbum, en vivo, acústicas y remasterizadas para reducir falsos positivos. El borrado exige acción explícita y PIN; ocultar/restaurar permite conservar archivos sin mostrarlos en la biblioteca normal. Los documentos antiguos que proponen índices o filtros adicionales son propuestas, no confirmación de que todo ese plan se haya implementado.

### Octubre de 2026: subtítulos, optimización y TV

- SubDL v2 queda como proveedor de subtítulos principal configurable; Podnapisi se conserva de respaldo. Los SRT/ZIP descargados se validan, extraen y normalizan a UTF-8. La integración no garantiza resultados para cada película/idioma.
- Auto-Tag puede extraer pistas de subtítulos de texto embebidas. Los subtítulos bitmap como PGS no se vuelven texto con esta ruta.
- Se amplió la detección de nombres de subtítulos vecinos y se preservaron caracteres españoles al servir codificaciones antiguas.
- Se coordinan Sync Library y Auto-Tag mediante un candado para reducir contención de SQLite/disco.
- Se optimizó el JSON de /biblioteca omitiendo claves nulas/específicas de otro tipo de medio. La cifra de más de 130 000 claves menos aparece en el registro de cambios; depende del tamaño real de biblioteca.
- El shell de PWA se describe como Network-First en línea. Esto no equivale a streaming HLS sin conexión.
- Se agregaron gestos de doble toque en video: −10 s en el lado izquierdo, +10 s en el derecho y pausa/reproducción al centro. En pantalla completa se esconden controles tras cuatro segundos de inactividad y se limpiaron títulos con extensión/ID TMDB.
- Para Android TV, routes/api.py añade GET /api/tv/library paginado de hasta 60 elementos y GET /api/tv/poster/<path>. Este último genera un JPEG centrado de 185×278 con calidad 82 y caché de un año. La corrección de Flask es establecer source.direct_passthrough = False antes de source.get_data().
- El endpoint de póster hace la conversión en la propia petición; la documentación anterior que dice “hilo secundario” no coincide con la implementación actual. El tamaño en bytes varía según la imagen, aunque el documento de sesión reporta ~18 KB en una prueba.
- Los nombres de endpoints TV y el bloqueo adulto se integraron en backend; falta probar con una matriz de usuarios, medios y clientes y guardar una prueba reproducible en el repositorio.

## 4. Cloudflare Tunnel, dominio y Cast

El flujo previsto es: cliente → HTTPS del hostname público → Cloudflare → conexión Tunnel saliente de cloudflared → origen local de Kraken, normalmente localhost:5000. Esto evita abrir un puerto entrante del router. El administrador de cada instancia necesita controlar su propio dominio dentro de Cloudflare, configurar una ruta publicada al origen local y mantener cloudflared/servidor disponibles.

### Quick Tunnel

start_offline_tunnel.bat inicia app_offline.py y luego un Quick Tunnel dirigido a 127.0.0.1:5000. El enlace trycloudflare.com es aleatorio y temporal; cualquier persona con el enlace puede intentar abrir la aplicación y deja de funcionar cuando el proceso se cierra. Debe usarse para demos o diagnóstico, no como dominio estable de producción.

### Túnel persistente

Para uso permanente, se documenta un túnel administrado, una ruta publicada con subdominio propio y un servicio Windows. Un comando de instalación puede contener un token de túnel; trátalo como secreto y no lo guardes en README, Cambios.md, capturas públicas ni commits. CAST_PUBLIC_URL debe apuntar al hostname público propio para que Google Cast reciba direcciones alcanzables desde el receptor. El valor actual de config.py sigue usando el dominio histórico como default; antes de distribución comunitaria hay que convertirlo en ejemplo/no default seguro y documentar variables de entorno.

Cloudflare Tunnel no configura automáticamente la autenticación de Kraken. JWT/cuentas del servidor son una capa distinta. Si Cloudflare Access exige un flujo de navegador, hay que probar compatibilidad con clientes Android TV/Cast que no completan login web interactivo.

## 5. Auditoría documental: problemas encontrados

### Documentación coherente con el código

- Las rutas de catálogo TV, póster derivado, token con PIN y revalidación HLS aparecen en backend y en el registro de cambios.
- Los 15 documentos antiguos citados en el commit 880b320 aparecen archivados bajo _archive/docs_historicos.
- La guía de octubre distingue el cliente Android del backend y menciona login por URL configurable, paginación, Leanback y Media3.
- La clasificación is_adult precede a Android TV; los cambios TV aplican filtros a datos existentes.

### Inconsistencias corregidas en README y notas

- El README anterior decía que el póster se generaba en un hilo secundario; el código actual lo hace síncronamente dentro de tv_poster().
- El README anterior mencionaba `gradlew` y SDK 35, aunque el repo principal no contiene el proyecto KrakenTV. El proyecto Android local ya usa compileSdk 37 y ahora incluye Gradle Wrapper 9.8.2.
- Algunas notas describen las rutas TV como autenticadas por cookie o Bearer; get_user_from_request() valida JWT Bearer en Authorization, no cookie.
- El README anterior mostraba kraken.ederzu.com como hostname de producción sin dejar claro que es específico de la instancia original.
- La hoja de ruta solicita probar ese hostname directamente. Debe sustituirse por una base URL configurable del entorno de pruebas.
- Los documentos de release 4.99, el README y Cambios.md cubren cortes distintos: para octubre, Cambios.md y el roadmap TV tenían el material más reciente, pero contenían estado pendiente/SDK ya desactualizado.

### Riesgos o afirmaciones por comprobar

1. **APK debug instalado en Android TV:** Android SDK 37, Build Tools 36.0.0, adb y el AVD `Television (1080p)` están disponibles. El APK actual compila y está instalado en `emulator-5554`. El usuario confirmó reproducción de video; faltan pruebas de pistas, reanudación, perfiles y mediciones de memoria.
2. **Código Android fuera de Git:** un clon del repo principal no puede compilar Android TV. Incluir o publicar por separado el proyecto es un requisito para comunidad.
3. **Autenticación del endpoint de póster:** tv_poster() no exige Bearer explícitamente. La ruta hermana /api/tv/library sí lo hace. Como el póster se sirve con caché pública, se debe decidir documentadamente si es deliberado o corregirlo antes de tratar el API como privado.
4. **Invalidación de pósteres:** las respuestas declaran max-age de un año e immutable; el derivado local se conserva en THUMBNAILS_FOLDER/tv_cache. Cambiar la carátula sin invalidar el hash/archivo puede dejar contenido antiguo en la caché.
5. **Rendimiento de primera carátula:** caratula() puede usar FFmpeg para generar la miniatura ausente; tv_poster() invoca esa función inline. Un video sin póster previo podría hacer esperar la petición.
6. **Mediciones no confirmadas:** “menos de 80 MB” Android TV es un objetivo de diseño pendiente de medir en hardware. “~18 KB” de JPEG depende de la imagen.
7. **Backend compartido:** /api/stream/token y /api/hls/play son endpoints generales tocados para el control adulto. Se requiere regresión de clientes web, escritorio, Android TV y Cast con perfiles normal/adulto/niño.
8. **Configuración de Tunnel:** el README registra un servicio Windows y hostname del servidor principal, pero la documentación Git no demuestra por sí sola que el servicio siga instalado/activo en la máquina.
9. **Prueba de smoke no incluida:** el commit no contiene smoke_tv.py. La nota “verificado” debe quedar atribuida a una ejecución no reproducible o acompañarse de una prueba versionada.

## 6. Pruebas recomendadas antes de distribuir

### Backend

- Sin token, GET /api/tv/library debe responder 401.
- Con JWT normal, el catálogo no debe incluir filas is_adult.
- Con JWT en modo niños, comprobar bloqueos tanto por is_adult como por ratings restringidos.
- En modo normal, probar lista con y sin PIN y verificar total, offset, limit, siguiente página y límite 60.
- Validar GET /api/tv/poster para respuesta 185×278, formato JPEG, bytes, cabeceras y caché fría/caliente. Comprobar ruta inexistente, archivo no imagen y nueva carátula.
- Emitir token para video normal y adulto: PIN incorrecto/ausente debe dar 403 para adulto; token autorizado debe permitir HLS; token manipulado, expirado o de otro id debe fallar.
- Ejecutar regresión del reproductor web existente, cambio de pista, progreso, limpieza de sesión y Cast.
- Mantener cada caso en una prueba automatizada o smoke script versionado con datos de prueba no sensibles.

### Android TV

- Compilar release con Wrapper 9.8.2 e instalar el debug en un AVD Android TV o televisor para validar interfaz y reproducción.
- Revisar login, guardado/cierre de sesión, base URL HTTPS, errores de red, foco/D-Pad y navegación.
- Validar páginas de catálogo, carga y errores de póster.
- Probar HLS, audio/subtítulos, seek, reanudación, adulto y modo niños en emulador y TV física.
- Medir memoria, estabilidad y compatibilidad armeabi-v7a. No publicar la promesa de RAM hasta medirla.

### Distribución

- Incluir el código Android o enlazar su repositorio/release desde el README.
- Eliminar los defaults a dominios y PINs de la instalación del autor.
- Proporcionar configuración por instancia: dominio, CAST_PUBLIC_URL, cuentas, PIN y claves externas.
- No empaquetar tokens Tunnel ni datos/bases privadas.
- Separar documentación del usuario, instalación de servidor, guía de administrador y arquitectura/roadmap.
- Revisar la licencia de Kraken y de dependencias/activos antes de distribuir públicamente.

## 7. Inventario de documentación revisada

### Documentación activa

- README.md: guía de uso/instalación y entrada principal. Actualizada para reflejar el servidor, Cloudflare, clientes y límites de estado.
- RELEASE_NOTES_v4.99.md: resumen de subtítulos, HLS, Adult Vault, optimización de biblioteca y reproductor.
- Cambios.md: timeline detallado desde versiones anteriores; mezcla cambios terminados con notas de sesiones y algunos estados históricos.
- SESION_v4.99_ROADMAP_TV.md: estado del Android TV, API TV, pendientes de build/hardware y roadmap Roku.

### Archivo histórico

Bajo _archive/docs_historicos/ se movieron 15 documentos: análisis TMDB/video search, diagnósticos/configuración HLS, mejoras propuestas, notas 4.76–4.86, guía de testing y una sesión extensa. Se conservan por trazabilidad, pero no se consideran fuente normativa del estado actual. Las propuestas de esos documentos no se deben presentar como funciones hasta comprobarlas en código.

### Regla de mantenimiento sugerida

Cambios.md conserva la cronología; README.md explica cómo instalar/usar; RELEASE_NOTES.md resume un release; SESION/ROADMAP mantiene pendientes; HISTORIAL_TECNICO.md explica decisiones y errores ya enfrentados. Al cambiar código, editar el documento de producto y los pasos de operación en el mismo cambio. Cada afirmación de “probado” debe decir el entorno, el resultado y dónde se conserva la prueba.
