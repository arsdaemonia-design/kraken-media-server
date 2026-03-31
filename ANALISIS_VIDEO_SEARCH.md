# Análisis Técnico: Problema de Búsqueda en Video

## Resumen Ejecutivo

Este documento analiza por qué la funcionalidad de búsqueda funciona correctamente para el contenido de audio pero falla para el contenido de video en la aplicación Kraken Media Server. La causa raíz es una divergencia arquitectónica fundamental entre cómo se renderizan el audio y el video, específicamente la vista de estilo "Netflix" para video que reconstruye completamente el DOM en cada llamada a `renderLib()`, destruyendo los elementos de input de búsqueda y su estado.

---

## 1. El Problema Principal

### 1.1 Descripción del Síntoma

| Característica | Modo Audio | Modo Video |
|----------------|------------|------------|
| **Persistencia del Input de Búsqueda** | Funciona correctamente - los inputs persisten entre renders | **Roto** - los inputs se recrean en cada pulsación de tecla |
| **Estado de Búsqueda** | Se mantiene entre re-renders | Se pierde inmediatamente, causando parpadeo visual y disruptura de UX |
| **Foco del Input** | Permanece enfocado mientras se escribe | Pierde el foco durante llamadas a `renderLib()` |
| **Botón ✕ para Limpiar** | No aplica | No funciona correctamente |

### 1.2 Causa Raíz

La ruta de renderizado de video (`_renderLibActual()`) en la **línea 6872** contiene una implementación de renderizado completamente separada que:

1. **Recrea todo el DOM del contenedor** en cada llamada de renderizado
2. **Inyecta nuevos elementos de input de búsqueda** inline dentro de las cadenas HTML renderizadas
3. **Destruye el estado existente del input** (valores, foco, posición del cursor) porque los elementos son reemplazados en lugar de actualizarse

Esto contrasta con la ruta de audio que se basa en **inputs HTML estáticos** definidos en la plantilla en las **líneas 1896 y 2013** que persisten entre renders.

---

## 2. Análisis de la Arquitectura del Código

### 2.1 Modo Audio: Patrón de Input Persistente

**Ubicación**: Líneas 1896-1897 (Móvil) y 2013-2014 (Escritorio)

```html
<!-- Input Móvil - Línea 1896 -->
<input type="text" id="lib-search-mobile" onkeyup="renderLib()" placeholder="Buscar...">

<!-- Input Escritorio - Línea 2013 -->
<input type="text" id="lib-search-desktop" onkeyup="renderLib()" placeholder="Buscar...">
```

**Arquitectura**:
- Los inputs se definen una vez en la plantilla HTML estática
- `renderLib()` lee de estos inputs vía `getFilteredTracks()` en las **líneas 6453-6455**
- Los inputs nunca se destruyen/recrean - solo se leen
- El `container.innerHTML` en la **línea 6663** solo afecta el área de **resultados**, no los inputs

**Flujo de Datos**:
```
Usuario escribe → onkeyup dispara → renderLib() → getFilteredTracks() lee input.value → 
Filtros aplicados → Contenedor re-renderizado solo con resultados → Input permanece intacto
```

### 2.2 Modo Video: Patrón de Recreación Inline de Inputs

**Ubicación**: Líneas 6979-6989 (Dentro de `_renderLibActual()` para video)

```javascript
// Línea 6979: El input se recrea como cadena HTML en cada render
const toolbarHtml = `
  <div class="relative flex-1 max-w-xs shrink-0">
    <input type="text" id="video-search" 
      value="${escapeHtml(currentSearchTerm)}" 
      onkeyup="window.netflixSearchTerm = this.value; renderLib();" 
      placeholder="Buscar..."
      class="w-full bg-[#18181b] border border-emerald-700...">
    ${currentSearchTerm ? `
    <button onclick="event.stopPropagation(); window.netflixSearchTerm = ''; renderLib();"...>
      <i class="fa-solid fa-xmark text-xs"></i>
    </button>
    ` : ''}
  </div>
`;
```

**Problema Crítico**:
- El input está embebido en `toolbarHtml` que se inyecta vía `container.innerHTML += toolbarHtml` en la **línea 7060**
- Cada pulsación de tecla activa `renderLib()` que limpia el contenedor en la **línea 6663** y reconstruye todo
- El elemento input es **físicamente destruido** y reemplazado con uno nuevo

