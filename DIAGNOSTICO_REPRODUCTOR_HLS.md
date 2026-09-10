# Diagnostico del reproductor de video y HLS

Fecha: 08-Sep-2026

## Resumen ejecutivo

El problema actual no parece estar en la pelicula `Anticristo (2009)` ni en la capacidad de FFmpeg para transcodificarla. Opera/VLC pueden reproducirla, y Kraken tambien logra generar segmentos HLS validos. El fallo aparece cuando el navegador/WebView debe seguir una playlist HLS progresiva mientras FFmpeg todavia esta transcodificando.

Cambiar a otro repositorio de reproductor podria mejorar la interfaz, pero no garantiza solucionar este caso. Un reproductor diferente seguiria dependiendo de:

- La playlist que entrega Kraken.
- Los segmentos que genera FFmpeg.
- El soporte HLS del motor WebView.
- El manejo de eventos, buffer, pausa, seek y finalizacion.

La alternativa mas segura es separar el problema en dos capas: primero estabilizar el protocolo de entrega; despues evaluar si conviene cambiar la libreria visual del reproductor.

## Evidencia de la sesion fallida

Sesion analizada: `sess_te2mbikyg`.

El log muestra:

- FFmpeg inicia correctamente con `h264_nvenc`.
- El video se codifica a H.264 Main.
- El audio AC-3 se convierte a AAC stereo.
- HLS usa segmentos de aproximadamente 6 segundos.
- El navegador recibe `playlist.m3u8`, `seg_000.ts` y `seg_001.ts`.
- La reproduccion avanza al menos hasta `8.7` segundos.
- El cliente reporta una duracion de `24.024` segundos y despues deja de pedir nuevos segmentos.

Al revisar el directorio temporal de esa misma sesion, el resultado fue distinto al del log parcial:

- Se generaron segmentos desde `seg_000.ts` hasta al menos `seg_168.ts`.
- El archivo `playlist.m3u8` continuo creciendo.
- La playlist no tenia `#EXT-X-ENDLIST` mientras FFmpeg seguia trabajando.
- Los segmentos generados tenian tamanos y tiempos validos.

Esto confirma que el servidor no se quedo detenido en el segundo 19. El cliente dejo de avanzar aunque el servidor siguio produciendo datos.

## Flujo actual

1. El usuario selecciona un video.
2. Kraken analiza el contenedor, el codec de video y las pistas de audio.
3. Si el archivo no es compatible directamente con el navegador, se crea una sesion HLS.
4. FFmpeg escribe `playlist.m3u8` y segmentos `.ts` en una carpeta temporal.
5. Flask sirve la playlist y los segmentos mediante rutas HTTP.
6. ArtPlayer muestra la interfaz.
7. HLS.js descarga la playlist y los segmentos y los conecta al elemento HTML `<video>`.
8. Kraken reporta progreso, estado, pausa, reproduccion y finalizacion al sistema de sesiones.

Por lo tanto, el reproductor visible no es una sola pieza. Actualmente intervienen ArtPlayer, HLS.js, el elemento `<video>`, Flask, FFmpeg y el WebView.

## Archivos involucrados

### `services/hls_transcoder.py`

Responsabilidades:

- Analizar codecs y pistas.
- Decidir si hay reproduccion directa, remux o transcodificacion.
- Elegir `h264_nvenc` cuando esta disponible.
- Convertir AC-3 a AAC.
- Crear segmentos HLS.
- Usar video H.264 Main, GOP estable y puntos de entrada frecuentes cuando se necesita reencode.
- Generar playlist progresiva con `-hls_playlist_type event`.

Riesgos de esta capa:

- La deteccion de compatibilidad puede ser demasiado optimista.
- `h264_nvenc` depende del driver y de la GPU.
- La transcodificacion en tiempo real puede ser mas lenta que la lectura del archivo.
- La playlist crece mientras el cliente ya esta intentando reproducirla.
- Los timestamps de ciertos archivos pueden requerir normalizacion adicional.

### `routes/hls.py`

Responsabilidades:

- Crear y registrar sesiones HLS.
- Esperar a que existan segmentos iniciales.
- Entregar `playlist.m3u8` y archivos `.ts`.
- Proteger el acceso mediante tokens cuando corresponde.
- Reportar cantidad de segmentos y vida de la sesion.
- Detener y limpiar sesiones.

Correcciones aplicadas:

