# 🐙 Kraken Media Server — Guía de Uso y Configuración (v5.0.2)

Kraken es un servidor multimedia autohospedado para organizar, descubrir y reproducir música y video desde tu propia biblioteca. Incluye una aplicación web adaptable (PC y móvil), modalidad de escritorio para Windows (`KrakenOffline.exe`), acceso remoto mediante Cloudflare Tunnel y una aplicación 100% nativa en Kotlin para Android TV (`KrakenTV`).

> **Estado documentado:** Backend/Web **v5.0.2 (`v5.0.2.7`)** y cliente Android TV **KrakenTV v5.0.1** (noviembre de 2026). Incluye **Modo Fiesta Colaborativo (`/fiesta`)**, **Catálogo Inteligente TMDB** (Sagas, Hero de Director/Actor, Tráilers Oficiales de YouTube y Similares), **Ruleta Interactiva**, **Favoritos unificados**, **Estadísticas en 3 pestañas**, **Enlaces Compartidos Efímeros (`/share/<token>`)**, **Perfiles Beta temporales**, **Login por QR para TV (`/tv-verify`)** y **Modo Amigo (Watch Party con Danmaku)**.

---

## Índice

1. [Qué ofrece Kraken](#1-qué-ofrece-kraken)
2. [Requisitos e Instalación](#2-requisitos-e-instalación)
3. [Primera configuración y Dominio Público](#3-primera-configuración-y-dominio-público)
4. [Música: Biblioteca, Favoritos, OST Nerd y Enlaces Compartidos](#4-música-biblioteca-favoritos-ost-nerd-y-enlaces-compartidos)
5. [🎉 Modo Fiesta Colaborativo (`/fiesta`)](#5--modo-fiesta-colaborativo-fiesta)
6. [🎬 Video: Catálogo Inteligente, Filtros, Sagas, Ruleta y Tráilers](#6--video-catálogo-inteligente-filtros-sagas-ruleta-y-tráilers)
7. [🍿 Modo Amigo (Watch Party), Radar y Cine Remote](#7--modo-amigo-watch-party-radar-y-cine-remote)
8. [📊 Estadísticas Avanzadas (Música, Video y Global)](#8--estadísticas-avanzadas-música-video-y-global)
9. [Subtítulos y Descargas](#9-subtítulos-y-descargas)
10. [Usuarios, Perfiles Beta Temporales, Modo Niños y Bóveda +18](#10-usuarios-perfiles-beta-temporales-modo-niños-y-bóveda-18)
11. [📺 Android TV Nativo (`KrakenTV`) y Vinculación por Código QR](#11--android-tv-nativo-krakentv-y-vinculación-por-código-qr)
12. [Acceso Remoto con Cloudflare Tunnel y Google Cast](#12-acceso-remoto-con-cloudflare-tunnel-y-google-cast)
13. [Modo Escritorio, PWA y Solución de Problemas](#13-modo-escritorio-pwa-y-solución-de-problemas)
14. [Documentación Relacionada](#14-documentación-relacionada)

---

## 1. Qué ofrece Kraken

- **Biblioteca de Video Inteligente (TMDB):** Catálogo de películas y series con pósters, *backdrops* horizontales 16:9 con encuadre superior, calificación oficial `★ TMDB`, agrupación automática de **Sagas y Franquicias**, filtros por **Director, Actor, Estudio, Década, Duración y Calidad**, **Preview en vivo al pasar el cursor**, **Tráilers oficiales de YouTube**, fila de **Títulos Similares** y **Ruleta Interactiva ("¿Qué vemos hoy?")**.
- **Reproducción de Video Adaptativa:** *Direct Play* / *Remux* (`-c:v copy`) sin pérdida cuando el cliente es compatible (incluyendo 4K en PC/Web y reanudación instantánea con `HTTP 206`), y transcodificación **HLS acelerada por GPU (NVIDIA NVENC)** con salto instantáneo a cualquier minuto (`-ss` server-side) y ajuste automático 1080p Nivel 4.1 para Smart TVs.
- **Biblioteca Musical Completa:** Lectura de etiquetas y carátulas con Mutagen, búsqueda instantánea sin acentos, **Playlist fija de `❤️ Mis Favoritos`**, **Mixes Para Ti** basados en BPM/energía, modo **OST Nerd** (bandas sonoras vinculadas con películas/series/juegos), letras sincronizadas `.lrc`, crossfade e historial real de reproducción.
- **🎉 Modo Fiesta Colaborativo (`/fiesta`):** Sala interactiva con código QR para que tus invitados pidan canciones desde su celular sin necesitar cuenta, voten con `🔥` en tiempo real y alimenten automáticamente la cola de reproducción del anfitrión en orden de popularidad.
- **🔗 Enlaces Compartidos Efímeros (`/share/<token>`):** Comparte cualquier canción mediante un link seguro con caducidad configurable (1 hora a 7 días) que abre un reproductor web independiente con letras sincronizadas.
- **🍿 Watch Party (Modo Amigo) y Cine Remote:** Mira películas o series sincronizadas al segundo con tus amigos conectados (con reacciones **Danmaku** flotantes en pantalla y chat en vivo) o usa tu celular como control remoto táctil de tu TV o PC.
- **📊 Estadísticas en 3 Pestañas:** Panel analítico detallado dividido en **🎵 Música**, **🎬 Video** y **🌐 Resumen Global** (incluyendo gigabytes ocupados en disco por categoría).
- **Cuentas, Perfiles Beta y Bóveda +18:** Autenticación JWT, códigos de invitación permanentes o **Perfiles Beta con expiración temporal**, **Modo Niños** y **Bóveda +18** protegida con PIN maestro.

---

## 2. Requisitos e Instalación

### Ejecutar desde código fuente (Desarrollo / Servidor Local)

- **Sistema Operativo:** Windows 10/11 recomendado; Python 3.10 o superior.
- **Herramientas Multimedia:** `ffmpeg` y `ffprobe` accesibles en el `PATH` o en la carpeta del proyecto.

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

El servidor escucha por defecto en `http://127.0.0.1:5000` (y en tu IP de red local `http://192.168.x.x:5000`).

### Aplicación de Escritorio (`app_offline.py` / Instalador)

Para abrir Kraken en su propia ventana nativa acelerada por hardware (`pywebview`):

```powershell
.\venv\Scripts\Activate.ps1
python app_offline.py
```

También puedes utilizar los ejecutables compilados en `dist/` (`KrakenOffline.exe`, `Kraken.exe` o el instalador `Kraken_Media_Server_Installer_v5.0.1.exe`).

---

## 3. Primera configuración y Dominio Público

1. **Asistente Inicial (Setup Wizard):** Al abrir Kraken por primera vez, crea tu cuenta de **SuperAdmin**, define tu **PIN Maestro** (para proteger ajustes críticos y la bóveda `+18`) y selecciona las carpetas donde almacenas tu música y tus videos.
2. **Sincronización de Biblioteca (`Sync Library`):** Escanea tus carpetas desde el menú lateral o el panel de administración para indexar tus archivos en `kraken.db` (motor SQLite en modo `WAL` de alta concurrencia).
3. **Configuración de URL Pública / Dominio del Servidor (Importante para `/share` y `/fiesta`):**
   - Entra a **Ajustes de Administrador** (icono de engrane o panel Admin).
   - En el campo **URL Pública del Servidor (`public_url`)**, escribe tu dominio externo si usas un túnel como Cloudflare (por ejemplo, `https://kraken.ederzu.com` o `https://media.tudominio.com`) y guarda los cambios.
   - **¿Cómo funciona?**
     - Si configuras un dominio público, tanto los enlaces compartidos (`/share/<token>`) como el código QR y enlace del **Modo Fiesta (`/fiesta`)** usarán automáticamente ese dominio (`https://tudominio.com/fiesta`), permitiendo que tus invitados se conecten incluso con datos móviles (4G/5G).
     - Si lo dejas **en blanco**, Kraken detecta automáticamente la IP LAN local de tu servidor (`http://192.168.x.x:5000`) para funcionar dentro de tu red Wi-Fi doméstica sin requerir internet.

---

## 4. Música: Biblioteca, Favoritos, OST Nerd y Enlaces Compartidos

### Navegación y Reproducción
- **Vistas superiores:** Alterna entre **Todo**, **Tracks**, **Albums**, **Artists** y **Playlists**, o filtra por carpetas desde el menú lateral.
- **Mixes Para Ti:** Kraken analiza BPM, energía e historial para generar mixes dinámicos (*Mis Favoritos*, *Para Ti Hoy*, *Chill & Noche*, *Energía Total*).
- **Historial Real y Cola Contextual:** Al reproducir cualquier canción, Kraken arma una cola contextual (álbum, artista o vista actual) y conserva el historial real de pistas reproducidas para que el botón **Anterior (`⏮`)** regrese siempre a las canciones que acabas de escuchar.

### ❤️ Mis Favoritos (Música)
- Puedes marcar cualquier canción con el icono de corazón `❤️` desde la lista de pistas o desde la barra de reproducción inferior.
- Para ver y reproducir todas tus canciones favoritas juntas, haz clic en **`❤️ Mis Favoritos`** en el menú lateral izquierdo (debajo de *Mi Música*) o toca la tarjeta **Mis Favoritos** dentro de *Mixes Para Ti*.

### 🎻 Modo OST Nerd
- Desde el menú lateral puedes abrir **OST Nerd**, un espacio especializado en bandas sonoras de películas, series, anime y videojuegos que vincula tus pistas musicales con fichas informativas y compositores.

### 🔗 Compartir Canciones con Enlaces Efímeros (`/share/<token>`)
1. Haz clic en el botón de **Compartir** (o menú contextual de una canción) para abrir el modal de enlace compartido.
2. Elige la duración de validez del enlace (**1 hora, 6 horas, 24 horas, 72 horas o 7 días**).
3. Copia el enlace generado (`/share/<token>`). Quien lo abra verá un reproductor web independiente con onda de audio y letras sincronizadas `.lrc`, sin tener acceso al resto de tu servidor. Al cumplirse el tiempo, el enlace caduca automáticamente (`HTTP 410 Gone`).

---

## 5. 🎉 Modo Fiesta Colaborativo (`/fiesta`)

El **Modo Fiesta** convierte a Kraken en una rockola colaborativa en tiempo real para reuniones y fiestas, sin que tus invitados necesiten cuenta ni contraseña.

### Cómo activarlo (Anfitrión)
1. Ve a la vista de **Mi Música** (en PC o desde tu celular).
2. En la barra superior de controles (junto al botón verde **Play All** en escritorio o junto a **Play** en móvil), pulsa el botón **`🎉 Modo Fiesta`**.
3. En la ventana emergente, pulsa **`Activar Modo Fiesta`**.
4. El botón superior mostrará el indicador pulsante **`EN VIVO`** y se desplegará un **Código QR** junto con el enlace directo (ej. `https://kraken.ederzu.com/fiesta` o `http://192.168.x.x:5000/fiesta`).

### Cómo participan los Invitados
1. Los invitados escanean el **Código QR** con la cámara de su teléfono o abren el link `/fiesta`.
2. Escriben su **apodo** (ej. *Aldo*, *Nico*) para identificarse.
3. Desde la pestaña **🔍 Pedir Canción**, buscan cualquier tema de tu biblioteca musical y pulsan **`+`** para agregarlo a la fila.
4. Desde la pestaña **🔥 Fila de la Fiesta**, todos los invitados ven las canciones solicitadas, quién pidió cada una y pueden **votar con `🔥`** por sus favoritas.

### Cómo se sincroniza con la Cola del Anfitrión
- Kraken sincroniza automáticamente la sala cada **4 segundos** con el reproductor del anfitrión:
  - **Si tu reproductor estaba detenido:** En cuanto un invitado pide la primera canción, Kraken la carga e **inicia la reproducción automáticamente**.
  - **Si ya había música sonando:** Las canciones de la fiesta se inyectan justo **después de la canción que está sonando actualmente** (`siguiente en la fila`), desplazando hacia abajo las canciones normales del álbum o mix.
  - **Orden dinámico por votos `🔥`:** Si una canción en espera recibe más fuegos `🔥` que otra, sube automáticamente de posición tanto en los celulares de los invitados como en la cola de reproducción del anfitrión.
  - **Identificación y consumo automático:** En la cola del reproductor del anfitrión verás cada tema etiquetado con `· 🎉 NombreInvitado (🔥votos)`. También puedes forzar su reproducción inmediata con el botón `▶` dentro del modal de Modo Fiesta. Cuando una canción de la fiesta empieza a sonar, se retira automáticamente de la lista de espera de los invitados.

---

## 6. 🎬 Video: Catálogo Inteligente, Filtros, Sagas, Ruleta y Tráilers

### Enriquecimiento Automático con TMDB (`Auto-Tag TMDB`)
- Para enriquecer tus películas y series con metadatos oficiales de **The Movie Database (TMDB)**, abre el panel **Historial / Mantenimiento** en el menú lateral y pulsa **`Auto-Tag TMDB`**.
- Kraken descargará pósters verticales, *backdrops* horizontales 16:9, calificación `★ TMDB`, sinopsis, año, **director, reparto principal con fotografía, estudio/productora, colección/saga oficial** y el **tráiler oficial de YouTube**.

### Barra de Herramientas y Popover Unificado de Filtros (`⚙️ Filtros`)
En la barra superior de **Mis Series y Videos** cuentas con:
- **Selector de Categoría (`Todo`, `Películas`, `Series`, `❤️ Favoritos`, carpetas)** y **Selector de Géneros**.
- **Botón `⚙️ Filtros` (Popover Unificado):** Agrupa de forma limpia:
  - **Década:** `2020s`, `2010s`, `2000s`, `90s`, `80s`, `Clásicos`.
  - **Duración:** Cortas (`< 90 min`), Estándar (`90–120 min`), Épicas (`> 2h`).
  - **Calidad y Estado:** `HD / 4K`, `No vistas`, `En progreso`, `Vistas`.
  - **📚 Agrupar Sagas:** Agrupa las películas que pertenecen a una misma franquicia oficial de TMDB (ej. *Harry Potter*, *Toy Story*, *John Wick*) o secuelas verificadas en una sola tarjeta de colección con botón **`▶ Reproducir Maratón en Orden`**.
- **Selector de Ordenamiento:** Recién agregadas, Calificación TMDB, Año de estreno o Alfabético (`A-Z`).

### Hero de Director / Actor y Películas Similares
- Al abrir el modal de **Más Información** de cualquier película, verás su calificación `★`, estudio, director y las fotos del reparto principal:
  - **Filas de Similares:** En la parte inferior del modal encontrarás el carrusel **"Más títulos similares"** calculado automáticamente según géneros, director, saga y época.
  - **Explorar Director o Actor:** Si haces clic sobre el nombre del **Director** o sobre cualquier **Actor**, el catálogo se filtra por esa persona, oculta los carruseles genéricos de *Explora* y despliega un **Hero Banner dedicado al Director/Actor** junto con una fila de **"Recomendadas similares a su estilo"**.

### 🎬 Tráilers Oficiales de YouTube
- Tanto en el **Hero Banner principal**, como en el modal de **Más Información** y en la **Ruleta**, dispones del botón **`🎬 Ver Tráiler`**.
- **Cómo funciona:** Kraken consulta la clave oficial del tráiler en TMDB (priorizando Español Latino/España y luego Inglés en YouTube) y la guarda en `kraken.db`. Al pulsar el botón, se abre un reproductor flotante 16:9 dentro de Kraken sin salir de la aplicación (con botón de respaldo para buscar en YouTube si es una película independiente sin tráiler registrado en TMDB).

### 🎲 Ruleta Interactiva ("¿Qué vemos hoy?")
- Si no sabes qué ver, pulsa el botón **`🎲 Ruleta`** en la barra superior de Video.
- Filtra opcionalmente por **Películas / Series**, **Género** y **Solo no vistas**, y pulsa **`¡Girar Ruleta!`**.
- La ruleta animará los pósters de tu biblioteca hasta detenerse en una recomendación ganadora, desde donde puedes **Reproducir**, **Ver Tráiler** o **Ver Más Info**.

### Preview en Vivo al Pasar el Cursor (Desktop)
- En computadoras de escritorio, al mantener el cursor brevemente sobre la tarjeta de un video, se despliega un **Preview flotante global** reproduciendo un fragmento silencioso de la película sin recortarse en los bordes del carrusel. En móviles y pantallas táctiles se desactiva automáticamente para garantizar un scroll táctil fluido.

---

## 7. 🍿 Modo Amigo (Watch Party), Radar y Cine Remote

El botón **Radar de Dispositivos** (icono de antena/dispositivos en la barra superior) permite interactuar en tiempo real con tus pantallas y con tus amigos conectados:

### 1. Segunda Pantalla y `Kraken Cine Remote` (Tus propios dispositivos)
- Si inicias una película en tu **Smart TV (`KrakenTV`)** o en la **PC**, y abres Kraken en tu celular con la misma cuenta, aparecerá un aviso invitándote a usar el celular como **Segunda Pantalla (`Cine Remote`)**.
- Desde el **Cine Remote** puedes pausar, reanudar, usar la barra de progreso con *seek* instantáneo, saltar `±10s` / `±30s`, cambiar el volumen, alternar pistas de audio y cambiar subtítulos sin tocar el control remoto del televisor.

### 2. Modo Amigo / Watch Party ("Ver con amigo")
- En el **Radar de Dispositivos**, cuando un amigo tiene sesión iniciada en Kraken, puedes pulsar **`🍿 Ver con amigo (Watch Party)`** junto a su nombre.
- **Sincronización en Tiempo Real:** Tu amigo recibe una invitación en pantalla; al aceptarla, ambos reproductores quedan enlazados (`KRAKEN_SYNC_WATCH_PARTY`). Si cualquiera pausa, reanuda o adelanta el video, el reproductor del otro se sincroniza automáticamente al mismo segundo.
- **Reacciones Danmaku y Chat en Vivo:** Durante la función pueden enviarse mensajes de texto y **super-emojis animados** que cruzan flotando sobre la pantalla del video estilo *Danmaku*, además de contar con una píldora flotante de chat rápido si uno de los dos usa el celular como acompañante.

---

## 8. 📊 Estadísticas Avanzadas (Música, Video y Global)

Para abrir tus estadísticas detalladas, haz clic en el **icono de gráfica dorada (`📊`)** ubicado en la barra superior de contadores (a la izquierda del total de canciones). El modal se divide en **3 pestañas interactivas**:

1. **🎵 Música:** Total de canciones indexadas, horas acumuladas de escucha, conteo de canciones favoritas, **Top 10 Canciones más escuchadas** (con reproducción en 1 clic), **Top Artistas** y distribución de **Géneros Musicales**.
2. **🎬 Video:** Total de películas y series, películas completadas vs. en progreso, horas estimadas de cine/series vistas, calificación promedio `★ TMDB` de tu colección, barra de porcentaje del catálogo visto y géneros cinematográficos favoritos.
3. **🌐 Resumen Global:** Total de medios combinados, **espacio total en disco en GB** (desglosado entre gigabytes de Audio y gigabytes de Video con barra comparativa) e historial de actividad reciente.

---

## 9. Subtítulos y Descargas

### Subtítulos
1. **Locales y Embebidos:** Kraken detecta archivos `.srt` y `.vtt` junto al video y extrae automáticamente subtítulos de texto embebidos en contenedores `.mkv`, normalizándolos a UTF-8.
2. **Búsqueda Online Integrada:** Desde el reproductor puedes buscar y descargar subtítulos en línea a través de **SubDL** y **Podnapisi**.

### Descargas (`yt-dlp` / `SpotDL`)
- Desde la sección **Descargar**, pega un enlace compatible para analizarlo y descargarlo en segundo plano como **Video** (`Mejor calidad`, `1080p`, `720p`, `480p`) o como **Audio MP3**, indexándose automáticamente en tu biblioteca al finalizar.

---

## 10. Usuarios, Perfiles Beta Temporales, Modo Niños y Bóveda +18

### Gestión de Usuarios y Códigos de Invitación (`KRK-XXXX`)
Desde el panel de **Administración**, el SuperAdmin puede generar dos tipos de códigos de invitación:
- **Invitación Permanente:** Crea una cuenta estándar definitiva.
- **⏳ Invitación Beta Temporal:** Permite definir un período de prueba (ej. **24 horas, 48 horas, 3 días, 7 días**). El invitado registra su propio usuario y contraseña, disfruta de Kraken durante ese lapso y, al vencer el plazo, el servidor bloquea automáticamente su acceso (`HTTP 403`). El administrador puede renovarle el tiempo (`+24h`, `+3d`, `+7d`) o ascenderlo a cuenta permanente en cualquier momento desde la lista de usuarios.

### Modo Niños y Bóveda +18
- **Modo Niños:** Oculta todo el contenido clasificado como adulto o con restricción de edad tanto en Web como en Android TV.
- **Bóveda +18:** Los videos marcados como `+18` u ocultos requieren ingresar el **PIN Maestro** tanto para mostrarse en el catálogo como para emitir un token de streaming o iniciar HLS.

---

## 11. 📺 Android TV Nativo (`KrakenTV`) y Vinculación por Código QR

El cliente oficial para televisores (**`KrakenMS.apk`**) cuenta con una interfaz **100% nativa en Kotlin (`NativeTvHomeView.kt`)** diseñada para fluir a 60fps en controles remotos D-Pad:

### Cómo iniciar sesión en tu TV con Código QR (Sin escribir con el control remoto)
1. Abre la app **Kraken TV** en tu televisor; a la izquierda verás un **Código QR** y una clave de 6 caracteres (ej. `K7M - 9P2`).
2. **Opción A (Escanear con cámara):** Escanea el QR con la cámara de tu celular (donde ya tengas sesión iniciada en Kraken) y toca **Autorizar**.
3. **Opción B (Ingresar código desde el menú de perfil):** En Kraken Web (desde tu celular o PC), abre tu menú de perfil arriba a la derecha, selecciona **`📺 Vincular Pantalla (TV)`**, escribe el código de 6 letras y pulsa **Vincular**.
4. Tu televisor iniciará sesión automáticamente y guardará tu sesión de forma persistente (**Auto-Login**).
*(Nota: En navegadores web también puedes usar el botón desplegable **`📲 QR Login`** en la ventana de inicio de sesión).*

### Características de la App Nativa de Android TV
- **Menú Lateral Retráctil en Overlay:** Navega entre **Video** (*Inicio, Películas, Series, Seguir viendo, Descubre hoy*) y **Mi Música** (*Todas las canciones con paginación infinita para +14,400 temas, Mixes Para Ti, Playlists, Álbumes, Artistas*).
- **Buscador Estilo Netflix Dual (Video / Música):** Teclado en pantalla simétrico `6×6` a prueba de pérdida de foco e insensible a acentos/tildes (`fantasia` encuentra *Fantasía*).
- **Vista de Series y Películas TMDB:** Pantalla dedicada de temporadas y episodios panorámicos 16:9 con botón **`▶ Continuar viendo T1:E3`** y **`🎲 Episodio Aleatorio`**.
- **Reproducción 4K Adaptativa:** Detecta automáticamente películas H.264 4K Nivel 5.1 que exceden el límite de hardware de los chips de Smart TV y las transcodifica al vuelo a 1080p por GPU con buffer de `64 MB`, evitando pantallas negras o congelamientos.

---

## 12. Acceso Remoto con Cloudflare Tunnel y Google Cast

### Cloudflare Tunnel
Permite acceder a tu servidor desde fuera de casa con HTTPS sin abrir puertos en el router:
- **Túnel Rápido Temporal (Pruebas):** `cloudflared tunnel --url http://127.0.0.1:5000` (o mediante `start_offline_tunnel.bat`).
- **Dominio Propio Persistente:** Configura un túnel administrado en Cloudflare Zero Trust apuntando tu subdominio (ej. `https://kraken.tudominio.com`) a `http://localhost:5000`, e ingresa ese mismo dominio en el campo **URL Pública del Servidor** dentro de los Ajustes de Administrador de Kraken.

### Google Cast / Chromecast
- Asegúrate de que tu `CAST_PUBLIC_URL` / **URL Pública** sea alcanzable por el Chromecast para transmitir manifiestos HLS y pistas directamente al televisor.

---

## 13. Modo Escritorio, PWA y Solución de Problemas

### PWA y Música Offline
- Desde navegadores compatibles (Chrome/Edge/Android) puedes instalar Kraken como **PWA** y descargar canciones o playlists en la memoria local del navegador (hasta 500 pistas) para escucharlas sin conexión.

### Solución Rápida de Problemas

| Síntoma | Qué revisar |
| :--- | :--- |
| **El QR del Modo Fiesta o link `/share` da `192.168.x.x` en vez de mi dominio** | Abre **Ajustes de Administrador** y verifica que tu dominio (`https://...`) esté guardado en **URL Pública del Servidor**. |
| **Las canciones del Modo Fiesta no suenan en el anfitrión** | Asegúrate de que el **Modo Fiesta** esté en estado **`EN VIVO`** en la ventana del anfitrión; la sincronización ocurre automáticamente cada 4 segundos. |
| **No aparece el tráiler de una película** | Ejecuta **Auto-Tag TMDB** desde el panel *Historial* o pulsa **`🎬 Ver Tráiler`** para que Kraken lo busque en tiempo real en TMDB/YouTube. |
| **Un video tarda en iniciar o falla el audio AC-3** | Verifica que `ffmpeg` y `ffprobe` estén instalados; Kraken transcodificará automáticamente el audio a AAC mediante HLS. |

---

## 14. Documentación Relacionada

- [Documentación Técnica Completa v5.0.1 & v5.0.2](version5.md)
- [Registro Cronológico de Cambios](Cambios.md)
- [Historial Técnico y Arquitectura](HISTORIAL_TECNICO.md)
- [Notas de Versión v4.99](RELEASE_NOTES_v4.99.md)