### 2.3 El Early Return de la Vista Netflix

**Ubicación**: Líneas 6872-7143

```javascript
// Línea 6872: Bloque de vista estilo Netflix
if (isRoot) {
  container.className = "flex flex-col gap-6...";
  // Líneas 6974-7007: HTML de la barra de herramientas creado aquí con input inline
  // Línea 7060: Input inyectado en el DOM
  container.innerHTML += toolbarHtml;
  // Líneas 7135-7139: Más contenido agregado
  container.innerHTML += `...grid...`;
  // Línea 7142: EARLY RETURN - sale antes de la lógica de audio
  observeLazyImages();
  return; // ← Esto previene llegar a la ruta de audio
}
```

Este early return en la **línea 7142** significa que la ruta de video nunca alcanza la lógica de renderizado compartida en la **línea 7427** donde ocurre el renderizado de lista/cuadrícula de audio.

---

## 3. Secciones de Código en Conflicto

### 3.1 Netflix View Recrea Todo (Líneas 6872-7143)

La implementación de la vista Netflix crea un **universo de renderizado completamente aislado**:

```javascript
// Línea 6663: El contenedor se limpia
container.innerHTML = "";

// Líneas 6872-7142: La vista Netflix construye todo desde cero
if (isRoot) {
  // Líneas 7031-7057: HTML del hero banner
  container.innerHTML += `...`;
  
  // Línea 7060: Barra de herramientas con input de búsqueda
  container.innerHTML += toolbarHtml; // ← Input recreado aquí
  
  // Líneas 7135-7139: Cuadrícula de shows
  container.innerHTML += `...grid...`;
  
  // Línea 7142: Salida antes de la lógica compartida
  return;
}
```

**Problema**: Cada llamada a `renderLib()` limpia `container.innerHTML` y reconstruye toda la UI de Netflix, incluyendo el input de búsqueda.

### 3.2 Audio Mantiene Inputs Persistentes (Líneas 1896, 2013)

El modo audio usa **inputs estáticos de plantilla**:

```html
<!-- Líneas 1896-1897: Búsqueda del header móvil -->
<input type="text" id="lib-search-mobile" onkeyup="renderLib()" ...>

<!-- Líneas 2013-2014: Búsqueda del header escritorio -->
<input type="text" id="lib-search-desktop" onkeyup="renderLib()" ...>
```

Estos existen **fuera** del contenedor que `renderLib()` limpia, por lo que persisten entre renders.

### 3.3 La Condición isSearching que Sale de Netflix (Líneas 6866-6869)

```javascript
// Línea 6866-6869: Condiciones que evitan la vista Netflix
const isRoot = (currentPath === "");
const isSearching = (searchValue.trim().length > 0) || (filters.sort !== 'default' && filters.sort != undefined);

// Línea 6872: La vista Netflix solo se muestra cuando isRoot es true
if (isRoot) {
  // ... renderizado de Netflix
}
```

**Problema Crítico**: La variable `isSearching` se calcula en la **línea 6867**, pero incluso cuando se está buscando, el código Netflix en la **línea 6872** aún se ejecuta porque `isRoot` puede seguir siendo verdadero. La recreación del input de búsqueda ocurre independientemente.

---

## 4. Comparación de Gestión de Estado de Inputs

### 4.1 Flujo de Estado Modo Audio

| Paso | Acción | Ubicación |
|------|--------|-----------|
| 1 | Usuario escribe en input persistente | Líneas 1896, 2013 |
| 2 | `onkeyup="renderLib()"` se dispara | Manejador inline |
| 3 | `getFilteredTracks()` lee valor del input | Líneas 6453-6455 |
| 4 | `container.innerHTML` actualizado con resultados | Línea 6663 |
| 5 | **Input permanece intacto** (fuera del contenedor limpiado) | N/A |

### 4.2 Flujo de Estado Modo Video

| Paso | Acción | Ubicación |
|------|--------|-----------|
| 1 | Usuario escribe en input de Netflix | Línea 6979 |
| 2 | `onkeyup="window.netflixSearchTerm = this.value; renderLib();"` | Manejador inline |
| 3 | `renderLib()` limpia todo el contenedor | Línea 6663 |
| 4 | `_renderLibActual()` reconstruye todo | Líneas 6647+ |
| 5 | **Input es destruido y recreado** | Línea 7060 |
| 6 | Foco se pierde, cursor reinicia, UX rota | Efecto secundario |