- Las playlists y los segmentos se sirven sin cache, ETag ni respuestas `304`.
- Se actualiza `last_activity` cuando se solicita contenido HLS.

Riesgos de esta capa:

- Una playlist parcialmente escrita debe leerse siempre en un momento valido.
- La limpieza de sesiones no debe terminar FFmpeg mientras el navegador sigue reproduciendo.
- El cliente podria conservar una playlist antigua si el WebView ignora los encabezados o si HLS.js no vuelve a solicitarla.

### `templates/index.html`

Responsabilidades:

- Inicializar ArtPlayer.
- Conectar HLS.js al elemento `<video>`.
- Esperar buffer inicial.
- Recuperar errores de red o media.
- Actualizar el reproductor y el loader.
- Reportar progreso y estado.
- Controlar fullscreen, pistas de audio, subtitulos y finalizacion.

Correcciones aplicadas:

- Se usa `autoStartLoad` en HLS.js.
- El inicio puede dispararse despues de recibir dos fragmentos `FRAG_BUFFERED`.
- Se agrego recuperacion limitada para errores fatales.
- Se agrego refresco del playlist cada 4 segundos mientras la sesion esta activa.
- Se agrego el log `LEVEL_LOADED` para comprobar si HLS.js ve crecer la playlist.
- Se corrigieron selectores del video usados por el heartbeat y el progreso.

Riesgos de esta capa:

- ArtPlayer puede reflejar una duracion inicial corta aunque HLS.js ya tenga mas segmentos.
- Un WebView puede tener restricciones de autoplay, Media Source Extensions o fullscreen.
- Un error de HLS.js puede parecer un problema de FFmpeg aunque FFmpeg siga trabajando.
- La logica global del archivo es extensa y comparte estado con audio, control remoto y movil.

### `assets/hls.min.js`

La copia actual corresponde a HLS.js `1.5.14`.

HLS.js es responsable de:

- Leer la playlist.
- Recargarla cuando es una transmision progresiva.
- Solicitar segmentos.
- Alimentar Media Source Extensions.
- Reportar errores de red y decodificacion.

Cambiar esta libreria puede ser util, pero no elimina las dependencias del formato HLS ni del motor del navegador.

### `assets/artplayer.js`

ArtPlayer es principalmente la capa visual y de controles. No es quien transcodifica el video. Cambiar ArtPlayer puede mejorar fullscreen, controles, pistas y apariencia, pero HLS.js seguiria siendo necesario si se mantiene HLS.

### `routes/api.py`, `state.py` y logica de sesiones

Estas piezas participan en:

- Estado de reproduccion.
- Heartbeats.
- Progreso del usuario.
- Control entre dispositivos.
- Sesiones HLS activas.

No deben modificarse durante una migracion visual sin pruebas, porque audio y video comparten parte del estado global.

## Causas confirmadas

### Confirmado: FFmpeg si continua generando contenido

La carpeta de la sesion contiene muchos segmentos posteriores a `seg_001.ts`. Por eso el proceso de transcodificacion no es el punto donde se detiene el video.

### Confirmado: el cliente recibe inicialmente una duracion corta

El estado reporta `duration=24.024`, que corresponde a los primeros segmentos visibles cuando se creo la playlist. Esa duracion no representa la duracion real de la pelicula.

### Confirmado: el cliente no mantiene el avance observado en el log

El log deja de mostrar nuevas solicitudes de playlist y segmentos aunque el directorio sigue creciendo. Eso apunta a HLS.js, Media Source Extensions, el WebView o la forma en que ArtPlayer maneja la playlist `EVENT`.

### Corregido previamente: incompatibilidad potencial por AC-3 y H.264 copiado

Cuando el audio requiere transcodificacion, Kraken ahora tambien puede reencodear el video a H.264 Main. Esto evita mezclar un video copiado con timestamps o puntos de entrada problematicos.

### Corregido previamente: cache HTTP

Se eliminaron ETag y respuestas `304` para playlist y segmentos. Asi se evita que el cliente reciba una respuesta validada sin el cuerpo actualizado.

## Causas todavia posibles

1. HLS.js interpreta la playlist `EVENT` como una fuente cuyo progreso no necesita recarga en ese estado particular.
2. ArtPlayer conserva la duracion inicial y no actualiza correctamente la duracion cuando llegan nuevos segmentos.
3. El WebView tiene una implementacion incompleta o particular de Media Source Extensions.
4. El cliente entra en estado pausado o `IDLE` internamente aunque el elemento `<video>` parezca iniciado.
5. Existe un error de decodificacion no visible en el log del servidor y solo disponible en la consola del navegador.
6. La transcodificacion produce segmentos validos, pero el navegador rechaza algun cambio de buffer o timestamp despues del segundo segmento.
7. El refresco periodico necesita sincronizarse mejor con el estado interno de HLS.js y no solo llamar `startLoad()`.