---

## 5. Tres Soluciones Posibles

### Solución A: Mantener Enfoque de Sincronización Actual (Parche Rápido)

**Enfoque**: Preservar la arquitectura actual pero agregar lógica de sincronización para mantener el estado del input entre re-renders.

**Implementación**:
1. Almacenar posición del cursor y estado de foco antes de que `renderLib()` limpie el contenedor
2. Restaurar foco después de que la vista Netflix se reconstruya
3. Usar `setTimeout` para asegurar que el DOM esté listo antes de restaurar el foco

**Cambios de Código** (alrededor de la línea 7060):
```javascript
// Antes de que renderLib() limpie el contenedor:
const activeElement = document.activeElement;
const selectionStart = activeElement?.selectionStart;
const selectionEnd = activeElement?.selectionEnd;

// Después de que la UI de Netflix se reconstruye:
if (activeElement?.id === 'video-search') {
  const newInput = document.getElementById('video-search');
  if (newInput) {
    newInput.focus();
    newInput.setSelectionRange(selectionStart, selectionEnd);
  }
}
```

**Pros**:
- Cambios mínimos de código
- Rápido de implementar
- Mantiene el diseño visual de Netflix existente

**Contras**:
- Solución "hacky" que lucha contra el framework
- Condiciones de carrera posibles con `setTimeout`
- Aún recrea DOM innecesariamente (costo de rendimiento)
- No mantenible a largo plazo

---

### Solución B: Vista Unificada (Unificar Audio/Video Completamente)

**Enfoque**: Remover la ruta de renderizado separada de Netflix por completo y hacer que el contenido de video use las mismas vistas de cuadrícula/lista que el audio, con estilos mejorados de tarjetas para programas de TV/películas.

**Implementación**:
1. Remover o simplificar significativamente el bloque `if (currentLibrary === 'video')` en la **línea 6843**
2. Modificar la función `createCard()` en la **línea 7471** para manejar contenido de video con relaciones de aspecto de póster
3. Agregar metadatos de estilo Netflix (info de temporada/episodio) al componente de tarjeta existente

**Cambios de Código**:
```javascript
// Línea 6843: Reemplazar todo el bloque de video con lógica compartida
// Mantener filtrado específico de video pero usar renderizado compartido
if (currentLibrary === 'video') {
  // Establecer clases CSS apropiadas para video
  container.className = `grid ${currentZoomIndex === 2 ? 'grid-cols-2' : 'grid-cols-3'} ...`;
  // Usar misma lógica de renderizado que audio
  filesToShow.forEach(f => container.innerHTML += createVideoCard(f));
}
```

**Pros**:
- Código único para mantener
- Experiencia de usuario consistente
- Mejor rendimiento (sin recreación de DOM)
- Más fácil agregar características (funciona una vez, funciona en todas partes)

**Contras**:
- Pierde el diseño visual distintivo de Netflix
- Requiere rediseñar componentes de tarjetas de video
- Más trabajo de desarrollo inicial
- Puede decepcionar a usuarios que gustaban de la estética de Netflix

---

### Solución C: Inputs Persistentes Separados (Lo Mejor de Ambos Mundos)

**Enfoque**: Mantener el diseño visual de Netflix pero mover el input de búsqueda fuera del contenedor recreado, similar a cómo funciona el modo audio. Usar CSS para posicionar los inputs apropiadamente.

**Implementación**:

**Paso 1**: Agregar inputs de búsqueda estáticos a la plantilla HTML (área de líneas 1849-1862):
```html
<!-- Agregar estos dentro del div view-library, antes del contenedor -->
<div id="video-search-container" class="hidden md:hidden">
  <input type="text" id="lib-search-video" 
    onkeyup="window.netflixSearchTerm = this.value; renderLib();" 
    placeholder="Buscar videos..." class="...">
</div>
```

**Paso 2**: Modificar `setLibraryMode()` en la **línea 3756** para mostrar/ocultar inputs apropiados:
```javascript
function setLibraryMode(mode) {
  // Código existente...
  
  // Mostrar/ocultar inputs de búsqueda basado en modo
  const audioInputs = document.getElementById('audio-search-container');
  const videoInputs = document.getElementById('video-search-container');
  if (audioInputs) audioInputs.classList.toggle('hidden', mode !== 'audio');
  if (videoInputs) videoInputs.classList.toggle('hidden', mode !== 'video');
  
  // Remover búsqueda inline de la generación HTML de Netflix
  // ...
}
```

**Paso 3**: Modificar el bloque Netflix de `_renderLibActual()` (línea 6979) para remover el input inline:
```javascript
// Línea 6974-7007: Remover el input de toolbarHtml
const toolbarHtml = `
  <div class="w-full flex items-center gap-2 px-2 md:px-0 mt-4 mb-4 overflow-x-auto no-scrollbar">
    <!-- REMOVIDO: El input de búsqueda ahora está en HTML estático -->
    <div class="flex gap-2 shrink-0">
      ${pillsHtml}
    </div>
    <!-- ... -->
  </div>
`;
```

**Paso 4**: Actualizar `getFilteredTracks()` en las **líneas 6453-6455** para también leer el input de video:
```javascript
function getFilteredTracks() {
  const mobileInput = document.getElementById('lib-search-mobile');
  const desktopInput = document.getElementById('lib-search-desktop');
  const videoInput = document.getElementById('lib-search-video'); // Agregar esto
  
  let rawTerm;
  if (currentLibrary === 'video' && videoInput) {
    rawTerm = videoInput.value || '';
  } else {
    rawTerm = (mobileInput?.value) || (desktopInput?.value) || '';
  }
  
  // ... resto de la función
}
```

**Pros**:
- Preserva completamente el diseño visual de Netflix
- Los inputs persisten como el modo audio (sin pérdida de foco)
- Separación limpia de responsabilidades
- Arquitectura mantenible a largo plazo
- Rendimiento optimizado (sin recreación innecesaria de DOM)

**Contras**:
- Requiere cambios a la plantilla HTML
- Necesita gestionar visibilidad de múltiples conjuntos de inputs
- Más cambios de código iniciales que la Solución A

---

## 6. Recomendación

**La Solución C (Inputs Persistentes Separados)** es el enfoque recomendado porque:

1. **Experiencia de Usuario**: Elimina el problema de pérdida de foco sin sacrificar el diseño visual
2. **Rendimiento**: Evita la recreación innecesaria de DOM en cada pulsación de tecla
3. **Mantenibilidad**: Sigue el mismo patrón que el modo audio, haciendo el código base más consistente
4. **Escalabilidad**: Más fácil extender con nuevas características (e.g., filtros avanzados, historial de búsqueda)
5. **Riesgo**: Menor riesgo de regresión comparado con la Solución B que remueve rutas de renderizado completas

---

## 7. Apéndice: Referencias de Líneas Clave

| Concepto | Números de Línea |
|----------|------------------|
| Definición de función `renderLib()` | 6641-6646 |
| Inicio de función `_renderLibActual()` | 6647 |
| Lectura de input en `getFilteredTracks()` | 6453-6455 |
| Elementos de input modo audio (Móvil) | 1896-1897 |
| Elementos de input modo audio (Escritorio) | 2013-2014 |
| Inicio de bloque de vista Netflix | 6872 |
| Creación de input de búsqueda de video | 6979-6989 |
| Inyección de barra de herramientas HTML | 7060 |
| Early return de vista Netflix | 7142 |
| Función `setLibraryMode()` | 3756 |
| Función `createCard()` | 7471 |

---

## 8. Conclusión

El problema de la búsqueda en video es fundamentalmente un problema arquitectónico donde la vista de Netflix recrea todo su DOM en cada renderizado, destruyendo los inputs. La Solución C proporciona el mejor equilibrio entre:

- **Preservar la experiencia visual** de Netflix que los usuarios esperan
- **Eliminar el comportamiento roto** de pérdida de foco
- **Mantener un código base sostenible** que no requiera hacks de `setTimeout`

Implementar los inputs persistentes separados requiere más esfuerzo inicial que el parche rápido, pero resulta en una aplicación más robusta, mantenible y con mejor rendimiento a largo plazo.

---

*Versión del Documento: 1.0*  
*Generado: 29 de Marzo, 2026*  
*Archivo analizado: templates/index.html*