## Es mas facil cambiar de repositorio?

Depende de que se quiera cambiar.

### Cambiar solo la libreria visual

Ejemplos: Video.js, Plyr, MediaElement.js o Shaka Player.

Ventajas:

- Puede mejorar controles, fullscreen, accesibilidad y apariencia.
- Permite aislar mejor la interfaz del reproductor.
- Puede facilitar una futura migracion a DASH o MP4 fragmentado.

Desventajas:

- No arregla automaticamente una playlist HLS que el cliente deja de recargar.
- Hay que reconectar audio tracks, subtitulos, progreso, control remoto y eventos `ended`.
- ArtPlayer ya esta integrado con muchas funciones globales de Kraken.
- Video.js o Plyr normalmente seguirian necesitando HLS.js en Chromium/WebView.

### Cambiar HLS.js por otro cliente

Puede ayudar si el problema es especifico de HLS.js, pero primero hay que confirmar en consola que el evento de bloqueo procede de HLS.js. Si el WebView es el problema, otra libreria podria fallar igual.

### Cambiar HLS por DASH o MP4 fragmentado

Esta es la migracion con mas posibilidades de resolver estructuralmente el problema, especialmente si se genera un manifiesto compatible con reproduccion progresiva y seek. Tambien es la de mayor alcance porque afecta FFmpeg, rutas, cliente, subtitulos, progreso, dispositivos y pruebas moviles.

### Cambiar todo el repositorio

No es la primera opcion recomendada. El reproductor es solo una parte de Kraken. Tambien habria que reconstruir:

- Biblioteca y filtros.
- Usuarios y permisos.
- Compartir canciones.
- Sesiones entre dispositivos.
- Control remoto.
- Audio y listas.
- Videos, series, subtitulos y progreso.
- Modo movil y WebView.

El costo y el riesgo serian mucho mayores que aislar primero el problema de entrega de video.

## Recomendacion

### Corto plazo

1. Probar la version actual con un reinicio completo del backend y `Ctrl + F5`.
2. Revisar la consola del navegador y confirmar logs `Playlist actualizado`.
3. Confirmar que aparecen nuevas solicitudes a `playlist.m3u8`, `seg_002.ts`, `seg_003.ts` y posteriores.
4. Comparar el comportamiento en Opera, Chrome/WebView y VLC.
5. Mantener intactos audio, sesiones y control remoto durante esta prueba.

### Mediano plazo

Separar la implementacion HLS de la inicializacion visual de ArtPlayer en un modulo propio. El modulo deberia exponer solamente:

- `load(source)`.
- `play()`.
- `pause()`.
- `seek(seconds)`.
- `setAudioTrack(index)`.
- `destroy()`.
- Eventos de `timeupdate`, `buffer`, `error` y `ended`.

Esto reduciria el riesgo de seguir parchando `index.html` y permitiria comparar ArtPlayer, Video.js o Shaka sin reescribir la logica de Kraken.

### Largo plazo

Evaluar una segunda ruta de entrega:

- HLS para compatibilidad actual.
- DASH o MP4 fragmentado para navegadores/WebView que presenten problemas con playlists `EVENT`.

La seleccion podria hacerse por capacidades del cliente y no por tipo de usuario. Mientras tanto, HLS debe conservarse como fallback.

## Criterio para decidir una migracion

No conviene migrar solo porque un video se detiene. La migracion gana sentido si se confirma una de estas condiciones:

- El WebView no soporta de forma confiable la combinacion actual.
- HLS.js presenta un error reproducible que no ocurre con otro cliente usando la misma playlist.
- Se necesita DASH, calidad adaptativa real o controles mas avanzados.
- La separacion de modulos ya esta lista y el costo de reconectar las funciones es controlable.

## Estado actual

- No se hizo commit.
- No se hizo push.
- El backend ya genera segmentos continuos para el caso probado.
- El siguiente dato decisivo debe salir de la consola del navegador/WebView, no solo del log Flask.
- La migracion de reproductor debe hacerse despues de capturar ese dato para no cambiar varias variables al mismo tiempo.
